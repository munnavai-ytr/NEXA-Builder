// Streaming Protocol Parser for NEXA AI Builder
import { VirtualFS } from '../core/fs';

export interface FileOp {
  path: string;
  action: 'create' | 'update' | 'delete';
  content: string;
}

export interface PatchOp {
  path: string;
  find: string;
  replace: string;
}

export interface RunOp {
  command: string;
}

export interface ParsedProtocol {
  files: FileOp[];
  patches: PatchOp[];
  runs: RunOp[];
  cleanedText: string;
}

export interface AppliedChangeResult {
  path: string;
  type: 'create' | 'update' | 'delete' | 'patch';
  success: boolean;
  error?: string;
  diffSummary?: string;
}

/**
 * Robust parser for AI output containing <file>, <patch>, and <run> tags
 */
export function parseProtocol(rawText: string): ParsedProtocol {
  const files: FileOp[] = [];
  const patches: PatchOp[] = [];
  const runs: RunOp[] = [];

  // 1. Parse <file path="..." action="...">content</file>
  // Also handle single or double quotes, self-closing, or missing action (defaults to update/create)
  const fileRegex = /<file\s+path=["']([^"']+)["'](?:\s+action=["'](create|update|delete)["'])?\s*>([\s\S]*?)<\/file>/gi;
  let match: RegExpExecArray | null;

  while ((match = fileRegex.exec(rawText)) !== null) {
    const rawPath = match[1].trim();
    const action = (match[2] as 'create' | 'update' | 'delete') || 'update';
    const content = match[3] ?? '';
    if (rawPath) {
      files.push({
        path: VirtualFS.normalizePath(rawPath),
        action,
        content: action === 'delete' ? '' : content.replace(/^\r?\n/, '').replace(/\r?\n$/, ''),
      });
    }
  }

  // 2. Parse <patch path="..."> <find>...</find> <replace>...</replace> </patch>
  const patchRegex = /<patch\s+path=["']([^"']+)["']\s*>([\s\S]*?)<\/patch>/gi;
  while ((match = patchRegex.exec(rawText)) !== null) {
    const rawPath = match[1].trim();
    const body = match[2];

    const findMatch = /<find>([\s\S]*?)<\/find>/i.exec(body);
    const replaceMatch = /<replace>([\s\S]*?)<\/replace>/i.exec(body);

    if (rawPath && findMatch && replaceMatch) {
      patches.push({
        path: VirtualFS.normalizePath(rawPath),
        find: findMatch[1],
        replace: replaceMatch[1],
      });
    }
  }

  // 3. Parse <run>command</run>
  const runRegex = /<run>([\s\S]*?)<\/run>/gi;
  while ((match = runRegex.exec(rawText)) !== null) {
    const cmd = match[1].trim();
    if (cmd) {
      runs.push({ command: cmd });
    }
  }

  // 4. Fallback: Parse markdown ```file:path format if model lapsed into markdown
  if (files.length === 0 && patches.length === 0) {
    const mdRegex = /```file:([^\n\r]+)[\r\n]+([\s\S]*?)```/g;
    while ((match = mdRegex.exec(rawText)) !== null) {
      const p = match[1].trim();
      const c = match[2];
      if (p) {
        files.push({
          path: VirtualFS.normalizePath(p),
          action: 'update',
          content: c.trim(),
        });
      }
    }
  }

  // Clean explanation text by stripping XML tags for conversational display
  let cleanedText = rawText
    .replace(/<file[\s\S]*?<\/file>/gi, '')
    .replace(/<patch[\s\S]*?<\/patch>/gi, '')
    .replace(/<run[\s\S]*?<\/run>/gi, '')
    .replace(/```file:[\s\S]*?```/g, '')
    .trim();

  return { files, patches, runs, cleanedText };
}

/**
 * Applies parsed file and patch operations to the Virtual File System
 */
export async function applyProtocolOperations(
  projectId: string,
  protocol: ParsedProtocol
): Promise<AppliedChangeResult[]> {
  const results: AppliedChangeResult[] = [];

  // Apply full file operations
  for (const file of protocol.files) {
    try {
      if (file.action === 'delete') {
        await VirtualFS.deleteFile(projectId, file.path);
        results.push({
          path: file.path,
          type: 'delete',
          success: true,
          diffSummary: `Deleted ${file.path}`,
        });
      } else {
        let existing = '';
        try {
          existing = await VirtualFS.readFile(projectId, file.path);
        } catch {
          // file is new
        }

        await VirtualFS.writeFile(projectId, file.path, file.content);
        results.push({
          path: file.path,
          type: existing ? 'update' : 'create',
          success: true,
          diffSummary: existing
            ? `Updated ${file.path} (${file.content.length} bytes)`
            : `Created ${file.path} (${file.content.length} bytes)`,
        });
      }
    } catch (err: any) {
      results.push({
        path: file.path,
        type: file.action,
        success: false,
        error: err.message || 'Failed file operation',
      });
    }
  }

  // Apply patches
  for (const patch of protocol.patches) {
    try {
      let content = '';
      try {
        content = await VirtualFS.readFile(projectId, patch.path);
      } catch {
        throw new Error(`Cannot patch non-existent file: ${patch.path}`);
      }

      // Exact replace first
      let updated = content;
      if (updated.includes(patch.find)) {
        updated = updated.replace(patch.find, patch.replace);
      } else {
        // Try normalized whitespace and newline matching
        const normExisting = content.replace(/\r\n/g, '\n');
        const normFind = patch.find.replace(/\r\n/g, '\n');
        const normReplace = patch.replace.replace(/\r\n/g, '\n');

        if (normExisting.includes(normFind)) {
          updated = normExisting.replace(normFind, normReplace);
        } else {
          // Trim match
          const trimFind = normFind.trim();
          if (normExisting.includes(trimFind)) {
            updated = normExisting.replace(trimFind, normReplace.trim());
          } else {
            throw new Error(`Target text to find was not found in ${patch.path}`);
          }
        }
      }

      await VirtualFS.writeFile(projectId, patch.path, updated);
      results.push({
        path: patch.path,
        type: 'patch',
        success: true,
        diffSummary: `Patched ${patch.path} (-${patch.find.length} / +${patch.replace.length} chars)`,
      });
    } catch (err: any) {
      results.push({
        path: patch.path,
        type: 'patch',
        success: false,
        error: err.message || 'Patch failed',
      });
    }
  }

  return results;
}

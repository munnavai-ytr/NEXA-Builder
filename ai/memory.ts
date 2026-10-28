// Project Memory Management (PROJECT_MEMORY.md)
import { VirtualFS } from '../core/fs';
import { FileRecord } from '../core/db';

export const MEMORY_FILE_NAME = 'PROJECT_MEMORY.md';

export interface ProjectMemory {
  overview: string;
  techStack: string;
  fileMap: Record<string, string>;
  designTokens: string;
  featuresDone: string[];
  decisionsAndRules: string[];
  knownIssues: string[];
  changelog: { timestamp: string; note: string }[];
}

/**
 * Creates initial PROJECT_MEMORY.md content for a project
 */
export function createInitialMemoryContent(projectName: string, template = 'saas'): string {
  return `# Project Memory: ${projectName}

## Overview
A high-performance in-browser web application created with NEXA Builder.

## Tech stack
- React / Modern ES Modules
- Tailwind CSS (v3/v4 utility classes)
- Design Tokens (CSS Variables)
- Custom in-browser esbuild-wasm bundler & dynamic import maps (MIT license)
- Virtual File System & Client-Side Execution

## Folder/file map
- index.html: Primary application HTML entry point and viewport setup
- style.css: Global styles, animation keyframes, and custom utility classes
- app.js: Interactive client-side logic and event listeners
- package.json: Project metadata, script definitions, and dependencies

## Design tokens
- Background: #070A12 (Deep Obsidian)
- Surface: rgba(16, 22, 38, 0.7)
- Accent Gradient: linear-gradient(135deg, #7C5CFF 0%, #22D3EE 100%)
- Text Primary: #F1F5F9
- Text Muted: #64748B
- Radius: 8px (md), 12px (lg)

## Features done
- Project initialization and workspace scaffolding
- Responsive viewport layout structure
- Interactive UI components

## Decisions & rules
- Mobile-first responsive hierarchy with 44px+ touch targets
- Zero broken images; resilient SVG/CSS fallbacks
- Non-destructive updates: preserve existing functional handlers
- Real client-side state transitions with smooth micro-interactions

## Known issues
- None

## Changelog
- ${new Date().toISOString().split('T')[0]}: Initialized project scaffolding with ${template} template.
`;
}

/**
 * Retrieves or initializes PROJECT_MEMORY.md in virtual file system
 */
export async function getOrInitMemory(projectId: string, projectName: string, template?: string): Promise<string> {
  try {
    return await VirtualFS.readFile(projectId, MEMORY_FILE_NAME);
  } catch {
    const initial = createInitialMemoryContent(projectName, template);
    await VirtualFS.writeFile(projectId, MEMORY_FILE_NAME, initial);
    return initial;
  }
}

/**
 * Updates PROJECT_MEMORY.md after an agent task execution
 */
export async function updateMemoryAfterTask(
  projectId: string,
  projectName: string,
  taskSummary: string,
  updatedFilePaths: string[]
): Promise<string> {
  let memoryText = await getOrInitMemory(projectId, projectName);

  const today = new Date().toISOString().split('T')[0];
  const newChangelogEntry = `- ${today}: ${taskSummary} (${updatedFilePaths.join(', ') || 'No file changes'})`;

  // Append to Changelog section
  if (memoryText.includes('## Changelog')) {
    memoryText = memoryText.replace(
      '## Changelog',
      `## Changelog\n${newChangelogEntry}`
    );
  } else {
    memoryText += `\n\n## Changelog\n${newChangelogEntry}\n`;
  }

  // Update Features Done section if relevant
  if (taskSummary && !taskSummary.startsWith('Fix:')) {
    if (memoryText.includes('## Features done')) {
      memoryText = memoryText.replace(
        '## Features done',
        `## Features done\n- ${taskSummary}`
      );
    }
  }

  // Compact Changelog if it gets excessively long (> 15 entries)
  const changelogSplit = memoryText.split('## Changelog\n');
  if (changelogSplit.length === 2) {
    const lines = changelogSplit[1].split('\n').filter((l) => l.trim().startsWith('-'));
    if (lines.length > 15) {
      const recent = lines.slice(0, 10);
      const archivedCount = lines.length - 10;
      const compacted = `${recent.join('\n')}\n- (Summary: ${archivedCount} earlier foundational changes)`;
      memoryText = `${changelogSplit[0]}## Changelog\n${compacted}\n`;
    }
  }

  await VirtualFS.writeFile(projectId, MEMORY_FILE_NAME, memoryText);
  return memoryText;
}

/**
 * Smart file selector: filters files to send only relevant files in prompt context
 * based on prompt keywords, file extensions, and imports
 */
export function selectRelevantFiles(
  allFiles: FileRecord[],
  userPrompt: string
): FileRecord[] {
  // Always exclude binary/huge items or hidden internal files
  const filtered = allFiles.filter((f) => f.path !== MEMORY_FILE_NAME);

  // If project is small (<= 8 files), include all of them
  if (filtered.length <= 8) {
    return filtered;
  }

  const promptLower = userPrompt.toLowerCase();
  const scoredFiles: { file: FileRecord; score: number }[] = [];

  for (const file of filtered) {
    let score = 0;
    const pathLower = file.path.toLowerCase();

    // Key entry points always have base priority
    if (pathLower === 'index.html' || pathLower === 'app.js' || pathLower === 'style.css') score += 5;
    if (pathLower.endsWith('app/page.tsx') || pathLower.endsWith('src/app.tsx')) score += 5;
    if (pathLower === 'package.json') score += 3;

    // Path matching words in prompt
    const words = promptLower.split(/[\s,._-]+/).filter((w) => w.length > 2);
    for (const w of words) {
      if (pathLower.includes(w)) {
        score += 8;
      }
      // Content check for mentions
      if (file.content.toLowerCase().includes(w)) {
        score += 2;
      }
    }

    scoredFiles.push({ file, score });
  }

  // Sort by score descending and pick top 8 files
  scoredFiles.sort((a, b) => b.score - a.score);
  return scoredFiles.slice(0, 8).map((sf) => sf.file);
}

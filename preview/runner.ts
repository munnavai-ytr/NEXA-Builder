// NEXA Preview Runner - Public Bridge & Backward Compatible Adapter
import { FileRecord } from '../core/db';
import { buildVirtualProject } from './engine/bundler';
import { ProjectMode, BundledPreview } from './engine/types';

export type { ProjectMode, BundledPreview };

/**
 * Detects project mode from virtual files
 */
export function detectProjectMode(files: FileRecord[]): 'static' | 'react' | 'next-compat' | 'python' | 'native-backend' {
  const paths = files.map((f) => f.path.toLowerCase());
  if (paths.some((p) => p.endsWith('.py'))) return 'python';
  if (paths.some((p) => p.endsWith('.go') || p.endsWith('.rs') || p.endsWith('.java') || p.endsWith('.cpp') || p.endsWith('.php'))) return 'native-backend';
  if (paths.some((p) => p.startsWith('app/') || p.startsWith('pages/') || p === 'next.config.js' || p === 'next.config.ts')) return 'next-compat';
  if (paths.some((p) => p.endsWith('.jsx') || p.endsWith('.tsx') || (p.endsWith('package.json') && files.some((f) => f.content.includes('"react"'))))) return 'react';
  return 'static';
}

/**
 * Backward-compatible synchronous wrapper returning minimal fallback bundle
 */
export function bundleVirtualProject(files: FileRecord[]): {
  mode: string;
  html: string;
  badge?: string;
  hasErrors?: boolean;
  errorMessage?: string;
} {
  const mode = detectProjectMode(files);
  const indexFile = files.find((f) => f.path === 'index.html' || f.path === 'index.htm');

  return {
    mode,
    badge: mode === 'next-compat' ? 'Preview mode – full Next.js runs on Vercel' : undefined,
    html: indexFile ? indexFile.content : '<!DOCTYPE html><html><body><div id="root"></div></body></html>',
  };
}

export { buildVirtualProject };

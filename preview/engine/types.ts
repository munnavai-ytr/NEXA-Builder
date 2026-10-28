// Engine Types for NEXA Builder In-Browser Preview
import { FileRecord } from '../../core/db';

export type BuildStage =
  | 'idle'
  | 'Starting engine'
  | 'Reading files'
  | 'Bundling'
  | 'Loading packages'
  | 'Rendering'
  | 'Ready'
  | 'Error';

export type ProjectMode = 'static' | 'react' | 'next-compat' | 'python' | 'native-backend';

export interface BundledPreview {
  mode: ProjectMode;
  html: string;
  badge?: string;
  hasErrors?: boolean;
  errorMessage?: string;
  pythonCode?: string;
  otherLanguageNotice?: string;
}

export type DetectedFramework =
  | 'next-app-router'
  | 'next-pages-router'
  | 'vite-react'
  | 'html-static'
  | 'vue-svelte'
  | 'python'
  | 'native-backend';

export interface PackageResolution {
  name: string;
  version: string;
  url: string;
  success: boolean;
  cached?: boolean;
}

export interface PreviewDiagnostics {
  framework: DetectedFramework;
  frameworkLabel: string;
  entryFile: string;
  fileCount: number;
  bundleSizeBytes: number;
  buildTimeMs: number;
  packagesResolved: PackageResolution[];
  buildWarnings: string[];
}

export interface PreviewErrorPayload {
  type: 'build' | 'runtime' | 'unhandledrejection' | 'syntax';
  message: string;
  file?: string;
  line?: number;
  column?: number;
  stack?: string;
}

export interface ConsoleLogEntry {
  id: string;
  level: 'log' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: number;
}

export interface EngineBuildResult {
  html: string;
  diagnostics: PreviewDiagnostics;
  error?: PreviewErrorPayload;
}

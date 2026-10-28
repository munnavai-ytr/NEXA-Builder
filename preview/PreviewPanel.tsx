'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Smartphone,
  Tablet,
  Monitor,
  RotateCw,
  ExternalLink,
  AlertTriangle,
  Wand2,
  X,
  Activity,
  Terminal,
  Clock,
  CheckCircle2,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  Info,
  Layers,
} from 'lucide-react';
import { FileRecord } from '../core/db';
import { buildVirtualProject } from './engine/bundler';
import {
  BuildStage,
  PreviewDiagnostics,
  PreviewErrorPayload,
  ConsoleLogEntry,
} from './engine/types';

export type DeviceMode = 'mobile' | 'tablet' | 'desktop';

interface PreviewPanelProps {
  files: FileRecord[];
  projectName?: string;
  refreshTrigger?: number;
  onAskAiFix?: (errorMessage: string) => void;
}

export function PreviewPanel({
  files,
  projectName = 'App',
  refreshTrigger = 0,
  onAskAiFix,
}: PreviewPanelProps) {
  const [device, setDevice] = useState<DeviceMode>('desktop');
  const [stage, setStage] = useState<BuildStage>('Starting engine');
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [diagnostics, setDiagnostics] = useState<PreviewDiagnostics | null>(null);
  const [runtimeError, setRuntimeError] = useState<PreviewErrorPayload | null>(null);
  const [logs, setLogs] = useState<ConsoleLogEntry[]>([]);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [isWatchdogAlert, setIsWatchdogAlert] = useState(false);
  const [reloadCounter, setReloadCounter] = useState(0);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const buildTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const watchdogTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastBuiltFilesHashRef = useRef<string>('');

  // Compute lightweight hash of files to avoid rebuilding unchanged state
  const filesHash = files.map((f) => `${f.path}:${f.content.length}:${f.updatedAt}`).join('|');

  const runBuild = useCallback(async () => {
    // Start watchdog for 20s
    setIsWatchdogAlert(false);
    if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
    watchdogTimerRef.current = setTimeout(() => {
      setIsWatchdogAlert(true);
    }, 20000);

    try {
      const result = await buildVirtualProject({
        files,
        onStageChange: (newStage) => setStage(newStage),
        cacheKey: projectName,
      });

      setHtmlContent(result.html);
      setDiagnostics(result.diagnostics);

      if (result.error) {
        setRuntimeError(result.error);
      } else {
        setRuntimeError(null);
      }
    } catch (err: any) {
      console.error('Build execution failed:', err);
      setStage('Error');
      setRuntimeError({
        type: 'build',
        message: err.message || 'Build failed unexpectedly',
      });
    } finally {
      if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
    }
  }, [files, projectName]);

  // Debounced 300ms incremental build trigger
  useEffect(() => {
    if (files.length === 0) return;

    if (buildTimeoutRef.current) clearTimeout(buildTimeoutRef.current);
    buildTimeoutRef.current = setTimeout(() => {
      lastBuiltFilesHashRef.current = filesHash;
      runBuild();
    }, 300);

    return () => {
      if (buildTimeoutRef.current) clearTimeout(buildTimeoutRef.current);
      if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
    };
  }, [filesHash, refreshTrigger, reloadCounter, runBuild, files.length]);

  // Listen to postMessage logs, errors, and watchdog signals from preview iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NEXA_PREVIEW_CONSOLE') {
        const { level, message, timestamp } = event.data;
        setLogs((prev) => [
          ...prev.slice(-200),
          {
            id: `log-${Date.now()}-${Math.random()}`,
            level: level || 'log',
            message: message || '',
            timestamp: timestamp || Date.now(),
          },
        ]);
      } else if (event.data?.type === 'NEXA_PREVIEW_ERROR') {
        setRuntimeError({
          type: 'runtime',
          message: event.data.error || 'A runtime error occurred in preview.',
          file: event.data.file,
          line: event.data.line,
          column: event.data.column,
          stack: event.data.stack,
        });
      } else if (event.data?.type === 'NEXA_PREVIEW_RENDERED') {
        setIsWatchdogAlert(false);
        if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleReload = () => {
    setRuntimeError(null);
    setIsWatchdogAlert(false);
    setReloadCounter((c) => c + 1);
  };

  const handleOpenExternal = () => {
    try {
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      console.error('Failed to open external preview:', err);
    }
  };

  const handleFixWithAi = () => {
    if (!runtimeError || !onAskAiFix) return;

    // Find content of file where error occurred to give AI full context
    let contextFileInfo = '';
    if (runtimeError.file) {
      const matching = files.find((f) => runtimeError.file?.includes(f.path));
      if (matching) {
        contextFileInfo = `\n\nContent of ${matching.path}:\n\`\`\`\n${matching.content}\n\`\`\``;
      }
    }

    const errorMsg = `Fix preview error: ${runtimeError.message}${
      runtimeError.file ? ` at ${runtimeError.file}${runtimeError.line ? `:${runtimeError.line}` : ''}` : ''
    }${contextFileInfo}`;

    onAskAiFix(errorMsg);
    setRuntimeError(null);
  };

  return (
    <div className="flex flex-col h-full bg-[#070A12] border-l border-white/10 select-none overflow-hidden relative">
      {/* Top Preview Control Bar */}
      <div className="flex items-center justify-between px-3 h-11 bg-[#0C101D] border-b border-white/5 shrink-0 gap-2">
        {/* Left: Device Switcher */}
        <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-lg border border-white/5">
          <button
            onClick={() => setDevice('mobile')}
            className={`p-1.5 rounded-md transition ${
              device === 'mobile'
                ? 'bg-cyan-500/20 text-cyan-300 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Mobile (375px)"
            aria-label="Mobile view (375px)"
          >
            <Smartphone className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setDevice('tablet')}
            className={`p-1.5 rounded-md transition ${
              device === 'tablet'
                ? 'bg-cyan-500/20 text-cyan-300 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Tablet (768px)"
            aria-label="Tablet view (768px)"
          >
            <Tablet className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setDevice('desktop')}
            className={`p-1.5 rounded-md transition ${
              device === 'desktop'
                ? 'bg-cyan-500/20 text-cyan-300 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Desktop (100% Fluid)"
            aria-label="Desktop view (fluid)"
          >
            <Monitor className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Center: Live Stage Progress Status */}
        <div className="flex items-center gap-2 px-2.5 py-1 bg-black/40 border border-white/5 rounded-md text-[11px] font-mono text-slate-300 max-w-[260px] sm:max-w-xs truncate">
          {stage === 'Ready' ? (
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
          ) : stage === 'Error' ? (
            <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shrink-0" />
          )}

          <span className="truncate text-slate-300">
            {stage === 'Ready'
              ? diagnostics?.frameworkLabel || 'Ready'
              : stage}
          </span>
        </div>

        {/* Right: Actions & Diagnostics */}
        <div className="flex items-center gap-1">
          {/* Diagnostics toggle button */}
          <button
            onClick={() => setIsDiagnosticsOpen(!isDiagnosticsOpen)}
            className={`p-1.5 rounded-md transition ${
              isDiagnosticsOpen
                ? 'bg-cyan-500/20 text-cyan-300'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
            title="Preview Diagnostics (framework, bundle size, resolved packages)"
            aria-label="Preview Diagnostics"
          >
            <Activity className="w-3.5 h-3.5" />
          </button>

          {/* Console drawer toggle */}
          <button
            onClick={() => setIsConsoleOpen(!isConsoleOpen)}
            className={`p-1.5 rounded-md transition flex items-center gap-1 ${
              isConsoleOpen
                ? 'bg-cyan-500/20 text-cyan-300'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
            title="Iframe Console logs"
            aria-label="Preview Console logs"
          >
            <Terminal className="w-3.5 h-3.5" />
            {logs.length > 0 && (
              <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">
                ({logs.length})
              </span>
            )}
          </button>

          <button
            onClick={handleReload}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded-md transition"
            title="Rebuild & reload preview"
            aria-label="Reload preview"
          >
            <RotateCw className={`w-3.5 h-3.5 ${stage !== 'Ready' && stage !== 'Error' ? 'animate-spin text-cyan-400' : ''}`} />
          </button>

          <button
            onClick={handleOpenExternal}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded-md transition"
            title="Open in new window"
            aria-label="Open in new window"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Frame Container */}
      <div className="flex-1 bg-[#05070D] overflow-hidden flex items-center justify-center p-2 relative">
        <div
          className={`h-full transition-all duration-300 flex flex-col items-center justify-center ${
            device === 'mobile'
              ? 'w-[375px] max-w-full rounded-2xl border-2 border-slate-700/80 shadow-2xl bg-black overflow-hidden'
              : device === 'tablet'
              ? 'w-[768px] max-w-full rounded-xl border border-slate-700/60 shadow-xl bg-black overflow-hidden'
              : 'w-full rounded-none border-0'
          }`}
        >
          {device === 'mobile' && (
            <div className="w-full h-5 bg-black flex items-center justify-center shrink-0 border-b border-white/5">
              <div className="w-16 h-1 rounded-full bg-slate-700"></div>
            </div>
          )}

          <iframe
            ref={iframeRef}
            srcDoc={htmlContent}
            title={`${projectName} Live Preview`}
            sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
            className="w-full h-full bg-white border-0"
          />

          {device === 'mobile' && (
            <div className="w-full h-4 bg-black flex items-center justify-center shrink-0 border-t border-white/5">
              <div className="w-24 h-1 rounded-full bg-slate-700"></div>
            </div>
          )}
        </div>

        {/* Watchdog Alert Banner if preview takes > 20s */}
        {isWatchdogAlert && (
          <div className="absolute top-4 left-4 right-4 z-40 bg-amber-950/90 border border-amber-500/50 rounded-xl p-3 backdrop-blur-md shadow-2xl animate-fade-in flex items-center justify-between gap-3 text-xs text-amber-200">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Preview is taking longer than expected (last stage: <strong>{stage}</strong>)</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleReload}
                className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded font-medium transition"
              >
                Retry
              </button>
              <button
                onClick={() => setIsConsoleOpen(true)}
                className="px-2.5 py-1 bg-white/10 hover:bg-white/15 text-slate-300 rounded font-medium transition"
              >
                Show logs
              </button>
              <button
                onClick={() => setIsWatchdogAlert(false)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Runtime / Build Error Overlay with "Ask AI to fix" */}
        {runtimeError && (
          <div className="absolute bottom-4 left-4 right-4 z-40 bg-red-950/95 border border-red-500/50 rounded-xl p-3.5 backdrop-blur-md shadow-2xl animate-fade-in flex flex-col gap-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="space-y-1 min-w-0">
                  <p className="text-xs font-semibold text-red-200">
                    {runtimeError.type === 'build' ? 'Compilation Build Error' : 'Preview Runtime Error'}
                  </p>
                  <p className="text-[11px] text-red-300 font-mono whitespace-pre-wrap leading-relaxed max-h-24 overflow-y-auto">
                    {runtimeError.message}
                  </p>
                  {runtimeError.file && (
                    <p className="text-[10px] text-slate-400 font-mono">
                      Location: {runtimeError.file}
                      {runtimeError.line ? `:${runtimeError.line}` : ''}
                      {runtimeError.column ? `:${runtimeError.column}` : ''}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setRuntimeError(null)}
                className="p-1 text-slate-400 hover:text-white rounded"
                aria-label="Dismiss error"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1 border-t border-red-500/20">
              <button
                onClick={handleReload}
                className="px-3 py-1 text-xs text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition"
              >
                Rebuild
              </button>
              {onAskAiFix && (
                <button
                  onClick={handleFixWithAi}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-violet-500 to-cyan-400 text-black text-xs font-bold rounded-lg transition shadow-md hover:opacity-95"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Ask AI to fix</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Diagnostics Modal / Popover */}
        {isDiagnosticsOpen && diagnostics && (
          <div className="absolute top-3 right-3 z-50 w-80 max-w-[90vw] bg-[#0C101D] border border-white/10 rounded-2xl shadow-2xl p-4 text-xs space-y-3 animate-fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-1.5 text-cyan-300 font-semibold">
                <Activity className="w-4 h-4" />
                <span>Preview Diagnostics</span>
              </div>
              <button
                onClick={() => setIsDiagnosticsOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1.5 text-[11px] text-slate-300">
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Framework</span>
                <span className="font-semibold text-white">{diagnostics.frameworkLabel}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Entry File</span>
                <span className="font-mono text-cyan-300 truncate max-w-[150px]">{diagnostics.entryFile}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Bundled Files</span>
                <span className="tabular-nums font-mono">{diagnostics.fileCount} files</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Bundle Size</span>
                <span className="tabular-nums font-mono">{(diagnostics.bundleSizeBytes / 1024).toFixed(1)} KB</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Build Time</span>
                <span className="tabular-nums font-mono text-emerald-400">{diagnostics.buildTimeMs} ms</span>
              </div>
            </div>

            <div className="pt-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Resolved Packages ({diagnostics.packagesResolved.length})
              </p>
              <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                {diagnostics.packagesResolved.map((pkg, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[10px] font-mono p-1 bg-white/5 rounded">
                    <span className="text-slate-200 truncate">{pkg.name}@{pkg.version}</span>
                    <span className="text-emerald-400 ml-1 shrink-0">esm.sh</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Collapsible Console Drawer */}
      {isConsoleOpen && (
        <div className="h-44 bg-[#080B14] border-t border-white/10 flex flex-col shrink-0 text-xs font-mono">
          <div className="flex items-center justify-between px-3 h-8 bg-[#0C101D] border-b border-white/5 shrink-0">
            <div className="flex items-center gap-1.5 text-slate-300">
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              <span>Preview Console</span>
              <span className="text-[10px] text-slate-500">({logs.length})</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setLogs([])}
                className="px-2 py-0.5 text-[10px] text-slate-400 hover:text-slate-200 rounded hover:bg-white/5 transition"
              >
                Clear
              </button>
              <button
                onClick={() => setIsConsoleOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="flex-1 p-2.5 overflow-y-auto space-y-1">
            {logs.length === 0 ? (
              <p className="text-slate-600 text-[11px]">No console output captured yet.</p>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className={`leading-relaxed text-[11px] ${
                    log.level === 'error'
                      ? 'text-red-400'
                      : log.level === 'warn'
                      ? 'text-amber-400'
                      : 'text-slate-300'
                  }`}
                >
                  <span className="text-slate-600 mr-2 text-[10px]">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span>{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

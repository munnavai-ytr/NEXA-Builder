'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Smartphone,
  Tablet,
  Monitor,
  RotateCw,
  ExternalLink,
  AlertTriangle,
  Wand2,
  X,
} from 'lucide-react';
import { bundleVirtualProject, BundledPreview } from './runner';
import { FileRecord } from '../core/db';

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
  const [reloadKey, setReloadKey] = useState<number>(0);
  const [isReloading, setIsReloading] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Memoize bundle preview to avoid unnecessary rebundling
  const bundled: BundledPreview = useMemo(() => {
    const _ = refreshTrigger;
    return bundleVirtualProject(files);
  }, [files, refreshTrigger]);

  // Listen for runtime errors from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NEXA_PREVIEW_ERROR') {
        setRuntimeError(event.data.error || 'A runtime error occurred in preview.');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleReload = () => {
    setIsReloading(true);
    setRuntimeError(null);
    setReloadKey((k) => k + 1);
    setTimeout(() => setIsReloading(false), 300);
  };

  const handleOpenExternal = () => {
    try {
      const blob = new Blob([bundled.html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      console.error('Failed to open external preview:', err);
    }
  };

  const handleFixWithAi = () => {
    if (runtimeError && onAskAiFix) {
      onAskAiFix(`Fix runtime preview error: ${runtimeError}`);
      setRuntimeError(null);
    }
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

        {/* Center: Fake URL / Next-Compat Badge */}
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 bg-black/30 border border-white/5 rounded-md text-[11px] font-mono text-slate-400 max-w-[280px] truncate">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
          {bundled.badge ? (
            <span className="text-cyan-400 font-semibold truncate">{bundled.badge}</span>
          ) : (
            <span className="truncate">localhost:3000 / preview</span>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleReload}
            disabled={isReloading}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded-md transition"
            title="Reload live preview"
            aria-label="Reload preview"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isReloading ? 'animate-spin text-cyan-400' : ''}`} />
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
            key={reloadKey}
            ref={iframeRef}
            srcDoc={bundled.html}
            title={`${projectName} Live Preview`}
            sandbox="allow-scripts allow-modals allow-forms allow-same-origin allow-popups"
            className="w-full h-full bg-white border-0"
          />

          {device === 'mobile' && (
            <div className="w-full h-4 bg-black flex items-center justify-center shrink-0 border-t border-white/5">
              <div className="w-24 h-1 rounded-full bg-slate-700"></div>
            </div>
          )}
        </div>

        {/* Runtime Error Overlay with "Ask AI to fix" */}
        {runtimeError && (
          <div className="absolute bottom-4 left-4 right-4 z-40 bg-red-950/90 border border-red-500/50 rounded-xl p-3 backdrop-blur-md shadow-2xl animate-fade-in flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 flex-1 min-w-0">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1 min-w-0">
                <p className="text-xs font-semibold text-red-200">Runtime Error</p>
                <p className="text-[11px] text-red-300 font-mono truncate">{runtimeError}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {onAskAiFix && (
                <button
                  onClick={handleFixWithAi}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-400 hover:bg-cyan-300 text-black text-xs font-bold rounded-lg transition shadow-md"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Ask AI to fix</span>
                </button>
              )}
              <button
                onClick={() => setRuntimeError(null)}
                className="p-1 text-slate-400 hover:text-white rounded"
                aria-label="Dismiss error"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

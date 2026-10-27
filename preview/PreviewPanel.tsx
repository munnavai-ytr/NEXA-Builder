'use client';

import React, { useState, useMemo, useRef } from 'react';
import {
  Smartphone,
  Tablet,
  Monitor,
  RotateCw,
  ExternalLink,
} from 'lucide-react';
import { bundlePreview } from './runner';
import { FileRecord } from '../core/db';

export type DeviceMode = 'mobile' | 'tablet' | 'desktop';

interface PreviewPanelProps {
  files: FileRecord[];
  projectName?: string;
  refreshTrigger?: number;
}

export function PreviewPanel({ files, projectName = 'App', refreshTrigger = 0 }: PreviewPanelProps) {
  const [device, setDevice] = useState<DeviceMode>('desktop');
  const [reloadKey, setReloadKey] = useState<number>(0);
  const [isReloading, setIsReloading] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Memoize bundle preview to avoid unnecessary rebundling and cascading effect renders
  const bundled = useMemo(() => {
    // refreshTrigger forces rebundle on demand
    const _ = refreshTrigger;
    return bundlePreview(files);
  }, [files, refreshTrigger]);

  const handleReload = () => {
    setIsReloading(true);
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

  return (
    <div className="flex flex-col h-full bg-[#070A12] border-l border-white/10 select-none overflow-hidden">
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

        {/* Center: Fake URL / Status Bar */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-black/30 border border-white/5 rounded-md text-[11px] font-mono text-slate-400 max-w-[240px] truncate">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
          <span className="truncate">localhost:3000 / preview</span>
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
      </div>
    </div>
  );
}

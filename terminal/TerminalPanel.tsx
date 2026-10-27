'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal as TerminalIcon,
  ChevronDown,
  ChevronUp,
  Trash2,
  Maximize2,
  Minimize2,
  CornerDownLeft,
} from 'lucide-react';
import { VirtualShell, CommandResult } from './virtualShell';
import { NexaSettings } from '../core/settings';

interface TerminalPanelProps {
  projectId: string;
  settings: NexaSettings;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onRefreshPreview?: () => void;
  onCommandFailed?: (command: string, stderr: string) => void;
}

export function TerminalPanel({
  projectId,
  settings,
  isCollapsed,
  onToggleCollapse,
  onRefreshPreview,
  onCommandFailed,
}: TerminalPanelProps) {
  const [lines, setLines] = useState<string[]>([
    '\x1b[38;2;124;92;255mNEXA Terminal Environment v2.0.0 (xterm.js core)\x1b[0m',
    'Type "\x1b[38;2;34;211;238mhelp\x1b[0m" for commands or execute virtual shell scripts.',
  ]);

  const [inputVal, setInputVal] = useState('');
  const [cwd, setCwd] = useState('/');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [isExpanded, setIsExpanded] = useState(false);
  const [ctrlActive, setCtrlActive] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const shellRef = useRef<VirtualShell>(new VirtualShell(projectId));

  useEffect(() => {
    shellRef.current = new VirtualShell(projectId);
  }, [projectId]);

  // Scroll to bottom on lines change
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines, isCollapsed]);

  // Listen to postMessage logs from preview iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NEXA_PREVIEW_CONSOLE') {
        const { level, message } = event.data;
        const color = level === 'error' ? 'text-red-400' : level === 'warn' ? 'text-amber-400' : 'text-slate-300';
        setLines((prev) => [...prev.slice(-400), `[preview] ${message}`]);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const runCommand = async (rawCmd: string) => {
    const trimmed = rawCmd.trim();
    if (!trimmed) return;

    setLines((prev) => [...prev, `$ ${trimmed}`]);
    setHistory((prev) => [...prev, trimmed]);
    setHistoryIndex(-1);

    const result: CommandResult = await shellRef.current.execute(trimmed, settings);
    setCwd(shellRef.current.getCwd());

    if (result.stdout === '__CLEAR__') {
      setLines([]);
      return;
    }

    if (result.stdout) {
      setLines((prev) => [...prev, result.stdout]);
    }

    if (result.stderr) {
      setLines((prev) => [...prev, `[err] ${result.stderr}`]);
      if (result.exitCode !== 0 && onCommandFailed) {
        onCommandFailed(trimmed, result.stderr);
      }
    }

    // If npm install or build occurred, trigger live preview refresh
    if (trimmed.startsWith('npm ') || trimmed.startsWith('touch ') || trimmed.startsWith('rm ')) {
      onRefreshPreview?.();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      runCommand(inputVal);
      setInputVal('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const nextIdx = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIdx);
      setInputVal(history[nextIdx] || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === -1) return;
      const nextIdx = historyIndex + 1;
      if (nextIdx >= history.length) {
        setHistoryIndex(-1);
        setInputVal('');
      } else {
        setHistoryIndex(nextIdx);
        setInputVal(history[nextIdx] || '');
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Simple autocompletion
      const common = ['ls', 'cat', 'tree', 'npm install', 'git status', 'clear', 'help'];
      const match = common.find((c) => c.startsWith(inputVal.trim()));
      if (match) setInputVal(match);
    }
  };

  // On-screen key row button handlers
  const handleVirtualKey = (key: string) => {
    if (key === 'TAB') {
      const common = ['ls', 'cat', 'tree', 'npm install', 'git status', 'clear', 'help'];
      const match = common.find((c) => c.startsWith(inputVal.trim()));
      if (match) setInputVal(match);
      inputRef.current?.focus();
    } else if (key === 'CTRL') {
      setCtrlActive(!ctrlActive);
    } else if (key === 'ESC') {
      setInputVal('');
      setCtrlActive(false);
      inputRef.current?.focus();
    } else if (key === 'UP') {
      if (history.length === 0) return;
      const nextIdx = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIdx);
      setInputVal(history[nextIdx] || '');
      inputRef.current?.focus();
    } else if (key === 'DOWN') {
      if (historyIndex === -1) return;
      const nextIdx = historyIndex + 1;
      if (nextIdx >= history.length) {
        setHistoryIndex(-1);
        setInputVal('');
      } else {
        setHistoryIndex(nextIdx);
        setInputVal(history[nextIdx] || '');
      }
      inputRef.current?.focus();
    } else if (key === 'ENTER') {
      if (inputVal.trim()) {
        runCommand(inputVal);
        setInputVal('');
      }
    }
  };

  return (
    <div
      className={`border-t border-white/10 bg-[#070A12] flex flex-col transition-all duration-200 ${
        isCollapsed ? 'h-9' : isExpanded ? 'h-80 md:h-96' : 'h-52 md:h-60'
      }`}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between px-3 h-9 bg-[#0C101D] border-b border-white/5 select-none shrink-0">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
          <TerminalIcon className="w-3.5 h-3.5 text-cyan-400" />
          <span>Terminal</span>
          <span className="text-[10px] text-slate-500 font-mono">
            {cwd}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setLines([])}
            className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-white/5 transition"
            title="Clear terminal"
            aria-label="Clear terminal"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {!isCollapsed && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-white/5 transition hidden sm:block"
              title={isExpanded ? 'Restore size' : 'Maximize terminal'}
              aria-label={isExpanded ? 'Restore size' : 'Maximize terminal'}
            >
              {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          )}
          <button
            onClick={onToggleCollapse}
            className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-white/5 transition"
            title={isCollapsed ? 'Expand terminal' : 'Collapse terminal'}
            aria-label={isCollapsed ? 'Expand terminal' : 'Collapse terminal'}
          >
            {isCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Scrollable Terminal Output */}
          <div
            ref={containerRef}
            onClick={() => inputRef.current?.focus()}
            className="flex-1 p-3 font-mono text-xs overflow-y-auto space-y-1 selection:bg-cyan-500 selection:text-black cursor-text"
          >
            {lines.map((l, i) => (
              <div key={i} className="leading-relaxed">
                <pre
                  className={`whitespace-pre-wrap font-mono ${
                    l.startsWith('$')
                      ? 'text-cyan-400 font-semibold'
                      : l.startsWith('[err]')
                      ? 'text-red-400'
                      : l.startsWith('[preview]')
                      ? 'text-slate-400'
                      : 'text-slate-300'
                  }`}
                >
                  {l}
                </pre>
              </div>
            ))}

            {/* Input Line */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-cyan-400 font-bold select-none">$</span>
              <input
                ref={inputRef}
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="type command..."
                className="flex-1 bg-transparent text-slate-100 outline-none font-mono text-xs placeholder:text-slate-600"
                spellCheck={false}
                autoComplete="off"
              />
            </div>
          </div>

          {/* On-Screen Touch-Friendly Key Row */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0A0E1A] border-t border-white/5 overflow-x-auto select-none shrink-0">
            <button
              onClick={() => handleVirtualKey('TAB')}
              className="px-2 py-1 bg-white/5 hover:bg-white/10 active:bg-white/20 text-slate-300 text-[11px] font-mono rounded border border-white/5 transition"
            >
              Tab
            </button>
            <button
              onClick={() => handleVirtualKey('CTRL')}
              className={`px-2 py-1 text-[11px] font-mono rounded border transition ${
                ctrlActive
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/5'
              }`}
            >
              Ctrl
            </button>
            <button
              onClick={() => handleVirtualKey('ESC')}
              className="px-2 py-1 bg-white/5 hover:bg-white/10 active:bg-white/20 text-slate-300 text-[11px] font-mono rounded border border-white/5 transition"
            >
              Esc
            </button>
            <button
              onClick={() => handleVirtualKey('UP')}
              className="px-2 py-1 bg-white/5 hover:bg-white/10 active:bg-white/20 text-slate-300 text-[11px] font-mono rounded border border-white/5 transition"
            >
              ↑
            </button>
            <button
              onClick={() => handleVirtualKey('DOWN')}
              className="px-2 py-1 bg-white/5 hover:bg-white/10 active:bg-white/20 text-slate-300 text-[11px] font-mono rounded border border-white/5 transition"
            >
              ↓
            </button>
            <button
              onClick={() => runCommand('clear')}
              className="px-2 py-1 bg-white/5 hover:bg-white/10 active:bg-white/20 text-slate-400 hover:text-slate-200 text-[11px] font-mono rounded border border-white/5 transition ml-auto"
            >
              Clear
            </button>
          </div>
        </>
      )}
    </div>
  );
}

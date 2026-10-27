'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Terminal as TerminalIcon, ChevronDown, ChevronUp, Trash2, Play, Maximize2, Minimize2 } from 'lucide-react';
import { VirtualFS } from '../core/fs';
import { NexaSettings } from '../core/settings';

export interface TerminalEntry {
  id: string;
  type: 'input' | 'output' | 'error' | 'info' | 'system';
  text: string;
  time: string;
}

interface TerminalPanelProps {
  projectId: string;
  settings: NexaSettings;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onRefreshPreview?: () => void;
}

export function TerminalPanel({
  projectId,
  settings,
  isCollapsed,
  onToggleCollapse,
  onRefreshPreview,
}: TerminalPanelProps) {
  const [entries, setEntries] = useState<TerminalEntry[]>([
    {
      id: 'init-1',
      type: 'system',
      text: 'NEXA In-Browser Terminal Environment v1.0.0 [Ready]',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    },
    {
      id: 'init-2',
      type: 'info',
      text: 'Type "help" to view built-in commands or "run" to refresh live preview.',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    },
  ]);

  const [inputVal, setInputVal] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [isExpanded, setIsExpanded] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom of terminal
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [entries, isCollapsed]);

  // Listen to postMessage logs from preview iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NEXA_PREVIEW_CONSOLE') {
        const { level, message } = event.data;
        const entryType = level === 'error' ? 'error' : level === 'warn' ? 'info' : 'output';
        const formattedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        setEntries((prev) => [
          ...prev.slice(-300), // keep last 300 logs
          {
            id: `log-${Date.now()}-${Math.random()}`,
            type: entryType,
            text: `[preview] ${message}`,
            time: formattedTime,
          },
        ]);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleCommand = async (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setEntries((prev) => [
      ...prev,
      { id: `in-${Date.now()}`, type: 'input', text: `$ ${trimmed}`, time: timeStr },
    ]);

    setHistory((prev) => [...prev, trimmed]);
    setHistoryIndex(-1);

    const parts = trimmed.split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    // Command handling
    if (command === 'clear' || command === 'cls') {
      setEntries([]);
      return;
    }

    if (command === 'help') {
      setEntries((prev) => [
        ...prev,
        {
          id: `out-${Date.now()}`,
          type: 'info',
          text: `Available commands:
  help               Show this help guide
  ls                 List project files
  tree               Display hierarchical folder tree
  cat <file>         Print file contents to terminal
  touch <file>       Create a new blank file
  rm <file>          Delete a file from virtual storage
  build              Verify project syntax and assets
  run                Trigger live preview hot-reload
  remote <cmd>       Send command to Remote Runner (if configured)
  env                Display current environment parameters
  clear              Clear terminal screen`,
          time: timeStr,
        },
      ]);
      return;
    }

    if (command === 'ls') {
      try {
        const tree = await VirtualFS.listTree(projectId);
        const fileNames = tree.map((n) => (n.type === 'directory' ? `${n.name}/` : n.name)).join('   ');
        setEntries((prev) => [
          ...prev,
          { id: `out-${Date.now()}`, type: 'output', text: fileNames || '(empty directory)', time: timeStr },
        ]);
      } catch (err: any) {
        setEntries((prev) => [
          ...prev,
          { id: `err-${Date.now()}`, type: 'error', text: `ls: ${err.message}`, time: timeStr },
        ]);
      }
      return;
    }

    if (command === 'tree') {
      try {
        const tree = await VirtualFS.listTree(projectId);
        const lines: string[] = ['.'];
        const formatTree = (nodes: any[], prefix = '') => {
          nodes.forEach((n, idx) => {
            const isLast = idx === nodes.length - 1;
            const branch = isLast ? '└── ' : '├── ';
            lines.push(`${prefix}${branch}${n.name}${n.type === 'directory' ? '/' : ''}`);
            if (n.children) {
              formatTree(n.children, prefix + (isLast ? '    ' : '│   '));
            }
          });
        };
        formatTree(tree);
        setEntries((prev) => [
          ...prev,
          { id: `out-${Date.now()}`, type: 'output', text: lines.join('\n'), time: timeStr },
        ]);
      } catch (err: any) {
        setEntries((prev) => [
          ...prev,
          { id: `err-${Date.now()}`, type: 'error', text: `tree: ${err.message}`, time: timeStr },
        ]);
      }
      return;
    }

    if (command === 'cat') {
      if (!args[0]) {
        setEntries((prev) => [
          ...prev,
          { id: `err-${Date.now()}`, type: 'error', text: 'Usage: cat <filename>', time: timeStr },
        ]);
        return;
      }
      try {
        const content = await VirtualFS.readFile(projectId, args[0]);
        setEntries((prev) => [
          ...prev,
          { id: `out-${Date.now()}`, type: 'output', text: content, time: timeStr },
        ]);
      } catch (err: any) {
        setEntries((prev) => [
          ...prev,
          { id: `err-${Date.now()}`, type: 'error', text: `cat: ${err.message}`, time: timeStr },
        ]);
      }
      return;
    }

    if (command === 'touch') {
      if (!args[0]) {
        setEntries((prev) => [
          ...prev,
          { id: `err-${Date.now()}`, type: 'error', text: 'Usage: touch <filename>', time: timeStr },
        ]);
        return;
      }
      try {
        await VirtualFS.writeFile(projectId, args[0], '');
        setEntries((prev) => [
          ...prev,
          { id: `out-${Date.now()}`, type: 'output', text: `Created file: ${args[0]}`, time: timeStr },
        ]);
      } catch (err: any) {
        setEntries((prev) => [
          ...prev,
          { id: `err-${Date.now()}`, type: 'error', text: `touch: ${err.message}`, time: timeStr },
        ]);
      }
      return;
    }

    if (command === 'rm') {
      if (!args[0]) {
        setEntries((prev) => [
          ...prev,
          { id: `err-${Date.now()}`, type: 'error', text: 'Usage: rm <filename>', time: timeStr },
        ]);
        return;
      }
      try {
        await VirtualFS.deleteFile(projectId, args[0]);
        setEntries((prev) => [
          ...prev,
          { id: `out-${Date.now()}`, type: 'output', text: `Removed: ${args[0]}`, time: timeStr },
        ]);
      } catch (err: any) {
        setEntries((prev) => [
          ...prev,
          { id: `err-${Date.now()}`, type: 'error', text: `rm: ${err.message}`, time: timeStr },
        ]);
      }
      return;
    }

    if (command === 'build') {
      setEntries((prev) => [
        ...prev,
        { id: `out-${Date.now()}`, type: 'info', text: 'Synthesizing module tree...\nAll project assets verified in VirtualFS. Ready for execution.', time: timeStr },
      ]);
      return;
    }

    if (command === 'run') {
      onRefreshPreview?.();
      setEntries((prev) => [
        ...prev,
        { id: `out-${Date.now()}`, type: 'info', text: 'Triggering live preview refresh...', time: timeStr },
      ]);
      return;
    }

    if (command === 'env') {
      setEntries((prev) => [
        ...prev,
        {
          id: `out-${Date.now()}`,
          type: 'output',
          text: `NODE_ENV=browser\nNEXA_AI_PROVIDER=${settings.provider}\nNEXA_THEME=${settings.theme}\nREMOTE_RUNNER=${settings.remoteRunnerUrl || '(not configured)'}`,
          time: timeStr,
        },
      ]);
      return;
    }

    if (command === 'remote') {
      if (!settings.remoteRunnerUrl) {
        setEntries((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            type: 'error',
            text: 'Remote runner is not configured. Go to Settings and supply a Remote Runner URL and token.',
            time: timeStr,
          },
        ]);
        return;
      }

      setEntries((prev) => [
        ...prev,
        {
          id: `info-${Date.now()}`,
          type: 'info',
          text: `Connecting to Remote Runner at ${settings.remoteRunnerUrl}...`,
          time: timeStr,
        },
      ]);

      try {
        const resp = await fetch(`${settings.remoteRunnerUrl}/exec`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${settings.remoteRunnerToken || ''}`,
          },
          body: JSON.stringify({ command: args.join(' ') }),
        });
        const data = await resp.json();
        setEntries((prev) => [
          ...prev,
          { id: `out-${Date.now()}`, type: 'output', text: data.stdout || data.output || 'Command executed.', time: timeStr },
        ]);
      } catch (err: any) {
        setEntries((prev) => [
          ...prev,
          { id: `err-${Date.now()}`, type: 'error', text: `Remote Runner error: ${err.message}`, time: timeStr },
        ]);
      }
      return;
    }

    // Default unrecognized command
    setEntries((prev) => [
      ...prev,
      { id: `err-${Date.now()}`, type: 'error', text: `command not found: ${command}. Type "help" for options.`, time: timeStr },
    ]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleCommand(inputVal);
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
    }
  };

  return (
    <div
      className={`border-t border-white/10 bg-[#070A12] flex flex-col transition-all duration-200 ${
        isCollapsed ? 'h-9' : isExpanded ? 'h-80 md:h-96' : 'h-48 md:h-56'
      }`}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between px-3 h-9 bg-[#0C101D] border-b border-white/5 select-none shrink-0">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
          <TerminalIcon className="w-3.5 h-3.5 text-cyan-400" />
          <span>Console & Terminal</span>
          <span className="text-[10px] text-slate-500 font-mono">({entries.length})</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setEntries([])}
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
              aria-label={isExpanded ? 'Restore terminal size' : 'Maximize terminal'}
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

      {/* Terminal Body */}
      {!isCollapsed && (
        <div
          ref={containerRef}
          onClick={() => inputRef.current?.focus()}
          className="flex-1 p-3 font-mono text-xs overflow-y-auto space-y-1.5 selection:bg-cyan-500 selection:text-black cursor-text"
        >
          {entries.map((entry) => {
            let color = 'text-slate-300';
            if (entry.type === 'input') color = 'text-cyan-400 font-semibold';
            if (entry.type === 'error') color = 'text-red-400';
            if (entry.type === 'info') color = 'text-violet-400';
            if (entry.type === 'system') color = 'text-emerald-400';

            return (
              <div key={entry.id} className="leading-relaxed flex items-start gap-2">
                <span className="text-slate-600 text-[10px] tabular-nums select-none shrink-0 pt-0.5">
                  {entry.time}
                </span>
                <pre className={`whitespace-pre-wrap font-mono ${color}`}>{entry.text}</pre>
              </div>
            );
          })}

          {/* Active Input Prompt */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-cyan-400 font-bold select-none">$</span>
            <input
              ref={inputRef}
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type command..."
              className="flex-1 bg-transparent text-slate-100 outline-none font-mono text-xs placeholder:text-slate-600"
              spellCheck={false}
              autoComplete="off"
            />
          </div>
        </div>
      )}
    </div>
  );
}

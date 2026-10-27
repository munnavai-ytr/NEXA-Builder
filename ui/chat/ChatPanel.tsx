'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Square,
  Sparkles,
  Bot,
  User,
  CheckCircle2,
  Clock,
  Loader2,
  Wand2,
  FileCode2,
} from 'lucide-react';
import { MessageRecord, PlanStep } from '../../core/db';

interface ChatPanelProps {
  messages: MessageRecord[];
  isStreaming: boolean;
  activeSteps?: PlanStep[];
  onSendMessage: (text: string) => void;
  onStopStreaming: () => void;
  onEnhancePrompt?: (text: string) => string;
}

export function ChatPanel({
  messages,
  isStreaming,
  activeSteps,
  onSendMessage,
  onStopStreaming,
  onEnhancePrompt,
}: ChatPanelProps) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeSteps, isStreaming]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isStreaming) return;
    onSendMessage(inputText.trim());
    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  };

  const handleEnhance = () => {
    if (!inputText.trim() || !onEnhancePrompt) return;
    const enhanced = onEnhancePrompt(inputText);
    setInputText(enhanced);
  };

  return (
    <div className="flex flex-col h-full bg-[#070A12] border-r border-white/10 select-none overflow-hidden">
      {/* Chat Header */}
      <div className="flex items-center justify-between px-4 h-11 bg-[#0C101D] border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-gradient-to-tr from-violet-500 to-cyan-400 flex items-center justify-center">
            <Sparkles className="w-3 h-3 text-black" />
          </div>
          <span className="text-xs font-semibold text-slate-200">AI Architect</span>
          {isStreaming && (
            <span className="flex items-center gap-1 text-[11px] text-cyan-400 animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" />
              Building...
            </span>
          )}
        </div>

        {isStreaming && (
          <button
            onClick={onStopStreaming}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-md transition"
          >
            <Square className="w-3 h-3 fill-current" />
            Stop
          </button>
        )}
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-3 text-cyan-400 shadow-xl">
              <Bot className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-200 mb-1">How can NEXA help?</h3>
            <p className="text-xs text-slate-400 max-w-xs mb-4">
              Describe features, UI designs, or bug fixes. NEXA plans and edits your files in the browser.
            </p>
            <div className="flex flex-col gap-2 w-full max-w-xs text-xs">
              <button
                onClick={() => setInputText('Add an analytics metrics dashboard with live interactive charts')}
                className="p-2 text-left rounded-lg bg-white/5 border border-white/10 hover:border-cyan-500/40 text-slate-300 transition"
              >
                + Add an analytics metrics dashboard
              </button>
              <button
                onClick={() => setInputText('Implement responsive mobile navigation menu with smooth transitions')}
                className="p-2 text-left rounded-lg bg-white/5 border border-white/10 hover:border-cyan-500/40 text-slate-300 transition"
              >
                + Add responsive mobile navigation
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col gap-1.5 ${
                msg.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 px-1">
                {msg.role === 'user' ? (
                  <>
                    <span>You</span>
                    <User className="w-3 h-3 text-slate-400" />
                  </>
                ) : (
                  <>
                    <Bot className="w-3 h-3 text-cyan-400" />
                    <span>NEXA AI</span>
                  </>
                )}
                <span>·</span>
                <span className="tabular-nums">
                  {new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <div
                className={`max-w-[90%] rounded-xl p-3 text-xs leading-relaxed select-text ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md'
                    : 'bg-[#0E1322] border border-white/10 text-slate-200'
                }`}
              >
                <div className="whitespace-pre-wrap font-sans">{msg.content}</div>

                {/* If assistant has recorded steps */}
                {msg.steps && msg.steps.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/10 space-y-1.5">
                    <p className="text-[10px] font-semibold tracking-wider uppercase text-slate-400">
                      Build Pipeline
                    </p>
                    <div className="grid grid-cols-5 gap-1 text-[10px]">
                      {msg.steps.map((st) => (
                        <div
                          key={st.id}
                          className={`p-1 rounded text-center truncate border ${
                            st.status === 'completed'
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                              : st.status === 'running'
                              ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300 animate-pulse'
                              : 'bg-white/5 border-white/5 text-slate-500'
                          }`}
                        >
                          {st.name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {/* Active streaming steps card */}
        {isStreaming && activeSteps && activeSteps.length > 0 && (
          <div className="bg-[#0E1322] border border-cyan-500/30 rounded-xl p-3 shadow-lg text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-cyan-300 flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                Executing Pipeline
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1 text-[10px]">
              {activeSteps.map((st) => (
                <div
                  key={st.id}
                  className={`p-1.5 rounded text-center truncate border flex flex-col items-center gap-0.5 ${
                    st.status === 'completed'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : st.status === 'running'
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-200 animate-pulse font-semibold'
                      : 'bg-white/5 border-white/5 text-slate-500'
                  }`}
                >
                  <span>{st.name}</span>
                  {st.status === 'completed' && <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />}
                  {st.status === 'running' && <Loader2 className="w-2.5 h-2.5 animate-spin text-cyan-300" />}
                  {st.status === 'pending' && <Clock className="w-2.5 h-2.5 text-slate-600" />}
                </div>
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div className="p-3 bg-[#0C101D] border-t border-white/10 shrink-0">
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <div className="relative rounded-xl border border-white/10 bg-[#070A12] focus-within:border-cyan-500/60 focus-within:ring-1 focus-within:ring-cyan-500/30 transition shadow-inner">
            <textarea
              ref={textareaRef}
              rows={2}
              value={inputText}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask NEXA to build or modify anything... (Enter to send, Shift+Enter for newline)"
              className="w-full bg-transparent p-3 text-xs text-slate-100 placeholder:text-slate-500 outline-none resize-none min-h-[50px] max-h-[160px]"
            />

            <div className="flex items-center justify-between px-2.5 pb-2">
              <div className="flex items-center gap-1.5">
                {onEnhancePrompt && (
                  <button
                    type="button"
                    onClick={handleEnhance}
                    disabled={!inputText.trim()}
                    className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-cyan-400 hover:text-cyan-300 disabled:opacity-30 disabled:pointer-events-none hover:bg-cyan-500/10 rounded-md transition"
                    title="Enhance prompt with detailed specifications"
                  >
                    <Wand2 className="w-3 h-3" />
                    <span>Enhance</span>
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={!inputText.trim() || isStreaming}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-900 bg-gradient-to-r from-violet-400 to-cyan-400 hover:opacity-90 disabled:opacity-40 disabled:pointer-events-none rounded-lg transition shadow-md"
              >
                <span>Send</span>
                <Send className="w-3 h-3" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

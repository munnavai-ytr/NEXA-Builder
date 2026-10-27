'use client';

import React, { useState, useRef } from 'react';
import {
  Sparkles,
  Play,
  Paperclip,
  Wand2,
  Settings,
  FolderCode,
  Clock,
  Trash2,
  ArrowRight,
  Shield,
  Layers,
  Cpu,
  Laptop,
  Check,
} from 'lucide-react';
import { useNexaStore } from '../../core/store';
import { hasActiveApiKey } from '../../core/settings';

const PROMPT_CHIPS = [
  {
    title: 'Modern SaaS Observability Landing',
    prompt: 'Build a high-converting dark SaaS landing page for an AI observability platform with interactive live telemetry charts, pricing calculator, and clean responsive navigation.',
    template: 'saas' as const,
  },
  {
    title: 'Interactive Kanban Board',
    prompt: 'Build a responsive Kanban board web app with columns for Todo, In Progress, Done, interactive task creation, and smooth drag-and-drop state transitions.',
    template: 'kanban' as const,
  },
  {
    title: 'Markdown Documentation & Notes',
    prompt: 'Build a developer documentation and note-taking PWA with markdown live preview, search filter, sidebar table of contents, and syntax highlighted code blocks.',
    template: 'docs' as const,
  },
  {
    title: 'Financial Crypto Tracker',
    prompt: 'Build a cryptocurrency and asset portfolio tracker with live price simulations, profit/loss calculator, asset allocation bar, and responsive touch controls.',
    template: 'saas' as const,
  },
];

export function HomePage() {
  const {
    projects,
    isLoadingProjects,
    settings,
    openSettings,
    createProjectFromPrompt,
    openProject,
    deleteProject,
    enhancePrompt,
  } = useNexaStore();

  const [promptInput, setPromptInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<'saas' | 'kanban' | 'docs'>('saas');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleRun = async () => {
    const text = promptInput.trim() || 'Modern SaaS Landing Page';
    
    // Check if key is required
    if (!hasActiveApiKey(settings) && settings.provider !== 'custom') {
      openSettings(`To build with ${settings.provider}, please enter your API key.`);
      return;
    }

    setIsCreating(true);
    try {
      await createProjectFromPrompt(text, selectedTemplate);
    } catch (err) {
      console.error('Failed to create project:', err);
      setIsCreating(false);
    }
  };

  const handleEnhance = () => {
    if (!promptInput.trim()) {
      setPromptInput('Build an enterprise developer workspace with real-time analytics');
    }
    const enhanced = enhancePrompt(promptInput || 'Build an enterprise developer workspace with real-time analytics');
    setPromptInput(enhanced);
  };

  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const content = evt.target?.result as string;
      const initialPrompt = `Imported from ${file.name}:\nBuild a modern web app incorporating the uploaded assets and layout.`;
      setIsCreating(true);
      const projectId = await createProjectFromPrompt(initialPrompt, selectedTemplate);
      // Also write imported file to project
      const { createNewFile } = useNexaStore.getState();
      await createNewFile(file.name);
      const { updateActiveContent, saveActiveFile } = useNexaStore.getState();
      updateActiveContent(content);
      await saveActiveFile();
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-[#070A12] text-slate-100 flex flex-col relative selection:bg-cyan-500 selection:text-black">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-b from-[#7C5CFF]/15 via-[#22D3EE]/10 to-transparent blur-3xl pointer-events-none rounded-full" />

      {/* Top Header */}
      <header className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto w-full z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#7C5CFF] to-[#22D3EE] flex items-center justify-center font-black text-black shadow-lg shadow-violet-500/20">
            N
          </div>
          <span className="text-base font-bold tracking-tight text-white">NEXA Builder</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => openSettings()}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-300 transition"
          >
            <Settings className="w-3.5 h-3.5 text-cyan-400" />
            <span>Settings & Keys</span>
          </button>
        </div>
      </header>

      {/* Main Hero & Chat Box */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-5 py-8 md:py-16 flex flex-col items-center z-10">
        <div className="text-center space-y-3 mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-slate-300 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>100% In-Browser · BYOK · Direct AI Streaming</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Build full-stack web apps in seconds with{' '}
            <span className="bg-gradient-to-r from-[#7C5CFF] to-[#22D3EE] bg-clip-text text-transparent">
              BYOK AI
            </span>
          </h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto leading-relaxed">
            Create, edit, and run complete web applications locally in your browser. Powered by your
            own Google Gemini, Claude, or OpenAI API keys.
          </p>
        </div>

        {/* Large Premium Chat Box */}
        <div className="w-full relative rounded-2xl glass-panel-elevated p-3 shadow-2xl transition-all focus-within:ring-2 focus-within:ring-cyan-500/40">
          <textarea
            ref={textareaRef}
            rows={4}
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleRun();
              }
            }}
            placeholder="Describe the application you want to build... (e.g. A modern SaaS metrics dashboard with dark theme, live charts, and customer management)"
            className="w-full bg-transparent p-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none resize-none min-h-[96px] max-h-[220px]"
          />

          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/5 px-2 pb-1">
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileAttach}
                accept=".html,.css,.js,.json,.txt"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded-lg transition"
                title="Attach HTML or JS file"
              >
                <Paperclip className="w-3.5 h-3.5" />
                <span>Attach File</span>
              </button>

              <button
                type="button"
                onClick={handleEnhance}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 rounded-lg transition"
                title="Enhance prompt into a detailed production specification"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>Enhance prompt</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleRun}
              disabled={isCreating}
              className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-slate-950 bg-gradient-to-r from-[#7C5CFF] to-[#22D3EE] hover:opacity-95 rounded-xl transition shadow-lg shadow-cyan-500/20 active:scale-95 disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isCreating ? 'Synthesizing...' : 'Run & Build'}</span>
            </button>
          </div>
        </div>

        {/* Example Prompt Chips */}
        <div className="w-full mt-6 space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider text-left">
            Prompt Inspirations
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {PROMPT_CHIPS.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setPromptInput(chip.prompt);
                  setSelectedTemplate(chip.template);
                }}
                className="flex flex-col items-start p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-cyan-500/30 text-left transition group"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300 transition">
                    {chip.title}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 transition" />
                </div>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                  {chip.prompt}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Recent Projects Section (IndexedDB) */}
        <div className="w-full mt-14 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <FolderCode className="w-4 h-4 text-cyan-400" />
              Recent Projects in IndexedDB
            </h2>
            <span className="text-xs text-slate-500 tabular-nums">
              {projects.length} {projects.length === 1 ? 'project' : 'projects'} saved
            </span>
          </div>

          {isLoadingProjects ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading stored projects...</div>
          ) : projects.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-white/10 text-center space-y-2">
              <FolderCode className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400">No projects created yet.</p>
              <p className="text-[11px] text-slate-500">
                Type an idea above and click &quot;Run &amp; Build&quot; to generate your first application.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {projects.map((proj) => (
                <div
                  key={proj.id}
                  onClick={() => openProject(proj.id)}
                  className="group relative p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-cyan-500/40 cursor-pointer transition flex flex-col justify-between h-36"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-white group-hover:text-cyan-300 truncate">
                        {proj.name}
                      </h3>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete project "${proj.name}"?`)) {
                            deleteProject(proj.id);
                          }
                        }}
                        className="p-1 text-slate-500 hover:text-red-400 rounded opacity-0 group-hover:opacity-100 transition"
                        title="Delete project"
                        aria-label="Delete project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                      {proj.description || 'Full-stack in-browser web application.'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-3 border-t border-white/5">
                    <span className="flex items-center gap-1 tabular-nums">
                      <Clock className="w-3 h-3 text-slate-600" />
                      {new Date(proj.updatedAt).toLocaleDateString()}
                    </span>
                    <span className="text-cyan-400 group-hover:underline">Open IDE →</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-6 text-center text-xs text-slate-500 border-t border-white/5 mt-auto">
        <p>NEXA Builder · Client-side Virtual File System & BYOK Studio</p>
      </footer>
    </div>
  );
}

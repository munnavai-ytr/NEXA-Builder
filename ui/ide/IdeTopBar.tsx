'use client';

import React, { useState } from 'react';
import {
  ArrowLeft,
  Sparkles,
  Download,
  Github,
  Settings,
  Check,
  Loader2,
  Edit2,
  FolderOpen,
  Share2,
} from 'lucide-react';
import { useNexaStore } from '../../core/store';

export function IdeTopBar() {
  const {
    activeProject,
    updateProjectName,
    navigateToHome,
    openSettings,
    openExportModal,
    isSaving,
    hasUnsavedChanges,
    lastSavedAt,
  } = useNexaStore();

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(activeProject?.name || 'Untitled App');

  const handleSaveName = () => {
    if (nameInput.trim()) {
      updateProjectName(nameInput.trim());
    }
    setIsEditingName(false);
  };

  return (
    <header className="flex items-center justify-between px-3 md:px-5 h-12 bg-[#0C101D] border-b border-white/10 shrink-0 gap-2 select-none z-20">
      {/* Left: Back & Project Wordmark */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={navigateToHome}
          className="flex items-center gap-1.5 text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-white/5 transition"
          title="Back to Projects"
        >
          <ArrowLeft className="w-4 h-4" />
          <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-violet-600 to-cyan-400 flex items-center justify-center font-black text-[11px] text-black">
            N
          </div>
        </button>

        <div className="h-4 w-px bg-white/10 hidden sm:block" />

        {/* Project Name (Editable Inline) */}
        <div className="flex items-center gap-1.5 min-w-0">
          {isEditingName ? (
            <input
              type="text"
              value={nameInput}
              autoFocus
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveName();
                if (e.key === 'Escape') setIsEditingName(false);
              }}
              className="bg-black/60 border border-cyan-400 text-xs font-semibold px-2 py-0.5 rounded text-white outline-none w-36 sm:w-56"
            />
          ) : (
            <button
              onClick={() => {
                setNameInput(activeProject?.name || '');
                setIsEditingName(true);
              }}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-100 hover:text-cyan-300 truncate group max-w-[140px] sm:max-w-xs transition text-left"
              title="Click to rename project"
            >
              <span className="truncate">{activeProject?.name || 'Untitled App'}</span>
              <Edit2 className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 transition shrink-0" />
            </button>
          )}
        </div>

        {/* Save Status */}
        <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-slate-400 ml-2">
          {isSaving ? (
            <span className="flex items-center gap-1 text-cyan-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Saving...</span>
            </span>
          ) : hasUnsavedChanges ? (
            <span className="flex items-center gap-1 text-amber-400">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>Unsaved changes</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-emerald-400">
              <Check className="w-3 h-3" />
              <span>Saved</span>
            </span>
          )}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <button
          onClick={openExportModal}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition"
          title="Export Project ZIP"
        >
          <Download className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">Export ZIP</span>
        </button>

        <button
          onClick={openExportModal}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition"
          title="Push to GitHub"
        >
          <Github className="w-3.5 h-3.5 text-violet-400" />
          <span className="hidden md:inline">GitHub</span>
        </button>

        <button
          onClick={() => openSettings()}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition"
          title="Settings & BYOK"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}

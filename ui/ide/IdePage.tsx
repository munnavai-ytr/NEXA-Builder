'use client';

import React, { useState } from 'react';
import {
  MessageSquare,
  FolderTree,
  Eye,
  Terminal,
  X,
  Plus,
  Save,
  Check,
  Code2,
} from 'lucide-react';
import { useNexaStore } from '../../core/store';
import { IdeTopBar } from './IdeTopBar';
import { ChatPanel } from '../chat/ChatPanel';
import { FileTree } from '../editor/FileTree';
import { CodeMirrorEditor } from '../editor/CodeMirrorEditor';
import { PreviewPanel } from '../../preview/PreviewPanel';
import { TerminalPanel } from '../../terminal/TerminalPanel';

export function IdePage() {
  const {
    activeProject,
    files,
    fileTree,
    activeFilePath,
    openTabs,
    activeFileContent,
    hasUnsavedChanges,
    messages,
    isStreaming,
    activeSteps,
    settings,
    previewRefreshTrigger,
    isTerminalCollapsed,
    mobileActiveTab,
    selectFile,
    closeTab,
    updateActiveContent,
    saveActiveFile,
    createNewFile,
    createNewFolder,
    deleteNode,
    renameNode,
    sendMessage,
    stopStreaming,
    enhancePrompt,
    toggleTerminalCollapse,
    triggerPreviewRefresh,
    setMobileActiveTab,
  } = useNexaStore();

  const [tabletView, setTabletView] = useState<'editor' | 'preview'>('editor');

  const handleCreateNewFile = () => {
    const filename = prompt('Enter new file path (e.g. src/components/Button.jsx):');
    if (filename) {
      createNewFile(filename);
    }
  };

  const handleCreateNewFolder = () => {
    const foldername = prompt('Enter new directory path (e.g. src/utils):');
    if (foldername) {
      createNewFolder(foldername);
    }
  };

  if (!activeProject) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#070A12] text-slate-400">
        Loading project workspace...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#070A12] select-none text-slate-100">
      {/* Top Header Bar */}
      <IdeTopBar />

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* =========================================================================
            DESKTOP 3-PANEL LAYOUT (>= 1024px)
           ========================================================================= */}
        <div className="hidden lg:flex w-full h-full overflow-hidden">
          {/* Panel 1: Chat Panel (Left, 340px) */}
          <div className="w-80 xl:w-96 h-full shrink-0 flex flex-col">
            <ChatPanel
              messages={messages}
              isStreaming={isStreaming}
              activeSteps={activeSteps}
              onSendMessage={sendMessage}
              onStopStreaming={stopStreaming}
              onEnhancePrompt={enhancePrompt}
            />
          </div>

          {/* Panel 2: File Tree + Code Editor (Middle, flex-1) */}
          <div className="flex-1 h-full flex border-r border-white/10 overflow-hidden bg-[#070A12]">
            {/* File Tree */}
            <FileTree
              tree={fileTree}
              activeFile={activeFilePath}
              onSelectFile={selectFile}
              onCreateFile={handleCreateNewFile}
              onCreateFolder={handleCreateNewFolder}
              onDeleteNode={deleteNode}
              onRenameNode={renameNode}
            />

            {/* Code Editor Container */}
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#070A12]">
              {/* Tab Bar */}
              <div className="flex items-center justify-between h-9 bg-[#0C101D] border-b border-white/5 overflow-x-auto shrink-0 px-2 gap-1">
                <div className="flex items-center gap-1 overflow-x-auto">
                  {openTabs.map((tab) => {
                    const isActive = tab === activeFilePath;
                    const fileName = tab.split('/').pop() || tab;
                    return (
                      <div
                        key={tab}
                        onClick={() => selectFile(tab)}
                        className={`flex items-center gap-1.5 px-3 h-7 rounded-md text-xs cursor-pointer transition select-none ${
                          isActive
                            ? 'bg-[#070A12] text-cyan-300 border border-white/10 font-medium'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                        }`}
                      >
                        <span className="truncate max-w-[120px]">{fileName}</span>
                        {isActive && hasUnsavedChanges && (
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            closeTab(tab);
                          }}
                          className="hover:text-red-400 p-0.5 rounded"
                          aria-label="Close tab"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={saveActiveFile}
                    disabled={!hasUnsavedChanges}
                    className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-300 hover:text-white disabled:opacity-30 rounded hover:bg-white/5 transition"
                    title="Save active file"
                  >
                    <Save className="w-3 h-3" />
                    <span>Save</span>
                  </button>
                </div>
              </div>

              {/* CodeMirror Editor */}
              <div className="flex-1 relative overflow-hidden">
                {activeFilePath ? (
                  <CodeMirrorEditor
                    filePath={activeFilePath}
                    value={activeFileContent}
                    onChange={updateActiveContent}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs">
                    <Code2 className="w-8 h-8 mb-2 opacity-40" />
                    <p>No file selected</p>
                    <button
                      onClick={handleCreateNewFile}
                      className="mt-2 text-cyan-400 hover:underline"
                    >
                      + Create a file
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Panel 3: Live Preview (Top) over Terminal (Bottom) (Right, 420px to flex) */}
          <div className="w-[440px] xl:w-[480px] h-full flex flex-col shrink-0 overflow-hidden bg-[#070A12]">
            <div className="flex-1 overflow-hidden">
              <PreviewPanel
                files={files}
                projectName={activeProject.name}
                refreshTrigger={previewRefreshTrigger}
              />
            </div>
            <TerminalPanel
              projectId={activeProject.id}
              settings={settings}
              isCollapsed={isTerminalCollapsed}
              onToggleCollapse={toggleTerminalCollapse}
              onRefreshPreview={triggerPreviewRefresh}
            />
          </div>
        </div>

        {/* =========================================================================
            TABLET 2-PANEL LAYOUT (768px - 1023px)
           ========================================================================= */}
        <div className="hidden md:flex lg:hidden w-full h-full overflow-hidden">
          {/* Left panel: Chat (300px) */}
          <div className="w-72 h-full shrink-0 flex flex-col border-r border-white/10">
            <ChatPanel
              messages={messages}
              isStreaming={isStreaming}
              activeSteps={activeSteps}
              onSendMessage={sendMessage}
              onStopStreaming={stopStreaming}
              onEnhancePrompt={enhancePrompt}
            />
          </div>

          {/* Right panel: Toggle between Editor and Preview/Terminal */}
          <div className="flex-1 h-full flex flex-col overflow-hidden">
            {/* Tablet View Switcher Header */}
            <div className="flex items-center justify-between px-3 h-9 bg-[#0C101D] border-b border-white/10 shrink-0">
              <div className="flex items-center gap-1 p-0.5 bg-black/40 rounded-lg border border-white/5">
                <button
                  onClick={() => setTabletView('editor')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                    tabletView === 'editor'
                      ? 'bg-cyan-500/20 text-cyan-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Editor & Files
                </button>
                <button
                  onClick={() => setTabletView('preview')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                    tabletView === 'preview'
                      ? 'bg-cyan-500/20 text-cyan-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Live Preview & Terminal
                </button>
              </div>
            </div>

            {tabletView === 'editor' ? (
              <div className="flex-1 flex overflow-hidden">
                <FileTree
                  tree={fileTree}
                  activeFile={activeFilePath}
                  onSelectFile={selectFile}
                  onCreateFile={handleCreateNewFile}
                  onCreateFolder={handleCreateNewFolder}
                  onDeleteNode={deleteNode}
                  onRenameNode={renameNode}
                />
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                  <div className="flex-1 relative overflow-hidden">
                    {activeFilePath && (
                      <CodeMirrorEditor
                        filePath={activeFilePath}
                        value={activeFileContent}
                        onChange={updateActiveContent}
                      />
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-hidden">
                  <PreviewPanel
                    files={files}
                    projectName={activeProject.name}
                    refreshTrigger={previewRefreshTrigger}
                  />
                </div>
                <TerminalPanel
                  projectId={activeProject.id}
                  settings={settings}
                  isCollapsed={isTerminalCollapsed}
                  onToggleCollapse={toggleTerminalCollapse}
                  onRefreshPreview={triggerPreviewRefresh}
                />
              </div>
            )}
          </div>
        </div>

        {/* =========================================================================
            MOBILE SINGLE VIEW (< 768px)
           ========================================================================= */}
        <div className="flex md:hidden w-full h-full flex-col overflow-hidden pb-14">
          {mobileActiveTab === 'chat' && (
            <div className="w-full h-full">
              <ChatPanel
                messages={messages}
                isStreaming={isStreaming}
                activeSteps={activeSteps}
                onSendMessage={sendMessage}
                onStopStreaming={stopStreaming}
                onEnhancePrompt={enhancePrompt}
              />
            </div>
          )}

          {mobileActiveTab === 'files' && (
            <div className="w-full h-full flex flex-col overflow-hidden bg-[#070A12]">
              <div className="h-44 border-b border-white/10 overflow-y-auto">
                <FileTree
                  tree={fileTree}
                  activeFile={activeFilePath}
                  onSelectFile={(path) => selectFile(path)}
                  onCreateFile={handleCreateNewFile}
                  onCreateFolder={handleCreateNewFolder}
                  onDeleteNode={deleteNode}
                  onRenameNode={renameNode}
                />
              </div>
              <div className="flex-1 relative overflow-hidden">
                {activeFilePath ? (
                  <CodeMirrorEditor
                    filePath={activeFilePath}
                    value={activeFileContent}
                    onChange={updateActiveContent}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-xs text-slate-500">
                    Tap a file in the explorer above to edit
                  </div>
                )}
              </div>
            </div>
          )}

          {mobileActiveTab === 'preview' && (
            <div className="w-full h-full">
              <PreviewPanel
                files={files}
                projectName={activeProject.name}
                refreshTrigger={previewRefreshTrigger}
              />
            </div>
          )}

          {mobileActiveTab === 'terminal' && (
            <div className="w-full h-full flex flex-col">
              <TerminalPanel
                projectId={activeProject.id}
                settings={settings}
                isCollapsed={false}
                onToggleCollapse={() => {}}
                onRefreshPreview={triggerPreviewRefresh}
              />
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          MOBILE BOTTOM TAB BAR (< 768px, 44px+ touch targets, safe-area)
         ========================================================================= */}
      <nav className="flex md:hidden fixed bottom-0 left-0 right-0 h-14 bg-[#0C101D] border-t border-white/10 z-30 px-3 items-center justify-around select-none">
        <button
          onClick={() => setMobileActiveTab('chat')}
          className={`flex flex-col items-center justify-center touch-target-44 px-3 rounded-lg transition ${
            mobileActiveTab === 'chat'
              ? 'text-cyan-300 font-medium'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          aria-label="Chat tab"
        >
          <MessageSquare className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">Chat</span>
        </button>

        <button
          onClick={() => setMobileActiveTab('files')}
          className={`flex flex-col items-center justify-center touch-target-44 px-3 rounded-lg transition ${
            mobileActiveTab === 'files'
              ? 'text-cyan-300 font-medium'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          aria-label="Files tab"
        >
          <FolderTree className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">Files</span>
        </button>

        <button
          onClick={() => setMobileActiveTab('preview')}
          className={`flex flex-col items-center justify-center touch-target-44 px-3 rounded-lg transition ${
            mobileActiveTab === 'preview'
              ? 'text-cyan-300 font-medium'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          aria-label="Preview tab"
        >
          <Eye className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">Preview</span>
        </button>

        <button
          onClick={() => setMobileActiveTab('terminal')}
          className={`flex flex-col items-center justify-center touch-target-44 px-3 rounded-lg transition ${
            mobileActiveTab === 'terminal'
              ? 'text-cyan-300 font-medium'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          aria-label="Terminal tab"
        >
          <Terminal className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">Terminal</span>
        </button>
      </nav>
    </div>
  );
}

'use client';

import React, { useEffect } from 'react';
import { useNexaStore } from '../core/store';
import { HomePage } from '../ui/home/HomePage';
import { IdePage } from '../ui/ide/IdePage';
import { SettingsModal } from '../ui/settings/SettingsModal';
import { ExportModal } from '../ui/export/ExportModal';
import { applyTheme } from '../lib/theme';

export default function NexaApp() {
  const {
    currentView,
    loadInitialData,
    settings,
    isSettingsOpen,
    settingsPromptReason,
    closeSettings,
    updateSettings,
    isExportOpen,
    closeExportModal,
    activeProject,
  } = useNexaStore();

  useEffect(() => {
    // Initialize DB and theme
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    applyTheme(settings.theme || 'violetCyan');
  }, [settings.theme]);

  return (
    <div className="min-h-screen bg-[#070A12] text-slate-100 flex flex-col font-sans">
      {currentView === 'home' ? <HomePage /> : <IdePage />}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        settings={settings}
        initialMessage={settingsPromptReason}
        onClose={closeSettings}
        onSave={updateSettings}
      />

      {/* Export / GitHub Modal */}
      {activeProject && (
        <ExportModal
          isOpen={isExportOpen}
          projectId={activeProject.id}
          projectName={activeProject.name}
          onClose={closeExportModal}
        />
      )}
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import {
  X,
  Key,
  ShieldCheck,
  Cpu,
  Palette,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Eye,
  EyeOff,
  Terminal,
  Layers,
} from 'lucide-react';
import {
  NexaSettings,
  AIProviderId,
  PROVIDERS,
  saveSettings,
} from '../../core/settings';
import { PROVIDER_INSTANCES } from '../../ai/provider';
import { THEME_PRESETS, applyTheme } from '../../lib/theme';

interface SettingsModalProps {
  isOpen: boolean;
  settings: NexaSettings;
  initialMessage?: string;
  onClose: () => void;
  onSave: (updated: NexaSettings) => void;
}

export function SettingsModal({
  isOpen,
  settings: initialSettings,
  initialMessage,
  onClose,
  onSave,
}: SettingsModalProps) {
  const [settings, setSettings] = useState<NexaSettings>(initialSettings);
  const [showKey, setShowKey] = useState(false);
  const [testingKey, setTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  if (!isOpen) return null;

  const currentProviderMeta = PROVIDERS[settings.provider];
  const currentKey = settings.apiKeys[settings.provider] || '';
  const currentModel = settings.models[settings.provider] || currentProviderMeta.defaultModel;

  const handleProviderChange = (newProvider: AIProviderId) => {
    setTestResult(null);
    setSettings((prev) => ({
      ...prev,
      provider: newProvider,
    }));
  };

  const handleKeyChange = (val: string) => {
    setTestResult(null);
    setSettings((prev) => ({
      ...prev,
      apiKeys: {
        ...prev.apiKeys,
        [prev.provider]: val,
      },
    }));
  };

  const handleModelChange = (val: string) => {
    setSettings((prev) => ({
      ...prev,
      models: {
        ...prev.models,
        [prev.provider]: val,
      },
    }));
  };

  const handleThemeChange = (themeId: string) => {
    applyTheme(themeId);
    setSettings((prev) => ({ ...prev, theme: themeId }));
  };

  const handleTestKey = async () => {
    setTestingKey(true);
    setTestResult(null);
    try {
      const provider = PROVIDER_INSTANCES[settings.provider];
      const res = await provider.testConnection(settings);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.message || 'Connection failed',
      });
    } finally {
      setTestingKey(false);
    }
  };

  const handleSaveAndClose = () => {
    saveSettings(settings);
    onSave(settings);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl bg-[#0C101D] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-cyan-500 flex items-center justify-center text-white shadow-md">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">NEXA Studio Settings</h2>
              <p className="text-xs text-slate-400">Bring Your Own Key (BYOK) & Environment</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Friendly alert if opened because no key was set */}
        {initialMessage && (
          <div className="px-6 py-3 bg-cyan-500/10 border-b border-cyan-500/20 flex items-center gap-2 text-xs text-cyan-300">
            <AlertTriangle className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>{initialMessage}</span>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Privacy Note */}
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-300 space-y-1">
              <p className="font-semibold text-emerald-300">Zero Middleman Server Policy</p>
              <p className="text-slate-400 leading-relaxed">
                Your API keys and projects are stored exclusively in your browser’s localStorage and
                IndexedDB. When executing prompts, requests travel directly from your browser to your
                chosen AI provider. We never log or proxy your keys.
              </p>
            </div>
          </div>

          {/* AI Provider Selector */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              AI Intelligence Provider
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(PROVIDERS) as AIProviderId[]).map((pid) => {
                const prov = PROVIDERS[pid];
                const isSelected = settings.provider === pid;
                const hasKey = Boolean(settings.apiKeys[pid]?.trim());

                return (
                  <button
                    key={pid}
                    type="button"
                    onClick={() => handleProviderChange(pid)}
                    className={`flex flex-col items-start p-3 rounded-xl border text-left transition ${
                      isSelected
                        ? 'bg-cyan-500/10 border-cyan-500/60 shadow-lg shadow-cyan-500/10'
                        : 'bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className={`text-xs font-semibold ${isSelected ? 'text-cyan-300' : 'text-slate-200'}`}>
                        {prov.name}
                      </span>
                      {hasKey && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Key saved" />}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 truncate w-full">
                      {prov.defaultModel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* API Key Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-cyan-400" />
                {currentProviderMeta.name} API Key
              </label>
              {currentProviderMeta.keyUrl && (
                <a
                  href={currentProviderMeta.keyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 hover:underline"
                >
                  <span>Get {currentProviderMeta.name} Key</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={currentKey}
                onChange={(e) => handleKeyChange(e.target.value)}
                placeholder={currentProviderMeta.placeholderKey}
                className="w-full bg-[#070A12] border border-white/10 focus:border-cyan-500/60 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-slate-600 outline-none pr-24 font-mono"
              />
              <div className="absolute right-2 top-2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="p-1 text-slate-400 hover:text-white rounded transition"
                  title={showKey ? 'Hide key' : 'Show key'}
                  aria-label={showKey ? 'Hide key' : 'Show key'}
                >
                  {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={handleTestKey}
                  disabled={testingKey || !currentKey}
                  className="px-2 py-1 text-[11px] font-medium bg-white/10 hover:bg-white/15 disabled:opacity-40 text-slate-200 rounded-md transition flex items-center gap-1"
                >
                  {testingKey ? <Loader2 className="w-3 h-3 animate-spin text-cyan-400" /> : null}
                  <span>Test</span>
                </button>
              </div>
            </div>

            {/* Test result display */}
            {testResult && (
              <div
                className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                  testResult.success
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                    : 'bg-red-500/10 border border-red-500/30 text-red-300'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>

          {/* Model Name & Suggestions */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              Model Name
            </label>
            <input
              type="text"
              value={currentModel}
              onChange={(e) => handleModelChange(e.target.value)}
              placeholder="e.g. gemini-2.5-flash"
              className="w-full bg-[#070A12] border border-white/10 focus:border-cyan-500/60 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none font-mono"
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="text-[10px] text-slate-500 py-0.5">Suggestions:</span>
              {currentProviderMeta.models.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleModelChange(m)}
                  className={`text-[10px] px-2 py-0.5 rounded-full border transition font-mono ${
                    currentModel === m
                      ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                      : 'bg-white/5 border-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Base URL (if custom) */}
          {settings.provider === 'custom' && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">
                Custom API Base URL (OpenAI-compatible)
              </label>
              <input
                type="text"
                value={settings.customBaseUrl}
                onChange={(e) => setSettings({ ...settings, customBaseUrl: e.target.value })}
                placeholder="http://localhost:11434/v1"
                className="w-full bg-[#070A12] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none font-mono"
              />
            </div>
          )}

          {/* Remote Runner Configuration */}
          <div className="space-y-2 pt-2 border-t border-white/5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              Remote Runner (Optional)
            </label>
            <p className="text-[11px] text-slate-400">
              Execute commands on an external server or container from the terminal panel.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={settings.remoteRunnerUrl}
                onChange={(e) => setSettings({ ...settings, remoteRunnerUrl: e.target.value })}
                placeholder="https://runner.example.com"
                className="bg-[#070A12] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none font-mono"
              />
              <input
                type="password"
                value={settings.remoteRunnerToken}
                onChange={(e) => setSettings({ ...settings, remoteRunnerToken: e.target.value })}
                placeholder="Bearer Token (optional)"
                className="bg-[#070A12] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none font-mono"
              />
            </div>
          </div>

          {/* Theme Settings (Design tokens) */}
          <div className="space-y-3 pt-2 border-t border-white/5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-cyan-400" />
              Studio Theme Preset (Design Tokens)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {Object.values(THEME_PRESETS).map((th) => {
                const isActive = settings.theme === th.id;
                return (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => handleThemeChange(th.id)}
                    className={`p-3 rounded-xl border text-left flex flex-col gap-2 transition ${
                      isActive
                        ? 'bg-white/10 border-cyan-400/60 shadow-md'
                        : 'bg-white/5 border-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ background: th.colors.accentPrimary }}
                      />
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ background: th.colors.accentSecondary }}
                      />
                    </div>
                    <span className="text-xs font-medium text-slate-200">{th.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-[#0A0E1A] shrink-0">
          <div className="text-[11px] text-slate-400">
            Keys are stored locally in your browser.
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white rounded-lg hover:bg-white/5 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAndClose}
              className="px-5 py-2 text-xs font-semibold text-slate-900 bg-gradient-to-r from-violet-400 to-cyan-400 hover:opacity-90 rounded-lg shadow-md transition"
            >
              Save & Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

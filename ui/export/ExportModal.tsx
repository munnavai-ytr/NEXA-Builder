'use client';

import React, { useState } from 'react';
import { X, Download, Github, Check, Copy, AlertCircle, FileArchive } from 'lucide-react';
import JSZip from 'jszip';
import { getProjectFiles } from '../../core/db';

interface ExportModalProps {
  isOpen: boolean;
  projectId: string;
  projectName: string;
  onClose: () => void;
}

export function ExportModal({ isOpen, projectId, projectName, onClose }: ExportModalProps) {
  const [activeTab, setActiveTab] = useState<'zip' | 'github'>('zip');
  const [isExporting, setIsExporting] = useState(false);
  const [copiedGitCmds, setCopiedGitCmds] = useState(false);
  const [githubRepoName, setGithubRepoName] = useState(
    projectName.toLowerCase().replace(/[^a-z0-9_-]/g, '-') || 'my-nexa-app'
  );

  if (!isOpen) return null;

  const handleDownloadZip = async () => {
    setIsExporting(true);
    try {
      const files = await getProjectFiles(projectId);
      const zip = new JSZip();

      for (const file of files) {
        zip.file(file.path, file.content);
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName.toLowerCase().replace(/\s+/g, '-')}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export ZIP:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const gitCommands = `# Initialize and push to GitHub:
git init
git add .
git commit -m "Deploy app via NEXA Builder"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/${githubRepoName}.git
git push -u origin main`;

  const handleCopyGitCommands = () => {
    navigator.clipboard.writeText(gitCommands);
    setCopiedGitCmds(true);
    setTimeout(() => setCopiedGitCmds(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-[#0C101D] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-cyan-500 flex items-center justify-center text-white">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Export & Publish</h2>
              <p className="text-xs text-slate-400">{projectName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition"
            aria-label="Close export dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center border-b border-white/10 px-6 pt-3 gap-4">
          <button
            onClick={() => setActiveTab('zip')}
            className={`pb-2.5 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition ${
              activeTab === 'zip'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileArchive className="w-3.5 h-3.5" />
            <span>Download ZIP</span>
          </button>
          <button
            onClick={() => setActiveTab('github')}
            className={`pb-2.5 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition ${
              activeTab === 'github'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Github className="w-3.5 h-3.5" />
            <span>Push to GitHub</span>
          </button>
        </div>

        {/* Tab content */}
        <div className="p-6 space-y-4">
          {activeTab === 'zip' ? (
            <div className="space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                Export all project files directly from browser memory into a standard ZIP archive.
                You can extract and run it locally with any web server.
              </p>

              <button
                onClick={handleDownloadZip}
                disabled={isExporting}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-violet-500 to-cyan-400 text-slate-900 font-semibold text-xs rounded-xl hover:opacity-90 transition shadow-lg shadow-cyan-500/10"
              >
                <Download className="w-4 h-4" />
                <span>{isExporting ? 'Generating ZIP...' : 'Download Project ZIP'}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">
                  Repository Name
                </label>
                <input
                  type="text"
                  value={githubRepoName}
                  onChange={(e) => setGithubRepoName(e.target.value)}
                  className="w-full bg-[#070A12] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none font-mono"
                />
              </div>

              <div className="relative">
                <div className="flex items-center justify-between pb-1 text-slate-400 text-[11px]">
                  <span>Terminal setup instructions:</span>
                  <button
                    onClick={handleCopyGitCommands}
                    className="flex items-center gap-1 text-cyan-400 hover:underline"
                  >
                    {copiedGitCmds ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedGitCmds ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-black/60 border border-white/10 rounded-xl font-mono text-[11px] text-slate-300 overflow-x-auto whitespace-pre">
                  {gitCommands}
                </pre>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleDownloadZip}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white/10 hover:bg-white/15 text-white font-medium text-xs rounded-xl transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download ZIP first to push with Git</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/10 bg-[#0A0E1A] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-300 hover:text-white rounded-lg hover:bg-white/5 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

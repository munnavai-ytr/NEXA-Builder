'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Github,
  Check,
  Copy,
  AlertCircle,
  FileArchive,
  ExternalLink,
  Loader2,
  Key,
} from 'lucide-react';
import JSZip from 'jszip';
import { getProjectFiles } from '../../core/db';

interface ExportModalProps {
  isOpen: boolean;
  projectId: string;
  projectName: string;
  onClose: () => void;
}

const GITHUB_PAT_STORAGE_KEY = 'nexa_github_pat';
const GITHUB_OWNER_STORAGE_KEY = 'nexa_github_owner';

export function ExportModal({ isOpen, projectId, projectName, onClose }: ExportModalProps) {
  const [activeTab, setActiveTab] = useState<'zip' | 'github'>('zip');
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [isPushingGithub, setIsPushingGithub] = useState(false);
  const [pushStatus, setPushStatus] = useState<string>('');
  const [publishedRepoUrl, setPublishedRepoUrl] = useState<string | null>(null);
  const [pushError, setPushError] = useState<string | null>(null);

  const [token, setToken] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(GITHUB_PAT_STORAGE_KEY) || '';
    }
    return '';
  });
  const [owner, setOwner] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(GITHUB_OWNER_STORAGE_KEY) || '';
    }
    return '';
  });
  const [repoName, setRepoName] = useState(
    projectName.toLowerCase().replace(/[^a-z0-9_-]/g, '-') || 'my-nexa-app'
  );
  const [isPrivate, setIsPrivate] = useState(false);

  if (!isOpen) return null;

  const handleDownloadZip = async () => {
    setIsExportingZip(true);
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
      setIsExportingZip(false);
    }
  };

  /**
   * Pushes all project files to GitHub using the GitHub REST Git Database API
   */
  const handlePushToGithub = async () => {
    if (!token.trim()) {
      setPushError('Please provide a GitHub Personal Access Token');
      return;
    }
    if (!repoName.trim()) {
      setPushError('Please provide a repository name');
      return;
    }

    setIsPushingGithub(true);
    setPushError(null);
    setPushStatus('Connecting to GitHub API...');

    // Save token in localStorage
    localStorage.setItem(GITHUB_PAT_STORAGE_KEY, token.trim());
    if (owner.trim()) {
      localStorage.setItem(GITHUB_OWNER_STORAGE_KEY, owner.trim());
    }

    try {
      const authHeader = {
        Authorization: `Bearer ${token.trim()}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      };

      // 1. Get authenticated user login if owner not specified
      let userLogin = owner.trim();
      if (!userLogin) {
        setPushStatus('Resolving authenticated user profile...');
        const userResp = await fetch('https://api.github.com/user', { headers: authHeader });
        if (!userResp.ok) throw new Error('Invalid GitHub token or user authentication failed');
        const userData = await userResp.json();
        userLogin = userData.login;
        setOwner(userLogin);
        localStorage.setItem(GITHUB_OWNER_STORAGE_KEY, userLogin);
      }

      // 2. Check if repository exists, or create it
      setPushStatus(`Checking repository ${userLogin}/${repoName.trim()}...`);
      let repoResp = await fetch(`https://api.github.com/repos/${userLogin}/${repoName.trim()}`, {
        headers: authHeader,
      });

      if (!repoResp.ok) {
        setPushStatus(`Creating new repository "${repoName.trim()}" on GitHub...`);
        const createResp = await fetch('https://api.github.com/user/repos', {
          method: 'POST',
          headers: authHeader,
          body: JSON.stringify({
            name: repoName.trim(),
            description: `${projectName} built with NEXA Builder`,
            private: isPrivate,
            auto_init: true,
          }),
        });
        if (!createResp.ok) {
          const errData = await createResp.json();
          throw new Error(errData.message || 'Failed to create repository on GitHub');
        }
        // Wait a moment for git init on GitHub's backend
        await new Promise((r) => setTimeout(r, 1500));
      }

      // 3. Load all project files
      const files = await getProjectFiles(projectId);
      setPushStatus(`Uploading ${files.length} project file blobs to GitHub...`);

      // 4. Create Git Blobs
      const treeItems: { path: string; mode: string; type: string; sha: string }[] = [];

      for (const f of files) {
        const blobResp = await fetch(`https://api.github.com/repos/${userLogin}/${repoName.trim()}/git/blobs`, {
          method: 'POST',
          headers: authHeader,
          body: JSON.stringify({
            content: f.content,
            encoding: 'utf-8',
          }),
        });

        if (!blobResp.ok) {
          const errData = await blobResp.json();
          throw new Error(`Failed to upload file ${f.path}: ${errData.message}`);
        }

        const blobData = await blobResp.json();
        treeItems.push({
          path: f.path,
          mode: '100644',
          type: 'blob',
          sha: blobData.sha,
        });
      }

      // 5. Get latest commit SHA on main
      setPushStatus('Creating Git tree and commit...');
      let parentCommitSha: string | undefined;
      const refResp = await fetch(
        `https://api.github.com/repos/${userLogin}/${repoName.trim()}/git/ref/heads/main`,
        { headers: authHeader }
      );
      if (refResp.ok) {
        const refData = await refResp.json();
        parentCommitSha = refData.object.sha;
      }

      // 6. Create Git Tree
      const treeResp = await fetch(
        `https://api.github.com/repos/${userLogin}/${repoName.trim()}/git/trees`,
        {
          method: 'POST',
          headers: authHeader,
          body: JSON.stringify({
            base_tree: parentCommitSha,
            tree: treeItems,
          }),
        }
      );
      if (!treeResp.ok) {
        const errData = await treeResp.json();
        throw new Error(`Failed to create tree: ${errData.message}`);
      }
      const treeData = await treeResp.json();

      // 7. Create Git Commit
      const commitResp = await fetch(
        `https://api.github.com/repos/${userLogin}/${repoName.trim()}/git/commits`,
        {
          method: 'POST',
          headers: authHeader,
          body: JSON.stringify({
            message: `Deploy app from NEXA Builder [${new Date().toISOString()}]`,
            tree: treeData.sha,
            parents: parentCommitSha ? [parentCommitSha] : [],
          }),
        }
      );
      if (!commitResp.ok) {
        const errData = await commitResp.json();
        throw new Error(`Failed to create commit: ${errData.message}`);
      }
      const commitData = await commitResp.json();

      // 8. Update branch ref
      setPushStatus('Updating main branch...');
      if (parentCommitSha) {
        await fetch(`https://api.github.com/repos/${userLogin}/${repoName.trim()}/git/refs/heads/main`, {
          method: 'PATCH',
          headers: authHeader,
          body: JSON.stringify({ sha: commitData.sha, force: true }),
        });
      } else {
        await fetch(`https://api.github.com/repos/${userLogin}/${repoName.trim()}/git/refs`, {
          method: 'POST',
          headers: authHeader,
          body: JSON.stringify({ ref: 'refs/heads/main', sha: commitData.sha }),
        });
      }

      const repoUrl = `https://github.com/${userLogin}/${repoName.trim()}`;
      setPublishedRepoUrl(repoUrl);
      setPushStatus('Successfully published to GitHub!');
    } catch (err: any) {
      console.error('GitHub push error:', err);
      setPushError(err.message || 'Failed to push to GitHub');
    } finally {
      setIsPushingGithub(false);
    }
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
                disabled={isExportingZip}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-violet-500 to-cyan-400 text-slate-900 font-semibold text-xs rounded-xl hover:opacity-90 transition shadow-lg shadow-cyan-500/10"
              >
                <Download className="w-4 h-4" />
                <span>{isExportingZip ? 'Generating ZIP...' : 'Download Project ZIP'}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-300">
                Push all project files directly to your GitHub account using the GitHub REST API.
                Your Personal Access Token is saved only in localStorage on your device.
              </p>

              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                  <span>GitHub Personal Access Token</span>
                  <a
                    href="https://github.com/settings/tokens/new?scopes=repo"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
                  >
                    <span>Create Token</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </label>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="ghp_... or github_pat_..."
                  className="w-full bg-[#070A12] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none font-mono placeholder:text-slate-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">
                    Owner / Username
                  </label>
                  <input
                    type="text"
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                    placeholder="Auto-detected if blank"
                    className="w-full bg-[#070A12] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">
                    Repository Name
                  </label>
                  <input
                    type="text"
                    value={repoName}
                    onChange={(e) => setRepoName(e.target.value)}
                    className="w-full bg-[#070A12] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="private-repo"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="rounded border-white/20 bg-black text-cyan-500"
                />
                <label htmlFor="private-repo" className="text-xs text-slate-400">
                  Create as Private Repository
                </label>
              </div>

              {pushStatus && (
                <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-300 flex items-center gap-2">
                  {isPushingGithub ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400 shrink-0" />
                  ) : (
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  )}
                  <span>{pushStatus}</span>
                </div>
              )}

              {pushError && (
                <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <span>{pushError}</span>
                </div>
              )}

              {publishedRepoUrl && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs space-y-1">
                  <p className="font-semibold text-emerald-300">Repository Published!</p>
                  <a
                    href={publishedRepoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-400 hover:underline flex items-center gap-1 font-mono text-[11px]"
                  >
                    <span>{publishedRepoUrl}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              <button
                onClick={handlePushToGithub}
                disabled={isPushingGithub || !token.trim()}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-violet-600 to-cyan-500 text-white font-semibold text-xs rounded-xl hover:opacity-90 disabled:opacity-40 transition shadow-lg shadow-cyan-500/10"
              >
                {isPushingGithub ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Publishing to GitHub...</span>
                  </>
                ) : (
                  <>
                    <Github className="w-4 h-4" />
                    <span>Push Project to GitHub</span>
                  </>
                )}
              </button>
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

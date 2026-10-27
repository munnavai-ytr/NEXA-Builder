'use client';

import React, { useState } from 'react';
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  FileJson,
  File,
  Plus,
  Trash2,
  Edit2,
  ChevronRight,
  ChevronDown,
  FolderPlus,
} from 'lucide-react';
import { FSNode } from '../../core/fs';

interface FileTreeProps {
  tree: FSNode[];
  activeFile: string;
  onSelectFile: (path: string) => void;
  onCreateFile: (parentPath?: string) => void;
  onCreateFolder?: (parentPath?: string) => void;
  onDeleteNode: (path: string) => void;
  onRenameNode: (oldPath: string, newPath: string) => void;
}

export function FileTree({
  tree,
  activeFile,
  onSelectFile,
  onCreateFile,
  onCreateFolder,
  onDeleteNode,
  onRenameNode,
}: FileTreeProps) {
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');

  const toggleCollapse = (path: string) => {
    setCollapsedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'html' || ext === 'htm') return <FileCode className="w-3.5 h-3.5 text-orange-400 shrink-0" />;
    if (ext === 'css') return <FileCode className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
    if (ext === 'js' || ext === 'jsx') return <FileCode className="w-3.5 h-3.5 text-yellow-400 shrink-0" />;
    if (ext === 'ts' || ext === 'tsx') return <FileCode className="w-3.5 h-3.5 text-cyan-400 shrink-0" />;
    if (ext === 'json') return <FileJson className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    if (ext === 'md') return <FileText className="w-3.5 h-3.5 text-violet-400 shrink-0" />;
    return <File className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
  };

  const startRename = (node: FSNode) => {
    setRenamingPath(node.path);
    setRenameValue(node.name);
  };

  const submitRename = (node: FSNode) => {
    if (!renameValue.trim() || renameValue === node.name) {
      setRenamingPath(null);
      return;
    }
    const parent = node.path.includes('/')
      ? node.path.slice(0, node.path.lastIndexOf('/'))
      : '';
    const newPath = parent ? `${parent}/${renameValue.trim()}` : renameValue.trim();
    onRenameNode(node.path, newPath);
    setRenamingPath(null);
  };

  const renderNode = (node: FSNode, depth = 0) => {
    const isFolder = node.type === 'directory';
    const isCollapsed = collapsedPaths.has(node.path);
    const isActive = activeFile === node.path;
    const isRenaming = renamingPath === node.path;

    return (
      <div key={node.path} className="flex flex-col select-none">
        <div
          style={{ paddingLeft: `${depth * 14 + 10}px` }}
          className={`group flex items-center justify-between h-7 pr-2 cursor-pointer rounded text-xs transition ${
            isActive
              ? 'bg-cyan-500/15 text-cyan-300 font-medium'
              : 'text-slate-300 hover:bg-white/5 hover:text-slate-100'
          }`}
          onClick={() => {
            if (isFolder) {
              toggleCollapse(node.path);
            } else {
              onSelectFile(node.path);
            }
          }}
        >
          <div className="flex items-center gap-1.5 truncate flex-1 mr-1">
            {isFolder ? (
              <>
                <span className="text-slate-500 hover:text-slate-300">
                  {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </span>
                {isCollapsed ? (
                  <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                ) : (
                  <FolderOpen className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                )}
              </>
            ) : (
              <>
                <span className="w-3.5 shrink-0" />
                {getFileIcon(node.name)}
              </>
            )}

            {isRenaming ? (
              <input
                type="text"
                value={renameValue}
                autoFocus
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => submitRename(node)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitRename(node);
                  if (e.key === 'Escape') setRenamingPath(null);
                }}
                className="bg-black/60 border border-cyan-500/60 text-xs px-1 py-0.5 rounded text-white outline-none w-32"
              />
            ) : (
              <span className="truncate">{node.name}</span>
            )}
          </div>

          {/* Action buttons on hover */}
          {!isRenaming && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startRename(node);
                }}
                className="p-1 hover:text-cyan-400 rounded transition"
                title="Rename"
                aria-label="Rename"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete "${node.name}"?`)) {
                    onDeleteNode(node.path);
                  }
                }}
                className="p-1 hover:text-red-400 rounded transition"
                title="Delete"
                aria-label="Delete"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Children if expanded folder */}
        {isFolder && !isCollapsed && node.children && (
          <div>{node.children.map((child) => renderNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#090D17] border-r border-white/5 select-none w-56 shrink-0">
      {/* File Tree Header */}
      <div className="flex items-center justify-between px-3 h-9 border-b border-white/5 bg-[#0C101D] shrink-0">
        <span className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase">
          Explorer
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onCreateFile()}
            className="p-1 text-slate-400 hover:text-cyan-300 rounded hover:bg-white/5 transition"
            title="New File"
            aria-label="New File"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onCreateFolder && onCreateFolder()}
            className="p-1 text-slate-400 hover:text-amber-300 rounded hover:bg-white/5 transition"
            title="New Folder"
            aria-label="New Folder"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tree List */}
      <div className="flex-1 overflow-y-auto py-2 px-1">
        {tree.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-500">
            No files yet.
            <button
              onClick={() => onCreateFile()}
              className="mt-2 block mx-auto text-cyan-400 hover:underline"
            >
              + Create index.html
            </button>
          </div>
        ) : (
          tree.map((node) => renderNode(node, 0))
        )}
      </div>
    </div>
  );
}

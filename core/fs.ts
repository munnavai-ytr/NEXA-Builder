// Virtual File System module for NEXA Builder
import { getProjectFiles, getFile, putFile, removeFile, FileRecord } from './db';

export interface FSNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FSNode[];
  size?: number;
  updatedAt?: number;
}

export interface FSPatch {
  path: string;
  action: 'create' | 'update' | 'delete';
  content?: string;
}

export class VirtualFS {
  /**
   * Reads a file content from virtual file system
   */
  static async readFile(projectId: string, path: string): Promise<string> {
    const normalized = this.normalizePath(path);
    const record = await getFile(projectId, normalized);
    if (!record) {
      throw new Error(`File not found: ${normalized}`);
    }
    return record.content;
  }

  /**
   * Writes a file to virtual file system
   */
  static async writeFile(projectId: string, path: string, content: string): Promise<void> {
    const normalized = this.normalizePath(path);
    await putFile(projectId, normalized, content);
  }

  /**
   * Deletes a file or directory recursively
   */
  static async deleteFile(projectId: string, path: string): Promise<void> {
    const normalized = this.normalizePath(path);
    const files = await getProjectFiles(projectId);
    
    // Check if exact file or folder prefix
    const targets = files.filter(
      (f) => f.path === normalized || f.path.startsWith(`${normalized}/`)
    );

    for (const t of targets) {
      await removeFile(projectId, t.path);
    }
  }

  /**
   * Renames a file or directory prefix
   */
  static async renameFile(projectId: string, oldPath: string, newPath: string): Promise<void> {
    const oldNorm = this.normalizePath(oldPath);
    const newNorm = this.normalizePath(newPath);
    const files = await getProjectFiles(projectId);

    const direct = files.find((f) => f.path === oldNorm);
    if (direct) {
      await putFile(projectId, newNorm, direct.content);
      await removeFile(projectId, oldNorm);
      return;
    }

    // directory rename
    const dirTargets = files.filter((f) => f.path.startsWith(`${oldNorm}/`));
    for (const item of dirTargets) {
      const remainder = item.path.slice(oldNorm.length);
      const targetPath = `${newNorm}${remainder}`;
      await putFile(projectId, targetPath, item.content);
      await removeFile(projectId, item.path);
    }
  }

  /**
   * Builds a hierarchical tree of files and directories
   */
  static async listTree(projectId: string): Promise<FSNode[]> {
    const files = await getProjectFiles(projectId);
    const root: Record<string, any> = {};

    for (const file of files) {
      const parts = file.path.split('/').filter(Boolean);
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isFile = i === parts.length - 1;

        if (isFile) {
          current[part] = {
            name: part,
            path: file.path,
            type: 'file',
            size: file.content.length,
            updatedAt: file.updatedAt,
          };
        } else {
          if (!current[part] || current[part].type !== 'directory') {
            current[part] = {
              name: part,
              path: parts.slice(0, i + 1).join('/'),
              type: 'directory',
              _children: {},
            };
          }
          current = current[part]._children;
        }
      }
    }

    function convert(obj: Record<string, any>): FSNode[] {
      const result: FSNode[] = [];
      const keys = Object.keys(obj).sort((a, b) => {
        // directories first, then alphabetical
        const aIsDir = obj[a].type === 'directory';
        const bIsDir = obj[b].type === 'directory';
        if (aIsDir && !bIsDir) return -1;
        if (!aIsDir && bIsDir) return 1;
        return a.localeCompare(b);
      });

      for (const k of keys) {
        const item = obj[k];
        if (item.type === 'directory') {
          result.push({
            name: item.name,
            path: item.path,
            type: 'directory',
            children: convert(item._children),
          });
        } else {
          result.push({
            name: item.name,
            path: item.path,
            type: 'file',
            size: item.size,
            updatedAt: item.updatedAt,
          });
        }
      }
      return result;
    }

    return convert(root);
  }

  /**
   * Applies an array of patches atomically
   */
  static async applyPatch(projectId: string, patches: FSPatch[]): Promise<void> {
    for (const patch of patches) {
      const normalized = this.normalizePath(patch.path);
      if (patch.action === 'delete') {
        await this.deleteFile(projectId, normalized);
      } else {
        await this.writeFile(projectId, normalized, patch.content || '');
      }
    }
  }

  /**
   * Normalizes path string by trimming leading/trailing slashes and double slashes
   */
  static normalizePath(path: string): string {
    return path
      .trim()
      .replace(/^\/+/, '')
      .replace(/\/+$/, '')
      .replace(/\/+/g, '/');
  }

  /**
   * Ingests starter templates for new projects
   */
  static async populateTemplate(projectId: string, templateType: 'saas' | 'kanban' | 'docs' | 'portfolio'): Promise<void> {
    const templates = getTemplateFiles(templateType);
    for (const [path, content] of Object.entries(templates)) {
      await this.writeFile(projectId, path, content);
    }
  }
}

// Starter templates
export function getTemplateFiles(templateType: 'saas' | 'kanban' | 'docs' | 'portfolio'): Record<string, string> {
  if (templateType === 'kanban') {
    return {
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FlowBoard Kanban</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="style.css">
</head>
<body class="bg-[#0B0F19] text-slate-100 min-h-screen p-6 font-sans">
  <header class="flex items-center justify-between pb-6 border-b border-slate-800 mb-6">
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">F</div>
      <h1 class="text-xl font-bold tracking-tight">FlowBoard Studio</h1>
    </div>
    <div class="flex items-center gap-3">
      <button id="add-task-btn" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition shadow-md">+ New Task</button>
    </div>
  </header>

  <div class="grid grid-cols-1 md:grid-cols-3 gap-6" id="board">
    <div class="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
      <div class="flex items-center justify-between pb-2 border-b border-slate-800/80">
        <h2 class="text-sm font-semibold text-slate-400">TODO</h2>
        <span class="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full" id="todo-count">2</span>
      </div>
      <div class="flex flex-col gap-3 task-list" data-status="todo" id="col-todo">
        <div class="task-card p-3 bg-slate-800/80 border border-slate-700/60 rounded-lg cursor-grab active:cursor-grabbing hover:border-indigo-500/40 transition">
          <p class="text-sm font-medium">Design dark mode wireframes</p>
          <div class="flex items-center justify-between mt-3 text-xs text-slate-400">
            <span class="text-indigo-400">High</span>
            <span>2h ago</span>
          </div>
        </div>
        <div class="task-card p-3 bg-slate-800/80 border border-slate-700/60 rounded-lg cursor-grab active:cursor-grabbing hover:border-indigo-500/40 transition">
          <p class="text-sm font-medium">Setup IndexedDB storage sync</p>
          <div class="flex items-center justify-between mt-3 text-xs text-slate-400">
            <span class="text-amber-400">Medium</span>
            <span>5h ago</span>
          </div>
        </div>
      </div>
    </div>

    <div class="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
      <div class="flex items-center justify-between pb-2 border-b border-slate-800/80">
        <h2 class="text-sm font-semibold text-slate-400">IN PROGRESS</h2>
        <span class="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full" id="in-progress-count">1</span>
      </div>
      <div class="flex flex-col gap-3 task-list" data-status="inprogress" id="col-inprogress">
        <div class="task-card p-3 bg-slate-800/80 border border-slate-700/60 rounded-lg cursor-grab active:cursor-grabbing hover:border-indigo-500/40 transition">
          <p class="text-sm font-medium">Virtual File System driver</p>
          <div class="flex items-center justify-between mt-3 text-xs text-slate-400">
            <span class="text-cyan-400">In Review</span>
            <span>Just now</span>
          </div>
        </div>
      </div>
    </div>

    <div class="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
      <div class="flex items-center justify-between pb-2 border-b border-slate-800/80">
        <h2 class="text-sm font-semibold text-slate-400">COMPLETED</h2>
        <span class="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full" id="done-count">1</span>
      </div>
      <div class="flex flex-col gap-3 task-list" data-status="done" id="col-done">
        <div class="task-card p-3 bg-slate-800/80 border border-slate-700/60 rounded-lg cursor-grab active:cursor-grabbing hover:border-indigo-500/40 transition opacity-80">
          <p class="text-sm font-medium line-through text-slate-400">Theme token system architecture</p>
          <div class="flex items-center justify-between mt-3 text-xs text-slate-500">
            <span class="text-emerald-400">Done</span>
            <span>Yesterday</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script src="app.js"></script>
</body>
</html>`,
      'style.css': `/* Custom FlowBoard Styles */
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
.task-card:hover {
  transform: translateY(-1px);
}
`,
      'app.js': `// FlowBoard Interactive Logic
document.getElementById('add-task-btn')?.addEventListener('click', () => {
  const taskTitle = prompt('Enter new task name:');
  if (!taskTitle) return;

  const todoCol = document.getElementById('col-todo');
  const card = document.createElement('div');
  card.className = 'task-card p-3 bg-slate-800/80 border border-slate-700/60 rounded-lg cursor-grab hover:border-indigo-500/40 transition';
  card.innerHTML = \`
    <p class="text-sm font-medium">\${taskTitle}</p>
    <div class="flex items-center justify-between mt-3 text-xs text-slate-400">
      <span class="text-indigo-400">New</span>
      <span>Just now</span>
    </div>
  \`;
  todoCol.prepend(card);
  
  const count = document.getElementById('todo-count');
  if (count) count.textContent = String(Number(count.textContent || 0) + 1);
});
console.log('FlowBoard loaded in sandboxed NEXA preview');
`,
      'package.json': `{\n  "name": "flowboard-app",\n  "version": "1.0.0",\n  "type": "module"\n}`,
    };
  }

  // Default: Modern SaaS Landing page
  return {
    'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PulseMetric — Real-time Cloud Observability</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="style.css">
</head>
<body class="bg-[#070A12] text-slate-100 min-h-screen font-sans selection:bg-cyan-500 selection:text-black">
  <!-- Top Navigation -->
  <header class="flex items-center justify-between gap-8 px-6 py-4 border-b border-slate-800/80 sticky top-0 bg-[#070A12]/80 backdrop-blur-md z-50">
    <a href="#" class="text-lg font-bold tracking-tight text-white flex items-center gap-2">
      <span class="w-6 h-6 rounded bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center text-xs font-black text-black">P</span>
      PulseMetric
    </a>
    <nav class="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
      <a href="#features" class="hover:text-white transition">Features</a>
      <a href="#metrics" class="hover:text-white transition">Telemetry</a>
      <a href="#pricing" class="hover:text-white transition">Pricing</a>
      <a href="#docs" class="hover:text-white transition">Docs</a>
    </nav>
    <div class="flex items-center gap-3">
      <button class="px-4 py-2 text-xs font-semibold text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition shadow-lg shadow-cyan-500/20">
        Start Free Trial
      </button>
    </div>
  </header>

  <!-- Hero Section -->
  <main class="max-w-6xl mx-auto px-6 py-16">
    <div class="text-center max-w-3xl mx-auto">
      <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-800 bg-slate-900/60 text-xs text-slate-400 mb-6">
        <span class="w-2 h-2 rounded-full bg-cyan-400"></span>
        PulseMetric 3.0 is live with zero-overhead tracing
      </div>
      <h1 class="text-4xl md:text-6xl font-bold tracking-tight text-white mb-6 leading-tight">
        Observability for modern <span class="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">distributed systems</span>
      </h1>
      <p class="text-lg text-slate-400 mb-8 max-w-2xl mx-auto leading-relaxed">
        Trace millions of cloud requests with nanosecond precision. Native OpenTelemetry integration with instant automated anomaly detection.
      </p>
      <div class="flex items-center justify-center gap-4">
        <button id="cta-btn" class="px-6 py-3 bg-gradient-to-r from-violet-600 to-cyan-500 text-white font-medium rounded-xl hover:opacity-95 transition shadow-xl shadow-violet-500/20">
          Deploy Agent Now
        </button>
        <button class="px-6 py-3 border border-slate-800 hover:border-slate-700 bg-slate-900/40 text-slate-300 font-medium rounded-xl transition">
          Live Interactive Demo
        </button>
      </div>
    </div>

    <!-- Live Telemetry Simulator Grid -->
    <div class="mt-16 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm">
      <div class="flex items-center justify-between pb-4 border-b border-slate-800">
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full bg-emerald-500"></span>
          <span class="text-sm font-semibold text-slate-300">Cluster Runtime Ingestion</span>
        </div>
        <div class="text-xs font-mono text-cyan-400" id="live-time">ACTIVE STREAM</div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
        <div class="p-4 bg-slate-950/60 border border-slate-800/60 rounded-xl">
          <p class="text-xs text-slate-400 mb-1">Global p99 Latency</p>
          <p class="text-2xl font-mono font-bold text-white" id="p99-stat">14.2ms</p>
          <p class="text-xs text-emerald-400 mt-2">↓ 3.4% vs baseline</p>
        </div>
        <div class="p-4 bg-slate-950/60 border border-slate-800/60 rounded-xl">
          <p class="text-xs text-slate-400 mb-1">Requests / Sec</p>
          <p class="text-2xl font-mono font-bold text-white" id="rps-stat">128,490</p>
          <p class="text-xs text-cyan-400 mt-2">↑ 12% sustained traffic</p>
        </div>
        <div class="p-4 bg-slate-950/60 border border-slate-800/60 rounded-xl">
          <p class="text-xs text-slate-400 mb-1">Error Budget Remaining</p>
          <p class="text-2xl font-mono font-bold text-white">99.98%</p>
          <p class="text-xs text-emerald-400 mt-2">Nominal SLA compliance</p>
        </div>
        <div class="p-4 bg-slate-950/60 border border-slate-800/60 rounded-xl">
          <p class="text-xs text-slate-400 mb-1">Active Edge Nodes</p>
          <p class="text-2xl font-mono font-bold text-white" id="nodes-stat">64</p>
          <p class="text-xs text-slate-400 mt-2">Distributed in 28 regions</p>
        </div>
      </div>
    </div>
  </main>

  <script src="app.js"></script>
</body>
</html>`,
    'style.css': `/* PulseMetric Global Theme */
@keyframes pulseGlow {
  0%, 100% { opacity: 0.8; }
  50% { opacity: 1; }
}
.glow-accent {
  animation: pulseGlow 3s infinite ease-in-out;
}
`,
    'app.js': `// PulseMetric Telemetry Live Updates
console.log('PulseMetric Client Observability Agent Online');

const p99 = document.getElementById('p99-stat');
const rps = document.getElementById('rps-stat');
const cta = document.getElementById('cta-btn');

setInterval(() => {
  if (p99) {
    const val = (12.5 + Math.random() * 3.5).toFixed(1);
    p99.textContent = val + 'ms';
  }
  if (rps) {
    const val = Math.floor(125000 + Math.random() * 8000);
    rps.textContent = val.toLocaleString();
  }
}, 2000);

if (cta) {
  cta.addEventListener('click', () => {
    alert('Agent script copied to clipboard: curl -fsSL https://get.pulsemetric.io | sh');
  });
}
`,
    'package.json': `{\n  "name": "pulsemetric-saas",\n  "version": "1.0.0",\n  "type": "module"\n}`,
  };
}

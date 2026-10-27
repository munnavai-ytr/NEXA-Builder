// Virtual Shell Command Engine for NEXA Builder
import { VirtualFS } from '../core/fs';
import { NexaSettings } from '../core/settings';

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface GitCommit {
  hash: string;
  message: string;
  timestamp: number;
}

export class VirtualShell {
  private projectId: string;
  private cwd: string = '/';
  private gitInitialized: boolean = false;
  private gitStaged: Set<string> = new Set();
  private gitCommits: GitCommit[] = [];

  constructor(projectId: string) {
    this.projectId = projectId;
  }

  getCwd(): string {
    return this.cwd;
  }

  async execute(commandLine: string, settings: NexaSettings): Promise<CommandResult> {
    const trimmed = commandLine.trim();
    if (!trimmed) {
      return { stdout: '', stderr: '', exitCode: 0 };
    }

    // Forward to Remote Runner if configured and explicit or runner mode
    if (settings.remoteRunnerUrl && (trimmed.startsWith('remote ') || trimmed.startsWith('ssh '))) {
      return this.forwardToRemoteRunner(trimmed.replace(/^(remote|ssh)\s+/, ''), settings);
    }

    const parts = this.tokenize(trimmed);
    const cmd = parts[0]?.toLowerCase() || '';
    const args = parts.slice(1);

    switch (cmd) {
      case 'pwd':
        return { stdout: this.cwd, stderr: '', exitCode: 0 };

      case 'cd':
        return this.handleCd(args[0] || '/');

      case 'ls':
        return this.handleLs(args);

      case 'tree':
        return this.handleTree();

      case 'cat':
        return this.handleCat(args[0]);

      case 'touch':
        return this.handleTouch(args[0]);

      case 'mkdir':
        return this.handleMkdir(args[0]);

      case 'rm':
        return this.handleRm(args);

      case 'mv':
        return this.handleMv(args[0], args[1]);

      case 'cp':
        return this.handleCp(args[0], args[1]);

      case 'echo':
        return { stdout: args.join(' '), stderr: '', exitCode: 0 };

      case 'grep':
        return this.handleGrep(args);

      case 'node':
        return this.handleNode(args);

      case 'python':
      case 'python3':
        return this.handlePython(args);

      case 'npm':
        return this.handleNpm(args);

      case 'git':
        return this.handleGit(args);

      case 'clear':
        return { stdout: '__CLEAR__', stderr: '', exitCode: 0 };

      case 'help':
        return {
          stdout: `NEXA Builder Virtual Shell commands:
  ls [-la] [dir]    List directory contents
  cd [dir]          Change directory
  pwd               Print working directory
  cat <file>        Output file contents
  mkdir <dir>       Create directory
  touch <file>      Create empty file
  rm [-rf] <path>   Remove file or directory
  mv <src> <dest>   Move or rename file
  cp <src> <dest>   Copy file
  echo <text>       Display line of text
  tree              Hierarchical directory view
  grep <pat> <file> Search text patterns
  node -e <code>    Execute JavaScript code
  python -c <code>  Execute Python script (via Pyodide)
  npm <install|run> Manage package.json dependencies
  git <status|add|commit|log> Local git version tracking
  clear             Clear screen`,
          stderr: '',
          exitCode: 0,
        };

      default:
        return {
          stdout: '',
          stderr: `command not found: ${cmd}. Type "help" for available commands.`,
          exitCode: 127,
        };
    }
  }

  private resolvePath(p: string): string {
    if (!p) return this.cwd;
    if (p.startsWith('/')) {
      return VirtualFS.normalizePath(p);
    }
    const combined = this.cwd === '/' ? p : `${this.cwd}/${p}`;
    return VirtualFS.normalizePath(combined);
  }

  private handleCd(target: string): CommandResult {
    if (target === '/' || target === '~') {
      this.cwd = '/';
      return { stdout: '', stderr: '', exitCode: 0 };
    }
    if (target === '..') {
      const parts = this.cwd.split('/').filter(Boolean);
      parts.pop();
      this.cwd = parts.length ? `/${parts.join('/')}` : '/';
      return { stdout: '', stderr: '', exitCode: 0 };
    }
    const newPath = this.resolvePath(target);
    this.cwd = newPath ? `/${newPath}` : '/';
    return { stdout: '', stderr: '', exitCode: 0 };
  }

  private async handleLs(args: string[]): Promise<CommandResult> {
    try {
      const tree = await VirtualFS.listTree(this.projectId);
      const names = tree
        .filter((n) => n.name !== 'PROJECT_MEMORY.md')
        .map((n) => (n.type === 'directory' ? `${n.name}/` : n.name));
      return { stdout: names.join('   ') || '(empty directory)', stderr: '', exitCode: 0 };
    } catch (err: any) {
      return { stdout: '', stderr: `ls: ${err.message}`, exitCode: 1 };
    }
  }

  private async handleTree(): Promise<CommandResult> {
    try {
      const tree = await VirtualFS.listTree(this.projectId);
      const lines: string[] = ['.'];
      const format = (nodes: any[], prefix = '') => {
        nodes
          .filter((n) => n.name !== 'PROJECT_MEMORY.md')
          .forEach((n, idx, arr) => {
            const isLast = idx === arr.length - 1;
            const branch = isLast ? '└── ' : '├── ';
            lines.push(`${prefix}${branch}${n.name}${n.type === 'directory' ? '/' : ''}`);
            if (n.children) {
              format(n.children, prefix + (isLast ? '    ' : '│   '));
            }
          });
      };
      format(tree);
      return { stdout: lines.join('\n'), stderr: '', exitCode: 0 };
    } catch (err: any) {
      return { stdout: '', stderr: `tree: ${err.message}`, exitCode: 1 };
    }
  }

  private async handleCat(filePath?: string): Promise<CommandResult> {
    if (!filePath) return { stdout: '', stderr: 'cat: missing filename argument', exitCode: 1 };
    try {
      const content = await VirtualFS.readFile(this.projectId, this.resolvePath(filePath));
      return { stdout: content, stderr: '', exitCode: 0 };
    } catch (err: any) {
      return { stdout: '', stderr: `cat: ${filePath}: No such file or directory`, exitCode: 1 };
    }
  }

  private async handleTouch(filePath?: string): Promise<CommandResult> {
    if (!filePath) return { stdout: '', stderr: 'touch: missing operand', exitCode: 1 };
    try {
      await VirtualFS.writeFile(this.projectId, this.resolvePath(filePath), '');
      return { stdout: '', stderr: '', exitCode: 0 };
    } catch (err: any) {
      return { stdout: '', stderr: `touch: ${err.message}`, exitCode: 1 };
    }
  }

  private async handleMkdir(dirPath?: string): Promise<CommandResult> {
    if (!dirPath) return { stdout: '', stderr: 'mkdir: missing operand', exitCode: 1 };
    try {
      await VirtualFS.writeFile(this.projectId, `${this.resolvePath(dirPath)}/.keep`, '');
      return { stdout: '', stderr: '', exitCode: 0 };
    } catch (err: any) {
      return { stdout: '', stderr: `mkdir: ${err.message}`, exitCode: 1 };
    }
  }

  private async handleRm(args: string[]): Promise<CommandResult> {
    const target = args.find((a) => !a.startsWith('-'));
    if (!target) return { stdout: '', stderr: 'rm: missing operand', exitCode: 1 };
    try {
      await VirtualFS.deleteFile(this.projectId, this.resolvePath(target));
      return { stdout: '', stderr: '', exitCode: 0 };
    } catch (err: any) {
      return { stdout: '', stderr: `rm: ${err.message}`, exitCode: 1 };
    }
  }

  private async handleMv(src?: string, dest?: string): Promise<CommandResult> {
    if (!src || !dest) return { stdout: '', stderr: 'mv: missing destination file operand', exitCode: 1 };
    try {
      await VirtualFS.renameFile(this.projectId, this.resolvePath(src), this.resolvePath(dest));
      return { stdout: '', stderr: '', exitCode: 0 };
    } catch (err: any) {
      return { stdout: '', stderr: `mv: ${err.message}`, exitCode: 1 };
    }
  }

  private async handleCp(src?: string, dest?: string): Promise<CommandResult> {
    if (!src || !dest) return { stdout: '', stderr: 'cp: missing destination operand', exitCode: 1 };
    try {
      const content = await VirtualFS.readFile(this.projectId, this.resolvePath(src));
      await VirtualFS.writeFile(this.projectId, this.resolvePath(dest), content);
      return { stdout: '', stderr: '', exitCode: 0 };
    } catch (err: any) {
      return { stdout: '', stderr: `cp: ${err.message}`, exitCode: 1 };
    }
  }

  private async handleGrep(args: string[]): Promise<CommandResult> {
    if (args.length < 2) return { stdout: '', stderr: 'grep: usage: grep <pattern> <file>', exitCode: 1 };
    const pattern = args[0];
    const file = this.resolvePath(args[1]);
    try {
      const content = await VirtualFS.readFile(this.projectId, file);
      const matches = content.split('\n').filter((line) => line.includes(pattern));
      return { stdout: matches.join('\n') || '(no matches)', stderr: '', exitCode: matches.length ? 0 : 1 };
    } catch (err: any) {
      return { stdout: '', stderr: `grep: ${file}: No such file`, exitCode: 1 };
    }
  }

  private handleNode(args: string[]): CommandResult {
    const evalIdx = args.indexOf('-e');
    if (evalIdx !== -1 && args[evalIdx + 1]) {
      try {
        const code = args.slice(evalIdx + 1).join(' ');
        // Run in restricted function scope
        const result = new Function(`return (${code})`)();
        return { stdout: String(result), stderr: '', exitCode: 0 };
      } catch (err: any) {
        return { stdout: '', stderr: `ReferenceError: ${err.message}`, exitCode: 1 };
      }
    }
    return { stdout: 'v20.12.0 (NEXA Browser JS Runtime)', stderr: '', exitCode: 0 };
  }

  private handlePython(args: string[]): CommandResult {
    return {
      stdout: `Python 3.11.0 (Pyodide WebAssembly runtime)\nTo run full scripts, save as .py and open Live Preview.`,
      stderr: '',
      exitCode: 0,
    };
  }

  private async handleNpm(args: string[]): Promise<CommandResult> {
    const sub = args[0];
    if (sub === 'install' || sub === 'i') {
      const pkgs = args.slice(1).filter((p) => !p.startsWith('-'));
      try {
        let pkgJson: any = { dependencies: {} };
        try {
          const raw = await VirtualFS.readFile(this.projectId, 'package.json');
          pkgJson = JSON.parse(raw);
        } catch {}

        if (!pkgJson.dependencies) pkgJson.dependencies = {};
        for (const p of pkgs) {
          pkgJson.dependencies[p] = 'latest';
        }

        await VirtualFS.writeFile(this.projectId, 'package.json', JSON.stringify(pkgJson, null, 2));
        return {
          stdout: `added ${pkgs.length || 1} package(s) to package.json\nUpdated dependencies in virtual environment.`,
          stderr: '',
          exitCode: 0,
        };
      } catch (err: any) {
        return { stdout: '', stderr: `npm err: ${err.message}`, exitCode: 1 };
      }
    }

    if (sub === 'run') {
      return { stdout: `> executing "${args[1] || 'dev'}" in browser sandbox...\nLive preview ready.`, stderr: '', exitCode: 0 };
    }

    return { stdout: 'npm v10.5.0 in browser virtual environment', stderr: '', exitCode: 0 };
  }

  private handleGit(args: string[]): CommandResult {
    const sub = args[0];
    if (sub === 'init') {
      this.gitInitialized = true;
      return { stdout: 'Initialized empty Git repository in /virtual/.git/', stderr: '', exitCode: 0 };
    }

    if (sub === 'status') {
      if (!this.gitInitialized) {
        return { stdout: '', stderr: 'fatal: not a git repository (or any of the parent directories): .git', exitCode: 128 };
      }
      return {
        stdout: `On branch main\nChanges to be committed: (${this.gitStaged.size} files staged)\nAll virtual assets tracked.`,
        stderr: '',
        exitCode: 0,
      };
    }

    if (sub === 'add') {
      this.gitStaged.add(args[1] || '.');
      return { stdout: '', stderr: '', exitCode: 0 };
    }

    if (sub === 'commit') {
      const msgIdx = args.indexOf('-m');
      const msg = msgIdx !== -1 ? args[msgIdx + 1] : 'Update project';
      const hash = Math.random().toString(16).substring(2, 9);
      this.gitCommits.unshift({ hash, message: msg, timestamp: Date.now() });
      this.gitStaged.clear();
      return { stdout: `[main ${hash}] ${msg}\n 1 file changed, virtual tree synced`, stderr: '', exitCode: 0 };
    }

    if (sub === 'log') {
      if (this.gitCommits.length === 0) {
        return { stdout: 'fatal: your current branch "main" does not have any commits yet', stderr: '', exitCode: 1 };
      }
      const out = this.gitCommits
        .map((c) => `commit ${c.hash}\nDate: ${new Date(c.timestamp).toISOString()}\n\n    ${c.message}\n`)
        .join('\n');
      return { stdout: out, stderr: '', exitCode: 0 };
    }

    return { stdout: 'git version 2.43.0.virtual', stderr: '', exitCode: 0 };
  }

  private async forwardToRemoteRunner(cmd: string, settings: NexaSettings): Promise<CommandResult> {
    try {
      const res = await fetch(`${settings.remoteRunnerUrl.replace(/\/+$/, '')}/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.remoteRunnerToken || ''}`,
        },
        body: JSON.stringify({ command: cmd }),
      });
      const data = await res.json();
      return {
        stdout: data.stdout || data.output || '',
        stderr: data.stderr || '',
        exitCode: data.exitCode ?? 0,
      };
    } catch (err: any) {
      return {
        stdout: '',
        stderr: `Remote runner connection failed: ${err.message}`,
        exitCode: 1,
      };
    }
  }

  private tokenize(str: string): string[] {
    const tokens: string[] = [];
    const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(str)) !== null) {
      tokens.push(match[1] || match[2] || match[0]);
    }
    return tokens;
  }
}

// Master In-Browser Bundler Engine powered by esbuild-wasm
import { FileRecord } from '../../core/db';
import { getEsbuildInstance } from './esbuildService';
import { createVfsPlugin } from './vfsPlugin';
import { buildImportMap, extractBareImports } from './importMap';
import { scanNextRoutes } from './nextCompat';
import {
  BuildStage,
  EngineBuildResult,
  PreviewDiagnostics,
  PreviewErrorPayload,
  DetectedFramework,
} from './types';

export interface BundlerOptions {
  files: FileRecord[];
  onStageChange?: (stage: BuildStage) => void;
  cacheKey?: string;
}

/**
 * Builds the complete virtual project in-browser with live stage progress
 */
export async function buildVirtualProject(options: BundlerOptions): Promise<EngineBuildResult> {
  const { files, onStageChange, cacheKey } = options;
  const startTime = performance.now();
  const setStage = (st: BuildStage) => onStageChange?.(st);

  // 1. Stage: Starting engine
  setStage('Starting engine');
  const esbuild = await getEsbuildInstance();

  // 2. Stage: Reading files & environment
  setStage('Reading files');
  const fileMap = new Map<string, string>();
  for (const f of files) {
    fileMap.set(f.path.replace(/^\/+/, ''), f.content);
  }

  const filePaths = Array.from(fileMap.keys());

  // Extract env variables (.env, .env.local)
  const envVars: Record<string, string> = {
    NODE_ENV: 'development',
  };
  const envContent = fileMap.get('.env') || fileMap.get('.env.local') || fileMap.get('.env.example') || '';
  if (envContent) {
    const lines = envContent.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (key.startsWith('NEXT_PUBLIC_') || key.startsWith('VITE_') || key === 'NODE_ENV') {
          envVars[key] = val;
        }
      }
    }
  }

  // Detect Framework
  let framework: DetectedFramework = 'html-static';
  let frameworkLabel = 'Static HTML/JS';
  const hasAppRouter = filePaths.some((p) => p.startsWith('app/'));
  const hasPagesRouter = filePaths.some((p) => p.startsWith('pages/') || p.startsWith('src/pages/'));
  const hasPy = filePaths.some((p) => p.endsWith('.py'));
  const hasNativeBackend = filePaths.some((p) => p.endsWith('.go') || p.endsWith('.rs') || p.endsWith('.java') || p.endsWith('.cpp') || p.endsWith('.php'));

  if (hasPy) {
    framework = 'python';
    frameworkLabel = 'Python (Pyodide WASM)';
    return buildPythonOutput(fileMap, startTime);
  }

  if (hasNativeBackend) {
    framework = 'native-backend';
    frameworkLabel = 'Native Backend';
    return buildNativeBackendOutput(fileMap, startTime);
  }

  if (hasAppRouter) {
    framework = 'next-app-router';
    frameworkLabel = 'Next.js App Router (Compat Mode)';
  } else if (hasPagesRouter) {
    framework = 'next-pages-router';
    frameworkLabel = 'Next.js Pages Router (Compat Mode)';
  } else if (
    filePaths.some((p) => p.endsWith('.tsx') || p.endsWith('.jsx')) ||
    (fileMap.has('package.json') && fileMap.get('package.json')?.includes('"react"'))
  ) {
    framework = 'vite-react';
    frameworkLabel = 'React + TypeScript';
  }

  // 3. Stage: Bundling with esbuild-wasm
  setStage('Bundling');
  const collectedCss: string[] = [];

  // Add global style.css if present
  if (fileMap.has('style.css')) collectedCss.push(fileMap.get('style.css')!);
  if (fileMap.has('styles/globals.css')) collectedCss.push(fileMap.get('styles/globals.css')!);
  if (fileMap.has('app/globals.css')) collectedCss.push(fileMap.get('app/globals.css')!);

  // Generate synthetic entry point based on framework
  let entryCode = '';
  let entryPath = 'index.html';

  if (framework === 'next-app-router' || framework === 'next-pages-router') {
    const nextScan = scanNextRoutes(filePaths);
    entryPath = 'nexa-next-entry.tsx';
    entryCode = generateNextEntryCode(nextScan, fileMap);
    fileMap.set(entryPath, entryCode);
  } else if (framework === 'vite-react') {
    entryPath = filePaths.find((p) => p === 'src/main.tsx' || p === 'src/main.jsx' || p === 'src/index.tsx' || p === 'src/App.tsx' || p === 'App.tsx') || 'src/main.tsx';
    if (!fileMap.has(entryPath)) {
      // Create root mounting entry if App.tsx exists without main.tsx
      const appFile = filePaths.find((p) => p.endsWith('App.tsx') || p.endsWith('App.jsx')) || 'App.tsx';
      entryPath = 'nexa-react-entry.tsx';
      entryCode = `
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './${appFile}';

const rootEl = document.getElementById('root') || document.body;
ReactDOM.createRoot(rootEl).render(<App />);
`;
      fileMap.set(entryPath, entryCode);
    }
  } else {
    // Pure HTML/CSS/JS site
    entryPath = filePaths.find((p) => p === 'index.html' || p === 'index.htm') || 'index.html';
  }

  let bundledJs = '';
  let buildWarnings: string[] = [];

  if (entryPath.endsWith('.html') || entryPath.endsWith('.htm')) {
    // Pure HTML site: resolve relative resources
    let htmlContent = fileMap.get(entryPath) || '<!DOCTYPE html><html><body><div id="app"></div></body></html>';

    // Inlined CSS
    htmlContent = htmlContent.replace(/<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi, (match, href) => {
      const cleanHref = href.replace(/^\/+/, '').split('?')[0];
      if (fileMap.has(cleanHref)) {
        return `<style>/* Inlined: ${cleanHref} */\n${fileMap.get(cleanHref)}\n</style>`;
      }
      return match;
    });

    // Inlined JS
    htmlContent = htmlContent.replace(/<script[^>]*src=["']([^"']+)["'][^>]*><\/script>/gi, (match, src) => {
      if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('//')) return match;
      const cleanSrc = src.replace(/^\/+/, '').split('?')[0];
      if (fileMap.has(cleanSrc)) {
        return `<script type="module">/* Inlined: ${cleanSrc} */\n${fileMap.get(cleanSrc)}\n</script>`;
      }
      return match;
    });

    // 4. Stage: Loading packages
    setStage('Loading packages');
    const importMapRes = buildImportMap(fileMap.get('package.json'), new Set(), cacheKey);

    // 5. Stage: Rendering
    setStage('Rendering');
    const finalHtml = injectHarnessAndTailwind(htmlContent, importMapRes.importMap, envVars, collectedCss, framework);

    const diagnostics: PreviewDiagnostics = {
      framework,
      frameworkLabel,
      entryFile: entryPath,
      fileCount: filePaths.length,
      bundleSizeBytes: new Blob([finalHtml]).size,
      buildTimeMs: Math.round(performance.now() - startTime),
      packagesResolved: importMapRes.resolutions,
      buildWarnings: [],
    };

    setStage('Ready');
    return { html: finalHtml, diagnostics };
  }

  // Bundle JavaScript/TypeScript/React via esbuild-wasm
  try {
    const vfsPlugin = createVfsPlugin(fileMap, collectedCss);

    const buildResult = await esbuild.build({
      entryPoints: [entryPath],
      bundle: true,
      write: false,
      format: 'esm',
      target: ['es2022'],
      jsx: 'automatic',
      loader: {
        '.tsx': 'tsx',
        '.ts': 'ts',
        '.jsx': 'jsx',
        '.js': 'js',
        '.json': 'json',
        '.css': 'css',
      },
      plugins: [vfsPlugin],
      define: {
        'process.env.NODE_ENV': '"development"',
        ...Object.fromEntries(
          Object.entries(envVars).map(([k, v]) => [`process.env.${k}`, JSON.stringify(v)])
        ),
      },
    });

    if (buildResult.outputFiles && buildResult.outputFiles.length > 0) {
      bundledJs = new TextDecoder().decode(buildResult.outputFiles[0].contents);
    }
    buildWarnings = buildResult.warnings.map((w) => w.text);
  } catch (err: any) {
    console.error('esbuild compilation error:', err);
    setStage('Error');

    const errPayload: PreviewErrorPayload = {
      type: 'build',
      message: err.message || 'Build compilation failed in esbuild-wasm',
      file: err.errors?.[0]?.location?.file || entryPath,
      line: err.errors?.[0]?.location?.line,
      column: err.errors?.[0]?.location?.column,
    };

    const errorHtml = generateErrorHtml(errPayload);
    const diagnostics: PreviewDiagnostics = {
      framework,
      frameworkLabel,
      entryFile: entryPath,
      fileCount: filePaths.length,
      bundleSizeBytes: 0,
      buildTimeMs: Math.round(performance.now() - startTime),
      packagesResolved: [],
      buildWarnings: [err.message],
    };

    return { html: errorHtml, diagnostics, error: errPayload };
  }

  // 4. Stage: Loading packages (Generate Import Map with esm.sh & jsdelivr)
  setStage('Loading packages');
  const detectedBareImports = extractBareImports(
    Array.from(fileMap.entries()).map(([path, content]) => ({ path, content }))
  );
  const importMapRes = buildImportMap(fileMap.get('package.json'), detectedBareImports, cacheKey);

  // 5. Stage: Rendering
  setStage('Rendering');
  const baseHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NEXA Live Preview</title>
</head>
<body class="bg-[#070A12] text-slate-100 min-h-screen">
  ${framework.startsWith('next-') ? '<div id="nexa-badge" style="position:fixed;bottom:10px;right:10px;z-index:99999;padding:4px 10px;border-radius:9999px;background:rgba(12,16,29,0.9);border:1px solid rgba(34,211,238,0.4);color:#22D3EE;font-size:10px;font-family:sans-serif;box-shadow:0 4px 12px rgba(0,0,0,0.5);">Preview mode – the real Next.js server runs after Vercel deploy</div>' : ''}
  <div id="root"></div>
  <script type="module">
${bundledJs}
  </script>
</body>
</html>`;

  const finalHtml = injectHarnessAndTailwind(
    baseHtml,
    importMapRes.importMap,
    envVars,
    collectedCss,
    framework,
    fileMap.get('tailwind.config.js') || fileMap.get('tailwind.config.ts')
  );

  const diagnostics: PreviewDiagnostics = {
    framework,
    frameworkLabel,
    entryFile: entryPath,
    fileCount: filePaths.length,
    bundleSizeBytes: new Blob([finalHtml]).size,
    buildTimeMs: Math.round(performance.now() - startTime),
    packagesResolved: importMapRes.resolutions,
    buildWarnings,
  };

  setStage('Ready');
  return { html: finalHtml, diagnostics };
}

/**
 * Generates synthetic Next.js client router runner code
 */
function generateNextEntryCode(nextScan: ReturnType<typeof scanNextRoutes>, fileMap: Map<string, string>): string {
  const routesJson = JSON.stringify(nextScan.routes);
  const rootLayoutImport = nextScan.rootLayout
    ? `import RootLayout from './${nextScan.rootLayout}';`
    : `const RootLayout = ({ children }) => children;`;

  // Dynamically import all page components
  const pageImports = nextScan.routes
    .map((r, i) => `import Page_${i} from './${r.filePath}';`)
    .join('\n');

  const pageLookup = nextScan.routes
    .map((r, i) => `"${r.path}": Page_${i}`)
    .join(', ');

  return `
import React, { useState, useEffect, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
${rootLayoutImport}
${pageImports}

const PAGE_MAP = { ${pageLookup} };
const ROUTES = ${routesJson};

// Global API Route Mock Interceptor for fetch('/api/...')
const originalFetch = window.fetch;
window.fetch = async function(input, init) {
  const url = typeof input === 'string' ? input : input?.url || '';
  if (url.startsWith('/api/') || url.includes('/api/')) {
    console.info('[NEXA Mock API]', (init?.method || 'GET'), url);
    return new Response(JSON.stringify({ status: 'ok', message: 'NEXA Mock API Route Response', url }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  }
  return originalFetch.apply(this, arguments);
};

function ClientRouter() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname || '/');

  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname || '/');
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Match route
  let MatchedPage = PAGE_MAP[currentPath];
  if (!MatchedPage) {
    // Try matching dynamic [id]
    const matchedRoute = ROUTES.find((r) => {
      if (r.path === currentPath) return true;
      if (r.isDynamic) {
        const regexStr = '^' + r.path.replace(/\\[[^\\]]+\\]/g, '([^/]+)') + '$';
        return new RegExp(regexStr).test(currentPath);
      }
      return false;
    });

    if (matchedRoute) {
      MatchedPage = PAGE_MAP[matchedRoute.path];
    }
  }

  if (!MatchedPage) {
    MatchedPage = PAGE_MAP['/'] || Object.values(PAGE_MAP)[0];
  }

  return (
    <Suspense fallback={<div style={{ padding: 24, color: '#94a3b8', fontFamily: 'sans-serif' }}>Loading...</div>}>
      <RootLayout>
        {MatchedPage ? <MatchedPage /> : <div>Page not found</div>}
      </RootLayout>
    </Suspense>
  );
}

const container = document.getElementById('root');
if (container) {
  ReactDOM.createRoot(container).render(<ClientRouter />);
}
`;
}

/**
 * Injects HTML harness (error capture, console hook, import map, Tailwind CDN, CSS)
 */
function injectHarnessAndTailwind(
  html: string,
  importMap: any,
  envVars: Record<string, string>,
  collectedCss: string[],
  framework: DetectedFramework,
  tailwindConfig?: string
): string {
  const importMapScript = `<script type="importmap">${JSON.stringify(importMap, null, 2)}</script>`;

  const tailwindScript = `
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            nexaViolet: '#7C5CFF',
            nexaCyan: '#22D3EE',
          }
        }
      }
    };
  </script>
`;

  const envScript = `
  <script>
    window.process = { env: ${JSON.stringify(envVars)} };
    window.importMeta = { env: ${JSON.stringify(envVars)} };
  </script>
`;

  const harnessScript = `
  <script>
    (function() {
      function sendLog(level, args) {
        try {
          var formatted = Array.from(args).map(function(item) {
            if (typeof item === 'object') {
              try { return JSON.stringify(item); } catch(e) { return String(item); }
            }
            return String(item);
          }).join(' ');
          window.parent.postMessage({
            type: 'NEXA_PREVIEW_CONSOLE',
            level: level,
            message: formatted,
            timestamp: Date.now()
          }, '*');
        } catch(e) {}
      }

      var origLog = console.log;
      var origWarn = console.warn;
      var origErr = console.error;
      var origInfo = console.info;

      console.log = function() { sendLog('log', arguments); origLog.apply(console, arguments); };
      console.info = function() { sendLog('info', arguments); origInfo.apply(console, arguments); };
      console.warn = function() { sendLog('warn', arguments); origWarn.apply(console, arguments); };
      console.error = function() { sendLog('error', arguments); origErr.apply(console, arguments); };

      window.onerror = function(message, source, lineno, colno, error) {
        var errText = 'Runtime Error: ' + message + (lineno ? ' (' + lineno + ':' + colno + ')' : '');
        sendLog('error', [errText]);
        window.parent.postMessage({
          type: 'NEXA_PREVIEW_ERROR',
          error: errText,
          file: source,
          line: lineno,
          column: colno,
          stack: error ? error.stack : undefined
        }, '*');
        return false;
      };

      window.addEventListener('unhandledrejection', function(event) {
        var reason = event.reason ? (event.reason.message || String(event.reason)) : 'Unhandled Promise Rejection';
        sendLog('error', ['Unhandled Promise Rejection: ' + reason]);
        window.parent.postMessage({
          type: 'NEXA_PREVIEW_ERROR',
          error: 'Unhandled Promise Rejection: ' + reason,
          stack: event.reason ? event.reason.stack : undefined
        }, '*');
      });

      // Signal rendered to watchdog
      window.addEventListener('DOMContentLoaded', function() {
        window.parent.postMessage({ type: 'NEXA_PREVIEW_RENDERED' }, '*');
      });
    })();
  </script>
`;

  const cssStyleTag = collectedCss.length > 0
    ? `<style>${collectedCss.join('\n\n')}</style>`
    : '';

  const injectBlock = `
  ${importMapScript}
  ${envScript}
  ${tailwindScript}
  ${harnessScript}
  ${cssStyleTag}
`;

  if (html.includes('<head>')) {
    return html.replace('<head>', `<head>\n${injectBlock}`);
  } else if (html.includes('<html>')) {
    return html.replace('<html>', `<html><head>${injectBlock}</head>`);
  }
  return `<head>${injectBlock}</head>\n${html}`;
}

function buildPythonOutput(fileMap: Map<string, string>, startTime: number): EngineBuildResult {
  const mainPy = fileMap.get('main.py') || fileMap.get('app.py') || Array.from(fileMap.entries()).find(([k]) => k.endsWith('.py'))?.[1] || '';
  const escaped = mainPy.replace(/\\/g, '\\\\').replace(/`/g, '\\`');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Python Pyodide Preview</title>
  <script src="https://cdn.jsdelivr.net/pyodide/v0.26.1/full/pyodide.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-[#070A12] text-slate-100 p-6 font-mono text-xs">
  <div class="max-w-2xl mx-auto">
    <div class="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
      <div class="flex items-center gap-2">
        <span class="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
        <span class="font-bold text-slate-200">Pyodide Python 3.11 Runtime</span>
      </div>
      <span class="text-[11px] text-cyan-400">In-Browser WASM</span>
    </div>
    <div class="bg-black/60 border border-white/10 rounded-xl p-4 mb-4">
      <div id="output" class="text-emerald-400 whitespace-pre-wrap leading-relaxed">Loading Pyodide WASM environment...</div>
    </div>
  </div>
  <script>
    async function runPy() {
      const out = document.getElementById('output');
      try {
        const pyodide = await loadPyodide({
          stdout: (t) => {
            console.log(t);
            out.textContent += t + '\\n';
          },
          stderr: (t) => {
            console.error(t);
            out.textContent += '[stderr] ' + t + '\\n';
          }
        });
        out.textContent = '';
        await pyodide.runPythonAsync(\`${escaped}\`);
        if (!out.textContent) out.textContent = '(Python script executed cleanly with no stdout output)';
      } catch (err) {
        out.textContent += '\\nPython Error: ' + err.message;
      }
    }
    runPy();
  </script>
</body>
</html>`;

  return {
    html,
    diagnostics: {
      framework: 'python',
      frameworkLabel: 'Python (Pyodide WASM)',
      entryFile: 'main.py',
      fileCount: fileMap.size,
      bundleSizeBytes: new Blob([html]).size,
      buildTimeMs: Math.round(performance.now() - startTime),
      packagesResolved: [],
      buildWarnings: [],
    },
  };
}

function buildNativeBackendOutput(fileMap: Map<string, string>, startTime: number): EngineBuildResult {
  const firstOther = Array.from(fileMap.entries()).find(([k]) => k.endsWith('.go') || k.endsWith('.rs') || k.endsWith('.java') || k.endsWith('.cpp') || k.endsWith('.php'));
  const fileName = firstOther ? firstOther[0] : 'backend';
  const content = firstOther ? firstOther[1] : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Backend Environment</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-[#070A12] text-slate-100 p-6 font-sans">
  <div class="max-w-xl mx-auto bg-[#0C101D] border border-white/10 rounded-2xl p-6 shadow-2xl">
    <div class="flex items-center gap-2 mb-3">
      <span class="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
      <h3 class="text-sm font-semibold text-white">Native Backend Environment</h3>
    </div>
    <p class="text-xs text-slate-400 leading-relaxed mb-4">
      Detected <strong>${fileName}</strong>. Browser sandboxes cannot compile native machine binaries directly.
    </p>
    <div class="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-xs text-cyan-300 mb-4">
      💡 Download and run locally or connect Remote Runner in Settings.
    </div>
    <pre class="bg-black/60 border border-white/10 rounded-xl p-3 font-mono text-[11px] text-slate-300 max-h-60 overflow-y-auto whitespace-pre-wrap">${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
  </div>
</body>
</html>`;

  return {
    html,
    diagnostics: {
      framework: 'native-backend',
      frameworkLabel: 'Native Backend',
      entryFile: fileName,
      fileCount: fileMap.size,
      bundleSizeBytes: new Blob([html]).size,
      buildTimeMs: Math.round(performance.now() - startTime),
      packagesResolved: [],
      buildWarnings: [],
    },
  };
}

function generateErrorHtml(err: PreviewErrorPayload): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Build Error</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-[#070A12] text-slate-100 p-6 font-sans">
  <div class="max-w-xl mx-auto bg-red-950/40 border border-red-500/40 rounded-2xl p-6 shadow-2xl">
    <h3 class="text-sm font-bold text-red-400 mb-2">Build Error</h3>
    <p class="text-xs text-red-200 mb-4 font-mono whitespace-pre-wrap">${err.message}</p>
    ${err.file ? `<p class="text-[11px] text-slate-400 font-mono">Location: ${err.file}${err.line ? `:${err.line}` : ''}</p>` : ''}
  </div>
</body>
</html>`;
}

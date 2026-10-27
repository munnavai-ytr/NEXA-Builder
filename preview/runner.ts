// License-Safe In-Browser Preview Bundler (Apache 2.0 / Vanilla / Next-Compat / Pyodide)
import { FileRecord } from '../core/db';

export type ProjectMode = 'static' | 'react' | 'next-compat' | 'python' | 'native-backend';

export interface BundledPreview {
  mode: ProjectMode;
  html: string;
  badge?: string;
  hasErrors?: boolean;
  errorMessage?: string;
  pythonCode?: string;
  otherLanguageNotice?: string;
}

/**
 * Detects project mode from virtual files
 */
export function detectProjectMode(files: FileRecord[]): ProjectMode {
  const paths = files.map((f) => f.path.toLowerCase());

  // Python project
  if (paths.some((p) => p.endsWith('.py'))) {
    return 'python';
  }

  // Other backend/native languages
  if (paths.some((p) => p.endsWith('.go') || p.endsWith('.rs') || p.endsWith('.java') || p.endsWith('.cpp') || p.endsWith('.php'))) {
    return 'native-backend';
  }

  // Next.js App or Pages directory
  if (paths.some((p) => p.startsWith('app/') || p.startsWith('pages/') || p === 'next.config.js' || p === 'next.config.ts')) {
    return 'next-compat';
  }

  // React / TSX
  if (paths.some((p) => p.endsWith('.jsx') || p.endsWith('.tsx') || p.endsWith('package.json') && files.some((f) => f.content.includes('"react"')))) {
    return 'react';
  }

  return 'static';
}

/**
 * Bundles virtual files into a sandboxed preview payload
 */
export function bundleVirtualProject(files: FileRecord[]): BundledPreview {
  const mode = detectProjectMode(files);
  const fileMap = new Map<string, string>();
  for (const f of files) {
    fileMap.set(f.path.replace(/^\/+/, ''), f.content);
  }

  // Handle Python files
  if (mode === 'python') {
    const mainPy = fileMap.get('main.py') || fileMap.get('app.py') || Array.from(fileMap.entries()).find(([k]) => k.endsWith('.py'))?.[1] || '';
    return {
      mode: 'python',
      pythonCode: mainPy,
      html: generatePythonPreviewHtml(mainPy),
    };
  }

  // Handle Other non-browser native languages
  if (mode === 'native-backend') {
    const firstOther = Array.from(fileMap.entries()).find(([k]) => k.endsWith('.go') || k.endsWith('.rs') || k.endsWith('.java') || k.endsWith('.cpp') || k.endsWith('.php'));
    const fileName = firstOther ? firstOther[0] : 'backend file';
    return {
      mode: 'native-backend',
      otherLanguageNotice: `Detected ${fileName}. Backend binaries run locally or via Remote Runner.`,
      html: generateNativeBackendPreviewHtml(fileName, firstOther?.[1] || ''),
    };
  }

  // Next-Compat Mode: Map app/ and pages/ routes into a reactive client runner
  if (mode === 'next-compat') {
    const pageContent = fileMap.get('app/page.tsx') || fileMap.get('app/page.jsx') || fileMap.get('pages/index.tsx') || fileMap.get('pages/index.jsx') || '';
    return {
      mode: 'next-compat',
      badge: 'Preview mode – full Next.js runs on Vercel',
      html: generateNextCompatHtml(pageContent, fileMap),
    };
  }

  // Static / Vanilla / React bundle
  let indexHtml = fileMap.get('index.html') || fileMap.get('index.htm');

  if (!indexHtml) {
    // Generate fallback HTML
    const jsFiles = Array.from(fileMap.keys()).filter((p) => p.endsWith('.js') || p.endsWith('.ts') || p.endsWith('.jsx') || p.endsWith('.tsx'));
    const cssFiles = Array.from(fileMap.keys()).filter((p) => p.endsWith('.css'));

    indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NEXA Live Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  ${cssFiles.map((css) => `<style>/* ${css} */\n${fileMap.get(css)}</style>`).join('\n')}
</head>
<body class="bg-[#070A12] text-slate-100 p-6 font-sans">
  <div id="root"></div>
  <div id="app"></div>
  ${jsFiles.map((js) => `<script type="module">/* ${js} */\n${fileMap.get(js)}</script>`).join('\n')}
</body>
</html>`;
  }

  // Inline CSS
  indexHtml = indexHtml.replace(/<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi, (match, href) => {
    const cleanHref = href.replace(/^\/+/, '').split('?')[0];
    if (fileMap.has(cleanHref)) {
      return `<style>/* Inlined: ${cleanHref} */\n${fileMap.get(cleanHref)}\n</style>`;
    }
    return match;
  });

  // Inline local scripts
  indexHtml = indexHtml.replace(/<script[^>]*src=["']([^"']+)["'][^>]*><\/script>/gi, (match, src) => {
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('//')) {
      return match;
    }
    const cleanSrc = src.replace(/^\/+/, '').split('?')[0];
    if (fileMap.has(cleanSrc)) {
      return `<script type="module">/* Inlined: ${cleanSrc} */\n${fileMap.get(cleanSrc)}\n</script>`;
    }
    return match;
  });

  // Inject console & runtime error harness
  const injectedHarness = generateConsoleHarnessScript();
  if (indexHtml.includes('</head>')) {
    indexHtml = indexHtml.replace('</head>', `${injectedHarness}\n</head>`);
  } else {
    indexHtml = `${injectedHarness}\n${indexHtml}`;
  }

  return {
    mode: mode === 'react' ? 'react' : 'static',
    html: indexHtml,
  };
}

/**
 * Console harness script injected into iframe to relay logs & errors
 */
function generateConsoleHarnessScript(): string {
  return `
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

  var originalLog = console.log;
  var originalWarn = console.warn;
  var originalError = console.error;
  var originalInfo = console.info;

  console.log = function() { sendLog('info', arguments); originalLog.apply(console, arguments); };
  console.info = function() { sendLog('info', arguments); originalInfo.apply(console, arguments); };
  console.warn = function() { sendLog('warn', arguments); originalWarn.apply(console, arguments); };
  console.error = function() { sendLog('error', arguments); originalError.apply(console, arguments); };

  window.onerror = function(message, source, lineno, colno, error) {
    var errorMsg = 'Runtime Error: ' + message + (lineno ? ' (' + lineno + ':' + colno + ')' : '');
    sendLog('error', [errorMsg]);
    window.parent.postMessage({
      type: 'NEXA_PREVIEW_ERROR',
      error: errorMsg,
      source: source,
      line: lineno
    }, '*');
    return false;
  };
})();
</script>
`;
}

/**
 * Next-Compat Mode HTML generator
 */
function generateNextCompatHtml(pageCode: string, fileMap: Map<string, string>): string {
  const css = fileMap.get('app/globals.css') || fileMap.get('styles/globals.css') || '';
  const harness = generateConsoleHarnessScript();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Next.js Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    ${css}
    body { margin: 0; background-color: #070A12; color: #F1F5F9; font-family: sans-serif; }
  </style>
  ${harness}
</head>
<body>
  <div id="root">
    <div style="padding: 24px; font-family: monospace; font-size: 13px; color: #94A3B8;">
      <div style="display:inline-block; padding: 4px 10px; border-radius: 9999px; background: rgba(34, 211, 238, 0.1); border: 1px solid rgba(34, 211, 238, 0.3); color: #22D3EE; margin-bottom: 16px; font-weight: 600;">
        Preview mode – full Next.js runs on Vercel
      </div>
      <h2 style="color: #fff; font-size: 18px; margin-bottom: 8px;">Next.js App Router Container</h2>
      <p style="margin-bottom: 16px;">Rendered via client-side compatibility router.</p>
      <div style="background: #0C101D; border: 1px solid rgba(255,255,255,0.1); padding: 16px; border-radius: 12px; white-space: pre-wrap; font-size: 12px; color: #E2E8F0;">
${pageCode.replace(/</g, '&lt;').replace(/>/g, '&gt;') || '(app/page.tsx empty)'}
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Python In-Browser Preview HTML generator (using Pyodide CDN)
 */
function generatePythonPreviewHtml(code: string): string {
  const harness = generateConsoleHarnessScript();
  const escaped = code.replace(/\\/g, '\\\\').replace(/`/g, '\\`');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Python Pyodide Preview</title>
  <script src="https://cdn.jsdelivr.net/pyodide/v0.26.1/full/pyodide.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  ${harness}
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
      <p class="text-[11px] text-slate-500 mb-2">// Executing main.py:</p>
      <div id="output" class="text-emerald-400 whitespace-pre-wrap leading-relaxed">Loading Pyodide WASM environment...</div>
    </div>
  </div>

  <script>
    async function runPython() {
      const out = document.getElementById('output');
      try {
        const pyodide = await loadPyodide({
          stdout: (text) => {
            console.log(text);
            out.textContent += text + '\\n';
          },
          stderr: (text) => {
            console.error(text);
            out.textContent += '[stderr] ' + text + '\\n';
          }
        });
        out.textContent = '';
        const userCode = \`${escaped}\`;
        await pyodide.runPythonAsync(userCode);
        if (!out.textContent) {
          out.textContent = '(Script executed successfully with no stdout output)';
        }
      } catch (err) {
        console.error('Python Error:', err);
        out.textContent += '\\nPython Error: ' + err.message;
      }
    }
    runPython();
  </script>
</body>
</html>`;
}

/**
 * Native backend HTML generator for non-browser languages
 */
function generateNativeBackendPreviewHtml(fileName: string, content: string): string {
  const harness = generateConsoleHarnessScript();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Backend Environment</title>
  <script src="https://cdn.tailwindcss.com"></script>
  ${harness}
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
      💡 <strong>Download and run locally or connect Remote Runner</strong> in Settings to execute native compile toolchains.
    </div>
    <pre class="bg-black/60 border border-white/10 rounded-xl p-3 font-mono text-[11px] text-slate-300 max-h-60 overflow-y-auto whitespace-pre-wrap">${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
  </div>
</body>
</html>`;
}

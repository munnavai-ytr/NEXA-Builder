// Sandboxed Live Preview Bundler and Iframe Runner
import { FileRecord } from '../core/db';

export interface BundledApp {
  html: string;
  blobUrl?: string;
  hasIndex: boolean;
}

/**
 * Console and error capturing script to inject into preview iframe
 */
const INJECTED_PREVIEW_HARNESS = `
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
    sendLog('error', ['Runtime Error: ' + message + (lineno ? ' (' + lineno + ':' + colno + ')' : '')]);
    return false;
  };
})();
</script>
`;

/**
 * Bundles virtual files into a standalone sandboxed HTML payload
 */
export function bundlePreview(files: FileRecord[]): BundledApp {
  const fileMap = new Map<string, string>();
  for (const f of files) {
    fileMap.set(f.path.replace(/^\/+/, ''), f.content);
  }

  let indexHtml = fileMap.get('index.html') || fileMap.get('index.htm');

  if (!indexHtml) {
    // Generate a fallback index.html if project only has js/css/md
    const jsFiles = Array.from(fileMap.keys()).filter((p) => p.endsWith('.js') || p.endsWith('.ts'));
    const cssFiles = Array.from(fileMap.keys()).filter((p) => p.endsWith('.css'));
    const mdFiles = Array.from(fileMap.keys()).filter((p) => p.endsWith('.md'));

    if (fileMap.size === 0) {
      return {
        html: `<!DOCTYPE html><html><body style="background:#070A12;color:#94a3b8;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><p>No files in project yet. Describe your app to generate code.</p></body></html>`,
        hasIndex: false,
      };
    }

    indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  ${cssFiles.map((css) => `<style>/* ${css} */\n${fileMap.get(css)}</style>`).join('\n')}
</head>
<body class="bg-[#070A12] text-slate-100 p-8 font-sans">
  <div class="max-w-xl mx-auto">
    <h2 class="text-xl font-bold mb-4">Project Preview</h2>
    ${mdFiles.map((m) => `<div class="p-4 bg-slate-900 border border-slate-800 rounded-lg mb-4 whitespace-pre-wrap font-mono text-xs">${fileMap.get(m)}</div>`).join('\n')}
    <div id="app"></div>
  </div>
  ${jsFiles.map((js) => `<script type="module">// ${js}\n${fileMap.get(js)}</script>`).join('\n')}
</body>
</html>`;
  }

  // Process and inline stylesheets
  indexHtml = indexHtml.replace(/<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi, (match, href) => {
    const cleanHref = href.replace(/^\/+/, '').split('?')[0];
    if (fileMap.has(cleanHref)) {
      return `<style>/* Inlined: ${cleanHref} */\n${fileMap.get(cleanHref)}\n</style>`;
    }
    return match;
  });

  // Process and inline relative script tags
  indexHtml = indexHtml.replace(/<script[^>]*src=["']([^"']+)["'][^>]*><\/script>/gi, (match, src) => {
    // ignore external CDNs
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('//')) {
      return match;
    }
    const cleanSrc = src.replace(/^\/+/, '').split('?')[0];
    if (fileMap.has(cleanSrc)) {
      return `<script type="module">/* Inlined: ${cleanSrc} */\n${fileMap.get(cleanSrc)}\n</script>`;
    }
    return match;
  });

  // Inject console & error logging harness right before </head> or at start
  if (indexHtml.includes('</head>')) {
    indexHtml = indexHtml.replace('</head>', `${INJECTED_PREVIEW_HARNESS}\n</head>`);
  } else {
    indexHtml = `${INJECTED_PREVIEW_HARNESS}\n${indexHtml}`;
  }

  return {
    html: indexHtml,
    hasIndex: true,
  };
}

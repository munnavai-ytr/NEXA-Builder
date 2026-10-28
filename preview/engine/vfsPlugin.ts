// Virtual File System Plugin for esbuild-wasm
import type { Plugin } from 'esbuild-wasm';
import { getNextShimsCode } from './nextCompat';

const EXTENSIONS = ['', '.tsx', '.ts', '.jsx', '.js', '.json', '.css', '/index.tsx', '/index.ts', '/index.jsx', '/index.js'];

export function createVfsPlugin(
  fileMap: Map<string, string>,
  collectedCss: string[]
): Plugin {
  return {
    name: 'nexa-vfs-plugin',
    setup(build) {
      // 1. Next.js internal shims interception
      build.onResolve({ filter: /^next(\/.*)?$/ }, (args) => {
        return { path: args.path, namespace: 'next-shims' };
      });

      build.onLoad({ filter: /.*/, namespace: 'next-shims' }, (args) => {
        const shims = getNextShimsCode();

        if (args.path === 'next/link') {
          return { contents: `${shims}\nexport default Link;`, loader: 'js' };
        }
        if (args.path === 'next/image') {
          return { contents: `${shims}\nexport default Image;`, loader: 'js' };
        }
        if (args.path === 'next/navigation') {
          return {
            contents: `${shims}\nexport { useRouter, usePathname, useSearchParams, useParams, redirect, notFound };`,
            loader: 'js',
          };
        }
        if (args.path === 'next/router') {
          return {
            contents: `${shims}\nexport { useRouter }; export default { useRouter };`,
            loader: 'js',
          };
        }
        if (args.path === 'next/head') {
          return { contents: `${shims}\nexport default Head;`, loader: 'js' };
        }
        if (args.path === 'next/script') {
          return { contents: `${shims}\nexport default Script;`, loader: 'js' };
        }
        if (args.path === 'next/dynamic') {
          return { contents: `${shims}\nexport default dynamic;`, loader: 'js' };
        }
        if (args.path.startsWith('next/font')) {
          return {
            contents: `${shims}\nexport const Inter = createFontMock('Inter');\nexport const Roboto = createFontMock('Roboto');\nexport const Outfit = createFontMock('Outfit');\nexport default createFontMock('sans-serif');`,
            loader: 'js',
          };
        }

        // Generic fallback Next module
        return {
          contents: `${shims}\nexport default {};`,
          loader: 'js',
        };
      });

      // 2. Resolve virtual files, @/ alias, and bare NPM imports
      build.onResolve({ filter: /.*/ }, (args) => {
        let target = args.path;

        // Resolve @/ alias
        if (target.startsWith('@/')) {
          target = target.slice(2);
        } else if (target.startsWith('./') || target.startsWith('../')) {
          // Resolve relative to importer directory
          const importerDir = args.importer ? args.importer.split('/').slice(0, -1).join('/') : '';
          target = resolveRelative(importerDir, target);
        } else if (!target.startsWith('/')) {
          // Check if bare name matches a virtual file (e.g. 'app.js', 'style.css')
          if (fileMap.has(target)) {
            return { path: target, namespace: 'nexa-vfs' };
          }
          // Otherwise, it is an external NPM package -> mark as external for import map!
          return { path: target, external: true };
        }

        // Clean leading slashes
        target = target.replace(/^\/+/, '');

        // Try exact match or extensions
        for (const ext of EXTENSIONS) {
          const candidate = `${target}${ext}`;
          if (fileMap.has(candidate)) {
            return { path: candidate, namespace: 'nexa-vfs' };
          }
        }

        // If file not in VFS and is not relative, treat as external package
        if (!args.path.startsWith('.') && !args.path.startsWith('/')) {
          return { path: args.path, external: true };
        }

        return { path: target, namespace: 'nexa-vfs' };
      });

      // 3. Load Virtual Files from fileMap
      build.onLoad({ filter: /.*/, namespace: 'nexa-vfs' }, (args) => {
        let content = fileMap.get(args.path);

        if (content === undefined) {
          // Try finding with extensions
          for (const ext of EXTENSIONS) {
            const candidate = `${args.path}${ext}`;
            if (fileMap.has(candidate)) {
              content = fileMap.get(candidate);
              break;
            }
          }
        }

        if (content === undefined) {
          return {
            errors: [
              {
                text: `File not found in Virtual File System: "${args.path}"`,
                location: { file: args.path, line: 1, column: 0, length: 0, lineText: '', namespace: 'nexa-vfs', suggestion: '' },
              },
            ],
          };
        }

        // Strip "use client" and "use server" pragmas
        content = content.replace(/^['"]use (?:client|server)['"];?\s*/g, '');

        // Handle CSS files
        if (args.path.endsWith('.css')) {
          collectedCss.push(`/* ${args.path} */\n${content}`);
          return {
            contents: `// Inlined CSS: ${args.path}`,
            loader: 'js',
          };
        }

        // Handle JSON
        if (args.path.endsWith('.json')) {
          return {
            contents: content,
            loader: 'json',
          };
        }

        // Handle SVG and images
        if (args.path.endsWith('.svg')) {
          const base64 = typeof btoa !== 'undefined' ? btoa(content) : '';
          const dataUrl = `data:image/svg+xml;base64,${base64}`;
          return {
            contents: `export default ${JSON.stringify(dataUrl)};`,
            loader: 'js',
          };
        }

        // Determine loader based on extension
        let loader: 'tsx' | 'ts' | 'jsx' | 'js' = 'tsx';
        if (args.path.endsWith('.ts')) loader = 'ts';
        else if (args.path.endsWith('.jsx')) loader = 'jsx';
        else if (args.path.endsWith('.js')) loader = 'js';

        return {
          contents: content,
          loader,
        };
      });
    },
  };
}

function resolveRelative(baseDir: string, relativePath: string): string {
  const baseParts = baseDir.split('/').filter(Boolean);
  const relParts = relativePath.split('/');

  for (const part of relParts) {
    if (part === '.' || !part) continue;
    if (part === '..') {
      baseParts.pop();
    } else {
      baseParts.push(part);
    }
  }

  return baseParts.join('/');
}

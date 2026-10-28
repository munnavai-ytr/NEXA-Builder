// Dynamic Import Map Generator with esm.sh & jsdelivr fallbacks, React de-duplication, and Cache API
import { PackageResolution } from './types';

interface ImportMapResult {
  importMap: { imports: Record<string, string>; scopes?: Record<string, Record<string, string>> };
  resolutions: PackageResolution[];
}

const importMapCache = new Map<string, ImportMapResult>();

// Known React peer-dependency libraries to ensure single React instance loads
const REACT_DEPENDENT_PACKAGES = new Set([
  'lucide-react',
  'zustand',
  'motion',
  'framer-motion',
  '@radix-ui/react-slot',
  '@radix-ui/react-dropdown-menu',
  '@radix-ui/react-dialog',
  '@radix-ui/react-tooltip',
  'react-router',
  'react-router-dom',
  'react-hook-form',
  'class-variance-authority',
  'recharts',
  'react-icons',
  'canvas-confetti',
  '@tanstack/react-query',
]);

/**
 * Scans code files to extract any unlisted bare imports (e.g. import { ... } from 'canvas-confetti')
 */
export function extractBareImports(files: { path: string; content: string }[]): Set<string> {
  const imports = new Set<string>();
  const importRegex = /(?:import|export)\s+(?:[\w*\s{},]*\s+from\s+)?['"]([@\w\d_/-]+)['"]/g;
  const requireRegex = /require\(['"]([@\w\d_/-]+)['"]\)/g;

  for (const f of files) {
    if (!f.path.endsWith('.ts') && !f.path.endsWith('.tsx') && !f.path.endsWith('.js') && !f.path.endsWith('.jsx')) {
      continue;
    }

    let match;
    while ((match = importRegex.exec(f.content)) !== null) {
      const spec = match[1];
      if (!spec.startsWith('.') && !spec.startsWith('/') && !spec.startsWith('@/')) {
        imports.add(spec);
      }
    }

    while ((match = requireRegex.exec(f.content)) !== null) {
      const spec = match[1];
      if (!spec.startsWith('.') && !spec.startsWith('/') && !spec.startsWith('@/')) {
        imports.add(spec);
      }
    }
  }

  return imports;
}

/**
 * Builds the import map for the preview iframe
 */
export function buildImportMap(
  pkgJsonRaw?: string,
  detectedImports?: Set<string>,
  cacheKey?: string
): ImportMapResult {
  if (cacheKey && importMapCache.has(cacheKey)) {
    return importMapCache.get(cacheKey)!;
  }

  let pkgDependencies: Record<string, string> = {};
  if (pkgJsonRaw) {
    try {
      const parsed = JSON.parse(pkgJsonRaw);
      pkgDependencies = {
        ...(parsed.dependencies || {}),
        ...(parsed.devDependencies || {}),
      };
    } catch {}
  }

  // React version pinning (default to 19.2.1)
  const reactVersion = pkgDependencies['react']?.replace(/[\^~]/, '') || '19.2.1';
  const reactDomVersion = pkgDependencies['react-dom']?.replace(/[\^~]/, '') || reactVersion;

  const imports: Record<string, string> = {
    react: `https://esm.sh/react@${reactVersion}`,
    'react/': `https://esm.sh/react@${reactVersion}/`,
    'react/jsx-runtime': `https://esm.sh/react@${reactVersion}/jsx-runtime`,
    'react/jsx-dev-runtime': `https://esm.sh/react@${reactVersion}/jsx-dev-runtime`,
    'react-dom': `https://esm.sh/react-dom@${reactDomVersion}?external=react`,
    'react-dom/': `https://esm.sh/react-dom@${reactDomVersion}/?external=react`,
    'react-dom/client': `https://esm.sh/react-dom@${reactDomVersion}/client?external=react`,
  };

  const resolutions: PackageResolution[] = [
    { name: 'react', version: reactVersion, url: imports['react'], success: true },
    { name: 'react-dom', version: reactDomVersion, url: imports['react-dom'], success: true },
    { name: 'react/jsx-runtime', version: reactVersion, url: imports['react/jsx-runtime'], success: true },
  ];

  // Combine explicitly declared dependencies + auto-detected imports
  const allPackages = new Set<string>([
    ...Object.keys(pkgDependencies),
    ...(detectedImports ? Array.from(detectedImports) : []),
  ]);

  for (const rawPkg of allPackages) {
    if (!rawPkg || rawPkg === 'react' || rawPkg === 'react-dom' || rawPkg.startsWith('next/')) {
      continue;
    }

    // Split scoped package or subpath (e.g. @radix-ui/react-slot or lodash/merge)
    const basePkg = rawPkg.startsWith('@')
      ? rawPkg.split('/').slice(0, 2).join('/')
      : rawPkg.split('/')[0];

    const version = pkgDependencies[basePkg]?.replace(/[\^~]/, '') || 'latest';
    const isReactDep =
      REACT_DEPENDENT_PACKAGES.has(basePkg) ||
      basePkg.startsWith('@radix-ui/') ||
      basePkg.startsWith('lucide-') ||
      basePkg.includes('react');

    const extParam = isReactDep ? '?external=react,react-dom' : '';
    const esmUrl = `https://esm.sh/${rawPkg}@${version}${extParam}`;

    imports[rawPkg] = esmUrl;

    // Subpath support if base pkg is imported with trailing slash
    if (!rawPkg.includes('/')) {
      imports[`${rawPkg}/`] = `https://esm.sh/${rawPkg}@${version}/${extParam ? extParam : ''}`;
    }

    resolutions.push({
      name: rawPkg,
      version,
      url: esmUrl,
      success: true,
    });
  }

  const result: ImportMapResult = {
    importMap: { imports },
    resolutions,
  };

  if (cacheKey) {
    importMapCache.set(cacheKey, result);
  }

  return result;
}

// Next.js App Router & Pages Router Compatibility Engine (Shims, Routing, API Mocking)

export interface NextRoute {
  path: string;
  filePath: string;
  layoutPaths: string[];
  isDynamic: boolean;
  paramName?: string;
}

/**
 * Scans virtual files for Next.js app/ and pages/ directory routes
 */
export function scanNextRoutes(filePaths: string[]): {
  routes: NextRoute[];
  rootLayout?: string;
  hasAppRouter: boolean;
  hasPagesRouter: boolean;
  apiRoutes: { path: string; filePath: string }[];
} {
  const routes: NextRoute[] = [];
  const apiRoutes: { path: string; filePath: string }[] = [];
  let rootLayout: string | undefined;

  const appFiles = filePaths.filter((p) => p.startsWith('app/'));
  const pagesFiles = filePaths.filter((p) => p.startsWith('pages/') || p.startsWith('src/pages/'));

  const hasAppRouter = appFiles.length > 0;
  const hasPagesRouter = pagesFiles.length > 0;

  if (hasAppRouter) {
    rootLayout = appFiles.find((p) => p === 'app/layout.tsx' || p === 'app/layout.jsx' || p === 'app/layout.js');

    // Find all page.tsx files
    const pageFiles = appFiles.filter((p) => {
      const parts = p.split('/');
      const filename = parts[parts.length - 1];
      return filename.startsWith('page.');
    });

    for (const pf of pageFiles) {
      let routePath = pf
        .replace(/^app\/?/, '/')
        .replace(/\/page\.[^/]+$/, '');

      if (!routePath || routePath === '') routePath = '/';
      if (!routePath.startsWith('/')) routePath = `/${routePath}`;

      // Check dynamic [id] or [slug]
      const dynamicMatch = /\[([^\]]+)\]/.exec(routePath);
      const isDynamic = Boolean(dynamicMatch);
      const paramName = dynamicMatch ? dynamicMatch[1] : undefined;

      // Find applicable layouts in directory hierarchy
      const segments = pf.split('/');
      const layoutPaths: string[] = [];
      let currentDir = 'app';

      for (let i = 1; i < segments.length - 1; i++) {
        currentDir += `/${segments[i]}`;
        const layoutCandidate = appFiles.find(
          (p) => p === `${currentDir}/layout.tsx` || p === `${currentDir}/layout.jsx`
        );
        if (layoutCandidate && !layoutPaths.includes(layoutCandidate)) {
          layoutPaths.push(layoutCandidate);
        }
      }

      routes.push({
        path: routePath,
        filePath: pf,
        layoutPaths,
        isDynamic,
        paramName,
      });
    }

    // Find API routes: app/api/**/route.ts
    const apiFiles = appFiles.filter((p) => p.includes('/route.ts') || p.includes('/route.js'));
    for (const af of apiFiles) {
      const apiPath = af.replace(/^app\/?/, '/').replace(/\/route\.[^/]+$/, '');
      apiRoutes.push({ path: apiPath, filePath: af });
    }
  } else if (hasPagesRouter) {
    const pageFiles = pagesFiles.filter((p) => {
      const base = p.split('/').pop() || '';
      return !base.startsWith('_') && !p.includes('/api/');
    });

    for (const pf of pageFiles) {
      let routePath = pf
        .replace(/^(?:src\/)?pages\/?/, '/')
        .replace(/\.[^/.]+$/, '');
      if (routePath.endsWith('/index')) routePath = routePath.replace(/\/index$/, '');
      if (!routePath || routePath === '') routePath = '/';

      routes.push({
        path: routePath,
        filePath: pf,
        layoutPaths: [],
        isDynamic: routePath.includes('['),
      });
    }

    // Pages API routes: pages/api/**.ts
    const apiFiles = pagesFiles.filter((p) => p.includes('/api/'));
    for (const af of apiFiles) {
      const apiPath = af.replace(/^(?:src\/)?pages\/?/, '/').replace(/\.[^/.]+$/, '');
      apiRoutes.push({ path: apiPath, filePath: af });
    }
  }

  // Ensure root / route exists
  if (routes.length === 0) {
    const anyEntry = filePaths.find((p) => p.endsWith('page.tsx') || p.endsWith('App.tsx') || p.endsWith('index.tsx'));
    if (anyEntry) {
      routes.push({
        path: '/',
        filePath: anyEntry,
        layoutPaths: rootLayout ? [rootLayout] : [],
        isDynamic: false,
      });
    }
  }

  return { routes, rootLayout, hasAppRouter, hasPagesRouter, apiRoutes };
}

/**
 * Returns full JavaScript code for Next.js client-side runtime shims
 */
export function getNextShimsCode(): string {
  return `
// NEXA Built-in Next.js Shims
export const Link = function NextLink({ href, children, replace, scroll, prefetch, ...props }) {
  const handleClick = (e) => {
    if (!props.target && href && typeof href === 'string' && !href.startsWith('http://') && !href.startsWith('https://')) {
      e.preventDefault();
      if (replace) {
        window.history.replaceState({}, '', href);
      } else {
        window.history.pushState({}, '', href);
      }
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
    props.onClick?.(e);
  };
  return window.React.createElement('a', { href: typeof href === 'object' ? href.pathname : href, onClick: handleClick, ...props }, children);
};

export const Image = function NextImage({ src, alt, width, height, fill, className, style, priority, ...props }) {
  const imgSrc = typeof src === 'object' && src !== null ? src.src || '' : src || '';
  const imgStyle = fill
    ? { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', ...style }
    : style;
  return window.React.createElement('img', {
    src: imgSrc,
    alt: alt || '',
    width: fill ? undefined : width,
    height: fill ? undefined : height,
    className,
    style: imgStyle,
    referrerPolicy: 'no-referrer',
    ...props
  });
};

export function useRouter() {
  return {
    push: (url) => {
      window.history.pushState({}, '', url);
      window.dispatchEvent(new PopStateEvent('popstate'));
    },
    replace: (url) => {
      window.history.replaceState({}, '', url);
      window.dispatchEvent(new PopStateEvent('popstate'));
    },
    back: () => window.history.back(),
    forward: () => window.history.forward(),
    refresh: () => window.dispatchEvent(new PopStateEvent('popstate')),
    prefetch: () => {},
  };
}

export function usePathname() {
  const [pathname, setPathname] = window.React.useState(window.location.pathname || '/');
  window.React.useEffect(() => {
    const handlePop = () => setPathname(window.location.pathname || '/');
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);
  return pathname;
}

export function useSearchParams() {
  const [searchParams, setSearchParams] = window.React.useState(new URLSearchParams(window.location.search));
  window.React.useEffect(() => {
    const handlePop = () => setSearchParams(new URLSearchParams(window.location.search));
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);
  return searchParams;
}

export function useParams() {
  const [params, setParams] = window.React.useState({});
  return params;
}

export function redirect(url) {
  window.history.pushState({}, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function notFound() {
  throw new Error('NEXT_NOT_FOUND');
}

export const Head = function NextHead({ children }) {
  return window.React.createElement(window.React.Fragment, null, children);
};

export const Script = function NextScript(props) {
  return window.React.createElement('script', props);
};

export function dynamic(importFn, options) {
  return function DynamicComponent(props) {
    const [Comp, setComp] = window.React.useState(null);
    window.React.useEffect(() => {
      importFn().then((mod) => setComp(() => mod.default || mod));
    }, []);
    if (!Comp) return options?.loading ? options.loading() : null;
    return window.React.createElement(Comp, props);
  };
}

// next/font fallback factory
export function createFontMock(fontFamily) {
  return function(opts) {
    return {
      className: 'font-sans',
      style: { fontFamily: fontFamily || 'sans-serif' },
      variable: '--font-sans',
    };
  };
}
`;
}

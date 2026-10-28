// esbuild-wasm singleton service
import * as esbuild from 'esbuild-wasm';

let initPromise: Promise<typeof esbuild> | null = null;
let isInitialized = false;

const WASM_URL = 'https://cdn.jsdelivr.net/npm/esbuild-wasm@0.28.2/esbuild.wasm';
const WASM_FALLBACK_URL = 'https://unpkg.com/esbuild-wasm@0.28.2/esbuild.wasm';

export async function getEsbuildInstance(): Promise<typeof esbuild> {
  if (typeof window === 'undefined') {
    throw new Error('esbuild-wasm can only run in the browser environment');
  }

  if (isInitialized) {
    return esbuild;
  }

  if (!initPromise) {
    initPromise = (async () => {
      try {
        await esbuild.initialize({
          wasmURL: WASM_URL,
          worker: false,
        });
        isInitialized = true;
        return esbuild;
      } catch (err: any) {
        // If already initialized in this window, treat as success
        if (err?.message?.includes('already called initialize') || err?.message?.includes('Cannot call "initialize" more than once')) {
          isInitialized = true;
          return esbuild;
        }

        console.warn('Primary WASM CDN failed, trying fallback CDN...', err);
        try {
          await esbuild.initialize({
            wasmURL: WASM_FALLBACK_URL,
            worker: false,
          });
          isInitialized = true;
          return esbuild;
        } catch (fallbackErr: any) {
          if (fallbackErr?.message?.includes('already called initialize')) {
            isInitialized = true;
            return esbuild;
          }
          throw fallbackErr;
        }
      }
    })();
  }

  return initPromise;
}

/**
 * DOM abstraction layer.
 *
 * Every browser API the SDK touches (event listeners, IntersectionObserver,
 * geometry, timing) is expressed through DomAdapter so observers can be
 * tested in Node with fake adapters, and SSR/edge runtimes get a null
 * adapter instead of crashes.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScrollPosition {
  x: number;
  y: number;
}

export interface DomAdapter {
  /** Listen to a window-level event. Returns an unsubscribe function. */
  listen(target: 'window' | 'document', type: string, handler: (event: unknown) => void): () => void;
  /**
   * Observe an element's viewport intersection ratio.
   * Called back with (ratio, rect?) whenever it changes. Returns unobserve fn.
   */
  observeIntersection(element: unknown, cb: (ratio: number, rect?: Rect) => void): () => void;
  scrollPosition(): ScrollPosition;
  viewportSize(): { width: number; height: number } | undefined;
  visibilityState(): 'visible' | 'hidden' | 'prerender' | string;
  userAgent(): string | undefined;
  language(): string | undefined;
  timezone(): string;
  devicePixelRatio(): number | undefined;
  platform(): string | undefined;
}

/** Adapter that never reports anything. Used off-browser (SSR/tests default). */
export function createNullAdapter(): DomAdapter {
  return {
    listen: () => () => {},
    observeIntersection: () => () => {},
    scrollPosition: () => ({ x: 0, y: 0 }),
    viewportSize: () => undefined,
    visibilityState: () => 'hidden',
    userAgent: () => undefined,
    language: () => undefined,
    timezone: () => 'UTC',
    devicePixelRatio: () => undefined,
    platform: () => undefined,
  };
}

/**
 * Real browser adapter built on standard Web APIs only.
 * Throws no errors in non-browser runtimes: createDefaultAdapter()
 * returns the null adapter when `window`/`document` are absent.
 */
export function createBrowserAdapter(): DomAdapter {
  const w = window;
  const d = document;
  return {
    listen(target, type, handler) {
      const t = target === 'window' ? w : d;
      const listener = handler as EventListener;
      t.addEventListener(type, listener, { passive: true });
      return () => t.removeEventListener(type, listener);
    },
    observeIntersection(element, cb) {
      if (typeof IntersectionObserver === 'undefined' || !(element instanceof Element)) {
        return () => {};
      }
      const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          const rect = entry.boundingClientRect;
          cb(entry.intersectionRatio, {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          });
        }
      });
      observer.observe(element);
      return () => observer.disconnect();
    },
    scrollPosition: () => ({ x: w.scrollX, y: w.scrollY }),
    viewportSize: () => ({ width: w.innerWidth, height: w.innerHeight }),
    visibilityState: () => d.visibilityState,
    userAgent: () => navigator.userAgent,
    language: () => navigator.language,
    timezone: () => Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
    devicePixelRatio: () => w.devicePixelRatio,
    platform: () => navigator.platform,
  };
}

export function createDefaultAdapter(): DomAdapter {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    return createBrowserAdapter();
  }
  return createNullAdapter();
}

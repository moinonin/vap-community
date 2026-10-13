/**
 * Injectable adapters for Chrome extension APIs.
 *
 * Everything Chrome-specific (runtime messaging, chrome.storage) goes through
 * these seams so the background service worker, content script and popup are
 * all testable in plain Node with fakes.
 */

/** MV3 runtime messaging, reduced to the two operations this SDK uses. */
export interface RuntimeAdapter {
  /** Send a message to the other side; resolves with the response value. */
  sendMessage(message: unknown): Promise<unknown>;
  /** Register a message handler. Returns an unsubscribe function. */
  addListener(handler: (message: unknown) => unknown | Promise<unknown>): () => void;
}

/** Async key/value store (chrome.storage.local shape). */
export interface AsyncStorageStore {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
}

interface ChromeRuntimeApi {
  lastError?: { message?: string };
  sendMessage(message: unknown, callback: (response: unknown) => void): void;
  onMessage: {
    addListener(fn: (message: unknown, sender: unknown, sendResponse: (r: unknown) => void) => unknown): void;
    removeListener(fn: (message: unknown, sender: unknown, sendResponse: (r: unknown) => void) => unknown): void;
  };
}

interface ChromeLike {
  runtime?: ChromeRuntimeApi;
  storage?: {
    local: {
      get(key: string, callback: (items: Record<string, unknown>) => void): void;
      set(items: Record<string, unknown>, callback?: () => void): void;
    };
  };
}

function chromeApi(): ChromeLike | undefined {
  return (globalThis as { chrome?: ChromeLike }).chrome;
}

/** True when running inside a real Chrome extension context. */
export function inChromeExtension(): boolean {
  return chromeApi()?.runtime !== undefined;
}

/** Real adapter over chrome.runtime. Throws when no Chrome APIs exist. */
export function createChromeRuntime(): RuntimeAdapter {
  const api = chromeApi()?.runtime;
  if (!api) throw new Error('extension-sdk: chrome.runtime is not available');
  return {
    sendMessage(message) {
      return new Promise((resolve, reject) => {
        api.sendMessage(message, (response) => {
          const err = chromeApi()?.runtime?.lastError;
          if (err) reject(new Error(err.message ?? 'chrome.runtime error'));
          else resolve(response);
        });
      });
    },
    addListener(handler) {
      const listener = (message: unknown, _sender: unknown, sendResponse: (r: unknown) => void) => {
        // Return true so Chrome keeps the message channel open for async replies.
        Promise.resolve(handler(message)).then(
          (r) => sendResponse(r),
          (e) => sendResponse({ ok: false, error: String((e as Error)?.message ?? e) }),
        );
        return true;
      };
      api.onMessage.addListener(listener);
      return () => api.onMessage.removeListener(listener);
    },
  };
}

/** Real adapter over chrome.storage.local. Throws when unavailable. */
export function createChromeStorageStore(): AsyncStorageStore {
  const local = chromeApi()?.storage?.local;
  if (!local) throw new Error('extension-sdk: chrome.storage.local is not available');
  return {
    get: (key) =>
      new Promise((resolve) => {
        local.get(key, (items) => {
          const v = items?.[key];
          resolve(typeof v === 'string' ? v : undefined);
        });
      }),
    set: (key, value) =>
      new Promise((resolve) => {
        local.set({ [key]: value }, () => resolve());
      }),
  };
}

/** In-memory AsyncStorageStore — the default in tests and plain Node. */
export function createMemoryStore(seed: Record<string, string> = {}): AsyncStorageStore {
  const map = new Map<string, string>(Object.entries(seed));
  return {
    get: async (key) => map.get(key),
    set: async (key, value) => {
      map.set(key, value);
    },
  };
}

/**
 * Popup entry: consent toggle + session status.
 *
 * The popup is plain DOM, but the elements it needs are unknown here — it only
 * talks to an injectable "document-like" object plus the messaging adapter,
 * keeping the module testable in Node. All Chrome APIs are hidden behind the
 * same seams as the rest of the extension SDK.
 */

import { MSG, type ExtensionMessage } from './messages';
import type { RuntimeAdapter } from './runtime';
import { createChromeRuntime, inChromeExtension } from './runtime';

export interface PopupElements {
  byId<T = unknown>(id: string): T | null;
}

interface ToggleEl {
  checked: boolean;
  addEventListener(type: string, listener: (event: { target: { checked: boolean } }) => void): void;
}

interface ButtonEl {
  addEventListener(type: string, listener: () => void): void;
}

interface TextEl {
  textContent: string;
}

export interface PopupController {
  /** Force one status refresh (asks the background for status). */
  refresh(): Promise<void>;
  /** The periodic status refresh timer; safe to call multiple times. */
  startStatusPolling(intervalMs: number): void;
  stopStatusPolling(): void;
  destroy(): void;
}

interface PopupDeps {
  dom: PopupElements;
  runtime: RuntimeAdapter;
  timers?: { setInterval(handler: () => void, ms: number): unknown; clearInterval(id: unknown): void };
}

export function initPopup(deps: PopupDeps): PopupController {
  const { dom, runtime, timers } = deps;
  const timersApi = timers ?? {
    setInterval: (handler: () => void, ms: number) => setInterval(handler, ms),
    clearInterval: (id: unknown) => clearInterval(id as Parameters<typeof clearInterval>[0]),
  };
  // Generic arrows confuse some bundler parsers in .ts files; use functions.
  function getConsentEl(id: string) { return dom.byId<ToggleEl>(id); }
  function getButtonEl(id: string) { return dom.byId<ButtonEl>(id); }
  function getTextEl(id: string) { return dom.byId<TextEl>(id); }

  const refresh = async () => {
    const status = (await runtime.sendMessage({ type: MSG.STATUS })) as {
      active?: boolean;
      sessionId?: string | null;
      consentGranted?: boolean;
    } | undefined;
    const statusEl = getTextEl('status');
    if (statusEl) statusEl.textContent = status?.active ? `active (${status.sessionId})` : 'inactive';
    const consentEl = getConsentEl('consent-toggle');
    if (consentEl) consentEl.checked = !!status?.consentGranted;
  };

  const consentToggle = getConsentEl('consent-toggle');
  if (consentToggle) {
    consentToggle.addEventListener('change', (event) => {
      void runtime.sendMessage({ type: MSG.CONSENT, granted: event.target.checked } satisfies ExtensionMessage).then(() => refresh());
    });
  }

  const startButton = getButtonEl('start-button');
  if (startButton) {
    startButton.addEventListener('click', () => {
      void runtime.sendMessage({ type: MSG.START }).then(() => refresh());
    });
  }
  const stopButton = getButtonEl('stop-button');
  if (stopButton) {
    stopButton.addEventListener('click', () => {
      void runtime.sendMessage({ type: MSG.STOP }).then(() => refresh());
    });
  }

  void refresh();

  let intervalId: unknown;
  return {
    refresh,
    startStatusPolling(intervalMs: number) {
      intervalId = timersApi.setInterval(() => void refresh(), intervalMs);
    },
    stopStatusPolling() {
      if (intervalId !== undefined) {
        timersApi.clearInterval(intervalId);
        intervalId = undefined;
      }
    },
    destroy() {
      if (intervalId !== undefined) timersApi.clearInterval(intervalId);
    },
  };
}

export function startStatusPolling(runtime: RuntimeAdapter, deps: PopupDeps): PopupController {
  const controller = initPopup({ ...deps, runtime });
  controller.startStatusPolling(2_000);
  return controller;
}

// Real boot: only when `chrome` exists; the popup is loaded by the browser.

declare const chrome: unknown;

if (inChromeExtension() && typeof document !== 'undefined') {
  const controller = initPopup({
    dom: { byId: (id) => document.getElementById(id) },
    runtime: createChromeRuntime(),
  });
  controller.startStatusPolling(2_000);
}

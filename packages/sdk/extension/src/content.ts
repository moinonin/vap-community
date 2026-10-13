/**
 * Content-script entry: the page observer host.
 *
 * The content script runs in the page's DOM (not a service worker), so we
 * create a real DomAdapter and let browser-sdk observers emit observations.
 * The sink forwards each observation to the background service worker, which
 * owns session/queue/consent.
 */

import {
  createDefaultAdapter,
  FocusObserver,
  InteractionObserver,
  VisibilityObserver,
  type DomAdapter,
  type ObservationSink,
} from '@verified-attention/browser-sdk';
import { MSG } from './messages';
import type { RuntimeAdapter } from './runtime';
import { createChromeRuntime, inChromeExtension } from './runtime';

export interface ContentScriptDeps {
  runtime: RuntimeAdapter;
  adapter?: DomAdapter;
  contentElement?: unknown;
}

export interface ContentScript {
  start(): void;
  stop(): void;
}

/**
 * Observers -> sink that messages the background. Consent is handled by the
 * background (it will only accept observations when a session is active).
 */
export function createContentScript(deps: ContentScriptDeps): ContentScript {
  const adapter = deps.adapter ?? createDefaultAdapter();
  const sink: ObservationSink = {
    emit(signalType, payload) {
      const message = { type: MSG.OBSERVATION, signalType, payload };
      void deps.runtime.sendMessage(message).catch(() => {
        // Drop gracefully if the background is asleep (MV3 service workers can be suspended).
      });
    },
  };
  const observers = [
    new VisibilityObserver(adapter, deps.contentElement),
    new InteractionObserver(adapter),
    new FocusObserver(adapter),
  ];
  return {
    start() {
      for (const observer of observers) observer.start(sink);
    },
    stop() {
      for (const observer of observers) observer.stop();
    },
  };
}

// Guarded boot: tsdown entry point for the content script. In tests, `chrome`
// is undefined; hosts call createContentScript() themselves.

if (inChromeExtension() && typeof document !== 'undefined') {
  const content = createContentScript({ runtime: createChromeRuntime() });
  content.start();
}

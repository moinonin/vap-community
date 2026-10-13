/**
 * Message protocol between the content script / popup and the background
 * service worker. Content scripts never touch sessions or the network:
 * they forward raw observations; the popup toggles consent and reads status.
 */

import type { SignalTypeName } from '@verified-attention/browser-sdk';

export const MSG = {
  START: 'vap:start',
  STOP: 'vap:stop',
  STATUS: 'vap:status',
  CONSENT: 'vap:consent',
  OBSERVATION: 'vap:observation',
} as const;

export interface StartMessage {
  type: typeof MSG.START;
}
export interface StopMessage {
  type: typeof MSG.STOP;
}
export interface StatusMessage {
  type: typeof MSG.STATUS;
}
export interface ConsentMessage {
  type: typeof MSG.CONSENT;
  granted: boolean;
}
export interface ObservationMessage {
  type: typeof MSG.OBSERVATION;
  signalType: SignalTypeName;
  payload: unknown;
}

export type ExtensionMessage =
  | StartMessage
  | StopMessage
  | StatusMessage
  | ConsentMessage
  | ObservationMessage;

/** Narrow an unknown runtime message to our protocol. */
export function isExtensionMessage(value: unknown): value is ExtensionMessage {
  if (!value || typeof value !== 'object') return false;
  const type = (value as { type?: unknown }).type;
  return typeof type === 'string' && Object.values(MSG).includes(type as (typeof MSG)[keyof typeof MSG]);
}

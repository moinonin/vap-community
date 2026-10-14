/**
 * Base interfaces and types for Omni-Channel Social & Brand Space Platform Adapters.
 * Conforms to SPEC-0020 and VAP Core Layer 2.
 */

export interface MediaTelemetry {
  playDurationMs?: number;
  audioActive?: boolean;
  playbackRate?: number;
  completionPercentage?: number;
}

export interface ExternalObservationPayload {
  platform: string;
  archetype: 'feed' | 'video' | 'article';
  contentUri: string;
  organizationId?: string;
  dwellTimeMs: number;
  activeFocusRatio: number; // 0.0 to 1.0 (tab active + window focused)
  interactionEntropy: number; // 0.0 to 1.0 micro-movement entropy
  viewportCoverageRatio: number; // 0.0 to 1.0
  readingVelocityWpm?: number;
  mediaTelemetry?: MediaTelemetry;
  clientSignature?: string;
  timestamp: string;
}

export type ObservationCallback = (payload: ExternalObservationPayload) => void;

export interface PlatformProfile {
  id: string;
  domains: (string | RegExp)[];
  archetype: 'feed' | 'video' | 'article';
  containerSelector: string;
  textSelector?: string;
  mediaSelector?: string;
  extractContentUrn: (el: Element, url: URL) => string;
}

export interface PlatformAdapter {
  readonly id: string;
  readonly profile: PlatformProfile;
  match(url: URL): boolean;
  attach(): Promise<void> | void;
  detach(): void;
  onObservation(callback: ObservationCallback): void;
}

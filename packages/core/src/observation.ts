/**
 * Observation types and schemas (VAP Section 4)
 * 
 * Observations are raw signals from the interaction environment.
 * They are uninterpreted - they do not carry semantic meaning.
 * Meaning is derived later through evidence processing.
 */

import { z } from 'zod';
import { 
  TimestampSchema, 
  UUIDSchema, 
  SessionIdSchema, 
  ContentIdSchema, 
  SourceIdSchema,
  SignalTypeSchema
} from './common';
import { randomUUID } from 'crypto';

/**
 * Raw observation payload - varies by signal type
 */
export const ScrollPayloadSchema = z.object({
  deltaX: z.number(),
  deltaY: z.number(),
  positionX: z.number(),
  positionY: z.number(),
  maxScrollX: z.number().optional(),
  maxScrollY: z.number().optional()
});

export const ClickPayloadSchema = z.object({
  elementSelector: z.string().optional(),
  elementTag: z.string().optional(),
  clientX: z.number(),
  clientY: z.number(),
  screenX: z.number().optional(),
  screenY: z.number().optional(),
  button: z.number().optional()
});

export const KeyPressPayloadSchema = z.object({
  key: z.string(),
  code: z.string().optional(),
  location: z.number().optional(),
  repeat: z.boolean().optional(),
  isPrintable: z.boolean().optional()
});

export const ViewportVisibilityPayloadSchema = z.object({
  visibilityRatio: z.number().min(0).max(1),
  visibleArea: z.number().optional(),
  totalArea: z.number().optional(),
  boundingRect: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number()
  }).optional()
});

export const FocusPayloadSchema = z.object({
  elementSelector: z.string().optional(),
  elementTag: z.string().optional(),
  focusType: z.enum(['focus', 'blur', 'focusin', 'focusout']).optional()
});

export const DeviceMotionPayloadSchema = z.object({
  accelerationX: z.number().optional(),
  accelerationY: z.number().optional(),
  accelerationZ: z.number().optional(),
  rotationAlpha: z.number().optional(),
  rotationBeta: z.number().optional(),
  rotationGamma: z.number().optional()
});

export const PageResizePayloadSchema = z.object({
  width: z.number(),
  height: z.number(),
  devicePixelRatio: z.number().optional()
});

export const CustomPayloadSchema = z.record(z.unknown());

/**
 * Union of all known observation payloads
 */
export const ObservationPayloadSchema = z.discriminatedUnion('signalType', [
  z.object({ signalType: z.literal('SCROLL'), payload: ScrollPayloadSchema }),
  z.object({ signalType: z.literal('CLICK'), payload: ClickPayloadSchema }),
  z.object({ signalType: z.literal('KEY_PRESS'), payload: KeyPressPayloadSchema }),
  z.object({ signalType: z.literal('VIEWPORT_VISIBILITY'), payload: ViewportVisibilityPayloadSchema }),
  z.object({ signalType: z.literal('FOCUS'), payload: FocusPayloadSchema }),
  z.object({ signalType: z.literal('DEVICE_MOTION'), payload: DeviceMotionPayloadSchema }),
  z.object({ signalType: z.literal('PAGE_RESIZE'), payload: PageResizePayloadSchema }),
  z.object({ signalType: z.literal('CUSTOM'), payload: CustomPayloadSchema })
]);

export type ObservationPayload = z.infer<typeof ObservationPayloadSchema>;

/**
 * Observation metadata (required for all observations)
 * VAP Section 4: MUST capture observation_id, source, timestamp, signal_type, payload
 */
export const ObservationMetaSchema = z.object({
  observationId: UUIDSchema,
  sourceId: SourceIdSchema,
  sessionId: SessionIdSchema,
  contentId: ContentIdSchema,
  timestamp: TimestampSchema,
  signalType: SignalTypeSchema,
  // Optional fields MAY include:
  reliabilityWeight: z.number().min(0).max(1).optional(),
  deviceTrust: z.number().min(0).max(1).optional(),
  // Platform-specific context
  platform: z.enum(['browser', 'mobile', 'desktop', 'server']).optional(),
  userAgentHash: z.string().optional(),
  viewportSize: z.object({ width: z.number(), height: z.number() }).optional()
});

export type ObservationMeta = z.infer<typeof ObservationMetaSchema>;

/**
 * Complete observation object
 */
export const ObservationSchema = ObservationMetaSchema.extend({
  payload: z.union([
    ScrollPayloadSchema,
    ClickPayloadSchema,
    KeyPressPayloadSchema,
    ViewportVisibilityPayloadSchema,
    FocusPayloadSchema,
    DeviceMotionPayloadSchema,
    PageResizePayloadSchema,
    CustomPayloadSchema
  ])
});

export type Observation = z.infer<typeof ObservationSchema>;

/**
 * Observation lifecycle states (VAP Section 4)
 */
export enum ObservationState {
  CAPTURED = 'captured',
  VERIFIED = 'verified',
  ATTRIBUTED = 'attributed',
  EMBEDDABLE = 'embeddable'
}

export const ObservationStateSchema = z.nativeEnum(ObservationState);

/**
 * Observation with lifecycle state
 */
export const ObservationWithStateSchema = ObservationSchema.extend({
  state: ObservationStateSchema,
  validatedAt: TimestampSchema.optional(),
  attributedAt: TimestampSchema.optional()
});

export type ObservationWithState = z.infer<typeof ObservationWithStateSchema>;

/**
 * Create a new observation with generated ID and timestamp
 */
export function createObservation(
  params: Omit<Observation, 'observationId' | 'timestamp'> & { timestamp?: string }
): Observation {
  return {
    ...params,
    observationId: randomUUID(),
    timestamp: params.timestamp ?? new Date().toISOString()
  } as Observation;
}

/**
 * Normalize observation from platform-specific format to canonical VAP format
 * Implementations MUST define this mapping for each platform
 */
export function normalizeObservation(
  platformObservation: unknown,
  platform: 'browser' | 'mobile' | 'desktop' | 'server'
): Observation {
  // Platform-specific normalization logic
  // This is a stub - actual implementation in pipeline/normalization
  throw new Error('normalizeObservation must be implemented per platform');
}

/**
 * Observation batch for efficient transport
 */
export const ObservationBatchSchema = z.object({
  batchId: UUIDSchema,
  sessionId: SessionIdSchema,
  sourceId: SourceIdSchema,
  observations: z.array(ObservationSchema),
  sentAt: TimestampSchema
});

export type ObservationBatch = z.infer<typeof ObservationBatchSchema>;
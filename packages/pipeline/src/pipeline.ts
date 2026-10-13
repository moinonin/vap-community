/**
 * Pipeline integration — wires validation → normalization → store
 *
 * Provides a Pipeline class that accepts raw evidence, validates it,
 * optionally normalizes platform observations, and persists to the store.
 */

import {
  validateEvidence,
  validateAgainstSession,
  InMemoryReplayCache,
  type TimestampConstraints,
  type ValidationResult,
  type ReplayCache,
} from './validation';
import {
  normalizeTimestamp,
  aggregateInteractionEvidence,
  aggregateVisibilityEvidence,
  meetsMinimumSpan,
} from './normalization';

/**
 * Pipeline stage interfaces
 */
export interface Stage<TIn, TOut extends { ok: boolean }> {
  name: string;
  process(input: TIn, ctx: PipelineContext): Promise<TOut>;
}

export interface PipelineContext {
  sessionId: string;
  sessionState: string;
  replayCache: ReplayCache;
  timestampConstraints?: Partial<TimestampConstraints>;
}

export type StageResult<T> = 
  | { ok: true; value: T }
  | { ok: false; errors: Array<{ code: string; message: string }> };

/**
 * Validation stage: schema + timestamp + session binding + replay protection
 */
export class ValidationStage implements Stage<unknown, StageResult<any>> {
  readonly name = 'ValidationStage';

  async process(input: unknown, ctx: PipelineContext): Promise<StageResult<any>> {
    // Replay check
    const evidenceId = (input as any)?.evidenceId;
    if (evidenceId && await ctx.replayCache.has(evidenceId)) {
      return { ok: false, errors: [{ code: 'DUPLICATE_EVIDENCE', message: `Duplicate evidence: ${evidenceId}` }] };
    }

    // Schema + timestamp validation
    const result = validateEvidence(input, ctx.timestampConstraints);
    if (!result.valid) {
      return { ok: false, errors: result.errors || [] };
    }

    // Session binding
    const sessionResult = validateAgainstSession(result as any, ctx.sessionState);
    if (!sessionResult.valid) {
      return { ok: false, errors: sessionResult.errors };
    }

    // Mark as seen
    if (evidenceId) await ctx.replayCache.add(evidenceId);

    return { ok: true, value: input };
  }
}

/**
 * Normalization stage: platform-specific → canonical (pass-through for already canonical)
 */
export class NormalizationStage implements Stage<StageResult<any>, StageResult<any>> {
  readonly name = 'NormalizationStage';

  async process(input: StageResult<any>, _ctx: PipelineContext): Promise<StageResult<any>> {
    if (!input.ok) return input;
    
    const evidence = input.value;
    // Normalize timestamp if numeric (create new object to avoid mutation)
    const normalizedEvidence = typeof evidence.timestamp === 'number'
      ? { ...evidence, timestamp: normalizeTimestamp(evidence.timestamp) }
      : evidence;
    return { ok: true, value: normalizedEvidence };
  }
}

/**
 * Store stage: persist to append-only store
 */
export class StoreStage implements Stage<StageResult<any>, StageResult<boolean>> {
  readonly name = 'StoreStage';

  constructor(private store: { append(e: any): Promise<void> }) {}

  async process(input: StageResult<any>, _ctx: PipelineContext): Promise<StageResult<boolean>> {
    if (!input.ok) return input;
    
    try {
      await this.store.append(input.value);
      return { ok: true, value: true };
    } catch (err: any) {
      return { ok: false, errors: [{ code: 'STORE_ERROR', message: err.message }] };
    }
  }
}

/**
 * Full pipeline: validation → normalization → store
 */
export class Pipeline {
  private readonly validation = new ValidationStage();
  private readonly normalization = new NormalizationStage();
  private storeStage: StoreStage | null = null;

  constructor(
    private readonly replayCache: ReplayCache = new InMemoryReplayCache(),
    private readonly timestampConstraints?: Partial<TimestampConstraints>,
  ) {}

  attachStore(store: { append(e: any): Promise<void> }): this {
    this.storeStage = new StoreStage(store);
    return this;
  }

  async run(
    input: unknown,
    ctx: Pick<PipelineContext, 'sessionId' | 'sessionState'>,
  ): Promise<PipelineResult> {
    const fullCtx: PipelineContext = {
      ...ctx,
      replayCache: this.replayCache,
      timestampConstraints: this.timestampConstraints,
    };

    // Stage 1: validation
    const vResult = await this.validation.process(input, fullCtx);
    if (!vResult.ok) {
      return { stage: 'validation', ok: false, errors: vResult.errors };
    }

    // Stage 2: normalization
    const nResult = await this.normalization.process(vResult, fullCtx);
    if (!nResult.ok) {
      return { stage: 'normalization', ok: false, errors: nResult.errors };
    }

    // Stage 3: store (optional)
    if (this.storeStage) {
      const sResult = await this.storeStage.process(nResult, fullCtx);
      if (!sResult.ok) {
        return { stage: 'store', ok: false, errors: sResult.errors };
      }
      return { stage: 'store', ok: true, evidenceId: (input as any).evidenceId };
    }

    return { stage: 'normalization', ok: true, evidenceId: (input as any).evidenceId };
  }
}

export interface PipelineResult {
  stage: 'validation' | 'normalization' | 'store';
  ok: boolean;
  errors?: any[];
  evidenceId?: string;
}

/**
 * Helpers re-exported for convenience
 */
export { aggregateInteractionEvidence, aggregateVisibilityEvidence, meetsMinimumSpan };

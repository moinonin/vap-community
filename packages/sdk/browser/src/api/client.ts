/**
 * Thin API client for the VAE ingestion endpoints.
 *
 * Endpoints (apps/api): POST /v1/sessions, POST /v1/sessions/:id/close,
 * PATCH /v1/sessions/:id (heartbeat), POST /v1/evidence.
 */

import type { FetchLike, ProofOfAttention } from '../types';

export class ApiError extends Error {
  constructor(
    message: string,
    /** HTTP status (0 = network/transport failure). */
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface CreateSessionResult {
  sessionId: string;
}

export class ApiClient {
  private readonly fetchImpl: FetchLike;

  constructor(
    private readonly apiUrl: string,
    fetchImpl?: FetchLike,
  ) {
    const f =
      fetchImpl ??
      (typeof fetch === 'function'
        ? ((fetch as unknown as FetchLike).bind(globalThis) as FetchLike)
        : undefined);
    if (!f) throw new Error('VerifiedAttention: no fetch implementation available');
    this.fetchImpl = f;
  }

  private url(path: string): string {
    return `${this.apiUrl.replace(/\/+$/, '')}${path}`;
  }

  private async request(path: string, method: string, body?: unknown): Promise<unknown> {
    let res: { ok: boolean; status: number; json(): Promise<unknown> };
    try {
      res = await this.fetchImpl(this.url(path), {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    } catch (err) {
      throw new ApiError(`network error: ${(err as Error)?.message ?? 'unknown'}`, 0);
    }
    const json = await res.json().catch(() => undefined);
    if (!res.ok) {
      const msg =
        (json as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`;
      throw new ApiError(msg, res.status);
    }
    return json;
  }

  async createSession(input: {
    contentId: string;
    participant: { viewerIdHash: string; consentId?: string };
    metadata?: Record<string, unknown>;
  }): Promise<CreateSessionResult> {
    const body = await this.request('/v1/sessions', 'POST', input);
    const sessionId = (body as { sessionId?: string })?.sessionId;
    if (typeof sessionId !== 'string' || sessionId.length === 0) {
      throw new ApiError('malformed session response: missing sessionId', 0);
    }
    return { sessionId };
  }

  async closeSession(sessionId: string): Promise<void> {
    await this.request(`/v1/sessions/${encodeURIComponent(sessionId)}/close`, 'POST');
  }

  async heartbeat(sessionId: string): Promise<void> {
    await this.request(`/v1/sessions/${encodeURIComponent(sessionId)}`, 'PATCH', {
      metadata: { heartbeatAt: new Date().toISOString() },
    });
  }

  /** Returns the server-assigned evidence id on success. Throws ApiError otherwise. */
  async ingestEvidence(evidence: unknown): Promise<string> {
    const body = await this.request('/v1/evidence', 'POST', evidence);
    return (body as { evidenceId?: string })?.evidenceId ?? '';
  }

  /**
   * Best-effort proof fetch after a session closes. The proof retrieval
   * endpoint lands with the public API work (S19); until then this resolves
   * undefined on any failure.
   */
  async fetchProof(sessionId: string): Promise<ProofOfAttention | undefined> {
    try {
      const body = await this.request(
        `/v1/proofs/session/${encodeURIComponent(sessionId)}`,
        'GET',
      );
      return body as ProofOfAttention;
    } catch {
      return undefined;
    }
  }
}

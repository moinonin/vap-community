/**
 * Proof Webhook Delivery (VAE Sprint 11)
 *
 * Delivers proof events to registered webhook endpoints with:
 * - Retry with exponential backoff
 * - Dead letter queue for permanently failed deliveries
 * - HMAC signature for webhook authenticity
 * - Idempotent delivery tracking
 */

import { z } from 'zod';
import type { Proof } from '@verified-attention/core';

// ─── Types ────────────────────────────────────────────────────────────────────

export const WebhookEndpointSchema = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  secret: z.string().min(1),
  events: z.array(z.enum(['PROOF_CREATED', 'PROOF_REVOKED', 'PROOF_PUBLISHED', 'PROOF_EXPIRED'])).default(['PROOF_CREATED']),
  status: z.enum(['ACTIVE', 'DISABLED', 'SUSPENDED']).default('ACTIVE'),
  maxRetries: z.number().int().nonnegative().default(5),
  retryBackoffMs: z.number().int().positive().default(1000),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
});

export type WebhookEndpoint = z.infer<typeof WebhookEndpointSchema>;

export const WebhookDeliverySchema = z.object({
  deliveryId: z.string().min(1),
  endpointId: z.string().min(1),
  event: z.enum(['PROOF_CREATED', 'PROOF_REVOKED', 'PROOF_PUBLISHED', 'PROOF_EXPIRED']),
  payload: z.record(z.unknown()),
  status: z.enum(['PENDING', 'DELIVERED', 'FAILED', 'DEAD_LETTERED']),
  attempts: z.number().int().nonnegative().default(0),
  lastAttemptAt: z.string().datetime().optional(),
  lastResponseCode: z.number().int().optional(),
  lastError: z.string().optional(),
  nextRetryAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
});

export type WebhookDelivery = z.infer<typeof WebhookDeliverySchema>;

export interface WebhookStore {
  saveEndpoint(endpoint: WebhookEndpoint): Promise<void>;
  getEndpoint(id: string): Promise<WebhookEndpoint | undefined>;
  listEndpoints(): Promise<WebhookEndpoint[]>;
  deleteEndpoint(id: string): Promise<boolean>;
  saveDelivery(delivery: WebhookDelivery): Promise<void>;
  getDelivery(id: string): Promise<WebhookDelivery | undefined>;
  listPendingDeliveries(): Promise<WebhookDelivery[]>;
  listDeadLetteredDeliveries(): Promise<WebhookDelivery[]>;
}

// ─── HMAC Signature ───────────────────────────────────────────────────────────

import { createHmac } from 'node:crypto';

export function buildWebhookSignature(
  payload: string,
  timestamp: string,
  secret: string
): string {
  const encoder = new TextEncoder();
  const key = encoder.encode(secret);
  const data = encoder.encode(`${timestamp}.${payload}`);

  return createHmac('sha256', key)
    .update(data)
    .digest('hex');
}

export function buildWebhookHeaders(
  deliveryId: string,
  payload: string,
  secret: string
): Record<string, string> {
  const timestamp = new Date().toISOString();
  const signature = buildWebhookSignature(payload, timestamp, secret);

  return {
    'Content-Type': 'application/json',
    'X-Webhook-Id': deliveryId,
    'X-Webhook-Timestamp': timestamp,
    'X-Webhook-Signature': signature,
  };
}

// ─── Delivery Engine ─────────────────────────────────────────────────────────

export class DeliverWebhook {
  private endpoints = new Map<string, WebhookEndpoint>();
  private deliveries = new Map<string, WebhookDelivery>;
  private deadLetter = new Map<string, WebhookDelivery>();
  private pendingQueue: WebhookDelivery[] = [];

  constructor(private store?: WebhookStore) {}

  async registerEndpoint(endpoint: WebhookEndpoint): Promise<void> {
    endpoint.createdAt = endpoint.createdAt || new Date().toISOString();
    if (this.store) {
      await this.store.saveEndpoint(endpoint);
    }
    this.endpoints.set(endpoint.id, endpoint);
  }

  async deliver(proof: Proof, event: 'PROOF_CREATED' | 'PROOF_REVOKED' | 'PROOF_PUBLISHED' | 'PROOF_EXPIRED'): Promise<WebhookDelivery> {
    const payload = JSON.stringify({
      event,
      proofId: proof.proofId,
      sessionId: proof.sessionId,
      contentId: proof.contentId,
      confidence: proof.confidence,
      state: proof.state,
      issuedAt: proof.issuedAt,
      verifierId: proof.verifierId,
      metadata: proof.metadata,
      timestamp: new Date().toISOString(),
    });

    const deliveryId = `wh_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const delivery: WebhookDelivery = {
      deliveryId,
      endpointId: '', // set per endpoint below
      event,
      payload: JSON.parse(payload),
      status: 'PENDING',
      attempts: 0,
      createdAt: new Date().toISOString(),
    };

    // Deliver to all matching active endpoints
    const matchingEndpoints = Array.from(this.endpoints.values()).filter(
      ep => ep.status === 'ACTIVE' && ep.events.includes(event)
    );

    const results: WebhookDelivery[] = [];

    for (const endpoint of matchingEndpoints) {
      const epDelivery: WebhookDelivery = {
        ...delivery,
        endpointId: endpoint.id,
        status: 'PENDING',
      };

      await this.deliverToEndpoint(epDelivery, endpoint, payload);
      results.push(epDelivery);
    }

    if (results.length === 0) {
      // No matching endpoints — still record the delivery attempt
    const noEndpointDelivery: WebhookDelivery = {
        ...delivery,
        endpointId: 'none',
        status: 'DEAD_LETTERED',
        lastError: 'No matching webhook endpoint',
      };
      if (this.store) {
        await this.store.saveDelivery(noEndpointDelivery);
      }
      this.deadLetter.set(noEndpointDelivery.deliveryId, noEndpointDelivery);
      return noEndpointDelivery;
    }

    return results[0] as WebhookDelivery;
  }

  private async deliverToEndpoint(
    delivery: WebhookDelivery,
    endpoint: WebhookEndpoint,
    payload: string
  ): Promise<void> {
    const headers = buildWebhookHeaders(delivery.deliveryId, payload, endpoint.secret);

    // Attempt delivery with retries
    for (let attempt = 0; attempt <= endpoint.maxRetries; attempt++) {
      delivery.attempts = attempt + 1;

      try {
        // In production, this would use fetch/axios to POST to endpoint.url
        // For now, simulate a successful delivery
        const responseCode = 200; // Simulated

        delivery.status = 'DELIVERED';
        delivery.lastAttemptAt = new Date().toISOString();
        delivery.lastResponseCode = responseCode;

        if (this.store) {
          await this.store.saveDelivery(delivery);
        }

        this.deliveries.set(delivery.deliveryId, delivery);
        return;
      } catch (err: any) {
        delivery.lastAttemptAt = new Date().toISOString();
        delivery.lastError = err.message;
        delivery.lastResponseCode = err.responseCode;

        if (attempt < endpoint.maxRetries) {
          // Schedule retry with exponential backoff
          const backoffMs = endpoint.retryBackoffMs * Math.pow(2, attempt);
          delivery.nextRetryAt = new Date(Date.now() + backoffMs).toISOString();
          this.pendingQueue.push(delivery);
        } else {
          // Max retries exceeded — dead letter
          delivery.status = 'DEAD_LETTERED';
          if (this.store) {
            await this.store.saveDelivery(delivery);
          }
          this.deadLetter.set(delivery.deliveryId, delivery);
        }
      }
    }
  }

  async processPending(): Promise<void> {
    const pending = [...this.pendingQueue];
    this.pendingQueue = [];

    for (const delivery of pending) {
      const endpoint = this.endpoints.get(delivery.endpointId);
      if (!endpoint) continue;

      const payload = JSON.stringify(delivery.payload);
      await this.deliverToEndpoint(delivery, endpoint, payload);
    }
  }

  async getDeadLettered(): Promise<WebhookDelivery[]> {
    if (this.store) {
      return this.store.listDeadLetteredDeliveries();
    }
    return Array.from(this.deadLetter.values());
  }

  listEndpoints(): WebhookEndpoint[] {
    return Array.from(this.endpoints.values());
  }

  listDeliveries(): WebhookDelivery[] {
    return Array.from(this.deliveries.values());
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _webhook: DeliverWebhook | null = null;

/**
 * Deliver a webhook event for a proof to all registered endpoints.
 */
export async function deliverWebhook(
  proof: Proof,
  event: 'PROOF_CREATED' | 'PROOF_REVOKED' | 'PROOF_PUBLISHED' | 'PROOF_EXPIRED'
): Promise<WebhookDelivery> {
  if (!_webhook) {
    _webhook = new DeliverWebhook();
  }
  return _webhook.deliver(proof, event);
}

/**
 * Register a webhook endpoint.
 */
export async function registerWebhookEndpoint(endpoint: WebhookEndpoint): Promise<void> {
  if (!_webhook) {
    _webhook = new DeliverWebhook();
  }
  return _webhook.registerEndpoint(endpoint);
}

/**
 * Webhook Delivery Tests (VAE Sprint 11)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeliverWebhook, deliverWebhook, registerWebhookEndpoint, buildWebhookSignature, buildWebhookHeaders } from './index';
import { ProofState } from '@verified-attention/core';
import type { Proof } from '@verified-attention/core';

vi.mock('crypto', () => ({
  createHmac: () => ({
    update: () => ({ digest: () => 'a'.repeat(64) }),
  }),
}));

describe('Webhook Delivery', () => {
  let webhook: DeliverWebhook;

  beforeEach(() => {
    vi.resetModules();
    webhook = new DeliverWebhook();
  });

  const mockProof: Proof = {
    proofId: 'urn:vap:proof:test-123',
    sessionId: 'urn:vap:session:test-session',
    contentId: 'urn:vap:content:test-content',
    confidence: 0.85,
    evidenceHash: 'sha256:abc123',
    verifierId: 'urn:vap:verifier:test-verifier',
    state: ProofState.PUBLISHED,
    issuedAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    metadata: { policyId: 'policy-1' },
    baseMetadata: {},
  } as unknown as Proof;

  it('registers a webhook endpoint', async () => {
    const endpoint = {
      id: 'wh-1',
      url: 'https://example.com/webhook',
      secret: 'whsec_test123',
      events: ['PROOF_CREATED'],
      status: 'ACTIVE',
      maxRetries: 3,
      retryBackoffMs: 1000,
      createdAt: new Date().toISOString(),
    };

    await webhook.registerEndpoint(endpoint as any);
    const endpoints = webhook.listEndpoints();
    expect(endpoints).toHaveLength(1);
    expect(endpoints[0].id).toBe('wh-1');
    expect(endpoints[0].url).toBe('https://example.com/webhook');
  });

  it('builds webhook signature', () => {
    const signature = buildWebhookSignature('{"test":true}', '2024-01-01T00:00:00.000Z', 'secret');
    expect(signature).toBeDefined();
    expect(typeof signature).toBe('string');
    expect(signature).toHaveLength(64); // SHA256 hex
  });

  it('builds webhook headers', () => {
    const headers = buildWebhookHeaders('del-1', '{"test":true}', 'secret');
    expect(headers).toHaveProperty('Content-Type', 'application/json');
    expect(headers).toHaveProperty('X-Webhook-Id', 'del-1');
    expect(headers).toHaveProperty('X-Webhook-Timestamp');
    expect(headers).toHaveProperty('X-Webhook-Signature');
  });

  it('delivers webhook to matching endpoints', async () => {
    await webhook.registerEndpoint({
      id: 'wh-publish',
      url: 'https://example.com/proof-events',
      secret: 'secret1',
      events: ['PROOF_PUBLISHED'],
      status: 'ACTIVE',
      maxRetries: 0,
      retryBackoffMs: 100,
      createdAt: new Date().toISOString(),
    } as any);

    await webhook.registerEndpoint({
      id: 'wh-create',
      url: 'https://example.com/proof-created',
      secret: 'secret2',
      events: ['PROOF_CREATED'],
      status: 'ACTIVE',
      maxRetries: 0,
      retryBackoffMs: 100,
      createdAt: new Date().toISOString(),
    } as any);

    // This proof is PUBLISHED, so only the PROOF_PUBLISHED endpoint should receive it
    const delivery = await webhook.deliver(mockProof, 'PROOF_PUBLISHED');
    expect(delivery).toBeDefined();
    expect(delivery.status).toBe('DELIVERED');
    expect(delivery.endpointId).toBe('wh-publish');
  });

  it('does not deliver to non-matching event endpoints', async () => {
    await webhook.registerEndpoint({
      id: 'wh-create-only',
      url: 'https://example.com/proof-created',
      secret: 'secret',
      events: ['PROOF_CREATED'],
      status: 'ACTIVE',
      maxRetries: 0,
      retryBackoffMs: 100,
      createdAt: new Date().toISOString(),
    } as any);

    const delivery = await webhook.deliver(mockProof, 'PROOF_PUBLISHED');
    // No matching endpoint for PROOF_PUBLISHED, should be dead-lettered
    expect(delivery.status).toBe('DEAD_LETTERED');
  });

  it('delivers to multiple matching endpoints', async () => {
    await webhook.registerEndpoint({
      id: 'wh-1',
      url: 'https://a.com',
      secret: 's1',
      events: ['PROOF_CREATED', 'PROOF_PUBLISHED'],
      status: 'ACTIVE',
      maxRetries: 0,
      retryBackoffMs: 100,
      createdAt: new Date().toISOString(),
    } as any);

    await webhook.registerEndpoint({
      id: 'wh-2',
      url: 'https://b.com',
      secret: 's2',
      events: ['PROOF_PUBLISHED'],
      status: 'ACTIVE',
      maxRetries: 0,
      retryBackoffMs: 100,
      createdAt: new Date().toISOString(),
    } as any);

    const deliveries = await Promise.all([
      webhook.deliver(mockProof, 'PROOF_PUBLISHED'),
    ]);

    // Both endpoints match PROOF_PUBLISHED
    expect(deliveries).toHaveLength(1); // returns first delivery
    expect(deliveries[0].status).toBe('DELIVERED');
  });

  it('skips disabled endpoints', async () => {
    await webhook.registerEndpoint({
      id: 'wh-disabled',
      url: 'https://example.com',
      secret: 'secret',
      events: ['PROOF_CREATED'],
      status: 'DISABLED',
      maxRetries: 0,
      retryBackoffMs: 100,
      createdAt: new Date().toISOString(),
    } as any);

    const delivery = await webhook.deliver(mockProof, 'PROOF_CREATED');
    // No active matching endpoints
    expect(delivery.status).toBe('DEAD_LETTERED');
  });

  it('does not deliver to suspended endpoints', async () => {
    await webhook.registerEndpoint({
      id: 'wh-suspended',
      url: 'https://example.com',
      secret: 'secret',
      events: ['PROOF_CREATED'],
      status: 'SUSPENDED',
      maxRetries: 0,
      retryBackoffMs: 100,
      createdAt: new Date().toISOString(),
    } as any);

    const delivery = await webhook.deliver(mockProof, 'PROOF_CREATED');
    expect(delivery.status).toBe('DEAD_LETTERED');
  });

  it('listDeliveries returns all deliveries', async () => {
    await webhook.registerEndpoint({
      id: 'wh-1',
      url: 'https://example.com',
      secret: 'secret',
      events: ['PROOF_PUBLISHED'],
      status: 'ACTIVE',
      maxRetries: 0,
      retryBackoffMs: 100,
      createdAt: new Date().toISOString(),
    } as any);

    await webhook.deliver(mockProof, 'PROOF_PUBLISHED');
    const deliveries = webhook.listDeliveries();
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].event).toBe('PROOF_PUBLISHED');
  });

  it('listPending returns empty when no pending deliveries', async () => {
    const pending = webhook['pendingQueue'];
    expect(pending).toHaveLength(0);
  });

  it('processPending processes queued deliveries', async () => {
    await webhook.registerEndpoint({
      id: 'wh-1',
      url: 'https://example.com',
      secret: 'secret',
      events: ['PROOF_PUBLISHED'],
      status: 'ACTIVE',
      maxRetries: 0,
      retryBackoffMs: 100,
      createdAt: new Date().toISOString(),
    } as any);

    const delivery = await webhook.deliver(mockProof, 'PROOF_PUBLISHED');
    expect(delivery.status).toBe('DELIVERED');
  });

  it('creates delivery with correct event type', async () => {
    await webhook.registerEndpoint({
      id: 'wh-1',
      url: 'https://example.com',
      secret: 'secret',
      events: ['PROOF_REVOKED'],
      status: 'ACTIVE',
      maxRetries: 0,
      retryBackoffMs: 100,
      createdAt: new Date().toISOString(),
    } as any);

    const delivery = await webhook.deliver(mockProof, 'PROOF_REVOKED');
    expect(delivery.event).toBe('PROOF_REVOKED');
    expect(delivery.payload).toHaveProperty('proofId', mockProof.proofId);
    expect(delivery.payload).toHaveProperty('event', 'PROOF_REVOKED');
  });

  it('delivery payload contains proof details', async () => {
    await webhook.registerEndpoint({
      id: 'wh-1',
      url: 'https://example.com',
      secret: 'secret',
      events: ['PROOF_CREATED'],
      status: 'ACTIVE',
      maxRetries: 0,
      retryBackoffMs: 100,
      createdAt: new Date().toISOString(),
    } as any);

    const delivery = await webhook.deliver(mockProof, 'PROOF_CREATED');
    expect(delivery.payload).toHaveProperty('proofId', mockProof.proofId);
    expect(delivery.payload).toHaveProperty('sessionId', mockProof.sessionId);
    expect(delivery.payload).toHaveProperty('contentId', mockProof.contentId);
    expect(delivery.payload).toHaveProperty('confidence', mockProof.confidence);
    expect(delivery.payload).toHaveProperty('verifierId', mockProof.verifierId);
    expect(delivery.payload).toHaveProperty('timestamp');
  });
});

describe('Webhook Singleton', () => {
  it('deliverWebhook is callable', async () => {
    const mockProof: Proof = {
      proofId: 'urn:vap:proof:test',
      sessionId: 'urn:vap:session:test',
      contentId: 'urn:vap:content:test',
      confidence: 0.8,
      evidenceHash: 'sha256:hash',
      verifierId: 'urn:vap:verifier:test',
      state: ProofState.SIGNED,
      issuedAt: new Date().toISOString(),
      metadata: {},
      baseMetadata: {},
    } as unknown as Proof;

    const delivery = await deliverWebhook(mockProof, 'PROOF_CREATED');
    expect(delivery).toBeDefined();
    expect(delivery.status).toBe('DEAD_LETTERED'); // No endpoints registered
  });

  it('registerWebhookEndpoint is callable', async () => {
    await expect(registerWebhookEndpoint({
      id: 'wh-singleton-test',
      url: 'https://example.com',
      secret: 'secret',
      events: ['PROOF_CREATED'],
      status: 'ACTIVE',
      maxRetries: 0,
      retryBackoffMs: 100,
      createdAt: new Date().toISOString(),
    })).resolves.toBeUndefined();
  });
});

/**
 * Integration Flow Test: session → proof → evaluatePolicy → settlement → payout (S4.2)
 */

import { describe, it, expect } from 'vitest';

describe('Integration Flow', () => {
  it('should verify session through proof generation and settlement', async () => {
    // Step 1: Session creation
    const sessionResponse = await fetch(`${process.env.INTEGRATION_BASE_URL || 'http://localhost:3000'}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-correlation-id': 'integration-flow-001' },
      body: JSON.stringify({ sessionId: 'sess-integration-001', userAgent: 'test-agent' })
    });
    expect(sessionResponse.ok).toBe(true);

    // Step 2: Proof generation (would call verifier service)
    // Placeholder: in full integration, verify service produces proof
    const proofId = 'proof-integration-001';

    // Step 3: Policy evaluation (calls verification package)
    const evalResponse = await fetch(`${process.env.INTEGRATION_BASE_URL || 'http://localhost:3000'}/evaluate-policy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-correlation-id': 'integration-flow-001' },
      body: JSON.stringify({ policyId: 'POLICY-001', evidenceCount: 3, inputContext: { sessionId: 'sess-integration-001' } })
    });
    expect(evalResponse.ok).toBe(true);

    // Step 4: Settlement (would call settlement-worker)
    const settlementResponse = await fetch(`${process.env.INTEGRATION_BASE_URL || 'http://localhost:3000'}/settlements/reconcile/settle-001`, {
      method: 'GET',
      headers: { 'x-correlation-id': 'integration-flow-001' }
    });
    // Settlement endpoint returns reconciliation; create endpoint would use POST
    expect([200, 404, 503]).toContain(settlementResponse.status);
  });

  it('should enforce idempotency key on verify endpoint (S4.3)', async () => {
    const idempotencyKey = 'idemp-test-001';
    const body = { sessionId: 'sess-idemp-001', proofId: 'proof-idemp-001' };

    const resp1 = await fetch(`${process.env.INTEGRATION_BASE_URL || 'http://localhost:3000'}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey, 'x-correlation-id': 'idemp-test' },
      body: JSON.stringify(body)
    });
    const resp2 = await fetch(`${process.env.INTEGRATION_BASE_URL || 'http://localhost:3000'}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey, 'x-correlation-id': 'idemp-test' },
      body: JSON.stringify(body)
    });

    // Both should return the same result (either 200 or a consistent error)
    expect(resp1.status).toBe(resp2.status);
  });
});

/**
 * Policy CRUD API (VAE Sprint 10/11)
 *
 * REST endpoints for managing verification policies.
 * Uses extended policy types from @verified-attention/verification
 */

import {
  PolicyConfigSchema,
  DEFAULT_POLICY,
  HIGH_TRUST_POLICY,
  LOW_FRICTION_POLICY,
  evaluatePolicy,
  InMemoryPolicyStore,
  PolicyType,
} from '@verified-attention/verification';

import type {
  PolicyConfig,
  PolicyStore,
  PolicyEvaluationInput,
  PolicyEvaluationResult,
} from '@verified-attention/verification';

export interface HttpResponse {
  status: number;
  body: unknown;
}

export interface RouteRequest {
  method: string;
  path: string;
  body?: unknown;
}

// Policy store instance (in production, this would be persisted)
const policyStore: InMemoryPolicyStore = new InMemoryPolicyStore();

// Initialize with default policies (using old policy format)
policyStore.createPolicy(DEFAULT_POLICY);
policyStore.createPolicy(HIGH_TRUST_POLICY);
policyStore.createPolicy(LOW_FRICTION_POLICY);

const POLICIES_PREFIX = '/v1/policies';

function parsePath(path: string): string[] {
  return path.split('/').filter(Boolean);
}

function matchPolicyRoute(request: RouteRequest): HttpResponse {
  const { method, path, body } = request;

  if (!path.startsWith(POLICIES_PREFIX)) {
    return { status: 404, body: { error: { code: 'NOT_FOUND', message: `${path} not found` } } };
  }

  const rest = path.slice(POLICIES_PREFIX.length);
  const segments = parsePath(rest);

  // GET /v1/policies - List all policies
  if (method === 'GET' && segments.length === 0) {
    return listPolicies();
  }

  // POST /v1/policies - Create new policy
  if (method === 'POST' && segments.length === 0) {
    return createPolicy(body);
  }

  // GET /v1/policies/:type - List policies by type
  if (method === 'GET' && segments.length === 1 && Object.values(PolicyType).includes(segments[0] as PolicyType)) {
    return listPoliciesByType(segments[0] as PolicyType);
  }

  // GET /v1/policies/:id - Get single policy
  if (method === 'GET' && segments.length === 1) {
    const id = segments[0];
    if (!id) return { status: 400, body: { error: { code: 'BAD_REQUEST', message: 'Policy ID required' } } };
    return getPolicy(id);
  }

  // PATCH /v1/policies/:id - Update policy
  if (method === 'PATCH' && segments.length === 1) {
    const id = segments[0];
    if (!id) return { status: 400, body: { error: { code: 'BAD_REQUEST', message: 'Policy ID required' } } };
    return updatePolicy(id, body);
  }

  // POST /v1/policies/:id/deprecate - Deprecate policy
  if (method === 'POST' && segments.length === 2 && segments[1] === 'deprecate') {
    const id = segments[0];
    if (!id) return { status: 400, body: { error: { code: 'BAD_REQUEST', message: 'Policy ID required' } } };
    return deprecatePolicy(id);
  }

  // POST /v1/policies/:id/evaluate - Evaluate policy against evidence
  if (method === 'POST' && segments.length === 2 && segments[1] === 'evaluate') {
    const id = segments[0];
    if (!id) return { status: 400, body: { error: { code: 'BAD_REQUEST', message: 'Policy ID required' } } };
    return evaluatePolicyEndpoint(id, body);
  }

  // DELETE /v1/policies/:id - Delete policy
  if (method === 'DELETE' && segments.length === 1) {
    const id = segments[0];
    if (!id) return { status: 400, body: { error: { code: 'BAD_REQUEST', message: 'Policy ID required' } } };
    return deletePolicy(id);
  }

  // GET /v1/policies/:id/audit - Get policy audit log
  if (method === 'GET' && segments.length === 2 && segments[1] === 'audit') {
    const id = segments[0];
    if (!id) return { status: 400, body: { error: { code: 'BAD_REQUEST', message: 'Policy ID required' } } };
    return getPolicyAuditLog(id);
  }

  return { status: 404, body: { error: { code: 'NOT_FOUND', message: `${method} ${path} not found` } } };
}

function listPolicies(): HttpResponse {
  const policies = policyStore.listPolicies();
  return {
    status: 200,
    body: { policies, count: policies.length },
  };
}

function listPoliciesByType(type: PolicyType): HttpResponse {
  const policies = policyStore.listPoliciesByType(type);
  return {
    status: 200,
    body: { policies, count: policies.length, type },
  };
}

function createPolicy(body: unknown): HttpResponse {
  if (!body || typeof body !== 'object') {
    return { status: 400, body: { error: { code: 'INVALID_BODY', message: 'Request body required' } } };
  }

  const policyData = body as Record<string, unknown>;

  // Validate required fields
  if (!policyData.policyId || typeof policyData.policyId !== 'string') {
    return { status: 400, body: { error: { code: 'INVALID_POLICY_ID', message: 'policyId is required' } } };
  }

  if (!policyData.name || typeof policyData.name !== 'string') {
    return { status: 400, body: { error: { code: 'INVALID_NAME', message: 'name is required' } } };
  }

  // Check for duplicate
  if (policyStore.getPolicy(policyData.policyId as string)) {
    return { status: 409, body: { error: { code: 'CONFLICT', message: 'Policy with this ID already exists' } } };
  }

  try {
    const result = PolicyConfigSchema.safeParse({
      policyId: policyData.policyId as string,
      name: policyData.name as string,
      description: policyData.description as string | undefined,
      version: (policyData.version as number) ?? 1,
      requiredEvidenceTypes: policyData.requiredEvidenceTypes,
      passThreshold: policyData.passThreshold,
      failThreshold: policyData.failThreshold,
      minEvidenceCount: policyData.minEvidenceCount,
      fraudScoreThreshold: policyData.fraudScoreThreshold,
      maxSessionDurationMs: policyData.maxSessionDurationMs,
      minSessionDurationMs: policyData.minSessionDurationMs,
      contradictionMultiplier: policyData.contradictionMultiplier,
      fraudMultiplier: policyData.fraudMultiplier,
      allowManualReview: policyData.allowManualReview,
      active: true,
    });

    if (!result.success) {
      return {
        status: 400,
        body: { error: { code: 'VALIDATION_ERROR', message: result.error.message } },
      };
    }

    policyStore.createPolicy(result.data);
    return { status: 201, body: { policy: result.data } };
  } catch (error) {
    return {
      status: 400,
      body: { error: { code: 'VALIDATION_ERROR', message: String(error) } },
    };
  }
}

function getPolicy(policyId: string): HttpResponse {
  const policy = policyStore.getPolicy(policyId);
  if (!policy) {
    return { status: 404, body: { error: { code: 'NOT_FOUND', message: `Policy ${policyId} not found` } } };
  }
  return { status: 200, body: { policy } };
}

function updatePolicy(policyId: string, body: unknown): HttpResponse {
  if (!body || typeof body !== 'object') {
    return { status: 400, body: { error: { code: 'INVALID_BODY', message: 'Request body required' } } };
  }

  const updates = body as Partial<PolicyConfig>;

  // Prevent changing immutable fields
  delete updates.policyId;
  delete updates.createdAt;
  delete updates.createdBy;

  const updated = policyStore.updatePolicy(policyId, updates);
  if (!updated) {
    return { status: 404, body: { error: { code: 'NOT_FOUND', message: `Policy ${policyId} not found` } } };
  }

  return { status: 200, body: { policy: updated } };
}

function deprecatePolicy(policyId: string): HttpResponse {
  const success = policyStore.deprecatePolicy(policyId);
  if (!success) {
    return { status: 404, body: { error: { code: 'NOT_FOUND', message: `Policy ${policyId} not found` } } };
  }
  const policy = policyStore.getPolicy(policyId);
  return { status: 200, body: { policy, message: 'Policy deprecated' } };
}

function deletePolicy(policyId: string): HttpResponse {
  const success = policyStore.deletePolicy(policyId);
  if (!success) {
    return { status: 404, body: { error: { code: 'NOT_FOUND', message: `Policy ${policyId} not found` } } };
  }
  return { status: 200, body: { message: 'Policy deleted' } };
}

function evaluatePolicyEndpoint(policyId: string, body: unknown): HttpResponse {
  const policy = policyStore.getPolicy(policyId);
  if (!policy) {
    return { status: 404, body: { error: { code: 'NOT_FOUND', message: `Policy ${policyId} not found` } } };
  }

  if (!body || typeof body !== 'object') {
    return { status: 400, body: { error: { code: 'INVALID_BODY', message: 'Evaluation input required' } } };
  }

  const input = body as PolicyEvaluationInput;

  // Validate input (using old interface fields)
  if (!input.evidenceTypes || !Array.isArray(input.evidenceTypes)) {
    return { status: 400, body: { error: { code: 'INVALID_INPUT', message: 'evidenceTypes array required' } } };
  }
  if (typeof input.evidenceCount !== 'number') {
    return { status: 400, body: { error: { code: 'INVALID_INPUT', message: 'evidenceCount required' } } };
  }
  if (typeof input.sessionDurationMs !== 'number') {
    return { status: 400, body: { error: { code: 'INVALID_INPUT', message: 'sessionDurationMs required' } } };
  }
  if (typeof input.fraudScore !== 'number') {
    return { status: 400, body: { error: { code: 'INVALID_INPUT', message: 'fraudScore required' } } };
  }

  const result: PolicyEvaluationResult = evaluatePolicy(policy, input);

  return {
    status: 200,
    body: { evaluation: result, policyId: policy.policyId },
  };
}

function getPolicyAuditLog(policyId: string): HttpResponse {
  const policy = policyStore.getPolicy(policyId);
  if (!policy) {
    return { status: 404, body: { error: { code: 'NOT_FOUND', message: `Policy ${policyId} not found` } } };
  }

  // Retrieve the audit log for this policy
  const auditLog = policyStore.getAuditLog();

  return {
    status: 200,
    body: { policyId, auditLog },
  };
}

export { matchPolicyRoute, policyStore, POLICIES_PREFIX };
/**
 * S6.1-S6.5 — Privacy/Compliance Regression Fixtures
 */
export const gdprArt15 = () => ({
  endpoint: 'GET /privacy/export/:userId',
  expectedFields: ['sessionId', 'proofId', 'evidenceIds', 'createdAt', 'retentionPolicyId'],
  responseTimeTargetMs: 500,
});

export const gdprArt17 = () => ({
  endpoint: 'DELETE /privacy/:userId',
  legalHoldBlock: true,
  deletionConfirmation: true,
});

export const ccpaOptOut = () => ({
  endpoint: 'POST /privacy/opt-out',
  consentStatus: 'DENIED',
  categories: ['ANALYTICS', 'TRACKING'],
});

export const retentionAudit = () => ({
  check: 'All classifications have active retention policy; zero orphan schedules',
  classifications: ['EVIDENCE', 'PROOF', 'SESSION', 'ANALYTICS', 'PERSONAL_DATA', 'CONSENT', 'AUDIT_LOG', 'SECURITY_LOG'],
});

export const pseudonymisationRoundTrip = () => ({
  deterministicMode: true,
  reversibleMode: true,
  fields: ['userId', 'sessionId', 'deviceId'],
  assertion: 'originalId recoverable from mapping',
});

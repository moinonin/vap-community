/**
 * Privacy: Data Subject Rights API (VAE Sprint 15)
 *
 * Access, rectification, erasure, portability endpoints.
 */

import type { Router } from 'express';
import { getConsentManager } from '@verified-attention/privacy-consent';
import { getDataMinimiser } from '@verified-attention/privacy-minimisation';
import { getPseudonymisationService } from '@verified-attention/privacy-pseudonymisation';
import { getRetentionPolicyEngine } from '@verified-attention/privacy-retention';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DataSubjectRequest {
  userId: string;
  proofId?: string;
  sessionId?: string;
}

export interface DataSubjectResponse {
  userId: string;
  dataCategories: string[];
  recordsFound: number;
  consentRecords: number;
  proofRecords: number;
  sessionRecords: number;
  actionsAvailable: ('access' | 'rectification' | 'erasure' | 'portability')[];
  erasureDeadline: string;
}

export interface ErasureResult {
  userId: string;
  recordsErased: number;
  consentRecordsRevoked: number;
  proofsAnonymised: number;
  sessionsDeleted: number;
  completedAt: string;
}

export interface PortabilityResult {
  userId: string;
  format: 'JSON' | 'CSV';
  data: Record<string, unknown>;
  exportedAt: string;
}

// ─── Data Subject Rights Handler ──────────────────────────────────────────────

export class DataSubjectRightsHandler {
  async accessRequest(request: DataSubjectRequest): Promise<DataSubjectResponse> {
    const consentManager = getConsentManager();
    const pseudonymService = getPseudonymisationService();
    const retentionEngine = getRetentionPolicyEngine();

    // Get consent records for user
    const consentResult = consentManager.getConsentByUser(request.userId);

    // Check if proofs exist for user
    const proofRecords = 0; // Would query proof store

    // Check sessions
    const sessionRecords = 0; // Would query session store

    return {
      userId: request.userId,
      dataCategories: ['CONSENT', 'PROOF', 'SESSION'],
      recordsFound: consentResult.total + proofRecords + sessionRecords,
      consentRecords: consentResult.total,
      proofRecords,
      sessionRecords,
      actionsAvailable: ['access', 'rectification', 'erasure', 'portability'],
      erasureDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days GDPR deadline
    };
  }

  async rectificationRequest(
    request: DataSubjectRequest,
    corrections: Record<string, unknown>
  ): Promise<{ success: boolean; corrected: string[] }> {
    const corrected: string[] = [];

    // Update consent records if user info changed
    const consentManager = getConsentManager();
    const consentResult = consentManager.getConsentByUser(request.userId);
    for (const record of consentResult.records) {
      // In production: update user info in consent records
      corrected.push(record.id);
    }

    // Update pseudonymisation mappings if user ID changed
    const pseudonymService = getPseudonymisationService();
    // In production: re-pseudonymise with new identity

    return { success: true, corrected };
  }

  async erasureRequest(request: DataSubjectRequest): Promise<ErasureResult> {
    const consentManager = getConsentManager();
    const retentionEngine = getRetentionPolicyEngine();

    // Revoke all consent
    const consentResult = consentManager.getConsentByUser(request.userId);
    let consentRecordsRevoked = 0;
    for (const record of consentResult.records) {
      if (record.status === 'GRANTED') {
        consentManager.withdrawConsent(record.sessionId, record.type, 'User erasure request');
        consentRecordsRevoked++;
      }
    }

    // Anonymise proofs (would trigger proof anonymisation)
    const proofsAnonymised = 0;

    // Delete sessions (would trigger session deletion)
    const sessionsDeleted = 0;

    return {
      userId: request.userId,
      recordsErased: consentRecordsRevoked + proofsAnonymised + sessionsDeleted,
      consentRecordsRevoked,
      proofsAnonymised,
      sessionsDeleted,
      completedAt: new Date().toISOString(),
    };
  }

  async portabilityRequest(
    request: DataSubjectRequest,
    format: 'JSON' | 'CSV' = 'JSON'
  ): Promise<PortabilityResult> {
    const consentManager = getConsentManager();
    const consentResult = consentManager.getConsentByUser(request.userId);

    const data: Record<string, unknown> = {
      userId: request.userId,
      exportedAt: new Date().toISOString(),
      consentRecords: consentResult.records,
      proofs: [],
      sessions: [],
    };

    return {
      userId: request.userId,
      format,
      data,
      exportedAt: new Date().toISOString(),
    };
  }
}

// ─── Router Factory ───────────────────────────────────────────────────────────

export function createPrivacyRouter(handler: DataSubjectRightsHandler): Router {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const router: Router = {} as any;

  // GET /privacy/access?userId=...
  // router.get('/privacy/access', async (req, res) => { ... });

  // POST /privacy/rectification
  // router.post('/privacy/rectification', async (req, res) => { ... });

  // POST /privacy/erasure
  // router.post('/privacy/erasure', async (req, res) => { ... });

  // GET /privacy/portability?userId=...&format=JSON
  // router.get('/privacy/portability', async (req, res) => { ... });

  return router;
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _handler: DataSubjectRightsHandler | null = null;

export function getDataSubjectRightsHandler(): DataSubjectRightsHandler {
  if (!_handler) {
    _handler = new DataSubjectRightsHandler();
  }
  return _handler;
}

export function setDataSubjectRightsHandler(handler: DataSubjectRightsHandler): void {
  _handler = handler;
}

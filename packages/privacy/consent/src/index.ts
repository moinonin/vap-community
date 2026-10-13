/**
 * Consent Management (VAE Sprint 15)
 *
 * Capture, store, query, and revoke user consent per session.
 * GDPR/CCPA compliant consent tracking.
 */

import { z } from 'zod';

// ─── Types ────────────────────────────────────────────────────────────────────

export const ConsentTypeSchema = z.enum([
  'ANALYTICS',
  'PERSONALIZATION',
  'ADVERTISING',
  'DATA_SHARING',
  'RESEARCH',
  'MARKETING',
  'ESSENTIAL',
]);
export type ConsentType = z.infer<typeof ConsentTypeSchema>;

export const ConsentStatusSchema = z.enum(['GRANTED', 'DENIED', 'WITHDRAWN', 'PENDING']);
export type ConsentStatus = z.infer<typeof ConsentStatusSchema>;

export const ConsentRecordSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  userId: z.string().min(1),
  type: ConsentTypeSchema,
  status: ConsentStatusSchema,
  timestamp: z.string().datetime(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  consentMethod: z.enum(['WEB_FORM', 'API', 'IMPLIED', 'LEGACY']).default('WEB_FORM'),
  policyVersion: z.string().optional(),
  withdrawalReason: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

export type ConsentRecord = z.infer<typeof ConsentRecordSchema>;

export const ConsentQuerySchema = z.object({
  sessionId: z.string().optional(),
  userId: z.string().optional(),
  type: ConsentTypeSchema.optional(),
  status: z.enum(['GRANTED', 'DENIED', 'WITHDRAWN', 'ALL']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.number().int().positive().default(100),
  offset: z.number().int().nonnegative().default(0),
});

export type ConsentQuery = z.infer<typeof ConsentQuerySchema>;

export const ConsentQueryResultSchema = z.object({
  records: z.array(ConsentRecordSchema),
  total: z.number().int().nonnegative(),
  granted: z.number().int().nonnegative(),
  denied: z.number().int().nonnegative(),
  withdrawn: z.number().int().nonnegative(),
  limit: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
});

export type ConsentQueryResult = z.infer<typeof ConsentQueryResultSchema>;

export interface ConsentManager {
  recordConsent(record: Omit<ConsentRecord, 'id' | 'timestamp'>): ConsentRecord;
  withdrawConsent(sessionId: string, type: ConsentType, reason?: string): ConsentRecord | undefined;
  getConsent(sessionId: string, type: ConsentType): ConsentRecord | undefined;
  getConsentByUser(userId: string, query?: ConsentQuery): ConsentQueryResult;
  getConsentBySession(sessionId: string, query?: ConsentQuery): ConsentQueryResult;
  getAllConsent(query?: ConsentQuery): ConsentQueryResult;
  hasConsent(sessionId: string, type: ConsentType): boolean;
  hasAnyConsent(sessionId: string, types: ConsentType[]): boolean;
  getConsentStats(): ConsentStats;
}

export interface ConsentStats {
  totalRecords: number;
  grantedCount: number;
  deniedCount: number;
  withdrawnCount: number;
  byType: Record<ConsentType, { granted: number; denied: number; withdrawn: number }>;
}

// ─── In-Memory Consent Manager ────────────────────────────────────────────────

export class ConsentManagerImpl implements ConsentManager {
  private records = new Map<string, ConsentRecord>();
  private sessionIndex = new Map<string, string[]>(); // sessionId -> record IDs
  private userIndex = new Map<string, string[]>(); // userId -> record IDs
  private recordCounter = 0;
  private statsCache: ConsentStats | null = null;

  recordConsent(record: Omit<ConsentRecord, 'id' | 'timestamp'>): ConsentRecord {
    const id = `consent_${Date.now()}_${++this.recordCounter}`;
    const timestamp = new Date().toISOString();

    const fullRecord: ConsentRecord = {
      ...record,
      id,
      timestamp,
    };

    this.records.set(id, fullRecord);

    // Index by session
    const sessionRecords = this.sessionIndex.get(record.sessionId) || [];
    sessionRecords.push(id);
    this.sessionIndex.set(record.sessionId, sessionRecords);

    // Index by user
    const userRecords = this.userIndex.get(record.userId) || [];
    userRecords.push(id);
    this.userIndex.set(record.userId, userRecords);

    this.statsCache = null; // Invalidate cache
    return fullRecord;
  }

  withdrawConsent(sessionId: string, type: ConsentType, reason?: string): ConsentRecord | undefined {
    // Find the most recent granted consent for this session/type
    const sessionRecords = this.sessionIndex.get(sessionId);
    if (!sessionRecords) return undefined;

    let latestRecord: ConsentRecord | undefined;
    for (const recordId of sessionRecords) {
      const record = this.records.get(recordId);
      if (record && record.sessionId === sessionId && record.type === type && record.status === 'GRANTED') {
        if (!latestRecord || new Date(record.timestamp) > new Date(latestRecord.timestamp)) {
          latestRecord = record;
        }
      }
    }

    if (!latestRecord) return undefined;

    // Update to withdrawn
    latestRecord.status = 'WITHDRAWN';
    latestRecord.withdrawalReason = reason;
    latestRecord.timestamp = new Date().toISOString();

    this.statsCache = null;
    return latestRecord;
  }

  getConsent(sessionId: string, type: ConsentType): ConsentRecord | undefined {
    const sessionRecords = this.sessionIndex.get(sessionId);
    if (!sessionRecords) return undefined;

    // Return the most recent record for this session/type
    let latest: ConsentRecord | undefined;
    for (const recordId of sessionRecords) {
      const record = this.records.get(recordId);
      if (record && record.sessionId === sessionId && record.type === type) {
        if (!latest || new Date(record.timestamp) > new Date(latest.timestamp)) {
          latest = record;
        }
      }
    }

    return latest;
  }

  getConsentByUser(userId: string, query?: ConsentQuery): ConsentQueryResult {
    const recordIds = this.userIndex.get(userId) || [];
    return this.filterRecords(recordIds, query);
  }

  getConsentBySession(sessionId: string, query?: ConsentQuery): ConsentQueryResult {
    const recordIds = this.sessionIndex.get(sessionId) || [];
    return this.filterRecords(recordIds, query);
  }

  getAllConsent(query?: ConsentQuery): ConsentQueryResult {
    const allIds = Array.from(this.records.keys());
    return this.filterRecords(allIds, query);
  }

  hasConsent(sessionId: string, type: ConsentType): boolean {
    const record = this.getConsent(sessionId, type);
    return record?.status === 'GRANTED';
  }

  hasAnyConsent(sessionId: string, types: ConsentType[]): boolean {
    for (const type of types) {
      if (this.hasConsent(sessionId, type)) return true;
    }
    return false;
  }

  getConsentStats(): ConsentStats {
    if (this.statsCache) return this.statsCache;

    const stats: ConsentStats = {
      totalRecords: 0,
      grantedCount: 0,
      deniedCount: 0,
      withdrawnCount: 0,
      byType: {} as Record<ConsentType, { granted: number; denied: number; withdrawn: number }>,
    };

    for (const type of Object.values(ConsentTypeSchema.Enum)) {
      stats.byType[type] = { granted: 0, denied: 0, withdrawn: 0 };
    }

    for (const record of this.records.values()) {
      stats.totalRecords++;
      if (record.status === 'GRANTED') stats.grantedCount++;
      else if (record.status === 'DENIED') stats.deniedCount++;
      else if (record.status === 'WITHDRAWN') stats.withdrawnCount++;

      if (stats.byType[record.type]) {
        if (record.status === 'GRANTED') stats.byType[record.type].granted++;
        else if (record.status === 'DENIED') stats.byType[record.type].denied++;
        else if (record.status === 'WITHDRAWN') stats.byType[record.type].withdrawn++;
      }
    }

    this.statsCache = stats;
    return stats;
  }

  private filterRecords(
    recordIds: string[],
    query?: ConsentQuery
  ): ConsentQueryResult {
    let records = recordIds.map(id => this.records.get(id)!).filter(Boolean);

    if (query?.type) {
      records = records.filter(r => r.type === query.type);
    }
    if (query?.status && query.status !== 'ALL') {
      if (query.status === 'GRANTED' || query.status === 'DENIED' || query.status === 'WITHDRAWN') {
        records = records.filter(r => r.status === query.status);
      }
    }
    if (query?.from) {
      records = records.filter(r => r.timestamp >= query.from!);
    }
    if (query?.to) {
      records = records.filter(r => r.timestamp <= query.to!);
    }

    const total = records.length;
    const offset = query?.offset || 0;
    const limit = query?.limit || 100;
    records = records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(offset, offset + limit);

    let granted = 0, denied = 0, withdrawn = 0;
    for (const r of records) {
      if (r.status === 'GRANTED') granted++;
      else if (r.status === 'DENIED') denied++;
      else if (r.status === 'WITHDRAWN') withdrawn++;
    }

    return {
      records,
      total,
      granted,
      denied,
      withdrawn,
      limit,
      offset,
    };
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

let _manager: ConsentManager | null = null;

export function getConsentManager(): ConsentManager {
  if (!_manager) {
    _manager = new ConsentManagerImpl();
  }
  return _manager;
}

export function setConsentManager(manager: ConsentManager): void {
  _manager = manager;
}

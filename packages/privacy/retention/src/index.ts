/**
 * Retention Policies (VAE Sprint 15)
 *
 * Data retention enforcement: evidence 90d, proofs 7y, analytics aggregated.
 */

import { z } from 'zod';

// ─── Types ────────────────────────────────────────────────────────────────────

export const DataClassificationSchema = z.enum([
  'EVIDENCE',
  'PROOF',
  'SESSION',
  'ANALYTICS',
  'PERSONAL_DATA',
  'CONSENT',
  'AUDIT_LOG',
  'SECURITY_LOG',
]);
export type DataClassification = z.infer<typeof DataClassificationSchema>;

export const RetentionPolicySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  classification: DataClassificationSchema,
  // Retention period
  retentionPeriod: z.object({
    type: z.enum(['FIXED', 'DYNAMIC', 'INFINITE', 'NO_RETENTION']),
    days: z.number().int().nonnegative().optional(),
    months: z.number().int().nonnegative().optional(),
    years: z.number().int().nonnegative().optional(),
  }),
  // What happens at expiry
  expiryAction: z.enum(['DELETE', 'ANONYMISE', 'AGGREGATE', 'ARCHIVE', 'NOTIFY']).default('DELETE'),
  // Legal hold override
  legalHold: z.boolean().default(false),
  legalHoldReason: z.string().optional(),
  // Grace period after expiry before action is taken (days)
  gracePeriodDays: z.number().int().nonnegative().default(0),
  // Description
  description: z.string().optional(),
  // Jurisdiction
  jurisdiction: z.array(z.enum(['GDPR', 'CCPA', 'LGPD', 'HIPAA', 'SOX', 'OTHER'])).default(['GDPR']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
});

export type RetentionPolicy = z.infer<typeof RetentionPolicySchema>;

export const RetentionScheduleSchema = z.object({
  classification: DataClassificationSchema,
  policyId: z.string().min(1),
  retentionUntil: z.string().datetime(),
  expiryAction: z.enum(['DELETE', 'ANONYMISE', 'AGGREGATE', 'ARCHIVE', 'NOTIFY']),
  legalHold: z.boolean().default(false),
});

export type RetentionSchedule = z.infer<typeof RetentionScheduleSchema>;

export const RetentionRequestSchema = z.object({
  dataId: z.string().min(1),
  classification: DataClassificationSchema,
  createdAt: z.string().datetime(),
  dataSource: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
  scheduleOverride: z.string().optional(), // custom retention override
});

export type RetentionRequest = z.infer<typeof RetentionRequestSchema>;

export const RetentionResultSchema = z.object({
  dataId: z.string().min(1),
  classification: DataClassificationSchema,
  scheduledForDeletion: z.string().datetime().optional(),
  deletedAt: z.string().datetime().optional(),
  anonymisedAt: z.string().datetime().optional(),
  status: z.enum(['RETAINED', 'SCHEDULED', 'DELETED', 'ANONYMISED', 'LEGAL_HOLD']),
  legalHoldReason: z.string().optional(),
});

export type RetentionResult = z.infer<typeof RetentionResultSchema>;

export interface RetentionPolicyEngine {
  createPolicy(policy: Omit<RetentionPolicy, 'id' | 'createdAt' | 'updatedAt'>): RetentionPolicy;
  getPolicy(policyId: string): RetentionPolicy | undefined;
  getPolicyForClassification(classification: DataClassification): RetentionPolicy | undefined;
  listPolicies(): RetentionPolicy[];
  updatePolicy(policyId: string, updates: Partial<Omit<RetentionPolicy, 'id' | 'createdAt'>>): RetentionPolicy | undefined;
  deletePolicy(policyId: string): boolean;
  scheduleRetention(request: RetentionRequest): RetentionResult;
  getRetentionSchedule(dataId: string): RetentionSchedule | undefined;
  getExpiringData(daysAhead: number): RetentionSchedule[];
  processExpiries(): RetentionResult[];
  placeLegalHold(dataId: string, reason: string): RetentionResult | undefined;
  releaseLegalHold(dataId: string): RetentionResult | undefined;
  getRetentionStats(): RetentionStats;
}

export interface RetentionStats {
  totalRecords: number;
  retainedCount: number;
  scheduledForDeletion: number;
  deletedCount: number;
  legalHoldCount: number;
  expiringThisMonth: number;
  byClassification: Record<DataClassification, { retained: number; scheduled: number; deleted: number }>;
}

// ─── Default Retention Policies ──────────────────────────────────────────────

const DEFAULT_POLICIES: Omit<RetentionPolicy, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'evidence-standard',
    classification: 'EVIDENCE',
    retentionPeriod: { type: 'FIXED', days: 90 },
    expiryAction: 'ANONYMISE',
    legalHold: false,
    gracePeriodDays: 0,
    description: 'Evidence retained for 90 days then anonymised',
    jurisdiction: ['GDPR', 'CCPA'],
  },
  {
    name: 'proof-standard',
    classification: 'PROOF',
    retentionPeriod: { type: 'FIXED', years: 7 },
    expiryAction: 'ARCHIVE',
    legalHold: false,
    gracePeriodDays: 0,
    description: 'Proofs retained for 7 years for legal compliance',
    jurisdiction: ['GDPR', 'CCPA', 'SOX'],
  },
  {
    name: 'session-standard',
    classification: 'SESSION',
    retentionPeriod: { type: 'FIXED', days: 90 },
    expiryAction: 'DELETE',
    legalHold: false,
    gracePeriodDays: 0,
    description: 'Sessions retained for 90 days',
    jurisdiction: ['GDPR', 'CCPA'],
  },
  {
    name: 'analytics-aggregated',
    classification: 'ANALYTICS',
    retentionPeriod: { type: 'INFINITE' },
    expiryAction: 'NOTIFY',
    legalHold: false,
    gracePeriodDays: 0,
    description: 'Aggregated analytics retained indefinitely (no PII)',
    jurisdiction: ['GDPR'],
  },
  {
    name: 'personal-data-minimal',
    classification: 'PERSONAL_DATA',
    retentionPeriod: { type: 'FIXED', days: 30 },
    expiryAction: 'DELETE',
    legalHold: false,
    gracePeriodDays: 0,
    description: 'Personal data minimal retention',
    jurisdiction: ['GDPR', 'CCPA', 'LGPD'],
  },
  {
    name: 'consent-records',
    classification: 'CONSENT',
    retentionPeriod: { type: 'FIXED', years: 5 },
    expiryAction: 'ARCHIVE',
    legalHold: false,
    gracePeriodDays: 0,
    description: 'Consent records retained for 5 years for compliance proof',
    jurisdiction: ['GDPR', 'CCPA'],
  },
  {
    name: 'audit-log',
    classification: 'AUDIT_LOG',
    retentionPeriod: { type: 'FIXED', years: 7 },
    expiryAction: 'ARCHIVE',
    legalHold: false,
    gracePeriodDays: 0,
    description: 'Audit logs retained for 7 years',
    jurisdiction: ['SOX', 'GDPR'],
  },
  {
    name: 'security-log',
    classification: 'SECURITY_LOG',
    retentionPeriod: { type: 'FIXED', months: 12 },
    expiryAction: 'DELETE',
    legalHold: false,
    gracePeriodDays: 0,
    description: 'Security logs retained for 12 months',
    jurisdiction: ['GDPR'],
  },
];

// ─── In-Memory Retention Engine ───────────────────────────────────────────────

export class RetentionPolicyEngineImpl implements RetentionPolicyEngine {
  private policies = new Map<string, RetentionPolicy>();
  private schedules = new Map<string, RetentionSchedule>(); // dataId -> schedule
  private results = new Map<string, RetentionResult>();
  private policyCounter = 0;
  private statsCache: RetentionStats | null = null;

  constructor() {
    for (const p of DEFAULT_POLICIES) {
      this.createPolicy(p);
    }
  }

  createPolicy(policy: Omit<RetentionPolicy, 'id' | 'createdAt' | 'updatedAt'>): RetentionPolicy {
    const now = new Date().toISOString();
    const id = `pol_${Date.now()}_${++this.policyCounter}`;
    const full: RetentionPolicy = {
      ...policy,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.policies.set(id, full);
    this.statsCache = null;
    return full;
  }

  getPolicy(policyId: string): RetentionPolicy | undefined {
    return this.policies.get(policyId);
  }

  getPolicyForClassification(classification: DataClassification): RetentionPolicy | undefined {
    for (const policy of this.policies.values()) {
      if (policy.classification === classification) return policy;
    }
    return undefined;
  }

  listPolicies(): RetentionPolicy[] {
    return Array.from(this.policies.values());
  }

  updatePolicy(
    policyId: string,
    updates: Partial<Omit<RetentionPolicy, 'id' | 'createdAt'>>
  ): RetentionPolicy | undefined {
    const existing = this.policies.get(policyId);
    if (!existing) return undefined;

    const updated: RetentionPolicy = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.policies.set(policyId, updated);
    this.statsCache = null;
    return updated;
  }

  deletePolicy(policyId: string): boolean {
    return this.policies.delete(policyId);
  }

  scheduleRetention(request: RetentionRequest): RetentionResult {
    const policy = request.scheduleOverride
      ? this.policies.get(request.scheduleOverride)
      : this.getPolicyForClassification(request.classification);

    if (!policy) {
      throw new Error(`No retention policy found for classification: ${request.classification}`);
    }

    const retentionUntil = this.calculateRetentionUntil(policy, request.createdAt);
    const dataId = request.dataId;

    const schedule: RetentionSchedule = {
      classification: request.classification,
      policyId: policy.id,
      retentionUntil,
      expiryAction: policy.expiryAction,
      legalHold: policy.legalHold,
    };

    this.schedules.set(dataId, schedule);

    // If already past retention, process immediately
    const now = new Date();
    if (new Date(retentionUntil) <= now) {
      return this.processExpiry(dataId);
    }

    return {
      dataId,
      classification: request.classification,
      scheduledForDeletion: retentionUntil,
      status: policy.legalHold ? 'LEGAL_HOLD' : 'SCHEDULED',
      legalHoldReason: policy.legalHold ? policy.legalHoldReason : undefined,
    };
  }

  getRetentionSchedule(dataId: string): RetentionSchedule | undefined {
    return this.schedules.get(dataId);
  }

  getExpiringData(daysAhead: number): RetentionSchedule[] {
    const now = new Date();
    const future = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    return Array.from(this.schedules.values()).filter(s => {
      const expiry = new Date(s.retentionUntil);
      return expiry >= now && expiry <= future && !s.legalHold;
    });
  }

  processExpiries(): RetentionResult[] {
    const now = new Date();
    const results: RetentionResult[] = [];

    for (const [dataId, schedule] of this.schedules) {
      const expiry = new Date(schedule.retentionUntil);
      const graceEnd = new Date(expiry.getTime() + schedule.expiryAction === 'DELETE' ? 0 : 0);

      // Check if retention period has passed (including grace period for non-delete)
      const effectiveExpiry = new Date(expiry.getTime() + (schedule.expiryAction !== 'DELETE' ? 30 * 24 * 60 * 60 * 1000 : 0));

      if (now >= expiry && !schedule.legalHold) {
        const result = this.processExpiry(dataId);
        results.push(result);
      }
    }

    return results;
  }

  placeLegalHold(dataId: string, reason: string): RetentionResult | undefined {
    const schedule = this.schedules.get(dataId);
    if (!schedule) return undefined;

    schedule.legalHold = true;
    // We don't store legalHoldReason in schedule, so we use the result
    const result = this.results.get(dataId);
    if (result) {
      result.legalHoldReason = reason;
      result.status = 'LEGAL_HOLD';
    }

    // Return updated result
    return {
      dataId,
      classification: schedule.classification,
      status: 'LEGAL_HOLD',
      legalHoldReason: reason,
    };
  }

  releaseLegalHold(dataId: string): RetentionResult | undefined {
    const schedule = this.schedules.get(dataId);
    if (!schedule) return undefined;

    schedule.legalHold = false;

    const result: RetentionResult = {
      dataId,
      classification: schedule.classification,
      status: new Date(schedule.retentionUntil) <= new Date() ? 'SCHEDULED' : 'RETAINED',
      scheduledForDeletion: schedule.retentionUntil,
    };

    this.results.set(dataId, result);
    return result;
  }

  getRetentionStats(): RetentionStats {
    if (this.statsCache) return this.statsCache;

    const stats: RetentionStats = {
      totalRecords: this.schedules.size,
      retainedCount: 0,
      scheduledForDeletion: 0,
      deletedCount: 0,
      legalHoldCount: 0,
      expiringThisMonth: 0,
      byClassification: {} as Record<DataClassification, { retained: number; scheduled: number; deleted: number }>,
    };

    for (const classification of Object.values(DataClassificationSchema.Enum)) {
      stats.byClassification[classification] = { retained: 0, scheduled: 0, deleted: 0 };
    }

    for (const [dataId, schedule] of this.schedules.entries()) {
      const result = this.results.get(dataId);
      if (result?.status === 'DELETED') {
        stats.deletedCount++;
        stats.byClassification[schedule.classification].deleted++;
      } else if (result?.status === 'LEGAL_HOLD' || schedule.legalHold) {
        stats.legalHoldCount++;
        stats.byClassification[schedule.classification].retained++;
      } else if (result?.status === 'SCHEDULED') {
        stats.scheduledForDeletion++;
        stats.byClassification[schedule.classification].scheduled++;
      } else {
        stats.retainedCount++;
        stats.byClassification[schedule.classification].retained++;
      }
    }

    // Count expiring this month
    const now = new Date();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    for (const schedule of this.schedules.values()) {
      if (!schedule.legalHold) {
        const expiry = new Date(schedule.retentionUntil);
        if (expiry >= now && expiry <= monthEnd) {
          stats.expiringThisMonth++;
        }
      }
    }

    this.statsCache = stats;
    return stats;
  }

  private calculateRetentionUntil(policy: RetentionPolicy, created: string): string {
    const createdDate = new Date(created);
    const { type, days, months, years } = policy.retentionPeriod;

    const result = new Date(createdDate);

    if (type === 'INFINITE') {
      // Set to far future (year 9999)
      return '9999-12-31T23:59:59.999Z';
    }

    if (days) result.setDate(result.getDate() + days);
    if (months) result.setMonth(result.getMonth() + months);
    if (years) result.setFullYear(result.getFullYear() + years);

    return result.toISOString();
  }

  private processExpiry(dataId: string): RetentionResult {
    const schedule = this.schedules.get(dataId);
    if (!schedule) {
      return {
        dataId,
        classification: 'EVIDENCE', // Default
        status: 'DELETED',
        deletedAt: new Date().toISOString(),
      };
    }

    const result: RetentionResult = {
      dataId,
      classification: schedule.classification,
      status: schedule.expiryAction === 'DELETE' ? 'DELETED' :
              schedule.expiryAction === 'ANONYMISE' ? 'ANONYMISED' : 'SCHEDULED',
      deletedAt: schedule.expiryAction === 'DELETE' ? new Date().toISOString() : undefined,
      anonymisedAt: schedule.expiryAction === 'ANONYMISE' ? new Date().toISOString() : undefined,
    };

    this.results.set(dataId, result);
    // Remove from schedules after processing
    this.schedules.delete(dataId);

    this.statsCache = null;
    return result;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

let _engine: RetentionPolicyEngine | null = null;

export function getRetentionPolicyEngine(): RetentionPolicyEngine {
  if (!_engine) {
    _engine = new RetentionPolicyEngineImpl();
  }
  return _engine;
}

export function setRetentionPolicyEngine(engine: RetentionPolicyEngine): void {
  _engine = engine;
}

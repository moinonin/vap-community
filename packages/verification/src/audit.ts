/**
 * Audit logging for verifier key operations.
 * Every key operation (generate, rotate, supersede) must emit an audit entry.
 */

export type KeyOperation = 'generate' | 'rotate' | 'supersede' | 'export';

export interface AuditEntry {
  id: string;
  operation: KeyOperation;
  keyId: string;
  verifierId: string;
  actor: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

/**
 * In-memory audit log (replace with persistent store in production).
 */
const auditLog: AuditEntry[] = [];

/**
 * Log a key operation to the audit trail.
 */
export function logKeyOperation(
  operation: KeyOperation,
  keyId: string,
  verifierId: string,
  actor = 'system',
  metadata?: Record<string, unknown>
): AuditEntry {
  const entry: AuditEntry = {
    id: `${Date.now()}-${keyId}`,
    operation,
    keyId,
    verifierId,
    actor,
    timestamp: new Date().toISOString(),
    metadata
  };
  auditLog.push(entry);
  // Freeze to enforce immutability
  Object.freeze(entry);
  return entry;
}

/**
 * Search audit entries by key ID or operation type.
 */
export function searchAuditLog(filter: { keyId?: string; operation?: KeyOperation }): AuditEntry[] {
  return auditLog.filter(e =>
    (filter.keyId === undefined || e.keyId === filter.keyId) &&
    (filter.operation === undefined || e.operation === filter.operation)
  );
}

/**
 * Get all audit entries (read-only).
 */
export function getAuditLog(): readonly AuditEntry[] {
  return auditLog;
}

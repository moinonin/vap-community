/**
 * S7.1 — Synthetic Attack Generator CLI Skeleton
 */
export interface AttackConfig {
  type: 'sybil' | 'fingerprint' | 'replay';
  count: number;
  outputFile?: string;
}

export function describeAttack(config: AttackConfig): string {
  return `Generate ${config.count} synthetic ${config.type} attacks → ${config.outputFile || 'stdout'}`;
}

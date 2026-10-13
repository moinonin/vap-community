import { describe, it, expect } from 'vitest';
import { enrichEvidence, enrichEvidenceBatch, DEFAULT_ENRICHMENT_OPTIONS } from './index';

describe('Evidence Enrichment', () => {
  const createMockEvidence = (overrides: any = {}) => ({
    evidenceId: 'urn:vap:evidence:test-1',
    evidenceType: 'E-INTERACTION',
    timestamp: 1700000000000,
    payload: { clickCount: 5 },
    provenance: { sourceId: 'browser-sdk', observationIds: ['obs-1'], observationHash: 'abc' },
    metadata: {},
    ...overrides,
  });

  describe('enrichEvidence', () => {
    it('should normalize timestamps', () => {
      const evidence = createMockEvidence({ timestamp: 1700000000000 });
      const result = enrichEvidence(evidence, { enableTimestampNormalization: true } as any);
      expect(result.enrichmentsApplied).toContain('timestamp-normalization');
      expect(typeof result.enrichedEvidence.timestamp).toBe('string');
      expect(result.enrichedEvidence.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should add source reliability score', () => {
      const evidence = createMockEvidence();
      const result = enrichEvidence(evidence, { enableSourceReliability: true } as any);
      expect(result.enrichmentsApplied).toContain('source-reliability');
      expect(result.enrichedEvidence.metadata.sourceReliability).toBe(0.95);
    });

    it('should attach default policy', () => {
      const evidence = createMockEvidence();
      const result = enrichEvidence(evidence, { enablePolicyAttachment: true } as any);
      expect(result.enrichmentsApplied).toContain('policy-attachment');
      expect(result.enrichedEvidence.metadata.policyId).toBe('default-collection-v1');
    });

    it('should not overwrite existing policy', () => {
      const evidence = createMockEvidence({ metadata: { policyId: 'custom-v2' } });
      const result = enrichEvidence(evidence, { enablePolicyAttachment: true } as any);
      expect(result.enrichedEvidence.metadata.policyId).toBe('custom-v2');
    });

    it('should apply all enrichments by default', () => {
      const evidence = createMockEvidence();
      const result = enrichEvidence(evidence);
      expect(result.enrichmentsApplied.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('enrichEvidenceBatch', () => {
    it('should enrich multiple items', () => {
      const items = [createMockEvidence(), createMockEvidence({ evidenceId: 'urn:vap:evidence:test-2' })];
      const results = enrichEvidenceBatch(items);
      expect(results).toHaveLength(2);
      expect(results[0].enrichmentsApplied.length).toBeGreaterThan(0);
    });
  });
});

/**
 * Evidence Enrichment Pipeline Stage
 *
 * Enriches evidence with contextual metadata:
 * - Geolocation from IP
 * - Device fingerprinting
 * - Timestamp normalization
 * - Source reliability scoring
 * - Policy attachment
 *
 * @module @verified-attention/pipeline-enrichment
 */

/**
 * Enrichment options
 */
export interface EnrichmentOptions {
  enableGeoEnrichment?: boolean;
  enableDeviceFingerprint?: boolean;
  enableTimestampNormalization?: boolean;
  enableSourceReliability?: boolean;
  enablePolicyAttachment?: boolean;
}

export const DEFAULT_ENRICHMENT_OPTIONS: Required<EnrichmentOptions> = {
  enableGeoEnrichment: true,
  enableDeviceFingerprint: false,
  enableTimestampNormalization: true,
  enableSourceReliability: true,
  enablePolicyAttachment: true,
};

/**
 * Enrichment result
 */
export interface EnrichmentResult {
  enrichedEvidence: any;
  enrichmentsApplied: string[];
  enrichmentMetadata: Record<string, unknown>;
}

/**
 * Geo-enrichment lookup result
 */
export interface GeoEnrichment {
  country?: string;
  region?: string;
  city?: string;
  timezone?: string;
  lat?: number;
  lon?: number;
}

/**
 * Source reliability scores (in production, fetched from a database)
 */
const SOURCE_RELIABILITY_SCORES: Record<string, number> = {
  'browser-sdk': 0.95,
  'mobile-sdk': 0.93,
  'api-partner': 0.85,
  'import': 0.70,
  'unknown': 0.50,
};

/**
 * Normalize timestamp to ISO 8601
 */
function normalizeTimestamp(timestamp: any): string {
  if (typeof timestamp === 'string') {
    const date = new Date(timestamp);
    if (!isNaN(date.getTime())) return date.toISOString();
  }
  if (typeof timestamp === 'number') {
    // Assume milliseconds if > 10^12, otherwise seconds
    const ms = timestamp > 1e12 ? timestamp : timestamp * 1000;
    return new Date(ms).toISOString();
  }
  return new Date().toISOString();
}

/**
 * Enrich a single evidence item
 */
export function enrichEvidence(evidence: any, options: EnrichmentOptions = {}): EnrichmentResult {
  const opts = { ...DEFAULT_ENRICHMENT_OPTIONS, ...options };
  const enriched = { ...evidence };
  const enrichmentsApplied: string[] = [];
  const enrichmentMetadata: Record<string, unknown> = {};

  // Timestamp normalization
  if (opts.enableTimestampNormalization && enriched.timestamp) {
    enriched.timestamp = normalizeTimestamp(enriched.timestamp);
    enrichmentsApplied.push('timestamp-normalization');
    enrichmentMetadata.originalTimestamp = evidence.timestamp;
    enrichmentMetadata.normalizedTimestamp = enriched.timestamp;
  }

  // Source reliability scoring
  if (opts.enableSourceReliability) {
    const sourceId = enriched.provenance?.sourceId ?? 'unknown';
    const score = SOURCE_RELIABILITY_SCORES[sourceId] ?? 0.50;
    if (!enriched.metadata) enriched.metadata = {};
    enriched.metadata.sourceReliability = score;
    enrichmentsApplied.push('source-reliability');
    enrichmentMetadata.sourceReliabilityScore = score;
  }

  // Policy attachment
  if (opts.enablePolicyAttachment) {
    if (!enriched.metadata) enriched.metadata = {};
    if (!enriched.metadata.policyId) {
      enriched.metadata.policyId = 'default-collection-v1';
    }
    if (!enriched.metadata.collectionPolicyVersion) {
      enriched.metadata.collectionPolicyVersion = '1.0.0';
    }
    enrichmentsApplied.push('policy-attachment');
    enrichmentMetadata.policyId = enriched.metadata.policyId;
  }

  // Geo enrichment (placeholder — production would use MaxMind or IP API)
  if (opts.enableGeoEnrichment && enriched.metadata?.ipAddress) {
    const geo: GeoEnrichment = {
      country: 'unknown',
      timezone: 'UTC',
    };
    if (!enriched.metadata.geo) enriched.metadata.geo = geo;
    enrichmentsApplied.push('geo-enrichment');
    enrichmentMetadata.geo = geo;
  }

  // Device fingerprint (placeholder — production would use a fingerprinting library)
  if (opts.enableDeviceFingerprint && enriched.metadata?.userAgent) {
    const ua = enriched.metadata.userAgent as string;
    const fingerprint = {
      browser: ua.includes('Firefox') ? 'Firefox' : ua.includes('Chrome') ? 'Chrome' : 'Unknown',
      os: ua.includes('Mac') ? 'macOS' : ua.includes('Windows') ? 'Windows' : ua.includes('Linux') ? 'Linux' : 'Unknown',
      isMobile: /Mobile|Android|iPhone/.test(ua),
    };
    if (!enriched.metadata.deviceFingerprint) enriched.metadata.deviceFingerprint = fingerprint;
    enrichmentsApplied.push('device-fingerprint');
    enrichmentMetadata.deviceFingerprint = fingerprint;
  }

  return {
    enrichedEvidence: enriched,
    enrichmentsApplied,
    enrichmentMetadata,
  };
}

/**
 * Enrich evidence batch
 */
export function enrichEvidenceBatch(evidenceList: any[], options?: EnrichmentOptions): EnrichmentResult[] {
  return evidenceList.map(e => enrichEvidence(e, options));
}

export default {
  enrichEvidence,
  enrichEvidenceBatch,
  DEFAULT_ENRICHMENT_OPTIONS,
};

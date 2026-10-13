/**
 * Protocol Openness Contract (S11)
 * Machine-readable contract for VAP openness and independent conformance
 */
import type { JsonWebKey } from 'crypto';

/**
 * Independent Verification Function (normative from VAP spec)
 * Consumer-side verification requires ONLY PoA + verifier public key
 */
export interface IndependentVerificationInput {
  poa: ProofOfAttention;
  verifierPublicKey: JsonWebKey | string; // JWK or PEM
}

export interface ProofOfAttention {
  proofId: string;
  claimId: string;
  verifierId: string;
  issuedAt: string; // ISO 8601
  expiresAt: string; // ISO 8601
  signature: string; // JWS detached signature
  payload: PoAPayload;
  publicKey: JsonWebKey | string;
}

export interface PoAPayload {
  claim: string;
  confidence: number;
  evidenceClasses: string[];
  policyId: string;
  modelVersion: string;
}

export interface IndependentVerificationResult {
  valid: boolean;
  errors: string[];
  verifiedAt: string; // ISO 8601
}

/**
 * Normative verification algorithm (from VAP spec)
 * 1. Parse PoA payload
 * 2. Verify JWS signature against verifier's public key
 * 3. Check expiresAt > now
 * 4. Verify verifierId matches certificate subject
 * 5. Return valid: boolean
 */
export function verifyProofOfAttention(
  input: IndependentVerificationInput
): IndependentVerificationResult {
  // Implementation per VAP spec
  // This is the reference algorithm - any VAP-compliant verifier MUST produce same result
  throw new Error('Normative algorithm - implement per VAP spec');
}

/**
 * Protocol Openness Contract (S11)
 * Machine-readable contract for VAP openness and independent conformance
 */
export const protocolOpennessContract = {
  // Specification
  specLicense: 'CC0',
  specLocation: 'docs/specs/0001-verified-attention-protocol.md',
  specVersion: '1.0',

  // Open standards only
  allowedStandards: [
    'JSON (RFC 8259)',
    'JWS (RFC 7515)',
    'JWK (RFC 7517)',
    'ISO 8601',
    'UUID (RFC 4122)',
    'SHA-256 (FIPS 180-4)',
    'X.509 (RFC 5280)'
  ],
  prohibitedDependencies: [
    'proprietary VAE packages',
    'internal APIs',
    'vendor-specific extensions'
  ],

  // Conformance suite
  conformanceSuite: {
    location: 'contracts/contract-tests/',
    entryPoint: 'provider-verify.js',
    independentExecution: true,
    zeroVAEDependencies: true
  },

  // Verification independence
  verification: {
    consumerSide: true,
    requiresVAEAPI: false,
    requiredInputs: ['PoA', 'verifierPublicKey'],
    algorithm: 'JWS verification + expiry + key match'
  },
  conformanceLevels: {
    'VAP-Core': {
      description: 'Evidence + Claim + PoA structure + independent verification',
      requiredTests: ['provider-verify.js'],
      schemas: ['evidence', 'claim', 'poa']
    },
    'VAP-Extended': {
      description: 'Core + policy evaluation + confidence calibration',
      requiredTests: ['provider-verify.js', 'integration-cicd.js'],
      schemas: ['evidence', 'claim', 'poa', 'policy', 'confidence']
    },
    'VAP-Full': {
      description: 'Extended + fraud detection + reward intelligence',
      requiredTests: ['provider-verify.js', 'integration-cicd.js', 'load-reconcile.js'],
      schemas: ['evidence', 'claim', 'poa', 'policy', 'confidence', 'fraud', 'reward']
    }
  },

  // VAP Schema definitions (normative)
  schemas: {
    evidence: {
      requiredFields: [
        'evidenceId', 'sessionId', 'sourceId', 'timestamp',
        'schemaVersion', 'signals', 'integrityHash', 'validatorId', 'validatedAt'
      ],
      types: {
        evidenceId: 'uuid-v4',
        sessionId: 'uuid-v4',
        sourceId: 'string',
        timestamp: 'ISO 8601',
        schemaVersion: 'integer',
        signals: 'object',
        integrityHash: 'sha256-hex',
        validatorId: 'string',
        validatedAt: 'ISO 8601'
      }
    },
    claim: {
      requiredFields: [
        'claimId', 'sessionId', 'claimType', 'confidence',
        'evidenceClasses', 'policyId', 'modelVersion'
      ],
      types: {
        claimId: 'uuid-v4',
        sessionId: 'uuid-v4',
        claimType: 'string (e.g., human_attended_content)',
        confidence: 'number 0.0-1.0',
        evidenceClasses: 'string[]',
        policyId: 'string',
        modelVersion: 'string'
      }
    },
    poa: {
      requiredFields: [
        'proofId', 'claimId', 'verifierId', 'issuedAt', 'expiresAt',
        'signature', 'payload', 'publicKey'
      ],
      types: {
        proofId: 'uuid-v4',
        claimId: 'uuid-v4',
        verifierId: 'string',
        issuedAt: 'ISO 8601',
        expiresAt: 'ISO 8601',
        signature: 'JWS detached signature',
        payload: 'object (claim, confidence, evidenceClasses, policyId, modelVersion)',
        publicKey: 'JWK / X.509 reference'
      }
    }
  }
};
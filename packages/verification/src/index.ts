/**
 * @verified-attention/verification
 *
 * Verification engine, confidence model, and policy engine for VAP Section 9.
 */

// Confidence model
export {
  ConfidenceInputSchema,
  ConfidenceResultSchema,
  ConfidenceConfigSchema,
  DEFAULT_CONFIDENCE_CONFIG,
  calculateConfidence,
  type ConfidenceInput,
  type ConfidenceResult,
  type ConfidenceConfig,
  // Calibrator interfaces/classes
  type Calibrator,
  IdentityCalibrator,
  IsotonicCalibrator,
} from './confidence.js';

// Policy engine
export {
  PolicyConfigSchema,
  DEFAULT_POLICY,
  HIGH_TRUST_POLICY,
  LOW_FRICTION_POLICY,
  evaluatePolicy,
  InMemoryPolicyStore,
  type PolicyConfig,
  type PolicyStore,
  type PolicyEvaluationInput,
  type PolicyEvaluationResult,
} from './policy.js';

// Sprint 10: Extended policy types
export type {
  EvidenceRequirement,
  ConfidenceThresholds,
  FraudLimitPolicy,
  SessionConstraintPolicy,
  PolicyConfig as ExtendedPolicyConfig,
  PolicyStore as ExtendedPolicyStore,
  PolicyEvaluationInput as ExtendedPolicyEvaluationInput,
  PolicyEvaluationResult as ExtendedPolicyEvaluationResult,
} from './policy/types.js';

export { PolicyType } from './policy/types.js';

export {
  EvidenceRequirementSchema,
  ConfidenceThresholdsSchema,
  FraudLimitPolicySchema,
  SessionConstraintPolicySchema,
  PolicyConfigSchema as ExtendedPolicyConfigSchema,
  DEFAULT_VERIFICATION_POLICY,
  HIGH_TRUST_VERIFICATION_POLICY,
  LOW_FRICTION_VERIFICATION_POLICY,
  InMemoryPolicyStore as ExtendedInMemoryPolicyStore,
  evaluatePolicy as evaluateExtendedPolicy,
} from './policy/types.js';

// Verification outcomes
export {
  OutcomeSemantics,
  determineOutcome,
  isTerminalOutcome,
  isValidOutcomeTransition,
} from './outcomes.js';

// Re-export VerificationOutcome from core
export { VerificationOutcome, VerificationOutcomeSchema } from '@verified-attention/core';

// Verification engine
export {
  VerificationInputSchema,
  VerificationResultSchema,
  VerificationEngine,
  createVerificationEngine,
  type VerificationInput,
  type VerificationResult,
} from './engine.js';

// Key management (VAP Section 10)
export {
  type VerifierKeyPair,
  generateKeyPair,
  exportPublicKey,
  rotateKey,
  isKeyActive,
} from './keys.js';

// HSM interface stub
export {
  type HSMInterface,
  StubHSM,
  hsm,
} from './hsm.js';

// Audit logging
export {
  type KeyOperation,
  type AuditEntry,
  logKeyOperation,
  searchAuditLog,
  getAuditLog,
} from './audit.js';

// Proof signing service (VAP Section 10)
export {
  type ProofSignEvent,
  onProofSigned,
  signProof,
} from './signing.js';

// Proof verification (VAP Section 10)
export {
  verifyProofSignature,
  verifyProofHash,
  verifyProof,
} from './verify.js';
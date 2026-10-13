/**
 * Verification Outcome Semantics (VAP Section 9)
 *
 * Outcome codes and their semantic meaning for verification decisions.
 * Outcomes are deterministic given the same evidence and policy.
 */

import { VerificationOutcome, VerificationOutcomeSchema } from '@verified-attention/core';

// Re-export for convenience
export { VerificationOutcome, VerificationOutcomeSchema } from '@verified-attention/core';

/**
 * Outcome semantics — describes what each outcome code means
 */
export const OutcomeSemantics: Record<VerificationOutcome, {
  code: VerificationOutcome;
  label: string;
  description: string;
  isTerminal: boolean;
  canTransitionTo: VerificationOutcome[];
}> = {
  [VerificationOutcome.PASS]: {
    code: VerificationOutcome.PASS,
    label: 'PASS',
    description: 'Confidence >= threshold & all required signals present. Verification succeeded.',
    isTerminal: true,
    canTransitionTo: [],
  },
  [VerificationOutcome.FAIL]: {
    code: VerificationOutcome.FAIL,
    label: 'FAIL',
    description: 'Fraud detected or confidence significantly below threshold. Verification failed.',
    isTerminal: true,
    canTransitionTo: [],
  },
  [VerificationOutcome.INSUFFICIENT]: {
    code: VerificationOutcome.INSUFFICIENT,
    label: 'INSUFF',
    description: 'Incomplete evidence yielded no decision. More evidence cannot change outcome.',
    isTerminal: true,
    canTransitionTo: [],
  },
  [VerificationOutcome.PENDING]: {
    code: VerificationOutcome.PENDING,
    label: 'PENDING',
    description: 'Awaiting more evidence. Decision deferred until more evidence arrives.',
    isTerminal: false,
    canTransitionTo: [
      VerificationOutcome.PASS,
      VerificationOutcome.FAIL,
      VerificationOutcome.INSUFFICIENT,
      VerificationOutcome.INCONCLUSIVE,
    ],
  },
  [VerificationOutcome.INCONCLUSIVE]: {
    code: VerificationOutcome.INCONCLUSIVE,
    label: 'INCONCLUSIVE',
    description: 'Evidence evaluated but cannot reach a definitive decision. May require manual review.',
    isTerminal: false,
    canTransitionTo: [
      VerificationOutcome.PASS,
      VerificationOutcome.FAIL,
      VerificationOutcome.INSUFFICIENT,
    ],
  },
};

/**
 * Check if an outcome is terminal (no further transitions possible)
 */
export function isTerminalOutcome(outcome: VerificationOutcome): boolean {
  return OutcomeSemantics[outcome].isTerminal;
}

/**
 * Check if a transition between outcomes is valid
 */
export function isValidOutcomeTransition(
  from: VerificationOutcome,
  to: VerificationOutcome
): boolean {
  if (from === to) return true;
  return OutcomeSemantics[from].canTransitionTo.includes(to);
}

/**
 * Determine outcome from confidence and policy thresholds
 *
 * Decision logic (VAP Section 9):
 * - PASS: confidence >= passThreshold AND all required evidence present
 * - FAIL: fraud detected OR confidence < failThreshold
 * - INSUFFICIENT: evidence count below minimum AND cannot improve
 * - PENDING: evidence count below minimum but can still improve
 * - INCONCLUSIVE: confidence in grey zone (between fail and pass thresholds)
 */
export function determineOutcome(params: {
  confidence: number;
  passThreshold: number;
  failThreshold: number;
  evidenceCount: number;
  minEvidenceCount: number;
  allRequiredPresent: boolean;
  fraudDetected: boolean;
  canReceiveMoreEvidence: boolean;
}): VerificationOutcome {
  const {
    confidence,
    passThreshold,
    failThreshold,
    evidenceCount,
    minEvidenceCount,
    allRequiredPresent,
    fraudDetected,
    canReceiveMoreEvidence,
  } = params;

  // Fraud = immediate FAIL
  if (fraudDetected) {
    return VerificationOutcome.FAIL;
  }

  // Confidence way below threshold = FAIL
  if (confidence < failThreshold) {
    return VerificationOutcome.FAIL;
  }

  // Confidence above threshold with all required evidence = PASS
  if (confidence >= passThreshold && allRequiredPresent) {
    return VerificationOutcome.PASS;
  }

  // Not enough evidence
  if (evidenceCount < minEvidenceCount) {
    if (canReceiveMoreEvidence) {
      return VerificationOutcome.PENDING;
    }
    return VerificationOutcome.INSUFFICIENT;
  }

  // Confidence in grey zone (between fail and pass)
  if (confidence >= failThreshold && confidence < passThreshold) {
    if (canReceiveMoreEvidence) {
      return VerificationOutcome.PENDING;
    }
    return VerificationOutcome.INCONCLUSIVE;
  }

  // Confidence OK but missing required evidence
  if (confidence >= passThreshold && !allRequiredPresent) {
    if (canReceiveMoreEvidence) {
      return VerificationOutcome.PENDING;
    }
    return VerificationOutcome.INCONCLUSIVE;
  }

  return VerificationOutcome.INCONCLUSIVE;
}

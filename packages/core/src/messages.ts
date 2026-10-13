import { z } from 'zod';
import { SessionIdSchema, PolicyIdSchema, SignatureSchema } from './common';
import { EvidenceSchema } from './evidence';

/**
 * SubmitEvidence message schema
 */
export const SubmitEvidenceSchema = z.object({
  session_id: SessionIdSchema,
  evidence_item: EvidenceSchema,
  producer_signature: SignatureSchema.optional()
});

export type SubmitEvidence = z.infer<typeof SubmitEvidenceSchema>;

/**
 * ClaimRequest message schema
 */
export const ClaimRequestSchema = z.object({
  session_id: SessionIdSchema,
  policy_id: PolicyIdSchema,
  requester_id: z.string().min(1)
});

export type ClaimRequest = z.infer<typeof ClaimRequestSchema>;

/**
 * VerificationCreate message schema
 */
export const VerificationCreateSchema = z.object({
  session_id: SessionIdSchema,
  policy: PolicyIdSchema,
  threshold: z.number().min(0).max(1)
});

export type VerificationCreate = z.infer<typeof VerificationCreateSchema>;

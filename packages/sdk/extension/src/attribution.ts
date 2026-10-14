/**
 * Extension-Side Prior Attention Attribution Store (Sprint 16, Unit 9)
 * Stores anonymous proofs earned across social platforms (LinkedIn, YouTube, Substack)
 * and answers first-party zero-knowledge attribution queries on brand conversion pages.
 */

import crypto from 'node:crypto';

export interface PriorAttentionProofEntry {
  proofUrn: string;
  organizationId: string;
  platform: string;
  contentUri: string;
  dwellTimeMs: number;
  confidenceScore: number;
  timestamp: string;
}

export interface PriorAttentionVoucher {
  organizationId: string;
  platform: string;
  proofUrn: string;
  exposureTimestamp: string;
  confidenceScore: number;
  lookbackWindowDays: number;
  attestationSignature: string;
}

export class ExtensionAttributionStore {
  private proofs: PriorAttentionProofEntry[] = [];
  private maxEntries = 100; // Ring buffer

  public storeProof(entry: PriorAttentionProofEntry): void {
    this.proofs.unshift(entry);
    if (this.proofs.length > this.maxEntries) {
      this.proofs.pop();
    }
  }

  public getProofs(): readonly PriorAttentionProofEntry[] {
    return this.proofs;
  }

  public queryPriorExposure(options: {
    organizationId: string;
    lookbackDays?: number;
  }): PriorAttentionVoucher | null {
    const lookbackDays = options.lookbackDays ?? 30;
    const cutoffTime = Date.now() - lookbackDays * 86400 * 1000;

    const matched = this.proofs.find((p) => {
      const matchOrg = !options.organizationId || p.organizationId === options.organizationId || p.contentUri.includes(options.organizationId);
      const withinWindow = new Date(p.timestamp).getTime() >= cutoffTime;
      return matchOrg && withinWindow && p.confidenceScore >= 0.6;
    });

    if (!matched) return null;

    // Mint local Ed25519/HMAC attestation signature without disclosing user ID
    const signatureData = `${matched.proofUrn}:${matched.organizationId}:${matched.timestamp}:${matched.confidenceScore}`;
    const attestationSignature = crypto
      .createHmac('sha256', 'vap-local-client-entropy')
      .update(signatureData)
      .digest('hex');

    return {
      organizationId: matched.organizationId || options.organizationId,
      platform: matched.platform,
      proofUrn: matched.proofUrn,
      exposureTimestamp: matched.timestamp,
      confidenceScore: matched.confidenceScore,
      lookbackWindowDays: lookbackDays,
      attestationSignature
    };
  }

  public clear(): void {
    this.proofs = [];
  }
}

export const defaultAttributionStore = new ExtensionAttributionStore();

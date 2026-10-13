/**
 * TLS Manager (VAE Sprint 14)
 *
 * Internal mTLS and external TLS 1.3 configuration.
 */

import { z } from 'zod';

// ─── Types ────────────────────────────────────────────────────────────────────

export const TLSConfigurationSchema = z.object({
  // External TLS
  external: z.object({
    enabled: z.boolean().default(true),
    minVersion: z.enum(['TLS_1_2', 'TLS_1_3']).default('TLS_1_3'),
    cipherSuites: z.array(z.string()).default([
      'TLS_AES_256_GCM_SHA384',
      'TLS_CHACHA20_POLY1305_SHA256',
      'TLS_AES_128_GCM_SHA256',
    ]),
    certificate: z.string().optional(),
    privateKey: z.string().optional(),
    port: z.number().int().positive().default(443),
    hsts: z.boolean().default(true),
    hstsMaxAge: z.number().int().positive().default(31536000),
  }).default({}),
  // Internal mTLS
  internal: z.object({
    enabled: z.boolean().default(true),
    minVersion: z.enum(['TLS_1_2', 'TLS_1_3']).default('TLS_1_3'),
    certificate: z.string().optional(),
    privateKey: z.string().optional(),
    caCertificate: z.string().optional(),
    port: z.number().int().positive().default(8443),
    requireClientCert: z.boolean().default(true),
    allowedClientCerts: z.array(z.string()).default([]),
  }).default({}),
  // Certificate management
  certificates: z.object({
    autoRenew: z.boolean().default(true),
    renewalDaysBeforeExpiry: z.number().int().positive().default(30),
    issuer: z.string().optional(),
  }).default({}),
});

export type TLSConfiguration = z.infer<typeof TLSConfigurationSchema>;

export const TLSStatusSchema = z.object({
  external: z.object({
    enabled: z.boolean(),
    protocolVersion: z.string().optional(),
    cipherSuite: z.string().optional(),
    certificateExpiry: z.string().datetime().optional(),
    hstsEnabled: z.boolean(),
  }),
  internal: z.object({
    enabled: z.boolean(),
    protocolVersion: z.string().optional(),
    cipherSuite: z.string().optional(),
    certificateExpiry: z.string().datetime().optional(),
    mTLSRequired: z.boolean(),
  }),
  overallStatus: z.enum(['HEALTHY', 'DEGRADED', 'CRITICAL']),
  issues: z.array(z.string()).default([]),
});

export type TLSStatus = z.infer<typeof TLSStatusSchema>;

export interface TLSManager {
  configure(config: TLSConfiguration): void;
  getStatus(): TLSStatus;
  getExternalConfig(): TLSConfiguration['external'];
  getInternalConfig(): TLSConfiguration['internal'];
  checkCertificateExpiry(): { expiringSoon: boolean; daysUntilExpiry: number };
  rotateCertificate(environment: 'external' | 'internal'): void;
  generateSelfSignedCert(hostname: string, days: number): { certificate: string; privateKey: string };
}

// ─── TLS Manager Implementation ───────────────────────────────────────────────

export class TLSManagerImpl implements TLSManager {
  private config: TLSConfiguration;
  private status: TLSStatus;

  constructor() {
    this.config = {
      external: {},
      internal: {},
      certificates: {},
    };
    this.status = {
      external: {
        enabled: true,
        protocolVersion: 'TLS 1.3',
        cipherSuite: 'TLS_AES_256_GCM_SHA384',
        certificateExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        hstsEnabled: true,
      },
      internal: {
        enabled: true,
        protocolVersion: 'TLS 1.3',
        cipherSuite: 'TLS_AES_256_GCM_SHA384',
        certificateExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        mTLSRequired: true,
      },
      overallStatus: 'HEALTHY',
      issues: [],
    };
  }

  configure(config: TLSConfiguration): void {
    this.config = config;
    this.updateStatus();
  }

  getStatus(): TLSStatus {
    return this.status;
  }

  getExternalConfig(): TLSConfiguration['external'] {
    return this.config.external;
  }

  getInternalConfig(): TLSConfiguration['internal'] {
    return this.config.internal;
  }

  checkCertificateExpiry(): { expiringSoon: boolean; daysUntilExpiry: number } {
    const externalExpiry = new Date(this.status.external.certificateExpiry ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString());
    const internalExpiry = new Date(this.status.internal.certificateExpiry ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString());
    const now = new Date();

    const externalDays = Math.floor((externalExpiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    const internalDays = Math.floor((internalExpiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    const minDays = Math.min(externalDays, internalDays);

    return {
      expiringSoon: minDays < this.config.certificates.renewalDaysBeforeExpiry || minDays < 0,
      daysUntilExpiry: minDays,
    };
  }

  rotateCertificate(_environment: 'external' | 'internal'): void {
    // In production, request new certificate from CA
    // For now, extend expiry by 365 days
    const newExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    this.status.external.certificateExpiry = newExpiry;
    this.status.internal.certificateExpiry = newExpiry;
    this.updateStatus();
  }

  generateSelfSignedCert(hostname: string, days: number): { certificate: string; privateKey: string } {
    // In production, use proper certificate generation
    // For now, return placeholder certificates
    return {
      certificate: `-----BEGIN CERTIFICATE-----\
MIIDXTCCAkWgAwIBAgIJAJC1HiIAZAiUMA0Gc... (self-signed for ${hostname})`,
      privateKey: `-----BEGIN PRIVATE KEY-----\
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgw...`,
    };
  }

  private updateStatus(): void {
    const issues: string[] = [];

    if (!this.config.external.enabled) {
      issues.push('External TLS is disabled');
    }
    if (!this.config.internal.enabled) {
      issues.push('Internal mTLS is disabled');
    }
    if (this.config.external.minVersion === 'TLS_1_2') {
      issues.push('External TLS minimum version is TLS 1.2 (recommend TLS 1.3)');
    }

    const expiryCheck = this.checkCertificateExpiry();
    if (expiryCheck.expiringSoon) {
      issues.push(`Certificate expiring in ${expiryCheck.daysUntilExpiry} days`);
    }

    const overallStatus = issues.length === 0 ? 'HEALTHY' :
      issues.some(i => i.includes('disabled')) ? 'CRITICAL' : 'DEGRADED';

    this.status = {
      external: {
        enabled: this.config.external.enabled,
        protocolVersion: this.config.external.minVersion === 'TLS_1_3' ? 'TLS 1.3' : 'TLS 1.2',
        cipherSuite: this.config.external.cipherSuites[0] || 'N/A',
        certificateExpiry: this.status.external.certificateExpiry,
        hstsEnabled: this.config.external.hsts,
      },
      internal: {
        enabled: this.config.internal.enabled,
        protocolVersion: this.config.internal.minVersion === 'TLS_1_3' ? 'TLS 1.3' : 'TLS 1.2',
        cipherSuite: this.config.external.cipherSuites[0] || 'N/A',
        certificateExpiry: this.status.internal.certificateExpiry,
        mTLSRequired: this.config.internal.requireClientCert,
      },
      overallStatus,
      issues,
    };
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

let _manager: TLSManager | null = null;

export function getTLSManager(): TLSManager {
  if (!_manager) {
    _manager = new TLSManagerImpl();
  }
  return _manager;
}

export function setTLSManager(manager: TLSManager): void {
  _manager = manager;
}

/**
 * TLS Manager Tests (VAE Sprint 14)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getTLSManager } from './index';

describe('TLS Manager', () => {
  let manager;

  beforeEach(() => {
    vi.resetModules();
    manager = getTLSManager();
  });

  it('has default configuration', () => {
    const status = manager.getStatus();
    expect(status.overallStatus).toBe('HEALTHY');
    expect(status.external.enabled).toBe(true);
    expect(status.internal.enabled).toBe(true);
    expect(status.external.hstsEnabled).toBe(true);
    expect(status.internal.mTLSRequired).toBe(true);
  });

  it('external TLS uses TLS 1.3 by default', () => {
    const config = manager.getExternalConfig();
    expect(config.minVersion).toBe('TLS_1_3');
    expect(config.hsts).toBe(true);
    expect(config.hstsMaxAge).toBe(31536000);
  });

  it('internal mTLS uses TLS 1.3 by default', () => {
    const config = manager.getInternalConfig();
    expect(config.minVersion).toBe('TLS_1_3');
    expect(config.requireClientCert).toBe(true);
  });

  it('configures custom TLS settings', () => {
    manager.configure({
      external: {
        enabled: true,
        minVersion: 'TLS_1_2',
        cipherSuites: ['TLS_AES_256_GCM_SHA384'],
        port: 443,
        hsts: false,
        hstsMaxAge: 0,
      },
      internal: {
        enabled: true,
        minVersion: 'TLS_1_3',
        port: 8443,
        requireClientCert: true,
      },
      certificates: { autoRenew: true, renewalDaysBeforeExpiry: 14 },
    });

    const status = manager.getStatus();
    expect(status.external.hstsEnabled).toBe(false);
    expect(status.issues).toContain('External TLS minimum version is TLS 1.2');
  });

  it('detects certificate expiry', () => {
    const check = manager.checkCertificateExpiry();
    expect(check.daysUntilExpiry).toBeGreaterThan(0);
    expect(check.expiringSoon).toBe(false);
  });

  it('rotates certificates', () => {
    const oldCheck = manager.checkCertificateExpiry();
    manager.rotateCertificate('external');
    const newCheck = manager.checkCertificateExpiry();
    expect(newCheck.daysUntilExpiry).toBeGreaterThan(oldCheck.daysUntilExpiry);
  });

  it('overall status is CRITICAL when TLS disabled', () => {
    manager.configure({
      external: { enabled: false, minVersion: 'TLS_1_3', cipherSuites: [], port: 443, hsts: true, hstsMaxAge: 31536000 },
      internal: { enabled: false, minVersion: 'TLS_1_3', certificate: '', privateKey: '', caCertificate: '', port: 8443, requireClientCert: true, allowedClientCerts: [] },
      certificates: { autoRenew: true, renewalDaysBeforeExpiry: 30 },
    });

    const status = manager.getStatus();
    expect(status.overallStatus).toBe('CRITICAL');
    expect(status.issues).toContain('External TLS is disabled');
    expect(status.issues).toContain('Internal mTLS is disabled');
  });

  it('generates self-signed certificate (stub)', () => {
    const cert = manager.generateSelfSignedCert('test.example.com', 365);
    expect(cert.certificate).toContain('BEGIN CERTIFICATE');
    expect(cert.privateKey).toContain('BEGIN PRIVATE KEY');
  });

  it('disabled external TLS shows in status', () => {
    manager.configure({
      external: { enabled: false, minVersion: 'TLS_1_3', cipherSuites: [], port: 443, hsts: true, hstsMaxAge: 31536000 },
      internal: { enabled: true, minVersion: 'TLS_1_3', certificate: '', privateKey: '', caCertificate: '', port: 8443, requireClientCert: true, allowedClientCerts: [] },
      certificates: { autoRenew: true, renewalDaysBeforeExpiry: 30 },
    });

    const status = manager.getStatus();
    expect(status.external.enabled).toBe(false);
    expect(status.issues).toContain('External TLS is disabled');
  });
});

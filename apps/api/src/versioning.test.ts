import { describe, it, expect } from 'vitest';
import { resolveVersion, CURRENT_VERSION, SUPPORTED_VERSIONS } from './versioning';

describe('API versioning', () => {
  it('resolves version from /v1 path', () => {
    expect(resolveVersion('/v1/sessions')).toEqual({ ok: true, version: 1 });
  });

  it('serves current version for unversioned paths', () => {
    expect(resolveVersion('/health')).toEqual({ ok: true, version: CURRENT_VERSION });
  });

  it('resolves via Accept-Version header', () => {
    expect(resolveVersion('/sessions', 'v1')).toEqual({ ok: true, version: 1 });
  });

  it('rejects unsupported versions', () => {
    const res = resolveVersion('/v99/sessions');
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('UNSUPPORTED_VERSION');
  });

  it('rejects malformed version prefixes', () => {
    const res = resolveVersion('/vx/sessions');
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('MALFORMED_VERSION');
  });

  it('rejects malformed Accept-Version header', () => {
    const res = resolveVersion('/sessions', 'latest');
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('MALFORMED_VERSION');
  });

  it('marks deprecated versions with headers', () => {
    SUPPORTED_VERSIONS.push({ major: 0, deprecated: true, sunset: '2030-01-01' });
    try {
      const res = resolveVersion('/v0/sessions');
      expect(res.ok).toBe(true);
      expect(res.deprecationHeaders?.Deprecation).toBe('true');
    } finally {
      SUPPORTED_VERSIONS.pop();
    }
  });
});

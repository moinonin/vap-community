/**
 * API versioning support (Sprint 19).
 *
 * Strategy: URL path versioning (`/v1/...`) with header negotiation
 * (`Accept-Version`) as an override signal for future versions, plus a
 * deprecation policy carried in response headers.
 */

export interface ApiVersion {
  major: number;
  deprecated?: boolean;
  sunset?: string; // ISO date when the version is removed
}

export const SUPPORTED_VERSIONS: ApiVersion[] = [
  { major: 1 },
];

export const CURRENT_VERSION = 1;

export interface VersionResult {
  ok: boolean;
  version: number;
  /** Set when the resolved version is deprecated */
  deprecationHeaders?: Record<string, string>;
  error?: { code: string; message: string };
}

/**
 * Resolve the API version for a request path + optional Accept-Version header.
 * Path form: /v<major>/... (anything else resolves to unversioned error for /v* paths).
 */
export function resolveVersion(path: string, acceptVersionHeader?: string): VersionResult {
  const match = /^\/v(\d+)(\/|$)/.exec(path);

  let version: number;
  if (match) {
    version = Number(match[1]);
  } else if (path.startsWith('/v')) {
    return {
      ok: false,
      version: -1,
      error: { code: 'MALFORMED_VERSION', message: `malformed version prefix in path: ${path}` },
    };
  } else if (acceptVersionHeader) {
    const hv = /^v?(\d+)$/.exec(acceptVersionHeader.trim());
    if (!hv) {
      return {
        ok: false,
        version: -1,
        error: { code: 'MALFORMED_VERSION', message: `invalid Accept-Version header: ${acceptVersionHeader}` },
      };
    }
    version = Number(hv[1]);
  } else {
    // Unversioned path without header: serve current version
    version = CURRENT_VERSION;
  }

  const supported = SUPPORTED_VERSIONS.find(v => v.major === version);
  if (!supported) {
    return {
      ok: false,
      version,
      error: {
        code: 'UNSUPPORTED_VERSION',
        message: `API version v${version} is not supported (supported: ${SUPPORTED_VERSIONS.map(v => 'v' + v.major).join(', ')})`,
      },
    };
  }

  const result: VersionResult = { ok: true, version };
  if (supported.deprecated) {
    result.deprecationHeaders = {
      Deprecation: 'true',
      ...(supported.sunset ? { Sunset: supported.sunset } : {}),
      Link: `</v${CURRENT_VERSION}>; rel="successor-version"`,
    };
  }
  return result;
}

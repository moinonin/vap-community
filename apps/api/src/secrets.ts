/**
 * Secrets Integration (S2.5)
 * Resolution order: Vault (production/staging) → local file (dev) → environment variables.
 * Never commit secrets; .env.local excluded by .gitignore.
 */

import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';

export interface SecretsConfig {
  vault_path: string | null;
  local_file_path: string | null;
}

export interface ResolvedSecrets {
  [key: string]: string;
}

export function resolveSecrets(config: SecretsConfig): ResolvedSecrets {
  const secrets: ResolvedSecrets = {};

  // 1. Vault (production): expected to inject via sidecar / init container
  // For this skeleton, Vault path is validated but not fetched directly.
  // In a full deployment, use @hashicorp/vault-api or Kubernetes Vault Agent.
  if (config.vault_path) {
    console.log(`[Secrets] Vault path configured: ${config.vault_path}`);
    console.log('[Secrets] In production, Vault agent injects secrets at runtime.');
    // Placeholder: Vault SDK would resolve here in full deployment
    // Example: await vaultClient.read(config.vault_path);
    return secrets;
  }

  // 2. Local file (dev only)
  if (config.local_file_path && existsSync(config.local_file_path)) {
    try {
      const content = readFileSync(config.local_file_path, 'utf-8');
      content.split('\n').forEach((line) => {
        const [k, v] = line.split('=', 2);
        if (k && v) secrets[k.trim()] = v.trim();
      });
      console.log(`[Secrets] Loaded ${Object.keys(secrets).length} keys from ${config.local_file_path}`);
    } catch (err) {
      console.error('[Secrets] Failed to load local secrets:', err);
    }
  } else if (config.local_file_path) {
    console.log(`[Secrets] No local file at ${config.local_file_path}; using environment variables`);
  }

  // 3. Environment variables (always available as final fallback)
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined && k.startsWith('VAE_')) {
      secrets[k] = v;
    }
  }

  return secrets;
}

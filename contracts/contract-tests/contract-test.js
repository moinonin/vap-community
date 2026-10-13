#!/usr/bin/env node
/**
 * CI Gate: Contract Test Runner (S3.4)
 * Validates contract JSON files are parseable and match expected schemas.
 * In a full Pact setup, this would invoke `pact.cli.verify()` against running providers.
 */

import { readFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const contractsDir = new URL('../contracts/', import.meta.url).pathname;
const files = readdirSync(contractsDir).filter(f => f.endsWith('.json'));

let passed = 0;
let failed = 0;

for (const file of files) {
  try {
    const content = JSON.parse(readFileSync(resolve(contractsDir, file), 'utf-8'));
    const hasConsumer = !!content.consumer?.name;
    const hasProvider = !!content.provider?.name;
    const hasInteractions = Array.isArray(content.interactions) && content.interactions.length > 0;

    if (hasConsumer && hasProvider && hasInteractions) {
      console.log(`✓ ${file}: contract valid (${content.interactions.length} interaction(s))`);
      passed++;
    } else {
      console.error(`✗ ${file}: missing required contract fields`);
      failed++;
    }
  } catch (err) {
    console.error(`✗ ${file}: parse error`, err);
    failed++;
  }
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

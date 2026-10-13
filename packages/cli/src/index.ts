#!/usr/bin/env node
/**
 * vap CLI entrypoint. All logic lives in ./cli for testability.
 */

import { run } from './cli';

run(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err) => {
    console.error(`error: ${(err as Error)?.message ?? String(err)}`);
    process.exit(1);
  },
);

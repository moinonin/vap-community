/**
 * Vitest setup for @verified-attention/ml-attention-model
 *
 * Polyfills Node's removed `util.isNullOrUndefined` which @tensorflow/tfjs-node@4.22.0
 * incorrectly imports from Node's built-in util module instead of tfjs-core's util.
 *
 * Node v25+ removed util.isNullOrUndefined (deprecated long ago). The tfjs-node
 * native binding (dist/nodejs_kernel_backend.js) does:
 *   var util_1 = require("util");
 *   if ((0, util_1.isNullOrUndefined)(tensorsOrDtype)) { ... }
 *
 * This setup restores the function so tensor ops (reshape, eye, GRU init) work.
 * We patch the require cache for 'util' so tfjs-node's require('util') gets the polyfill.
 */

const polyfill = (value: unknown): boolean => value === null || value === undefined;

// Patch Node's built-in util module in the require cache BEFORE tfjs-node loads it
const utilModule = require('util');
try {
  // Try direct assignment first (may fail on non-configurable)
  if (typeof utilModule.isNullOrUndefined !== 'function') {
    utilModule.isNullOrUndefined = polyfill;
  }
} catch {
  // If direct assignment fails (non-configurable property), use Object.defineProperty
  try {
    Object.defineProperty(utilModule, 'isNullOrUndefined', {
      value: polyfill,
      writable: true,
      configurable: true,
      enumerable: false,
    });
  } catch {
    // Last resort: replace the entire module in require.cache
    // This ensures tfjs-node's `require('util')` gets our patched version
    const utilCacheKey = require.resolve('util');
    if (require.cache[utilCacheKey]) {
      require.cache[utilCacheKey].exports.isNullOrUndefined = polyfill;
    }
  }
}

// Also patch the ESM import version if different (tfjs-node uses CommonJS require(), not ESM)
try {
  const utilESM = require('util'); // already handled above, but keep for completeness
  if (typeof utilESM.isNullOrUndefined !== 'function') {
    // Can't modify ESM namespace directly, but tfjs-node uses CommonJS require()
  }
} catch {
  // ignore
}

export {};
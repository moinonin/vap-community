/**
 * VAP Conformance Test Framework
 * Provides test runner, fixtures, and assertions for VAP conformance testing
 */

import type { z } from 'zod';

// ─── Types ──────────────────────────────────────────────────────────────

export interface ConformanceResult {
  passed: boolean;
  errors: ConformanceError[];
  warnings: ConformanceWarning[];
  metadata: Record<string, unknown>;
}

export interface ConformanceError {
  code: string;
  message: string;
  path?: (string | number)[];
  severity: 'error' | 'warning';
}

export interface ConformanceWarning {
  code: string;
  message: string;
  path?: string[];
}

export interface TestFixture<T> {
  name: string;
  input: unknown;
  expected: T;
  shouldPass: boolean;
}

export interface TestSuiteConfig {
  name: string;
  description: string;
  fixtures: TestFixture<unknown>[];
  validate: (input: unknown) => ConformanceResult;
}

// ─── Core Assertions ────────────────────────────────────────────────────

export function assertConforms(
  result: ConformanceResult,
  message?: string
): void {
  if (!result.passed) {
    const errorMsg = result.errors.map(e => `${e.code}: ${e.message}`).join('\n');
    throw new Error(`${message || 'Conformance failed'}:\\n${errorMsg}`);
  }
}

export function assertNotConforms(
  result: ConformanceResult,
  message?: string
): void {
  if (result.passed) {
    throw new Error(message || 'Expected conformance to fail but it passed');
  }
}

// ─── Zod Schema Helpers ─────────────────────────────────────────────────

export function validateSchema<T>(
  schema: z.ZodSchema<T>,
  input: unknown
): ConformanceResult {
  const result = schema.safeParse(input);
  
  if (result.success) {
    return {
      passed: true,
      errors: [],
      warnings: [],
      metadata: { parsed: result.data }
    };
  }
  
  return {
    passed: false,
    errors: result.error.issues.map(issue => ({
      code: issue.code,
      message: issue.message,
      path: issue.path,
      severity: 'error' as const
    })),
    warnings: [],
    metadata: {}
  };
}

// ─── Test Runner ────────────────────────────────────────────────────────

export class ConformanceRunner {
  private suites: Map<string, TestSuiteConfig> = new Map();
  private results: Map<string, ConformanceResult[]> = new Map();

  registerSuite(config: TestSuiteConfig): void {
    this.suites.set(config.name, config);
  }

  async runSuite(name: string): Promise<ConformanceResult[]> {
    const suite = this.suites.get(name);
    if (!suite) {
      throw new Error(`Suite not found: ${name}`);
    }

    const results: ConformanceResult[] = [];
    
    for (const fixture of suite.fixtures) {
      const result = suite.validate(fixture.input);
      results.push(result);
      
      if (fixture.shouldPass) {
        assertConforms(result, `Fixture "${fixture.name}" should pass`);
      } else {
        assertNotConforms(result, `Fixture "${fixture.name}" should fail`);
      }
    }
    
    this.results.set(name, results);
    return results;
  }

  async runAll(): Promise<Map<string, ConformanceResult[]>> {
    for (const name of this.suites.keys()) {
      await this.runSuite(name);
    }
    return this.results;
  }

  getResults(): Map<string, ConformanceResult[]> {
    return this.results;
  }

  generateReport(): string {
    const lines = ['# VAP Conformance Test Report', ''];
    
    for (const [suiteName, results] of this.results) {
      const passed = results.filter(r => r.passed).length;
      const total = results.length;
      lines.push(`## ${suiteName}: ${passed}/${total} passed`);
      lines.push('');
      
      for (const result of results) {
        if (!result.passed) {
          lines.push('### FAILED');
          for (const error of result.errors) {
            lines.push(`- **${error.code}**: ${error.message}`);
          }
          lines.push('');
        }
      }
    }
    
    return lines.join('\n');
  }
}

// ─── JUnit XML Output ──────────────────────────────────────────────────

export function generateJUnitXML(results: Map<string, ConformanceResult[]>): string {
  let totalTests = 0;
  let totalFailures = 0;
  const totalErrors = 0;
  const totalTime = 0;

  const testsuites: string[] = [];

  for (const [suiteName, suiteResults] of results) {
    const failures = suiteResults.filter(r => !r.passed).length;
    const tests = suiteResults.length;

    totalTests += tests;
    totalFailures += failures;

    const testcases = suiteResults.map((result: ConformanceResult, i: number) => {
      if (result.passed) {
        return `    <testcase name="test_${i}" classname="${suiteName}" time="0.001"/>`;
      } else {
        const errorMessages = result.errors.map((e: ConformanceError) => `${e.code}: ${e.message}`).join('\n');
        return `    <testcase name="test_${i}" classname="${suiteName}" time="0.001">\n      <failure message="Conformance failed">${errorMessages}</failure>\n    </testcase>`;
      }
    }).join('\n');

    testsuites.push(`  <testsuite name="${suiteName}" tests="${tests}" failures="${failures}" errors="0" time="0">\n${testcases}\n  </testsuite>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuites name="VAP Conformance" tests="${totalTests}" failures="${totalFailures}" errors="${totalErrors}" time="${totalTime.toFixed(3)}">\n${testsuites.join('\n')}\n</testsuites>`;
}

// ─── Fixture Helpers ────────────────────────────────────────────────────

export function createValidFixture<T>(name: string, input: T): TestFixture<T> {
  return { name, input, expected: input, shouldPass: true };
}

export function createInvalidFixture<T>(name: string, input: unknown): TestFixture<T> {
  return { name, input, expected: input as T, shouldPass: false };
}

// ─── Export all ────────────────────────────────────────────────────────

export const conformance = {
  runner: new ConformanceRunner(),
  validateSchema,
  assertConforms,
  assertNotConforms,
  generateJUnitXML,
  createValidFixture,
  createInvalidFixture
};
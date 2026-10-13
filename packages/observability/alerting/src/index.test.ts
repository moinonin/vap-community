/**
 * Alerting Tests (VAE Sprint 13)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getAlertRuleEngine, type AlertRuleEngine, type AlertRule, type Alert } from './index';

describe('Alerting', () => {
  let engine;

  beforeEach(() => {
    vi.resetModules();
    engine = getAlertRuleEngine();
  });

  it('creates an alert rule', () => {
    const rule: AlertRule = {
      id: 'rule-1',
      name: 'High Error Rate',
      description: 'Alert when error rate exceeds 5%',
      severity: 'WARNING',
      channels: ['SLACK'],
      metric: 'errorRateEvidence',
      operator: 'GT',
      threshold: 0.05,
      windowMinutes: 5,
      throttleMinutes: 15,
      autoResolve: true,
      tags: ['pipeline'],
      createdAt: new Date().toISOString(),
    };
    const created = engine.createRule(rule);
    expect(created.id).toBe('rule-1');
    expect(created.name).toBe('High Error Rate');
  });

  it('evaluates metrics and triggers alerts', () => {
    engine.createRule({
      id: 'rule-1',
      name: 'High Error Rate',
      severity: 'WARNING',
      channels: ['SLACK'],
      metric: 'errorRateEvidence',
      operator: 'GT',
      threshold: 0.05,
      windowMinutes: 5,
      throttleMinutes: 0,
      autoResolve: true,
      tags: [],
      createdAt: new Date().toISOString(),
    });

    const alerts = engine.evaluate({ errorRateEvidence: 0.1 });
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0].severity).toBe('WARNING');
    expect(alerts[0].metric).toBe('errorRateEvidence');
  });

  it('does not trigger when below threshold', () => {
    engine.createRule({
      id: 'rule-1',
      name: 'High Error Rate',
      severity: 'WARNING',
      channels: ['SLACK'],
      metric: 'errorRateEvidence',
      operator: 'GT',
      threshold: 0.05,
      windowMinutes: 5,
      throttleMinutes: 0,
      autoResolve: true,
      tags: [],
      createdAt: new Date().toISOString(),
    });

    const alerts = engine.evaluate({ errorRateEvidence: 0.01 });
    expect(alerts).toHaveLength(0);
  });

  it('listRules returns all rules', () => {
    engine.createRule({
      id: 'rule-1',
      name: 'Rule 1',
      severity: 'INFO',
      channels: ['EMAIL'],
      metric: 'test',
      operator: 'GT',
      threshold: 1,
      windowMinutes: 5,
      throttleMinutes: 0,
      autoResolve: true,
      tags: [],
      createdAt: new Date().toISOString(),
    });
    engine.createRule({
      id: 'rule-2',
      name: 'Rule 2',
      severity: 'WARNING',
      channels: ['SLACK'],
      metric: 'test2',
      operator: 'LT',
      threshold: 0.5,
      windowMinutes: 5,
      throttleMinutes: 0,
      autoResolve: true,
      tags: [],
      createdAt: new Date().toISOString(),
    });

    const rules = engine.listRules();
    expect(rules.length).toBe(2);
  });

  it('getActiveAlerts returns unresolved alerts', () => {
    engine.createRule({
      id: 'rule-1',
      name: 'Test',
      severity: 'WARNING',
      channels: ['SLACK'],
      metric: 'test',
      operator: 'GT',
      threshold: 0.5,
      windowMinutes: 5,
      throttleMinutes: 0,
      autoResolve: true,
      tags: [],
      createdAt: new Date().toISOString(),
    });

    engine.evaluate({ test: 0.8 });
    const active = engine.getActiveAlerts();
    expect(active.length).toBeGreaterThan(0);
  });

  it('resolveAlert resolves an alert', () => {
    engine.createRule({
      id: 'rule-resolve-1',
      name: 'Test',
      severity: 'WARNING',
      channels: ['SLACK'],
      metric: 'test',
      operator: 'GT',
      threshold: 0.5,
      windowMinutes: 5,
      throttleMinutes: 0,
      autoResolve: false,
      tags: [],
      createdAt: new Date().toISOString(),
    });

    const alerts = engine.evaluate({ test: 0.8 });
    const alertId = alerts[0].id;
    const resolved = engine.resolveAlert(alertId);
    expect(resolved).toBe(true);
    const active = engine.getActiveAlerts();
    expect(active.find(a => a.id === alertId)).toBeUndefined();
  });

  it('deleteRule removes a rule', () => {
    engine.createRule({
      id: 'rule-delete',
      name: 'To Delete',
      severity: 'INFO',
      channels: ['EMAIL'],
      metric: 'test',
      operator: 'GT',
      threshold: 1,
      windowMinutes: 5,
      throttleMinutes: 0,
      autoResolve: true,
      tags: [],
      createdAt: new Date().toISOString(),
    });
    expect(engine.deleteRule('rule-delete')).toBe(true);
    expect(engine.getRule('rule-delete')).toBeUndefined();
  });
});

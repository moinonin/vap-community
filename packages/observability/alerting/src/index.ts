/**
 * Alerting Rules (VAE Sprint 13)
 *
 * PagerDuty/Slack/email alerting with configurable rules.
 */

import { z } from 'zod';

// ─── Types ────────────────────────────────────────────────────────────────────

export const AlertSeveritySchema = z.enum(['INFO', 'WARNING', 'CRITICAL', 'EMERGENCY']);
export type AlertSeverity = z.infer<typeof AlertSeveritySchema>;

export const AlertChannelSchema = z.enum(['PAGERDUTY', 'SLACK', 'EMAIL', 'WEBHOOK']);
export type AlertChannel = z.infer<typeof AlertChannelSchema>;

export const AlertRuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  severity: AlertSeveritySchema,
  channels: z.array(AlertChannelSchema),
  // Condition
  metric: z.string().min(1), // e.g., 'errorRateEvidence'
  operator: z.enum(['GT', 'GTE', 'LT', 'LTE', 'EQ', 'NEQ']),
  threshold: z.number(),
  // Evaluation window
  windowMinutes: z.number().int().positive().default(5),
  // Throttling
  throttleMinutes: z.number().int().nonnegative().default(15),
  // Whether to auto-resolve
  autoResolve: z.boolean().default(true),
  // Tags
  tags: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
});

export type AlertRule = z.infer<typeof AlertRuleSchema>;

export const AlertSchema = z.object({
  id: z.string().min(1),
  ruleId: z.string().min(1),
  severity: AlertSeveritySchema,
  message: z.string().min(1),
  metric: z.string().min(1),
  currentValue: z.number(),
  threshold: z.number(),
  triggeredAt: z.string().datetime(),
  resolvedAt: z.string().datetime().optional(),
  channels: z.array(AlertChannelSchema),
  tags: z.array(z.string()).default([]),
});

export type Alert = z.infer<typeof AlertSchema>;

export interface AlertRuleEngine {
  createRule(rule: AlertRule): AlertRule;
  getRule(ruleId: string): AlertRule | undefined;
  listRules(): AlertRule[];
  deleteRule(ruleId: string): boolean;
  evaluate(metrics: Record<string, number>): Alert[];
  resolveAlert(alertId: string): boolean;
  getActiveAlerts(): Alert[];
}

// ─── In-Memory Alerting ───────────────────────────────────────────────────────

export class AlertRuleEngineImpl implements AlertRuleEngine {
  private rules = new Map<string, AlertRule>();
  private alerts = new Map<string, Alert>();
  private lastTriggered = new Map<string, string>(); // ruleId -> ISO timestamp
  private alertCounter = 0;

  createRule(rule: AlertRule): AlertRule {
    rule.createdAt = rule.createdAt || new Date().toISOString();
    this.rules.set(rule.id, rule);
    return rule;
  }

  getRule(ruleId: string): AlertRule | undefined {
    return this.rules.get(ruleId);
  }

  listRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  deleteRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  evaluate(metrics: Record<string, number>): Alert[] {
    const triggered: Alert[] = [];
    const now = new Date().toISOString();

    for (const rule of this.rules.values()) {
      const value = metrics[rule.metric];
      if (value === undefined) continue;

      const shouldTrigger = this.evaluateCondition(value, rule);
      const lastTrigger = this.lastTriggered.get(rule.id);

      // Check throttle
      if (shouldTrigger && lastTrigger) {
        const last = new Date(lastTrigger);
        const elapsed = (new Date(now).getTime() - last.getTime()) / 60000;
        if (elapsed < rule.throttleMinutes) continue;
      }

      // Check if already active
      const existingAlert = Array.from(this.alerts.values()).find(
        a => a.ruleId === rule.id && !a.resolvedAt
      );

      if (shouldTrigger) {
        if (existingAlert) {
          // Update existing
          existingAlert.currentValue = value;
          existingAlert.message = this.buildMessage(rule, value);
        } else {
          // Create new
          const alert: Alert = {
            id: `alert_${Date.now()}_${++this.alertCounter}`,
            ruleId: rule.id,
            severity: rule.severity,
            message: this.buildMessage(rule, value),
            metric: rule.metric,
            currentValue: value,
            threshold: rule.threshold,
            triggeredAt: now,
            channels: rule.channels,
            tags: rule.tags,
          };
          this.alerts.set(alert.id, alert);
          triggered.push(alert);
        }
        this.lastTriggered.set(rule.id, now);
      } else if (rule.autoResolve && existingAlert) {
        existingAlert.resolvedAt = now;
      }
    }

    return triggered;
  }

  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;
    alert.resolvedAt = new Date().toISOString();
    return true;
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(a => !a.resolvedAt);
  }

  private evaluateCondition(value: number, rule: AlertRule): boolean {
    switch (rule.operator) {
      case 'GT': return value > rule.threshold;
      case 'GTE': return value >= rule.threshold;
      case 'LT': return value < rule.threshold;
      case 'LTE': return value <= rule.threshold;
      case 'EQ': return value === rule.threshold;
      case 'NEQ': return value !== rule.threshold;
      default: return false;
    }
  }

  private buildMessage(rule: AlertRule, value: number): string {
    const opSymbol = {
      GT: '>',
      GTE: '>=',
      LT: '<',
      LTE: '<=',
      EQ: '=',
      NEQ: '!=',
    }[rule.operator];

    return `${rule.name}: ${rule.metric} is ${value} ${opSymbol} ${rule.threshold} (threshold)`;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

let _engine: AlertRuleEngine | null = null;

export function getAlertRuleEngine(): AlertRuleEngine {
  if (!_engine) {
    _engine = new AlertRuleEngineImpl();
  }
  return _engine;
}

export function setAlertRuleEngine(engine: AlertRuleEngine): void {
  _engine = engine;
}

// ─── AlertRule type re-export ─────────────────────────────────────────────────
// (types already exported above via const/runtime exports)

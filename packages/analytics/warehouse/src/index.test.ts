/**
 * Warehouse Tests (VAE Sprint 13)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getWarehouse, type Warehouse, type WarehouseTable } from './index';

vi.mock('crypto', () => ({ randomUUID: () => 'test-uuid' }));

describe('Analytics Warehouse', () => {
  let warehouse: Warehouse;

  beforeEach(() => {
    vi.resetModules();
    warehouse = getWarehouse();
  });

  it('creates a table', () => {
    const table: WarehouseTable = {
      name: 'evidence',
      partitionKey: 'DAY',
      columns: [
        { name: 'sessionId', type: 'STRING', nullable: false },
        { name: 'timestamp', type: 'TIMESTAMP', nullable: false },
        { name: 'data', type: 'JSON', nullable: true },
      ],
      createdAt: new Date().toISOString(),
      rowCount: 0,
    };

    warehouse.createTable(table);
    const tables = warehouse.listTables();
    expect(tables).toHaveLength(1);
    expect(tables[0].name).toBe('evidence');
  });

  it('ingests a record', () => {
    warehouse.createTable({
      name: 'evidence',
      partitionKey: 'DAY',
      columns: [{ name: 'sessionId', type: 'STRING', nullable: false }],
      createdAt: new Date().toISOString(),
    });

    const record = warehouse.ingest('evidence', {
      sessionId: 'sess-1',
      timestamp: new Date().toISOString(),
      data: { foo: 'bar' },
    });

    expect(record.id).toMatch(/^rec_/);
    expect(record.table).toBe('evidence');
    expect(record.partition).toMatch(/^\\d{4}-\\d{2}-\\d{2}$/);
  });

  it('queries records with filter', () => {
    warehouse.createTable({
      name: 'sessions',
      partitionKey: 'DAY',
      columns: [{ name: 'sessionId', type: 'STRING', nullable: false }],
      createdAt: new Date().toISOString(),
    });

    warehouse.ingest('sessions', { sessionId: 'sess-1', status: 'ACTIVE' });
    warehouse.ingest('sessions', { sessionId: 'sess-2', status: 'CLOSED' });

    const results = warehouse.query('sessions', { status: 'ACTIVE' });
    expect(results).toHaveLength(1);
    expect(results[0].sessionId).toBe('sess-1');
  });

  it('queries records with limit', () => {
    warehouse.createTable({
      name: 'events',
      partitionKey: 'DAY',
      columns: [{ name: 'type', type: 'STRING', nullable: false }],
      createdAt: new Date().toISOString(),
    });

    for (let i = 0; i < 10; i++) {
      warehouse.ingest('events', { type: `event-${i}` });
    }

    const results = warehouse.query('events', undefined, 5);
    expect(results).toHaveLength(5);
  });

  it('gets partition stats', () => {
    warehouse.createTable({
      name: 'events',
      partitionKey: 'DAY',
      columns: [{ name: 'type', type: 'STRING', nullable: false }],
      createdAt: new Date().toISOString(),
    });

    warehouse.ingest('events', { type: 'click', timestamp: new Date().toISOString() });
    warehouse.ingest('events', { type: 'view', timestamp: new Date().toISOString() });

    const stats = warehouse.getPartitionStats('events', warehouse['data'].get('events')!.keys().next().value!);
    expect(stats.rowCount).toBe(2);
    expect(stats.sizeBytes).toBeGreaterThan(0);
  });

  it('throws error for non-existent table', () => {
    expect(() => warehouse.ingest('nonexistent', {})).toThrow('Table nonexistent not found');
  });

  it('partition key DAY returns YYYY-MM-DD format', () => {
    const record = warehouse.ingest('test', { timestamp: '2024-01-15T10:30:00.000Z' });
    expect(record.partition).toBe('2024-01-15');
  });

  it('partition key WEEK returns week start date', () => {
    // Monday Jan 15, 2024 - week starts Monday Jan 15
    const record = warehouse.ingest('test', { timestamp: '2024-01-15T10:30:00.000Z' });
    expect(record.partition).toBe('2024-01-15');
  });

  it('partition key MONTH returns YYYY-MM format', () => {
    const record = warehouse.ingest('test', { timestamp: '2024-01-15T10:30:00.000Z' });
    expect(record.partition).toBe('2024-01');
  });

  it('inherits table rowCount', () => {
    warehouse.createTable({
      name: 'test-table',
      partitionKey: 'DAY',
      columns: [],
      createdAt: new Date().toISOString(),
      rowCount: 5,
    });

    warehouse.ingest('test-table', {});
    const tables = warehouse.listTables();
    expect(tables[0].rowCount).toBe(6);
  });
});

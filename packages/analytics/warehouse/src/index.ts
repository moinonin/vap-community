/**
 * Analytics Data Warehouse (VAE Sprint 13)
 *
 * Columnar data warehouse for analytics, partitioned by day/week/month.
 */

import { z } from 'zod';

// ─── Types ────────────────────────────────────────────────────────────────────

export const WarehouseTableSchema = z.object({
  name: z.string().min(1),
  partitionKey: z.enum(['DAY', 'WEEK', 'MONTH']),
  columns: z.array(z.object({
    name: z.string().min(1),
    type: z.enum(['STRING', 'NUMBER', 'BOOLEAN', 'TIMESTAMP', 'JSON']),
    nullable: z.boolean().default(true),
  })),
  createdAt: z.string().datetime(),
  rowCount: z.number().int().nonnegative().default(0),
});

export type WarehouseTable = z.infer<typeof WarehouseTableSchema>;

export const IngestionRecordSchema = z.object({
  id: z.string().min(1),
  table: z.string().min(1),
  payload: z.record(z.unknown()),
  ingestedAt: z.string().datetime(),
  partition: z.string(),
});

export type IngestionRecord = z.infer<typeof IngestionRecordSchema>;

export interface Warehouse {
  createTable(table: WarehouseTable): void;
  listTables(): WarehouseTable[];
  ingest(table: string, record: Record<string, unknown>): IngestionRecord;
  query(table: string, filter?: Record<string, unknown>, limit?: number): Record<string, unknown>[];
  getPartitionStats(table: string, partition: string): PartitionStats;
}

export interface PartitionStats {
  table: string;
  partition: string;
  rowCount: number;
  sizeBytes: number;
  firstRecord: string;
  lastRecord: string;
}

// ─── In-Memory Warehouse ──────────────────────────────────────────────────────

export class DataWarehouse implements Warehouse {
  private tables = new Map<string, WarehouseTable>();
  private data = new Map<string, Map<string, IngestionRecord>>();
  private recordCounter = 0;

  createTable(table: WarehouseTable): void {
    this.tables.set(table.name, table);
    this.data.set(table.name, new Map());
  }

  listTables(): WarehouseTable[] {
    return Array.from(this.tables.values());
  }

  ingest(tableName: string, record: Record<string, unknown>): IngestionRecord {
    const table = this.tables.get(tableName);
    if (!table) throw new Error(`Table ${tableName} not found`);

    const partition = this.getPartitionKey(record, table.partitionKey);
    const partitionData = this.data.get(tableName)!;
    if (!partitionData.has(partition)) {
      partitionData.set(partition, new Map());
    }

    const id = `rec_${Date.now()}_${++this.recordCounter}`;
    const ingestion: IngestionRecord = {
      id,
      table: tableName,
      payload: record,
      ingestedAt: new Date().toISOString(),
      partition,
    };

    partitionData.get(partition)!.set(id, ingestion);
    table.rowCount = (table.rowCount || 0) + 1;

    return ingestion;
  }

  query(
    tableName: string,
    filter?: Record<string, unknown>,
    limit?: number
  ): Record<string, unknown>[] {
    const partitionData = this.data.get(tableName);
    if (!partitionData) return [];

    const results: Record<string, unknown>[] = [];

    for (const [, records] of partitionData) {
      for (const [, ingestion] of records) {
        if (filter) {
          let matches = true;
          for (const [key, value] of Object.entries(filter)) {
            if (ingestion.payload[key] !== value) {
              matches = false;
              break;
            }
          }
          if (!matches) continue;
        }
        results.push(ingestion.payload);
        if (limit && results.length >= limit) break;
      }
      if (limit && results.length >= limit) break;
    }

    return results;
  }

  getPartitionStats(tableName: string, partition: string): PartitionStats {
    const partitionData = this.data.get(tableName)?.get(partition);
    if (!partitionData) {
      return { table: tableName, partition, rowCount: 0, sizeBytes: 0, firstRecord: '', lastRecord: '' };
    }

    const records = Array.from(partitionData.values());
    const timestamps = records.map(r => r.ingestedAt).sort();
    let sizeBytes = 0;
    for (const r of records) {
      sizeBytes += JSON.stringify(r.payload).length;
    }

    return {
      table: tableName,
      partition,
      rowCount: records.length,
      sizeBytes,
      firstRecord: timestamps[0] || '',
      lastRecord: timestamps[timestamps.length - 1] || '',
    };
  }

  private getPartitionKey(record: Record<string, unknown>, partitionKey: string): string {
    const ts = (record.timestamp as string) || (record.ingestedAt as string) || new Date().toISOString();
    const date = new Date(ts);

    switch (partitionKey) {
      case 'DAY':
        return date.toISOString().split('T')[0];
      case 'WEEK':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return weekStart.toISOString().split('T')[0];
      case 'MONTH':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      default:
        return date.toISOString().split('T')[0];
    }
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

let _warehouse: Warehouse | null = null;

export function getWarehouse(): Warehouse {
  if (!_warehouse) {
    _warehouse = new DataWarehouse();
  }
  return _warehouse;
}

export function setWarehouse(warehouse: Warehouse): void {
  _warehouse = warehouse;
}

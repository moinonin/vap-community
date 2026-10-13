/**
 * Settlement Worker Entrypoint
 * 
 * Runs as a background worker that processes settlement jobs from a queue.
 * For now, provides a CLI interface; in production, connect to Redis/RabbitMQ/Kafka.
 */

import { getSettlementEngine, createSettlement, prepareSettlement, exportSettlement, reconcileSettlement, getSettlementSummary } from './index.js';

interface WorkerJob {
  type: 'create' | 'prepare' | 'export' | 'reconcile' | 'summary';
  payload: Record<string, unknown>;
  idempotencyKey: string;
}

async function processJob(job: WorkerJob): Promise<unknown> {
  switch (job.type) {
    case 'create':
      return createSettlement(
        job.payload.campaignId as string,
        job.payload.periodStart as string,
        job.payload.periodEnd as string
      );
    case 'prepare':
      return prepareSettlement(job.payload.settlementId as string);
    case 'export':
      return exportSettlement(
        job.payload.settlementId as string,
        job.payload.options as Record<string, unknown>
      );
    case 'reconcile':
      return reconcileSettlement(job.payload.settlementId as string);
    case 'summary':
      return getSettlementSummary(
        job.payload.campaignId as string,
        job.payload.dateFrom as string | undefined,
        job.payload.dateTo as string | undefined
      );
    default:
      throw new Error(`Unknown job type: ${job.type}`);
  }
}

// Simple in-memory job queue for demonstration
const jobQueue: WorkerJob[] = [];
const processing = new Set<string>();

export function enqueueJob(job: WorkerJob): void {
  if (processing.has(job.idempotencyKey)) {
    console.log(`Job ${job.idempotencyKey} already processing, skipping`);
    return;
  }
  jobQueue.push(job);
  console.log(`Enqueued job: ${job.type} (${job.idempotencyKey})`);
}

async function processQueue(): Promise<void> {
  while (jobQueue.length > 0) {
    const job = jobQueue.shift()!;
    if (processing.has(job.idempotencyKey)) continue;
    
    processing.add(job.idempotencyKey);
    try {
      console.log(`Processing job: ${job.type} (${job.idempotencyKey})`);
      const result = await processJob(job);
      console.log(`Completed job: ${job.type} (${job.idempotencyKey})`, JSON.stringify(result, null, 2));
    } catch (error) {
      console.error(`Failed job: ${job.type} (${job.idempotencyKey})`, error);
    } finally {
      processing.delete(job.idempotencyKey);
    }
  }
}

// CLI interface
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'create':
    if (args.length < 4) {
      console.error('Usage: node worker.js create <campaignId> <periodStart> <periodEnd> [idempotencyKey]');
      process.exit(1);
    }
    enqueueJob({
      type: 'create',
      payload: { campaignId: args[1], periodStart: args[2], periodEnd: args[3] },
      idempotencyKey: args[4] || `create-${args[1]}-${args[2]}-${args[3]}`
    });
    break;
  case 'prepare':
    if (args.length < 2) {
      console.error('Usage: node worker.js prepare <settlementId> [idempotencyKey]');
      process.exit(1);
    }
    enqueueJob({
      type: 'prepare',
      payload: { settlementId: args[1] },
      idempotencyKey: args[2] || `prepare-${args[1]}`
    });
    break;
  case 'export':
    if (args.length < 2) {
      console.error('Usage: node worker.js export <settlementId> [format] [idempotencyKey]');
      process.exit(1);
    }
    enqueueJob({
      type: 'export',
      payload: { settlementId: args[1], options: { format: args[2] || 'JSON', includeHeaders: true, delimiter: ',', dateFormat: 'ISO' } },
      idempotencyKey: args[3] || `export-${args[1]}-${args[2] || 'JSON'}`
    });
    break;
  case 'reconcile':
    if (args.length < 2) {
      console.error('Usage: node worker.js reconcile <settlementId> [idempotencyKey]');
      process.exit(1);
    }
    enqueueJob({
      type: 'reconcile',
      payload: { settlementId: args[1] },
      idempotencyKey: args[2] || `reconcile-${args[1]}`
    });
    break;
  case 'summary':
    if (args.length < 2) {
      console.error('Usage: node worker.js summary <campaignId> [dateFrom] [dateTo] [idempotencyKey]');
      process.exit(1);
    }
    enqueueJob({
      type: 'summary',
      payload: { campaignId: args[1], dateFrom: args[2], dateTo: args[3] },
      idempotencyKey: args[4] || `summary-${args[1]}`
    });
    break;
  case 'run':
    console.log('Starting settlement worker...');
    setInterval(processQueue, 1000);
    // Keep process alive
    process.stdin.resume();
    break;
  default:
    console.log('Settlement Worker');
    console.log('Usage:');
    console.log('  node worker.js create <campaignId> <periodStart> <periodEnd> [idempotencyKey]');
    console.log('  node worker.js prepare <settlementId> [idempotencyKey]');
    console.log('  node worker.js export <settlementId> [format] [idempotencyKey]');
    console.log('  node worker.js reconcile <settlementId> [idempotencyKey]');
    console.log('  node worker.js summary <campaignId> [dateFrom] [dateTo] [idempotencyKey]');
    console.log('  node worker.js run  (starts continuous queue processor)');
    process.exit(1);
}

// Process any enqueued jobs from CLI
if (command !== 'run') {
  await processQueue();
}
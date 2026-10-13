/**
 * HTTP adapter for the attention model serving service.
 * Thin node:http layer mirroring apps/api thin-adapter style.
 *
 * Routes:
 *   POST /v1/score       { features: number[20] } -> score + drift flag
 *   GET  /v1/model/info  model metadata
 *   GET  /health         liveness
 */

import type { Server } from 'node:http';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AttentionServingModel } from './model.js';
import type { DriftDetector, DriftStatus } from './drift.js';

export interface ScoreRequest {
  features: number[];
}

export interface ScoreResponse {
  attentionProbability: number;
  calibratedConfidence: number;
  modelVersion: string;
  drift: DriftStatus;
  timestamp: string;
}

export interface ServingAppConfig {
  port: number;
  host: string;
}

export const DEFAULT_SERVING_CONFIG: ServingAppConfig = {
  port: 8085,
  host: '0.0.0.0',
};

function parseJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 1024 * 1024) {
        reject(new Error('Body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function handleScore(
  req: IncomingMessage,
  res: ServerResponse,
  model: AttentionServingModel,
  drift: DriftDetector
): Promise<void> {
  try {
    const body = (await parseJsonBody(req)) as Partial<ScoreRequest>;
    if (!Array.isArray(body.features)) {
      sendJson(res, 400, { error: 'Missing features field (expected number[] of length 20)' });
      return;
    }
    const scored = await model.score(body.features);
    drift.observe(body.features);
    const response: ScoreResponse = {
      ...scored,
      drift: drift.getStatus(),
      timestamp: new Date().toISOString(),
    };
    sendJson(res, 200, response);
  } catch (err) {
    sendJson(res, 400, { error: err instanceof Error ? err.message : 'Unknown error' });
  }
}

function handleModelInfo(res: ServerResponse, model: AttentionServingModel, drift: DriftDetector): void {
  sendJson(res, 200, { ...model.getInfo(), drift: drift.getStatus() });
}

function handleHealth(res: ServerResponse, model: AttentionServingModel): void {
  sendJson(res, 200, {
    status: model.isReady() ? 'healthy' : 'unavailable',
    model: 'attention',
    version: model.getInfo().modelVersion,
    uptime: process.uptime(),
  });
}

/**
 * Create the HTTP server for a loaded model + drift detector (not started).
 */
export function createServingServer(
  model: AttentionServingModel,
  drift: DriftDetector,
  config: Partial<ServingAppConfig> = {}
) {
  const cfg = { ...DEFAULT_SERVING_CONFIG, ...config };

  const server = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'POST' && url.pathname === '/v1/score') {
      await handleScore(req, res, model, drift);
    } else if (req.method === 'GET' && url.pathname === '/v1/model/info') {
      handleModelInfo(res, model, drift);
    } else if (req.method === 'GET' && url.pathname === '/health') {
      handleHealth(res, model);
    } else {
      sendJson(res, 404, { error: 'Not found', path: url.pathname });
    }
  });

  return { server, config: cfg };
}

export function startServingServer(
  model: AttentionServingModel,
  drift: DriftDetector,
  config: Partial<ServingAppConfig> = {}
): Promise<{ server: Server; port: number }> {
  const { server, config: cfg } = createServingServer(model, drift, config);
  return new Promise(resolve => {
    server.listen(cfg.port, cfg.host, () => {
      const address = server.address();
      resolve({ server, port: typeof address === 'object' && address ? address.port : cfg.port });
    });
  });
}

export function stopServingServer(server: Server): Promise<void> {
  return new Promise(resolve => {
    server.close(() => resolve());
  });
}

/**
 * Server for Verified Attention Informational Frontend & Interactive Explorer
 *
 * Provides:
 * 1. Static asset serving (HTML, CSS, JS, whitepaper PDF)
 * 2. API proxy to the backend VAE API (with CORS handling and mock/demo fallback)
 * 3. Interactive live Proof verification runner
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');

const PORT = Number(process.env.PORT || 4000);
// VAE API target — if running via Docker, VAE_API_PORT can be customized (e.g. 3002)
const API_URL = process.env.VAP_API_URL || 'http://127.0.0.1:3002';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.ico': 'image/x-icon',
};

// Helper: proxy requests to backend VAE API
async function proxyToApi(req, res, targetPath) {
  const backendUrl = `${API_URL}${targetPath}`;
  try {
    let bodyData = null;
    if (req.method === 'POST' || req.method === 'PATCH' || req.method === 'PUT') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      bodyData = Buffer.concat(chunks).toString();
    }

    const headers = {
      'Content-Type': req.headers['content-type'] || 'application/json',
      'Accept': 'application/json',
    };

    const response = await fetch(backendUrl, {
      method: req.method,
      headers,
      body: bodyData,
    });

    const data = await response.text();
    const isJson = response.headers.get('content-type')?.includes('application/json');

    if (!response.ok || !isJson) {
      // Fallback to demo simulation if the backend port points to an unrelated service or errors
      return handleSimulatedApi(req, res, targetPath);
    }

    res.writeHead(response.status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end(data);
  } catch (err) {
    // If backend isn't up, return simulated response for standalone demo mode
    handleSimulatedApi(req, res, targetPath);
  }
}

// In-memory demo store for when backend API is offline
const demoSessions = new Map();
const demoProofs = new Map();

function handleSimulatedApi(req, res, targetPath) {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });

  const now = new Date().toISOString();

  if (targetPath.startsWith('/v1/policies')) {
    return res.end(JSON.stringify({
      policies: [
        {
          policyId: 'default-v1',
          name: 'Standard Verification',
          minDurationMs: 15000,
          minConfidence: 0.70,
          requiredEvidence: ['E-INTERACTION', 'E-VISIBLE']
        },
        {
          policyId: 'high-trust-v1',
          name: 'High-Trust Enterprise',
          minDurationMs: 30000,
          minConfidence: 0.90,
          requiredEvidence: ['E-INTERACTION', 'E-VISIBLE', 'E-DURATION']
        }
      ]
    }));
  }

  if (targetPath.startsWith('/v1/sessions') && req.method === 'POST') {
    const id = `urn:vap:session:${Math.random().toString(36).substring(2, 10)}`;
    demoSessions.set(id, { id, createdAt: now, state: 'ACTIVE' });
    return res.end(JSON.stringify({ sessionId: id, state: 'ACTIVE', createdAt: now }));
  }

  if (targetPath.startsWith('/v1/evidence') && req.method === 'POST') {
    return res.end(JSON.stringify({ status: 'INGESTED', timestamp: now }));
  }

  if (targetPath.startsWith('/v1/proofs') && req.method === 'POST') {
    const proofId = `urn:vap:proof:${Math.random().toString(36).substring(2, 10)}`;
    const proof = {
      proofId,
      state: 'PUBLISHED',
      confidence: 0.94,
      issuedAt: now,
      signature: 'ed25519_sig_demo_' + Buffer.from(now).toString('hex').slice(0, 32),
      claims: [
        { type: 'human_presence', confidence: 0.96 },
        { type: 'engaged_reading', confidence: 0.93 }
      ]
    };
    demoProofs.set(proofId, proof);
    return res.end(JSON.stringify(proof));
  }

  res.end(JSON.stringify({ status: 'OK', simulated: true }));
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = parsedUrl.pathname;

  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    return res.end();
  }

  // API Proxy
  if (pathname.startsWith('/api/v1/')) {
    const targetPath = pathname.replace('/api', '');
    return proxyToApi(req, res, targetPath);
  }

  // Whitepaper PDF download direct link
  if (pathname === '/whitepaper.pdf') {
    const pdfPath = path.join(repoRoot, 'docs/whitepaper/verified-attention-whitepaper.pdf');
    if (fs.existsSync(pdfPath)) {
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="verified-attention-whitepaper.pdf"',
      });
      return fs.createReadStream(pdfPath).pipe(res);
    }
  }

  // Static File Serving
  if (pathname === '/') pathname = '/index.html';
  const filePath = path.join(__dirname, 'public', pathname);

  try {
    const ext = path.extname(filePath);
    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('404 Not Found');
    }

    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('500 Internal Server Error: ' + err.message);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n=============================================================`);
  console.log(`✨ Verified Attention Portal & Explorer`);
  console.log(`🌐 Live URL:  http://localhost:${PORT}`);
  console.log(`🔗 VAE API:   ${API_URL}`);
  console.log(`📄 Paper:     http://localhost:${PORT}/whitepaper.pdf`);
  console.log(`=============================================================\n`);
});

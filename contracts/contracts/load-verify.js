/**
 * k6 Load Script — Verify Path (S5.1)
 * Ramp: 100 → 10k RPS, 5min duration. Target p99 < 200ms.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 100 },
    { duration: '60s', target: 500 },
    { duration: '90s', target: 2000 },
    { duration: '60s', target: 5000 },
    { duration: '60s', target: 10000 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(99)<200'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const payload = JSON.stringify({ sessionId: 'load-test-sess', proofId: 'load-proof', evidenceIds: ['load-evid'] });
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'x-correlation-id': `load-${__VU}-${__ITER}`,
    },
  };

  const res = http.post('http://localhost:3000/verify', payload, params);
  check(res, {
    'status is 200 or 404': (r) => r.status === 200 || r.status === 404,
    'duration < 200ms': (r) => r.timings.duration < 200,
  });
  sleep(1);
}

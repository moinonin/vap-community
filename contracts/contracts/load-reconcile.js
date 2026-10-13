/**
 * k6 Load Script — Settlement Reconcile (S5.2)
 * 1k concurrent users reconciling settlements.
 */

import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 1000,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(99)<500'],
  },
};

export default function () {
  const settlementId = `settle-${__VU}-${__ITER}`;
  const res = http.get(`http://localhost:3000/settlements/reconcile/${settlementId}`, {
    headers: { 'x-correlation-id': `reconcile-${__VU}-${__ITER}` },
  });
  check(res, {
    'status acceptable': (r) => r.status === 200 || r.status === 404 || r.status === 503,
  });
}

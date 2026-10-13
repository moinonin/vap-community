# Launch Runbooks (S8)

## api (Public REST API)
- Deploy: `docker-compose up api`
- Rollback: `docker-compose restart api` (previous image tag)
- Scale: `docker-compose scale api=3`
- Debug: `docker logs vae-api` + `correlationId` from `x-correlation-id`

## verifier (Verification Service)
- Deploy: `docker-compose up verifier`
- Rollback: `docker-compose restart verifier`
- Scale: replay queue depth alert; scale by adding workers
- Debug: replay queue depth, proof generation latency

## settlement-worker (Settlement Engine)
- Deploy: `docker-compose up settlement-worker`
- Rollback: `docker-compose restart settlement-worker`
- Scale: add workers; reconciliation drift alert
- Debug: ledger discrepancy, reconciliation report

## Alpha Onboarding
- 1 publisher, 3 campaigns
- Synthetic → real traffic transition
- 30-min setup target
- Exit criteria: zero P0; settlement ±$0.01; fraud FP < 0.5%

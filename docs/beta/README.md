# VAE Beta Program (Sprint 21)

**Status: PRE-PROGRAM.** This document defines the beta program plan. No beta
participants are onboarded yet (no `docs/beta/participants.md`); the program
opens only after the S20 onboarding assets
([docs/quickstart.md](../quickstart.md), [examples/](../../examples/)) are
validated — which they now are, locally.

## Scope

Beta participants integrate VAE into a real property to verify genuine human
attention on selected content. In scope:

- Browser SDK integration ([packages/sdk/browser](../../packages/sdk/browser/))
- Public REST API (`/v1/sessions`, `/v1/evidence`, `/v1/proofs`,
  `/v1/policies`) per [apps/api/openapi.yaml](../../apps/api/openapi.yaml)
- Proof verification via the `vap` CLI ([packages/cli](../../packages/cli/))

Out of scope for beta: rewards/settlement marketplace, mobile/extension SDKs
(S17–S18 not built), hosted sandbox (no self-serve signup yet), ML-serving
guarantees (S8 drift/retrain pipeline partial).

## Onboarding steps

1. Kickoff call + agreement (acceptance into the program, data-use terms,
   consent UX requirements per `docs/privacy/dpia-baseline.md`).
2. Local setup: follow [docs/quickstart.md](../quickstart.md) end-to-end;
   validate with `node examples/publish-and-verify.mjs`.
3. Staging integration: embed the browser SDK on a staging page with the
   publisher's CMP wired into `consentProvider`.
4. Pilot content: enable verification on 1–3 pages; collect sessions +
   evidence for 2 weeks.
5. Feedback review: bi-weekly 30-min call + async channel (below).

## Feedback channels

- **Primary:** GitHub Issues with label `beta` (API gaps, SDK bugs, doc fixes)
- **Blocking incidents:** dedicated Slack connect channel (provided on signup)
- **Structured survey:** usability API/SDK/docs survey at weeks 2 and 6
- Feedback is triaged into `docs/beta/feedback.md` (to be created at kickoff),
  categorized (usability / API gaps / performance / documentation) and
  prioritized; the sprint goal is to land the top 10 items.

## SLAs (support targets, best-effort)

| Severity | Definition | Response | Fix target |
|---|---|---|---|
| Blocking | Integration broken, no workaround | 4 business hours | 24 hours or rollback |
| Major | Degraded (missing evidence, verify failures) | 1 business day | 5 business days |
| Minor | Questions, doc gaps, cosmetic | 2 business days | next beta release |

## Exit criteria for beta → 1.0 RC

- [ ] 5–10 publishers across ≥3 verticals integrated (participants doc signed)
- [ ] Load verified at 2× expected launch volume (k6 gate recorded green:
      `scripts/run-gated.sh LOAD_TEST k6 run contracts/contracts/load-verify.js`)
- [ ] Top-10 feedback items landed and participants unblocked
- [ ] [docs/launch/checklist.md](../launch/checklist.md) fully green
- [ ] `vae-1.0-rc1` release tag cut

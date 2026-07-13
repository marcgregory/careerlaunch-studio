# Known Issues — Closed Beta

Last updated: 2026-07-14

## Release Gate

No critical product-flow or parser blockers are currently open. The remaining issues are production-readiness work.

| ID | Severity | Area | Issue | Exit condition |
| --- | --- | --- | --- | --- |
| OPS-1 | Major | Error monitoring | Sentry integration needs modernization and production event-capture verification. | A deliberate production-safe test error is captured with release, environment, route, and request context. |
| OPS-2 | Major | Release engineering | The production release gate is still partly manual. | CI verifies health, auth, builder, resume CRUD, AI, PDF export, billing, and Sentry before promotion. |
| OPS-3 | Major | Rate limiting | Rate limits are stored in process memory and are not consistent across Vercel instances. | Production-sensitive limits use a shared backend and pass concurrency/expiry tests. |
| OPS-4 | Minor | Observability | Structured logs and AI/PDF latency visibility are incomplete. | Production dashboards or queries expose request errors and P50/P95 latency for critical operations. |
| QA-1 | Minor | Accessibility | Automated coverage passes, but broader manual keyboard and screen-reader verification remains. | Manual audit is completed and findings are resolved or explicitly accepted. |
| DEPLOY-1 | Minor | Vercel configuration | The Vercel project still has a custom Build Command that should be reconciled with the documented build path. | Project settings and repository deployment documentation agree. |

## Resolved Parser Issues

R1, R3, and R7 are no longer active blockers. Pipe-separated experience, skills-before-experience ordering, and table-formatted resume cases now have passing regression coverage.

The parser is feature-frozen for closed beta. Reopen parser work only when a real source document reproduces a defect and a failing regression fixture is added first.

# CareerLaunch Studio Technical Debt Register

Last updated: 2026-07-03

| Item | Priority | Reason | Impact | Planned Sprint | Owner |
| --- | --- | --- | --- | --- | --- |
| Finalize auth provider | High | Architecture allows Auth.js or Clerk, but implementation needs one path | Blocks scaffolding decisions | Sprint 1 | Engineering |
| Spike PDF export engine | High | Export fidelity is core product value | Poor exports reduce conversion and trust | Sprint 1 | Engineering |
| Legal review for subscription terms | High | Resume-builder subscriptions can create trust and compliance risk | Launch risk and refund risk | Sprint 3 | Founder |
| Define AI content policy | Medium | Generated resume content must be user-reviewed and non-deceptive | Quality, legal, and trust risk | Sprint 4 | Product |
| Analytics governance | Medium | Product needs metrics but handles sensitive career data | Privacy risk if over-collected | Sprint 2 | Product/Engineering |
| Template originality review | High | Product must not copy competitor templates | IP and brand risk | Sprint 1 | Design/Founder |
| Review npm audit findings | High | Initial install reported moderate, high, and critical advisories | Dependency risk before public launch | Sprint 1 | Engineering |
| Replace local demo persistence | High | Builder currently stores data in browser localStorage | Users need account-backed resume persistence | Sprint 1 | Engineering |
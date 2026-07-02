# CareerLaunch Studio Technical Debt Register

Last updated: 2026-07-03

| Item | Priority | Reason | Impact | Planned Sprint | Owner |
| --- | --- | --- | --- | --- | --- |
| Provision PostgreSQL and apply initial migration | High | Persistence code and migration exist, but no local/hosted database is configured in this workspace | Blocks full Sprint 1 DoD verification | Sprint 1 | Engineering |
| Run full database-backed Playwright flow | High | E2E happy path is implemented but skipped without `DATABASE_URL` | Signup, save, and export ownership flow still needs live verification | Sprint 1 | Engineering |
| Spike PDF export engine | High | Current export route records an ownership-checked PDF request and uses browser print for demo output | Poor exports reduce conversion and trust | Sprint 1 | Engineering |
| Legal review for subscription terms | High | Resume-builder subscriptions can create trust and compliance risk | Launch risk and refund risk | Sprint 3 | Founder |
| Define AI content policy | Medium | Generated resume content must be user-reviewed and non-deceptive | Quality, legal, and trust risk | Sprint 4 | Product |
| Analytics governance | Medium | Product needs metrics but handles sensitive career data | Privacy risk if over-collected | Sprint 2 | Product/Engineering |
| Template originality review | High | Product must not copy competitor templates | IP and brand risk | Sprint 1 | Design/Founder |
| Review npm audit findings | Medium | Current audit reports 5 dependency advisories after adding Prisma and Playwright | Dependency risk before public launch | Sprint 1 | Engineering |

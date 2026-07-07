# Authentication Hardening — Sprint 7

**Goal:** Secure the auth system for closed beta without overengineering.

**Golden Rule:** Password reset + rate limiting + soft email verification only. No 2FA, no passkeys, no session management.

**Email Provider:** Resend (free tier — 100 emails/day, generous for beta).

---

## New Files

| File | Purpose |
|---|---|
| `apps/web/lib/email.ts` | Resend client, `sendVerificationEmail()`, `sendPasswordResetEmail()` |
| `apps/web/lib/auth-tokens.ts` | `generateToken()` (32 random bytes → base64url), `hashToken()` (SHA-256), `createToken()`, `consumeToken()` |
| `apps/web/components/email-verification-banner.tsx` | Soft banner: "Verify your email — resend" |
| `apps/web/app/forgot-password/page.tsx` | Email input form, success message (don't reveal if email exists) |
| `apps/web/app/reset-password/page.tsx` | New password form, token from query param |
| `apps/web/app/api/auth/forgot-password/route.ts` | POST — rate-limited, creates token, sends email |
| `apps/web/app/api/auth/reset-password/route.ts` | POST — consumes token, updates password |
| `apps/web/app/api/auth/verify-email/route.ts` | GET — consumes token, sets `emailVerifiedAt` |
| `apps/web/app/api/auth/resend-verification/route.ts` | POST — rate-limited, sends new verification email |

## Modified Files

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `emailVerifiedAt` to User, add `AuthToken` model |
| `apps/web/app/api/auth/register/route.ts` | Rate limiting (IP), auto-create verification token & send email |
| `apps/web/app/api/auth/login/route.ts` | Rate limiting (IP + email) |
| `apps/web/app/dashboard/page.tsx` | Show `EmailVerificationBanner` when unverified |
| `apps/web/app/login/page.tsx` | Add "Forgot password?" link below password field |
| `.env.example` | Add `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |

## Migration

| File | Purpose |
|---|---|
| `prisma/migrations/20260707060000_add_auth_tokens/` | Add `emailVerifiedAt` on User, create `AuthToken` table |

---

## Token Security

- `generateToken()` — `crypto.randomBytes(32)` → base64url (256 bits of entropy)
- `hashToken(raw)` — `crypto.createHash("sha256").update(raw).digest("hex")`
- DB stores only the hash, not the raw token
- Only the email contains the raw token
- Tokens marked `usedAt` on consumption — single-use
- Auto-expire: verification 24h, password reset 1h

## Rate Limiting Strategy

Using the existing in-memory `checkRateLimit()` from `apps/web/lib/rate-limit.ts`:

| Route | Key | Limits |
|---|---|---|
| `POST /login` | `login:ip:{ip}` | 10/60s (IP burst) |
| `POST /login` | `login:email:{email}` | 5/900s (15min, per email) |
| `POST /register` | `register:ip:{ip}` | 3/3600s (1h, per IP) |
| `POST /forgot-password` | `forgot:email:{email}` | 1/300s (5min, per email) |
| `POST /forgot-password` | `forgot:ip:{ip}` | 3/3600s (1h, per IP) |
| `POST /resend-verification` | `verify:email:{email}` | 1/120s (2min, per email) |

## Auth Flow Diagrams

### Registration

```
[Register form] → POST /api/auth/register
                    ├── Rate limit check (IP)
                    ├── Create user
                    ├── Create verification token (SHA-256 hashed)
                    ├── Send verification email via Resend
                    └── Set session cookie → redirect /dashboard
    
[Dashboard] → Shows "Verify your email" banner (if !emailVerifiedAt)
               ├── Click "Resend" → POST /api/auth/resend-verification
               └── Check email → click link → GET /api/auth/verify-email?token=xxx
                                                    ├── Hash token, find matching AuthToken
                                                    ├── Mark token used
                                                    └── Set emailVerifiedAt → redirect /dashboard
```

### Password Reset

```
[Login page] → Click "Forgot password?"
                ↓
[Forgot password form] → POST /api/auth/forgot-password
                          ├── Rate limit check
                          ├── Create reset token (always — no email enumeration)
                          ├── Send email (if account exists)
                          └── Show "Check your email" (always, even if no account)
                           
[Email] → Click link → /reset-password?token=xxx&email=yyy
                        ↓
[Reset password form] → POST /api/auth/reset-password
                        ├── Hash token
                        ├── Consume token (single-use)
                        ├── Update password (PBKDF2 rehash)
                        └── Redirect /login?reset=success
```

---

## Acceptance Criteria

- [ ] User can register → receives verification email → can verify
- [ ] Unverified user sees soft banner on dashboard (not blocked)
- [ ] User can resend verification email (rate-limited)
- [ ] User can request password reset → receives email
- [ ] Password reset link works once, expires after 1h
- [ ] Used reset token returns error, not password change
- [ ] Login is rate-limited per IP (10/60s)
- [ ] Login is rate-limited per email (5/15min)
- [ ] Register is rate-limited per IP (3/h)
- [ ] Forgot-password is rate-limited per email (1/5min)
- [ ] Forgot-password does not reveal whether email exists
- [ ] Tokens are stored as SHA-256 hashes only
- [ ] `.env.example` documents `RESEND_API_KEY` and `RESEND_FROM_EMAIL`
- [ ] Build passes (TypeScript, lint)

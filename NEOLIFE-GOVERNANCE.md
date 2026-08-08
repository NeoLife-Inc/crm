# NeoLife CRM Governance

This document defines governance rules for the NeoLife fork of [trycompai/crm](https://github.com/trycompai/crm).

## Fork Strategy

NeoLife maintains a fork at `github.com/NeoLife-Inc/crm` with the upstream remote pointing to `trycompai/crm`.

### Principles

1. **All changes are additive.** Never modify upstream code in place. Add new files, or wrap upstream code with conditional env gates (e.g., `if (process.env.S3_BUCKET)`).
2. **Upstream rebases must preserve NeoLife additions.** See `README-NEOLIFE.md` rebase checklist.
3. **No PHI in CRM.** B2B data only — clinics, pharmacies, providers as companies/contacts. Patient data never enters the CRM.
4. **Eve version is pinned.** `eve` is pinned to exact `0.29.4` (no `^`) in all package.json files. Never blind-update — eve is BETA.
5. **Committed generated code.** `apps/api/src/generated/server.ts` is committed and must NOT regenerate during build (GLIBC constraint).

### NeoLife-Specific Files

| File | Purpose |
|---|---|
| `README-NEOLIFE.md` | Deployment docs, rebase checklist, env var reference |
| `NEOLIFE-GOVERNANCE.md` | This file — governance rules |
| `apps/agent/agent/lib/neolife-boot.ts` | Boot assertion for model routing |
| `apps/api/scripts/mint-api-key.ts` | API key minting for headless auth |
| `.github/workflows/upstream-sync.yml` | Weekly upstream sync workflow |

### NeoLife-Modified Files

| File | Change | Env Gate |
|---|---|---|
| `packages/db/src/settings.ts` | `DEFAULT_AGENT_MODEL` → Anthropic | None (always on) |
| `packages/auth/src/auth.ts` | Added `apiKey()` plugin | None (always on) |
| `packages/auth/package.json` | Added `@better-auth/api-key` dep | None |
| `apps/api/src/trpc/trpc.context.ts` | Bearer token fallback | None (always on) |
| `apps/app/lib/onboarding.ts` | `readResearchGate()` soft gate | `CONTEXT_GATE_OPTIONAL=1` |
| `apps/app/app/(landing)/onboarding/page.tsx` | `researchOptional` prop | `CONTEXT_GATE_OPTIONAL=1` |
| `apps/app/app/(landing)/onboarding/onboarding-form.tsx` | Conditional redirect | `CONTEXT_GATE_OPTIONAL=1` |
| `packages/db/src/blob.ts` | S3 upload alternative | `S3_BUCKET` set |
| `packages/db/src/images.ts` | S3 URL recognition | `S3_PUBLIC_URL` set |
| `packages/db/package.json` | Added `@aws-sdk/client-s3` dep | None |

### Upstream Sync Process

1. A GitHub Actions workflow (`.github/workflows/upstream-sync.yml`) runs weekly.
2. It creates a branch from `main`, fetches upstream `release`, and attempts a merge.
3. If the merge succeeds without conflicts, it opens a PR for review.
4. If conflicts exist, the PR body lists the conflicting files for manual resolution.
5. After merge, verify all items in the `README-NEOLIFE.md` rebase checklist survive.

### Security Rules

1. **API keys** are prefixed with `neolife_` and rate-limited (100 req/min per key).
2. **API key minting** is blocked in production unless `CRM_ALLOW_MINT_PROD=1` is set.
3. **Sign-in allow-list** (`ALLOWED_SIGN_IN`) controls who can authenticate. Unset = nobody.
4. **No password auth.** Only OAuth (Google/Microsoft) and API keys.
5. **Cookie domain** must be set to the parent domain when app and API are on different subdomains.

### Data Boundaries

1. CRM database is a dedicated `crm` database on shared RDS Postgres 16.
2. No cross-database queries between CRM and neolife platform databases.
3. CRM data is B2B only — no patient records, no PHI.
4. File storage (profile picture mirrors) uses S3, not Vercel Blob.

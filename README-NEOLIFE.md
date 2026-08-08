# NeoLife CRM Fork — Deployment & Governance

This document tracks NeoLife-specific changes to the [trycompai/crm](https://github.com/trycompai/crm) fork.
All changes are **additive** — never modifying upstream code in place, only adding files or wrapping with conditional env gates.

## Deployment

- **Host**: EC2 tools box (Amazon Linux 2023, ARM64)
- **Path**: `/opt/crm`
- **Processes**: 3 systemd services (`crm-api`, `crm-app`, `crm-agent`) + `crm-cloudflared`
- **Database**: Dedicated `crm` database on shared RDS Postgres 16
- **Ingress**: Cloudflare Tunnel → Caddy → localhost ports
- **URLs**: `crm.neolife.health` (app), `crm-api.neolife.health` (API)
- **Access**: Cloudflare Access email allow-list on both subdomains

## Environment

Key env vars in `/opt/crm/.env`:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | RDS connection string for `crm` database |
| `BETTER_AUTH_SECRET` | Cookie signing secret |
| `AGENT_BRIDGE_SECRET` | Agent tab communication |
| `CRON_SECRET` | Mailbox sync route guard |
| `NODE_EXTRA_CA_CERTS` | RDS SSL CA bundle path |
| `CONTEXT_GATE_OPTIONAL` | `1` = skip Context.dev API key onboarding gate |
| `ALLOWED_SIGN_IN` | Email domain/address allow-list for sign-in |

## NeoLife Changes (CRMA2)

### CRMA2.2 — Model routing to Anthropic
- **File**: `packages/db/src/settings.ts` — `DEFAULT_AGENT_MODEL` changed to `{ id: "anthropic/claude-sonnet-4-20250514", contextWindowTokens: 200_000 }`
- **File**: `apps/agent/agent/lib/neolife-boot.ts` — NEW: `assertModelRouting()` boot assertion
- **File**: `apps/agent/agent/agent.ts` — calls `assertModelRouting()` before `logCapabilities()`

### CRMA2.3 — Context.dev gate softened
- **File**: `apps/app/lib/onboarding.ts` — `readResearchGate()` returns `"settled"` when `CONTEXT_GATE_OPTIONAL=1`
- **File**: `apps/app/app/(landing)/onboarding/page.tsx` — passes `researchOptional` prop
- **File**: `apps/app/app/(landing)/onboarding/onboarding-form.tsx` — conditional redirect to `/` when `researchOptional`

### CRMA2.4 — Headless auth (API key plugin)
- **File**: `packages/auth/package.json` — added `@better-auth/api-key` dependency
- **File**: `packages/auth/src/auth.ts` — added `apiKey()` plugin with `neolife_` prefix + rate limiting
- **File**: `apps/api/src/trpc/trpc.context.ts` — Bearer token fallback when no cookie session
- **File**: `apps/api/scripts/mint-api-key.ts` — NEW: script to mint API keys for headless agents

### CRMA2.5 — S3 blob storage
- **File**: `packages/db/src/blob.ts` — `mirror()` prefers S3 when `S3_BUCKET` is set, falls back to Vercel Blob
- **File**: `packages/db/src/images.ts` — `isMirrored()` checks S3 URL suffix too
- **File**: `packages/db/package.json` — added `@aws-sdk/client-s3`

### CRMA2.6 — Governance doc
- **File**: `NEOLIFE-GOVERNANCE.md` — NEW: fork strategy, security rules, data boundaries

### CRMA2.7 — Weekly upstream sync workflow
- **File**: `.github/workflows/upstream-sync.yml` — NEW: weekly Monday 09:00 UTC, fetches upstream `release` branch, opens PR

### CRMA2.8 — ARM64 sandbox manifest
- **File**: `apps/agent/agent/lib/neolife-sandbox.ts` — NEW: `neolifeSandboxBackend()` env-gated backend choice
- **File**: `apps/agent/agent/sandbox/sandbox.ts` — imports `neolifeSandboxBackend()`
- **File**: `apps/agent/agent/subagents/agent_runner/sandbox/sandbox.ts` — imports `neolifeSandboxBackend()`
- **File**: `apps/agent/agent/subagents/agent_builder/sandbox/sandbox.ts` — imports `neolifeSandboxBackend()`
- **File**: `apps/agent/scripts/check-sandbox.sh` — NEW: checks ARM64 Docker image manifest, advises `NEOLIFE_SANDBOX_BACKEND` setting
- **Env var**: `NEOLIFE_SANDBOX_BACKEND=docker|bash` (unset = upstream default)

## Rebase Checklist

When rebasing on upstream `trycompai/crm`, verify these NeoLife additions survive:

1. [ ] `packages/db/src/settings.ts` — `DEFAULT_AGENT_MODEL` is `anthropic/claude-sonnet-4-20250514`
2. [ ] `apps/agent/agent/lib/neolife-boot.ts` exists and is imported in `agent.ts`
3. [ ] `apps/agent/agent/agent.ts` calls `assertModelRouting()` at boot
4. [ ] `apps/app/lib/onboarding.ts` — `readResearchGate()` has `CONTEXT_GATE_OPTIONAL` short-circuit
5. [ ] `apps/app/app/(landing)/onboarding/page.tsx` — passes `researchOptional` prop
6. [ ] `apps/app/app/(landing)/onboarding/onboarding-form.tsx` — has `researchOptional` conditional redirect
7. [ ] `packages/auth/package.json` — has `@better-auth/api-key` dependency
8. [ ] `packages/auth/src/auth.ts` — has `apiKey()` plugin import and usage
9. [ ] `apps/api/src/trpc/trpc.context.ts` — has Bearer token fallback
10. [ ] `apps/api/scripts/mint-api-key.ts` exists
11. [ ] `packages/db/src/blob.ts` — uses S3 (CRMA2.5)
12. [ ] `NEOLIFE-GOVERNANCE.md` exists (CRMA2.6)
13. [ ] `.github/workflows/upstream-sync.yml` exists (CRMA2.7)
14. [ ] `apps/agent/agent/lib/neolife-sandbox.ts` exists and is imported in all 3 sandbox.ts files (CRMA2.8)
15. [ ] `apps/agent/scripts/check-sandbox.sh` exists (CRMA2.8)
16. [ ] Eve version pinned to exact `0.29.4` (no `^`) in `apps/agent/package.json` and `apps/app/package.json`
17. [ ] `apps/api/src/generated/server.ts` is committed and NOT regenerated during build

## Database Migrations

After adding the `apiKey()` plugin (CRMA2.4), new tables are required. Run on the tools box:

```sh
cd /opt/crm
# Generate the updated Prisma schema with apiKey tables
bun run auth:generate
# Apply migration
bun run db:deploy
```

## API Key Minting

```sh
# On the tools box, as the crm user:
cd /opt/crm/apps/api
bun scripts/mint-api-key.ts user@neolife.health "headless-agent"
# Output: neolife_<random-key>
```

Use the key in API requests:
```
Authorization: Bearer neolife_<key>
```

# Deploying the web app on Railway

**Status:** configuration only. Nothing has been deployed, no Railway project or AWS credential has been
provisioned, and live AI has not been enabled. The owner creates the service and sets variables.

The app is the existing Next.js 16 server in `web/`. There is no database, no separate backend, and no Rust
binary at runtime. PDF parsing (PR #59) is out of scope here.

## Files

| File | Purpose |
| --- | --- |
| `web/railway.json` | Config-as-code: Railpack builder, `npm run build`, `npm run start`, health check on `/`, restart on failure |
| `web/.nvmrc` | Pins Node.js 22, the same major version CI uses |

## Service settings

| Setting | Value |
| --- | --- |
| Source | GitHub repo `charlierichards13/ScaleMe`, branch `main` |
| Root Directory | `/web` |
| Config file path | `/web/railway.json` (Railway does not resolve this file relative to Root Directory, so give the absolute path) |
| Builder | Railpack (set by `railway.json`) |
| Install | automatic `npm ci` from `web/package-lock.json` |
| Build command | `npm run build` |
| Start command | `npm run start` (`next start`) |
| Health check path | `/` |
| Replicas | **1**. The cost guard keeps its counters in one process's memory, so each extra replica adds a full budget |
| Networking | Generate a Railway domain. Don't set a custom target port: `next start` reads the injected `PORT` and listens on all interfaces |

Deployments must not include `web/.env.local`. It is git-ignored, so a GitHub-sourced build doesn't include it.

## Environment variables (names only)

### Recommended for the public demo: live AI off

Set none of the AI variables. Every page and fictional demo works. `?demo=true` calls return labeled
synthetic samples. All live calls to `/api/fit/analyze`, `/api/interview/next` and `/api/practice/access`
return `503 AI_UNAVAILABLE` from `src/proxy.ts` before any route code or AWS SDK call runs.

| Name | When |
| --- | --- |
| `SITE_URL` | Optional. The deployed `https://…` origin, used for Open Graph `metadataBase`. Railway exposes service variables at build time; redeploy after changing it |
| `NODE_ENV` | Don't set it. `next build` and `next start` set it themselves |

### Live AI (private preview only, needs explicit owner approval first)

Enabling live AI makes the hosted service able to incur Bedrock charges. The threat model
([THREAT_MODEL.md](security/THREAT_MODEL.md), "Cost guard") says the per-process limiter isn't a public
production limit. Read it before setting any of these:

| Name | Notes |
| --- | --- |
| `FIT_LIVE_AI_ENABLED` | Must be exactly `true` for live mode. Unset or any other value fails closed |
| `SCALEME_PRIVATE_AI_TOKEN` | 32–256 URL-safe chars. The owner shares it privately with testers. Unset or invalid fails closed. Never use an AWS key here |
| `AWS_REGION`, `BEDROCK_MODEL_ID` | Required. If either is missing, an authorized live request returns `503` before quota use or an AWS call |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Railway has no AWS role, so the SDK default chain needs keys. Use a dedicated least-privilege IAM user that can only call `bedrock:InvokeModel` on the chosen model. Store them as Railway **sealed** variables. Never commit them |
| `FIT_RATE_LIMIT_GLOBAL_PER_MIN`, `FIT_DAILY_CALL_LIMIT`, `FIT_MAX_CONCURRENT`, `BEDROCK_MAX_ATTEMPTS`, `BEDROCK_TIMEOUT_MS`, `BEDROCK_MAX_OUTPUT_TOKENS` | Optional. The defaults and ranges are in `web/.env.example`. A set but invalid value fails closed |

Don't create any `NEXT_PUBLIC_` variable for these.

## What was verified locally (2026-11-15, Windows, Node 24.20, `next start`)

- `PORT=4123 npm run start` listened on port 4123, on both localhost and the network interface.
- These pages returned `200`: `/`, `/dashboard`, `/interview/contextual`, `/interview`, `/fit-insights`,
  `/impact-lab`, `/onboarding`, `/resume-lab`, `/fit`, `/coach`, `/discover-preview`. An unknown path
  returned `404`.
- With AI unset, POST to all three gated APIs returned `503 AI_UNAVAILABLE` from the proxy, including
  subpaths, `?demo=false`, `?demo=TRUE` and a bearer header. `?demo=true` on both AI routes returned
  `200` with `X-ScaleMe-Mode: demo`.
- With `FIT_LIVE_AI_ENABLED=true`, an ephemeral random token and no AWS settings or credentials:
  - Missing or wrong token returned `401`.
  - A cross-origin `Origin` header returned `403`.
  - The free access check returned `200`.
  - An authorized valid request returned `503`. The server log named only the missing variables.
  - No AWS call was possible.

Not verified: an actual Railway build or deploy, Railway's edge or HTTPS behavior, and any live Bedrock call.

## After the first deploy (owner)

1. Open the Railway domain. Check `/`, `/dashboard`, `/interview/contextual` and the fictional demos.
2. Run `curl -X POST https://<domain>/api/fit/analyze`. It should return `503 AI_UNAVAILABLE` while live AI is off.
3. Run `curl -X POST "https://<domain>/api/fit/analyze?demo=true"`. It should return `200` with a `DEMO` label.

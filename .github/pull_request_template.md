## Summary and scope

<!-- What changed? Which files and why? Do not include personal resume data. -->

## Related issue

Refs #<!-- issue number; use Closes #n only if all acceptance criteria are fulfilled -->

## Security impact and trust boundaries

- [ ] Reviewed `SECURITY.md` and `docs/security/REVIEW_CHECKLIST.md`
- [ ] No new credentials, real resumes, personal data, or private applicant logs committed
- [ ] Validated server inputs, model outputs, safe errors and sensitive-data handling as applicable
- [ ] Checked new cloud calls, endpoints, URL fetching, uploads and storage for authorization, quotas, SSRF and retention risks
- [ ] Security findings, limitations or exceptions documented below

**New data flows / external systems / permissions:**
<!-- None, or describe. -->

**Known security risks and mitigations:**
<!-- Do not claim "secure" solely because tests pass. -->

## Documentation changed (required)

- [ ] Updated `docs/api-contract.md` if API types or errors changed
- [ ] Updated threat model/security test plan if prompts, trust boundaries, storage or network behavior changed
- [ ] Updated README/setup/architecture if behavior, dependencies or configuration changed
- [ ] Or **no doc update needed because:** <!-- explicit rationale -->

## Verification (list actual runs, not guesses)

- [ ] `cd web && npm ci && npm run lint` (if web changed)
- [ ] `cd web && npm exec -- next typegen && npm exec -- tsc --noEmit` (if web changed)
- [ ] `cd web && npm run test --if-present && npm run build` (if web changed)
- [ ] `cd web && npm audit --audit-level=high` (or explain why not)
- [ ] Rust fmt, Clippy, tests if Rust changed
- [ ] Tested malformed/hostile/empty inputs relevant to this feature
- [ ] GitHub Actions checks passed
- [ ] Screenshots/short clip with **synthetic** data when UI changed

**Mocked tests vs actual external-service tests:**
<!-- Explicitly distinguish. -->

## Handoff and rollout

**Environment variable names only, no secret values:**
**How to test:**
**Open follow-ups / limitations:**
**Human reviewer:**

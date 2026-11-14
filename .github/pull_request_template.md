## What changed?

<!-- Describe the smallest useful change and how it connects to ScaleMe's MVP. -->

## Related issue

Refs #<!-- issue number; use Closes #n only if fully complete -->

## Verification

- [ ] `cd web && npm ci && npm run lint` (if web files changed)
- [ ] `cd web && npm exec -- tsc --noEmit && npm run build` (if web files changed)
- [ ] `cargo test --manifest-path services/matching-rust/Cargo.toml` (if Rust files changed)
- [ ] Verified the relevant user flow locally
- [ ] Screenshots / short clip added for UI changes (if applicable)
- [ ] No credentials, real candidate data, or copied proprietary resumes committed
- [ ] Relevant API contract changes documented
- [ ] GitHub Actions checks passed

## Demo / rollout notes

<!-- Any dependencies, env variables (names only), limitations, or fallback needed by teammates? -->

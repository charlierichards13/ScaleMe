# Contributing to ScaleMe

Welcome! ScaleMe uses short-lived feature branches, small PRs, human review and **documentation-as-part-of-done**. Contributors include humans and AI coding agents. Security instructions are in [AGENTS.md](AGENTS.md) and [SECURITY.md](SECURITY.md); read both before changes.

## One issue, one branch, one owner

1. Read your issue and the [Roadmap](docs/ROADMAP.md). Confirm owner, acceptance criteria, dependencies and planned files.
2. Work in your own branch/worktree from the latest `main`; do not edit another agent's worktree.
3. Read `docs/api-contract.md` for interfaces. Coordinate schema changes before adjusting consumers.
4. If editing `web/`, preserve and read `web/AGENTS.md` (Next.js 16 instructions).
5. No direct pushes to `main`, force pushes, unattended PR merges, destructive commands or cloud deployment without human approval.
6. Open a PR referencing the issue, with evidence of tests and a description of any unresolved risks.

Example (PowerShell; adapt branch name):

```powershell
git switch main
git pull --ff-only
git switch -c feat/my-scoped-task
# edit, test, review diff and staged files
git status
git diff --check
git diff --cached --stat
```

## Documentation is part of every change

**Each contributor or agent must check whether its code change requires updates to documentation, and update them in the *same PR*.** Do not postpone documentation indefinitely until after merging.

| If changing… | Update… |
| --- | --- |
| API request/response, error codes, validation limits | `docs/api-contract.md` and sample requests |
| Environment variables, AWS permissions, deployment settings | `docs/aws-bedrock-plan.md` (once merged), `web/.env.example` (names only) and setup notes |
| New endpoints, external services or data flows | `docs/security/THREAT_MODEL.md` and architecture notes |
| LLM prompts, model selection, tools or output processing | Threat model, AI test cases, limitations and evidence rules |
| PDF uploads, URL ingestion or persistence | Security review checklist and data/retention documentation |
| User-facing features and flow | Relevant README, screenshots using synthetic data, and demo notes |
| Tests, dependencies and CI | Verification instructions, changelog/decision notes where useful |
| Agent instructions | Root `AGENTS.md` and any relevant nested instructions, coordinated with teammates |

If no documentation change is needed, state **"Docs: no change needed because..."** in your PR. Do not check a box without inspecting the impact.

**Do not claim** mocked Bedrock tests are live-model tests. Keep a list of verified results, untested assumptions and follow-ups.

## Required local verification

From `web/`:

```bash
npm ci
npm run lint
npm exec -- next typegen
npm exec -- tsc --noEmit
npm run test --if-present
npm run build
npm audit --audit-level=high
```

On Windows PowerShell, use `npm.cmd` if `npm.ps1` is blocked. Do not run `npm audit fix --force` without reviewing potential breaking updates.

For `services/resume-parser/` (Rust 1.89 or newer; details and a Windows note in [docs/RESUME_INGESTION.md](docs/RESUME_INGESTION.md)):

```bash
cargo fmt --manifest-path services/resume-parser/Cargo.toml --all -- --check
cargo clippy --manifest-path services/resume-parser/Cargo.toml --locked --all-targets -- -D warnings
cargo test --manifest-path services/resume-parser/Cargo.toml --locked
cargo build --manifest-path services/resume-parser/Cargo.toml --locked --release
```

For `services/matching-rust/`, when present:

```bash
cargo fmt --manifest-path services/matching-rust/Cargo.toml --all -- --check
cargo clippy --manifest-path services/matching-rust/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path services/matching-rust/Cargo.toml
```

Check failure modes as well as happy paths, especially malformed inputs, leakage, untrusted instructions in resume text, unauthorized redirects and cloud failure. CI does not prove security; a human reviews risky changes.

## Pull request handoff

- Explain the problem solved, owned files changed and how the feature is invoked.
- Link the issue and document **actual** test commands/results.
- State changes to data flow, IAM, secrets, logging, retention, third-party APIs, dependency versions and AI prompts.
- Include docs updated, or the rationale for not updating them.
- Describe unverified assumptions, deployment steps, known limitations, and any security risks needing another issue.
- Use synthetic fixtures and screenshots. Never paste a real resume or token in a PR description.
- Wait for CI and human review; do not merge automatically.

## Security escalations

If an agent finds credentials, accidental PII, an exploitable path, unrestricted cloud billing or high-risk prompt/tool behavior, **stop and report privately**. Do not copy secrets into the conversation or open a public issue containing a secret. Do not silently suppress or weaken a failing security check to get a green PR.

## Scope discipline

The hackathon MVP is resume → job → fit analysis → interview → evidence-grounded impact suggestions. Job discovery, optional visa-related guidance, a full native app and accounts are stretch/future items. Favor a safe end-to-end demo over partial production claims.

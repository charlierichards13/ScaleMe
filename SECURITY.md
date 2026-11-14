# ScaleMe security policy

ScaleMe is a **hackathon prototype**, not an audited or production-certified career platform. Treat it as **development/demo only** until the public-launch gate below is complete. Never claim "secure", "OWASP compliant", or "penetration tested" solely because documentation or mocked tests exist.

## Reporting a vulnerability

Please report potential vulnerabilities **privately to the repository maintainers** using a private communication channel already agreed by the team. If GitHub Private Vulnerability Reporting is enabled for this repository, use that instead. Do **not** publish exploit details, real candidate data, credentials, or personal information in public issues or PRs.

Include a safe reproduction using **synthetic data**, the affected route or commit, expected and actual results, and potential impact. Do not test against other people's accounts, production systems, or live job sites without explicit authorization. Maintainers should acknowledge privately, assess severity, isolate affected functionality if needed, fix on a restricted branch, test, and disclose only after a safe fix.

We have not established an external reporting SLA or public bug bounty.

## Data classification

| Data | Sensitivity | Rules |
| --- | --- | --- |
| Public job descriptions / public company pages | External and **untrusted** | Respect access terms; never execute embedded instructions |
| Uploaded resumes, names, email addresses, employment history | Personal / confidential | Minimize, avoid logs, don't commit; use synthetic fixtures |
| Interview responses and personalized analysis | Personal / confidential | Session isolation, retention limits, access control if stored |
| Optional work-authorization preferences | Sensitive contextual data | Optional only; no passports, SEVIS IDs or eligibility verdicts |
| AWS credentials, API tokens, deployment secrets | Secret | Server-only, least privilege, never in Git, client output or AI prompts |
| Prompts, code, third-party dependencies | Application integrity assets | Review changes, validate responses, pin/monitor dependencies |

For the hackathon MVP, **prefer no account system and no persistent storage of resumes or interview transcripts**. Any new persistence or telemetry must receive a documented privacy review first.

## Security principles

- **Trust boundaries:** Browser, uploaded PDF text, job URLs, model output, external providers and AI-agent tool responses are all untrusted. Authorization decisions belong in deterministic application code, not an LLM.
- **LLM-specific:** Treat resume/job text as data; validate generated JSON, verify cited evidence, never execute model output, and avoid giving the model tools, credentials or arbitrary network access.
- **AWS:** Run Bedrock server-side with short-lived roles/profile credentials, least-privilege IAM, region/model allowlists, timeouts and a budget. Do not provision paid cloud resources without human approval.
- **Web/API:** Validate types and sizes; implement abuse/rate limits before exposing cost-bearing routes; use safe errors; never return internal AWS details.
- **PDF/URLs:** Validate real file content, impose time/memory and size limits. Job URL fetching requires SSRF defenses for DNS and redirects, plus scheme/host validation, timeouts and response limits.
- **Privacy:** Use synthetic demos, redact logs, and prevent cross-user data access. Any retention policy must be defined before users upload real data.
- **Supply chain:** Review additions to dependencies and GitHub Actions, monitor advisories, run CI, and avoid untrusted install scripts.

See [Threat Model](docs/security/THREAT_MODEL.md), [Review Checklist](docs/security/REVIEW_CHECKLIST.md), and [Contributor Guidelines](CONTRIBUTING.md) for controls and verification.

## Public launch gate (not yet satisfied)

Before inviting users to upload real resumes or exposing an unauthenticated AWS model endpoint:

- [ ] Review and test the final architecture and deployment trust boundaries.
- [ ] Add request-size limits, per-client quotas/rate limits, spend alarms and safe failures for paid AI calls.
- [ ] Validate PDF and URL ingestion controls (including redirects, DNS rebinding/metadata-service access and parsing failures).
- [ ] Run adversarial AI tests **against the actual configured Bedrock model**, not only mocks.
- [ ] Test personal-data leakage, session isolation, deletion/retention behavior and log redaction.
- [ ] Document where data is sent, regional processing, vendor retention settings, user disclosure and consent requirements.
- [ ] Review IAM, secrets, HTTPS, deploy settings, allowed origins, security headers and dependency audit results.
- [ ] Run and review CI and an authorized security test; log findings and remediation status.
- [ ] Require a human security sign-off for any open high-impact risk.

**Current status:** There is no assertion that the above controls are complete. The Issue #6 fit-analysis implementation (`POST /api/fit/analyze`, branch `feat/bedrock-fit`, in pull-request review and **not yet merged or independently audited**) has passing **mocked** unit tests only. **No live Bedrock call has been made** (AWS quota restriction, so real-model behavior, including prompt-injection resistance, is unverified), and it has **no rate limiting or spend controls** ([#23](https://github.com/charlierichards13/ScaleMe/issues/23)). Adversarial AI/privacy review against a real model is tracked in [#24](https://github.com/charlierichards13/ScaleMe/issues/24). Details: [Bedrock review notes](docs/security/BEDROCK_REVIEW_NOTES.md).

## References

- [OWASP ASVS 5.0](https://asvs.owasp.org/)
- [OWASP GenAI LLM Top 10](https://genai.owasp.org/llm-top-10/)
- [AWS Bedrock security documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/security.html)

Do not paste real incidents or user data into AI coding chats. Keep security findings in appropriate private channels.

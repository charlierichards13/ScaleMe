# Phase A brand UI verification — Issue #55

Base: freshly cloned `origin/main`, `39d8e0e` (PR #53), including PR #52 assets and PR #50 parser. Branch: `feat/brand-ui-integration`. Checked 2026-11-15 on Linux with Chromium, Next.js dev and production servers. Only guest/empty states and bundled fictional content were used.

## Before / after

Before: a placeholder upward-trend badge plus typed wordmark in shared navigation; “Your career. Your potential. Scaled.” in the welcome hero; older indigo/ink tokens and a light footer.

After: the original approved geometric S/arrow wordmark on wide light surfaces, its standalone symbol in compact headers, and the dark variant on an ink footer. The hero says “Invest in your own potential.” in HTML, with evidence-driven preparation copy, a working guest CTA and “See how it works” anchor. Shared tokens update button, navigation and workspace colors without changing the dashboard layout, feature classifications or guest/offline behavior.

| View | Before | After |
| --- | --- | --- |
| Desktop welcome, including footer | [1440 px](images/before-welcome.jpg) | [1440 px](images/after-welcome-1440.jpg) |
| Desktop dashboard/sidebar | [1440 px](images/before-dashboard.jpg) | [1440 px](images/after-dashboard-1440.jpg) |
| Mobile welcome/footer | Same former placeholder/hero/light footer described above | [390 px](images/after-welcome-390.jpg) |
| Mobile workspace | Former full placeholder logo in header | [Dashboard](images/after-dashboard-390.jpg), [open drawer](images/after-sidebar-390.jpg) |

Before captures use `next dev` at the unchanged base. After captures use `next start` from the production build. Screenshots use reduced motion so all content is visible.

## Automated checks

All commands from `web/`:

- `npm ci`: passed. Existing ESLint 10 plugin peer-range warnings; no dependency or lockfile changes.
- `npm run lint`: passed.
- `npm exec -- next typegen`: passed.
- `npm exec -- tsc --noEmit`: passed.
- `npm test`: passed, 13 files / 173 tests. Existing service tests use mocks; no live AI was enabled or tested.
- `npm run build`: passed, all 19 pages generated. With `SITE_URL` unset, Next.js warns that automatic social-image URLs resolve against `http://localhost:3000`. See [configuration requirements](BRAND_ASSETS.md#metadata-configuration).
- `npm audit --audit-level=high`: exit 0; nine existing moderate findings in minimatch/ESLint tooling, no high or critical findings. Dependencies intentionally unchanged.
- `git diff --check`: passed.

## Browser checks

Repeated against the production build at widths **1440, 768, 390 and 320 px**:

- Welcome/header/footer and dashboard/sidebar render without horizontal document overflow. Every visible logo loads and decodes. Screenshots inspected for light/dark artwork, mobile symbol sizing, text wrapping and spacing.
- Hero's accessible text is exactly “Invest in your own potential.”; primary CTA still points to `/onboarding`; “See how it works” navigates to `#features`.
- Sign-in popover retains the account-unavailable explanation; Escape closes it and returns focus to Sign in.
- Mobile navigation opens, closes with Escape and returns focus to the menu button. Sidebar names/statuses and dashboard empty state remain intact.
- Keyboard Tab reaches the visible “Skip to content” link. Header links and Sign in show the brand focus ring; footer links show the lavender ring against ink. Native link/button semantics are retained.
- With `prefers-reduced-motion: reduce`, the hero has no entrance animation. The existing motion regression tests pass.
- No page errors or HTTP error responses during these flows.
- Automatic metadata includes 512 px app icon, 180 px Apple icon, favicon and the 1200×630 Open Graph asset. Generated icon/image URLs and `/brand/{logo,logo-dark,icon,icon-dark,app-icon,favicon}.svg` all return HTTP 200. PR #52 assets have no diff.
- Production computed tokens confirm ink `rgb(13, 16, 57)` and brand `#7153fc`.

## Limits and handoff

No production origin is known. Configure `SITE_URL` at build time only after the owner supplies the real URL; the unconfigured localhost social-image fallback is unsuitable for publishing. No canonical link is added. No merge or deployment was performed.

Chromium checks do not establish Safari/Firefox, assistive-technology or OS/browser-tab icon behavior. The unchanged favicon was inspected at its native 16, 32 and 64 px sizes: the S/arrow silhouette remains distinguishable; fine interior strokes naturally soften at 16 px. Final artwork approval remains with the human reviewer. Existing drawer behavior is preserved; this change does not add a focus trap. Feature-owned standalone layouts and larger dashboard polish remain Phase B.

No backend, authentication, parser, feature-owned implementation, dependency, external call or data-flow changes. API contracts and threat model need no change for this presentation-only integration. Human review and GitHub CI remain required before merge.

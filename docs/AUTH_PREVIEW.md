# Account UI preview — Issue #42

Visit `/sign-in` or `/sign-up`. Both are isolated routes under
`web/src/app/(auth-preview)/`, outside the dashboard layout. All styles are
scoped with a unique scaleme-auth prefix. No shared styles, root layout, existing feature
routes, backend, dependencies, or API contracts change.

**UI-only; no user accounts, login, or privacy guarantees exist yet.**
Accounts/sign-in are not enabled in this prototype. Do not enter real passwords.

## What works

- Responsive branded sign-in and create-account compositions, with desktop
  evidence-story card and compact mobile introduction.
- Explicit, associated labels and descriptions for disabled name/email/password
  fields. Inputs have no names, values, or handlers; there is no form or submission.
- Keyboard-operable validation preview toggles illustrative email and password
  errors, associated through `aria-describedby` and `aria-invalid`. A polite status
  announces the example state. Errors never imply a credential check occurred.
- Cross-navigation between previews and “Explore Demo” to the existing
  `/fit-insights` fictional demo. Links disable speculative prefetching.
- Disabled sign-in/create-account, password reset, and identity-provider controls
  explicitly marked “Not available.”
- Skip link, visible keyboard focus, reduced-motion support, and route metadata.

The only local React state is a boolean for displaying example errors. It resets
on reload. No credential entry, authentication, account creation, sessions,
authorization, storage, cookies, telemetry, identity-provider call, email sending,
AWS call, or backend integration is implemented. Initial page/static asset requests
and deliberate link navigation still occur normally. This is not a security or
privacy certification of the wider platform.

Real authentication is a separately scoped future phase requiring product and
security approval, managed-provider selection, server session/authorization
design, privacy/retention decisions, threat modeling, and appropriate tests.
No setup, environment variables, or deployment changes are required here.

## Verification

From `web/`:

```sh
npm ci --ignore-scripts
npm run lint
npm exec -- next typegen
npm exec -- tsc --noEmit
npm run test --if-present
npm run build
npm audit --audit-level=high
```

All pass locally. 65 tests across 8 files include 6 new server-rendered markup
tests checking disabled inputs, no forms/submission, safety disclosure, local
navigation, and unavailable controls. Install used `--ignore-scripts` to avoid
dependency lifecycle scripts; locked dependencies and build worked.
Audit exits 0 with 9 existing moderate development-toolchain advisories; no
dependency or lockfile changes were made. No Rust crate exists, so Rust checks
do not apply. No live AWS or real authentication tests apply to this UI-only scope.

For browser verification, start `npm run start -- --hostname 127.0.0.1` after a
production build, then in another terminal:

```sh
# Playwright must be available in the verification environment, not the app bundle.
node scripts/check-auth-preview.mjs
# If it is installed outside this repository:
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node scripts/check-auth-preview.mjs
```

The script accepts `CHROMIUM_PATH` (default `/usr/bin/chromium`) and
`AUTH_PREVIEW_ORIGIN` (default `http://127.0.0.1:3000`).
It checks both routes at 1440, 768, 390, and 320 pixels: loaded responsive styles, no horizontal overflow,
disabled inputs, keyboard toggling/skip link/focus, reduced motion, error
associations, reload reset, route navigation, fictional-demo destination,
no page errors, no network requests during preview interactions, and empty
local/session storage and cookies in fresh browser contexts. It writes the
screenshots below. Screen reader announcements are implemented with semantic
markup but have not been manually tested with assistive technology.

## Screenshots

| Route | Desktop | Mobile | Error example |
| --- | --- | --- | --- |
| Sign in | [Desktop](screenshots/auth-preview/sign-in-desktop.png) | [Mobile](screenshots/auth-preview/sign-in-mobile.png) | [Desktop](screenshots/auth-preview/sign-in-desktop-errors.png), [mobile](screenshots/auth-preview/sign-in-mobile-errors.png) |
| Create account | [Desktop](screenshots/auth-preview/sign-up-desktop.png) | [Mobile](screenshots/auth-preview/sign-up-mobile.png) | [Desktop](screenshots/auth-preview/sign-up-desktop-errors.png), [mobile](screenshots/auth-preview/sign-up-mobile-errors.png) |

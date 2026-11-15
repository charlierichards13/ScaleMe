# ScaleMe brand asset kit — Concept 2 (geometric S)

**Brand line:** Invest in your own potential.  
**Core product:** Evidence-driven career preparation.  
**Status:** Candidate production artwork; visually review before publishing. This is an original vector redraw *inspired by* the selected image concept, not a pixel-perfect vectorization of the generated raster.

## Files & recommended placement

Copy the `web/` folder in this kit into the ScaleMe repository after creating a **new branding branch**. It is intentionally separate from the uncommitted navigation work and PR #46.

- `web/public/brand/icon.svg` — transparent primary S symbol, all-size vector
- `web/public/brand/icon-dark.svg` — violet S mark for dark backgrounds
- `web/public/brand/icon-white.svg` — pale/white mark for filled buttons and badges
- `web/public/brand/icon-monochrome.svg` — one-color mark, useful for print
- `web/public/brand/logo.svg` — horizontal wordmark on light surfaces
- `web/public/brand/logo-dark.svg` — horizontal wordmark on dark surfaces
- `web/public/brand/logo-tagline.svg` and `logo-tagline-dark.svg` — horizontal lockups with tagline
- `web/public/brand/logo-stacked.svg` and `logo-stacked-dark.svg` — stacked lockups
- `web/public/brand/app-icon.svg` — square gradient app-icon master
- `web/public/brand/favicon.svg` — simplified 64×64 favicon vector
- `web/public/brand/favicon.ico`, `app-icon-{16,32,48,64,128,192,256,512,1024}.png` — common raster outputs
- `web/public/brand/icon-transparent-{64,256,512}.png` — transparent symbol raster
- `web/public/brand/logo-1120.png`, `logo-dark-1120.png` — horizontal raster alternatives
- `web/public/brand/og-image.png` — 1200×630 social sharing preview
- `web/src/app/icon.png` — Next.js App Router automatic icon metadata (512×512)
- `web/src/app/apple-icon.png` — Next.js automatic Apple touch icon (180×180)
- `web/src/app/favicon.ico` — replacement for the **existing** Next.js favicon
- `web/src/app/opengraph-image.png` — Next.js automatic Open Graph image (1200×630)
- `docs/branding/preview.png` — side-by-side rendered brand review (not a deployed asset)

All SVG wordmark and tagline letters are converted to paths so they render consistently without bundling a font file. Source paths are editable. No third-party logos or font files are included.

## Color choices

| Token | Color |
| --- | --- |
| Primary indigo | `#7153FC` |
| Lavender highlight | `#AC86FF` |
| Deep purple | `#3928B8` |
| Ink | `#0D1039` |
| Canvas | `#F8F9FC` |
| Muted text | `#535A77` |

## Implementation guidance

- Use `src="/brand/logo.svg"` on light surfaces, `/brand/logo-dark.svg` on dark surfaces, and `/brand/icon.svg` when icon-only.
- Alt text: `ScaleMe`. Do not put the full tagline in an image's alt text unless it communicates information not in surrounding copy.
- The `web/src/app/` icon files are picked up automatically by the Next.js App Router; test generated metadata and icons after installation. Existing `favicon.ico` is deliberately replaced.
- Use the line **“Invest in your own potential.”** in the hero with accessible HTML text. The logo-with-tagline art is optional on the marketing page; avoid repeating the tagline twice.
- Preserve the existing shared route integration, mock/fictional disclosures, authentication status, and AWS safeguards. Branding should not claim live services where none exist.
- Do **not** add all PNG sizes to a page. Use SVG for navigation; app/favicon/touch/OG icons cover different use cases.
- Test 16px favicon legibility, light/dark contrast, browser mobile tab, app router asset response, Lighthouse and keyboard/screen-reader navigation.
- Before public launch, perform a name/logo similarity or trademark check. Concept art was generated and then manually redrawn as a vector; this is not a claim of trademark clearance.

## Suggested PR workflow

1. Finish, commit, and publish the active navigation PR before switching branches in your main worktree.
2. Create `feat/scaleme-brand-assets` from the latest `main` in a clean worktree or separate folder.
3. Copy the kit's `web/` tree, commit, push, and open a **draft PR** containing only brand resources.
4. Review visual rendering, PNG dimensions, icon metadata, and CI. Then ask Grok to wire the shared header/sidebar/logo components in a separate UI PR.

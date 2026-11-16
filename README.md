# livestock-ownership-database

[![CI](https://github.com/NishitaUpreti/livestock-ownership-database/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/NishitaUpreti/livestock-ownership-database/actions/workflows/ci.yml)

A web-based livestock ownership database that enables farmers to register, track, and manage livestock records including health, identification, and ownership details.

The application is a **static site**: HTML pages, one shared stylesheet, and vanilla JavaScript. There is no framework, bundler, or server-side build step. Everything is served directly from `public/`.

## Project structure

```text
livestock-ownership-database/
├── public/
│   ├── 14 HTML pages (landing, auth, registration, dashboards, livestock,
│   │   health, vaccination, schemes, export, about, support)
│   ├── style.css
│   ├── config.js            # Supabase client configuration
│   └── images / video
├── scripts/
│   └── check-links.mjs      # deterministic local link checker
├── tests/
│   └── smoke.spec.mjs       # Playwright page smoke tests
├── package.json             # CI tooling only (no runtime dependencies)
├── eslint.config.mjs
├── .htmlvalidate.json
├── .stylelintrc.json
├── playwright.config.mjs
└── .github/
    ├── workflows/ci.yml
    └── dependabot.yml
```

## Run the site locally

Requirements: **Node.js 24** (or any version satisfying `engines` in `package.json`) and npm.

```bash
npm ci            # install CI tooling (not required just to view the site)
npm run serve     # http-server on http://127.0.0.1:4173
```

Open `http://127.0.0.1:4173/landingPage2.html`.

You can also open the HTML files directly, but a local server is recommended because relative links and browser security behave more like production.

### Supabase configuration

`public/config.js` contains placeholders:

```js
const SUPABASE_URL = "https://your-project-id.supabase.co";
const SUPABASE_ANON_KEY = "your-anon-public-key-here";
```

Replace them locally with your own Supabase project values.

Security notes:

- The Supabase **anon/public key is designed to be shipped to browsers**. It is safe to expose only when Row Level Security (RLS) is enabled on every table.
- **Never commit a `service_role` key** or any other secret. The `.gitignore` excludes `.env` files.
- If you add environment-specific configuration, load it from a file that is not committed.

## Continuous Integration

The [`CI`](.github/workflows/ci.yml) workflow runs automatically:

- on every **pull request targeting `main`**
- on every **push to `main`**
- manually via **Actions → CI → Run workflow** (`workflow_dispatch`)

It uses `ubuntu-latest`, Node.js 24, npm caching, and a `concurrency` group that cancels superseded runs.

> If this repository is a fork, confirm that Actions is enabled under **Settings → Actions → General**. Workflows do not run on forks where Actions is disabled.

### What each check does

| Check | Command | Purpose |
|---|---|---|
| `lint` | `npm run lint` | Validates HTML (`html-validate`), CSS (`stylelint`, including inline `<style>`), and JavaScript (`ESLint`, including inline `<script>`). |
| `links` | `npm run test:links` | Verifies every local `href`/`src` resolves with **exact filename casing**, and that `#fragment` anchors exist. |
| `smoke` | `npm run test:smoke` | Serves `public/` and loads all 14 pages in Chromium. Asserts HTTP 200, a non-empty title/body, no uncaught page errors, and no failed same-origin resources. |
| `audit` | `npm run audit` | Fails on high or critical advisories in the tooling dependency tree (`npm audit --audit-level=high`). |

Each job is independent, so a failure appears as a specific failing status check on the pull request. A failed job exits non-zero, which marks the pull request as failing.

### Why these rules

- HTML validation keeps the **accessibility and correctness** rules that catch real problems (missing `alt` text, icon buttons without accessible names, invalid nesting, unescaped characters, missing button types).
- Purely stylistic HTML rules (`no-inline-style`, `void-style`, `no-trailing-whitespace`) are disabled because this codebase intentionally keeps styles inline per page; enforcing them would require a large refactor unrelated to CI.
- `no-autoplay` is a **warning**, not an error: removing autoplay from the landing-page video is a product decision.
- CSS linting is limited to correctness rules. `no-duplicate-selectors` is disabled because several pages use later duplicate blocks as intentional cascade overrides.
- ESLint's `no-unused-vars` is disabled for HTML because functions referenced only from `onclick="..."` handlers are invisible to ESLint. `no-redeclare` and `no-undef` remain enabled.
- A formatter (Prettier) is intentionally **not** enforced: the pages contain large inline style/script blocks and formatting the repository would create a large, behaviour-neutral diff without improving correctness.

### Run the checks locally

```bash
npm ci

# Individual gates
npm run lint          # HTML + CSS + JS
npm run test:links    # local links and anchors
npm run audit         # dependency vulnerabilities

# Browser smoke tests (first run downloads Chromium)
npx playwright install chromium
npm run test:smoke

# Everything except the audit
npm test
```

The link checker compares against the real directory listing, so it catches case mismatches (for example `livestock.html` vs `liveStock.html`) even on case-insensitive macOS filesystems, where those links appear to work.

### Required status checks and branch protection

The workflow file alone does not prevent merging. An administrator must configure a ruleset once:

1. Open **Settings → Rules → Rulesets → New branch ruleset**.
2. Target the `main` branch.
3. Enable **Require a pull request before merging**.
4. Enable **Require status checks to pass before merging** and select:
   - `lint`
   - `links`
   - `smoke`
   - `audit`
5. Enable **Require branches to be up to date before merging**.
6. Block force pushes and branch deletion, then save.

After that, a pull request with a failing check cannot be merged. Check runs are visible under the **Checks** tab of each pull request and under **Actions**.

### Dependency and security automation

- `.github/dependabot.yml` opens weekly grouped updates for npm tooling and GitHub Actions, keeping action SHAs patched.
- Recommended repository settings (GitHub-hosted, no workflow file needed):
  - **Dependabot alerts** and **Dependabot security updates**.
  - **Secret scanning** and **push protection**.
  - **Code scanning → CodeQL default setup** for JavaScript. Note: CodeQL does not extract inline `<script>` blocks from HTML, so its coverage here is limited to `public/config.js`.
- No secrets are required by CI. All jobs run with `contents: read`.

### Verifying the pipeline

- **Success:** open **Actions → CI** and confirm all four jobs are green for the commit. The badge at the top of this README reflects the latest `main` run.
- **Failure:** deliberately break a check on a branch (for example, rename a linked page or remove an `alt` attribute) and open a pull request. The relevant job fails, the check is red, and merging is blocked once the ruleset is enabled.

### Limitations

- The project has **no build step and no unit-test framework**, so the pipeline validates static assets and exercises the rendered pages instead of compiling code.
- Smoke tests run in **Chromium only**.
- Authentication and data-entry flows depend on a Supabase project and on `/api/*` endpoints that are not part of this repository. They are not covered by automated tests.
- External CDN scripts (Chart.js, jsPDF, Supabase, Font Awesome) are loaded at runtime. The smoke tests assert failures for same-origin resources and uncaught page errors; third-party CDN availability is outside the repository's control.
- There is no `index.html`; the landing page is `landingPage2.html`. If this site is deployed with `public/` as the web root, `/` will return 404 unless an index page or redirect is added.
- Third-party CDN scripts do not use Subresource Integrity (SRI). Adding SRI is a worthwhile follow-up.

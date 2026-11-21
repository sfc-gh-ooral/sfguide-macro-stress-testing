# Macro Stress Testing v2: what changed

This branch rebuilds the app, the landing page and the polish to the Snow Packs v2 bar. Your data stories, Snowflake features, stack (Streamlit in Snowflake plus a static hosted example) and owner line are kept. `COCO-V2-INSTRUCTIONS.md` is the checklist we followed, written so your CoCo can apply it to your other packs.

## Screen by screen

### App shell (new)
- **Before:** a Streamlit page with a title, a sidebar button and a gallery of notes; the hosted Try page was a separate single-page mock.
- **After:** both run as **Macro Stress Testing**, showing the book of the fictional processor Quillmar Payments (design brief in `docs/DESIGN.md`). A graphite command bar with a logo, five tabs, a Sample/Live switch, an environment badge and a role chip; a scenario rail on the right that stays on every screen (a bottom sheet on phones).
- **Why:** v2 asks for a branded, enterprise-looking shell and a mode switch that always shows which mode is on.

### Pulse (new)
- KPI tiles (volume, approval, delinquency, charge-off, pools outside appetite) with animated counters, deltas vs baseline and 24-month sparklines; volume by tier with holiday months shaded; macro backdrop charts; three "what the data shows" cards that link to the planted stories.
- **Why:** the first screen should show the book and the scenario at a glance.

### Scenario lab (rebuilt from the Try page's sliders and table)
- The same dials and presets (Mild, Base case, Severe, 2008-style), now driving a tier × product grid graded **Within appetite / Watch / Breach** against a new `MACRO_STRESS_APPETITE` table, a stress fan (charge-off per tier vs unemployment, with limits) and a per-tier table.
- **Why:** a risk committee asks "does anything breach?", so the scenario needed a decision, not just deltas.

### Pools (new)
- All 16 pools in a sortable, filterable table with status pills and charge-off meters; a drawer per pool with 24 months of history and the tier's betas.

### Stress notes (rebuilt)
- The grounded draft + verifier pattern is unchanged in spirit, with three upgrades: the fact pack is now **numbered** and the draft must cite `[F#]` after every number; the fact pack uses the **scenario** (not only the start and end of the window); and the verifier returns `claims_checked` plus its edits. Staged progress steps, a streaming reveal, hover-to-find citations, and the "inject an unsupported forecast" toggle are kept.
- Live mode saves each note to `MACRO_STRESS_REPORTS` (new columns `scenario`, `verifier_json`).

### Ask (new)
- The Cortex Agent your setup already created is now called from the app (`SNOWFLAKE.CORTEX.DATA_AGENT_RUN`), with suggested questions, staged steps, a streaming answer and the SQL it ran. Before, the agent could only be explored in Snowsight.

### Landing page (rebuilt)
- Moved to `docs/index.html` with its own identity: a problem-first headline, an inline SVG stress fan drawn from the pack's betas, an at-a-glance strip (setup time, cost, edition), six captioned screenshots with matching alt text, a how-it-works ladder naming each Snowflake capability, the planted stories, run options, the disclaimer and docs links. Light and dark mode; works at 390 px. No CDN scripts.

## Data and SQL

- **Seeded generator:** `data/generate.py` (seed 4242) now produces the portfolio, betas, appetite and synthetic indicators, writes `data/*.csv`, the hosted example's `docs/try/data/pack.json`, and the INSERT blocks inside both setup scripts. Same drivers, betas, seasonality and noise ranges as your SQL; re-running gives byte-identical files. Planted stories are documented in `data/README.md`.
- **Least-privilege role:** setup creates `SNOWPACK_MACRO_STRESS_ROLE`, grants it to the user running setup, builds everything as that role, and revokes the account-level create privileges at the end. `teardown.sql` drops objects as that role, then drops the role.
- **New objects:** `MACRO_STRESS_APPETITE` (table) and `MACRO_STRESS_SCENARIO(FLOAT, FLOAT)` (SQL table function). Call the function with FLOAT arguments; integer literals are rejected.
- **Unchanged:** the benchmark view, semantic view, agent tools and the real-data path in `app/setup.sql`. The agent's profile color changed to orange, and its prompt now says not to name real companies.
- **Files moved:** `index.html`, `styles.css`, `try/` and `assets/` moved to `docs/`. The old root `index.html` and `try/index.html` now just redirect, so your current links keep working until you change the Pages setting (below).

## Verified live (November 2026)

Setup, the scenario function, both AI paths and teardown ran in a test account with key-pair auth only. The app's scenario math matched `MACRO_STRESS_SCENARIO` exactly on all presets (`data/sample/parity.json`). Not run: `app/setup.sql` (no Marketplace listing in the test account) and opening the deployed Streamlit app in Snowsight.

## What to do after merging

1. **GitHub Pages:** Settings > Pages > Build and deployment > Deploy from a branch > `main`, folder **`/docs`**. Save, wait for the deploy, then open `/` and `/try/`.
2. **Check the hosted example:** every JS and CSS file referenced from `/try/index.html` should return 200 (`app.js`, `app.css`), and `/try/data/pack.json`, `/try/mock/notes.json` and `/try/mock/agent.json` should load. `docs/.nojekyll` is already committed.
3. **Remove the redirects:** once Pages serves `/docs`, delete the root `index.html` and `try/index.html`.
4. **Pull:** `git checkout main && git pull` after you merge.
5. **Rebuild commands** if you change data, SQL or prompts:

   ```bash
   python3 data/generate.py                 # regenerate data and the setup INSERT blocks
   # run app/setup_synthetic.sql in Snowflake
   export SNOWFLAKE_ACCOUNT=... SNOWFLAKE_USER=... SNOWFLAKE_PRIVATE_KEY_PATH=...
   python3 scripts/capture_sample.py        # parity check + Live AI notes and agent answers for Sample mode
   npm run build:example                    # or: python3 scripts/build_example.py
   python3 -m http.server 8811 --bind 127.0.0.1 --directory docs &
   python3 scripts/capture_screenshots.py   # docs/images/ and docs/images/cards/
   ```

6. **Catalog card:** `docs/images/cards/macro-stress-testing-1.jpg` to `-5.jpg` (960×600, under 100 KB) are ready for the Snow Packs catalog; ready for the catalog entry.

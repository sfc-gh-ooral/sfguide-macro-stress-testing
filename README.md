# Macro Stress Testing

**When rates climb and jobs soften, which part of your payments book breaks first?** This example stress-tests the book of a fictional processor, Quillmar Payments, against the macro cycle. Shock Fed funds and unemployment, see approval, 30-day delinquency and charge-off move per credit tier and product against risk appetite, and hand the risk committee a stress note in which every number cites a fact and a second AI pass checks it.

The app is **Macro Stress Testing** (design notes in [docs/DESIGN.md](docs/DESIGN.md)).

- Guide: https://sfc-gh-jsoliz.github.io/sfguide-macro-stress-testing/
- Hosted example, no account needed: https://sfc-gh-jsoliz.github.io/sfguide-macro-stress-testing/try/

Owner: Javier Soliz · Last reviewed: November 2026

This is an illustrative example, not an official Snowflake product, and not supported by Snowflake Support.

## What it shows

| Screen | What you do | Snowflake capability |
|---|---|---|
| Pulse | Read the June 2026 book under a scenario: KPI tiles with deltas, volume by tier with holiday months shaded, the macro backdrop | `MACRO_STRESS_SCENARIO` SQL table function, `MACRO_STRESS_BENCHMARK` view |
| Scenario lab | Turn the Fed funds and unemployment dials or pick a preset; a tier × product grid grades each pool Within appetite, Watch or Breach; a stress fan shows charge-off per tier as unemployment rises | `MACRO_STRESS_SCENARIO`, `MACRO_STRESS_BETA`, `MACRO_STRESS_APPETITE` |
| Pools | Sort and filter all 16 pools; open one for 24 months of history and its betas | `MACRO_STRESS_BENCHMARK` |
| Stress notes | Generate a committee note: a numbered fact pack, a grounded draft that cites `[F#]` after every number, and a verifier verdict. Optionally inject an unsupported forecast to watch the verifier flag it | Cortex `AI_COMPLETE` (twice per note); notes saved to `MACRO_STRESS_REPORTS` |
| Ask | Ask the book a question in plain English and see the SQL that answered it | Cortex Agents (`DATA_AGENT_RUN`) with Cortex Analyst over the `MACRO_STRESS_SV` semantic view |

A Sample/Live switch sits in the app header. Sample mode uses the bundled synthetic data and AI results captured from a Live run, labeled "Sample AI response", with staged progress steps and a 4–8 second delay. Live mode runs every query and AI call in your account and reports the measured latency; if a Live call fails, the app shows the error and never falls back to sample data.

## Prerequisites

- Snowflake **Enterprise Edition** or higher, in a region where Cortex `AI_COMPLETE`, Cortex Agents and Cortex Analyst are available (or with cross-region inference enabled). Tested in AWS US East 1 in November 2026.
- A role that can create roles and grant account privileges (for example `ACCOUNTADMIN`) to run setup. Setup then creates a least-privilege role, `SNOWPACK_MACRO_STRESS_ROLE`, and does everything else as that role.
- The `AI_COMPLETE` model `claude-sonnet-4-5`. If your account lacks it, change `MODEL` in `app/stress_core.py`.
- For the app: Streamlit in Snowflake, or locally Python 3.10+ with `streamlit` (tested 1.55), `pandas` and `altair`; Live mode locally also needs `snowflake-snowpark-python` (tested 1.42) and a key pair registered on your user.
- Optional: the free Marketplace listing **Financial Data Package** (database `SNOWFLAKE_PUBLIC_DATA_FINANCIAL_PACKAGE`) for real macro indicators.

## Quick start: no account

Open the [hosted example](https://sfc-gh-jsoliz.github.io/sfguide-macro-stress-testing/try/), or run the Streamlit app in Sample mode from a fresh clone:

```bash
pip install streamlit pandas altair
streamlit run app/streamlit_app.py
```

To serve the hosted example locally: `python3 -m http.server 8000 --bind 127.0.0.1 --directory docs`, then open http://127.0.0.1:8000/try/.

## Run Live mode

1. **Set up Snowflake.** Run [`app/setup_synthetic.sql`](app/setup_synthetic.sql) top to bottom in a worksheet (about 15 seconds on XSMALL). It creates the role, database, warehouse and every object below on synthetic data.
   - **Real macro data (optional):** get the free Financial Data Package listing, then run [`app/setup.sql`](app/setup.sql) instead. It keeps the synthetic portfolio and reads real CPI, unemployment, Fed funds, PCE and consumer sentiment from Cybersyn.
2. **Run the app**, either way:
   - **Streamlit in Snowflake:** follow [`app/deploy_streamlit.sql`](app/deploy_streamlit.sql). It creates a stage, lists the files to upload (`app/*.py`, `app/environment.yml`, `data/*.csv`, `data/sample/*.json`) and creates the `MACRO_STRESS_APP` Streamlit object. It opens in Live mode on your session.
   - **Locally, with key-pair auth:**

     ```bash
     pip install streamlit pandas altair snowflake-snowpark-python
     export SNOWFLAKE_ACCOUNT=<your_account>
     export SNOWFLAKE_USER=<YOUR_USER>
     export SNOWFLAKE_PRIVATE_KEY_PATH=~/.snowflake/keys/<your_key>.p8
     streamlit run app/streamlit_app.py
     ```

     Optional: `SNOWFLAKE_ROLE` (default `SNOWPACK_MACRO_STRESS_ROLE`) and `SNOWFLAKE_WAREHOUSE` (default `SNOWPACK_MACRO_STRESS_WH`). The app never asks for credentials in the browser. Keep any env file out of git (`.env.local` is ignored).
3. **Explore the notebook:** [`notebook/lab-macro-stress.ipynb`](notebook/) walks the pattern cell by cell (benchmark view → semantic view → fact pack → grounded draft → verifier).
4. **Clean up:** run [`app/teardown.sql`](app/teardown.sql).

To refresh the Sample data after changing anything: `python3 data/generate.py`, re-run setup, then `python3 scripts/capture_sample.py` (Live env vars set), `npm run build:example` (or `python3 scripts/build_example.py`) and `python3 scripts/capture_screenshots.py` with `docs/` served on port 8811.

## Objects created

| Object | Type | Purpose |
|---|---|---|
| `SNOWPACK_MACRO_STRESS_ROLE` | Role | Owns everything below; granted to the user who ran setup. Account-level create privileges are revoked again at the end of setup |
| `SNOWPACK_MACRO_STRESS` | Database | Dedicated, isolated database |
| `SNOWPACK_MACRO_STRESS.CORE` | Schema | Holds all objects below |
| `SNOWPACK_MACRO_STRESS_WH` | Warehouse | XSMALL, auto-suspend 60 s |
| `MACRO_STRESS_SEGMENT`, `MACRO_STRESS_PRODUCT`, `MACRO_STRESS_INDICATOR` | Tables | Credit tier, product and macro indicator dimensions |
| `MACRO_STRESS_PORTFOLIO_MONTHLY` | Table | Synthetic book by tier, product and month (384 rows); swap in your own data |
| `MACRO_STRESS_BETA` | Table | Per-tier elasticities for scenarios |
| `MACRO_STRESS_APPETITE` | Table | Illustrative charge-off limit per tier |
| `MACRO_STRESS_INDICATORS` | Table (synthetic) / View (real) | Monthly macro indicators |
| `MACRO_STRESS_BENCHMARK` | View | Portfolio joined to the macro backdrop; macro columns are non-additive |
| `MACRO_STRESS_SCENARIO(FLOAT, FLOAT)` | SQL table function | Latest month under a Fed funds (bps) and unemployment (pp) shock, with appetite status. Call it with FLOAT arguments: `TABLE(MACRO_STRESS_SCENARIO(200::FLOAT, 1::FLOAT))` |
| `MACRO_STRESS_DATA_SOURCE_INFO` | View | Which data mode is active |
| `MACRO_STRESS_SV` | Semantic view | Business layer for Cortex Analyst |
| `MACRO_STRESS_REPORTS` | Table | Saved stress notes with verifier verdicts |
| `MACRO_STRESS_AGENT` | Cortex Agent | Cortex Analyst over `MACRO_STRESS_SV`; the app calls it with `DATA_AGENT_RUN` |
| `APP_STAGE`, `MACRO_STRESS_APP` | Stage, Streamlit | Only if you deploy with `app/deploy_streamlit.sql` |

## Cost and time

Measured in November 2026 on an XSMALL warehouse:

- `setup_synthetic.sql`: 38 statements in about 15 seconds.
- `MACRO_STRESS_SCENARIO` returns in under a second; the app calls it on every dial change in Live mode.
- One stress note (two `AI_COMPLETE` calls): 6.6 to 9.2 seconds across 26 Live notes.
- One Cortex Agent answer: 12.0 to 28.5 seconds across 7 Live questions.
- Warehouse compute for setup plus a session of clicking around is a small fraction of a credit (well under 0.1; estimate from run time, as metering had not reported when we cleaned up). `AI_COMPLETE` and Cortex Agent calls bill Cortex credits per token on top; we didn't measure them, so check `SNOWFLAKE.ACCOUNT_USAGE.CORTEX_AISQL_USAGE_HISTORY` in your account.

## What was verified live

In November 2026, in a test account with key-pair authentication only: setup and teardown ran top to bottom; the Streamlit app ran in Live mode (scenario function, stress note generated and saved, Cortex Agent answer) via Streamlit's app test harness; the scenario math in the app matched `MACRO_STRESS_SCENARIO` exactly for all four presets and the baseline (`data/sample/parity.json`); `deploy_streamlit.sql` created the Streamlit object with all files on the stage. We didn't open the deployed app in Snowsight, and we didn't run `app/setup.sql`, because the Marketplace listing wasn't mounted in the test account.

## Known limitations

- The portfolio is **synthetic** (a processor's own book has no public source), and `setup_synthetic.sql` also uses synthetic macro indicators. Betas and appetite limits are illustrative, not estimated or calibrated.
- Scenarios shock only the latest month (June 2026) and treat effects as linear in the shock. Sentiment responds with a fixed illustrative elasticity.
- The macro backdrop joins the portfolio by month, so macro columns repeat across pools and must be averaged, never summed.
- The stress fan on the Scenario lab sweeps 13 unemployment points; in Live mode the app computes that sweep locally from the same tables and betas instead of calling the table function 13 times. The grid, tiles and notes use the table function.
- The verifier is itself an LLM. It catches unsupported numbers and hedge words on this data (3 of 20 clean drafts were flagged for computed percentages that were not in the fact pack; all 4 injected forecasts were flagged), but it is a review aid, not a guarantee.
- The hosted example has Sample notes only for the four presets (and the injected forecast for "All tiers"), and Sample answers only for the five suggested questions.
- The Streamlit app uses `use_container_width`, which current Streamlit marks deprecated, to stay compatible with older Streamlit in Snowflake runtimes.

## Customize with Cortex Code

Adapt this pack with [Cortex Code](https://docs.snowflake.com/en/user-guide/cortex-code/cortex-code). Try prompts like:

- "Explain this pack's data model and map `MACRO_STRESS_PORTFOLIO_MONTHLY` to my settlement tables without changing any objects. Propose least-privilege access and a validation plan first."
- "Add a `+300 bps / +2.5 pp` preset and make Deep-subprime react about twice as hard as Subprime in `MACRO_STRESS_BETA`; update `data/generate.py`, regenerate, and re-check parity with `MACRO_STRESS_SCENARIO`."
- "Set charge-off limits in `MACRO_STRESS_APPETITE` from my risk appetite statement and explain which pools move to Watch or Breach under each preset."

## Repository layout

```text
app/setup_synthetic.sql   Setup on synthetic data (role, DB, warehouse, tables, function, semantic view, agent)
app/setup.sql             Same, with real macro indicators from the Marketplace
app/teardown.sql          Cleanup
app/deploy_streamlit.sql  Streamlit in Snowflake deployment
app/streamlit_app.py      The app (Sample and Live)
app/stress_core.py        Data access, scenario math, fact pack and prompts
data/generate.py          Seeded data generator; data/README.md lists the planted stories
data/sample/              Results captured from a Live run (notes, agent answers, parity)
docs/                     GitHub Pages: landing page, DESIGN.md, images, hosted example in docs/try/
notebook/                 Step-by-step notebook
scripts/                  Sample capture, hosted-example build, screenshots
```

## License

Apache 2.0 (see [`LICENSE`](LICENSE)). Illustrative example on synthetic data, provided as-is; not an official Snowflake product and not supported by Snowflake Support. Not production, regulatory, compliance or financial advice. Contains no customer data. Review and test before any production use.

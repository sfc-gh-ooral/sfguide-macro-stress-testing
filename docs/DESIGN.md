# Design: Macro Stress Testing

This pack's app and landing page share one look. The product is called Macro Stress Testing; the firm whose book is shown is fictional.

## Brand

- **Product:** Macro Stress Testing, a stress-testing workspace for a payments processor's risk and FP&A (financial planning and analysis) team.
- **Fictional firm whose book is shown:** Quillmar Payments, a card, debit, prepaid and BNPL (buy now, pay later) processor.
- **Name check:** "Quillmar" is a coined stem. Exact-phrase web searches returned no firm, product or trademark with that name (November 2026).
- **Voice:** calm, exact, committee-ready. Short sentences, numbers with units, no hype. The app "shows", "moves" and "flags"; it never "predicts" or "guarantees". Every AI paragraph says where its numbers come from.

### Logo mark (inline SVG)

A keel under load: a square plate with a copper stress line that bends down through three tier bars.

```html
<svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
  <rect x="1" y="1" width="30" height="30" rx="7" fill="#1F2328"/>
  <rect x="7" y="9" width="4" height="15" rx="1" fill="#E9DFCC"/>
  <rect x="14" y="13" width="4" height="11" rx="1" fill="#E9DFCC"/>
  <rect x="21" y="17" width="4" height="7" rx="1" fill="#E9DFCC"/>
  <path d="M5 8 C 13 9, 19 14, 27 23" stroke="#D9693D" stroke-width="2.4" fill="none" stroke-linecap="round"/>
</svg>
```

Wordmark: "MACRO STRESS" in condensed caps with wide tracking, then "Testing" in regular weight.

## Design direction: an instrument panel on sand paper

### Palette

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#F4EFE6` sand | `#14161A` | page |
| `--surface` | `#FFFDF8` | `#1D2025` | cards, tables |
| `--surface-2` | `#EFE7D9` | `#262A30` | rails, table heads, skeletons |
| `--ink` | `#1F2328` graphite | `#EEE7DB` | body text |
| `--muted` | `#5B5F66` | `#A9A39A` | captions |
| `--line` | `#DDD2BF` | `#353A41` | hairlines |
| `--oxide` | `#A0421C` | `#E58358` | brand accent, stressed series, primary buttons |
| `--steel` | `#24545C` | `#7FB8C0` | baseline series, links |
| `--ok` | `#2F6B3A` | `#7CC48A` | Within appetite |
| `--watch` | `#835500` | `#E2B04A` | Watch |
| `--breach` | `#A8201A` | `#F0857E` | Breach |
| `--band` | `#E9DFCC` | `#2A2721` | holiday-month bands |

Text and pill colors were checked against their backgrounds with a contrast script; all pairs meet WCAG AA (4.5:1 for text).

### Typography

- Headings: a condensed sans stack (`"Avenir Next Condensed", "Roboto Condensed", "Arial Narrow", sans-serif`), uppercase eyebrow labels with 0.12em tracking.
- Body: system UI sans.
- Every figure: tabular monospace (`ui-monospace, "SF Mono", Menlo, Consolas, monospace`), so columns of rates line up like a trading blotter.
- No web fonts are downloaded; nothing loads from a CDN.

### Layout model

- **Top navigation**, not a sidebar: a graphite command bar with the logo, five tabs (Pulse, Scenario lab, Pools, Stress notes, Ask), the Sample/Live switch, an environment badge and a role chip ("R. Okafor · Portfolio risk").
- **Scenario rail on the right** (desktop): the two shock dials and four presets stay visible on every screen, so any screen can be read "under the scenario". On phones it becomes a sticky bottom bar that opens a sheet.
- **Pool drawer** slides in from the right with the 24-month history of one credit tier and product pool.
- Density: medium-high. 12-column grid, 16 px gutters, 8 px radius, 1 px hairlines instead of shadows.

### Charts

Hand-written SVG, no chart library:
- baseline dashed in steel, stressed solid in oxide, direct labels at the line end, plus a legend;
- November and December shaded as sand "holiday bands";
- hover or tap shows a tooltip with the month and exact values;
- a fan chart of charge-off against the unemployment shock per tier, with a marker at the current scenario.

### Motion

- Counters tween in 450 ms (ease-out cubic) when the scenario changes.
- Preset buttons animate the dials over 600 ms.
- Skeleton loaders shimmer in `--surface-2` while data loads.
- AI runs show staged steps with tick marks, then the note streams in word by word.
- The drawer slides 240 ms. All motion stops under `prefers-reduced-motion`.

### Dark mode

Follows `prefers-color-scheme`, with a manual toggle in the command bar. The sand turns to a warm charcoal; oxide and steel lighten to keep AA contrast.

## How this differs from the live catalog

Surveyed Try apps and landing pages (November 2026): Auto Finance Portfolio Analytics, Workforce Intelligence, Loss Triangle Analysis, Credit Risk Model Studio, Collections Copilot, Payment Fraud Workbench, Complaints Intelligence, Market Data Discovery, Wealth Advisor Assistant and Continuous Control Testing.

What we avoid:
- **Dark-green sidebar with a mint hero card** (Auto Finance): we use top navigation and no hero card in the app.
- **Purple or violet gradients** (Collections Copilot, Loss Triangle, Workforce): no gradients beyond a faint sand grain; no purple anywhere.
- **Black-and-lime trading terminal** (Payment Fraud): our dark surface is warm charcoal and the accent is oxide copper, not neon.
- **Beige editorial serif** (Credit Risk Model Studio): we use condensed sans headings and monospace figures, no serif.
- **Rose/red accent on white** (Complaints Intelligence) and **blue-on-white SaaS** (Wealth Advisor, Market Data Discovery, Continuous Control Testing): our base is sand, with oxide and steel.
- **Left sidebar + KPI row + chart** (most packs): our signature is the persistent right-hand scenario rail, so the whole app reads "under a shock".
- **Hero with a tilted product screenshot** (several landing pages): our landing hero is typographic, with an inline SVG "stress fan" drawn from the pack's own betas and a shock ladder.

Javier Soliz's other Payments packs use the catalog's default light-blue look; none uses sand, oxide or steel.

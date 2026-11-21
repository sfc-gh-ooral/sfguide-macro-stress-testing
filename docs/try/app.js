/* Macro Stress Testing: hosted example (Sample mode only). No external scripts. */
(() => {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const REPO = "https://github.com/sfc-gh-jsoliz/sfguide-macro-stress-testing";
  const TIER_VAR = { "Prime": "--t-prime", "Near-prime": "--t-near", "Subprime": "--t-sub", "Deep-subprime": "--t-deep" };
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- formatting
  const usd = (v) => Math.abs(v) >= 1e9 ? "$" + (v / 1e9).toFixed(2) + "B" : "$" + (v / 1e6).toFixed(1) + "M";
  const pct = (v, d = 2) => (v * 100).toFixed(d) + "%";
  const pts = (v) => (v >= 0 ? "+" : "−") + Math.abs(v * 100).toFixed(2) + " pts";
  const mon = (iso) => { const d = new Date(iso + "T00:00:00Z"); return d.toLocaleString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }); };

  // ---------- state
  const S = { fed: 200, un: 1.0, tab: "pulse", sort: { key: "charge_off_stress", dir: -1 }, filter: { tier: "", product: "", status: "", q: "" }, notes: [], current: null };
  let P, NOTES, AGENT;

  // ---------- scenario math (mirrors MACRO_STRESS_SCENARIO in app/setup_synthetic.sql)
  function betas() {
    const b = {};
    P.betas.forEach((r) => { (b[r.credit_tier] ||= {})[r.portfolio_metric] = r.beta; });
    return b;
  }
  let B, A, LATEST, MONTHS, BY;
  function scenario(fedBps = S.fed, unPp = S.un) {
    const fed = fedBps / 100, un = unPp, sent = -(1.5 * fed + 4 * un);
    return LATEST.map((r) => {
      const b = B[r.credit_tier], a = A[r.credit_tier];
      const co = r.charge_off_rate > 0 ? Math.max(0, r.charge_off_rate + b.charge_off_rate * un) : 0;
      const status = r.charge_off_rate === 0 ? "No credit risk" : co > a.charge_off_limit ? "Breach" : co >= a.watch_share * a.charge_off_limit ? "Watch" : "Within appetite";
      return {
        credit_tier: r.credit_tier, product: r.product,
        volume_base: r.transaction_volume_usd, volume_stress: r.transaction_volume_usd * (1 + b.transaction_volume_usd * sent),
        approval_base: r.approval_rate, approval_stress: Math.min(0.999, Math.max(0.30, r.approval_rate + b.approval_rate * fed)),
        delinquency_base: r.delinquency_rate_30d, delinquency_stress: r.delinquency_rate_30d > 0 ? Math.max(0, r.delinquency_rate_30d + b.delinquency_rate_30d * un) : 0,
        charge_off_base: r.charge_off_rate, charge_off_stress: co, charge_off_limit: a.charge_off_limit, status, sentiment_delta: sent,
      };
    });
  }
  function agg(sc, tier = "All tiers") {
    const d = tier === "All tiers" ? sc : sc.filter((r) => r.credit_tier === tier);
    const w = (rows, k) => { const t = rows.reduce((s, r) => s + r.volume_base, 0); return t ? rows.reduce((s, r) => s + r[k] * r.volume_base, 0) / t : 0; };
    const cr = d.filter((r) => r.charge_off_base > 0);
    return {
      vb: d.reduce((s, r) => s + r.volume_base, 0), vs: d.reduce((s, r) => s + r.volume_stress, 0),
      ab: w(d, "approval_base"), as: w(d, "approval_stress"), db: w(cr, "delinquency_base"), ds: w(cr, "delinquency_stress"),
      cb: w(cr, "charge_off_base"), cs: w(cr, "charge_off_stress"),
      breach: d.filter((r) => r.status === "Breach").length, watch: d.filter((r) => r.status === "Watch").length,
    };
  }
  const statusCls = (s) => ({ "Breach": "p-breach", "Watch": "p-watch", "Within appetite": "p-ok" }[s] || "p-none");
  const pill = (s) => `<span class="pill ${statusCls(s)}">${esc(s)}</span>`;

  // ---------- animated counters
  function tween(el, to, fmt, dur = 450) {
    const from = el.__v ?? to; el.__v = to;
    if (reduced || Math.abs(from - to) < 1e-12) { el.textContent = fmt(to); return; }
    const t0 = performance.now(), id = (el.__id = (el.__id || 0) + 1);
    const step = (now) => {
      if (el.__id !== id) return;
      const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(from + (to - from) * e);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ---------- charts (hand-written SVG)
  function tipOn(chart, html, x, y) { const t = $(".tip", chart); t.innerHTML = html; t.style.left = x + "px"; t.style.top = y + "px"; t.classList.add("on"); }
  function tipOff(chart) { $(".tip", chart).classList.remove("on"); }
  function scale(d0, d1, r0, r1) { return (v) => r0 + ((v - d0) / (d1 - d0 || 1)) * (r1 - r0); }
  function niceMax(v) { const p = Math.pow(10, Math.floor(Math.log10(v))); return Math.ceil(v / p * 2) / 2 * p; }

  function stackedBars(el, months, series, opts) {
    const W = 760, H = opts.h || 230, L = 46, R = 8, T = 10, Bm = 26;
    const tot = months.map((_, i) => series.reduce((s, x) => s + x.values[i], 0));
    const ymax = niceMax(Math.max(...tot)), x = (i) => L + (i * (W - L - R)) / months.length, bw = (W - L - R) / months.length - 4;
    const y = scale(0, ymax, H - Bm, T);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label)}"><g class="grid">`;
    for (let k = 0; k <= 4; k++) { const v = (ymax * k) / 4; s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 6}" y="${y(v) + 3}" text-anchor="end">${opts.fmtY(v)}</text>`; }
    s += `</g>`;
    months.forEach((m, i) => { if (/-(11|12)-/.test(m)) s += `<rect x="${x(i)}" y="${T}" width="${bw + 4}" height="${H - Bm - T}" fill="var(--band)"/>`; });
    months.forEach((m, i) => {
      let acc = 0;
      series.forEach((se) => { const v = se.values[i]; s += `<rect x="${x(i) + 2}" y="${y(acc + v)}" width="${bw}" height="${Math.max(0, y(acc) - y(acc + v))}" fill="${se.color}" rx="1"/>`; acc += v; });
      if (i % 3 === 0) s += `<text x="${x(i) + bw / 2 + 2}" y="${H - 8}" text-anchor="middle">${mon(m)}</text>`;
      s += `<rect class="hit" data-i="${i}" x="${x(i)}" y="${T}" width="${bw + 4}" height="${H - Bm - T}" fill="transparent"/>`;
    });
    s += `</svg><div class="tip"></div>`;
    el.innerHTML = s;
    $$(".hit", el).forEach((r) => {
      const show = () => {
        const i = +r.dataset.i, box = el.getBoundingClientRect(), rb = r.getBoundingClientRect();
        tipOn(el, `<b>${mon(months[i])}${/-(11|12)-/.test(months[i]) ? " · holiday" : ""}</b><br>` + series.map((se) => `${esc(se.name)}: ${opts.fmtY(se.values[i])}`).join("<br>") + `<br>Total: ${opts.fmtY(tot[i])}`, rb.left - box.left + rb.width / 2, rb.top - box.top + 20);
      };
      r.addEventListener("mouseenter", show); r.addEventListener("click", show); r.addEventListener("mouseleave", () => tipOff(el));
    });
  }

  function lines(el, xs, series, opts) {
    const W = opts.w || 760, H = opts.h || 220, L = 46, R = opts.r || 90, T = 12, Bm = 26;
    const all = series.flatMap((s) => s.values).filter((v) => v != null);
    const lo = opts.min ?? Math.min(...all), hi = opts.max ?? Math.max(...all), pad = (hi - lo) * 0.08 || 1;
    const y = scale(lo - (opts.min != null ? 0 : pad), hi + pad, H - Bm, T), x = scale(0, xs.length - 1, L, W - R);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label)}"><g class="grid">`;
    for (let k = 0; k <= 4; k++) { const v = lo + ((hi - lo) * k) / 4; s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 6}" y="${y(v) + 3}" text-anchor="end">${opts.fmtY(v)}</text>`; }
    s += `</g>`;
    if (opts.bands) xs.forEach((m, i) => { if (/-(11|12)-/.test(m)) s += `<rect x="${x(i) - (W - L - R) / xs.length / 2}" y="${T}" width="${(W - L - R) / xs.length}" height="${H - Bm - T}" fill="var(--band)"/>`; });
    if (opts.limits) opts.limits.forEach((l) => { s += `<line x1="${L}" x2="${W - R}" y1="${y(l.v)}" y2="${y(l.v)}" stroke="${l.color}" stroke-dasharray="2 4" opacity=".7"/>`; });
    xs.forEach((m, i) => { if (opts.xEvery && i % opts.xEvery === 0) s += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${opts.fmtX(m)}</text>`; });
    series.forEach((se) => {
      const d = se.values.map((v, i) => (v == null ? "" : `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)).join(" ");
      s += `<path d="${d}" fill="none" stroke="${se.color}" stroke-width="${se.w || 1.8}" ${se.dash ? 'stroke-dasharray="5 4"' : ""}/>`;
      const li = se.values.length - 1;
      if (opts.endLabels) s += `<text x="${x(li) + 6}" y="${y(se.values[li]) + 3}" style="fill:${se.color};font-weight:600">${esc(se.short || se.name)}</text>`;
    });
    if (opts.marker != null) {
      const mx = x(opts.marker);
      s += `<line x1="${mx}" x2="${mx}" y1="${T}" y2="${H - Bm}" stroke="var(--oxide)" stroke-width="1.2"/>`;
      series.forEach((se) => { const v = interp(se.values, opts.marker); s += `<circle cx="${mx}" cy="${y(v)}" r="4" fill="${se.color}" stroke="var(--surface)" stroke-width="1.5"/>`; });
    }
    s += `<rect class="hit" x="${L}" y="${T}" width="${W - L - R}" height="${H - Bm - T}" fill="transparent"/></svg><div class="tip"></div>`;
    el.innerHTML = s;
    const hit = $(".hit", el), svg = $("svg", el);
    const move = (ev) => {
      const r = svg.getBoundingClientRect(), px = ((ev.clientX - r.left) / r.width) * W;
      const i = Math.max(0, Math.min(xs.length - 1, Math.round(((px - L) / (W - L - R)) * (xs.length - 1))));
      const box = el.getBoundingClientRect();
      tipOn(el, `<b>${esc(opts.fmtX(xs[i]))}</b><br>` + series.map((se) => `${esc(se.name)}: ${se.values[i] == null ? "n/d" : opts.fmtY(se.values[i])}`).join("<br>"), ((x(i) / W) * r.width) + r.left - box.left, ev.clientY - box.top);
    };
    hit.addEventListener("mousemove", move); hit.addEventListener("click", move); hit.addEventListener("mouseleave", () => tipOff(el));
  }
  function interp(vals, i) { const a = Math.floor(i), b = Math.min(vals.length - 1, a + 1), t = i - a; return vals[a] + (vals[b] - vals[a]) * t; }
  function spark(vals, color) {
    const W = 120, H = 30, lo = Math.min(...vals), hi = Math.max(...vals), x = scale(0, vals.length - 1, 1, W - 3), y = scale(lo, hi, H - 3, 3);
    const d = vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" fill="none" stroke="${color}" stroke-width="1.5" vector-effect="non-scaling-stroke"/><circle cx="${x(vals.length - 1)}" cy="${y(vals[vals.length - 1])}" r="2.4" fill="${color}"/></svg>`;
  }
  const legend = (items) => `<div class="legend">${items.map((i) => `<span><i class="${i.dash ? "dash" : ""}" style="background:${i.color};color:${i.color}"></i>${esc(i.name)}</span>`).join("")}</div>`;

  // ---------- series helpers
  function monthly(filterFn, metric, weighted) {
    return MONTHS.map((m) => {
      const rows = BY[m].filter(filterFn);
      if (!weighted) return rows.reduce((s, r) => s + r[metric], 0);
      const cr = rows.filter((r) => r.delinquency_rate_30d > 0), t = cr.reduce((s, r) => s + r.transaction_volume_usd, 0);
      return t ? cr.reduce((s, r) => s + r[metric] * r.transaction_volume_usd, 0) / t : 0;
    });
  }
  const ind = (key) => MONTHS.map((m) => P.indicators.find((r) => r.indicator_key === key && r.month_end === m).indicator_value);

  // ---------- Pulse
  function renderPulse() {
    const sc = scenario(), a = agg(sc), base = agg(scenario(0, 0));
    const vol = monthly(() => true, "transaction_volume_usd"), dq = monthly(() => true, "delinquency_rate_30d", true), co = monthly(() => true, "charge_off_rate", true);
    const appr = MONTHS.map((m) => { const r = BY[m], t = r.reduce((s, x) => s + x.transaction_volume_usd, 0); return r.reduce((s, x) => s + x.approval_rate * x.transaction_volume_usd, 0) / t; });
    const yoy = (arr) => arr[arr.length - 1] / arr[arr.length - 13] - 1;
    const tiles = [
      ["Monthly volume", a.vs, usd, a.vs - a.vb, (d) => (d >= 0 ? "+" : "−") + usd(Math.abs(d)), d => d < 0 ? "dn-bad" : "up-good", `Jun 2025 → Jun 2026: ${(yoy(vol) * 100).toFixed(1)}%`, vol, css("--steel")],
      ["Approval rate", a.as, (v) => pct(v), a.as - a.ab, pts, d => d < 0 ? "dn-bad" : "up-good", `Baseline ${pct(a.ab)}`, appr, css("--steel")],
      ["30-day delinquency", a.ds, (v) => pct(v), a.ds - a.db, pts, d => d > 0 ? "up-bad" : "dn-good", `Credit products · baseline ${pct(a.db)}`, dq, css("--oxide")],
      ["Charge-off", a.cs, (v) => pct(v), a.cs - a.cb, pts, d => d > 0 ? "up-bad" : "dn-good", `Credit products · baseline ${pct(a.cb)}`, co, css("--oxide")],
    ];
    const kp = $("#kpis");
    if (!kp.children.length || kp.querySelector(".sk")) {
      kp.innerHTML = tiles.map((t, i) => `<div class="card kpi"><div class="l">${t[0]}</div><div class="v" data-k="${i}"></div><div class="d" data-d="${i}"></div><div class="b" data-b="${i}"></div>${spark(t[7], t[8])}</div>`).join("") +
        `<div class="card kpi"><div class="l">Pools outside appetite</div><div class="v"><span data-k="br">0</span><span class="flat" style="font-size:15px"> breach · </span><span data-k="wa">0</span><span class="flat" style="font-size:15px"> watch</span></div><div class="b">Charge-off vs tier limit, 8 credit pools</div><div class="b" style="margin-top:8px"><button class="link" data-go="lab">Open the scenario lab →</button></div></div>`;
    }
    tiles.forEach((t, i) => {
      tween($(`[data-k="${i}"]`, kp), t[1], t[2]);
      const d = $(`[data-d="${i}"]`, kp), dv = t[3];
      d.className = "d " + (Math.abs(dv) < 1e-9 ? "flat" : t[5](dv));
      d.textContent = Math.abs(dv) < 1e-9 ? "No change vs baseline" : t[4](dv) + " vs baseline";
      $(`[data-b="${i}"]`, kp).textContent = t[6];
    });
    tween($('[data-k="br"]', kp), a.breach, (v) => Math.round(v));
    tween($('[data-k="wa"]', kp), a.watch, (v) => Math.round(v));
    $("#pulse-sub").textContent = `${scenarioName()} applied to the June 2026 book of ${P.firm}. Sample data, synthetic.`;
    if (!$("#vol-chart").dataset.done) {
      stackedBars($("#vol-chart"), MONTHS, P.tiers.map((t) => ({ name: t, color: css(TIER_VAR[t]), values: monthly((r) => r.credit_tier === t, "transaction_volume_usd") })), { label: "Monthly transaction volume by credit tier, July 2024 to June 2026, with November and December shaded", fmtY: usd });
      $("#vol-legend").innerHTML = legend(P.tiers.map((t) => ({ name: t, color: css(TIER_VAR[t]) })).concat([{ name: "Holiday months (Nov–Dec)", color: css("--band") }]));
      lines($("#macro-chart"), MONTHS, [
        { name: "Unemployment", short: "Unemp.", values: ind("UNEMPLOYMENT"), color: css("--oxide") },
        { name: "Fed funds", short: "Fed funds", values: ind("FED_FUNDS"), color: css("--steel") },
      ], { label: "Unemployment rate and Fed funds rate by month", fmtY: (v) => v.toFixed(2) + "%", fmtX: mon, xEvery: 6, endLabels: true, h: 200, w: 480 });
      lines($("#sent-chart"), MONTHS, [{ name: "Consumer sentiment", short: "Sentiment", values: ind("SENTIMENT"), color: css("--muted") }], { label: "Consumer sentiment index by month", fmtY: (v) => v.toFixed(1), fmtX: mon, xEvery: 6, endLabels: true, h: 130, w: 480 });
      lines($("#dq-chart"), MONTHS, [
        { name: "30-day delinquency", short: "Delinq.", values: dq, color: css("--oxide") },
        { name: "Charge-off", short: "Charge-off", values: co, color: css("--steel") },
      ], { label: "Volume-weighted delinquency and charge-off on credit products by month, holiday months shaded", fmtY: (v) => pct(v, 1), fmtX: mon, xEvery: 4, endLabels: true, bands: true, min: 0, h: 190 });
      $("#vol-chart").dataset.done = 1;
    }
  }

  // ---------- Scenario lab
  function renderLab() {
    const sc = scenario();
    let h = `<div class="hd"></div>` + P.products.map((p) => `<div class="hd">${esc(p)}</div>`).join("");
    P.tiers.forEach((t) => {
      h += `<div class="tier">${esc(t)}</div>`;
      P.products.forEach((p) => {
        const r = sc.find((x) => x.credit_tier === t && x.product === p);
        const c = { "Breach": "c-breach", "Watch": "c-watch", "Within appetite": "c-ok" }[r.status] || "c-none";
        h += r.charge_off_base > 0
          ? `<button class="cell ${c}" data-pool="${esc(t)}|${esc(p)}" aria-label="${esc(t)} ${esc(p)}: charge-off ${pct(r.charge_off_stress)}, ${esc(r.status)}"><div class="v">${pct(r.charge_off_stress)}</div><div class="s">limit ${pct(r.charge_off_limit, 1)} · ${esc(r.status)}</div></button>`
          : `<div class="cell c-none" aria-label="${esc(t)} ${esc(p)}: no credit risk"><div class="v">—</div><div class="s">No credit risk</div></div>`;
      });
    });
    $("#heat").innerHTML = h;
    // fan chart: charge-off vs unemployment shock per tier
    const us = Array.from({ length: 13 }, (_, i) => i * 0.25);
    const series = P.tiers.map((t) => ({ name: t, short: t, color: css(TIER_VAR[t]), values: us.map((u) => agg(scenario(S.fed, u), t).cs) }));
    lines($("#fan"), us, series, { label: "Volume-weighted charge-off by tier as unemployment rises from 0 to 3 percentage points, with tier limits dashed", fmtY: (v) => pct(v, 1), fmtX: (u) => "+" + u.toFixed(2) + " pp", xEvery: 4, endLabels: true, min: 0, marker: S.un / 0.25, r: 100, limits: P.tiers.map((t) => ({ v: A[t].charge_off_limit, color: css(TIER_VAR[t]) })) });
    $("#fan-legend").innerHTML = legend(series.map((s) => ({ name: s.name, color: s.color })).concat([{ name: "Tier charge-off limit", color: css("--muted"), dash: true }]));
    const rows = P.tiers.map((t) => { const a = agg(sc, t); return `<tr class="click" data-tier="${esc(t)}"><td>${esc(t)}</td><td class="n">${pct(a.ab)}<span class="delta ${a.as < a.ab ? "dn-bad" : "flat"}">${pts(a.as - a.ab)}</span></td><td class="n">${pct(a.ds)}<span class="delta ${a.ds > a.db ? "up-bad" : "flat"}">${pts(a.ds - a.db)}</span></td><td class="n">${pct(a.cs)}<span class="delta ${a.cs > a.cb ? "up-bad" : "flat"}">${pts(a.cs - a.cb)}</span></td><td class="n">${pct(A[t].charge_off_limit, 1)}</td><td>${a.breach ? pill("Breach") : a.watch ? pill("Watch") : pill("Within appetite")}</td></tr>`; }).join("");
    $("#tier-body").innerHTML = rows;
  }

  // ---------- Pools
  const COLS = [
    ["credit_tier", "Tier", false], ["product", "Product", false], ["volume_stress", "Volume", true], ["approval_stress", "Approval", true],
    ["delinquency_stress", "30d delinq.", true], ["charge_off_stress", "Charge-off", true], ["status", "Status", false],
  ];
  function renderPools() {
    const sc = scenario(), f = S.filter;
    let rows = sc.filter((r) => (!f.tier || r.credit_tier === f.tier) && (!f.product || r.product === f.product) && (!f.status || r.status === f.status) && (!f.q || (r.credit_tier + " " + r.product).toLowerCase().includes(f.q.toLowerCase())));
    const { key, dir } = S.sort;
    rows = rows.slice().sort((a, b) => (typeof a[key] === "string" ? a[key].localeCompare(b[key]) : a[key] - b[key]) * dir);
    $("#pool-head").innerHTML = COLS.map(([k, l, n]) => `<th class="${n ? "n" : ""}" aria-sort="${k === key ? (dir > 0 ? "ascending" : "descending") : "none"}"><button data-sort="${k}">${l}</button></th>`).join("");
    const base = (r, k) => r[k.replace("_stress", "_base")];
    $("#pool-body").innerHTML = rows.length ? rows.map((r) => {
      const meter = r.charge_off_base > 0 ? `<div class="meter"><i style="width:${Math.min(100, (r.charge_off_stress / (r.charge_off_limit * 1.25)) * 100)}%;background:var(${r.status === "Breach" ? "--breach" : r.status === "Watch" ? "--watch" : "--ok"})"></i><b style="left:80%"></b></div>` : "";
      const cell = (k, fmt, badUp) => { const d = r[k] - base(r, k); return `<td class="n">${fmt(r[k])}<span class="delta ${Math.abs(d) < 1e-9 ? "flat" : (d > 0) === badUp ? "up-bad" : "dn-good"}">${k === "volume_stress" ? (d >= 0 ? "+" : "−") + usd(Math.abs(d)) : pts(d)}</span></td>`; };
      return `<tr class="click" tabindex="0" data-pool="${esc(r.credit_tier)}|${esc(r.product)}"><td>${esc(r.credit_tier)}</td><td>${esc(r.product)}</td>${cell("volume_stress", usd, false)}${cell("approval_stress", (v) => pct(v), false)}${r.delinquency_base > 0 ? cell("delinquency_stress", (v) => pct(v), true) : `<td class="n flat">—</td>`}${r.charge_off_base > 0 ? `<td class="n">${pct(r.charge_off_stress)}${meter}</td>` : `<td class="n flat">—</td>`}<td>${pill(r.status)}</td></tr>`;
    }).join("") : `<tr><td colspan="7"><div class="empty"><b>No pools match these filters</b>Clear a filter to see all 16 tier × product pools.<br><button class="btn mt" id="clear-filters">Clear filters</button></div></td></tr>`;
    $("#pool-count").textContent = `${rows.length} of 16 pools`;
  }

  function openPool(tier, product) {
    const hist = P.portfolio.filter((r) => r.credit_tier === tier && r.product === product);
    const r = scenario().find((x) => x.credit_tier === tier && x.product === product), b = B[tier], pool = P.pools.find((x) => x.credit_tier === tier && x.product === product);
    const d = $("#drawer");
    d.innerHTML = `<button class="icon-btn x" style="color:var(--ink);border-color:var(--line)" aria-label="Close" data-close>✕</button>
      <div class="eyebrow">Pool detail · ${esc(scenarioName())}</div><h2 style="font-size:22px;margin-top:4px">${esc(tier)} · ${esc(product)}</h2>
      <div style="margin-top:8px">${pill(r.status)} <span class="powered">MACRO_STRESS_SCENARIO</span></div>
      <div class="kv">
        <div><small>Volume (Jun 2026)</small><b>${usd(r.volume_base)} → ${usd(r.volume_stress)}</b></div>
        <div><small>Approval</small><b>${pct(r.approval_base)} → ${pct(r.approval_stress)}</b></div>
        <div><small>30-day delinquency</small><b>${r.delinquency_base ? pct(r.delinquency_base) + " → " + pct(r.delinquency_stress) : "No credit risk"}</b></div>
        <div><small>Charge-off (limit ${pct(r.charge_off_limit, 1)})</small><b>${r.charge_off_base ? pct(r.charge_off_base) + " → " + pct(r.charge_off_stress) : "No credit risk"}</b></div>
        <div><small>Holiday lift</small><b>+${(pool.holiday_lift * 100).toFixed(0)}% Nov–Dec</b></div>
        <div><small>Average ticket</small><b>$${pool.avg_ticket}</b></div>
      </div>
      <h3>Volume, 24 months</h3><div class="chart" id="d-vol"></div>
      ${r.charge_off_base ? `<h3 class="mt">Credit health, 24 months</h3><div class="chart" id="d-risk"></div>${legend([{ name: "30-day delinquency", color: css("--oxide") }, { name: "Charge-off", color: css("--steel") }])}` : ""}
      <h3 class="mt">Sensitivity betas (${esc(tier)})</h3>
      <table><tbody>
        <tr><td>Approval per +1 pp Fed funds</td><td class="n">${pts(b.approval_rate)}</td></tr>
        <tr><td>30-day delinquency per +1 pp unemployment</td><td class="n">${pts(b.delinquency_rate_30d)}</td></tr>
        <tr><td>Charge-off per +1 pp unemployment</td><td class="n">${pts(b.charge_off_rate)}</td></tr>
        <tr><td>Volume per +1 pt sentiment</td><td class="n">+${(b.transaction_volume_usd * 100).toFixed(1)}%</td></tr>
      </tbody></table><p class="b" style="color:var(--muted);font-size:12px">From MACRO_STRESS_BETA. Synthetic, illustrative elasticities.</p>`;
    stackedBars($("#d-vol", d), MONTHS, [{ name: "Volume", color: css(TIER_VAR[tier]), values: hist.map((h) => h.transaction_volume_usd) }], { label: `Monthly volume for ${tier} ${product}`, fmtY: usd, h: 170 });
    if (r.charge_off_base) lines($("#d-risk", d), MONTHS, [{ name: "30-day delinquency", values: hist.map((h) => h.delinquency_rate_30d), color: css("--oxide") }, { name: "Charge-off", values: hist.map((h) => h.charge_off_rate), color: css("--steel") }], { label: `Delinquency and charge-off for ${tier} ${product}`, fmtY: (v) => pct(v, 1), fmtX: mon, xEvery: 6, bands: true, min: 0, h: 170, r: 10 });
    d.classList.add("on"); $("#scrim").classList.add("on"); $("[data-close]", d).focus();
  }
  function closeDrawer() { $("#drawer").classList.remove("on"); $("#scrim").classList.remove("on"); }

  // ---------- AI helpers
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function runSteps(el, steps, total) {
    el.innerHTML = steps.map((s) => `<li><i></i>${esc(s)}</li>`).join("");
    const lis = $$("li", el), each = total / steps.length;
    for (let i = 0; i < lis.length; i++) { lis[i].className = "run"; await sleep(each * (0.8 + Math.random() * 0.4)); lis[i].className = "done"; }
  }
  function md(text) {
    const lines = text.split("\n"); let h = "", tbl = false, ul = false, head = true;
    const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\[(F\d+)\]/g, '<span class="cite" data-f="$1" tabindex="0">$1</span>');
    for (const L of lines) {
      if (/^\s*\|/.test(L)) {
        const cells = L.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        if (cells.every((c) => /^:?-+:?$/.test(c))) continue;
        if (!tbl) { h += '<div class="tbl-wrap"><table>'; tbl = true; head = true; }
        h += "<tr>" + cells.map((c) => (head ? `<th>${inline(c)}</th>` : `<td>${inline(c)}</td>`)).join("") + "</tr>"; head = false; continue;
      } else if (tbl) { h += "</table></div>"; tbl = false; }
      if (/^\s*[-*] /.test(L)) { if (!ul) { h += "<ul>"; ul = true; } h += `<li>${inline(L.replace(/^\s*[-*] /, ""))}</li>`; continue; } else if (ul) { h += "</ul>"; ul = false; }
      if (/^# /.test(L)) h += `<h1>${inline(L.slice(2))}</h1>`;
      else if (/^#{2,3} /.test(L)) h += `<h3>${inline(L.replace(/^#+ /, ""))}</h3>`;
      else if (L.trim()) h += `<p>${inline(L)}</p>`;
    }
    if (tbl) h += "</table></div>"; if (ul) h += "</ul>";
    return h;
  }
  async function stream(el, text) {
    const words = text.split(/(\s+)/); let out = "";
    el.classList.add("caret");
    const chunk = Math.max(2, Math.ceil(words.length / 90));
    for (let i = 0; i < words.length; i += chunk) { out += words.slice(i, i + chunk).join(""); el.innerHTML = md(out); if (!reduced) await sleep(18); }
    el.innerHTML = md(text); el.classList.remove("caret");
  }

  // ---------- Stress notes
  function presetFor(fed, un) { return P.presets.find((p) => p.fedBps === fed && Math.abs(p.unPp - un) < 1e-9); }
  function findNote(tier, inj) { const p = presetFor(S.fed, S.un); return p && NOTES.find((n) => n.tier === tier && n.preset === p.name && n.injected === inj); }
  function renderHistory() {
    $("#history").innerHTML = S.notes.length ? S.notes.map((n, i) => `<li><button data-note="${i}" aria-current="${S.current === n}"><span class="pill ${n.verdict.status === "verified" ? "p-ok" : "p-breach"}">${n.verdict.status === "verified" ? "Verified" : "Needs review"}</span> <b>${esc(n.tier)}</b><small>${esc(n.preset)} · ${n.facts.length} facts · ${n.verdict.edits.length} flagged${n.injected ? " · injected forecast" : ""}</small></button></li>`).join("") : `<li class="empty"><b>No notes yet</b>Generate one above.</li>`;
  }
  function showNote(n, animate) {
    S.current = n; renderHistory();
    $("#note-inject").checked = !!n.injected; $("#note-tier").value = n.tier;
    const v = n.verdict, ok = v.status === "verified";
    $("#facts").innerHTML = n.facts.map((f) => `<li class="fact" data-fact="${f.id}"><b>${f.id}</b><div><span>${esc(f.label)}</span><em>${esc(f.value)}</em><span>${esc(f.source)}</span></div></li>`).join("");
    const body = $("#note-body");
    const verdict = `<div class="verdict ${ok ? "ok" : "bad"}"><b>${ok ? "Verified" : "Needs review"}</b> · ${v.claims_checked ?? "—"} numeric claims checked · ${v.residual_hedges ?? 0} hedges · ${v.edits.length} flagged
      ${v.edits.length ? `<ul>${v.edits.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>` : ""}</div>`;
    const head = `<div class="form-row" style="justify-content:space-between"><span class="ai-label">Sample AI response · captured from Cortex AI_COMPLETE (${MODEL()}) in ${(n.latencyMs / 1000).toFixed(1)} s</span><span class="powered">MACRO_STRESS_REPORTS</span></div>`;
    if (!animate) { body.innerHTML = head + `<div class="note">${md(n.draft)}</div>` + verdict; return; }
    body.innerHTML = head + `<div class="note" id="note-text"></div><div id="note-verdict"></div>`;
    return stream($("#note-text"), n.draft).then(() => { $("#note-verdict").innerHTML = verdict; });
  }
  // Keep the shown note in step with the tier and injection controls.
  function syncNote() {
    const tier = $("#note-tier").value, inj = $("#note-inject").checked;
    $("#note-gate").innerHTML = "";
    const seen = S.notes.find((x) => x.tier === tier && x.injected === inj && x.preset === (presetFor(S.fed, S.un) || {}).name);
    const n = seen || findNote(tier, inj);
    if (n) { if (!seen) S.notes.unshift({ ...n }); showNote(seen || S.notes[0], false); return; }
    $("#note-body").innerHTML = `<div class="callout">No captured note matches these settings yet. Select Generate note.</div>`;
    S.current = null; renderHistory();
  }
  const MODEL = () => "claude-sonnet-4-5";
  async function generateNote() {
    const tier = $("#note-tier").value, inj = $("#note-inject").checked, n = findNote(tier, inj);
    const box = $("#note-gate");
    if (!presetFor(S.fed, S.un)) {
      box.innerHTML = `<div class="callout">Sample notes were captured for the four presets. Pick one to generate a note: ${P.presets.map((p) => `<button class="btn" data-preset="${esc(p.name)}">${esc(p.name)}</button>`).join(" ")}</div>`;
      return;
    }
    if (!n) { box.innerHTML = `<div class="callout">The captured sample has an injected-forecast note for “All tiers” only. Switch the tier to All tiers, or turn the injection off.</div>`; return; }
    box.innerHTML = "";
    const btn = $("#note-run"); btn.disabled = true;
    $("#note-body").innerHTML = `<ol class="steps" id="note-steps"></ol><div class="sk" style="height:14px;width:70%"></div><div class="sk mt" style="height:14px;width:90%"></div><div class="sk mt" style="height:120px"></div>`;
    await runSteps($("#note-steps"), [
      `Running MACRO_STRESS_SCENARIO(${S.fed}, ${S.un}) on 16 pools…`,
      `Building a fact pack of ${n.facts.length} numbered facts…`,
      "Drafting the note with Cortex AI_COMPLETE under data rules…",
      inj ? "Appending the injected forecast to test the verifier…" : "Checking every number against the fact pack…",
      "Verifier pass with Cortex AI_COMPLETE…",
    ], 4200 + Math.random() * 2400);
    const copy = { ...n };
    S.notes.unshift(copy);
    await showNote(copy, true);
    btn.disabled = false;
  }

  // ---------- Ask
  async function ask(q) {
    const a = AGENT.find((x) => x.question === q), chat = $("#chat");
    chat.insertAdjacentHTML("beforeend", `<div class="msg user">${esc(q)}</div>`);
    if (!a) {
      chat.insertAdjacentHTML("beforeend", `<div class="msg bot"><span class="ai-label">Sample mode</span><p>The hosted example answers the five captured questions above. Run the app in Live mode to ask the Cortex Agent anything. <a href="${REPO}#run-live-mode-locally">Live-mode guide</a></p></div>`);
      return;
    }
    const id = "m" + Date.now();
    chat.insertAdjacentHTML("beforeend", `<div class="msg bot" id="${id}"><ol class="steps"></ol></div>`);
    const m = $("#" + id);
    m.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
    await runSteps($(".steps", m), ["Planning with the Macro Stress Agent…", "Reading semantic view MACRO_STRESS_SV…", "Generating SQL with Cortex Analyst…", "Running SQL on SNOWPACK_MACRO_STRESS_WH…", "Writing the answer…"], 4500 + Math.random() * 2500);
    m.innerHTML = `<span class="ai-label">Sample AI response · captured from the Cortex Agent in ${(a.latencyMs / 1000).toFixed(1)} s</span><div class="note" id="${id}t"></div>`;
    await stream($("#" + id + "t"), a.text);
    m.insertAdjacentHTML("beforeend", `<p style="font-size:12px;color:var(--muted)">Source: semantic view MACRO_STRESS_SV via Cortex Analyst. Synthetic data.</p>${a.sql.map((s) => `<details><summary>SQL the agent ran</summary><pre>${esc(s)}</pre></details>`).join("")}`);
  }

  // ---------- rail + scenario wiring
  function scenarioName() { const p = presetFor(S.fed, S.un); return (p ? p.name + ": " : "") + `+${S.fed} bps Fed funds, +${S.un.toFixed(2)} pp unemployment`; }
  function renderRail() {
    $("#fed-v").textContent = `+${S.fed} bps`; $("#un-v").textContent = `+${S.un.toFixed(2)} pp`;
    $("#fed").value = S.fed; $("#un").value = S.un;
    $$("#presets .btn").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.fed === S.fed && Math.abs(+b.dataset.un - S.un) < 1e-9)));
    const a = agg(scenario()), m = (k) => ind(k)[MONTHS.length - 1];
    $("#rail-sum").innerHTML = `<div>Fed funds <b>${m("FED_FUNDS").toFixed(2)}% → ${(m("FED_FUNDS") + S.fed / 100).toFixed(2)}%</b></div><div>Unemployment <b>${m("UNEMPLOYMENT").toFixed(2)}% → ${(m("UNEMPLOYMENT") + S.un).toFixed(2)}%</b></div><div>Sentiment (modeled) <b>${m("SENTIMENT").toFixed(1)} → ${(m("SENTIMENT") + scenario()[0].sentiment_delta).toFixed(1)}</b></div><div>Breach · Watch <b>${a.breach} · ${a.watch}</b></div>`;
    $("#sheet-sum").textContent = scenarioName();
  }
  function refresh() { renderRail(); renderPulse(); renderLab(); renderPools(); }
  let raf;
  function animateTo(f, u) {
    cancelAnimationFrame(raf);
    const f0 = S.fed, u0 = S.un, t0 = performance.now(), dur = reduced ? 1 : 600;
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      S.fed = p < 1 ? Math.round((f0 + (f - f0) * e) / 25) * 25 : f; S.un = p < 1 ? Math.round((u0 + (u - u0) * e) * 4) / 4 : u;
      refresh(); if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  function go(tab) {
    S.tab = tab;
    $$(".tab").forEach((t) => t.setAttribute("aria-selected", String(t.dataset.tab === tab)));
    $$(".screen").forEach((s) => s.classList.toggle("on", s.id === "s-" + tab));
    $(".tabs").classList.remove("open");
    history.replaceState(null, "", "#" + tab);
    window.scrollTo({ top: 0 });
  }

  // ---------- events
  function wire() {
    $$(".tab").forEach((t) => t.addEventListener("click", () => go(t.dataset.tab)));
    $("#menu").addEventListener("click", () => $(".tabs").classList.toggle("open"));
    $("#fed").addEventListener("input", (e) => { S.fed = +e.target.value; refresh(); });
    $("#un").addEventListener("input", (e) => { S.un = +e.target.value; refresh(); });
    $$("#presets .btn").forEach((b) => b.addEventListener("click", () => animateTo(+b.dataset.fed, +b.dataset.un)));
    $("#reset").addEventListener("click", () => animateTo(0, 0));
    $("#sheet-bar").addEventListener("click", () => { const r = $(".rail"); r.classList.toggle("open"); $("#sheet-bar").setAttribute("aria-expanded", r.classList.contains("open")); });
    document.addEventListener("click", (e) => {
      const t = e.target.closest("[data-go],[data-pool],[data-tier],[data-sort],[data-note],[data-close],[data-preset],#clear-filters,[data-q]");
      if (!t) return;
      if (t.dataset.go) go(t.dataset.go);
      else if (t.dataset.pool) { const [a, b] = t.dataset.pool.split("|"); openPool(a, b); }
      else if (t.dataset.tier) { S.filter.tier = t.dataset.tier; $("#f-tier").value = t.dataset.tier; renderPools(); go("pools"); }
      else if (t.dataset.sort) { const k = t.dataset.sort; S.sort = { key: k, dir: S.sort.key === k ? -S.sort.dir : -1 }; renderPools(); }
      else if (t.dataset.note) showNote(S.notes[+t.dataset.note], false);
      else if ("close" in t.dataset) closeDrawer();
      else if (t.dataset.preset) { const p = P.presets.find((x) => x.name === t.dataset.preset); animateTo(p.fedBps, p.unPp); $("#note-gate").innerHTML = ""; }
      else if (t.id === "clear-filters") { S.filter = { tier: "", product: "", status: "", q: "" }; ["#f-tier", "#f-product", "#f-status", "#f-q"].forEach((s) => ($(s).value = "")); renderPools(); }
      else if (t.dataset.q) ask(t.dataset.q);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { closeDrawer(); $("#live-modal").classList.remove("on"); }
      if (e.key === "Enter" && e.target.matches("tr[data-pool]")) { const [a, b] = e.target.dataset.pool.split("|"); openPool(a, b); }
    });
    $("#scrim").addEventListener("click", closeDrawer);
    [["#f-tier", "tier"], ["#f-product", "product"], ["#f-status", "status"], ["#f-q", "q"]].forEach(([s, k]) => $(s).addEventListener("input", (e) => { S.filter[k] = e.target.value; renderPools(); }));
    $("#note-run").addEventListener("click", generateNote);
    $("#note-inject").addEventListener("change", syncNote);
    $("#note-tier").addEventListener("change", syncNote);
    document.addEventListener("mouseover", (e) => {
      const c = e.target.closest(".cite"); $$(".fact.hot,.cite.hot").forEach((x) => x.classList.remove("hot"));
      if (c) { const f = $(`[data-fact="${c.dataset.f}"]`); if (f) { f.classList.add("hot"); f.scrollIntoView({ block: "nearest" }); } c.classList.add("hot"); }
    });
    $("#ask-form").addEventListener("submit", (e) => { e.preventDefault(); const q = $("#ask-input").value.trim(); if (q) { ask(q); $("#ask-input").value = ""; } });
    $("#mode-live").addEventListener("click", () => $("#live-modal").classList.add("on"));
    $("#live-close").addEventListener("click", () => $("#live-modal").classList.remove("on"));
    $("#theme").addEventListener("click", () => {
      const r = document.documentElement, dark = r.dataset.theme !== "dark";
      r.dataset.theme = dark ? "dark" : "light"; try { localStorage.setItem("mst-theme", r.dataset.theme); } catch (_) {}
      $("#vol-chart").dataset.done = ""; refresh();
    });
  }

  // ---------- boot
  async function boot() {
    try {
      const [p, n, a] = await Promise.all(["data/pack.json", "mock/notes.json", "mock/agent.json"].map((u) => fetch(u).then((r) => { if (!r.ok) throw new Error(u + " returned " + r.status); return r.json(); })));
      P = p; NOTES = n; AGENT = a;
    } catch (err) {
      $("#boot-error").innerHTML = `<div class="callout err"><b>Couldn't load the sample data.</b> ${esc(err.message)}. Reload the page, or run the app from the repository.</div>`;
      return;
    }
    B = betas(); A = Object.fromEntries(P.appetite.map((r) => [r.credit_tier, r]));
    MONTHS = [...new Set(P.portfolio.map((r) => r.month_end))];
    BY = Object.fromEntries(MONTHS.map((m) => [m, P.portfolio.filter((r) => r.month_end === m)]));
    LATEST = BY[P.asOf];
    $("#note-tier").innerHTML = ["All tiers", ...P.tiers].map((t) => `<option>${esc(t)}</option>`).join("");
    $("#f-tier").innerHTML = `<option value="">All tiers</option>` + P.tiers.map((t) => `<option>${esc(t)}</option>`).join("");
    $("#f-product").innerHTML = `<option value="">All products</option>` + P.products.map((t) => `<option>${esc(t)}</option>`).join("");
    $("#suggest").innerHTML = AGENT.map((x) => `<button class="btn" data-q="${esc(x.question)}">${esc(x.question)}</button>`).join("");
    S.notes = [NOTES.find((x) => x.tier === "All tiers" && x.preset === "Base case" && !x.injected), NOTES.find((x) => x.tier === "All tiers" && x.preset === "Base case" && x.injected)].filter(Boolean).map((x) => ({ ...x }));
    wire();
    refresh();
    if (S.notes[0]) showNote(S.notes[0], false);
    const h = location.hash.slice(1); if (["pulse", "lab", "pools", "notes", "ask"].includes(h)) go(h);
  }
  try { const t = localStorage.getItem("mst-theme"); if (t) document.documentElement.dataset.theme = t; else if (matchMedia("(prefers-color-scheme: dark)").matches) document.documentElement.dataset.theme = "dark"; } catch (_) {}
  boot();
})();

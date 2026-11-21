"""Macro Stress Testing (Streamlit).

Runs in Streamlit in Snowflake (Live mode on the active session) or locally:
  Sample mode: bundled synthetic data in data/, captured AI results in data/sample/. No account needed.
  Live mode:   the pack's objects in SNOWPACK_MACRO_STRESS.CORE; AI_COMPLETE and the Cortex Agent run for real.
"""
import json
import random
import sys
import time
from pathlib import Path

import altair as alt
import pandas as pd
import streamlit as st

sys.path.insert(0, str(Path(__file__).resolve().parent))
import stress_core as core  # noqa: E402

st.set_page_config(page_title="Macro Stress Testing", layout="wide", initial_sidebar_state="collapsed")

TOK = dict(bg="#F4EFE6", surface="#FFFDF8", surface2="#EFE7D9", ink="#1F2328", muted="#5B5F66", line="#DDD2BF",
           oxide="#A0421C", steel="#24545C", ok="#2F6B3A", watch="#835500", breach="#A8201A", band="#E9DFCC")
TIER_COLORS = {"Prime": "#24545C", "Near-prime": "#6E7F3A", "Subprime": "#B0661C", "Deep-subprime": "#A8201A"}
STATUS_CLS = {"Breach": "breach", "Watch": "watch", "Within appetite": "ok", "No credit risk": "none"}
LOGO = ('<svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true"><rect x="1" y="1" width="30" height="30" rx="7" fill="#2B3036"/>'
        '<rect x="7" y="9" width="4" height="15" rx="1" fill="#E9DFCC"/><rect x="14" y="13" width="4" height="11" rx="1" fill="#E9DFCC"/>'
        '<rect x="21" y="17" width="4" height="7" rx="1" fill="#E9DFCC"/><path d="M5 8 C 13 9, 19 14, 27 23" stroke="#D9693D" '
        'stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>')

st.markdown(f"""<style>
.stApp {{ background: {TOK['bg']}; color: {TOK['ink']}; }}
header[data-testid="stHeader"] {{ background: transparent; }}
.block-container {{ padding-top: 1rem; max-width: 1440px; }}
h1, h2, h3 {{ font-family: "Avenir Next Condensed", "Roboto Condensed", "Arial Narrow", sans-serif !important; letter-spacing: .01em; color: {TOK['ink']}; }}
.hv-bar {{ background: {TOK['ink']}; color: #EEE7DB; border-radius: 8px; padding: 10px 16px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }}
.hv-bar b {{ font: 700 15px "Avenir Next Condensed", "Arial Narrow", sans-serif; letter-spacing: .18em; }}
.hv-bar .sub {{ color: #A9A39A; font-family: "Avenir Next Condensed", "Arial Narrow", sans-serif; }}
.hv-env {{ margin-left: auto; font: 600 11px ui-monospace, Menlo, monospace; padding: 5px 8px; border-radius: 4px; }}
.hv-env.sample {{ background: #3B2A20; color: #F2B79A; }} .hv-env.live {{ background: #1E3A2A; color: #9FE0B0; }}
.hv-user {{ font-size: 12px; color: #EEE7DB; }} .hv-user small {{ color: #A9A39A; }}
.hv-eyebrow {{ font: 600 11px "Avenir Next Condensed", "Arial Narrow", sans-serif; letter-spacing: .12em; text-transform: uppercase; color: {TOK['muted']}; }}
.hv-kpis {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin: 8px 0 4px; }}
.hv-kpi {{ background: {TOK['surface']}; border: 1px solid {TOK['line']}; border-radius: 8px; padding: 14px; }}
.hv-kpi .l {{ font-size: 12px; color: {TOK['muted']}; }}
.hv-kpi .v {{ font: 600 23px ui-monospace, Menlo, monospace; margin: 3px 0; }}
.hv-kpi .d {{ font: 12px ui-monospace, Menlo, monospace; }}
.bad {{ color: {TOK['breach']}; }} .good {{ color: {TOK['ok']}; }} .flat {{ color: {TOK['muted']}; }}
.hv-pill {{ display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 12px; font-weight: 600; }}
.hv-pill.ok {{ color: {TOK['ok']}; background: #E4EADD; }} .hv-pill.watch {{ color: {TOK['watch']}; background: #F1E6D0; }}
.hv-pill.breach {{ color: {TOK['breach']}; background: #F5DED8; }} .hv-pill.none {{ color: {TOK['muted']}; background: {TOK['surface2']}; }}
.hv-powered {{ display: inline-block; font: 600 10.5px ui-monospace, Menlo, monospace; color: {TOK['steel']}; border: 1px solid {TOK['line']}; border-radius: 4px; padding: 3px 6px; }}
.hv-ai {{ display: inline-block; font: 600 11px ui-monospace, Menlo, monospace; color: {TOK['oxide']}; border: 1px dashed {TOK['oxide']}; border-radius: 4px; padding: 3px 7px; margin-bottom: 6px; }}
.hv-cite {{ font: 600 10.5px ui-monospace, Menlo, monospace; color: {TOK['steel']}; background: #E2EAE9; border-radius: 3px; padding: 0 4px; }}
.hv-verdict {{ border-radius: 8px; padding: 10px 14px; border: 1px solid {TOK['line']}; margin-top: 10px; }}
.hv-verdict.ok {{ background: #E8EEE4; }} .hv-verdict.bad {{ background: #F6E4E0; }}
div[data-testid="stTabs"] button p {{ font-family: "Avenir Next Condensed", "Arial Narrow", sans-serif; text-transform: uppercase; letter-spacing: .06em; font-weight: 600; }}
.stButton > button[kind="primary"] {{ background: {TOK['oxide']}; border-color: {TOK['oxide']}; color: #fff; }}
</style>""", unsafe_allow_html=True)


# ---------------------------------------------------------------- mode
@st.cache_resource(show_spinner=False)
def _session():
    return core.live_session()


def live_available():
    try:
        return _session(), None
    except Exception as e:  # noqa: BLE001
        return None, str(e)


@st.cache_data(show_spinner=False, ttl=600)
def live_tables(_src):
    port = _src._df(f"SELECT * FROM {core.SCHEMA}.MACRO_STRESS_PORTFOLIO_MONTHLY")
    port["month_end"] = pd.to_datetime(port["month_end"])
    return (port, _src._df(f"SELECT * FROM {core.SCHEMA}.MACRO_STRESS_BETA"),
            _src._df(f"SELECT * FROM {core.SCHEMA}.MACRO_STRESS_APPETITE"))


if "mode" not in st.session_state:
    sess, _ = live_available()
    st.session_state["mode"] = "Live" if sess is not None else "Sample"

bar_l, bar_r = st.columns([5, 2])
with bar_r:
    mode = st.radio("Data mode", ["Sample", "Live"], horizontal=True, key="mode", label_visibility="collapsed")
with bar_l:
    st.markdown(f'<div class="hv-bar">{LOGO}<b>MACRO STRESS</b><span class="sub">Testing · Quillmar Payments</span>'
                f'<span class="hv-env {"live" if mode == "Live" else "sample"}">{"LIVE · SNOWFLAKE" if mode == "Live" else "SAMPLE · SYNTHETIC"}</span>'
                f'<span class="hv-user">R. Okafor <small>Portfolio risk</small></span></div>', unsafe_allow_html=True)

if mode == "Live":
    session, err = live_available()
    if session is None:
        st.error("Live mode isn't connected. " + (err or ""))
        st.markdown("Run `app/setup_synthetic.sql`, then start the app with key-pair auth:\n\n"
                    "```bash\nexport SNOWFLAKE_ACCOUNT=<your_account>\nexport SNOWFLAKE_USER=<YOUR_USER>\n"
                    "export SNOWFLAKE_PRIVATE_KEY_PATH=~/.snowflake/keys/<your_key>.p8\nstreamlit run app/streamlit_app.py\n```\n"
                    "Or deploy the app as Streamlit in Snowflake (see README). Switch to Sample to keep exploring.")
        st.stop()
    src = core.LiveSource(session)
else:
    src = core.SampleSource()


@st.cache_data(show_spinner=False)
def sample_ai():
    d = core.DATA_DIR / "sample"
    return json.loads((d / "notes.json").read_text()), json.loads((d / "agent.json").read_text())


try:
    bench = src.benchmark()
    data_mode, data_note = src.data_note()
except Exception as e:  # noqa: BLE001
    st.error(f"Couldn't read the pack's tables in Snowflake: {e}. Check that setup ran and that the role is SNOWPACK_MACRO_STRESS_ROLE.")
    st.stop()

st.caption(("Sample mode: bundled synthetic data; AI answers were captured from a Live run and are labeled Sample AI response. "
            if mode == "Sample" else "Live mode: reading SNOWPACK_MACRO_STRESS.CORE. ") + data_note)

# ---------------------------------------------------------------- scenario rail
PRESET_MAP = {n: (f, u) for n, f, u in core.PRESETS}
if "fed" not in st.session_state:
    st.session_state.update(fed=200, un=1.0)


def apply_preset(name):
    st.session_state["fed"], st.session_state["un"] = PRESET_MAP[name]


main, rail = st.columns([3.3, 1], gap="large")
with rail:
    st.markdown('<div class="hv-eyebrow">Scenario · shock dials</div>', unsafe_allow_html=True)
    st.slider("Fed funds shock (bps)", 0, 300, step=25, key="fed")
    st.slider("Unemployment shock (pp)", 0.0, 3.0, step=0.25, key="un")
    pc = st.columns(2)
    for i, (n, _, _) in enumerate(core.PRESETS):
        pc[i % 2].button(n, key=f"p_{n}", on_click=apply_preset, args=(n,), use_container_width=True)
    st.caption("Betas from MACRO_STRESS_BETA: approval moves with Fed funds; delinquency and charge-off with unemployment; "
               "volume with a modeled sentiment response. Debit and prepaid carry no credit risk.")

fed, un = st.session_state["fed"], float(st.session_state["un"])
preset = next((n for n, f, u in core.PRESETS if f == fed and abs(u - un) < 1e-9), None)
scen_name = (preset + ": " if preset else "") + f"+{fed} bps Fed funds, +{un:.2f} pp unemployment"
try:
    t0 = time.time()
    sc = src.scenario(fed, un)
    scen_ms = int((time.time() - t0) * 1000)
except Exception as e:  # noqa: BLE001
    st.error(f"MACRO_STRESS_SCENARIO failed: {e}")
    st.stop()
base = src.scenario(0, 0)
agg, agg0 = core.aggregate(sc), core.aggregate(base)
latest = bench[bench["month_end"] == bench["month_end"].max()].iloc[0]
with rail:
    st.markdown(f"""<div style="font-size:12.5px;border-top:1px dashed {TOK['line']};padding-top:8px">
Fed funds <b style="float:right;font-family:ui-monospace">{latest['fed_funds_rate']:.2f}% → {latest['fed_funds_rate'] + fed / 100:.2f}%</b><br>
Unemployment <b style="float:right;font-family:ui-monospace">{latest['unemployment_rate']:.2f}% → {latest['unemployment_rate'] + un:.2f}%</b><br>
Sentiment (modeled) <b style="float:right;font-family:ui-monospace">{latest['consumer_sentiment']:.1f} → {latest['consumer_sentiment'] + sc['sentiment_delta'].iloc[0]:.1f}</b><br>
Breach · Watch <b style="float:right;font-family:ui-monospace">{agg['breaches']} · {agg['watches']}</b></div>""", unsafe_allow_html=True)
    if mode == "Live":
        st.caption(f"MACRO_STRESS_SCENARIO ran in {scen_ms} ms.")


def pill(s):
    return f'<span class="hv-pill {STATUS_CLS.get(s, "none")}">{s}</span>'


def delta(v, kind, bad_up=True):
    if abs(v) < 1e-12:
        return '<span class="flat">No change vs baseline</span>'
    cls = "bad" if (v > 0) == bad_up else "good"
    txt = (("+" if v > 0 else "−") + core.usd(abs(v))) if kind == "usd" else f"{'+' if v > 0 else '−'}{abs(v) * 100:.2f} pts"
    return f'<span class="{cls}">{txt} vs baseline</span>'


def band_layer(df_months):
    hol = pd.DataFrame({"m": [m for m in df_months if m.month in (11, 12)]})
    return alt.Chart(hol).mark_rect(color=TOK["band"], opacity=.9).encode(x="yearmonth(m):T", x2=alt.X2("yearmonth(m):T"))


def stream_text(text):
    for w in text.split(" "):
        yield w + " "
        time.sleep(0.012)


def staged(steps, total):
    box = st.empty()
    done = []
    per = total / len(steps)
    for s in steps:
        box.markdown("\n".join([f"- ✓ {d}" for d in done] + [f"- ⏳ **{s}**"]))
        time.sleep(per * random.uniform(0.8, 1.2))
        done.append(s)
    box.markdown("\n".join(f"- ✓ {d}" for d in done))


def cite_md(text):
    import re
    return re.sub(r"\[(F\d+)\]", r'<span class="hv-cite">\1</span>', text)


with main:
    tabs = st.tabs(["Pulse", "Scenario lab", "Pools", "Stress notes", "Ask"])

    # ------------------------------------------------ Pulse
    with tabs[0]:
        st.markdown('<div class="hv-eyebrow">Portfolio pulse · June 2026</div>', unsafe_allow_html=True)
        st.markdown(f"### How the book reads under the scenario\n{scen_name}. "
                    '<span class="hv-powered">Powered by MACRO_STRESS_SCENARIO</span>', unsafe_allow_html=True)
        st.markdown(f"""<div class="hv-kpis">
<div class="hv-kpi"><div class="l">Monthly volume</div><div class="v">{core.usd(agg['volume_stress'])}</div><div class="d">{delta(agg['volume_stress'] - agg['volume_base'], 'usd', bad_up=False)}</div></div>
<div class="hv-kpi"><div class="l">Approval rate</div><div class="v">{core.pct(agg['approval_stress'])}</div><div class="d">{delta(agg['approval_stress'] - agg['approval_base'], 'pts', bad_up=False)}</div></div>
<div class="hv-kpi"><div class="l">30-day delinquency · credit</div><div class="v">{core.pct(agg['delinquency_stress'])}</div><div class="d">{delta(agg['delinquency_stress'] - agg['delinquency_base'], 'pts')}</div></div>
<div class="hv-kpi"><div class="l">Charge-off · credit</div><div class="v">{core.pct(agg['charge_off_stress'])}</div><div class="d">{delta(agg['charge_off_stress'] - agg['charge_off_base'], 'pts')}</div></div>
<div class="hv-kpi"><div class="l">Pools outside appetite</div><div class="v">{agg['breaches']} <span class="flat" style="font-size:14px">breach</span> · {agg['watches']} <span class="flat" style="font-size:14px">watch</span></div><div class="d flat">8 credit pools vs tier limits</div></div>
</div>""", unsafe_allow_html=True)
        c1, c2 = st.columns([3, 2])
        vol = bench.groupby(["month_end", "credit_tier"], as_index=False)["transaction_volume_usd"].sum()
        vol["volume_b"] = vol["transaction_volume_usd"] / 1e9
        months = sorted(bench["month_end"].unique())
        bars = alt.Chart(vol).mark_bar().encode(
            x=alt.X("yearmonth(month_end):T", title=None), y=alt.Y("sum(volume_b):Q", title="Volume ($B)"),
            color=alt.Color("credit_tier:N", sort=core.TIERS, scale=alt.Scale(domain=list(TIER_COLORS), range=list(TIER_COLORS.values())),
                            legend=alt.Legend(title=None, orient="bottom")),
            order=alt.Order("credit_tier:N"),
            tooltip=[alt.Tooltip("yearmonth(month_end):T", title="Month"), alt.Tooltip("credit_tier:N", title="Tier"),
                     alt.Tooltip("volume_b:Q", title="$B", format=".2f")])
        c1.markdown("**Monthly volume by credit tier** · holiday months shaded <span class='hv-powered'>MACRO_STRESS_BENCHMARK</span>", unsafe_allow_html=True)
        c1.altair_chart((band_layer(pd.to_datetime(months)) + bars).properties(height=280), use_container_width=True)
        macro = bench.groupby("month_end", as_index=False)[["unemployment_rate", "fed_funds_rate", "consumer_sentiment"]].mean()
        ml = macro.melt("month_end", ["unemployment_rate", "fed_funds_rate"], var_name="series", value_name="pct")
        ml["series"] = ml["series"].map({"unemployment_rate": "Unemployment", "fed_funds_rate": "Fed funds"})
        c2.markdown("**Macro backdrop** <span class='hv-powered'>MACRO_STRESS_INDICATORS</span>", unsafe_allow_html=True)
        c2.altair_chart(alt.Chart(ml).mark_line(strokeWidth=2).encode(
            x=alt.X("yearmonth(month_end):T", title=None), y=alt.Y("pct:Q", title="Percent", scale=alt.Scale(zero=False)),
            color=alt.Color("series:N", scale=alt.Scale(range=[TOK["oxide"], TOK["steel"]]), legend=alt.Legend(title=None, orient="bottom")),
            tooltip=[alt.Tooltip("yearmonth(month_end):T", title="Month"), "series:N", alt.Tooltip("pct:Q", format=".2f")]).properties(height=170),
            use_container_width=True)
        c2.altair_chart(alt.Chart(macro).mark_line(color=TOK["muted"]).encode(
            x=alt.X("yearmonth(month_end):T", title=None), y=alt.Y("consumer_sentiment:Q", title="Sentiment", scale=alt.Scale(zero=False)),
            tooltip=[alt.Tooltip("yearmonth(month_end):T", title="Month"), alt.Tooltip("consumer_sentiment:Q", format=".1f")]).properties(height=110),
            use_container_width=True)

    # ------------------------------------------------ Scenario lab
    with tabs[1]:
        st.markdown('<div class="hv-eyebrow">Scenario lab · June 2026</div>', unsafe_allow_html=True)
        st.markdown("### Charge-off against appetite, pool by pool\nLimits from MACRO_STRESS_APPETITE; Watch starts at 80% of the limit.")
        grid = sc.pivot_table(index="credit_tier", columns="product", values="charge_off_stress", aggfunc="first").reindex(core.TIERS)[core.PRODUCTS]
        stat = sc.pivot_table(index="credit_tier", columns="product", values="status", aggfunc="first").reindex(core.TIERS)[core.PRODUCTS]
        html = "<table style='width:100%;border-collapse:separate;border-spacing:6px'><tr><th></th>" + "".join(f"<th style='text-align:left;font-size:12px;color:{TOK['muted']}'>{p}</th>" for p in core.PRODUCTS) + "</tr>"
        bg = {"Breach": "#F5DED8", "Watch": "#F1E6D0", "Within appetite": "#E4EADD", "No credit risk": TOK["surface2"]}
        for t in core.TIERS:
            html += f"<tr><td style='font-weight:600'>{t}</td>"
            for p in core.PRODUCTS:
                s_ = stat.loc[t, p]
                v = "—" if s_ == "No credit risk" else core.pct(grid.loc[t, p])
                html += f"<td style='background:{bg[s_]};border-radius:6px;padding:8px'><b style='font-family:ui-monospace'>{v}</b><br><small>{s_}</small></td>"
            html += "</tr>"
        st.markdown(html + "</table>", unsafe_allow_html=True)
        us = [i * 0.25 for i in range(13)]
        fan = []
        tables = live_tables(src) if mode == "Live" else (src.portfolio, src.betas, src.appetite)
        for u in us:
            s2 = core.scenario_frame(*tables, fed, u)  # same betas as MACRO_STRESS_SCENARIO; parity checked in data/sample/parity.json
            for t in core.TIERS:
                fan.append(dict(u=u, tier=t, co=core.aggregate(s2, t)["charge_off_stress"] * 100))
        fan = pd.DataFrame(fan)
        lines = alt.Chart(fan).mark_line(strokeWidth=2).encode(
            x=alt.X("u:Q", title="Unemployment shock (pp)"), y=alt.Y("co:Q", title="Charge-off (%)"),
            color=alt.Color("tier:N", sort=core.TIERS, scale=alt.Scale(domain=list(TIER_COLORS), range=list(TIER_COLORS.values())), legend=alt.Legend(title=None, orient="bottom")),
            tooltip=["tier:N", alt.Tooltip("u:Q", title="Shock pp"), alt.Tooltip("co:Q", title="Charge-off %", format=".2f")])
        rule = alt.Chart(pd.DataFrame({"u": [un]})).mark_rule(color=TOK["oxide"]).encode(x="u:Q")
        st.markdown("**Stress fan: charge-off vs unemployment shock** <span class='hv-powered'>MACRO_STRESS_BETA</span>", unsafe_allow_html=True)
        st.altair_chart((lines + rule).properties(height=280), use_container_width=True)

    # ------------------------------------------------ Pools
    with tabs[2]:
        st.markdown('<div class="hv-eyebrow">Pools · 4 tiers × 4 products</div>', unsafe_allow_html=True)
        f1, f2, f3 = st.columns(3)
        ft = f1.multiselect("Tier", core.TIERS)
        fp = f2.multiselect("Product", core.PRODUCTS)
        fs = f3.multiselect("Status", ["Breach", "Watch", "Within appetite", "No credit risk"])
        view = sc.copy()
        if ft: view = view[view["credit_tier"].isin(ft)]
        if fp: view = view[view["product"].isin(fp)]
        if fs: view = view[view["status"].isin(fs)]
        if view.empty:
            st.info("No pools match these filters. Clear a filter to see all 16 pools.")
        else:
            show = view[["credit_tier", "product", "volume_stress", "approval_stress", "delinquency_stress", "charge_off_stress", "charge_off_limit", "status"]].copy()
            show["volume_stress"] = show["volume_stress"] / 1e6
            for c in ["approval_stress", "delinquency_stress", "charge_off_stress", "charge_off_limit"]:
                show[c] = show[c] * 100
            st.dataframe(show.sort_values("charge_off_stress", ascending=False), hide_index=True, use_container_width=True, column_config={
                "credit_tier": "Tier", "product": "Product", "volume_stress": st.column_config.NumberColumn("Volume ($M)", format="%.1f"),
                "approval_stress": st.column_config.NumberColumn("Approval %", format="%.2f"),
                "delinquency_stress": st.column_config.NumberColumn("30d delinq. %", format="%.2f"),
                "charge_off_stress": st.column_config.ProgressColumn("Charge-off %", format="%.2f", min_value=0, max_value=15),
                "charge_off_limit": st.column_config.NumberColumn("Limit %", format="%.1f"), "status": "Status"})
        pick = st.selectbox("Open a pool", [f"{t} · {p}" for t in core.TIERS for p in core.PRODUCTS], index=15)
        t, p = pick.split(" · ")
        r = sc[(sc["credit_tier"] == t) & (sc["product"] == p)].iloc[0]
        hist = bench[(bench["credit_tier"] == t) & (bench["product"] == p)]
        st.markdown(f"#### {t} · {p} {pill(r['status'])}", unsafe_allow_html=True)
        k = st.columns(4)
        k[0].metric("Volume (Jun 2026)", core.usd(r["volume_stress"]), core.usd(r["volume_stress"] - r["volume_base"]))
        k[1].metric("Approval", core.pct(r["approval_stress"]), f"{(r['approval_stress'] - r['approval_base']) * 100:+.2f} pts")
        k[2].metric("30d delinquency", core.pct(r["delinquency_stress"]) if r["delinquency_base"] else "—",
                    f"{(r['delinquency_stress'] - r['delinquency_base']) * 100:+.2f} pts" if r["delinquency_base"] else None, delta_color="inverse")
        k[3].metric(f"Charge-off (limit {core.pct(r['charge_off_limit'], 1)})", core.pct(r["charge_off_stress"]) if r["charge_off_base"] else "—",
                    f"{(r['charge_off_stress'] - r['charge_off_base']) * 100:+.2f} pts" if r["charge_off_base"] else None, delta_color="inverse")
        h = hist.melt("month_end", ["delinquency_rate_30d", "charge_off_rate"], var_name="metric", value_name="rate")
        h["rate"] *= 100
        st.altair_chart(alt.Chart(h).mark_line().encode(x=alt.X("yearmonth(month_end):T", title=None), y=alt.Y("rate:Q", title="%"),
                        color=alt.Color("metric:N", scale=alt.Scale(range=[TOK["oxide"], TOK["steel"]]), legend=alt.Legend(title=None, orient="bottom")),
                        tooltip=[alt.Tooltip("yearmonth(month_end):T", title="Month"), "metric:N", alt.Tooltip("rate:Q", format=".2f")]).properties(height=200),
                        use_container_width=True)

    # ------------------------------------------------ Stress notes
    with tabs[3]:
        st.markdown('<div class="hv-eyebrow">Stress notes · grounded draft + verifier</div>', unsafe_allow_html=True)
        st.markdown("### A committee note where every number cites a fact <span class='hv-powered'>Powered by Cortex AI_COMPLETE</span>", unsafe_allow_html=True)
        n1, n2, n3 = st.columns([2, 2, 1])
        tier = n1.selectbox("Subject", ["All tiers"] + core.TIERS)
        inj = n2.checkbox("Inject an unsupported forecast (to test the verifier)")
        run = n3.button("Generate stress note", type="primary", use_container_width=True)
        if run:
            steps = [f"Running MACRO_STRESS_SCENARIO({fed}, {un}) on 16 pools", "Building the numbered fact pack",
                     f"Drafting with Cortex AI_COMPLETE ({core.MODEL}) under data rules",
                     "Appending the injected forecast" if inj else "Checking every number against the fact pack",
                     "Verifier pass with Cortex AI_COMPLETE"]
            if mode == "Sample":
                notes, _ = sample_ai()
                note = next((n for n in notes if n["tier"] == tier and n["preset"] == preset and n["injected"] == inj), None)
                if note is None:
                    st.warning("Sample notes were captured for the four presets (and the injected forecast for All tiers only). "
                               "Pick a preset in the scenario rail, or switch to Live.")
                else:
                    staged(steps, random.uniform(4.5, 7.0))
                    st.session_state["note"] = dict(note, sample=True)
            else:
                with st.spinner(" → ".join(steps)):
                    try:
                        note = core.run_note(src, bench, tier, fed, un, inj)
                        src.save_report(tier, scen_name, note["draft"], note["verdict"]["status"], note["verdict"])
                        st.session_state["note"] = dict(note, sample=False, fresh=True)
                    except Exception as e:  # noqa: BLE001
                        st.error(f"AI_COMPLETE failed: {e}")
        note = st.session_state.get("note")
        if note:
            a, b = st.columns([3, 2])
            with a:
                label = "Sample AI response · captured from Live" if note.get("sample") else "Live · Cortex AI_COMPLETE"
                st.markdown(f'<span class="hv-ai">{label} · {note["latencyMs"] / 1000:.1f} s</span>', unsafe_allow_html=True)
                if note.pop("fresh", False) or run:
                    ph = st.empty()
                    acc = ""
                    for w in stream_text(note["draft"]):
                        acc += w
                        ph.markdown(cite_md(acc), unsafe_allow_html=True)
                else:
                    st.markdown(cite_md(note["draft"]), unsafe_allow_html=True)
                v = note["verdict"]
                ok = v["status"] == "verified"
                st.markdown(f'<div class="hv-verdict {"ok" if ok else "bad"}"><b>{"Verified" if ok else "Needs review"}</b> · '
                            f'{v.get("claims_checked", "—")} numeric claims checked · {v.get("residual_hedges") or 0} hedges · {len(v["edits"])} flagged'
                            + ("<ul>" + "".join(f"<li>{e}</li>" for e in v["edits"]) + "</ul>" if v["edits"] else "") + "</div>", unsafe_allow_html=True)
            with b:
                st.markdown("**Fact pack** · the only numbers the note may use")
                st.dataframe(pd.DataFrame(note["facts"])[["id", "label", "value", "source"]], hide_index=True, use_container_width=True, height=420)
        if mode == "Live":
            st.markdown("**Saved notes** <span class='hv-powered'>MACRO_STRESS_REPORTS</span>", unsafe_allow_html=True)
            rep = src.reports()
            if rep.empty:
                st.info("No notes saved yet. Generate one above.")
            else:
                st.dataframe(rep[["created_at", "subject", "scenario", "status", "edits_applied"]], hide_index=True, use_container_width=True)

    # ------------------------------------------------ Ask
    with tabs[4]:
        st.markdown('<div class="hv-eyebrow">Ask · Cortex Agent over a semantic view</div>', unsafe_allow_html=True)
        st.markdown("### Ask the book a question in plain English <span class='hv-powered'>Powered by Cortex Agents</span>", unsafe_allow_html=True)
        _, answers = sample_ai()
        qs = [a_["question"] for a_ in answers]
        q = st.selectbox("Suggested questions", qs)
        free = st.text_input("Or ask your own (Live mode)", disabled=(mode == "Sample"))
        if st.button("Ask", type="primary"):
            question = free.strip() or q
            st.markdown(f"**You:** {question}")
            steps = ["Planning with the Macro Stress Agent", "Reading semantic view MACRO_STRESS_SV",
                     "Generating SQL with Cortex Analyst", "Running SQL on SNOWPACK_MACRO_STRESS_WH", "Writing the answer"]
            if mode == "Sample":
                ans = next(a_ for a_ in answers if a_["question"] == question)
                staged(steps, random.uniform(4.5, 7.5))
                st.markdown(f'<span class="hv-ai">Sample AI response · captured from the Cortex Agent · {ans["latencyMs"] / 1000:.1f} s</span>', unsafe_allow_html=True)
            else:
                with st.spinner(" → ".join(steps)):
                    t0 = time.time()
                    try:
                        ans = src.ask_agent(question)
                    except Exception as e:  # noqa: BLE001
                        st.error(f"The Cortex Agent call failed: {e}")
                        st.stop()
                st.markdown(f'<span class="hv-ai">Live · Cortex Agent · {time.time() - t0:.1f} s</span>', unsafe_allow_html=True)
            ph = st.empty()
            acc = ""
            for w in stream_text(ans["text"] or "The agent returned no text."):
                acc += w
                ph.markdown(acc)
            for s_ in ans.get("sql", []):
                with st.expander("SQL the agent ran"):
                    st.code(s_, language="sql")

st.markdown(f"<p style='color:{TOK['muted']};font-size:12px;margin-top:24px'>Quillmar Payments is fictional. Synthetic data and "
            "illustrative logic; not production, regulatory or financial advice. An example, not an official Snowflake product. "
            "Owner: Javier Soliz.</p>", unsafe_allow_html=True)

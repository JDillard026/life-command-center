"use client";

import { useEffect, useMemo, useState } from "react";

const LS_BILLS = "lcc_bills_v5"; // ✅ MUST match Bills page
const LS_PORT_ASSETS = "lcc_port_assets_v1";
const LS_PORT_TXNS = "lcc_port_txns_v1";
const LS_PORT_PRICES = "lcc_port_prices_v1";

// Addictive dashboard state
const LS_DASH = "lcc_dash_v2";

function safeParse(str, fallback) {
  try {
    const v = JSON.parse(str);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function toNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function money(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function isoDate(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function normSymbol(s) {
  return String(s || "").trim().toUpperCase();
}

function daysBetween(fromISO, toISO) {
  if (!fromISO || !toISO) return null;
  const a = new Date(String(fromISO) + "T00:00:00");
  const b = new Date(String(toISO) + "T00:00:00");
  const t = b.getTime() - a.getTime();
  if (!Number.isFinite(t)) return null;
  return Math.round(t / 86400000);
}

function normalizeBillsState(saved) {
  // Bills v5 saves { version, settings, items } (but also tolerate arrays)
  const base = saved && typeof saved === "object" ? saved : {};
  const items = Array.isArray(base.items) ? base.items : Array.isArray(base) ? base : [];
  return { items: items.filter(Boolean) };
}

function clamp(n, lo, hi) {
  const x = Number(n);
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}

function pct01(x) {
  return `${Math.round(clamp(x, 0, 1) * 100)}%`;
}

function fmtDeltaMoney(delta) {
  const d = toNum(delta);
  const sign = d > 0 ? "+" : d < 0 ? "−" : "";
  const abs = Math.abs(d);
  return `${sign}${money(abs)}`;
}

function deltaColor(delta) {
  const d = toNum(delta);
  if (d > 0) return "rgba(130, 255, 190, .92)";
  if (d < 0) return "rgba(255, 140, 140, .92)";
  return "rgba(255,255,255,.75)";
}

function arrow(delta) {
  const d = toNum(delta);
  if (d > 0) return "▲";
  if (d < 0) return "▼";
  return "•";
}

function moodFromScore(score) {
  if (score >= 88) return { label: "Locked in", note: "Protect the streak.", badge: "🟢" };
  if (score >= 74) return { label: "Solid", note: "One clean action today.", badge: "🟡" };
  if (score >= 60) return { label: "At risk", note: "Do what’s due soon.", badge: "🟠" };
  return { label: "Emergency mode", note: "Next action only. No thinking.", badge: "🔴" };
}

function xpForLevel(level) {
  // Increasing curve but not insane
  return 120 + level * 45;
}

function computeLevelFromXP(totalXP) {
  let xp = Math.max(0, toNum(totalXP));
  let level = 1;
  while (xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level += 1;
    if (level > 99) break;
  }
  return { level, xpIntoLevel: xp, xpNeeded: xpForLevel(level) };
}

function Pill({ children }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,.10)",
        background: "rgba(255,255,255,.04)",
        fontSize: 12,
        color: "rgba(255,255,255,.82)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function Sparkline({ values }) {
  const vals = Array.isArray(values) ? values.map((x) => toNum(x)) : [];
  const v = vals.slice(-14);
  const min = v.length ? Math.min(...v) : 0;
  const max = v.length ? Math.max(...v) : 0;
  const range = max - min || 1;

  const w = 120;
  const h = 28;
  const pad = 2;

  const pts = v
    .map((y, i) => {
      const x = pad + (i * (w - pad * 2)) / Math.max(1, v.length - 1);
      const yy = h - pad - ((y - min) * (h - pad * 2)) / range;
      return `${x.toFixed(2)},${yy.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ opacity: 0.9 }}>
      <polyline
        points={pts}
        fill="none"
        stroke="rgba(255,255,255,.70)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MicroBtn({ href, title, sub, tag }) {
  return (
    <a
      className="card"
      href={href}
      style={{
        padding: 10,
        display: "block",
        textDecoration: "none",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontWeight: 900, color: "rgba(255,255,255,.92)" }}>{title}</div>
        {tag ? (
          <div className="muted" style={{ fontSize: 12 }}>
            {tag}
          </div>
        ) : null}
      </div>
      {sub ? <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{sub}</div> : null}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 2,
          background: "rgba(255,255,255,.18)",
          opacity: 0.55,
        }}
      />
    </a>
  );
}

export default function DashboardPage() {
  const [billsState, setBillsState] = useState({ items: [] });
  const [assets, setAssets] = useState([]);
  const [txns, setTxns] = useState([]);
  const [prices, setPrices] = useState({});
  const [loaded, setLoaded] = useState(false);

  const [dash, setDash] = useState({
    streak: 0,
    lastSeen: null,
    lastCheckin: null, // ISO date of last check-in
    xpTotal: 0,
    snapshots: {}, // { [iso]: { net, inv, debt, outflow, due7 } }
  });

  const today = useMemo(() => isoDate(), []);

  useEffect(() => {
    const bRaw = safeParse(localStorage.getItem(LS_BILLS) || "null", null);
    const b = normalizeBillsState(bRaw);

    const aRaw = safeParse(localStorage.getItem(LS_PORT_ASSETS) || "[]", []);
    const tRaw = safeParse(localStorage.getItem(LS_PORT_TXNS) || "[]", []);
    const pRaw = safeParse(localStorage.getItem(LS_PORT_PRICES) || "{}", {});

    setBillsState(b);
    setAssets(Array.isArray(aRaw) ? aRaw : []);
    setTxns(Array.isArray(tRaw) ? tRaw : []);
    setPrices(pRaw && typeof pRaw === "object" ? pRaw : {});

    // Load dash state + update "visit streak" (this is separate from check-in)
    const saved = safeParse(localStorage.getItem(LS_DASH) || "null", null) || {};
    const lastSeen = saved.lastSeen || null;
    let streak = toNum(saved.streak);

    if (!lastSeen) {
      streak = 1;
    } else {
      const diff = daysBetween(lastSeen, today);
      if (diff === 0) {
        // same day: keep
      } else if (diff === 1) {
        streak = Math.max(1, streak + 1);
      } else if (diff > 1) {
        streak = 1;
      }
    }

    const next = {
      streak,
      lastSeen: today,
      lastCheckin: saved.lastCheckin || null,
      xpTotal: toNum(saved.xpTotal),
      snapshots: saved.snapshots && typeof saved.snapshots === "object" ? saved.snapshots : {},
    };

    localStorage.setItem(LS_DASH, JSON.stringify(next));
    setDash(next);

    setLoaded(true);
  }, [today]);

  const billsComputed = useMemo(() => {
    const items = Array.isArray(billsState.items) ? billsState.items : [];
    const active = items.filter((x) => x && x.active !== false);

    const noncontrollableMonthly = active
      .filter((x) => x.type !== "controllable")
      .reduce((s, x) => s + toNum(x.amount), 0);

    const controllableMin = active
      .filter((x) => x.type === "controllable")
      .reduce((s, x) => s + toNum(x.minPay), 0);

    const controllableExtra = active
      .filter((x) => x.type === "controllable")
      .reduce((s, x) => s + toNum(x.extraPay), 0);

    const debtBalance = active
      .filter((x) => x.type === "controllable")
      .reduce((s, x) => s + toNum(x.balance), 0);

    const monthlyOutflow = noncontrollableMonthly + controllableMin + controllableExtra;

    const dueSoon = active
      .filter((x) => x.dueDate)
      .map((x) => ({
        ...x,
        dueIn: daysBetween(today, String(x.dueDate)),
      }))
      .filter((x) => x.dueIn != null)
      .sort((a, b) => a.dueIn - b.dueIn);

    const dueNext7 = dueSoon.filter((x) => x.dueIn >= 0 && x.dueIn <= 7);
    const nextDue = dueSoon.find((x) => x.dueIn >= 0) || null;

    return {
      noncontrollableMonthly,
      controllableMin,
      controllableExtra,
      debtBalance,
      monthlyOutflow,
      nextDue,
      dueNext7,
      activeCount: active.length,
    };
  }, [billsState, today]);

  const investmentsTotal = useMemo(() => {
    const txByAsset = new Map();
    for (const t of txns) {
      if (!t || !t.assetId) continue; // ✅ ignore bad txns
      const arr = txByAsset.get(t.assetId) || [];
      arr.push(t);
      txByAsset.set(t.assetId, arr);
    }

    let totalValue = 0;

    for (const a of assets) {
      if (!a || !a.id) continue;

      const list = (txByAsset.get(a.id) || [])
        .slice()
        .sort((x, y) => {
          const dx = String(x?.date ?? "");
          const dy = String(y?.date ?? "");
          const c = dx.localeCompare(dy);
          if (c !== 0) return c;
          return toNum(x?.createdAt) - toNum(y?.createdAt);
        });

      let shares = 0;
      let cashNet = 0;

      for (const t of list) {
        const fee = toNum(t?.fee);

        if (t?.type === "BUY") shares += toNum(t?.qty);
        if (t?.type === "SELL") shares -= toNum(t?.qty);

        if (t?.type === "CASH_IN") cashNet += toNum(t?.amount) - fee;
        if (t?.type === "CASH_OUT") cashNet -= toNum(t?.amount) + fee;

        if (t?.type === "DIVIDEND") cashNet += toNum(t?.amount);
      }

      const type = String(a?.type ?? "").toLowerCase();
      const symbol = type === "cash" ? "CASH" : normSymbol(a?.symbol);
      const key = `${type}:${symbol}`;
      const lastPrice = toNum(prices?.[key]?.price);

      const value =
        type === "cash"
          ? Math.max(0, cashNet)
          : Math.max(0, shares) * lastPrice;

      totalValue += value;
    }

    return totalValue;
  }, [assets, txns, prices]);

  const netSnapshot = useMemo(() => {
    const debt = toNum(billsComputed.debtBalance);
    const inv = toNum(investmentsTotal);
    const outflow = toNum(billsComputed.monthlyOutflow);
    const due7 = billsComputed.dueNext7?.length || 0;
    return { inv, debt, outflow, due7, net: inv - debt };
  }, [billsComputed, investmentsTotal]);

  // Auto-save daily KPI snapshot (this drives deltas + sparklines)
  useEffect(() => {
    if (!loaded) return;

    const current = safeParse(localStorage.getItem(LS_DASH) || "null", null) || {};
    const snapshots = current.snapshots && typeof current.snapshots === "object" ? current.snapshots : {};
    const existing = snapshots[today];

    const snap = {
      net: toNum(netSnapshot.net),
      inv: toNum(netSnapshot.inv),
      debt: toNum(netSnapshot.debt),
      outflow: toNum(netSnapshot.outflow),
      due7: toNum(netSnapshot.due7),
    };

    // Only write if missing or values changed materially
    const changed =
      !existing ||
      Math.abs(toNum(existing.net) - snap.net) > 0.01 ||
      Math.abs(toNum(existing.inv) - snap.inv) > 0.01 ||
      Math.abs(toNum(existing.debt) - snap.debt) > 0.01 ||
      Math.abs(toNum(existing.outflow) - snap.outflow) > 0.01 ||
      toNum(existing.due7) !== snap.due7;

    if (!changed) return;

    const next = {
      streak: toNum(current.streak) || dash.streak,
      lastSeen: current.lastSeen || today,
      lastCheckin: current.lastCheckin || dash.lastCheckin || null,
      xpTotal: toNum(current.xpTotal) || dash.xpTotal || 0,
      snapshots: { ...snapshots, [today]: snap },
    };

    localStorage.setItem(LS_DASH, JSON.stringify(next));
    setDash((prev) => ({ ...prev, snapshots: next.snapshots }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, today, netSnapshot.net, netSnapshot.inv, netSnapshot.debt, netSnapshot.outflow, netSnapshot.due7]);

  const trends = useMemo(() => {
    const snaps = dash.snapshots && typeof dash.snapshots === "object" ? dash.snapshots : {};

    const yesterday = (() => {
      const d = new Date(today + "T00:00:00");
      d.setDate(d.getDate() - 1);
      return isoDate(d);
    })();

    const s0 = snaps[today] || null;
    const s1 = snaps[yesterday] || null;

    const netDelta = s0 && s1 ? toNum(s0.net) - toNum(s1.net) : 0;
    const invDelta = s0 && s1 ? toNum(s0.inv) - toNum(s1.inv) : 0;
    const debtDelta = s0 && s1 ? toNum(s0.debt) - toNum(s1.debt) : 0;
    const outflowDelta = s0 && s1 ? toNum(s0.outflow) - toNum(s1.outflow) : 0;

    // Build last 14 days arrays for sparklines
    const series = (key) => {
      const arr = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(today + "T00:00:00");
        d.setDate(d.getDate() - i);
        const iso = isoDate(d);
        arr.push(toNum(snaps?.[iso]?.[key] ?? NaN));
      }
      // Replace NaN gaps with nearest previous known (so line doesn't flat to 0)
      let last = null;
      return arr.map((v) => {
        const ok = Number.isFinite(v);
        if (ok) {
          last = v;
          return v;
        }
        return last ?? 0;
      });
    };

    return {
      hasYesterday: !!s1,
      netDelta,
      invDelta,
      debtDelta,
      outflowDelta,
      netSeries: series("net"),
      invSeries: series("inv"),
      debtSeries: series("debt"),
      outflowSeries: series("outflow"),
    };
  }, [dash.snapshots, today]);

  const engagement = useMemo(() => {
    const due7 = toNum(netSnapshot.due7);
    const debt = toNum(netSnapshot.debt);
    const extra = toNum(billsComputed.controllableExtra);
    const outflow = toNum(netSnapshot.outflow);
    const inv = toNum(netSnapshot.inv);

    // “Gamey” score that feels reactive
    let score = 76;

    // urgency pressure
    if (due7 >= 4) score -= 14;
    else if (due7 >= 2) score -= 9;
    else if (due7 >= 1) score -= 5;

    // debt pressure
    if (debt > 0) score -= Math.min(18, Math.log10(debt + 10) * 6);

    // positive signals
    if (extra > 0) score += Math.min(10, extra / 50);
    if (inv > 0) score += 6;

    // outflow responsibility
    if (outflow > 0) score -= Math.min(10, outflow / 1200);

    // daily check-in bonus
    if (dash.lastCheckin === today) score += 6;

    score = clamp(Math.round(score), 35, 95);
    const mood = moodFromScore(score);

    const focus = [];
    const nextDue = billsComputed.nextDue;

    if (nextDue) {
      focus.push({
        title: `Next due: ${nextDue.name}`,
        sub: nextDue.dueIn === 0 ? "Due today" : `Due in ${nextDue.dueIn} day(s)`,
        href: "/bills",
        tag: nextDue.dueIn <= 2 ? "Urgent" : "Soon",
      });
    } else {
      focus.push({
        title: "No due dates set",
        sub: "Add due dates so this becomes a real command center",
        href: "/bills",
        tag: "Setup",
      });
    }

    if (debt > 0 && extra === 0) {
      focus.push({
        title: "Add a small extra payment",
        sub: "Even $25/mo changes the timeline",
        href: "/bills",
        tag: "Win",
      });
    } else if (debt > 0 && extra > 0) {
      focus.push({
        title: "Keep extra payments consistent",
        sub: `Extra/month: ${money(extra)}`,
        href: "/bills",
        tag: "Momentum",
      });
    } else {
      focus.push({
        title: "Debt not added (or zero)",
        sub: "If you have debt, add it so net is real",
        href: "/bills",
        tag: "Check",
      });
    }

    if (inv === 0 && assets.length > 0) {
      focus.push({
        title: "Fix portfolio prices",
        sub: "Holdings exist but value is $0",
        href: "/investments",
        tag: "Fix",
      });
    } else {
      focus.push({
        title: "Log one thing today",
        sub: dash.lastCheckin === today ? "You checked in. Protect the streak." : "Check in to lock today.",
        href: "/spending",
        tag: "Daily",
      });
    }

    return { score, mood, focus: focus.slice(0, 3) };
  }, [netSnapshot, billsComputed.nextDue, billsComputed.controllableExtra, assets.length, dash.lastCheckin, today]);

  const levelState = useMemo(() => computeLevelFromXP(dash.xpTotal), [dash.xpTotal]);

  function saveDash(nextDash) {
    localStorage.setItem(LS_DASH, JSON.stringify(nextDash));
    setDash(nextDash);
  }

  function doDailyCheckin() {
    const current = safeParse(localStorage.getItem(LS_DASH) || "null", null) || {};
    const lastCheckin = current.lastCheckin || null;

    // already checked in today
    if (lastCheckin === today) return;

    const baseXP = 30; // core dopamine
    const urgencyBonus = (netSnapshot.due7 >= 2 ? 10 : 0) + (netSnapshot.due7 >= 4 ? 10 : 0);
    const debtBonus = netSnapshot.debt > 0 ? 8 : 0;
    const totalEarned = baseXP + urgencyBonus + debtBonus;

    const next = {
      streak: toNum(current.streak) || dash.streak || 1,
      lastSeen: current.lastSeen || today,
      lastCheckin: today,
      xpTotal: toNum(current.xpTotal) + totalEarned,
      snapshots: current.snapshots && typeof current.snapshots === "object" ? current.snapshots : dash.snapshots || {},
    };

    saveDash(next);
  }

  const checkedInToday = dash.lastCheckin === today;

  return (
    <main className="container">
      <header style={{ marginBottom: 14 }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
          Dashboard
        </div>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h1 style={{ margin: 0 }}>Life Command Center</h1>
            <div className="muted" style={{ marginTop: 6 }}>
              Today: <b>{today}</b> • Your numbers + your next moves.
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Pill>🔥 Streak: <b>{dash.streak}</b></Pill>
            <Pill>🏷️ Level: <b>{levelState.level}</b></Pill>
            <Pill>
              {engagement.mood.badge} Momentum: <b>{engagement.score}</b>
            </Pill>
          </div>
        </div>
      </header>

      {!loaded ? (
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 950 }}>Loading…</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            Reading your saved data.
          </div>
        </div>
      ) : (
        <>
          {/* DAILY CHECK-IN (the addiction button) */}
          <div className="card" style={{ padding: 12, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 950 }}>Daily Check-In</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  {checkedInToday ? "✅ Locked for today. Come back tomorrow." : "Tap once to lock today + earn XP."}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <Pill>
                  XP: <b>{dash.xpTotal}</b>
                </Pill>

                <Pill>
                  Level XP: <b>{Math.round(levelState.xpIntoLevel)}</b> / <b>{levelState.xpNeeded}</b>
                </Pill>

                <button
                  className="btn"
                  onClick={doDailyCheckin}
                  disabled={checkedInToday}
                  style={{
                    opacity: checkedInToday ? 0.55 : 1,
                    cursor: checkedInToday ? "not-allowed" : "pointer",
                  }}
                >
                  {checkedInToday ? "Checked in" : "Check in now"}
                </button>
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Status: <b style={{ color: "rgba(255,255,255,.92)" }}>{engagement.mood.label}</b> •{" "}
                {engagement.mood.note}
              </div>

              {/* XP progress bar */}
              <div className="card" style={{ padding: 10 }}>
                <div className="muted" style={{ fontSize: 12 }}>Level progress</div>
                <div
                  style={{
                    marginTop: 8,
                    height: 10,
                    borderRadius: 999,
                    background: "rgba(255,255,255,.10)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: 10,
                      width: `${clamp(levelState.xpIntoLevel / levelState.xpNeeded, 0, 1) * 100}%`,
                      background: "rgba(255,255,255,.55)",
                    }}
                  />
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  Next level in <b style={{ color: "rgba(255,255,255,.92)" }}>{Math.max(0, levelState.xpNeeded - Math.round(levelState.xpIntoLevel))}</b> XP
                </div>
              </div>
            </div>
          </div>

          {/* DAILY FOCUS (guidance) */}
          <div className="card" style={{ padding: 12, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 950 }}>Daily Focus</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  3 moves. That’s it.
                </div>
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                Bills tracked:{" "}
                <b style={{ color: "rgba(255,255,255,.92)" }}>{billsComputed.activeCount}</b>
              </div>
            </div>

            <div
              className="grid"
              style={{
                marginTop: 10,
                gap: 10,
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              }}
            >
              {engagement.focus.map((x, idx) => (
                <a
                  key={idx}
                  href={x.href}
                  className="card"
                  style={{ padding: 10, display: "block", textDecoration: "none", position: "relative", overflow: "hidden" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontWeight: 950, color: "rgba(255,255,255,.92)" }}>{x.title}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{x.tag}</div>
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{x.sub}</div>
                  <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2, background: "rgba(255,255,255,.18)", opacity: 0.6 }} />
                </a>
              ))}
            </div>
          </div>

          {/* KPIs + DELTAS (dopamine) */}
          <div
            className="grid"
            style={{
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            }}
          >
            <div className="card kpi" style={{ padding: 14 }}>
              <div className="muted" style={{ fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                <span>Net snapshot</span>
                <Sparkline values={trends.netSeries} />
              </div>

              <div className="kpiValue">{money(netSnapshot.net)}</div>

              <div className="muted" style={{ fontSize: 12, marginTop: 6, display: "flex", justifyContent: "space-between" }}>
                <span>Investments − Debt</span>
                <span style={{ color: deltaColor(trends.netDelta) }}>
                  {trends.hasYesterday ? `${arrow(trends.netDelta)} ${fmtDeltaMoney(trends.netDelta)} vs yday` : "—"}
                </span>
              </div>
            </div>

            <div className="card kpi" style={{ padding: 14 }}>
              <div className="muted" style={{ fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                <span>Investments</span>
                <Sparkline values={trends.invSeries} />
              </div>

              <div className="kpiValue">{money(netSnapshot.inv)}</div>

              <div className="muted" style={{ fontSize: 12, marginTop: 6, display: "flex", justifyContent: "space-between" }}>
                <span>From portfolio prices</span>
                <span style={{ color: deltaColor(trends.invDelta) }}>
                  {trends.hasYesterday ? `${arrow(trends.invDelta)} ${fmtDeltaMoney(trends.invDelta)} vs yday` : "—"}
                </span>
              </div>
            </div>

            <div className="card kpi" style={{ padding: 14 }}>
              <div className="muted" style={{ fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                <span>Debt balance</span>
                <Sparkline values={trends.debtSeries} />
              </div>

              <div className="kpiValue">{money(netSnapshot.debt)}</div>

              <div className="muted" style={{ fontSize: 12, marginTop: 6, display: "flex", justifyContent: "space-between" }}>
                <span>From controllable bills</span>
                {/* For debt: decreasing is GOOD, so invert the color logic */}
                <span style={{ color: deltaColor(-trends.debtDelta) }}>
                  {trends.hasYesterday
                    ? `${arrow(-trends.debtDelta)} ${fmtDeltaMoney(-trends.debtDelta)} better vs yday`
                    : "—"}
                </span>
              </div>
            </div>

            <div className="card kpi" style={{ padding: 14 }}>
              <div className="muted" style={{ fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                <span>Monthly outflow</span>
                <Sparkline values={trends.outflowSeries} />
              </div>

              <div className="kpiValue">{money(netSnapshot.outflow)}</div>

              <div className="muted" style={{ fontSize: 12, marginTop: 6, display: "flex", justifyContent: "space-between" }}>
                <span>Fixed + minimums + extras</span>
                {/* Outflow: lower is “better” */}
                <span style={{ color: deltaColor(-trends.outflowDelta) }}>
                  {trends.hasYesterday
                    ? `${arrow(-trends.outflowDelta)} ${fmtDeltaMoney(-trends.outflowDelta)} better vs yday`
                    : "—"}
                </span>
              </div>
            </div>
          </div>

          <div style={{ height: 14 }} />

          {/* Quick Actions */}
          <div className="card" style={{ padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <div style={{ fontWeight: 950 }}>Quick actions</div>
              <div className="muted" style={{ fontSize: 12 }}>
                Rule: <b style={{ color: "rgba(255,255,255,.92)" }}>1 log/day</b> keeps you winning.
              </div>
            </div>

            <div className="row" style={{ gap: 10, flexWrap: "wrap", marginTop: 10 }}>
              <a className="btn" href="/bills">Bills</a>
              <a className="btn" href="/investments">Investments</a>
              <a className="btn" href="/spending">Add Spending</a>
              <a className="btn" href="/income">Income</a>
              <a className="btn" href="/savings">Savings</a>
            </div>

            <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              This dashboard now rewards you with: streak + XP + deltas + trend lines.
            </div>
          </div>

          <div style={{ height: 14 }} />

          {/* Bills due soon + Micro-wins */}
          <div
            className="grid"
            style={{
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            }}
          >
            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontWeight: 950, marginBottom: 10 }}>
                Bills due soon (next 7 days)
              </div>

              {billsComputed.dueNext7.length === 0 ? (
                <div className="muted">Nothing due in the next week.</div>
              ) : (
                <div className="grid" style={{ gap: 8 }}>
                  {billsComputed.dueNext7.slice(0, 6).map((b) => (
                    <div key={b.id} className="card" style={{ padding: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ fontWeight: 900 }}>{b.name}</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {b.dueIn === 0 ? "Today" : `In ${b.dueIn}d`}
                        </div>
                      </div>

                      <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                        Due <b style={{ color: "rgba(255,255,255,0.92)" }}>{b.dueDate}</b> •{" "}
                        {b.type === "controllable"
                          ? `Min ${money(b.minPay)} + Extra ${money(b.extraPay)}`
                          : `Amt ${money(b.amount)}`}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
                Next due:{" "}
                <b style={{ color: "rgba(255,255,255,0.92)" }}>
                  {billsComputed.nextDue ? `${billsComputed.nextDue.name} (${billsComputed.nextDue.dueDate})` : "—"}
                </b>
              </div>
            </div>

            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontWeight: 950, marginBottom: 10 }}>Micro-wins</div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
                Pick one. Finish it. That’s how you win.
              </div>

              <div className="grid" style={{ gap: 10 }}>
                <MicroBtn
                  href="/spending"
                  title="Log 1 expense"
                  sub={checkedInToday ? "You’re locked today. This keeps data real." : "Log one thing, then hit Check-In."}
                  tag="Daily"
                />
                <MicroBtn
                  href="/bills"
                  title="Set the next due date"
                  sub="Dashboard gets smarter when due dates exist."
                  tag="Setup"
                />
                <MicroBtn
                  href="/investments"
                  title="Refresh / set prices"
                  sub="Your net snapshot depends on prices."
                  tag="Fix"
                />
              </div>

              <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
                Mood: <b style={{ color: "rgba(255,255,255,.92)" }}>{engagement.mood.label}</b> • Score{" "}
                <b style={{ color: "rgba(255,255,255,.92)" }}>{engagement.score}</b>
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
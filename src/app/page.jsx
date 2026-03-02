"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { projectCashFlow, todayISO } from "../lib/projectionEngine";

export const dynamic = "force-dynamic";

// Storage keys (robust on purpose)
const LS_ACCOUNTS = "lcc_accounts_v1";
const LS_PRIMARY = "lcc_accounts_primary_v1";

const BILL_KEYS = ["lcc_bills_v5", "lcc_bills_v4", "lcc_bills_v3", "lcc_bills_v2", "lcc_bills_v1", "lcc_bills"];
const EVENT_KEYS = ["lcc_events", "lcc_events_v2", "lcc_events_v1"];

/** ---------- utils ---------- */
function safeParse(str, fallback) {
  try {
    const v = JSON.parse(str);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function getFirstLS(keys, fallback) {
  for (const k of keys) {
    const raw = typeof window !== "undefined" ? localStorage.getItem(k) : null;
    if (raw && raw !== "null" && raw !== "undefined" && raw !== "[]") {
      const parsed = safeParse(raw, null);
      if (parsed != null) return { key: k, value: parsed };
    }
  }
  return { key: null, value: fallback };
}

function money(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function fmtShort(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function daysUntil(iso) {
  if (!iso) return null;
  const now = new Date();
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const d = new Date(iso + "T00:00:00").getTime();
  return Math.round((d - t0) / 86400000);
}

/** Normalize bills into: { name, dueDate, amount } */
function normalizeBills(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((b) => {
      const dueDate = (b?.dueDate || b?.due || b?.nextDueDate || "").slice?.(0, 10) || b?.dueDate;
      const amount = Number(b?.amount ?? b?.minPayment ?? b?.payment ?? b?.dueAmount);
      const name = b?.name || b?.title || b?.vendor || "Bill";
      if (!dueDate) return null;
      if (!Number.isFinite(amount)) return { name, dueDate, amount: null };
      return { name, dueDate, amount };
    })
    .filter(Boolean);
}

/** Normalize events into projectionEngine shape */
function normalizeEvents(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((e) => {
      const id = e?.id ?? e?._id ?? e?.uuid;
      const title = e?.title ?? e?.name ?? "Event";
      const date = (e?.date || e?.when || e?.startDate || "").slice?.(0, 10) || e?.date;

      const flow = (e?.flow || e?.type || e?.kind || "neutral").toString().toLowerCase();
      const normalizedFlow =
        flow.includes("income") || flow === "in" || flow === "credit"
          ? "income"
          : flow.includes("expense") || flow === "out" || flow === "debit"
          ? "expense"
          : "neutral";

      const amt = Number(typeof e?.amount === "string" ? e.amount.replace(/[^0-9.-]/g, "") : e?.amount);
      const amount = Number.isFinite(amt) ? amt : null;

      const recurrence = e?.recurrence ?? { freq: "none" };
      const exceptions = Array.isArray(e?.exceptions) ? e.exceptions : [];
      const overrides = e?.overrides && typeof e.overrides === "object" ? e.overrides : {};

      if (!id || !date) return null;

      return {
        id,
        title,
        date: String(date).slice(0, 10),
        flow: normalizedFlow,
        amount,
        recurrence,
        exceptions,
        overrides,
      };
    })
    .filter(Boolean);
}

function pct(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(100, num));
}

function safeNum(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

export default function DashboardPage() {
  const [accounts, setAccounts] = useState([]);
  const [primaryId, setPrimaryId] = useState("");
  const [events, setEvents] = useState([]);
  const [bills, setBills] = useState([]);

  // Load from localStorage (client-only)
  useEffect(() => {
    const a = safeParse(localStorage.getItem(LS_ACCOUNTS) || "[]", []);
    setAccounts(Array.isArray(a) ? a : []);

    const p = localStorage.getItem(LS_PRIMARY) || "";
    setPrimaryId(p);

    const ev = getFirstLS(EVENT_KEYS, []).value;
    setEvents(normalizeEvents(ev));

    const bl = getFirstLS(BILL_KEYS, []).value;
    setBills(normalizeBills(bl));
  }, []);

  const primaryAccount = useMemo(() => {
    const list = Array.isArray(accounts) ? accounts : [];
    if (!list.length) return null;
    const found = list.find((x) => x.id === primaryId);
    return found || list[0] || null;
  }, [accounts, primaryId]);

  const startingBalance = useMemo(() => {
    const bal = Number(primaryAccount?.balance);
    return Number.isFinite(bal) ? bal : null;
  }, [primaryAccount]);

  const billsWithAmounts = useMemo(
    () => bills.filter((b) => Number.isFinite(Number(b.amount))),
    [bills]
  );

  const forecast = useMemo(() => {
    if (startingBalance == null) return null;

    return projectCashFlow({
      startDateISO: todayISO(),
      days: 30,
      startingBalance,
      events,
      bills: billsWithAmounts,
    });
  }, [startingBalance, events, billsWithAmounts]);

  const upcomingBills7 = useMemo(() => {
    const today = todayISO();
    return bills
      .filter((b) => b?.dueDate && b.dueDate >= today)
      .sort((a, b) => (a.dueDate > b.dueDate ? 1 : -1))
      .slice(0, 7);
  }, [bills]);

  const next7 = useMemo(() => {
    if (!forecast?.ok) return [];
    return forecast.daily.slice(0, 7);
  }, [forecast]);

  const kpis = useMemo(() => {
    if (!forecast?.ok) return null;

    const start = safeNum(forecast.startingBalance, 0);
    const end = safeNum(forecast.projectedEndBalance, 0);
    const low = safeNum(forecast.lowestBalance, start);
    const lowDate = forecast.lowestDate;

    // “runway” indicator: how deep is the drop vs start
    const drop = Math.max(0, start - low);
    const runwayScore = start <= 0 ? 0 : pct(((start - drop) / start) * 100); // 100 = no drop, 0 = wiped
    const runwayLabel =
      low < 0 ? "Risk: negative" : runwayScore >= 85 ? "Stable" : runwayScore >= 65 ? "Watch" : "Tight";

    // How many days until lowest point
    const dd = lowDate ? daysUntil(lowDate) : null;

    // Balance sparkline from daily balances
    const balances = forecast.daily.map((d) => safeNum(d.balance, 0));
    const minB = Math.min(...balances);
    const maxB = Math.max(...balances);

    return {
      start,
      end,
      low,
      lowDate,
      runwayScore,
      runwayLabel,
      daysToLow: dd,
      minB,
      maxB,
      balances,
      totalIn: safeNum(forecast.totalIncome, 0),
      totalOut: safeNum(forecast.totalOut, 0),
      totalBills: safeNum(forecast.totalBills, 0),
      totalExp: safeNum(forecast.totalExpenses, 0),
      through: forecast.endDate,
    };
  }, [forecast]);

  const setup = useMemo(() => {
    const hasAccounts = Array.isArray(accounts) && accounts.length > 0;
    const hasPrimary = !!primaryAccount;
    const hasBalance = startingBalance != null;

    const hasBillsAmounts = billsWithAmounts.length > 0;
    const hasEventAmounts =
      Array.isArray(events) &&
      events.some((e) => Number.isFinite(Number(e.amount)) && (e.flow === "income" || e.flow === "expense"));

    return {
      hasAccounts,
      hasPrimary,
      hasBalance,
      hasBillsAmounts,
      hasEventAmounts,
      isForecastMeaningful: hasBillsAmounts || hasEventAmounts,
    };
  }, [accounts, primaryAccount, startingBalance, billsWithAmounts, events]);

  const heroHint = useMemo(() => {
    if (!setup.hasAccounts) return "Add accounts to start forecasting.";
    if (!setup.hasBalance) return "Set your primary balance — forecast needs a starting number.";
    if (!setup.isForecastMeaningful) return "Add bill amounts or income/expense events to get a real projection.";
    if (kpis?.low < 0) return "Forecast shows you going negative — fix before it happens.";
    if ((kpis?.runwayLabel || "") === "Tight") return "Runway looks tight — review due dates and upcoming expenses.";
    return "You’re set. Keep the data real and the forecast stays useful.";
  }, [setup, kpis]);

  return (
    <main className="container">
      {/* HERO */}
      <header style={{ marginBottom: 16 }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
          Dashboard
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
          <div>
            <h1 style={{ margin: 0 }}>Life Command Center</h1>
            <div className="muted" style={{ marginTop: 6 }}>
              {heroHint}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <span className="pill" style={{ padding: "8px 10px" }}>
              Today: <b>{todayISO()}</b>
            </span>
            {primaryAccount?.name ? (
              <span className="pill" style={{ padding: "8px 10px" }}>
                Primary: <b>{primaryAccount.name}</b>
              </span>
            ) : null}
          </div>
        </div>
      </header>

      {/* LAYOUT: main + right rail */}
      <div className="row" style={{ gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* MAIN */}
        <div style={{ flex: 2, minWidth: 360 }} className="grid">
          {/* Forecast Core */}
          <div className="card" style={{ padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 950, fontSize: 16 }}>30-Day Cash Flow Forecast</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  Forecast is powered by Accounts + Bills + income/expense events.
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Link className="btnGhost" href="/accounts">Accounts</Link>
                <Link className="btnGhost" href="/calendar">Calendar</Link>
                <Link className="btnGhost" href="/bills">Bills</Link>
              </div>
            </div>

            <div style={{ height: 12 }} />

            {startingBalance == null ? (
              <div className="card" style={{ padding: 12 }}>
                <div style={{ fontWeight: 950, marginBottom: 6 }}>Setup required</div>
                <div className="muted">
                  Add an account balance in <b>Accounts</b> and set it as <b>Primary</b>.
                </div>
                <div style={{ height: 10 }} />
                <Link className="btn" href="/accounts">Go to Accounts</Link>
              </div>
            ) : !forecast ? (
              <div className="muted">Loading forecast…</div>
            ) : forecast.ok === false ? (
              <div className="card" style={{ padding: 12 }}>
                <div style={{ fontWeight: 950 }}>Forecast error</div>
                <div className="muted" style={{ marginTop: 6 }}>
                  {forecast.message || "Unknown error."}
                </div>
              </div>
            ) : (
              <>
                {/* KPI ROW */}
                <div className="grid" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
                  <div className="card" style={{ padding: 12 }}>
                    <div className="muted" style={{ fontSize: 12 }}>Starting balance</div>
                    <div style={{ fontWeight: 950, fontSize: 18, marginTop: 4 }}>{money(kpis.start)}</div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                      Primary: {primaryAccount?.name || "—"}
                    </div>
                  </div>

                  <div className="card" style={{ padding: 12 }}>
                    <div className="muted" style={{ fontSize: 12 }}>Lowest projected</div>
                    <div style={{ fontWeight: 950, fontSize: 18, marginTop: 4 }}>{money(kpis.low)}</div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                      {fmtShort(kpis.lowDate)}{kpis.daysToLow != null ? ` • ${kpis.daysToLow}d` : ""}
                    </div>
                  </div>

                  <div className="card" style={{ padding: 12 }}>
                    <div className="muted" style={{ fontSize: 12 }}>Projected end</div>
                    <div style={{ fontWeight: 950, fontSize: 18, marginTop: 4 }}>{money(kpis.end)}</div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                      Through {fmtShort(kpis.through)}
                    </div>
                  </div>

                  <div className="card" style={{ padding: 12 }}>
                    <div className="muted" style={{ fontSize: 12 }}>Runway</div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", marginTop: 4 }}>
                      <div style={{ fontWeight: 950, fontSize: 18 }}>{kpis.runwayLabel}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{Math.round(kpis.runwayScore)}%</div>
                    </div>

                    <div style={{ height: 8 }} />
                    <div
                      style={{
                        height: 10,
                        borderRadius: 999,
                        border: "1px solid var(--lcc-border)",
                        background: "rgba(255,255,255,.05)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${kpis.runwayScore}%`,
                          background: "rgba(var(--lcc-accent), .35)",
                        }}
                      />
                    </div>

                    <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                      In {money(kpis.totalIn)} • Out {money(kpis.totalOut)}
                    </div>
                  </div>
                </div>

                <div style={{ height: 12 }} />

                {/* BALANCE SPARKLINE */}
                <div className="card" style={{ padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 950 }}>Balance trend</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      Min {money(kpis.minB)} • Max {money(kpis.maxB)}
                    </div>
                  </div>

                  <div style={{ height: 10 }} />

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: `repeat(${Math.min(30, kpis.balances.length)}, 1fr)`,
                      gap: 4,
                      alignItems: "end",
                      height: 44,
                    }}
                  >
                    {kpis.balances.slice(0, 30).map((b, idx) => {
                      const span = Math.max(1, kpis.maxB - kpis.minB);
                      const h = 8 + Math.round(((b - kpis.minB) / span) * 34);
                      const isLow = b === kpis.minB;
                      return (
                        <div
                          key={idx}
                          title={`${idx + 1}: ${money(b)}`}
                          style={{
                            height: h,
                            borderRadius: 6,
                            border: "1px solid var(--lcc-border)",
                            background: isLow ? "rgba(239,68,68,.18)" : "rgba(255,255,255,.06)",
                          }}
                        />
                      );
                    })}
                  </div>

                  <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
                    This is the “premium” feel: you can see momentum instantly.
                  </div>
                </div>

                <div style={{ height: 12 }} />

                {/* NEXT 7 DAYS */}
                <div className="card" style={{ padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 950 }}>Next 7 days</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      Bills + events combined
                    </div>
                  </div>

                  <div style={{ height: 10 }} />

                  {next7.length === 0 ? (
                    <div className="muted">No forecast days available.</div>
                  ) : (
                    <div className="grid" style={{ gap: 10 }}>
                      {next7.map((d) => {
                        const net = safeNum(d.netChange, 0);
                        const netLabel = net === 0 ? "No change" : net > 0 ? `+${money(net)}` : `-${money(Math.abs(net))}`;
                        const risk = safeNum(d.balance, 0) < 0;

                        return (
                          <div key={d.date} className="card" style={{ padding: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                              <div>
                                <div style={{ fontWeight: 950 }}>
                                  {fmtShort(d.date)}
                                  {risk ? <span className="muted" style={{ marginLeft: 8 }}>(negative)</span> : null}
                                </div>
                                <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                                  Income {money(d.income)} • Expenses {money(d.expense)} • Bills {money(d.bills)}
                                </div>
                              </div>

                              <div style={{ textAlign: "right" }}>
                                <span className="pill" style={{ display: "inline-block", padding: "7px 10px" }}>
                                  {netLabel}
                                </span>
                                <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                                  Balance: <b>{money(d.balance)}</b>
                                </div>
                              </div>
                            </div>

                            {Array.isArray(d.items) && d.items.length > 0 ? (
                              <div style={{ marginTop: 10 }} className="muted">
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Items</div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                  {d.items.slice(0, 6).map((it, idx) => (
                                    <span key={idx} className="pill" style={{ padding: "6px 10px" }}>
                                      {it.title}: {money(it.amount)}
                                    </span>
                                  ))}
                                  {d.items.length > 6 ? (
                                    <span className="pill" style={{ padding: "6px 10px" }}>
                                      +{d.items.length - 6} more
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {!setup.isForecastMeaningful ? (
                    <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
                      Tip: Add bill amounts (Bills) or income/expense amounts (Calendar) so this becomes real.
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </div>

          {/* Quick actions (more “product”) */}
          <div className="card" style={{ padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
              <div style={{ fontWeight: 950 }}>Quick actions</div>
              <div className="muted" style={{ fontSize: 12 }}>
                Keep it simple: balances + due dates + recurring.
              </div>
            </div>

            <div style={{ height: 10 }} />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link className="btn" href="/accounts">Update balance</Link>
              <Link className="btnGhost" href="/calendar">Add income/expense</Link>
              <Link className="btnGhost" href="/bills">Add due dates</Link>
              <Link className="btnGhost" href="/spending">Log spending</Link>
            </div>
          </div>
        </div>

        {/* RIGHT RAIL */}
        <div style={{ flex: 1, minWidth: 320 }} className="grid">
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontWeight: 950, marginBottom: 10 }}>Bills due soon</div>

            {upcomingBills7.length === 0 ? (
              <div className="muted">No upcoming bills (or no due dates yet).</div>
            ) : (
              <div className="grid">
                {upcomingBills7.map((b, i) => {
                  const d = daysUntil(b.dueDate);
                  const label =
                    d === null ? "" : d === 0 ? "Due today" : d > 0 ? `Due in ${d} day${d === 1 ? "" : "s"}` : `${Math.abs(d)} day(s) late`;

                  return (
                    <div key={`${b.name}-${b.dueDate}-${i}`} className="card" style={{ padding: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div>
                          <div style={{ fontWeight: 900 }}>{b.name}</div>
                          <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                            {fmtShort(b.dueDate)} • {label}
                          </div>
                        </div>
                        <div className="pill">{b.amount == null ? "—" : money(b.amount)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ height: 10 }} />
            <Link className="btnGhost" href="/bills">Manage bills</Link>
          </div>

          {/* Setup Checklist (premium empty state) */}
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontWeight: 950, marginBottom: 8 }}>Setup checklist</div>

            <div className="grid" style={{ gap: 10 }}>
              <div className="card" style={{ padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 900 }}>Accounts</div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      Add accounts + set a primary balance
                    </div>
                  </div>
                  <div className="pill">{setup.hasBalance ? "Done" : "Do"}</div>
                </div>
              </div>

              <div className="card" style={{ padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 900 }}>Bills</div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      Add due dates + amounts
                    </div>
                  </div>
                  <div className="pill">{setup.hasBillsAmounts ? "Done" : "Do"}</div>
                </div>
              </div>

              <div className="card" style={{ padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 900 }}>Calendar</div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      Add income/expense events with amounts
                    </div>
                  </div>
                  <div className="pill">{setup.hasEventAmounts ? "Done" : "Do"}</div>
                </div>
              </div>
            </div>

            <div style={{ height: 10 }} />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link className="btn" href="/accounts">Accounts</Link>
              <Link className="btnGhost" href="/bills">Bills</Link>
              <Link className="btnGhost" href="/calendar">Calendar</Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
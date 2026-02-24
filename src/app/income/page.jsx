"use client";

import { useEffect, useMemo, useState } from "react";

const LS_INCOME = "lcc_income_v2";

function safeParse(str, fallback) {
  try {
    const v = JSON.parse(str);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function uid() {
  return globalThis.crypto?.randomUUID?.() ?? String(Date.now());
}

function isoDate(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toDateOnly(iso) {
  // ISO "YYYY-MM-DD" -> Date at local midnight
  const s = String(iso || "").trim();
  if (!s) return null;
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function monthKeyFromISO(iso) {
  const s = String(iso || "");
  return s.length >= 7 ? s.slice(0, 7) : "";
}

function fmtMonthLabel(ym) {
  // "YYYY-MM" -> "YYYY-MM"
  return ym || "—";
}

function daysInMonth(year, monthIndex0) {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

function money(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function parseMoneyInput(v) {
  const cleaned = String(v ?? "").replace(/[^0-9.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : NaN;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function addDays(d, days) {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + days);
  return x;
}

function sameOrAfter(a, b) {
  return a.getTime() >= b.getTime();
}

function sameOrBefore(a, b) {
  return a.getTime() <= b.getTime();
}

function dateToISO(d) {
  return isoDate(d);
}

function startOfMonthDate(ym) {
  const [y, m] = String(ym).split("-").map((x) => Number(x));
  if (!Number.isFinite(y) || !Number.isFinite(m)) return null;
  return new Date(y, m - 1, 1);
}

function endOfMonthDate(ym) {
  const [y, m] = String(ym).split("-").map((x) => Number(x));
  if (!Number.isFinite(y) || !Number.isFinite(m)) return null;
  return new Date(y, m - 1, daysInMonth(y, m - 1));
}

/**
 * Pay schedule
 * - WEEKLY / BIWEEKLY: uses anchorDate (most recent payday) and steps forward.
 * - TWICE_MONTHLY: 1st & 15th
 * - MONTHLY: 1st
 */
function computePaydaysForMonth({ monthYM, schedule, anchorDateISO }) {
  const start = startOfMonthDate(monthYM);
  const end = endOfMonthDate(monthYM);
  if (!start || !end) return [];

  const scheduleKey = String(schedule || "BIWEEKLY").toUpperCase();

  if (scheduleKey === "TWICE_MONTHLY") {
    const [y, m] = monthYM.split("-").map((x) => Number(x));
    const d1 = new Date(y, m - 1, 1);
    const d15 = new Date(y, m - 1, 15);
    return [d1, d15].filter((d) => d >= start && d <= end);
  }

  if (scheduleKey === "MONTHLY") {
    const [y, m] = monthYM.split("-").map((x) => Number(x));
    const d1 = new Date(y, m - 1, 1);
    return [d1].filter((d) => d >= start && d <= end);
  }

  // weekly / biweekly
  const step = scheduleKey === "WEEKLY" ? 7 : 14;
  const anchor = toDateOnly(anchorDateISO);
  if (!anchor) return []; // can’t compute without anchor

  // Back up to ensure we start before the month
  let cur = new Date(anchor.getTime());
  // If anchor is after end, go backwards
  while (cur > end) cur = addDays(cur, -step);
  // If anchor is before start by a lot, step forward until >= start
  while (addDays(cur, step) < start) cur = addDays(cur, step);

  const out = [];
  // Ensure we include any payday inside the month
  // Move forward from cur until beyond end
  let iter = new Date(cur.getTime());
  // If iter is before start, push forward
  while (iter < start) iter = addDays(iter, step);

  while (iter <= end) {
    out.push(new Date(iter.getTime()));
    iter = addDays(iter, step);
  }

  return out;
}

export default function IncomePage() {
  // Settings (important)
  const [goalMonthly, setGoalMonthly] = useState("8000");
  const [schedule, setSchedule] = useState("BIWEEKLY"); // WEEKLY | BIWEEKLY | TWICE_MONTHLY | MONTHLY
  const [anchorDate, setAnchorDate] = useState(isoDate()); // most recent payday (for weekly/biweekly)
  const [paycheckAmt, setPaycheckAmt] = useState("2000"); // expected per paycheck
  const [bonusEstimate, setBonusEstimate] = useState("0"); // expected extra for month

  // Add deposit
  const [date, setDate] = useState(isoDate());
  const [source, setSource] = useState("Paycheck");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  // Data
  const [deposits, setDeposits] = useState([]); // {id,date,source,amount,note,createdAt}
  const [status, setStatus] = useState({ msg: "" });
  const [error, setError] = useState("");

  // UI
  const [viewMonth, setViewMonth] = useState(monthKeyFromISO(isoDate()));
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState("date_desc"); // date_desc | amt_desc | source_asc

  // Edit
  const [editId, setEditId] = useState("");
  const [eDate, setEDate] = useState(isoDate());
  const [eSource, setESource] = useState("");
  const [eAmount, setEAmount] = useState("");
  const [eNote, setENote] = useState("");

  // Load
  useEffect(() => {
    const saved = safeParse(localStorage.getItem(LS_INCOME) || "{}", {});
    const sDeposits = Array.isArray(saved.deposits) ? saved.deposits : [];
    setDeposits(sDeposits);

    if (saved.goalMonthly != null) setGoalMonthly(String(saved.goalMonthly));
    if (saved.schedule) setSchedule(String(saved.schedule));
    if (saved.anchorDate) setAnchorDate(String(saved.anchorDate));
    if (saved.paycheckAmt != null) setPaycheckAmt(String(saved.paycheckAmt));
    if (saved.bonusEstimate != null) setBonusEstimate(String(saved.bonusEstimate));

    if (saved.viewMonth) setViewMonth(String(saved.viewMonth));
    setStatus({ msg: "Income loaded ✅" });
  }, []);

  // Persist
  useEffect(() => {
    try {
      localStorage.setItem(
        LS_INCOME,
        JSON.stringify({
          deposits,
          goalMonthly: parseMoneyInput(goalMonthly),
          schedule,
          anchorDate,
          paycheckAmt: parseMoneyInput(paycheckAmt),
          bonusEstimate: parseMoneyInput(bonusEstimate),
          viewMonth,
        })
      );
    } catch {}
  }, [deposits, goalMonthly, schedule, anchorDate, paycheckAmt, bonusEstimate, viewMonth]);

  function addDeposit(e) {
    e.preventDefault();
    setError("");
    setStatus({ msg: "" });

    const dt = String(date || "").trim();
    const src = String(source || "").trim();
    const amt = parseMoneyInput(amount);
    const nt = String(note || "").trim();

    if (!dt) return setError("Date is required.");
    if (!src) return setError("Source is required.");
    if (!Number.isFinite(amt) || amt <= 0) return setError("Amount must be > 0.");

    setDeposits((prev) => [
      { id: uid(), date: dt, source: src, amount: amt, note: nt, createdAt: Date.now() },
      ...prev,
    ]);

    setAmount("");
    setNote("");
    setStatus({ msg: "Deposit added ✅" });
  }

  function deleteDeposit(id) {
    if (!confirm("Delete this deposit?")) return;
    setDeposits((prev) => prev.filter((d) => d.id !== id));
  }

  function openEdit(d) {
    setEditId(d.id);
    setEDate(d.date);
    setESource(d.source);
    setEAmount(String(d.amount ?? ""));
    setENote(d.note || "");
  }

  function cancelEdit() {
    setEditId("");
    setEDate(isoDate());
    setESource("");
    setEAmount("");
    setENote("");
  }

  function saveEdit() {
    const dt = String(eDate || "").trim();
    const src = String(eSource || "").trim();
    const amt = parseMoneyInput(eAmount);
    const nt = String(eNote || "").trim();

    if (!dt || !src || !Number.isFinite(amt) || amt <= 0) {
      alert("Edit invalid. Need date, source, amount > 0.");
      return;
    }

    setDeposits((prev) =>
      prev.map((x) => (x.id === editId ? { ...x, date: dt, source: src, amount: amt, note: nt } : x))
    );
    cancelEdit();
    setStatus({ msg: "Deposit updated ✅" });
  }

  function quickPreset(src, amt) {
    setSource(src);
    setAmount(String(amt));
  }

  const computed = useMemo(() => {
    const now = new Date();
    const todayISO = isoDate(now);
    const today = toDateOnly(todayISO) || new Date();

    const thisMonth = viewMonth || monthKeyFromISO(todayISO);

    const monthDeposits = deposits.filter((d) => monthKeyFromISO(d.date) === thisMonth);
    const monthTotal = monthDeposits.reduce((s, d) => s + (Number(d.amount) || 0), 0);

    // Month stats
    const sm = startOfMonthDate(thisMonth);
    const em = endOfMonthDate(thisMonth);
    const dim = sm ? daysInMonth(sm.getFullYear(), sm.getMonth()) : 30;
    const dayNum = sm ? clamp((today.getDate() || 1), 1, dim) : 1;
    const daysLeftInclToday = Math.max(1, dim - dayNum + 1);
    const daysLeftExclToday = Math.max(0, dim - dayNum);

    const goalM = parseMoneyInput(goalMonthly);
    const goalMonthlyNum = Number.isFinite(goalM) ? goalM : 0;

    const remainingToGoal = Math.max(0, goalMonthlyNum - monthTotal);
    const neededPerDay = daysLeftInclToday > 0 ? remainingToGoal / daysLeftInclToday : remainingToGoal;

    // Pace line (where you should be today)
    const paceTargetToday = goalMonthlyNum > 0 ? (goalMonthlyNum * dayNum) / dim : 0;

    // Paydays this month
    const paydays = computePaydaysForMonth({
      monthYM: thisMonth,
      schedule,
      anchorDateISO: anchorDate,
    }).sort((a, b) => a.getTime() - b.getTime());

    // Paydays remaining from today to end of month (inclusive)
    const paydaysLeft = paydays.filter((d) => sameOrAfter(d, today)).length;

    const payAmt = parseMoneyInput(paycheckAmt);
    const payAmtNum = Number.isFinite(payAmt) ? payAmt : 0;

    const neededPerPaycheck = paydaysLeft > 0 ? remainingToGoal / paydaysLeft : remainingToGoal;

    // Projection
    const bonusNum = Number.isFinite(parseMoneyInput(bonusEstimate)) ? parseMoneyInput(bonusEstimate) : 0;
    const projectedRemaining = paydaysLeft * payAmtNum + (bonusNum || 0);
    const projectedTotal = monthTotal + projectedRemaining;

    // Next payday
    const nextPayday = paydays.find((d) => sameOrAfter(d, today));

    // Weekly (last 7 days total)
    const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = t0 - 6 * 86400000;
    let weekTotal = 0;
    for (const d of deposits) {
      const t = new Date(String(d.date) + "T00:00:00").getTime();
      if (t >= weekStart && t <= t0) weekTotal += Number(d.amount) || 0;
    }

    // Streak (consecutive days with deposit; allow starting yesterday if none today)
    const daysWith = new Set(deposits.map((d) => d.date));
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const t = t0 - i * 86400000;
      const key = isoDate(new Date(t));
      if (daysWith.has(key)) streak++;
      else break;
    }
    if (streak === 0) {
      for (let i = 1; i < 365; i++) {
        const t = t0 - i * 86400000;
        const key = isoDate(new Date(t));
        if (daysWith.has(key)) streak++;
        else break;
      }
    }

    // Filters
    const qq = q.trim().toLowerCase();
    let rows = deposits.slice();

    if (qq) {
      rows = rows.filter((d) => {
        const hay = `${d.source} ${d.note} ${d.date}`.toLowerCase();
        return hay.includes(qq);
      });
    }

    rows.sort((a, b) => {
      if (sortBy === "date_desc")
        return String(b.date).localeCompare(String(a.date)) || (b.createdAt || 0) - (a.createdAt || 0);
      if (sortBy === "amt_desc") return (Number(b.amount) || 0) - (Number(a.amount) || 0);
      if (sortBy === "source_asc") return String(a.source).localeCompare(String(b.source));
      return 0;
    });

    // Month options
    const months = Array.from(new Set(deposits.map((d) => monthKeyFromISO(d.date)).filter(Boolean)))
      .sort()
      .reverse();
    if (!months.includes(thisMonth)) months.unshift(thisMonth);

    // Progress %
    const monthPct = goalMonthlyNum > 0 ? clamp((monthTotal / goalMonthlyNum) * 100, 0, 999) : 0;
    const pacePct = goalMonthlyNum > 0 ? clamp((paceTargetToday / goalMonthlyNum) * 100, 0, 100) : 0;

    // Alerts
    const behindPace = goalMonthlyNum > 0 && monthTotal + 0.0001 < paceTargetToday; // tiny epsilon
    const goalHit = goalMonthlyNum > 0 && monthTotal >= goalMonthlyNum;
    const noDepositDays = (() => {
      // days since last deposit date
      if (deposits.length === 0) return 999;
      const latest = deposits
        .slice()
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
      const ld = toDateOnly(latest?.date);
      if (!ld) return 999;
      const diff = Math.floor((t0 - ld.getTime()) / 86400000);
      return Math.max(0, diff);
    })();

    return {
      todayISO,
      thisMonth,
      months,
      monthTotal,
      weekTotal,
      streak,
      goalMonthlyNum,
      remainingToGoal,
      neededPerDay,
      neededPerPaycheck,
      paydays,
      paydaysLeft,
      nextPaydayISO: nextPayday ? dateToISO(nextPayday) : "",
      payAmtNum,
      bonusNum,
      projectedTotal,
      projectedRemaining,
      paceTargetToday,
      behindPace,
      goalHit,
      noDepositDays,
      rows,
      monthPct,
      pacePct,
      daysLeftInclToday,
      daysLeftExclToday,
      dayNum,
      dim,
    };
  }, [deposits, goalMonthly, schedule, anchorDate, paycheckAmt, bonusEstimate, viewMonth, q, sortBy]);

  return (
    <main className="container">
      <header style={{ marginBottom: 14 }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Income</div>
        <h1 style={{ margin: 0 }}>Income Command</h1>
        <div className="muted" style={{ marginTop: 6 }}>
          This is the engine. If income is weak, everything breaks.
        </div>
        {status.msg ? <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>{status.msg}</div> : null}
      </header>

      {/* Alerts */}
      {(computed.behindPace || computed.goalHit || computed.noDepositDays >= 3) ? (
        <div className="row" style={{ gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          {computed.goalHit ? (
            <div className="card" style={{ padding: 12, flex: 1, minWidth: 260 }}>
              <div style={{ fontWeight: 950 }}>Goal hit ✅</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                Month total {money(computed.monthTotal)} ≥ goal {money(computed.goalMonthlyNum)}.
              </div>
            </div>
          ) : null}

          {computed.behindPace ? (
            <div className="card" style={{ padding: 12, flex: 1, minWidth: 260 }}>
              <div style={{ fontWeight: 950 }}>Behind pace ⚠️</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                You’re at {money(computed.monthTotal)} but pace target is {money(computed.paceTargetToday)}.
              </div>
            </div>
          ) : null}

          {computed.noDepositDays >= 3 ? (
            <div className="card" style={{ padding: 12, flex: 1, minWidth: 260 }}>
              <div style={{ fontWeight: 950 }}>No deposits logged</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                It’s been {computed.noDepositDays} days since the last deposit entry.
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* KPIs */}
      <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
        <div className="card kpi" style={{ flex: 1, minWidth: 240, padding: 14 }}>
          <div className="muted" style={{ fontSize: 12 }}>This month</div>
          <div className="kpiValue">{money(computed.monthTotal)}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            Goal {money(computed.goalMonthlyNum)} • {computed.monthPct.toFixed(0)}%
          </div>

          <div className="card" style={{ padding: 10, marginTop: 10 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Pace bar</div>
            <div style={{ height: 10, borderRadius: 999, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.04)", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${clamp(computed.monthPct, 0, 100)}%`,
                  background: "rgba(255,255,255,.18)",
                }}
              />
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Today is day {computed.dayNum}/{computed.dim}. Pace target: {money(computed.paceTargetToday)}.
            </div>
          </div>
        </div>

        <div className="card kpi" style={{ flex: 1, minWidth: 240, padding: 14 }}>
          <div className="muted" style={{ fontSize: 12 }}>Needed to hit goal</div>
          <div className="kpiValue">{money(computed.remainingToGoal)}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            Per day: {money(computed.neededPerDay)} • Days left: {computed.daysLeftInclToday}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            Paydays left: {computed.paydaysLeft} • Per paycheck: {money(computed.neededPerPaycheck)}
          </div>
        </div>

        <div className="card kpi" style={{ flex: 1, minWidth: 240, padding: 14 }}>
          <div className="muted" style={{ fontSize: 12 }}>Projection</div>
          <div className="kpiValue">{money(computed.projectedTotal)}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            Expected remaining: {money(computed.projectedRemaining)}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            Next payday: {computed.nextPaydayISO || "—"}
          </div>
        </div>
      </div>

      <div style={{ height: 16 }} />

      {/* Settings + Add Deposit */}
      <div className="row" style={{ gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* Settings */}
        <div className="card" style={{ flex: 1, minWidth: 340, padding: 12 }}>
          <div style={{ fontWeight: 950, marginBottom: 10 }}>Income Setup</div>

          <div className="grid" style={{ gap: 10 }}>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Monthly goal</div>
              <input className="input" inputMode="decimal" value={goalMonthly} onChange={(e) => setGoalMonthly(e.target.value)} placeholder="8000" />
            </div>

            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Pay schedule</div>
                <select className="input" value={schedule} onChange={(e) => setSchedule(e.target.value)}>
                  <option value="WEEKLY">Weekly</option>
                  <option value="BIWEEKLY">Biweekly</option>
                  <option value="TWICE_MONTHLY">Twice monthly (1st + 15th)</option>
                  <option value="MONTHLY">Monthly (1st)</option>
                </select>
              </div>

              <div style={{ flex: 1, minWidth: 160 }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Expected paycheck</div>
                <input className="input" inputMode="decimal" value={paycheckAmt} onChange={(e) => setPaycheckAmt(e.target.value)} placeholder="2000" />
              </div>
            </div>

            {(String(schedule).toUpperCase() === "WEEKLY" || String(schedule).toUpperCase() === "BIWEEKLY") ? (
              <div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Anchor payday (most recent payday)</div>
                <input className="input" type="date" value={anchorDate} onChange={(e) => setAnchorDate(e.target.value)} />
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  Used to auto-calc paydays inside the month.
                </div>
              </div>
            ) : null}

            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Monthly bonus estimate (optional)</div>
              <input className="input" inputMode="decimal" value={bonusEstimate} onChange={(e) => setBonusEstimate(e.target.value)} placeholder="0" />
            </div>

            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontWeight: 900 }}>Paydays this month</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                {computed.paydays.length
                  ? computed.paydays.map((d) => dateToISO(d)).join(" • ")
                  : "Set schedule + anchor date (weekly/biweekly) to auto-calc."}
              </div>
            </div>
          </div>
        </div>

        {/* Add Deposit */}
        <div className="card" style={{ flex: 2, minWidth: 420, padding: 12 }}>
          <div style={{ fontWeight: 950, marginBottom: 10 }}>Add Deposit</div>

          <form onSubmit={addDeposit} className="grid" style={{ gap: 10 }}>
            <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 170 }} />
              <input
                className="input"
                placeholder="Source (Paycheck, Bonus, Side hustle...)"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                style={{ flex: 1, minWidth: 220 }}
              />
              <input
                className="input"
                placeholder="Amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{ width: 180 }}
              />
            </div>

            <input className="input" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />

            {error ? (
              <div className="card" style={{ padding: 10 }}>
                <div style={{ fontWeight: 950 }}>Fix this:</div>
                <div className="muted" style={{ marginTop: 4 }}>{error}</div>
              </div>
            ) : null}

            <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <button className="btn" type="submit">Add Deposit</button>
              <button className="btnGhost" type="button" onClick={() => { setAmount(""); setNote(""); setError(""); }}>
                Clear
              </button>

              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <button className="btnGhost" type="button" onClick={() => quickPreset("Paycheck", computed.payAmtNum || 2000)}>Paycheck</button>
                <button className="btnGhost" type="button" onClick={() => quickPreset("Bonus", 500)}>Bonus</button>
                <button className="btnGhost" type="button" onClick={() => quickPreset("Side Hustle", 200)}>Side</button>
              </div>
            </div>

            <div className="muted" style={{ fontSize: 12 }}>
              Streak: {computed.streak} days • Last 7 days: {money(computed.weekTotal)}
            </div>
          </form>
        </div>
      </div>

      <div style={{ height: 16 }} />

      {/* History */}
      <div className="card" style={{ padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 950 }}>Deposit History</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              {computed.rows.length} items • Month: <b>{fmtMonthLabel(computed.thisMonth)}</b>
            </div>
          </div>

          <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <select className="input" value={viewMonth} onChange={(e) => setViewMonth(e.target.value)} style={{ width: 140 }}>
              {computed.months.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            <input className="input" placeholder="Search source/note/date…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 260 }} />

            <select className="input" value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ width: 200 }}>
              <option value="date_desc">Sort: Date (new → old)</option>
              <option value="amt_desc">Sort: Amount (high → low)</option>
              <option value="source_asc">Sort: Source (A → Z)</option>
            </select>
          </div>
        </div>

        <div style={{ height: 10 }} />

        {computed.rows.length === 0 ? (
          <div className="muted">No deposits yet.</div>
        ) : (
          <div className="grid">
            {computed.rows.map((d) => (
              <div key={d.id} className="card" style={{ padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 950 }}>
                      {money(d.amount)}{" "}
                      <span className="muted" style={{ fontWeight: 800 }}>• {d.source}</span>
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      Date {d.date}{d.note ? ` • Note: ${d.note}` : ""}
                    </div>
                  </div>

                  <div className="row" style={{ gap: 8 }}>
                    <button className="btnGhost" type="button" onClick={() => openEdit(d)}>
                      Edit
                    </button>
                    <button className="btnGhost" type="button" onClick={() => deleteDeposit(d.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit modal (simple inline) */}
      {editId ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 9999,
          }}
        >
          <div className="card" style={{ width: "min(720px, 100%)", padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <div style={{ fontWeight: 950 }}>Edit Deposit</div>
              <button className="btnGhost" type="button" onClick={cancelEdit}>Close</button>
            </div>

            <div style={{ height: 10 }} />

            <div className="grid" style={{ gap: 10 }}>
              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <input className="input" type="date" value={eDate} onChange={(e) => setEDate(e.target.value)} style={{ width: 170 }} />
                <input className="input" value={eSource} onChange={(e) => setESource(e.target.value)} placeholder="Source" style={{ flex: 1, minWidth: 220 }} />
                <input className="input" value={eAmount} onChange={(e) => setEAmount(e.target.value)} placeholder="Amount" inputMode="decimal" style={{ width: 180 }} />
              </div>
              <input className="input" value={eNote} onChange={(e) => setENote(e.target.value)} placeholder="Note (optional)" />

              <div className="row" style={{ gap: 10 }}>
                <button className="btn" type="button" onClick={saveEdit}>Save</button>
                <button className="btnGhost" type="button" onClick={cancelEdit}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
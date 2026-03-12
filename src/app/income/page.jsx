"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/** ---------- utils ---------- **/
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
  if (!ym || ym.length < 7) return "—";
  const [y, m] = ym.split("-").map((x) => Number(x));
  if (!Number.isFinite(y) || !Number.isFinite(m)) return ym;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
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

function pct(n, d) {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return 0;
  return (n / d) * 100;
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

  const step = scheduleKey === "WEEKLY" ? 7 : 14;
  const anchor = toDateOnly(anchorDateISO);
  if (!anchor) return [];

  let cur = new Date(anchor.getTime());
  while (cur > end) cur = addDays(cur, -step);
  while (addDays(cur, step) < start) cur = addDays(cur, step);

  const out = [];
  let iter = new Date(cur.getTime());
  while (iter < start) iter = addDays(iter, step);
  while (iter <= end) {
    out.push(new Date(iter.getTime()));
    iter = addDays(iter, step);
  }
  return out;
}

/** ---------- defaults ---------- **/
const DEFAULT_SETTINGS = {
  goalMonthly: 8000,
  schedule: "BIWEEKLY",
  anchorDate: isoDate(),
  paycheckAmt: 2000,
  bonusEstimate: 0,
};

const ACCENT = "#3b82f6";
const ACCENT_SOFT = "rgba(59,130,246,.18)";
const BORDER = "rgba(255,255,255,.08)";
const BORDER_SOFT = "rgba(255,255,255,.06)";
const TEXT_SOFT = "rgba(255,255,255,.72)";
const TEXT_MID = "rgba(255,255,255,.86)";
const BG_SOFT = "rgba(255,255,255,.035)";
const BG_PANEL = "rgba(255,255,255,.03)";
const SHADOW = "0 18px 60px rgba(0,0,0,.30)";

const panelStyle = {
  background: BG_PANEL,
  border: `1px solid ${BORDER_SOFT}`,
  borderRadius: 18,
  boxShadow: SHADOW,
};

const cardStyle = {
  background: BG_SOFT,
  border: `1px solid ${BORDER}`,
  borderRadius: 16,
  boxShadow: "0 12px 35px rgba(0,0,0,.22)",
};

function pill(bg = "rgba(255,255,255,.05)", border = "rgba(255,255,255,.10)") {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "7px 11px",
    borderRadius: 999,
    background: bg,
    border: `1px solid ${border}`,
    fontSize: 12,
    color: TEXT_MID,
  };
}

function normalizeDeposit(raw) {
  const x = raw || {};
  const amt = Number(x.amount);
  const createdAt = Number(x.createdAt);

  return {
    id: String(x.id || uid()),
    date: String(x.date || isoDate()),
    source: String(x.source || "").trim(),
    amount: Number.isFinite(amt) ? amt : 0,
    note: String(x.note || ""),
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
  };
}

function mapDepositRowToClient(row) {
  return normalizeDeposit({
    id: row.id,
    date: row.deposit_date,
    source: row.source,
    amount: row.amount,
    note: row.note,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  });
}

function mapDepositClientToRow(deposit, userId) {
  return {
    id: deposit.id,
    user_id: userId,
    deposit_date: deposit.date,
    source: deposit.source,
    amount: Number(deposit.amount) || 0,
    note: deposit.note || "",
    created_at: deposit.createdAt
      ? new Date(deposit.createdAt).toISOString()
      : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function mapIncomeSettingsRowToClient(row) {
  return {
    goalMonthly:
      Number.isFinite(Number(row?.goal_monthly)) ? Number(row.goal_monthly) : DEFAULT_SETTINGS.goalMonthly,
    schedule: row?.schedule ? String(row.schedule) : DEFAULT_SETTINGS.schedule,
    anchorDate: row?.anchor_date ? String(row.anchor_date) : DEFAULT_SETTINGS.anchorDate,
    paycheckAmt:
      Number.isFinite(Number(row?.paycheck_amt)) ? Number(row.paycheck_amt) : DEFAULT_SETTINGS.paycheckAmt,
    bonusEstimate:
      Number.isFinite(Number(row?.bonus_estimate)) ? Number(row.bonus_estimate) : DEFAULT_SETTINGS.bonusEstimate,
    viewMonth: row?.view_month ? String(row.view_month) : monthKeyFromISO(isoDate()),
  };
}

function mapIncomeSettingsClientToRow(settings, userId) {
  return {
    user_id: userId,
    goal_monthly: Number(settings.goalMonthly) || 0,
    schedule: String(settings.schedule || "BIWEEKLY").toUpperCase(),
    anchor_date: settings.anchorDate || null,
    paycheck_amt: Number(settings.paycheckAmt) || 0,
    bonus_estimate: Number(settings.bonusEstimate) || 0,
    view_month: settings.viewMonth || monthKeyFromISO(isoDate()),
    updated_at: new Date().toISOString(),
  };
}

function ProgressBar({ valuePct, background = "rgba(255,255,255,.07)", fill = ACCENT, height = 14 }) {
  return (
    <div
      style={{
        height,
        borderRadius: 999,
        background,
        border: "1px solid rgba(255,255,255,.08)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${clamp(valuePct, 0, 100)}%`,
          background: fill,
          borderRadius: 999,
          transition: "width .25s ease",
        }}
      />
    </div>
  );
}

export default function IncomePage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  // Settings
  const [goalMonthly, setGoalMonthly] = useState(String(DEFAULT_SETTINGS.goalMonthly));
  const [schedule, setSchedule] = useState(DEFAULT_SETTINGS.schedule);
  const [anchorDate, setAnchorDate] = useState(DEFAULT_SETTINGS.anchorDate);
  const [paycheckAmt, setPaycheckAmt] = useState(String(DEFAULT_SETTINGS.paycheckAmt));
  const [bonusEstimate, setBonusEstimate] = useState(String(DEFAULT_SETTINGS.bonusEstimate));

  // Add deposit
  const [date, setDate] = useState(isoDate());
  const [source, setSource] = useState("Paycheck");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  // Data
  const [deposits, setDeposits] = useState([]);
  const [status, setStatus] = useState({ msg: "" });
  const [error, setError] = useState("");

  // UI
  const [viewMonth, setViewMonth] = useState(monthKeyFromISO(isoDate()));
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState("date_desc");

  // Edit
  const [editId, setEditId] = useState("");
  const [eDate, setEDate] = useState(isoDate());
  const [eSource, setESource] = useState("");
  const [eAmount, setEAmount] = useState("");
  const [eNote, setENote] = useState("");

  const CONTROL_H = 46;
  const controlStyle = { height: CONTROL_H, display: "inline-flex", alignItems: "center" };

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        if (!supabase) throw new Error("Supabase is not configured. Check your environment variables.");

        const {
          data: { user: currentUser },
          error: userErr,
        } = await supabase.auth.getUser();

        if (userErr) throw userErr;
        if (!mounted) return;

        setUser(currentUser || null);

        if (!currentUser) {
          setLoading(false);
          return;
        }

        const [depositsRes, settingsRes] = await Promise.all([
          supabase
            .from("income_deposits")
            .select("*")
            .eq("user_id", currentUser.id)
            .order("deposit_date", { ascending: false })
            .order("created_at", { ascending: false }),
          supabase
            .from("income_settings")
            .select("*")
            .eq("user_id", currentUser.id)
            .maybeSingle(),
        ]);

        if (depositsRes.error) throw depositsRes.error;
        if (settingsRes.error) throw settingsRes.error;

        const loadedDeposits = (depositsRes.data || []).map(mapDepositRowToClient);
        const s = mapIncomeSettingsRowToClient(settingsRes.data);

        if (!mounted) return;

        setDeposits(loadedDeposits);
        setGoalMonthly(String(s.goalMonthly));
        setSchedule(String(s.schedule));
        setAnchorDate(String(s.anchorDate));
        setPaycheckAmt(String(s.paycheckAmt));
        setBonusEstimate(String(s.bonusEstimate));
        setViewMonth(String(s.viewMonth || monthKeyFromISO(isoDate())));
        setStatus({ msg: "Income loaded ✅" });
      } catch (err) {
        if (!mounted) return;
        setPageError(err?.message || "Failed to load income data.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    bootstrap();
    return () => {
      mounted = false;
    };
  }, []);

  async function saveSettings(next) {
    if (!user || !supabase) return;

    const payload = mapIncomeSettingsClientToRow(
      {
        goalMonthly: Number.isFinite(parseMoneyInput(next.goalMonthly)) ? parseMoneyInput(next.goalMonthly) : 0,
        schedule: next.schedule,
        anchorDate: next.anchorDate,
        paycheckAmt: Number.isFinite(parseMoneyInput(next.paycheckAmt)) ? parseMoneyInput(next.paycheckAmt) : 0,
        bonusEstimate: Number.isFinite(parseMoneyInput(next.bonusEstimate)) ? parseMoneyInput(next.bonusEstimate) : 0,
        viewMonth: next.viewMonth,
      },
      user.id
    );

    const { error: saveErr } = await supabase.from("income_settings").upsert(payload, { onConflict: "user_id" });

    if (saveErr) setPageError(saveErr.message || "Failed to save income settings.");
  }

  async function addDeposit(e) {
    e.preventDefault();
    setError("");
    setStatus({ msg: "" });
    setPageError("");

    if (!user || !supabase) {
      setError("You must be logged in.");
      return;
    }

    const dt = String(date || "").trim();
    const src = String(source || "").trim();
    const amt = parseMoneyInput(amount);
    const nt = String(note || "").trim();

    if (!dt) return setError("Date is required.");
    if (!src) return setError("Source is required.");
    if (!Number.isFinite(amt) || amt <= 0) return setError("Amount must be > 0.");

    const deposit = normalizeDeposit({
      id: uid(),
      date: dt,
      source: src,
      amount: amt,
      note: nt,
      createdAt: Date.now(),
    });

    const { data, error: saveErr } = await supabase
      .from("income_deposits")
      .insert([mapDepositClientToRow(deposit, user.id)])
      .select()
      .single();

    if (saveErr) {
      setError(saveErr.message || "Failed to save deposit.");
      return;
    }

    const savedDeposit = mapDepositRowToClient(data);

    setDeposits((prev) => [savedDeposit, ...prev]);
    setAmount("");
    setNote("");
    setStatus({ msg: "Deposit added ✅" });
  }

  async function deleteDeposit(id) {
    if (!user || !supabase) return;
    if (!confirm("Delete this deposit?")) return;

    const previous = deposits;
    setDeposits((prev) => prev.filter((d) => d.id !== id));

    const { error: delErr } = await supabase
      .from("income_deposits")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (delErr) {
      setDeposits(previous);
      setPageError(delErr.message || "Failed to delete deposit.");
    }
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

  async function saveEdit() {
    if (!user || !supabase) return;

    const dt = String(eDate || "").trim();
    const src = String(eSource || "").trim();
    const amt = parseMoneyInput(eAmount);
    const nt = String(eNote || "").trim();

    if (!dt || !src || !Number.isFinite(amt) || amt <= 0) {
      alert("Edit invalid. Need date, source, amount > 0.");
      return;
    }

    const current = deposits.find((x) => x.id === editId);
    if (!current) return;

    const nextDeposit = normalizeDeposit({
      ...current,
      date: dt,
      source: src,
      amount: amt,
      note: nt,
    });

    const { data, error: saveErr } = await supabase
      .from("income_deposits")
      .update({
        deposit_date: nextDeposit.date,
        source: nextDeposit.source,
        amount: nextDeposit.amount,
        note: nextDeposit.note,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (saveErr) {
      setPageError(saveErr.message || "Failed to update deposit.");
      return;
    }

    const savedDeposit = mapDepositRowToClient(data);
    setDeposits((prev) => prev.map((x) => (x.id === editId ? savedDeposit : x)));
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

    const sm = startOfMonthDate(thisMonth);
    const dim = sm ? daysInMonth(sm.getFullYear(), sm.getMonth()) : 30;
    const dayNum = sm ? clamp(today.getDate() || 1, 1, dim) : 1;
    const daysLeftInclToday = Math.max(1, dim - dayNum + 1);

    const goalM = parseMoneyInput(goalMonthly);
    const goalMonthlyNum = Number.isFinite(goalM) ? goalM : 0;

    const remainingToGoal = Math.max(0, goalMonthlyNum - monthTotal);
    const neededPerDay = daysLeftInclToday > 0 ? remainingToGoal / daysLeftInclToday : remainingToGoal;

    const paceTargetToday = goalMonthlyNum > 0 ? (goalMonthlyNum * dayNum) / dim : 0;
    const gapToPace = monthTotal - paceTargetToday;
    const behindBy = Math.max(0, -gapToPace);
    const aheadBy = Math.max(0, gapToPace);
    const bufferDays = goalMonthlyNum > 0 && neededPerDay > 0 ? Math.floor(aheadBy / neededPerDay) : 0;

    const paydays = computePaydaysForMonth({
      monthYM: thisMonth,
      schedule,
      anchorDateISO: anchorDate,
    }).sort((a, b) => a.getTime() - b.getTime());

    const paydaysLeftDates = paydays.filter((d) => sameOrAfter(d, today));
    const paydaysLeft = paydaysLeftDates.length;

    const payAmt = parseMoneyInput(paycheckAmt);
    const payAmtNum = Number.isFinite(payAmt) ? payAmt : 0;

    const neededPerPaycheck = paydaysLeft > 0 ? remainingToGoal / paydaysLeft : remainingToGoal;

    const b = parseMoneyInput(bonusEstimate);
    const bonusNum = Number.isFinite(b) ? b : 0;

    const projectedRemaining = paydaysLeft * payAmtNum + bonusNum;
    const projectedTotal = monthTotal + projectedRemaining;
    const projectedGap = projectedTotal - goalMonthlyNum;

    const nextPayday = paydaysLeftDates[0];

    const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = t0 - 6 * 86400000;
    let weekTotal = 0;
    for (const d of deposits) {
      const t = new Date(String(d.date) + "T00:00:00").getTime();
      if (t >= weekStart && t <= t0) weekTotal += Number(d.amount) || 0;
    }

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

    const qq = q.trim().toLowerCase();
    let rows = deposits.slice();
    if (qq) rows = rows.filter((d) => `${d.source} ${d.note} ${d.date}`.toLowerCase().includes(qq));

    rows.sort((a, b) => {
      if (sortBy === "date_desc") {
        return String(b.date).localeCompare(String(a.date)) || (b.createdAt || 0) - (a.createdAt || 0);
      }
      if (sortBy === "amt_desc") return (Number(b.amount) || 0) - (Number(a.amount) || 0);
      if (sortBy === "source_asc") return String(a.source).localeCompare(String(b.source));
      return 0;
    });

    const months = Array.from(new Set(deposits.map((d) => monthKeyFromISO(d.date)).filter(Boolean))).sort().reverse();
    if (!months.includes(thisMonth)) months.unshift(thisMonth);

    const monthPct = goalMonthlyNum > 0 ? clamp(pct(monthTotal, goalMonthlyNum), 0, 999) : 0;
    const pacePct = goalMonthlyNum > 0 ? clamp(pct(paceTargetToday, goalMonthlyNum), 0, 100) : 0;
    const projectedPct = goalMonthlyNum > 0 ? clamp(pct(projectedTotal, goalMonthlyNum), 0, 999) : 0;

    const plan = paydaysLeftDates.slice(0, 4).map((d) => {
      const need = neededPerPaycheck;
      const delta = payAmtNum - need;
      return { iso: dateToISO(d), need, expected: payAmtNum, delta };
    });

    const shortfallIfOnlyPaychecks = Math.max(0, remainingToGoal - paydaysLeft * payAmtNum);
    const bonusNeeded = Math.max(0, shortfallIfOnlyPaychecks - bonusNum);

    const bySourceMap = new Map();
    for (const d of monthDeposits) {
      const k = String(d.source || "Unknown").trim() || "Unknown";
      bySourceMap.set(k, (bySourceMap.get(k) || 0) + (Number(d.amount) || 0));
    }
    const bySource = Array.from(bySourceMap.entries())
      .map(([source, total]) => ({
        source,
        total,
        pct: monthTotal > 0 ? (total / monthTotal) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    const topSource = bySource[0]?.source || "";
    const behindPace = goalMonthlyNum > 0 && monthTotal + 0.0001 < paceTargetToday;
    const goalHit = goalMonthlyNum > 0 && monthTotal >= goalMonthlyNum;
    const projectedHit = goalMonthlyNum > 0 && projectedTotal >= goalMonthlyNum;

    const noDepositDays = (() => {
      if (deposits.length === 0) return 999;
      const latest = deposits.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
      const ld = toDateOnly(latest?.date);
      if (!ld) return 999;
      const diff = Math.floor((t0 - ld.getTime()) / 86400000);
      return Math.max(0, diff);
    })();

    const targetStatus = (() => {
      if (goalHit) return "Target Hit";
      if (projectedHit) return "Projected Hit";
      if (behindPace) return "Behind";
      return "On Track";
    })();

    return {
      thisMonth,
      months,
      monthDeposits,
      monthTotal,
      goalMonthlyNum,
      remainingToGoal,
      neededPerDay,
      paceTargetToday,
      monthPct,
      pacePct,
      projectedPct,
      gapToPace,
      behindBy,
      aheadBy,
      bufferDays,
      paydays,
      paydaysLeft,
      nextPaydayISO: nextPayday ? dateToISO(nextPayday) : "",
      payAmtNum,
      bonusNum,
      projectedRemaining,
      projectedTotal,
      projectedGap,
      plan,
      neededPerPaycheck,
      shortfallIfOnlyPaychecks,
      bonusNeeded,
      bySource,
      topSource,
      behindPace,
      goalHit,
      projectedHit,
      noDepositDays,
      streak,
      weekTotal,
      rows,
      dayNum,
      dim,
      daysLeftInclToday,
      targetStatus,
    };
  }, [deposits, goalMonthly, schedule, anchorDate, paycheckAmt, bonusEstimate, viewMonth, q, sortBy]);

  const scheduleKey = String(schedule || "").toUpperCase();

  if (loading) {
    return (
      <main className="container" style={{ paddingBottom: 24 }}>
        <div className="card" style={{ ...panelStyle, padding: 16 }}>Loading income...</div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="container" style={{ paddingBottom: 24 }}>
        <div className="card" style={{ ...panelStyle, padding: 16 }}>
          <div style={{ fontWeight: 950 }}>Please log in</div>
          <div className="muted" style={{ marginTop: 6 }}>
            This page now loads from Supabase, so you need to be signed in.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="container" style={{ paddingBottom: 24 }}>
      <header style={{ marginBottom: 16 }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Income</div>

        <div
          className="row"
          style={{ justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}
        >
          <div>
            <h1 style={{ margin: 0, letterSpacing: -0.4 }}>Income Target Command</h1>
            <div className="muted" style={{ marginTop: 6 }}>
              Set the target. Log deposits. Watch the gap close.
            </div>
          </div>

          <div style={pill(ACCENT_SOFT, "rgba(59,130,246,.28)")}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: ACCENT, display: "inline-block" }} />
            Viewing: <b style={{ color: "rgba(255,255,255,.95)" }}>{fmtMonthLabel(computed.thisMonth)}</b>
          </div>
        </div>

        {status.msg ? (
          <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
            {status.msg}
          </div>
        ) : null}
      </header>

      {pageError ? (
        <div className="card" style={{ ...cardStyle, padding: 12, marginBottom: 16, border: "1px solid rgba(239,68,68,.35)" }}>
          <div style={{ fontWeight: 950 }}>Database issue</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{pageError}</div>
        </div>
      ) : null}

      {/* HERO TARGET SECTION */}
      <div className="card" style={{ ...panelStyle, padding: 16, marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "flex-start",
            flexWrap: "wrap",
            marginBottom: 14,
          }}
        >
          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Main target tracker</div>
            <div style={{ fontWeight: 950, fontSize: 22 }}>
              {computed.targetStatus}{" "}
              <span className="muted" style={{ fontSize: 14, fontWeight: 800 }}>
                • {fmtMonthLabel(computed.thisMonth)}
              </span>
            </div>
          </div>

          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <div style={pill()}>{computed.paydaysLeft} paycheck{computed.paydaysLeft === 1 ? "" : "s"} left</div>
            <div style={pill()}>{computed.nextPaydayISO || "No payday queued"}</div>
          </div>
        </div>

        <div
          className="grid"
          style={{
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            marginBottom: 14,
          }}
        >
          <div className="card" style={{ ...cardStyle, padding: 14 }}>
            <div className="muted" style={{ fontSize: 12 }}>Income target</div>
            <div style={{ fontSize: 30, fontWeight: 950, marginTop: 6 }}>{money(computed.goalMonthlyNum)}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>The number you are chasing this month.</div>
          </div>

          <div className="card" style={{ ...cardStyle, padding: 14 }}>
            <div className="muted" style={{ fontSize: 12 }}>Made so far</div>
            <div style={{ fontSize: 30, fontWeight: 950, marginTop: 6, color: "rgba(255,255,255,.96)" }}>
              {money(computed.monthTotal)}
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              {computed.monthPct.toFixed(0)}% of target logged.
            </div>
          </div>

          <div className="card" style={{ ...cardStyle, padding: 14 }}>
            <div className="muted" style={{ fontSize: 12 }}>Left to target</div>
            <div style={{ fontSize: 30, fontWeight: 950, marginTop: 6, color: computed.remainingToGoal > 0 ? "#f8fafc" : "#22c55e" }}>
              {money(computed.remainingToGoal)}
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              {computed.remainingToGoal > 0 ? `Need ${money(computed.neededPerDay)} per day.` : "Target already cleared."}
            </div>
          </div>

          <div className="card" style={{ ...cardStyle, padding: 14 }}>
            <div className="muted" style={{ fontSize: 12 }}>Projected finish</div>
            <div style={{ fontSize: 30, fontWeight: 950, marginTop: 6, color: computed.projectedGap >= 0 ? "#22c55e" : "#f8fafc" }}>
              {money(computed.projectedTotal)}
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              {computed.projectedGap >= 0
                ? `Projected to finish ${money(computed.projectedGap)} over target.`
                : `Projected short by ${money(Math.abs(computed.projectedGap))}.`}
            </div>
          </div>
        </div>

        <div className="card" style={{ ...cardStyle, padding: 14 }}>
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", marginBottom: 8 }}>
                <div style={{ fontWeight: 900 }}>Actual progress</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {money(computed.monthTotal)} / {money(computed.goalMonthlyNum)}
                </div>
              </div>
              <ProgressBar valuePct={computed.monthPct} fill={ACCENT} height={16} />
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", marginBottom: 8 }}>
                <div style={{ fontWeight: 900 }}>Projected finish line</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {money(computed.projectedTotal)} projected
                </div>
              </div>
              <ProgressBar valuePct={computed.projectedPct} fill="rgba(255,255,255,.35)" height={10} />
            </div>

            <div
              className="grid"
              style={{
                gap: 10,
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                marginTop: 2,
              }}
            >
              <div style={pill("rgba(255,255,255,.04)", "rgba(255,255,255,.09)")}>
                <b style={{ color: "rgba(255,255,255,.95)" }}>{money(computed.remainingToGoal)}</b> left to close
              </div>
              <div style={pill("rgba(255,255,255,.04)", "rgba(255,255,255,.09)")}>
                Need <b style={{ color: "rgba(255,255,255,.95)" }}>{money(computed.neededPerPaycheck)}</b> per remaining paycheck
              </div>
              <div style={pill("rgba(255,255,255,.04)", "rgba(255,255,255,.09)")}>
                Pace today: <b style={{ color: "rgba(255,255,255,.95)" }}>{money(computed.paceTargetToday)}</b>
              </div>
              <div style={pill("rgba(255,255,255,.04)", "rgba(255,255,255,.09)")}>
                {computed.gapToPace >= 0 ? "Ahead" : "Behind"} by{" "}
                <b style={{ color: "rgba(255,255,255,.95)" }}>{money(Math.abs(computed.gapToPace))}</b>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ALERTS / COMMAND STRIP */}
      {(computed.behindPace || computed.goalHit || computed.noDepositDays >= 3 || computed.projectedGap < 0) ? (
        <div
          className="grid"
          style={{
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            marginBottom: 16,
          }}
        >
          {computed.goalHit ? (
            <div className="card" style={{ ...cardStyle, padding: 12 }}>
              <div style={{ fontWeight: 950 }}>Target hit ✅</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                You already logged {money(computed.monthTotal)} this month.
              </div>
            </div>
          ) : null}

          {computed.projectedGap < 0 ? (
            <div className="card" style={{ ...cardStyle, padding: 12 }}>
              <div style={{ fontWeight: 950 }}>Projection is short</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                Current projection misses target by {money(Math.abs(computed.projectedGap))}.
              </div>
            </div>
          ) : null}

          {computed.behindPace ? (
            <div className="card" style={{ ...cardStyle, padding: 12 }}>
              <div style={{ fontWeight: 950 }}>Behind pace ⚠️</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                You are at {money(computed.monthTotal)} but should be near {money(computed.paceTargetToday)}.
              </div>
            </div>
          ) : null}

          {computed.noDepositDays >= 3 ? (
            <div className="card" style={{ ...cardStyle, padding: 12 }}>
              <div style={{ fontWeight: 950 }}>No deposits logged</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                It has been {computed.noDepositDays} days since the last logged deposit.
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* SECONDARY CARDS */}
      <div
        className="grid"
        style={{
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          alignItems: "stretch",
          marginBottom: 16,
        }}
      >
        <div className="card" style={{ ...panelStyle, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
            <div>
              <div className="muted" style={{ fontSize: 12 }}>Paycheck planner</div>
              <div style={{ fontWeight: 950, fontSize: 18 }}>
                Need <span className="muted" style={{ fontWeight: 800 }}>{money(computed.neededPerPaycheck)}</span> / paycheck
              </div>
            </div>
            <div className="muted" style={{ fontSize: 12, textAlign: "right" }}>
              Next payday
              <div style={{ fontWeight: 950, fontSize: 16 }}>{computed.nextPaydayISO || "—"}</div>
            </div>
          </div>

          <div style={{ height: 10 }} />

          <div className="card" style={{ ...cardStyle, padding: 10 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
              {computed.paydaysLeft ? (
                <>
                  {computed.paydaysLeft} left • Expected check <b>{money(computed.payAmtNum)}</b>
                </>
              ) : (
                <>No paydays left in this month based on current setup.</>
              )}
            </div>

            {computed.plan.length ? (
              <div className="grid" style={{ gap: 8 }}>
                {computed.plan.map((p) => {
                  const good = p.delta >= 0;
                  return (
                    <div key={p.iso} className="card" style={{ ...cardStyle, padding: 10, background: "rgba(255,255,255,.025)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                        <div>
                          <div style={{ fontWeight: 900 }}>{p.iso}</div>
                          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                            Need {money(p.need)}
                          </div>
                        </div>

                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 900 }}>
                            {good ? "Covered" : "Short"}{" "}
                            <span className="muted" style={{ fontWeight: 800 }}>{money(Math.abs(p.delta))}</span>
                          </div>
                          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                            Expected {money(p.expected)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="muted" style={{ fontSize: 12 }}>
                Set schedule and anchor date to auto-calc paydays.
              </div>
            )}

            <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
              {computed.shortfallIfOnlyPaychecks > 0 ? (
                <>
                  Paychecks alone leave you short <b>{money(computed.shortfallIfOnlyPaychecks)}</b>. Bonus estimate:{" "}
                  <b>{money(computed.bonusNum)}</b>. Extra bonus still needed: <b>{money(computed.bonusNeeded)}</b>.
                </>
              ) : (
                <>Expected paychecks plus bonus estimate should cover the target.</>
              )}
            </div>
          </div>
        </div>

        <div className="card" style={{ ...panelStyle, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
            <div>
              <div className="muted" style={{ fontSize: 12 }}>Income streams this month</div>
              <div style={{ fontWeight: 950, fontSize: 18 }}>
                Top source <span className="muted" style={{ fontWeight: 800 }}>{computed.topSource || "—"}</span>
              </div>
            </div>
            <div className="muted" style={{ fontSize: 12, textAlign: "right" }}>
              Total
              <div style={{ fontWeight: 950, fontSize: 16 }}>{money(computed.monthTotal)}</div>
            </div>
          </div>

          <div style={{ height: 10 }} />

          <div className="card" style={{ ...cardStyle, padding: 10 }}>
            {computed.bySource.length ? (
              <div className="grid" style={{ gap: 8 }}>
                {computed.bySource.slice(0, 6).map((s) => (
                  <div key={s.source} style={{ display: "grid", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                      <div style={{ fontWeight: 900 }}>{s.source}</div>
                      <div className="muted" style={{ fontWeight: 900 }}>
                        {money(s.total)} <span style={{ fontSize: 12, fontWeight: 800 }}>({s.pct.toFixed(0)}%)</span>
                      </div>
                    </div>
                    <ProgressBar valuePct={s.pct} fill="rgba(255,255,255,.22)" height={10} />
                  </div>
                ))}
                {computed.bySource.length > 6 ? (
                  <div className="muted" style={{ fontSize: 12 }}>+{computed.bySource.length - 6} more sources</div>
                ) : null}
              </div>
            ) : (
              <div className="muted" style={{ fontSize: 12 }}>No deposits logged for this month yet.</div>
            )}
          </div>
        </div>

        <div className="card" style={{ ...panelStyle, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
            <div>
              <div className="muted" style={{ fontSize: 12 }}>Fast snapshot</div>
              <div style={{ fontWeight: 950, fontSize: 18 }}>This month in plain English</div>
            </div>
          </div>

          <div style={{ height: 10 }} />

          <div className="grid" style={{ gap: 8 }}>
            <div className="card" style={{ ...cardStyle, padding: 10 }}>
              <div className="muted" style={{ fontSize: 12 }}>Last 7 days</div>
              <div style={{ fontWeight: 950, fontSize: 20, marginTop: 6 }}>{money(computed.weekTotal)}</div>
            </div>

            <div className="card" style={{ ...cardStyle, padding: 10 }}>
              <div className="muted" style={{ fontSize: 12 }}>Deposit streak</div>
              <div style={{ fontWeight: 950, fontSize: 20, marginTop: 6 }}>{computed.streak} day{computed.streak === 1 ? "" : "s"}</div>
            </div>

            <div className="card" style={{ ...cardStyle, padding: 10 }}>
              <div className="muted" style={{ fontSize: 12 }}>Buffer / catch-up</div>
              <div style={{ fontWeight: 950, fontSize: 20, marginTop: 6 }}>
                {computed.gapToPace >= 0 ? `${computed.bufferDays} day${computed.bufferDays === 1 ? "" : "s"} buffer` : money(computed.behindBy)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SETTINGS + ADD DEPOSIT */}
      <div
        className="grid"
        style={{
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          alignItems: "start",
          marginBottom: 16,
        }}
      >
        <div className="card" style={{ ...panelStyle, padding: 14 }}>
          <div style={{ fontWeight: 950, marginBottom: 10 }}>Income setup</div>

          <div className="grid" style={{ gap: 12 }}>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Income target</div>
              <input
                className="input"
                inputMode="decimal"
                value={goalMonthly}
                onChange={async (e) => {
                  const next = e.target.value;
                  setGoalMonthly(next);
                  await saveSettings({
                    goalMonthly: next,
                    schedule,
                    anchorDate,
                    paycheckAmt,
                    bonusEstimate,
                    viewMonth,
                  });
                }}
                placeholder="8000"
                style={{ ...controlStyle, width: "100%" }}
              />
            </div>

            <div
              className="grid"
              style={{
                gap: 10,
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              }}
            >
              <div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Pay schedule</div>
                <select
                  className="input"
                  value={schedule}
                  onChange={async (e) => {
                    const next = e.target.value;
                    setSchedule(next);
                    await saveSettings({
                      goalMonthly,
                      schedule: next,
                      anchorDate,
                      paycheckAmt,
                      bonusEstimate,
                      viewMonth,
                    });
                  }}
                  style={{ ...controlStyle, width: "100%" }}
                >
                  <option value="WEEKLY">Weekly</option>
                  <option value="BIWEEKLY">Biweekly</option>
                  <option value="TWICE_MONTHLY">Twice monthly (1st + 15th)</option>
                  <option value="MONTHLY">Monthly (1st)</option>
                </select>
              </div>

              <div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Expected paycheck</div>
                <input
                  className="input"
                  inputMode="decimal"
                  value={paycheckAmt}
                  onChange={async (e) => {
                    const next = e.target.value;
                    setPaycheckAmt(next);
                    await saveSettings({
                      goalMonthly,
                      schedule,
                      anchorDate,
                      paycheckAmt: next,
                      bonusEstimate,
                      viewMonth,
                    });
                  }}
                  placeholder="2000"
                  style={{ ...controlStyle, width: "100%" }}
                />
              </div>
            </div>

            {(scheduleKey === "WEEKLY" || scheduleKey === "BIWEEKLY") ? (
              <div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Anchor payday (most recent payday)</div>
                <input
                  className="input"
                  type="date"
                  value={anchorDate}
                  onChange={async (e) => {
                    const next = e.target.value;
                    setAnchorDate(next);
                    await saveSettings({
                      goalMonthly,
                      schedule,
                      anchorDate: next,
                      paycheckAmt,
                      bonusEstimate,
                      viewMonth,
                    });
                  }}
                  style={{ ...controlStyle, width: "100%" }}
                />
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  Used to calculate future paydays in the current month.
                </div>
              </div>
            ) : null}

            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Monthly bonus estimate</div>
              <input
                className="input"
                inputMode="decimal"
                value={bonusEstimate}
                onChange={async (e) => {
                  const next = e.target.value;
                  setBonusEstimate(next);
                  await saveSettings({
                    goalMonthly,
                    schedule,
                    anchorDate,
                    paycheckAmt,
                    bonusEstimate: next,
                    viewMonth,
                  });
                }}
                placeholder="0"
                style={{ ...controlStyle, width: "100%" }}
              />
            </div>

            <div className="card" style={{ ...cardStyle, padding: 12 }}>
              <div style={{ fontWeight: 900 }}>Paydays this month</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                {computed.paydays.length
                  ? computed.paydays.map((d) => dateToISO(d)).join(" • ")
                  : "Set schedule and anchor date to auto-calc paydays."}
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ ...panelStyle, padding: 14 }}>
          <div style={{ fontWeight: 950, marginBottom: 10 }}>Add deposit</div>

          <form onSubmit={addDeposit} className="grid" style={{ gap: 12 }}>
            <div
              className="grid"
              style={{
                gap: 10,
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                alignItems: "center",
              }}
            >
              <input
                className="input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{ ...controlStyle, width: "100%" }}
              />
              <input
                className="input"
                placeholder="Source (Paycheck, Bonus, Side hustle...)"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                style={{ ...controlStyle, width: "100%" }}
              />
              <input
                className="input"
                placeholder="Amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{ ...controlStyle, width: "100%" }}
              />
            </div>

            <input
              className="input"
              placeholder="Note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{ ...controlStyle, width: "100%" }}
            />

            {error ? (
              <div className="card" style={{ ...cardStyle, padding: 10, border: "1px solid rgba(239,68,68,.35)" }}>
                <div style={{ fontWeight: 950 }}>Fix this:</div>
                <div className="muted" style={{ marginTop: 4 }}>{error}</div>
              </div>
            ) : null}

            <div className="grid" style={{ gap: 10 }}>
              <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <button className="btn" type="submit" style={{ height: CONTROL_H, background: ACCENT, border: "1px solid rgba(255,255,255,.12)" }}>
                  Add Deposit
                </button>
                <button
                  className="btnGhost"
                  type="button"
                  onClick={() => {
                    setAmount("");
                    setNote("");
                    setError("");
                  }}
                  style={{ height: CONTROL_H }}
                >
                  Clear
                </button>
              </div>

              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <button
                  className="btnGhost"
                  type="button"
                  onClick={() => quickPreset("Paycheck", parseMoneyInput(paycheckAmt) || 2000)}
                  style={{ height: CONTROL_H }}
                >
                  Paycheck
                </button>
                <button
                  className="btnGhost"
                  type="button"
                  onClick={() => quickPreset("Bonus", 500)}
                  style={{ height: CONTROL_H }}
                >
                  Bonus
                </button>
                <button
                  className="btnGhost"
                  type="button"
                  onClick={() => quickPreset("Side Hustle", 200)}
                  style={{ height: CONTROL_H }}
                >
                  Side Hustle
                </button>
              </div>
            </div>

            <div className="muted" style={{ fontSize: 12 }}>
              Streak: {computed.streak} days • Last 7 days: {money(computed.weekTotal)}
            </div>
          </form>
        </div>
      </div>

      {/* HISTORY */}
      <div className="card" style={{ ...panelStyle, padding: 14 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontWeight: 950 }}>Deposit history</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              {computed.rows.length} items • Month: <b>{fmtMonthLabel(computed.thisMonth)}</b>
            </div>
          </div>

          <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <select
              className="input"
              value={viewMonth}
              onChange={async (e) => {
                const next = e.target.value;
                setViewMonth(next);
                await saveSettings({
                  goalMonthly,
                  schedule,
                  anchorDate,
                  paycheckAmt,
                  bonusEstimate,
                  viewMonth: next,
                });
              }}
              style={{ width: 170, ...controlStyle }}
            >
              {computed.months.map((m) => (
                <option key={m} value={m}>{fmtMonthLabel(m)}</option>
              ))}
            </select>

            <input
              className="input"
              placeholder="Search source / note / date..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ width: 280, ...controlStyle }}
            />

            <select
              className="input"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{ width: 220, ...controlStyle }}
            >
              <option value="date_desc">Sort: Date (new → old)</option>
              <option value="amt_desc">Sort: Amount (high → low)</option>
              <option value="source_asc">Sort: Source (A → Z)</option>
            </select>
          </div>
        </div>

        <div style={{ height: 12 }} />

        {computed.rows.length === 0 ? (
          <div className="muted">No deposits yet.</div>
        ) : (
          <div className="grid" style={{ gap: 10 }}>
            {computed.rows.map((d) => (
              <div key={d.id} className="card" style={{ ...cardStyle, padding: 12 }}>
                <div
                  className="grid"
                  style={{
                    gap: 10,
                    gridTemplateColumns: "1fr auto",
                    alignItems: "start",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 950, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
                      <span>{money(d.amount)}</span>
                      <span className="muted" style={{ fontWeight: 800 }}>• {d.source}</span>
                      <span className="muted" style={{ fontSize: 12 }}>• {d.date}</span>
                    </div>
                    {d.note ? (
                      <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                        Note: {d.note}
                      </div>
                    ) : null}
                  </div>

                  <div className="row" style={{ gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                    <button className="btnGhost" type="button" onClick={() => openEdit(d)} style={{ height: CONTROL_H }}>
                      Edit
                    </button>
                    <button className="btnGhost" type="button" onClick={() => deleteDeposit(d.id)} style={{ height: CONTROL_H }}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* EDIT MODAL */}
      {editId ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.58)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 9999,
          }}
        >
          <div className="card" style={{ ...panelStyle, width: "min(760px, 100%)", padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <div style={{ fontWeight: 950 }}>Edit deposit</div>
              <button className="btnGhost" type="button" onClick={cancelEdit} style={{ height: CONTROL_H }}>
                Close
              </button>
            </div>

            <div style={{ height: 12 }} />

            <div className="grid" style={{ gap: 10 }}>
              <div
                className="grid"
                style={{
                  gap: 10,
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  alignItems: "center",
                }}
              >
                <input
                  className="input"
                  type="date"
                  value={eDate}
                  onChange={(e) => setEDate(e.target.value)}
                  style={{ ...controlStyle, width: "100%" }}
                />
                <input
                  className="input"
                  value={eSource}
                  onChange={(e) => setESource(e.target.value)}
                  placeholder="Source"
                  style={{ ...controlStyle, width: "100%" }}
                />
                <input
                  className="input"
                  value={eAmount}
                  onChange={(e) => setEAmount(e.target.value)}
                  placeholder="Amount"
                  inputMode="decimal"
                  style={{ ...controlStyle, width: "100%" }}
                />
              </div>

              <input
                className="input"
                value={eNote}
                onChange={(e) => setENote(e.target.value)}
                placeholder="Note (optional)"
                style={{ ...controlStyle, width: "100%" }}
              />

              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <button className="btn" type="button" onClick={saveEdit} style={{ height: CONTROL_H, background: ACCENT, border: "1px solid rgba(255,255,255,.12)" }}>
                  Save
                </button>
                <button className="btnGhost" type="button" onClick={cancelEdit} style={{ height: CONTROL_H }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
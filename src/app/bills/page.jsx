"use client";

import { useEffect, useMemo, useState } from "react";

const LS_BILLS = "lcc_bills_v5";

/** ---------- utils ---------- **/
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

function parseMoneyInput(v) {
  const cleaned = String(v ?? "").replace(/[^0-9.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : NaN;
}

function money(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

function addMonths(iso, monthsToAdd) {
  if (!iso) return "";
  const [y, m, d] = String(iso).split("-").map((x) => Number(x));
  if (![y, m, d].every(Number.isFinite)) return "";
  const dt = new Date(y, m - 1, d);
  dt.setMonth(dt.getMonth() + Number(monthsToAdd || 0));
  return isoDate(dt);
}

function daysBetween(fromISO, toISO) {
  if (!fromISO || !toISO) return null;
  const a = new Date(fromISO + "T00:00:00");
  const b = new Date(toISO + "T00:00:00");
  const t = b.getTime() - a.getTime();
  if (!Number.isFinite(t)) return null;
  return Math.round(t / 86400000);
}

function plural(n, s) {
  return n === 1 ? s : `${s}s`;
}

/**
 * Payoff estimator (single debt) with monthly simulation.
 * Returns { months, payoffISO, totalInterest, totalPaid }.
 */
function payoffEstimateDetailed({ balance, aprPct, monthlyPay, startISO }) {
  const bal0 = Number(balance);
  const pmt = Number(monthlyPay);
  const apr = Number(aprPct);

  if (!Number.isFinite(bal0) || bal0 <= 0) return { months: null, payoffISO: null, totalInterest: 0, totalPaid: 0 };
  if (!Number.isFinite(pmt) || pmt <= 0) return { months: null, payoffISO: null, totalInterest: 0, totalPaid: 0 };

  const start = startISO || isoDate();

  if (!Number.isFinite(apr) || apr <= 0) {
    const months = Math.ceil(bal0 / pmt);
    const totalPaid = months * pmt;
    const totalInterest = Math.max(0, totalPaid - bal0);
    return { months, payoffISO: addMonths(start, months), totalInterest, totalPaid };
  }

  const r = (apr / 100) / 12;
  const firstInterest = bal0 * r;
  if (pmt <= firstInterest + 0.01) return { months: Infinity, payoffISO: null, totalInterest: Infinity, totalPaid: Infinity };

  let bal = bal0;
  let months = 0;
  let totalInterest = 0;
  let totalPaid = 0;

  while (bal > 0 && months < 2000) {
    const interest = bal * r;
    totalInterest += interest;

    const payThisMonth = Math.min(pmt, bal + interest);
    totalPaid += payThisMonth;

    bal = bal + interest - payThisMonth;
    months += 1;

    if (!Number.isFinite(bal)) return { months: null, payoffISO: null, totalInterest: 0, totalPaid: 0 };
    if (bal < 0) bal = 0;
  }

  if (months >= 2000) return { months: Infinity, payoffISO: null, totalInterest: Infinity, totalPaid: Infinity };
  return { months, payoffISO: addMonths(start, months), totalInterest, totalPaid };
}

/**
 * Snowball/Avalanche planner:
 * - uses minimums + global extra pool
 * - allocates pool to ONE focus debt at a time
 */
function planStrategy({ debts, monthlyExtraPool, strategy, startISO, previewMonths = 6 }) {
  const today = startISO || isoDate();
  const pool = Math.max(0, Number(monthlyExtraPool) || 0);

  const ds = (debts || [])
    .map((d) => ({
      id: String(d.id),
      name: String(d.name || ""),
      balance: Math.max(0, Number(d.balance) || 0),
      aprPct: Math.max(0, Number(d.aprPct) || 0),
      minPay: Math.max(0, Number(d.minPay) || 0),
    }))
    .filter((d) => d.balance > 0 && d.name);

  if (ds.length === 0) {
    return { monthsToDebtFree: 0, debtFreeISO: today, totalInterest: 0, payoffOrder: [], schedulePreview: [] };
  }

  const totalMin = ds.reduce((s, d) => s + d.minPay, 0);
  const capacity = totalMin + pool;
  if (capacity <= 0) {
    return { monthsToDebtFree: Infinity, debtFreeISO: null, totalInterest: Infinity, payoffOrder: [], schedulePreview: [] };
  }

  let months = 0;
  let totalInterest = 0;

  const payoffOrder = [];
  const schedulePreview = [];

  function pickFocus(remaining) {
    const list = remaining.slice();
    if (strategy === "snowball") {
      list.sort((a, b) => (a.balance - b.balance) || (b.aprPct - a.aprPct));
    } else {
      list.sort((a, b) => (b.aprPct - a.aprPct) || (a.balance - b.balance));
    }
    return list[0];
  }

  const MAX_MONTHS = 3000;

  while (months < MAX_MONTHS) {
    const remaining = ds.filter((d) => d.balance > 0);
    if (remaining.length === 0) break;

    if (months < previewMonths) {
      const focus = pickFocus(remaining);
      schedulePreview.push({
        monthIndex: months + 1,
        dateISO: addMonths(today, months + 1),
        focusDebtName: focus?.name || "",
        balances: remaining.map((d) => ({ id: d.id, name: d.name, balance: d.balance })),
      });
    }

    // interest
    for (const d of remaining) {
      const r = (d.aprPct / 100) / 12;
      const interest = d.balance * r;
      d.balance += interest;
      totalInterest += interest;
    }

    // minimums
    for (const d of remaining) {
      const pay = Math.min(d.minPay, d.balance);
      d.balance -= pay;
    }

    // pool to focus
    let extraLeft = pool;
    while (extraLeft > 0) {
      const still = ds.filter((d) => d.balance > 0);
      if (still.length === 0) break;

      const focus = pickFocus(still);
      if (!focus) break;

      const pay = Math.min(extraLeft, focus.balance);
      focus.balance -= pay;
      extraLeft -= pay;

      if (focus.balance <= 0.000001) focus.balance = 0;
    }

    // record payoffs
    for (const d of ds) {
      if (d.balance === 0 && !payoffOrder.some((x) => x.id === d.id)) {
        payoffOrder.push({ id: d.id, name: d.name, months: months + 1, paidOffISO: addMonths(today, months + 1) });
      }
    }

    months += 1;
    if (!Number.isFinite(totalInterest)) {
      return { monthsToDebtFree: Infinity, debtFreeISO: null, totalInterest: Infinity, payoffOrder, schedulePreview };
    }
  }

  if (months >= MAX_MONTHS) {
    return { monthsToDebtFree: Infinity, debtFreeISO: null, totalInterest: Infinity, payoffOrder, schedulePreview };
  }

  return { monthsToDebtFree: months, debtFreeISO: addMonths(today, months), totalInterest, payoffOrder, schedulePreview };
}

/** ---------- normalization ---------- **/
const DEFAULTS = {
  version: 5,
  settings: {
    paycheckMonthly: 0,
    extraPoolMonthly: 0,
    strategy: "avalanche",
  },
  items: [],
};

function normalizeBill(raw) {
  const x = raw || {};
  const type = x.type === "controllable" ? "controllable" : "noncontrollable";
  const freq = ["monthly", "weekly", "biweekly", "quarterly", "yearly", "one_time"].includes(x.frequency) ? x.frequency : "monthly";
  const dueDate = String(x.dueDate || "").trim() || isoDate();
  const amount = Number(x.amount);
  const active = x.active !== false;

  const balance = Number(x.balance);
  const aprPct = Number(x.aprPct);
  const minPay = Number(x.minPay);
  const extraPay = Number(x.extraPay);

  return {
    id: String(x.id || uid()),
    name: String(x.name || "").trim(),
    type,
    frequency: freq,
    dueDate,
    amount: Number.isFinite(amount) ? amount : 0,
    active,
    notes: String(x.notes || ""),

    balance: Number.isFinite(balance) ? balance : 0,
    aprPct: Number.isFinite(aprPct) ? aprPct : 0,
    minPay: Number.isFinite(minPay) ? minPay : 0,
    extraPay: Number.isFinite(extraPay) ? extraPay : 0,

    createdAt: Number.isFinite(Number(x.createdAt)) ? Number(x.createdAt) : Date.now(),
  };
}

function normalizeState(saved) {
  const base = saved && typeof saved === "object" ? saved : {};
  const settings = base.settings && typeof base.settings === "object" ? base.settings : {};
  const items = Array.isArray(base.items) ? base.items : Array.isArray(base) ? base : [];

  return {
    version: 5,
    settings: {
      paycheckMonthly: Number.isFinite(Number(settings.paycheckMonthly)) ? Number(settings.paycheckMonthly) : 0,
      extraPoolMonthly: Number.isFinite(Number(settings.extraPoolMonthly)) ? Number(settings.extraPoolMonthly) : 0,
      strategy: settings.strategy === "snowball" ? "snowball" : "avalanche",
    },
    items: items.map(normalizeBill).filter((b) => b.name),
  };
}

/** ---------- tiny UI helpers ---------- **/
const ACCENT = "#3b82f6"; // electric blue
const panelStyle = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 16,
  boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
};

const cardStyle = {
  background: "rgba(255,255,255,0.035)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 16,
  boxShadow: "0 14px 45px rgba(0,0,0,0.28)",
};

const chip = (bg = "rgba(255,255,255,0.06)", border = "rgba(255,255,255,0.10)") => ({
  padding: "6px 10px",
  borderRadius: 999,
  background: bg,
  border: `1px solid ${border}`,
  fontSize: 12,
  color: "rgba(255,255,255,0.86)",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
});

/** ---------- component ---------- **/
export default function BillsPage() {
  const [state, setState] = useState(DEFAULTS);

  // form mode
  const [mode, setMode] = useState("add");
  const [editId, setEditId] = useState(null);

  // form fields
  const [name, setName] = useState("");
  const [type, setType] = useState("noncontrollable");
  const [frequency, setFrequency] = useState("monthly");
  const [dueDate, setDueDate] = useState(isoDate());
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  // controllable fields
  const [balance, setBalance] = useState("");
  const [aprPct, setAprPct] = useState("");
  const [minPay, setMinPay] = useState("");
  const [extraPay, setExtraPay] = useState("0");

  // list controls
  const [scope, setScope] = useState("active");
  const [tab, setTab] = useState("all");
  const [sortBy, setSortBy] = useState("due_asc");
  const [q, setQ] = useState("");

  // planner UI
  const [plannerOpen, setPlannerOpen] = useState(true);

  const [error, setError] = useState("");

  useEffect(() => {
    const savedRaw = safeParse(localStorage.getItem(LS_BILLS) || "null", null);
    const normalized = normalizeState(savedRaw);
    setState({ ...DEFAULTS, ...normalized });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_BILLS, JSON.stringify(state));
    } catch {}
  }, [state]);

  const items = state.items;

  function resetForm() {
    setMode("add");
    setEditId(null);
    setName("");
    setType("noncontrollable");
    setFrequency("monthly");
    setDueDate(isoDate());
    setAmount("");
    setNotes("");
    setBalance("");
    setAprPct("");
    setMinPay("");
    setExtraPay("0");
    setError("");
  }

  function startEdit(bill) {
    setMode("edit");
    setEditId(bill.id);
    setName(bill.name || "");
    setType(bill.type || "noncontrollable");
    setFrequency(bill.frequency || "monthly");
    setDueDate(bill.dueDate || isoDate());
    setAmount(String(Number.isFinite(Number(bill.amount)) ? bill.amount : ""));
    setNotes(bill.notes || "");
    setBalance(String(Number.isFinite(Number(bill.balance)) ? bill.balance : ""));
    setAprPct(String(Number.isFinite(Number(bill.aprPct)) ? bill.aprPct : ""));
    setMinPay(String(Number.isFinite(Number(bill.minPay)) ? bill.minPay : ""));
    setExtraPay(String(Number.isFinite(Number(bill.extraPay)) ? bill.extraPay : "0"));
    setError("");
  }

  function upsertBill(e) {
    e.preventDefault();
    setError("");

    const nm = String(name || "").trim();
    const dd = String(dueDate || "").trim();
    const amt = parseMoneyInput(amount);

    if (!nm) return setError("Name is required.");
    if (!dd) return setError("Due date is required.");

    if (type === "noncontrollable") {
      if (!Number.isFinite(amt) || amt <= 0) return setError("Amount must be > 0 for non-controllable bills.");
    }

    const bbal = parseMoneyInput(balance);
    const aapr = parseMoneyInput(aprPct);
    const mmin = parseMoneyInput(minPay);
    const xtra = parseMoneyInput(extraPay);

    if (type === "controllable") {
      if (!Number.isFinite(bbal) || bbal < 0) return setError("Balance must be a number (0 or more).");
      if (!Number.isFinite(aapr) || aapr < 0 || aapr > 100) return setError("APR must be between 0 and 100.");
      if (!Number.isFinite(mmin) || mmin < 0) return setError("Minimum payment must be 0 or more.");
      if (!Number.isFinite(xtra) || xtra < 0) return setError("Extra payment must be 0 or more.");
      if (bbal > 0 && (mmin + xtra) <= 0) return setError("Set a minimum payment or extra payment > 0.");
    }

    const payload = normalizeBill({
      id: mode === "edit" ? editId : uid(),
      name: nm,
      type,
      frequency,
      dueDate: dd,
      amount: type === "noncontrollable" ? amt : Number.isFinite(amt) && amt > 0 ? amt : 0,
      notes,
      balance: type === "controllable" ? bbal : 0,
      aprPct: type === "controllable" ? aapr : 0,
      minPay: type === "controllable" ? mmin : 0,
      extraPay: type === "controllable" ? xtra : 0,
      createdAt: mode === "edit" ? (items.find((x) => x.id === editId)?.createdAt ?? Date.now()) : Date.now(),
      active: true,
    });

    setState((prev) => {
      const exists = prev.items.some((x) => x.id === payload.id);
      const nextItems = exists ? prev.items.map((x) => (x.id === payload.id ? { ...x, ...payload } : x)) : [payload, ...prev.items];
      return { ...prev, items: nextItems };
    });

    resetForm();
  }

  function toggleActive(id) {
    setState((prev) => ({ ...prev, items: prev.items.map((x) => (x.id === id ? { ...x, active: !x.active } : x)) }));
  }

  function removeBill(id) {
    if (!confirm("Delete this item permanently?")) return;
    setState((prev) => ({ ...prev, items: prev.items.filter((x) => x.id !== id) }));
  }

  function setExtraFor(id, nextExtra) {
    setState((prev) => ({
      ...prev,
      items: prev.items.map((x) => (x.id === id ? { ...x, extraPay: Math.max(0, Number(nextExtra) || 0) } : x)),
    }));
  }

  const computed = useMemo(() => {
    const today = isoDate();
    const query = String(q || "").trim().toLowerCase();

    let list = items.slice();
    if (scope === "active") list = list.filter((x) => x.active);
    if (scope === "inactive") list = list.filter((x) => !x.active);

    if (tab === "controllable") list = list.filter((x) => x.type === "controllable");
    if (tab === "noncontrollable") list = list.filter((x) => x.type === "noncontrollable");

    if (query) list = list.filter((x) => `${x.name} ${x.notes || ""}`.toLowerCase().includes(query));

    const withDerived = list.map((x) => {
      const isControl = x.type === "controllable";
      const totalPay = isControl ? (Number(x.minPay) || 0) + (Number(x.extraPay) || 0) : 0;
      const est = isControl
        ? payoffEstimateDetailed({ balance: x.balance, aprPct: x.aprPct, monthlyPay: totalPay, startISO: today })
        : { months: null, payoffISO: null, totalInterest: 0, totalPaid: 0 };

      return { ...x, totalPay, payoffMonths: est.months, payoffISO: est.payoffISO, payoffInterest: est.totalInterest };
    });

    withDerived.sort((a, b) => {
      if (sortBy === "due_asc") return String(a.dueDate).localeCompare(String(b.dueDate));
      if (sortBy === "amt_desc") return (Number(b.amount) || 0) - (Number(a.amount) || 0);
      if (sortBy === "name_asc") return String(a.name).localeCompare(String(b.name));
      if (sortBy === "payoff_asc") {
        const am = a.payoffMonths;
        const bm = b.payoffMonths;
        const aVal = am === Infinity ? Number.POSITIVE_INFINITY : Number.isFinite(am) ? am : Number.POSITIVE_INFINITY;
        const bVal = bm === Infinity ? Number.POSITIVE_INFINITY : Number.isFinite(bm) ? bm : Number.POSITIVE_INFINITY;
        return aVal - bVal;
      }
      return 0;
    });

    const activeItems = items.filter((x) => x.active);
    const noncontrollableMonthly = activeItems.filter((x) => x.type === "noncontrollable").reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const controllableMin = activeItems.filter((x) => x.type === "controllable").reduce((s, x) => s + (Number(x.minPay) || 0), 0);
    const controllableExtra = activeItems.filter((x) => x.type === "controllable").reduce((s, x) => s + (Number(x.extraPay) || 0), 0);
    const controllableBalances = activeItems.filter((x) => x.type === "controllable").reduce((s, x) => s + (Number(x.balance) || 0), 0);

    const monthlyOutflow = noncontrollableMonthly + controllableMin + controllableExtra;

    const nextDue = activeItems
      .filter((x) => String(x.dueDate) >= today)
      .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))[0];

    const debts = activeItems
      .filter((x) => x.type === "controllable")
      .map((x) => ({ id: x.id, name: x.name, balance: x.balance, aprPct: x.aprPct, minPay: x.minPay }))
      .filter((d) => (Number(d.balance) || 0) > 0);

    const planner = planStrategy({
      debts,
      monthlyExtraPool: Number(state.settings.extraPoolMonthly) || 0,
      strategy: state.settings.strategy,
      startISO: today,
      previewMonths: 6,
    });

    const paycheckMonthly = Number(state.settings.paycheckMonthly) || 0;
    const pctIncome = paycheckMonthly > 0 ? (monthlyOutflow / paycheckMonthly) * 100 : null;

    return {
      today,
      list: withDerived,
      totals: { noncontrollableMonthly, controllableMin, controllableExtra, controllableBalances, monthlyOutflow, pctIncome },
      nextDue,
      planner,
    };
  }, [items, scope, tab, sortBy, q, state.settings.paycheckMonthly, state.settings.extraPoolMonthly, state.settings.strategy]);

  const hero = [
    { label: "Monthly outflow", value: money(computed.totals.monthlyOutflow), sub: computed.totals.pctIncome != null ? `${computed.totals.pctIncome.toFixed(1)}% of income` : "Set income to see %", tone: "accent" },
    { label: "Non-controllable", value: money(computed.totals.noncontrollableMonthly), sub: "Fixed bills baseline", tone: "neutral" },
    { label: "Controllable min", value: money(computed.totals.controllableMin), sub: "Minimums (debts)", tone: "neutral" },
    { label: "Total debt balance", value: money(computed.totals.controllableBalances), sub: computed.planner.monthsToDebtFree && computed.planner.monthsToDebtFree !== Infinity ? `Debt-free est: ${computed.planner.debtFreeISO}` : "Add debts to estimate", tone: "neutral" },
  ];

  return (
    <main className="container" style={{ paddingBottom: 24 }}>
      {/* TOP */}
      <header style={{ marginBottom: 16 }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Bills</div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "baseline" }}>
          <h1 style={{ margin: 0, letterSpacing: -0.5 }}>Bills & Debt Control</h1>
          <div style={chip("rgba(59,130,246,0.10)", "rgba(59,130,246,0.25)")}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: ACCENT, display: "inline-block" }} />
            Next due: <b style={{ color: "rgba(255,255,255,0.92)" }}>{computed.nextDue ? `${computed.nextDue.name} (${computed.nextDue.dueDate})` : "—"}</b>
          </div>
        </div>
        <div className="muted" style={{ marginTop: 6 }}>Track fixed bills + debts you can pay off. Sliders change payoff dates instantly.</div>
      </header>

      {/* HERO METRICS */}
      <div className="grid" style={{ gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginBottom: 16 }}>
        {hero.map((h) => (
          <div key={h.label} className="card" style={{ ...cardStyle, padding: 14 }}>
            <div className="muted" style={{ fontSize: 12 }}>{h.label}</div>
            <div style={{ fontWeight: 950, fontSize: 26, marginTop: 6, color: h.tone === "accent" ? ACCENT : "rgba(255,255,255,0.95)" }}>
              {h.value}
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{h.sub}</div>
          </div>
        ))}
      </div>

      {/* PLANNER */}
      <div className="card" style={{ ...panelStyle, padding: 14, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ fontWeight: 950 }}>Snowball / Avalanche Planner</div>
            <div className="muted" style={{ fontSize: 12 }}>Uses minimums + extra pool (separate from per-debt extras).</div>
          </div>
          <button className="btnGhost" type="button" onClick={() => setPlannerOpen((v) => !v)}>
            {plannerOpen ? "Hide" : "Show"}
          </button>
        </div>

        {plannerOpen ? (
          <>
            <div style={{ height: 10 }} />

            <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div className="muted" style={{ fontSize: 12, width: 140 }}>Strategy</div>
              <select
                className="input"
                value={state.settings.strategy}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    settings: { ...prev.settings, strategy: e.target.value === "snowball" ? "snowball" : "avalanche" },
                  }))
                }
                style={{ width: 240 }}
              >
                <option value="avalanche">Avalanche (highest APR first)</option>
                <option value="snowball">Snowball (lowest balance first)</option>
              </select>

              <div className="muted" style={{ fontSize: 12, width: 160 }}>Extra pool / month</div>
              <input
                className="input"
                inputMode="decimal"
                placeholder="e.g. 300"
                value={state.settings.extraPoolMonthly ? String(state.settings.extraPoolMonthly) : ""}
                onChange={(e) => {
                  const v = parseMoneyInput(e.target.value);
                  setState((prev) => ({
                    ...prev,
                    settings: { ...prev.settings, extraPoolMonthly: Number.isFinite(v) ? Math.max(0, v) : 0 },
                  }));
                }}
                style={{ width: 220 }}
              />

              <div className="muted" style={{ fontSize: 12 }}>
                Tip: Avalanche usually saves the most interest.
              </div>
            </div>

            <div style={{ height: 12 }} />

            {computed.planner.monthsToDebtFree === 0 ? (
              <div className="muted">No active controllable balances to plan.</div>
            ) : computed.planner.monthsToDebtFree === Infinity ? (
              <div className="card" style={{ ...cardStyle, padding: 12 }}>
                <div style={{ fontWeight: 950 }}>Planner can’t compute payoff</div>
                <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                  You have no payment capacity (minimums + extra pool = 0). Set minimum payments or add an extra pool.
                </div>
              </div>
            ) : (
              <div className="grid" style={{ gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
                <div className="card" style={{ ...cardStyle, padding: 12 }}>
                  <div className="muted" style={{ fontSize: 12 }}>Debt-free estimate</div>
                  <div style={{ fontWeight: 950, marginTop: 6, fontSize: 18 }}>
                    {computed.planner.debtFreeISO}{" "}
                    <span className="muted" style={{ fontSize: 12 }}>
                      ({computed.planner.monthsToDebtFree} {plural(computed.planner.monthsToDebtFree, "month")})
                    </span>
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                    Est. interest: <b style={{ color: "rgba(255,255,255,0.92)" }}>{money(computed.planner.totalInterest)}</b>
                  </div>
                </div>

                <div className="card" style={{ ...cardStyle, padding: 12 }}>
                  <div style={{ fontWeight: 950, marginBottom: 8 }}>Payoff order</div>
                  {computed.planner.payoffOrder.length === 0 ? (
                    <div className="muted" style={{ fontSize: 12 }}>No payoff order available.</div>
                  ) : (
                    <div className="grid" style={{ gap: 8 }}>
                      {computed.planner.payoffOrder.slice(0, 6).map((x, idx) => (
                        <div key={x.id} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                          <div style={{ fontWeight: 800 }}>{idx + 1}. {x.name}</div>
                          <div className="muted" style={{ fontSize: 12 }}>
                            <b style={{ color: "rgba(255,255,255,0.92)" }}>{x.paidOffISO}</b>
                          </div>
                        </div>
                      ))}
                      {computed.planner.payoffOrder.length > 6 ? (
                        <div className="muted" style={{ fontSize: 12 }}>+ {computed.planner.payoffOrder.length - 6} more…</div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* SETTINGS */}
      <div className="card" style={{ ...panelStyle, padding: 14, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ fontWeight: 950 }}>Settings</div>
          <div className="muted" style={{ fontSize: 12 }}>Optional. Used for “% of income”.</div>
        </div>
        <div style={{ height: 10 }} />
        <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div className="muted" style={{ fontSize: 12, width: 160 }}>Monthly income</div>
          <input
            className="input"
            style={{ width: 240 }}
            inputMode="decimal"
            placeholder="e.g. 6500"
            value={state.settings.paycheckMonthly ? String(state.settings.paycheckMonthly) : ""}
            onChange={(e) => {
              const v = parseMoneyInput(e.target.value);
              setState((prev) => ({
                ...prev,
                settings: { ...prev.settings, paycheckMonthly: Number.isFinite(v) ? Math.max(0, v) : 0 },
              }));
            }}
          />
        </div>
      </div>

      {/* ADD / EDIT */}
      <div className="card" style={{ ...panelStyle, padding: 14, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ fontWeight: 950 }}>{mode === "edit" ? "Edit item" : "Add item"}</div>
          {mode === "edit" ? (
            <button className="btnGhost" type="button" onClick={resetForm}>
              Cancel edit
            </button>
          ) : null}
        </div>

        <div style={{ height: 10 }} />

        <form onSubmit={upsertBill} className="grid" style={{ gap: 10 }}>
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <input
              className="input"
              placeholder="Name (Rent, Internet, Credit Card...)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ flex: 1, minWidth: 260 }}
            />

            <select className="input" value={type} onChange={(e) => setType(e.target.value)} style={{ width: 240 }}>
              <option value="noncontrollable">Non-controllable (fixed)</option>
              <option value="controllable">Controllable (debt)</option>
            </select>

            <select className="input" value={frequency} onChange={(e) => setFrequency(e.target.value)} style={{ width: 170 }}>
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-weekly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
              <option value="one_time">One-time</option>
            </select>

            <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ width: 180 }} />
          </div>

          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <input
              className="input"
              placeholder={type === "controllable" ? "Optional: current minimum due" : "Amount"}
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ width: 260 }}
            />
            <input className="input" placeholder="Notes (autopay/login/etc.)" value={notes} onChange={(e) => setNotes(e.target.value)} style={{ flex: 1, minWidth: 260 }} />
          </div>

          {type === "controllable" ? (
            <div className="card" style={{ ...cardStyle, padding: 12 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ fontWeight: 950 }}>Debt payoff details</div>
                <div style={chip("rgba(59,130,246,0.10)", "rgba(59,130,246,0.20)")}>
                  Total used = min + extra
                </div>
              </div>

              <div style={{ height: 10 }} />

              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <input className="input" placeholder="Balance" inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} style={{ width: 220 }} />
                <input className="input" placeholder="APR %" inputMode="decimal" value={aprPct} onChange={(e) => setAprPct(e.target.value)} style={{ width: 180 }} />
                <input className="input" placeholder="Minimum payment" inputMode="decimal" value={minPay} onChange={(e) => setMinPay(e.target.value)} style={{ width: 220 }} />
                <input className="input" placeholder="Extra payment" inputMode="decimal" value={extraPay} onChange={(e) => setExtraPay(e.target.value)} style={{ width: 220 }} />
              </div>

              <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
                If payoff shows “Never”, your total payment doesn’t cover interest.
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="card" style={{ ...cardStyle, padding: 12, border: `1px solid rgba(239,68,68,0.35)` }}>
              <div style={{ fontWeight: 950 }}>Fix this:</div>
              <div className="muted" style={{ marginTop: 6 }}>{error}</div>
            </div>
          ) : null}

          <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button className="btn" type="submit" style={{ background: ACCENT, border: "1px solid rgba(255,255,255,0.12)" }}>
              {mode === "edit" ? "Save changes" : "Add item"}
            </button>
            <button className="btnGhost" type="button" onClick={resetForm}>Clear</button>
            <div className="muted" style={{ fontSize: 12 }}>Pro move: deactivate instead of delete to keep history.</div>
          </div>
        </form>
      </div>

      {/* LIST */}
      <div className="card" style={{ ...panelStyle, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontWeight: 950 }}>Bills list</div>

          <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input className="input" placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 220 }} />

            <select className="input" value={tab} onChange={(e) => setTab(e.target.value)} style={{ width: 200 }}>
              <option value="all">All</option>
              <option value="noncontrollable">Non-controllable</option>
              <option value="controllable">Controllable</option>
            </select>

            <select className="input" value={scope} onChange={(e) => setScope(e.target.value)} style={{ width: 170 }}>
              <option value="active">Active</option>
              <option value="all">All</option>
              <option value="inactive">Inactive</option>
            </select>

            <select className="input" value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ width: 200 }}>
              <option value="due_asc">Due date</option>
              <option value="amt_desc">Amount</option>
              <option value="name_asc">Name</option>
              <option value="payoff_asc">Payoff</option>
            </select>
          </div>
        </div>

        <div style={{ height: 12 }} />

        {computed.list.length === 0 ? (
          <div className="muted">No items match your filters.</div>
        ) : (
          <div className="grid" style={{ gap: 10 }}>
            {computed.list.map((b) => {
              const isControl = b.type === "controllable";
              const dueIn = daysBetween(computed.today, b.dueDate);

              const payoffLabel = (() => {
                if (!isControl) return null;
                const bal = Number(b.balance) || 0;
                const pay = Number(b.totalPay) || 0;
                if (bal <= 0) return "Paid off";
                if (pay <= 0) return "No payment set";
                if (b.payoffMonths === Infinity) return "Never (payment too low)";
                if (Number.isFinite(b.payoffMonths) && b.payoffISO) return `${b.payoffISO} (${b.payoffMonths} ${plural(b.payoffMonths, "month")})`;
                return "Estimate unavailable";
              })();

              const min = Math.max(0, Number(b.minPay) || 0);
              const extra = Math.max(0, Number(b.extraPay) || 0);
              const bal = Math.max(0, Number(b.balance) || 0);
              const sliderMax = isControl ? Math.ceil(Math.max(500, min * 2, bal * 0.1)) : 0;

              const badge = isControl
                ? chip("rgba(59,130,246,0.08)", "rgba(59,130,246,0.22)")
                : chip("rgba(255,255,255,0.06)", "rgba(255,255,255,0.10)");

              return (
                <div key={b.id} className="card" style={{ ...cardStyle, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div style={{ minWidth: 280, flex: 1 }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 950, fontSize: 16 }}>{b.name}</div>
                        <div style={badge}>
                          <span style={{ width: 7, height: 7, borderRadius: 99, background: isControl ? ACCENT : "rgba(255,255,255,0.45)", display: "inline-block" }} />
                          {b.active ? "Active" : "Inactive"} • {isControl ? "Controllable" : "Non-controllable"} • {b.frequency}
                        </div>
                      </div>

                      <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                        Due <b style={{ color: "rgba(255,255,255,0.92)" }}>{b.dueDate}</b>
                        {Number.isFinite(dueIn) ? ` (${dueIn >= 0 ? `in ${dueIn}d` : `${Math.abs(dueIn)}d late`})` : ""}
                        {" • "}
                        {isControl ? (
                          <>
                            Balance {money(b.balance)} • Min {money(b.minPay)} • Extra {money(b.extraPay)} • Total{" "}
                            <b style={{ color: "rgba(255,255,255,0.92)" }}>{money(b.totalPay)}</b> • APR {clamp(b.aprPct, 0, 100)}%
                          </>
                        ) : (
                          <>Amount <b style={{ color: "rgba(255,255,255,0.92)" }}>{money(b.amount)}</b></>
                        )}
                      </div>

                      {isControl ? (
                        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                          Payoff: <b style={{ color: "rgba(255,255,255,0.92)" }}>{payoffLabel}</b>
                          {" • "}
                          Est. interest: <b style={{ color: "rgba(255,255,255,0.92)" }}>{money(b.payoffInterest)}</b>
                        </div>
                      ) : null}

                      {b.notes ? (
                        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                          Notes: {b.notes}
                        </div>
                      ) : null}

                      {isControl ? (
                        <div className="card" style={{ ...panelStyle, padding: 12, marginTop: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                            <div style={{ fontWeight: 900 }}>Extra payment slider</div>
                            <div className="muted" style={{ fontSize: 12 }}>Drag to see payoff change.</div>
                          </div>

                          <div style={{ height: 10 }} />

                          <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                            <div className="muted" style={{ fontSize: 12, width: 90 }}>Extra</div>

                            <input
                              className="input"
                              type="range"
                              min={0}
                              max={sliderMax}
                              step={5}
                              value={extra}
                              onChange={(e) => setExtraFor(b.id, e.target.value)}
                              style={{ flex: 1, minWidth: 220, accentColor: ACCENT }}
                            />

                            <input
                              className="input"
                              inputMode="decimal"
                              value={String(extra)}
                              onChange={(e) => setExtraFor(b.id, parseMoneyInput(e.target.value))}
                              style={{ width: 140 }}
                            />

                            <button className="btnGhost" type="button" onClick={() => setExtraFor(b.id, 0)}>
                              Reset
                            </button>
                          </div>

                          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                            Slider max auto-scales. Total payment used = min + extra.
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                      <button className="btnGhost" type="button" onClick={() => startEdit(b)}>Edit</button>
                      <button className="btnGhost" type="button" onClick={() => toggleActive(b.id)}>
                        {b.active ? "Deactivate" : "Activate"}
                      </button>
                      <button className="btnGhost" type="button" onClick={() => removeBill(b.id)}>Delete</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="muted" style={{ fontSize: 12, marginTop: 14 }}>
        Estimates are simplified (monthly interest, no fees). Real payoff may differ.
      </div>
    </main>
  );
}
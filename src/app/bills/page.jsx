"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

function addDays(iso, daysToAdd) {
  if (!iso) return "";
  const [y, m, d] = String(iso).split("-").map((x) => Number(x));
  if (![y, m, d].every(Number.isFinite)) return "";
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + Number(daysToAdd || 0));
  return isoDate(dt);
}

function nextDueDateFromFrequency(currentISO, frequency) {
  const base = currentISO || isoDate();
  switch (frequency) {
    case "weekly":
      return addDays(base, 7);
    case "biweekly":
      return addDays(base, 14);
    case "quarterly":
      return addMonths(base, 3);
    case "yearly":
      return addMonths(base, 12);
    case "one_time":
      return base;
    case "monthly":
    default:
      return addMonths(base, 1);
  }
}

function daysBetween(fromISO, toISO) {
  if (!fromISO || !toISO) return null;
  const a = new Date(String(fromISO) + "T00:00:00");
  const b = new Date(String(toISO) + "T00:00:00");
  const t = b.getTime() - a.getTime();
  if (!Number.isFinite(t)) return null;
  return Math.round(t / 86400000);
}

function plural(n, s) {
  return n === 1 ? s : `${s}s`;
}

function freqToMonthlyMult(freq) {
  switch (freq) {
    case "weekly":
      return 4.333;
    case "biweekly":
      return 2.167;
    case "quarterly":
      return 1 / 3;
    case "yearly":
      return 1 / 12;
    case "one_time":
      return 0;
    case "monthly":
    default:
      return 1;
  }
}

function safeNum(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function fmtWhen(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function typeLabel(type) {
  return type === "controllable" ? "Debt" : "Bill";
}

function accountTypeLabel(t) {
  const v = String(t || "other").toLowerCase();
  if (v === "checking") return "Checking";
  if (v === "savings") return "Savings";
  if (v === "cash") return "Cash";
  if (v === "credit") return "Credit Card";
  if (v === "investment") return "Investment";
  return "Other";
}

function accountIcon(type) {
  const t = String(type || "other").toLowerCase();
  if (t === "checking") return "🏦";
  if (t === "savings") return "💰";
  if (t === "cash") return "💵";
  if (t === "credit") return "💳";
  if (t === "investment") return "📈";
  return "📁";
}

/**
 * Payoff estimator (single debt) with monthly simulation.
 * Returns { months, payoffISO, totalInterest, totalPaid }.
 */
function payoffEstimateDetailed({ balance, aprPct, monthlyPay, startISO }) {
  const bal0 = Number(balance);
  const pmt = Number(monthlyPay);
  const apr = Number(aprPct);

  if (!Number.isFinite(bal0) || bal0 <= 0) {
    return { months: null, payoffISO: null, totalInterest: 0, totalPaid: 0 };
  }
  if (!Number.isFinite(pmt) || pmt <= 0) {
    return { months: null, payoffISO: null, totalInterest: 0, totalPaid: 0 };
  }

  const start = startISO || isoDate();

  if (!Number.isFinite(apr) || apr <= 0) {
    const months = Math.ceil(bal0 / pmt);
    const totalPaid = months * pmt;
    const totalInterest = Math.max(0, totalPaid - bal0);
    return {
      months,
      payoffISO: addMonths(start, months),
      totalInterest,
      totalPaid,
    };
  }

  const r = apr / 100 / 12;
  const firstInterest = bal0 * r;
  if (pmt <= firstInterest + 0.01) {
    return {
      months: Infinity,
      payoffISO: null,
      totalInterest: Infinity,
      totalPaid: Infinity,
    };
  }

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

    if (!Number.isFinite(bal)) {
      return { months: null, payoffISO: null, totalInterest: 0, totalPaid: 0 };
    }
    if (bal < 0) bal = 0;
  }

  if (months >= 2000) {
    return {
      months: Infinity,
      payoffISO: null,
      totalInterest: Infinity,
      totalPaid: Infinity,
    };
  }

  return {
    months,
    payoffISO: addMonths(start, months),
    totalInterest,
    totalPaid,
  };
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
    return {
      monthsToDebtFree: 0,
      debtFreeISO: today,
      totalInterest: 0,
      payoffOrder: [],
      schedulePreview: [],
    };
  }

  const totalMin = ds.reduce((s, d) => s + d.minPay, 0);
  const capacity = totalMin + pool;
  if (capacity <= 0) {
    return {
      monthsToDebtFree: Infinity,
      debtFreeISO: null,
      totalInterest: Infinity,
      payoffOrder: [],
      schedulePreview: [],
    };
  }

  let months = 0;
  let totalInterest = 0;
  const payoffOrder = [];
  const schedulePreview = [];

  function pickFocus(remaining) {
    const list = remaining.slice();
    if (strategy === "snowball") {
      list.sort((a, b) => a.balance - b.balance || b.aprPct - a.aprPct);
    } else {
      list.sort((a, b) => b.aprPct - a.aprPct || a.balance - b.balance);
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

    for (const d of remaining) {
      const r = d.aprPct / 100 / 12;
      const interest = d.balance * r;
      d.balance += interest;
      totalInterest += interest;
    }

    for (const d of remaining) {
      const pay = Math.min(d.minPay, d.balance);
      d.balance -= pay;
    }

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

    for (const d of ds) {
      if (d.balance === 0 && !payoffOrder.some((x) => x.id === d.id)) {
        payoffOrder.push({
          id: d.id,
          name: d.name,
          months: months + 1,
          paidOffISO: addMonths(today, months + 1),
        });
      }
    }

    months += 1;

    if (!Number.isFinite(totalInterest)) {
      return {
        monthsToDebtFree: Infinity,
        debtFreeISO: null,
        totalInterest: Infinity,
        payoffOrder,
        schedulePreview,
      };
    }
  }

  if (months >= MAX_MONTHS) {
    return {
      monthsToDebtFree: Infinity,
      debtFreeISO: null,
      totalInterest: Infinity,
      payoffOrder,
      schedulePreview,
    };
  }

  return {
    monthsToDebtFree: months,
    debtFreeISO: addMonths(today, months),
    totalInterest,
    payoffOrder,
    schedulePreview,
  };
}

/** ---------- normalization ---------- **/
const DEFAULTS = {
  version: 6,
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
  const freq = ["monthly", "weekly", "biweekly", "quarterly", "yearly", "one_time"].includes(x.frequency)
    ? x.frequency
    : "monthly";
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
    lastPaidDate: String(x.lastPaidDate || "").trim(),
    autopay: x.autopay === true,
    category: String(x.category || "").trim(),
    accountId: String(x.accountId || "").trim(),
    createdAt: Number.isFinite(Number(x.createdAt)) ? Number(x.createdAt) : Date.now(),
  };
}

function normalizeState(saved) {
  const base = saved && typeof saved === "object" ? saved : {};
  const settings = base.settings && typeof base.settings === "object" ? base.settings : {};
  const items = Array.isArray(base.items) ? base.items : Array.isArray(base) ? base : [];

  return {
    version: 6,
    settings: {
      paycheckMonthly: Number.isFinite(Number(settings.paycheckMonthly))
        ? Number(settings.paycheckMonthly)
        : 0,
      extraPoolMonthly: Number.isFinite(Number(settings.extraPoolMonthly))
        ? Number(settings.extraPoolMonthly)
        : 0,
      strategy: settings.strategy === "snowball" ? "snowball" : "avalanche",
    },
    items: items.map(normalizeBill).filter((b) => b.name),
  };
}

/** ---------- db mapping ---------- **/
function mapRowToBill(row) {
  return normalizeBill({
    id: row.id,
    name: row.name,
    type: row.type,
    frequency: row.frequency,
    dueDate: row.due_date,
    amount: row.amount,
    active: row.active,
    notes: row.notes,
    balance: row.balance,
    aprPct: row.apr_pct,
    minPay: row.min_pay,
    extraPay: row.extra_pay,
    lastPaidDate: row.last_paid_date,
    autopay: row.autopay,
    category: row.category,
    accountId: row.account_id,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  });
}

function mapBillToRow(bill, userId) {
  return {
    id: bill.id,
    user_id: userId,
    name: bill.name,
    type: bill.type,
    frequency: bill.frequency,
    due_date: bill.dueDate || null,
    amount: Number(bill.amount) || 0,
    active: bill.active !== false,
    notes: bill.notes || "",
    balance: Number(bill.balance) || 0,
    apr_pct: Number(bill.aprPct) || 0,
    min_pay: Number(bill.minPay) || 0,
    extra_pay: Number(bill.extraPay) || 0,
    last_paid_date: bill.lastPaidDate || null,
    autopay: bill.autopay === true,
    category: bill.category || "",
    account_id: bill.accountId || null,
    created_at: bill.createdAt ? new Date(bill.createdAt).toISOString() : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function mapSettingsToRow(settings, userId) {
  return {
    user_id: userId,
    paycheck_monthly: Number(settings.paycheckMonthly) || 0,
    extra_pool_monthly: Number(settings.extraPoolMonthly) || 0,
    strategy: settings.strategy === "snowball" ? "snowball" : "avalanche",
    updated_at: new Date().toISOString(),
  };
}

function mapAccountRowToClient(row) {
  return {
    id: row.id,
    name: row.name || "",
    type: row.account_type || "other",
    balance: safeNum(row.balance, 0),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
  };
}

function mapTxnRowToClient(row) {
  return {
    id: row.id,
    accountId: row.account_id,
    ts: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    kind: row.kind || "transaction",
    amount: safeNum(row.amount, 0),
    delta: safeNum(row.delta, 0),
    resultingBalance: safeNum(row.resulting_balance, 0),
    note: row.note || "",
    relatedAccountId: row.related_account_id || "",
    relatedAccountName: row.related_account_name || "",
    sourceType: row.source_type || "",
    sourceId: row.source_id || "",
  };
}

function mapTxnClientToRow(txn, userId) {
  return {
    id: txn.id,
    user_id: userId,
    account_id: txn.accountId,
    kind: txn.kind || "transaction",
    amount: safeNum(txn.amount, 0),
    delta: safeNum(txn.delta, 0),
    resulting_balance: safeNum(txn.resultingBalance, 0),
    note: txn.note || "",
    related_account_id: txn.relatedAccountId || null,
    related_account_name: txn.relatedAccountName || "",
    source_type: txn.sourceType || "",
    source_id: txn.sourceId || "",
    created_at: new Date(txn.ts || Date.now()).toISOString(),
  };
}

/** ---------- tiny UI helpers ---------- **/
const ACCENT = "#60a5fa";
const GOOD = "#34d399";
const WARN = "#f59e0b";
const BAD = "#f87171";

const panelStyle = {
  background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.025))",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 22,
  boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
  backdropFilter: "blur(12px)",
};

const cardStyle = {
  background: "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.025))",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 20,
  boxShadow: "0 16px 45px rgba(0,0,0,0.28)",
  backdropFilter: "blur(10px)",
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

function ProgressBar({
  label,
  value,
  sublabel,
  pct = 0,
  color = ACCENT,
  danger = false,
}) {
  const safePct = clamp(pct, 0, 100);

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
        <div className="muted" style={{ fontSize: 12 }}>{label}</div>
        <div style={{ fontWeight: 900 }}>{value}</div>
      </div>

      <div
        style={{
          height: 10,
          borderRadius: 999,
          overflow: "hidden",
          background: danger ? "rgba(248,113,113,0.10)" : "rgba(255,255,255,0.06)",
          border: `1px solid ${danger ? "rgba(248,113,113,0.18)" : "rgba(255,255,255,0.08)"}`,
        }}
      >
        <div
          style={{
            width: `${safePct}%`,
            height: "100%",
            borderRadius: 999,
            background: `linear-gradient(90deg, ${color}, rgba(255,255,255,0.9))`,
            boxShadow: `0 0 20px ${color}55`,
            transition: "width 180ms ease",
          }}
        />
      </div>

      {sublabel ? (
        <div className="muted" style={{ fontSize: 12 }}>
          {sublabel}
        </div>
      ) : null}
    </div>
  );
}

function dueUrgencyPct(dueIn) {
  if (!Number.isFinite(dueIn)) return 0;
  if (dueIn <= 0) return 100;
  if (dueIn >= 30) return 8;
  return clamp(((30 - dueIn) / 30) * 100, 8, 100);
}

function payoffSpeedPct(months) {
  if (months === Infinity || months == null) return 6;
  if (months <= 3) return 100;
  if (months <= 6) return 88;
  if (months <= 12) return 72;
  if (months <= 24) return 52;
  if (months <= 36) return 34;
  return 18;
}

function paymentStrengthPct(balance, totalPay) {
  const bal = Math.max(0, Number(balance) || 0);
  const pay = Math.max(0, Number(totalPay) || 0);
  if (bal <= 0) return 100;
  return clamp((pay / bal) * 100 * 12, 4, 100);
}

function incomePressurePct(monthlyOutflow, income) {
  const out = Math.max(0, Number(monthlyOutflow) || 0);
  const inc = Math.max(0, Number(income) || 0);
  if (inc <= 0) return 0;
  return clamp((out / inc) * 100, 0, 100);
}

function Modal({ open, title, subtitle, onClose, children }) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(2,6,23,.72)",
        backdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        className="card"
        style={{
          width: "min(760px, 100%)",
          padding: 16,
          borderRadius: 22,
          border: "1px solid rgba(255,255,255,.08)",
          boxShadow: "0 20px 80px rgba(0,0,0,.45)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 18 }}>{title}</div>
            {subtitle ? (
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                {subtitle}
              </div>
            ) : null}
          </div>

          <button className="btnGhost" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div style={{ height: 14 }} />
        {children}
      </div>
    </div>
  );
}

/** ---------- component ---------- **/
export default function BillsPage() {
  const [state, setState] = useState(DEFAULTS);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const extraSaveTimers = useRef({});

  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [primaryAccountId, setPrimaryAccountId] = useState("");

  const [mode, setMode] = useState("add");
  const [editId, setEditId] = useState(null);

  const [name, setName] = useState("");
  const [type, setType] = useState("noncontrollable");
  const [frequency, setFrequency] = useState("monthly");
  const [dueDate, setDueDate] = useState(isoDate());
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  const [balance, setBalance] = useState("");
  const [aprPct, setAprPct] = useState("");
  const [minPay, setMinPay] = useState("");
  const [extraPay, setExtraPay] = useState("0");
  const [autopay, setAutopay] = useState(false);
  const [category, setCategory] = useState("");
  const [linkedAccountId, setLinkedAccountId] = useState("");

  const [scope, setScope] = useState("active");
  const [tab, setTab] = useState("all");
  const [sortBy, setSortBy] = useState("due_asc");
  const [q, setQ] = useState("");

  const [plannerOpen, setPlannerOpen] = useState(true);
  const [error, setError] = useState("");

  const [historyOpenId, setHistoryOpenId] = useState("");
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payingBillId, setPayingBillId] = useState("");
  const [payFromAccountId, setPayFromAccountId] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        if (!supabase) {
          throw new Error("Supabase is not configured. Check your environment variables.");
        }

        const {
          data: { user: currentUser },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;
        if (!mounted) return;

        setUser(currentUser || null);

        if (!currentUser) {
          setState(DEFAULTS);
          setLoading(false);
          return;
        }

        const [billsRes, settingsRes, accountsRes, billSettingsRes, txnsRes] = await Promise.all([
          supabase
            .from("bills")
            .select("*")
            .eq("user_id", currentUser.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("bill_settings")
            .select("*")
            .eq("user_id", currentUser.id)
            .maybeSingle(),
          supabase
            .from("accounts")
            .select("*")
            .eq("user_id", currentUser.id)
            .order("updated_at", { ascending: false }),
          supabase
            .from("account_settings")
            .select("*")
            .eq("user_id", currentUser.id)
            .maybeSingle(),
          supabase
            .from("account_transactions")
            .select("*")
            .eq("user_id", currentUser.id)
            .order("created_at", { ascending: false }),
        ]);

        if (billsRes.error) throw billsRes.error;
        if (settingsRes.error) throw settingsRes.error;
        if (accountsRes.error) throw accountsRes.error;
        if (billSettingsRes.error) throw billSettingsRes.error;
        if (txnsRes.error) throw txnsRes.error;

        const bills = (billsRes.data || []).map(mapRowToBill);
        const settingsRow = settingsRes.data;
        const loadedAccounts = (accountsRes.data || []).map(mapAccountRowToClient);
        const loadedTxns = (txnsRes.data || []).map(mapTxnRowToClient);

        const nextState = normalizeState({
          version: 6,
          settings: {
            paycheckMonthly: settingsRow?.paycheck_monthly ?? 0,
            extraPoolMonthly: settingsRow?.extra_pool_monthly ?? 0,
            strategy: settingsRow?.strategy === "snowball" ? "snowball" : "avalanche",
          },
          items: bills,
        });

        if (!mounted) return;

        setState(nextState);
        setAccounts(loadedAccounts);
        setTransactions(loadedTxns);
        setPrimaryAccountId(billSettingsRes.data?.primary_account_id || loadedAccounts[0]?.id || "");
        setPageError("");
      } catch (err) {
        if (!mounted) return;
        setPageError(err?.message || "Failed to load bills.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    bootstrap();

    return () => {
      mounted = false;
      Object.values(extraSaveTimers.current).forEach((t) => clearTimeout(t));
    };
  }, []);

  async function saveSettings(nextSettings) {
    if (!user || !supabase) return;

    const { error: saveErr } = await supabase
      .from("bill_settings")
      .upsert(mapSettingsToRow(nextSettings, user.id), { onConflict: "user_id" });

    if (saveErr) {
      setPageError(saveErr.message || "Failed to save settings.");
    }
  }

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
    setAutopay(false);
    setCategory("");
    setLinkedAccountId("");
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
    setAutopay(bill.autopay === true);
    setCategory(bill.category || "");
    setLinkedAccountId(bill.accountId || "");
    setError("");
  }

  async function upsertBill(e) {
    e.preventDefault();
    setError("");
    setPageError("");

    if (!user || !supabase) {
      setError("You must be logged in.");
      return;
    }

    const nm = String(name || "").trim();
    const dd = String(dueDate || "").trim();
    const amt = parseMoneyInput(amount);

    if (!nm) return setError("Name is required.");
    if (!dd) return setError("Due date is required.");

    if (type === "noncontrollable") {
      if (!Number.isFinite(amt) || amt <= 0) {
        return setError("Amount must be > 0 for non-controllable bills.");
      }
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
      if (bbal > 0 && mmin + xtra <= 0) return setError("Set a minimum payment or extra payment > 0.");
    }

    const existingCreatedAt =
      mode === "edit" ? state.items.find((x) => x.id === editId)?.createdAt ?? Date.now() : Date.now();

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
      lastPaidDate: mode === "edit" ? state.items.find((x) => x.id === editId)?.lastPaidDate || "" : "",
      autopay,
      category,
      accountId: linkedAccountId || "",
      createdAt: existingCreatedAt,
      active: true,
    });

    const row = mapBillToRow(payload, user.id);

    const { data, error: saveErr } = await supabase
      .from("bills")
      .upsert(row)
      .select()
      .single();

    if (saveErr) {
      setError(saveErr.message || "Failed to save bill.");
      return;
    }

    const savedBill = mapRowToBill(data);

    setState((prev) => {
      const exists = prev.items.some((x) => x.id === savedBill.id);
      const nextItems = exists
        ? prev.items.map((x) => (x.id === savedBill.id ? savedBill : x))
        : [savedBill, ...prev.items];
      return { ...prev, items: nextItems };
    });

    resetForm();
  }

  async function toggleActive(id) {
    if (!user || !supabase) return;

    const current = state.items.find((x) => x.id === id);
    if (!current) return;

    const nextValue = !current.active;

    setState((prev) => ({
      ...prev,
      items: prev.items.map((x) => (x.id === id ? { ...x, active: nextValue } : x)),
    }));

    const { error: saveErr } = await supabase
      .from("bills")
      .update({
        active: nextValue,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (saveErr) {
      setState((prev) => ({
        ...prev,
        items: prev.items.map((x) => (x.id === id ? { ...x, active: current.active } : x)),
      }));
      setPageError(saveErr.message || "Failed to update bill.");
    }
  }

  async function toggleAutopay(id) {
    if (!user || !supabase) return;

    const current = state.items.find((x) => x.id === id);
    if (!current) return;

    const nextValue = !current.autopay;

    setState((prev) => ({
      ...prev,
      items: prev.items.map((x) => (x.id === id ? { ...x, autopay: nextValue } : x)),
    }));

    const { error: saveErr } = await supabase
      .from("bills")
      .update({
        autopay: nextValue,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (saveErr) {
      setState((prev) => ({
        ...prev,
        items: prev.items.map((x) => (x.id === id ? { ...x, autopay: current.autopay } : x)),
      }));
      setPageError(saveErr.message || "Failed to update autopay.");
    }
  }

  async function removeBill(id) {
    if (!user || !supabase) return;
    if (!confirm("Delete this item permanently?")) return;

    const previous = state.items;
    setState((prev) => ({
      ...prev,
      items: prev.items.filter((x) => x.id !== id),
    }));

    const { error: delErr } = await supabase
      .from("bills")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (delErr) {
      setState((prev) => ({ ...prev, items: previous }));
      setPageError(delErr.message || "Failed to delete bill.");
    }
  }

  function setExtraFor(id, nextExtra) {
    const n = Number(nextExtra);
    const safeExtra = Math.max(0, Number.isFinite(n) ? n : 0);

    setState((prev) => ({
      ...prev,
      items: prev.items.map((x) => (x.id === id ? { ...x, extraPay: safeExtra } : x)),
    }));

    if (!user || !supabase) return;

    if (extraSaveTimers.current[id]) {
      clearTimeout(extraSaveTimers.current[id]);
    }

    extraSaveTimers.current[id] = setTimeout(async () => {
      const { error: saveErr } = await supabase
        .from("bills")
        .update({
          extra_pay: safeExtra,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", user.id);

      if (saveErr) {
        setPageError(saveErr.message || "Failed to save extra payment.");
      }
    }, 250);
  }

  async function createAccountTransaction(entry) {
    if (!user || !supabase) return { ok: false, error: "Missing user." };

    const { data, error } = await supabase
      .from("account_transactions")
      .insert([mapTxnClientToRow(entry, user.id)])
      .select()
      .single();

    if (error) return { ok: false, error: error.message || "Failed to save transaction." };

    setTransactions((prev) => [mapTxnRowToClient(data), ...prev]);
    return { ok: true };
  }

  async function saveAccountBalance(accountId, nextBalance) {
    if (!user || !supabase) return { ok: false, error: "Missing user." };

    const { data, error } = await supabase
      .from("accounts")
      .update({
        balance: safeNum(nextBalance, 0),
        updated_at: new Date().toISOString(),
      })
      .eq("id", accountId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) return { ok: false, error: error.message || "Failed to save account." };

    const saved = mapAccountRowToClient(data);
    setAccounts((prev) => prev.map((a) => (a.id === accountId ? saved : a)));
    return { ok: true, account: saved };
  }

  async function saveBillPatch(billId, patch) {
    if (!user || !supabase) return { ok: false, error: "Missing user." };

    const { data, error } = await supabase
      .from("bills")
      .update({
        ...patch,
        updated_at: new Date().toISOString(),
      })
      .eq("id", billId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) return { ok: false, error: error.message || "Failed to save bill." };

    const saved = mapRowToBill(data);
    setState((prev) => ({
      ...prev,
      items: prev.items.map((x) => (x.id === billId ? saved : x)),
    }));
    return { ok: true, bill: saved };
  }

  function openPayModal(bill) {
    const defaultAccount = bill.accountId || primaryAccountId || accounts[0]?.id || "";
    setPayingBillId(bill.id);
    setPayFromAccountId(defaultAccount);
    setPayAmount(String(
      bill.type === "controllable"
        ? Math.max(0, Number(bill.minPay) || Number(bill.amount) || 0)
        : Math.max(0, Number(bill.amount) || 0)
    ));
    setPayNote("");
    setPayModalOpen(true);
  }

  const payingBill = useMemo(
    () => state.items.find((x) => x.id === payingBillId) || null,
    [state.items, payingBillId]
  );

  async function payBillNow() {
    setPageError("");
    if (!payingBill) return;

    const account = accounts.find((a) => a.id === payFromAccountId);
    if (!account) {
      alert("Choose an account to pay from.");
      return;
    }

    const amt = parseMoneyInput(payAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      alert("Payment amount must be greater than 0.");
      return;
    }

    const accountCur = safeNum(account.balance, 0);
    const accountNext = accountCur - Math.abs(amt);

    const saveAccountRes = await saveAccountBalance(account.id, accountNext);
    if (!saveAccountRes.ok) {
      setPageError(saveAccountRes.error || "Failed to update account.");
      return;
    }

    const today = isoDate();
    const billPatch = {
      last_paid_date: today,
      account_id: account.id,
    };

    if (payingBill.frequency !== "one_time") {
      billPatch.due_date = nextDueDateFromFrequency(payingBill.dueDate || today, payingBill.frequency);
    }

    if (payingBill.type === "controllable") {
      billPatch.balance = Math.max(0, safeNum(payingBill.balance, 0) - Math.abs(amt));
    }

    const saveBillRes = await saveBillPatch(payingBill.id, billPatch);
    if (!saveBillRes.ok) {
      setPageError(saveBillRes.error || "Failed to update bill.");
      return;
    }

    const txnRes = await createAccountTransaction({
      id: uid(),
      ts: Date.now(),
      kind: "bill_payment",
      accountId: account.id,
      amount: Math.abs(amt),
      delta: -Math.abs(amt),
      resultingBalance: accountNext,
      note: payNote?.trim() || `${payingBill.name} payment`,
      relatedAccountId: "",
      relatedAccountName: "",
      sourceType: "bill",
      sourceId: payingBill.id,
    });

    if (!txnRes.ok) {
      setPageError(txnRes.error || "Failed to save payment transaction.");
      return;
    }

    setPayModalOpen(false);
    setPayingBillId("");
    setPayFromAccountId("");
    setPayAmount("");
    setPayNote("");
  }

  const computed = useMemo(() => {
    const today = isoDate();
    const query = String(q || "").trim().toLowerCase();

    let list = state.items.slice();
    if (scope === "active") list = list.filter((x) => x.active);
    if (scope === "inactive") list = list.filter((x) => !x.active);

    if (tab === "controllable") list = list.filter((x) => x.type === "controllable");
    if (tab === "noncontrollable") list = list.filter((x) => x.type === "noncontrollable");

    if (query) {
      list = list.filter((x) =>
        `${x.name} ${x.notes || ""} ${x.category || ""}`.toLowerCase().includes(query)
      );
    }

    const withDerived = list.map((x) => {
      const isControl = x.type === "controllable";
      const totalPay = isControl ? (Number(x.minPay) || 0) + (Number(x.extraPay) || 0) : 0;

      const est = isControl
        ? payoffEstimateDetailed({
            balance: x.balance,
            aprPct: x.aprPct,
            monthlyPay: totalPay,
            startISO: today,
          })
        : { months: null, payoffISO: null, totalInterest: 0, totalPaid: 0 };

      const dueIn = daysBetween(today, x.dueDate);

      const monthlyEquivalent =
        x.type === "noncontrollable"
          ? (Number(x.amount) || 0) * freqToMonthlyMult(x.frequency)
          : 0;

      const linkedAccount = accounts.find((a) => a.id === x.accountId) || null;
      const history = transactions
        .filter((t) => t.sourceType === "bill" && t.sourceId === x.id)
        .sort((a, b) => safeNum(b.ts, 0) - safeNum(a.ts, 0));

      return {
        ...x,
        totalPay,
        payoffMonths: est.months,
        payoffISO: est.payoffISO,
        payoffInterest: est.totalInterest,
        dueIn,
        monthlyEquivalent,
        linkedAccount,
        history,
      };
    });

    withDerived.sort((a, b) => {
      if (sortBy === "due_asc") {
        const ad = Number.isFinite(a.dueIn) ? a.dueIn : 999999;
        const bd = Number.isFinite(b.dueIn) ? b.dueIn : 999999;
        return ad - bd;
      }
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

    const activeItems = state.items.filter((x) => x.active);

    const noncontrollableMonthly = activeItems
      .filter((x) => x.type === "noncontrollable")
      .reduce((s, x) => s + (Number(x.amount) || 0) * freqToMonthlyMult(x.frequency), 0);

    const controllableMin = activeItems
      .filter((x) => x.type === "controllable")
      .reduce((s, x) => s + (Number(x.minPay) || 0), 0);

    const controllableExtra = activeItems
      .filter((x) => x.type === "controllable")
      .reduce((s, x) => s + (Number(x.extraPay) || 0), 0);

    const controllableBalances = activeItems
      .filter((x) => x.type === "controllable")
      .reduce((s, x) => s + (Number(x.balance) || 0), 0);

    const monthlyOutflow = noncontrollableMonthly + controllableMin + controllableExtra;

    const nextDue = activeItems
      .filter((x) => x.dueDate)
      .map((x) => ({ ...x, dueIn: daysBetween(today, x.dueDate) }))
      .filter((x) => x.dueIn != null)
      .sort((a, b) => a.dueIn - b.dueIn)[0];

    const debts = activeItems
      .filter((x) => x.type === "controllable")
      .map((x) => ({
        id: x.id,
        name: x.name,
        balance: x.balance,
        aprPct: x.aprPct,
        minPay: x.minPay,
      }))
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

    const upcoming = activeItems
      .map((x) => ({
        ...x,
        dueIn: daysBetween(today, x.dueDate),
      }))
      .filter((x) => Number.isFinite(x.dueIn))
      .sort((a, b) => a.dueIn - b.dueIn)
      .slice(0, 5);

    return {
      today,
      list: withDerived,
      totals: {
        noncontrollableMonthly,
        controllableMin,
        controllableExtra,
        controllableBalances,
        monthlyOutflow,
        pctIncome,
      },
      nextDue,
      planner,
      upcoming,
    };
  }, [
    state.items,
    scope,
    tab,
    sortBy,
    q,
    state.settings.paycheckMonthly,
    state.settings.extraPoolMonthly,
    state.settings.strategy,
    accounts,
    transactions,
  ]);

  const hero = [
    {
      label: "Monthly outflow",
      value: money(computed.totals.monthlyOutflow),
      sub: computed.totals.pctIncome != null ? `${computed.totals.pctIncome.toFixed(1)}% of income` : "Set income to see pressure",
      pct: incomePressurePct(computed.totals.monthlyOutflow, state.settings.paycheckMonthly),
      color: computed.totals.pctIncome != null && computed.totals.pctIncome >= 70 ? BAD : ACCENT,
    },
    {
      label: "Non-controllable",
      value: money(computed.totals.noncontrollableMonthly),
      sub: "Frequency-aware baseline",
      pct: computed.totals.monthlyOutflow > 0 ? (computed.totals.noncontrollableMonthly / computed.totals.monthlyOutflow) * 100 : 0,
      color: ACCENT,
    },
    {
      label: "Controllable min",
      value: money(computed.totals.controllableMin),
      sub: "Minimum debt payments",
      pct: computed.totals.monthlyOutflow > 0 ? (computed.totals.controllableMin / computed.totals.monthlyOutflow) * 100 : 0,
      color: WARN,
    },
    {
      label: "Total debt balance",
      value: money(computed.totals.controllableBalances),
      sub:
        computed.planner.monthsToDebtFree &&
        computed.planner.monthsToDebtFree !== Infinity
          ? `Debt-free est: ${computed.planner.debtFreeISO}`
          : "Add debts to estimate",
      pct: payoffSpeedPct(computed.planner.monthsToDebtFree),
      color: GOOD,
    },
  ];

  if (loading) {
    return (
      <main className="container" style={{ paddingBottom: 24 }}>
        <div className="card" style={{ ...panelStyle, padding: 16 }}>
          Loading bills...
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="container" style={{ paddingBottom: 24 }}>
        <div className="card" style={{ ...panelStyle, padding: 16 }}>
          <div style={{ fontWeight: 900 }}>Please log in</div>
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
        <div className="muted" style={{ fontSize: 12, marginBottom: 6, letterSpacing: ".08em", textTransform: "uppercase" }}>
          Bills
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            alignItems: "baseline",
          }}
        >
          <div>
            <h1 style={{ margin: 0, letterSpacing: -1, fontSize: "clamp(28px,4vw,42px)" }}>
              Bills & Debt Control
            </h1>
            <div className="muted" style={{ marginTop: 8 }}>
              Premium bill tracking with payoff planning, linked accounts, payment history, and real pay-bill actions.
            </div>
          </div>

          <div
            style={{
              ...chip("rgba(96,165,250,0.10)", "rgba(96,165,250,0.28)"),
              padding: "10px 12px",
              borderRadius: 14,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 99,
                background: ACCENT,
                display: "inline-block",
                boxShadow: `0 0 14px ${ACCENT}`,
              }}
            />
            Next due:{" "}
            <b style={{ color: "rgba(255,255,255,0.92)" }}>
              {computed.nextDue ? `${computed.nextDue.name} (${computed.nextDue.dueDate})` : "—"}
            </b>
          </div>
        </div>
      </header>

      {pageError ? (
        <div
          className="card"
          style={{
            ...cardStyle,
            padding: 12,
            marginBottom: 16,
            border: "1px solid rgba(239,68,68,0.35)",
            background: "linear-gradient(180deg, rgba(127,29,29,0.30), rgba(127,29,29,0.15))",
          }}
        >
          <div style={{ fontWeight: 950 }}>Database issue</div>
          <div className="muted" style={{ marginTop: 6 }}>
            {pageError}
          </div>
        </div>
      ) : null}

      <div
        className="grid"
        style={{
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          marginBottom: 16,
        }}
      >
        {hero.map((h) => (
          <div key={h.label} className="card" style={{ ...cardStyle, padding: 14 }}>
            <ProgressBar
              label={h.label}
              value={h.value}
              sublabel={h.sub}
              pct={h.pct}
              color={h.color}
              danger={h.color === BAD}
            />
          </div>
        ))}
      </div>

      <div
        className="grid"
        style={{
          gap: 16,
          gridTemplateColumns: "1.15fr .85fr",
          marginBottom: 16,
        }}
      >
        <div
          className="card"
          style={{
            ...panelStyle,
            padding: 16,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background:
                "radial-gradient(circle at top left, rgba(96,165,250,0.10), transparent 28%), radial-gradient(circle at bottom right, rgba(52,211,153,0.08), transparent 24%)",
            }}
          />

          <div style={{ position: "relative" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ fontWeight: 950, fontSize: 18 }}>Snowball / Avalanche Planner</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  Uses minimums + extra pool. Cleaner debt-free projection.
                </div>
              </div>
              <button className="btnGhost" type="button" onClick={() => setPlannerOpen((v) => !v)}>
                {plannerOpen ? "Hide" : "Show"}
              </button>
            </div>

            {plannerOpen ? (
              <>
                <div style={{ height: 12 }} />

                <div
                  className="row"
                  style={{
                    gap: 10,
                    flexWrap: "wrap",
                    alignItems: "center",
                    padding: 12,
                    borderRadius: 16,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div className="muted" style={{ fontSize: 12, width: 140 }}>
                    Strategy
                  </div>
                  <select
                    className="input"
                    value={state.settings.strategy}
                    onChange={async (e) => {
                      const nextSettings = {
                        ...state.settings,
                        strategy: e.target.value === "snowball" ? "snowball" : "avalanche",
                      };
                      setState((prev) => ({ ...prev, settings: nextSettings }));
                      await saveSettings(nextSettings);
                    }}
                    style={{ width: 260 }}
                  >
                    <option value="avalanche">Avalanche (highest APR first)</option>
                    <option value="snowball">Snowball (lowest balance first)</option>
                  </select>

                  <div className="muted" style={{ fontSize: 12, width: 160 }}>
                    Extra pool / month
                  </div>
                  <input
                    className="input"
                    inputMode="decimal"
                    placeholder="e.g. 300"
                    value={state.settings.extraPoolMonthly ? String(state.settings.extraPoolMonthly) : ""}
                    onChange={async (e) => {
                      const v = parseMoneyInput(e.target.value);
                      const nextSettings = {
                        ...state.settings,
                        extraPoolMonthly: Number.isFinite(v) ? Math.max(0, v) : 0,
                      };
                      setState((prev) => ({ ...prev, settings: nextSettings }));
                      await saveSettings(nextSettings);
                    }}
                    style={{ width: 220 }}
                  />
                </div>

                <div style={{ height: 12 }} />

                {computed.planner.monthsToDebtFree === 0 ? (
                  <div className="muted">No active controllable balances to plan.</div>
                ) : computed.planner.monthsToDebtFree === Infinity ? (
                  <div className="card" style={{ ...cardStyle, padding: 12 }}>
                    <div style={{ fontWeight: 950 }}>Planner can’t compute payoff</div>
                    <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                      You have no payment capacity. Set minimum payments or add an extra pool.
                    </div>
                  </div>
                ) : (
                  <div
                    className="grid"
                    style={{ gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}
                  >
                    <div className="card" style={{ ...cardStyle, padding: 14 }}>
                      <ProgressBar
                        label="Debt-free estimate"
                        value={`${computed.planner.debtFreeISO}`}
                        sublabel={`Estimated interest ${money(computed.planner.totalInterest)} • ${computed.planner.monthsToDebtFree} ${plural(computed.planner.monthsToDebtFree, "month")}`}
                        pct={payoffSpeedPct(computed.planner.monthsToDebtFree)}
                        color={GOOD}
                      />
                    </div>

                    <div className="card" style={{ ...cardStyle, padding: 14 }}>
                      <div style={{ fontWeight: 950, marginBottom: 10 }}>Payoff order</div>
                      {computed.planner.payoffOrder.length === 0 ? (
                        <div className="muted" style={{ fontSize: 12 }}>
                          No payoff order available.
                        </div>
                      ) : (
                        <div className="grid" style={{ gap: 10 }}>
                          {computed.planner.payoffOrder.slice(0, 6).map((x, idx) => (
                            <div
                              key={x.id}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 10,
                                padding: "10px 12px",
                                borderRadius: 14,
                                background: "rgba(255,255,255,0.03)",
                                border: "1px solid rgba(255,255,255,0.06)",
                              }}
                            >
                              <div style={{ fontWeight: 800 }}>
                                {idx + 1}. {x.name}
                              </div>
                              <div className="muted" style={{ fontSize: 12 }}>
                                <b style={{ color: "rgba(255,255,255,0.92)" }}>{x.paidOffISO}</b>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>

        <div className="card" style={{ ...panelStyle, padding: 16 }}>
          <div style={{ fontWeight: 950, fontSize: 18 }}>Upcoming bills</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            Quick timeline for the next few due dates.
          </div>

          <div style={{ height: 12 }} />

          {computed.upcoming.length === 0 ? (
            <div className="muted">No upcoming items.</div>
          ) : (
            <div className="grid" style={{ gap: 10 }}>
              {computed.upcoming.map((b) => (
                <div
                  key={b.id}
                  style={{
                    padding: "12px 12px",
                    borderRadius: 16,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 900 }}>{b.name}</div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                        {b.dueDate} • {b.type === "controllable" ? "Debt" : "Bill"}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 900 }}>
                        {money(b.type === "controllable" ? b.minPay || b.amount : b.amount)}
                      </div>
                      <div
                        className="muted"
                        style={{
                          fontSize: 12,
                          color: b.dueIn <= 3 ? BAD : b.dueIn <= 7 ? WARN : "rgba(255,255,255,0.72)",
                        }}
                      >
                        {b.dueIn >= 0 ? `in ${b.dueIn}d` : `${Math.abs(b.dueIn)}d late`}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ ...panelStyle, padding: 14, marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div style={{ fontWeight: 950 }}>Settings</div>
          <div className="muted" style={{ fontSize: 12 }}>
            Used for pressure bars and % of income.
          </div>
        </div>

        <div style={{ height: 10 }} />

        <div
          className="row"
          style={{
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
            padding: 12,
            borderRadius: 16,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="muted" style={{ fontSize: 12, width: 160 }}>
            Monthly income
          </div>
          <input
            className="input"
            style={{ width: 240 }}
            inputMode="decimal"
            placeholder="e.g. 6500"
            value={state.settings.paycheckMonthly ? String(state.settings.paycheckMonthly) : ""}
            onChange={async (e) => {
              const v = parseMoneyInput(e.target.value);
              const nextSettings = {
                ...state.settings,
                paycheckMonthly: Number.isFinite(v) ? Math.max(0, v) : 0,
              };
              setState((prev) => ({ ...prev, settings: nextSettings }));
              await saveSettings(nextSettings);
            }}
          />
        </div>
      </div>

      <div className="card" style={{ ...panelStyle, padding: 14, marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div style={{ fontWeight: 950, fontSize: 18 }}>{mode === "edit" ? "Edit item" : "Add item"}</div>
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

            <select
              className="input"
              value={type}
              onChange={(e) => setType(e.target.value)}
              style={{ width: 240 }}
            >
              <option value="noncontrollable">Non-controllable (fixed)</option>
              <option value="controllable">Controllable (debt)</option>
            </select>

            <select
              className="input"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              style={{ width: 170 }}
            >
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-weekly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
              <option value="one_time">One-time</option>
            </select>

            <input
              className="input"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={{ width: 180 }}
            />
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
            <input
              className="input"
              placeholder="Category (Housing, Utilities, Insurance...)"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{ width: 240 }}
            />
            <select
              className="input"
              value={linkedAccountId}
              onChange={(e) => setLinkedAccountId(e.target.value)}
              style={{ minWidth: 240, flex: 1 }}
            >
              <option value="">Linked account (optional)</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {accountIcon(a.type)} {a.name} — {accountTypeLabel(a.type)}
                </option>
              ))}
            </select>
          </div>

          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <input
              className="input"
              placeholder="Notes (autopay/login/etc.)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ flex: 1, minWidth: 260 }}
            />

            <label
              style={{
                ...chip("rgba(255,255,255,0.05)", "rgba(255,255,255,0.10)"),
                minHeight: 42,
                padding: "10px 12px",
              }}
            >
              <input
                type="checkbox"
                checked={autopay}
                onChange={(e) => setAutopay(e.target.checked)}
              />
              Autopay
            </label>
          </div>

          {type === "controllable" ? (
            <div
              className="card"
              style={{
                ...cardStyle,
                padding: 14,
                background:
                  "linear-gradient(180deg, rgba(96,165,250,0.10), rgba(255,255,255,0.025))",
              }}
            >
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ fontWeight: 950 }}>Debt payoff details</div>
                <div style={chip("rgba(96,165,250,0.10)", "rgba(96,165,250,0.20)")}>
                  Total used = min + extra
                </div>
              </div>

              <div style={{ height: 10 }} />

              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <input
                  className="input"
                  placeholder="Balance"
                  inputMode="decimal"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                  style={{ width: 220 }}
                />
                <input
                  className="input"
                  placeholder="APR %"
                  inputMode="decimal"
                  value={aprPct}
                  onChange={(e) => setAprPct(e.target.value)}
                  style={{ width: 180 }}
                />
                <input
                  className="input"
                  placeholder="Minimum payment"
                  inputMode="decimal"
                  value={minPay}
                  onChange={(e) => setMinPay(e.target.value)}
                  style={{ width: 220 }}
                />
                <input
                  className="input"
                  placeholder="Extra payment"
                  inputMode="decimal"
                  value={extraPay}
                  onChange={(e) => setExtraPay(e.target.value)}
                  style={{ width: 220 }}
                />
              </div>

              <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
                If payoff shows “Never”, your total payment does not beat monthly interest.
              </div>
            </div>
          ) : null}

          {error ? (
            <div
              className="card"
              style={{
                ...cardStyle,
                padding: 12,
                border: "1px solid rgba(239,68,68,0.35)",
                background: "linear-gradient(180deg, rgba(127,29,29,0.28), rgba(127,29,29,0.12))",
              }}
            >
              <div style={{ fontWeight: 950 }}>Fix this</div>
              <div className="muted" style={{ marginTop: 6 }}>
                {error}
              </div>
            </div>
          ) : null}

          <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button
              className="btn"
              type="submit"
              style={{ background: ACCENT, border: "1px solid rgba(255,255,255,0.12)" }}
            >
              {mode === "edit" ? "Save changes" : "Add item"}
            </button>
            <button className="btnGhost" type="button" onClick={resetForm}>
              Clear
            </button>
            <div className="muted" style={{ fontSize: 12 }}>
              Deactivate instead of delete if you want history.
            </div>
          </div>
        </form>
      </div>

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
          <div style={{ fontWeight: 950, fontSize: 18 }}>Bills list</div>

          <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input
              className="input"
              placeholder="Search..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ width: 220 }}
            />

            <select
              className="input"
              value={tab}
              onChange={(e) => setTab(e.target.value)}
              style={{ width: 200 }}
            >
              <option value="all">All</option>
              <option value="noncontrollable">Non-controllable</option>
              <option value="controllable">Controllable</option>
            </select>

            <select
              className="input"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              style={{ width: 170 }}
            >
              <option value="active">Active</option>
              <option value="all">All</option>
              <option value="inactive">Inactive</option>
            </select>

            <select
              className="input"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{ width: 200 }}
            >
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
          <div className="grid" style={{ gap: 12 }}>
            {computed.list.map((b) => {
              const isControl = b.type === "controllable";
              const dueIn = b.dueIn;

              const payoffLabel = (() => {
                if (!isControl) return null;
                const bal = Number(b.balance) || 0;
                const pay = Number(b.totalPay) || 0;
                if (bal <= 0) return "Paid off";
                if (pay <= 0) return "No payment set";
                if (b.payoffMonths === Infinity) return "Never (payment too low)";
                if (Number.isFinite(b.payoffMonths) && b.payoffISO) {
                  return `${b.payoffISO} (${b.payoffMonths} ${plural(b.payoffMonths, "month")})`;
                }
                return "Estimate unavailable";
              })();

              const min = Math.max(0, Number(b.minPay) || 0);
              const extra = Math.max(0, Number(b.extraPay) || 0);
              const bal = Math.max(0, Number(b.balance) || 0);

              const sliderMax = isControl
                ? Math.max(50, Math.min(2000, Math.ceil(Math.max(250, min * 3, bal * 0.05))))
                : 0;

              const badge = isControl
                ? chip("rgba(96,165,250,0.08)", "rgba(96,165,250,0.22)")
                : chip("rgba(255,255,255,0.06)", "rgba(255,255,255,0.10)");

              const duePct = dueUrgencyPct(dueIn);
              const speedPct = payoffSpeedPct(b.payoffMonths);
              const strengthPct = paymentStrengthPct(b.balance, b.totalPay);

              const dueColor = !Number.isFinite(dueIn)
                ? ACCENT
                : dueIn <= 3
                  ? BAD
                  : dueIn <= 7
                    ? WARN
                    : GOOD;

              return (
                <div
                  key={b.id}
                  className="card"
                  style={{
                    ...cardStyle,
                    padding: 16,
                    background: isControl
                      ? "linear-gradient(180deg, rgba(96,165,250,0.08), rgba(255,255,255,0.025))"
                      : "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.025))",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ minWidth: 280, flex: 1 }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 950, fontSize: 18 }}>{b.name}</div>

                        <div style={badge}>
                          <span
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: 99,
                              background: isControl ? ACCENT : "rgba(255,255,255,0.45)",
                              display: "inline-block",
                              boxShadow: isControl ? `0 0 12px ${ACCENT}` : "none",
                            }}
                          />
                          {b.active ? "Active" : "Inactive"} • {typeLabel(b.type)} • {b.frequency}
                        </div>

                        {b.autopay ? (
                          <div style={chip("rgba(52,211,153,0.10)", "rgba(52,211,153,0.24)")}>
                            Autopay
                          </div>
                        ) : null}

                        {b.category ? (
                          <div style={chip("rgba(255,255,255,0.05)", "rgba(255,255,255,0.10)")}>
                            {b.category}
                          </div>
                        ) : null}
                      </div>

                      <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                        Due <b style={{ color: "rgba(255,255,255,0.92)" }}>{b.dueDate}</b>
                        {Number.isFinite(dueIn)
                          ? ` (${dueIn >= 0 ? `in ${dueIn}d` : `${Math.abs(dueIn)}d late`})`
                          : ""}
                        {" • "}
                        {isControl ? (
                          <>
                            Balance {money(b.balance)} • Min {money(b.minPay)} • Extra {money(b.extraPay)} • Total{" "}
                            <b style={{ color: "rgba(255,255,255,0.92)" }}>{money(b.totalPay)}</b> • APR {clamp(b.aprPct, 0, 100)}%
                          </>
                        ) : (
                          <>
                            Amount <b style={{ color: "rgba(255,255,255,0.92)" }}>{money(b.amount)}</b>
                            {b.frequency !== "monthly" && b.frequency !== "one_time" ? (
                              <>
                                {" • "}
                                Monthly eq{" "}
                                <b style={{ color: "rgba(255,255,255,0.92)" }}>
                                  {money(b.monthlyEquivalent)}
                                </b>
                              </>
                            ) : null}
                          </>
                        )}
                      </div>

                      <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                        Linked account:{" "}
                        <b style={{ color: "rgba(255,255,255,0.92)" }}>
                          {b.linkedAccount
                            ? `${accountIcon(b.linkedAccount.type)} ${b.linkedAccount.name}`
                            : "None"}
                        </b>
                        {" • "}
                        Last paid:{" "}
                        <b style={{ color: "rgba(255,255,255,0.92)" }}>
                          {b.lastPaidDate || "—"}
                        </b>
                      </div>

                      {isControl ? (
                        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                          Payoff: <b style={{ color: "rgba(255,255,255,0.92)" }}>{payoffLabel}</b>
                          {" • "}
                          Est. interest:{" "}
                          <b style={{ color: "rgba(255,255,255,0.92)" }}>{money(b.payoffInterest)}</b>
                        </div>
                      ) : null}

                      {b.notes ? (
                        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                          Notes: {b.notes}
                        </div>
                      ) : null}

                      <div
                        className="grid"
                        style={{
                          gap: 10,
                          gridTemplateColumns: isControl ? "repeat(auto-fit, minmax(220px, 1fr))" : "1fr",
                          marginTop: 14,
                        }}
                      >
                        <div
                          style={{
                            padding: 12,
                            borderRadius: 16,
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.06)",
                          }}
                        >
                          <ProgressBar
                            label="Due urgency"
                            value={Number.isFinite(dueIn) ? (dueIn >= 0 ? `${dueIn}d left` : `${Math.abs(dueIn)}d late`) : "—"}
                            sublabel={dueIn <= 3 ? "This needs attention now." : "Keeps upcoming bills visible."}
                            pct={duePct}
                            color={dueColor}
                            danger={dueIn <= 3}
                          />
                        </div>

                        {isControl ? (
                          <>
                            <div
                              style={{
                                padding: 12,
                                borderRadius: 16,
                                background: "rgba(255,255,255,0.03)",
                                border: "1px solid rgba(255,255,255,0.06)",
                              }}
                            >
                              <ProgressBar
                                label="Payoff speed"
                                value={b.payoffMonths === Infinity ? "Too slow" : b.payoffMonths ? `${b.payoffMonths} mo` : "—"}
                                sublabel="Higher bar = faster payoff path."
                                pct={speedPct}
                                color={GOOD}
                              />
                            </div>

                            <div
                              style={{
                                padding: 12,
                                borderRadius: 16,
                                background: "rgba(255,255,255,0.03)",
                                border: "1px solid rgba(255,255,255,0.06)",
                              }}
                            >
                              <ProgressBar
                                label="Payment strength"
                                value={money(b.totalPay)}
                                sublabel="How aggressive your payment is relative to this balance."
                                pct={strengthPct}
                                color={ACCENT}
                              />
                            </div>
                          </>
                        ) : null}
                      </div>

                      {isControl ? (
                        <div className="card" style={{ ...panelStyle, padding: 12, marginTop: 12 }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 10,
                              flexWrap: "wrap",
                              alignItems: "center",
                            }}
                          >
                            <div style={{ fontWeight: 900 }}>Extra payment slider</div>
                            <div className="muted" style={{ fontSize: 12 }}>
                              Drag to see payoff shift live.
                            </div>
                          </div>

                          <div style={{ height: 10 }} />

                          <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                            <div className="muted" style={{ fontSize: 12, width: 90 }}>
                              Extra
                            </div>

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

                          <div style={{ height: 10 }} />

                          <ProgressBar
                            label="Extra payment intensity"
                            value={money(extra)}
                            sublabel="This is your manual push beyond the minimum."
                            pct={min + extra > 0 ? (extra / (min + extra)) * 100 : 0}
                            color={WARN}
                          />
                        </div>
                      ) : null}

                      {historyOpenId === b.id ? (
                        <div
                          className="card"
                          style={{
                            ...panelStyle,
                            padding: 12,
                            marginTop: 12,
                          }}
                        >
                          <div style={{ fontWeight: 900, marginBottom: 10 }}>Payment history</div>
                          {b.history.length === 0 ? (
                            <div className="muted" style={{ fontSize: 12 }}>No payment history yet.</div>
                          ) : (
                            <div className="grid" style={{ gap: 8 }}>
                              {b.history.slice(0, 6).map((h) => {
                                const account = accounts.find((a) => a.id === h.accountId);
                                return (
                                  <div
                                    key={h.id}
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      gap: 10,
                                      padding: "10px 12px",
                                      borderRadius: 14,
                                      background: "rgba(255,255,255,0.03)",
                                      border: "1px solid rgba(255,255,255,0.06)",
                                    }}
                                  >
                                    <div>
                                      <div style={{ fontWeight: 800 }}>{money(h.amount)}</div>
                                      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                                        {account ? `${accountIcon(account.type)} ${account.name}` : "Unknown account"}
                                      </div>
                                      {h.note ? (
                                        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                                          {h.note}
                                        </div>
                                      ) : null}
                                    </div>
                                    <div className="muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                                      {fmtWhen(h.ts)}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>

                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                      <button className="btn" type="button" onClick={() => openPayModal(b)}>
                        Pay Bill
                      </button>
                      <button className="btnGhost" type="button" onClick={() => startEdit(b)}>
                        Edit
                      </button>
                      <button className="btnGhost" type="button" onClick={() => toggleAutopay(b.id)}>
                        {b.autopay ? "Autopay On" : "Autopay Off"}
                      </button>
                      <button
                        className="btnGhost"
                        type="button"
                        onClick={() => setHistoryOpenId((prev) => (prev === b.id ? "" : b.id))}
                      >
                        {historyOpenId === b.id ? "Hide History" : "History"}
                      </button>
                      <button className="btnGhost" type="button" onClick={() => toggleActive(b.id)}>
                        {b.active ? "Deactivate" : "Activate"}
                      </button>
                      <button className="btnGhost" type="button" onClick={() => removeBill(b.id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="muted" style={{ fontSize: 12, marginTop: 14 }}>
        Estimates are simplified. Monthly interest only, no fees, no promo APR changes.
      </div>

      <Modal
        open={payModalOpen}
        title={payingBill ? `Pay: ${payingBill.name}` : "Pay Bill"}
        subtitle={
          payingBill
            ? `${typeLabel(payingBill.type)} • Due ${payingBill.dueDate} • Last paid ${payingBill.lastPaidDate || "—"}`
            : ""
        }
        onClose={() => setPayModalOpen(false)}
      >
        {!payingBill ? (
          <div className="muted">No bill selected.</div>
        ) : (
          <div className="grid" style={{ gap: 12 }}>
            <select
              className="input"
              value={payFromAccountId}
              onChange={(e) => setPayFromAccountId(e.target.value)}
            >
              <option value="">Choose account to pay from</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {accountIcon(a.type)} {a.name} — {accountTypeLabel(a.type)} — {money(a.balance)}
                </option>
              ))}
            </select>

            <input
              className="input"
              inputMode="decimal"
              placeholder="Payment amount"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
            />

            <input
              className="input"
              placeholder="Optional note"
              value={payNote}
              onChange={(e) => setPayNote(e.target.value)}
            />

            {payFromAccountId ? (() => {
              const a = accounts.find((x) => x.id === payFromAccountId);
              const amt = parseMoneyInput(payAmount);
              const projected = a ? safeNum(a.balance, 0) - (Number.isFinite(amt) ? Math.abs(amt) : 0) : null;

              return a ? (
                <div
                  className="card"
                  style={{
                    ...cardStyle,
                    padding: 12,
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  <div className="muted" style={{ fontSize: 12 }}>Account preview</div>
                  <div style={{ marginTop: 6, fontWeight: 900 }}>
                    {accountIcon(a.type)} {a.name}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                    Current: <b style={{ color: "rgba(255,255,255,0.92)" }}>{money(a.balance)}</b>
                    {" • "}
                    After payment: <b style={{ color: projected < 0 ? BAD : "rgba(255,255,255,0.92)" }}>{money(projected)}</b>
                  </div>
                </div>
              ) : null;
            })() : null}

            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              <button className="btn" type="button" onClick={payBillNow}>
                Confirm payment
              </button>
              <button className="btnGhost" type="button" onClick={() => setPayModalOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </Modal>
    </main>
  );
}
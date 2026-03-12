"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

/* =========================
   utils
========================= */
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

function safeNum(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function money(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
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

function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

function addMonths(iso, monthsToAdd) {
  if (!iso) return "";
  const [y, m, d] = String(iso).split("-").map(Number);
  if (![y, m, d].every(Number.isFinite)) return "";
  const dt = new Date(y, m - 1, d);
  dt.setMonth(dt.getMonth() + Number(monthsToAdd || 0));
  return isoDate(dt);
}

function addDays(iso, daysToAdd) {
  if (!iso) return "";
  const [y, m, d] = String(iso).split("-").map(Number);
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
  const a = new Date(`${fromISO}T00:00:00`);
  const b = new Date(`${toISO}T00:00:00`);
  const diff = b.getTime() - a.getTime();
  if (!Number.isFinite(diff)) return null;
  return Math.round(diff / 86400000);
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

function dueTone(days) {
  if (!Number.isFinite(days)) {
    return {
      label: "No due date",
      color: "#60a5fa",
      bg: "rgba(96,165,250,.12)",
      border: "rgba(96,165,250,.24)",
      glow: "0 0 24px rgba(96,165,250,.20)",
    };
  }
  if (days < 0) {
    return {
      label: `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} late`,
      color: "#f87171",
      bg: "rgba(248,113,113,.12)",
      border: "rgba(248,113,113,.28)",
      glow: "0 0 24px rgba(248,113,113,.22)",
    };
  }
  if (days <= 3) {
    return {
      label: days === 0 ? "Due today" : `Due in ${days} day${days === 1 ? "" : "s"}`,
      color: "#fb7185",
      bg: "rgba(251,113,133,.12)",
      border: "rgba(251,113,133,.28)",
      glow: "0 0 24px rgba(251,113,133,.22)",
    };
  }
  if (days <= 7) {
    return {
      label: `Due in ${days} days`,
      color: "#f59e0b",
      bg: "rgba(245,158,11,.12)",
      border: "rgba(245,158,11,.28)",
      glow: "0 0 24px rgba(245,158,11,.18)",
    };
  }
  return {
    label: `Due in ${days} days`,
    color: "#34d399",
    bg: "rgba(52,211,153,.12)",
    border: "rgba(52,211,153,.24)",
    glow: "0 0 24px rgba(52,211,153,.18)",
  };
}

function duePercent(days) {
  if (!Number.isFinite(days)) return 0;
  if (days < 0) return 100;
  if (days === 0) return 100;
  if (days <= 3) return 92;
  if (days <= 7) return 72;
  if (days <= 14) return 48;
  if (days <= 21) return 26;
  return 10;
}

function monthlyWeight(amount, frequency) {
  const amt = safeNum(amount, 0);
  return amt * freqToMonthlyMult(frequency);
}

/* =========================
   normalization
========================= */
const DEFAULTS = {
  version: 1,
  settings: {
    paycheckMonthly: 0,
  },
  items: [],
};

function normalizeBill(raw) {
  const x = raw || {};
  const freq = ["monthly", "weekly", "biweekly", "quarterly", "yearly", "one_time"].includes(x.frequency)
    ? x.frequency
    : "monthly";

  return {
    id: String(x.id || uid()),
    name: String(x.name || "").trim(),
    amount: Number.isFinite(Number(x.amount)) ? Number(x.amount) : 0,
    dueDate: String(x.dueDate || "").trim() || isoDate(),
    frequency: freq,
    category: String(x.category || "").trim(),
    notes: String(x.notes || ""),
    active: x.active !== false,
    autopay: x.autopay === true,
    accountId: String(x.accountId || "").trim(),
    lastPaidDate: String(x.lastPaidDate || "").trim(),
    createdAt: Number.isFinite(Number(x.createdAt)) ? Number(x.createdAt) : Date.now(),
  };
}

function normalizeState(saved) {
  const base = saved && typeof saved === "object" ? saved : {};
  const settings = base.settings && typeof base.settings === "object" ? base.settings : {};
  const items = Array.isArray(base.items) ? base.items : [];

  return {
    version: 1,
    settings: {
      paycheckMonthly: Number.isFinite(Number(settings.paycheckMonthly))
        ? Number(settings.paycheckMonthly)
        : 0,
    },
    items: items.map(normalizeBill).filter((b) => b.name),
  };
}

/* =========================
   db mapping
========================= */
function mapRowToBill(row) {
  return normalizeBill({
    id: row.id,
    name: row.name,
    amount: row.amount,
    dueDate: row.due_date,
    frequency: row.frequency,
    category: row.category,
    notes: row.notes,
    active: row.active,
    autopay: row.autopay,
    accountId: row.account_id,
    lastPaidDate: row.last_paid_date,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  });
}

function mapBillToRow(bill, userId) {
  return {
    id: bill.id,
    user_id: userId,
    name: bill.name,
    type: "noncontrollable",
    frequency: bill.frequency,
    due_date: bill.dueDate || null,
    amount: Number(bill.amount) || 0,
    notes: bill.notes || "",
    active: bill.active !== false,
    autopay: bill.autopay === true,
    category: bill.category || "",
    account_id: bill.accountId || null,
    last_paid_date: bill.lastPaidDate || null,
    created_at: bill.createdAt ? new Date(bill.createdAt).toISOString() : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function mapSettingsToRow(settings, userId) {
  return {
    user_id: userId,
    paycheck_monthly: Number(settings.paycheckMonthly) || 0,
    extra_pool_monthly: 0,
    strategy: "avalanche",
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
    related_account_id: null,
    related_account_name: "",
    source_type: txn.sourceType || "",
    source_id: txn.sourceId || "",
    created_at: new Date(txn.ts || Date.now()).toISOString(),
  };
}

/* =========================
   visual tokens
========================= */
const ACCENT = "#60a5fa";
const GOOD = "#34d399";
const WARN = "#f59e0b";
const BAD = "#f87171";

const shellCard = {
  background: "linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.025))",
  border: "1px solid rgba(255,255,255,.08)",
  borderRadius: 24,
  boxShadow: "0 18px 55px rgba(0,0,0,.30)",
  backdropFilter: "blur(12px)",
};

const softCard = {
  background: "linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02))",
  border: "1px solid rgba(255,255,255,.07)",
  borderRadius: 20,
  boxShadow: "0 14px 36px rgba(0,0,0,.24)",
  backdropFilter: "blur(10px)",
};

function pill(bg = "rgba(255,255,255,.06)", border = "rgba(255,255,255,.1)") {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 999,
    background: bg,
    border: `1px solid ${border}`,
    color: "rgba(255,255,255,.9)",
    fontSize: 12,
    whiteSpace: "nowrap",
  };
}

function MetricBar({ label, value, sublabel, pct, color = ACCENT, danger = false }) {
  const safePct = clamp(pct, 0, 100);

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
        <div className="muted" style={{ fontSize: 12 }}>{label}</div>
        <div style={{ fontWeight: 900 }}>{value}</div>
      </div>

      <div
        style={{
          position: "relative",
          height: 12,
          borderRadius: 999,
          overflow: "hidden",
          background: danger ? "rgba(248,113,113,.08)" : "rgba(255,255,255,.05)",
          border: `1px solid ${danger ? "rgba(248,113,113,.18)" : "rgba(255,255,255,.08)"}`,
        }}
      >
        <div
          style={{
            width: `${safePct}%`,
            height: "100%",
            borderRadius: 999,
            background: `linear-gradient(90deg, ${color}, rgba(255,255,255,.95))`,
            boxShadow: `0 0 18px ${color}66`,
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
        justifyContent: "center",
        alignItems: "center",
        padding: 16,
      }}
    >
      <div
        className="card"
        style={{
          width: "min(760px, 100%)",
          padding: 18,
          borderRadius: 24,
          border: "1px solid rgba(255,255,255,.08)",
          boxShadow: "0 24px 80px rgba(0,0,0,.45)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
          <div>
            <div style={{ fontWeight: 950, fontSize: 18 }}>{title}</div>
            {subtitle ? (
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{subtitle}</div>
            ) : null}
          </div>

          <button className="btnGhost" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div style={{ height: 16 }} />
        {children}
      </div>
    </div>
  );
}

/* =========================
   component
========================= */
export default function BillsPage() {
  const [state, setState] = useState(DEFAULTS);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [primaryAccountId, setPrimaryAccountId] = useState("");

  const [mode, setMode] = useState("add");
  const [editId, setEditId] = useState(null);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(isoDate());
  const [frequency, setFrequency] = useState("monthly");
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [linkedAccountId, setLinkedAccountId] = useState("");
  const [autopay, setAutopay] = useState(false);

  const [scope, setScope] = useState("active");
  const [sortBy, setSortBy] = useState("due_asc");
  const [lane, setLane] = useState("all");
  const [q, setQ] = useState("");

  const [historyOpenId, setHistoryOpenId] = useState("");
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payingBillId, setPayingBillId] = useState("");
  const [payFromAccountId, setPayFromAccountId] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");

  const [error, setError] = useState("");

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

        const [billsRes, settingsRes, accountsRes, accountSettingsRes, txnsRes] = await Promise.all([
          supabase
            .from("bills")
            .select("*")
            .eq("user_id", currentUser.id)
            .eq("type", "noncontrollable")
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
        if (accountSettingsRes.error) throw accountSettingsRes.error;
        if (txnsRes.error) throw txnsRes.error;

        const bills = (billsRes.data || []).map(mapRowToBill);
        const settingsRow = settingsRes.data;
        const loadedAccounts = (accountsRes.data || []).map(mapAccountRowToClient);
        const loadedTxns = (txnsRes.data || []).map(mapTxnRowToClient);

        const nextState = normalizeState({
          version: 1,
          settings: {
            paycheckMonthly: settingsRow?.paycheck_monthly ?? 0,
          },
          items: bills,
        });

        if (!mounted) return;

        setState(nextState);
        setAccounts(loadedAccounts);
        setTransactions(loadedTxns);
        setPrimaryAccountId(accountSettingsRes.data?.primary_account_id || loadedAccounts[0]?.id || "");
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
    setAmount("");
    setDueDate(isoDate());
    setFrequency("monthly");
    setCategory("");
    setNotes("");
    setLinkedAccountId("");
    setAutopay(false);
    setError("");
  }

  function startEdit(bill) {
    setMode("edit");
    setEditId(bill.id);
    setName(bill.name || "");
    setAmount(String(Number.isFinite(Number(bill.amount)) ? bill.amount : ""));
    setDueDate(bill.dueDate || isoDate());
    setFrequency(bill.frequency || "monthly");
    setCategory(bill.category || "");
    setNotes(bill.notes || "");
    setLinkedAccountId(bill.accountId || "");
    setAutopay(bill.autopay === true);
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

    if (!nm) return setError("Bill name is required.");
    if (!dd) return setError("Due date is required.");
    if (!Number.isFinite(amt) || amt <= 0) return setError("Amount must be greater than 0.");

    const existingCreatedAt =
      mode === "edit" ? state.items.find((x) => x.id === editId)?.createdAt ?? Date.now() : Date.now();

    const payload = normalizeBill({
      id: mode === "edit" ? editId : uid(),
      name: nm,
      amount: amt,
      dueDate: dd,
      frequency,
      category,
      notes,
      accountId: linkedAccountId || "",
      autopay,
      active: true,
      lastPaidDate: mode === "edit" ? state.items.find((x) => x.id === editId)?.lastPaidDate || "" : "",
      createdAt: existingCreatedAt,
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

    const saved = mapRowToBill(data);

    setState((prev) => {
      const exists = prev.items.some((x) => x.id === saved.id);
      const nextItems = exists
        ? prev.items.map((x) => (x.id === saved.id ? saved : x))
        : [saved, ...prev.items];
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
    if (!confirm("Delete this bill permanently?")) return;

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
    setPayAmount(String(Math.max(0, Number(bill.amount) || 0)));
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
      due_date: payingBill.frequency !== "one_time"
        ? nextDueDateFromFrequency(payingBill.dueDate || today, payingBill.frequency)
        : payingBill.dueDate || today,
    };

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

    const withDerived = list.map((x) => {
      const dueIn = daysBetween(today, x.dueDate);
      const monthlyEq = monthlyWeight(x.amount, x.frequency);
      const linkedAccount = accounts.find((a) => a.id === x.accountId) || null;
      const history = transactions
        .filter((t) => t.sourceType === "bill" && t.sourceId === x.id)
        .sort((a, b) => safeNum(b.ts, 0) - safeNum(a.ts, 0));

      let laneName = "upcoming";
      if (Number.isFinite(dueIn)) {
        if (dueIn < 0) laneName = "late";
        else if (dueIn <= 7) laneName = "soon";
      }
      if (x.autopay) laneName = "autopay";

      return {
        ...x,
        dueIn,
        monthlyEq,
        linkedAccount,
        history,
        laneName,
        tone: dueTone(dueIn),
      };
    });

    let filtered = withDerived;

    if (query) {
      filtered = filtered.filter((x) =>
        `${x.name} ${x.category || ""} ${x.notes || ""}`.toLowerCase().includes(query)
      );
    }

    if (lane !== "all") {
      filtered = filtered.filter((x) => x.laneName === lane);
    }

    filtered.sort((a, b) => {
      if (sortBy === "due_asc") {
        const ad = Number.isFinite(a.dueIn) ? a.dueIn : 999999;
        const bd = Number.isFinite(b.dueIn) ? b.dueIn : 999999;
        return ad - bd;
      }
      if (sortBy === "amount_desc") return safeNum(b.amount, 0) - safeNum(a.amount, 0);
      if (sortBy === "monthly_desc") return safeNum(b.monthlyEq, 0) - safeNum(a.monthlyEq, 0);
      if (sortBy === "name_asc") return String(a.name).localeCompare(String(b.name));
      return 0;
    });

    const activeItems = state.items.filter((x) => x.active);

    const totalMonthly = activeItems.reduce((s, x) => s + monthlyWeight(x.amount, x.frequency), 0);
    const lateCount = activeItems.filter((x) => {
      const d = daysBetween(today, x.dueDate);
      return Number.isFinite(d) && d < 0;
    }).length;

    const dueSoonCount = activeItems.filter((x) => {
      const d = daysBetween(today, x.dueDate);
      return Number.isFinite(d) && d >= 0 && d <= 7;
    }).length;

    const autopayCount = activeItems.filter((x) => x.autopay).length;

    const nextDue = activeItems
      .map((x) => ({ ...x, dueIn: daysBetween(today, x.dueDate) }))
      .filter((x) => Number.isFinite(x.dueIn))
      .sort((a, b) => a.dueIn - b.dueIn)[0];

    const topMonthly = activeItems
      .map((x) => ({ ...x, monthlyEq: monthlyWeight(x.amount, x.frequency) }))
      .sort((a, b) => safeNum(b.monthlyEq, 0) - safeNum(a.monthlyEq, 0))
      .slice(0, 4);

    const paycheckMonthly = safeNum(state.settings.paycheckMonthly, 0);
    const pressurePct = paycheckMonthly > 0 ? clamp((totalMonthly / paycheckMonthly) * 100, 0, 100) : 0;

    return {
      today,
      list: filtered,
      totals: {
        totalMonthly,
        lateCount,
        dueSoonCount,
        autopayCount,
        activeCount: activeItems.length,
        pressurePct,
      },
      nextDue,
      topMonthly,
    };
  }, [state.items, accounts, transactions, q, lane, scope, sortBy, state.settings.paycheckMonthly]);

  const hero = [
    {
      label: "Monthly bill load",
      value: money(computed.totals.totalMonthly),
      sublabel:
        state.settings.paycheckMonthly > 0
          ? `${computed.totals.pressurePct.toFixed(1)}% of monthly income`
          : "Set monthly income to see pressure",
      pct: computed.totals.pressurePct,
      color: computed.totals.pressurePct >= 70 ? BAD : ACCENT,
      danger: computed.totals.pressurePct >= 70,
    },
    {
      label: "Late bills",
      value: String(computed.totals.lateCount),
      sublabel: computed.totals.lateCount > 0 ? "These need action first" : "Nothing overdue",
      pct: clamp(computed.totals.lateCount * 22, 0, 100),
      color: BAD,
      danger: computed.totals.lateCount > 0,
    },
    {
      label: "Due in 7 days",
      value: String(computed.totals.dueSoonCount),
      sublabel: "Short-window timeline",
      pct: clamp(computed.totals.dueSoonCount * 18, 0, 100),
      color: WARN,
    },
    {
      label: "Autopay enabled",
      value: String(computed.totals.autopayCount),
      sublabel: `${computed.totals.activeCount} active total`,
      pct:
        computed.totals.activeCount > 0
          ? (computed.totals.autopayCount / computed.totals.activeCount) * 100
          : 0,
      color: GOOD,
    },
  ];

  if (loading) {
    return (
      <main className="container" style={{ paddingBottom: 24 }}>
        <div className="card" style={{ ...shellCard, padding: 18 }}>
          Loading bills...
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="container" style={{ paddingBottom: 24 }}>
        <div className="card" style={{ ...shellCard, padding: 18 }}>
          <div style={{ fontWeight: 900 }}>Please log in</div>
          <div className="muted" style={{ marginTop: 6 }}>
            This page loads from Supabase, so you need to be signed in.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="container" style={{ paddingBottom: 26 }}>
      <header style={{ marginBottom: 18 }}>
        <div className="muted" style={{ fontSize: 12, letterSpacing: ".12em", textTransform: "uppercase", marginBottom: 8 }}>
          Bills
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 18,
            flexWrap: "wrap",
            alignItems: "baseline",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: "clamp(30px,4vw,46px)", letterSpacing: -1.2 }}>
              Premium Bills Control
            </h1>
            <div className="muted" style={{ marginTop: 8, maxWidth: 760 }}>
              Clean bill tracking with real urgency, better due-date visibility, linked-account payments,
              history, and a layout that feels premium instead of cramped.
            </div>
          </div>

          <div
            style={{
              ...pill("rgba(96,165,250,.10)", "rgba(96,165,250,.28)"),
              padding: "10px 14px",
              borderRadius: 16,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: ACCENT,
                boxShadow: `0 0 14px ${ACCENT}`,
              }}
            />
            Next due:
            <b style={{ color: "rgba(255,255,255,.94)" }}>
              {computed.nextDue ? `${computed.nextDue.name} • ${computed.nextDue.dueDate}` : " — "}
            </b>
          </div>
        </div>
      </header>

      {pageError ? (
        <div
          className="card"
          style={{
            ...softCard,
            padding: 14,
            marginBottom: 16,
            border: "1px solid rgba(239,68,68,.30)",
            background: "linear-gradient(180deg, rgba(127,29,29,.30), rgba(127,29,29,.12))",
          }}
        >
          <div style={{ fontWeight: 950 }}>Database issue</div>
          <div className="muted" style={{ marginTop: 6 }}>{pageError}</div>
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
        {hero.map((item) => (
          <div key={item.label} className="card" style={{ ...softCard, padding: 14 }}>
            <MetricBar
              label={item.label}
              value={item.value}
              sublabel={item.sublabel}
              pct={item.pct}
              color={item.color}
              danger={item.danger}
            />
          </div>
        ))}
      </div>

      <div
        className="grid"
        style={{
          gap: 16,
          gridTemplateColumns: "1.18fr .82fr",
          marginBottom: 16,
        }}
      >
        <div
          className="card"
          style={{
            ...shellCard,
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
                "radial-gradient(circle at top left, rgba(96,165,250,.10), transparent 28%), radial-gradient(circle at bottom right, rgba(52,211,153,.08), transparent 24%)",
            }}
          />

          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 950, fontSize: 18 }}>Bill pressure overview</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  Your biggest bill weight, pressure against income, and what is creating the most monthly drag.
                </div>
              </div>

              <div style={pill("rgba(255,255,255,.05)", "rgba(255,255,255,.10)")}>
                Active bills: <b>{computed.totals.activeCount}</b>
              </div>
            </div>

            <div style={{ height: 14 }} />

            <div className="grid" style={{ gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
              <div className="card" style={{ ...softCard, padding: 14 }}>
                <MetricBar
                  label="Income pressure"
                  value={`${computed.totals.pressurePct.toFixed(1)}%`}
                  sublabel={
                    state.settings.paycheckMonthly > 0
                      ? `${money(computed.totals.totalMonthly)} of ${money(state.settings.paycheckMonthly)}`
                      : "Set monthly income below"
                  }
                  pct={computed.totals.pressurePct}
                  color={computed.totals.pressurePct >= 70 ? BAD : ACCENT}
                  danger={computed.totals.pressurePct >= 70}
                />
              </div>

              <div className="card" style={{ ...softCard, padding: 14 }}>
                <div style={{ fontWeight: 900, marginBottom: 10 }}>Top monthly weight</div>
                {computed.topMonthly.length === 0 ? (
                  <div className="muted" style={{ fontSize: 12 }}>No active bills yet.</div>
                ) : (
                  <div className="grid" style={{ gap: 10 }}>
                    {computed.topMonthly.map((b) => (
                      <div
                        key={b.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          padding: "10px 12px",
                          borderRadius: 14,
                          background: "rgba(255,255,255,.03)",
                          border: "1px solid rgba(255,255,255,.06)",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 800 }}>{b.name}</div>
                          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                            {b.frequency} • {b.category || "No category"}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 900 }}>{money(b.monthlyEq)}</div>
                          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                            monthly eq
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ ...shellCard, padding: 16 }}>
          <div style={{ fontWeight: 950, fontSize: 18 }}>Upcoming timeline</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            Fast visual read for what is late, close, and under control.
          </div>

          <div style={{ height: 14 }} />

          {state.items.filter((x) => x.active).length === 0 ? (
            <div className="muted">No active bills yet.</div>
          ) : (
            <div className="grid" style={{ gap: 10 }}>
              {state.items
                .filter((x) => x.active)
                .map((x) => ({ ...x, dueIn: daysBetween(isoDate(), x.dueDate), tone: dueTone(daysBetween(isoDate(), x.dueDate)) }))
                .sort((a, b) => {
                  const ad = Number.isFinite(a.dueIn) ? a.dueIn : 999999;
                  const bd = Number.isFinite(b.dueIn) ? b.dueIn : 999999;
                  return ad - bd;
                })
                .slice(0, 5)
                .map((b) => (
                  <div
                    key={b.id}
                    style={{
                      padding: 12,
                      borderRadius: 16,
                      background: b.tone.bg,
                      border: `1px solid ${b.tone.border}`,
                      boxShadow: b.tone.glow,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 900 }}>{b.name}</div>
                        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                          {b.dueDate} • {b.frequency}
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 900 }}>{money(b.amount)}</div>
                        <div style={{ fontSize: 12, marginTop: 4, color: b.tone.color }}>
                          {b.tone.label}
                        </div>
                      </div>
                    </div>

                    <div style={{ height: 10 }} />

                    <div
                      style={{
                        height: 8,
                        borderRadius: 999,
                        overflow: "hidden",
                        background: "rgba(255,255,255,.10)",
                        border: "1px solid rgba(255,255,255,.10)",
                      }}
                    >
                      <div
                        style={{
                          width: `${duePercent(b.dueIn)}%`,
                          height: "100%",
                          borderRadius: 999,
                          background: `linear-gradient(90deg, ${b.tone.color}, rgba(255,255,255,.92))`,
                          boxShadow: `0 0 18px ${b.tone.color}66`,
                        }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ ...shellCard, padding: 14, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ fontWeight: 950 }}>Settings</div>
          <div className="muted" style={{ fontSize: 12 }}>Used for pressure bars and affordability view.</div>
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
            background: "rgba(255,255,255,.03)",
            border: "1px solid rgba(255,255,255,.06)",
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

      <div className="card" style={{ ...shellCard, padding: 14, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ fontWeight: 950, fontSize: 18 }}>
            {mode === "edit" ? "Edit bill" : "Add bill"}
          </div>

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
              placeholder="Bill name (Rent, Internet, Insurance...)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ flex: 1, minWidth: 260 }}
            />

            <input
              className="input"
              placeholder="Amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ width: 180 }}
            />

            <input
              className="input"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={{ width: 180 }}
            />

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
          </div>

          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <input
              className="input"
              placeholder="Category (Housing, Utilities, Insurance...)"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{ width: 260 }}
            />

            <select
              className="input"
              value={linkedAccountId}
              onChange={(e) => setLinkedAccountId(e.target.value)}
              style={{ minWidth: 260, flex: 1 }}
            >
              <option value="">Linked account (optional)</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {accountIcon(a.type)} {a.name} — {accountTypeLabel(a.type)}
                </option>
              ))}
            </select>

            <label
              style={{
                ...pill("rgba(255,255,255,.05)", "rgba(255,255,255,.10)"),
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

          <input
            className="input"
            placeholder="Notes (login, account number, reminder info...)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          {error ? (
            <div
              className="card"
              style={{
                ...softCard,
                padding: 12,
                border: "1px solid rgba(239,68,68,.35)",
                background: "linear-gradient(180deg, rgba(127,29,29,.28), rgba(127,29,29,.12))",
              }}
            >
              <div style={{ fontWeight: 950 }}>Fix this</div>
              <div className="muted" style={{ marginTop: 6 }}>{error}</div>
            </div>
          ) : null}

          <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button
              className="btn"
              type="submit"
              style={{ background: ACCENT, border: "1px solid rgba(255,255,255,.12)" }}
            >
              {mode === "edit" ? "Save changes" : "Add bill"}
            </button>

            <button className="btnGhost" type="button" onClick={resetForm}>
              Clear
            </button>

            <div className="muted" style={{ fontSize: 12 }}>
              Use deactivate instead of delete if you want to keep history.
            </div>
          </div>
        </form>
      </div>

      <div className="card" style={{ ...shellCard, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontWeight: 950, fontSize: 18 }}>Bills list</div>

          <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input
              className="input"
              placeholder="Search bills..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ width: 220 }}
            />

            <select
              className="input"
              value={lane}
              onChange={(e) => setLane(e.target.value)}
              style={{ width: 170 }}
            >
              <option value="all">All lanes</option>
              <option value="late">Late</option>
              <option value="soon">Due soon</option>
              <option value="upcoming">Upcoming</option>
              <option value="autopay">Autopay</option>
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
              style={{ width: 190 }}
            >
              <option value="due_asc">Due date</option>
              <option value="amount_desc">Amount</option>
              <option value="monthly_desc">Monthly weight</option>
              <option value="name_asc">Name</option>
            </select>
          </div>
        </div>

        <div style={{ height: 12 }} />

        {computed.list.length === 0 ? (
          <div className="muted">No bills match your filters.</div>
        ) : (
          <div className="grid" style={{ gap: 14 }}>
            {computed.list.map((b) => {
              const tone = b.tone;
              const duePct = duePercent(b.dueIn);

              return (
                <div
                  key={b.id}
                  className="card"
                  style={{
                    ...softCard,
                    padding: 16,
                    background: `linear-gradient(180deg, ${tone.bg}, rgba(255,255,255,.02))`,
                    border: `1px solid ${tone.border}`,
                    boxShadow: tone.glow,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 14,
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ minWidth: 280, flex: 1 }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 950, fontSize: 20 }}>{b.name}</div>

                        <div style={pill(tone.bg, tone.border)}>
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 999,
                              background: tone.color,
                              boxShadow: `0 0 14px ${tone.color}`,
                            }}
                          />
                          {b.active ? "Active" : "Inactive"}
                        </div>

                        <div style={pill("rgba(255,255,255,.05)", "rgba(255,255,255,.10)")}>
                          {b.frequency}
                        </div>

                        {b.autopay ? (
                          <div style={pill("rgba(52,211,153,.10)", "rgba(52,211,153,.22)")}>
                            Autopay
                          </div>
                        ) : null}

                        {b.category ? (
                          <div style={pill("rgba(255,255,255,.05)", "rgba(255,255,255,.10)")}>
                            {b.category}
                          </div>
                        ) : null}
                      </div>

                      <div className="muted" style={{ fontSize: 13, marginTop: 10 }}>
                        Due <b style={{ color: "rgba(255,255,255,.94)" }}>{b.dueDate}</b> • Amount{" "}
                        <b style={{ color: "rgba(255,255,255,.94)" }}>{money(b.amount)}</b>
                        {b.frequency !== "monthly" && b.frequency !== "one_time" ? (
                          <>
                            {" • "}Monthly eq <b style={{ color: "rgba(255,255,255,.94)" }}>{money(b.monthlyEq)}</b>
                          </>
                        ) : null}
                      </div>

                      <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                        Linked account:{" "}
                        <b style={{ color: "rgba(255,255,255,.94)" }}>
                          {b.linkedAccount
                            ? `${accountIcon(b.linkedAccount.type)} ${b.linkedAccount.name}`
                            : "None"}
                        </b>
                        {" • "}
                        Last paid: <b style={{ color: "rgba(255,255,255,.94)" }}>{b.lastPaidDate || "—"}</b>
                      </div>

                      {b.notes ? (
                        <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                          Notes: {b.notes}
                        </div>
                      ) : null}

                      <div style={{ marginTop: 14 }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            flexWrap: "wrap",
                            alignItems: "baseline",
                            marginBottom: 8,
                          }}
                        >
                          <div className="muted" style={{ fontSize: 12 }}>Urgency line</div>
                          <div style={{ fontSize: 12, fontWeight: 900, color: tone.color }}>
                            {tone.label}
                          </div>
                        </div>

                        <div
                          style={{
                            position: "relative",
                            height: 12,
                            borderRadius: 999,
                            overflow: "hidden",
                            background: "rgba(255,255,255,.08)",
                            border: "1px solid rgba(255,255,255,.10)",
                          }}
                        >
                          <div
                            style={{
                              width: `${duePct}%`,
                              height: "100%",
                              borderRadius: 999,
                              background: `linear-gradient(90deg, ${tone.color}, rgba(255,255,255,.95))`,
                              boxShadow: `0 0 20px ${tone.color}66`,
                            }}
                          />
                        </div>
                      </div>

                      {historyOpenId === b.id ? (
                        <div className="card" style={{ ...shellCard, padding: 12, marginTop: 14 }}>
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
                                      background: "rgba(255,255,255,.03)",
                                      border: "1px solid rgba(255,255,255,.06)",
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
        Bills page only. No debt planner, no payoff noise, no extra clutter.
      </div>

      <Modal
        open={payModalOpen}
        title={payingBill ? `Pay: ${payingBill.name}` : "Pay Bill"}
        subtitle={
          payingBill
            ? `Due ${payingBill.dueDate} • ${payingBill.frequency} • Last paid ${payingBill.lastPaidDate || "—"}`
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
                    ...softCard,
                    padding: 12,
                    background: "rgba(255,255,255,.03)",
                  }}
                >
                  <div className="muted" style={{ fontSize: 12 }}>Account preview</div>
                  <div style={{ marginTop: 6, fontWeight: 900 }}>
                    {accountIcon(a.type)} {a.name}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                    Current: <b style={{ color: "rgba(255,255,255,.92)" }}>{money(a.balance)}</b>
                    {" • "}
                    After payment:{" "}
                    <b style={{ color: projected < 0 ? BAD : "rgba(255,255,255,.92)" }}>
                      {money(projected)}
                    </b>
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
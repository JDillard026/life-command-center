"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Copy,
  CreditCard,
  PiggyBank,
  Plus,
  Save,
  Search,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { writeAccountDelta, writeAccountTransfer } from "@/lib/accountLedger";
import GlassPane from "../components/GlassPane";

const DEFAULT_CATEGORIES = [
  { id: "groceries", name: "Groceries", group: "Food", color: "#22c55e", isBudgeted: true },
  { id: "eating_out", name: "Eating Out", group: "Food", color: "#10b981", isBudgeted: true },
  { id: "coffee", name: "Coffee", group: "Food", color: "#14b8a6", isBudgeted: true },
  { id: "gas", name: "Gas", group: "Transport", color: "#60a5fa", isBudgeted: true },
  { id: "rideshare", name: "Ride Share", group: "Transport", color: "#3b82f6", isBudgeted: false },
  { id: "utilities", name: "Utilities", group: "Bills", color: "#8b5cf6", isBudgeted: false },
  { id: "phone", name: "Phone", group: "Bills", color: "#7c3aed", isBudgeted: false },
  { id: "internet", name: "Internet", group: "Bills", color: "#6d28d9", isBudgeted: false },
  { id: "subscriptions", name: "Subscriptions", group: "Bills", color: "#4c1d95", isBudgeted: true },
  { id: "shopping", name: "Shopping", group: "Lifestyle", color: "#fb7185", isBudgeted: true },
  { id: "entertainment", name: "Entertainment", group: "Lifestyle", color: "#f43f5e", isBudgeted: false },
  { id: "personal", name: "Personal Care", group: "Lifestyle", color: "#e11d48", isBudgeted: false },
  { id: "health", name: "Health", group: "Health", color: "#f59e0b", isBudgeted: false },
  { id: "fitness", name: "Fitness", group: "Health", color: "#f97316", isBudgeted: false },
  { id: "travel", name: "Travel", group: "Travel", color: "#38bdf8", isBudgeted: false },
  { id: "savings", name: "Savings", group: "Transfers", color: "#22c55e", isBudgeted: false },
  { id: "investing", name: "Investing", group: "Transfers", color: "#16a34a", isBudgeted: false },
  { id: "debt", name: "Debt Payments", group: "Transfers", color: "#dc2626", isBudgeted: false },
  { id: "misc", name: "Misc", group: "Other", color: "#94a3b8", isBudgeted: true },
];

const DEFAULT_BUDGETS = {
  weekly: {
    groceries: 200,
    eating_out: 120,
    coffee: 25,
    gas: 100,
    subscriptions: 30,
    shopping: 60,
    misc: 40,
  },
  monthly: {
    groceries: 800,
    eating_out: 450,
    coffee: 90,
    gas: 400,
    subscriptions: 120,
    shopping: 250,
    misc: 150,
  },
  yearly: {
    groceries: 9600,
    eating_out: 5400,
    coffee: 1080,
    gas: 4800,
    subscriptions: 1440,
    shopping: 3000,
    misc: 1800,
  },
};

const MOBILE_SECTIONS = [
  { value: "list", label: "Feed" },
  { value: "focus", label: "Focus" },
  { value: "tools", label: "Add" },
];

function uid() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function roundMoneyValue(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function parseMoneyInput(v) {
  const cleaned = String(v ?? "").replace(/[^0-9.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : NaN;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toDate(iso) {
  return new Date(`${iso}T00:00:00`);
}

function money(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "$0.00";
  return x.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function shortDate(iso) {
  const d = toDate(iso);
  if (!Number.isFinite(d.getTime())) return iso || "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function normalizeTime(v) {
  const raw = String(v || "").trim();
  if (!raw) return "";
  const m = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return "";
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return "";
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return "";
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function fmtTime(v) {
  const t = normalizeTime(v);
  if (!t) return "All day";
  const [h, m] = t.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function ledgerDateTimeISO(date, time) {
  const d = String(date || todayISO());
  const t = normalizeTime(time) || "12:00";
  const stamp = new Date(`${d}T${t}:00`);
  if (!Number.isFinite(stamp.getTime())) return new Date().toISOString();
  return stamp.toISOString();
}

function normalizeCategory(raw) {
  const x = raw || {};
  return {
    id: String(x.id || uid()),
    name: String(x.name || "").trim(),
    group: String(x.group || "Other").trim() || "Other",
    color: String(x.color || "#94a3b8"),
    isBudgeted: x.isBudgeted !== false,
  };
}

function startOfWeek(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfWeek(d) {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function startOfYear(d) {
  return new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);
}

function endOfYear(d) {
  return new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);
}

function periodBounds(mode) {
  const now = new Date();
  if (mode === "week") {
    return { start: startOfWeek(now), end: endOfWeek(now), budgetMode: "weekly", label: "This Week" };
  }
  if (mode === "year") {
    return { start: startOfYear(now), end: endOfYear(now), budgetMode: "yearly", label: "This Year" };
  }
  return { start: startOfMonth(now), end: endOfMonth(now), budgetMode: "monthly", label: "This Month" };
}

function inRange(iso, start, end) {
  const d = toDate(iso);
  return d >= start && d <= end;
}

function percentChange(current, previous) {
  const a = Number(current) || 0;
  const b = Number(previous) || 0;
  if (b === 0) return a > 0 ? 100 : 0;
  return ((a - b) / b) * 100;
}

function trendMeta(current, previous) {
  const diff = percentChange(current, previous);
  return {
    value: `${diff >= 0 ? "+" : ""}${diff.toFixed(0)}%`,
    positive: diff >= 0,
    text: "vs prior period",
  };
}

function budgetStatus(spent, budget) {
  if (!budget || budget <= 0) return "No budget";
  const pct = spent / budget;
  if (pct >= 1) return "Over";
  if (pct >= 0.85) return "Near";
  return "OK";
}

function getPreviousRange(period, currentRange) {
  const start = new Date(currentRange.start);
  const end = new Date(currentRange.end);

  if (period === "week") {
    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - 7);
    const prevEnd = new Date(end);
    prevEnd.setDate(prevEnd.getDate() - 7);
    return { start: prevStart, end: prevEnd };
  }

  if (period === "year") {
    return {
      start: new Date(start.getFullYear() - 1, 0, 1, 0, 0, 0, 0),
      end: new Date(start.getFullYear() - 1, 11, 31, 23, 59, 59, 999),
    };
  }

  return {
    start: new Date(start.getFullYear(), start.getMonth() - 1, 1, 0, 0, 0, 0),
    end: new Date(start.getFullYear(), start.getMonth(), 0, 23, 59, 59, 999),
  };
}

function sumExpenses(rows) {
  return rows.reduce((sum, row) => sum + (row.type === "expense" ? Number(row.amount) || 0 : 0), 0);
}

function mapCategoryRowToClient(row) {
  return normalizeCategory({
    id: row.id,
    name: row.name,
    group: row.group_name,
    color: row.color,
    isBudgeted: row.is_budgeted,
  });
}

function mapCategoryClientToRow(cat, userId) {
  return {
    id: cat.id,
    user_id: userId,
    name: cat.name,
    group_name: cat.group,
    color: cat.color,
    is_budgeted: cat.isBudgeted !== false,
    updated_at: new Date().toISOString(),
  };
}

function mapAccountRowToClient(row) {
  return {
    id: row.id,
    name: String(row.name || "Account"),
    accountType: String(row.account_type || "other"),
    balance: roundMoneyValue(row.balance),
  };
}

function normalizeAccountMatch(v) {
  return String(v || "").trim().toLowerCase();
}

function findAccountByName(accounts, name) {
  const target = normalizeAccountMatch(name);
  if (!target) return null;
  return accounts.find((account) => normalizeAccountMatch(account.name) === target) || null;
}

function parseStoredAccount(value, type) {
  const raw = String(value || "").trim();
  if (!raw) return { display: "", accountName: "", transferAccountName: "" };
  if (type === "transfer" && raw.includes("→")) {
    const [accountName = "", transferAccountName = ""] = raw.split("→").map((part) => part.trim());
    return { display: raw, accountName, transferAccountName };
  }
  return { display: raw, accountName: raw, transferAccountName: "" };
}

function buildLedgerMap(rows) {
  const map = new Map();
  (rows || []).forEach((row) => {
    const key = String(row.source_id || "");
    if (!key) return;
    const list = map.get(key) || [];
    list.push(row);
    map.set(key, list);
  });
  return map;
}

function mapTransactionRowToClient(row, ledgerRows = []) {
  const accountMeta = parseStoredAccount(row.account_name, row.type);

  let accountId = "";
  let accountName = accountMeta.accountName || "";
  let transferAccountId = "";
  let transferAccountName = accountMeta.transferAccountName || "";

  if (row.type === "transfer" && ledgerRows.length >= 2) {
    const outRow = ledgerRows.find((entry) => Number(entry.delta) < 0) || ledgerRows[0];
    const inRow = ledgerRows.find((entry) => Number(entry.delta) > 0) || ledgerRows[1] || null;
    accountId = outRow?.account_id || "";
    accountName = outRow?.account_name || accountName;
    transferAccountId = inRow?.account_id || outRow?.related_account_id || "";
    transferAccountName = inRow?.account_name || outRow?.related_account_name || transferAccountName;
  } else if (ledgerRows.length) {
    const main =
      row.type === "income"
        ? ledgerRows.find((entry) => Number(entry.delta) > 0) || ledgerRows[0]
        : ledgerRows.find((entry) => Number(entry.delta) < 0) || ledgerRows[0];
    accountId = main?.account_id || "";
    accountName = main?.account_name || accountName;
  }

  return {
    id: row.id,
    type: row.type,
    amount: Number(row.amount) || 0,
    categoryId: row.category_id || "",
    date: row.tx_date,
    time: normalizeTime(row.tx_time || ""),
    merchant: row.merchant || "",
    note: row.note || "",
    paymentMethod: row.payment_method || "",
    account: accountMeta.display,
    accountId,
    accountName,
    transferAccountId,
    transferAccountName,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  };
}

function mapTransactionClientToRow(tx, userId) {
  return {
    id: tx.id,
    user_id: userId,
    type: tx.type,
    amount: Number(tx.amount) || 0,
    category_id: tx.categoryId || null,
    tx_date: tx.date,
    tx_time: normalizeTime(tx.time || "") || null,
    merchant: tx.merchant || "",
    note: tx.note || "",
    payment_method: tx.paymentMethod || "",
    account_name: tx.account || "",
    created_at: tx.createdAt ? new Date(tx.createdAt).toISOString() : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function mapPlannedRowToClient(row) {
  return {
    id: row.id,
    amount: Number(row.amount) || 0,
    categoryId: row.category_id || "",
    date: row.planned_date,
    time: normalizeTime(row.planned_time || ""),
    merchant: row.merchant || "",
    note: row.note || "",
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  };
}

function mapPlannedClientToRow(p, userId) {
  return {
    id: p.id,
    user_id: userId,
    amount: Number(p.amount) || 0,
    category_id: p.categoryId || null,
    planned_date: p.date,
    planned_time: normalizeTime(p.time || "") || null,
    merchant: p.merchant || "",
    note: p.note || "",
    created_at: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function isBillManagedTransaction(tx) {
  const note = String(tx?.note || "");
  const paymentMethod = String(tx?.paymentMethod || "");
  return paymentMethod === "Bill Payment" || note.startsWith("[Bill Payment]");
}

function txKindMeta(type, reverse = false) {
  if (type === "expense") {
    return reverse
      ? { deltaSign: 1, kind: "spending_expense_delete", sourceType: "spending_transaction_delete" }
      : { deltaSign: -1, kind: "spending_expense", sourceType: "spending_transaction" };
  }
  if (type === "income") {
    return reverse
      ? { deltaSign: -1, kind: "spending_income_delete", sourceType: "spending_transaction_delete" }
      : { deltaSign: 1, kind: "spending_income", sourceType: "spending_transaction" };
  }
  return reverse
    ? { kind: "spending_transfer_delete", sourceType: "spending_transaction_delete" }
    : { kind: "spending_transfer", sourceType: "spending_transaction" };
}

function iconForType(type) {
  if (type === "income") return ArrowUpRight;
  if (type === "transfer") return ArrowLeftRight;
  return ArrowDownRight;
}

function toneForType(type) {
  if (type === "income") return "green";
  if (type === "transfer") return "amber";
  return "red";
}

function statusTone(status) {
  if (status === "Over") {
    return {
      color: "#ffd6df",
      background: "rgba(255,107,127,.12)",
      border: "1px solid rgba(255,107,127,.22)",
    };
  }
  if (status === "Near") {
    return {
      color: "#ffe8b4",
      background: "rgba(245,158,11,.12)",
      border: "1px solid rgba(245,158,11,.24)",
    };
  }
  if (status === "OK") {
    return {
      color: "#cbffe1",
      background: "rgba(74,222,128,.12)",
      border: "1px solid rgba(74,222,128,.24)",
    };
  }
  return {
    color: "#d8e1ff",
    background: "rgba(148,163,184,.12)",
    border: "1px solid rgba(148,163,184,.22)",
  };
}

async function getDefaultCalendarProfileId(userId) {
  const { data, error } = await supabase
    .from("calendar_profiles")
    .select("id,is_default,created_at")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) throw error;
  return data?.[0]?.id ?? null;
}

function calendarTitleForTransaction(tx, category) {
  if (tx.type === "income") {
    return tx.merchant?.trim() ? `Income • ${tx.merchant.trim()}` : "Income";
  }
  return tx.merchant?.trim()
    ? `${category?.name?.trim() || "Expense"} • ${tx.merchant.trim()}`
    : category?.name?.trim() || "Expense";
}

function calendarTitleForPlanned(planned, category) {
  const categoryName = category?.name?.trim() || "Planned Expense";
  return planned.merchant?.trim()
    ? `Planned • ${categoryName} • ${planned.merchant.trim()}`
    : `Planned • ${categoryName}`;
}

async function upsertCalendarEventForTransaction(tx, userId, category) {
  if (tx.type === "transfer" || isBillManagedTransaction(tx)) return;

  const profileId = await getDefaultCalendarProfileId(userId);
  if (!profileId) return;

  const source = tx.type === "income" ? "income" : "spending";
  const payload = {
    user_id: userId,
    profile_id: profileId,
    title: calendarTitleForTransaction(tx, category),
    event_date: tx.date,
    event_time: normalizeTime(tx.time || "") || null,
    end_time: null,
    category: tx.type === "income" ? "Payday" : category?.name || "Expense",
    flow: tx.type === "income" ? "income" : "expense",
    amount: Number(tx.amount) || 0,
    note: tx.note || "",
    status: "scheduled",
    color: tx.type === "income" ? "#22c55e" : "#ef4444",
    source,
    source_id: tx.id,
    source_table: "spending_transactions",
    auto_created: true,
    transaction_type: tx.type === "income" ? "income" : "expense",
    updated_at: new Date().toISOString(),
  };

  const { data: existing, error: findError } = await supabase
    .from("calendar_events")
    .select("id")
    .eq("user_id", userId)
    .eq("profile_id", profileId)
    .eq("source", source)
    .eq("source_id", tx.id)
    .maybeSingle();

  if (findError) throw findError;

  if (existing?.id) {
    const { error: updateError } = await supabase.from("calendar_events").update(payload).eq("id", existing.id);
    if (updateError) throw updateError;
    return;
  }

  const { error: insertError } = await supabase.from("calendar_events").insert([
    { id: uid(), created_at: new Date().toISOString(), ...payload },
  ]);
  if (insertError) throw insertError;
}

async function upsertCalendarEventForPlanned(planned, userId, category) {
  const profileId = await getDefaultCalendarProfileId(userId);
  if (!profileId) return;

  const payload = {
    user_id: userId,
    profile_id: profileId,
    title: calendarTitleForPlanned(planned, category),
    event_date: planned.date,
    event_time: normalizeTime(planned.time || "") || null,
    end_time: null,
    category: "Planned Expense",
    flow: "expense",
    amount: Number(planned.amount) || 0,
    note: planned.note || "",
    status: "scheduled",
    color: "#f59e0b",
    source: "planned_expense",
    source_id: planned.id,
    source_table: "spending_planned_items",
    auto_created: true,
    transaction_type: "expense",
    updated_at: new Date().toISOString(),
  };

  const { data: existing, error: findError } = await supabase
    .from("calendar_events")
    .select("id")
    .eq("user_id", userId)
    .eq("profile_id", profileId)
    .eq("source", "planned_expense")
    .eq("source_id", planned.id)
    .maybeSingle();

  if (findError) throw findError;

  if (existing?.id) {
    const { error: updateError } = await supabase.from("calendar_events").update(payload).eq("id", existing.id);
    if (updateError) throw updateError;
    return;
  }

  const { error: insertError } = await supabase.from("calendar_events").insert([
    { id: uid(), created_at: new Date().toISOString(), ...payload },
  ]);
  if (insertError) throw insertError;
}

async function deleteCalendarEventBySource(userId, source, sourceId) {
  const { error } = await supabase
    .from("calendar_events")
    .delete()
    .eq("user_id", userId)
    .eq("source", source)
    .eq("source_id", sourceId);
  if (error) throw error;
}

function ActionBtn({ children, onClick, variant = "ghost", full = false, type = "button", disabled = false }) {
  const isPrimary = variant === "primary";
  const isDanger = variant === "danger";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="spActionBtn"
      style={{
        width: full ? "100%" : undefined,
        border: isDanger
          ? "1px solid rgba(255,132,163,0.20)"
          : isPrimary
          ? "1px solid rgba(143,177,255,0.22)"
          : "1px solid rgba(214,226,255,0.10)",
        background: isDanger
          ? "linear-gradient(180deg, rgba(255,132,163,0.11), rgba(255,132,163,0.04))"
          : isPrimary
          ? "linear-gradient(180deg, rgba(143,177,255,0.18), rgba(143,177,255,0.06))"
          : "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.014))",
        color: isDanger ? "#ffd3df" : "#f7fbff",
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

function MiniPill({ children, tone = "neutral" }) {
  const tones = {
    neutral: { text: "rgba(255,255,255,0.88)", border: "rgba(214,226,255,0.14)", glow: "rgba(140,170,255,0.08)" },
    green: { text: "#97efc7", border: "rgba(143,240,191,0.18)", glow: "rgba(110,229,173,0.10)" },
    amber: { text: "#f5cf88", border: "rgba(255,204,112,0.18)", glow: "rgba(255,194,92,0.10)" },
    red: { text: "#ffb4c5", border: "rgba(255,132,163,0.18)", glow: "rgba(255,108,145,0.10)" },
    blue: { text: "#bfd6ff", border: "rgba(143,177,255,0.18)", glow: "rgba(110,163,255,0.10)" },
  };
  const meta = tones[tone] || tones.neutral;

  return (
    <div
      style={{
        minHeight: 30,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "0 10px",
        borderRadius: 999,
        border: `1px solid ${meta.border}`,
        background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012))",
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.03), 0 0 10px ${meta.glow}`,
        color: meta.text,
        fontSize: 11,
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
  );
}

function PaneHeader({ title, subcopy, right }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 10,
        flexWrap: "wrap",
        marginBottom: 12,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 17, lineHeight: 1.08, fontWeight: 850, letterSpacing: "-0.035em", color: "#fff" }}>
          {title}
        </div>
        {subcopy ? (
          <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.45, color: "rgba(255,255,255,0.60)" }}>{subcopy}</div>
        ) : null}
      </div>
      {right || null}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, detail, tone = "neutral" }) {
  const colors = {
    neutral: { text: "#fff", border: "rgba(214,226,255,0.14)", glow: "rgba(140,170,255,0.08)", bg: "rgba(10,15,24,0.66)" },
    green: { text: "#97efc7", border: "rgba(143,240,191,0.18)", glow: "rgba(110,229,173,0.10)", bg: "rgba(11,22,17,0.66)" },
    amber: { text: "#f5cf88", border: "rgba(255,204,112,0.18)", glow: "rgba(255,194,92,0.10)", bg: "rgba(22,17,11,0.66)" },
    red: { text: "#ffb4c5", border: "rgba(255,132,163,0.18)", glow: "rgba(255,108,145,0.10)", bg: "rgba(22,11,15,0.66)" },
    blue: { text: "#bfd6ff", border: "rgba(143,177,255,0.18)", glow: "rgba(110,163,255,0.10)", bg: "rgba(10,16,28,0.66)" },
  };
  const meta = colors[tone] || colors.neutral;

  return (
    <GlassPane tone={tone} size="card" style={{ height: "100%" }}>
      <div style={{ minHeight: 110, display: "grid", gridTemplateRows: "auto auto 1fr", gap: 7 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 12,
            display: "grid",
            placeItems: "center",
            border: `1px solid ${meta.border}`,
            background: meta.bg,
            color: meta.text,
            boxShadow: `0 0 10px ${meta.glow}`,
          }}
        >
          <Icon size={15} />
        </div>

        <div>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".2em", fontWeight: 800, color: "rgba(255,255,255,0.40)" }}>
            {label}
          </div>
          <div style={{ marginTop: 8, fontSize: "clamp(18px, 2.2vw, 28px)", lineHeight: 1, fontWeight: 850, letterSpacing: "-0.05em", color: meta.text }}>
            {value}
          </div>
        </div>

        <div style={{ fontSize: 11.5, lineHeight: 1.4, color: "rgba(255,255,255,0.60)" }}>{detail}</div>
      </div>
    </GlassPane>
  );
}

function ProgressBar({ value = 0, color = "var(--lcc-green)" }) {
  const pct = clamp(Number(value) || 0, 0, 100);
  return (
    <div className="spProgress">
      <div className="spProgressFill" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color} 0%, rgba(255,255,255,.92) 220%)`, boxShadow: `0 0 18px ${color}44, 0 0 26px ${color}18` }} />
    </div>
  );
}

function SpendingBarsChart({ data }) {
  const width = 900;
  const height = 240;
  const padX = 26;
  const padTop = 18;
  const padBottom = 34;
  const chartH = height - padTop - padBottom;
  const chartW = width - padX * 2;
  const max = Math.max(...data.map((d) => d.value), 10);
  const slotW = chartW / Math.max(data.length, 1);
  const barW = Math.max(6, slotW - (data.length > 20 ? 4 : 8));
  const bars = data.map((d, i) => {
    const x = padX + i * slotW + (slotW - barW) / 2;
    const h = d.value <= 0 ? 4 : Math.max(10, (d.value / max) * chartH);
    const y = padTop + chartH - h;
    return { ...d, x, y, h };
  });

  return (
    <div className="spBarsWrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="spBarsSvg">
        <defs>
          <linearGradient id="spBarFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#ff8b9c" stopOpacity="0.98" />
            <stop offset="100%" stopColor="#ff6177" stopOpacity="0.58" />
          </linearGradient>
        </defs>

        {Array.from({ length: 4 }).map((_, i) => {
          const y = padTop + (i / 3) * chartH;
          return <line key={i} x1={padX} x2={padX + chartW} y1={y} y2={y} stroke="rgba(255,255,255,0.055)" strokeDasharray="5 7" />;
        })}

        {bars.map((b) => (
          <g key={b.key}>
            <rect x={b.x} y={b.y} width={barW} height={b.h} rx={Math.min(12, barW / 2)} fill="url(#spBarFill)" opacity="0.95" />
            <text x={b.x + barW / 2} y={height - 8} textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.38)">
              {b.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function periodTrendData(rows, period) {
  if (period === "year") {
    const monthMap = new Map();
    rows.forEach((row) => {
      if (row.type !== "expense") return;
      const date = toDate(row.date);
      if (!Number.isFinite(date.getTime())) return;
      const key = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
      monthMap.set(key, roundMoneyValue((monthMap.get(key) || 0) + roundMoneyValue(row.amount)));
    });
    return Array.from(monthMap.entries())
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
      .map(([key, value]) => ({ key, label: key.slice(5), value }));
  }

  const dayMap = new Map();
  rows.forEach((row) => {
    if (row.type !== "expense") return;
    dayMap.set(row.date, roundMoneyValue((dayMap.get(row.date) || 0) + roundMoneyValue(row.amount)));
  });
  return Array.from(dayMap.entries())
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    .map(([key, value]) => ({ key, label: shortDate(key), value }));
}

function emptySelection() {
  return { kind: "tx", id: null };
}

export default function SpendingPage() {
  const [user, setUser] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [pageError, setPageError] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const [tab, setTab] = React.useState("overview");
  const [period, setPeriod] = React.useState("month");
  const [search, setSearch] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [selectedRecord, setSelectedRecord] = React.useState(emptySelection());

  const [categories, setCategories] = React.useState(DEFAULT_CATEGORIES);
  const [budgets, setBudgets] = React.useState(DEFAULT_BUDGETS);
  const [accounts, setAccounts] = React.useState([]);
  const [transactions, setTransactions] = React.useState([]);
  const [plannedItems, setPlannedItems] = React.useState([]);

  const [mode, setMode] = React.useState("now");
  const [qaType, setQaType] = React.useState("expense");
  const [qaAmount, setQaAmount] = React.useState("");
  const [qaDate, setQaDate] = React.useState(todayISO());
  const [qaTime, setQaTime] = React.useState("");
  const [qaCategoryId, setQaCategoryId] = React.useState("groceries");
  const [qaMerchant, setQaMerchant] = React.useState("");
  const [qaNote, setQaNote] = React.useState("");
  const [qaPayment, setQaPayment] = React.useState("Card");
  const [qaAccountId, setQaAccountId] = React.useState("");
  const [qaTransferToAccountId, setQaTransferToAccountId] = React.useState("");
  const [convertAccountId, setConvertAccountId] = React.useState("");

  const [newCategoryName, setNewCategoryName] = React.useState("");
  const [newCategoryGroup, setNewCategoryGroup] = React.useState("Other");
  const [budgetEditorCategoryId, setBudgetEditorCategoryId] = React.useState("");
  const [budgetEditorValue, setBudgetEditorValue] = React.useState("");
  const [mobileSection, setMobileSection] = React.useState("focus");

  const range = React.useMemo(() => periodBounds(period), [period]);

  const categoriesById = React.useMemo(() => {
    const map = new Map();
    categories.forEach((c) => map.set(c.id, c));
    return map;
  }, [categories]);

  const groups = React.useMemo(() => ["All", ...Array.from(new Set(categories.map((c) => c.group))).sort()], [categories]);

  const getAccountById = React.useCallback((accountId) => accounts.find((account) => account.id === accountId) || null, [accounts]);

  const getTransactionAccountSelection = React.useCallback(
    (tx) => {
      const fromAccount =
        (tx.accountId ? getAccountById(tx.accountId) : null) ||
        (tx.accountName ? findAccountByName(accounts, tx.accountName) : null) ||
        (tx.account ? findAccountByName(accounts, tx.account) : null);

      const toAccount =
        tx.type === "transfer"
          ? (tx.transferAccountId ? getAccountById(tx.transferAccountId) : null) ||
            (tx.transferAccountName ? findAccountByName(accounts, tx.transferAccountName) : null)
          : null;

      return { fromAccount, toAccount };
    },
    [accounts, getAccountById]
  );

  const clearQuickAdd = React.useCallback(() => {
    setQaAmount("");
    setQaDate(todayISO());
    setQaTime("");
    setQaMerchant("");
    setQaNote("");
    setQaPayment("Card");
    setQaType("expense");
    setQaCategoryId(categories[0]?.id || "groceries");
    setQaAccountId(accounts[0]?.id || "");
    setQaTransferToAccountId(accounts.find((account) => account.id !== (accounts[0]?.id || ""))?.id || "");
    setMode("now");
  }, [accounts, categories]);

  const loadAll = React.useCallback(
    async (preferredSelection = null) => {
      setLoading(true);
      setPageError("");

      try {
        const {
          data: { user: currentUser },
          error: userErr,
        } = await supabase.auth.getUser();

        if (userErr) throw userErr;
        setUser(currentUser || null);

        if (!currentUser) {
          setAccounts([]);
          setTransactions([]);
          setPlannedItems([]);
          setLoading(false);
          return;
        }

        const [catRes, budgetRes, accountRes, txRes, plannedRes, ledgerRes] = await Promise.all([
          supabase.from("spending_categories").select("*").eq("user_id", currentUser.id).order("group_name").order("name"),
          supabase.from("spending_budgets").select("*").eq("user_id", currentUser.id),
          supabase.from("accounts").select("id,name,account_type,balance").eq("user_id", currentUser.id).order("name"),
          supabase
            .from("spending_transactions")
            .select("*")
            .eq("user_id", currentUser.id)
            .order("tx_date", { ascending: false })
            .order("tx_time", { ascending: false })
            .order("created_at", { ascending: false }),
          supabase
            .from("spending_planned_items")
            .select("*")
            .eq("user_id", currentUser.id)
            .order("planned_date", { ascending: true })
            .order("planned_time", { ascending: true })
            .order("created_at", { ascending: false }),
          supabase
            .from("account_transactions")
            .select("source_id,account_id,related_account_id,related_account_name,delta,kind,source_type")
            .eq("user_id", currentUser.id)
            .eq("source_type", "spending_transaction"),
        ]);

        if (catRes.error) throw catRes.error;
        if (budgetRes.error) throw budgetRes.error;
        if (accountRes.error) throw accountRes.error;
        if (txRes.error) throw txRes.error;
        if (plannedRes.error) throw plannedRes.error;
        if (ledgerRes.error) throw ledgerRes.error;

        const loadedCategories = (catRes.data || []).length > 0 ? (catRes.data || []).map(mapCategoryRowToClient) : DEFAULT_CATEGORIES;
        const nextBudgets = { weekly: {}, monthly: {}, yearly: {} };
        if ((budgetRes.data || []).length > 0) {
          for (const row of budgetRes.data || []) {
            if (!nextBudgets[row.period_mode]) continue;
            nextBudgets[row.period_mode][row.category_id] = Number(row.amount) || 0;
          }
        } else {
          nextBudgets.weekly = { ...DEFAULT_BUDGETS.weekly };
          nextBudgets.monthly = { ...DEFAULT_BUDGETS.monthly };
          nextBudgets.yearly = { ...DEFAULT_BUDGETS.yearly };
        }

        const loadedAccounts = (accountRes.data || []).map(mapAccountRowToClient);
        const ledgerMap = buildLedgerMap(ledgerRes.data || []);
        const loadedTransactions = (txRes.data || [])
          .map((row) => mapTransactionRowToClient(row, ledgerMap.get(String(row.id)) || []))
          .sort((a, b) => {
            if (b.date !== a.date) return String(b.date).localeCompare(String(a.date));
            if ((b.time || "") !== (a.time || "")) return String(b.time || "").localeCompare(String(a.time || ""));
            return Number(b.createdAt || 0) - Number(a.createdAt || 0);
          });
        const loadedPlanned = (plannedRes.data || [])
          .map(mapPlannedRowToClient)
          .sort((a, b) => {
            if (a.date !== b.date) return String(a.date).localeCompare(String(b.date));
            if ((a.time || "") !== (b.time || "")) return String(a.time || "").localeCompare(String(b.time || ""));
            return Number(a.createdAt || 0) - Number(b.createdAt || 0);
          });

        setCategories(loadedCategories);
        setBudgets(nextBudgets);
        setAccounts(loadedAccounts);
        setTransactions(loadedTransactions);
        setPlannedItems(loadedPlanned);

        const firstAccountId = loadedAccounts[0]?.id || "";
        setQaCategoryId((prev) => (loadedCategories.some((c) => c.id === prev) ? prev : loadedCategories[0]?.id || "groceries"));
        setQaAccountId((prev) => (loadedAccounts.some((account) => account.id === prev) ? prev : firstAccountId));
        setConvertAccountId((prev) => (loadedAccounts.some((account) => account.id === prev) ? prev : firstAccountId));
        setQaTransferToAccountId((prev) => {
          const stillGood = prev && loadedAccounts.some((account) => account.id === prev) && prev !== (qaAccountId || firstAccountId);
          if (stillGood) return prev;
          return loadedAccounts.find((account) => account.id !== (qaAccountId || firstAccountId))?.id || "";
        });
        setBudgetEditorCategoryId((prev) => (loadedCategories.some((c) => c.id === prev) ? prev : loadedCategories[0]?.id || ""));

        setSelectedRecord((prev) => {
          if (
            preferredSelection &&
            ((preferredSelection.kind === "tx" && loadedTransactions.some((tx) => tx.id === preferredSelection.id)) ||
              (preferredSelection.kind === "planned" && loadedPlanned.some((p) => p.id === preferredSelection.id)))
          ) {
            return preferredSelection;
          }

          const stillExists =
            (prev.kind === "tx" && loadedTransactions.some((tx) => tx.id === prev.id)) ||
            (prev.kind === "planned" && loadedPlanned.some((p) => p.id === prev.id));

          if (stillExists) return prev;
          if (loadedTransactions[0]) return { kind: "tx", id: loadedTransactions[0].id };
          if (loadedPlanned[0]) return { kind: "planned", id: loadedPlanned[0].id };
          return emptySelection();
        });
      } catch (err) {
        setPageError(err?.message || "Failed to load spending page.");
      } finally {
        setLoading(false);
      }
    },
    [qaAccountId]
  );

  React.useEffect(() => {
    loadAll();
  }, [loadAll]);

  React.useEffect(() => {
    if (!status) return;
    const id = setTimeout(() => setStatus(""), 3200);
    return () => clearTimeout(id);
  }, [status]);

  React.useEffect(() => {
    if (!categories.length) return;
    if (categories.some((c) => c.id === qaCategoryId)) return;
    setQaCategoryId(categories[0].id);
  }, [categories, qaCategoryId]);

  React.useEffect(() => {
    if (!accounts.length) {
      setQaAccountId("");
      return;
    }
    setQaAccountId((prev) => (accounts.some((account) => account.id === prev) ? prev : accounts[0].id));
  }, [accounts]);

  React.useEffect(() => {
    if (accounts.length < 2) {
      setQaTransferToAccountId("");
      return;
    }
    setQaTransferToAccountId((prev) => {
      if (prev && accounts.some((account) => account.id === prev) && prev !== qaAccountId) return prev;
      return accounts.find((account) => account.id !== qaAccountId)?.id || "";
    });
  }, [accounts, qaAccountId]);

  React.useEffect(() => {
    if (!accounts.length) {
      setConvertAccountId("");
      return;
    }
    setConvertAccountId((prev) => (accounts.some((account) => account.id === prev) ? prev : accounts[0].id));
  }, [accounts]);

  const filteredTransactions = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions
      .filter((t) => inRange(t.date, range.start, range.end))
      .filter((t) => (typeFilter === "all" ? true : t.type === typeFilter))
      .filter((t) => (categoryFilter === "all" ? true : t.categoryId === categoryFilter))
      .filter((t) => {
        if (!q) return true;
        const cat = categoriesById.get(t.categoryId)?.name ?? "";
        return `${t.merchant} ${t.note} ${t.date} ${t.time} ${cat} ${t.amount} ${t.paymentMethod} ${t.account}`
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => {
        if (b.date !== a.date) return String(b.date).localeCompare(String(a.date));
        if ((b.time || "") !== (a.time || "")) return String(b.time || "").localeCompare(String(a.time || ""));
        return Number(b.createdAt || 0) - Number(a.createdAt || 0);
      });
  }, [transactions, range.start, range.end, typeFilter, categoryFilter, search, categoriesById]);

  const filteredPlanned = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return plannedItems
      .filter((p) => inRange(p.date, range.start, range.end))
      .filter((p) => (categoryFilter === "all" ? true : p.categoryId === categoryFilter))
      .filter((p) => {
        if (!q) return true;
        const cat = categoriesById.get(p.categoryId)?.name ?? "";
        return `${p.merchant} ${p.note} ${p.date} ${p.time} ${cat} ${p.amount}`.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (a.date !== b.date) return String(a.date).localeCompare(String(b.date));
        if ((a.time || "") !== (b.time || "")) return String(a.time || "").localeCompare(String(b.time || ""));
        return Number(a.createdAt || 0) - Number(b.createdAt || 0);
      });
  }, [plannedItems, range.start, range.end, categoryFilter, search, categoriesById]);

  const previousRange = React.useMemo(() => getPreviousRange(period, range), [period, range]);
  const previousTransactions = React.useMemo(() => transactions.filter((t) => inRange(t.date, previousRange.start, previousRange.end)), [transactions, previousRange]);

  const totals = React.useMemo(() => {
    let expense = 0;
    let income = 0;
    let transfer = 0;
    filteredTransactions.forEach((tx) => {
      if (tx.type === "expense") expense += Number(tx.amount) || 0;
      if (tx.type === "income") income += Number(tx.amount) || 0;
      if (tx.type === "transfer") transfer += Number(tx.amount) || 0;
    });

    const plannedExpense = filteredPlanned.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    return {
      expense: roundMoneyValue(expense),
      income: roundMoneyValue(income),
      transfer: roundMoneyValue(transfer),
      plannedExpense: roundMoneyValue(plannedExpense),
      forecastNet: roundMoneyValue(income - expense - plannedExpense),
    };
  }, [filteredTransactions, filteredPlanned]);

  const previousExpense = React.useMemo(() => sumExpenses(previousTransactions), [previousTransactions]);
  const expenseTrend = React.useMemo(() => trendMeta(totals.expense, previousExpense), [totals.expense, previousExpense]);
  const trendData = React.useMemo(() => periodTrendData(filteredTransactions, period), [filteredTransactions, period]);
  const upcomingItems = React.useMemo(() => plannedItems.filter((p) => p.date >= todayISO()).slice(0, 8), [plannedItems]);

  const plannedByCategory = React.useMemo(() => {
    const map = new Map();
    filteredPlanned.forEach((planned) => {
      map.set(planned.categoryId || "uncat", roundMoneyValue((map.get(planned.categoryId || "uncat") || 0) + roundMoneyValue(planned.amount)));
    });
    return map;
  }, [filteredPlanned]);

  const totalsByCategory = React.useMemo(() => {
    return categories
      .map((category) => {
        const spent = roundMoneyValue(
          filteredTransactions
            .filter((tx) => tx.type === "expense" && tx.categoryId === category.id)
            .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0)
        );
        const planned = roundMoneyValue(plannedByCategory.get(category.id) || 0);
        const forecast = roundMoneyValue(spent + planned);
        const budget = roundMoneyValue(Number(budgets?.[range.budgetMode]?.[category.id] || 0));
        return {
          categoryId: category.id,
          category,
          spent,
          planned,
          forecast,
          budget,
          status: budgetStatus(forecast, budget),
          pct: budget > 0 ? clamp((forecast / budget) * 100, 0, 100) : 0,
        };
      })
      .sort((a, b) => b.forecast - a.forecast);
  }, [categories, filteredTransactions, plannedByCategory, budgets, range.budgetMode]);

  const budgetLoad = React.useMemo(() => {
    const budgetTotal = totalsByCategory.reduce((sum, row) => sum + (row.budget || 0), 0);
    const forecast = totalsByCategory.reduce((sum, row) => sum + (row.forecast || 0), 0);
    return budgetTotal > 0 ? clamp((forecast / budgetTotal) * 100, 0, 999) : 0;
  }, [totalsByCategory]);

  const forecastRemaining = React.useMemo(() => {
    const budgetTotal = totalsByCategory.reduce((sum, row) => sum + (row.budget || 0), 0);
    const forecast = totalsByCategory.reduce((sum, row) => sum + (row.forecast || 0), 0);
    return roundMoneyValue(budgetTotal - forecast);
  }, [totalsByCategory]);

  const rosterTransactions = filteredTransactions.slice(0, 60);
  const rosterPlanned = filteredPlanned.slice(0, 40);

  const selectedTx = React.useMemo(
    () => (selectedRecord.kind === "tx" ? transactions.find((tx) => tx.id === selectedRecord.id) || null : null),
    [selectedRecord, transactions]
  );
  const selectedPlanned = React.useMemo(
    () => (selectedRecord.kind === "planned" ? plannedItems.find((p) => p.id === selectedRecord.id) || null : null),
    [selectedRecord, plannedItems]
  );
  const selectedCategory = React.useMemo(() => {
    const id = selectedTx?.categoryId || selectedPlanned?.categoryId || budgetEditorCategoryId || categories[0]?.id || "";
    return categories.find((category) => category.id === id) || null;
  }, [selectedTx, selectedPlanned, budgetEditorCategoryId, categories]);

  const selectedBudget = React.useMemo(() => (selectedCategory ? Number(budgets?.[range.budgetMode]?.[selectedCategory.id] || 0) : 0), [selectedCategory, budgets, range.budgetMode]);
  const selectedSpent = React.useMemo(() => {
    if (!selectedCategory) return 0;
    const row = totalsByCategory.find((item) => item.categoryId === selectedCategory.id);
    return Number(row?.spent || 0);
  }, [selectedCategory, totalsByCategory]);
  const selectedPlannedTotal = React.useMemo(() => (selectedCategory ? Number(plannedByCategory.get(selectedCategory.id) || 0) : 0), [selectedCategory, plannedByCategory]);
  const selectedForecast = roundMoneyValue(selectedSpent + selectedPlannedTotal);
  const selectedLoadPct = selectedBudget > 0 ? (selectedForecast / selectedBudget) * 100 : 0;

  async function applyLedgerForTransaction(tx, options = {}) {
    const { reverse = false } = options;
    const { fromAccount, toAccount } = getTransactionAccountSelection(tx);
    const amount = roundMoneyValue(tx.amount);
    const meta = txKindMeta(tx.type, reverse);
    if (!(amount > 0)) return;

    if (tx.type === "transfer") {
      const realFrom = reverse ? toAccount : fromAccount;
      const realTo = reverse ? fromAccount : toAccount;
      if (!realFrom?.id || !realTo?.id) throw new Error("Transfer accounts could not be resolved.");
      await writeAccountTransfer({
        userId: user.id,
        fromAccountId: realFrom.id,
        toAccountId: realTo.id,
        amount,
        note: tx.note || tx.merchant || "Transfer",
        sourceType: meta.sourceType,
        sourceId: tx.id,
        createdAt: ledgerDateTimeISO(tx.date, tx.time),
      });
      return;
    }

    if (!fromAccount?.id) throw new Error("Selected account could not be resolved.");
    await writeAccountDelta({
      userId: user.id,
      accountId: fromAccount.id,
      delta: roundMoneyValue(amount * meta.deltaSign),
      kind: meta.kind,
      amount,
      note: tx.note || tx.merchant || (tx.type === "income" ? "Income" : "Expense"),
      sourceType: meta.sourceType,
      sourceId: tx.id,
      createdAt: ledgerDateTimeISO(tx.date, tx.time),
    });
  }

  async function saveCategory() {
    if (!user) return;
    const name = String(newCategoryName || "").trim();
    const group = String(newCategoryGroup || "Other").trim() || "Other";
    if (!name) {
      setPageError("Category name required.");
      return;
    }

    setSaving(true);
    setPageError("");
    try {
      const category = normalizeCategory({ id: uid(), name, group, color: "#94a3b8", isBudgeted: true });
      const { error } = await supabase.from("spending_categories").upsert([mapCategoryClientToRow(category, user.id)]);
      if (error) throw error;
      setNewCategoryName("");
      setNewCategoryGroup("Other");
      setStatus("Category added.");
      await loadAll();
    } catch (err) {
      setPageError(err?.message || "Failed to save category.");
    } finally {
      setSaving(false);
    }
  }

  async function saveBudgetValue() {
    if (!user || !budgetEditorCategoryId) return;
    const amount = parseMoneyInput(budgetEditorValue);
    if (!Number.isFinite(amount) || amount < 0) {
      setPageError("Enter a valid budget amount.");
      return;
    }

    setSaving(true);
    setPageError("");
    try {
      const { error } = await supabase.from("spending_budgets").upsert(
        [
          {
            user_id: user.id,
            period_mode: range.budgetMode,
            category_id: budgetEditorCategoryId,
            amount: roundMoneyValue(amount),
            updated_at: new Date().toISOString(),
          },
        ],
        { onConflict: "user_id,period_mode,category_id" }
      );
      if (error) throw error;
      setStatus("Budget updated.");
      await loadAll(selectedRecord);
    } catch (err) {
      setPageError(err?.message || "Failed to save budget.");
    } finally {
      setSaving(false);
    }
  }

  async function addNow() {
    setPageError("");
    if (!user) return;
    if (!accounts.length) {
      setPageError("Add at least one account first.");
      return;
    }

    const amt = parseMoneyInput(qaAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setPageError("Enter a valid amount.");
      return;
    }
    if (!qaDate) {
      setPageError("Date required.");
      return;
    }
    if (qaType === "expense" && !qaCategoryId && qaPayment !== "Bill Payment") {
      setPageError("Pick a category.");
      return;
    }
    if ((qaType === "expense" || qaType === "income") && !qaAccountId) {
      setPageError("Pick an account.");
      return;
    }
    if (qaType === "transfer" && (!qaAccountId || !qaTransferToAccountId)) {
      setPageError("Pick both transfer accounts.");
      return;
    }
    if (qaType === "transfer" && qaAccountId === qaTransferToAccountId) {
      setPageError("Transfer accounts must be different.");
      return;
    }

    const roundedAmount = roundMoneyValue(amt);
    const fromAccount = getAccountById(qaAccountId);
    const toAccount = getAccountById(qaTransferToAccountId);

    setSaving(true);
    try {
      const tx = {
        id: uid(),
        type: qaType,
        amount: roundedAmount,
        categoryId: qaType === "expense" ? qaCategoryId : "",
        date: qaDate,
        time: normalizeTime(qaTime),
        merchant: qaMerchant.trim(),
        note: qaNote.trim(),
        paymentMethod: qaType === "transfer" ? "Transfer" : qaPayment,
        account: qaType === "transfer" ? [fromAccount?.name, toAccount?.name].filter(Boolean).join(" → ") : fromAccount?.name || "",
        accountId: qaType === "transfer" ? fromAccount?.id || "" : fromAccount?.id || "",
        accountName: qaType === "transfer" ? fromAccount?.name || "" : fromAccount?.name || "",
        transferAccountId: qaType === "transfer" ? toAccount?.id || "" : "",
        transferAccountName: qaType === "transfer" ? toAccount?.name || "" : "",
        createdAt: Date.now(),
      };

      const { data, error } = await supabase.from("spending_transactions").insert([mapTransactionClientToRow(tx, user.id)]).select().single();
      if (error) throw error;

      const saved = mapTransactionRowToClient(data, []);
      const ledgerTx = { ...saved, accountId: tx.accountId, accountName: tx.accountName, transferAccountId: tx.transferAccountId, transferAccountName: tx.transferAccountName, account: tx.account };

      try {
        await applyLedgerForTransaction(ledgerTx);
        const category = categoriesById.get(saved.categoryId);
        await upsertCalendarEventForTransaction(ledgerTx, user.id, category);
      } catch (syncError) {
        await supabase.from("spending_transactions").delete().eq("id", saved.id).eq("user_id", user.id);
        try {
          await applyLedgerForTransaction(ledgerTx, { reverse: true });
        } catch {}
        throw syncError;
      }

      clearQuickAdd();
      setStatus("Transaction saved.");
      await loadAll({ kind: "tx", id: saved.id });
      setMobileSection("focus");
    } catch (err) {
      setPageError(err?.message || "Failed to save transaction.");
    } finally {
      setSaving(false);
    }
  }

  async function addPlanned() {
    setPageError("");
    if (!user) return;

    const amt = parseMoneyInput(qaAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setPageError("Enter a valid amount.");
      return;
    }
    if (!qaDate) {
      setPageError("Planned date required.");
      return;
    }
    if (!qaCategoryId) {
      setPageError("Pick a category.");
      return;
    }

    setSaving(true);
    try {
      const planned = {
        id: uid(),
        amount: roundMoneyValue(amt),
        categoryId: qaCategoryId,
        date: qaDate,
        time: normalizeTime(qaTime),
        merchant: qaMerchant.trim(),
        note: qaNote.trim(),
        createdAt: Date.now(),
      };

      const { data, error } = await supabase.from("spending_planned_items").insert([mapPlannedClientToRow(planned, user.id)]).select().single();
      if (error) throw error;

      const saved = mapPlannedRowToClient(data);
      const category = categoriesById.get(saved.categoryId);
      try {
        await upsertCalendarEventForPlanned(saved, user.id, category);
      } catch (calendarError) {
        await supabase.from("spending_planned_items").delete().eq("id", saved.id).eq("user_id", user.id);
        throw calendarError;
      }

      clearQuickAdd();
      setStatus("Planned item saved.");
      await loadAll({ kind: "planned", id: saved.id });
      setMobileSection("focus");
    } catch (err) {
      setPageError(err?.message || "Failed to save planned item.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTransaction(id) {
    if (!user) return;
    const tx = transactions.find((entry) => entry.id === id);
    if (!tx) return;
    if (isBillManagedTransaction(tx)) {
      setPageError("Delete bill payment entries from the Bills page.");
      return;
    }
    if (!window.confirm("Delete this transaction?")) return;

    try {
      const { fromAccount, toAccount } = getTransactionAccountSelection(tx);
      const ledgerTx = {
        ...tx,
        accountId: fromAccount?.id || tx.accountId || "",
        accountName: fromAccount?.name || tx.accountName || tx.account || "",
        transferAccountId: toAccount?.id || tx.transferAccountId || "",
        transferAccountName: toAccount?.name || tx.transferAccountName || "",
      };

      await applyLedgerForTransaction(ledgerTx, { reverse: true });

      const { error } = await supabase.from("spending_transactions").delete().eq("id", id).eq("user_id", user.id);
      if (error) {
        await applyLedgerForTransaction(ledgerTx).catch(() => {});
        throw error;
      }

      if (tx.type === "income") {
        await deleteCalendarEventBySource(user.id, "income", id).catch(() => {});
      } else if (tx.type === "expense") {
        await deleteCalendarEventBySource(user.id, "spending", id).catch(() => {});
      }

      setStatus("Transaction deleted.");
      await loadAll();
    } catch (err) {
      setPageError(err?.message || "Failed to delete transaction.");
    }
  }

  async function duplicateTransaction(tx) {
    if (!user) return;
    if (isBillManagedTransaction(tx)) {
      setPageError("Duplicate bills from the Bills page so debt and history stay synced.");
      return;
    }

    try {
      const { fromAccount, toAccount } = getTransactionAccountSelection(tx);
      const clone = {
        ...tx,
        id: uid(),
        createdAt: Date.now(),
        account: tx.type === "transfer" ? [fromAccount?.name || tx.accountName, toAccount?.name || tx.transferAccountName].filter(Boolean).join(" → ") : fromAccount?.name || tx.accountName || tx.account,
        accountId: fromAccount?.id || tx.accountId || "",
        accountName: fromAccount?.name || tx.accountName || tx.account || "",
        transferAccountId: toAccount?.id || tx.transferAccountId || "",
        transferAccountName: toAccount?.name || tx.transferAccountName || "",
      };

      const { data, error } = await supabase.from("spending_transactions").insert([mapTransactionClientToRow(clone, user.id)]).select().single();
      if (error) throw error;

      const saved = mapTransactionRowToClient(data, []);
      const ledgerTx = { ...saved, accountId: clone.accountId, accountName: clone.accountName, transferAccountId: clone.transferAccountId, transferAccountName: clone.transferAccountName, account: clone.account };

      try {
        await applyLedgerForTransaction(ledgerTx);
        const category = categoriesById.get(saved.categoryId);
        await upsertCalendarEventForTransaction(ledgerTx, user.id, category);
      } catch (syncError) {
        await supabase.from("spending_transactions").delete().eq("id", saved.id).eq("user_id", user.id);
        try {
          await applyLedgerForTransaction(ledgerTx, { reverse: true });
        } catch {}
        throw syncError;
      }

      setStatus("Transaction duplicated.");
      await loadAll({ kind: "tx", id: saved.id });
      setMobileSection("focus");
    } catch (err) {
      setPageError(err?.message || "Failed to duplicate transaction.");
    }
  }

  async function deletePlanned(id) {
    if (!user) return;
    if (!window.confirm("Delete this planned item?")) return;
    try {
      const { error } = await supabase.from("spending_planned_items").delete().eq("id", id).eq("user_id", user.id);
      if (error) throw error;
      await deleteCalendarEventBySource(user.id, "planned_expense", id).catch(() => {});
      setStatus("Planned item deleted.");
      await loadAll();
    } catch (err) {
      setPageError(err?.message || "Failed to delete planned item.");
    }
  }

  async function convertPlanned(planned) {
    if (!user) return;
    if (!accounts.length) {
      setPageError("Add at least one account first.");
      return;
    }
    if (!window.confirm("Convert this planned item into a real transaction?")) return;

    const account = getAccountById(convertAccountId) || accounts[0] || null;
    if (!account) {
      setPageError("Pick an account first.");
      return;
    }

    setSaving(true);
    try {
      const tx = {
        id: uid(),
        type: "expense",
        amount: roundMoneyValue(planned.amount),
        categoryId: planned.categoryId || "",
        date: planned.date,
        time: planned.time || "",
        merchant: planned.merchant || "",
        note: planned.note || "",
        paymentMethod: "Card",
        account: account.name || "",
        accountId: account.id,
        accountName: account.name || "",
        transferAccountId: "",
        transferAccountName: "",
        createdAt: Date.now(),
      };

      const { data, error } = await supabase.from("spending_transactions").insert([mapTransactionClientToRow(tx, user.id)]).select().single();
      if (error) throw error;

      const saved = mapTransactionRowToClient(data, []);
      const ledgerTx = { ...saved, accountId: tx.accountId, accountName: tx.accountName, account: tx.account };

      try {
        await applyLedgerForTransaction(ledgerTx);
        const category = categoriesById.get(saved.categoryId);
        await upsertCalendarEventForTransaction(ledgerTx, user.id, category);
      } catch (syncError) {
        await supabase.from("spending_transactions").delete().eq("id", saved.id).eq("user_id", user.id);
        try {
          await applyLedgerForTransaction(ledgerTx, { reverse: true });
        } catch {}
        throw syncError;
      }

      const deletePlannedRes = await supabase.from("spending_planned_items").delete().eq("id", planned.id).eq("user_id", user.id);
      if (deletePlannedRes.error) {
        await supabase.from("spending_transactions").delete().eq("id", saved.id).eq("user_id", user.id);
        try {
          await applyLedgerForTransaction(ledgerTx, { reverse: true });
        } catch {}
        await deleteCalendarEventBySource(user.id, "spending", saved.id).catch(() => {});
        throw deletePlannedRes.error;
      }

      await deleteCalendarEventBySource(user.id, "planned_expense", planned.id).catch(() => {});
      setStatus("Planned item converted.");
      await loadAll({ kind: "tx", id: saved.id });
      setMobileSection("focus");
    } catch (err) {
      setPageError(err?.message || "Failed to convert planned item.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <>
        <div className="spRoot">
          <div className="spGate">Loading spending…</div>
        </div>
        <style jsx global>{styles}</style>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <div className="spRoot">
          <div className="spGate">Sign in to use spending.</div>
        </div>
        <style jsx global>{styles}</style>
      </>
    );
  }

  const selectedTypeIcon = selectedTx ? iconForType(selectedTx.type) : selectedPlanned ? CalendarClock : Wallet;
  const SelectedIcon = selectedTypeIcon;

  return (
    <>
      <div className="spRoot">
        <div className="spSummaryStrip">
          <div className="spSummaryLeft">
            <div className="spTitleWrap">
              <div className="spEyebrow">Spending</div>
              <div className="spPageTitle">Spending Control</div>
            </div>

            <div className="spSummaryStats">
              <div className="spMiniStat">
                <span className="spMiniLabel">{range.label}</span>
                <span className="spMiniValue">{money(totals.expense)}</span>
              </div>
              <div className="spMiniStat">
                <span className="spMiniLabel">Income</span>
                <span className="spMiniValue">{money(totals.income)}</span>
              </div>
              <div className="spMiniStat">
                <span className="spMiniLabel">Planned</span>
                <span className="spMiniValue">{money(totals.plannedExpense)}</span>
              </div>
              <div className="spMiniStat">
                <span className="spMiniLabel">Forecast</span>
                <span className={`spMiniValue ${totals.forecastNet < 0 ? "spTextRed" : "spTextGreen"}`}>{money(totals.forecastNet)}</span>
              </div>
            </div>
          </div>

          <div className="spSummaryRight">
            <MiniPill tone={expenseTrend.positive ? "amber" : "green"}>{expenseTrend.value}</MiniPill>
            <MiniPill tone={forecastRemaining < 0 ? "red" : "green"}>{money(forecastRemaining)} left</MiniPill>
            <MiniPill tone="blue">{accounts.length} accounts</MiniPill>
          </div>
        </div>

        <div className="spMobileTabs">
          {MOBILE_SECTIONS.map((section) => (
            <button
              key={section.value}
              type="button"
              className={`spMobileTab ${mobileSection === section.value ? "spMobileTab_active" : ""}`}
              onClick={() => setMobileSection(section.value)}
            >
              {section.label}
            </button>
          ))}
        </div>

        <div className="spShell">
          <section className={`spCol ${mobileSection === "list" ? "spCol_show" : ""}`}>
            <GlassPane tone="neutral" size="panel" className="spPaneShell">
              <PaneHeader
                title="Feed"
                subcopy="Transactions and planned items for the active range."
                right={<MiniPill tone="blue">{rosterTransactions.length + rosterPlanned.length}</MiniPill>}
              />

              <div className="spToolbarGrid">
                <div className="spSearchBox">
                  <Search size={14} />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search spending…" />
                  {search ? (
                    <button type="button" className="spInlineIcon" onClick={() => setSearch("")}> 
                      <X size={12} />
                    </button>
                  ) : null}
                </div>

                <div className="spSelectRow">
                  <select value={period} onChange={(e) => setPeriod(e.target.value)}>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                    <option value="year">This Year</option>
                  </select>
                  <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                    <option value="all">All types</option>
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                    <option value="transfer">Transfer</option>
                  </select>
                </div>

                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                  <option value="all">All categories</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="spRosterList">
                {rosterTransactions.map((tx) => {
                  const selected = selectedRecord.kind === "tx" && selectedRecord.id === tx.id;
                  const Icon = iconForType(tx.type);
                  const tone = toneForType(tx.type);
                  return (
                    <button
                      key={tx.id}
                      type="button"
                      className={`spRosterRow ${selected ? "spRosterRow_active" : ""}`}
                      onClick={() => {
                        setSelectedRecord({ kind: "tx", id: tx.id });
                        setTab("focus");
                        setMobileSection("focus");
                      }}
                    >
                      <div className={`spRosterIcon spRosterIcon_${tone}`}>
                        <Icon size={14} />
                      </div>
                      <div className="spRosterBody">
                        <div className="spRosterTop">
                          <span className="spRosterTitle">{tx.merchant || tx.note || tx.type}</span>
                          <span className={`spRosterAmount spRosterAmount_${tone}`}>{money(tx.amount)}</span>
                        </div>
                        <div className="spRosterMeta">
                          {shortDate(tx.date)} · {fmtTime(tx.time)} · {tx.type}
                          {tx.accountName ? ` · ${tx.accountName}` : ""}
                          {isBillManagedTransaction(tx) ? " · bills-owned" : ""}
                        </div>
                      </div>
                    </button>
                  );
                })}

                {rosterPlanned.map((planned) => {
                  const selected = selectedRecord.kind === "planned" && selectedRecord.id === planned.id;
                  return (
                    <button
                      key={planned.id}
                      type="button"
                      className={`spRosterRow ${selected ? "spRosterRow_active" : ""}`}
                      onClick={() => {
                        setSelectedRecord({ kind: "planned", id: planned.id });
                        setTab("focus");
                        setMobileSection("focus");
                      }}
                    >
                      <div className="spRosterIcon spRosterIcon_amber">
                        <CalendarClock size={14} />
                      </div>
                      <div className="spRosterBody">
                        <div className="spRosterTop">
                          <span className="spRosterTitle">{planned.merchant || planned.note || "Planned item"}</span>
                          <span className="spRosterAmount spRosterAmount_amber">{money(planned.amount)}</span>
                        </div>
                        <div className="spRosterMeta">
                          {shortDate(planned.date)} · {fmtTime(planned.time)} · {categoriesById.get(planned.categoryId)?.name || "Planned"}
                        </div>
                      </div>
                    </button>
                  );
                })}

                {!rosterTransactions.length && !rosterPlanned.length ? <div className="spEmptyInline">Nothing matches the current filters.</div> : null}
              </div>
            </GlassPane>
          </section>

          <section className={`spCol ${mobileSection === "focus" ? "spCol_show" : ""}`}>
            <GlassPane tone="neutral" size="panel" className="spPaneShell">
              <PaneHeader
                title="Overview"
                subcopy="Real account-linked transactions and clean planned flow."
                right={
                  <div className="spTabRow">
                    {["overview", "budgets", "focus"].map((item) => (
                      <button key={item} type="button" className={`spTab ${tab === item ? "spTab_active" : ""}`} onClick={() => setTab(item)}>
                        {item}
                      </button>
                    ))}
                  </div>
                }
              />

              {tab === "overview" ? (
                <div className="spCenterScroll">
                  <div className="spStatsGrid">
                    <StatCard icon={Wallet} label="Spent" value={money(totals.expense)} detail={`${range.label} expense total`} tone="red" />
                    <StatCard icon={ArrowUpRight} label="Income" value={money(totals.income)} detail="Income entered from the spending page" tone="green" />
                    <StatCard icon={CalendarClock} label="Planned" value={money(totals.plannedExpense)} detail="Upcoming planned expense load" tone="amber" />
                    <StatCard icon={CreditCard} label="Forecast" value={money(totals.forecastNet)} detail="Income minus spent and planned" tone={totals.forecastNet < 0 ? "red" : "green"} />
                  </div>

                  <GlassPane tone="neutral" size="card">
                    <PaneHeader title="Expense Trend" subcopy={`${range.label} expense by ${period === "year" ? "month" : "day"}.`} right={<MiniPill tone={expenseTrend.positive ? "amber" : "green"}>{expenseTrend.value}</MiniPill>} />
                    <SpendingBarsChart data={trendData.length ? trendData : [{ key: "none", label: "—", value: 0 }]} />
                  </GlassPane>

                  <GlassPane tone="neutral" size="card">
                    <PaneHeader title="Upcoming Planned" subcopy="Next planned items across the whole period." right={<MiniPill tone="amber">{upcomingItems.length}</MiniPill>} />
                    <div className="spDataList">
                      {upcomingItems.length ? (
                        upcomingItems.map((item) => (
                          <div key={item.id} className="spDataRow">
                            <div>
                              <div className="spDataTitle">{item.merchant || item.note || "Planned item"}</div>
                              <div className="spDataSub">
                                {shortDate(item.date)} · {fmtTime(item.time)} · {categoriesById.get(item.categoryId)?.name || "Planned"}
                              </div>
                            </div>
                            <div className="spDataAmount spDataAmount_amber">{money(item.amount)}</div>
                          </div>
                        ))
                      ) : (
                        <div className="spEmptyInline">No planned items coming up.</div>
                      )}
                    </div>
                  </GlassPane>
                </div>
              ) : null}

              {tab === "budgets" ? (
                <div className="spCenterScroll">
                  <GlassPane tone="neutral" size="card">
                    <PaneHeader title="Budget Load" subcopy={`${range.label} budget against actual and planned spending.`} right={<MiniPill tone={forecastRemaining < 0 ? "red" : budgetLoad >= 85 ? "amber" : "green"}>{Math.round(budgetLoad)}%</MiniPill>} />

                    <div className="spBudgetSummary">
                      <div className="spBudgetSummaryCard">
                        <div className="spBudgetSummaryLabel">Forecast remaining</div>
                        <div className={`spBudgetSummaryValue ${forecastRemaining < 0 ? "spTextRed" : "spTextGreen"}`}>{money(forecastRemaining)}</div>
                      </div>
                      <div className="spBudgetSummaryCard">
                        <div className="spBudgetSummaryLabel">Tracked categories</div>
                        <div className="spBudgetSummaryValue">{totalsByCategory.length}</div>
                      </div>
                    </div>

                    <div className="spBudgetList">
                      {totalsByCategory.map((row) => {
                        const tone = statusTone(row.status);
                        return (
                          <div key={row.categoryId} className="spBudgetRow">
                            <div className="spBudgetRowTop">
                              <div>
                                <div className="spDataTitle">{row.category.name}</div>
                                <div className="spDataSub">
                                  {money(row.spent)} actual · {money(row.planned)} planned · {money(row.budget)} budget
                                </div>
                              </div>
                              <div className="spBudgetStatus" style={tone}>
                                {row.status}
                              </div>
                            </div>
                            <ProgressBar value={row.pct} color={row.status === "Over" ? "#ff6177" : row.status === "Near" ? "#f59e0b" : "#22c55e"} />
                          </div>
                        );
                      })}
                    </div>
                  </GlassPane>
                </div>
              ) : null}

              {tab === "focus" ? (
                <div className="spCenterScroll">
                  {selectedTx ? (
                    <GlassPane tone={toneForType(selectedTx.type)} size="card">
                      <PaneHeader
                        title="Transaction focus"
                        subcopy={isBillManagedTransaction(selectedTx) ? "This row is owned by Bills. Change it from the Bills page so money history stays synced." : "Transaction detail routed through the shared money engine."}
                        right={<MiniPill tone={toneForType(selectedTx.type)}>{selectedTx.type}</MiniPill>}
                      />

                      <div className="spFocusHero">
                        <div className={`spFocusIcon spFocusIcon_${toneForType(selectedTx.type)}`}>
                          <SelectedIcon size={18} />
                        </div>
                        <div>
                          <div className="spFocusAmount">{money(selectedTx.amount)}</div>
                          <div className="spDataSub">
                            {shortDate(selectedTx.date)} · {fmtTime(selectedTx.time)} · {selectedTx.accountName || selectedTx.account || "No account"}
                          </div>
                        </div>
                      </div>

                      <div className="spFocusGrid">
                        <div className="spMetricLite"><span>Merchant</span><strong>{selectedTx.merchant || "—"}</strong></div>
                        <div className="spMetricLite"><span>Category</span><strong>{categoriesById.get(selectedTx.categoryId)?.name || "—"}</strong></div>
                        <div className="spMetricLite"><span>Method</span><strong>{selectedTx.paymentMethod || "—"}</strong></div>
                        <div className="spMetricLite"><span>Account</span><strong>{selectedTx.accountName || selectedTx.account || "—"}</strong></div>
                        {selectedTx.type === "transfer" ? <div className="spMetricLite"><span>To account</span><strong>{selectedTx.transferAccountName || "—"}</strong></div> : null}
                      </div>

                      {selectedTx.note ? <div className="spFocusNote">{selectedTx.note}</div> : null}

                      <div className="spFocusActions">
                        <ActionBtn onClick={() => duplicateTransaction(selectedTx)} disabled={isBillManagedTransaction(selectedTx)}>
                          <Copy size={13} />
                          Duplicate
                        </ActionBtn>
                        <ActionBtn variant="danger" onClick={() => deleteTransaction(selectedTx.id)} disabled={isBillManagedTransaction(selectedTx)}>
                          <Trash2 size={13} />
                          Delete
                        </ActionBtn>
                      </div>
                    </GlassPane>
                  ) : null}

                  {selectedPlanned ? (
                    <GlassPane tone="amber" size="card">
                      <PaneHeader title="Planned focus" subcopy="Planned expenses stay off the ledger until converted." right={<MiniPill tone="amber">planned</MiniPill>} />

                      <div className="spFocusHero">
                        <div className="spFocusIcon spFocusIcon_amber">
                          <CalendarClock size={18} />
                        </div>
                        <div>
                          <div className="spFocusAmount">{money(selectedPlanned.amount)}</div>
                          <div className="spDataSub">
                            {shortDate(selectedPlanned.date)} · {fmtTime(selectedPlanned.time)} · {categoriesById.get(selectedPlanned.categoryId)?.name || "Planned"}
                          </div>
                        </div>
                      </div>

                      <div className="spFocusGrid">
                        <div className="spMetricLite"><span>Merchant</span><strong>{selectedPlanned.merchant || "—"}</strong></div>
                        <div className="spMetricLite"><span>Category</span><strong>{categoriesById.get(selectedPlanned.categoryId)?.name || "—"}</strong></div>
                        <div className="spMetricLite"><span>Convert to</span><strong>{getAccountById(convertAccountId)?.name || accounts[0]?.name || "Choose account"}</strong></div>
                      </div>

                      {selectedPlanned.note ? <div className="spFocusNote">{selectedPlanned.note}</div> : null}

                      <div className="spFieldBlock">
                        <label className="spFieldLabel">Post to account</label>
                        <select value={convertAccountId} onChange={(e) => setConvertAccountId(e.target.value)}>
                          {accounts.map((account) => (
                            <option key={account.id} value={account.id}>{account.name} · {money(account.balance)}</option>
                          ))}
                        </select>
                      </div>

                      <div className="spFocusActions">
                        <ActionBtn variant="primary" onClick={() => convertPlanned(selectedPlanned)}>
                          <CheckCircle2 size={13} />
                          Convert to real transaction
                        </ActionBtn>
                        <ActionBtn variant="danger" onClick={() => deletePlanned(selectedPlanned.id)}>
                          <Trash2 size={13} />
                          Delete planned
                        </ActionBtn>
                      </div>
                    </GlassPane>
                  ) : null}

                  {!selectedTx && !selectedPlanned ? <div className="spEmptyInline">Select a record from the feed.</div> : null}
                </div>
              ) : null}
            </GlassPane>
          </section>

          <section className={`spCol ${mobileSection === "tools" ? "spCol_show" : ""}`}>
            <div className="spToolsStack">
              <GlassPane tone="neutral" size="panel">
                <PaneHeader title="Quick Add" subcopy="Post now or plan it first." right={<MiniPill tone="blue">{mode}</MiniPill>} />

                <div className="spModeRow">
                  <button type="button" className={`spModeBtn ${mode === "now" ? "spModeBtn_active" : ""}`} onClick={() => setMode("now")}>Now</button>
                  <button type="button" className={`spModeBtn ${mode === "planned" ? "spModeBtn_active" : ""}`} onClick={() => setMode("planned")}>Planned</button>
                </div>

                {mode === "now" ? (
                  <>
                    <div className="spModeRow" style={{ marginTop: 10 }}>
                      {[
                        { value: "expense", label: "Expense" },
                        { value: "income", label: "Income" },
                        { value: "transfer", label: "Transfer" },
                      ].map((item) => (
                        <button key={item.value} type="button" className={`spModeBtn ${qaType === item.value ? "spModeBtn_active" : ""}`} onClick={() => setQaType(item.value)}>
                          {item.label}
                        </button>
                      ))}
                    </div>

                    <div className="spFieldGrid" style={{ marginTop: 12 }}>
                      <div className="spFieldBlock"><label className="spFieldLabel">Amount</label><input value={qaAmount} onChange={(e) => setQaAmount(e.target.value)} placeholder="0.00" inputMode="decimal" /></div>
                      <div className="spFieldBlock"><label className="spFieldLabel">Date</label><input type="date" value={qaDate} onChange={(e) => setQaDate(e.target.value)} /></div>
                      <div className="spFieldBlock"><label className="spFieldLabel">Time</label><input value={qaTime} onChange={(e) => setQaTime(e.target.value)} placeholder="09:00" /></div>
                    </div>

                    <div className="spFieldGrid">
                      {qaType !== "transfer" ? (
                        <div className="spFieldBlock"><label className="spFieldLabel">Category</label><select value={qaCategoryId} onChange={(e) => setQaCategoryId(e.target.value)}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>
                      ) : null}
                      <div className="spFieldBlock"><label className="spFieldLabel">From account</label><select value={qaAccountId} onChange={(e) => setQaAccountId(e.target.value)}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {money(account.balance)}</option>)}</select></div>
                      {qaType === "transfer" ? (
                        <div className="spFieldBlock"><label className="spFieldLabel">To account</label><select value={qaTransferToAccountId} onChange={(e) => setQaTransferToAccountId(e.target.value)}>{accounts.filter((account) => account.id !== qaAccountId).map((account) => <option key={account.id} value={account.id}>{account.name} · {money(account.balance)}</option>)}</select></div>
                      ) : (
                        <div className="spFieldBlock"><label className="spFieldLabel">Method</label><input value={qaPayment} onChange={(e) => setQaPayment(e.target.value)} placeholder="Card" /></div>
                      )}
                    </div>

                    <div className="spFieldBlock"><label className="spFieldLabel">Merchant / source</label><input value={qaMerchant} onChange={(e) => setQaMerchant(e.target.value)} placeholder={qaType === "income" ? "Employer or source" : "Merchant"} /></div>
                    <div className="spFieldBlock"><label className="spFieldLabel">Note</label><textarea value={qaNote} onChange={(e) => setQaNote(e.target.value)} placeholder="Optional note…" rows={3} /></div>

                    <ActionBtn variant="primary" full onClick={addNow} disabled={saving}>
                      <Save size={13} />
                      {saving ? "Saving…" : "Post transaction"}
                    </ActionBtn>
                  </>
                ) : (
                  <>
                    <div className="spFieldGrid" style={{ marginTop: 12 }}>
                      <div className="spFieldBlock"><label className="spFieldLabel">Amount</label><input value={qaAmount} onChange={(e) => setQaAmount(e.target.value)} placeholder="0.00" inputMode="decimal" /></div>
                      <div className="spFieldBlock"><label className="spFieldLabel">Planned date</label><input type="date" value={qaDate} onChange={(e) => setQaDate(e.target.value)} /></div>
                      <div className="spFieldBlock"><label className="spFieldLabel">Time</label><input value={qaTime} onChange={(e) => setQaTime(e.target.value)} placeholder="09:00" /></div>
                    </div>
                    <div className="spFieldGrid">
                      <div className="spFieldBlock"><label className="spFieldLabel">Category</label><select value={qaCategoryId} onChange={(e) => setQaCategoryId(e.target.value)}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>
                      <div className="spFieldBlock"><label className="spFieldLabel">Merchant</label><input value={qaMerchant} onChange={(e) => setQaMerchant(e.target.value)} placeholder="Merchant" /></div>
                    </div>
                    <div className="spFieldBlock"><label className="spFieldLabel">Note</label><textarea value={qaNote} onChange={(e) => setQaNote(e.target.value)} placeholder="Optional note…" rows={3} /></div>
                    <ActionBtn variant="primary" full onClick={addPlanned} disabled={saving}>
                      <Save size={13} />
                      {saving ? "Saving…" : "Save planned item"}
                    </ActionBtn>
                  </>
                )}
              </GlassPane>

              <GlassPane tone="neutral" size="panel">
                <PaneHeader title="Category Tools" subcopy="Keep categories and budgets tight." right={<MiniPill tone="blue">{groups.length - 1} groups</MiniPill>} />
                <div className="spFieldGrid">
                  <div className="spFieldBlock"><label className="spFieldLabel">New category</label><input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Streaming" /></div>
                  <div className="spFieldBlock"><label className="spFieldLabel">Group</label><select value={newCategoryGroup} onChange={(e) => setNewCategoryGroup(e.target.value)}>{groups.filter((g) => g !== "All").map((group) => <option key={group} value={group}>{group}</option>)}</select></div>
                </div>
                <ActionBtn full onClick={saveCategory} disabled={saving}>
                  <Plus size={13} />
                  Add category
                </ActionBtn>

                <div className="spDivider" />

                <div className="spFieldGrid">
                  <div className="spFieldBlock"><label className="spFieldLabel">Budget category</label><select value={budgetEditorCategoryId} onChange={(e) => setBudgetEditorCategoryId(e.target.value)}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>
                  <div className="spFieldBlock"><label className="spFieldLabel">Budget for {range.budgetMode}</label><input value={budgetEditorValue} onChange={(e) => setBudgetEditorValue(e.target.value)} placeholder="0.00" inputMode="decimal" /></div>
                </div>
                <ActionBtn variant="primary" full onClick={saveBudgetValue} disabled={saving}>
                  <PiggyBank size={13} />
                  Save budget
                </ActionBtn>
              </GlassPane>

              <GlassPane tone="neutral" size="panel">
                <PaneHeader title="Focused Category" subcopy="Actual and planned load for the currently focused category." right={selectedCategory ? <MiniPill tone="blue">{selectedCategory.name}</MiniPill> : null} />
                {selectedCategory ? (
                  <>
                    <div className="spMetricLiteGrid">
                      <div className="spMetricLite"><span>Spent</span><strong>{money(selectedSpent)}</strong></div>
                      <div className="spMetricLite"><span>Planned</span><strong>{money(selectedPlannedTotal)}</strong></div>
                      <div className="spMetricLite"><span>Budget</span><strong>{money(selectedBudget)}</strong></div>
                      <div className="spMetricLite"><span>Forecast</span><strong>{money(selectedForecast)}</strong></div>
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <ProgressBar value={selectedLoadPct} color={selectedLoadPct >= 100 ? "#ff6177" : selectedLoadPct >= 85 ? "#f59e0b" : "#22c55e"} />
                    </div>
                  </>
                ) : (
                  <div className="spEmptyInline">Pick a category or record to see focused budget load.</div>
                )}
              </GlassPane>
            </div>
          </section>
        </div>
      </div>

      {(status || pageError) && (
        <div className="spToastStack">
          {status ? (
            <div className="spToast spToast_ok">
              <CheckCircle2 size={14} />
              {status}
            </div>
          ) : null}
          {pageError ? (
            <div className="spToast spToast_error">
              <X size={14} />
              {pageError}
              <button type="button" className="spInlineIcon" onClick={() => setPageError("")}> 
                <X size={12} />
              </button>
            </div>
          ) : null}
        </div>
      )}

      <style jsx global>{styles}</style>
    </>
  );
}

const styles = `
  .spRoot {
    min-height: calc(100svh - 24px);
    display: grid;
    grid-template-rows: auto auto 1fr;
    gap: 12px;
    color: var(--lcc-text, #f7fbff);
  }

  .spGate {
    min-height: 60svh;
    display: grid;
    place-items: center;
    color: rgba(255,255,255,0.62);
  }

  .spSummaryStrip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    min-height: 86px;
    padding: 16px 18px;
    border-radius: var(--lcc-radius-lg, 22px);
    border: 1px solid rgba(214,226,255,0.10);
    background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.02)), rgba(9,12,20,0.82);
    box-shadow: 0 20px 40px rgba(0,0,0,0.28);
  }

  .spSummaryLeft, .spSummaryRight {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .spTitleWrap { display: grid; gap: 4px; }
  .spEyebrow {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.44);
  }
  .spPageTitle {
    font-size: clamp(24px, 2vw, 30px);
    line-height: 1;
    font-weight: 900;
    letter-spacing: -0.04em;
  }

  .spSummaryStats {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .spMiniStat {
    min-width: 116px;
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid rgba(214,226,255,0.10);
    background: rgba(255,255,255,0.03);
    display: grid;
    gap: 4px;
  }

  .spMiniLabel {
    font-size: 10px;
    letter-spacing: .12em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.44);
    font-weight: 800;
  }

  .spMiniValue {
    font-size: 16px;
    font-weight: 850;
    letter-spacing: -0.03em;
  }

  .spTextGreen { color: #97efc7; }
  .spTextRed { color: #ffb4c5; }

  .spMobileTabs {
    display: none;
    grid-template-columns: repeat(3, minmax(0,1fr));
    gap: 8px;
  }

  .spMobileTab {
    min-height: 38px;
    border-radius: 12px;
    border: 1px solid rgba(214,226,255,0.10);
    background: rgba(255,255,255,0.03);
    color: rgba(255,255,255,0.65);
    cursor: pointer;
  }

  .spMobileTab_active {
    color: #fff;
    border-color: rgba(143,177,255,0.28);
    background: linear-gradient(180deg, rgba(143,177,255,0.18), rgba(143,177,255,0.06));
  }

  .spShell {
    display: grid;
    grid-template-columns: 0.96fr 1.4fr 0.9fr;
    gap: 12px;
    min-height: 0;
  }

  .spCol { min-width: 0; min-height: 0; }
  .spPaneShell { height: 100%; overflow: hidden; }
  .spToolsStack { display: grid; gap: 12px; }

  .spToolbarGrid {
    display: grid;
    gap: 10px;
    margin-bottom: 12px;
  }

  .spSearchBox {
    min-height: 40px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    border-radius: 12px;
    border: 1px solid rgba(214,226,255,0.10);
    background: rgba(255,255,255,0.03);
    color: rgba(255,255,255,0.55);
  }

  .spSearchBox input, .spFieldBlock input, .spFieldBlock select, .spFieldBlock textarea, .spSelectRow select {
    width: 100%;
    background: transparent;
    border: 0;
    outline: 0;
    color: #fff;
    font: inherit;
  }

  .spFieldBlock input, .spFieldBlock select, .spFieldBlock textarea, .spSelectRow select {
    min-height: 40px;
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid rgba(214,226,255,0.10);
    background: rgba(255,255,255,0.03);
  }

  .spFieldBlock textarea { min-height: 92px; resize: vertical; }

  .spFieldBlock { display: grid; gap: 7px; }
  .spFieldLabel {
    font-size: 12px;
    font-weight: 700;
    color: rgba(255,255,255,0.62);
  }

  .spSelectRow, .spFieldGrid, .spModeRow, .spTabRow, .spFocusActions, .spSummaryRight {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .spFieldGrid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 10px;
  }

  .spModeBtn, .spTab {
    min-height: 34px;
    padding: 0 12px;
    border-radius: 10px;
    border: 1px solid rgba(214,226,255,0.10);
    background: rgba(255,255,255,0.03);
    color: rgba(255,255,255,0.68);
    cursor: pointer;
    text-transform: capitalize;
  }

  .spModeBtn_active, .spTab_active {
    color: #fff;
    border-color: rgba(143,177,255,0.28);
    background: linear-gradient(180deg, rgba(143,177,255,0.18), rgba(143,177,255,0.06));
  }

  .spRosterList, .spCenterScroll {
    min-height: 0;
    display: grid;
    gap: 8px;
    overflow: auto;
    padding-right: 2px;
  }

  .spCenterScroll { max-height: calc(100svh - 280px); }
  .spRosterList { max-height: calc(100svh - 316px); }

  .spRosterRow {
    width: 100%;
    display: grid;
    grid-template-columns: 40px 1fr;
    gap: 10px;
    align-items: center;
    padding: 10px;
    border-radius: 14px;
    border: 1px solid rgba(214,226,255,0.08);
    background: rgba(255,255,255,0.03);
    color: #fff;
    text-align: left;
    cursor: pointer;
  }

  .spRosterRow_active, .spRosterRow:hover {
    border-color: rgba(143,177,255,0.22);
    background: rgba(255,255,255,0.05);
  }

  .spRosterIcon {
    width: 38px;
    height: 38px;
    display: grid;
    place-items: center;
    border-radius: 12px;
    border: 1px solid rgba(214,226,255,0.10);
    background: rgba(255,255,255,0.04);
  }

  .spRosterIcon_red { color: #ffb4c5; }
  .spRosterIcon_green { color: #97efc7; }
  .spRosterIcon_amber { color: #f5cf88; }

  .spRosterBody, .spStatsGrid, .spDataList, .spBudgetList, .spMetricLiteGrid {
    display: grid;
    gap: 10px;
  }

  .spRosterTop, .spDataRow, .spBudgetRowTop, .spMetricLite {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .spRosterTitle, .spDataTitle {
    font-size: 14px;
    font-weight: 800;
    letter-spacing: -0.02em;
  }

  .spRosterMeta, .spDataSub {
    font-size: 12px;
    color: rgba(255,255,255,0.58);
    line-height: 1.45;
  }

  .spRosterAmount, .spDataAmount { font-weight: 850; }
  .spRosterAmount_red, .spDataAmount_red { color: #ffb4c5; }
  .spRosterAmount_green, .spDataAmount_green { color: #97efc7; }
  .spRosterAmount_amber, .spDataAmount_amber { color: #f5cf88; }

  .spStatsGrid {
    grid-template-columns: repeat(4, minmax(0,1fr));
  }

  .spBudgetSummary {
    display: grid;
    grid-template-columns: repeat(2, minmax(0,1fr));
    gap: 10px;
    margin-bottom: 12px;
  }

  .spBudgetSummaryCard, .spMetricLite, .spFocusNote {
    padding: 12px;
    border-radius: 12px;
    border: 1px solid rgba(214,226,255,0.08);
    background: rgba(255,255,255,0.03);
  }

  .spBudgetSummaryLabel, .spMetricLite span {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: .12em;
    font-weight: 800;
    color: rgba(255,255,255,0.42);
  }

  .spBudgetSummaryValue, .spMetricLite strong {
    margin-top: 5px;
    display: block;
    font-size: 16px;
    font-weight: 850;
    letter-spacing: -0.03em;
  }

  .spBudgetStatus {
    min-height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 800;
  }

  .spFocusHero {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }

  .spFocusIcon {
    width: 42px;
    height: 42px;
    display: grid;
    place-items: center;
    border-radius: 14px;
    border: 1px solid rgba(214,226,255,0.08);
    background: rgba(255,255,255,0.04);
  }

  .spFocusIcon_red { color: #ffb4c5; }
  .spFocusIcon_green { color: #97efc7; }
  .spFocusIcon_amber { color: #f5cf88; }

  .spFocusAmount {
    font-size: clamp(24px, 2vw, 30px);
    line-height: 1;
    font-weight: 900;
    letter-spacing: -0.04em;
  }

  .spFocusGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0,1fr));
    gap: 10px;
    margin-bottom: 12px;
  }

  .spDivider {
    height: 1px;
    margin: 12px 0;
    background: rgba(255,255,255,0.06);
  }

  .spProgress {
    position: relative;
    height: 8px;
    overflow: hidden;
    border-radius: 999px;
    background: rgba(255,255,255,0.06);
  }

  .spProgressFill {
    height: 100%;
    border-radius: 999px;
  }

  .spBarsWrap { width: 100%; overflow: auto; }
  .spBarsSvg { width: 100%; min-width: 620px; display: block; }
  .spEmptyInline {
    padding: 14px;
    border-radius: 12px;
    border: 1px dashed rgba(214,226,255,0.12);
    background: rgba(255,255,255,0.02);
    color: rgba(255,255,255,0.58);
  }

  .spActionBtn {
    min-height: 36px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 0 13px;
    border-radius: 12px;
    font: inherit;
  }

  .spToastStack {
    position: fixed;
    right: 16px;
    bottom: 16px;
    z-index: 90;
    display: grid;
    gap: 8px;
    width: min(420px, calc(100vw - 32px));
  }

  .spToast {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 14px;
    border: 1px solid rgba(214,226,255,0.10);
    background: rgba(9,12,20,0.96);
    box-shadow: 0 20px 40px rgba(0,0,0,0.28);
  }

  .spToast_ok { color: #97efc7; }
  .spToast_error { color: #ffb4c5; }
  .spInlineIcon {
    width: 24px;
    height: 24px;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: currentColor;
    cursor: pointer;
  }

  @media (max-width: 1180px) {
    .spShell { grid-template-columns: 1fr; }
    .spCol { display: none; }
    .spCol_show { display: block; }
    .spMobileTabs { display: grid; }
    .spRosterList, .spCenterScroll { max-height: none; }
  }

  @media (max-width: 860px) {
    .spSummaryStrip {
      padding: 14px;
      flex-direction: column;
      align-items: flex-start;
    }

    .spStatsGrid,
    .spBudgetSummary,
    .spFieldGrid,
    .spFocusGrid,
    .spMetricLiteGrid {
      grid-template-columns: 1fr;
    }
  }
`;

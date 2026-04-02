"use client";

import * as React from "react";
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarClock,
  Copy,
  CreditCard,
  ListFilter,
  PiggyBank,
  Plus,
  Search,
  Trash2,
  Wallet,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import GlassPane from "../components/GlassPane";

export const dynamic = "force-dynamic";

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
  weekly: { groceries: 200, eating_out: 120, coffee: 25, gas: 100, subscriptions: 30, shopping: 60, misc: 40 },
  monthly: { groceries: 800, eating_out: 450, coffee: 90, gas: 400, subscriptions: 120, shopping: 250, misc: 150 },
  yearly: { groceries: 9600, eating_out: 5400, coffee: 1080, gas: 4800, subscriptions: 1440, shopping: 3000, misc: 1800 },
};

const MOBILE_SECTIONS = [
  { value: "list", label: "Feed" },
  { value: "focus", label: "Focus" },
  { value: "tools", label: "Add" },
];

function uid() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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

function parseMoneyInput(v) {
  const cleaned = String(v ?? "").replace(/[^0-9.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : NaN;
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

function shortDate(iso) {
  const d = toDate(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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
  if (mode === "week") return { start: startOfWeek(now), end: endOfWeek(now), budgetMode: "weekly", label: "This Week" };
  if (mode === "year") return { start: startOfYear(now), end: endOfYear(now), budgetMode: "yearly", label: "This Year" };
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
    return { start: new Date(start.getFullYear() - 1, 0, 1, 0, 0, 0, 0), end: new Date(start.getFullYear() - 1, 11, 31, 23, 59, 59, 999) };
  }
  return { start: new Date(start.getFullYear(), start.getMonth() - 1, 1, 0, 0, 0, 0), end: new Date(start.getFullYear(), start.getMonth(), 0, 23, 59, 59, 999) };
}

function sumExpenses(rows) {
  return rows.reduce((sum, t) => sum + (t.type === "expense" ? Number(t.amount) || 0 : 0), 0);
}

function trendMeta(current, previous) {
  const diff = percentChange(current, previous);
  const positive = diff >= 0;
  return { value: `${positive ? "+" : ""}${diff.toFixed(0)}%`, positive, text: "vs prior period" };
}

function mapCategoryRowToClient(row) {
  return normalizeCategory({ id: row.id, name: row.name, group: row.group_name, color: row.color, isBudgeted: row.is_budgeted });
}

function mapCategoryClientToRow(cat, userId) {
  return { id: cat.id, user_id: userId, name: cat.name, group_name: cat.group, color: cat.color, is_budgeted: cat.isBudgeted !== false, updated_at: new Date().toISOString() };
}

function roundMoneyValue(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function mapAccountRowToClient(row) {
  return { id: row.id, name: String(row.name || "Account"), accountType: String(row.account_type || ""), balance: roundMoneyValue(row.balance) };
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

function mapTransactionRowToClient(row) {
  const accountMeta = parseStoredAccount(row.account_name, row.type);
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
    accountId: "",
    accountName: accountMeta.accountName,
    transferAccountId: "",
    transferAccountName: accountMeta.transferAccountName,
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
  return { id: row.id, amount: Number(row.amount) || 0, categoryId: row.category_id || "", date: row.planned_date, time: normalizeTime(row.planned_time || ""), merchant: row.merchant || "", note: row.note || "", createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now() };
}

function mapPlannedClientToRow(p, userId) {
  return { id: p.id, user_id: userId, amount: Number(p.amount) || 0, category_id: p.categoryId || null, planned_date: p.date, planned_time: normalizeTime(p.time || "") || null, merchant: p.merchant || "", note: p.note || "", created_at: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(), updated_at: new Date().toISOString() };
}

async function getDefaultCalendarProfileId(userId) {
  const { data, error } = await supabase.from("calendar_profiles").select("id,is_default,created_at").eq("user_id", userId).order("is_default", { ascending: false }).order("created_at", { ascending: true }).limit(1);
  if (error) throw error;
  return data?.[0]?.id ?? null;
}

function calendarTitleForTransaction(tx, category) {
  if (tx.type === "income") return tx.merchant?.trim() ? `Income • ${tx.merchant.trim()}` : "Income";
  return tx.merchant?.trim() ? `${category?.name?.trim() || (tx.paymentMethod === "Bill Payment" ? "Bill Payment" : "Expense")} • ${tx.merchant.trim()}` : (category?.name?.trim() || (tx.paymentMethod === "Bill Payment" ? "Bill Payment" : "Expense"));
}

function calendarTitleForPlanned(planned, category) {
  const categoryName = category?.name?.trim() || "Planned Expense";
  return planned.merchant?.trim() ? `Planned • ${categoryName} • ${planned.merchant.trim()}` : `Planned • ${categoryName}`;
}

async function upsertCalendarEventForTransaction(tx, userId, category) {
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
    category: tx.type === "income" ? "Payday" : category?.name || (tx.paymentMethod === "Bill Payment" ? "Bill Payment" : "Expense"),
    flow: tx.type === "income" ? "income" : "expense",
    amount: Number(tx.amount) || 0,
    note: tx.note || "",
    status: "scheduled",
    color: tx.type === "income" ? "#22c55e" : tx.paymentMethod === "Bill Payment" ? "#f59e0b" : "#ef4444",
    source,
    source_id: tx.id,
    source_table: "spending_transactions",
    auto_created: true,
    transaction_type: tx.type === "income" ? "income" : "expense",
    updated_at: new Date().toISOString(),
  };
  const { data: existing, error: findError } = await supabase.from("calendar_events").select("id").eq("user_id", userId).eq("profile_id", profileId).eq("source", source).eq("source_id", tx.id).maybeSingle();
  if (findError) throw findError;
  if (existing?.id) {
    const { error: updateError } = await supabase.from("calendar_events").update(payload).eq("id", existing.id);
    if (updateError) throw updateError;
    return;
  }
  const { error: insertError } = await supabase.from("calendar_events").insert([{ id: uid(), created_at: new Date().toISOString(), ...payload }]);
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
  const { data: existing, error: findError } = await supabase.from("calendar_events").select("id").eq("user_id", userId).eq("profile_id", profileId).eq("source", "planned_expense").eq("source_id", planned.id).maybeSingle();
  if (findError) throw findError;
  if (existing?.id) {
    const { error: updateError } = await supabase.from("calendar_events").update(payload).eq("id", existing.id);
    if (updateError) throw updateError;
    return;
  }
  const { error: insertError } = await supabase.from("calendar_events").insert([{ id: uid(), created_at: new Date().toISOString(), ...payload }]);
  if (insertError) throw insertError;
}

async function deleteCalendarEventBySource(userId, source, sourceId) {
  const { error } = await supabase.from("calendar_events").delete().eq("user_id", userId).eq("source", source).eq("source_id", sourceId);
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
        border: isDanger ? "1px solid rgba(255,132,163,0.20)" : isPrimary ? "1px solid rgba(143,177,255,0.22)" : "1px solid rgba(214,226,255,0.10)",
        background: isDanger ? "linear-gradient(180deg, rgba(255,132,163,0.11), rgba(255,132,163,0.04))" : isPrimary ? "linear-gradient(180deg, rgba(143,177,255,0.18), rgba(143,177,255,0.06))" : "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.014))",
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
  };
  const meta = tones[tone] || tones.neutral;
  return <div style={{ minHeight: 30, display: "inline-flex", alignItems: "center", gap: 8, padding: "0 10px", borderRadius: 999, border: `1px solid ${meta.border}`, background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012))", boxShadow: `inset 0 1px 0 rgba(255,255,255,0.03), 0 0 10px ${meta.glow}`, color: meta.text, fontSize: 11, fontWeight: 800, whiteSpace: "nowrap" }}>{children}</div>;
}

function PaneHeader({ title, subcopy, right }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 17, lineHeight: 1.08, fontWeight: 850, letterSpacing: "-0.035em", color: "#fff" }}>{title}</div>
        {subcopy ? <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.45, color: "rgba(255,255,255,0.60)" }}>{subcopy}</div> : null}
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
  };
  const meta = colors[tone] || colors.neutral;
  return (
    <GlassPane tone={tone} size="card" style={{ height: "100%" }}>
      <div style={{ minHeight: 110, display: "grid", gridTemplateRows: "auto auto 1fr", gap: 7 }}>
        <div style={{ width: 34, height: 34, borderRadius: 12, display: "grid", placeItems: "center", border: `1px solid ${meta.border}`, background: meta.bg, color: meta.text, boxShadow: `0 0 10px ${meta.glow}` }}><Icon size={15} /></div>
        <div>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".2em", fontWeight: 800, color: "rgba(255,255,255,0.40)" }}>{label}</div>
          <div style={{ marginTop: 8, fontSize: "clamp(18px, 2.2vw, 28px)", lineHeight: 1, fontWeight: 850, letterSpacing: "-0.05em", color: meta.text }}>{value}</div>
        </div>
        <div style={{ fontSize: 11.5, lineHeight: 1.4, color: "rgba(255,255,255,0.60)" }}>{detail}</div>
      </div>
    </GlassPane>
  );
}

function ProgressBar({ value = 0, color = "var(--lcc-green)" }) {
  const pct = clamp(Number(value) || 0, 0, 100);
  return <div className="spProgress"><div className="spProgressFill" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color} 0%, rgba(255,255,255,.92) 220%)`, boxShadow: `0 0 18px ${color}44, 0 0 26px ${color}18` }} /></div>;
}

function statusTone(status) {
  if (status === "Over") return { color: "#ffd6df", background: "rgba(255,107,127,.12)", border: "1px solid rgba(255,107,127,.22)" };
  if (status === "Near") return { color: "#ffe8b4", background: "rgba(245,158,11,.12)", border: "1px solid rgba(245,158,11,.24)" };
  if (status === "OK") return { color: "#cbffe1", background: "rgba(74,222,128,.12)", border: "1px solid rgba(74,222,128,.24)" };
  return { color: "#d8e1ff", background: "rgba(148,163,184,.12)", border: "1px solid rgba(148,163,184,.22)" };
}

function SpendingBarsChart({ data }) {
  const width = 1000;
  const height = 250;
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
            <text x={b.x + barW / 2} y={height - 8} textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.38)">{b.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function SpendingPage() {
  const [user, setUser] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [pageError, setPageError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [tab, setTab] = React.useState("overview");
  const [period, setPeriod] = React.useState("month");
  const [search, setSearch] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [selectedRecord, setSelectedRecord] = React.useState({ kind: "tx", id: null });
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
  const [newCategoryName, setNewCategoryName] = React.useState("");
  const [newCategoryGroup, setNewCategoryGroup] = React.useState("Other");
  const [mobileSection, setMobileSection] = React.useState("focus");

  const range = React.useMemo(() => periodBounds(period), [period]);
  const categoriesById = React.useMemo(() => {
    const map = new Map();
    categories.forEach((c) => map.set(c.id, c));
    return map;
  }, [categories]);
  const groups = React.useMemo(() => ["All", ...Array.from(new Set(categories.map((c) => c.group))).sort((a, b) => a.localeCompare(b))], [categories]);

  React.useEffect(() => {
    let mounted = true;
    async function loadAll() {
      try {
        setPageError("");
        const { data: { user: currentUser }, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        if (!mounted) return;
        setUser(currentUser || null);
        if (!currentUser) {
          setLoading(false);
          return;
        }
        const [catRes, budgetRes, accountRes, txRes, plannedRes] = await Promise.all([
          supabase.from("spending_categories").select("*").eq("user_id", currentUser.id).order("group_name").order("name"),
          supabase.from("spending_budgets").select("*").eq("user_id", currentUser.id),
          supabase.from("accounts").select("id,name,account_type,balance,updated_at").eq("user_id", currentUser.id).order("name"),
          supabase.from("spending_transactions").select("*").eq("user_id", currentUser.id).order("tx_date", { ascending: false }).order("tx_time", { ascending: false }).order("created_at", { ascending: false }),
          supabase.from("spending_planned_items").select("*").eq("user_id", currentUser.id).order("planned_date", { ascending: true }).order("planned_time", { ascending: true }).order("created_at", { ascending: false }),
        ]);
        if (catRes.error) throw catRes.error;
        if (budgetRes.error) throw budgetRes.error;
        if (accountRes.error) throw accountRes.error;
        if (txRes.error) throw txRes.error;
        if (plannedRes.error) throw plannedRes.error;
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
        if (!mounted) return;
        setCategories(loadedCategories);
        setBudgets(nextBudgets);
        setAccounts((accountRes.data || []).map(mapAccountRowToClient));
        setTransactions((txRes.data || []).map(mapTransactionRowToClient));
        setPlannedItems((plannedRes.data || []).map(mapPlannedRowToClient));
      } catch (err) {
        if (!mounted) return;
        setPageError(err?.message || "Failed to load spending page.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadAll();
    return () => { mounted = false; };
  }, []);

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

  const filteredTransactions = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions
      .filter((t) => inRange(t.date, range.start, range.end))
      .filter((t) => (typeFilter === "all" ? true : t.type === typeFilter))
      .filter((t) => (categoryFilter === "all" ? true : t.categoryId === categoryFilter))
      .filter((t) => {
        if (!q) return true;
        const cat = categoriesById.get(t.categoryId)?.name ?? "";
        return `${t.merchant} ${t.note} ${t.date} ${t.time} ${cat} ${t.amount} ${t.paymentMethod} ${t.account}`.toLowerCase().includes(q);
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
    let expense = 0; let income = 0; let transfer = 0;
    for (const t of filteredTransactions) {
      if (t.type === "expense") expense += Number(t.amount) || 0;
      else if (t.type === "income") income += Number(t.amount) || 0;
      else transfer += Number(t.amount) || 0;
    }
    const plannedExpense = filteredPlanned.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    return { expense, income, transfer, plannedExpense, net: income - expense, forecastNet: income - (expense + plannedExpense) };
  }, [filteredTransactions, filteredPlanned]);

  const previousExpense = React.useMemo(() => sumExpenses(previousTransactions), [previousTransactions]);
  const expenseTrend = React.useMemo(() => trendMeta(totals.expense, previousExpense), [totals.expense, previousExpense]);

  const trendData = React.useMemo(() => {
    const start = range.start;
    const periodMode = period;
    const pad = (n) => String(n).padStart(2, "0");
    const keys = periodMode === "week"
      ? Array.from({ length: 7 }).map((_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; })
      : periodMode === "year"
      ? Array.from({ length: 12 }).map((_, i) => { const d = new Date(start.getFullYear(), i, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`; })
      : Array.from({ length: new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate() }).map((_, i) => { const d = new Date(start.getFullYear(), start.getMonth(), i + 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; });
    const totalsMap = new Map(keys.map((k) => [k, 0]));
    for (const tx of filteredTransactions) {
      if (tx.type !== "expense") continue;
      if (periodMode === "year") {
        const d = toDate(tx.date);
        const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
        totalsMap.set(key, (totalsMap.get(key) || 0) + (Number(tx.amount) || 0));
      } else {
        totalsMap.set(tx.date, (totalsMap.get(tx.date) || 0) + (Number(tx.amount) || 0));
      }
    }
    return keys.map((key) => {
      const d = toDate(key);
      const label = periodMode === "year" ? d.toLocaleDateString(undefined, { month: "short" }) : periodMode === "month" ? String(d.getDate()) : d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3);
      return { key, label, value: Number(totalsMap.get(key) || 0) };
    });
  }, [filteredTransactions, range.start, period]);

  const totalsByCategory = React.useMemo(() => {
    const map = new Map();
    for (const t of filteredTransactions) {
      if (t.type !== "expense") continue;
      map.set(t.categoryId, (map.get(t.categoryId) || 0) + (Number(t.amount) || 0));
    }
    return Array.from(map.entries()).map(([categoryId, total]) => ({ categoryId, total, category: categoriesById.get(categoryId) })).sort((a, b) => b.total - a.total);
  }, [filteredTransactions, categoriesById]);

  const plannedByCategory = React.useMemo(() => {
    const map = new Map();
    for (const p of filteredPlanned) map.set(p.categoryId, (map.get(p.categoryId) || 0) + (Number(p.amount) || 0));
    return map;
  }, [filteredPlanned]);

  const budgetRows = React.useMemo(() => {
    const modeKey = range.budgetMode;
    const currentBudgets = budgets?.[modeKey] || {};
    const spentMap = new Map(totalsByCategory.map((x) => [x.categoryId, x.total]));
    return categories.map((c) => {
      const spent = Number(spentMap.get(c.id) || 0);
      const planned = Number(plannedByCategory.get(c.id) || 0);
      const budget = Number(currentBudgets[c.id] || 0);
      const forecast = spent + planned;
      return { ...c, spent, planned, budget, forecast, status: budgetStatus(spent, budget), forecastStatus: budgetStatus(forecast, budget) };
    }).filter((r) => r.budget > 0 || r.spent > 0 || r.planned > 0 || r.isBudgeted).sort((a, b) => b.forecast - a.forecast || a.name.localeCompare(b.name));
  }, [categories, budgets, totalsByCategory, plannedByCategory, range.budgetMode]);

  const totalBudget = React.useMemo(() => budgetRows.reduce((sum, row) => sum + (Number(row.budget) || 0), 0), [budgetRows]);
  const remaining = totalBudget - totals.expense;
  const forecastRemaining = totalBudget - (totals.expense + totals.plannedExpense);
  const budgetLoad = totalBudget > 0 ? ((totals.expense + totals.plannedExpense) / totalBudget) * 100 : 0;
  const priorityCategory = totalsByCategory[0];
  const priorityPercent = React.useMemo(() => {
    if (!priorityCategory) return 0;
    const budget = Number(budgets?.[range.budgetMode]?.[priorityCategory.categoryId] || 0);
    if (budget <= 0) return 0;
    return (priorityCategory.total / budget) * 100;
  }, [priorityCategory, budgets, range.budgetMode]);

  const upcomingItems = React.useMemo(() => {
    const now = new Date();
    return plannedItems.filter((p) => toDate(p.date) >= new Date(now.getFullYear(), now.getMonth(), now.getDate())).sort((a, b) => {
      if (a.date !== b.date) return String(a.date).localeCompare(String(b.date));
      if ((a.time || "") !== (b.time || "")) return String(a.time || "").localeCompare(String(b.time || ""));
      return Number(a.createdAt || 0) - Number(b.createdAt || 0);
    }).slice(0, 8);
  }, [plannedItems]);

  const rosterTransactions = React.useMemo(() => filteredTransactions.slice(0, 9), [filteredTransactions]);
  const rosterPlanned = React.useMemo(() => filteredPlanned.slice(0, 6), [filteredPlanned]);
  const selectableRoster = React.useMemo(() => [...rosterTransactions.map((tx) => ({ kind: "tx", id: tx.id })), ...rosterPlanned.map((item) => ({ kind: "planned", id: item.id }))], [rosterTransactions, rosterPlanned]);

  React.useEffect(() => {
    if (!selectableRoster.length) {
      if (selectedRecord.id !== null) setSelectedRecord({ kind: "tx", id: null });
      return;
    }
    const exists = selectableRoster.some((entry) => entry.kind === selectedRecord.kind && entry.id === selectedRecord.id);
    if (!exists) setSelectedRecord(selectableRoster[0]);
  }, [selectableRoster, selectedRecord]);

  const selectedTx = React.useMemo(() => (selectedRecord.kind === "tx" ? transactions.find((t) => t.id === selectedRecord.id) : null), [selectedRecord, transactions]);
  const selectedPlanned = React.useMemo(() => (selectedRecord.kind === "planned" ? plannedItems.find((p) => p.id === selectedRecord.id) : null), [selectedRecord, plannedItems]);
  const selectedItem = selectedRecord.kind === "planned" ? selectedPlanned : selectedTx;
  const selectedCategory = React.useMemo(() => (selectedItem ? categoriesById.get(selectedItem.categoryId) : null), [selectedItem, categoriesById]);
  const selectedBudget = React.useMemo(() => (selectedCategory ? Number(budgets?.[range.budgetMode]?.[selectedCategory.id] || 0) : 0), [selectedCategory, budgets, range.budgetMode]);
  const selectedSpent = React.useMemo(() => { if (!selectedCategory) return 0; const match = totalsByCategory.find((row) => row.categoryId === selectedCategory.id); return Number(match?.total || 0); }, [selectedCategory, totalsByCategory]);
  const selectedPlannedTotal = React.useMemo(() => (selectedCategory ? Number(plannedByCategory.get(selectedCategory.id) || 0) : 0), [selectedCategory, plannedByCategory]);
  const selectedForecast = selectedSpent + selectedPlannedTotal;
  const selectedLoadPct = selectedBudget > 0 ? (selectedForecast / selectedBudget) * 100 : 0;

  function getAccountById(accountId) {
    return accounts.find((account) => account.id === accountId) || null;
  }

  function getTransactionAccountSelection(tx) {
    const fromAccount = (tx.accountId ? getAccountById(tx.accountId) : null) || (tx.accountName ? findAccountByName(accounts, tx.accountName) : null) || (tx.account ? findAccountByName(accounts, tx.account) : null);
    const toAccount = tx.type === "transfer" ? ((tx.transferAccountId ? getAccountById(tx.transferAccountId) : null) || (tx.transferAccountName ? findAccountByName(accounts, tx.transferAccountName) : null)) : null;
    return { fromAccount, toAccount };
  }

  async function updateSingleAccountBalance(accountId, delta) {
    const account = getAccountById(accountId);
    if (!account) throw new Error("Selected account could not be found.");
    const nextBalance = roundMoneyValue((Number(account.balance) || 0) + delta);
    const { error } = await supabase.from("accounts").update({ balance: nextBalance, updated_at: new Date().toISOString() }).eq("user_id", user.id).eq("id", accountId);
    if (error) throw error;
    return { accountId, nextBalance };
  }

  function applyAccountStateUpdates(balanceUpdates) {
    if (!balanceUpdates.length) return;
    setAccounts((prev) => prev.map((account) => { const match = balanceUpdates.find((entry) => entry.accountId === account.id); return match ? { ...account, balance: match.nextBalance } : account; }));
  }

  async function applyAccountImpact({ type, amount, fromAccountId, toAccountId, reverse = false }) {
    const roundedAmount = roundMoneyValue(amount);
    if (!(roundedAmount > 0)) return;
    if (type === "expense") {
      const delta = reverse ? roundedAmount : -roundedAmount;
      const result = await updateSingleAccountBalance(fromAccountId, delta);
      applyAccountStateUpdates([result]);
      return;
    }
    if (type === "income") {
      const delta = reverse ? -roundedAmount : roundedAmount;
      const result = await updateSingleAccountBalance(fromAccountId, delta);
      applyAccountStateUpdates([result]);
      return;
    }
    if (type === "transfer") {
      if (!fromAccountId || !toAccountId) throw new Error("Pick both transfer accounts.");
      if (fromAccountId === toAccountId) throw new Error("Transfer accounts must be different.");
      const fromAccount = getAccountById(fromAccountId);
      const toAccount = getAccountById(toAccountId);
      if (!fromAccount || !toAccount) throw new Error("One of the selected transfer accounts no longer exists.");
      const fromDelta = reverse ? roundedAmount : -roundedAmount;
      const toDelta = reverse ? -roundedAmount : roundedAmount;
      const nextFromBalance = roundMoneyValue((Number(fromAccount.balance) || 0) + fromDelta);
      const nextToBalance = roundMoneyValue((Number(toAccount.balance) || 0) + toDelta);
      const { error: fromError } = await supabase.from("accounts").update({ balance: nextFromBalance, updated_at: new Date().toISOString() }).eq("user_id", user.id).eq("id", fromAccountId);
      if (fromError) throw fromError;
      const { error: toError } = await supabase.from("accounts").update({ balance: nextToBalance, updated_at: new Date().toISOString() }).eq("user_id", user.id).eq("id", toAccountId);
      if (toError) {
        await supabase.from("accounts").update({ balance: fromAccount.balance, updated_at: new Date().toISOString() }).eq("user_id", user.id).eq("id", fromAccountId);
        throw toError;
      }
      applyAccountStateUpdates([{ accountId: fromAccountId, nextBalance: nextFromBalance }, { accountId: toAccountId, nextBalance: nextToBalance }]);
    }
  }

  function clearQuickAdd() {
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
  }

  async function addNow() {
    setPageError("");
    if (!user) return;
    if (!accounts.length) return alert("Add at least one account first.");
    const amt = parseMoneyInput(qaAmount);
    if (!Number.isFinite(amt) || amt <= 0) return alert("Enter a valid amount.");
    if (!qaDate) return alert("Date required.");
    if (qaType === "expense" && !qaCategoryId && qaPayment !== "Bill Payment") return alert("Pick a category.");
    if ((qaType === "expense" || qaType === "income") && !qaAccountId) return alert("Pick an account.");
    if (qaType === "transfer" && (!qaAccountId || !qaTransferToAccountId)) return alert("Pick both transfer accounts.");
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
      const saved = mapTransactionRowToClient(data);
      try {
        await applyAccountImpact({ type: saved.type, amount: saved.amount, fromAccountId: saved.accountId || fromAccount?.id || "", toAccountId: saved.transferAccountId || toAccount?.id || "" });
      } catch (accountError) {
        await supabase.from("spending_transactions").delete().eq("id", saved.id).eq("user_id", user.id);
        throw accountError;
      }
      const category = categoriesById.get(saved.categoryId);
      await upsertCalendarEventForTransaction(saved, user.id, category);
      setTransactions((prev) => [saved, ...prev]);
      clearQuickAdd();
      setSelectedRecord({ kind: "tx", id: saved.id });
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
    if (!Number.isFinite(amt) || amt <= 0) return alert("Enter a valid amount.");
    if (!qaDate) return alert("Planned date required.");
    if (!qaCategoryId) return alert("Pick a category.");
    setSaving(true);
    try {
      const planned = { id: uid(), amount: Math.round(amt * 100) / 100, categoryId: qaCategoryId, date: qaDate, time: normalizeTime(qaTime), merchant: qaMerchant.trim(), note: qaNote.trim(), createdAt: Date.now() };
      const { data, error } = await supabase.from("spending_planned_items").insert([mapPlannedClientToRow(planned, user.id)]).select().single();
      if (error) throw error;
      const saved = mapPlannedRowToClient(data);
      const category = categoriesById.get(saved.categoryId);
      await upsertCalendarEventForPlanned(saved, user.id, category);
      setPlannedItems((prev) => [saved, ...prev]);
      clearQuickAdd();
      setSelectedRecord({ kind: "planned", id: saved.id });
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
    if (!confirm("Delete this transaction?")) return;
    try {
      const { fromAccount, toAccount } = getTransactionAccountSelection(tx);
      await applyAccountImpact({ type: tx.type, amount: tx.amount, fromAccountId: fromAccount?.id || "", toAccountId: toAccount?.id || "", reverse: true });
      const { error } = await supabase.from("spending_transactions").delete().eq("id", id).eq("user_id", user.id);
      if (error) throw error;
      setTransactions((prev) => prev.filter((entry) => entry.id !== id));
      await deleteCalendarEventBySource(user.id, "spending", id).catch(() => {});
      await deleteCalendarEventBySource(user.id, "income", id).catch(() => {});
    } catch (err) {
      setPageError(err?.message || "Failed to delete transaction.");
    }
  }

  async function duplicateTransaction(tx) {
    if (!user) return;
    try {
      const { fromAccount, toAccount } = getTransactionAccountSelection(tx);
      const clone = { ...tx, id: uid(), createdAt: Date.now(), account: tx.type === "transfer" ? [fromAccount?.name || tx.accountName, toAccount?.name || tx.transferAccountName].filter(Boolean).join(" → ") : fromAccount?.name || tx.accountName || tx.account, accountId: fromAccount?.id || tx.accountId || "", accountName: fromAccount?.name || tx.accountName || tx.account || "", transferAccountId: toAccount?.id || tx.transferAccountId || "", transferAccountName: toAccount?.name || tx.transferAccountName || "" };
      const { data, error } = await supabase.from("spending_transactions").insert([mapTransactionClientToRow(clone, user.id)]).select().single();
      if (error) throw error;
      const saved = mapTransactionRowToClient(data);
      try {
        await applyAccountImpact({ type: saved.type, amount: saved.amount, fromAccountId: clone.accountId, toAccountId: clone.transferAccountId });
      } catch (accountError) {
        await supabase.from("spending_transactions").delete().eq("id", saved.id).eq("user_id", user.id);
        throw accountError;
      }
      const category = categoriesById.get(saved.categoryId);
      await upsertCalendarEventForTransaction(saved, user.id, category);
      setTransactions((prev) => [saved, ...prev]);
      setSelectedRecord({ kind: "tx", id: saved.id });
      setMobileSection("focus");
    } catch (err) {
      setPageError(err?.message || "Failed to duplicate transaction.");
    }
  }

  async function deletePlanned(id) {
    if (!user) return;
    if (!confirm("Delete this planned item?")) return;
    const previous = plannedItems;
    setPlannedItems((prev) => prev.filter((p) => p.id !== id));
    try {
      const { error } = await supabase.from("spending_planned_items").delete().eq("id", id).eq("user_id", user.id);
      if (error) throw error;
      await deleteCalendarEventBySource(user.id, "planned_expense", id).catch(() => {});
    } catch (err) {
      setPlannedItems(previous);
      setPageError(err?.message || "Failed to delete planned item.");
    }
  }

  async function convertPlanned(planned) {
    if (!user) return;
    if (!accounts.length) return alert("Add at least one account first.");
    if (!confirm("Convert this planned item into a real transaction?")) return;
    const account = getAccountById(qaAccountId) || accounts[0] || null;
    if (!account) return alert("Pick an account first.");
    try {
      const tx = { id: uid(), type: "expense", amount: planned.amount, categoryId: planned.categoryId, date: planned.date, time: normalizeTime(planned.time || ""), merchant: planned.merchant || "", note: planned.note || "", paymentMethod: "Card", account: account.name, accountId: account.id, accountName: account.name, transferAccountId: "", transferAccountName: "", createdAt: Date.now() };
      const { data: insertedTx, error: txErr } = await supabase.from("spending_transactions").insert([mapTransactionClientToRow(tx, user.id)]).select().single();
      if (txErr) throw txErr;
      const savedTx = mapTransactionRowToClient(insertedTx);
      try {
        await applyAccountImpact({ type: "expense", amount: savedTx.amount, fromAccountId: account.id });
      } catch (accountError) {
        await supabase.from("spending_transactions").delete().eq("id", savedTx.id).eq("user_id", user.id);
        throw accountError;
      }
      const { error: plannedErr } = await supabase.from("spending_planned_items").delete().eq("id", planned.id).eq("user_id", user.id);
      if (plannedErr) {
        await applyAccountImpact({ type: "expense", amount: savedTx.amount, fromAccountId: account.id, reverse: true });
        await supabase.from("spending_transactions").delete().eq("id", savedTx.id).eq("user_id", user.id);
        throw plannedErr;
      }
      const category = categoriesById.get(savedTx.categoryId);
      await deleteCalendarEventBySource(user.id, "planned_expense", planned.id).catch(() => {});
      await upsertCalendarEventForTransaction(savedTx, user.id, category);
      setTransactions((prev) => [savedTx, ...prev]);
      setPlannedItems((prev) => prev.filter((p) => p.id !== planned.id));
      setSelectedRecord({ kind: "tx", id: savedTx.id });
      setMobileSection("focus");
    } catch (err) {
      setPageError(err?.message || "Failed to convert planned item.");
    }
  }

  async function addCategory() {
    if (!user) return;
    const name = newCategoryName.trim();
    const group = newCategoryGroup.trim() || "Other";
    if (!name) return alert("Category name required.");
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 30) || uid();
    if (categoriesById.get(id)) return alert("Category already exists.");
    try {
      const cat = normalizeCategory({ id, name, group, color: "#94a3b8", isBudgeted: true });
      const { data, error } = await supabase.from("spending_categories").insert([mapCategoryClientToRow(cat, user.id)]).select().single();
      if (error) throw error;
      setCategories((prev) => [...prev, mapCategoryRowToClient(data)].sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name)));
      setNewCategoryName("");
      setNewCategoryGroup("Other");
    } catch (err) {
      setPageError(err?.message || "Failed to add category.");
    }
  }

  async function deleteCategory(id) {
    if (!user) return;
    if (!confirm("Delete this category? Existing old transactions may show blank category.")) return;
    const previous = categories;
    setCategories((prev) => prev.filter((c) => c.id !== id));
    try {
      const { error } = await supabase.from("spending_categories").delete().eq("id", id).eq("user_id", user.id);
      if (error) throw error;
    } catch (err) {
      setCategories(previous);
      setPageError(err?.message || "Failed to delete category.");
    }
  }

  async function updateBudget(categoryId, amountStr) {
    if (!user) return;
    const amt = parseMoneyInput(amountStr);
    if (!Number.isFinite(amt) || amt < 0) return;
    const modeKey = range.budgetMode;
    const rounded = Math.round(amt * 100) / 100;
    setBudgets((prev) => ({ ...prev, [modeKey]: { ...(prev[modeKey] || {}), [categoryId]: rounded } }));
    const { error } = await supabase.from("spending_budgets").upsert({ user_id: user.id, period_mode: modeKey, category_id: categoryId, amount: rounded, updated_at: new Date().toISOString() }, { onConflict: "user_id,period_mode,category_id" });
    if (error) setPageError(error.message || "Failed to save budget.");
  }

  const quickAddSave = async () => { if (mode === "planned") return addPlanned(); return addNow(); };
  const currentMonth = new Date().toLocaleString(undefined, { month: "long", year: "numeric" });

  if (loading) {
    return <main className="spPage"><div className="spPageShell"><GlassPane size="card"><div style={{ fontWeight: 800, fontSize: 18, color: "#fff" }}>Loading spending...</div></GlassPane></div><style jsx global>{globalStyles}</style></main>;
  }

  if (!user) {
    return <main className="spPage"><div className="spPageShell"><GlassPane size="card"><div style={{ fontWeight: 800, fontSize: 18, color: "#fff" }}>This page needs an authenticated user.</div></GlassPane></div><style jsx global>{globalStyles}</style></main>;
  }

  const selectedBadgeTone = selectedRecord.kind === "planned" ? "amber" : selectedTx?.type === "income" ? "green" : selectedTx?.paymentMethod === "Bill Payment" ? "amber" : selectedTx?.type === "expense" ? "red" : "neutral";

  return (
    <>
      <main className="spPage">
        <div className="spPageShell">
          <GlassPane size="card">
            <div className="spHeroGrid">
              <div style={{ minWidth: 0 }}>
                <div className="spEyebrow">Life Command Center</div>
                <div className="spHeroTitle">Spending Command</div>
                <div className="spHeroSub">Live spending, planned items, account-linked transaction logging, and bill-payment visibility in one connected workspace.</div>
                <div className="spPillRow"><MiniPill>{range.label}</MiniPill><MiniPill>{filteredTransactions.length} logged</MiniPill><MiniPill tone="amber">{filteredPlanned.length} planned</MiniPill><MiniPill>{currentMonth}</MiniPill></div>
              </div>
              <div className="spHeroSide">
                <ActionBtn variant={period === "week" ? "primary" : "ghost"} onClick={() => setPeriod("week")}>Week</ActionBtn>
                <ActionBtn variant={period === "month" ? "primary" : "ghost"} onClick={() => setPeriod("month")}>Month</ActionBtn>
                <ActionBtn variant={period === "year" ? "primary" : "ghost"} onClick={() => setPeriod("year")}>Year</ActionBtn>
                <ActionBtn variant={tab === "overview" ? "primary" : "ghost"} onClick={() => setTab("overview")}>Overview</ActionBtn>
                <ActionBtn variant={tab === "manage" ? "primary" : "ghost"} onClick={() => setTab("manage")}>Manage</ActionBtn>
              </div>
            </div>
          </GlassPane>

          {pageError ? <GlassPane tone="red" size="card"><div style={{ fontWeight: 800, fontSize: 15, color: "#fff" }}>{pageError}</div></GlassPane> : null}

          <section className="spMetricGrid">
            <StatCard icon={Wallet} label="Spend Pressure" value={money(totals.expense)} detail={`${expenseTrend.value} ${expenseTrend.text}`} tone="red" />
            <StatCard icon={CalendarClock} label="Planned Queue" value={money(totals.plannedExpense)} detail={upcomingItems.length ? `${upcomingItems.length} upcoming item(s)` : "Nothing planned yet"} tone="amber" />
            <StatCard icon={PiggyBank} label="Remaining Budget" value={money(Math.max(remaining, 0))} detail={remaining < 0 ? `Over by ${money(Math.abs(remaining))}` : `From ${money(totalBudget)} budget`} tone={remaining < 0 ? "red" : "green"} />
            <StatCard icon={ArrowDownRight} label="Forecast Net" value={money(totals.forecastNet)} detail={`Live net ${money(totals.net)}`} tone={totals.forecastNet >= 0 ? "green" : "red"} />
          </section>

          {tab === "overview" ? (
            <>
              <GlassPane size="card">
                <PaneHeader title="Spending Controls" subcopy="Search the board, filter categories, and keep the center focus card locked on what matters." right={<MiniPill>{search ? "Filtered" : "Live board"}</MiniPill>} />
                <div className="spControlsGrid">
                  <div><div className="spTinyLabel">Search</div><div className="spSearchWrap"><Search size={15} /><input className="spField spSearchField" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search spending" /></div></div>
                  <div><div className="spTinyLabel">Category</div><select className="spField spFieldStrong" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}><option value="all">All categories</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.group} • {c.name}</option>)}</select></div>
                  <div><div className="spTinyLabel">Type</div><select className="spField spFieldStrong" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option value="all">All types</option><option value="expense">Expense</option><option value="income">Income</option><option value="transfer">Transfer</option></select></div>
                </div>
              </GlassPane>

              <div className="spMobileSwitch">{MOBILE_SECTIONS.map((item) => <ActionBtn key={item.value} variant={mobileSection === item.value ? "primary" : "ghost"} onClick={() => setMobileSection(item.value)}>{item.label}</ActionBtn>)}</div>

              <section className="spWorkspaceGrid">
                <GlassPane size="card" className={`spMobilePanel ${mobileSection === "list" ? "spMobilePanelActive" : ""}`}>
                  <div className="spRosterPane">
                    <PaneHeader title="Spend Feed" subcopy="Transactions first. Planned queue stays grouped below it." right={<MiniPill>{rosterTransactions.length + rosterPlanned.length} showing</MiniPill>} />
                    <div className="spRosterList">
                      {rosterTransactions.length === 0 && rosterPlanned.length === 0 ? <div className="spEmptyState"><div><div className="spEmptyTitle">No spending records</div><div className="spEmptyText">Nothing matches this range yet.</div></div></div> : null}
                      {rosterTransactions.map((tx) => {
                        const cat = categoriesById.get(tx.categoryId);
                        const badgeTone = tx.type === "income" ? "green" : tx.paymentMethod === "Bill Payment" ? "amber" : tx.type === "expense" ? "red" : "neutral";
                        const amountPrefix = tx.type === "income" ? "+" : tx.type === "expense" ? "-" : "";
                        return (
                          <button key={tx.id} type="button" className={`spRosterRow ${selectedRecord.kind === "tx" && selectedRecord.id === tx.id ? "spRosterRowActive" : ""}`} onClick={() => { setSelectedRecord({ kind: "tx", id: tx.id }); setMobileSection("focus"); }}>
                            <div className="spRosterIcon">{tx.type === "income" ? <ArrowUpRight size={16} /> : tx.type === "transfer" ? <ArrowLeftRight size={16} /> : tx.paymentMethod === "Bill Payment" ? <CreditCard size={16} /> : <ArrowDownRight size={16} />}</div>
                            <div style={{ minWidth: 0 }}>
                              <div className="spRosterTitle">{tx.merchant || cat?.name || (tx.type === "income" ? "Income" : "Transaction")}</div>
                              <div className="spRosterSub">{cat?.name || (tx.paymentMethod === "Bill Payment" ? "Bill Payment" : tx.type)} • {shortDate(tx.date)} • {fmtTime(tx.time)}</div>
                              <div className="spRosterMetaRow">{tx.paymentMethod === "Bill Payment" ? <MiniPill tone="amber">Bill Sync</MiniPill> : null}{tx.account ? <MiniPill>{tx.account}</MiniPill> : null}</div>
                            </div>
                            <div className="spRosterAmount">{amountPrefix}{money(tx.amount)}</div>
                          </button>
                        );
                      })}
                      {rosterPlanned.length ? <div className="spSectionDivider">Planned Queue</div> : null}
                      {rosterPlanned.map((item) => {
                        const cat = categoriesById.get(item.categoryId);
                        return (
                          <button key={item.id} type="button" className={`spRosterRow spRosterRowPlanned ${selectedRecord.kind === "planned" && selectedRecord.id === item.id ? "spRosterRowActive" : ""}`} onClick={() => { setSelectedRecord({ kind: "planned", id: item.id }); setMobileSection("focus"); }}>
                            <div className="spRosterIcon"><CalendarClock size={16} /></div>
                            <div style={{ minWidth: 0 }}>
                              <div className="spRosterTitle">{item.merchant || cat?.name || "Planned Expense"}</div>
                              <div className="spRosterSub">{cat?.name || "Uncategorized"} • {shortDate(item.date)} • {fmtTime(item.time)}</div>
                              <div className="spRosterMetaRow"><MiniPill tone="amber">Planned</MiniPill></div>
                            </div>
                            <div className="spRosterAmount">{money(item.amount)}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </GlassPane>

                <div className={`spMobilePanel ${mobileSection === "focus" ? "spMobilePanelActive" : ""}`}>
                  <GlassPane size="card" style={{ height: "100%" }}>
                    <PaneHeader title={selectedRecord.kind === "planned" ? "Planned Focus" : "Spending Focus"} subcopy="One serious center card instead of a loose dashboard stack." right={selectedItem ? <MiniPill tone={selectedBadgeTone}>{selectedRecord.kind === "planned" ? "Planned" : selectedTx?.paymentMethod === "Bill Payment" ? "Bill" : selectedTx?.type || "Live"}</MiniPill> : null} />
                    {!selectedItem ? <div className="spEmptyState" style={{ minHeight: 280 }}><div><div className="spEmptyTitle">No item selected</div><div className="spEmptyText">Choose a transaction or planned item from the feed.</div></div></div> : <div className="spFocusBox">
                      <div className="spFocusHero">
                        <div>
                          <div className="spTinyLabel">Selected Record</div>
                          <div className="spFocusTitle">{selectedRecord.kind === "planned" ? selectedPlanned?.merchant || selectedCategory?.name || "Planned Expense" : selectedTx?.merchant || selectedCategory?.name || (selectedTx?.type === "income" ? "Income" : selectedTx?.paymentMethod === "Bill Payment" ? "Bill Payment" : "Transaction")}</div>
                          <div className={`spFocusAmount ${selectedRecord.kind === "planned" ? "spValueWarn" : selectedTx?.type === "income" ? "spValueGood" : selectedTx?.paymentMethod === "Bill Payment" ? "spValueWarn" : selectedTx?.type === "expense" ? "spValueBad" : "spValueWarn"}`}>{selectedRecord.kind === "planned" ? money(selectedPlanned?.amount || 0) : `${selectedTx?.type === "income" ? "+" : selectedTx?.type === "expense" ? "-" : ""}${money(selectedTx?.amount || 0)}`}</div>
                          <div className="spFocusSub">{selectedCategory?.name || (selectedTx?.paymentMethod === "Bill Payment" ? "Bill Payment" : "Uncategorized")} • {shortDate(selectedItem.date)} • {fmtTime(selectedItem.time)}</div>
                        </div>
                        <div className="spFocusPills">
                          {selectedCategory ? <MiniPill>{selectedCategory.name}</MiniPill> : null}
                          {selectedRecord.kind === "planned" ? <MiniPill tone="amber">Pending</MiniPill> : null}
                          {selectedTx?.paymentMethod === "Bill Payment" ? <MiniPill tone="amber">Bill Sync</MiniPill> : null}
                          {selectedTx?.account ? <MiniPill>{selectedTx.account}</MiniPill> : null}
                        </div>
                      </div>

                      <div style={{ marginTop: 14 }}><ProgressBar value={selectedBudget > 0 ? selectedLoadPct : 0} color={selectedBudget > 0 && selectedLoadPct >= 100 ? "var(--lcc-red)" : selectedBudget > 0 && selectedLoadPct >= 85 ? "var(--lcc-amber)" : "var(--lcc-green)"} /></div>

                      <div className="spInfoGrid" style={{ marginTop: 14 }}>
                        <div className="spInfoCell"><div className="spTinyLabel">Category Budget</div><div className="spInfoValue">{selectedBudget > 0 ? money(selectedBudget) : "None"}</div><div className="spInfoSub">{selectedCategory?.name || "No category budget"}</div></div>
                        <div className="spInfoCell"><div className="spTinyLabel">Category Forecast</div><div className="spInfoValue">{money(selectedForecast)}</div><div className="spInfoSub">Spent plus planned for this category.</div></div>
                        <div className="spInfoCell"><div className="spTinyLabel">Account / Method</div><div className="spInfoValue">{selectedRecord.kind === "planned" ? "Planned" : selectedTx?.paymentMethod || "—"}</div><div className="spInfoSub">{selectedRecord.kind === "planned" ? "No account hit yet" : selectedTx?.account || "No linked account"}</div></div>
                        <div className="spInfoCell"><div className="spTinyLabel">Notes</div><div className="spInfoValue">{selectedItem.note ? "Saved" : "—"}</div><div className="spInfoSub">{selectedItem.note || "No note on this record."}</div></div>
                      </div>

                      <div className="spFocusSplit">
                        <div className="spSectionCard">
                          <PaneHeader title="Trend" subcopy="Visible period expense trend." />
                          <SpendingBarsChart data={trendData} />
                        </div>
                        <div className="spSectionCard">
                          <PaneHeader title="Actions" subcopy="Keep edits decisive and clean." />
                          <div className="spRailList">
                            {selectedRecord.kind === "planned" && selectedPlanned ? <><ActionBtn variant="primary" full onClick={() => convertPlanned(selectedPlanned)}>Convert to Real</ActionBtn><ActionBtn variant="danger" full onClick={() => deletePlanned(selectedPlanned.id)}><Trash2 size={14} />Delete Planned</ActionBtn></> : selectedTx ? <><ActionBtn full onClick={() => duplicateTransaction(selectedTx)}><Copy size={14} />Duplicate</ActionBtn><ActionBtn variant="danger" full onClick={() => deleteTransaction(selectedTx.id)}><Trash2 size={14} />Delete</ActionBtn></> : null}
                          </div>
                        </div>
                      </div>
                    </div>}
                  </GlassPane>
                </div>

                <div className={`spRailStack spMobilePanel ${mobileSection === "tools" ? "spMobilePanelActive" : ""}`}>
                  <GlassPane size="card">
                    <PaneHeader title="Quick Add" subcopy="This hits the real account balance, not just the label." right={<MiniPill>{mode === "planned" ? "Planned" : "Live"}</MiniPill>} />
                    <div className="spInlineTools"><ActionBtn variant={mode === "now" ? "primary" : "ghost"} onClick={() => setMode("now")}>Now</ActionBtn><ActionBtn variant={mode === "planned" ? "primary" : "ghost"} onClick={() => { setMode("planned"); setQaType("expense"); }}>Planned</ActionBtn></div>
                    <div className="spFormStack" style={{ marginTop: 14 }}>
                      <div className="spFormGrid2">
                        <div><div className="spTinyLabel">Type</div>{mode === "now" ? <select className="spField spFieldStrong" value={qaType} onChange={(e) => setQaType(e.target.value)}><option value="expense">Expense</option><option value="income">Income</option><option value="transfer">Transfer</option></select> : <div className="spFixedTag">PLANNED EXPENSE</div>}</div>
                        <div><div className="spTinyLabel">Amount</div><input className="spField spFieldStrong" inputMode="decimal" placeholder="0.00" value={qaAmount} onChange={(e) => setQaAmount(e.target.value)} /></div>
                      </div>
                      <div className="spFormGrid2">
                        <div><div className="spTinyLabel">Date</div><input className="spField spFieldStrong" type="date" value={qaDate} onChange={(e) => setQaDate(e.target.value)} /></div>
                        <div><div className="spTinyLabel">Time</div><input className="spField spFieldStrong" type="time" value={qaTime} onChange={(e) => setQaTime(e.target.value)} /></div>
                      </div>
                      <div className="spFormGrid2">
                        <div><div className="spTinyLabel">Category</div><select className="spField spFieldStrong" value={qaCategoryId} onChange={(e) => setQaCategoryId(e.target.value)} disabled={mode === "now" && qaType !== "expense"}>{categories.map((c) => <option key={c.id} value={c.id}>{c.group} • {c.name}</option>)}</select></div>
                        <div><div className="spTinyLabel">Merchant / Source</div><input className="spField spFieldStrong" placeholder={qaType === "income" ? "Where did it come from?" : qaType === "transfer" ? "Optional transfer note" : "Where did it go?"} value={qaMerchant} onChange={(e) => setQaMerchant(e.target.value)} /></div>
                      </div>
                      {mode === "planned" ? <div className="spFixedHint">Planned items hit the calendar and forecast, but they do not move account balances until converted.</div> : qaType === "transfer" ? <div className="spFormGrid2"><div><div className="spTinyLabel">From Account</div><select className="spField spFieldStrong" value={qaAccountId} onChange={(e) => setQaAccountId(e.target.value)}><option value="">Select account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} • {money(account.balance)}</option>)}</select></div><div><div className="spTinyLabel">To Account</div><select className="spField spFieldStrong" value={qaTransferToAccountId} onChange={(e) => setQaTransferToAccountId(e.target.value)}><option value="">Select account</option>{accounts.filter((account) => account.id !== qaAccountId).map((account) => <option key={account.id} value={account.id}>{account.name} • {money(account.balance)}</option>)}</select></div></div> : <div className="spFormGrid2"><div><div className="spTinyLabel">Payment Method</div><select className="spField spFieldStrong" value={qaPayment} onChange={(e) => setQaPayment(e.target.value)}><option>Card</option><option>Cash</option><option>ACH</option><option>Transfer</option></select></div><div><div className="spTinyLabel">Account</div><select className="spField spFieldStrong" value={qaAccountId} onChange={(e) => setQaAccountId(e.target.value)}><option value="">Select account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} • {money(account.balance)}</option>)}</select></div></div>}
                      <div><div className="spTinyLabel">Note</div><textarea className="spField spFieldStrong spTextarea" placeholder="Optional note" value={qaNote} onChange={(e) => setQaNote(e.target.value)} /></div>
                      <div className="spInlineTools"><ActionBtn variant="primary" onClick={quickAddSave} disabled={saving}><Plus size={14} />{saving ? "Saving..." : mode === "planned" ? "Save Planned" : "Save Transaction"}</ActionBtn><ActionBtn onClick={clearQuickAdd} disabled={saving}>Reset</ActionBtn></div>
                    </div>
                  </GlassPane>

                  <GlassPane size="card">
                    <PaneHeader title="Pressure Read" subcopy="Quick command stats without killing space." />
                    <div className="spRailList"><div className="spMiniCard"><div className="spTinyLabel">Budget Load</div><div className="spMiniValue">{totalBudget > 0 ? `${clamp(budgetLoad, 0, 999).toFixed(0)}%` : "0%"}</div><div className="spMiniSub">Forecast pressure against total budget.</div></div><div className="spMiniCard"><div className="spTinyLabel">Logged This Range</div><div className="spMiniValue">{filteredTransactions.length}</div><div className="spMiniSub">Transaction count inside the selected period.</div></div><div className="spMiniCard"><div className="spTinyLabel">Upcoming Planned</div><div className="spMiniValue">{upcomingItems.length}</div><div className="spMiniSub">Planned items waiting to hit.</div></div></div>
                  </GlassPane>
                </div>
              </section>
            </>
          ) : (
            <section className="spManageGrid">
              <GlassPane size="card">
                <PaneHeader title="Manage Spend" subcopy="Search, clean up, convert planned items, and tune budgets." />
                <div className="spControlsGrid" style={{ marginBottom: 16 }}>
                  <div><div className="spTinyLabel">Search</div><div className="spSearchWrap"><Search size={15} /><input className="spField spSearchField" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search transactions or planned items" /></div></div>
                  <div><div className="spTinyLabel">Type</div><select className="spField spFieldStrong" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option value="all">All types</option><option value="expense">Expense</option><option value="income">Income</option><option value="transfer">Transfer</option></select></div>
                  <div><div className="spTinyLabel">Category</div><select className="spField spFieldStrong" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}><option value="all">All categories</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.group} • {c.name}</option>)}</select></div>
                </div>
                <div className="spManageSplit">
                  <div className="spScrollableStack">
                    <PaneHeader title="Transactions" subcopy="Current range results." />
                    {filteredTransactions.length === 0 ? <div className="spEmptyState"><div><div className="spEmptyTitle">No transactions match</div><div className="spEmptyText">Try a looser filter.</div></div></div> : filteredTransactions.map((tx) => { const cat = categoriesById.get(tx.categoryId); return <div key={tx.id} className="spManageRow"><div className="spManageRowHead"><div><div className="spRosterTitle">{tx.merchant || cat?.name || (tx.type === "income" ? "Income" : "Transaction")}</div><div className="spRosterSub">{shortDate(tx.date)} • {fmtTime(tx.time)} • {tx.type === "income" ? "Income" : cat?.name || (tx.paymentMethod === "Bill Payment" ? "Bill Payment" : "Uncategorized")}</div>{tx.note ? <div className="spRosterSub">{tx.note}</div> : null}</div><div style={{ textAlign: "right" }}><div className="spRosterAmount">{tx.type === "income" ? "+" : tx.type === "expense" ? "-" : ""}{money(tx.amount)}</div><div className="spRosterSub">{tx.account || tx.paymentMethod}</div></div></div><div className="spInlineTools" style={{ marginTop: 12 }}><ActionBtn onClick={() => duplicateTransaction(tx)}><Copy size={14} />Duplicate</ActionBtn><ActionBtn variant="danger" onClick={() => deleteTransaction(tx.id)}><Trash2 size={14} />Delete</ActionBtn></div></div>; })}
                  </div>
                  <div className="spScrollableStack">
                    <PaneHeader title="Planned Items" subcopy="Convert or clear them." />
                    {filteredPlanned.length === 0 ? <div className="spEmptyState"><div><div className="spEmptyTitle">No planned items</div><div className="spEmptyText">Nothing planned matches this filter.</div></div></div> : filteredPlanned.map((item) => { const cat = categoriesById.get(item.categoryId); return <div key={item.id} className="spManageRow spManageRowPlanned"><div className="spManageRowHead"><div><div className="spRosterTitle">{item.merchant || cat?.name || "Planned Expense"}</div><div className="spRosterSub">{shortDate(item.date)} • {fmtTime(item.time)} • {cat?.name || "Uncategorized"}</div>{item.note ? <div className="spRosterSub">{item.note}</div> : null}</div><div style={{ textAlign: "right" }}><div className="spRosterAmount">{money(item.amount)}</div></div></div><div className="spInlineTools" style={{ marginTop: 12 }}><ActionBtn variant="primary" onClick={() => convertPlanned(item)}>Convert to Real</ActionBtn><ActionBtn variant="danger" onClick={() => deletePlanned(item.id)}><Trash2 size={14} />Delete</ActionBtn></div></div>; })}
                  </div>
                </div>
              </GlassPane>

              <div className="spRailStack">
                <GlassPane size="card">
                  <PaneHeader title="Category Control" subcopy="Add and clean up categories." />
                  <div className="spFormGrid2"><input className="spField spFieldStrong" placeholder="New category name" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} /><select className="spField spFieldStrong" value={newCategoryGroup} onChange={(e) => setNewCategoryGroup(e.target.value)}>{groups.filter((g) => g !== "All").map((g) => <option key={g} value={g}>{g}</option>)}</select></div>
                  <div className="spInlineTools" style={{ marginTop: 12 }}><ActionBtn variant="primary" onClick={addCategory}><Plus size={14} />Add Category</ActionBtn></div>
                  <div className="spScrollableStack" style={{ marginTop: 14, maxHeight: 360 }}>
                    {categories.map((cat) => <div key={cat.id} className="spManageRow"><div className="spManageRowHead"><div><div className="spRosterTitle">{cat.name}</div><div className="spRosterSub">{cat.group}</div></div><div className="spInlineTools"><MiniPill>{cat.isBudgeted ? "Budgeted" : "Tracked"}</MiniPill><ActionBtn variant="danger" onClick={() => deleteCategory(cat.id)}><Trash2 size={14} />Delete</ActionBtn></div></div></div>)}
                  </div>
                </GlassPane>
                <GlassPane size="card">
                  <PaneHeader title="Budget Tune" subcopy={`Edit ${range.budgetMode} budgets in place.`} right={<MiniPill>{range.budgetMode}</MiniPill>} />
                  <div className="spScrollableStack" style={{ maxHeight: 460 }}>
                    {budgetRows.length === 0 ? <div className="spEmptyState"><div><div className="spEmptyTitle">No budget rows</div><div className="spEmptyText">Start using categories and budgets.</div></div></div> : budgetRows.map((row) => { const tone = statusTone(row.forecastStatus); const progressColor = row.forecastStatus === "Over" ? "var(--lcc-red)" : row.forecastStatus === "Near" ? "var(--lcc-amber)" : "var(--lcc-green)"; const progressPct = row.budget > 0 ? (row.forecast / row.budget) * 100 : 0; return <div key={row.id} className="spManageRow"><div className="spManageRowHead"><div><div className="spRosterTitle">{row.name}</div><div className="spRosterSub">{money(row.spent)} spent • {money(row.planned)} planned</div></div><span className="spStatusPill" style={tone}>{row.forecastStatus}</span></div><div style={{ marginTop: 12 }}><ProgressBar value={progressPct} color={progressColor} /></div><div className="spFormGrid2" style={{ marginTop: 12 }}><div><div className="spTinyLabel">Budget</div><input className="spField spFieldStrong" defaultValue={row.budget ? String(row.budget) : ""} placeholder="0.00" onBlur={(e) => updateBudget(row.id, e.target.value)} /></div><div><div className="spTinyLabel">Forecast</div><div className="spFixedTag">{money(row.forecast)}</div></div></div></div>; })}
                  </div>
                </GlassPane>
              </div>
            </section>
          )}
        </div>
      </main>

      <style jsx global>{globalStyles}</style>
    </>
  );
}

const globalStyles = `
  .spPage { width: 100%; min-width: 0; color: var(--lcc-text); font-family: var(--lcc-font-sans); }
  .spPageShell { width: 100%; max-width: none; margin: 0; padding: 0 0 20px; display: grid; gap: 14px; }
  .spEyebrow { font-size: 10px; text-transform: uppercase; letter-spacing: .22em; font-weight: 800; color: rgba(255,255,255,0.42); }
  .spHeroTitle { margin-top: 8px; font-size: clamp(24px, 3.2vw, 34px); line-height: 1.02; font-weight: 850; letter-spacing: -0.05em; color: #fff; }
  .spHeroSub { margin-top: 8px; font-size: 13px; line-height: 1.55; color: rgba(255,255,255,0.62); max-width: 840px; }
  .spHeroGrid { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 14px; align-items: start; }
  .spHeroSide { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; align-content: flex-start; }
  .spPillRow { margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap; }
  .spMetricGrid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
  .spControlsGrid { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, .8fr) minmax(200px, .58fr); gap: 14px; align-items: end; }
  .spWorkspaceGrid { display: grid; grid-template-columns: minmax(300px, .88fr) minmax(0, 1.42fr) minmax(300px, .82fr); gap: 14px; align-items: stretch; }
  .spManageGrid { display: grid; grid-template-columns: minmax(0, 1.28fr) minmax(300px, .82fr); gap: 14px; }
  .spManageSplit { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
  .spWorkspaceGrid > *, .spManageGrid > * { min-width: 0; height: 100%; }
  .spRosterPane { height: 100%; min-height: 0; display: flex; flex-direction: column; }
  .spRailStack { display: grid; gap: 14px; }
  .spSearchWrap { position: relative; display: flex; align-items: center; gap: 8px; min-height: 46px; border-radius: 16px; border: 1px solid rgba(214,226,255,0.11); background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.012)), rgba(8, 12, 20, 0.82); color: rgba(255,255,255,0.58); padding: 0 12px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.03), 0 10px 30px rgba(0,0,0,0.16); }
  .spSearchField { min-height: 42px !important; border: 0 !important; background: transparent !important; box-shadow: none !important; padding: 0 !important; }
  .spActionBtn { min-height: 42px; padding: 10px 13px; border-radius: 15px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-size: 13px; font-weight: 800; line-height: 1; transition: transform 160ms ease, border-color 160ms ease, background 160ms ease, box-shadow 160ms ease; box-shadow: inset 0 1px 0 rgba(255,255,255,0.03), 0 8px 20px rgba(0,0,0,0.14); }
  .spActionBtn:hover { transform: translateY(-1px); }
  .spTinyLabel { display: block; margin-bottom: 8px; font-size: 10px; color: rgba(255,255,255,0.46); text-transform: uppercase; letter-spacing: .16em; font-weight: 800; }
  .spField { width: 100%; min-height: 46px; border-radius: 16px; border: 1px solid rgba(214,226,255,0.11); background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.012)), rgba(8, 12, 20, 0.84); color: var(--lcc-text); padding: 0 14px; outline: none; font: inherit; box-shadow: inset 0 1px 0 rgba(255,255,255,0.03), 0 8px 22px rgba(0,0,0,0.14); transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease, transform 160ms ease; }
  .spFieldStrong { border-color: rgba(214,226,255,0.14); background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.014)), rgba(7, 12, 21, 0.9); }
  .spField:focus { border-color: rgba(143,177,255,0.34); box-shadow: 0 0 0 4px rgba(79,114,255,0.08), 0 14px 28px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.04); transform: translateY(-1px); }
  .spField::placeholder { color: rgba(225,233,245,0.38); }
  .spField option { background: #08111f; color: #f4f7ff; }
  .spTextarea { min-height: 110px; resize: vertical; padding: 12px 14px; }
  .spRosterList, .spScrollableStack { flex: 1 1 auto; min-height: 0; overflow: auto; display: grid; gap: 10px; padding-right: 2px; }
  .spRosterRow { width: 100%; display: grid; grid-template-columns: 44px minmax(0, 1fr) auto; gap: 12px; align-items: center; min-height: 94px; padding: 12px 14px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.07); background: linear-gradient(180deg, rgba(8,13,24,0.78), rgba(4,8,16,0.74)); cursor: pointer; transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease; text-align: left; }
  .spRosterRow:hover { transform: translateY(-1px); }
  .spRosterRowActive { border-color: rgba(143,177,255,0.24); box-shadow: inset 0 1px 0 rgba(255,255,255,0.03), 0 0 0 1px rgba(255,255,255,0.01), 0 0 24px rgba(140,170,255,0.08); }
  .spRosterRowPlanned { background: linear-gradient(180deg, rgba(255,183,86,0.08), rgba(4,8,16,0.74)); }
  .spRosterIcon { width: 42px; height: 42px; border-radius: 14px; display: grid; place-items: center; border: 1px solid rgba(255,255,255,0.05); background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.012)), rgba(8, 12, 20, 0.72); color: rgba(247,251,255,0.88); }
  .spRosterTitle { font-size: 14px; font-weight: 800; color: #fff; line-height: 1.2; overflow-wrap: anywhere; }
  .spRosterSub { margin-top: 4px; font-size: 11.5px; color: rgba(255,255,255,0.54); line-height: 1.35; }
  .spRosterMetaRow { margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap; }
  .spRosterAmount { font-size: 15px; font-weight: 850; color: #fff; white-space: nowrap; }
  .spEmptyState { min-height: 150px; display: grid; place-items: center; text-align: center; padding: 14px; }
  .spEmptyTitle { font-size: 16px; font-weight: 850; color: #fff; }
  .spEmptyText { margin-top: 6px; font-size: 13px; line-height: 1.5; color: rgba(255,255,255,0.60); max-width: 360px; }
  .spFocusBox { border-radius: 24px; border: 1px solid rgba(214,226,255,0.12); background: linear-gradient(180deg, rgba(255,255,255,0.032), rgba(255,255,255,0.01)); padding: 16px; min-height: 100%; box-shadow: inset 0 1px 0 rgba(255,255,255,0.03), 0 18px 50px rgba(0,0,0,0.18); }
  .spFocusHero { display: grid; gap: 12px; }
  .spFocusTitle { margin-top: 8px; font-size: clamp(22px, 2.5vw, 30px); line-height: 1; font-weight: 850; letter-spacing: -0.04em; color: #fff; }
  .spFocusAmount { margin-top: 10px; font-size: clamp(34px, 4vw, 52px); line-height: 1; font-weight: 850; letter-spacing: -0.05em; }
  .spFocusSub { margin-top: 8px; font-size: 12px; color: rgba(255,255,255,0.58); }
  .spFocusPills { display: flex; gap: 8px; flex-wrap: wrap; }
  .spValueGood { color: #97efc7; }
  .spValueBad { color: #ffb4c5; }
  .spValueWarn { color: #f5cf88; }
  .spInfoGrid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
  .spInfoCell { border-radius: 18px; border: 1px solid rgba(255,255,255,0.055); background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.018)); padding: 12px; }
  .spInfoValue { font-size: 0.98rem; font-weight: 900; line-height: 1.15; color: #fff; overflow-wrap: anywhere; }
  .spInfoSub { margin-top: 5px; color: rgba(255,255,255,0.62); font-size: 0.79rem; line-height: 1.4; }
  .spFocusSplit { margin-top: 14px; display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(260px, 0.82fr); gap: 14px; }
  .spSectionCard { border-radius: 22px; border: 1px solid rgba(214,226,255,0.11); background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.012)); padding: 14px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.03); }
  .spRailList { display: grid; gap: 10px; }
  .spMiniCard { border-radius: 16px; border: 1px solid rgba(255,255,255,0.055); background: rgba(255,255,255,0.024); padding: 12px; }
  .spMiniValue { margin-top: 6px; font-size: 22px; font-weight: 900; line-height: 1; color: #fff; }
  .spMiniSub { margin-top: 6px; font-size: 12px; line-height: 1.45; color: rgba(255,255,255,0.62); }
  .spInlineTools { display: flex; gap: 8px; flex-wrap: wrap; }
  .spFormStack { display: grid; gap: 12px; }
  .spFormGrid2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .spProgress { height: 10px; overflow: hidden; border-radius: 999px; background: rgba(255,255,255,.1); }
  .spProgressFill { height: 100%; border-radius: 999px; transition: width .45s ease; }
  .spBarsWrap { overflow: hidden; border-radius: 24px; border: 1px solid rgba(255,255,255,.055); background: linear-gradient(180deg, rgba(8,13,24,.34), rgba(5,9,17,.14)); padding: 10px 10px 4px; }
  .spBarsSvg { display: block; width: 100%; height: 250px; }
  .spFixedTag { min-height: 46px; padding: 0 14px; border-radius: 16px; border: 1px solid rgba(214,226,255,0.12); background: rgba(255,255,255,0.03); display: flex; align-items: center; color: rgba(247,251,255,0.9); font-size: 12px; font-weight: 800; }
  .spFixedHint { font-size: 12px; line-height: 1.45; color: rgba(255,255,255,0.60); border-radius: 16px; border: 1px solid rgba(255,255,255,0.06); background: rgba(255,255,255,0.024); padding: 12px 14px; }
  .spSectionDivider { margin-top: 4px; font-size: 10px; text-transform: uppercase; letter-spacing: .16em; color: rgba(255,255,255,0.38); font-weight: 900; }
  .spManageRow { border-radius: 18px; border: 1px solid rgba(255,255,255,0.07); background: linear-gradient(180deg, rgba(8,13,24,0.78), rgba(4,8,16,0.72)); padding: 12px; }
  .spManageRowPlanned { background: linear-gradient(180deg, rgba(255,183,86,0.08), rgba(4,8,16,0.72)); }
  .spManageRowHead { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; flex-wrap: wrap; }
  .spStatusPill { display: inline-flex; align-items: center; min-height: 30px; padding: 6px 10px; border-radius: 999px; font-size: 11px; font-weight: 900; letter-spacing: .04em; }
  .spMobileSwitch { display: none; gap: 8px; }
  .spMobilePanel { min-width: 0; }

  @media (max-width: 1420px) {
    .spControlsGrid { grid-template-columns: 1fr; }
    .spWorkspaceGrid { grid-template-columns: minmax(280px, .94fr) minmax(0, 1fr); }
    .spRailStack { grid-column: 1 / -1; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .spFocusSplit { grid-template-columns: 1fr; }
    .spManageGrid { grid-template-columns: 1fr; }
  }

  @media (max-width: 1180px) {
    .spMetricGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .spInfoGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .spManageSplit { grid-template-columns: 1fr; }
  }

  @media (max-width: 980px) {
    .spHeroGrid { grid-template-columns: 1fr; }
    .spHeroSide { justify-content: flex-start; }
    .spRailStack { grid-template-columns: 1fr; }
    .spMobileSwitch { display: flex; flex-wrap: wrap; }
    .spWorkspaceGrid { grid-template-columns: 1fr; }
    .spMobilePanel { display: none; }
    .spMobilePanel.spMobilePanelActive { display: block; }
  }

  @media (max-width: 760px) {
    .spMetricGrid, .spInfoGrid, .spFormGrid2 { grid-template-columns: 1fr; }
    .spRosterRow { grid-template-columns: 44px minmax(0, 1fr); }
    .spRosterAmount { grid-column: 2; white-space: normal; font-size: 13px; color: rgba(255,255,255,0.74); }
    .spPageShell { padding: 0 0 14px; }
  }
`;

"use client";

import * as React from "react";
import { supabase } from "@/lib/supabaseClient";

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

const TONE = { red: "#ff6b7f", green: "#4ade80", amber: "#f59e0b", blue: "#60a5fa" };

function uid() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
function pad2(n) { return String(n).padStart(2, "0"); }
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function toDate(iso) { return new Date(`${iso}T00:00:00`); }
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
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
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
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0); }
function endOfMonth(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999); }
function startOfYear(d) { return new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0); }
function endOfYear(d) { return new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999); }
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
function groupTransactionsForTrend(transactions, start, period) {
  const pad = (n) => String(n).padStart(2, "0");
  const makeKeys = () => {
    if (period === "week") {
      return Array.from({ length: 7 }).map((_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      });
    }
    if (period === "year") {
      return Array.from({ length: 12 }).map((_, i) => {
        const d = new Date(start.getFullYear(), i, 1);
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
      });
    }
    const days = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    return Array.from({ length: days }).map((_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), i + 1);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    });
  };
  const labelForKey = (key) => {
    const d = toDate(key);
    if (period === "year") return d.toLocaleDateString(undefined, { month: "short" });
    if (period === "month") return String(d.getDate());
    return d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3);
  };
  const keys = makeKeys();
  const totals = new Map(keys.map((k) => [k, 0]));
  for (const tx of transactions) {
    if (tx.type !== "expense") continue;
    if (period === "year") {
      const d = toDate(tx.date);
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
      totals.set(key, (totals.get(key) || 0) + (Number(tx.amount) || 0));
    } else {
      totals.set(tx.date, (totals.get(tx.date) || 0) + (Number(tx.amount) || 0));
    }
  }
  return keys.map((key) => ({ key, label: labelForKey(key), value: Number(totals.get(key) || 0) }));
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
    const prevStart = new Date(start.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
    const prevEnd = new Date(start.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
    return { start: prevStart, end: prevEnd };
  }
  const prevStart = new Date(start.getFullYear(), start.getMonth() - 1, 1, 0, 0, 0, 0);
  const prevEnd = new Date(start.getFullYear(), start.getMonth(), 0, 23, 59, 59, 999);
  return { start: prevStart, end: prevEnd };
}
function sumExpenses(rows) { return rows.reduce((sum, t) => sum + (t.type === "expense" ? Number(t.amount) || 0 : 0), 0); }
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
function mapTransactionRowToClient(row) {
  return { id: row.id, type: row.type, amount: Number(row.amount) || 0, categoryId: row.category_id || "", date: row.tx_date, time: normalizeTime(row.tx_time || ""), merchant: row.merchant || "", note: row.note || "", paymentMethod: row.payment_method || "", account: row.account_name || "", createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now() };
}
function mapTransactionClientToRow(tx, userId) {
  return { id: tx.id, user_id: userId, type: tx.type, amount: Number(tx.amount) || 0, category_id: tx.categoryId || null, tx_date: tx.date, tx_time: normalizeTime(tx.time || "") || null, merchant: tx.merchant || "", note: tx.note || "", payment_method: tx.paymentMethod || "", account_name: tx.account || "", created_at: tx.createdAt ? new Date(tx.createdAt).toISOString() : new Date().toISOString(), updated_at: new Date().toISOString() };
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
  const categoryName = category?.name?.trim() || "Expense";
  return tx.merchant?.trim() ? `${categoryName} • ${tx.merchant.trim()}` : categoryName;
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

function SpendingBarsChart({ data }) {
  const width = 1000;
  const height = 270;
  const padX = 26;
  const padTop = 18;
  const padBottom = 34;
  const chartH = height - padTop - padBottom;
  const chartW = width - padX * 2;
  const max = Math.max(...data.map((d) => d.value), 10);
  const avg = data.length ? data.reduce((s, d) => s + d.value, 0) / data.length : 0;
  const innerGap = data.length > 20 ? 4 : 8;
  const slotW = chartW / Math.max(data.length, 1);
  const barW = Math.max(6, slotW - innerGap);
  const avgY = padTop + chartH - (avg / max) * chartH;
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
          <linearGradient id="spBarGlow" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#ffd2da" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ff6177" stopOpacity="0" />
          </linearGradient>
          <filter id="spBarShadow"><feGaussianBlur stdDeviation="7" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        {Array.from({ length: 4 }).map((_, i) => {
          const y = padTop + (i / 3) * chartH;
          return <line key={i} x1={padX} x2={padX + chartW} y1={y} y2={y} stroke="rgba(255,255,255,0.055)" strokeDasharray="5 7" />;
        })}
        <line x1={padX} x2={padX + chartW} y1={avgY} y2={avgY} stroke="rgba(255,255,255,0.18)" strokeDasharray="6 7" />
        {bars.map((b) => {
          const isHot = b.value > 0 && b.value === max;
          const zeroBar = b.value <= 0;
          return (
            <g key={b.key}>
              {!zeroBar ? (
                <>
                  <rect x={b.x} y={b.y - 2} width={barW} height={b.h + 2} rx={Math.min(12, barW / 2)} fill="url(#spBarGlow)" opacity={isHot ? 0.92 : 0.45} filter="url(#spBarShadow)" />
                  <rect x={b.x} y={b.y} width={barW} height={b.h} rx={Math.min(12, barW / 2)} fill="url(#spBarFill)" opacity={isHot ? 1 : 0.92} />
                  <circle cx={b.x + barW / 2} cy={b.y + 5} r="3.5" fill="#ffd8df" opacity={isHot ? 1 : 0.75} />
                </>
              ) : (
                <rect x={b.x} y={padTop + chartH - 4} width={barW} height={4} rx={999} fill="rgba(255,255,255,0.12)" />
              )}
              <text x={b.x + barW / 2} y={height - 8} textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.38)">{b.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function ProgressBar({ value = 0, color = TONE.green }) {
  const pct = clamp(Number(value) || 0, 0, 100);
  return <div className="spProgress"><div className="spProgressFill" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color} 0%, rgba(255,255,255,.92) 220%)`, boxShadow: `0 0 18px ${color}44, 0 0 26px ${color}18` }} /></div>;
}

function statusTone(status) {
  if (status === "Over") return { color: "#ffd6df", background: "rgba(255,107,127,.12)", border: "1px solid rgba(255,107,127,.22)" };
  if (status === "Near") return { color: "#ffe8b4", background: "rgba(245,158,11,.12)", border: "1px solid rgba(245,158,11,.24)" };
  if (status === "OK") return { color: "#cbffe1", background: "rgba(74,222,128,.12)", border: "1px solid rgba(74,222,128,.24)" };
  return { color: "#d8e1ff", background: "rgba(148,163,184,.12)", border: "1px solid rgba(148,163,184,.22)" };
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
  const [qaAccount, setQaAccount] = React.useState("Checking");
  const [newCategoryName, setNewCategoryName] = React.useState("");
  const [newCategoryGroup, setNewCategoryGroup] = React.useState("Other");

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
        const [catRes, budgetRes, txRes, plannedRes] = await Promise.all([
          supabase.from("spending_categories").select("*").eq("user_id", currentUser.id).order("group_name").order("name"),
          supabase.from("spending_budgets").select("*").eq("user_id", currentUser.id),
          supabase.from("spending_transactions").select("*").eq("user_id", currentUser.id).order("tx_date", { ascending: false }).order("tx_time", { ascending: false }).order("created_at", { ascending: false }),
          supabase.from("spending_planned_items").select("*").eq("user_id", currentUser.id).order("planned_date", { ascending: true }).order("planned_time", { ascending: true }).order("created_at", { ascending: false }),
        ]);
        if (catRes.error) throw catRes.error;
        if (budgetRes.error) throw budgetRes.error;
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
    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    if (!categories.length) return;
    if (categories.some((c) => c.id === qaCategoryId)) return;
    setQaCategoryId(categories[0].id);
  }, [categories, qaCategoryId]);

  const filteredTransactions = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((t) => inRange(t.date, range.start, range.end)).filter((t) => (typeFilter === "all" ? true : t.type === typeFilter)).filter((t) => (categoryFilter === "all" ? true : t.categoryId === categoryFilter)).filter((t) => {
      if (!q) return true;
      const cat = categoriesById.get(t.categoryId)?.name ?? "";
      return `${t.merchant} ${t.note} ${t.date} ${t.time} ${cat} ${t.amount} ${t.paymentMethod} ${t.account}`.toLowerCase().includes(q);
    }).sort((a, b) => {
      if (b.date !== a.date) return String(b.date).localeCompare(String(a.date));
      if ((b.time || "") !== (a.time || "")) return String(b.time || "").localeCompare(String(a.time || ""));
      return Number(b.createdAt || 0) - Number(a.createdAt || 0);
    });
  }, [transactions, range.start, range.end, typeFilter, categoryFilter, search, categoriesById]);

  const filteredPlanned = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return plannedItems.filter((p) => inRange(p.date, range.start, range.end)).filter((p) => (categoryFilter === "all" ? true : p.categoryId === categoryFilter)).filter((p) => {
      if (!q) return true;
      const cat = categoriesById.get(p.categoryId)?.name ?? "";
      return `${p.merchant} ${p.note} ${p.date} ${p.time} ${cat} ${p.amount}`.toLowerCase().includes(q);
    }).sort((a, b) => {
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
  const trendData = React.useMemo(() => groupTransactionsForTrend(filteredTransactions, range.start, period), [filteredTransactions, range.start, period]);
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
  const rosterTransactions = React.useMemo(() => filteredTransactions.slice(0, 8), [filteredTransactions]);
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
  const selectedSpent = React.useMemo(() => {
    if (!selectedCategory) return 0;
    const match = totalsByCategory.find((row) => row.categoryId === selectedCategory.id);
    return Number(match?.total || 0);
  }, [selectedCategory, totalsByCategory]);
  const selectedPlannedTotal = React.useMemo(() => (selectedCategory ? Number(plannedByCategory.get(selectedCategory.id) || 0) : 0), [selectedCategory, plannedByCategory]);
  const selectedForecast = selectedSpent + selectedPlannedTotal;
  const selectedLoadPct = selectedBudget > 0 ? (selectedForecast / selectedBudget) * 100 : 0;

  function clearQuickAdd() {
    setQaAmount("");
    setQaDate(todayISO());
    setQaTime("");
    setQaMerchant("");
    setQaNote("");
    setQaPayment("Card");
    setQaAccount("Checking");
    setQaType("expense");
    setQaCategoryId(categories[0]?.id || "groceries");
    setMode("now");
  }

  async function addNow() {
    setPageError("");
    if (!user) return;
    const amt = parseMoneyInput(qaAmount);
    if (!Number.isFinite(amt) || amt <= 0) return alert("Enter a valid amount.");
    if (!qaDate) return alert("Date required.");
    if (qaType === "expense" && !qaCategoryId) return alert("Pick a category.");
    setSaving(true);
    try {
      const tx = { id: uid(), type: qaType, amount: Math.round(amt * 100) / 100, categoryId: qaType === "expense" ? qaCategoryId : "", date: qaDate, time: normalizeTime(qaTime), merchant: qaMerchant.trim(), note: qaNote.trim(), paymentMethod: qaPayment, account: qaAccount, createdAt: Date.now() };
      const { data, error } = await supabase.from("spending_transactions").insert([mapTransactionClientToRow(tx, user.id)]).select().single();
      if (error) throw error;
      const saved = mapTransactionRowToClient(data);
      const category = categoriesById.get(saved.categoryId);
      await upsertCalendarEventForTransaction(saved, user.id, category);
      setTransactions((prev) => [saved, ...prev]);
      clearQuickAdd();
      setSelectedRecord({ kind: "tx", id: saved.id });
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
    } catch (err) {
      setPageError(err?.message || "Failed to save planned item.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTransaction(id) {
    if (!user) return;
    if (!confirm("Delete this transaction?")) return;
    const previous = transactions;
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    try {
      const { error } = await supabase.from("spending_transactions").delete().eq("id", id).eq("user_id", user.id);
      if (error) throw error;
      await deleteCalendarEventBySource(user.id, "spending", id);
      await deleteCalendarEventBySource(user.id, "income", id);
    } catch (err) {
      setTransactions(previous);
      setPageError(err?.message || "Failed to delete transaction.");
    }
  }

  async function duplicateTransaction(tx) {
    if (!user) return;
    try {
      const clone = { ...tx, id: uid(), createdAt: Date.now() };
      const { data, error } = await supabase.from("spending_transactions").insert([mapTransactionClientToRow(clone, user.id)]).select().single();
      if (error) throw error;
      const saved = mapTransactionRowToClient(data);
      const category = categoriesById.get(saved.categoryId);
      await upsertCalendarEventForTransaction(saved, user.id, category);
      setTransactions((prev) => [saved, ...prev]);
      setSelectedRecord({ kind: "tx", id: saved.id });
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
      await deleteCalendarEventBySource(user.id, "planned_expense", id);
    } catch (err) {
      setPlannedItems(previous);
      setPageError(err?.message || "Failed to delete planned item.");
    }
  }

  async function convertPlanned(planned) {
    if (!user) return;
    if (!confirm("Convert this planned item into a real transaction?")) return;
    try {
      const tx = { id: uid(), type: "expense", amount: planned.amount, categoryId: planned.categoryId, date: planned.date, time: normalizeTime(planned.time || ""), merchant: planned.merchant || "", note: planned.note || "", paymentMethod: "Card", account: "Checking", createdAt: Date.now() };
      const { data: insertedTx, error: txErr } = await supabase.from("spending_transactions").insert([mapTransactionClientToRow(tx, user.id)]).select().single();
      if (txErr) throw txErr;
      const { error: plannedErr } = await supabase.from("spending_planned_items").delete().eq("id", planned.id).eq("user_id", user.id);
      if (plannedErr) throw plannedErr;
      const savedTx = mapTransactionRowToClient(insertedTx);
      const category = categoriesById.get(savedTx.categoryId);
      await deleteCalendarEventBySource(user.id, "planned_expense", planned.id);
      await upsertCalendarEventForTransaction(savedTx, user.id, category);
      setTransactions((prev) => [savedTx, ...prev]);
      setPlannedItems((prev) => prev.filter((p) => p.id !== planned.id));
      setSelectedRecord({ kind: "tx", id: savedTx.id });
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

  const styles = (
    <style>{`
      .spendingPage { --sp-text:#f5f7ff; --sp-muted:rgba(218,226,242,.78); --sp-dim:rgba(186,198,223,.48); --sp-border:rgba(214,226,255,.09); --sp-card:rgba(7,11,18,.34); --sp-shadow:0 24px 54px rgba(0,0,0,.26), inset 0 1px 0 rgba(255,255,255,.03); color:var(--sp-text); color-scheme:dark; }
      .spendingPage *,.spendingPage *::before,.spendingPage *::after { box-sizing:border-box; }
      .spendingPage .spShell { width:100%; max-width:1680px; margin:0 auto; padding:12px 8px 28px; }
      .spendingPage .spGlass,.spendingPage .spHero,.spendingPage .spSignalCard,.spendingPage .spPanel,.spendingPage .spStatTile,.spendingPage .spRosterItem,.spendingPage .spMiniCard,.spendingPage .spFormCard,.spendingPage .spBudgetRow { position:relative; overflow:hidden; border-radius:28px; border:1px solid var(--sp-border); background:linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.012) 14%, rgba(255,255,255,.005) 26%, rgba(255,255,255,0) 44%), linear-gradient(135deg, rgba(255,255,255,.022), rgba(255,255,255,.006) 22%, transparent 44%), var(--sp-card); box-shadow:var(--sp-shadow); backdrop-filter:blur(14px) saturate(118%); -webkit-backdrop-filter:blur(14px) saturate(118%); }
      .spendingPage .spGlass::before,.spendingPage .spHero::before,.spendingPage .spSignalCard::before,.spendingPage .spPanel::before,.spendingPage .spStatTile::before,.spendingPage .spRosterItem::before,.spendingPage .spMiniCard::before,.spendingPage .spFormCard::before,.spendingPage .spBudgetRow::before { content:""; position:absolute; inset:0; pointer-events:none; background:radial-gradient(circle at 0% 0%, rgba(82,114,255,.05), transparent 28%), radial-gradient(circle at 100% 0%, rgba(255,255,255,.02), transparent 18%), radial-gradient(circle at 50% 100%, rgba(255,107,127,.025), transparent 30%); }
      .spendingPage .spHero { padding:18px 20px; margin-bottom:14px; }
      .spendingPage .spHeroInner { position:relative; z-index:1; display:grid; grid-template-columns:minmax(0,1fr) auto; gap:16px; align-items:start; }
      .spendingPage .spEyebrow { font-size:11px; text-transform:uppercase; letter-spacing:.22em; color:var(--sp-dim); margin-bottom:10px; font-weight:800; }
      .spendingPage .spTitle { margin:0; font-size:clamp(34px,3vw,58px); line-height:.96; letter-spacing:-.05em; font-weight:950; }
      .spendingPage .spSub { margin-top:10px; color:var(--sp-muted); max-width:760px; line-height:1.55; font-size:14px; }
      .spendingPage .spChipRow,.spendingPage .spActionRow,.spendingPage .spWrapRow { display:flex; flex-wrap:wrap; gap:10px; }
      .spendingPage .spHeroRight { display:grid; gap:10px; justify-items:end; }
      .spendingPage .spChip { display:inline-flex; align-items:center; justify-content:center; min-height:36px; padding:7px 14px; border-radius:999px; border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.03); color:#f4f7ff; font-size:11px; font-weight:900; letter-spacing:.04em; white-space:nowrap; }
      .spendingPage .spSegment { display:inline-flex; gap:6px; padding:4px; border-radius:999px; border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.03); }
      .spendingPage .spSegmentBtn,.spendingPage .spTabBtn,.spendingPage .spGhostBtn,.spendingPage .spDangerBtn,.spendingPage .spSolidBtn { min-height:40px; padding:0 14px; border-radius:14px; font-size:13px; font-weight:900; letter-spacing:.02em; cursor:pointer; transition:transform .18s ease, border-color .18s ease, background .18s ease, box-shadow .18s ease, opacity .18s ease; }
      .spendingPage .spSegmentBtn,.spendingPage .spTabBtn,.spendingPage .spGhostBtn { border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.028); color:#f5f7ff; }
      .spendingPage .spSegmentBtn.active,.spendingPage .spTabBtn.active { border-color:rgba(255,255,255,.15); background:linear-gradient(180deg, rgba(255,255,255,.97), rgba(233,237,246,.92)); color:#09111f; }
      .spendingPage .spSolidBtn { border:1px solid rgba(102,154,255,.24); background:linear-gradient(180deg, rgba(77,124,255,.18), rgba(32,74,189,.08)); color:#f7f9ff; }
      .spendingPage .spDangerBtn { border:1px solid rgba(244,114,182,.24); background:rgba(244,114,182,.09); color:#ffd7e6; }
      .spendingPage .spSignalGrid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-bottom:14px; }
      .spendingPage .spSignalCard { padding:18px; min-height:138px; }
      .spendingPage .signalTeal { background:linear-gradient(180deg, rgba(90,255,195,.08), rgba(0,0,0,0) 46%), linear-gradient(135deg, rgba(255,255,255,.022), rgba(255,255,255,.006) 22%, transparent 44%), rgba(7,11,18,.34); }
      .spendingPage .signalAmber { background:linear-gradient(180deg, rgba(255,196,98,.08), rgba(0,0,0,0) 46%), linear-gradient(135deg, rgba(255,255,255,.022), rgba(255,255,255,.006) 22%, transparent 44%), rgba(7,11,18,.34); }
      .spendingPage .signalGreen { background:linear-gradient(180deg, rgba(74,222,128,.08), rgba(0,0,0,0) 46%), linear-gradient(135deg, rgba(255,255,255,.022), rgba(255,255,255,.006) 22%, transparent 44%), rgba(7,11,18,.34); }
      .spendingPage .signalRose { background:linear-gradient(180deg, rgba(255,119,157,.08), rgba(0,0,0,0) 46%), linear-gradient(135deg, rgba(255,255,255,.022), rgba(255,255,255,.006) 22%, transparent 44%), rgba(7,11,18,.34); }
      .spendingPage .spSignalLabel,.spendingPage .spTinyLabel { font-size:11px; text-transform:uppercase; letter-spacing:.18em; color:var(--sp-dim); font-weight:800; }
      .spendingPage .spSignalValue { margin-top:12px; font-size:clamp(28px,2.6vw,42px); line-height:1; font-weight:950; letter-spacing:-.04em; }
      .spendingPage .spSignalSub,.spendingPage .spSectionText { margin-top:10px; color:var(--sp-muted); font-size:13px; line-height:1.55; }
      .spendingPage .spAccentBad { color:#ff8fa8; font-weight:900; }
      .spendingPage .spCommandBar { padding:16px 18px; margin-bottom:14px; }
      .spendingPage .spCommandBarInner { position:relative; z-index:1; display:grid; grid-template-columns:minmax(0,1.1fr) auto auto; gap:12px; align-items:end; }
      .spendingPage .spPanel { padding:18px; }
      .spendingPage .spCommandGrid { display:grid; grid-template-columns:minmax(0,.95fr) minmax(0,1.2fr) minmax(340px,.85fr); gap:14px; align-items:start; margin-bottom:14px; }
      .spendingPage .spManageGrid { display:grid; grid-template-columns:minmax(0,1.18fr) minmax(350px,.82fr); gap:14px; }
      .spendingPage .spStickyRail { position:sticky; top:12px; display:grid; gap:14px; }
      .spendingPage .spPanelHead,.spendingPage .spRowHead { position:relative; z-index:1; display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap; }
      .spendingPage .spPanelHead { margin-bottom:14px; }
      .spendingPage .spSectionTitle { margin:0; font-size:clamp(26px,2vw,38px); line-height:1; font-weight:950; letter-spacing:-.03em; }
      .spendingPage .spSectionMini { margin:0; font-size:19px; line-height:1.1; font-weight:900; }
      .spendingPage .spField,.spendingPage .spSelect,.spendingPage .spTextarea { width:100%; min-height:48px; border-radius:15px; border:1px solid rgba(177,196,255,.13); background:rgba(8,13,23,.56)!important; color:#f4f7ff!important; font-size:14px; font-weight:600; padding:0 14px; outline:none; box-shadow:inset 0 1px 0 rgba(255,255,255,.02), 0 0 0 rgba(0,0,0,0); }
      .spendingPage .spTextarea { min-height:96px; padding:12px 14px; resize:vertical; }
      .spendingPage .spSelect option { background:#08111f!important; color:#f4f7ff!important; }
      .spendingPage .spStack,.spendingPage .spScrollArea { display:grid; gap:12px; }
      .spendingPage .spScrollArea { max-height:860px; overflow:auto; padding-right:4px; }
      .spendingPage .spRosterItem { padding:14px 14px 12px; border-radius:22px; cursor:pointer; }
      .spendingPage .spRosterItem.active { border-color:rgba(255,255,255,.16); background:linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.014) 18%, rgba(255,255,255,.006) 30%, rgba(255,255,255,0) 48%), linear-gradient(135deg, rgba(255,255,255,.026), rgba(255,255,255,.008) 22%, transparent 44%), rgba(10,15,25,.48); }
      .spendingPage .spRosterItem.planned { background:linear-gradient(180deg, rgba(255,189,89,.05), rgba(0,0,0,0) 46%), linear-gradient(135deg, rgba(255,255,255,.022), rgba(255,255,255,.006) 22%, transparent 44%), rgba(7,11,18,.34); }
      .spendingPage .spRosterTop { display:grid; grid-template-columns:auto 1fr auto; gap:10px; align-items:center; }
      .spendingPage .spIconBadge { width:38px; height:38px; border-radius:14px; display:grid; place-items:center; border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.03); font-size:13px; font-weight:900; color:#f4f7ff; }
      .spendingPage .spRosterTitle { font-size:16px; line-height:1.15; font-weight:900; }
      .spendingPage .spRosterMeta { margin-top:6px; color:var(--sp-muted); font-size:13px; line-height:1.45; }
      .spendingPage .spRosterAmount { text-align:right; font-size:24px; line-height:1; font-weight:950; letter-spacing:-.03em; }
      .spendingPage .spAmountBad { color:#ffb6c6; } .spendingPage .spAmountGood { color:#9ef6bf; } .spendingPage .spAmountWarn { color:#ffe09a; }
      .spendingPage .spAccentBar { height:8px; margin-top:12px; border-radius:999px; background:rgba(255,255,255,.08); overflow:hidden; }
      .spendingPage .spAccentBar > span { display:block; height:100%; border-radius:999px; background:linear-gradient(90deg, rgba(255,136,157,.98), rgba(255,205,214,.96)); box-shadow:0 0 18px rgba(255,136,157,.34); }
      .spendingPage .spFocusShell { display:grid; gap:14px; }
      .spendingPage .spFocusHero { padding:18px; border-radius:26px; border:1px solid rgba(255,255,255,.08); background:linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.012) 18%, rgba(255,255,255,.006) 30%, rgba(255,255,255,0) 48%), linear-gradient(135deg, rgba(255,255,255,.026), rgba(255,255,255,.008) 22%, transparent 44%), rgba(10,14,22,.42); }
      .spendingPage .spFocusAmount { margin-top:10px; font-size:clamp(42px,4vw,72px); line-height:.95; letter-spacing:-.05em; font-weight:950; }
      .spendingPage .spMiniGrid,.spendingPage .spGrid2,.spendingPage .spGrid3,.spendingPage .spStatGrid { display:grid; gap:12px; }
      .spendingPage .spMiniGrid,.spendingPage .spGrid2 { grid-template-columns:repeat(2,minmax(0,1fr)); }
      .spendingPage .spGrid3,.spendingPage .spStatGrid { grid-template-columns:repeat(3,minmax(0,1fr)); }
      .spendingPage .spMiniCard,.spendingPage .spStatTile,.spendingPage .spFormCard,.spendingPage .spBudgetRow { padding:14px; border-radius:22px; }
      .spendingPage .spStatValue { margin-top:8px; font-size:31px; line-height:1; font-weight:950; letter-spacing:-.03em; }
      .spendingPage .spBarsWrap { overflow:hidden; border-radius:24px; border:1px solid rgba(255,255,255,.055); background:linear-gradient(180deg, rgba(8,13,24,.34), rgba(5,9,17,.14)); padding:10px 10px 4px; }
      .spendingPage .spBarsSvg { display:block; width:100%; height:270px; }
      .spendingPage .spProgress { height:10px; overflow:hidden; border-radius:999px; background:rgba(255,255,255,.1); }
      .spendingPage .spProgressFill { height:100%; border-radius:999px; transition:width .45s ease; }
      .spendingPage .spPillStatus { display:inline-flex; align-items:center; min-height:30px; padding:6px 10px; border-radius:999px; font-size:11px; font-weight:900; letter-spacing:.04em; }
      .spendingPage .spValueGood { color:#9ef6bf; font-weight:900; } .spendingPage .spValueBad { color:#ffb6c6; font-weight:900; } .spendingPage .spValueWarn { color:#ffe09a; font-weight:900; }
      .spendingPage .spEmpty { border:1px dashed rgba(255,255,255,.1); border-radius:20px; padding:16px; color:var(--sp-muted); background:rgba(255,255,255,.018); }
      .spendingPage .spError { padding:14px 16px; margin-bottom:14px; border-radius:22px; border:1px solid rgba(244,114,182,.26); background:linear-gradient(180deg, rgba(96,17,44,.28), rgba(36,8,18,.2)); }
      @media (max-width:1240px) { .spendingPage .spSignalGrid,.spendingPage .spGrid3,.spendingPage .spStatGrid { grid-template-columns:repeat(2,minmax(0,1fr)); } .spendingPage .spCommandBarInner,.spendingPage .spCommandGrid,.spendingPage .spManageGrid { grid-template-columns:1fr; } .spendingPage .spStickyRail { position:static; } }
      @media (max-width:920px) { .spendingPage .spHeroInner,.spendingPage .spMiniGrid,.spendingPage .spGrid2,.spendingPage .spGrid3,.spendingPage .spStatGrid,.spendingPage .spSignalGrid { grid-template-columns:1fr; } .spendingPage .spHeroRight { justify-items:start; } }
    `}</style>
  );

  if (loading) return <main className="spendingPage">{styles}<div className="spShell"><section className="spHero"><div className="spHeroInner"><div><div className="spEyebrow">Life Command Center</div><h1 className="spTitle">Spending Command</h1><div className="spSub">Loading spending command board...</div></div></div></section></div></main>;
  if (!user) return <main className="spendingPage">{styles}<div className="spShell"><section className="spHero"><div className="spHeroInner"><div><div className="spEyebrow">Life Command Center</div><h1 className="spTitle">Spending Command</h1><div className="spSub">This page needs an authenticated user.</div></div></div></section></div></main>;

  return (
    <main className="spendingPage">
      {styles}
      <div className="spShell">
        <header className="spHero">
          <div className="spHeroInner">
            <div>
              <div className="spEyebrow">Life Command Center</div>
              <h1 className="spTitle">Spending Command</h1>
              <div className="spSub">Live spend pressure, planned expenses, budget control, and direct logging in the same command layout as the rest of the app.</div>
              <div className="spChipRow" style={{ marginTop: 12 }}>
                <span className="spChip">{range.label.toUpperCase()}</span>
                <span className="spChip">{filteredTransactions.length} logged</span>
                <span className="spChip">{filteredPlanned.length} planned</span>
                <span className="spChip">{currentMonth}</span>
              </div>
            </div>
            <div className="spHeroRight">
              <div className="spSegment">{["week", "month", "year"].map((p) => <button key={p} type="button" className={`spSegmentBtn ${period === p ? "active" : ""}`} onClick={() => setPeriod(p)}>{p[0].toUpperCase() + p.slice(1)}</button>)}</div>
              <div className="spSegment">
                <button type="button" className={`spTabBtn ${tab === "overview" ? "active" : ""}`} onClick={() => setTab("overview")}>Overview</button>
                <button type="button" className={`spTabBtn ${tab === "manage" ? "active" : ""}`} onClick={() => setTab("manage")}>Manage</button>
              </div>
            </div>
          </div>
        </header>

        {pageError ? <div className="spError"><div style={{ fontWeight: 900, fontSize: 15 }}>Database issue</div><div className="spSectionText">{pageError}</div></div> : null}

        <section className="spSignalGrid">
          <article className="spSignalCard signalTeal"><div className="spSignalLabel">Monthly Pressure</div><div className="spSignalValue">{money(totals.expense)}</div><div className="spSignalSub"><span className="spAccentBad">{expenseTrend.value}</span> {expenseTrend.text}</div></article>
          <article className="spSignalCard signalAmber"><div className="spSignalLabel">Planned Queue</div><div className="spSignalValue">{money(totals.plannedExpense)}</div><div className="spSignalSub">{upcomingItems.length > 0 ? `${upcomingItems.length} upcoming item(s)` : "Nothing planned yet"}</div></article>
          <article className="spSignalCard signalGreen"><div className="spSignalLabel">Remaining Budget</div><div className="spSignalValue">{money(Math.max(remaining, 0))}</div><div className="spSignalSub">{remaining < 0 ? `Over by ${money(Math.abs(remaining))}` : `From ${money(totalBudget)} budget`}</div></article>
          <article className="spSignalCard signalRose"><div className="spSignalLabel">Forecast Net</div><div className="spSignalValue">{money(totals.forecastNet)}</div><div className="spSignalSub">Live net {money(totals.net)}</div></article>
        </section>

        {tab === "overview" ? (
          <>
            <section className="spGlass spCommandBar">
              <div className="spCommandBarInner">
                <div><div className="spSignalLabel">Spending Controls</div><div className="spSectionText">Search the board, filter categories, and keep the center focus card locked on what matters.</div></div>
                <select className="spSelect" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}><option value="all">All categories</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.group} • {c.name}</option>)}</select>
                <input className="spField" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search spending" />
              </div>
            </section>

            <section className="spCommandGrid">
              <article className="spPanel">
                <div className="spPanelHead"><div><h2 className="spSectionMini">Spend Roster</h2><div className="spSectionText">Live activity stays left. Focus stays center.</div></div><span className="spChip">{rosterTransactions.length + rosterPlanned.length} showing</span></div>
                <div className="spScrollArea">
                  {rosterTransactions.length === 0 && rosterPlanned.length === 0 ? <div className="spEmpty">No spending records in this range yet.</div> : <>
                    {rosterTransactions.map((tx) => {
                      const cat = categoriesById.get(tx.categoryId);
                      const amountTone = tx.type === "income" ? "spAmountGood" : tx.type === "expense" ? "spAmountBad" : "spAmountWarn";
                      const progressBase = tx.type === "expense" && totalBudget > 0 ? clamp((tx.amount / Math.max(totalBudget, 1)) * 100, 4, 100) : tx.type === "income" ? 20 : 12;
                      return <div key={tx.id} className={`spRosterItem ${selectedRecord.kind === "tx" && selectedRecord.id === tx.id ? "active" : ""}`} onClick={() => setSelectedRecord({ kind: "tx", id: tx.id })}><div className="spRosterTop"><div className="spIconBadge">{tx.type === "income" ? "+" : tx.type === "transfer" ? "↔" : "$"}</div><div><div className="spRosterTitle">{tx.merchant || cat?.name || (tx.type === "income" ? "Income" : "Transaction")}</div><div className="spRosterMeta">{cat?.name || (tx.type === "income" ? "Income" : "Uncategorized")} • {shortDate(tx.date)} • {fmtTime(tx.time)}</div></div><div className={`spRosterAmount ${amountTone}`}>{tx.type === "income" ? "+" : tx.type === "expense" ? "-" : ""}{money(tx.amount)}</div></div><div className="spAccentBar"><span style={{ width: `${progressBase}%` }} /></div></div>;
                    })}
                    {rosterPlanned.length > 0 ? <div className="spSignalLabel" style={{ marginTop: 6 }}>Planned Queue</div> : null}
                    {rosterPlanned.map((item) => {
                      const cat = categoriesById.get(item.categoryId);
                      const budget = Number(budgets?.[range.budgetMode]?.[item.categoryId] || 0);
                      const width = budget > 0 ? clamp((item.amount / budget) * 100, 5, 100) : 18;
                      return <div key={item.id} className={`spRosterItem planned ${selectedRecord.kind === "planned" && selectedRecord.id === item.id ? "active" : ""}`} onClick={() => setSelectedRecord({ kind: "planned", id: item.id })}><div className="spRosterTop"><div className="spIconBadge">⏳</div><div><div className="spRosterTitle">{item.merchant || cat?.name || "Planned Expense"}</div><div className="spRosterMeta">{cat?.name || "Uncategorized"} • {shortDate(item.date)} • {fmtTime(item.time)}</div></div><div className="spRosterAmount spAmountWarn">{money(item.amount)}</div></div><div className="spAccentBar"><span style={{ width: `${width}%` }} /></div></div>;
                    })}
                  </>}
                </div>
              </article>

              <article className="spPanel">
                <div className="spPanelHead"><div><h2 className="spSectionTitle">{selectedRecord.kind === "planned" ? "Planned Focus" : "Spending Focus"}</h2><div className="spSectionText">Center command card like the bills page.</div></div><span className="spChip">{selectedRecord.kind === "planned" ? "PLANNED" : selectedTx?.type ? selectedTx.type.toUpperCase() : "LIVE"}</span></div>
                {!selectedItem ? <div className="spEmpty">Select a transaction or planned item from the roster.</div> : <div className="spFocusShell">
                  <div className="spFocusHero">
                    <div className="spPanelHead"><div><div className="spSignalLabel">{selectedRecord.kind === "planned" ? "Planned Item" : "Selected Record"}</div><h3 className="spSectionMini" style={{ marginTop: 10 }}>{selectedRecord.kind === "planned" ? selectedPlanned?.merchant || selectedCategory?.name || "Planned Expense" : selectedTx?.merchant || selectedCategory?.name || (selectedTx?.type === "income" ? "Income" : "Transaction")}</h3></div>{selectedCategory ? <span className="spPillStatus" style={{ color: "#f0f5ff", background: `${selectedCategory.color}22`, border: `1px solid ${selectedCategory.color}44` }}>{selectedCategory.name}</span> : null}</div>
                    <div className={`spFocusAmount ${selectedRecord.kind === "planned" ? "spValueWarn" : selectedTx?.type === "income" ? "spValueGood" : selectedTx?.type === "expense" ? "spValueBad" : "spValueWarn"}`}>{selectedRecord.kind === "planned" ? money(selectedPlanned?.amount || 0) : `${selectedTx?.type === "income" ? "+" : selectedTx?.type === "expense" ? "-" : ""}${money(selectedTx?.amount || 0)}`}</div>
                    <div className="spMiniGrid" style={{ marginTop: 14 }}>
                      <div className="spMiniCard"><div className="spTinyLabel">Date</div><div className="spStatValue" style={{ fontSize: 30 }}>{shortDate(selectedItem.date)}</div><div className="spSectionText">{fmtTime(selectedItem.time)}</div></div>
                      <div className="spMiniCard"><div className="spTinyLabel">Budget Mode</div><div className="spStatValue" style={{ fontSize: 30 }}>{range.budgetMode}</div><div className="spSectionText">{selectedBudget > 0 ? `${money(selectedBudget)} loaded` : "No category budget set"}</div></div>
                      <div className="spMiniCard"><div className="spTinyLabel">Payment / Account</div><div className="spStatValue" style={{ fontSize: 25 }}>{selectedRecord.kind === "planned" ? "Planned" : selectedTx?.paymentMethod || selectedTx?.account || "None"}</div><div className="spSectionText">{selectedRecord.kind === "planned" ? "Waiting to become real" : selectedTx?.account || "No linked account"}</div></div>
                      <div className="spMiniCard"><div className="spTinyLabel">Category Pressure</div><div className="spStatValue" style={{ fontSize: 30 }}>{selectedBudget > 0 ? `${clamp(selectedLoadPct, 0, 999).toFixed(0)}%` : "0%"}</div><div className="spSectionText">{selectedCategory?.name || "No category"} forecast load</div></div>
                    </div>
                    <div style={{ marginTop: 14 }}><ProgressBar value={selectedBudget > 0 ? selectedLoadPct : 0} color={selectedBudget > 0 && selectedLoadPct >= 100 ? TONE.red : selectedBudget > 0 && selectedLoadPct >= 85 ? TONE.amber : TONE.green} /></div>
                    <div className="spActionRow" style={{ marginTop: 14 }}>{selectedRecord.kind === "planned" && selectedPlanned ? <><button className="spSolidBtn" type="button" onClick={() => convertPlanned(selectedPlanned)}>Convert to Real</button><button className="spDangerBtn" type="button" onClick={() => deletePlanned(selectedPlanned.id)}>Delete Planned</button></> : selectedTx ? <><button className="spGhostBtn" type="button" onClick={() => duplicateTransaction(selectedTx)}>Duplicate</button><button className="spDangerBtn" type="button" onClick={() => deleteTransaction(selectedTx.id)}>Delete</button></> : null}</div>
                  </div>
                  <div className="spBarsWrap"><SpendingBarsChart data={trendData} /></div>
                  <div className="spStatGrid">
                    <div className="spStatTile"><div className="spTinyLabel">Priority Category</div><div className="spStatValue">{priorityCategory?.category?.name || "No leader"}</div><div className="spSectionText">{priorityCategory ? money(priorityCategory.total) : "Start logging spending."}</div></div>
                    <div className="spStatTile"><div className="spTinyLabel">Pressure vs Budget</div><div className="spStatValue">{priorityCategory ? `${clamp(priorityPercent, 0, 999).toFixed(0)}%` : "0%"}</div><div className="spSectionText">{priorityCategory?.category?.name ? `${priorityCategory.category.name} usage` : "No pressure leader"}</div></div>
                    <div className="spStatTile"><div className="spTinyLabel">Forecast Remaining</div><div className="spStatValue">{money(Math.max(forecastRemaining, 0))}</div><div className="spSectionText">{forecastRemaining < 0 ? `Over by ${money(Math.abs(forecastRemaining))}` : "After planned items land"}</div></div>
                  </div>
                </div>}
              </article>

              <div className="spStickyRail">
                <article className="spPanel">
                  <div className="spPanelHead"><div><h2 className="spSectionMini">Quick Add</h2><div className="spSectionText">Tighter rail. Same language as bills.</div></div><div className="spSegment"><button type="button" className={`spSegmentBtn ${mode === "now" ? "active" : ""}`} onClick={() => setMode("now")}>Now</button><button type="button" className={`spSegmentBtn ${mode === "planned" ? "active" : ""}`} onClick={() => { setMode("planned"); setQaType("expense"); }}>Planned</button></div></div>
                  <div className="spStack">
                    <div className="spFormCard"><div className="spGrid2">{mode === "now" ? <div><div className="spTinyLabel">Type</div><select className="spSelect" value={qaType} onChange={(e) => setQaType(e.target.value)}><option value="expense">Expense</option><option value="income">Income</option><option value="transfer">Transfer</option></select></div> : <div><div className="spTinyLabel">Type</div><div className="spChip" style={{ width: "100%" }}>PLANNED EXPENSE</div></div>}<div><div className="spTinyLabel">Amount</div><input className="spField" inputMode="decimal" placeholder="0.00" value={qaAmount} onChange={(e) => setQaAmount(e.target.value)} /></div><div><div className="spTinyLabel">Date</div><input className="spField" type="date" value={qaDate} onChange={(e) => setQaDate(e.target.value)} /></div><div><div className="spTinyLabel">Time</div><input className="spField" type="time" value={qaTime} onChange={(e) => setQaTime(e.target.value)} /></div></div></div>
                    <div className="spFormCard"><div className="spGrid2"><div><div className="spTinyLabel">Category</div><select className="spSelect" value={qaCategoryId} onChange={(e) => setQaCategoryId(e.target.value)}>{categories.map((c) => <option key={c.id} value={c.id}>{c.group} • {c.name}</option>)}</select></div><div><div className="spTinyLabel">Merchant / Source</div><input className="spField" placeholder="Where did it go?" value={qaMerchant} onChange={(e) => setQaMerchant(e.target.value)} /></div><div><div className="spTinyLabel">Payment Method</div><select className="spSelect" value={qaPayment} onChange={(e) => setQaPayment(e.target.value)}><option>Card</option><option>Cash</option><option>ACH</option><option>Transfer</option></select></div><div><div className="spTinyLabel">Account</div><input className="spField" value={qaAccount} onChange={(e) => setQaAccount(e.target.value)} placeholder="Checking" /></div></div></div>
                    <div className="spFormCard"><div className="spTinyLabel">Note</div><textarea className="spTextarea" placeholder="Optional note" value={qaNote} onChange={(e) => setQaNote(e.target.value)} /></div>
                    <div className="spActionRow"><button className="spSolidBtn" type="button" onClick={quickAddSave} disabled={saving}>{saving ? "Saving..." : mode === "planned" ? "Save Planned" : "Save Transaction"}</button><button className="spGhostBtn" type="button" onClick={clearQuickAdd} disabled={saving}>Reset</button></div>
                  </div>
                </article>

                <article className="spPanel"><div className="spPanelHead"><div><h2 className="spSectionMini">Pressure Read</h2><div className="spSectionText">Quick command stats.</div></div></div><div className="spStack"><div className="spStatTile"><div className="spTinyLabel">Budget Load</div><div className="spStatValue">{totalBudget > 0 ? `${clamp(budgetLoad, 0, 999).toFixed(0)}%` : "0%"}</div><div className="spSectionText">Forecast pressure against total budget.</div></div><div className="spStatTile"><div className="spTinyLabel">Logged This Range</div><div className="spStatValue">{filteredTransactions.length}</div><div className="spSectionText">Transaction count inside the selected period.</div></div><div className="spStatTile"><div className="spTinyLabel">Upcoming Planned</div><div className="spStatValue">{upcomingItems.length}</div><div className="spSectionText">Planned items waiting to hit.</div></div></div></article>
              </div>
            </section>
          </>
        ) : (
          <section className="spManageGrid">
            <article className="spPanel">
              <div className="spPanelHead"><div><h2 className="spSectionTitle">Manage Spend</h2><div className="spSectionText">Search, clean up, convert planned items, and tune budgets.</div></div></div>
              <div className="spGrid3" style={{ marginBottom: 16 }}><input className="spField" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search transactions or planned items" /><select className="spSelect" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option value="all">All types</option><option value="expense">Expense</option><option value="income">Income</option><option value="transfer">Transfer</option></select><select className="spSelect" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}><option value="all">All categories</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.group} • {c.name}</option>)}</select></div>
              <div className="spGrid2">
                <div className="spFormCard"><div className="spPanelHead"><div><h3 className="spSectionMini">Transactions</h3><div className="spSectionText">Current range results.</div></div></div><div className="spScrollArea">{filteredTransactions.length === 0 ? <div className="spEmpty">No transactions match this filter.</div> : filteredTransactions.map((tx) => { const cat = categoriesById.get(tx.categoryId); const valueClass = tx.type === "income" ? "spValueGood" : tx.type === "expense" ? "spValueBad" : "spValueWarn"; return <div key={tx.id} className="spRosterItem"><div className="spRowHead"><div><div className="spRosterTitle">{tx.merchant || cat?.name || (tx.type === "income" ? "Income" : "Transaction")}</div><div className="spSectionText">{shortDate(tx.date)} • {fmtTime(tx.time)} • {tx.type === "income" ? "Income" : cat?.name || "Uncategorized"}</div>{tx.note ? <div className="spSectionText">{tx.note}</div> : null}</div><div style={{ textAlign: "right" }}><div className={valueClass}>{tx.type === "income" ? "+" : tx.type === "expense" ? "-" : ""}{money(tx.amount)}</div><div className="spSectionText">{tx.account || tx.paymentMethod}</div></div></div><div className="spActionRow" style={{ marginTop: 12 }}><button className="spGhostBtn" type="button" onClick={() => duplicateTransaction(tx)}>Duplicate</button><button className="spDangerBtn" type="button" onClick={() => deleteTransaction(tx.id)}>Delete</button></div></div>; })}</div></div>
                <div className="spFormCard"><div className="spPanelHead"><div><h3 className="spSectionMini">Planned Items</h3><div className="spSectionText">Convert or clear them.</div></div></div><div className="spScrollArea">{filteredPlanned.length === 0 ? <div className="spEmpty">No planned items match this filter.</div> : filteredPlanned.map((item) => { const cat = categoriesById.get(item.categoryId); return <div key={item.id} className="spRosterItem planned"><div className="spRowHead"><div><div className="spRosterTitle">{item.merchant || cat?.name || "Planned Expense"}</div><div className="spSectionText">{shortDate(item.date)} • {fmtTime(item.time)} • {cat?.name || "Uncategorized"}</div>{item.note ? <div className="spSectionText">{item.note}</div> : null}</div><div style={{ textAlign: "right" }}><div className="spValueWarn">{money(item.amount)}</div></div></div><div className="spActionRow" style={{ marginTop: 12 }}><button className="spSolidBtn" type="button" onClick={() => convertPlanned(item)}>Convert to Real</button><button className="spDangerBtn" type="button" onClick={() => deletePlanned(item.id)}>Delete</button></div></div>; })}</div></div>
              </div>
            </article>

            <div className="spStickyRail">
              <article className="spPanel"><div className="spPanelHead"><div><h2 className="spSectionMini">Category Control</h2><div className="spSectionText">Add and clean up categories.</div></div></div><div className="spFormCard" style={{ marginBottom: 14 }}><div className="spGrid2"><input className="spField" placeholder="New category name" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} /><select className="spSelect" value={newCategoryGroup} onChange={(e) => setNewCategoryGroup(e.target.value)}>{groups.filter((g) => g !== "All").map((g) => <option key={g} value={g}>{g}</option>)}</select></div></div><div className="spActionRow" style={{ marginBottom: 14 }}><button className="spSolidBtn" type="button" onClick={addCategory}>Add Category</button></div><div className="spScrollArea">{categories.map((cat) => <div key={cat.id} className="spRosterItem"><div className="spRowHead"><div><div className="spRosterTitle">{cat.name}</div><div className="spSectionText">{cat.group}</div></div><div className="spActionRow"><span className="spPillStatus" style={{ color: "#f0f5ff", background: `${cat.color}22`, border: `1px solid ${cat.color}44` }}>{cat.isBudgeted ? "BUDGETED" : "TRACKED"}</span><button className="spDangerBtn" type="button" onClick={() => deleteCategory(cat.id)}>Delete</button></div></div></div>)}</div></article>
              <article className="spPanel"><div className="spPanelHead"><div><h2 className="spSectionMini">Budget Tune</h2><div className="spSectionText">Edit {range.budgetMode} budgets in place.</div></div><span className="spChip">{range.budgetMode.toUpperCase()}</span></div><div className="spScrollArea">{budgetRows.length === 0 ? <div className="spEmpty">No budget rows yet.</div> : budgetRows.map((row) => { const tone = statusTone(row.forecastStatus); const progressColor = row.forecastStatus === "Over" ? TONE.red : row.forecastStatus === "Near" ? TONE.amber : TONE.green; const progressPct = row.budget > 0 ? (row.forecast / row.budget) * 100 : 0; return <div key={row.id} className="spBudgetRow"><div className="spRowHead"><div><div className="spRosterTitle">{row.name}</div><div className="spSectionText">{money(row.spent)} spent • {money(row.planned)} planned</div></div><span className="spPillStatus" style={tone}>{row.forecastStatus}</span></div><div style={{ marginTop: 12 }}><ProgressBar value={progressPct} color={progressColor} /></div><div className="spGrid2" style={{ marginTop: 12 }}><div><div className="spTinyLabel">Budget</div><input className="spField" defaultValue={row.budget ? String(row.budget) : ""} placeholder="0.00" onBlur={(e) => updateBudget(row.id, e.target.value)} /></div><div><div className="spTinyLabel">Forecast</div><div className="spChip" style={{ width: "100%" }}>{money(row.forecast)}</div></div></div></div>; })}</div></article>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

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

const TONE = {
  red: "#ff6b7f",
  green: "#4ade80",
  amber: "#f59e0b",
  blue: "#60a5fa",
};

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

  return keys.map((key) => ({
    key,
    label: labelForKey(key),
    value: Number(totals.get(key) || 0),
  }));
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

function sumExpenses(rows) {
  return rows.reduce((sum, t) => sum + (t.type === "expense" ? Number(t.amount) || 0 : 0), 0);
}

function trendMeta(current, previous) {
  const diff = percentChange(current, previous);
  const positive = diff >= 0;
  return {
    value: `${positive ? "+" : ""}${diff.toFixed(0)}%`,
    positive,
    text: "vs prior period",
  };
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

function mapTransactionRowToClient(row) {
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
    account: row.account_name || "",
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
  const categoryName = category?.name?.trim() || "Expense";
  return tx.merchant?.trim() ? `${categoryName} • ${tx.merchant.trim()}` : categoryName;
}

function calendarTitleForPlanned(planned, category) {
  const categoryName = category?.name?.trim() || "Planned Expense";
  return planned.merchant?.trim()
    ? `Planned • ${categoryName} • ${planned.merchant.trim()}`
    : `Planned • ${categoryName}`;
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
    const { error: updateError } = await supabase
      .from("calendar_events")
      .update(payload)
      .eq("id", existing.id);

    if (updateError) throw updateError;
    return;
  }

  const { error: insertError } = await supabase
    .from("calendar_events")
    .insert([{ id: uid(), created_at: new Date().toISOString(), ...payload }]);

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
    const { error: updateError } = await supabase
      .from("calendar_events")
      .update(payload)
      .eq("id", existing.id);

    if (updateError) throw updateError;
    return;
  }

  const { error: insertError } = await supabase
    .from("calendar_events")
    .insert([{ id: uid(), created_at: new Date().toISOString(), ...payload }]);

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

function TrendChart({ data }) {
  const width = 1000;
  const height = 280;
  const padX = 28;
  const padY = 20;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;
  const max = Math.max(...data.map((d) => d.value), 10);

  const points = data.map((d, i) => {
    const x = padX + (data.length <= 1 ? 0 : (i / (data.length - 1)) * chartW);
    const y = padY + chartH - (d.value / max) * chartH;
    return { ...d, x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${padX + chartW} ${height - padY} L ${padX} ${height - padY} Z`;

  return (
    <div className="spTrendWrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="spTrendSvg">
        <defs>
          <linearGradient id="spendingTrendFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={TONE.red} stopOpacity="0.24" />
            <stop offset="100%" stopColor={TONE.red} stopOpacity="0.01" />
          </linearGradient>
          <filter id="spendingTrendGlow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {Array.from({ length: 5 }).map((_, i) => {
          const y = padY + (i / 4) * chartH;
          return (
            <line
              key={i}
              x1={padX}
              x2={padX + chartW}
              y1={y}
              y2={y}
              stroke="rgba(255,255,255,0.08)"
              strokeDasharray="5 6"
            />
          );
        })}

        {points.map((p) => (
          <text
            key={`label-${p.key}`}
            x={p.x}
            y={height - 4}
            textAnchor="middle"
            fontSize="12"
            fill="rgba(255,255,255,0.42)"
          >
            {p.label}
          </text>
        ))}

        <path d={areaPath} fill="url(#spendingTrendFill)" />
        <path
          d={linePath}
          fill="none"
          stroke={TONE.red}
          strokeWidth="4"
          filter="url(#spendingTrendGlow)"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((p) => (
          <g key={p.key}>
            <circle cx={p.x} cy={p.y} r="4" fill={TONE.red} />
            <circle cx={p.x} cy={p.y} r="10" fill={TONE.red} fillOpacity="0.08" />
          </g>
        ))}
      </svg>
    </div>
  );
}

function ProgressBar({ value = 0, color = TONE.green }) {
  const pct = clamp(Number(value) || 0, 0, 100);
  return (
    <div className="spProgress">
      <div
        className="spProgressFill"
        style={{
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${color} 0%, rgba(255,255,255,.92) 220%)`,
          boxShadow: `0 0 18px ${color}44, 0 0 26px ${color}18`,
        }}
      />
    </div>
  );
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

  const groups = React.useMemo(
    () => ["All", ...Array.from(new Set(categories.map((c) => c.group))).sort((a, b) => a.localeCompare(b))],
    [categories]
  );

  React.useEffect(() => {
    let mounted = true;

    async function loadAll() {
      try {
        setPageError("");

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

        const [catRes, budgetRes, txRes, plannedRes] = await Promise.all([
          supabase
            .from("spending_categories")
            .select("*")
            .eq("user_id", currentUser.id)
            .order("group_name")
            .order("name"),
          supabase.from("spending_budgets").select("*").eq("user_id", currentUser.id),
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
        ]);

        if (catRes.error) throw catRes.error;
        if (budgetRes.error) throw budgetRes.error;
        if (txRes.error) throw txRes.error;
        if (plannedRes.error) throw plannedRes.error;

        const loadedCategories =
          (catRes.data || []).length > 0 ? (catRes.data || []).map(mapCategoryRowToClient) : DEFAULT_CATEGORIES;

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

  const previousTransactions = React.useMemo(
    () => transactions.filter((t) => inRange(t.date, previousRange.start, previousRange.end)),
    [transactions, previousRange]
  );

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

    return {
      expense,
      income,
      transfer,
      plannedExpense,
      net: income - expense,
      forecastNet: income - (expense + plannedExpense),
    };
  }, [filteredTransactions, filteredPlanned]);

  const previousExpense = React.useMemo(() => sumExpenses(previousTransactions), [previousTransactions]);
  const expenseTrend = React.useMemo(() => trendMeta(totals.expense, previousExpense), [totals.expense, previousExpense]);
  const trendData = React.useMemo(
    () => groupTransactionsForTrend(filteredTransactions, range.start, period),
    [filteredTransactions, range.start, period]
  );

  const totalsByCategory = React.useMemo(() => {
    const map = new Map();

    for (const t of filteredTransactions) {
      if (t.type !== "expense") continue;
      map.set(t.categoryId, (map.get(t.categoryId) || 0) + (Number(t.amount) || 0));
    }

    return Array.from(map.entries())
      .map(([categoryId, total]) => ({
        categoryId,
        total,
        category: categoriesById.get(categoryId),
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredTransactions, categoriesById]);

  const plannedByCategory = React.useMemo(() => {
    const map = new Map();
    for (const p of filteredPlanned) {
      map.set(p.categoryId, (map.get(p.categoryId) || 0) + (Number(p.amount) || 0));
    }
    return map;
  }, [filteredPlanned]);

  const budgetRows = React.useMemo(() => {
    const modeKey = range.budgetMode;
    const currentBudgets = budgets?.[modeKey] || {};
    const spentMap = new Map(totalsByCategory.map((x) => [x.categoryId, x.total]));

    return categories
      .map((c) => {
        const spent = Number(spentMap.get(c.id) || 0);
        const planned = Number(plannedByCategory.get(c.id) || 0);
        const budget = Number(currentBudgets[c.id] || 0);
        const forecast = spent + planned;

        return {
          ...c,
          spent,
          planned,
          budget,
          forecast,
          status: budgetStatus(spent, budget),
          forecastStatus: budgetStatus(forecast, budget),
        };
      })
      .filter((r) => r.budget > 0 || r.spent > 0 || r.planned > 0 || r.isBudgeted)
      .sort((a, b) => b.forecast - a.forecast || a.name.localeCompare(b.name));
  }, [categories, budgets, totalsByCategory, plannedByCategory, range.budgetMode]);

  const totalBudget = React.useMemo(
    () => budgetRows.reduce((sum, row) => sum + (Number(row.budget) || 0), 0),
    [budgetRows]
  );

  const remaining = totalBudget - totals.expense;
  const priorityCategory = totalsByCategory[0];

  const priorityPercent = React.useMemo(() => {
    if (!priorityCategory) return 0;
    const budget = Number(budgets?.[range.budgetMode]?.[priorityCategory.categoryId] || 0);
    if (budget <= 0) return 0;
    return (priorityCategory.total / budget) * 100;
  }, [priorityCategory, budgets, range.budgetMode]);

  const recentActivity = React.useMemo(() => filteredTransactions.slice(0, 7), [filteredTransactions]);

  const upcomingItems = React.useMemo(() => {
    const now = new Date();
    return plannedItems
      .filter((p) => toDate(p.date) >= new Date(now.getFullYear(), now.getMonth(), now.getDate()))
      .sort((a, b) => {
        if (a.date !== b.date) return String(a.date).localeCompare(String(b.date));
        if ((a.time || "") !== (b.time || "")) return String(a.time || "").localeCompare(String(b.time || ""));
        return Number(a.createdAt || 0) - Number(b.createdAt || 0);
      })
      .slice(0, 7);
  }, [plannedItems]);

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
    if (!Number.isFinite(amt) || amt <= 0) {
      alert("Enter a valid amount.");
      return;
    }

    if (!qaDate) {
      alert("Date required.");
      return;
    }

    if (qaType === "expense" && !qaCategoryId) {
      alert("Pick a category.");
      return;
    }

    setSaving(true);

    try {
      const tx = {
        id: uid(),
        type: qaType,
        amount: Math.round(amt * 100) / 100,
        categoryId: qaType === "expense" ? qaCategoryId : "",
        date: qaDate,
        time: normalizeTime(qaTime),
        merchant: qaMerchant.trim(),
        note: qaNote.trim(),
        paymentMethod: qaPayment,
        account: qaAccount,
        createdAt: Date.now(),
      };

      const { data, error } = await supabase
        .from("spending_transactions")
        .insert([mapTransactionClientToRow(tx, user.id)])
        .select()
        .single();

      if (error) throw error;

      const saved = mapTransactionRowToClient(data);
      const category = categoriesById.get(saved.categoryId);

      await upsertCalendarEventForTransaction(saved, user.id, category);
      setTransactions((prev) => [saved, ...prev]);
      clearQuickAdd();
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
      alert("Enter a valid amount.");
      return;
    }

    if (!qaDate) {
      alert("Planned date required.");
      return;
    }

    if (!qaCategoryId) {
      alert("Pick a category.");
      return;
    }

    setSaving(true);

    try {
      const planned = {
        id: uid(),
        amount: Math.round(amt * 100) / 100,
        categoryId: qaCategoryId,
        date: qaDate,
        time: normalizeTime(qaTime),
        merchant: qaMerchant.trim(),
        note: qaNote.trim(),
        createdAt: Date.now(),
      };

      const { data, error } = await supabase
        .from("spending_planned_items")
        .insert([mapPlannedClientToRow(planned, user.id)])
        .select()
        .single();

      if (error) throw error;

      const saved = mapPlannedRowToClient(data);
      const category = categoriesById.get(saved.categoryId);

      await upsertCalendarEventForPlanned(saved, user.id, category);
      setPlannedItems((prev) => [saved, ...prev]);
      clearQuickAdd();
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
      const { error } = await supabase
        .from("spending_transactions")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

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
      const clone = {
        ...tx,
        id: uid(),
        createdAt: Date.now(),
      };

      const { data, error } = await supabase
        .from("spending_transactions")
        .insert([mapTransactionClientToRow(clone, user.id)])
        .select()
        .single();

      if (error) throw error;

      const saved = mapTransactionRowToClient(data);
      const category = categoriesById.get(saved.categoryId);

      await upsertCalendarEventForTransaction(saved, user.id, category);
      setTransactions((prev) => [saved, ...prev]);
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
      const { error } = await supabase
        .from("spending_planned_items")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

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
      const tx = {
        id: uid(),
        type: "expense",
        amount: planned.amount,
        categoryId: planned.categoryId,
        date: planned.date,
        time: normalizeTime(planned.time || ""),
        merchant: planned.merchant || "",
        note: planned.note || "",
        paymentMethod: "Card",
        account: "Checking",
        createdAt: Date.now(),
      };

      const { data: insertedTx, error: txErr } = await supabase
        .from("spending_transactions")
        .insert([mapTransactionClientToRow(tx, user.id)])
        .select()
        .single();

      if (txErr) throw txErr;

      const { error: plannedErr } = await supabase
        .from("spending_planned_items")
        .delete()
        .eq("id", planned.id)
        .eq("user_id", user.id);

      if (plannedErr) throw plannedErr;

      const savedTx = mapTransactionRowToClient(insertedTx);
      const category = categoriesById.get(savedTx.categoryId);

      await deleteCalendarEventBySource(user.id, "planned_expense", planned.id);
      await upsertCalendarEventForTransaction(savedTx, user.id, category);

      setTransactions((prev) => [savedTx, ...prev]);
      setPlannedItems((prev) => prev.filter((p) => p.id !== planned.id));
    } catch (err) {
      setPageError(err?.message || "Failed to convert planned item.");
    }
  }

  async function addCategory() {
    if (!user) return;

    const name = newCategoryName.trim();
    const group = newCategoryGroup.trim() || "Other";

    if (!name) {
      alert("Category name required.");
      return;
    }

    const id =
      name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 30) || uid();

    if (categoriesById.get(id)) {
      alert("Category already exists.");
      return;
    }

    try {
      const cat = normalizeCategory({
        id,
        name,
        group,
        color: "#94a3b8",
        isBudgeted: true,
      });

      const { data, error } = await supabase
        .from("spending_categories")
        .insert([mapCategoryClientToRow(cat, user.id)])
        .select()
        .single();

      if (error) throw error;

      setCategories((prev) =>
        [...prev, mapCategoryRowToClient(data)].sort(
          (a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name)
        )
      );
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
      const { error } = await supabase
        .from("spending_categories")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

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

    setBudgets((prev) => ({
      ...prev,
      [modeKey]: {
        ...(prev[modeKey] || {}),
        [categoryId]: rounded,
      },
    }));

    const { error } = await supabase
      .from("spending_budgets")
      .upsert(
        {
          user_id: user.id,
          period_mode: modeKey,
          category_id: categoryId,
          amount: rounded,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,period_mode,category_id" }
      );

    if (error) setPageError(error.message || "Failed to save budget.");
  }

  const currentMonth = new Date().toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });

  const styles = (
    <style jsx global>{`
      .spendingPage {
        --text: #f7f8ff;
        --muted: rgba(225, 232, 255, 0.72);
        --muted2: rgba(225, 232, 255, 0.46);
        --line: rgba(255, 255, 255, 0.1);
        --glass: linear-gradient(180deg, rgba(6, 12, 24, 0.44), rgba(4, 8, 16, 0.2));
        --glassSoft: linear-gradient(180deg, rgba(255,255,255,0.026), rgba(255,255,255,0.006));
        --shadow: 0 20px 60px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.045);
        color: var(--text);
        color-scheme: dark;
      }

      .spendingPage *,
      .spendingPage *::before,
      .spendingPage *::after {
        box-sizing: border-box;
      }

      .spendingPage .spShell {
        width: 100%;
        max-width: none;
        margin: 0;
        padding: 22px 12px 58px 4px;
      }

      .spendingPage .spCard,
      .spendingPage .spHero,
      .spendingPage .spMetric,
      .spendingPage .spMiniCard,
      .spendingPage .spGlassLine {
        position: relative;
        overflow: hidden;
        border-radius: 30px;
        border: 1px solid rgba(255,255,255,0.078);
        background: var(--glass);
        box-shadow: var(--shadow);
        backdrop-filter: blur(15px) saturate(126%);
        -webkit-backdrop-filter: blur(15px) saturate(126%);
      }

      .spendingPage .spCard::before,
      .spendingPage .spHero::before,
      .spendingPage .spMetric::before,
      .spendingPage .spMiniCard::before,
      .spendingPage .spGlassLine::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background:
          radial-gradient(circle at top left, rgba(80,120,255,0.08), transparent 28%),
          radial-gradient(circle at top right, rgba(255,255,255,0.022), transparent 18%),
          radial-gradient(circle at bottom center, rgba(255,107,127,0.035), transparent 28%);
      }

      .spendingPage .spHero {
        padding: 28px;
        margin-bottom: 22px;
      }

      .spendingPage .spHeroTop {
        position: relative;
        z-index: 1;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 20px;
        flex-wrap: wrap;
      }

      .spendingPage .spHeroTop > *,
      .spendingPage .spCardHead > *,
      .spendingPage .spListHead > * {
        min-width: 0;
      }

      .spendingPage .spEyebrow {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.2em;
        color: var(--muted2);
        margin-bottom: 12px;
      }

      .spendingPage .spTitle {
        margin: 0;
        font-size: clamp(34px, 4vw, 64px);
        line-height: 0.95;
        font-weight: 950;
        letter-spacing: -0.045em;
      }

      .spendingPage .spSub {
        margin-top: 12px;
        max-width: 960px;
        color: var(--muted);
        line-height: 1.6;
        font-size: 15px;
      }

      .spendingPage .spChipRow,
      .spendingPage .spActionRow {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }

      .spendingPage .spChip {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 40px;
        padding: 10px 15px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.075);
        background: rgba(255,255,255,0.038);
        color: #f5f7ff;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.04em;
      }

      .spendingPage .spHeroMeta {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        justify-content: flex-end;
        max-width: 100%;
      }

      .spendingPage .spSegment {
        display: inline-flex;
        gap: 6px;
        padding: 4px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.08);
        background: rgba(255,255,255,0.04);
      }

      .spendingPage .spSegmentBtn,
      .spendingPage .spTabBtn,
      .spendingPage .spSolidBtn,
      .spendingPage .spGhostBtn,
      .spendingPage .spDangerBtn {
        min-height: 44px;
        padding: 0 16px;
        border-radius: 14px;
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 0.02em;
        cursor: pointer;
        transition:
          transform 0.18s ease,
          border-color 0.18s ease,
          background 0.18s ease,
          box-shadow 0.18s ease,
          opacity 0.18s ease;
      }

      .spendingPage .spSegmentBtn:hover,
      .spendingPage .spTabBtn:hover,
      .spendingPage .spSolidBtn:hover,
      .spendingPage .spGhostBtn:hover,
      .spendingPage .spDangerBtn:hover {
        transform: translateY(-1px);
      }

      .spendingPage .spSegmentBtn,
      .spendingPage .spTabBtn,
      .spendingPage .spGhostBtn {
        border: 1px solid rgba(255,255,255,0.09);
        background: rgba(255,255,255,0.03);
        color: #f5f7ff;
      }

      .spendingPage .spSegmentBtn.active,
      .spendingPage .spTabBtn.active {
        border-color: rgba(255,255,255,0.14);
        background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(233,237,246,0.92));
        color: #08111f;
      }

      .spendingPage .spSolidBtn {
        border: 1px solid rgba(130,170,255,0.24);
        background: linear-gradient(180deg, rgba(77,124,255,0.22), rgba(32,74,189,0.12));
        color: #f7f9ff;
      }

      .spendingPage .spDangerBtn {
        border: 1px solid rgba(244,114,182,0.22);
        background: rgba(244,114,182,0.08);
        color: #ffd5e5;
      }

      .spendingPage .spSegmentBtn:disabled,
      .spendingPage .spTabBtn:disabled,
      .spendingPage .spSolidBtn:disabled,
      .spendingPage .spGhostBtn:disabled,
      .spendingPage .spDangerBtn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
        transform: none;
      }

      .spendingPage .spMetricGrid {
        display: grid;
        grid-template-columns: repeat(4, minmax(235px, 1fr));
        gap: 18px;
        margin-bottom: 22px;
      }

      .spendingPage .spMetric {
        padding: 22px;
        min-height: 168px;
      }

      .spendingPage .spMetricLabel {
        position: relative;
        z-index: 1;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        color: var(--muted2);
      }

      .spendingPage .spMetricValue {
        position: relative;
        z-index: 1;
        margin-top: 14px;
        font-size: clamp(30px, 3.1vw, 48px);
        line-height: 1;
        font-weight: 950;
        letter-spacing: -0.04em;
      }

      .spendingPage .spMetricSub {
        position: relative;
        z-index: 1;
        margin-top: 14px;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.5;
      }

      .spendingPage .spMetricAccent {
        display: inline-block;
        margin-right: 6px;
        font-weight: 900;
      }

      .spendingPage .spOverviewGrid,
      .spendingPage .spOverviewGridLower,
      .spendingPage .spManageGrid {
        display: grid;
        gap: 20px;
      }

      .spendingPage .spOverviewGrid {
        grid-template-columns: minmax(0, 1.68fr) minmax(520px, 1fr);
        margin-bottom: 20px;
      }

      .spendingPage .spOverviewGridLower {
        grid-template-columns: minmax(0, 1.42fr) minmax(470px, 1fr);
      }

      .spendingPage .spManageGrid {
        grid-template-columns: minmax(0, 1.34fr) minmax(460px, 1fr);
      }

      .spendingPage .spCard {
        padding: 24px;
      }

      .spendingPage .spCardHead {
        position: relative;
        z-index: 1;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 14px;
        flex-wrap: wrap;
        margin-bottom: 16px;
      }

      .spendingPage .spSectionTitle {
        margin: 0;
        font-size: 34px;
        line-height: 1;
        font-weight: 900;
        letter-spacing: -0.03em;
      }

      .spendingPage .spSectionMini {
        margin: 0;
        font-size: 20px;
        line-height: 1.1;
        font-weight: 900;
      }

      .spendingPage .spSectionText {
        margin-top: 8px;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.55;
      }

      .spendingPage .spTiny {
        color: var(--muted2);
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-size: 10px;
        font-weight: 700;
        margin-bottom: 8px;
      }

      .spendingPage .spInnerCard {
        position: relative;
        z-index: 1;
        border-radius: 22px;
        padding: 16px;
        border: 1px solid rgba(255,255,255,0.06);
        background: linear-gradient(180deg, rgba(10,16,28,0.38), rgba(5,9,17,0.15));
      }

      .spendingPage .spInnerGrid2 {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
      }

      .spendingPage .spMiniStatGrid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
        margin-top: 18px;
      }

      .spendingPage .spColumnStack,
      .spendingPage .spStack,
      .spendingPage .spList {
        display: grid;
        gap: 14px;
      }

      .spendingPage .spSplitList {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }

      .spendingPage .spQuickGrid4 {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
      }

      .spendingPage .spQuickGrid2,
      .spendingPage .spFilterGrid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
      }

      .spendingPage .spField,
      .spendingPage .spSelect,
      .spendingPage .spTextarea {
        width: 100%;
        min-height: 50px;
        border-radius: 16px;
        border: 1px solid rgba(177,196,255,0.14);
        background: rgba(8, 13, 24, 0.52) !important;
        color: #f4f7ff !important;
        font-size: 14px;
        font-weight: 600;
        padding: 0 14px;
        outline: none;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.02), 0 0 0 rgba(0,0,0,0);
        transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
      }

      .spendingPage .spTextarea {
        min-height: 102px;
        padding: 12px 14px;
        resize: vertical;
      }

      .spendingPage .spField::placeholder,
      .spendingPage .spTextarea::placeholder {
        color: rgba(233,238,255,0.44) !important;
      }

      .spendingPage .spField:focus,
      .spendingPage .spSelect:focus,
      .spendingPage .spTextarea:focus {
        border-color: rgba(121,163,255,0.36);
        box-shadow: 0 0 0 4px rgba(59,130,246,0.08);
      }

      .spendingPage .spSelect {
        cursor: pointer;
      }

      .spendingPage .spSelect option {
        background: #08111f !important;
        color: #f4f7ff !important;
      }

      .spendingPage input:-webkit-autofill,
      .spendingPage input:-webkit-autofill:hover,
      .spendingPage input:-webkit-autofill:focus,
      .spendingPage textarea:-webkit-autofill,
      .spendingPage select:-webkit-autofill {
        -webkit-text-fill-color: #f4f7ff !important;
        -webkit-box-shadow: 0 0 0px 1000px #0a1321 inset !important;
        box-shadow: 0 0 0px 1000px #0a1321 inset !important;
        transition: background-color 9999s ease-in-out 0s;
      }

      .spendingPage input[type="date"]::-webkit-calendar-picker-indicator,
      .spendingPage input[type="time"]::-webkit-calendar-picker-indicator {
        filter: invert(1) opacity(0.72);
        cursor: pointer;
      }

      .spendingPage .spTrendWrap {
        overflow: hidden;
        border-radius: 24px;
        border: 1px solid rgba(255,255,255,0.055);
        background: linear-gradient(180deg, rgba(10,16,28,0.34), rgba(5,9,17,0.12));
        padding: 12px;
      }

      .spendingPage .spTrendSvg {
        display: block;
        width: 100%;
        height: 280px;
      }

      .spendingPage .spBudgetGrid {
        display: grid;
        gap: 14px;
      }

      .spendingPage .spBudgetItem {
        border-radius: 22px;
        border: 1px solid rgba(255,255,255,0.055);
        background: linear-gradient(180deg, rgba(10,16,28,0.38), rgba(5,9,17,0.14));
        padding: 16px;
      }

      .spendingPage .spBudgetHead {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
        margin-bottom: 12px;
      }

      .spendingPage .spBudgetMeta {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
        margin-top: 12px;
      }

      .spendingPage .spPillStatus {
        display: inline-flex;
        align-items: center;
        min-height: 30px;
        padding: 6px 10px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 900;
        letter-spacing: 0.04em;
      }

      .spendingPage .spProgress {
        height: 10px;
        overflow: hidden;
        border-radius: 999px;
        background: rgba(255,255,255,0.1);
      }

      .spendingPage .spProgressFill {
        height: 100%;
        border-radius: 999px;
        transition: width 0.45s ease;
      }

      .spendingPage .spListItem {
        position: relative;
        overflow: hidden;
        border-radius: 22px;
        padding: 14px;
        border: 1px solid rgba(255,255,255,0.055);
        background: linear-gradient(180deg, rgba(8,13,24,0.34), rgba(4,8,16,0.12));
      }

      .spendingPage .spListHead {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
        flex-wrap: wrap;
      }

      .spendingPage .spListHead > :first-child {
        flex: 1 1 240px;
        min-width: 0;
      }

      .spendingPage .spListHead > :last-child {
        flex: 0 0 auto;
      }

      .spendingPage .spListTitle {
        font-size: 16px;
        font-weight: 900;
      }

      .spendingPage .spMuted {
        color: var(--muted);
      }

      .spendingPage .spMuted2 {
        color: var(--muted2);
      }

      .spendingPage .spValueGood {
        color: rgb(134 239 172);
        font-weight: 900;
      }

      .spendingPage .spValueBad {
        color: rgb(255 176 196);
        font-weight: 900;
      }

      .spendingPage .spValueWarn {
        color: rgb(253 224 71);
        font-weight: 900;
      }

      .spendingPage .spBudgetInput {
        max-width: 150px;
      }

      .spendingPage .spError {
        padding: 14px 16px;
        margin-bottom: 18px;
        border-radius: 22px;
        border: 1px solid rgba(244,114,182,0.26);
        background: linear-gradient(180deg, rgba(96,17,44,0.28), rgba(36,8,18,0.2));
      }

      .spendingPage .spEmpty {
        border: 1px dashed rgba(255,255,255,0.1);
        border-radius: 18px;
        padding: 16px;
        color: var(--muted);
        background: rgba(255,255,255,0.018);
      }

      .spendingPage .spTitle,
      .spendingPage .spSectionTitle,
      .spendingPage .spSectionMini,
      .spendingPage .spListTitle,
      .spendingPage .spMetricValue,
      .spendingPage .spMetricSub,
      .spendingPage .spSectionText {
        overflow-wrap: anywhere;
      }

      @media (max-width: 1580px) {
        .spendingPage .spOverviewGrid {
          grid-template-columns: minmax(0, 1.45fr) minmax(470px, 1fr);
        }

        .spendingPage .spOverviewGridLower,
        .spendingPage .spManageGrid {
          grid-template-columns: minmax(0, 1.16fr) minmax(410px, 0.96fr);
        }
      }

      @media (max-width: 1320px) {
        .spendingPage .spMetricGrid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .spendingPage .spOverviewGrid,
        .spendingPage .spOverviewGridLower,
        .spendingPage .spManageGrid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 980px) {
        .spendingPage .spMiniStatGrid,
        .spendingPage .spSplitList,
        .spendingPage .spQuickGrid4,
        .spendingPage .spQuickGrid2,
        .spendingPage .spInnerGrid2,
        .spendingPage .spBudgetMeta,
        .spendingPage .spFilterGrid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 760px) {
        .spendingPage .spShell {
          padding: 16px 10px 34px;
        }

        .spendingPage .spHero,
        .spendingPage .spCard,
        .spendingPage .spMetric {
          border-radius: 22px;
          padding: 18px;
        }

        .spendingPage .spMetricGrid {
          grid-template-columns: 1fr;
        }

        .spendingPage .spHeroMeta,
        .spendingPage .spActionRow {
          justify-content: flex-start;
        }

        .spendingPage .spSectionTitle {
          font-size: 26px;
        }

        .spendingPage .spTitle {
          font-size: 36px;
        }

        .spendingPage .spTrendSvg {
          height: 230px;
        }
      }
    `}</style>
  );

  const quickAddSave = async () => {
    if (mode === "planned") {
      await addPlanned();
      return;
    }
    await addNow();
  };

  if (loading) {
    return (
      <main className="spendingPage">
        {styles}
        <div className="spShell">
          <section className="spHero">
            <div className="spHeroTop">
              <div>
                <div className="spEyebrow">LIVE FINANCE BOARD</div>
                <h1 className="spTitle">Spending Control</h1>
                <div className="spSub">Loading spending...</div>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="spendingPage">
        {styles}
        <div className="spShell">
          <section className="spHero">
            <div className="spHeroTop">
              <div>
                <div className="spEyebrow">LIVE FINANCE BOARD</div>
                <h1 className="spTitle">Spending Control</h1>
                <div className="spSub">This page needs an authenticated user.</div>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="spendingPage">
      {styles}

      <div className="spShell">
        <header className="spHero">
          <div className="spHeroTop">
            <div>
              <div className="spEyebrow">LIVE FINANCE BOARD</div>
              <h1 className="spTitle">Spending Control</h1>
              <div className="spSub">
                Wider desktop spread, cleaner right side, and slightly more transparent cards so the background actually shows.
              </div>

              <div className="spChipRow" style={{ marginTop: 14 }}>
                <span className="spChip">{range.label.toUpperCase()}</span>
                <span className="spChip">{filteredTransactions.length} TRANSACTIONS</span>
                <span className="spChip">{filteredPlanned.length} PLANNED</span>
                <span className="spChip">{currentMonth}</span>
              </div>
            </div>

            <div className="spHeroMeta">
              <div className="spSegment">
                {["week", "month", "year"].map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`spSegmentBtn ${period === p ? "active" : ""}`}
                    onClick={() => setPeriod(p)}
                  >
                    {p[0].toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>

              <div className="spSegment">
                <button
                  type="button"
                  className={`spTabBtn ${tab === "overview" ? "active" : ""}`}
                  onClick={() => setTab("overview")}
                >
                  Overview
                </button>
                <button
                  type="button"
                  className={`spTabBtn ${tab === "manage" ? "active" : ""}`}
                  onClick={() => setTab("manage")}
                >
                  Manage
                </button>
              </div>
            </div>
          </div>
        </header>

        {pageError ? (
          <div className="spError">
            <div style={{ fontWeight: 900, fontSize: 15 }}>Database issue</div>
            <div className="spSectionText" style={{ marginTop: 6 }}>
              {pageError}
            </div>
          </div>
        ) : null}

        <section className="spMetricGrid">
          <article className="spMetric">
            <div className="spMetricLabel">Spent</div>
            <div className="spMetricValue">{money(totals.expense)}</div>
            <div className="spMetricSub">
              <span className="spMetricAccent" style={{ color: TONE.red }}>
                {expenseTrend.value}
              </span>
              {expenseTrend.text}
            </div>
          </article>

          <article className="spMetric">
            <div className="spMetricLabel">Planned</div>
            <div className="spMetricValue">{money(totals.plannedExpense)}</div>
            <div className="spMetricSub">
              {upcomingItems.length > 0 ? `${upcomingItems.length} upcoming item(s)` : "Nothing planned yet"}
            </div>
          </article>

          <article className="spMetric">
            <div className="spMetricLabel">Remaining</div>
            <div className="spMetricValue">{money(Math.max(remaining, 0))}</div>
            <div className="spMetricSub">
              {remaining < 0 ? `Over by ${money(Math.abs(remaining))}` : `From ${money(totalBudget)} budget`}
            </div>
          </article>

          <article className="spMetric">
            <div className="spMetricLabel">Net</div>
            <div className="spMetricValue">{money(totals.net)}</div>
            <div className="spMetricSub">Forecast {money(totals.forecastNet)}</div>
          </article>
        </section>

        {tab === "overview" ? (
          <>
            <section className="spOverviewGrid">
              <article className="spCard">
                <div className="spCardHead">
                  <div>
                    <h2 className="spSectionTitle">Spending Pressure</h2>
                    <div className="spSectionText">
                      Opened up so the chart has room and the page does not feel jammed.
                    </div>
                  </div>
                  <span className="spChip">{priorityCategory?.category?.name || "NO LEADER"}</span>
                </div>

                <TrendChart data={trendData} />

                <div className="spMiniStatGrid">
                  <div className="spInnerCard">
                    <div className="spTiny">Priority Category</div>
                    <div style={{ fontSize: 28, fontWeight: 950, lineHeight: 1 }}>
                      {priorityCategory?.category?.name || "No expense data"}
                    </div>
                    <div className="spSectionText" style={{ marginTop: 10 }}>
                      {priorityCategory ? money(priorityCategory.total) : "Start logging spending."}
                    </div>
                  </div>

                  <div className="spInnerCard">
                    <div className="spTiny">Pressure vs Budget</div>
                    <div style={{ fontSize: 28, fontWeight: 950, lineHeight: 1 }}>
                      {priorityCategory ? `${clamp(priorityPercent, 0, 999).toFixed(0)}%` : "0%"}
                    </div>
                    <div className="spSectionText" style={{ marginTop: 10 }}>
                      {priorityCategory?.category?.name
                        ? `${priorityCategory.category.name} budget usage`
                        : "No category leader yet"}
                    </div>
                  </div>

                  <div className="spInnerCard">
                    <div className="spTiny">Forecast View</div>
                    <div style={{ fontSize: 28, fontWeight: 950, lineHeight: 1 }}>
                      {money(totals.forecastNet)}
                    </div>
                    <div className="spSectionText" style={{ marginTop: 10 }}>
                      After planned items land.
                    </div>
                  </div>
                </div>
              </article>

              <article className="spCard">
                <div className="spCardHead">
                  <div>
                    <h2 className="spSectionTitle">Quick Add</h2>
                    <div className="spSectionText">Now the right side has real room and the fields are not choking each other.</div>
                  </div>

                  <div className="spSegment">
                    <button
                      type="button"
                      className={`spSegmentBtn ${mode === "now" ? "active" : ""}`}
                      onClick={() => setMode("now")}
                    >
                      Now
                    </button>
                    <button
                      type="button"
                      className={`spSegmentBtn ${mode === "planned" ? "active" : ""}`}
                      onClick={() => {
                        setMode("planned");
                        setQaType("expense");
                      }}
                    >
                      Planned
                    </button>
                  </div>
                </div>

                <div className="spStack">
                  <div className="spQuickGrid4">
                    {mode === "now" ? (
                      <div>
                        <div className="spTiny">Type</div>
                        <select className="spSelect" value={qaType} onChange={(e) => setQaType(e.target.value)}>
                          <option value="expense">Expense</option>
                          <option value="income">Income</option>
                          <option value="transfer">Transfer</option>
                        </select>
                      </div>
                    ) : (
                      <div>
                        <div className="spTiny">Type</div>
                        <div className="spChip" style={{ width: "100%" }}>
                          PLANNED EXPENSE
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="spTiny">Amount</div>
                      <input
                        className="spField"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={qaAmount}
                        onChange={(e) => setQaAmount(e.target.value)}
                      />
                    </div>

                    <div>
                      <div className="spTiny">Date</div>
                      <input
                        className="spField"
                        type="date"
                        value={qaDate}
                        onChange={(e) => setQaDate(e.target.value)}
                      />
                    </div>

                    <div>
                      <div className="spTiny">Time</div>
                      <input
                        className="spField"
                        type="time"
                        value={qaTime}
                        onChange={(e) => setQaTime(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="spQuickGrid2">
                    <div>
                      <div className="spTiny">Category</div>
                      <select
                        className="spSelect"
                        value={qaCategoryId}
                        onChange={(e) => setQaCategoryId(e.target.value)}
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.group} • {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="spTiny">Merchant / Source</div>
                      <input
                        className="spField"
                        placeholder="Where did it go?"
                        value={qaMerchant}
                        onChange={(e) => setQaMerchant(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="spQuickGrid2">
                    <div>
                      <div className="spTiny">Payment Method</div>
                      <select className="spSelect" value={qaPayment} onChange={(e) => setQaPayment(e.target.value)}>
                        <option>Card</option>
                        <option>Cash</option>
                        <option>ACH</option>
                        <option>Transfer</option>
                      </select>
                    </div>

                    <div>
                      <div className="spTiny">Account</div>
                      <input
                        className="spField"
                        value={qaAccount}
                        onChange={(e) => setQaAccount(e.target.value)}
                        placeholder="Checking"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="spTiny">Note</div>
                    <textarea
                      className="spTextarea"
                      placeholder="Optional note"
                      value={qaNote}
                      onChange={(e) => setQaNote(e.target.value)}
                    />
                  </div>

                  <div className="spActionRow">
                    <button className="spSolidBtn" type="button" onClick={quickAddSave} disabled={saving}>
                      {saving ? "Saving..." : mode === "planned" ? "Save Planned Item" : "Save Transaction"}
                    </button>
                    <button className="spGhostBtn" type="button" onClick={clearQuickAdd} disabled={saving}>
                      Reset
                    </button>
                  </div>
                </div>
              </article>
            </section>

            <section className="spOverviewGridLower">
              <article className="spCard">
                <div className="spCardHead">
                  <div>
                    <h2 className="spSectionTitle">Budget Clarity</h2>
                    <div className="spSectionText">Clean pressure read so you can actually see what is good, tight, or cooked.</div>
                  </div>
                  <span className="spChip">{range.budgetMode.toUpperCase()}</span>
                </div>

                <div className="spBudgetGrid">
                  {budgetRows.length === 0 ? (
                    <div className="spEmpty">No budget or expense data yet.</div>
                  ) : (
                    budgetRows.slice(0, 8).map((row) => {
                      const tone = statusTone(row.forecastStatus);
                      const progressColor =
                        row.forecastStatus === "Over"
                          ? TONE.red
                          : row.forecastStatus === "Near"
                            ? TONE.amber
                            : TONE.green;

                      const progressPct = row.budget > 0 ? (row.forecast / row.budget) * 100 : 0;

                      return (
                        <div key={row.id} className="spBudgetItem">
                          <div className="spBudgetHead">
                            <div>
                              <div className="spListTitle">{row.name}</div>
                              <div className="spSectionText">
                                {row.group} • {money(row.spent)} spent • {money(row.planned)} planned
                              </div>
                            </div>

                            <span className="spPillStatus" style={tone}>
                              {row.forecastStatus}
                            </span>
                          </div>

                          <ProgressBar value={progressPct} color={progressColor} />

                          <div className="spBudgetMeta">
                            <div>
                              <div className="spTiny">Budget</div>
                              <div style={{ fontWeight: 900 }}>{money(row.budget)}</div>
                            </div>
                            <div>
                              <div className="spTiny">Forecast</div>
                              <div style={{ fontWeight: 900 }}>{money(row.forecast)}</div>
                            </div>
                            <div>
                              <div className="spTiny">Remaining</div>
                              <div style={{ fontWeight: 900 }}>
                                {money(Math.max((row.budget || 0) - row.forecast, 0))}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </article>

              <div className="spColumnStack">
                <article className="spCard">
                  <div className="spCardHead">
                    <div>
                      <h2 className="spSectionMini">Recent Activity</h2>
                      <div className="spSectionText">Latest movement in this period.</div>
                    </div>
                  </div>

                  <div className="spList">
                    {recentActivity.length === 0 ? (
                      <div className="spEmpty">No transactions yet for this period.</div>
                    ) : (
                      recentActivity.map((tx) => {
                        const cat = categoriesById.get(tx.categoryId);
                        const valueClass =
                          tx.type === "income"
                            ? "spValueGood"
                            : tx.type === "expense"
                              ? "spValueBad"
                              : "spValueWarn";

                        return (
                          <div key={tx.id} className="spListItem">
                            <div className="spListHead">
                              <div>
                                <div className="spListTitle">
                                  {tx.merchant || cat?.name || (tx.type === "income" ? "Income" : "Transaction")}
                                </div>
                                <div className="spSectionText">
                                  {shortDate(tx.date)} • {fmtTime(tx.time)} •{" "}
                                  {tx.type === "income" ? "Income" : cat?.name || "Uncategorized"}
                                </div>
                              </div>

                              <div style={{ textAlign: "right" }}>
                                <div className={valueClass}>
                                  {tx.type === "income" ? "+" : tx.type === "expense" ? "-" : ""}
                                  {money(tx.amount)}
                                </div>
                                <div className="spSectionText" style={{ marginTop: 6 }}>
                                  {tx.account || tx.paymentMethod}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </article>

                <article className="spCard">
                  <div className="spCardHead">
                    <div>
                      <h2 className="spSectionMini">Upcoming Planned</h2>
                      <div className="spSectionText">Scheduled spending waiting to hit.</div>
                    </div>
                  </div>

                  <div className="spList">
                    {upcomingItems.length === 0 ? (
                      <div className="spEmpty">No upcoming planned items.</div>
                    ) : (
                      upcomingItems.map((item) => {
                        const cat = categoriesById.get(item.categoryId);
                        return (
                          <div key={item.id} className="spListItem">
                            <div className="spListHead">
                              <div>
                                <div className="spListTitle">{item.merchant || cat?.name || "Planned Expense"}</div>
                                <div className="spSectionText">
                                  {shortDate(item.date)} • {fmtTime(item.time)} • {cat?.name || "Uncategorized"}
                                </div>
                              </div>

                              <div style={{ textAlign: "right" }}>
                                <div className="spValueWarn">{money(item.amount)}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </article>
              </div>
            </section>
          </>
        ) : (
          <section className="spManageGrid">
            <article className="spCard">
              <div className="spCardHead">
                <div>
                  <h2 className="spSectionTitle">Search and Control</h2>
                  <div className="spSectionText">Filter transactions and planned items without the page feeling cramped.</div>
                </div>
              </div>

              <div className="spFilterGrid" style={{ marginBottom: 16 }}>
                <input
                  className="spField"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search transactions or planned items."
                />

                <select className="spSelect" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                  <option value="all">All types</option>
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                  <option value="transfer">Transfer</option>
                </select>

                <select
                  className="spSelect"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="all">All categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.group} • {c.name}
                    </option>
                  ))}
                </select>

                <div className="spChip" style={{ width: "100%" }}>
                  {filteredTransactions.length} TX • {filteredPlanned.length} PLANNED
                </div>
              </div>

              <div className="spSplitList">
                <div className="spInnerCard">
                  <div className="spCardHead" style={{ marginBottom: 12 }}>
                    <div>
                      <h3 className="spSectionMini">Transactions</h3>
                      <div className="spSectionText">Current range results.</div>
                    </div>
                  </div>

                  <div className="spList">
                    {filteredTransactions.length === 0 ? (
                      <div className="spEmpty">No transactions match this filter.</div>
                    ) : (
                      filteredTransactions.map((tx) => {
                        const cat = categoriesById.get(tx.categoryId);
                        const valueClass =
                          tx.type === "income"
                            ? "spValueGood"
                            : tx.type === "expense"
                              ? "spValueBad"
                              : "spValueWarn";

                        return (
                          <div key={tx.id} className="spListItem">
                            <div className="spListHead">
                              <div>
                                <div className="spListTitle">
                                  {tx.merchant || cat?.name || (tx.type === "income" ? "Income" : "Transaction")}
                                </div>
                                <div className="spSectionText">
                                  {shortDate(tx.date)} • {fmtTime(tx.time)} •{" "}
                                  {tx.type === "income" ? "Income" : cat?.name || "Uncategorized"}
                                </div>
                                {tx.note ? (
                                  <div className="spSectionText" style={{ marginTop: 6 }}>
                                    {tx.note}
                                  </div>
                                ) : null}
                              </div>

                              <div style={{ textAlign: "right" }}>
                                <div className={valueClass}>
                                  {tx.type === "income" ? "+" : tx.type === "expense" ? "-" : ""}
                                  {money(tx.amount)}
                                </div>
                                <div className="spSectionText" style={{ marginTop: 6 }}>
                                  {tx.account || tx.paymentMethod}
                                </div>
                              </div>
                            </div>

                            <div className="spActionRow" style={{ marginTop: 12 }}>
                              <button className="spGhostBtn" type="button" onClick={() => duplicateTransaction(tx)}>
                                Duplicate
                              </button>
                              <button className="spDangerBtn" type="button" onClick={() => deleteTransaction(tx.id)}>
                                Delete
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="spInnerCard">
                  <div className="spCardHead" style={{ marginBottom: 12 }}>
                    <div>
                      <h3 className="spSectionMini">Planned Items</h3>
                      <div className="spSectionText">Move them, convert them, or delete them.</div>
                    </div>
                  </div>

                  <div className="spList">
                    {filteredPlanned.length === 0 ? (
                      <div className="spEmpty">No planned items match this filter.</div>
                    ) : (
                      filteredPlanned.map((item) => {
                        const cat = categoriesById.get(item.categoryId);

                        return (
                          <div key={item.id} className="spListItem">
                            <div className="spListHead">
                              <div>
                                <div className="spListTitle">{item.merchant || cat?.name || "Planned Expense"}</div>
                                <div className="spSectionText">
                                  {shortDate(item.date)} • {fmtTime(item.time)} • {cat?.name || "Uncategorized"}
                                </div>
                                {item.note ? (
                                  <div className="spSectionText" style={{ marginTop: 6 }}>
                                    {item.note}
                                  </div>
                                ) : null}
                              </div>

                              <div style={{ textAlign: "right" }}>
                                <div className="spValueWarn">{money(item.amount)}</div>
                              </div>
                            </div>

                            <div className="spActionRow" style={{ marginTop: 12 }}>
                              <button className="spSolidBtn" type="button" onClick={() => convertPlanned(item)}>
                                Convert to Real
                              </button>
                              <button className="spDangerBtn" type="button" onClick={() => deletePlanned(item.id)}>
                                Delete
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </article>

            <div className="spColumnStack">
              <article className="spCard">
                <div className="spCardHead">
                  <div>
                    <h2 className="spSectionMini">Category Control</h2>
                    <div className="spSectionText">Add and clean up categories.</div>
                  </div>
                </div>

                <div className="spQuickGrid2" style={{ marginBottom: 14 }}>
                  <input
                    className="spField"
                    placeholder="New category name"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                  />

                  <select
                    className="spSelect"
                    value={newCategoryGroup}
                    onChange={(e) => setNewCategoryGroup(e.target.value)}
                  >
                    {groups
                      .filter((g) => g !== "All")
                      .map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="spActionRow" style={{ marginBottom: 16 }}>
                  <button className="spSolidBtn" type="button" onClick={addCategory}>
                    Add Category
                  </button>
                </div>

                <div className="spList">
                  {categories.map((cat) => (
                    <div key={cat.id} className="spListItem">
                      <div className="spListHead">
                        <div>
                          <div className="spListTitle">{cat.name}</div>
                          <div className="spSectionText">{cat.group}</div>
                        </div>

                        <div className="spActionRow">
                          <span
                            className="spPillStatus"
                            style={{
                              color: "#f0f5ff",
                              background: `${cat.color}22`,
                              border: `1px solid ${cat.color}44`,
                            }}
                          >
                            {cat.isBudgeted ? "BUDGETED" : "TRACKED"}
                          </span>
                          <button className="spDangerBtn" type="button" onClick={() => deleteCategory(cat.id)}>
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="spCard">
                <div className="spCardHead">
                  <div>
                    <h2 className="spSectionMini">Budget Tune</h2>
                    <div className="spSectionText">
                      Edit {range.budgetMode} budgets without leaving the page.
                    </div>
                  </div>
                  <span className="spChip">{range.budgetMode.toUpperCase()}</span>
                </div>

                <div className="spList">
                  {budgetRows.length === 0 ? (
                    <div className="spEmpty">No budget rows yet.</div>
                  ) : (
                    budgetRows.map((row) => {
                      const tone = statusTone(row.forecastStatus);
                      const progressColor =
                        row.forecastStatus === "Over"
                          ? TONE.red
                          : row.forecastStatus === "Near"
                            ? TONE.amber
                            : TONE.green;

                      const progressPct = row.budget > 0 ? (row.forecast / row.budget) * 100 : 0;

                      return (
                        <div key={row.id} className="spBudgetItem">
                          <div className="spBudgetHead">
                            <div>
                              <div className="spListTitle">{row.name}</div>
                              <div className="spSectionText">
                                {money(row.spent)} spent • {money(row.planned)} planned
                              </div>
                            </div>

                            <span className="spPillStatus" style={tone}>
                              {row.forecastStatus}
                            </span>
                          </div>

                          <ProgressBar value={progressPct} color={progressColor} />

                          <div className="spQuickGrid2" style={{ marginTop: 12 }}>
                            <div>
                              <div className="spTiny">Budget</div>
                              <input
                                className="spField spBudgetInput"
                                defaultValue={row.budget ? String(row.budget) : ""}
                                placeholder="0.00"
                                onBlur={(e) => updateBudget(row.id, e.target.value)}
                              />
                            </div>

                            <div>
                              <div className="spTiny">Forecast</div>
                              <div className="spChip" style={{ width: "100%" }}>
                                {money(row.forecast)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </article>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
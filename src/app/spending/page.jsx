"use client";

import * as React from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

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

const ACCENT = "#22c55e";
const RED = "#ff5d73";
const GREEN = "#4ade80";
const BLUE = "#38bdf8";

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
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
function percentChange(current, previous) {
  const a = Number(current) || 0;
  const b = Number(previous) || 0;
  if (b === 0) return a > 0 ? 100 : 0;
  return ((a - b) / b) * 100;
}
function shortDate(iso) {
  const d = toDate(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function formatTrendLabel(iso, period) {
  const d = toDate(iso);
  if (period === "year") return d.toLocaleDateString(undefined, { month: "short" });
  if (period === "month") return String(d.getDate());
  return d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3);
}
function buildDateKeys(period, start) {
  if (period === "week") {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    });
  }
  if (period === "year") {
    return Array.from({ length: 12 }).map((_, i) => {
      const d = new Date(start.getFullYear(), i, 1);
      return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`;
    });
  }
  const days = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  return Array.from({ length: days }).map((_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), i + 1);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  });
}
function groupTransactionsForTrend(transactions, start, period) {
  const keys = buildDateKeys(period, start);
  const totals = new Map(keys.map((k) => [k, 0]));

  for (const tx of transactions) {
    if (tx.type !== "expense") continue;
    if (period === "year") {
      const d = toDate(tx.date);
      const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`;
      totals.set(key, (totals.get(key) || 0) + (Number(tx.amount) || 0));
    } else {
      totals.set(tx.date, (totals.get(tx.date) || 0) + (Number(tx.amount) || 0));
    }
  }

  return keys.map((key) => ({
    key,
    label: formatTrendLabel(key, period),
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
function budgetStatus(spent, budget) {
  if (!budget || budget <= 0) return "No budget";
  const pct = spent / budget;
  if (pct >= 1) return "Over";
  if (pct >= 0.85) return "Near";
  return "OK";
}
function statusBadge(status) {
  if (status === "Over") return <Badge variant="destructive">Over</Badge>;
  if (status === "Near") return <Badge variant="secondary">Near</Badge>;
  if (status === "No budget") return <Badge variant="outline">No budget</Badge>;
  return <Badge>OK</Badge>;
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
function NativeSelect({ value, onChange, children, className = "", ...rest }) {
  return (
    <select
      value={value}
      onChange={onChange}
      className={
        "w-full h-11 rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40 " +
        className
      }
      {...rest}
    >
      {children}
    </select>
  );
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
    merchant: p.merchant || "",
    note: p.note || "",
    created_at: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function GlassSection({ children, className = "" }) {
  return (
    <div
      className={
        "rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,12,24,.96),rgba(7,11,21,.94))] shadow-[0_24px_60px_rgba(0,0,0,.42)] backdrop-blur-xl " +
        className
      }
    >
      {children}
    </div>
  );
}

function CommandMetricCard({ title, value, sub, accentValue, tone = "green" }) {
  const toneMap = {
    red: { border: "rgba(255,93,115,.18)", glow: "rgba(255,93,115,.18)", accent: RED },
    green: { border: "rgba(74,222,128,.18)", glow: "rgba(74,222,128,.18)", accent: GREEN },
    blue: { border: "rgba(56,189,248,.18)", glow: "rgba(56,189,248,.18)", accent: BLUE },
  };

  const t = toneMap[tone] || toneMap.green;

  return (
    <div
      className="relative overflow-hidden rounded-[24px] border p-5"
      style={{
        borderColor: t.border,
        background: "linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.02))",
        boxShadow: `inset 0 1px 0 rgba(255,255,255,.03), 0 0 28px ${t.glow}`,
      }}
    >
      <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-white/40">{title}</div>
      <div className="text-[26px] font-black leading-none text-white md:text-[32px]">{value}</div>
      <div className="mt-2 flex items-center gap-2 text-sm">
        {accentValue ? (
          <span className="font-black" style={{ color: t.accent }}>
            {accentValue}
          </span>
        ) : null}
        <span className="text-white/52">{sub}</span>
      </div>
    </div>
  );
}

function ProgressBar({ value = 0, color = ACCENT }) {
  const pct = clamp(Number(value) || 0, 0, 100);
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-white/10 shadow-[inset_0_1px_3px_rgba(0,0,0,.25)]">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${color} 0%, rgba(255,255,255,.9) 180%)`,
          boxShadow: `0 0 18px ${color}55, 0 0 28px ${color}33`,
        }}
      />
    </div>
  );
}

function RingGauge({ percent = 0, amount = "$0.00", label = "Category", color = "#22c55e" }) {
  const p = clamp(Number(percent) || 0, 0, 100);
  const angle = (p / 100) * 360;

  return (
    <div className="my-3 flex justify-center">
      <div
        className="relative grid h-[184px] w-[184px] place-items-center rounded-full"
        style={{
          background: `conic-gradient(${color} 0deg, ${color} ${angle}deg, rgba(255,255,255,0.08) ${angle}deg, rgba(255,255,255,0.08) 360deg)`,
          boxShadow: `0 0 30px ${color}22`,
        }}
      >
        <div className="flex h-[140px] w-[140px] flex-col items-center justify-center rounded-full border border-white/10 bg-[radial-gradient(circle_at_50%_35%,rgba(18,26,46,0.98),rgba(6,10,18,0.98))] px-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,.03)]">
          <div className="mb-1 text-[10px] uppercase tracking-[0.24em] text-white/35">{label}</div>
          <div className="text-[26px] font-black leading-none text-white">{p.toFixed(1)}%</div>
          <div className="mt-2 text-sm text-white/60">{amount}</div>
        </div>
      </div>
    </div>
  );
}

function TrendChart({ data, color = RED }) {
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
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${padX + chartW} ${height - padY} L ${padX} ${height - padY} Z`;

  const gridLines = 4;
  const yMarks = Array.from({ length: gridLines + 1 }).map((_, i) => {
    const y = padY + (i / gridLines) * chartH;
    const val = Math.round(max - (i / gridLines) * max);
    return { y, val };
  });

  return (
    <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,.025),rgba(255,255,255,.015))] p-3">
      <div className="relative h-[260px] w-full">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
          <defs>
            <linearGradient id="trendFillSmallHeader" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.38" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
            <filter id="trendGlowSmallHeader">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {yMarks.map((g, i) => (
            <g key={i}>
              <line x1={padX} x2={padX + chartW} y1={g.y} y2={g.y} stroke="rgba(255,255,255,0.08)" strokeDasharray="5 6" />
              <text x={4} y={g.y + 4} fontSize="12" fill="rgba(255,255,255,0.35)">
                {g.val}
              </text>
            </g>
          ))}

          {points.map((p) => (
            <text
              key={`label-${p.key}`}
              x={p.x}
              y={height - 2}
              textAnchor="middle"
              fontSize="12"
              fill="rgba(255,255,255,0.38)"
            >
              {p.label}
            </text>
          ))}

          <path d={areaPath} fill="url(#trendFillSmallHeader)" />
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth="4"
            filter="url(#trendGlowSmallHeader)"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {points.map((p) => (
            <g key={p.key}>
              <circle cx={p.x} cy={p.y} r="4" fill={color} />
              <circle cx={p.x} cy={p.y} r="9" fill={color} fillOpacity="0.12" />
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

export default function SpendingPage() {
  const [user, setUser] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [pageError, setPageError] = React.useState("");

  const [tab, setTab] = React.useState("overview");
  const [period, setPeriod] = React.useState("month");
  const [search, setSearch] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("expense");

  const [categories, setCategories] = React.useState(DEFAULT_CATEGORIES);
  const [budgets, setBudgets] = React.useState(DEFAULT_BUDGETS);
  const [transactions, setTransactions] = React.useState([]);
  const [plannedItems, setPlannedItems] = React.useState([]);

  const [mode, setMode] = React.useState("now");
  const [qaType, setQaType] = React.useState("expense");
  const [qaAmount, setQaAmount] = React.useState("");
  const [qaDate, setQaDate] = React.useState(todayISO());
  const [qaCategoryId, setQaCategoryId] = React.useState("groceries");
  const [qaMerchant, setQaMerchant] = React.useState("");
  const [qaNote, setQaNote] = React.useState("");
  const [qaPayment, setQaPayment] = React.useState("Card");
  const [qaAccount, setQaAccount] = React.useState("Checking");

  const [newCategoryName, setNewCategoryName] = React.useState("");
  const [newCategoryGroup, setNewCategoryGroup] = React.useState("Other");

  const groups = React.useMemo(
    () => ["All", ...Array.from(new Set(categories.map((c) => c.group))).sort((a, b) => a.localeCompare(b))],
    [categories]
  );

  const categoriesById = React.useMemo(() => {
    const map = new Map();
    categories.forEach((c) => map.set(c.id, c));
    return map;
  }, [categories]);

  const range = React.useMemo(() => periodBounds(period), [period]);

  React.useEffect(() => {
    let mounted = true;

    async function loadAll() {
      try {
        if (!supabase) throw new Error("Supabase is not configured.");

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
          supabase.from("spending_categories").select("*").eq("user_id", currentUser.id).order("group_name").order("name"),
          supabase.from("spending_budgets").select("*").eq("user_id", currentUser.id),
          supabase
            .from("spending_transactions")
            .select("*")
            .eq("user_id", currentUser.id)
            .order("tx_date", { ascending: false })
            .order("created_at", { ascending: false }),
          supabase
            .from("spending_planned_items")
            .select("*")
            .eq("user_id", currentUser.id)
            .order("planned_date", { ascending: true })
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
            const modeKey = row.period_mode;
            if (!nextBudgets[modeKey]) continue;
            nextBudgets[modeKey][row.category_id] = Number(row.amount) || 0;
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

  const filteredTransactions = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions
      .filter((t) => inRange(t.date, range.start, range.end))
      .filter((t) => (typeFilter === "all" ? true : t.type === typeFilter))
      .filter((t) => (categoryFilter === "all" ? true : t.categoryId === categoryFilter))
      .filter((t) => {
        if (!q) return true;
        const cat = categoriesById.get(t.categoryId)?.name ?? "";
        return `${t.merchant} ${t.note} ${t.date} ${cat} ${t.amount}`.toLowerCase().includes(q);
      })
      .sort((a, b) => String(b.date).localeCompare(String(a.date)) || (b.createdAt || 0) - (a.createdAt || 0));
  }, [transactions, range.start, range.end, typeFilter, categoryFilter, search, categoriesById]);

  const filteredPlanned = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return plannedItems
      .filter((p) => inRange(p.date, range.start, range.end))
      .filter((p) => (categoryFilter === "all" ? true : p.categoryId === categoryFilter))
      .filter((p) => {
        if (!q) return true;
        const cat = categoriesById.get(p.categoryId)?.name ?? "";
        return `${p.merchant} ${p.note} ${p.date} ${cat} ${p.amount}`.toLowerCase().includes(q);
      })
      .sort((a, b) => String(a.date).localeCompare(String(b.date)) || (a.createdAt || 0) - (b.createdAt || 0));
  }, [plannedItems, range.start, range.end, categoryFilter, search, categoriesById]);

  const previousRange = React.useMemo(() => getPreviousRange(period, range), [period, range]);

  const previousTransactions = React.useMemo(() => {
    return transactions.filter((t) => inRange(t.date, previousRange.start, previousRange.end));
  }, [transactions, previousRange]);

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
      netForecast: income - (expense + plannedExpense),
    };
  }, [filteredTransactions, filteredPlanned]);

  const previousExpense = React.useMemo(() => sumExpenses(previousTransactions), [previousTransactions]);

  const trendData = React.useMemo(() => {
    return groupTransactionsForTrend(filteredTransactions, range.start, period);
  }, [filteredTransactions, range.start, period]);

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
  const safeDays = React.useMemo(() => {
    if (period === "week") return 7;
    if (period === "year") return 12;
    return new Date(range.start.getFullYear(), range.start.getMonth() + 1, 0).getDate();
  }, [period, range.start]);
  const dailyAverage = safeDays > 0 ? totals.expense / safeDays : 0;
  const expenseTrend = trendMeta(totals.expense, previousExpense);

  const priorityCategory = totalsByCategory[0];
  const priorityBudget = priorityCategory
    ? Number(budgets?.[range.budgetMode]?.[priorityCategory.categoryId] ?? 0)
    : 0;
  const priorityPercent = priorityBudget > 0
    ? (priorityCategory.total / priorityBudget) * 100
    : totalBudget > 0
    ? (totals.expense / totalBudget) * 100
    : 0;

  const recentActivity = React.useMemo(() => filteredTransactions.slice(0, 8), [filteredTransactions]);

  const upcomingItems = React.useMemo(() => {
    const now = new Date();
    return plannedItems
      .filter((p) => toDate(p.date) >= new Date(now.getFullYear(), now.getMonth(), now.getDate()))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)) || (a.createdAt || 0) - (b.createdAt || 0))
      .slice(0, 6);
  }, [plannedItems]);

  async function addNow() {
    setPageError("");
    if (!user || !supabase) return;

    const amt = parseMoneyInput(qaAmount);
    if (!Number.isFinite(amt) || amt <= 0) return alert("Enter a valid amount.");
    if (!qaDate) return alert("Date required.");
    if (qaType === "expense" && !qaCategoryId) return alert("Pick a category.");

    const tx = {
      id: uid(),
      type: qaType,
      amount: Math.round(amt * 100) / 100,
      categoryId: qaType === "expense" ? qaCategoryId : qaCategoryId || "",
      date: qaDate,
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

    if (error) {
      setPageError(error.message || "Failed to save transaction.");
      return;
    }

    setTransactions((prev) => [mapTransactionRowToClient(data), ...prev]);
    clearQuickAdd();
  }

  async function addPlanned() {
    setPageError("");
    if (!user || !supabase) return;

    const amt = parseMoneyInput(qaAmount);
    if (!Number.isFinite(amt) || amt <= 0) return alert("Enter a valid amount.");
    if (!qaDate) return alert("Planned date required.");
    if (!qaCategoryId) return alert("Pick a category.");

    const planned = {
      id: uid(),
      amount: Math.round(amt * 100) / 100,
      categoryId: qaCategoryId,
      date: qaDate,
      merchant: qaMerchant.trim(),
      note: qaNote.trim(),
      createdAt: Date.now(),
    };

    const { data, error } = await supabase
      .from("spending_planned_items")
      .insert([mapPlannedClientToRow(planned, user.id)])
      .select()
      .single();

    if (error) {
      setPageError(error.message || "Failed to save planned item.");
      return;
    }

    setPlannedItems((prev) => [mapPlannedRowToClient(data), ...prev]);
    clearQuickAdd();
  }

  function clearQuickAdd() {
    setQaAmount("");
    setQaDate(todayISO());
    setQaMerchant("");
    setQaNote("");
    setQaPayment("Card");
    setQaAccount("Checking");
    setQaType("expense");
    setQaCategoryId("groceries");
    setMode("now");
  }

  async function deleteTransaction(id) {
    if (!user || !supabase) return;
    if (!confirm("Delete this transaction?")) return;

    const previous = transactions;
    setTransactions((prev) => prev.filter((t) => t.id !== id));

    const { error } = await supabase.from("spending_transactions").delete().eq("id", id).eq("user_id", user.id);

    if (error) {
      setTransactions(previous);
      setPageError(error.message || "Failed to delete transaction.");
    }
  }

  async function duplicateTransaction(tx) {
    if (!user || !supabase) return;

    const clone = { ...tx, id: uid(), createdAt: Date.now() };

    const { data, error } = await supabase
      .from("spending_transactions")
      .insert([mapTransactionClientToRow(clone, user.id)])
      .select()
      .single();

    if (error) {
      setPageError(error.message || "Failed to duplicate transaction.");
      return;
    }

    setTransactions((prev) => [mapTransactionRowToClient(data), ...prev]);
  }

  async function deletePlanned(id) {
    if (!user || !supabase) return;
    if (!confirm("Delete this planned item?")) return;

    const previous = plannedItems;
    setPlannedItems((prev) => prev.filter((p) => p.id !== id));

    const { error } = await supabase.from("spending_planned_items").delete().eq("id", id).eq("user_id", user.id);

    if (error) {
      setPlannedItems(previous);
      setPageError(error.message || "Failed to delete planned item.");
    }
  }

  async function convertPlanned(planned) {
    if (!user || !supabase) return;
    if (!confirm("Convert this planned item into a real transaction?")) return;

    const tx = {
      id: uid(),
      type: "expense",
      amount: planned.amount,
      categoryId: planned.categoryId,
      date: planned.date,
      merchant: planned.merchant || "",
      note: planned.note || "",
      paymentMethod: "Card",
      account: "Checking",
      createdAt: Date.now(),
    };

    const [insertTxRes, deletePlannedRes] = await Promise.all([
      supabase.from("spending_transactions").insert([mapTransactionClientToRow(tx, user.id)]).select().single(),
      supabase.from("spending_planned_items").delete().eq("id", planned.id).eq("user_id", user.id),
    ]);

    if (insertTxRes.error) {
      setPageError(insertTxRes.error.message || "Failed to create transaction from planned item.");
      return;
    }
    if (deletePlannedRes.error) {
      setPageError(deletePlannedRes.error.message || "Transaction created, but planned item failed to delete.");
    }

    setTransactions((prev) => [mapTransactionRowToClient(insertTxRes.data), ...prev]);
    setPlannedItems((prev) => prev.filter((p) => p.id !== planned.id));
  }

  async function addCategory() {
    if (!user || !supabase) return;

    const name = newCategoryName.trim();
    const group = newCategoryGroup.trim() || "Other";
    if (!name) return alert("Category name required.");

    const id =
      name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 30) || uid();

    if (categoriesById.get(id)) return alert("Category already exists.");

    const cat = normalizeCategory({ id, name, group, color: "#94a3b8", isBudgeted: true });

    const { data, error } = await supabase
      .from("spending_categories")
      .insert([mapCategoryClientToRow(cat, user.id)])
      .select()
      .single();

    if (error) {
      setPageError(error.message || "Failed to add category.");
      return;
    }

    setCategories((prev) =>
      [...prev, mapCategoryRowToClient(data)].sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name))
    );
    setNewCategoryName("");
    setNewCategoryGroup("Other");
  }

  async function deleteCategory(id) {
    if (!user || !supabase) return;
    if (!confirm("Delete this category? Existing old transactions may show blank category.")) return;

    const previous = categories;
    setCategories((prev) => prev.filter((c) => c.id !== id));

    const { error } = await supabase.from("spending_categories").delete().eq("id", id).eq("user_id", user.id);

    if (error) {
      setCategories(previous);
      setPageError(error.message || "Failed to delete category.");
    }
  }

  async function updateBudget(categoryId, amountStr) {
    if (!user || !supabase) return;

    const amt = parseMoneyInput(amountStr);
    if (!Number.isFinite(amt) || amt < 0) return;

    const modeKey = range.budgetMode;
    setBudgets((prev) => ({
      ...prev,
      [modeKey]: {
        ...(prev[modeKey] || {}),
        [categoryId]: Math.round(amt * 100) / 100,
      },
    }));

    const { error } = await supabase
      .from("spending_budgets")
      .upsert(
        {
          user_id: user.id,
          period_mode: modeKey,
          category_id: categoryId,
          amount: Math.round(amt * 100) / 100,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,period_mode,category_id" }
      );

    if (error) setPageError(error.message || "Failed to save budget.");
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-[1700px] px-4 py-4">
        <GlassSection className="p-5 text-white/70">Loading spending...</GlassSection>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-[1700px] px-4 py-4">
        <GlassSection className="p-5">
          <div className="text-lg font-black text-white">Please log in</div>
          <div className="mt-2 text-sm text-white/60">This page uses Supabase, so you need to be signed in.</div>
        </GlassSection>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1700px] space-y-4 px-4 py-4">
      <GlassSection className="overflow-hidden px-6 py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="mb-1 text-[10px] font-black uppercase tracking-[0.26em] text-sky-300/75">
              Life Command Center
            </div>
            <h1 className="m-0 text-3xl font-bold tracking-tight text-white">
              Spending Control
            </h1>
            <div className="mt-1 text-sm text-white/50">
              Track live spend, watch pressure, and forecast what hits next.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {["week", "month", "year"].map((p) => {
              const active = period === p;
              return (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className="min-h-10 rounded-full px-4 text-sm font-black transition"
                  style={{
                    border: active ? "1px solid rgba(255,255,255,0.16)" : "1px solid rgba(255,255,255,0.08)",
                    background: active
                      ? "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(235,235,235,0.92))"
                      : "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
                    color: active ? "#09111f" : "rgba(255,255,255,0.88)",
                  }}
                >
                  {p[0].toUpperCase() + p.slice(1)}
                </button>
              );
            })}

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="h-11 rounded-full border border-white/10 bg-black/40 p-1">
                <TabsTrigger value="overview" className="rounded-full px-5 text-sm">Overview</TabsTrigger>
                <TabsTrigger value="manage" className="rounded-full px-5 text-sm">Manage</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </GlassSection>

      {pageError ? (
        <GlassSection className="border-red-400/20 p-4">
          <div className="font-black text-white">Database issue</div>
          <div className="mt-1 text-sm text-white/60">{pageError}</div>
        </GlassSection>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <CommandMetricCard
          title="Spent"
          value={money(totals.expense)}
          sub={expenseTrend.text}
          accentValue={expenseTrend.value}
          tone="red"
        />
        <CommandMetricCard
          title="Remaining"
          value={money(Math.max(remaining, 0))}
          sub={remaining < 0 ? "budget exceeded" : `from ${money(totalBudget)} budget`}
          accentValue={remaining < 0 ? money(Math.abs(remaining)) : ""}
          tone="green"
        />
        <CommandMetricCard
          title="Daily Avg"
          value={money(dailyAverage)}
          sub={range.label}
          accentValue={totals.expense > previousExpense ? "↑ active" : "↓ calmer"}
          tone="blue"
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="hidden" />

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(320px,.85fr)]">
            <GlassSection className="p-5">
              <div className="mb-3 flex items-center justify-between gap-4">
                <div>
                  <div className="text-2xl font-black text-white">Spending Trend</div>
                  <div className="mt-1 text-sm text-white/52">
                    Daily spend pattern for {range.label.toLowerCase()}.
                  </div>
                </div>

                <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-white/60">
                  {range.label}
                </div>
              </div>

              <TrendChart data={trendData} color={RED} />
            </GlassSection>

            <GlassSection className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-[0.24em] text-white/40">Priority Category</div>
                  <div className="text-xl font-black text-white">
                    {priorityCategory?.category?.name || "No category yet"}
                  </div>
                </div>

                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-black text-white/70">
                  Top pressure
                </div>
              </div>

              <RingGauge
                percent={priorityPercent}
                amount={money(priorityCategory?.total || 0)}
                label={priorityCategory?.category?.name || "Waiting"}
                color={priorityCategory?.category?.color || "#22c55e"}
              />

              <div className="rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.025))] p-4">
                <div className="mb-2 text-sm text-white/55">Quick read</div>
                <div className="text-sm leading-7 text-white/88">
                  {priorityCategory
                    ? priorityPercent >= 100
                      ? "This category is over budget pressure right now. Pull back here first."
                      : priorityPercent >= 85
                      ? "This category is getting close to the limit. Watch the next few purchases."
                      : "This category is still under control. Pace is acceptable right now."
                    : "Add spending and budgets to generate live pressure insights."}
                </div>
              </div>
            </GlassSection>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,.82fr)]">
            <GlassSection className="p-5">
              <div className="mb-4">
                <div className="text-2xl font-black text-white">Categories</div>
                <div className="mt-1 text-sm text-white/52">Budget pressure by category.</div>
              </div>

              <div className="space-y-3">
                {budgetRows.length === 0 ? (
                  <div className="text-sm text-white/55">No budget rows yet.</div>
                ) : (
                  budgetRows.slice(0, 7).map((r) => {
                    const pct = r.budget > 0 ? clamp((r.forecast / r.budget) * 100, 0, 100) : 0;
                    return (
                      <div key={r.id} className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div
                              className="h-9 w-9 rounded-xl border border-white/10"
                              style={{
                                background: `linear-gradient(180deg, ${r.color}33, rgba(255,255,255,.03))`,
                                boxShadow: `0 0 18px ${r.color}22`,
                              }}
                            />
                            <div className="min-w-0">
                              <div className="truncate text-lg font-black text-white">{r.name}</div>
                              <div className="text-xs text-white/45">{r.group}</div>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-sm font-black text-white">
                              {money(r.spent)} / {money(r.budget)}
                            </div>
                            <div className="mt-1">{statusBadge(r.forecastStatus)}</div>
                          </div>
                        </div>

                        <ProgressBar
                          value={pct}
                          color={pct >= 100 ? "#dc2626" : pct >= 85 ? "#f59e0b" : r.color || ACCENT}
                        />
                      </div>
                    );
                  })
                )}
              </div>
            </GlassSection>

            <GlassSection className="p-5">
              <div className="mb-4">
                <div className="text-2xl font-black text-white">Upcoming Bills</div>
                <div className="mt-1 text-sm text-white/52">Planned items and forecasted outflow.</div>
              </div>

              <div className="space-y-3">
                {upcomingItems.length === 0 ? (
                  <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4 text-sm text-white/55">
                    No upcoming planned items.
                  </div>
                ) : (
                  upcomingItems.map((p) => {
                    const cat = categoriesById.get(p.categoryId);
                    return (
                      <div key={p.id} className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-lg font-black text-white">
                              {p.merchant || cat?.name || "Planned item"}
                            </div>
                            <div className="mt-1 text-sm text-white/50">
                              {shortDate(p.date)} {cat ? `• ${cat.name}` : ""}
                            </div>
                          </div>
                          <div className="text-right text-lg font-black text-white">{money(p.amount)}</div>
                        </div>

                        {p.note ? <div className="mt-2 text-sm text-white/45">{p.note}</div> : null}

                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button size="sm" variant="secondary" onClick={() => convertPlanned(p)}>
                            Convert
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => deletePlanned(p.id)}>
                            Delete
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </GlassSection>
          </div>

          <GlassSection className="p-5">
            <div className="mb-4">
              <div className="text-2xl font-black text-white">Recent Activity</div>
              <div className="mt-1 text-sm text-white/52">Latest spending, income, and transfers.</div>
            </div>

            <div className="space-y-3">
              {recentActivity.length === 0 ? (
                <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4 text-sm text-white/55">
                  No activity in this range.
                </div>
              ) : (
                recentActivity.map((t) => {
                  const cat = categoriesById.get(t.categoryId);
                  const isExpense = t.type === "expense";
                  const amountColor = isExpense ? "#ff6b81" : t.type === "income" ? "#4ade80" : "#7dd3fc";

                  return (
                    <div key={t.id} className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-lg font-black text-white">
                              {t.merchant || cat?.name || "Transaction"}
                            </span>
                            <Badge variant="outline">{t.type}</Badge>
                            {cat ? <Badge variant="secondary">{cat.name}</Badge> : null}
                          </div>
                          <div className="mt-1 text-sm text-white/45">
                            {shortDate(t.date)} • {t.paymentMethod || "—"} / {t.account || "—"}
                            {t.note ? ` • ${t.note}` : ""}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-2xl font-black leading-none" style={{ color: amountColor }}>
                              {isExpense ? "-" : t.type === "income" ? "+" : ""}
                              {money(t.amount)}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="secondary" onClick={() => duplicateTransaction(t)}>
                              Duplicate
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => deleteTransaction(t.id)}>
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </GlassSection>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)]">
            <GlassSection className="p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-black text-white">Quick Add</div>
                  <div className="mt-1 text-sm text-white/55">
                    Use <b>Now</b> for real spending. Use <b>Planned</b> for forecast.
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant={mode === "now" ? "default" : "secondary"} onClick={() => setMode("now")}>Now</Button>
                  <Button variant={mode === "planned" ? "default" : "secondary"} onClick={() => setMode("planned")}>Planned</Button>
                  <Button variant="secondary" onClick={clearQuickAdd}>Clear</Button>
                  <Button onClick={() => (mode === "planned" ? addPlanned() : addNow())}>
                    {mode === "planned" ? "Add Planned" : "Add Transaction"}
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-12">
                <div className="md:col-span-2">
                  <Label className="mb-2 block text-xs text-white/55">Type</Label>
                  <NativeSelect value={qaType} onChange={(e) => setQaType(e.target.value)} disabled={mode === "planned"}>
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                    <option value="transfer">Transfer</option>
                  </NativeSelect>
                </div>

                <div className="md:col-span-2">
                  <Label className="mb-2 block text-xs text-white/55">Amount</Label>
                  <Input
                    className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white placeholder:text-white/35"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={qaAmount}
                    onChange={(e) => setQaAmount(e.target.value)}
                  />
                </div>

                <div className="md:col-span-3">
                  <Label className="mb-2 block text-xs text-white/55">Category</Label>
                  <NativeSelect
                    value={qaCategoryId}
                    onChange={(e) => setQaCategoryId(e.target.value)}
                    disabled={mode === "now" ? qaType !== "expense" : false}
                  >
                    {categories
                      .slice()
                      .sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.group} • {c.name}
                        </option>
                      ))}
                  </NativeSelect>
                </div>

                <div className="md:col-span-2">
                  <Label className="mb-2 block text-xs text-white/55">{mode === "planned" ? "Planned date" : "Date"}</Label>
                  <Input
                    className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white"
                    type="date"
                    value={qaDate}
                    onChange={(e) => setQaDate(e.target.value)}
                  />
                </div>

                <div className="md:col-span-3">
                  <Label className="mb-2 block text-xs text-white/55">Merchant</Label>
                  <Input
                    className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white placeholder:text-white/35"
                    placeholder="optional"
                    value={qaMerchant}
                    onChange={(e) => setQaMerchant(e.target.value)}
                  />
                </div>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-12">
                <div className="md:col-span-6">
                  <Label className="mb-2 block text-xs text-white/55">Note</Label>
                  <Input
                    className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white placeholder:text-white/35"
                    placeholder="optional"
                    value={qaNote}
                    onChange={(e) => setQaNote(e.target.value)}
                  />
                </div>

                <div className="md:col-span-3">
                  <Label className="mb-2 block text-xs text-white/55">Payment</Label>
                  <NativeSelect value={qaPayment} onChange={(e) => setQaPayment(e.target.value)} disabled={mode === "planned"}>
                    <option>Card</option>
                    <option>Cash</option>
                    <option>Debit</option>
                    <option>Credit</option>
                    <option>Apple Pay</option>
                    <option>Google Pay</option>
                  </NativeSelect>
                </div>

                <div className="md:col-span-3">
                  <Label className="mb-2 block text-xs text-white/55">Account</Label>
                  <NativeSelect value={qaAccount} onChange={(e) => setQaAccount(e.target.value)} disabled={mode === "planned"}>
                    <option>Checking</option>
                    <option>Savings</option>
                    <option>Credit Card</option>
                    <option>Business</option>
                  </NativeSelect>
                </div>
              </div>
            </GlassSection>

            <GlassSection className="p-5">
              <div className="mb-4">
                <div className="text-lg font-black text-white">Filters</div>
                <div className="mt-1 text-sm text-white/55">Search transactions, narrow categories, and change the view.</div>
              </div>

              <div className="grid gap-3">
                <div>
                  <Label className="mb-2 block text-xs text-white/55">Search</Label>
                  <Input
                    className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white placeholder:text-white/35"
                    placeholder="Merchant, note, category, amount..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <div>
                  <Label className="mb-2 block text-xs text-white/55">Type</Label>
                  <NativeSelect value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                    <option value="expense">Expenses</option>
                    <option value="income">Income</option>
                    <option value="transfer">Transfers</option>
                    <option value="all">All</option>
                  </NativeSelect>
                </div>

                <div>
                  <Label className="mb-2 block text-xs text-white/55">Category</Label>
                  <NativeSelect value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                    <option value="all">All Categories</option>
                    {groups
                      .filter((g) => g !== "All")
                      .map((group) => {
                        const arr = categories.filter((c) => c.group === group).sort((a, b) => a.name.localeCompare(b.name));
                        return (
                          <optgroup key={group} label={group}>
                            {arr.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </optgroup>
                        );
                      })}
                  </NativeSelect>
                </div>
              </div>
            </GlassSection>
          </div>
        </TabsContent>

        <TabsContent value="manage" className="space-y-4">
          <GlassSection className="p-5">
            <div className="mb-4">
              <div className="text-lg font-black text-white">Manage Budgets</div>
              <div className="mt-1 text-sm text-white/55">Current period mode: <b>{range.budgetMode}</b></div>
            </div>

            <div className="space-y-3">
              {categories
                .slice()
                .sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name))
                .map((c) => (
                  <div key={c.id} className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                    <div className="grid items-center gap-4 md:grid-cols-12">
                      <div className="md:col-span-4">
                        <div className="font-black text-white">{c.name}</div>
                        <div className="text-xs text-white/52">{c.group}</div>
                      </div>

                      <div className="md:col-span-3">
                        <Label className="mb-2 block text-xs text-white/55">Budget</Label>
                        <Input
                          className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white"
                          defaultValue={String(budgets?.[range.budgetMode]?.[c.id] ?? 0)}
                          inputMode="decimal"
                          onBlur={(e) => updateBudget(c.id, e.target.value)}
                        />
                      </div>

                      <div className="md:col-span-2">
                        <div className="text-xs text-white/52">Spent</div>
                        <div className="mt-2 font-black text-white">
                          {money(
                            filteredTransactions
                              .filter((t) => t.type === "expense" && t.categoryId === c.id)
                              .reduce((s, t) => s + (Number(t.amount) || 0), 0)
                          )}
                        </div>
                      </div>

                      <div className="md:col-span-2">
                        <div className="text-xs text-white/52">Planned</div>
                        <div className="mt-2 font-black text-white">
                          {money(
                            filteredPlanned
                              .filter((p) => p.categoryId === c.id)
                              .reduce((s, p) => s + (Number(p.amount) || 0), 0)
                          )}
                        </div>
                      </div>

                      <div className="md:col-span-1 text-right">
                        {statusBadge(
                          budgetStatus(
                            filteredTransactions
                              .filter((t) => t.type === "expense" && t.categoryId === c.id)
                              .reduce((s, t) => s + (Number(t.amount) || 0), 0) +
                              filteredPlanned
                                .filter((p) => p.categoryId === c.id)
                                .reduce((s, p) => s + (Number(p.amount) || 0), 0),
                            Number(budgets?.[range.budgetMode]?.[c.id] ?? 0)
                          )
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </GlassSection>

          <div className="grid gap-4 xl:grid-cols-2">
            <GlassSection className="p-5">
              <div className="mb-4">
                <div className="text-lg font-black text-white">Add Category</div>
                <div className="mt-1 text-sm text-white/55">Keep categories clean and grouped correctly.</div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="mb-2 block text-xs text-white/55">Category name</Label>
                  <Input
                    className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white placeholder:text-white/35"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Car Wash"
                  />
                </div>

                <div>
                  <Label className="mb-2 block text-xs text-white/55">Group</Label>
                  <Input
                    className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white placeholder:text-white/35"
                    value={newCategoryGroup}
                    onChange={(e) => setNewCategoryGroup(e.target.value)}
                    placeholder="Transport"
                  />
                </div>

                <Button onClick={addCategory}>Add Category</Button>
              </div>
            </GlassSection>

            <GlassSection className="p-5">
              <div className="mb-4">
                <div className="text-lg font-black text-white">Current Categories</div>
                <div className="mt-1 text-sm text-white/55">Delete the ones you do not want.</div>
              </div>

              <div className="max-h-[460px] space-y-3 overflow-auto">
                {categories
                  .slice()
                  .sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name))
                  .map((c) => (
                    <div key={c.id} className="flex items-start justify-between gap-3 rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                      <div>
                        <div className="font-black text-white">{c.name}</div>
                        <div className="text-xs text-white/52">{c.group} • {c.id}</div>
                      </div>
                      <Button size="sm" variant="destructive" onClick={() => deleteCategory(c.id)}>
                        Delete
                      </Button>
                    </div>
                  ))}
              </div>
            </GlassSection>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
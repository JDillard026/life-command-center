"use client";

import * as React from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export const dynamic = "force-dynamic";

const LS_KEY = "lcc_spending_v4_shadcn_charts";

/** ---------------- Defaults ---------------- **/
const DEFAULT_CATEGORIES = [
  { id: "groceries", name: "Groceries", group: "Food", color: "#22c55e", isBudgeted: true },
  { id: "eating_out", name: "Eating Out", group: "Food", color: "#10b981", isBudgeted: true },
  { id: "coffee", name: "Coffee", group: "Food", color: "#14b8a6", isBudgeted: true },

  { id: "gas", name: "Gas", group: "Transport", color: "#60a5fa", isBudgeted: true },
  { id: "rideshare", name: "Ride Share", group: "Transport", color: "#3b82f6", isBudgeted: false },
  { id: "parking", name: "Parking/Tolls", group: "Transport", color: "#2563eb", isBudgeted: false },

  { id: "rent_mortgage", name: "Rent/Mortgage", group: "Bills", color: "#a78bfa", isBudgeted: false },
  { id: "utilities", name: "Utilities", group: "Bills", color: "#8b5cf6", isBudgeted: false },
  { id: "phone", name: "Phone", group: "Bills", color: "#7c3aed", isBudgeted: false },
  { id: "internet", name: "Internet", group: "Bills", color: "#6d28d9", isBudgeted: false },
  { id: "insurance", name: "Insurance", group: "Bills", color: "#5b21b6", isBudgeted: false },
  { id: "subscriptions", name: "Subscriptions", group: "Bills", color: "#4c1d95", isBudgeted: true },

  { id: "shopping", name: "Shopping", group: "Lifestyle", color: "#fb7185", isBudgeted: true },
  { id: "entertainment", name: "Entertainment", group: "Lifestyle", color: "#f43f5e", isBudgeted: false },
  { id: "personal", name: "Personal Care", group: "Lifestyle", color: "#e11d48", isBudgeted: false },

  { id: "health", name: "Health/Medical", group: "Health", color: "#f59e0b", isBudgeted: false },
  { id: "fitness", name: "Fitness", group: "Health", color: "#f97316", isBudgeted: false },

  { id: "kids", name: "Kids", group: "Family", color: "#34d399", isBudgeted: false },
  { id: "pets", name: "Pets", group: "Family", color: "#2dd4bf", isBudgeted: false },

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

const DEFAULT_RULES = [
  { id: "r1", enabled: true, field: "either", match: "mcdonald", categoryId: "eating_out" },
  { id: "r2", enabled: true, field: "either", match: "starbucks", categoryId: "coffee" },
  { id: "r3", enabled: true, field: "either", match: "walmart", categoryId: "groceries" },
  { id: "r4", enabled: true, field: "either", match: "shell", categoryId: "gas" },
];

const FALLBACK_COLORS = ["#22c55e", "#06b6d4", "#3b82f6", "#a78bfa", "#f59e0b", "#ef4444", "#14b8a6", "#fb7185"];

/** ---------------- utils ---------------- **/
function safeParse(str, fallback) {
  try {
    if (!str) return fallback;
    const v = JSON.parse(str);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}
function uid() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function pad2(n) {
  return String(n).padStart(2, "0");
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function toDate(iso) {
  return new Date(iso + "T00:00:00");
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
function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}
function withinRange(isoDate, a, b) {
  const d = toDate(isoDate);
  return d.getTime() >= a.getTime() && d.getTime() <= b.getTime();
}
function startOfWeek(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // Monday
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
function isoWeekYearAndNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((Number(d) - Number(yearStart)) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNo };
}
function periodKeyFor(mode, d) {
  if (mode === "weekly") {
    const { year, week } = isoWeekYearAndNumber(d);
    return `${year}-W${pad2(week)}`;
  }
  if (mode === "monthly") return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
  return `${d.getFullYear()}`;
}
function addCadence(iso, cadence) {
  const d = toDate(iso);
  if (cadence === "weekly") d.setDate(d.getDate() + 7);
  else if (cadence === "monthly") d.setMonth(d.getMonth() + 1);
  else d.setFullYear(d.getFullYear() + 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function downloadText(filename, text) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function pill(status) {
  if (status.includes("Over")) return <Badge variant="destructive">Over</Badge>;
  if (status.includes("Near")) return <Badge variant="secondary">Near</Badge>;
  if (status.includes("No budget")) return <Badge variant="outline">No budget</Badge>;
  return <Badge variant="default">OK</Badge>;
}

function NativeSelect({ value, onChange, children, className = "", ...rest }) {
  return (
    <select
      value={value}
      onChange={onChange}
      className={
        "w-full h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring " +
        className
      }
      {...rest}
    >
      {children}
    </select>
  );
}

/** ---------- receipts (client-only compression) ---------- **/
async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

async function compressImageDataUrl(dataUrl, opts = {}) {
  // opts: maxW, maxH, quality(0-1), mime
  const { maxW = 1280, maxH = 1280, quality = 0.72, mime = "image/jpeg" } = opts;

  if (typeof document === "undefined") return dataUrl;

  const img = new Image();
  img.decoding = "async";
  img.src = dataUrl;

  await new Promise((res, rej) => {
    img.onload = () => res(true);
    img.onerror = rej;
  });

  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) return dataUrl;

  const scale = Math.min(1, maxW / w, maxH / h);
  const tw = Math.max(1, Math.round(w * scale));
  const th = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement("canvas");
  canvas.width = tw;
  canvas.height = th;

  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;

  ctx.drawImage(img, 0, 0, tw, th);
  try {
    return canvas.toDataURL(mime, quality);
  } catch {
    return dataUrl;
  }
}

function approxBytesFromDataUrl(dataUrl) {
  // rough estimate: base64 length * 0.75
  const i = dataUrl.indexOf(",");
  const b64 = i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
  return Math.round(b64.length * 0.75);
}

function formatBytes(n) {
  if (!Number.isFinite(n)) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

/** ---------- category suggestion ---------- **/
function normalizeText(s) {
  return String(s ?? "").toLowerCase().trim();
}

function heuristicSuggestCategory(merchant, note) {
  const t = `${normalizeText(merchant)} ${normalizeText(note)}`.trim();

  // quick keyword-based fallback (only used if rules didn't match)
  const rules = [
    { re: /(starbucks|dunkin|coffee|cafe)/, id: "coffee" },
    { re: /(mcdonald|burger king|wendy|taco|chipotle|subway|pizza|restaurant|grill)/, id: "eating_out" },
    { re: /(walmart|publix|target|aldi|kroger|whole foods|grocery|market)/, id: "groceries" },
    { re: /(shell|bp|chevron|exxon|circle k|wawa|7-?eleven|gas)/, id: "gas" },
    { re: /(netflix|hulu|spotify|apple|google one|prime video|subscription)/, id: "subscriptions" },
    { re: /(uber|lyft|rideshare)/, id: "rideshare" },
    { re: /(parking|toll)/, id: "parking" },
    { re: /(doctor|pharmacy|walgreens|cvs|urgent care|hospital)/, id: "health" },
    { re: /(gym|planet fitness|fitness)/, id: "fitness" },
    { re: /(amazon|shopping|mall|store)/, id: "shopping" },
    { re: /(insurance)/, id: "insurance" },
    { re: /(verizon|at&t|t-?mobile|phone)/, id: "phone" },
    { re: /(internet|xfinity|spectrum|comcast)/, id: "internet" },
    { re: /(electric|water|utility|utilities)/, id: "utilities" },
  ];

  for (const r of rules) if (r.re.test(t)) return r.id;
  return "";
}

/** ---------------- Page ---------------- **/
export default function Spending() {
  /** drafts */
  const newRecDraft = React.useRef({ name: "", amount: "", categoryId: "subscriptions", cadence: "monthly", nextDate: todayISO() });
  const newRuleDraft = React.useRef({ field: "either", match: "", categoryId: "misc" });
  const newCatDraft = React.useRef({ name: "", group: "Other" });

  const [state, setState] = React.useState(() => {
    const base = {
      categories: DEFAULT_CATEGORIES,
      budgets: DEFAULT_BUDGETS,
      rules: DEFAULT_RULES,
      recurring: [],
      transactions: [],

      // NEW:
      plannedItems: [], // planned purchases (not yet transactions)

      planned: { weekly: {}, monthly: {}, yearly: {} },
      rollover: { enabled: true, carry: { weekly: {}, monthly: {}, yearly: {} }, finalized: { weekly: {}, monthly: {}, yearly: {} } },

      ui: {
        tab: "overview",
        manageTab: "budgets",
        period: "week",
        customFrom: todayISO(),
        customTo: todayISO(),

        search: "",
        groupFilter: "All",
        categoryFilter: "All",
        typeFilter: "expense",
        sort: "date_desc",

        compact: false,
        showRoutedSections: true,
        onlyBudgetedCategories: true,

        // NEW:
        showReceipts: false,
      },
    };

    if (typeof window === "undefined") return base;
    const saved = safeParse(localStorage.getItem(LS_KEY), base);

    // merge safely (so old saves still work)
    return {
      ...base,
      ...saved,
      ui: { ...base.ui, ...(saved.ui ?? {}) },
      categories: Array.isArray(saved.categories) ? saved.categories : base.categories,
      budgets: saved.budgets ?? base.budgets,
      rules: Array.isArray(saved.rules) ? saved.rules : base.rules,
      recurring: Array.isArray(saved.recurring) ? saved.recurring : base.recurring,
      transactions: Array.isArray(saved.transactions) ? saved.transactions : base.transactions,
      plannedItems: Array.isArray(saved.plannedItems) ? saved.plannedItems : base.plannedItems,
      planned: saved.planned ?? base.planned,
      rollover: saved.rollover ?? base.rollover,
    };
  });

  React.useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch {
      // localStorage full -> receipts most likely; user can delete receipts or export/reset
    }
  }, [state]);

  const categoriesById = React.useMemo(() => {
    const m = new Map();
    state.categories.forEach((c) => m.set(c.id, c));
    return m;
  }, [state.categories]);

  const groups = React.useMemo(() => {
    const set = new Set(state.categories.map((c) => c.group));
    return ["All", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [state.categories]);

  const categoriesByGroup = React.useMemo(() => {
    const by = new Map();
    for (const c of state.categories) {
      if (!by.has(c.group)) by.set(c.group, []);
      by.get(c.group).push(c);
    }
    for (const [g, arr] of by.entries()) arr.sort((a, b) => a.name.localeCompare(b.name));
    return by;
  }, [state.categories]);

  const range = React.useMemo(() => {
    const now = new Date();
    if (state.ui.period === "week") return { a: startOfWeek(now), b: endOfWeek(now), label: "This Week" };
    if (state.ui.period === "month") return { a: startOfMonth(now), b: endOfMonth(now), label: "This Month" };
    if (state.ui.period === "year") return { a: startOfYear(now), b: endOfYear(now), label: "This Year" };
    const a = new Date(state.ui.customFrom + "T00:00:00");
    const b = new Date(state.ui.customTo + "T23:59:59");
    return { a, b, label: "Custom Range" };
  }, [state.ui.period, state.ui.customFrom, state.ui.customTo]);

  const budgetMode = React.useMemo(() => {
    if (state.ui.period === "week") return "weekly";
    if (state.ui.period === "month") return "monthly";
    if (state.ui.period === "year") return "yearly";
    const days = Math.max(1, Math.round((range.b.getTime() - range.a.getTime()) / 86400000) + 1);
    return days <= 10 ? "weekly" : "monthly";
  }, [state.ui.period, range.a, range.b]);

  const currentPeriodKey = React.useMemo(() => periodKeyFor(budgetMode, new Date()), [budgetMode]);
  const budgets = state.budgets?.[budgetMode] ?? {};

  const carryForThisPeriod = React.useMemo(() => {
    if (!state.rollover.enabled) return {};
    return state.rollover.carry?.[budgetMode]?.[currentPeriodKey] ?? {};
  }, [state.rollover, budgetMode, currentPeriodKey]);

  const plannedForPeriod = React.useMemo(() => state.planned?.[budgetMode]?.[currentPeriodKey] ?? {}, [state.planned, budgetMode, currentPeriodKey]);

  const isFinalized = React.useMemo(() => !!state.rollover.finalized?.[budgetMode]?.[currentPeriodKey], [state.rollover, budgetMode, currentPeriodKey]);

  function setUI(patch) {
    setState((s) => ({ ...s, ui: { ...s.ui, ...patch } }));
  }

  /** ---------------- Filters ---------------- **/
  const filteredTx = React.useMemo(() => {
    const search = state.ui.search.trim().toLowerCase();
    let tx = state.transactions.filter((t) => withinRange(t.date, range.a, range.b));

    if (state.ui.typeFilter !== "all") tx = tx.filter((t) => t.type === state.ui.typeFilter);

    if (state.ui.groupFilter !== "All") {
      tx = tx.filter((t) => (categoriesById.get(t.categoryId)?.group ?? "Other") === state.ui.groupFilter);
    }
    if (state.ui.categoryFilter !== "All") tx = tx.filter((t) => t.categoryId === state.ui.categoryFilter);

    if (search) {
      tx = tx.filter((t) => {
        const cat = categoriesById.get(t.categoryId)?.name ?? "";
        const grp = categoriesById.get(t.categoryId)?.group ?? "";
        return (
          String(t.note ?? "").toLowerCase().includes(search) ||
          String(t.merchant ?? "").toLowerCase().includes(search) ||
          String(t.paymentMethod ?? "").toLowerCase().includes(search) ||
          String(t.account ?? "").toLowerCase().includes(search) ||
          cat.toLowerCase().includes(search) ||
          grp.toLowerCase().includes(search) ||
          String(t.amount).includes(search) ||
          String(t.date).includes(search)
        );
      });
    }

    const sort = state.ui.sort;
    const dir = sort.endsWith("_asc") ? 1 : -1;
    if (sort.startsWith("date_")) tx.sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0) * dir);
    else tx.sort((a, b) => (a.amount - b.amount) * dir);

    return tx;
  }, [
    state.transactions,
    state.ui.search,
    state.ui.groupFilter,
    state.ui.categoryFilter,
    state.ui.typeFilter,
    state.ui.sort,
    range.a,
    range.b,
    categoriesById,
  ]);

  const filteredPlanned = React.useMemo(() => {
    // planned items are filtered by "planned date" range too (same filters)
    const search = state.ui.search.trim().toLowerCase();
    let arr = (state.plannedItems ?? []).filter((p) => withinRange(p.date, range.a, range.b));

    if (state.ui.typeFilter !== "all") {
      // planned are only expense-style
      if (state.ui.typeFilter !== "expense") arr = [];
    }

    if (state.ui.groupFilter !== "All") {
      arr = arr.filter((p) => (categoriesById.get(p.categoryId)?.group ?? "Other") === state.ui.groupFilter);
    }
    if (state.ui.categoryFilter !== "All") arr = arr.filter((p) => p.categoryId === state.ui.categoryFilter);

    if (search) {
      arr = arr.filter((p) => {
        const cat = categoriesById.get(p.categoryId)?.name ?? "";
        const grp = categoriesById.get(p.categoryId)?.group ?? "";
        return (
          String(p.note ?? "").toLowerCase().includes(search) ||
          String(p.merchant ?? "").toLowerCase().includes(search) ||
          cat.toLowerCase().includes(search) ||
          grp.toLowerCase().includes(search) ||
          String(p.amount).includes(search) ||
          String(p.date).includes(search)
        );
      });
    }

    // newest first
    arr.sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : (b.createdAt ?? 0) - (a.createdAt ?? 0)));

    return arr;
  }, [state.plannedItems, state.ui.search, state.ui.groupFilter, state.ui.categoryFilter, state.ui.typeFilter, range.a, range.b, categoriesById]);

  /** ---------------- Totals (include planned in forecast) ---------------- **/
  const totals = React.useMemo(() => {
    let expense = 0, income = 0, transfer = 0;
    for (const t of filteredTx) {
      if (t.type === "expense") expense += t.amount;
      else if (t.type === "income") income += t.amount;
      else transfer += t.amount;
    }
    const plannedExpense = filteredPlanned.reduce((s, p) => s + Number(p.amount || 0), 0);
    return {
      expense,
      income,
      transfer,
      plannedExpense,
      net: income - expense,
      netForecast: income - (expense + plannedExpense),
    };
  }, [filteredTx, filteredPlanned]);

  const totalsByCategory = React.useMemo(() => {
    // expense transactions only
    const m = new Map();
    for (const t of filteredTx) {
      if (t.type !== "expense") continue;
      m.set(t.categoryId, (m.get(t.categoryId) ?? 0) + t.amount);
    }
    const arr = Array.from(m.entries()).map(([categoryId, total]) => {
      const c = categoriesById.get(categoryId);
      return { categoryId, name: c?.name ?? "Unknown", group: c?.group ?? "Other", color: c?.color, total };
    });
    arr.sort((a, b) => b.total - a.total);
    return arr;
  }, [filteredTx, categoriesById]);

  const plannedByCategory = React.useMemo(() => {
    const m = new Map();
    for (const p of filteredPlanned) m.set(p.categoryId, (m.get(p.categoryId) ?? 0) + Number(p.amount || 0));
    return m;
  }, [filteredPlanned]);

  const totalsByGroup = React.useMemo(() => {
    const m = new Map();
    for (const t of filteredTx) {
      if (t.type !== "expense") continue;
      const g = categoriesById.get(t.categoryId)?.group ?? "Other";
      m.set(g, (m.get(g) ?? 0) + t.amount);
    }
    const arr = Array.from(m.entries()).map(([group, total]) => ({ group, total }));
    arr.sort((a, b) => b.total - a.total);
    return arr;
  }, [filteredTx, categoriesById]);

  /** ---------------- Budget rows (Spent vs Budget + Planned Forecast) ---------------- **/
  const budgetRows = React.useMemo(() => {
    const spentMap = new Map(totalsByCategory.map((x) => [x.categoryId, x.total]));
    return state.categories
      .map((c) => {
        const spent = spentMap.get(c.id) ?? 0;
        const plannedLocal = Number(plannedByCategory.get(c.id) ?? 0);

        const baseBudget = Number(budgets?.[c.id] ?? 0);
        const carry = Number(carryForThisPeriod?.[c.id] ?? 0);
        const budgetWithCarry = baseBudget + carry;

        const plannedRemaining = Number(plannedForPeriod?.[c.id] ?? 0);

        // forecast = spent + (your "planned remaining") + (planned purchases)
        const forecast = spent + plannedRemaining + plannedLocal;

        const pct = budgetWithCarry > 0 ? spent / budgetWithCarry : 0;
        const status = budgetWithCarry === 0 ? "No budget" : pct >= 1 ? "Over" : pct >= 0.85 ? "Near" : "OK";

        const forecastPct = budgetWithCarry > 0 ? forecast / budgetWithCarry : 0;
        const forecastStatus =
          budgetWithCarry === 0
            ? "No budget"
            : forecastPct >= 1
              ? "Over (forecast)"
              : forecastPct >= 0.85
                ? "Near (forecast)"
                : "OK";

        return {
          ...c,
          spent,
          plannedLocal,
          baseBudget,
          carry,
          budgetWithCarry,
          plannedRemaining,
          forecast,
          pct,
          status,
          forecastPct,
          forecastStatus,
        };
      })
      .filter((r) => (state.ui.onlyBudgetedCategories ? r.isBudgeted || r.baseBudget > 0 || r.spent > 0 || r.plannedLocal > 0 : true))
      .sort((a, b) => (b.forecastPct - a.forecastPct) || (b.forecast - a.forecast) || a.name.localeCompare(b.name));
  }, [state.categories, totalsByCategory, plannedByCategory, budgets, carryForThisPeriod, plannedForPeriod, state.ui.onlyBudgetedCategories]);

  /** ---------------- Charts (spent only; planned shown separately) ---------------- **/
  const chartCategoryShare = React.useMemo(() => {
    const top = totalsByCategory.slice(0, 8);
    const rest = totalsByCategory.slice(8).reduce((s, x) => s + x.total, 0);
    return [
      ...top.map((x) => ({ name: x.name, value: x.total, color: x.color })),
      ...(rest > 0 ? [{ name: "Other", value: rest }] : []),
    ];
  }, [totalsByCategory]);

  const chartDailySpend = React.useMemo(() => {
    const map = new Map();
    for (const t of filteredTx) {
      if (t.type !== "expense") continue;
      map.set(t.date, (map.get(t.date) ?? 0) + t.amount);
    }

    const days = [];
    const cur = new Date(range.a);
    cur.setHours(0, 0, 0, 0);
    const end = new Date(range.b);
    end.setHours(0, 0, 0, 0);

    while (cur.getTime() <= end.getTime()) {
      const iso = `${cur.getFullYear()}-${pad2(cur.getMonth() + 1)}-${pad2(cur.getDate())}`;
      days.push({ date: iso, spend: Math.round((map.get(iso) ?? 0) * 100) / 100 });
      cur.setDate(cur.getDate() + 1);
      if (days.length > 370) break;
    }

    return days.map((d) => ({ label: d.date.slice(5), spend: d.spend }));
  }, [filteredTx, range.a, range.b]);

  /** ---------------- Actions ---------------- **/
  const sectionRefs = React.useRef({});
  function scrollToCategory(cid) {
    const el = sectionRefs.current[cid];
    el?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }

  function exportJSON() {
    downloadText(`spending_export_${todayISO()}.json`, JSON.stringify(state, null, 2));
  }
  function importJSON(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const next = safeParse(String(reader.result), state);
        setState((s) => ({
          ...s,
          ...next,
          ui: { ...(s.ui ?? {}), ...(next.ui ?? {}) },
          categories: Array.isArray(next.categories) ? next.categories : s.categories,
          budgets: next.budgets ?? s.budgets,
          rules: Array.isArray(next.rules) ? next.rules : s.rules,
          recurring: Array.isArray(next.recurring) ? next.recurring : s.recurring,
          transactions: Array.isArray(next.transactions) ? next.transactions : s.transactions,
          plannedItems: Array.isArray(next.plannedItems) ? next.plannedItems : (s.plannedItems ?? []),
          planned: next.planned ?? s.planned,
          rollover: next.rollover ?? s.rollover,
        }));
      } catch {
        alert("Import failed. Use a valid export JSON.");
      }
    };
    reader.readAsText(file);
  }

  function autoPickCategoryFromRules(merchant, note) {
    const m = normalizeText(merchant);
    const n = normalizeText(note);

    for (const r of state.rules ?? []) {
      if (!r.enabled) continue;
      const match = normalizeText(r.match);
      if (!match) continue;

      if (r.field === "merchant" && m.includes(match)) return r.categoryId;
      if (r.field === "note" && n.includes(match)) return r.categoryId;
      if (r.field === "either" && (m.includes(match) || n.includes(match))) return r.categoryId;
    }
    return "";
  }

  function suggestCategory(merchant, note) {
    // priority: enabled rules -> heuristics
    const fromRules = autoPickCategoryFromRules(merchant, note);
    if (fromRules) return { categoryId: fromRules, source: "rule" };
    const fromHeur = heuristicSuggestCategory(merchant, note);
    if (fromHeur) return { categoryId: fromHeur, source: "hint" };
    return { categoryId: "", source: "" };
  }

  function deleteTx(id) {
    if (!confirm("Delete this transaction?")) return;
    setState((s) => ({ ...s, transactions: s.transactions.filter((t) => t.id !== id) }));
  }
  function duplicateTx(tx) {
    setState((s) => ({ ...s, transactions: [{ ...tx, id: uid(), createdAt: Date.now() }, ...s.transactions] }));
  }

  function updateCategoryBudget(categoryId, vStr) {
    const v = parseMoneyInput(vStr);
    if (!Number.isFinite(v) || v < 0) return;
    setState((s) => ({
      ...s,
      budgets: { ...s.budgets, [budgetMode]: { ...(s.budgets?.[budgetMode] ?? {}), [categoryId]: Math.round(v * 100) / 100 } },
    }));
  }
  function updatePlannedRemaining(categoryId, vStr) {
    const v = parseMoneyInput(vStr);
    if (!Number.isFinite(v) || v < 0) return;
    setState((s) => ({
      ...s,
      planned: {
        ...s.planned,
        [budgetMode]: {
          ...(s.planned?.[budgetMode] ?? {}),
          [currentPeriodKey]: { ...((s.planned?.[budgetMode] ?? {})[currentPeriodKey] ?? {}), [categoryId]: Math.round(v * 100) / 100 },
        },
      },
    }));
  }
  function toggleCategoryBudgeted(categoryId) {
    setState((s) => ({
      ...s,
      categories: s.categories.map((c) => (c.id === categoryId ? { ...c, isBudgeted: !c.isBudgeted } : c)),
    }));
  }

  function finalizeCurrentPeriod() {
    if (!state.rollover.enabled) return alert("Rollover is disabled.");
    if (!confirm(`Finalize ${budgetMode} ${currentPeriodKey}? This writes carry into next period.`)) return;

    const spentMap = new Map(totalsByCategory.map((x) => [x.categoryId, x.total]));
    const carryNow = carryForThisPeriod ?? {};

    const nextKey = (() => {
      const d = new Date();
      if (budgetMode === "weekly") d.setDate(d.getDate() + 7);
      else if (budgetMode === "monthly") d.setMonth(d.getMonth() + 1);
      else d.setFullYear(d.getFullYear() + 1);
      return periodKeyFor(budgetMode, d);
    })();

    const nextCarry = {};
    for (const c of state.categories) {
      const baseBudget = Number(budgets?.[c.id] ?? 0);
      const carry = Number(carryNow?.[c.id] ?? 0);
      const budgetWithCarry = baseBudget + carry;
      const spent = Number(spentMap.get(c.id) ?? 0);

      const shouldRollover = c.isBudgeted || baseBudget > 0;
      if (!shouldRollover) continue;

      const leftover = Math.round((budgetWithCarry - spent) * 100) / 100;
      if (leftover !== 0) nextCarry[c.id] = leftover;
    }

    setState((s) => ({
      ...s,
      rollover: {
        ...s.rollover,
        finalized: { ...s.rollover.finalized, [budgetMode]: { ...(s.rollover.finalized?.[budgetMode] ?? {}), [currentPeriodKey]: true } },
        carry: {
          ...s.rollover.carry,
          [budgetMode]: {
            ...(s.rollover.carry?.[budgetMode] ?? {}),
            [nextKey]: { ...(((s.rollover.carry?.[budgetMode] ?? {})[nextKey]) ?? {}), ...nextCarry },
          },
        },
      },
    }));
  }

  function runDueRecurring() {
    const today = todayISO();
    const newTx = [];
    const updated = (state.recurring ?? []).map((r) => {
      if (!r.enabled) return r;
      let next = r.nextDate;
      if (!next) return r;

      while (next <= today) {
        newTx.push({
          id: uid(),
          type: r.type ?? "expense",
          amount: Math.round(Number(r.amount) * 100) / 100,
          categoryId: r.categoryId ?? "",
          date: next,
          merchant: (r.merchant ?? r.name ?? "").trim(),
          note: (r.note ?? "").trim(),
          paymentMethod: (r.paymentMethod ?? "Card").trim(),
          account: (r.account ?? "Checking").trim(),
          createdAt: Date.now(),
          receipts: [],
          meta: { recurringId: r.id, recurringName: r.name },
        });
        next = addCadence(next, r.cadence);
      }
      return { ...r, nextDate: next };
    });

    if (!newTx.length) return alert("No recurring items due today.");
    setState((s) => ({ ...s, recurring: updated, transactions: [...newTx, ...s.transactions] }));
  }

  /** ---------------- Quick Add / Planned Add ---------------- **/
  const amountRef = React.useRef(null);

  const [qaMode, setQaMode] = React.useState("now"); // "now" | "planned"
  const [qaType, setQaType] = React.useState("expense");
  const [qaAmount, setQaAmount] = React.useState("");
  const [qaDate, setQaDate] = React.useState(todayISO());
  const [qaCategoryId, setQaCategoryId] = React.useState("");
  const [qaMerchant, setQaMerchant] = React.useState("");
  const [qaNote, setQaNote] = React.useState("");
  const [qaPayment, setQaPayment] = React.useState("Card");
  const [qaAccount, setQaAccount] = React.useState("Checking");

  const [splitMode, setSplitMode] = React.useState(false);
  const [splitLines, setSplitLines] = React.useState([{ id: uid(), categoryId: "groceries", amountStr: "", note: "" }]);

  // NEW: receipts staged for quick-add
  const [qaReceipts, setQaReceipts] = React.useState([]); // [{id, dataUrl, bytes, createdAt}]

  // NEW: live suggestion
  const suggestion = React.useMemo(() => suggestCategory(qaMerchant, qaNote), [qaMerchant, qaNote, state.rules]);

  React.useEffect(() => {
    // if user hasn't set category and suggestion exists, don't auto-set; just show suggestion UI
  }, [suggestion.categoryId]);

  const splitTotal = React.useMemo(() => {
    if (!splitMode) return 0;
    const nums = splitLines.map((l) => parseMoneyInput(l.amountStr)).filter((n) => Number.isFinite(n) && n > 0);
    return Math.round(nums.reduce((s, x) => s + x, 0) * 100) / 100;
  }, [splitMode, splitLines]);

  function resetQuickAdd() {
    setQaMode("now");
    setQaType("expense");
    setQaAmount("");
    setQaDate(todayISO());
    setQaCategoryId("");
    setQaMerchant("");
    setQaNote("");
    setQaPayment("Card");
    setQaAccount("Checking");
    setSplitMode(false);
    setSplitLines([{ id: uid(), categoryId: "groceries", amountStr: "", note: "" }]);
    setQaReceipts([]);
    setTimeout(() => amountRef.current?.focus?.(), 0);
  }

  async function handleAddReceiptFiles(files) {
    const arr = Array.from(files || []);
    if (!arr.length) return;

    const items = [];
    for (const f of arr) {
      // only images
      if (!String(f.type).startsWith("image/")) continue;

      const raw = await fileToDataUrl(f);
      const compressed = await compressImageDataUrl(raw, { maxW: 1400, maxH: 1400, quality: 0.72, mime: "image/jpeg" });
      const bytes = approxBytesFromDataUrl(compressed);

      items.push({
        id: uid(),
        dataUrl: compressed,
        bytes,
        createdAt: Date.now(),
        name: f.name,
        mime: "image/jpeg",
      });
    }

    if (!items.length) return;

    // hard cap receipts in the quick-add stage to avoid accidental storage blowups
    const next = [...qaReceipts, ...items].slice(0, 8);
    setQaReceipts(next);
  }

  function removeStagedReceipt(id) {
    setQaReceipts((s) => s.filter((r) => r.id !== id));
  }

  function applySuggestion() {
    if (!suggestion.categoryId) return;
    setQaCategoryId(suggestion.categoryId);
  }

  function addPlannedItem() {
    const date = qaDate || todayISO();
    const amt = splitMode ? splitTotal : parseMoneyInput(qaAmount);

    if (!Number.isFinite(amt) || amt <= 0) return alert("Enter a valid amount > 0.");
    if (!qaCategoryId) {
      // if empty, try suggestion
      if (suggestion.categoryId) setQaCategoryId(suggestion.categoryId);
      if (!suggestion.categoryId) return alert("Pick a category for planned purchases.");
    }

    // planned items are always expense-like
    const planned = {
      id: uid(),
      amount: Math.round(Number(amt) * 100) / 100,
      categoryId: qaCategoryId || suggestion.categoryId || "misc",
      date,
      merchant: qaMerchant.trim(),
      note: qaNote.trim(),
      createdAt: Date.now(),
      receipts: qaReceipts,
      status: "planned", // planned | bought | canceled
    };

    setState((s) => ({ ...s, plannedItems: [planned, ...(s.plannedItems ?? [])] }));
    resetQuickAdd();
  }

  function addTransactionNow() {
    const date = qaDate || todayISO();

    if (qaType === "expense" && splitMode) {
      const lines = splitLines
        .map((l) => ({ ...l, amount: parseMoneyInput(l.amountStr) }))
        .filter((l) => Number.isFinite(l.amount) && l.amount > 0 && l.categoryId);

      if (!lines.length) return alert("Split: add at least one line with category + amount.");

      const groupId = uid();
      const txs = lines.map((l) => ({
        id: uid(),
        type: "expense",
        amount: Math.round(l.amount * 100) / 100,
        categoryId: l.categoryId,
        date,
        merchant: qaMerchant.trim(),
        note: (l.note || qaNote).trim(),
        paymentMethod: qaPayment,
        account: qaAccount,
        createdAt: Date.now(),
        receipts: qaReceipts, // same receipts applied to each split line (simple + practical)
        meta: { splitGroupId: groupId },
      }));

      setState((s) => ({ ...s, transactions: [...txs, ...s.transactions] }));
      resetQuickAdd();
      return;
    }

    const amt = parseMoneyInput(qaAmount);
    if (!Number.isFinite(amt) || amt <= 0) return alert("Enter a valid amount > 0.");

    let cid = qaCategoryId;
    if (qaType === "expense" && !cid) {
      cid = suggestion.categoryId || "";
      if (!cid) return alert("Pick a category (or add a rule / use suggestion).");
    }

    const tx = {
      id: uid(),
      type: qaType,
      amount: Math.round(Number(amt) * 100) / 100,
      categoryId: qaType === "expense" ? cid : cid || "",
      date,
      merchant: qaMerchant.trim(),
      note: qaNote.trim(),
      paymentMethod: qaPayment,
      account: qaAccount,
      createdAt: Date.now(),
      receipts: qaReceipts,
    };

    setState((s) => ({ ...s, transactions: [tx, ...s.transactions] }));
    resetQuickAdd();
  }

  function addAction() {
    if (qaMode === "planned") return addPlannedItem();
    return addTransactionNow();
  }

  /** ---------------- Planned items actions ---------------- **/
  function deletePlanned(id) {
    if (!confirm("Delete this planned item?")) return;
    setState((s) => ({ ...s, plannedItems: (s.plannedItems ?? []).filter((p) => p.id !== id) }));
  }

  function convertPlannedToTx(p) {
    if (!confirm("Convert planned item to a transaction (posts it now)?")) return;

    const tx = {
      id: uid(),
      type: "expense",
      amount: Math.round(Number(p.amount) * 100) / 100,
      categoryId: p.categoryId,
      date: p.date || todayISO(),
      merchant: (p.merchant ?? "").trim(),
      note: (p.note ?? "").trim(),
      paymentMethod: "Card",
      account: "Checking",
      createdAt: Date.now(),
      receipts: Array.isArray(p.receipts) ? p.receipts : [],
      meta: { convertedFromPlannedId: p.id },
    };

    setState((s) => ({
      ...s,
      transactions: [tx, ...s.transactions],
      plannedItems: (s.plannedItems ?? []).filter((x) => x.id !== p.id),
    }));
  }

  /** ---------------- Receipt actions for existing tx / planned ---------------- **/
  async function addReceiptsToTransaction(txId, files) {
    const arr = Array.from(files || []);
    if (!arr.length) return;

    const items = [];
    for (const f of arr) {
      if (!String(f.type).startsWith("image/")) continue;
      const raw = await fileToDataUrl(f);
      const compressed = await compressImageDataUrl(raw, { maxW: 1400, maxH: 1400, quality: 0.72, mime: "image/jpeg" });
      items.push({
        id: uid(),
        dataUrl: compressed,
        bytes: approxBytesFromDataUrl(compressed),
        createdAt: Date.now(),
        name: f.name,
        mime: "image/jpeg",
      });
    }

    if (!items.length) return;

    setState((s) => ({
      ...s,
      transactions: s.transactions.map((t) => {
        if (t.id !== txId) return t;
        const cur = Array.isArray(t.receipts) ? t.receipts : [];
        return { ...t, receipts: [...cur, ...items].slice(0, 12) };
      }),
    }));
  }

  function removeReceiptFromTransaction(txId, receiptId) {
    setState((s) => ({
      ...s,
      transactions: s.transactions.map((t) => {
        if (t.id !== txId) return t;
        const cur = Array.isArray(t.receipts) ? t.receipts : [];
        return { ...t, receipts: cur.filter((r) => r.id !== receiptId) };
      }),
    }));
  }

  async function addReceiptsToPlanned(plannedId, files) {
    const arr = Array.from(files || []);
    if (!arr.length) return;

    const items = [];
    for (const f of arr) {
      if (!String(f.type).startsWith("image/")) continue;
      const raw = await fileToDataUrl(f);
      const compressed = await compressImageDataUrl(raw, { maxW: 1400, maxH: 1400, quality: 0.72, mime: "image/jpeg" });
      items.push({
        id: uid(),
        dataUrl: compressed,
        bytes: approxBytesFromDataUrl(compressed),
        createdAt: Date.now(),
        name: f.name,
        mime: "image/jpeg",
      });
    }

    if (!items.length) return;

    setState((s) => ({
      ...s,
      plannedItems: (s.plannedItems ?? []).map((p) => {
        if (p.id !== plannedId) return p;
        const cur = Array.isArray(p.receipts) ? p.receipts : [];
        return { ...p, receipts: [...cur, ...items].slice(0, 12) };
      }),
    }));
  }

  function removeReceiptFromPlanned(plannedId, receiptId) {
    setState((s) => ({
      ...s,
      plannedItems: (s.plannedItems ?? []).map((p) => {
        if (p.id !== plannedId) return p;
        const cur = Array.isArray(p.receipts) ? p.receipts : [];
        return { ...p, receipts: cur.filter((r) => r.id !== receiptId) };
      }),
    }));
  }

  /** ---------------- Manage budgets helpers ---------------- **/
  const carrySum = Object.values(carryForThisPeriod ?? {}).reduce((s, v) => s + Number(v || 0), 0);
  const budgetedTotal = budgetRows.reduce((s, r) => s + (r.baseBudget > 0 ? r.baseBudget : 0), 0);

  /** ---------------- Top buttons ---------------- **/
  const topGroups = totalsByGroup.slice(0, 6);
  const topCats = totalsByCategory.slice(0, 8);

  /** ---------------- Render small receipt UI ---------------- **/
  function ReceiptStrip({ receipts, onRemove }) {
    const list = Array.isArray(receipts) ? receipts : [];
    if (!list.length) return null;
    const totalBytes = list.reduce((s, r) => s + Number(r.bytes || 0), 0);

    return (
      <div className="mt-2 rounded-lg border p-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            Receipts: <b>{list.length}</b> • Stored: <b>{formatBytes(totalBytes)}</b>
          </div>
          <div className="text-xs text-muted-foreground">Tip: localStorage is limited. Delete old receipts if it breaks saving.</div>
        </div>

        <div className="mt-2 grid gap-2 sm:grid-cols-3 md:grid-cols-5">
          {list.map((r) => (
            <div key={r.id} className="relative rounded-md overflow-hidden border bg-muted/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.dataUrl} alt={r.name || "receipt"} className="h-24 w-full object-cover" />
              <div className="p-1 text-[10px] text-muted-foreground truncate">{r.name || "receipt"} • {formatBytes(r.bytes || 0)}</div>
              {onRemove ? (
                <button
                  className="absolute top-1 right-1 rounded-md bg-background/80 px-2 py-1 text-[10px] border hover:bg-background"
                  onClick={() => onRemove(r.id)}
                  type="button"
                >
                  Remove
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    );
  }

  /** ---------------- UI ---------------- **/
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-4">
      {/* Sticky header */}
      <div className="sticky top-0 z-30 -mx-4 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 bg-background/80 border-b">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">Spending</div>
            <div className="text-2xl font-black tracking-tight truncate">Budget Control Center</div>
            <div className="text-sm text-muted-foreground">
              Budgets + rollover + planned purchases + receipts + suggestions.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={state.ui.tab} onValueChange={(v) => setUI({ tab: v })}>
              <TabsList className="h-10">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="manage">Manage</TabsTrigger>
              </TabsList>
            </Tabs>

            <Button variant="secondary" onClick={exportJSON}>Export</Button>

            <Label className="inline-flex items-center">
              <Button variant="secondary" asChild>
                <span>Import</span>
              </Button>
              <input
                className="hidden"
                type="file"
                accept="application/json"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importJSON(f);
                  e.currentTarget.value = "";
                }}
              />
            </Label>

            <Button
              variant="destructive"
              onClick={() => {
                if (!confirm("Reset ALL data (transactions/rules/recurring/plans/rollover/planned items/receipts)?")) return;
                localStorage.removeItem(LS_KEY);
                location.reload();
              }}
            >
              Reset All
            </Button>
          </div>
        </div>
      </div>

      {/* Period + Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Period & Filters</CardTitle>
          <CardDescription>
            {range.label} • {range.a.toLocaleDateString()} → {range.b.toLocaleDateString()} • Budget mode:{" "}
            <b>{budgetMode}</b> • Key: <b>{currentPeriodKey}</b>
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant={state.ui.period === "week" ? "default" : "secondary"} onClick={() => setUI({ period: "week" })}>Week</Button>
            <Button size="sm" variant={state.ui.period === "month" ? "default" : "secondary"} onClick={() => setUI({ period: "month" })}>Month</Button>
            <Button size="sm" variant={state.ui.period === "year" ? "default" : "secondary"} onClick={() => setUI({ period: "year" })}>Year</Button>
            <Button size="sm" variant={state.ui.period === "custom" ? "default" : "secondary"} onClick={() => setUI({ period: "custom" })}>Custom</Button>

            {state.ui.period === "custom" && (
              <div className="flex flex-wrap items-center gap-2">
                <Input type="date" value={state.ui.customFrom} onChange={(e) => setUI({ customFrom: e.target.value })} className="w-[150px]" />
                <span className="text-xs text-muted-foreground">to</span>
                <Input type="date" value={state.ui.customTo} onChange={(e) => setUI({ customTo: e.target.value })} className="w-[150px]" />
              </div>
            )}
          </div>

          <div className="grid gap-2 md:grid-cols-12">
            <div className="md:col-span-4">
              <Label className="text-xs text-muted-foreground">Search</Label>
              <Input
                placeholder="Merchant, note, category, amount, date..."
                value={state.ui.search}
                onChange={(e) => setUI({ search: e.target.value })}
              />
            </div>

            <div className="md:col-span-2">
              <Label className="text-xs text-muted-foreground">Type</Label>
              <NativeSelect value={state.ui.typeFilter} onChange={(e) => setUI({ typeFilter: e.target.value })}>
                <option value="expense">Expenses</option>
                <option value="income">Income</option>
                <option value="transfer">Transfers</option>
                <option value="all">All</option>
              </NativeSelect>
            </div>

            <div className="md:col-span-2">
              <Label className="text-xs text-muted-foreground">Group</Label>
              <NativeSelect value={state.ui.groupFilter} onChange={(e) => setUI({ groupFilter: e.target.value, categoryFilter: "All" })}>
                {groups.map((g) => (
                  <option key={g} value={g}>{g === "All" ? "All Groups" : g}</option>
                ))}
              </NativeSelect>
            </div>

            <div className="md:col-span-2">
              <Label className="text-xs text-muted-foreground">Category</Label>
              <NativeSelect value={state.ui.categoryFilter} onChange={(e) => setUI({ categoryFilter: e.target.value })}>
                <option value="All">All Categories</option>
                {Array.from(categoriesByGroup.entries()).map(([g, arr]) => (
                  <optgroup key={g} label={g}>
                    {arr.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </optgroup>
                ))}
              </NativeSelect>
            </div>

            <div className="md:col-span-2">
              <Label className="text-xs text-muted-foreground">Sort</Label>
              <NativeSelect value={state.ui.sort} onChange={(e) => setUI({ sort: e.target.value })}>
                <option value="date_desc">Newest</option>
                <option value="date_asc">Oldest</option>
                <option value="amount_desc">Amount (High)</option>
                <option value="amount_asc">Amount (Low)</option>
              </NativeSelect>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={state.ui.compact} onCheckedChange={(v) => setUI({ compact: v })} />
                <span className="text-sm">Compact</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={state.ui.showRoutedSections} onCheckedChange={(v) => setUI({ showRoutedSections: v })} />
                <span className="text-sm">Category sections</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={state.ui.onlyBudgetedCategories} onCheckedChange={(v) => setUI({ onlyBudgetedCategories: v })} />
                <span className="text-sm">Budgeted only</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={state.ui.showReceipts} onCheckedChange={(v) => setUI({ showReceipts: v })} />
                <span className="text-sm">Show receipts</span>
              </div>
            </div>

            {(topGroups.length || topCats.length) ? (
              <div className="flex flex-wrap gap-2 items-center">
                {topGroups.slice(0, 3).map((g) => (
                  <Button key={g.group} size="sm" variant="secondary" onClick={() => setUI({ groupFilter: g.group, categoryFilter: "All" })}>
                    {g.group}: {money(g.total)}
                  </Button>
                ))}
                {topCats.slice(0, 3).map((c) => (
                  <Button key={c.categoryId} size="sm" variant="secondary" onClick={() => scrollToCategory(c.categoryId)}>
                    {c.name}: {money(c.total)}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* KPI row */}
      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Expenses (spent)</CardDescription>
            <CardTitle className="text-2xl font-black">{money(totals.expense)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {filteredTx.filter((t) => t.type === "expense").length} tx
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Planned (forecast)</CardDescription>
            <CardTitle className="text-2xl font-black">{money(totals.plannedExpense)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {filteredPlanned.length} planned items
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Net (actual)</CardDescription>
            <CardTitle className="text-2xl font-black">{money(totals.net)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Income - spent</CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Net (forecast)</CardDescription>
            <CardTitle className="text-lg font-black">{money(totals.netForecast)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Budget total: {money(budgetedTotal)} • Carry: {money(carrySum)} • Finalized: {isFinalized ? "YES" : "NO"}
          </CardContent>
        </Card>
      </div>

      {/* Quick Add */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Quick Add</CardTitle>
              <CardDescription>
                Use <b>Now</b> for real transactions. Use <b>Planned</b> to forecast without posting.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant={qaMode === "now" ? "default" : "secondary"} onClick={() => setQaMode("now")}>Now</Button>
              <Button variant={qaMode === "planned" ? "default" : "secondary"} onClick={() => setQaMode("planned")}>Planned</Button>

              <Button variant="secondary" onClick={() => setSplitMode((v) => !v)}>
                Split: {splitMode ? "ON" : "OFF"}
              </Button>
              <Button variant="secondary" onClick={runDueRecurring}>Run Due</Button>
              <Button variant="secondary" onClick={resetQuickAdd}>Clear</Button>
              <Button onClick={addAction}>{qaMode === "planned" ? "Add Planned" : "Add"}</Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-12">
            <div className="md:col-span-2">
              <Label className="text-xs text-muted-foreground">Type</Label>
              <NativeSelect value={qaType} onChange={(e) => setQaType(e.target.value)} disabled={qaMode === "planned"}>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
                <option value="transfer">Transfer</option>
              </NativeSelect>
              {qaMode === "planned" ? (
                <div className="text-[11px] text-muted-foreground mt-1">Planned items are expense-only.</div>
              ) : null}
            </div>

            <div className="md:col-span-2">
              <Label className="text-xs text-muted-foreground">{splitMode && (qaMode === "planned" || qaType === "expense") ? "Split total" : "Amount"}</Label>
              {(splitMode && (qaMode === "planned" || qaType === "expense")) ? (
                <Input value={money(splitTotal)} readOnly />
              ) : (
                <Input
                  ref={amountRef}
                  inputMode="decimal"
                  placeholder="0.00"
                  value={qaAmount}
                  onChange={(e) => setQaAmount(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addAction();
                  }}
                />
              )}
            </div>

            <div className="md:col-span-3">
              <Label className="text-xs text-muted-foreground">Category</Label>
              <NativeSelect
                value={qaCategoryId}
                onChange={(e) => setQaCategoryId(e.target.value)}
                disabled={qaMode === "now" ? (qaType !== "expense") : false}
              >
                <option value="">{qaMode === "planned" ? "Category required..." : (qaType === "expense" ? "Category (or suggestion)..." : "Category (optional)...")}</option>
                {Array.from(categoriesByGroup.entries()).map(([g, arr]) => (
                  <optgroup key={g} label={g}>
                    {arr.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </optgroup>
                ))}
              </NativeSelect>

              {/* suggestion pill */}
              {suggestion.categoryId && qaMode !== "now" ? null : (
                suggestion.categoryId && (qaType === "expense") ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant={suggestion.source === "rule" ? "default" : "secondary"}>
                      Suggest: {categoriesById.get(suggestion.categoryId)?.name ?? suggestion.categoryId}
                    </Badge>
                    <Button size="sm" variant="secondary" onClick={applySuggestion}>Apply</Button>
                    <span className="text-[11px] text-muted-foreground">
                      {suggestion.source === "rule" ? "Matched your rule." : "Keyword hint."}
                    </span>
                  </div>
                ) : null
              )}
              {suggestion.categoryId && qaMode === "planned" ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant={suggestion.source === "rule" ? "default" : "secondary"}>
                    Suggest: {categoriesById.get(suggestion.categoryId)?.name ?? suggestion.categoryId}
                  </Badge>
                  <Button size="sm" variant="secondary" onClick={applySuggestion}>Apply</Button>
                  <span className="text-[11px] text-muted-foreground">
                    {suggestion.source === "rule" ? "Matched your rule." : "Keyword hint."}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="md:col-span-2">
              <Label className="text-xs text-muted-foreground">{qaMode === "planned" ? "Planned date" : "Date"}</Label>
              <Input type="date" value={qaDate} onChange={(e) => setQaDate(e.target.value)} />
            </div>

            <div className="md:col-span-3">
              <Label className="text-xs text-muted-foreground">Merchant</Label>
              <Input placeholder="(optional)" value={qaMerchant} onChange={(e) => setQaMerchant(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-12">
            <div className="md:col-span-5">
              <Label className="text-xs text-muted-foreground">Note</Label>
              <Input placeholder="(optional)" value={qaNote} onChange={(e) => setQaNote(e.target.value)} />
            </div>

            <div className="md:col-span-2">
              <Label className="text-xs text-muted-foreground">Payment</Label>
              <NativeSelect value={qaPayment} onChange={(e) => setQaPayment(e.target.value)} disabled={qaMode === "planned"}>
                <option>Card</option><option>Cash</option><option>Debit</option><option>Credit</option>
                <option>Apple Pay</option><option>Google Pay</option><option>Zelle</option><option>Venmo</option>
              </NativeSelect>
            </div>

            <div className="md:col-span-2">
              <Label className="text-xs text-muted-foreground">Account</Label>
              <NativeSelect value={qaAccount} onChange={(e) => setQaAccount(e.target.value)} disabled={qaMode === "planned"}>
                <option>Checking</option><option>Savings</option><option>Credit Card</option><option>Business</option>
              </NativeSelect>
            </div>

            <div className="md:col-span-3 flex items-end gap-2">
              <Label className="w-full inline-flex items-center justify-between rounded-md border bg-background px-3 h-10 text-sm cursor-pointer">
                <span>Add receipts</span>
                <input
                  className="hidden"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    const files = e.target.files;
                    handleAddReceiptFiles(files);
                    e.currentTarget.value = "";
                  }}
                />
              </Label>
            </div>
          </div>

          {/* staged receipts */}
          {qaReceipts.length ? (
            <div className="rounded-xl border p-3">
              <div className="text-sm font-black">Staged receipts</div>
              <ReceiptStrip receipts={qaReceipts} onRemove={removeStagedReceipt} />
            </div>
          ) : null}

          {/* split editor */}
          {splitMode && (qaMode === "planned" || qaType === "expense") ? (
            <div className="rounded-xl border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-black">Split lines</div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setSplitLines((s) => [...s, { id: uid(), categoryId: "misc", amountStr: "", note: "" }])}
                >
                  Add line
                </Button>
              </div>

              <div className="space-y-2">
                {splitLines.map((l) => (
                  <div key={l.id} className="grid gap-2 md:grid-cols-12 items-center">
                    <div className="md:col-span-4">
                      <NativeSelect
                        value={l.categoryId}
                        onChange={(e) => setSplitLines((s) => s.map((x) => (x.id === l.id ? { ...x, categoryId: e.target.value } : x)))}
                      >
                        <option value="">Category...</option>
                        {Array.from(categoriesByGroup.entries()).map(([g, arr]) => (
                          <optgroup key={g} label={g}>
                            {arr.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </optgroup>
                        ))}
                      </NativeSelect>
                    </div>
                    <div className="md:col-span-2">
                      <Input
                        placeholder="Amount"
                        inputMode="decimal"
                        value={l.amountStr}
                        onChange={(e) => setSplitLines((s) => s.map((x) => (x.id === l.id ? { ...x, amountStr: e.target.value } : x)))}
                      />
                    </div>
                    <div className="md:col-span-5">
                      <Input
                        placeholder="Line note (optional)"
                        value={l.note}
                        onChange={(e) => setSplitLines((s) => s.map((x) => (x.id === l.id ? { ...x, note: e.target.value } : x)))}
                      />
                    </div>
                    <div className="md:col-span-1 flex justify-end">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setSplitLines((s) => (s.length <= 1 ? s : s.filter((x) => x.id !== l.id)))}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-xs text-muted-foreground">
                Split applies to <b>Now Expense</b> and <b>Planned</b>. Planned split will add as one planned item with total.
              </div>
            </div>
          ) : null}

          {/* one-tap */}
          {(qaMode === "now" && qaType === "expense" && !splitMode) ? (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-muted-foreground">One-tap:</span>
              {["groceries", "eating_out", "coffee", "gas", "shopping", "subscriptions", "misc"].map((id) => {
                const c = categoriesById.get(id);
                if (!c) return null;
                const active = qaCategoryId === id;
                return (
                  <Button key={id} size="sm" variant={active ? "default" : "secondary"} onClick={() => setQaCategoryId(id)}>
                    {c.name}
                  </Button>
                );
              })}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Planned purchases list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Planned Purchases</CardTitle>
          <CardDescription>
            These affect forecast but are not real transactions until converted.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-2">
          {filteredPlanned.length === 0 ? (
            <div className="text-sm text-muted-foreground">No planned items in this range.</div>
          ) : (
            filteredPlanned.map((p) => {
              const cat = categoriesById.get(p.categoryId);
              return (
                <div key={p.id} className="rounded-xl border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted-foreground">{p.date}</span>
                        <span className="font-black">{cat?.name ?? "—"}</span>
                        <Badge variant="outline">{cat?.group ?? "Other"}</Badge>
                        <Badge variant="secondary">Planned</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {p.merchant ? <b>{p.merchant}</b> : "—"} {p.note ? <>• {p.note}</> : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-black">{money(p.amount)}</div>
                      <Button size="sm" variant="secondary" onClick={() => convertPlannedToTx(p)}>Convert</Button>
                      <Button size="sm" variant="destructive" onClick={() => deletePlanned(p.id)}>Delete</Button>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Label className="inline-flex items-center">
                      <Button size="sm" variant="secondary" asChild>
                        <span>Add receipts</span>
                      </Button>
                      <input
                        className="hidden"
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => {
                          const files = e.target.files;
                          addReceiptsToPlanned(p.id, files);
                          e.currentTarget.value = "";
                        }}
                      />
                    </Label>
                  </div>

                  {state.ui.showReceipts ? (
                    <ReceiptStrip
                      receipts={p.receipts}
                      onRemove={(rid) => removeReceiptFromPlanned(p.id, rid)}
                    />
                  ) : null}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Tabs content */}
      <Tabs value={state.ui.tab} onValueChange={(v) => setUI({ tab: v })}>
        <TabsList className="hidden" />

        <TabsContent value="overview" className="space-y-4">
          {/* Charts */}
          <div className="grid gap-3 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Category share (spent)</CardTitle>
                <CardDescription>Transactions only (planned shown in forecast cards).</CardDescription>
              </CardHeader>
              <CardContent className="h-[320px]">
                {chartCategoryShare.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={chartCategoryShare} dataKey="value" nameKey="name" innerRadius={70} outerRadius={110} paddingAngle={2}>
                        {chartCategoryShare.map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={entry.color ?? FALLBACK_COLORS[idx % FALLBACK_COLORS.length]} />
                        ))}
                      </Pie>
                      <ReTooltip formatter={(v) => money(Number(v))} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-sm text-muted-foreground">No expense data in this range.</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Daily spend (spent)</CardTitle>
                <CardDescription>Transactions only.</CardDescription>
              </CardHeader>
              <CardContent className="h-[320px]">
                {chartDailySpend.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartDailySpend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis />
                      <ReTooltip formatter={(v) => money(Number(v))} />
                      <Legend />
                      <Bar dataKey="spend" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-sm text-muted-foreground">No expense data in this range.</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Budgets summary */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap justify-between items-start gap-2">
                <div>
                  <CardTitle className="text-base">Budgets ({budgetMode})</CardTitle>
                  <CardDescription>Spent vs budget+carry, plus forecast (planned remaining + planned purchases).</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => setState((s) => ({ ...s, rollover: { ...s.rollover, enabled: !s.rollover.enabled } }))}>
                    Rollover: {state.rollover.enabled ? "ON" : "OFF"}
                  </Button>
                  <Button variant="secondary" onClick={finalizeCurrentPeriod}>Finalize</Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-2">
              {budgetRows.length ? (
                budgetRows.slice(0, 12).map((r) => (
                  <div key={r.id} className="rounded-xl border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-black">{r.name}</div>
                          {pill(r.status)}
                          <span className="text-xs text-muted-foreground">{r.group}</span>
                          {r.plannedLocal > 0 ? <Badge variant="secondary">Planned {money(r.plannedLocal)}</Badge> : null}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Spent {money(r.spent)} / {money(r.budgetWithCarry)} • Planned remaining {money(r.plannedRemaining)} • Forecast {money(r.forecast)} ({r.forecastStatus})
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="secondary" onClick={() => scrollToCategory(r.id)}>View</Button>
                      </div>
                    </div>

                    <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-foreground/25" style={{ width: `${Math.round(clamp01(r.forecastPct) * 100)}%` }} />
                    </div>

                    <div className="mt-1 text-xs text-muted-foreground">
                      Used (spent) {r.budgetWithCarry > 0 ? `${Math.round(r.pct * 100)}%` : "—"} • Forecast {r.budgetWithCarry > 0 ? `${Math.round(r.forecastPct * 100)}%` : "—"} • Carry {money(r.carry)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">No budget rows to show yet.</div>
              )}
              {budgetRows.length > 12 ? (
                <div className="text-xs text-muted-foreground">Showing top 12. Manage → Budgets for full controls.</div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Manage */}
        <TabsContent value="manage" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Manage</CardTitle>
              <CardDescription>Budgets, recurring, rules, categories.</CardDescription>
            </CardHeader>

            <CardContent>
              <Tabs value={state.ui.manageTab} onValueChange={(v) => setUI({ manageTab: v })}>
                <TabsList className="flex flex-wrap">
                  <TabsTrigger value="budgets">Budgets</TabsTrigger>
                  <TabsTrigger value="recurring">Recurring</TabsTrigger>
                  <TabsTrigger value="rules">Rules</TabsTrigger>
                  <TabsTrigger value="categories">Categories</TabsTrigger>
                </TabsList>

                {/* Budgets */}
                <TabsContent value="budgets" className="pt-3 space-y-3">
                  <div className="flex flex-wrap gap-2 items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Mode: <b>{budgetMode}</b> • Key: <b>{currentPeriodKey}</b> • Finalized: <b>{isFinalized ? "YES" : "NO"}</b>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" onClick={() => setState((s) => ({ ...s, rollover: { ...s.rollover, enabled: !s.rollover.enabled } }))}>
                        Rollover: {state.rollover.enabled ? "ON" : "OFF"}
                      </Button>
                      <Button variant="secondary" onClick={finalizeCurrentPeriod}>Finalize Period</Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {budgetRows.map((r) => (
                      <div key={r.id} className="rounded-xl border p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="font-black">{r.name}</div>
                              {pill(r.status)}
                              <span className="text-xs text-muted-foreground">{r.group}</span>
                              {r.plannedLocal > 0 ? <Badge variant="secondary">Planned {money(r.plannedLocal)}</Badge> : null}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Spent {money(r.spent)} / Budget+Carry {money(r.budgetWithCarry)} • Base {money(r.baseBudget)} • Carry {money(r.carry)}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Planned remaining {money(r.plannedRemaining)} • Forecast {money(r.forecast)} ({r.forecastStatus})
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-2">
                              <Checkbox checked={!!r.isBudgeted} onCheckedChange={() => toggleCategoryBudgeted(r.id)} id={`bud-${r.id}`} />
                              <Label htmlFor={`bud-${r.id}`} className="text-sm">Budgeted</Label>
                            </div>

                            <div className="w-[140px]">
                              <Label className="text-xs text-muted-foreground">Base budget</Label>
                              <Input defaultValue={String(r.baseBudget ?? 0)} inputMode="decimal" onBlur={(e) => updateCategoryBudget(r.id, e.target.value)} />
                            </div>

                            <div className="w-[170px]">
                              <Label className="text-xs text-muted-foreground">Planned remaining</Label>
                              <Input defaultValue={String(r.plannedRemaining ?? 0)} inputMode="decimal" onBlur={(e) => updatePlannedRemaining(r.id, e.target.value)} />
                            </div>

                            <Button size="sm" variant="secondary" onClick={() => scrollToCategory(r.id)}>View</Button>
                          </div>
                        </div>

                        <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-foreground/25" style={{ width: `${Math.round(clamp01(r.forecastPct) * 100)}%` }} />
                        </div>

                        <div className="mt-1 text-xs text-muted-foreground">
                          Used (spent) {r.budgetWithCarry > 0 ? `${Math.round(r.pct * 100)}%` : "—"} • Forecast{" "}
                          {r.budgetWithCarry > 0 ? `${Math.round(r.forecastPct * 100)}%` : "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                {/* Recurring */}
                <TabsContent value="recurring" className="pt-3 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm text-muted-foreground">
                      Recurring items don’t post until you click <b>Run Due</b>.
                    </div>
                    <Button variant="secondary" onClick={runDueRecurring}>Run Due</Button>
                  </div>

                  <div className="rounded-xl border p-3 space-y-2">
                    <div className="font-black">Add recurring</div>
                    <div className="grid gap-2 md:grid-cols-12 items-end">
                      <div className="md:col-span-3">
                        <Label className="text-xs text-muted-foreground">Name</Label>
                        <Input placeholder="Netflix" onChange={(e) => (newRecDraft.current.name = e.target.value)} />
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-xs text-muted-foreground">Amount</Label>
                        <Input placeholder="0.00" inputMode="decimal" onChange={(e) => (newRecDraft.current.amount = e.target.value)} />
                      </div>
                      <div className="md:col-span-3">
                        <Label className="text-xs text-muted-foreground">Category</Label>
                        <NativeSelect defaultValue="subscriptions" onChange={(e) => (newRecDraft.current.categoryId = e.target.value)}>
                          {Array.from(categoriesByGroup.entries()).map(([g, arr]) => (
                            <optgroup key={g} label={g}>
                              {arr.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </optgroup>
                          ))}
                        </NativeSelect>
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-xs text-muted-foreground">Cadence</Label>
                        <NativeSelect defaultValue="monthly" onChange={(e) => (newRecDraft.current.cadence = e.target.value)}>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                          <option value="yearly">Yearly</option>
                        </NativeSelect>
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-xs text-muted-foreground">Next date</Label>
                        <Input type="date" defaultValue={todayISO()} onChange={(e) => (newRecDraft.current.nextDate = e.target.value)} />
                      </div>
                      <div className="md:col-span-12">
                        <Button
                          onClick={() => {
                            const name = (newRecDraft.current.name ?? "").trim();
                            const amt = parseMoneyInput(newRecDraft.current.amount ?? "");
                            const categoryId = newRecDraft.current.categoryId ?? "subscriptions";
                            const cadence = newRecDraft.current.cadence ?? "monthly";
                            const nextDate = newRecDraft.current.nextDate ?? todayISO();

                            if (!name) return alert("Recurring name required.");
                            if (!Number.isFinite(amt) || amt <= 0) return alert("Recurring amount required.");

                            const rec = {
                              id: uid(),
                              enabled: true,
                              name,
                              amount: Math.round(amt * 100) / 100,
                              type: "expense",
                              categoryId,
                              cadence,
                              nextDate,
                              merchant: name,
                              note: "",
                              paymentMethod: "Card",
                              account: "Checking",
                            };
                            setState((s) => ({ ...s, recurring: [rec, ...s.recurring] }));
                            alert("Recurring added.");
                          }}
                        >
                          Add recurring
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {(state.recurring ?? []).length === 0 ? (
                      <div className="text-sm text-muted-foreground">No recurring items yet.</div>
                    ) : (
                      state.recurring.map((r) => (
                        <div key={r.id} className="rounded-xl border p-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="font-black">{r.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {money(r.amount)} • {categoriesById.get(r.categoryId)?.name ?? "—"} • {r.cadence} • next: {r.nextDate} •{" "}
                                {r.enabled ? "enabled" : "disabled"}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant="secondary" onClick={() => setState((s) => ({ ...s, recurring: s.recurring.map((x) => (x.id === r.id ? { ...x, enabled: !x.enabled } : x)) }))}>
                                {r.enabled ? "Disable" : "Enable"}
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => {
                                if (!confirm("Delete recurring item?")) return;
                                setState((s) => ({ ...s, recurring: s.recurring.filter((x) => x.id !== r.id) }));
                              }}>
                                Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>

                {/* Rules */}
                <TabsContent value="rules" className="pt-3 space-y-3">
                  <div className="rounded-xl border p-3 space-y-2">
                    <div className="font-black">Add rule</div>
                    <div className="grid gap-2 md:grid-cols-12 items-end">
                      <div className="md:col-span-3">
                        <Label className="text-xs text-muted-foreground">Field</Label>
                        <NativeSelect defaultValue="either" onChange={(e) => (newRuleDraft.current.field = e.target.value)}>
                          <option value="either">Merchant OR Note</option>
                          <option value="merchant">Merchant only</option>
                          <option value="note">Note only</option>
                        </NativeSelect>
                      </div>
                      <div className="md:col-span-4">
                        <Label className="text-xs text-muted-foreground">Match text (contains)</Label>
                        <Input placeholder="starbucks" onChange={(e) => (newRuleDraft.current.match = e.target.value)} />
                      </div>
                      <div className="md:col-span-5">
                        <Label className="text-xs text-muted-foreground">Category</Label>
                        <NativeSelect defaultValue="misc" onChange={(e) => (newRuleDraft.current.categoryId = e.target.value)}>
                          {Array.from(categoriesByGroup.entries()).map(([g, arr]) => (
                            <optgroup key={g} label={g}>
                              {arr.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </optgroup>
                          ))}
                        </NativeSelect>
                      </div>
                      <div className="md:col-span-12">
                        <Button
                          onClick={() => {
                            const match = (newRuleDraft.current.match ?? "").trim();
                            if (!match) return alert("Rule match text required.");
                            const rule = {
                              id: uid(),
                              enabled: true,
                              field: (newRuleDraft.current.field ?? "either"),
                              match,
                              categoryId: newRuleDraft.current.categoryId ?? "misc",
                            };
                            setState((s) => ({ ...s, rules: [rule, ...(s.rules ?? [])] }));
                            alert("Rule added.");
                          }}
                        >
                          Add rule
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {(state.rules ?? []).length === 0 ? (
                      <div className="text-sm text-muted-foreground">No rules yet.</div>
                    ) : (
                      state.rules.map((r) => (
                        <div key={r.id} className="rounded-xl border p-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="font-black">
                                {r.enabled ? "✅" : "⛔"} If {r.field} contains “{r.match}” → {categoriesById.get(r.categoryId)?.name ?? "—"}
                              </div>
                              <div className="text-xs text-muted-foreground">Suggestion + auto-fill use these rules.</div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant="secondary" onClick={() => setState((s) => ({ ...s, rules: s.rules.map((x) => (x.id === r.id ? { ...x, enabled: !x.enabled } : x)) }))}>
                                {r.enabled ? "Disable" : "Enable"}
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => {
                                if (!confirm("Delete rule?")) return;
                                setState((s) => ({ ...s, rules: s.rules.filter((x) => x.id !== r.id) }));
                              }}>
                                Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>

                {/* Categories */}
                <TabsContent value="categories" className="pt-3 space-y-3">
                  <div className="rounded-xl border p-3 space-y-2">
                    <div className="font-black">Add category</div>
                    <div className="grid gap-2 md:grid-cols-12 items-end">
                      <div className="md:col-span-5">
                        <Label className="text-xs text-muted-foreground">Name</Label>
                        <Input placeholder="Car Wash" onChange={(e) => (newCatDraft.current.name = e.target.value)} />
                      </div>
                      <div className="md:col-span-5">
                        <Label className="text-xs text-muted-foreground">Group</Label>
                        <Input placeholder="Transport" onChange={(e) => (newCatDraft.current.group = e.target.value)} />
                      </div>
                      <div className="md:col-span-12">
                        <Button
                          onClick={() => {
                            const name = (newCatDraft.current.name ?? "").trim();
                            const group = ((newCatDraft.current.group ?? "") || "Other").trim();
                            if (!name) return alert("Category name required.");

                            const id =
                              name
                                .toLowerCase()
                                .replace(/[^a-z0-9]+/g, "_")
                                .replace(/^_+|_+$/g, "")
                                .slice(0, 30) || uid();

                            if (categoriesById.get(id)) return alert("Category ID already exists. Rename it slightly.");

                            const c = {
                              id,
                              name,
                              group,
                              isBudgeted: true,
                              color: FALLBACK_COLORS[state.categories.length % FALLBACK_COLORS.length],
                            };
                            setState((s) => ({ ...s, categories: [...s.categories, c] }));
                            alert("Category added.");
                          }}
                        >
                          Add category
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {state.categories.map((c) => (
                      <div key={c.id} className="rounded-xl border p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="font-black">{c.name}</div>
                            <div className="text-xs text-muted-foreground">id: {c.id} • group: {c.group}</div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="secondary" onClick={() => scrollToCategory(c.id)}>View</Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                if (!confirm("Delete category? (Existing tx keep old categoryId and may show as Unknown)")) return;
                                setState((s) => ({ ...s, categories: s.categories.filter((x) => x.id !== c.id) }));
                              }}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Category drilldown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Spending by Category</CardTitle>
          <CardDescription>Collapsible sections (shows spent tx, planned shown as badge + forecast).</CardDescription>
        </CardHeader>

        <CardContent>
          {!state.ui.showRoutedSections ? (
            <div className="text-sm text-muted-foreground">Hidden.</div>
          ) : (
            <div className="space-y-3">
              {state.categories.map((c) => {
                const categoryTx = filteredTx.filter((t) => t.type === "expense" && t.categoryId === c.id);
                const categoryTotal = categoryTx.reduce((s, t) => s + t.amount, 0);
                const plannedLocal = Number(plannedByCategory.get(c.id) ?? 0);

                const baseBudget = Number(budgets?.[c.id] ?? 0);
                const carry = Number(carryForThisPeriod?.[c.id] ?? 0);
                const budgetWithCarry = baseBudget + carry;
                const pct = budgetWithCarry > 0 ? categoryTotal / budgetWithCarry : 0;
                const forecastPct = budgetWithCarry > 0 ? (categoryTotal + plannedLocal) / budgetWithCarry : 0;

                const isFilteredToThis = state.ui.categoryFilter === c.id;
                const shouldShow =
                  isFilteredToThis ||
                  categoryTx.length > 0 ||
                  plannedLocal > 0 ||
                  (baseBudget > 0 && (state.ui.groupFilter === "All" || state.ui.groupFilter === c.group));

                if (!shouldShow) return null;
                if (state.ui.groupFilter !== "All" && state.ui.groupFilter !== c.group && !isFilteredToThis) return null;

                const cap = state.ui.compact ? 6 : 12;

                return (
                  <div
                    key={c.id}
                    ref={(el) => { sectionRefs.current[c.id] = el; }}
                    className="rounded-2xl border overflow-hidden"
                  >
                    <details open={isFilteredToThis}>
                      <summary className="cursor-pointer select-none p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-muted/40">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-lg font-black">{c.name}</div>
                            <Badge variant="outline">{c.group}</Badge>
                            {budgetWithCarry > 0 ? (
                              <Badge variant={forecastPct >= 1 ? "destructive" : forecastPct >= 0.85 ? "secondary" : "default"}>
                                Forecast {Math.round(forecastPct * 100)}%
                              </Badge>
                            ) : (
                              <Badge variant="outline">No budget</Badge>
                            )}
                            {plannedLocal > 0 ? <Badge variant="secondary">Planned {money(plannedLocal)}</Badge> : null}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            Spent: <b>{money(categoryTotal)}</b>
                            {budgetWithCarry > 0 ? (
                              <>
                                {" "}• Budget+Carry: <b>{money(budgetWithCarry)}</b> (Base {money(baseBudget)} + Carry {money(carry)})
                                {" "}• Remaining (spent): <b>{money(Math.max(0, budgetWithCarry - categoryTotal))}</b>
                              </>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="secondary" onClick={(e) => { e.preventDefault(); setUI({ categoryFilter: c.id }); }}>
                            Filter
                          </Button>
                          <Button size="sm" variant="secondary" onClick={(e) => { e.preventDefault(); setUI({ categoryFilter: "All", groupFilter: "All" }); }}>
                            Clear
                          </Button>
                        </div>
                      </summary>

                      <div className="px-4 pb-4">
                        {budgetWithCarry > 0 ? (
                          <div className="mt-2 space-y-2">
                            <div className="text-xs text-muted-foreground">Spent progress</div>
                            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                              <div className="h-full bg-foreground/25" style={{ width: `${Math.round(clamp01(pct) * 100)}%` }} />
                            </div>

                            <div className="text-xs text-muted-foreground mt-2">Forecast progress (spent + planned)</div>
                            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                              <div className="h-full bg-foreground/40" style={{ width: `${Math.round(clamp01(forecastPct) * 100)}%` }} />
                            </div>
                          </div>
                        ) : null}

                        <div className="mt-3 space-y-2">
                          {categoryTx.length === 0 ? (
                            <div className="text-sm text-muted-foreground">No spent transactions in this category for this period.</div>
                          ) : (
                            categoryTx.slice(0, cap).map((t) => (
                              <div key={t.id} className="rounded-xl border p-3">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="text-xs text-muted-foreground">{t.date}</span>
                                      <span className="font-bold">{t.merchant || "—"}</span>
                                      <span className="text-xs text-muted-foreground">
                                        • {(t.paymentMethod || "—")} / {(t.account || "—")}
                                      </span>
                                      {t.meta?.recurringName ? <Badge variant="outline">Recurring</Badge> : null}
                                      {t.meta?.splitGroupId ? <Badge variant="outline">Split</Badge> : null}
                                      {Array.isArray(t.receipts) && t.receipts.length ? <Badge variant="secondary">Receipts {t.receipts.length}</Badge> : null}
                                    </div>
                                    {t.note ? <div className="text-xs text-muted-foreground mt-1">{t.note}</div> : null}
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <div className="font-black">{money(t.amount)}</div>
                                    <Button size="sm" variant="secondary" onClick={() => duplicateTx(t)}>Duplicate</Button>
                                    <Button size="sm" variant="destructive" onClick={() => deleteTx(t.id)}>Delete</Button>
                                  </div>
                                </div>

                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <Label className="inline-flex items-center">
                                    <Button size="sm" variant="secondary" asChild>
                                      <span>Add receipts</span>
                                    </Button>
                                    <input
                                      className="hidden"
                                      type="file"
                                      accept="image/*"
                                      multiple
                                      onChange={(e) => {
                                        addReceiptsToTransaction(t.id, e.target.files);
                                        e.currentTarget.value = "";
                                      }}
                                    />
                                  </Label>
                                </div>

                                {state.ui.showReceipts ? (
                                  <ReceiptStrip receipts={t.receipts} onRemove={(rid) => removeReceiptFromTransaction(t.id, rid)} />
                                ) : null}
                              </div>
                            ))
                          )}

                          {categoryTx.length > cap ? (
                            <div className="text-xs text-muted-foreground">
                              Showing top {cap}. Use filters/search to narrow.
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </details>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* All transactions */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">All Transactions (Filtered)</CardTitle>
              <CardDescription>Master list for the selected range and filters.</CardDescription>
            </div>
            <Button
              variant="destructive"
              onClick={() => {
                if (!confirm("Delete ALL transactions only? (Keeps categories/budgets/rules/recurring/planned items)")) return;
                setState((s) => ({ ...s, transactions: [] }));
              }}
            >
              Reset Transactions
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {filteredTx.length === 0 ? (
            <div className="text-sm text-muted-foreground">No transactions for this range.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="p-3">Date</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Group</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Merchant</th>
                    <th className="p-3">Pay/Acct</th>
                    <th className="p-3">Note</th>
                    <th className="p-3">Receipts</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTx.map((t) => {
                    const cat = categoriesById.get(t.categoryId);
                    const group = cat?.group ?? (t.type === "expense" ? "Other" : "—");
                    const receiptCount = Array.isArray(t.receipts) ? t.receipts.length : 0;
                    return (
                      <tr key={t.id} className="border-t">
                        <td className="p-3 whitespace-nowrap">{t.date}</td>
                        <td className="p-3 whitespace-nowrap">{t.type}</td>
                        <td className="p-3 whitespace-nowrap">{group}</td>
                        <td className="p-3 whitespace-nowrap">{cat?.name ?? "—"}</td>
                        <td className="p-3 whitespace-nowrap">{t.merchant || "—"}</td>
                        <td className="p-3 whitespace-nowrap text-muted-foreground">
                          {(t.paymentMethod || "—")} / {(t.account || "—")}
                        </td>
                        <td className="p-3 min-w-[220px] text-muted-foreground">{t.note || "—"}</td>
                        <td className="p-3 whitespace-nowrap">
                          {receiptCount ? <Badge variant="secondary">{receiptCount}</Badge> : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="p-3 text-right font-black whitespace-nowrap">{money(t.amount)}</td>
                        <td className="p-3 text-right whitespace-nowrap">
                          <Button size="sm" variant="secondary" className="mr-2" onClick={() => duplicateTx(t)}>
                            Duplicate
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => deleteTx(t.id)}>
                            Delete
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
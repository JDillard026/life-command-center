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
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
function pad2(n) {
  return String(n).padStart(2, "0");
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
function pillForStatus(status) {
  if (status.includes("Over")) return <Badge variant="destructive">Over</Badge>;
  if (status.includes("Near")) return <Badge variant="secondary">Near</Badge>;
  if (status.includes("No budget")) return <Badge variant="outline">No budget</Badge>;
  return <Badge variant="default">OK</Badge>;
}

export default function Spending() {
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
      },
    };

    if (typeof window === "undefined") return base;

    const saved = safeParse(localStorage.getItem(LS_KEY), base);
    return {
      ...base,
      ...saved,
      ui: { ...base.ui, ...(saved.ui ?? {}) },
      categories: Array.isArray(saved.categories) ? saved.categories : base.categories,
      budgets: saved.budgets ?? base.budgets,
      rules: Array.isArray(saved.rules) ? saved.rules : base.rules,
      recurring: Array.isArray(saved.recurring) ? saved.recurring : base.recurring,
      transactions: Array.isArray(saved.transactions) ? saved.transactions : base.transactions,
      planned: saved.planned ?? base.planned,
      rollover: saved.rollover ?? base.rollover,
    };
  });

  React.useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch {}
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

  const plannedForPeriod = React.useMemo(() => {
    return state.planned?.[budgetMode]?.[currentPeriodKey] ?? {};
  }, [state.planned, budgetMode, currentPeriodKey]);

  const isFinalized = React.useMemo(() => {
    return !!state.rollover.finalized?.[budgetMode]?.[currentPeriodKey];
  }, [state.rollover, budgetMode, currentPeriodKey]);

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

  const totals = React.useMemo(() => {
    let expense = 0, income = 0, transfer = 0;
    for (const t of filteredTx) {
      if (t.type === "expense") expense += t.amount;
      else if (t.type === "income") income += t.amount;
      else transfer += t.amount;
    }
    return { expense, income, transfer, net: income - expense };
  }, [filteredTx]);

  const totalsByCategory = React.useMemo(() => {
    const m = new Map();
    for (const t of filteredTx) {
      if (t.type !== "expense") continue;
      m.set(t.categoryId, (m.get(t.categoryId) ?? 0) + t.amount);
    }
    const arr = Array.from(m.entries()).map(([categoryId, total]) => {
      const c = categoriesById.get(categoryId);
      return {
        categoryId,
        name: c?.name ?? "Unknown",
        group: c?.group ?? "Other",
        color: c?.color,
        total,
      };
    });
    arr.sort((a, b) => b.total - a.total);
    return arr;
  }, [filteredTx, categoriesById]);

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

  const budgetRows = React.useMemo(() => {
    const spentMap = new Map(totalsByCategory.map((x) => [x.categoryId, x.total]));
    return state.categories
      .map((c) => {
        const spent = spentMap.get(c.id) ?? 0;
        const baseBudget = Number(budgets?.[c.id] ?? 0);
        const carry = Number(carryForThisPeriod?.[c.id] ?? 0);
        const budgetWithCarry = baseBudget + carry;

        const plannedRemaining = Number(plannedForPeriod?.[c.id] ?? 0);
        const forecast = spent + plannedRemaining;

        const pct = budgetWithCarry > 0 ? spent / budgetWithCarry : 0;
        const status = budgetWithCarry === 0 ? "No budget" : pct >= 1 ? "Over" : pct >= 0.85 ? "Near" : "OK";

        const forecastPct = budgetWithCarry > 0 ? forecast / budgetWithCarry : 0;
        const forecastStatus =
          budgetWithCarry === 0 ? "No budget" : forecastPct >= 1 ? "Over (forecast)" : forecastPct >= 0.85 ? "Near (forecast)" : "OK";

        return { ...c, spent, baseBudget, carry, budgetWithCarry, plannedRemaining, forecast, pct, status, forecastPct, forecastStatus };
      })
      .filter((r) => (state.ui.onlyBudgetedCategories ? r.isBudgeted || r.baseBudget > 0 || r.spent > 0 : true))
      .sort((a, b) => (b.pct - a.pct) || (b.spent - a.spent) || a.name.localeCompare(b.name));
  }, [state.categories, totalsByCategory, budgets, carryForThisPeriod, plannedForPeriod, state.ui.onlyBudgetedCategories]);

  const chartCategoryShare = React.useMemo(() => {
    const top = totalsByCategory.slice(0, 8);
    const rest = totalsByCategory.slice(8).reduce((s, x) => s + x.total, 0);
    const data = [
      ...top.map((x) => ({ name: x.name, value: x.total, color: x.color })),
      ...(rest > 0 ? [{ name: "Other", value: rest }] : []),
    ];
    return data;
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

  const sectionRefs = React.useRef({});
  const amountRef = React.useRef(null);

  function setUI(patch) {
    setState((s) => ({ ...s, ui: { ...s.ui, ...patch } }));
  }

  // Quick add state
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

  function autoPickCategory(merchant, note) {
    const m = (merchant ?? "").toLowerCase();
    const n = (note ?? "").toLowerCase();
    for (const r of state.rules ?? []) {
      if (!r.enabled) continue;
      const match = String(r.match ?? "").trim().toLowerCase();
      if (!match) continue;
      if (r.field === "merchant" && m.includes(match)) return r.categoryId;
      if (r.field === "note" && n.includes(match)) return r.categoryId;
      if (r.field === "either" && (m.includes(match) || n.includes(match))) return r.categoryId;
    }
    return "";
  }

  function resetQuickAdd() {
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
    setTimeout(() => amountRef.current?.focus?.(), 0);
  }

  const splitTotal = React.useMemo(() => {
    if (!splitMode) return 0;
    const nums = splitLines
      .map((l) => parseMoneyInput(l.amountStr))
      .filter((n) => Number.isFinite(n) && n > 0);
    return Math.round(nums.reduce((s, x) => s + x, 0) * 100) / 100;
  }, [splitMode, splitLines]);

  function addTransaction() {
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
      cid = autoPickCategory(qaMerchant, qaNote);
      if (!cid) return alert("Pick a category (or add a rule so it auto-categorizes).");
    }

    const tx = {
      id: uid(),
      type: qaType,
      amount: Math.round(amt * 100) / 100,
      categoryId: qaType === "expense" ? cid : cid || "",
      date,
      merchant: qaMerchant.trim(),
      note: qaNote.trim(),
      paymentMethod: qaPayment,
      account: qaAccount,
      createdAt: Date.now(),
    };

    setState((s) => ({ ...s, transactions: [tx, ...s.transactions] }));
    resetQuickAdd();
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
          meta: { recurringId: r.id, recurringName: r.name },
        });
        next = addCadence(next, r.cadence);
      }
      return { ...r, nextDate: next };
    });

    if (!newTx.length) return alert("No recurring items due today.");
    setState((s) => ({ ...s, recurring: updated, transactions: [...newTx, ...s.transactions] }));
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
          planned: next.planned ?? s.planned,
          rollover: next.rollover ?? s.rollover,
        }));
      } catch {
        alert("Import failed. Use a valid export JSON.");
      }
    };
    reader.readAsText(file);
  }

  function scrollToCategory(cid) {
    const el = sectionRefs.current[cid];
    el?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }

  const topGroups = totalsByGroup.slice(0, 6);
  const topCats = totalsByCategory.slice(0, 8);

  const carrySum = Object.values(carryForThisPeriod ?? {}).reduce((s, v) => s + Number(v || 0), 0);
  const budgetedTotal = budgetRows.reduce((s, r) => s + (r.baseBudget > 0 ? r.baseBudget : 0), 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Spending</div>
          <div className="text-2xl font-black tracking-tight">Budget Control Center</div>
          <div className="text-sm text-muted-foreground">
            Dashboard + charts. Category budgets + rollover + forecast + rules + recurring + splits.
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant={state.ui.tab === "overview" ? "default" : "secondary"} onClick={() => setUI({ tab: "overview" })}>
            Overview
          </Button>
          <Button variant={state.ui.tab === "manage" ? "default" : "secondary"} onClick={() => setUI({ tab: "manage" })}>
            Manage
          </Button>

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
              if (!confirm("Reset ALL data (transactions/rules/recurring/plans/rollover)?")) return;
              localStorage.removeItem(LS_KEY);
              location.reload();
            }}
          >
            Reset All
          </Button>
        </div>
      </div>

      {/* Period + Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Period & Filters</CardTitle>
          <CardDescription>
            {range.label} • {range.a.toLocaleDateString()} → {range.b.toLocaleDateString()} • Budget mode: <b>{budgetMode}</b> • Key: <b>{currentPeriodKey}</b>
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

          <div className="grid gap-2 md:grid-cols-5">
            <div className="md:col-span-2">
              <Label className="text-xs text-muted-foreground">Search</Label>
              <Input
                placeholder="Merchant, note, category, amount, date..."
                value={state.ui.search}
                onChange={(e) => setUI({ search: e.target.value })}
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Type</Label>
              <select
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                value={state.ui.typeFilter}
                onChange={(e) => setUI({ typeFilter: e.target.value })}
              >
                <option value="expense">Expenses</option>
                <option value="income">Income</option>
                <option value="transfer">Transfers</option>
                <option value="all">All</option>
              </select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Group</Label>
              <select
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                value={state.ui.groupFilter}
                onChange={(e) => setUI({ groupFilter: e.target.value, categoryFilter: "All" })}
              >
                {groups.map((g) => (
                  <option key={g} value={g}>{g === "All" ? "All Groups" : g}</option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Sort</Label>
              <select
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                value={state.ui.sort}
                onChange={(e) => setUI({ sort: e.target.value })}
              >
                <option value="date_desc">Newest</option>
                <option value="date_asc">Oldest</option>
                <option value="amount_desc">Amount (High)</option>
                <option value="amount_asc">Amount (Low)</option>
              </select>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <Label className="text-xs text-muted-foreground">Category</Label>
              <select
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                value={state.ui.categoryFilter}
                onChange={(e) => setUI({ categoryFilter: e.target.value })}
              >
                <option value="All">All Categories</option>
                {Array.from(categoriesByGroup.entries()).map(([g, arr]) => (
                  <optgroup key={g} label={g}>
                    {arr.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="flex items-end justify-between gap-3">
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
            </div>
          </div>

          {(topGroups.length || topCats.length) ? (
            <>
              <Separator />
              <div className="flex flex-wrap gap-2 items-center">
                {topGroups.length ? (
                  <>
                    <span className="text-xs text-muted-foreground mr-1">Top groups:</span>
                    {topGroups.map((g) => (
                      <Button key={g.group} size="sm" variant="secondary" onClick={() => setUI({ groupFilter: g.group, categoryFilter: "All" })}>
                        {g.group} ({money(g.total)})
                      </Button>
                    ))}
                  </>
                ) : null}

                {topCats.length ? (
                  <>
                    <span className="text-xs text-muted-foreground ml-2 mr-1">Top categories:</span>
                    {topCats.map((c) => (
                      <Button key={c.categoryId} size="sm" variant="secondary" onClick={() => scrollToCategory(c.categoryId)}>
                        {c.name} ({money(c.total)})
                      </Button>
                    ))}
                  </>
                ) : null}
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* KPI row */}
      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Expenses</CardDescription>
            <CardTitle className="text-2xl font-black">{money(totals.expense)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {filteredTx.filter((t) => t.type === "expense").length} tx
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Income</CardDescription>
            <CardTitle className="text-2xl font-black">{money(totals.income)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {filteredTx.filter((t) => t.type === "income").length} tx
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Net</CardDescription>
            <CardTitle className="text-2xl font-black">{money(totals.net)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Income - expenses</CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Budget snapshot ({budgetMode})</CardDescription>
            <CardTitle className="text-lg font-black">{money(budgetedTotal)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Carry: {money(carrySum)} • Finalized: {isFinalized ? "YES" : "NO"}
          </CardContent>
        </Card>
      </div>

      {/* Quick Add */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Quick Add</CardTitle>
              <CardDescription>Leave category blank on an expense and rules will try to auto-categorize.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setSplitMode((v) => !v)}>
                Split: {splitMode ? "ON" : "OFF"}
              </Button>
              <Button variant="secondary" onClick={runDueRecurring}>Run Due Recurring</Button>
              <Button variant="secondary" onClick={resetQuickAdd}>Clear</Button>
              <Button onClick={addTransaction}>Add</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-6">
            <div>
              <Label className="text-xs text-muted-foreground">Type</Label>
              <select
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                value={qaType}
                onChange={(e) => setQaType(e.target.value)}
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
                <option value="transfer">Transfer</option>
              </select>
            </div>

            {!splitMode ? (
              <div>
                <Label className="text-xs text-muted-foreground">Amount</Label>
                <Input
                  ref={amountRef}
                  inputMode="decimal"
                  placeholder="0.00"
                  value={qaAmount}
                  onChange={(e) => setQaAmount(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addTransaction(); }}
                />
              </div>
            ) : (
              <div>
                <Label className="text-xs text-muted-foreground">Split Total</Label>
                <Input value={money(splitTotal)} readOnly />
              </div>
            )}

            <div className="md:col-span-2">
              <Label className="text-xs text-muted-foreground">Category</Label>
              <select
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                value={qaCategoryId}
                onChange={(e) => setQaCategoryId(e.target.value)}
                disabled={qaType !== "expense"}
                title={qaType !== "expense" ? "Category optional for income/transfers." : ""}
              >
                <option value="">{qaType === "expense" ? "Category (or auto)..." : "Category (optional)..."}</option>
                {Array.from(categoriesByGroup.entries()).map(([g, arr]) => (
                  <optgroup key={g} label={g}>
                    {arr.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Date</Label>
              <Input type="date" value={qaDate} onChange={(e) => setQaDate(e.target.value)} />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Merchant</Label>
              <Input placeholder="(optional)" value={qaMerchant} onChange={(e) => setQaMerchant(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-6">
            <div className="md:col-span-3">
              <Label className="text-xs text-muted-foreground">Note</Label>
              <Input placeholder="(optional)" value={qaNote} onChange={(e) => setQaNote(e.target.value)} />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Payment</Label>
              <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={qaPayment} onChange={(e) => setQaPayment(e.target.value)}>
                <option>Card</option><option>Cash</option><option>Debit</option><option>Credit</option>
                <option>Apple Pay</option><option>Google Pay</option><option>Zelle</option><option>Venmo</option>
              </select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Account</Label>
              <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={qaAccount} onChange={(e) => setQaAccount(e.target.value)}>
                <option>Checking</option><option>Savings</option><option>Credit Card</option><option>Business</option>
              </select>
            </div>

            <div className="flex items-end gap-2">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => {
                  const cid = autoPickCategory(qaMerchant, qaNote);
                  if (!cid) return alert("No rule matched.");
                  setQaCategoryId(cid);
                }}
              >
                Run Rules
              </Button>
            </div>
          </div>

          {/* split editor */}
          {splitMode && qaType === "expense" ? (
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-bold">Split lines</div>
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
                      <select
                        className="w-full h-10 rounded-md border bg-background px-3 text-sm"
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
                      </select>
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
            </div>
          ) : null}

          {/* one-tap */}
          {qaType === "expense" && !splitMode ? (
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

      {/* Tabs */}
      <Tabs value={state.ui.tab} onValueChange={(v) => setUI({ tab: v })}>
        <TabsList className="hidden" />

        <TabsContent value="overview" className="space-y-4">
          {/* Charts */}
          <div className="grid gap-3 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Category share</CardTitle>
                <CardDescription>Expenses only, top categories + other.</CardDescription>
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
                <CardTitle className="text-base">Daily spend</CardTitle>
                <CardDescription>Expenses per day in the selected range.</CardDescription>
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

          {/* Budget list */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap justify-between items-start gap-2">
                <div>
                  <CardTitle className="text-base">Budgets ({budgetMode})</CardTitle>
                  <CardDescription>Spent vs budget+carry, plus forecast with planned remaining.</CardDescription>
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
                  <div key={r.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-bold">{r.name}</div>
                          {pillForStatus(r.status)}
                          <span className="text-xs text-muted-foreground">{r.group}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Spent {money(r.spent)} / {money(r.budgetWithCarry)} • Planned {money(r.plannedRemaining)} • Forecast {money(r.forecast)} ({r.forecastStatus})
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="secondary" onClick={() => scrollToCategory(r.id)}>View</Button>
                      </div>
                    </div>
                    <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-foreground/25" style={{ width: `${Math.round(clamp01(r.pct) * 100)}%` }} />
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Used {r.budgetWithCarry > 0 ? `${Math.round(r.pct * 100)}%` : "—"} • Carry {money(r.carry)}
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
                      <div key={r.id} className="rounded-lg border p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="font-black">{r.name}</div>
                              {pillForStatus(r.status)}
                              <span className="text-xs text-muted-foreground">{r.group}</span>
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
                              <Input
                                defaultValue={String(r.baseBudget ?? 0)}
                                inputMode="decimal"
                                onBlur={(e) => updateCategoryBudget(r.id, e.target.value)}
                              />
                            </div>

                            <div className="w-[160px]">
                              <Label className="text-xs text-muted-foreground">Planned remaining</Label>
                              <Input
                                defaultValue={String(r.plannedRemaining ?? 0)}
                                inputMode="decimal"
                                onBlur={(e) => updatePlannedRemaining(r.id, e.target.value)}
                              />
                            </div>

                            <Button size="sm" variant="secondary" onClick={() => scrollToCategory(r.id)}>View</Button>
                          </div>
                        </div>

                        <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-foreground/25" style={{ width: `${Math.round(clamp01(r.pct) * 100)}%` }} />
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Used {r.budgetWithCarry > 0 ? `${Math.round(r.pct * 100)}%` : "—"} • Forecast {r.budgetWithCarry > 0 ? `${Math.round(r.forecastPct * 100)}%` : "—"}
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

                  <div className="rounded-lg border p-3 space-y-2">
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
                        <select
                          className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                          defaultValue="subscriptions"
                          onChange={(e) => (newRecDraft.current.categoryId = e.target.value)}
                        >
                          {Array.from(categoriesByGroup.entries()).map(([g, arr]) => (
                            <optgroup key={g} label={g}>
                              {arr.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-xs text-muted-foreground">Cadence</Label>
                        <select
                          className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                          defaultValue="monthly"
                          onChange={(e) => (newRecDraft.current.cadence = e.target.value)}
                        >
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                          <option value="yearly">Yearly</option>
                        </select>
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
                        <div key={r.id} className="rounded-lg border p-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="font-black">{r.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {money(r.amount)} • {categoriesById.get(r.categoryId)?.name ?? "—"} • {r.cadence} • next: {r.nextDate} • {r.enabled ? "enabled" : "disabled"}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setState((s) => ({ ...s, recurring: s.recurring.map((x) => (x.id === r.id ? { ...x, enabled: !x.enabled } : x)) }))}
                              >
                                {r.enabled ? "Disable" : "Enable"}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  if (!confirm("Delete recurring item?")) return;
                                  setState((s) => ({ ...s, recurring: s.recurring.filter((x) => x.id !== r.id) }));
                                }}
                              >
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
                  <div className="rounded-lg border p-3 space-y-2">
                    <div className="font-black">Add rule</div>
                    <div className="grid gap-2 md:grid-cols-12 items-end">
                      <div className="md:col-span-3">
                        <Label className="text-xs text-muted-foreground">Field</Label>
                        <select
                          className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                          defaultValue="either"
                          onChange={(e) => (newRuleDraft.current.field = e.target.value)}
                        >
                          <option value="either">Merchant OR Note</option>
                          <option value="merchant">Merchant only</option>
                          <option value="note">Note only</option>
                        </select>
                      </div>
                      <div className="md:col-span-4">
                        <Label className="text-xs text-muted-foreground">Match text (contains)</Label>
                        <Input placeholder="starbucks" onChange={(e) => (newRuleDraft.current.match = e.target.value)} />
                      </div>
                      <div className="md:col-span-4">
                        <Label className="text-xs text-muted-foreground">Category</Label>
                        <select
                          className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                          defaultValue="misc"
                          onChange={(e) => (newRuleDraft.current.categoryId = e.target.value)}
                        >
                          {Array.from(categoriesByGroup.entries()).map(([g, arr]) => (
                            <optgroup key={g} label={g}>
                              {arr.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
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
                        <div key={r.id} className="rounded-lg border p-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="font-black">
                                {r.enabled ? "✅" : "⛔"} If {r.field} contains “{r.match}” → {categoriesById.get(r.categoryId)?.name ?? "—"}
                              </div>
                              <div className="text-xs text-muted-foreground">Rules apply only when category is blank for an expense.</div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setState((s) => ({ ...s, rules: s.rules.map((x) => (x.id === r.id ? { ...x, enabled: !x.enabled } : x)) }))}
                              >
                                {r.enabled ? "Disable" : "Enable"}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  if (!confirm("Delete rule?")) return;
                                  setState((s) => ({ ...s, rules: s.rules.filter((x) => x.id !== r.id) }));
                                }}
                              >
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
                  <div className="rounded-lg border p-3 space-y-2">
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
                      <div key={c.id} className="rounded-lg border p-3">
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

      {/* Routed sections */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Spending by Category</CardTitle>
          <CardDescription>Auto-routed expense transactions per category.</CardDescription>
        </CardHeader>
        <CardContent>
          {!state.ui.showRoutedSections ? (
            <div className="text-sm text-muted-foreground">Hidden.</div>
          ) : (
            <div className="space-y-3">
              {state.categories.map((c) => {
                const categoryTx = filteredTx.filter((t) => t.type === "expense" && t.categoryId === c.id);
                const categoryTotal = categoryTx.reduce((s, t) => s + t.amount, 0);

                const baseBudget = Number(budgets?.[c.id] ?? 0);
                const carry = Number(carryForThisPeriod?.[c.id] ?? 0);
                const budgetWithCarry = baseBudget + carry;
                const pct = budgetWithCarry > 0 ? categoryTotal / budgetWithCarry : 0;

                const isFilteredToThis = state.ui.categoryFilter === c.id;
                const shouldShow =
                  isFilteredToThis ||
                  categoryTx.length > 0 ||
                  (baseBudget > 0 && (state.ui.groupFilter === "All" || state.ui.groupFilter === c.group));

                if (!shouldShow) return null;
                if (state.ui.groupFilter !== "All" && state.ui.groupFilter !== c.group && !isFilteredToThis) return null;

                return (
                  <div
                    key={c.id}
                    ref={(el) => { sectionRefs.current[c.id] = el; }}
                    className="rounded-xl border p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-lg font-black">{c.name}</div>
                          <Badge variant="outline">{c.group}</Badge>
                          {budgetWithCarry > 0 ? (
                            <Badge variant={pct >= 1 ? "destructive" : pct >= 0.85 ? "secondary" : "default"}>
                              {Math.round(pct * 100)}%
                            </Badge>
                          ) : (
                            <Badge variant="outline">No budget</Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Total: <b>{money(categoryTotal)}</b>
                          {budgetWithCarry > 0 ? (
                            <>
                              {" "}• Budget+Carry: <b>{money(budgetWithCarry)}</b> (Base {money(baseBudget)} + Carry {money(carry)})
                              {" "}• Remaining: <b>{money(Math.max(0, budgetWithCarry - categoryTotal))}</b>
                            </>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="secondary" onClick={() => setUI({ categoryFilter: c.id })}>Filter</Button>
                        <Button size="sm" variant="secondary" onClick={() => setUI({ categoryFilter: "All", groupFilter: "All" })}>Clear</Button>
                      </div>
                    </div>

                    {budgetWithCarry > 0 ? (
                      <div className="mt-3 h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-foreground/25" style={{ width: `${Math.round(clamp01(pct) * 100)}%` }} />
                      </div>
                    ) : null}

                    <div className="mt-3 space-y-2">
                      {categoryTx.length === 0 ? (
                        <div className="text-sm text-muted-foreground">No expenses in this category for this period.</div>
                      ) : (
                        categoryTx.slice(0, state.ui.compact ? 6 : 12).map((t) => (
                          <div key={t.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs text-muted-foreground">{t.date}</span>
                                <span className="font-bold">{t.merchant || "—"}</span>
                                <span className="text-xs text-muted-foreground">
                                  • {(t.paymentMethod || "—")} / {(t.account || "—")}
                                </span>
                                {t.meta?.recurringName ? <Badge variant="outline">Recurring</Badge> : null}
                                {t.meta?.splitGroupId ? <Badge variant="outline">Split</Badge> : null}
                              </div>
                              {t.note ? <div className="text-xs text-muted-foreground mt-1">{t.note}</div> : null}
                            </div>

                            <div className="flex items-center gap-2">
                              <div className="font-black">{money(t.amount)}</div>
                              <Button size="sm" variant="secondary" onClick={() => duplicateTx(t)}>Duplicate</Button>
                              <Button size="sm" variant="destructive" onClick={() => deleteTx(t.id)}>Delete</Button>
                            </div>
                          </div>
                        ))
                      )}

                      {categoryTx.length > (state.ui.compact ? 6 : 12) ? (
                        <div className="text-xs text-muted-foreground">
                          Showing top {state.ui.compact ? 6 : 12}. Use filters/search to narrow.
                        </div>
                      ) : null}
                    </div>
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
                if (!confirm("Delete ALL transactions only? (Keeps categories/budgets/rules/recurring)")) return;
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
            <div className="overflow-x-auto rounded-lg border">
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
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTx.map((t) => {
                    const cat = categoriesById.get(t.categoryId);
                    const group = cat?.group ?? (t.type === "expense" ? "Other" : "—");
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
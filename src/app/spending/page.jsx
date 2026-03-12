"use client";

import * as React from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

export const dynamic = "force-dynamic";

/** ---------------- defaults ---------------- **/
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

const ACCENT = "#3b82f6";

/** ---------------- utils ---------------- **/
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

  const groups = React.useMemo(() => {
    return ["All", ...Array.from(new Set(categories.map((c) => c.group))).sort((a, b) => a.localeCompare(b))];
  }, [categories]);

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
          supabase.from("spending_transactions").select("*").eq("user_id", currentUser.id).order("tx_date", { ascending: false }).order("created_at", { ascending: false }),
          supabase.from("spending_planned_items").select("*").eq("user_id", currentUser.id).order("planned_date", { ascending: false }).order("created_at", { ascending: false }),
        ]);

        if (catRes.error) throw catRes.error;
        if (budgetRes.error) throw budgetRes.error;
        if (txRes.error) throw txRes.error;
        if (plannedRes.error) throw plannedRes.error;

        const loadedCategories =
          (catRes.data || []).length > 0
            ? (catRes.data || []).map(mapCategoryRowToClient)
            : DEFAULT_CATEGORIES;

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
      .sort((a, b) => String(b.date).localeCompare(String(a.date)) || (b.createdAt || 0) - (a.createdAt || 0));
  }, [plannedItems, range.start, range.end, categoryFilter, search, categoriesById]);

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

    const { error } = await supabase
      .from("spending_transactions")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      setTransactions(previous);
      setPageError(error.message || "Failed to delete transaction.");
    }
  }

  async function duplicateTransaction(tx) {
    if (!user || !supabase) return;

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

    const { error } = await supabase
      .from("spending_planned_items")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

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
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 30) || uid();

    if (categoriesById.get(id)) return alert("Category already exists.");

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

    if (error) {
      setPageError(error.message || "Failed to add category.");
      return;
    }

    setCategories((prev) => [...prev, mapCategoryRowToClient(data)].sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name)));
    setNewCategoryName("");
    setNewCategoryGroup("Other");
  }

  async function deleteCategory(id) {
    if (!user || !supabase) return;
    if (!confirm("Delete this category? Existing old transactions may show blank category.")) return;

    const previous = categories;
    setCategories((prev) => prev.filter((c) => c.id !== id));

    const { error } = await supabase
      .from("spending_categories")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

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

    if (error) {
      setPageError(error.message || "Failed to save budget.");
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <Card>
          <CardContent className="p-6">Loading spending...</CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <Card>
          <CardContent className="p-6">
            <div className="font-black text-lg">Please log in</div>
            <div className="text-sm text-muted-foreground mt-2">
              This page now uses Supabase, so you need to be signed in.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-4">
      <div className="sticky top-0 z-30 -mx-4 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 bg-background/80 border-b">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">Spending</div>
            <div className="text-2xl font-black tracking-tight truncate">Spending Control</div>
            <div className="text-sm text-muted-foreground">
              Simpler setup. Faster input. Cleaner budget tracking.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="h-10">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="manage">Manage</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>

      {pageError ? (
        <Card className="border-red-500/40">
          <CardContent className="p-4">
            <div className="font-black">Database issue</div>
            <div className="text-sm text-muted-foreground mt-1">{pageError}</div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Period & Filters</CardTitle>
          <CardDescription>
            {range.label} • Budget mode: <b>{range.budgetMode}</b>
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant={period === "week" ? "default" : "secondary"} onClick={() => setPeriod("week")}>Week</Button>
            <Button size="sm" variant={period === "month" ? "default" : "secondary"} onClick={() => setPeriod("month")}>Month</Button>
            <Button size="sm" variant={period === "year" ? "default" : "secondary"} onClick={() => setPeriod("year")}>Year</Button>
          </div>

          <div className="grid gap-2 md:grid-cols-12">
            <div className="md:col-span-5">
              <Label className="text-xs text-muted-foreground">Search</Label>
              <Input
                placeholder="Merchant, note, category, amount..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="md:col-span-3">
              <Label className="text-xs text-muted-foreground">Type</Label>
              <NativeSelect value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="expense">Expenses</option>
                <option value="income">Income</option>
                <option value="transfer">Transfers</option>
                <option value="all">All</option>
              </NativeSelect>
            </div>

            <div className="md:col-span-4">
              <Label className="text-xs text-muted-foreground">Category</Label>
              <NativeSelect value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="all">All Categories</option>
                {groups
                  .filter((g) => g !== "All")
                  .map((group) => {
                    const arr = categories.filter((c) => c.group === group).sort((a, b) => a.name.localeCompare(b.name));
                    return (
                      <optgroup key={group} label={group}>
                        {arr.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </optgroup>
                    );
                  })}
              </NativeSelect>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Spent</CardDescription>
            <CardTitle className="text-2xl font-black">{money(totals.expense)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Actual expense transactions only
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Planned</CardDescription>
            <CardTitle className="text-2xl font-black">{money(totals.plannedExpense)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Forecast items not bought yet
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Net Actual</CardDescription>
            <CardTitle className="text-2xl font-black">{money(totals.net)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Income minus spent
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Net Forecast</CardDescription>
            <CardTitle className="text-2xl font-black">{money(totals.netForecast)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Income minus spent and planned
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Quick Add</CardTitle>
              <CardDescription>
                Use <b>Now</b> for real spending. Use <b>Planned</b> for forecast.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant={mode === "now" ? "default" : "secondary"} onClick={() => setMode("now")}>Now</Button>
              <Button variant={mode === "planned" ? "default" : "secondary"} onClick={() => setMode("planned")}>Planned</Button>
              <Button variant="secondary" onClick={clearQuickAdd}>Clear</Button>
              <Button onClick={() => (mode === "planned" ? addPlanned() : addNow())}>
                {mode === "planned" ? "Add Planned" : "Add Transaction"}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-12">
            <div className="md:col-span-2">
              <Label className="text-xs text-muted-foreground">Type</Label>
              <NativeSelect value={qaType} onChange={(e) => setQaType(e.target.value)} disabled={mode === "planned"}>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
                <option value="transfer">Transfer</option>
              </NativeSelect>
            </div>

            <div className="md:col-span-2">
              <Label className="text-xs text-muted-foreground">Amount</Label>
              <Input inputMode="decimal" placeholder="0.00" value={qaAmount} onChange={(e) => setQaAmount(e.target.value)} />
            </div>

            <div className="md:col-span-3">
              <Label className="text-xs text-muted-foreground">Category</Label>
              <NativeSelect
                value={qaCategoryId}
                onChange={(e) => setQaCategoryId(e.target.value)}
                disabled={mode === "now" ? qaType !== "expense" : false}
              >
                {categories
                  .slice()
                  .sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name))
                  .map((c) => (
                    <option key={c.id} value={c.id}>{c.group} • {c.name}</option>
                  ))}
              </NativeSelect>
            </div>

            <div className="md:col-span-2">
              <Label className="text-xs text-muted-foreground">{mode === "planned" ? "Planned date" : "Date"}</Label>
              <Input type="date" value={qaDate} onChange={(e) => setQaDate(e.target.value)} />
            </div>

            <div className="md:col-span-3">
              <Label className="text-xs text-muted-foreground">Merchant</Label>
              <Input placeholder="optional" value={qaMerchant} onChange={(e) => setQaMerchant(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-12">
            <div className="md:col-span-6">
              <Label className="text-xs text-muted-foreground">Note</Label>
              <Input placeholder="optional" value={qaNote} onChange={(e) => setQaNote(e.target.value)} />
            </div>

            <div className="md:col-span-3">
              <Label className="text-xs text-muted-foreground">Payment</Label>
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
              <Label className="text-xs text-muted-foreground">Account</Label>
              <NativeSelect value={qaAccount} onChange={(e) => setQaAccount(e.target.value)} disabled={mode === "planned"}>
                <option>Checking</option>
                <option>Savings</option>
                <option>Credit Card</option>
                <option>Business</option>
              </NativeSelect>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="hidden" />

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Budget Status</CardTitle>
              <CardDescription>
                Simple view: spent, planned, budget, forecast.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {budgetRows.length === 0 ? (
                <div className="text-sm text-muted-foreground">No budget rows yet.</div>
              ) : (
                budgetRows.map((r) => {
                  const pct = r.budget > 0 ? Math.min(100, Math.round((r.forecast / r.budget) * 100)) : 0;
                  return (
                    <div key={r.id} className="rounded-xl border p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="font-black">{r.name}</div>
                            <Badge variant="outline">{r.group}</Badge>
                            {statusBadge(r.forecastStatus)}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Spent {money(r.spent)} • Planned {money(r.planned)} • Forecast {money(r.forecast)} • Budget {money(r.budget)}
                          </div>
                        </div>
                        <div className="font-black">{r.budget > 0 ? `${pct}%` : "—"}</div>
                      </div>

                      {r.budget > 0 ? (
                        <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full"
                            style={{
                              width: `${pct}%`,
                              background: pct >= 100 ? "#dc2626" : pct >= 85 ? "#f59e0b" : ACCENT,
                            }}
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Planned Purchases</CardTitle>
                <CardDescription>
                  Forecast only. Convert when actually bought.
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
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-black">{money(p.amount)}</span>
                              <span className="text-sm">{cat?.name ?? "—"}</span>
                              <Badge variant="outline">{cat?.group ?? "Other"}</Badge>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {p.date} • {p.merchant || "—"} {p.note ? `• ${p.note}` : ""}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="secondary" onClick={() => convertPlanned(p)}>Convert</Button>
                            <Button size="sm" variant="destructive" onClick={() => deletePlanned(p.id)}>Delete</Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Recent Transactions</CardTitle>
                <CardDescription>
                  Cleaner list. No junk extras.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {filteredTransactions.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No transactions in this range.</div>
                ) : (
                  filteredTransactions.slice(0, 20).map((t) => {
                    const cat = categoriesById.get(t.categoryId);
                    return (
                      <div key={t.id} className="rounded-xl border p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-black">{money(t.amount)}</span>
                              <span className="text-sm">{t.merchant || "—"}</span>
                              <Badge variant="outline">{t.type}</Badge>
                              {t.type === "expense" && cat ? <Badge variant="secondary">{cat.name}</Badge> : null}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {t.date} • {t.paymentMethod || "—"} / {t.account || "—"} {t.note ? `• ${t.note}` : ""}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="secondary" onClick={() => duplicateTransaction(t)}>Duplicate</Button>
                            <Button size="sm" variant="destructive" onClick={() => deleteTransaction(t.id)}>Delete</Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="manage" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Manage Budgets</CardTitle>
              <CardDescription>
                Simple budget editor for the current period mode: <b>{range.budgetMode}</b>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {categories
                .slice()
                .sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name))
                .map((c) => (
                  <div key={c.id} className="rounded-xl border p-3">
                    <div className="grid gap-3 md:grid-cols-12 items-center">
                      <div className="md:col-span-4">
                        <div className="font-black">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{c.group}</div>
                      </div>

                      <div className="md:col-span-3">
                        <Label className="text-xs text-muted-foreground">Budget</Label>
                        <Input
                          defaultValue={String(budgets?.[range.budgetMode]?.[c.id] ?? 0)}
                          inputMode="decimal"
                          onBlur={(e) => updateBudget(c.id, e.target.value)}
                        />
                      </div>

                      <div className="md:col-span-2">
                        <div className="text-xs text-muted-foreground">Spent</div>
                        <div className="font-black mt-2">
                          {money(
                            filteredTransactions
                              .filter((t) => t.type === "expense" && t.categoryId === c.id)
                              .reduce((s, t) => s + (Number(t.amount) || 0), 0)
                          )}
                        </div>
                      </div>

                      <div className="md:col-span-2">
                        <div className="text-xs text-muted-foreground">Planned</div>
                        <div className="font-black mt-2">
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
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Add Category</CardTitle>
                <CardDescription>
                  Keep categories clean and simple.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Category name</Label>
                  <Input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Car Wash" />
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Group</Label>
                  <Input value={newCategoryGroup} onChange={(e) => setNewCategoryGroup(e.target.value)} placeholder="Transport" />
                </div>

                <Button onClick={addCategory}>Add Category</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Current Categories</CardTitle>
                <CardDescription>
                  Delete the ones you do not want.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[460px] overflow-auto">
                {categories
                  .slice()
                  .sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name))
                  .map((c) => (
                    <div key={c.id} className="rounded-xl border p-3 flex items-start justify-between gap-3">
                      <div>
                        <div className="font-black">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{c.group} • {c.id}</div>
                      </div>
                      <Button size="sm" variant="destructive" onClick={() => deleteCategory(c.id)}>
                        Delete
                      </Button>
                    </div>
                  ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
import { supabase } from "@/lib/supabaseClient";
import { writeAccountDelta, writeAccountTransfer } from "@/lib/accountLedger";

export const DEFAULT_CATEGORIES = [
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

export const DEFAULT_BUDGETS = {
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

export const MOBILE_SECTIONS = [
  { value: "feed", label: "Feed" },
  { value: "studio", label: "Studio" },
  { value: "tools", label: "Tools" },
];

export const TOOL_PANELS = [
  { value: "capture", label: "Capture" },
  { value: "categories", label: "Categories" },
  { value: "budget", label: "Budget" },
  { value: "insights", label: "Insights" },
];

export const MERCHANT_PRESETS = [
  { match: ["walmart"], label: "W", name: "Walmart", tone: "blue" },
  { match: ["target"], label: "T", name: "Target", tone: "red" },
  { match: ["amazon"], label: "A", name: "Amazon", tone: "amber" },
  { match: ["costco"], label: "C", name: "Costco", tone: "blue" },
  { match: ["publix"], label: "P", name: "Publix", tone: "green" },
  { match: ["wawa"], label: "W", name: "Wawa", tone: "amber" },
  { match: ["starbucks"], label: "S", name: "Starbucks", tone: "green" },
  { match: ["mcdonald"], label: "M", name: "McDonald's", tone: "amber" },
  { match: ["shell"], label: "S", name: "Shell", tone: "amber" },
  { match: ["circle k"], label: "K", name: "Circle K", tone: "red" },
  { match: ["sam", "sam's"], label: "S", name: "Sam's Club", tone: "blue" },
  { match: ["apple"], label: "A", name: "Apple", tone: "neutral" },
];

export function uid() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function roundMoneyValue(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function parseMoneyInput(v) {
  const raw = String(v ?? "").trim();
  const negativeByParens = /^\(.*\)$/.test(raw);
  const cleaned = raw.replace(/[^0-9.-]/g, "");
  let num = Number(cleaned);
  if (negativeByParens && Number.isFinite(num)) {
    num = -Math.abs(num);
  }
  return Number.isFinite(num) ? num : NaN;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function toDate(iso) {
  return new Date(`${iso}T00:00:00`);
}

export function money(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "$0.00";
  return x.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export function shortDate(iso) {
  const d = toDate(iso);
  if (!Number.isFinite(d.getTime())) return iso || "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function normalizeTime(v) {
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

export function fmtTime(v) {
  const t = normalizeTime(v);
  if (!t) return "All day";
  const [h, m] = t.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function ledgerDateTimeISO(date, time) {
  const d = String(date || todayISO());
  const t = normalizeTime(time) || "12:00";
  const stamp = new Date(`${d}T${t}:00`);
  if (!Number.isFinite(stamp.getTime())) return new Date().toISOString();
  return stamp.toISOString();
}

export function normalizeCategory(raw) {
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

export function periodBounds(mode) {
  const now = new Date();
  if (mode === "week") {
    return { start: startOfWeek(now), end: endOfWeek(now), budgetMode: "weekly", label: "This Week" };
  }
  if (mode === "year") {
    return { start: startOfYear(now), end: endOfYear(now), budgetMode: "yearly", label: "This Year" };
  }
  return { start: startOfMonth(now), end: endOfMonth(now), budgetMode: "monthly", label: "This Month" };
}

export function inRange(iso, start, end) {
  const d = toDate(iso);
  return d >= start && d <= end;
}

function percentChange(current, previous) {
  const a = Number(current) || 0;
  const b = Number(previous) || 0;
  if (b === 0) return a > 0 ? 100 : 0;
  return ((a - b) / b) * 100;
}

export function trendMeta(current, previous) {
  const diff = percentChange(current, previous);
  return {
    value: `${diff >= 0 ? "+" : ""}${diff.toFixed(0)}%`,
    positive: diff >= 0,
    text: "vs prior period",
  };
}

export function budgetStatus(spent, budget) {
  if (!budget || budget <= 0) return "No budget";
  const pct = spent / budget;
  if (pct >= 1) return "Over";
  if (pct >= 0.85) return "Near";
  return "OK";
}

export function getPreviousRange(period, currentRange) {
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

export function sumExpenses(rows) {
  return rows.reduce((sum, row) => sum + (row.type === "expense" ? Number(row.amount) || 0 : 0), 0);
}

export function mapCategoryRowToClient(row) {
  return normalizeCategory({
    id: row.id,
    name: row.name,
    group: row.group_name,
    color: row.color,
    isBudgeted: row.is_budgeted,
  });
}

export function mapCategoryClientToRow(cat, userId) {
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

export function mapAccountRowToClient(row) {
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

export function findAccountByName(accounts, name) {
  const target = normalizeAccountMatch(name);
  if (!target) return null;
  return accounts.find((account) => normalizeAccountMatch(account.name) === target) || null;
}

export function parseStoredAccount(value, type) {
  const raw = String(value || "").trim();
  if (!raw) return { display: "", accountName: "", transferAccountName: "" };
  if (type === "transfer" && raw.includes("→")) {
    const [accountName = "", transferAccountName = ""] = raw.split("→").map((part) => part.trim());
    return { display: raw, accountName, transferAccountName };
  }
  return { display: raw, accountName: raw, transferAccountName: "" };
}

export function buildLedgerMap(rows) {
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

export function mapTransactionRowToClient(row, ledgerRows = []) {
  const accountMeta = parseStoredAccount(row.account_name, row.type);

  let accountId = "";
  let accountName = accountMeta.accountName || "";
  let transferAccountId = "";
  let transferAccountName = accountMeta.transferAccountName || "";

  if (row.type === "transfer" && ledgerRows.length >= 2) {
    const outRow = ledgerRows.find((entry) => Number(entry.delta) < 0) || ledgerRows[0];
    const inRow = ledgerRows.find((entry) => Number(entry.delta) > 0) || ledgerRows[1] || null;
    accountId = outRow?.account_id || "";
    transferAccountId = inRow?.account_id || outRow?.related_account_id || "";
    transferAccountName = outRow?.related_account_name || transferAccountName;
  } else if (ledgerRows.length) {
    const main =
      row.type === "income"
        ? ledgerRows.find((entry) => Number(entry.delta) > 0) || ledgerRows[0]
        : ledgerRows.find((entry) => Number(entry.delta) < 0) || ledgerRows[0];
    accountId = main?.account_id || "";
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

export function mapTransactionClientToRow(tx, userId) {
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

export function mapPlannedRowToClient(row) {
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

export function mapPlannedClientToRow(p, userId) {
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

export function isBillManagedTransaction(tx) {
  const note = String(tx?.note || "");
  const paymentMethod = String(tx?.paymentMethod || "");
  return paymentMethod === "Bill Payment" || note.startsWith("[Bill Payment]");
}

export function txKindMeta(type, reverse = false) {
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

export function toneForType(type) {
  if (type === "income") return "green";
  if (type === "transfer") return "amber";
  return "red";
}

export function statusTone(status) {
  if (status === "Over") return { tone: "red", label: "Over" };
  if (status === "Near") return { tone: "amber", label: "Near" };
  if (status === "OK") return { tone: "green", label: "OK" };
  return { tone: "neutral", label: "No budget" };
}

export async function getDefaultCalendarProfileId(userId) {
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

export async function upsertCalendarEventForTransaction(tx, userId, category) {
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

  const { error: insertError } = await supabase.from("calendar_events").insert([{ id: uid(), created_at: new Date().toISOString(), ...payload }]);
  if (insertError) throw insertError;
}

export async function upsertCalendarEventForPlanned(planned, userId, category) {
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

  const { error: insertError } = await supabase.from("calendar_events").insert([{ id: uid(), created_at: new Date().toISOString(), ...payload }]);
  if (insertError) throw insertError;
}

export async function deleteCalendarEventBySource(userId, source, sourceId) {
  const { error } = await supabase.from("calendar_events").delete().eq("user_id", userId).eq("source", source).eq("source_id", sourceId);
  if (error) throw error;
}

export async function applyLedgerForTransaction({ tx, userId, accounts, reverse = false }) {
  const amount = roundMoneyValue(tx.amount);
  const meta = txKindMeta(tx.type, reverse);
  if (!(amount > 0)) return;

  const fromAccount =
    (tx.accountId ? accounts.find((account) => account.id === tx.accountId) : null) ||
    (tx.accountName ? findAccountByName(accounts, tx.accountName) : null) ||
    (tx.account ? findAccountByName(accounts, tx.account) : null);

  const toAccount =
    tx.type === "transfer"
      ? (tx.transferAccountId ? accounts.find((account) => account.id === tx.transferAccountId) : null) ||
        (tx.transferAccountName ? findAccountByName(accounts, tx.transferAccountName) : null)
      : null;

  if (tx.type === "transfer") {
    const realFrom = reverse ? toAccount : fromAccount;
    const realTo = reverse ? fromAccount : toAccount;
    if (!realFrom?.id || !realTo?.id) throw new Error("Transfer accounts could not be resolved.");
    await writeAccountTransfer({
      userId,
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
    userId,
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

export function merchantPresetForName(name) {
  const raw = String(name || "").trim();
  if (!raw) return { label: "?", name: "Unknown", tone: "neutral" };
  const lower = raw.toLowerCase();
  const preset = MERCHANT_PRESETS.find((entry) => entry.match.some((needle) => lower.includes(needle)));
  if (preset) return preset;
  const label = raw
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
    .slice(0, 2);
  return { label: label || raw.charAt(0).toUpperCase(), name: raw, tone: "neutral" };
}

export function merchantInsight(transactions = [], categoriesById, merchantName) {
  const merchant = String(merchantName || "").trim().toLowerCase();
  if (!merchant) return null;
  const rows = transactions.filter((tx) => tx.type === "expense" && String(tx.merchant || "").trim().toLowerCase() === merchant);
  if (!rows.length) return null;

  const total = roundMoneyValue(rows.reduce((sum, row) => sum + roundMoneyValue(row.amount), 0));
  const visits = rows.length;
  const avg = roundMoneyValue(total / Math.max(visits, 1));
  const categoryTotals = new Map();
  rows.forEach((row) => {
    const categoryName = categoriesById.get(row.categoryId)?.name || "Uncategorized";
    categoryTotals.set(categoryName, roundMoneyValue((categoryTotals.get(categoryName) || 0) + roundMoneyValue(row.amount)));
  });
  const topCategory = Array.from(categoryTotals.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "Uncategorized";

  return {
    merchant: rows[0].merchant || merchantName,
    total,
    visits,
    avg,
    topCategory,
    lastSeen: rows[0].date,
  };
}

export function buildTopMerchants(rows = []) {
  const map = new Map();
  rows.forEach((row) => {
    if (row.type !== "expense") return;
    const key = String(row.merchant || "").trim();
    if (!key) return;
    const existing = map.get(key) || { merchant: key, total: 0, count: 0 };
    existing.total = roundMoneyValue(existing.total + roundMoneyValue(row.amount));
    existing.count += 1;
    map.set(key, existing);
  });

  return Array.from(map.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)
    .map((row) => ({ ...row, avg: roundMoneyValue(row.total / Math.max(row.count, 1)), preset: merchantPresetForName(row.merchant) }));
}

export function topCategoryGroups(categories = []) {
  return ["All", ...Array.from(new Set(categories.map((c) => c.group))).sort()];
}

export function periodTrendData(rows, period) {
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

export function emptySelection() {
  return { kind: "tx", id: null };
}

export function sanitizeUploadFileName(name) {
  const base = String(name || "receipt")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base || "receipt";
}

export function formatFileSize(bytes) {
  const value = Number(bytes) || 0;
  if (value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  const digits = size >= 10 || unitIndex === 0 ? 0 : 1;
  return `${size.toFixed(digits)} ${units[unitIndex]}`;
}

export async function hydrateReceiptUrls(rows = []) {
  const rawRows = Array.isArray(rows) ? rows : [];
  if (!rawRows.length) return [];

  const bucketGroups = new Map();
  for (const row of rawRows) {
    const bucket = String(row.storage_bucket || "spending-receipts");
    const path = String(row.storage_path || "").trim();
    if (!path) continue;
    const list = bucketGroups.get(bucket) || [];
    list.push(path);
    bucketGroups.set(bucket, list);
  }

  const signedUrlMap = new Map();
  for (const [bucket, paths] of bucketGroups.entries()) {
    try {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrls(paths, 60 * 60);
      if (error) throw error;
      (data || []).forEach((entry, index) => {
        const path = paths[index];
        if (path && entry?.signedUrl) signedUrlMap.set(`${bucket}::${path}`, entry.signedUrl);
      });
    } catch {
      // Keep the row usable even if signed URL hydration fails.
    }
  }

  return rawRows.map((row) => {
    const bucket = String(row.storage_bucket || "spending-receipts");
    const storagePath = String(row.storage_path || "").trim();
    const mimeType = String(row.mime_type || "").toLowerCase();
    const previewUrl = signedUrlMap.get(`${bucket}::${storagePath}`) || null;
    return {
      id: row.id,
      userId: row.user_id || "",
      transactionId: row.transaction_id || "",
      fileName: row.file_name || "Receipt",
      storageBucket: bucket,
      storagePath,
      mimeType: row.mime_type || "",
      fileSize: Number(row.file_size) || 0,
      receiptStatus: row.receipt_status || "attached",
      capturedAt: row.captured_at || null,
      merchantName: row.merchant_name || "",
      receiptTotal: row.receipt_total != null ? Number(row.receipt_total) : null,
      subtotal: row.subtotal != null ? Number(row.subtotal) : null,
      taxAmount: row.tax_amount != null ? Number(row.tax_amount) : null,
      note: row.note || "",
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || null,
      previewUrl,
      isImage: mimeType.startsWith("image/"),
      isPdf: mimeType === "application/pdf",
    };
  });
}


const RECEIPT_IGNORE_PATTERNS = [
  /order confirmed/i,
  /\bdoc\b/i,
  /approval/i,
  /\baid\b/i,
  /register/i,
  /cashier/i,
  /guest copy/i,
  /drive thru/i,
  /order number/i,
  /tran seq/i,
  /card number/i,
  /card type/i,
  /operator/i,
  /welcome to/i,
  /subtotal/i,
  /^tax$/i,
  /^total$/i,
  /discount total/i,
  /^change$/i,
  /^visa$/i,
  /^mastercard$/i,
];

export function shouldIgnoreReceiptItemName(name) {
  const value = String(name || "").trim();
  if (!value) return true;
  return RECEIPT_IGNORE_PATTERNS.some((pattern) => pattern.test(value));
}

export function autoClassifyReceiptItem({ itemName = "", merchantName = "", lineTotal = 0 }) {
  const text = `${itemName} ${merchantName}`.toLowerCase();
  const total = Math.abs(Number(lineTotal) || 0);

  const wasteWords = [
    "cigarette","beer","liquor","alcohol","vape","lottery","candy","cookie","dessert","ice cream","energy drink"
  ];
  const wantWords = [
    "chick-fil-a","mcdonald","starbucks","coffee","latte","fries","burger","nugget","pizza","parfait","shake","snack","chips","soda"
  ];
  const needWords = [
    "milk","egg","bread","rice","water","gas","fuel","medicine","pharmacy","toilet paper","diaper","soap","detergent","baby formula","produce","fruit","vegetable","chicken","beef"
  ];

  if (wasteWords.some((word) => text.includes(word))) return "waste";
  if (needWords.some((word) => text.includes(word))) return "need";
  if (wantWords.some((word) => text.includes(word))) return "want";
  if (total <= 0) return "review";
  return text.includes("grocery") || text.includes("publix") || text.includes("walmart") ? "need" : "want";
}

export function autoPriceSignal({ itemName = "", merchantName = "", unitPrice = 0, lineTotal = 0 }) {
  const text = `${itemName} ${merchantName}`.toLowerCase();
  const unit = Math.abs(Number(unitPrice) || Number(lineTotal) || 0);
  if (unit <= 0) return "neutral";
  const fastFood = ["chick-fil-a","mcdonald","burger","fries","nugget","parfait","coffee","starbucks","pizza"].some((word) => text.includes(word));
  if (fastFood) {
    if (unit <= 4.5) return "good";
    if (unit <= 8.5) return "fair";
    return "high";
  }
  if (unit <= 5) return "good";
  if (unit <= 12) return "fair";
  return "high";
}

export function autoCoachFlag({ classification = "review", priceSignal = "neutral", lineTotal = 0 }) {
  const total = Math.abs(Number(lineTotal) || 0);
  if (classification === "waste") return "stop";
  if (priceSignal === "high" && total >= 8) return "overspent";
  if (classification === "want" && total >= 10) return "watch";
  if (priceSignal === "good") return "good-price";
  return "normal";
}

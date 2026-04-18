
import { supabase } from "@/lib/supabaseClient";
import { writeAccountDelta, writeAccountTransfer } from "@/lib/accountLedger";

export const DEFAULT_CATEGORIES = [
  { id: "housing", name: "Housing", group: "Bills", color: "#8b5cf6", isBudgeted: false },
  { id: "groceries", name: "Groceries", group: "Food", color: "#22c55e", isBudgeted: true },
  { id: "eating_out", name: "Eating Out", group: "Food", color: "#10b981", isBudgeted: true },
  { id: "gas", name: "Gas", group: "Transport", color: "#60a5fa", isBudgeted: true },
  { id: "utilities", name: "Utilities", group: "Bills", color: "#7c3aed", isBudgeted: false },
  { id: "shopping", name: "Shopping", group: "Lifestyle", color: "#fb7185", isBudgeted: true },
  { id: "health", name: "Health", group: "Health", color: "#f59e0b", isBudgeted: false },
  { id: "debt", name: "Debt Payments", group: "Debt", color: "#dc2626", isBudgeted: false },
  { id: "misc", name: "Misc", group: "Other", color: "#94a3b8", isBudgeted: true },
];

export const DEFAULT_BUDGETS = {
  weekly: { groceries: 200, eating_out: 100, gas: 80, shopping: 60, misc: 40 },
  monthly: { groceries: 800, eating_out: 400, gas: 320, shopping: 240, misc: 150 },
  yearly: { groceries: 9600, eating_out: 4800, gas: 3840, shopping: 2880, misc: 1800 },
};

export function uid() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function safeNum(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function roundMoneyValue(value) {
  return Math.round(safeNum(value, 0) * 100) / 100;
}

export function parseMoneyInput(value) {
  const raw = String(value ?? "").trim();
  const negativeByParens = /^\(.*\)$/.test(raw);
  const cleaned = raw.replace(/[^0-9.-]/g, "");
  let num = Number(cleaned);
  if (negativeByParens && Number.isFinite(num)) num = -Math.abs(num);
  return Number.isFinite(num) ? num : NaN;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function normalizeTime(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const m = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return "";
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return "";
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return "";
  return `${pad2(hh)}:${pad2(mm)}`;
}

export function toDate(iso) {
  return new Date(`${iso}T00:00:00`);
}

export function shortDate(iso) {
  const d = toDate(iso);
  if (!Number.isFinite(d.getTime())) return iso || "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function fmtTime(value) {
  const t = normalizeTime(value);
  if (!t) return "All day";
  const [h, m] = t.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function money(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "$0.00";
  return num.toLocaleString(undefined, { style: "currency", currency: "USD" });
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
  if (mode === "week") return { start: startOfWeek(now), end: endOfWeek(now), budgetMode: "weekly", label: "This Week" };
  if (mode === "year") return { start: startOfYear(now), end: endOfYear(now), budgetMode: "yearly", label: "This Year" };
  return { start: startOfMonth(now), end: endOfMonth(now), budgetMode: "monthly", label: "This Month" };
}

export function inRange(iso, start, end) {
  const d = toDate(iso);
  return d >= start && d <= end;
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

function percentChange(current, previous) {
  const a = safeNum(current, 0);
  const b = safeNum(previous, 0);
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

export function pct(value, digits = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return `${num.toFixed(digits)}%`;
}

export function topCategoryGroups(categories = []) {
  return ["All", ...Array.from(new Set(categories.map((c) => c.group))).sort()];
}

export function emptySelection() {
  return { kind: "tx", id: null };
}

export function toneForType(type) {
  if (type === "income") return "green";
  if (type === "transfer") return "blue";
  return "red";
}

export function statusTone(status) {
  if (status === "Over") return { tone: "red", label: "Over" };
  if (status === "Near") return { tone: "amber", label: "Near" };
  if (status === "OK") return { tone: "green", label: "OK" };
  return { tone: "neutral", label: "No budget" };
}

export function isBillManagedTransaction(tx) {
  const note = String(tx?.note || "");
  const paymentMethod = String(tx?.paymentMethod || "");
  return paymentMethod === "Bill Payment" || note.startsWith("[Bill Payment]");
}

export function mapCategoryRowToClient(row) {
  return {
    id: row.id,
    name: row.name || "",
    group: row.group_name || "Other",
    color: row.color || "#94a3b8",
    isBudgeted: row.is_budgeted !== false,
  };
}

export function mapCategoryClientToRow(category, userId) {
  return {
    id: category.id,
    user_id: userId,
    name: category.name,
    group_name: category.group,
    color: category.color,
    is_budgeted: category.isBudgeted !== false,
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

export function mapPlannedClientToRow(planned, userId) {
  return {
    id: planned.id,
    user_id: userId,
    amount: Number(planned.amount) || 0,
    category_id: planned.categoryId || null,
    planned_date: planned.date,
    planned_time: normalizeTime(planned.time || "") || null,
    merchant: planned.merchant || "",
    note: planned.note || "",
    created_at: planned.createdAt ? new Date(planned.createdAt).toISOString() : new Date().toISOString(),
    updated_at: new Date().toISOString(),
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

export function ledgerDateTimeISO(date, time) {
  const d = String(date || todayISO());
  const t = normalizeTime(time) || "12:00";
  const stamp = new Date(`${d}T${t}:00`);
  if (!Number.isFinite(stamp.getTime())) return new Date().toISOString();
  return stamp.toISOString();
}

export function txKindMeta(type, reverse = false) {
  if (type === "expense") {
    return reverse
      ? { deltaSign: 1, kind: "spending_expense_edit_reverse", sourceType: "spending_transaction" }
      : { deltaSign: -1, kind: "spending_expense", sourceType: "spending_transaction" };
  }
  if (type === "income") {
    return reverse
      ? { deltaSign: -1, kind: "spending_income_edit_reverse", sourceType: "spending_transaction" }
      : { deltaSign: 1, kind: "spending_income", sourceType: "spending_transaction" };
  }
  return reverse
    ? { kind: "spending_transfer_edit_reverse", sourceType: "spending_transaction" }
    : { kind: "spending_transfer", sourceType: "spending_transaction" };
}

export async function applyLedgerForTransaction({ tx, userId, accounts, reverse = false, sourceIdOverride = null }) {
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

  const sourceId = sourceIdOverride || tx.id;

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
      sourceId,
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
    sourceId,
    createdAt: ledgerDateTimeISO(tx.date, tx.time),
  });
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
  if (tx.type === "income") return tx.merchant?.trim() ? `Income • ${tx.merchant.trim()}` : "Income";
  return tx.merchant?.trim() ? `${category?.name?.trim() || "Expense"} • ${tx.merchant.trim()}` : category?.name?.trim() || "Expense";
}

function calendarTitleForPlanned(planned, category) {
  const categoryName = category?.name?.trim() || "Planned Expense";
  return planned.merchant?.trim() ? `Planned • ${categoryName} • ${planned.merchant.trim()}` : `Planned • ${categoryName}`;
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

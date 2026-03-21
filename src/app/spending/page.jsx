"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import * as Select from "@radix-ui/react-select";
import { ChevronDown, Check } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

export const dynamic = "force-dynamic";

/* =========================================================
   LIFE COMMAND CENTER — SPENDING COMMAND
   Full rewrite
   - custom selects (no ugly white browser dropdowns)
   - global floating action menus
   - planned delete/convert fixed
   - optional time support
   - calendar sync
   ========================================================= */

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
function longDate(iso) {
  const d = toDate(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
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

/* ------------------------- mappers ------------------------- */
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

/* ------------------------- calendar sync ------------------------- */
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

/* ------------------------- UI helpers ------------------------- */
function LccSelect({
  value,
  onValueChange,
  placeholder = "Select",
  items = [],
  className = "",
}) {
  return (
    <Select.Root value={value} onValueChange={onValueChange}>
      <Select.Trigger
        className={`flex h-11 w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-left text-sm text-white outline-none transition hover:bg-white/[0.06] focus:ring-2 focus:ring-white/10 ${className}`}
      >
        <Select.Value placeholder={placeholder} />
        <Select.Icon>
          <ChevronDown className="h-4 w-4 text-white/70" />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={8}
          className="z-[99999] max-h-80 w-[var(--radix-select-trigger-width)] overflow-hidden rounded-2xl border border-white/10 bg-[#0c1322] shadow-[0_24px_60px_rgba(0,0,0,.65)]"
        >
          <Select.Viewport className="p-2">
            {items.map((item) => (
              <Select.Item
                key={item.value}
                value={item.value}
                className="relative flex cursor-pointer select-none items-center rounded-xl py-2.5 pl-9 pr-3 text-sm text-white/90 outline-none transition hover:bg-white/10 data-[highlighted]:bg-white/10"
              >
                <span className="absolute left-3 inline-flex w-4 items-center justify-center">
                  <Select.ItemIndicator>
                    <Check className="h-4 w-4 text-white" />
                  </Select.ItemIndicator>
                </span>
                <Select.ItemText>{item.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

function ShellCard({ children, className = "" }) {
  return (
    <div
      className={
        "rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,16,28,.95),rgba(7,11,21,.92))] shadow-[0_24px_60px_rgba(0,0,0,.42)] backdrop-blur-xl " +
        className
      }
    >
      {children}
    </div>
  );
}

function MetricCard({ title, value, sub, tone = "neutral", accentValue = "" }) {
  const map = {
    red: { border: "rgba(255,107,127,.18)", glow: "rgba(255,107,127,.18)", accent: TONE.red },
    green: { border: "rgba(74,222,128,.18)", glow: "rgba(74,222,128,.18)", accent: TONE.green },
    amber: { border: "rgba(245,158,11,.18)", glow: "rgba(245,158,11,.18)", accent: TONE.amber },
    neutral: { border: "rgba(255,255,255,.10)", glow: "rgba(255,255,255,.04)", accent: "#fff" },
  };
  const t = map[tone] || map.neutral;

  return (
    <div
      className="rounded-[24px] border p-5"
      style={{
        borderColor: t.border,
        background: "linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.02))",
        boxShadow: `inset 0 1px 0 rgba(255,255,255,.03), 0 0 28px ${t.glow}`,
      }}
    >
      <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-white/38">{title}</div>
      <div className="text-[28px] font-black leading-none text-white md:text-[34px]">{value}</div>
      <div className="mt-2 flex items-center gap-2 text-sm">
        {accentValue ? <span className="font-black" style={{ color: t.accent }}>{accentValue}</span> : null}
        <span className="text-white/52">{sub}</span>
      </div>
    </div>
  );
}

function ProgressBar({ value = 0, color = TONE.green }) {
  const pct = clamp(Number(value) || 0, 0, 100);
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${color} 0%, rgba(255,255,255,.95) 220%)`,
          boxShadow: `0 0 18px ${color}55, 0 0 28px ${color}22`,
        }}
      />
    </div>
  );
}

function TrendChart({ data }) {
  const width = 1000;
  const height = 260;
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
    <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.015))] p-3">
      <div className="relative h-[240px] w-full">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
          <defs>
            <linearGradient id="spendingTrendFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={TONE.red} stopOpacity="0.35" />
              <stop offset="100%" stopColor={TONE.red} stopOpacity="0.02" />
            </linearGradient>
            <filter id="spendingTrendGlow">
              <feGaussianBlur stdDeviation="5" result="blur" />
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
              fill="rgba(255,255,255,0.38)"
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
              <circle cx={p.x} cy={p.y} r="9" fill={TONE.red} fillOpacity="0.12" />
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

function ActionButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-lg text-white/80 transition hover:bg-white/[0.07]"
    >
      …
    </button>
  );
}

function FloatingMenu({ menu, onClose }) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!menu) return;

    function handlePointer(e) {
      const target = e.target;
      if (target instanceof HTMLElement && target.closest("[data-floating-menu]")) return;
      onClose();
    }

    function handleEsc(e) {
      if (e.key === "Escape") onClose();
    }

    window.addEventListener("mousedown", handlePointer);
    window.addEventListener("keydown", handleEsc);
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onClose, true);

    return () => {
      window.removeEventListener("mousedown", handlePointer);
      window.removeEventListener("keydown", handleEsc);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [menu, onClose]);

  if (!mounted || !menu) return null;

  return createPortal(
    <div
      data-floating-menu="true"
      className="fixed z-[9999] w-56 rounded-2xl border border-white/10 bg-[#0c1322] p-2 shadow-[0_24px_60px_rgba(0,0,0,.6)]"
      style={{ top: menu.top, left: menu.left }}
    >
      {menu.items.map((item, i) => (
        <button
          key={`${item.label}-${i}`}
          type="button"
          onClick={() => {
            onClose();
            item.onClick?.();
          }}
          className={`w-full rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
            item.tone === "danger"
              ? "text-red-300 hover:bg-red-400/10"
              : item.tone === "success"
              ? "text-emerald-300 hover:bg-emerald-400/10"
              : "text-white/82 hover:bg-white/8"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body
  );
}

/* ------------------------- main ------------------------- */
export default function SpendingPage() {
  const [user, setUser] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [pageError, setPageError] = React.useState("");
  const [saving, setSaving] = React.useState(false);

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
  const [qaTime, setQaTime] = React.useState("");
  const [qaCategoryId, setQaCategoryId] = React.useState("groceries");
  const [qaMerchant, setQaMerchant] = React.useState("");
  const [qaNote, setQaNote] = React.useState("");
  const [qaPayment, setQaPayment] = React.useState("Card");
  const [qaAccount, setQaAccount] = React.useState("Checking");

  const [newCategoryName, setNewCategoryName] = React.useState("");
  const [newCategoryGroup, setNewCategoryGroup] = React.useState("Other");

  const [menu, setMenu] = React.useState(null);

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

  const filteredTransactions = React.useMemo(() => {
    const q = search.trim().toLowerCase();

    return transactions
      .filter((t) => inRange(t.date, range.start, range.end))
      .filter((t) => (typeFilter === "all" ? true : t.type === typeFilter))
      .filter((t) => (categoryFilter === "all" ? true : t.categoryId === categoryFilter))
      .filter((t) => {
        if (!q) return true;
        const cat = categoriesById.get(t.categoryId)?.name ?? "";
        return `${t.merchant} ${t.note} ${t.date} ${t.time} ${cat} ${t.amount}`.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (b.date !== a.date) return String(b.date).localeCompare(String(a.date));
        return String(b.time || "").localeCompare(String(a.time || ""));
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
        return String(a.time || "").localeCompare(String(b.time || ""));
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
  const trendData = React.useMemo(() => groupTransactionsForTrend(filteredTransactions, range.start, period), [filteredTransactions, range.start, period]);

  const totalsByCategory = React.useMemo(() => {
    const map = new Map();
    for (const t of filteredTransactions) {
      if (t.type !== "expense") continue;
      map.set(t.categoryId, (map.get(t.categoryId) || 0) + (Number(t.amount) || 0));
    }

    return Array.from(map.entries())
      .map(([categoryId, total]) => ({ categoryId, total, category: categoriesById.get(categoryId) }))
      .sort((a, b) => b.total - a.total);
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

  const totalBudget = React.useMemo(() => budgetRows.reduce((sum, row) => sum + (Number(row.budget) || 0), 0), [budgetRows]);
  const remaining = totalBudget - totals.expense;
  const priorityCategory = totalsByCategory[0];

  const priorityPercent = React.useMemo(() => {
    if (!priorityCategory) return 0;
    const budget = Number(budgets?.[range.budgetMode]?.[priorityCategory.categoryId] || 0);
    if (budget <= 0) return 0;
    return (priorityCategory.total / budget) * 100;
  }, [priorityCategory, budgets, range.budgetMode]);

  const recentActivity = React.useMemo(() => filteredTransactions.slice(0, 8), [filteredTransactions]);

  const upcomingItems = React.useMemo(() => {
    const now = new Date();
    return plannedItems
      .filter((p) => toDate(p.date) >= new Date(now.getFullYear(), now.getMonth(), now.getDate()))
      .sort((a, b) => {
        if (a.date !== b.date) return String(a.date).localeCompare(String(b.date));
        return String(a.time || "").localeCompare(String(b.time || ""));
      })
      .slice(0, 8);
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
    setQaCategoryId("groceries");
    setMode("now");
  }

  function openMenuFromButton(e, items) {
    const rect = e.currentTarget.getBoundingClientRect();
    const menuWidth = 224;
    const menuHeightGuess = Math.max(52, items.length * 44 + 16);
    const gap = 10;

    let left = rect.right - menuWidth;
    left = Math.max(12, Math.min(left, window.innerWidth - menuWidth - 12));

    const roomBelow = window.innerHeight - rect.bottom;
    const roomAbove = rect.top;
    const openUp = roomBelow < menuHeightGuess && roomAbove > roomBelow;

    let top = openUp ? rect.top - menuHeightGuess - gap : rect.bottom + gap;
    top = Math.max(12, Math.min(top, window.innerHeight - menuHeightGuess - 12));

    setMenu({ top, left, items });
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
      const tx = {
        id: uid(),
        type: qaType,
        amount: Math.round(amt * 100) / 100,
        categoryId: qaType === "expense" ? qaCategoryId : qaCategoryId || "",
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
    if (!Number.isFinite(amt) || amt <= 0) return alert("Enter a valid amount.");
    if (!qaDate) return alert("Planned date required.");
    if (!qaCategoryId) return alert("Pick a category.");

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
      const clone = { ...tx, id: uid(), createdAt: Date.now() };

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
    if (!name) return alert("Category name required.");

    const id =
      name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 30) || uid();

    if (categoriesById.get(id)) return alert("Category already exists.");

    try {
      const cat = normalizeCategory({ id, name, group, color: "#94a3b8", isBudgeted: true });

      const { data, error } = await supabase
        .from("spending_categories")
        .insert([mapCategoryClientToRow(cat, user.id)])
        .select()
        .single();
      if (error) throw error;

      setCategories((prev) =>
        [...prev, mapCategoryRowToClient(data)].sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name))
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

  if (loading) {
    return (
      <div className="mx-auto max-w-[1720px] px-4 py-4">
        <ShellCard className="p-5 text-white/70">Loading spending...</ShellCard>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-[1720px] px-4 py-4">
        <ShellCard className="p-6">
          <div className="text-lg font-black text-white">Please log in</div>
          <div className="mt-2 text-sm text-white/60">This page uses Supabase, so you need to be signed in.</div>
        </ShellCard>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1720px] space-y-4 px-4 py-4">
      <FloatingMenu menu={menu} onClose={() => setMenu(null)} />

      <ShellCard className="px-6 py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="mb-1 text-[10px] font-black uppercase tracking-[0.28em] text-white/45">
              Life Command Center
            </div>
            <h1 className="m-0 text-3xl font-black tracking-tight text-white md:text-[2.2rem]">
              Spending Control
            </h1>
            <div className="mt-1 text-sm text-white/56">
              Real spending, planned hits, budget pressure, and calendar sync in one command view.
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
                      ? "linear-gradient(180deg, rgba(255,255,255,.96), rgba(235,235,235,.92))"
                      : "linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.03))",
                    color: active ? "#09111f" : "rgba(255,255,255,0.88)",
                  }}
                >
                  {p[0].toUpperCase() + p.slice(1)}
                </button>
              );
            })}

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="h-11 rounded-full border border-white/10 bg-black/40 p-1">
                <TabsTrigger value="overview" className="rounded-full px-5 text-sm">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="manage" className="rounded-full px-5 text-sm">
                  Manage
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </ShellCard>

      {pageError ? (
        <ShellCard className="border-red-400/20 p-4">
          <div className="font-black text-white">Database issue</div>
          <div className="mt-1 text-sm text-white/60">{pageError}</div>
        </ShellCard>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-4">
        <MetricCard title="Spent" value={money(totals.expense)} sub={expenseTrend.text} accentValue={expenseTrend.value} tone="red" />
        <MetricCard title="Planned" value={money(totals.plannedExpense)} sub="still coming" accentValue={upcomingItems.length ? `${upcomingItems.length} items` : ""} tone="amber" />
        <MetricCard title="Remaining" value={money(Math.max(remaining, 0))} sub={remaining < 0 ? "budget exceeded" : `from ${money(totalBudget)} budget`} accentValue={remaining < 0 ? money(Math.abs(remaining)) : ""} tone="green" />
        <MetricCard title="Net" value={money(totals.net)} sub="income - spend" accentValue={money(totals.forecastNet)} tone="neutral" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="hidden" />

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_420px]">
            <ShellCard className="p-5">
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">{range.label}</div>
                  <div className="mt-1 text-xl font-black text-white">Spending pressure</div>
                </div>
                <div className="text-sm text-white/50">
                  Top category: <span className="font-bold text-white/85">{priorityCategory?.category?.name || "—"}</span>
                </div>
              </div>

              <TrendChart data={trendData} />

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Priority category</div>
                  <div className="mt-2 text-2xl font-black text-white">{priorityCategory?.category?.name || "No expense data"}</div>
                  <div className="mt-1 text-sm text-white/56">
                    {priorityCategory ? money(priorityCategory.total) : "Start logging spending to build this."}
                  </div>
                  <div className="mt-4">
                    <ProgressBar value={priorityPercent} color={priorityPercent >= 100 ? TONE.red : priorityPercent >= 85 ? TONE.amber : TONE.green} />
                  </div>
                  <div className="mt-2 text-xs text-white/46">
                    {priorityPercent ? `${priorityPercent.toFixed(0)}% of category budget` : "No budget on this category yet"}
                  </div>
                </div>

                <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Forecast view</div>
                  <div className="mt-2 text-2xl font-black text-white">{money(totals.forecastNet)}</div>
                  <div className="mt-1 text-sm text-white/56">After planned items land</div>

                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/56">Live net</span>
                      <span className="font-bold text-white">{money(totals.net)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/56">Planned hits</span>
                      <span className="font-bold text-amber-300">{money(totals.plannedExpense)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </ShellCard>

            <div className="space-y-4">
              <ShellCard className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Quick add</div>
                    <div className="mt-1 text-xl font-black text-white">Log now or plan ahead</div>
                  </div>
                  <div className="inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1">
                    <button
                      type="button"
                      onClick={() => setMode("now")}
                      className={`rounded-full px-4 py-2 text-sm font-black transition ${mode === "now" ? "bg-white text-[#08111f]" : "text-white/70"}`}
                    >
                      Now
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode("planned")}
                      className={`rounded-full px-4 py-2 text-sm font-black transition ${mode === "planned" ? "bg-white text-[#08111f]" : "text-white/70"}`}
                    >
                      Planned
                    </button>
                  </div>
                </div>

                <div className="grid gap-3">
                  {mode === "now" ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label className="mb-2 block text-white/72">Type</Label>
                        <LccSelect
                          value={qaType}
                          onValueChange={setQaType}
                          items={[
                            { value: "expense", label: "Expense" },
                            { value: "income", label: "Income" },
                          ]}
                        />
                      </div>

                      <div>
                        <Label className="mb-2 block text-white/72">Amount</Label>
                        <Input value={qaAmount} onChange={(e) => setQaAmount(e.target.value)} placeholder="0.00" className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white" />
                      </div>

                      <div>
                        <Label className="mb-2 block text-white/72">Date</Label>
                        <Input type="date" value={qaDate} onChange={(e) => setQaDate(e.target.value)} className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white" />
                      </div>

                      <div>
                        <Label className="mb-2 block text-white/72">Time</Label>
                        <Input type="time" value={qaTime} onChange={(e) => setQaTime(e.target.value)} className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white" />
                      </div>

                      <div>
                        <Label className="mb-2 block text-white/72">Category</Label>
                        <LccSelect
                          value={qaCategoryId}
                          onValueChange={setQaCategoryId}
                          items={categories.map((c) => ({
                            value: c.id,
                            label: `${c.group} • ${c.name}`,
                          }))}
                        />
                      </div>

                      <div>
                        <Label className="mb-2 block text-white/72">Merchant</Label>
                        <Input value={qaMerchant} onChange={(e) => setQaMerchant(e.target.value)} placeholder="Where did it go?" className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white" />
                      </div>

                      <div>
                        <Label className="mb-2 block text-white/72">Payment</Label>
                        <LccSelect
                          value={qaPayment}
                          onValueChange={setQaPayment}
                          items={[
                            { value: "Card", label: "Card" },
                            { value: "Cash", label: "Cash" },
                            { value: "Bank", label: "Bank" },
                            { value: "Transfer", label: "Transfer" },
                          ]}
                        />
                      </div>

                      <div>
                        <Label className="mb-2 block text-white/72">Account</Label>
                        <Input value={qaAccount} onChange={(e) => setQaAccount(e.target.value)} placeholder="Checking" className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white" />
                      </div>

                      <div className="sm:col-span-2">
                        <Label className="mb-2 block text-white/72">Note</Label>
                        <Input value={qaNote} onChange={(e) => setQaNote(e.target.value)} placeholder="Optional note" className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white" />
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label className="mb-2 block text-white/72">Amount</Label>
                        <Input value={qaAmount} onChange={(e) => setQaAmount(e.target.value)} placeholder="0.00" className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white" />
                      </div>

                      <div>
                        <Label className="mb-2 block text-white/72">Planned date</Label>
                        <Input type="date" value={qaDate} onChange={(e) => setQaDate(e.target.value)} className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white" />
                      </div>

                      <div>
                        <Label className="mb-2 block text-white/72">Planned time</Label>
                        <Input type="time" value={qaTime} onChange={(e) => setQaTime(e.target.value)} className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white" />
                      </div>

                      <div>
                        <Label className="mb-2 block text-white/72">Category</Label>
                        <LccSelect
                          value={qaCategoryId}
                          onValueChange={setQaCategoryId}
                          items={categories.map((c) => ({
                            value: c.id,
                            label: `${c.group} • ${c.name}`,
                          }))}
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <Label className="mb-2 block text-white/72">Merchant</Label>
                        <Input value={qaMerchant} onChange={(e) => setQaMerchant(e.target.value)} placeholder="What is this for?" className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white" />
                      </div>

                      <div className="sm:col-span-2">
                        <Label className="mb-2 block text-white/72">Note</Label>
                        <Input value={qaNote} onChange={(e) => setQaNote(e.target.value)} placeholder="Optional note" className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white" />
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <Button
                      type="button"
                      onClick={mode === "now" ? addNow : addPlanned}
                      disabled={saving}
                      className="rounded-2xl bg-white px-5 text-[#09111f] hover:bg-white/90"
                    >
                      {saving ? "Saving..." : mode === "now" ? "Save transaction" : "Save planned item"}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={clearQuickAdd}
                      className="rounded-2xl border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]"
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              </ShellCard>

              <ShellCard className="p-5">
                <div className="mb-4">
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Upcoming</div>
                  <div className="mt-1 text-xl font-black text-white">Planned hits</div>
                </div>

                <div className="space-y-3">
                  {upcomingItems.length === 0 ? (
                    <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4 text-sm text-white/56">
                      No upcoming planned items.
                    </div>
                  ) : (
                    upcomingItems.map((p) => {
                      const cat = categoriesById.get(p.categoryId);
                      return (
                        <div key={p.id} className="flex items-start justify-between gap-3 rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
                          <div className="min-w-0 flex-1">
                            <div className="font-black text-white">{p.merchant || cat?.name || "Planned expense"}</div>
                            <div className="mt-1 text-sm text-white/54">
                              {shortDate(p.date)} • {fmtTime(p.time)} • {cat?.name || "Uncategorized"}
                            </div>
                            {p.note ? <div className="mt-2 text-sm text-white/64">{p.note}</div> : null}
                          </div>

                          <div className="flex items-start gap-3">
                            <div className="text-right">
                              <div className="font-black text-amber-300">{money(p.amount)}</div>
                            </div>

                            <ActionButton
                              onClick={(e) =>
                                openMenuFromButton(e, [
                                  { label: "Convert to real expense", tone: "success", onClick: () => convertPlanned(p) },
                                  { label: "Delete planned item", tone: "danger", onClick: () => deletePlanned(p.id) },
                                ])
                              }
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ShellCard>
            </div>
          </div>

          <ShellCard className="p-5">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Filters</div>
                <div className="mt-1 text-xl font-black text-white">Live activity</div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search merchant, note, amount..."
                  className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white"
                />

                <LccSelect
                  value={typeFilter}
                  onValueChange={setTypeFilter}
                  items={[
                    { value: "expense", label: "Expense" },
                    { value: "income", label: "Income" },
                    { value: "all", label: "All types" },
                  ]}
                />

                <LccSelect
                  value={categoryFilter}
                  onValueChange={setCategoryFilter}
                  items={[
                    { value: "all", label: "All categories" },
                    ...categories.map((c) => ({
                      value: c.id,
                      label: c.name,
                    })),
                  ]}
                />

                <div className="flex items-center rounded-2xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white/56">
                  {range.label}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {recentActivity.length === 0 ? (
                <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4 text-sm text-white/56">
                  No activity in this period yet.
                </div>
              ) : (
                recentActivity.map((tx) => {
                  const cat = categoriesById.get(tx.categoryId);
                  const isIncome = tx.type === "income";

                  return (
                    <div key={tx.id} className="flex items-start justify-between gap-3 rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.02))] p-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="truncate font-black text-white">{tx.merchant || cat?.name || "Untitled"}</div>
                          <Badge className={isIncome ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}>
                            {isIncome ? "Income" : "Expense"}
                          </Badge>
                          {cat?.name ? <Badge variant="outline" className="border-white/10 text-white/60">{cat.name}</Badge> : null}
                        </div>
                        <div className="mt-1 text-sm text-white/52">
                          {longDate(tx.date)} • {fmtTime(tx.time)}
                          {tx.account ? ` • ${tx.account}` : ""}
                          {tx.paymentMethod ? ` • ${tx.paymentMethod}` : ""}
                        </div>
                        {tx.note ? <div className="mt-2 text-sm text-white/68">{tx.note}</div> : null}
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="text-right">
                          <div className={`text-lg font-black ${isIncome ? "text-emerald-300" : "text-red-300"}`}>
                            {isIncome ? "+" : "-"}
                            {money(tx.amount).replace("-", "")}
                          </div>
                        </div>

                        <ActionButton
                          onClick={(e) =>
                            openMenuFromButton(e, [
                              { label: "Duplicate", onClick: () => duplicateTransaction(tx) },
                              { label: "Delete", tone: "danger", onClick: () => deleteTransaction(tx.id) },
                            ])
                          }
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ShellCard>

          <ShellCard className="p-5">
            <div className="mb-4">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Budgets</div>
              <div className="mt-1 text-xl font-black text-white">Category pressure</div>
            </div>

            <div className="space-y-4">
              {budgetRows.map((row) => {
                const pct = row.budget > 0 ? (row.forecast / row.budget) * 100 : 0;
                const color = pct >= 100 ? TONE.red : pct >= 85 ? TONE.amber : TONE.green;

                return (
                  <div key={row.id} className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div>
                        <div className="font-black text-white">{row.name}</div>
                        <div className="mt-1 text-sm text-white/52">
                          Spent {money(row.spent)} • Planned {money(row.planned)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-white">{money(row.budget)}</div>
                        <div className="mt-1 text-xs text-white/46">{row.forecastStatus}</div>
                      </div>
                    </div>

                    <ProgressBar value={pct} color={color} />

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="text-xs text-white/46">
                        Forecast {money(row.forecast)} • {pct ? `${pct.toFixed(0)}%` : "No budget"}
                      </div>
                      <Input
                        defaultValue={row.budget ? String(row.budget) : ""}
                        placeholder="Budget"
                        onBlur={(e) => updateBudget(row.id, e.target.value)}
                        className="h-10 w-[130px] rounded-2xl border-white/10 bg-white/[0.04] text-right text-white"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </ShellCard>
        </TabsContent>

        <TabsContent value="manage" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,.8fr)]">
            <ShellCard className="p-5">
              <div className="mb-4">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Planned items</div>
                <div className="mt-1 text-xl font-black text-white">What is still coming</div>
              </div>

              <div className="space-y-3">
                {filteredPlanned.length === 0 ? (
                  <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4 text-sm text-white/56">
                    No planned items in this view.
                  </div>
                ) : (
                  filteredPlanned.map((p) => {
                    const cat = categoriesById.get(p.categoryId);
                    return (
                      <div key={p.id} className="flex items-start justify-between gap-3 rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.02))] p-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="truncate font-black text-white">{p.merchant || cat?.name || "Planned expense"}</div>
                            <Badge className="bg-amber-500/15 text-amber-300">Planned</Badge>
                            {cat?.name ? <Badge variant="outline" className="border-white/10 text-white/60">{cat.name}</Badge> : null}
                          </div>
                          <div className="mt-1 text-sm text-white/52">{longDate(p.date)} • {fmtTime(p.time)}</div>
                          {p.note ? <div className="mt-2 text-sm text-white/68">{p.note}</div> : null}
                        </div>

                        <div className="flex items-start gap-3">
                          <div className="text-right">
                            <div className="text-lg font-black text-amber-300">{money(p.amount)}</div>
                          </div>

                          <ActionButton
                            onClick={(e) =>
                              openMenuFromButton(e, [
                                { label: "Convert to real expense", tone: "success", onClick: () => convertPlanned(p) },
                                { label: "Delete planned item", tone: "danger", onClick: () => deletePlanned(p.id) },
                              ])
                            }
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ShellCard>

            <div className="space-y-4">
              <ShellCard className="p-5">
                <div className="mb-4">
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Categories</div>
                  <div className="mt-1 text-xl font-black text-white">Add or trim categories</div>
                </div>

                <div className="grid gap-3">
                  <div>
                    <Label className="mb-2 block text-white/72">Category name</Label>
                    <Input
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Example: Pet Care"
                      className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white"
                    />
                  </div>

                  <div>
                    <Label className="mb-2 block text-white/72">Group</Label>
                    <LccSelect
                      value={newCategoryGroup}
                      onValueChange={setNewCategoryGroup}
                      items={groups
                        .filter((g) => g !== "All")
                        .map((g) => ({ value: g, label: g }))}
                    />
                  </div>

                  <div className="pt-1">
                    <Button onClick={addCategory} className="rounded-2xl bg-white px-5 text-[#09111f] hover:bg-white/90">
                      Add category
                    </Button>
                  </div>
                </div>
              </ShellCard>

              <ShellCard className="p-5">
                <div className="mb-4">
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Existing categories</div>
                  <div className="mt-1 text-xl font-black text-white">Current structure</div>
                </div>

                <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                  {categories
                    .slice()
                    .sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name))
                    .map((cat) => (
                      <div key={cat.id} className="flex items-center justify-between gap-3 rounded-[18px] border border-white/10 bg-white/[0.03] p-3">
                        <div className="min-w-0">
                          <div className="font-black text-white">{cat.name}</div>
                          <div className="mt-1 text-sm text-white/52">{cat.group}</div>
                        </div>

                        <ActionButton
                          onClick={(e) =>
                            openMenuFromButton(e, [{ label: "Delete", tone: "danger", onClick: () => deleteCategory(cat.id) }])
                          }
                        />
                      </div>
                    ))}
                </div>
              </ShellCard>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
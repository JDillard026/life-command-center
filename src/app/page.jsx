"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  CircleHelp,
  MoreHorizontal,
  Plus,
  Receipt,
  Search,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import GlassPane from "./components/GlassPane";

export const dynamic = "force-dynamic";

/* ──────────────────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────────────────── */

function safeNum(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function money(value, digits = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function signedMoney(value, digits = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  const abs = Math.abs(num).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  if (num > 0) return `+${abs}`;
  if (num < 0) return `-${abs}`;
  return abs;
}

function pct(value, digits = 1) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return `${num.toFixed(digits)}%`;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays(date, days) {
  const out = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  out.setDate(out.getDate() + days);
  return out;
}

function addMonthsClamped(date, months) {
  const baseYear = date.getFullYear();
  const baseMonth = date.getMonth() + months;
  const baseDay = date.getDate();

  const monthStart = new Date(baseYear, baseMonth, 1);
  const monthEndDay = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() + 1,
    0
  ).getDate();

  return new Date(
    monthStart.getFullYear(),
    monthStart.getMonth(),
    Math.min(baseDay, monthEndDay)
  );
}

function addYearsClamped(date, years) {
  return addMonthsClamped(date, years * 12);
}

function toISODateLocal(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseISODateLocal(iso) {
  const raw = String(iso || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [y, m, d] = raw.split("-").map(Number);
  const out = new Date(y, m - 1, d);
  if (out.getFullYear() !== y || out.getMonth() !== m - 1 || out.getDate() !== d) {
    return null;
  }
  return out;
}

function startOfMonthISO(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function endOfMonthISO(date = new Date()) {
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return toISODateLocal(end);
}

function monthKeyFromISO(iso) {
  const value = String(iso || "");
  return value.length >= 7 ? value.slice(0, 7) : "";
}

function fmtShort(iso) {
  const date = parseISODateLocal(iso);
  if (!date) return "—";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function diffCalendarDays(left, right = startOfToday()) {
  const leftDate = left instanceof Date ? left : parseISODateLocal(left);
  const rightDate = right instanceof Date ? right : parseISODateLocal(right);
  if (!leftDate || !rightDate) return null;

  const a = new Date(leftDate.getFullYear(), leftDate.getMonth(), leftDate.getDate()).getTime();
  const b = new Date(rightDate.getFullYear(), rightDate.getMonth(), rightDate.getDate()).getTime();
  return Math.round((a - b) / 86400000);
}

function normalizeFrequency(freq) {
  const value = String(freq || "").toLowerCase().trim();
  if (["weekly", "biweekly", "monthly", "quarterly", "yearly", "one_time"].includes(value)) {
    return value;
  }
  return "monthly";
}

function addByFrequency(date, freq) {
  switch (normalizeFrequency(freq)) {
    case "weekly":
      return addDays(date, 7);
    case "biweekly":
      return addDays(date, 14);
    case "quarterly":
      return addMonthsClamped(date, 3);
    case "yearly":
      return addYearsClamped(date, 1);
    case "one_time":
      return date;
    default:
      return addMonthsClamped(date, 1);
  }
}

function freqToMonthlyMult(freq) {
  switch (normalizeFrequency(freq)) {
    case "weekly":
      return 4.333;
    case "biweekly":
      return 2.167;
    case "quarterly":
      return 1 / 3;
    case "yearly":
      return 1 / 12;
    case "one_time":
      return 0;
    default:
      return 1;
  }
}

function isSameOrAfter(left, right) {
  if (!left || !right) return false;
  return (
    new Date(left.getFullYear(), left.getMonth(), left.getDate()).getTime() >=
    new Date(right.getFullYear(), right.getMonth(), right.getDate()).getTime()
  );
}

function getLastOccurrenceOnOrBefore(anchor, freq, reference) {
  let current = new Date(anchor.getTime());
  let previous = null;
  let guard = 0;

  while (current <= reference && guard < 800) {
    previous = new Date(current.getTime());
    current = addByFrequency(current, freq);
    guard += 1;
  }

  return previous;
}

function getEffectiveBillAmount(bill) {
  const amount = safeNum(bill.amount, 0);
  const balance = safeNum(bill.balance, 0);
  const minPay = safeNum(bill.minPay, 0);
  const extraPay = safeNum(bill.extraPay, 0);

  if (bill.type === "controllable") {
    let planned = minPay + extraPay;
    if (planned <= 0) planned = amount > 0 ? amount : balance > 0 ? balance : 0;
    if (balance > 0) planned = Math.min(planned, balance);
    return Math.max(planned, 0);
  }

  if (amount > 0) return amount;
  if (minPay + extraPay > 0) return minPay + extraPay;
  return 0;
}

function getBillDueMeta(bill, reference = startOfToday()) {
  if (bill.active === false) {
    return { dueDate: null, days: null, isOverdue: false, amountDue: 0 };
  }

  const anchor = parseISODateLocal(bill.dueDate);
  const lastPaid = parseISODateLocal(bill.lastPaidDate);
  const freq = normalizeFrequency(bill.frequency);
  const amountDue = getEffectiveBillAmount(bill);

  if (!anchor) {
    return { dueDate: null, days: null, isOverdue: false, amountDue };
  }

  if (freq === "one_time") {
    if (lastPaid && isSameOrAfter(lastPaid, anchor)) {
      return { dueDate: null, days: null, isOverdue: false, amountDue: 0 };
    }
    const days = diffCalendarDays(anchor, reference);
    return {
      dueDate: toISODateLocal(anchor),
      days,
      isOverdue: days != null && days < 0,
      amountDue,
    };
  }

  const currentCycleDue = getLastOccurrenceOnOrBefore(anchor, freq, reference) || anchor;
  let effectiveDue = currentCycleDue;

  if (currentCycleDue <= reference && lastPaid && isSameOrAfter(lastPaid, currentCycleDue)) {
    effectiveDue = addByFrequency(currentCycleDue, freq);
  }

  const days = diffCalendarDays(effectiveDue, reference);
  return {
    dueDate: toISODateLocal(effectiveDue),
    days,
    isOverdue: days != null && days < 0,
    amountDue,
  };
}

function getBillMonthlyPressureAmount(bill, reference = startOfToday()) {
  const amount = getEffectiveBillAmount(bill);
  if (amount <= 0 || bill.active === false) return 0;

  const freq = normalizeFrequency(bill.frequency);
  if (freq === "one_time") {
    const dueMeta = getBillDueMeta(bill, reference);
    if (!dueMeta.dueDate) return 0;
    return monthKeyFromISO(dueMeta.dueDate) === monthKeyFromISO(toISODateLocal(reference))
      ? amount
      : 0;
  }

  return amount * freqToMonthlyMult(freq);
}

function normalizeAccountType(type) {
  return String(type || "").trim().toLowerCase();
}

function isInvestmentAccount(type) {
  const value = normalizeAccountType(type);
  return (
    value === "investment" ||
    value.includes("brokerage") ||
    value.includes("retirement") ||
    value.includes("ira") ||
    value.includes("401")
  );
}

function isDebtAccount(type) {
  const value = normalizeAccountType(type);
  return value === "credit" || value.includes("loan") || value.includes("debt");
}

function isLiquidCashAccount(type) {
  const value = normalizeAccountType(type);
  return (
    value === "checking" ||
    value === "savings" ||
    value === "cash" ||
    value.includes("money") ||
    value.includes("wallet")
  );
}

function normalizeText(value = "") {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function makeAmountKey(amount) {
  return safeNum(amount, 0).toFixed(2);
}

function buildCanonicalIncomeRows(spendingTx, incomeDeposits) {
  const strictDepositCounts = new Map();
  const looseDepositCounts = new Map();

  function addCount(map, key) {
    map.set(key, safeNum(map.get(key), 0) + 1);
  }

  function useCount(map, key) {
    const count = safeNum(map.get(key), 0);
    if (count <= 0) return false;
    if (count === 1) map.delete(key);
    else map.set(key, count - 1);
    return true;
  }

  const deposits = incomeDeposits.map((row) => ({
    id: `deposit-${row.id}`,
    date: row.date || "",
    label: row.source || "Income",
    note: row.note || "",
    amount: safeNum(row.amount, 0),
  }));

  deposits.forEach((row) => {
    const amountKey = makeAmountKey(row.amount);
    const strictKey = `${row.date}|${amountKey}|${normalizeText(row.label || row.note)}`;
    const looseKey = `${row.date}|${amountKey}`;
    addCount(strictDepositCounts, strictKey);
    addCount(looseDepositCounts, looseKey);
  });

  const extraIncomeTx = [];
  spendingTx
    .filter((row) => String(row.type || "").toLowerCase() === "income")
    .forEach((row) => {
      const amountKey = makeAmountKey(row.amount);
      const strictKey = `${row.date}|${amountKey}|${normalizeText(row.merchant || row.note)}`;
      const looseKey = `${row.date}|${amountKey}`;

      if (useCount(strictDepositCounts, strictKey)) return;
      if (useCount(looseDepositCounts, looseKey)) return;

      extraIncomeTx.push({
        id: `spending-income-${row.id}`,
        date: row.date || "",
        label: row.merchant || "Income",
        note: row.note || "",
        amount: safeNum(row.amount, 0),
      });
    });

  return [...deposits, ...extraIncomeTx];
}

function mapAccountRowToClient(row) {
  return {
    id: row.id,
    name: row.name || "",
    type: row.account_type || "other",
    balance: safeNum(row.balance, 0),
  };
}

function mapBillRowToClient(row) {
  return {
    id: row.id,
    name: row.name || "Bill",
    type: row.type === "controllable" ? "controllable" : "noncontrollable",
    frequency: row.frequency || "monthly",
    dueDate: row.due_date || "",
    lastPaidDate: row.last_paid_date || "",
    amount: safeNum(row.amount, 0),
    active: row.active !== false,
    balance: safeNum(row.balance, 0),
    minPay: safeNum(row.min_pay, 0),
    extraPay: safeNum(row.extra_pay, 0),
  };
}

function mapSpendingTxRowToClient(row) {
  return {
    id: row.id,
    type: row.type || "expense",
    amount: safeNum(row.amount, 0),
    date: row.tx_date || "",
    merchant: row.merchant || "",
    note: row.note || "",
    accountName: row.account_name || "",
    category:
      row.category ||
      row.category_name ||
      row.category_label ||
      row.category_id ||
      "Other",
  };
}

function mapIncomeDepositRowToClient(row) {
  return {
    id: row.id,
    date: row.deposit_date || "",
    source: row.source || "",
    amount: safeNum(row.amount, 0),
    note: row.note || "",
  };
}

function mapInvestmentAssetRow(row) {
  return {
    id: row.id,
    symbol: String(row.symbol || "").trim().toUpperCase(),
    name: row.name || row.symbol || "Asset",
  };
}

function mapInvestmentTxnRow(row) {
  return {
    id: row.id,
    assetId: row.asset_id,
    type: String(row.txn_type || "").toUpperCase(),
    date: row.txn_date || "",
    qty: safeNum(row.qty, 0),
    price: safeNum(row.price, 0),
  };
}

function mapSavingsGoalRow(row) {
  return {
    id: row.id,
    name: row.name || row.title || "Goal",
    currentAmount: safeNum(row.current_amount ?? row.currentAmount, 0),
    targetAmount: safeNum(row.target_amount ?? row.targetAmount, 0),
    dueDate: row.due_date || row.dueDate || "",
    priority: safeNum(row.priority, 0),
  };
}

function buildPositionMap(assets, txns, quoteMap) {
  const byAsset = new Map();

  assets.forEach((asset) => {
    byAsset.set(asset.id, {
      asset,
      shares: 0,
      basis: 0,
      currentValue: null,
      unrealizedPnl: null,
    });
  });

  const ordered = [...txns].sort((a, b) => String(a.date).localeCompare(String(b.date)));

  ordered.forEach((tx) => {
    const entry = byAsset.get(tx.assetId);
    if (!entry) return;

    const qty = safeNum(tx.qty, 0);
    const price = safeNum(tx.price, 0);
    if (qty <= 0) return;

    if (tx.type === "BUY") {
      entry.shares += qty;
      entry.basis += qty * price;
      return;
    }

    if (tx.type === "SELL" && entry.shares > 0) {
      const sellQty = Math.min(qty, entry.shares);
      const avgCost = entry.shares > 0 ? entry.basis / entry.shares : 0;
      entry.shares -= sellQty;
      entry.basis -= avgCost * sellQty;

      if (entry.shares <= 0.000001) {
        entry.shares = 0;
        entry.basis = 0;
      }
    }
  });

  byAsset.forEach((entry) => {
    const symbol = String(entry.asset.symbol || "").toUpperCase();
    const live = safeNum(quoteMap[symbol], NaN);
    if (Number.isFinite(live) && entry.shares > 0) {
      entry.currentValue = entry.shares * live;
      entry.unrealizedPnl = entry.currentValue - entry.basis;
    }
  });

  return byAsset;
}

async function fetchQuoteMap(symbols) {
  const unique = [...new Set(symbols.map((symbol) => String(symbol || "").trim().toUpperCase()).filter(Boolean))];
  if (!unique.length) return {};

  try {
    const res = await fetch(`/api/prices-batch?symbols=${encodeURIComponent(unique.join(","))}`, {
      cache: "no-store",
    });
    if (!res.ok) return {};
    const json = await res.json();
    const out = {};

    function assign(symbol, value) {
      const sym = String(symbol || "").trim().toUpperCase();
      const price = Number(value);
      if (!sym || !Number.isFinite(price)) return;
      out[sym] = price;
    }

    if (Array.isArray(json)) {
      json.forEach((item) => {
        assign(
          item?.symbol ?? item?.ticker,
          item?.price ?? item?.currentPrice ?? item?.last ?? item?.close
        );
      });
    }

    if (Array.isArray(json?.quotes)) {
      json.quotes.forEach((item) => {
        assign(
          item?.symbol ?? item?.ticker,
          item?.price ?? item?.currentPrice ?? item?.last ?? item?.close
        );
      });
    }

    if (Array.isArray(json?.data)) {
      json.data.forEach((item) => {
        assign(
          item?.symbol ?? item?.ticker,
          item?.price ?? item?.currentPrice ?? item?.last ?? item?.close
        );
      });
    }

    if (json?.prices && typeof json.prices === "object") {
      Object.entries(json.prices).forEach(([symbol, value]) => {
        if (typeof value === "object" && value !== null) {
          assign(symbol, value.price ?? value.currentPrice ?? value.last ?? value.close);
        } else {
          assign(symbol, value);
        }
      });
    }

    if (json && typeof json === "object" && !Array.isArray(json)) {
      Object.entries(json).forEach(([symbol, value]) => {
        if (out[String(symbol).toUpperCase()]) return;
        if (typeof value === "number") {
          assign(symbol, value);
        } else if (value && typeof value === "object") {
          assign(value.symbol ?? symbol, value.price ?? value.currentPrice ?? value.last ?? value.close);
        }
      });
    }

    return out;
  } catch {
    return {};
  }
}

function buildDailyCumulativeSeries(startISO, endISO, incomeRows, expenseRows) {
  const start = parseISODateLocal(startISO);
  const end = parseISODateLocal(endISO);
  if (!start || !end || start > end) return [];

  const deltas = new Map();

  function addDelta(date, delta) {
    if (!date) return;
    deltas.set(date, safeNum(deltas.get(date), 0) + safeNum(delta, 0));
  }

  incomeRows.forEach((row) => addDelta(row.date, row.amount));
  expenseRows.forEach((row) => addDelta(row.date, -safeNum(row.amount, 0)));

  const out = [];
  let running = 0;
  let current = new Date(start.getTime());

  while (current <= end) {
    const iso = toISODateLocal(current);
    running += safeNum(deltas.get(iso), 0);
    out.push({ iso, label: fmtShort(iso), value: running });
    current = addDays(current, 1);
  }

  return out.length ? out : [{ iso: startISO, label: fmtShort(startISO), value: 0 }];
}

function buildSpendingBuckets(expenseRows) {
  const map = new Map();

  expenseRows.forEach((row) => {
    const label = String(row.category || "Other").replace(/_/g, " ").trim() || "Other";
    map.set(label, safeNum(map.get(label), 0) + safeNum(row.amount, 0));
  });

  const total = [...map.values()].reduce((sum, value) => sum + safeNum(value, 0), 0);

  const sorted = [...map.entries()]
    .map(([label, amount]) => ({
      label,
      amount,
      pct: total > 0 ? (amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    total,
    items: sorted.slice(0, 6),
  };
}

function buildSvgLinePath(series, width = 100, height = 36, pad = 3) {
  if (!series.length) return "";

  const values = series.map((point) => safeNum(point.value, 0));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return series
    .map((point, index) => {
      const x =
        series.length === 1
          ? width / 2
          : (index / (series.length - 1)) * (width - pad * 2) + pad;

      const y =
        height -
        ((safeNum(point.value, 0) - min) / range) * (height - pad * 2) -
        pad;

      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function buildSvgAreaPath(series, width = 100, height = 36, pad = 3) {
  if (!series.length) return "";
  const line = buildSvgLinePath(series, width, height, pad);
  return `${line} L ${width - pad} ${height - pad} L ${pad} ${height - pad} Z`;
}

function sampleSeriesLabels(series, count = 6) {
  if (!series.length) return [];
  if (series.length <= count) {
    return series.map((item, index) => ({ index, ...item }));
  }

  const indices = [...new Set(
    Array.from({ length: count }, (_, i) =>
      Math.round((i / Math.max(count - 1, 1)) * (series.length - 1))
    )
  )];

  return indices
    .sort((a, b) => a - b)
    .map((index) => ({ index, ...series[index] }));
}

function toneClass(value, inverse = false) {
  const num = safeNum(value, 0);
  if (!num) return "neutral";
  if (inverse) return num > 0 ? "negative" : "positive";
  return num > 0 ? "positive" : "negative";
}

function dayLabelFromDiff(days) {
  if (days == null) return "Scheduled";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

/* ──────────────────────────────────────────────────────────────────────────
   UI
   ────────────────────────────────────────────────────────────────────────── */

function MenuPanel({ title, open, onClose, items = [] }) {
  if (!open) return null;

  return (
    <div className="opsMenu" onClick={(e) => e.stopPropagation()}>
      <div className="opsMenuHead">
        <div className="opsMenuTitle">{title}</div>
        <button type="button" className="opsMenuClose" onClick={onClose} aria-label="Close menu">
          <X size={13} />
        </button>
      </div>

      <div className="opsMenuList">
        {items.map((item) => (
          <Link key={`${item.href}-${item.label}`} href={item.href} className="opsMenuLink" onClick={onClose}>
            <div className="opsMenuLinkTitle">{item.label}</div>
            <div className="opsMenuLinkNote">{item.note}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function NotificationPanel({ open, onClose, items }) {
  if (!open) return null;

  return (
    <div className="opsMenu" onClick={(e) => e.stopPropagation()}>
      <div className="opsMenuHead">
        <div className="opsMenuTitle">Signals</div>
        <button type="button" className="opsMenuClose" onClick={onClose} aria-label="Close notifications">
          <X size={13} />
        </button>
      </div>

      <div className="opsSignalList">
        {items.length ? (
          items.map((item) => (
            <div className="opsSignalRow" key={item.id}>
              <div className={`opsSignalDot opsToneBg-${item.tone}`} />
              <div className="opsSignalCopy">
                <div className="opsSignalTitle">{item.title}</div>
                <div className="opsSignalText">{item.detail}</div>
              </div>
              <div className={`opsSignalValue opsTone-${item.tone}`}>{item.value}</div>
            </div>
          ))
        ) : (
          <div className="opsEmpty">
            <div className="opsEmptyTitle">No active signals</div>
            <div className="opsEmptyDetail">Nothing urgent is showing on the board.</div>
          </div>
        )}
      </div>
    </div>
  );
}

function CalendarQuickPanel({ open, onClose, items, todayCount, upcomingCount }) {
  if (!open) return null;

  const todayItems = items.filter((item) => item.bucket === "today");
  const upcomingItems = items.filter((item) => item.bucket === "upcoming");

  return (
    <div
      className="opsMenu"
      style={{ width: "min(370px, calc(100vw - 32px))" }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="opsMenuHead">
        <div>
          <div className="opsMenuTitle">Calendar quick view</div>
          <div className="opsMenuLinkNote" style={{ marginTop: 2 }}>
            {todayCount} today · {upcomingCount} upcoming
          </div>
        </div>
        <button type="button" className="opsMenuClose" onClick={onClose} aria-label="Close calendar panel">
          <X size={13} />
        </button>
      </div>

      {items.length ? (
        <div className="opsMenuList">
          {todayItems.length ? (
            <div
              style={{
                padding: "2px 2px 0",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.32)",
              }}
            >
              Today
            </div>
          ) : null}

          {todayItems.map((item) => (
            <Link key={item.id} href="/calendar" className="opsMenuLink" onClick={onClose}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <div className="opsMenuLinkTitle">{item.title}</div>
                  <div className="opsMenuLinkNote">{item.note}</div>
                </div>
                <div className={`opsSignalValue opsTone-${item.tone}`}>{item.amount}</div>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span className={`opsChip ${item.kind === "income" ? "opsChipBlue" : item.tone === "warning" ? "opsChipWarning" : "opsChipNeutral"}`}>
                  {item.kindLabel}
                </span>
                <span className="opsMenuLinkNote">{item.whenLabel}</span>
              </div>
            </Link>
          ))}

          {upcomingItems.length ? (
            <div
              style={{
                padding: "6px 2px 0",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.32)",
              }}
            >
              Upcoming
            </div>
          ) : null}

          {upcomingItems.map((item) => (
            <Link key={item.id} href="/calendar" className="opsMenuLink" onClick={onClose}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <div className="opsMenuLinkTitle">{item.title}</div>
                  <div className="opsMenuLinkNote">{item.note}</div>
                </div>
                <div className={`opsSignalValue opsTone-${item.tone}`}>{item.amount}</div>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span className={`opsChip ${item.kind === "income" ? "opsChipBlue" : item.tone === "warning" ? "opsChipWarning" : "opsChipNeutral"}`}>
                  {item.kindLabel}
                </span>
                <span className="opsMenuLinkNote">{item.whenLabel}</span>
              </div>
            </Link>
          ))}

          <div style={{ paddingTop: 6 }}>
            <Link href="/calendar" className="opsTopButton opsTopButtonWide" onClick={onClose}>
              <CalendarDays size={14} />
              <span>Open calendar</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="opsEmpty">
          <div className="opsEmptyTitle">No scheduled money events</div>
          <div className="opsEmptyDetail">Nothing is queued for today or the next two weeks.</div>
          <div style={{ marginTop: 12 }}>
            <Link href="/calendar" className="opsTopButton opsTopButtonWide" onClick={onClose}>
              <CalendarDays size={14} />
              <span>Open calendar</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCell({ label, value, sub, tone = "neutral", active = false }) {
  return (
    <div className={`opsKpiCell ${active ? "opsKpiCellActive" : ""}`}>
      <div className="opsKpiLabel">{label}</div>
      <div className={`opsKpiValue opsTone-${tone}`}>{value}</div>
      <div className={`opsKpiSub opsTone-${tone === "neutral" ? "muted" : tone}`}>{sub}</div>
    </div>
  );
}

function CardHeader({ title, right }) {
  return (
    <div className="opsCardHead">
      <div className="opsCardTitle">{title}</div>
      <div className="opsCardHeadRight">{right}</div>
    </div>
  );
}

function StatRow({ label, value, tone = "neutral" }) {
  return (
    <div className="opsStatRow">
      <span className="opsStatRowLabel">{label}</span>
      <span className={`opsStatRowValue opsTone-${tone}`}>{value}</span>
    </div>
  );
}

function MetricCell({ label, value, sub, tone = "neutral" }) {
  return (
    <div className="opsMetricCell">
      <div className="opsMetricLabel">{label}</div>
      <div className={`opsMetricValue opsTone-${tone}`}>{value}</div>
      <div className="opsMetricSub">{sub}</div>
    </div>
  );
}

function LineChart({ series, compareSeries = [] }) {
  const linePath = buildSvgLinePath(series, 100, 36, 3.5);
  const areaPath = buildSvgAreaPath(series, 100, 36, 3.5);
  const comparePath = compareSeries.length
    ? buildSvgLinePath(compareSeries, 100, 36, 3.5)
    : "";
  const labels = sampleSeriesLabels(series, 6);

  return (
    <div className="opsChartWrap">
      <svg viewBox="0 0 100 36" className="opsChartSvg" preserveAspectRatio="none">
        <defs>
          <linearGradient id="opsAreaFade" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(164, 186, 232, 0.22)" />
            <stop offset="70%" stopColor="rgba(164, 186, 232, 0.05)" />
            <stop offset="100%" stopColor="rgba(164, 186, 232, 0)" />
          </linearGradient>
        </defs>

        {comparePath ? (
          <path
            d={comparePath}
            fill="none"
            stroke="rgba(108, 126, 166, 0.34)"
            strokeWidth="0.62"
            strokeDasharray="1.6 1.8"
            strokeLinecap="round"
          />
        ) : null}

        {areaPath ? <path d={areaPath} fill="url(#opsAreaFade)" /> : null}

        {linePath ? (
          <path
            d={linePath}
            fill="none"
            stroke="rgba(235, 240, 250, 0.98)"
            strokeWidth="0.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
      </svg>

      {labels.length ? (
        <div className="opsChartLabels">
          {labels.map((item) => (
            <span key={`${item.iso}-${item.index}`}>{item.label}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TransactionTable({ items }) {
  if (!items.length) {
    return (
      <div className="opsEmpty">
        <div className="opsEmptyTitle">No recent transactions</div>
        <div className="opsEmptyDetail">Once money moves, it will show here.</div>
      </div>
    );
  }

  return (
    <div className="opsTableWrap">
      <div className="opsTableHead">
        <span>Merchant</span>
        <span>Category</span>
        <span>Amount</span>
        <span>Date</span>
      </div>

      {items.map((item) => (
        <div className="opsTableRow" key={item.id}>
          <div className="opsTableCell opsTableCellMain">
            <div className="opsTableName">{item.title}</div>
            <div className="opsTableMeta">{item.accountName || item.source || item.note || "Recorded item"}</div>
          </div>
          <div className="opsTableCell">{item.category || "General"}</div>
          <div className={`opsTableCell opsTableAmount opsTone-${item.tone}`}>{item.value}</div>
          <div className="opsTableCell opsTableDate">{item.dateLabel}</div>
        </div>
      ))}
    </div>
  );
}

function BillList({ items }) {
  if (!items.length) {
    return (
      <div className="opsEmpty">
        <div className="opsEmptyTitle">No upcoming bills</div>
        <div className="opsEmptyDetail">Nothing is close enough to matter right now.</div>
      </div>
    );
  }

  return (
    <div className="opsBillList">
      {items.map((bill) => (
        <div className="opsBillRow" key={bill.id}>
          <div className={`opsBillIcon opsToneBg-${bill.tone}`}>
            <Receipt size={14} />
          </div>

          <div className="opsBillCopy">
            <div className="opsBillName">{bill.name}</div>
            <div className="opsBillMeta">{bill.meta}</div>
          </div>

          <div className="opsBillRight">
            <div className={`opsBillAmount opsTone-${bill.tone}`}>{bill.amount}</div>
            <div className={`opsBillStatus opsTone-${bill.tone}`}>{bill.status}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SignalCard({ items }) {
  if (!items.length) {
    return (
      <div className="opsEmpty">
        <div className="opsEmptyTitle">No active signals</div>
        <div className="opsEmptyDetail">The system is quiet right now.</div>
      </div>
    );
  }

  return (
    <div className="opsSignalList">
      {items.map((item) => (
        <div className="opsSignalItem" key={item.id}>
          <div className="opsSignalItemTop">
            <div className="opsSignalItemText">
              <strong>{item.title}</strong> — {item.detail}
            </div>
            <span className="opsSignalItemValue">{item.value}</span>
          </div>
          <div className={`opsSignalBar opsToneBg-${item.tone}`} />
        </div>
      ))}
    </div>
  );
}

function CategoryList({ items, total }) {
  if (!items.length || total <= 0) {
    return (
      <div className="opsEmpty">
        <div className="opsEmptyTitle">No spending mix yet</div>
        <div className="opsEmptyDetail">Log expenses to unlock category concentration.</div>
      </div>
    );
  }

  return (
    <div className="opsCategoryList">
      {items.map((item) => (
        <div className="opsCategoryRow" key={item.label}>
          <div className="opsCategoryLeft">
            <div className="opsCategoryLabel">{item.label}</div>
            <div className="opsCategoryBarTrack">
              <div className="opsCategoryBarFill" style={{ width: `${Math.max(4, Math.min(100, item.pct))}%` }} />
            </div>
          </div>

          <div className="opsCategoryRight">
            <div className="opsCategoryAmount">{money(item.amount)}</div>
            <div className="opsCategoryPct">{pct(item.pct, 0)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [search, setSearch] = useState("");

  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const [accounts, setAccounts] = useState([]);
  const [bills, setBills] = useState([]);
  const [spendingTx, setSpendingTx] = useState([]);
  const [incomeDeposits, setIncomeDeposits] = useState([]);
  const [investmentAssets, setInvestmentAssets] = useState([]);
  const [investmentTxns, setInvestmentTxns] = useState([]);
  const [savingsGoals, setSavingsGoals] = useState([]);
  const [quoteMap, setQuoteMap] = useState({});

  const topbarMenusRef = useRef(null);

  const closeAllPanels = useCallback(() => {
    setNotificationsOpen(false);
    setAddMenuOpen(false);
    setHelpOpen(false);
    setCalendarOpen(false);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      setLoading(true);
      setPageError("");

      try {
        if (!supabase) {
          throw new Error("Missing Supabase environment variables.");
        }

        const {
          data: { user: currentUser },
          error: userErr,
        } = await supabase.auth.getUser();

        if (userErr) throw userErr;

        if (!currentUser) {
          if (!mounted) return;
          setUser(null);
          setLoading(false);
          return;
        }

        if (!mounted) return;
        setUser(currentUser);

        const today = startOfToday();
        const prevMonthStart = startOfMonthISO(addMonthsClamped(today, -1));
        const monthEnd = endOfMonthISO(today);

        const [
          accRes,
          billsRes,
          spendingRes,
          incomeRes,
          assetRes,
          txnRes,
          goalsRes,
        ] = await Promise.all([
          supabase.from("accounts").select("*").eq("user_id", currentUser.id),
          supabase.from("bills").select("*").eq("user_id", currentUser.id),
          supabase
            .from("spending_transactions")
            .select("*")
            .eq("user_id", currentUser.id)
            .gte("tx_date", prevMonthStart)
            .lte("tx_date", monthEnd),
          supabase
            .from("income_deposits")
            .select("*")
            .eq("user_id", currentUser.id)
            .gte("deposit_date", prevMonthStart)
            .lte("deposit_date", monthEnd),
          supabase.from("investment_assets").select("*").eq("user_id", currentUser.id),
          supabase.from("investment_transactions").select("*").eq("user_id", currentUser.id),
          supabase.from("savings_goals").select("*").eq("user_id", currentUser.id),
        ]);

        if (accRes.error) throw accRes.error;
        if (billsRes.error) throw billsRes.error;
        if (spendingRes.error) throw spendingRes.error;
        if (incomeRes.error) throw incomeRes.error;
        if (assetRes.error) throw assetRes.error;
        if (txnRes.error) throw txnRes.error;
        if (goalsRes.error) throw goalsRes.error;

        const loadedAssets = (assetRes.data || []).map(mapInvestmentAssetRow);
        const nextQuotes = await fetchQuoteMap(
          loadedAssets.map((asset) => asset.symbol).filter(Boolean)
        );

        if (!mounted) return;

        setAccounts((accRes.data || []).map(mapAccountRowToClient));
        setBills((billsRes.data || []).map(mapBillRowToClient));
        setSpendingTx((spendingRes.data || []).map(mapSpendingTxRowToClient));
        setIncomeDeposits((incomeRes.data || []).map(mapIncomeDepositRowToClient));
        setInvestmentAssets(loadedAssets);
        setInvestmentTxns((txnRes.data || []).map(mapInvestmentTxnRow));
        setSavingsGoals((goalsRes.data || []).map(mapSavingsGoalRow));
        setQuoteMap(nextQuotes);
      } catch (err) {
        if (!mounted) return;
        setPageError(err?.message || "Failed to load dashboard.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!topbarMenusRef.current) return;
      if (!topbarMenusRef.current.contains(event.target)) {
        closeAllPanels();
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        closeAllPanels();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown, { passive: true });
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeAllPanels]);

  const computed = useMemo(() => {
    const today = startOfToday();
    const todayISO = toISODateLocal(today);
    const currentMonthStart = startOfMonthISO(today);
    const currentMonthKey = monthKeyFromISO(todayISO);

    const previousMonthDate = addMonthsClamped(today, -1);
    const previousMonthStart = startOfMonthISO(previousMonthDate);
    const previousMonthEnd = endOfMonthISO(previousMonthDate);
    const previousMonthKey = monthKeyFromISO(previousMonthStart);

    const incomeRows = buildCanonicalIncomeRows(spendingTx, incomeDeposits);

    const currentIncomeRows = incomeRows.filter(
      (row) => monthKeyFromISO(row.date) === currentMonthKey
    );
    const previousIncomeRows = incomeRows.filter(
      (row) => monthKeyFromISO(row.date) === previousMonthKey
    );

    const currentExpenseRows = spendingTx.filter((row) => {
      const type = String(row.type || "").toLowerCase();
      return (
        monthKeyFromISO(row.date) === currentMonthKey &&
        type !== "income" &&
        type !== "transfer"
      );
    });

    const previousExpenseRows = spendingTx.filter((row) => {
      const type = String(row.type || "").toLowerCase();
      return (
        monthKeyFromISO(row.date) === previousMonthKey &&
        type !== "income" &&
        type !== "transfer"
      );
    });

    const monthlyIncome = currentIncomeRows.reduce((sum, row) => sum + safeNum(row.amount, 0), 0);
    const monthlySpending = currentExpenseRows.reduce((sum, row) => sum + safeNum(row.amount, 0), 0);
    const monthMovement = monthlyIncome - monthlySpending;

    const billMetaList = bills
      .filter((bill) => bill.active !== false)
      .map((bill) => ({
        ...bill,
        ...getBillDueMeta(bill, today),
      }));

    const monthlyBillPressure = billMetaList.reduce(
      (sum, bill) => sum + getBillMonthlyPressureAmount(bill, today),
      0
    );

    const dueSoonBills = billMetaList
      .filter((bill) => bill.days != null && bill.days >= 0 && bill.days <= 14)
      .sort((a, b) => safeNum(a.days, 9999) - safeNum(b.days, 9999));

    const overdueBills = billMetaList
      .filter((bill) => bill.days != null && bill.days < 0)
      .sort((a, b) => safeNum(a.days, 0) - safeNum(b.days, 0));

    const upcomingBills = billMetaList
      .filter((bill) => bill.dueDate && bill.days != null && bill.days <= 30)
      .sort((a, b) => safeNum(a.days, 9999) - safeNum(b.days, 9999))
      .slice(0, 5);

    const dueSoonTotal = dueSoonBills.reduce((sum, bill) => sum + safeNum(bill.amountDue, 0), 0);

    const cashAccounts = accounts.filter(
      (account) => !isInvestmentAccount(account.type) && !isDebtAccount(account.type)
    );
    const liquidAccounts = accounts.filter((account) => isLiquidCashAccount(account.type));
    const creditAccounts = accounts.filter(
      (account) => normalizeAccountType(account.type) === "credit"
    );

    const cashTotal = cashAccounts.reduce((sum, account) => sum + safeNum(account.balance, 0), 0);
    const liquidTotal = liquidAccounts.reduce((sum, account) => sum + safeNum(account.balance, 0), 0);
    const creditDebt = creditAccounts.reduce(
      (sum, account) =>
        sum +
        Math.abs(Math.min(safeNum(account.balance, 0), 0)) +
        Math.max(safeNum(account.balance, 0), 0),
      0
    );

    const positionMap = buildPositionMap(investmentAssets, investmentTxns, quoteMap);
    const positions = [...positionMap.values()].filter((entry) => entry.shares > 0);
    const portfolioMarketValue = positions.reduce(
      (sum, entry) => sum + safeNum(entry.currentValue, 0),
      0
    );
    const portfolioCostBasis = positions.reduce(
      (sum, entry) => sum + safeNum(entry.basis, 0),
      0
    );
    const portfolioPnL = positions.reduce(
      (sum, entry) => sum + safeNum(entry.unrealizedPnl, 0),
      0
    );
    const investmentTotal = portfolioMarketValue || portfolioCostBasis;

    const netWorth = cashTotal + investmentTotal - creditDebt;

    const goalRows = [...savingsGoals].sort((a, b) => b.priority - a.priority);

    const cashFlowSeries = buildDailyCumulativeSeries(
      currentMonthStart,
      todayISO,
      currentIncomeRows,
      currentExpenseRows
    );

    const previousCashFlowSeries = buildDailyCumulativeSeries(
      previousMonthStart,
      previousMonthEnd,
      previousIncomeRows,
      previousExpenseRows
    );

    const spendingBuckets = buildSpendingBuckets(currentExpenseRows);
    const largestCategory = spendingBuckets.items[0] || null;
    const monthlyCapacity = monthlyIncome - monthlySpending - monthlyBillPressure;

    const recentTransactions = [
      ...currentIncomeRows.map((row) => ({
        id: `income-${row.id}`,
        title: row.label || "Income",
        category: "Income",
        accountName: row.note || "Deposit",
        value: signedMoney(row.amount),
        tone: "positive",
        dateLabel: fmtShort(row.date),
        rawDate: row.date || "",
      })),
      ...currentExpenseRows.map((row) => ({
        id: `expense-${row.id}`,
        title: row.merchant || "Expense",
        category: row.category || "Other",
        accountName: row.accountName || row.note || "Expense",
        value: signedMoney(-safeNum(row.amount, 0)),
        tone: "negative",
        dateLabel: fmtShort(row.date),
        rawDate: row.date || "",
      })),
    ]
      .sort((a, b) => {
        if (a.rawDate === b.rawDate) return String(b.id).localeCompare(String(a.id));
        return String(b.rawDate).localeCompare(String(a.rawDate));
      })
      .slice(0, 6);

    const notifications = [];

    overdueBills.forEach((bill) => {
      notifications.push({
        id: `overdue-${bill.id}`,
        title: `${bill.name} overdue`,
        detail: `${Math.abs(bill.days)} day${Math.abs(bill.days) === 1 ? "" : "s"} late`,
        value: money(bill.amountDue),
        tone: "negative",
      });
    });

    dueSoonBills.slice(0, 3).forEach((bill) => {
      notifications.push({
        id: `due-${bill.id}`,
        title: `${bill.name} due soon`,
        detail:
          bill.days === 0
            ? "Due today"
            : `Due in ${bill.days} day${bill.days === 1 ? "" : "s"}`,
        value: money(bill.amountDue),
        tone: bill.days <= 2 ? "negative" : "warning",
      });
    });

    if (monthlyIncome > 0 && monthlySpending > monthlyIncome) {
      notifications.push({
        id: "burn-rate",
        title: "Spending outpacing income",
        detail: "Current month outflow is higher than inflow.",
        value: signedMoney(monthMovement),
        tone: "warning",
      });
    }

    if (!goalRows.length) {
      notifications.push({
        id: "goals-empty",
        title: "No savings goal set",
        detail: "Liquid balance is idle with no active target.",
        value: money(liquidTotal),
        tone: "neutral",
      });
    }

    const q = normalizeText(search);
    const filteredTransactions = recentTransactions.filter((item) => {
      if (!q) return true;
      return (
        normalizeText(item.title).includes(q) ||
        normalizeText(item.category).includes(q) ||
        normalizeText(item.accountName).includes(q)
      );
    });

    const billCards = upcomingBills.map((bill) => {
      const tone =
        bill.days != null && bill.days < 0
          ? "negative"
          : bill.days != null && bill.days <= 7
          ? "warning"
          : "neutral";

      return {
        id: bill.id,
        name: bill.name,
        meta:
          bill.days == null
            ? "No due date"
            : bill.days < 0
            ? `Was due ${fmtShort(bill.dueDate)}`
            : `Due ${fmtShort(bill.dueDate)}`,
        amount: money(bill.amountDue),
        status:
          bill.days == null
            ? "Scheduled"
            : bill.days < 0
            ? "Overdue"
            : bill.days === 0
            ? "Today"
            : `${bill.days} day${bill.days === 1 ? "" : "s"}`,
        tone,
      };
    });

    const calendarBills = billMetaList
      .filter((bill) => bill.dueDate && bill.days != null && bill.days >= 0 && bill.days <= 14)
      .map((bill) => ({
        id: `cal-bill-${bill.id}`,
        rawDate: bill.dueDate,
        bucket: bill.days === 0 ? "today" : "upcoming",
        title: bill.name,
        note: bill.days === 0 ? "Payment due today" : `Bill due ${fmtShort(bill.dueDate)}`,
        amount: money(bill.amountDue),
        tone: bill.days <= 2 ? "warning" : "neutral",
        whenLabel: dayLabelFromDiff(bill.days),
        kind: "bill",
        kindLabel: "Bill",
      }));

    const calendarIncome = incomeRows
      .map((row) => {
        const days = diffCalendarDays(row.date, today);
        return {
          id: `cal-income-${row.id}`,
          rawDate: row.date,
          days,
          title: row.label || "Income",
          note: row.note || "Scheduled deposit",
          amount: signedMoney(row.amount),
          tone: "positive",
        };
      })
      .filter((row) => row.days != null && row.days >= 0 && row.days <= 14)
      .map((row) => ({
        id: row.id,
        rawDate: row.rawDate,
        bucket: row.days === 0 ? "today" : "upcoming",
        title: row.title,
        note: row.note,
        amount: row.amount,
        tone: row.tone,
        whenLabel: dayLabelFromDiff(row.days),
        kind: "income",
        kindLabel: "Income",
      }));

    const calendarItems = [...calendarBills, ...calendarIncome].sort((a, b) => {
      if (a.rawDate === b.rawDate) {
        if (a.kind === b.kind) return String(a.title).localeCompare(String(b.title));
        return a.kind === "income" ? -1 : 1;
      }
      return String(a.rawDate).localeCompare(String(b.rawDate));
    });

    const todayCalendarCount = calendarItems.filter((item) => item.bucket === "today").length;
    const upcomingCalendarCount = calendarItems.filter((item) => item.bucket === "upcoming").length;

    return {
      dateLabel: new Date().toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
      netWorth,
      accountsCount: accounts.length,
      cashTotal,
      liquidTotal,
      monthMovement,
      monthlyIncome,
      monthlySpending,
      monthlyBillPressure,
      dueSoonTotal,
      dueSoonCount: dueSoonBills.length,
      overdueCount: overdueBills.length,
      monthlyCapacity,
      investmentTotal,
      positionsCount: positions.length,
      cashFlowSeries,
      previousCashFlowSeries,
      filteredTransactions,
      billCards,
      notifications,
      notificationCount: notifications.length,
      spendingBuckets,
      largestCategory,
      portfolioPnL,
      calendarItems,
      todayCalendarCount,
      upcomingCalendarCount,
      totalCalendarCount: todayCalendarCount + upcomingCalendarCount,
    };
  }, [
    accounts,
    bills,
    spendingTx,
    incomeDeposits,
    investmentAssets,
    investmentTxns,
    savingsGoals,
    quoteMap,
    search,
  ]);

  function toggleNotifications() {
    setNotificationsOpen((prev) => {
      const next = !prev;
      setAddMenuOpen(false);
      setHelpOpen(false);
      setCalendarOpen(false);
      return next;
    });
  }

  function toggleCalendar() {
    setCalendarOpen((prev) => {
      const next = !prev;
      setNotificationsOpen(false);
      setAddMenuOpen(false);
      setHelpOpen(false);
      return next;
    });
  }

  function toggleAddMenu() {
    setAddMenuOpen((prev) => {
      const next = !prev;
      setNotificationsOpen(false);
      setHelpOpen(false);
      setCalendarOpen(false);
      return next;
    });
  }

  function toggleHelpMenu() {
    setHelpOpen((prev) => {
      const next = !prev;
      setNotificationsOpen(false);
      setAddMenuOpen(false);
      setCalendarOpen(false);
      return next;
    });
  }

  const addMenuItems = [
    { href: "/accounts", label: "Add account", note: "Create or adjust a money bucket." },
    { href: "/income", label: "Log income", note: "Record deposits and inflow." },
    { href: "/spending", label: "Add expense", note: "Capture true outflow or transfer." },
    { href: "/bills", label: "Add bill", note: "Create recurring or one-time pressure." },
    { href: "/savings", label: "Create goal", note: "Add a savings target to fund." },
  ];

  const helpMenuItems = [
    { href: "/accounts", label: "Open accounts", note: "Review live balance buckets." },
    { href: "/bills", label: "Open bills", note: "Manage due dates and pressure." },
    { href: "/calendar", label: "Open calendar", note: "See upcoming items on the board." },
  ];

  if (loading) {
    return (
      <main className="opsDashRoot">
        <GlassPane size="hero" className="opsShell">
          <div className="opsLoading">Loading dashboard.</div>
        </GlassPane>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="opsDashRoot">
        <GlassPane size="hero" className="opsShell">
          <div className="opsLoading">Please log in.</div>
          <div className="opsLoginSub">This dashboard requires an authenticated user.</div>
          <div style={{ marginTop: 14 }}>
            <Link href="/login" className="opsActionLink">
              Go to login <ArrowRight size={14} />
            </Link>
          </div>
        </GlassPane>
      </main>
    );
  }

  return (
    <main className="opsDashRoot">
      <GlassPane size="hero" className="opsShell">
        {pageError ? (
          <div className="opsErrorBox">
            <div className="opsErrorTitle">Dashboard error</div>
            <div className="opsErrorText">{pageError}</div>
          </div>
        ) : null}

        <div className="opsTopbar">
          <div className="opsTopbarLeft">
            <div className="opsBreadcrumb">
              Dashboard <span>/ Overview</span>
            </div>
            <div className="opsStatusPill">
              <div className="opsStatusDot" />
              <span>Live</span>
            </div>
            <div className="opsTopbarDate">{computed.dateLabel}</div>
          </div>

          <div className="opsTopbarRight" ref={topbarMenusRef}>
            <label className="opsSearch">
              <Search size={14} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={closeAllPanels}
                placeholder="Search workspace..."
              />
              <span>⌘K</span>
            </label>

            <div className="opsMenuWrap">
              <button
                type="button"
                className="opsTopButton"
                onClick={toggleNotifications}
                aria-label="Signals"
                aria-expanded={notificationsOpen}
              >
                <Bell size={14} />
                {computed.notificationCount ? (
                  <span className="opsTopButtonDot">{computed.notificationCount}</span>
                ) : null}
              </button>

              <NotificationPanel
                open={notificationsOpen}
                onClose={() => setNotificationsOpen(false)}
                items={computed.notifications}
              />
            </div>

            <div className="opsMenuWrap">
              <button
                type="button"
                className="opsTopButton opsTopButtonWide"
                onClick={toggleCalendar}
                aria-label="Calendar quick view"
                aria-expanded={calendarOpen}
              >
                <CalendarDays size={14} />
                <span>Calendar</span>
                {computed.totalCalendarCount ? (
                  <span className="opsTopButtonDot">{computed.totalCalendarCount}</span>
                ) : null}
              </button>

              <CalendarQuickPanel
                open={calendarOpen}
                onClose={() => setCalendarOpen(false)}
                items={computed.calendarItems}
                todayCount={computed.todayCalendarCount}
                upcomingCount={computed.upcomingCalendarCount}
              />
            </div>

            <div className="opsMenuWrap">
              <button
                type="button"
                className="opsTopButton opsTopButtonPrimary"
                onClick={toggleAddMenu}
                aria-expanded={addMenuOpen}
              >
                <Plus size={14} />
                <span>Add</span>
              </button>

              <MenuPanel
                title="Quick add"
                open={addMenuOpen}
                onClose={() => setAddMenuOpen(false)}
                items={addMenuItems}
              />
            </div>

            <div className="opsMenuWrap">
              <button
                type="button"
                className="opsTopButton"
                onClick={toggleHelpMenu}
                aria-label="Help"
                aria-expanded={helpOpen}
              >
                <CircleHelp size={14} />
              </button>

              <MenuPanel
                title="Helpful shortcuts"
                open={helpOpen}
                onClose={() => setHelpOpen(false)}
                items={helpMenuItems}
              />
            </div>
          </div>
        </div>

        <div className="opsKpiStrip">
          <KpiCell
            label="Net Worth"
            value={money(computed.netWorth)}
            sub={`${computed.accountsCount} accounts`}
            tone="neutral"
            active
          />
          <KpiCell
            label="Cash Available"
            value={money(computed.liquidTotal)}
            sub="liquid"
            tone="neutral"
          />
          <KpiCell
            label="Month Movement"
            value={signedMoney(computed.monthMovement)}
            sub={computed.monthMovement < 0 ? "spending > income" : "positive month flow"}
            tone={toneClass(computed.monthMovement)}
          />
          <KpiCell
            label="Income MTD"
            value={money(computed.monthlyIncome)}
            sub="recorded"
            tone="positive"
          />
          <KpiCell
            label="Spending MTD"
            value={money(computed.monthlySpending)}
            sub="true outflow"
            tone={computed.monthlySpending > computed.monthlyIncome ? "warning" : "neutral"}
          />
          <KpiCell
            label="Bill Pressure"
            value={money(computed.monthlyBillPressure)}
            sub={`${computed.overdueCount} overdue`}
            tone={computed.overdueCount ? "negative" : computed.dueSoonCount ? "warning" : "neutral"}
          />
        </div>

        <div className="opsContent">
          <div className="opsGrid2to1">
            <section className="opsCard opsCardLarge">
              <CardHeader
                title="Cash Position"
                right={
                  <div className="opsCardHeadRight">
                    <span className="opsChip opsChipBlue">Watch</span>
                    <span className="opsChip opsChipNeutral">{computed.notificationCount} signals</span>
                    <button type="button" className="opsGhostBtn" aria-label="More options">
                      <MoreHorizontal size={14} />
                    </button>
                  </div>
                }
              />

              <div className="opsHeroBlock">
                <div className="opsHeroValue">{money(computed.liquidTotal)}</div>
                <div className="opsHeroSub">
                  Month-to-date movement{" "}
                  <span className={`opsTone-${toneClass(computed.monthMovement)}`}>
                    {signedMoney(computed.monthMovement)}
                  </span>
                </div>
              </div>

              <LineChart
                series={computed.cashFlowSeries}
                compareSeries={computed.previousCashFlowSeries}
              />

              <div className="opsMetricRow">
                <MetricCell label="Income" value={money(computed.monthlyIncome)} sub="This month" tone="positive" />
                <MetricCell label="Spending" value={money(computed.monthlySpending)} sub="This month" tone="negative" />
                <MetricCell label="Liquid" value={money(computed.liquidTotal)} sub="Available now" />
                <MetricCell
                  label="Capacity"
                  value={signedMoney(computed.monthlyCapacity)}
                  sub="After spending & bills"
                  tone={toneClass(computed.monthlyCapacity)}
                />
              </div>
            </section>

            <section className="opsCard">
              <CardHeader
                title="Monthly Capacity"
                right={
                  <button type="button" className="opsGhostBtn" aria-label="More options">
                    <MoreHorizontal size={14} />
                  </button>
                }
              />

              <div className="opsGaugeTop">
                <div className="opsGaugeLabel">Income − Spending − Bills</div>
                <div className={`opsGaugeValue opsTone-${toneClass(computed.monthlyCapacity)}`}>
                  {signedMoney(computed.monthlyCapacity)}
                </div>
              </div>

              <div className="opsGaugeTrack">
                <div
                  className="opsGaugeFill"
                  style={{
                    width: `${Math.max(
                      6,
                      Math.min(
                        100,
                        computed.monthlyIncome > 0
                          ? (Math.abs(computed.monthlyCapacity) / Math.max(computed.monthlyIncome, 1)) * 100
                          : 14
                      )
                    )}%`,
                  }}
                />
              </div>

              <div className="opsGaugeSub">
                {computed.monthlyCapacity < 0
                  ? "Current pressure is consuming the month."
                  : "You still have room left to allocate."}
              </div>

              <div className="opsStatList">
                <StatRow label="Income" value={money(computed.monthlyIncome)} tone="positive" />
                <StatRow label="Spending" value={signedMoney(-computed.monthlySpending)} tone="negative" />
                <StatRow
                  label="Bill Pressure"
                  value={signedMoney(-computed.monthlyBillPressure)}
                  tone={computed.overdueCount ? "negative" : "warning"}
                />
                <StatRow
                  label="Due Soon"
                  value={money(computed.dueSoonTotal)}
                  tone={computed.dueSoonCount ? "warning" : "neutral"}
                />
              </div>
            </section>
          </div>

          <div className="opsGrid2to1">
            <section className="opsCard opsCardLarge">
              <CardHeader
                title="Recent Transactions"
                right={
                  <div className="opsCardHeadRight">
                    <span className="opsChip opsChipBlue">Latest</span>
                    <Link href="/spending" className="opsMiniAction">Open</Link>
                  </div>
                }
              />
              <TransactionTable items={computed.filteredTransactions} />
            </section>

            <section className="opsCard">
              <CardHeader
                title="Signals"
                right={<span className="opsChip opsChipNegative">{computed.notificationCount} active</span>}
              />
              <SignalCard items={computed.notifications.slice(0, 4)} />
            </section>
          </div>

          <div className="opsGrid3">
            <section className="opsCard">
              <CardHeader
                title="Upcoming Bills"
                right={
                  <div className="opsCardHeadRight">
                    <span className="opsChip opsChipWarning">{computed.overdueCount} overdue</span>
                    <Link href="/bills" className="opsMiniAction">Open</Link>
                  </div>
                }
              />
              <BillList items={computed.billCards} />
            </section>

            <section className="opsCard">
              <CardHeader
                title="Net Worth"
                right={
                  <div className="opsCardHeadRight">
                    <span className="opsChip opsChipBlue">{computed.accountsCount} accounts</span>
                  </div>
                }
              />

              <div className="opsWealthBlock">
                <div className="opsWealthValue">{money(computed.netWorth)}</div>
                <div className="opsWealthTrack">
                  <div
                    className="opsWealthFill"
                    style={{
                      width: `${Math.max(
                        8,
                        Math.min(
                          100,
                          computed.netWorth > 0 && computed.cashTotal > 0
                            ? (computed.netWorth / Math.max(computed.cashTotal + Math.max(computed.investmentTotal, 0), 1)) * 100
                            : 12
                        )
                      )}%`,
                    }}
                  />
                </div>
                <div className="opsWealthSub">
                  {computed.investmentTotal > 0
                    ? `${money(computed.investmentTotal)} invested`
                    : "No active investments yet"}
                </div>
              </div>

              <div className="opsStatList">
                <StatRow label="Assets" value={money(computed.cashTotal + computed.investmentTotal)} tone="positive" />
                <StatRow label="Cash" value={money(computed.cashTotal)} />
                <StatRow label="Investments" value={money(computed.investmentTotal)} tone={computed.positionsCount ? "positive" : "neutral"} />
                <StatRow label="Portfolio P/L" value={signedMoney(computed.portfolioPnL)} tone={toneClass(computed.portfolioPnL)} />
              </div>
            </section>

            <section className="opsCard">
              <CardHeader
                title="Spending Mix"
                right={
                  computed.largestCategory ? (
                    <span className="opsChip opsChipNeutral">{computed.largestCategory.label}</span>
                  ) : null
                }
              />
              <CategoryList items={computed.spendingBuckets.items.slice(0, 5)} total={computed.spendingBuckets.total} />
            </section>
          </div>
        </div>
      </GlassPane>
    </main>
  );
}
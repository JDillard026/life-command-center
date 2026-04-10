"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Layers3,
  ListTodo,
  Search,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import GlassPane from "../../components/GlassPane";
import styles from "../CalendarPage.module.css";

/* ──────────────────────────────────────────────────────────────────────────
   Constants
   ────────────────────────────────────────────────────────────────────────── */

const ALLOWED_VIEWS = new Set(["agenda", "month", "upcoming"]);
const DAY_MS = 86400000;

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

function normalizeText(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeFrequency(freq) {
  const value = String(freq || "").trim().toLowerCase();
  if (["weekly", "biweekly", "monthly", "quarterly", "yearly", "one_time"].includes(value)) {
    return value;
  }
  return "monthly";
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function startOfWeekSunday(date) {
  const out = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  out.setDate(out.getDate() - out.getDay());
  return out;
}

function endOfWeekSaturday(date) {
  const start = startOfWeekSunday(date);
  return addDays(start, 6);
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

function parseDateLike(value) {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const text = String(value).trim();
  if (!text) return null;

  const localDate = parseISODateLocal(text.slice(0, 10));
  if (localDate) return localDate;

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;

  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function extractDateTime(value) {
  if (!value) return { dateISO: "", timeLabel: "" };

  const text = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return { dateISO: text, timeLabel: "" };
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return {
      dateISO: text.slice(0, 10),
      timeLabel: text.includes("T") ? text.slice(11, 16) : "",
    };
  }

  return {
    dateISO: toISODateLocal(parsed),
    timeLabel: parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
  };
}

function diffDays(left, right = startOfToday()) {
  const a = left instanceof Date ? left : parseDateLike(left);
  const b = right instanceof Date ? right : parseDateLike(right);
  if (!a || !b) return null;

  const x = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const y = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((x - y) / DAY_MS);
}

function monthKey(dateOrIso) {
  const date = dateOrIso instanceof Date ? dateOrIso : parseDateLike(dateOrIso);
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function fmtMonthTitle(date) {
  return date.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function fmtDayShort(iso) {
  const date = parseDateLike(iso);
  if (!date) return "—";
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function fmtDayLong(iso) {
  const date = parseDateLike(iso);
  if (!date) return "—";
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function buildMonthGrid(anchorMonthDate) {
  const monthStart = startOfMonth(anchorMonthDate);
  const monthEnd = endOfMonth(anchorMonthDate);
  const gridStart = startOfWeekSunday(monthStart);
  const gridEnd = endOfWeekSaturday(monthEnd);

  const cells = [];
  let cursor = new Date(gridStart.getTime());

  while (cursor <= gridEnd) {
    cells.push(new Date(cursor.getTime()));
    cursor = addDays(cursor, 1);
  }

  return cells;
}

function getManualCalendarDate(row) {
  return (
    row.event_date ||
    row.date ||
    row.start_date ||
    row.due_date ||
    row.starts_on ||
    row.day ||
    extractDateTime(row.start_at || row.starts_at || row.datetime || row.timestamp).dateISO
  );
}

function getManualCalendarTime(row) {
  if (row.event_time) return String(row.event_time);
  if (row.time) return String(row.time);
  if (row.start_time) return String(row.start_time);
  if (row.starts_at || row.start_at || row.datetime || row.timestamp) {
    return extractDateTime(row.starts_at || row.start_at || row.datetime || row.timestamp).timeLabel;
  }
  return "";
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

function mapBillRow(row) {
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

function buildBillOccurrences(bill, rangeStart, rangeEnd, today) {
  if (bill.active === false) return [];

  const anchor = parseDateLike(bill.dueDate);
  const lastPaid = parseDateLike(bill.lastPaidDate);
  const freq = normalizeFrequency(bill.frequency);
  const amountDue = getEffectiveBillAmount(bill);

  if (!anchor) return [];

  const items = [];

  if (freq === "one_time") {
    if (lastPaid && anchor <= lastPaid) return [];
    if (anchor >= rangeStart && anchor <= rangeEnd) {
      const days = diffDays(anchor, today);
      items.push({
        id: `bill-${bill.id}-${toISODateLocal(anchor)}`,
        dateISO: toISODateLocal(anchor),
        timeLabel: "",
        title: bill.name,
        note: "Bill due",
        amount: amountDue,
        amountLabel: money(amountDue),
        kind: "bill",
        tone: days != null && days < 0 ? "negative" : days != null && days <= 3 ? "warning" : "neutral",
        sourceLabel: "Bills",
        href: "/bills",
      });
    }
    return items;
  }

  let current = new Date(anchor.getTime());
  let guard = 0;

  while (current < rangeStart && guard < 800) {
    current = addByFrequency(current, freq);
    guard += 1;
  }

  while (current <= rangeEnd && guard < 1600) {
    const include = !lastPaid || current > lastPaid;

    if (include) {
      const days = diffDays(current, today);
      items.push({
        id: `bill-${bill.id}-${toISODateLocal(current)}`,
        dateISO: toISODateLocal(current),
        timeLabel: "",
        title: bill.name,
        note: `${bill.frequency || "monthly"} bill`,
        amount: amountDue,
        amountLabel: money(amountDue),
        kind: "bill",
        tone: days != null && days < 0 ? "negative" : days != null && days <= 3 ? "warning" : "neutral",
        sourceLabel: "Bills",
        href: "/bills",
      });
    }

    current = addByFrequency(current, freq);
    guard += 1;
  }

  return items;
}

function mapManualEventRow(row) {
  const dateISO = getManualCalendarDate(row);
  if (!dateISO) return null;

  const amount = safeNum(row.amount, NaN);
  const sourceText = String(row.source || row.source_table || row.transaction_type || "manual").toLowerCase();

  let kind = "event";
  let tone = "neutral";

  if (sourceText.includes("income")) {
    kind = "income";
    tone = "positive";
  } else if (sourceText.includes("expense") || sourceText.includes("spending")) {
    kind = "expense";
    tone = "negative";
  } else if (sourceText.includes("bill")) {
    kind = "bill";
    tone = "warning";
  }

  return {
    id: `manual-${row.id}`,
    dateISO,
    timeLabel: getManualCalendarTime(row),
    title: row.title || row.name || row.label || "Calendar event",
    note: row.note || row.description || row.source || "Manual calendar item",
    amount: Number.isFinite(amount) ? amount : null,
    amountLabel: Number.isFinite(amount)
      ? kind === "income"
        ? signedMoney(amount)
        : kind === "expense" || kind === "bill"
        ? signedMoney(-Math.abs(amount))
        : money(amount)
      : "",
    kind,
    tone,
    sourceLabel: "Calendar",
    href: "/calendar",
  };
}

function mapPlannedSpendingRow(row) {
  const dateISO = row.planned_date || row.date || "";
  if (!dateISO) return null;

  const amount = safeNum(row.amount, 0);

  return {
    id: `planned-${row.id}`,
    dateISO,
    timeLabel: "",
    title: row.merchant || row.name || "Planned expense",
    note: row.note || "Planned spending item",
    amount,
    amountLabel: signedMoney(-Math.abs(amount)),
    kind: "expense",
    tone: "negative",
    sourceLabel: "Spending",
    href: "/spending",
  };
}

function mapIncomeDepositRow(row) {
  const dateISO = row.deposit_date || row.date || "";
  if (!dateISO) return null;

  const amount = safeNum(row.amount, 0);

  return {
    id: `deposit-${row.id}`,
    dateISO,
    timeLabel: "",
    title: row.source || "Income",
    note: row.note || "Recorded deposit",
    amount,
    amountLabel: signedMoney(amount),
    kind: "income",
    tone: "positive",
    sourceLabel: "Income",
    href: "/income",
  };
}

function mapSpendingTransactionRow(row) {
  const dateISO = row.tx_date || row.date || "";
  if (!dateISO) return null;

  const type = String(row.type || "expense").toLowerCase();
  const amount = safeNum(row.amount, 0);

  if (type === "transfer") {
    return {
      id: `tx-${row.id}`,
      dateISO,
      timeLabel: "",
      title: row.merchant || "Transfer",
      note: row.note || row.account_name || "Money transfer",
      amount,
      amountLabel: money(amount),
      kind: "transfer",
      tone: "neutral",
      sourceLabel: "Spending",
      href: "/spending",
    };
  }

  if (type === "income") {
    return {
      id: `tx-${row.id}`,
      dateISO,
      timeLabel: "",
      title: row.merchant || "Income",
      note: row.note || row.account_name || "Recorded income",
      amount,
      amountLabel: signedMoney(amount),
      kind: "income",
      tone: "positive",
      sourceLabel: "Spending",
      href: "/spending",
    };
  }

  return {
    id: `tx-${row.id}`,
    dateISO,
    timeLabel: "",
    title: row.merchant || "Expense",
    note:
      row.note ||
      row.account_name ||
      row.category ||
      row.category_name ||
      "Recorded expense",
    amount,
    amountLabel: signedMoney(-Math.abs(amount)),
    kind: "expense",
    tone: "negative",
    sourceLabel: "Spending",
    href: "/spending",
  };
}

function sortEvents(a, b) {
  if (a.dateISO !== b.dateISO) return String(a.dateISO).localeCompare(String(b.dateISO));
  if ((a.timeLabel || "") !== (b.timeLabel || "")) {
    return String(a.timeLabel || "").localeCompare(String(b.timeLabel || ""));
  }
  return String(a.title || "").localeCompare(String(b.title || ""));
}

function buildSearchHaystack(event) {
  return normalizeText(
    [
      event.title,
      event.note,
      event.kind,
      event.sourceLabel,
      event.amountLabel,
      event.dateISO,
    ].join(" ")
  );
}

function groupedByDay(events) {
  const map = new Map();

  events.forEach((event) => {
    const key = event.dateISO || "";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(event);
  });

  return [...map.entries()]
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    .map(([dateISO, items]) => ({
      dateISO,
      items: items.sort(sortEvents),
    }));
}

function toneAmountClass(stylesObj, tone) {
  if (tone === "positive") return stylesObj.amountPositive;
  if (tone === "negative") return stylesObj.amountNegative;
  if (tone === "warning") return stylesObj.amountWarning;
  return stylesObj.amountNeutral;
}

function eventDotClass(stylesObj, tone) {
  if (tone === "positive") return stylesObj.dotPositive;
  if (tone === "negative") return stylesObj.dotNegative;
  if (tone === "warning") return stylesObj.dotWarning;
  return stylesObj.dotNeutral;
}

function eventPillClass(stylesObj, tone) {
  if (tone === "positive") return stylesObj.pillPositive;
  if (tone === "negative") return stylesObj.pillNegative;
  if (tone === "warning") return stylesObj.pillWarning;
  return stylesObj.pillNeutral;
}

function upcomingBucketLabel(days) {
  if (days === 0) return "Today";
  if (days >= 1 && days <= 7) return "Next 7 days";
  return "Later";
}

function buildUpcomingBuckets(events, today) {
  const buckets = {
    Today: [],
    "Next 7 days": [],
    Later: [],
  };

  events.forEach((event) => {
    const days = diffDays(event.dateISO, today);
    if (days == null || days < 0) return;
    const key = upcomingBucketLabel(days);
    buckets[key].push({ ...event, daysAway: days });
  });

  return Object.entries(buckets)
    .map(([label, items]) => ({
      label,
      items: items.sort(sortEvents),
    }))
    .filter((bucket) => bucket.items.length);
}

function relativeDayLabel(days) {
  if (days == null) return "";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

/* ──────────────────────────────────────────────────────────────────────────
   UI
   ────────────────────────────────────────────────────────────────────────── */

function ViewTab({ href, active, icon: Icon, label }) {
  return (
    <Link href={href} className={`${styles.viewTab} ${active ? styles.viewTabActive : ""}`}>
      <Icon size={14} />
      <span>{label}</span>
    </Link>
  );
}

function SummaryCard({ label, value, sub, tone = "neutral" }) {
  return (
    <div className={styles.summaryCard}>
      <div className={styles.summaryLabel}>{label}</div>
      <div
        className={`${styles.summaryValue} ${
          tone === "positive"
            ? styles.valuePositive
            : tone === "negative"
            ? styles.valueNegative
            : tone === "warning"
            ? styles.valueWarning
            : ""
        }`}
      >
        {value}
      </div>
      <div className={styles.summarySub}>{sub}</div>
    </div>
  );
}

function EventRow({ event, selected = false, onClick }) {
  return (
    <button
      type="button"
      className={`${styles.eventRow} ${selected ? styles.eventRowSelected : ""}`}
      onClick={onClick}
    >
      <div className={styles.eventLeft}>
        <div className={`${styles.eventMarker} ${eventDotClass(styles, event.tone)}`} />
        <div className={styles.eventMain}>
          <div className={styles.eventTitle}>{event.title}</div>
          <div className={styles.eventMeta}>
            <span>{event.timeLabel || "All day"}</span>
            <span>•</span>
            <span>{event.note}</span>
          </div>
        </div>
      </div>

      <div className={styles.eventRight}>
        {event.amountLabel ? (
          <div className={`${styles.eventAmount} ${toneAmountClass(styles, event.tone)}`}>
            {event.amountLabel}
          </div>
        ) : null}
        <div className={styles.eventSource}>{event.sourceLabel}</div>
      </div>
    </button>
  );
}

function MonthBoard({
  anchorMonthDate,
  selectedISO,
  onSelectDay,
  monthEventsMap,
  todayISO,
}) {
  const cells = useMemo(() => buildMonthGrid(anchorMonthDate), [anchorMonthDate]);
  const currentMonthKey = monthKey(anchorMonthDate);

  const weekdayRow = useMemo(() => {
    const start = startOfWeekSunday(startOfToday());
    return Array.from({ length: 7 }, (_, i) =>
      addDays(start, i).toLocaleDateString(undefined, { weekday: "short" })
    );
  }, []);

  const currentMonthDays = useMemo(() => {
    const start = startOfMonth(anchorMonthDate);
    const end = endOfMonth(anchorMonthDate);
    const out = [];
    let cursor = new Date(start.getTime());

    while (cursor <= end) {
      out.push(new Date(cursor.getTime()));
      cursor = addDays(cursor, 1);
    }

    return out;
  }, [anchorMonthDate]);

  return (
    <div className={styles.monthBoard}>
      <div className={styles.weekdayRow}>
        {weekdayRow.map((label) => (
          <div key={label} className={styles.weekdayCell}>
            {label}
          </div>
        ))}
      </div>

      <div className={styles.monthGrid}>
        {cells.map((cellDate) => {
          const iso = toISODateLocal(cellDate);
          const events = monthEventsMap.get(iso) || [];
          const isOutside = monthKey(cellDate) !== currentMonthKey;
          const isSelected = iso === selectedISO;
          const isToday = iso === todayISO;

          return (
            <button
              type="button"
              key={iso}
              className={`${styles.monthCell} ${isOutside ? styles.monthCellMuted : ""} ${
                isSelected ? styles.monthCellSelected : ""
              } ${isToday ? styles.monthCellToday : ""}`}
              onClick={() => onSelectDay(iso)}
            >
              <div className={styles.monthCellTop}>
                <span className={styles.monthDayNumber}>{cellDate.getDate()}</span>
                {events.length ? <span className={styles.monthCount}>{events.length}</span> : null}
              </div>

              <div className={styles.monthCellItems}>
                {events.slice(0, 4).map((event) => (
                  <div key={event.id} className={styles.monthItem}>
                    <span className={`${styles.monthItemDot} ${eventDotClass(styles, event.tone)}`} />
                    <span className={styles.monthItemText}>
                      {event.timeLabel ? `${event.timeLabel} ` : ""}
                      {event.title}
                    </span>
                  </div>
                ))}

                {events.length > 4 ? (
                  <div className={styles.monthMore}>+{events.length - 4} more</div>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      <div className={styles.mobileMonthList}>
        {currentMonthDays.map((day) => {
          const iso = toISODateLocal(day);
          const events = monthEventsMap.get(iso) || [];
          const isSelected = iso === selectedISO;
          const isToday = iso === todayISO;

          return (
            <button
              type="button"
              key={iso}
              className={`${styles.mobileDayCard} ${isSelected ? styles.mobileDayCardSelected : ""}`}
              onClick={() => onSelectDay(iso)}
            >
              <div className={styles.mobileDayHead}>
                <div>
                  <div className={styles.mobileDayLabel}>
                    {day.toLocaleDateString(undefined, { weekday: "short" })}
                  </div>
                  <div className={styles.mobileDayNumber}>
                    {day.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </div>
                </div>

                <div className={styles.mobileDayBadges}>
                  {isToday ? <span className={styles.todayBadge}>Today</span> : null}
                  {events.length ? <span className={styles.countBadge}>{events.length}</span> : null}
                </div>
              </div>

              <div className={styles.mobileDayItems}>
                {events.length ? (
                  events.slice(0, 4).map((event) => (
                    <div key={event.id} className={styles.mobileDayItem}>
                      <span className={`${styles.monthItemDot} ${eventDotClass(styles, event.tone)}`} />
                      <span className={styles.mobileDayItemText}>
                        {event.timeLabel ? `${event.timeLabel} ` : ""}
                        {event.title}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className={styles.mobileDayEmpty}>No scheduled items</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AgendaBoard({ groups, selectedISO, onSelectDay }) {
  if (!groups.length) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyTitle}>Nothing scheduled in this window</div>
        <div className={styles.emptyText}>Try another view or a different search.</div>
      </div>
    );
  }

  return (
    <div className={styles.agendaBoard}>
      {groups.map((group) => {
        const totalIncome = group.items
          .filter((item) => item.kind === "income")
          .reduce((sum, item) => sum + safeNum(item.amount, 0), 0);

        const totalOut = group.items
          .filter((item) => item.kind === "expense" || item.kind === "bill")
          .reduce((sum, item) => sum + safeNum(item.amount, 0), 0);

        return (
          <div key={group.dateISO} className={styles.agendaGroup}>
            <button
              type="button"
              className={`${styles.agendaGroupHead} ${
                group.dateISO === selectedISO ? styles.agendaGroupHeadSelected : ""
              }`}
              onClick={() => onSelectDay(group.dateISO)}
            >
              <div>
                <div className={styles.agendaDate}>{fmtDayLong(group.dateISO)}</div>
                <div className={styles.agendaDateSub}>
                  {group.items.length} item{group.items.length === 1 ? "" : "s"}
                </div>
              </div>

              <div className={styles.agendaTotals}>
                {totalIncome > 0 ? (
                  <span className={styles.agendaIncome}>
                    <ArrowUpRight size={12} />
                    {money(totalIncome)}
                  </span>
                ) : null}
                {totalOut > 0 ? (
                  <span className={styles.agendaOut}>
                    <ArrowDownRight size={12} />
                    {money(totalOut)}
                  </span>
                ) : null}
              </div>
            </button>

            <div className={styles.timelineList}>
              {group.items.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  selected={group.dateISO === selectedISO}
                  onClick={() => onSelectDay(group.dateISO)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function UpcomingBoard({ buckets, onSelectDay }) {
  if (!buckets.length) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyTitle}>No upcoming scheduled events</div>
        <div className={styles.emptyText}>Nothing is queued in the current window.</div>
      </div>
    );
  }

  return (
    <div className={styles.upcomingBoard}>
      {buckets.map((bucket) => (
        <div key={bucket.label} className={styles.bucketSection}>
          <div className={styles.bucketHead}>
            <div className={styles.bucketTitle}>{bucket.label}</div>
            <div className={styles.bucketCount}>{bucket.items.length}</div>
          </div>

          <div className={styles.bucketList}>
            {bucket.items.map((event) => (
              <button
                type="button"
                key={event.id}
                className={styles.upcomingRow}
                onClick={() => onSelectDay(event.dateISO)}
              >
                <div className={styles.upcomingRowDate}>
                  <div className={styles.upcomingRowDay}>{fmtDayShort(event.dateISO)}</div>
                  <div className={styles.upcomingRowRelative}>{relativeDayLabel(event.daysAway)}</div>
                </div>

                <div className={styles.upcomingRowMain}>
                  <div className={styles.upcomingRowTitleWrap}>
                    <span className={`${styles.monthItemDot} ${eventDotClass(styles, event.tone)}`} />
                    <span className={styles.upcomingRowTitle}>{event.title}</span>
                    <span className={`${styles.kindPill} ${eventPillClass(styles, event.tone)}`}>
                      {event.kind}
                    </span>
                  </div>
                  <div className={styles.upcomingRowMeta}>
                    {event.timeLabel || "All day"} • {event.note}
                  </div>
                </div>

                <div className={styles.upcomingRowRight}>
                  {event.amountLabel ? (
                    <div className={`${styles.upcomingRowAmount} ${toneAmountClass(styles, event.tone)}`}>
                      {event.amountLabel}
                    </div>
                  ) : null}
                  <div className={styles.upcomingRowSource}>{event.sourceLabel}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DayInspector({ dateISO, events }) {
  const incomeTotal = events
    .filter((item) => item.kind === "income")
    .reduce((sum, item) => sum + safeNum(item.amount, 0), 0);

  const outflowTotal = events
    .filter((item) => item.kind === "expense" || item.kind === "bill")
    .reduce((sum, item) => sum + safeNum(item.amount, 0), 0);

  return (
    <GlassPane className={styles.railCard}>
      <div className={styles.railCardInner}>
        <div className={styles.railEyebrow}>Selected day</div>
        <div className={styles.railTitle}>{fmtDayLong(dateISO)}</div>

        <div className={styles.dayStatGrid}>
          <div className={styles.dayStat}>
            <div className={styles.dayStatLabel}>Income</div>
            <div className={`${styles.dayStatValue} ${styles.valuePositive}`}>
              {incomeTotal > 0 ? money(incomeTotal) : "—"}
            </div>
          </div>

          <div className={styles.dayStat}>
            <div className={styles.dayStatLabel}>Outflow</div>
            <div className={`${styles.dayStatValue} ${styles.valueNegative}`}>
              {outflowTotal > 0 ? money(outflowTotal) : "—"}
            </div>
          </div>

          <div className={styles.dayStat}>
            <div className={styles.dayStatLabel}>Items</div>
            <div className={styles.dayStatValue}>{events.length}</div>
          </div>

          <div className={styles.dayStat}>
            <div className={styles.dayStatLabel}>Net</div>
            <div
              className={`${styles.dayStatValue} ${
                incomeTotal - outflowTotal > 0
                  ? styles.valuePositive
                  : incomeTotal - outflowTotal < 0
                  ? styles.valueNegative
                  : ""
              }`}
            >
              {events.length ? signedMoney(incomeTotal - outflowTotal) : "—"}
            </div>
          </div>
        </div>

        <div className={styles.inspectorList}>
          {events.length ? (
            events.map((event) => (
              <Link key={event.id} href={event.href || "/calendar"} className={styles.inspectorItem}>
                <div className={styles.inspectorItemLeft}>
                  <span className={`${styles.monthItemDot} ${eventDotClass(styles, event.tone)}`} />
                  <div>
                    <div className={styles.inspectorItemTitle}>{event.title}</div>
                    <div className={styles.inspectorItemMeta}>
                      {event.timeLabel || "All day"} • {event.note}
                    </div>
                  </div>
                </div>

                {event.amountLabel ? (
                  <div className={`${styles.inspectorItemValue} ${toneAmountClass(styles, event.tone)}`}>
                    {event.amountLabel}
                  </div>
                ) : null}
              </Link>
            ))
          ) : (
            <div className={styles.emptyBlock}>
              <div className={styles.emptyTitle}>No items on this day</div>
              <div className={styles.emptyText}>Pick another day with activity.</div>
            </div>
          )}
        </div>
      </div>
    </GlassPane>
  );
}

function QueueCard({ title, items }) {
  return (
    <GlassPane className={styles.railCard}>
      <div className={styles.railCardInner}>
        <div className={styles.railHeadRow}>
          <div>
            <div className={styles.railEyebrow}>Upcoming queue</div>
            <div className={styles.railTitleSmall}>{title}</div>
          </div>
          <span className={styles.miniBadge}>{items.length}</span>
        </div>

        <div className={styles.queueList}>
          {items.length ? (
            items.map((event) => (
              <Link key={event.id} href={event.href || "/calendar"} className={styles.queueItem}>
                <div className={styles.queueItemMain}>
                  <span className={`${styles.monthItemDot} ${eventDotClass(styles, event.tone)}`} />
                  <div>
                    <div className={styles.queueItemTitle}>{event.title}</div>
                    <div className={styles.queueItemMeta}>
                      {fmtDayShort(event.dateISO)}
                      {event.timeLabel ? ` • ${event.timeLabel}` : ""}
                    </div>
                  </div>
                </div>
                {event.amountLabel ? (
                  <div className={`${styles.queueItemValue} ${toneAmountClass(styles, event.tone)}`}>
                    {event.amountLabel}
                  </div>
                ) : null}
              </Link>
            ))
          ) : (
            <div className={styles.emptyBlock}>
              <div className={styles.emptyTitle}>Queue is clear</div>
              <div className={styles.emptyText}>Nothing else is scheduled soon.</div>
            </div>
          )}
        </div>
      </div>
    </GlassPane>
  );
}

function SnapshotCard({ snapshot }) {
  return (
    <GlassPane className={styles.railCard}>
      <div className={styles.railCardInner}>
        <div className={styles.railEyebrow}>Window snapshot</div>
        <div className={styles.railTitleSmall}>Next 60 days</div>

        <div className={styles.snapshotGrid}>
          <div className={styles.snapshotCell}>
            <div className={styles.snapshotLabel}>Events</div>
            <div className={styles.snapshotValue}>{snapshot.totalCount}</div>
          </div>
          <div className={styles.snapshotCell}>
            <div className={styles.snapshotLabel}>Bills</div>
            <div className={`${styles.snapshotValue} ${styles.valueWarning}`}>{snapshot.billCount}</div>
          </div>
          <div className={styles.snapshotCell}>
            <div className={styles.snapshotLabel}>Income</div>
            <div className={`${styles.snapshotValue} ${styles.valuePositive}`}>{money(snapshot.incomeTotal)}</div>
          </div>
          <div className={styles.snapshotCell}>
            <div className={styles.snapshotLabel}>Outflow</div>
            <div className={`${styles.snapshotValue} ${styles.valueNegative}`}>{money(snapshot.outflowTotal)}</div>
          </div>
        </div>

        <div className={styles.snapshotFooter}>
          <div className={styles.snapshotFooterLabel}>Next event</div>
          <div className={styles.snapshotFooterValue}>
            {snapshot.nextEvent
              ? `${snapshot.nextEvent.title} • ${fmtDayShort(snapshot.nextEvent.dateISO)}`
              : "Nothing upcoming"}
          </div>
        </div>
      </div>
    </GlassPane>
  );
}

function LegendCard() {
  return (
    <GlassPane className={styles.railCard}>
      <div className={styles.railCardInner}>
        <div className={styles.railEyebrow}>Legend</div>
        <div className={styles.legendList}>
          <div className={styles.legendRow}>
            <span className={`${styles.monthItemDot} ${styles.dotPositive}`} />
            <span>Income / payday</span>
          </div>
          <div className={styles.legendRow}>
            <span className={`${styles.monthItemDot} ${styles.dotNegative}`} />
            <span>Expense / outflow</span>
          </div>
          <div className={styles.legendRow}>
            <span className={`${styles.monthItemDot} ${styles.dotWarning}`} />
            <span>Bill pressure</span>
          </div>
          <div className={styles.legendRow}>
            <span className={`${styles.monthItemDot} ${styles.dotNeutral}`} />
            <span>Manual event / transfer</span>
          </div>
        </div>
      </div>
    </GlassPane>
  );
}

export default function CalendarViewPage() {
  const params = useParams();
  const rawView = String(params?.view || "agenda").toLowerCase();
  const view = ALLOWED_VIEWS.has(rawView) ? rawView : "agenda";

  const today = useMemo(() => startOfToday(), []);
  const todayISO = useMemo(() => toISODateLocal(today), [today]);

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [search, setSearch] = useState("");

  const [manualEvents, setManualEvents] = useState([]);
  const [bills, setBills] = useState([]);
  const [plannedItems, setPlannedItems] = useState([]);
  const [spendingTx, setSpendingTx] = useState([]);
  const [incomeDeposits, setIncomeDeposits] = useState([]);

  const [selectedISO, setSelectedISO] = useState(todayISO);
  const [anchorMonthDate, setAnchorMonthDate] = useState(startOfMonth(today));

  useEffect(() => {
    let mounted = true;

    async function loadPage() {
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

        const rangeStart = toISODateLocal(addDays(today, -120));
        const rangeEnd = toISODateLocal(addDays(today, 180));

        const [calendarRes, billsRes, plannedRes, spendingRes, incomeRes] = await Promise.all([
          supabase.from("calendar_events").select("*").eq("user_id", currentUser.id),
          supabase.from("bills").select("*").eq("user_id", currentUser.id),
          supabase
            .from("spending_planned_items")
            .select("*")
            .eq("user_id", currentUser.id)
            .gte("planned_date", rangeStart)
            .lte("planned_date", rangeEnd),
          supabase
            .from("spending_transactions")
            .select("*")
            .eq("user_id", currentUser.id)
            .gte("tx_date", rangeStart)
            .lte("tx_date", rangeEnd),
          supabase
            .from("income_deposits")
            .select("*")
            .eq("user_id", currentUser.id)
            .gte("deposit_date", rangeStart)
            .lte("deposit_date", rangeEnd),
        ]);

        if (calendarRes.error) throw calendarRes.error;
        if (billsRes.error) throw billsRes.error;
        if (plannedRes.error) throw plannedRes.error;
        if (spendingRes.error) throw spendingRes.error;
        if (incomeRes.error) throw incomeRes.error;

        if (!mounted) return;

        setManualEvents((calendarRes.data || []).map(mapManualEventRow).filter(Boolean));
        setBills((billsRes.data || []).map(mapBillRow));
        setPlannedItems((plannedRes.data || []).map(mapPlannedSpendingRow).filter(Boolean));
        setSpendingTx((spendingRes.data || []).map(mapSpendingTransactionRow).filter(Boolean));
        setIncomeDeposits((incomeRes.data || []).map(mapIncomeDepositRow).filter(Boolean));
      } catch (err) {
        if (!mounted) return;
        setPageError(err?.message || "Failed to load calendar.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadPage();

    return () => {
      mounted = false;
    };
  }, [today]);

  const computed = useMemo(() => {
    const rangeStart = addDays(today, -120);
    const rangeEnd = addDays(today, 180);

    const billEvents = bills.flatMap((bill) =>
      buildBillOccurrences(bill, rangeStart, rangeEnd, today)
    );

    const allEventsRaw = [
      ...manualEvents,
      ...billEvents,
      ...plannedItems,
      ...spendingTx,
      ...incomeDeposits,
    ].filter(Boolean);

    const q = normalizeText(search);

    const filteredEvents = allEventsRaw
      .filter((event) => (q ? buildSearchHaystack(event).includes(q) : true))
      .sort(sortEvents);

    const allEventsMap = new Map();
    filteredEvents.forEach((event) => {
      if (!allEventsMap.has(event.dateISO)) allEventsMap.set(event.dateISO, []);
      allEventsMap.get(event.dateISO).push(event);
    });

    const monthEvents = filteredEvents.filter(
      (event) => monthKey(event.dateISO) === monthKey(anchorMonthDate)
    );

    const monthEventsMap = new Map();
    monthEvents.forEach((event) => {
      if (!monthEventsMap.has(event.dateISO)) monthEventsMap.set(event.dateISO, []);
      monthEventsMap.get(event.dateISO).push(event);
    });

    const agendaStart = addDays(today, -14);
    const agendaEnd = addDays(today, 45);

    const agendaEvents = filteredEvents.filter((event) => {
      const date = parseDateLike(event.dateISO);
      return date && date >= agendaStart && date <= agendaEnd;
    });

    const groupedAgenda = groupedByDay(agendaEvents);

    const upcomingEventsWindow = filteredEvents.filter((event) => {
      const date = parseDateLike(event.dateISO);
      return date && date >= today && date <= addDays(today, 60);
    });

    const upcomingBuckets = buildUpcomingBuckets(upcomingEventsWindow, today);

    const currentMonthEventDates = [...new Set(monthEvents.map((event) => event.dateISO))].sort();
    const agendaDates = groupedAgenda.map((group) => group.dateISO);
    const upcomingDates = [...new Set(upcomingEventsWindow.map((event) => event.dateISO))].sort();

    let preferredSelectedISO = selectedISO;

    if (view === "month") {
      const selectedHasItems =
        monthKey(selectedISO) === monthKey(anchorMonthDate) &&
        safeNum(monthEventsMap.get(selectedISO)?.length, 0) > 0;

      if (!selectedHasItems) {
        if (monthKey(todayISO) === monthKey(anchorMonthDate) && safeNum(monthEventsMap.get(todayISO)?.length, 0) > 0) {
          preferredSelectedISO = todayISO;
        } else if (currentMonthEventDates.length) {
          preferredSelectedISO = currentMonthEventDates[0];
        } else if (monthKey(todayISO) === monthKey(anchorMonthDate)) {
          preferredSelectedISO = todayISO;
        } else {
          preferredSelectedISO = toISODateLocal(startOfMonth(anchorMonthDate));
        }
      }
    } else if (view === "agenda") {
      preferredSelectedISO = agendaDates.includes(selectedISO)
        ? selectedISO
        : agendaDates[0] || todayISO;
    } else {
      preferredSelectedISO = upcomingDates.includes(selectedISO)
        ? selectedISO
        : upcomingDates[0] || todayISO;
    }

    const selectedDayEvents = (allEventsMap.get(preferredSelectedISO) || []).slice().sort(sortEvents);

    const todayCount = filteredEvents.filter((event) => event.dateISO === todayISO).length;

    const dueSoonCount = filteredEvents.filter((event) => {
      const date = parseDateLike(event.dateISO);
      const days = diffDays(date, today);
      return event.kind === "bill" && days != null && days >= 0 && days <= 7;
    }).length;

    const monthIncome = monthEvents
      .filter((event) => event.kind === "income")
      .reduce((sum, event) => sum + safeNum(event.amount, 0), 0);

    const monthOutflow = monthEvents
      .filter((event) => event.kind === "expense" || event.kind === "bill")
      .reduce((sum, event) => sum + safeNum(event.amount, 0), 0);

    const manualCount = filteredEvents.filter((event) => event.kind === "event").length;

    const queueItems = upcomingEventsWindow.slice(0, 8);

    const upcomingSnapshot = {
      totalCount: upcomingEventsWindow.length,
      billCount: upcomingEventsWindow.filter((event) => event.kind === "bill").length,
      incomeTotal: upcomingEventsWindow
        .filter((event) => event.kind === "income")
        .reduce((sum, event) => sum + safeNum(event.amount, 0), 0),
      outflowTotal: upcomingEventsWindow
        .filter((event) => event.kind === "expense" || event.kind === "bill")
        .reduce((sum, event) => sum + safeNum(event.amount, 0), 0),
      nextEvent: upcomingEventsWindow[0] || null,
    };

    return {
      filteredEvents,
      monthEventsMap,
      groupedAgenda,
      upcomingBuckets,
      selectedDayEvents,
      preferredSelectedISO,
      todayCount,
      dueSoonCount,
      monthIncome,
      monthOutflow,
      manualCount,
      queueItems,
      upcomingSnapshot,
    };
  }, [
    anchorMonthDate,
    bills,
    incomeDeposits,
    manualEvents,
    plannedItems,
    search,
    selectedISO,
    spendingTx,
    today,
    todayISO,
    view,
  ]);

  useEffect(() => {
    if (computed.preferredSelectedISO && computed.preferredSelectedISO !== selectedISO) {
      setSelectedISO(computed.preferredSelectedISO);
    }
  }, [computed.preferredSelectedISO, selectedISO]);

  function handleSelectDay(iso) {
    setSelectedISO(iso);
    const date = parseDateLike(iso);
    if (date) {
      setAnchorMonthDate(startOfMonth(date));
    }
  }

  function goPrevMonth() {
    const next = startOfMonth(addMonthsClamped(anchorMonthDate, -1));
    setAnchorMonthDate(next);
  }

  function goNextMonth() {
    const next = startOfMonth(addMonthsClamped(anchorMonthDate, 1));
    setAnchorMonthDate(next);
  }

  function goToday() {
    setAnchorMonthDate(startOfMonth(today));
    setSelectedISO(todayISO);
  }

  if (loading) {
    return (
      <main className={styles.page}>
        <GlassPane size="hero" className={styles.shell}>
          <div className={styles.loading}>Loading calendar.</div>
        </GlassPane>
      </main>
    );
  }

  if (!user) {
    return (
      <main className={styles.page}>
        <GlassPane size="hero" className={styles.shell}>
          <div className={styles.loading}>Please log in.</div>
        </GlassPane>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <GlassPane size="hero" className={styles.shell}>
        <div className={styles.content}>
          {pageError ? (
            <div className={styles.errorBox}>
              <div className={styles.errorTitle}>Calendar error</div>
              <div className={styles.errorText}>{pageError}</div>
            </div>
          ) : null}

          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <div className={styles.eyebrow}>Calendar / Command Board</div>
              <div className={styles.titleRow}>
                <h1 className={styles.title}>Financial calendar</h1>
                <div className={styles.titlePills}>
                  <span className={styles.livePill}>
                    <Sparkles size={12} />
                    <span>Live</span>
                  </span>
                  <span className={styles.monthLabel}>{fmtMonthTitle(anchorMonthDate)}</span>
                </div>
              </div>
            </div>

            <div className={styles.headerRight}>
              <label className={styles.search}>
                <Search size={14} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search scheduled money..."
                />
              </label>

              <div className={styles.viewTabs}>
                <ViewTab
                  href="/calendar/agenda"
                  active={view === "agenda"}
                  icon={ListTodo}
                  label="Agenda"
                />
                <ViewTab
                  href="/calendar/month"
                  active={view === "month"}
                  icon={CalendarDays}
                  label="Month"
                />
                <ViewTab
                  href="/calendar/upcoming"
                  active={view === "upcoming"}
                  icon={Layers3}
                  label="Upcoming"
                />
              </div>
            </div>
          </div>

          <div className={styles.summaryGrid}>
            <SummaryCard
              label="Today"
              value={String(computed.todayCount)}
              sub="items on the board"
            />
            <SummaryCard
              label="Bills due soon"
              value={String(computed.dueSoonCount)}
              sub="next 7 days"
              tone={computed.dueSoonCount ? "warning" : "neutral"}
            />
            <SummaryCard
              label="Income this month"
              value={money(computed.monthIncome)}
              sub="paydays and deposits"
              tone="positive"
            />
            <SummaryCard
              label="Outflow this month"
              value={money(computed.monthOutflow)}
              sub="bills and spending"
              tone={computed.monthOutflow > computed.monthIncome ? "negative" : "warning"}
            />
            <SummaryCard
              label="Manual events"
              value={String(computed.manualCount)}
              sub="calendar-only items"
            />
          </div>

          <div className={styles.board}>
            <div className={styles.mainColumn}>
              <GlassPane className={styles.mainCard}>
                <div className={styles.cardInner}>
                  <div className={styles.mainCardHead}>
                    <div>
                      <div className={styles.cardEyebrow}>
                        {view === "month"
                          ? "Month board"
                          : view === "upcoming"
                          ? "Upcoming queue"
                          : "Agenda"}
                      </div>
                      <div className={styles.cardTitle}>
                        {view === "month"
                          ? "Month overview"
                          : view === "upcoming"
                          ? "Next scheduled events"
                          : "Timeline agenda"}
                      </div>
                    </div>

                    <div className={styles.monthControls}>
                      <button type="button" className={styles.navButton} onClick={goPrevMonth} aria-label="Previous month">
                        <ChevronLeft size={15} />
                      </button>
                      <button type="button" className={styles.todayButton} onClick={goToday}>
                        Today
                      </button>
                      <button type="button" className={styles.navButton} onClick={goNextMonth} aria-label="Next month">
                        <ChevronRight size={15} />
                      </button>
                    </div>
                  </div>

                  {view === "month" ? (
                    <MonthBoard
                      anchorMonthDate={anchorMonthDate}
                      selectedISO={computed.preferredSelectedISO}
                      onSelectDay={handleSelectDay}
                      monthEventsMap={computed.monthEventsMap}
                      todayISO={todayISO}
                    />
                  ) : view === "upcoming" ? (
                    <UpcomingBoard
                      buckets={computed.upcomingBuckets}
                      onSelectDay={handleSelectDay}
                    />
                  ) : (
                    <AgendaBoard
                      groups={computed.groupedAgenda}
                      selectedISO={computed.preferredSelectedISO}
                      onSelectDay={handleSelectDay}
                    />
                  )}
                </div>
              </GlassPane>
            </div>

            <div className={styles.railColumn}>
              <div className={styles.railStack}>
                <DayInspector
                  dateISO={computed.preferredSelectedISO}
                  events={computed.selectedDayEvents}
                />

                {view === "upcoming" ? (
                  <SnapshotCard snapshot={computed.upcomingSnapshot} />
                ) : (
                  <QueueCard title="Next money events" items={computed.queueItems} />
                )}

                <LegendCard />
              </div>
            </div>
          </div>
        </div>
      </GlassPane>
    </main>
  );
}
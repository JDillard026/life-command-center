import { writeAccountDelta, writeIncomeDepositSplits } from "@/lib/accountLedger";

export const DEFAULT_SETTINGS = {
  goalMonthly: 8000,
  schedule: "BIWEEKLY",
  anchorDate: todayISO(),
  paycheckAmt: 2000,
  bonusEstimate: 0,
  defaultAccountId: "",
  defaultProfileId: "",
  autoCreateCalendar: false,
  paydayEventTime: "09:00",
  viewMonth: todayISO().slice(0, 7),
};

export function uid() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function safeNum(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

export function round2(n) {
  return Math.round((safeNum(n) + Number.EPSILON) * 100) / 100;
}

export function parseMoneyInput(v) {
  const cleaned = String(v ?? "").replace(/[^0-9.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : NaN;
}

export function money(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "$0.00";
  return num.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function shortMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "$0";
  return num.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function dateLabel(iso) {
  const d = toDateOnly(iso);
  if (!d) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatAgo(value) {
  if (!value) return "—";
  const ms = Date.now() - new Date(value).getTime();
  const minutes = Math.round(ms / 60000);
  if (!Number.isFinite(minutes)) return "—";
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function fmtMonthLabel(ym) {
  if (!ym || ym.length < 7) return "—";
  const [y, m] = ym.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export function monthKeyFromISO(iso) {
  const s = String(iso || "");
  return s.length >= 7 ? s.slice(0, 7) : "";
}

export function toDateOnly(value) {
  const s = String(value || "").trim();
  if (!s) return null;
  const d = new Date(`${s}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function addDays(dateValue, days) {
  const base = dateValue instanceof Date ? dateValue : toDateOnly(dateValue);
  if (!base) return new Date();
  const x = new Date(base.getTime());
  x.setDate(x.getDate() + Number(days || 0));
  return x;
}

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function pct(n, d) {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return 0;
  return (n / d) * 100;
}

export function daysInMonth(year, monthIndex0) {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

export function startOfMonthDate(ym) {
  const [y, m] = String(ym || "").split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return null;
  return new Date(y, m - 1, 1, 12);
}

export function endOfMonthDate(ym) {
  const [y, m] = String(ym || "").split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return null;
  return new Date(y, m - 1, daysInMonth(y, m - 1), 12);
}

export function niceSourceLabel(s) {
  const raw = String(s || "").trim();
  return raw || "Income";
}

export function timeLabel(hhmm) {
  if (!hhmm) return "All day";
  const [h, m] = String(hhmm).split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function toneMeta(tone = "neutral") {
  if (tone === "good") {
    return {
      text: "#97efc7",
      border: "rgba(116, 231, 174, 0.22)",
      glow: "rgba(116, 231, 174, 0.12)",
    };
  }
  if (tone === "warn") {
    return {
      text: "#f5cf88",
      border: "rgba(245, 207, 136, 0.22)",
      glow: "rgba(245, 207, 136, 0.12)",
    };
  }
  if (tone === "bad") {
    return {
      text: "#ff646b",
      border: "rgba(255, 100, 107, 0.24)",
      glow: "rgba(255, 100, 107, 0.12)",
    };
  }
  if (tone === "blue") {
    return {
      text: "#bcd7ff",
      border: "rgba(126, 160, 255, 0.22)",
      glow: "rgba(110, 163, 255, 0.12)",
    };
  }
  return {
    text: "#f7fbff",
    border: "rgba(214, 226, 255, 0.14)",
    glow: "rgba(140, 170, 255, 0.08)",
  };
}

export function sortDeposits(list = []) {
  return [...list].sort((a, b) => {
    if (a.date !== b.date) return String(b.date).localeCompare(String(a.date));
    return Number(b.createdAt || 0) - Number(a.createdAt || 0);
  });
}

export function normalizeDeposit(raw) {
  const x = raw || {};
  return {
    id: String(x.id || uid()),
    date: String(x.date || todayISO()),
    source: String(x.source || "Income"),
    amount: round2(x.amount),
    note: String(x.note || ""),
    createdAt: Number.isFinite(Number(x.createdAt)) ? Number(x.createdAt) : Date.now(),
    accountId: x.accountId ? String(x.accountId) : "",
    accountName: x.accountName ? String(x.accountName) : "",
  };
}

export function normalizeScheduled(raw) {
  const x = raw || {};
  return {
    id: String(x.id || uid()),
    pay_date: String(x.pay_date || todayISO()),
    expected_amount: round2(x.expected_amount),
    source: String(x.source || "Paycheck"),
    note: String(x.note || ""),
    account_id: x.account_id ? String(x.account_id) : "",
    account_name: x.account_name ? String(x.account_name) : "",
    status: String(x.status || "scheduled"),
    calendar_event_id: x.calendar_event_id ? String(x.calendar_event_id) : "",
    created_at: x.created_at || new Date().toISOString(),
    projected: Boolean(x.projected),
  };
}

export function mapDepositRowToClient(row) {
  return normalizeDeposit({
    id: row.id,
    date: row.deposit_date,
    source: row.source,
    amount: row.amount,
    note: row.note,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    accountId: row.account_id || "",
    accountName: row.account_name || "",
  });
}

export function mapIncomeSettingsRowToClient(row) {
  const base = { ...DEFAULT_SETTINGS };
  return {
    goalMonthly: safeNum(row?.goal_monthly, base.goalMonthly),
    schedule: row?.schedule ? String(row.schedule) : base.schedule,
    anchorDate: row?.anchor_date ? String(row.anchor_date) : base.anchorDate,
    paycheckAmt: safeNum(row?.paycheck_amt, base.paycheckAmt),
    bonusEstimate: safeNum(row?.bonus_estimate, base.bonusEstimate),
    viewMonth: row?.view_month ? String(row.view_month) : base.viewMonth,
    defaultAccountId: row?.default_account_id ? String(row.default_account_id) : "",
    defaultProfileId: row?.default_profile_id ? String(row.default_profile_id) : "",
    autoCreateCalendar: Boolean(row?.auto_create_calendar),
    paydayEventTime: row?.payday_event_time ? String(row.payday_event_time) : base.paydayEventTime,
  };
}

export function mapIncomeSettingsClientToRow(settings, userId) {
  return {
    user_id: userId,
    goal_monthly: round2(settings.goalMonthly),
    schedule: String(settings.schedule || "BIWEEKLY").toUpperCase(),
    anchor_date: settings.anchorDate || null,
    paycheck_amt: round2(settings.paycheckAmt),
    bonus_estimate: round2(settings.bonusEstimate),
    view_month: settings.viewMonth || todayISO().slice(0, 7),
    default_account_id: settings.defaultAccountId || null,
    default_profile_id: settings.defaultProfileId || null,
    auto_create_calendar: Boolean(settings.autoCreateCalendar),
    payday_event_time: settings.paydayEventTime || null,
    updated_at: new Date().toISOString(),
  };
}

export function computeProjectedPaydaysForMonth({ monthYM, schedule, anchorDateISO }) {
  const start = startOfMonthDate(monthYM);
  const end = endOfMonthDate(monthYM);
  if (!start || !end) return [];

  const mode = String(schedule || "BIWEEKLY").toUpperCase();

  if (mode === "TWICE_MONTHLY") {
    const [y, m] = monthYM.split("-").map(Number);
    const d1 = new Date(y, m - 1, 1, 12);
    const d15 = new Date(y, m - 1, 15, 12);
    return [d1, d15]
      .filter((d) => d >= start && d <= end)
      .map((d) => ({ id: `proj-${d.toISOString().slice(0, 10)}`, pay_date: d.toISOString().slice(0, 10), projected: true }));
  }

  if (mode === "MONTHLY") {
    const [y, m] = monthYM.split("-").map(Number);
    const d1 = new Date(y, m - 1, 1, 12);
    return [d1]
      .filter((d) => d >= start && d <= end)
      .map((d) => ({ id: `proj-${d.toISOString().slice(0, 10)}`, pay_date: d.toISOString().slice(0, 10), projected: true }));
  }

  const step = mode === "WEEKLY" ? 7 : 14;
  const anchor = toDateOnly(anchorDateISO);
  if (!anchor) return [];

  let cur = new Date(anchor.getTime());
  while (cur > end) cur = addDays(cur, -step);
  while (addDays(cur, step) < start) cur = addDays(cur, step);

  const out = [];
  let iter = new Date(cur.getTime());
  while (iter < start) iter = addDays(iter, step);

  while (iter <= end) {
    out.push({ id: `proj-${iter.toISOString().slice(0, 10)}`, pay_date: iter.toISOString().slice(0, 10), projected: true });
    iter = addDays(iter, step);
  }

  return out;
}

export function buildQueueEntries({ monthDeposits, scheduled, projectedOnly, search = "", filter = "all" }) {
  const q = search.trim().toLowerCase();
  const combined = [
    ...monthDeposits.map((item) => ({
      key: `received:${item.id}`,
      type: "received",
      id: item.id,
      date: item.date,
      amount: round2(item.amount),
      source: niceSourceLabel(item.source),
      note: item.note || "",
      accountName: item.accountName || "",
      createdAt: item.createdAt || 0,
      label: "Received",
    })),
    ...scheduled.map((item) => ({
      key: `scheduled:${item.id}`,
      type: "scheduled",
      id: item.id,
      date: item.pay_date,
      amount: round2(item.expected_amount),
      source: niceSourceLabel(item.source),
      note: item.note || "",
      accountName: item.account_name || "",
      status: item.status || "scheduled",
      createdAt: item.created_at ? new Date(item.created_at).getTime() : 0,
      label: "Scheduled",
      calendarEventId: item.calendar_event_id || "",
    })),
    ...projectedOnly.map((item) => ({
      key: `projected:${item.id}`,
      type: "projected",
      id: item.id,
      date: item.pay_date,
      amount: null,
      source: "Projected payday",
      note: "Expected based on your current schedule settings.",
      accountName: "",
      createdAt: 0,
      label: "Projected",
    })),
  ];

  return combined
    .filter((item) => {
      if (filter !== "all" && item.type !== filter) return false;
      if (!q) return true;
      return [item.source, item.note, item.accountName, item.date, item.label]
        .join(" ")
        .toLowerCase()
        .includes(q);
    })
    .sort((a, b) => {
      if (a.date !== b.date) return String(b.date).localeCompare(String(a.date));
      return Number(b.createdAt || 0) - Number(a.createdAt || 0);
    });
}

export function buildIncomeSummary({ deposits, scheduled, settings, viewMonth }) {
  const todayIso = todayISO();
  const today = toDateOnly(todayIso) || new Date();
  const targetMonth = viewMonth || monthKeyFromISO(todayIso);
  const goalNum = round2(settings.goalMonthly);

  const monthDeposits = sortDeposits(
    deposits.filter((deposit) => monthKeyFromISO(deposit.date) === targetMonth)
  );
  const monthTotal = round2(monthDeposits.reduce((sum, deposit) => sum + safeNum(deposit.amount), 0));

  const monthScheduled = [...scheduled]
    .filter((item) => monthKeyFromISO(item.pay_date) === targetMonth && item.status === "scheduled")
    .sort((a, b) => String(a.pay_date).localeCompare(String(b.pay_date)));

  const projectedMonthDates = computeProjectedPaydaysForMonth({
    monthYM: targetMonth,
    schedule: settings.schedule,
    anchorDateISO: settings.anchorDate,
  });

  const scheduledDates = new Set(monthScheduled.map((item) => item.pay_date));
  const projectedOnly = projectedMonthDates.filter((item) => !scheduledDates.has(item.pay_date));

  const start = startOfMonthDate(targetMonth);
  const dim = start ? daysInMonth(start.getFullYear(), start.getMonth()) : 30;
  const currentMonthKey = monthKeyFromISO(todayIso);

  let dayNum = 1;
  let daysLeft = dim;

  if (targetMonth === currentMonthKey) {
    dayNum = clamp(today.getDate(), 1, dim);
    daysLeft = Math.max(1, dim - dayNum + 1);
  } else if (targetMonth < currentMonthKey) {
    dayNum = dim;
    daysLeft = 0;
  } else {
    dayNum = 0;
    daysLeft = dim;
  }

  const remaining = Math.max(0, goalNum - monthTotal);
  const neededPerDay = daysLeft > 0 ? round2(remaining / daysLeft) : remaining;
  const paceToday =
    targetMonth === currentMonthKey
      ? round2((goalNum * dayNum) / dim)
      : targetMonth < currentMonthKey
      ? goalNum
      : 0;
  const gap = round2(monthTotal - paceToday);
  const behindBy = Math.max(0, -gap);
  const aheadBy = Math.max(0, gap);

  const sourceMap = new Map();
  for (const deposit of monthDeposits) {
    const key = niceSourceLabel(deposit.source);
    sourceMap.set(key, round2((sourceMap.get(key) || 0) + safeNum(deposit.amount)));
  }

  const sourceBreakdown = [...sourceMap.entries()]
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total - a.total);

  const last7Start = addDays(today, -6);
  const last7Total = round2(
    deposits
      .filter((deposit) => {
        const dd = toDateOnly(deposit.date);
        return dd && dd >= last7Start && dd <= today;
      })
      .reduce((sum, deposit) => sum + safeNum(deposit.amount), 0)
  );

  const depositStreak = (() => {
    let streak = 0;
    for (let i = 0; i < 60; i += 1) {
      const test = addDays(today, -i).toISOString().slice(0, 10);
      const has = deposits.some((deposit) => deposit.date === test);
      if (has) streak += 1;
      else break;
    }
    return streak;
  })();

  const projectedThisMonth = round2(
    monthTotal +
      monthScheduled.reduce((sum, item) => sum + safeNum(item.expected_amount), 0) +
      safeNum(settings.bonusEstimate)
  );

  const nextScheduled = monthScheduled[0] || null;
  const nextProjected = projectedOnly[0] || null;
  const selectedDeposit = monthDeposits[0] || null;
  const routedCount = monthDeposits.filter((deposit) => deposit.accountId).length;

  return {
    goalNum,
    targetMonth,
    monthDeposits,
    monthTotal,
    remaining,
    neededPerDay,
    paceToday,
    behindBy,
    aheadBy,
    progressPct: pct(monthTotal, goalNum),
    projectedThisMonth,
    projectedPct: pct(projectedThisMonth, goalNum),
    shortByProjection: Math.max(0, round2(goalNum - projectedThisMonth)),
    upcomingScheduled: monthScheduled,
    sourceBreakdown,
    projectedMonthDates,
    projectedOnly,
    last7Total,
    depositStreak,
    nextScheduled,
    nextProjected,
    selectedDeposit,
    routedCount,
  };
}

export function buildQuickForm(settings, mode = "received") {
  return {
    mode,
    date: todayISO(),
    source: "Paycheck",
    amount:
      mode === "received" && safeNum(settings.paycheckAmt) > 0
        ? String(settings.paycheckAmt)
        : "",
    note: "",
    destinationAccountId: settings.defaultAccountId || "",
    createCalendarEvent: false,
  };
}

export function buildEditForm(deposit) {
  return {
    id: deposit?.id || "",
    date: deposit?.date || todayISO(),
    source: deposit?.source || "",
    amount: deposit ? String(deposit.amount ?? "") : "",
    note: deposit?.note || "",
  };
}

export async function addDepositLedger({
  userId,
  accountId,
  accountName,
  amountValue,
  sourceId,
  sourceLabel,
  noteText,
  createdAt,
}) {
  if (!userId || !accountId || safeNum(amountValue) <= 0) {
    return { ok: true, message: "" };
  }

  try {
    await writeIncomeDepositSplits({
      userId,
      splits: [{ accountId, amount: Number(amountValue), accountName: accountName || "" }],
      source: sourceLabel || "Income",
      note: noteText || "",
      sourceType: "income_deposit",
      sourceId,
      createdAt,
    });

    return { ok: true, message: `Posted to ${accountName || "account"}.` };
  } catch (err) {
    return { ok: false, message: err?.message || "Income deposit ledger write failed." };
  }
}

export async function reverseDepositLedger({ userId, deposit, reasonKind = "income_delete", noteSuffix = "deleted" }) {
  if (!userId || !deposit?.accountId || safeNum(deposit.amount) <= 0) {
    return { ok: true };
  }

  await writeAccountDelta({
    userId,
    accountId: deposit.accountId,
    delta: -Number(deposit.amount),
    kind: reasonKind,
    amount: Number(deposit.amount),
    note: `${deposit.source || "Income"}${deposit.note ? ` • ${deposit.note}` : ""} • ${noteSuffix}`,
    sourceType: reasonKind,
    sourceId: deposit.id,
    createdAt: new Date().toISOString(),
  });

  return { ok: true };
}

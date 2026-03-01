// lib/projectionEngine.js
// Pure logic: given events + bills + starting balance, return 30-day projection.
// No React, no localStorage, no UI.

const pad2 = (n) => String(n).padStart(2, "0");

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function addDaysISO(iso, delta) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function safeNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function parseISO(iso) {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/**
 * Recurrence match:
 * rec: { freq:"none"|"weekly"|"monthly", interval, byWeekday?, byMonthday?, until? }
 */
export function recurrenceMatchesDate(rec, dateISO, anchorISO) {
  if (!rec || rec.freq === "none") return false;
  if (rec.until && String(dateISO) > String(rec.until)) return false;

  const d = parseISO(dateISO);
  const a = parseISO(anchorISO);
  if (!d || !a) return false;

  const interval = clamp(Number(rec.interval ?? 1), 1, 52);

  if (rec.freq === "weekly") {
    const by = Number(rec.byWeekday);
    if (!Number.isFinite(by)) return false;
    if (d.getDay() !== by) return false;

    const aWeek = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    aWeek.setDate(aWeek.getDate() - aWeek.getDay());
    const dWeek = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    dWeek.setDate(dWeek.getDate() - dWeek.getDay());

    const diffWeeks = Math.round((dWeek.getTime() - aWeek.getTime()) / (7 * 86400000));
    return diffWeeks >= 0 && diffWeeks % interval === 0;
  }

  if (rec.freq === "monthly") {
    let md = Number(rec.byMonthday);
    if (!Number.isFinite(md)) return false;

    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    md = clamp(md, 1, 31);
    const effective = Math.min(md, lastDay);
    if (d.getDate() !== effective) return false;

    const am = a.getFullYear() * 12 + a.getMonth();
    const dm = d.getFullYear() * 12 + d.getMonth();
    const diff = dm - am;
    return diff >= 0 && diff % interval === 0;
  }

  return false;
}

function isException(base, instanceDate) {
  const ex = Array.isArray(base?.exceptions) ? base.exceptions : [];
  return ex.includes(instanceDate);
}

function applyOverrides(base, instanceDate) {
  const ov = base?.overrides?.[instanceDate] || null;
  if (!ov) return base;
  return { ...base, ...ov };
}

/**
 * Expand repeating + overrides into instances for [startISO..endISO]
 * Input event shape expected:
 *  { id, title, date, flow, amount, recurrence, exceptions, overrides }
 */
export function expandEventInstances(events, startISO, endISO) {
  const out = [];
  const list = Array.isArray(events) ? events : [];

  for (const base of list) {
    if (!base?.date || !base?.id) continue;

    const rec = base.recurrence || { freq: "none" };
    const baseDate = String(base.date).slice(0, 10);

    const pushInstance = (iso, isRecurring) => {
      if (iso < startISO || iso > endISO) return;
      if (isException(base, iso)) return;

      const applied = applyOverrides(base, iso);
      out.push({
        ...applied,
        _baseId: base.id,
        _instanceDate: iso,
        _isRecurringInstance: isRecurring,
      });
    };

    pushInstance(baseDate, false);

    if (rec && rec.freq !== "none") {
      for (let iso = startISO; iso <= endISO; iso = addDaysISO(iso, 1)) {
        if (iso === baseDate) continue;
        if (recurrenceMatchesDate(rec, iso, baseDate)) pushInstance(iso, true);
      }
    }
  }

  return out;
}

/**
 * Bills expected shape:
 *  { dueDate: "YYYY-MM-DD", amount: number, name }
 */
export function projectCashFlow({
  startDateISO,
  days = 30,
  startingBalance,
  events = [],
  bills = [],
}) {
  const start = String(startDateISO || todayISO()).slice(0, 10);
  const horizon = clamp(Number(days || 30), 7, 365);

  const startBal = safeNum(startingBalance);
  if (startBal === null) {
    return {
      ok: false,
      error: "startingBalance_missing",
      message: "Starting balance is required (from Accounts page).",
    };
  }

  const end = addDaysISO(start, horizon - 1);

  const instances = expandEventInstances(events, start, end);

  // Build daily buckets
  const byDate = new Map();
  for (let i = 0; i < horizon; i++) {
    const d = addDaysISO(start, i);
    byDate.set(d, { income: 0, expense: 0, bills: 0, items: [] });
  }

  // Events
  for (const inst of instances) {
    const date = String(inst._instanceDate).slice(0, 10);
    if (!byDate.has(date)) continue;

    const amt = safeNum(inst.amount);
    if (amt === null) continue; // ignore no-amount for projection

    const flow = String(inst.flow || "neutral").toLowerCase();
    if (flow === "income") {
      byDate.get(date).income += amt;
      byDate.get(date).items.push({ type: "income", title: inst.title || "Income", amount: amt });
    } else if (flow === "expense") {
      byDate.get(date).expense += amt;
      byDate.get(date).items.push({ type: "expense", title: inst.title || "Expense", amount: amt });
    }
  }

  // Bills always subtract
  const billList = Array.isArray(bills) ? bills : [];
  for (const b of billList) {
    const due = String(b?.dueDate || "").slice(0, 10);
    if (!due || !byDate.has(due)) continue;

    const amt = safeNum(b.amount);
    if (amt === null) continue;

    byDate.get(due).bills += amt;
    byDate.get(due).items.push({ type: "bill", title: b.name || "Bill", amount: amt });
  }

  // Simulate
  let balance = startBal;
  let lowestBalance = balance;
  let lowestDate = start;

  let totalIncome = 0;
  let totalExpense = 0;
  let totalBills = 0;

  const daily = [];

  for (let i = 0; i < horizon; i++) {
    const date = addDaysISO(start, i);
    const bucket = byDate.get(date);

    totalIncome += bucket.income;
    totalExpense += bucket.expense;
    totalBills += bucket.bills;

    balance = balance + bucket.income - bucket.expense - bucket.bills;

    if (balance < lowestBalance) {
      lowestBalance = balance;
      lowestDate = date;
    }

    daily.push({
      date,
      income: bucket.income,
      expense: bucket.expense,
      bills: bucket.bills,
      netChange: bucket.income - bucket.expense - bucket.bills,
      balance,
      items: bucket.items,
    });
  }

  return {
    ok: true,
    startDate: start,
    endDate: end,
    startingBalance: startBal,
    projectedEndBalance: balance,
    lowestBalance,
    lowestDate,
    totalIncome,
    totalExpenses: totalExpense,
    totalBills,
    totalOut: totalExpense + totalBills,
    daily,
  };
}
"use client";

export const FREQS = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
  { value: "one_time", label: "One Time" },
];

export const STRATEGY_OPTIONS = [
  { value: "avalanche", label: "Avalanche" },
  { value: "snowball", label: "Snowball" },
  { value: "urgent", label: "Urgent First" },
];

export function uid() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

export function safeNum(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

export function round2(n) {
  return Math.round((safeNum(n) + Number.EPSILON) * 100) / 100;
}

export function parseMoneyInput(value) {
  const cleaned = String(value ?? "").replace(/[^0-9.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : NaN;
}

export function isoDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

export function parseIsoParts(iso) {
  const match = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return { yyyy: +match[1], mm: +match[2], dd: +match[3] };
}

export function isoToLocalDate(iso, hour = 12) {
  const parts = parseIsoParts(String(iso || "").slice(0, 10));
  if (!parts) return null;
  return new Date(parts.yyyy, parts.mm - 1, parts.dd, hour, 0, 0, 0);
}

export function isoSerial(iso) {
  const parts = parseIsoParts(String(iso || "").slice(0, 10));
  if (!parts) return null;
  return Math.floor(Date.UTC(parts.yyyy, parts.mm - 1, parts.dd) / 86400000);
}

export function todaySerial() {
  const now = new Date();
  return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
}

export function compareIsoDates(a, b) {
  const aa = isoSerial(a);
  const bb = isoSerial(b);
  if (!Number.isFinite(aa) || !Number.isFinite(bb)) return 0;
  return aa - bb;
}

export function money(n) {
  const value = Number(n);
  if (!Number.isFinite(value)) return "$0";
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function moneyTight(n) {
  const value = Number(n);
  if (!Number.isFinite(value)) return "$0.00";
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function shortDate(value) {
  if (!value) return "—";
  const date = isoToLocalDate(String(value).slice(0, 10), 12) || new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function fmtAgo(value) {
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

export function monthKeyOf(value) {
  const parts = parseIsoParts(String(value || "").slice(0, 10));
  if (!parts) return "";
  return `${parts.yyyy}-${String(parts.mm).padStart(2, "0")}`;
}

export function addDaysIso(iso, days) {
  const date = isoToLocalDate(iso, 12);
  if (!date) return "";
  date.setDate(date.getDate() + Number(days || 0));
  return isoDate(date);
}

export function addMonthsClamped(iso, months) {
  const date = isoToLocalDate(iso, 12);
  if (!date) return "";

  const day = date.getDate();
  const next = new Date(date.getFullYear(), date.getMonth() + Number(months || 0), 1, 12);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, lastDay));
  return isoDate(next);
}

export function nextDueFromFreq(iso, freq) {
  const base = iso || isoDate();
  switch (String(freq || "").toLowerCase()) {
    case "weekly":
      return addDaysIso(base, 7);
    case "biweekly":
      return addDaysIso(base, 14);
    case "quarterly":
      return addMonthsClamped(base, 3);
    case "yearly":
      return addMonthsClamped(base, 12);
    case "one_time":
      return base;
    default:
      return addMonthsClamped(base, 1);
  }
}

export function prevDueFromFreq(iso, freq) {
  const base = iso || isoDate();
  switch (String(freq || "").toLowerCase()) {
    case "weekly":
      return addDaysIso(base, -7);
    case "biweekly":
      return addDaysIso(base, -14);
    case "quarterly":
      return addMonthsClamped(base, -3);
    case "yearly":
      return addMonthsClamped(base, -12);
    case "one_time":
      return base;
    default:
      return addMonthsClamped(base, -1);
  }
}

export function daysUntil(iso) {
  const serial = isoSerial(iso);
  if (!Number.isFinite(serial)) return null;
  return serial - todaySerial();
}

export function dueMeta(days) {
  if (!Number.isFinite(days)) return { label: "No date", tone: "blue", pct: 10 };
  if (days < 0) return { label: `${Math.abs(days)}d late`, tone: "red", pct: 100 };
  if (days === 0) return { label: "Due today", tone: "red", pct: 100 };
  if (days <= 3) return { label: `${days}d left`, tone: "red", pct: 92 };
  if (days <= 7) return { label: `${days}d left`, tone: "amber", pct: 72 };
  if (days <= 14) return { label: `${days}d left`, tone: "amber", pct: 48 };
  return { label: `${days}d left`, tone: "green", pct: 18 };
}

export function dueText(days) {
  if (!Number.isFinite(days)) return "No due date";
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "1 day remaining";
  return `${days} days remaining`;
}

export function monthlyMinimumPayment(debt) {
  const min = safeNum(debt?.minPay, 0);
  const fallback = safeNum(debt?.amount, 0);
  return round2(min > 0 ? min : fallback);
}

export function monthlyScheduledPayment(debt) {
  return round2(monthlyMinimumPayment(debt) + safeNum(debt?.extraPay, 0));
}

export function monthlyInterest(balance, aprPct) {
  return round2((safeNum(balance) * safeNum(aprPct)) / 1200);
}

export function amortize(balance, aprPct, payment, maxMonths = 1200) {
  let bal = safeNum(balance, 0);
  const apr = safeNum(aprPct, 0);
  const pay = safeNum(payment, 0);

  if (bal <= 0) return { months: 0, totalInterest: 0 };
  if (pay <= 0) return { months: Infinity, totalInterest: Infinity };

  const rate = apr / 100 / 12;
  let months = 0;
  let totalInterest = 0;

  while (bal > 0 && months < maxMonths) {
    const interest = rate > 0 ? bal * rate : 0;
    totalInterest += interest;
    const principal = pay - interest;

    if (principal <= 0) {
      return { months: Infinity, totalInterest: Infinity };
    }

    bal = Math.max(0, bal + interest - pay);
    months += 1;
  }

  if (months >= maxMonths) return { months: Infinity, totalInterest: Infinity };
  return { months, totalInterest: round2(totalInterest) };
}

export function payoffLabel(balance, aprPct, payment) {
  const result = amortize(balance, aprPct, payment);
  if (result.months === Infinity) return "Payment too low";
  if (result.months <= 0) return "Paid off";
  if (result.months < 12) return `${result.months}mo`;
  const years = result.months / 12;
  return `${years.toFixed(years >= 2 ? 1 : 2)}yr`;
}

export function strategySubtitle(strategy) {
  if (strategy === "snowball") return "Smallest balance first";
  if (strategy === "urgent") return "Soonest due first";
  return "Highest APR first";
}

export function sortForStrategy(list, strategy) {
  const clone = [...list];

  if (strategy === "snowball") {
    clone.sort((a, b) => {
      const balDiff = safeNum(a.balance) - safeNum(b.balance);
      if (balDiff !== 0) return balDiff;
      const aprDiff = safeNum(b.aprPct) - safeNum(a.aprPct);
      if (aprDiff !== 0) return aprDiff;
      return compareIsoDates(a.dueDate, b.dueDate);
    });
    return clone;
  }

  if (strategy === "urgent") {
    clone.sort((a, b) => {
      const ad = Number.isFinite(daysUntil(a.dueDate)) ? daysUntil(a.dueDate) : 999999;
      const bd = Number.isFinite(daysUntil(b.dueDate)) ? daysUntil(b.dueDate) : 999999;
      const dueDiff = ad - bd;
      if (dueDiff !== 0) return dueDiff;
      const aprDiff = safeNum(b.aprPct) - safeNum(a.aprPct);
      if (aprDiff !== 0) return aprDiff;
      return safeNum(b.balance) - safeNum(a.balance);
    });
    return clone;
  }

  clone.sort((a, b) => {
    const aprDiff = safeNum(b.aprPct) - safeNum(a.aprPct);
    if (aprDiff !== 0) return aprDiff;
    const interestDiff = monthlyInterest(b.balance, b.aprPct) - monthlyInterest(a.balance, a.aprPct);
    if (interestDiff !== 0) return interestDiff;
    return safeNum(b.balance) - safeNum(a.balance);
  });
  return clone;
}

export function isInvestmentAccountType(type) {
  const value = String(type || "").toLowerCase();
  return value === "investment" || value.includes("broker");
}

export function accountTypeLabel(type) {
  const value = String(type || "other").toLowerCase();
  if (value.includes("checking")) return "Checking";
  if (value.includes("savings")) return "Savings";
  if (value.includes("cash")) return "Cash";
  if (value.includes("credit")) return "Credit Card";
  if (value.includes("invest")) return "Investment";
  return "Other";
}

export function toneMeta(tone = "neutral") {
  if (tone === "green") {
    return {
      text: "#97efc7",
      border: "rgba(116, 231, 174, 0.22)",
      glow: "rgba(116, 231, 174, 0.12)",
      bg: "rgba(9, 26, 18, 0.7)",
    };
  }
  if (tone === "blue") {
    return {
      text: "#bcd7ff",
      border: "rgba(126, 160, 255, 0.22)",
      glow: "rgba(110, 163, 255, 0.12)",
      bg: "rgba(9, 16, 31, 0.72)",
    };
  }
  if (tone === "amber") {
    return {
      text: "#f5cf88",
      border: "rgba(245, 207, 136, 0.2)",
      glow: "rgba(245, 207, 136, 0.1)",
      bg: "rgba(30, 20, 7, 0.7)",
    };
  }
  if (tone === "red") {
    return {
      text: "#ff646b",
      border: "rgba(255, 100, 107, 0.24)",
      glow: "rgba(255, 100, 107, 0.12)",
      bg: "rgba(31, 8, 11, 0.72)",
    };
  }
  return {
    text: "#f7fbff",
    border: "rgba(214, 226, 255, 0.14)",
    glow: "rgba(140, 170, 255, 0.08)",
    bg: "rgba(10, 15, 24, 0.66)",
  };
}

export function mapDebt(row) {
  return {
    id: row.id,
    name: row.name || "Debt",
    type: row.type === "controllable" ? "controllable" : "noncontrollable",
    frequency: row.frequency || "monthly",
    dueDate: row.due_date || "",
    amount: safeNum(row.amount),
    active: row.active !== false,
    balance: safeNum(row.balance),
    minPay: safeNum(row.min_pay),
    extraPay: safeNum(row.extra_pay),
    aprPct: safeNum(row.apr_pct),
    autopay: row.autopay === true,
    category: row.category || "",
    notes: row.notes || "",
    accountId: row.account_id || "",
    linkedDebtId: row.linked_debt_id || "",
    lastPaidDate: row.last_paid_date || "",
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
  };
}

export function mapAccount(row) {
  return {
    id: row.id,
    name: row.name || "",
    type: row.account_type || "other",
    balance: safeNum(row.balance),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
  };
}

export function mapPayment(row) {
  return {
    id: row.id,
    billId: row.bill_id,
    linkedDebtId: row.linked_debt_id || "",
    amount: safeNum(row.amount),
    paymentDate: row.payment_date || "",
    accountId: row.payment_account_id || "",
    note: row.note || "",
    createdAt: row.created_at || new Date().toISOString(),
  };
}

export function buildDebtForm(debt, defaultAccountId = "") {
  if (!debt) {
    return {
      name: "",
      balance: "",
      aprPct: "",
      minPay: "",
      extraPay: "",
      amount: "",
      dueDate: isoDate(),
      frequency: "monthly",
      category: "",
      notes: "",
      accountId: defaultAccountId || "",
      autopay: false,
      lastPaidDate: "",
    };
  }

  return {
    name: debt.name || "",
    balance: String(debt.balance ?? ""),
    aprPct: String(debt.aprPct ?? ""),
    minPay: String(debt.minPay ?? ""),
    extraPay: String(debt.extraPay ?? ""),
    amount: String(debt.amount ?? ""),
    dueDate: debt.dueDate || isoDate(),
    frequency: debt.frequency || "monthly",
    category: debt.category || "",
    notes: debt.notes || "",
    accountId: debt.accountId || defaultAccountId || "",
    autopay: debt.autopay === true,
    lastPaidDate: debt.lastPaidDate || "",
  };
}

export function buildDebtSummaries({ debts = [], linkedBills = [], payments = [], accounts = [] }) {
  const accountNameById = new Map(accounts.map((account) => [account.id, account.name]));
  const currentMonthKey = monthKeyOf(isoDate());
  const byId = {};

  debts.forEach((debt) => {
    const linked = linkedBills
      .filter((bill) => bill.linkedDebtId === debt.id)
      .sort((a, b) => compareIsoDates(a.dueDate, b.dueDate));

    const history = payments
      .filter((payment) => payment.billId === debt.id || payment.linkedDebtId === debt.id)
      .sort(
        (a, b) =>
          compareIsoDates(b.paymentDate, a.paymentDate) ||
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );

    const monthlyPlan = monthlyScheduledPayment(debt);
    const minPayment = monthlyMinimumPayment(debt);
    const monthlyBleed = monthlyInterest(debt.balance, debt.aprPct);
    const status = dueMeta(daysUntil(debt.dueDate));
    const payoffBase = payoffLabel(debt.balance, debt.aprPct, monthlyPlan);

    const paidThisMonth = round2(
      history
        .filter((payment) => monthKeyOf(payment.paymentDate) === currentMonthKey)
        .reduce((sum, payment) => sum + safeNum(payment.amount), 0)
    );

    const totalPaid = round2(history.reduce((sum, payment) => sum + safeNum(payment.amount), 0));
    const underwater = amortize(debt.balance, debt.aprPct, monthlyPlan).months === Infinity;

    const riskLevel =
      status.tone === "red"
        ? "critical"
        : underwater || safeNum(debt.aprPct) >= 20
        ? "warning"
        : "stable";

    byId[debt.id] = {
      debt,
      status,
      linkedBills: linked,
      linkedBillsCount: linked.length,
      history,
      paidThisMonth,
      totalPaid,
      monthlyPlan,
      minPayment,
      monthlyBleed,
      payoffBase,
      linkedAccountName: accountNameById.get(debt.accountId) || "None",
      linkedAccountId: debt.accountId || "",
      underwater,
      riskLevel,
      isOverdue: Number.isFinite(daysUntil(debt.dueDate)) && daysUntil(debt.dueDate) < 0,
    };
  });

  return byId;
}

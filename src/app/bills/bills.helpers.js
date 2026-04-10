export function uid() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

export function safeNum(n, fallback = 0) {
  const value = Number(n);
  return Number.isFinite(value) ? value : fallback;
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
  const parts = parseIsoParts(iso);
  if (!parts) return null;
  return new Date(parts.yyyy, parts.mm - 1, parts.dd, hour, 0, 0, 0);
}

export function isoSerial(iso) {
  const parts = parseIsoParts(iso);
  if (!parts) return null;
  return Math.floor(Date.UTC(parts.yyyy, parts.mm - 1, parts.dd) / 86400000);
}

export function todaySerial() {
  const now = new Date();
  return Math.floor(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000
  );
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

export function rewindDueNTimes(iso, freq, count = 1) {
  let next = iso || "";
  const loops = Math.max(0, Number(count || 0));
  for (let i = 0; i < loops; i += 1) {
    next = prevDueFromFreq(next, freq);
  }
  return next;
}

export function daysUntil(iso) {
  const serial = isoSerial(iso);
  if (!Number.isFinite(serial)) return null;
  return serial - todaySerial();
}

export function ledgerTs(iso) {
  const date = isoToLocalDate(iso, 12) || new Date();
  return date.toISOString();
}

export function freqMult(freq) {
  switch (String(freq || "").toLowerCase()) {
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

export function moWeight(amount, freq) {
  return round2(safeNum(amount) * freqMult(freq));
}

export function normType(value) {
  return String(value || "other").toLowerCase().trim();
}

export function isInvestment(type) {
  return normType(type) === "investment" || normType(type).includes("broker");
}

export function formatFrequencyLabel(value) {
  return (
    FREQS.find((item) => item.value === value)?.label ||
    String(value || "monthly").replaceAll("_", " ")
  );
}

export function dueMeta(days) {
  if (!Number.isFinite(days)) {
    return { label: "No date", tone: "blue", pct: 10 };
  }
  if (days < 0) return { label: `${Math.abs(days)}d late`, tone: "red", pct: 100 };
  if (days === 0) return { label: "Due today", tone: "red", pct: 100 };
  if (days <= 3) return { label: `${days}d left`, tone: "red", pct: 92 };
  if (days <= 7) return { label: `${days}d left`, tone: "amber", pct: 72 };
  if (days <= 14) return { label: `${days}d left`, tone: "amber", pct: 48 };
  return { label: `${days}d left`, tone: "green", pct: 18 };
}

export function cycleStart(bill) {
  if (!bill?.dueDate || !bill?.frequency) return "";
  if (String(bill.frequency).toLowerCase() === "one_time") return bill.dueDate;
  return prevDueFromFreq(bill.dueDate, bill.frequency);
}

export function cycleEnd(bill) {
  if (!bill?.dueDate || !bill?.frequency) return "";
  if (String(bill.frequency).toLowerCase() === "one_time") return bill.dueDate;
  return nextDueFromFreq(bill.dueDate, bill.frequency);
}

export function isPaidThisCycle(bill) {
  if (!bill?.lastPaidDate || bill.active === false) return false;
  const paid = isoSerial(bill.lastPaidDate);
  const due = isoSerial(bill.dueDate);
  if (!Number.isFinite(paid) || !Number.isFinite(due)) return false;

  if (String(bill.frequency || "").toLowerCase() === "one_time") {
    return paid >= due;
  }

  const start = isoSerial(cycleStart(bill));
  const end = isoSerial(cycleEnd(bill));
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  return paid >= start && paid < end;
}

export function billStatus(bill) {
  if (!bill) return { label: "—", tone: "blue", pct: 0, isPaid: false };
  if (bill.active === false) {
    return { label: "Inactive", tone: "blue", pct: 0, isPaid: false };
  }
  if (isPaidThisCycle(bill)) {
    return { label: "Paid", tone: "green", pct: 100, isPaid: true };
  }
  return { ...dueMeta(daysUntil(bill.dueDate)), isPaid: false };
}

export function dueText(days) {
  if (!Number.isFinite(days)) return "No due date";
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return "Due today";
  return `${days} days remaining`;
}

export function moInterest(balance, aprPct) {
  return round2((safeNum(balance) * safeNum(aprPct)) / 1200);
}

export function payoffMo(balance, aprPct, payment) {
  const bal = safeNum(balance);
  const rate = safeNum(aprPct) / 100 / 12;
  const pay = safeNum(payment);
  if (bal <= 0 || pay <= 0) return 0;
  if (rate <= 0) return Math.ceil(bal / pay);
  if (pay <= bal * rate) return Infinity;
  const months = -Math.log(1 - (rate * bal) / pay) / Math.log(1 + rate);
  return Number.isFinite(months) ? Math.ceil(months) : Infinity;
}

export function payoffLabel(balance, aprPct, payment) {
  const months = payoffMo(balance, aprPct, payment);
  if (months === Infinity) return "Payment too low";
  if (months <= 0) return "Paid off";
  if (months < 12) return `${months}mo`;
  return `${(months / 12).toFixed(months / 12 >= 2 ? 1 : 2)}yr`;
}

export function shouldAdvance(bill, paymentDate, advance) {
  if (!advance) return false;
  if (String(bill?.frequency || "").toLowerCase() === "one_time") return false;
  const due = isoSerial(bill?.dueDate);
  const paid = isoSerial(paymentDate);
  if (!Number.isFinite(due)) return false;
  if (!Number.isFinite(paid)) return true;
  return paid >= due || due <= todaySerial();
}

export function emptyBillForm(defaultAccountId = "") {
  return {
    name: "",
    amount: "",
    dueDate: isoDate(),
    frequency: "monthly",
    category: "",
    notes: "",
    accountId: defaultAccountId,
    autopay: false,
    lastPaidDate: "",
    isDebtBill: false,
    debtMode: "none",
    linkedDebtId: "",
    newDebtName: "",
    newDebtBalance: "",
    newDebtAprPct: "",
    newDebtMinPay: "",
    newDebtExtraPay: "",
    newDebtFrequency: "monthly",
    newDebtDueDate: isoDate(),
    newDebtCategory: "",
    newDebtNotes: "",
    newDebtAccountId: defaultAccountId,
    newDebtAutopay: false,
  };
}

export function editorState(bill, linkedDebt, defaultAccountId = "") {
  if (!bill) return emptyBillForm(defaultAccountId);
  return {
    name: bill.name || "",
    amount: String(bill.amount ?? ""),
    dueDate: bill.dueDate || isoDate(),
    frequency: bill.frequency || "monthly",
    category: bill.category || "",
    notes: bill.notes || "",
    accountId: bill.accountId || defaultAccountId,
    autopay: bill.autopay === true,
    lastPaidDate: bill.lastPaidDate || "",
    isDebtBill: !!bill.linkedDebtId,
    debtMode: bill.linkedDebtId ? "link_existing" : "none",
    linkedDebtId: bill.linkedDebtId || "",
    newDebtName: linkedDebt?.name || bill.name || "",
    newDebtBalance: linkedDebt ? String(linkedDebt.balance ?? "") : "",
    newDebtAprPct: linkedDebt ? String(linkedDebt.aprPct ?? "") : "",
    newDebtMinPay: linkedDebt
      ? String(linkedDebt.minPay ?? "")
      : String(bill.amount ?? ""),
    newDebtExtraPay: linkedDebt ? String(linkedDebt.extraPay ?? "") : "",
    newDebtFrequency: linkedDebt?.frequency || bill.frequency || "monthly",
    newDebtDueDate: linkedDebt?.dueDate || bill.dueDate || isoDate(),
    newDebtCategory: linkedDebt?.category || bill.category || "",
    newDebtNotes: linkedDebt?.notes || bill.notes || "",
    newDebtAccountId: linkedDebt?.accountId || bill.accountId || defaultAccountId,
    newDebtAutopay: linkedDebt ? linkedDebt.autopay === true : bill.autopay === true,
  };
}

export function paymentDraftState(bill, defaultAccountId = "") {
  return {
    amount: bill ? String(bill.amount || "") : "",
    paymentDate: isoDate(),
    accountId: bill?.accountId || defaultAccountId,
    note: "",
    advanceDue: true,
    saving: false,
  };
}

export function mapBill(row) {
  return {
    id: row.id,
    name: row.name || "Bill",
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
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
  };
}

export function mapAcct(row) {
  return {
    id: row.id,
    name: row.name || "",
    type: row.account_type || "other",
    balance: safeNum(row.balance),
    updatedAt: row.updated_at || new Date().toISOString(),
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

export function spendingRow(id, userId, bill, amount, date, accountName, note = "") {
  return {
    id,
    user_id: userId,
    type: "expense",
    amount: round2(amount),
    category_id: null,
    tx_date: date,
    tx_time: null,
    merchant: bill.name || "Bill Payment",
    note: `[Bill Payment] ${bill.name || "Bill"}${note ? ` • ${note}` : ""}`,
    payment_method: "Bill Payment",
    account_name: accountName || "",
    created_at: ledgerTs(date),
    updated_at: new Date().toISOString(),
  };
}

export function calendarMirrorRow(id, userId, profileId, bill, amount, date, note = "") {
  return {
    id,
    user_id: userId,
    profile_id: profileId || null,
    title: bill.name || "Bill Payment",
    event_date: date,
    event_time: null,
    end_time: null,
    category: bill.category || "Bill",
    flow: "expense",
    amount: round2(amount),
    note: note || "",
    status: "done",
    color: "#ef4444",
    source: "spending",
    source_id: id,
    source_table: "spending_transactions",
    auto_created: true,
    transaction_type: "expense",
    created_at: ledgerTs(date),
    updated_at: new Date().toISOString(),
  };
}

export const FREQS = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
  { value: "one_time", label: "One Time" },
];

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

export function buildBillForwardSchedule(bill, count = 6) {
  if (!bill?.dueDate) return [];
  const items = [];
  let due = bill.dueDate;
  let guard = 0;

  while (due && items.length < count && guard < 24) {
    const days = daysUntil(due);
    const meta = dueMeta(days);
    items.push({
      id: `${bill.id}-${due}`,
      dueDate: due,
      amount: round2(bill.amount),
      tone: meta.tone,
      label: meta.label,
    });

    if (String(bill.frequency || "").toLowerCase() === "one_time") break;
    due = nextDueFromFreq(due, bill.frequency);
    guard += 1;
  }

  return items;
}

export function buildBillSummaries({
  bills = [],
  payments = [],
  debtProfiles = [],
  accounts = [],
}) {
  const monthKey = monthKeyOf(isoDate());
  const debtMap = new Map(debtProfiles.map((debt) => [debt.id, debt]));
  const accountMap = new Map(accounts.map((account) => [account.id, account.name || "Account"]));
  const paymentMap = new Map();

  payments.forEach((payment) => {
    if (!paymentMap.has(payment.billId)) paymentMap.set(payment.billId, []);
    paymentMap.get(payment.billId).push(payment);
  });

  const result = {};

  bills.forEach((bill) => {
    const rows = [...(paymentMap.get(bill.id) || [])].sort(
      (a, b) =>
        compareIsoDates(b.paymentDate, a.paymentDate) ||
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );

    const linkedDebt = debtMap.get(bill.linkedDebtId) || null;
    const monthlyPlan = moWeight(bill.amount, bill.frequency);
    const totalPaid = round2(rows.reduce((sum, row) => sum + safeNum(row.amount), 0));
    const paidThisMonth = round2(
      rows
        .filter((row) => monthKeyOf(row.paymentDate) === monthKey)
        .reduce((sum, row) => sum + safeNum(row.amount), 0)
    );
    const debtPlannedPayment = linkedDebt
      ? round2(safeNum(linkedDebt.minPay) + safeNum(linkedDebt.extraPay))
      : 0;

    result[bill.id] = {
      status: billStatus(bill),
      daysUntil: daysUntil(bill.dueDate),
      payments: rows,
      paymentsCount: rows.length,
      totalPaid,
      paidThisMonth,
      monthlyImpact: monthlyPlan,
      lastPayment: rows[0] || null,
      linkedDebt,
      linkedDebtBalance: linkedDebt ? round2(linkedDebt.balance) : 0,
      monthlyInterest: linkedDebt ? moInterest(linkedDebt.balance, linkedDebt.aprPct) : 0,
      payoff: linkedDebt
        ? payoffLabel(linkedDebt.balance, linkedDebt.aprPct, debtPlannedPayment)
        : "—",
      debtPlan: debtPlannedPayment,
      cycleStart: cycleStart(bill),
      cycleEnd: cycleEnd(bill),
      accountName: accountMap.get(bill.accountId) || "None",
      forwardSchedule: buildBillForwardSchedule(bill, 6),
    };
  });

  return result;
}

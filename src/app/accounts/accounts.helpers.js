import { projectCashFlow, todayISO as projectionTodayISO } from "@/lib/projectionEngine";

export const META_PREFIX = "__LCC_META__";

export function uid() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

export function round2(n) {
  return Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
}

export function safeNum(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

export function parseMoneyInput(v) {
  const cleaned = String(v ?? "").replace(/[^0-9.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : NaN;
}

export function fmtMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "$0.00";
  return num.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function shortDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "—";
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

export function addDays(dateValue, days) {
  const d = new Date(dateValue);
  d.setDate(d.getDate() + days);
  return d;
}

export function compareIso(a, b) {
  return String(a || "").localeCompare(String(b || ""));
}

export function isFutureDate(dateValue) {
  if (!dateValue) return false;
  const target = new Date(`${String(dateValue).slice(0, 10)}T12:00:00`);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  return target.getTime() > today.getTime();
}

export function monthStart(value = new Date()) {
  return new Date(value.getFullYear(), value.getMonth(), 1, 0, 0, 0, 0);
}

export function monthEnd(value = new Date()) {
  return new Date(value.getFullYear(), value.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function dayKey(value) {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function extractStoredNote(rawNote) {
  const text = String(rawNote ?? "");
  const idx = text.indexOf(META_PREFIX);

  if (idx === -1) {
    return { userNote: text, meta: {} };
  }

  const userNote = text.slice(0, idx).trimEnd();
  const payload = text.slice(idx + META_PREFIX.length);

  try {
    const parsed = JSON.parse(decodeURIComponent(payload));
    return { userNote, meta: parsed || {} };
  } catch {
    return { userNote, meta: {} };
  }
}

export function normalizeAccountType(type = "") {
  const value = String(type || "").trim().toLowerCase();
  if (value.includes("checking")) return "Checking";
  if (value.includes("savings")) return "Savings";
  if (value.includes("credit")) return "Credit";
  if (value.includes("cash")) return "Cash";
  if (value.includes("broker")) return "Brokerage";
  if (value.includes("invest")) return "Investment";
  if (value.includes("debt")) return "Debt";
  if (!value) return "Account";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function allowsNegativeOpeningBalance(type = "") {
  const value = String(type || "").toLowerCase();
  return value.includes("credit") || value.includes("debt") || value.includes("loan");
}

export function accountTone(accountType = "") {
  const value = String(accountType || "").toLowerCase();
  if (value.includes("savings")) return "green";
  if (value.includes("credit")) return "red";
  if (value.includes("cash")) return "amber";
  return "blue";
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

export function typeMatches(type, filter) {
  const value = String(type || "").toLowerCase();
  if (filter === "all") return true;
  if (filter === "checking") return value.includes("checking");
  if (filter === "savings") return value.includes("savings");
  if (filter === "credit") return value.includes("credit");
  if (filter === "cash") return value.includes("cash");
  return true;
}

export function isCashLikeAccount(type = "") {
  const value = String(type || "").toLowerCase();
  if (!value) return true;
  if (value.includes("credit")) return false;
  if (value.includes("debt")) return false;
  if (value.includes("loan")) return false;
  if (value.includes("broker")) return false;
  if (value.includes("invest")) return false;
  return true;
}

export function getIncomeRouting(row, defaultAccountId) {
  const extracted = extractStoredNote(row.note);
  const meta = extracted.meta;
  const posted = !!meta?.posted;

  const status =
    meta?.status === "scheduled" || isFutureDate(row.deposit_date)
      ? "scheduled"
      : "received";

  let shares = [];

  if (Array.isArray(meta?.splits) && meta.splits.length) {
    shares = meta.splits
      .filter((split) => split?.accountId && safeNum(split.amount, 0) > 0)
      .map((split) => ({
        accountId: split.accountId,
        accountName: split.accountName || "",
        amount: round2(split.amount),
      }));
  } else if (defaultAccountId) {
    shares = [
      {
        accountId: defaultAccountId,
        accountName: row.account_name || "",
        amount: round2(row.amount),
      },
    ];
  }

  return {
    id: row.id,
    source: row.source || "Income",
    deposit_date: row.deposit_date || "",
    amount: round2(row.amount),
    posted,
    status,
    shares,
  };
}

export function isTransferRow(tx) {
  const kind = String(tx.kind || "").toLowerCase();
  const sourceType = String(tx.source_type || "").toLowerCase();
  return kind.includes("transfer") || sourceType.includes("transfer");
}

export function isBillRow(tx) {
  const kind = String(tx.kind || "").toLowerCase();
  const sourceType = String(tx.source_type || "").toLowerCase();
  return kind.includes("bill") || sourceType.includes("bill");
}

export function flowBucket(tx) {
  if (isTransferRow(tx)) return "Transfers";
  if (isBillRow(tx)) return "Bills";
  if (safeNum(tx.delta, 0) > 0) return "Income";
  if (String(tx.source_type || "").toLowerCase().includes("adjust")) return "Adjustments";
  return "Spending";
}

export function amountFromBill(bill) {
  const type = String(bill?.type || "").toLowerCase();
  if (type === "controllable") {
    const plan = safeNum(bill?.min_pay, 0) + safeNum(bill?.extra_pay, 0);
    return round2(plan > 0 ? plan : safeNum(bill?.amount, 0));
  }
  return round2(safeNum(bill?.amount, 0));
}

export function billTitle(bill) {
  return bill?.category || bill?.notes || bill?.name || "Bill";
}

export function buildBalanceBars(transactions, currentBalance, days = 14) {
  const txByDay = new Map();

  transactions.forEach((tx) => {
    const key = dayKey(tx.created_at);
    if (!key) return;
    txByDay.set(key, round2((txByDay.get(key) || 0) + safeNum(tx.delta, 0)));
  });

  let running = round2(currentBalance);
  const today = new Date();
  const values = [];

  for (let i = 0; i < days; i += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);

    values.unshift({
      key,
      label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      value: running,
    });

    running = round2(running - safeNum(txByDay.get(key), 0));
  }

  const nums = values.map((v) => v.value);
  const min = Math.min(...nums, 0);
  const max = Math.max(...nums, 1);
  const range = Math.max(max - min, 1);

  return values.map((v) => ({
    ...v,
    height: 18 + ((v.value - min) / range) * 52,
  }));
}

export function riskMeta(summary) {
  if (!summary) {
    return {
      tone: "blue",
      label: "Stable",
      detail: "This account looks stable right now.",
      chipTone: "blue",
      riskLevel: "stable",
    };
  }

  if (summary.projectedLowPoint < 0) {
    return {
      tone: "red",
      label: "Critical",
      detail: "This account is projected to dip below zero soon.",
      chipTone: "red",
      riskLevel: "critical",
    };
  }

  if (
    summary.projected14 < summary.safeBuffer ||
    summary.projectedLowPoint < summary.safeBuffer
  ) {
    return {
      tone: "amber",
      label: "Watch",
      detail: "This account is projected below its safe buffer soon.",
      chipTone: "amber",
      riskLevel: "warning",
    };
  }

  return {
    tone: "green",
    label: "Stable",
    detail: "This account looks stable right now.",
    chipTone: "green",
    riskLevel: "stable",
  };
}

export function emptyCreateForm() {
  return {
    name: "",
    account_type: "checking",
    opening_balance: "",
    safe_buffer: "150",
  };
}

export function emptyAdjustForm(account) {
  return {
    mode: "add",
    amount: "",
    note: "",
    safe_buffer: String(round2(safeNum(account?.safe_buffer, 150))),
  };
}

export function emptyTransferForm(selectedAccountId = "", accounts = []) {
  return {
    toAccountId:
      accounts.find((account) => account.id !== selectedAccountId)?.id || "",
    amount: "",
    note: "",
  };
}

export function buildProjectedBillsForAccount(accountBills, startISO, horizonDays = 30) {
  const horizonEnd = addDays(new Date(`${startISO}T12:00:00`), horizonDays - 1)
    .toISOString()
    .slice(0, 10);

  const out = [];

  const addMonthsISO = (iso, delta) => {
    const date = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
    const day = date.getDate();
    const next = new Date(date.getFullYear(), date.getMonth() + delta, 1, 12);
    const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(day, last));
    return next.toISOString().slice(0, 10);
  };

  const nextDue = (iso, freq) => {
    const base = String(iso || startISO).slice(0, 10);
    const f = String(freq || "monthly").toLowerCase();

    if (f === "weekly") {
      return addDays(new Date(`${base}T12:00:00`), 7).toISOString().slice(0, 10);
    }
    if (f === "biweekly") {
      return addDays(new Date(`${base}T12:00:00`), 14).toISOString().slice(0, 10);
    }
    if (f === "quarterly") return addMonthsISO(base, 3);
    if (f === "yearly") return addMonthsISO(base, 12);
    if (f === "one_time") return "";
    return addMonthsISO(base, 1);
  };

  (accountBills || []).forEach((bill) => {
    if (bill.active === false) return;

    let due = String(bill.due_date || "").slice(0, 10);
    if (!due) return;

    const amount = amountFromBill(bill);
    if (!(amount > 0)) return;

    let guard = 0;
    while (due && due <= horizonEnd && guard < 36) {
      if (due >= startISO) {
        out.push({
          dueDate: due,
          amount,
          name: billTitle(bill),
        });
      }

      if (String(bill.frequency || "").toLowerCase() === "one_time") break;
      due = nextDue(due, bill.frequency);
      guard += 1;
    }
  });

  return out.sort((a, b) => compareIso(a.dueDate, b.dueDate));
}

export function buildAccountSummaries({
  accounts = [],
  transactions = [],
  bills = [],
  incomeRows = [],
  defaultAccountId = "",
}) {
  const now = new Date();
  const startIso = projectionTodayISO();
  const monthEndIso = monthEnd(now).toISOString().slice(0, 10);
  const monthStartDate = monthStart(now).getTime();
  const last30Cutoff = addDays(new Date(), -30).getTime();

  const txMap = new Map(accounts.map((account) => [account.id, []]));
  transactions.forEach((tx) => {
    if (!txMap.has(tx.account_id)) return;
    txMap.get(tx.account_id).push({
      ...tx,
      delta: round2(tx.delta),
      resulting_balance: round2(tx.resulting_balance),
    });
  });

  const billMap = new Map(accounts.map((account) => [account.id, []]));
  bills.forEach((bill) => {
    if (!bill.account_id || !billMap.has(bill.account_id)) return;
    billMap.get(bill.account_id).push(bill);
  });

  const scheduledIncomeMap = new Map(accounts.map((account) => [account.id, []]));
  incomeRows.forEach((row) => {
    const routed = getIncomeRouting(row, defaultAccountId);
    if (routed.posted || routed.status !== "scheduled") return;

    routed.shares.forEach((share) => {
      if (!scheduledIncomeMap.has(share.accountId)) return;
      scheduledIncomeMap.get(share.accountId).push({
        id: `${routed.id}-${share.accountId}`,
        income_id: routed.id,
        source: routed.source,
        deposit_date: routed.deposit_date,
        amount: round2(share.amount),
      });
    });
  });

  const result = {};

  accounts.forEach((account) => {
    const accountTxs = [...(txMap.get(account.id) || [])].sort(
      (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );

    const monthTxs = accountTxs.filter(
      (tx) => new Date(tx.created_at || 0).getTime() >= monthStartDate
    );
    const last30Txs = accountTxs.filter(
      (tx) => new Date(tx.created_at || 0).getTime() >= last30Cutoff
    );

    const upcomingBills = [...(billMap.get(account.id) || [])]
      .filter((bill) => bill.active !== false)
      .filter((bill) => bill.due_date && String(bill.due_date).slice(0, 10) >= startIso)
      .sort((a, b) => compareIso(a.due_date, b.due_date));

    const scheduledDeposits = [...(scheduledIncomeMap.get(account.id) || [])]
      .filter((row) => row.deposit_date && String(row.deposit_date).slice(0, 10) >= startIso)
      .sort((a, b) => compareIso(a.deposit_date, b.deposit_date));

    const nextBill = upcomingBills[0] || null;
    const nextIncome = scheduledDeposits[0] || null;

    const monthIncome = round2(
      monthTxs
        .filter((tx) => safeNum(tx.delta, 0) > 0)
        .filter((tx) => !isTransferRow(tx))
        .reduce((sum, tx) => sum + safeNum(tx.delta, 0), 0)
    );

    const monthBills = round2(
      Math.abs(
        monthTxs
          .filter((tx) => isBillRow(tx))
          .reduce((sum, tx) => sum + safeNum(tx.delta, 0), 0)
      )
    );

    const monthSpending = round2(
      Math.abs(
        monthTxs
          .filter((tx) => !isBillRow(tx) && !isTransferRow(tx) && safeNum(tx.delta, 0) < 0)
          .filter((tx) => !String(tx.source_type || "").toLowerCase().includes("adjust"))
          .reduce((sum, tx) => sum + safeNum(tx.delta, 0), 0)
      )
    );

    const monthTransfersNet = round2(
      monthTxs
        .filter((tx) => isTransferRow(tx))
        .reduce((sum, tx) => sum + safeNum(tx.delta, 0), 0)
    );

    const last30Delta = round2(
      last30Txs.reduce((sum, tx) => sum + safeNum(tx.delta, 0), 0)
    );

    const startBalance = round2(
      safeNum(account.balance, 0) -
        monthTxs.reduce((sum, tx) => sum + safeNum(tx.delta, 0), 0)
    );

    const projection = projectCashFlow({
      startDateISO: startIso,
      days: 30,
      startingBalance: safeNum(account.balance, 0),
      events: scheduledDeposits.map((row) => ({
        id: row.id,
        title: row.source || "Income",
        date: row.deposit_date,
        flow: "income",
        amount: round2(row.amount),
      })),
      bills: buildProjectedBillsForAccount(billMap.get(account.id) || [], startIso, 30),
    });

    const projected14 = projection.ok
      ? round2(projection.daily[13]?.balance ?? account.balance)
      : round2(account.balance);

    const projectedMonthEnd = projection.ok
      ? round2(
          projection.daily.find((day) => String(day.date) >= monthEndIso)?.balance ??
            projection.projectedEndBalance
        )
      : round2(account.balance);

    const lowPoint = projection.ok
      ? round2(projection.lowestBalance)
      : round2(account.balance);

    const projectionEvents = projection.ok
      ? projection.daily.flatMap((day) =>
          (day.items || []).map((item, index) => ({
            id: `${account.id}-${day.date}-${index}`,
            date: day.date,
            kind: item.type === "income" ? "income" : "expense",
            delta: item.type === "income" ? round2(item.amount) : -round2(item.amount),
            label: item.title,
            afterBalance: round2(day.balance),
          }))
        )
      : [];

    const flowMixMap = new Map();
    monthTxs.forEach((tx) => {
      const key = flowBucket(tx);
      const existing = flowMixMap.get(key) || { label: key, total: 0 };
      existing.total = round2(existing.total + safeNum(tx.delta, 0));
      flowMixMap.set(key, existing);
    });

    const safeBuffer = round2(safeNum(account.safe_buffer, 150));
    const risk =
      lowPoint < 0
        ? "critical"
        : projected14 < safeBuffer || lowPoint < safeBuffer
        ? "warning"
        : "stable";

    result[account.id] = {
      account,
      transactions: accountTxs,
      recentTransactions: accountTxs.slice(0, 50),
      last30Delta,
      startBalance,
      monthIncome,
      monthBills,
      monthSpending,
      monthTransfersNet,
      nextBill,
      nextIncome,
      upcomingBills,
      scheduledDeposits,
      safeBuffer,
      projected14,
      projectedMonthEnd,
      projectedLowPoint: lowPoint,
      projectionEvents,
      atRisk: risk !== "stable",
      riskLevel: risk,
      flowMix: [...flowMixMap.values()].sort(
        (a, b) => Math.abs(b.total) - Math.abs(a.total)
      ),
    };
  });

  return result;
}
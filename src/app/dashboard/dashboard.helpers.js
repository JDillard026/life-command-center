export function safeNum(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function money(value, digits = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function signedMoney(value, digits = 2) {
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

export function pct(value, digits = 1) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return `${num.toFixed(digits)}%`;
}

export function startCase(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function addDays(date, days) {
  const out = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  out.setDate(out.getDate() + days);
  return out;
}

export function addMonthsClamped(date, months) {
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

export function toISODateLocal(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function parseISODateLocal(iso) {
  const raw = String(iso || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [y, m, d] = raw.split("-").map(Number);
  const out = new Date(y, m - 1, d);
  if (out.getFullYear() !== y || out.getMonth() !== m - 1 || out.getDate() !== d) {
    return null;
  }
  return out;
}

export function startOfMonthISO(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

export function endOfMonthISO(date = new Date()) {
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return toISODateLocal(end);
}

export function monthKeyFromISO(iso) {
  const value = String(iso || "");
  return value.length >= 7 ? value.slice(0, 7) : "";
}

export function fmtShort(iso) {
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
      return addMonthsClamped(date, 12);
    case "one_time":
      return date;
    default:
      return addMonthsClamped(date, 1);
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
    return { dueDate: null, days: null, amountDue: 0 };
  }

  const anchor = parseISODateLocal(bill.dueDate);
  const lastPaid = parseISODateLocal(bill.lastPaidDate);
  const freq = normalizeFrequency(bill.frequency);
  const amountDue = getEffectiveBillAmount(bill);

  if (!anchor) {
    return { dueDate: null, days: null, amountDue };
  }

  if (freq === "one_time") {
    if (lastPaid && isSameOrAfter(lastPaid, anchor)) {
      return { dueDate: null, days: null, amountDue: 0 };
    }
    return {
      dueDate: toISODateLocal(anchor),
      days: diffCalendarDays(anchor, reference),
      amountDue,
    };
  }

  const currentCycleDue = getLastOccurrenceOnOrBefore(anchor, freq, reference) || anchor;
  let effectiveDue = currentCycleDue;

  if (currentCycleDue <= reference && lastPaid && isSameOrAfter(lastPaid, currentCycleDue)) {
    effectiveDue = addByFrequency(currentCycleDue, freq);
  }

  return {
    dueDate: toISODateLocal(effectiveDue),
    days: diffCalendarDays(effectiveDue, reference),
    amountDue,
  };
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

export function mapAccountRowToClient(row) {
  return {
    id: row.id,
    name: row.name || "",
    type: row.account_type || "other",
    balance: safeNum(row.balance, 0),
  };
}

export function mapBillRowToClient(row) {
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

export function mapSpendingTxRowToClient(row) {
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

export function mapIncomeDepositRowToClient(row) {
  return {
    id: row.id,
    date: row.deposit_date || "",
    source: row.source || "",
    amount: safeNum(row.amount, 0),
    note: row.note || "",
  };
}

export function mapInvestmentAssetRow(row) {
  return {
    id: row.id,
    symbol: String(row.symbol || "").trim().toUpperCase(),
    name: row.name || row.symbol || "Asset",
  };
}

export function mapInvestmentTxnRow(row) {
  return {
    id: row.id,
    assetId: row.asset_id,
    type: String(row.txn_type || "").toUpperCase(),
    date: row.txn_date || "",
    qty: safeNum(row.qty, 0),
    price: safeNum(row.price, 0),
  };
}

export function mapSavingsGoalRow(row) {
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

export async function fetchQuoteMap(symbols) {
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

    if (Array.isArray(json?.quotes)) {
      json.quotes.forEach((item) => {
        assign(item?.symbol ?? item?.ticker, item?.price ?? item?.currentPrice ?? item?.last ?? item?.close);
      });
    } else if (Array.isArray(json)) {
      json.forEach((item) => {
        assign(item?.symbol ?? item?.ticker, item?.price ?? item?.currentPrice ?? item?.last ?? item?.close);
      });
    } else if (json && typeof json === "object") {
      Object.entries(json.prices || json).forEach(([symbol, value]) => {
        if (typeof value === "object" && value !== null) {
          assign(symbol, value.price ?? value.currentPrice ?? value.last ?? value.close);
        } else {
          assign(symbol, value);
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

  return out;
}

function buildSpendingBuckets(expenseRows) {
  const map = new Map();

  expenseRows.forEach((row) => {
    const label = startCase(row.category || "Other") || "Other";
    map.set(label, safeNum(map.get(label), 0) + safeNum(row.amount, 0));
  });

  const total = [...map.values()].reduce((sum, value) => sum + safeNum(value, 0), 0);

  return {
    total,
    items: [...map.entries()]
      .map(([label, amount]) => ({
        label,
        amount,
        pct: total > 0 ? (amount / total) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6),
  };
}

export function buildSvgLinePath(series, width = 100, height = 36, pad = 3) {
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

export function buildSvgAreaPath(series, width = 100, height = 36, pad = 3) {
  if (!series.length) return "";
  const line = buildSvgLinePath(series, width, height, pad);
  return `${line} L ${width - pad} ${height - pad} L ${pad} ${height - pad} Z`;
}

export function sampleSeriesLabels(series, count = 6) {
  if (!series.length) return [];
  if (series.length <= count) return series;
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const index = Math.round((i / (count - 1)) * (series.length - 1));
    out.push({ index, ...series[index] });
  }
  return out.filter((item, idx, arr) => arr.findIndex((x) => x.index === item.index) === idx);
}

export function toneClass(value) {
  const num = safeNum(value, 0);
  if (!num) return "neutral";
  return num > 0 ? "positive" : "negative";
}

function getPlanModel() {
  return {
    tier: "Core",
    badge: "Upgrade available",
    title: "Unlock premium command tools",
    body: "Keep the dashboard clean, but still give people a strong reason to upgrade inside the product.",
    ctaLabel: "Upgrade plan",
    ctaHref: "/settings",
    features: [
      "Connected account sync",
      "Premium OCR / receipt intelligence",
      "Refinance evaluation tool",
      "PFS statement tools",
    ],
  };
}

export function buildDashboardState({
  accounts,
  bills,
  spendingTx,
  incomeDeposits,
  investmentAssets,
  investmentTxns,
  savingsGoals,
  quoteMap,
  search,
}) {
  const today = startOfToday();
  const todayISO = toISODateLocal(today);
  const currentMonthStart = startOfMonthISO(today);
  const currentMonthKey = monthKeyFromISO(todayISO);
  const previousMonthDate = addMonthsClamped(today, -1);
  const previousMonthStart = startOfMonthISO(previousMonthDate);
  const previousMonthEnd = endOfMonthISO(previousMonthDate);
  const previousMonthKey = monthKeyFromISO(previousMonthStart);

  const incomeRows = buildCanonicalIncomeRows(spendingTx, incomeDeposits);

  const currentIncomeRows = incomeRows.filter((row) => monthKeyFromISO(row.date) === currentMonthKey);
  const previousIncomeRows = incomeRows.filter((row) => monthKeyFromISO(row.date) === previousMonthKey);

  const currentExpenseRows = spendingTx.filter((row) => {
    const type = String(row.type || "").toLowerCase();
    return monthKeyFromISO(row.date) === currentMonthKey && type !== "income" && type !== "transfer";
  });

  const previousExpenseRows = spendingTx.filter((row) => {
    const type = String(row.type || "").toLowerCase();
    return monthKeyFromISO(row.date) === previousMonthKey && type !== "income" && type !== "transfer";
  });

  const monthlyIncome = currentIncomeRows.reduce((sum, row) => sum + safeNum(row.amount, 0), 0);
  const monthlySpending = currentExpenseRows.reduce((sum, row) => sum + safeNum(row.amount, 0), 0);
  const monthMovement = monthlyIncome - monthlySpending;

  const billMetaList = bills
    .filter((bill) => bill.active !== false)
    .map((bill) => ({ ...bill, ...getBillDueMeta(bill, today) }));

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
  const creditAccounts = accounts.filter((account) => normalizeAccountType(account.type) === "credit");

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
  const portfolioMarketValue = positions.reduce((sum, entry) => sum + safeNum(entry.currentValue, 0), 0);
  const portfolioCostBasis = positions.reduce((sum, entry) => sum + safeNum(entry.basis, 0), 0);
  const portfolioPnL = positions.reduce((sum, entry) => sum + safeNum(entry.unrealizedPnl, 0), 0);
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
    .slice(0, 8);

  const query = normalizeText(search);
  const filteredTransactions = recentTransactions.filter((item) => {
    if (!query) return true;
    return (
      normalizeText(item.title).includes(query) ||
      normalizeText(item.category).includes(query) ||
      normalizeText(item.accountName).includes(query)
    );
  });

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

  dueSoonBills.slice(0, 4).forEach((bill) => {
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
      detail: "Liquid balance is idle without an active goal.",
      value: money(liquidTotal),
      tone: "neutral",
    });
  }

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

  const primaryHeadline = overdueBills.length
    ? `${overdueBills.length} overdue item${overdueBills.length === 1 ? "" : "s"} need attention`
    : monthlyCapacity < 0
    ? "This month is running tight"
    : "Board looks stable right now";

  const primaryHeadlineTone = overdueBills.length
    ? "negative"
    : monthlyCapacity < 0
    ? "warning"
    : "positive";

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
    primaryHeadline,
    primaryHeadlineTone,
    plan: getPlanModel(),
  };
}

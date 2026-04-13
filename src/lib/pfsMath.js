export function createLineItem(label = "", amount = "") {
  return {
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    label,
    amount,
  };
}

export function safeNum(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function round2(value) {
  return Math.round((safeNum(value, 0) + Number.EPSILON) * 100) / 100;
}

export function sumLineItems(items = []) {
  return round2(
    items.reduce((sum, item) => sum + safeNum(item?.amount, 0), 0)
  );
}

export function calculatePfsTotals(state) {
  const totalAssets = sumLineItems(state.assets);
  const totalLiabilities = sumLineItems(state.liabilities);
  const monthlyIncome = sumLineItems(state.income);
  const monthlyExpenses = sumLineItems(state.expenses);
  const netWorth = round2(totalAssets - totalLiabilities);
  const monthlyCashFlow = round2(monthlyIncome - monthlyExpenses);

  return {
    totalAssets,
    totalLiabilities,
    monthlyIncome,
    monthlyExpenses,
    netWorth,
    monthlyCashFlow,
  };
}

export function formatCurrency(value) {
  return safeNum(value, 0).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

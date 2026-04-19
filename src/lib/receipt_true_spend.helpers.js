export function normalizeWhitespace(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

export function normalizeSpendItemName(value = "") {
  let v = normalizeWhitespace(value).toLowerCase();
  v = v.replace(/[^a-z0-9.%/\- ]+/g, " ");
  v = v.replace(/\b(oz|fl oz|lb|lbs|ct|pk|pkg|ea|item|items)\b/g, " ");
  v = v.replace(/\b(large|medium|small)\b/g, " ");
  return v.replace(/\s+/g, " ").trim();
}

export function defaultSpendGroupFromText(itemName = "", merchantName = "") {
  const text = `${itemName} ${merchantName}`.toLowerCase();
  if (/vend|vending/.test(text)) return { group: "Vending Machine", name: "Vending Machine" };
  if (/cookie|oreo|chips ahoy|nutter butter/.test(text)) return { group: "Cookies", name: "Cookies" };
  if (/chip|dorito|cheeto|pringles|ruffles/.test(text)) return { group: "Chips", name: "Chips" };
  if (/coke|pepsi|sprite|dr pepper|mountain dew|soda/.test(text)) return { group: "Soda", name: "Soda" };
  if (/monster|red bull|energy/.test(text)) return { group: "Energy Drinks", name: "Energy Drinks" };
  if (/snickers|reeses|kitkat|candy|m&m/.test(text)) return { group: "Candy", name: "Candy" };
  if (/milk|bread|egg|cheese|butter/.test(text)) return { group: "Essentials", name: normalizeWhitespace(itemName) || "Essentials" };
  return { group: "Unmapped", name: normalizeWhitespace(itemName) || "Unknown Item" };
}

export function applySpendItemRules({ itemName = "", merchantName = "", rules = [] }) {
  const normalized = normalizeSpendItemName(itemName);
  const merchant = normalizeWhitespace(merchantName).toLowerCase();

  for (const rule of [...rules].sort((a, b) => Number(a.priority || 100) - Number(b.priority || 100))) {
    if (!rule?.is_active) continue;
    const ruleValue = normalizeWhitespace(rule.match_value).toLowerCase();
    let matched = false;
    if (rule.match_type === "contains") matched = normalized.includes(ruleValue);
    if (rule.match_type === "exact") matched = normalized === ruleValue;
    if (rule.match_type === "merchant_contains") matched = merchant.includes(ruleValue);
    if (rule.match_type === "regex") {
      try {
        matched = new RegExp(rule.match_value, "i").test(`${itemName} ${merchantName}`);
      } catch {
        matched = false;
      }
    }

    if (matched) {
      return {
        normalized_item_name: rule.normalized_name || normalizeWhitespace(itemName),
        normalized_group: rule.normalized_group || "Unmapped",
        store_recommendation: rule.target_store || null,
        normalization_confidence: 0.95,
        merchant_rule_hit: rule.id || null,
      };
    }
  }

  const fallback = defaultSpendGroupFromText(itemName, merchantName);
  return {
    normalized_item_name: fallback.name,
    normalized_group: fallback.group,
    store_recommendation: null,
    normalization_confidence: fallback.group === "Unmapped" ? 0.35 : 0.7,
    merchant_rule_hit: null,
  };
}

export function autoClassifyReceiptItem({ itemName = "", lineTotal = 0 }) {
  const text = String(itemName).toLowerCase();
  if (/cookie|candy|soda|energy|chip/.test(text)) return "want";
  if (/vend|vending/.test(text)) return "want";
  if (/milk|bread|egg|banana|rice|water|medicine|soap|detergent/.test(text)) return "need";
  if (Number(lineTotal) >= 25 && /candy|cookie|snack/.test(text)) return "waste";
  return "review";
}

export function autoPriceSignal({ unitPrice = 0, lineTotal = 0 }) {
  const u = Number(unitPrice) || 0;
  const l = Number(lineTotal) || 0;
  if (u >= 8 || l >= 18) return "high";
  if (u > 0 && u <= 2.5) return "good";
  if (u > 0) return "fair";
  return "neutral";
}

export function autoCoachFlag({ classification = "review", priceSignal = "neutral", lineTotal = 0 }) {
  const total = Number(lineTotal) || 0;
  if (classification === "waste") return "stop";
  if (classification === "want" && (priceSignal === "high" || total >= 12)) return "overspent";
  if (priceSignal === "good") return "good-price";
  if (classification === "want") return "watch";
  return "normal";
}

export function deriveItemSavings({ itemName = "", rawText = "", unitPrice = 0, lineTotal = 0 }) {
  const text = `${itemName} ${rawText}`.toLowerCase();
  let savingsAmount = 0;

  const direct = text.match(/(?:you\s+saved|save|savings|discount|coupon)\s*[:$]?\s*(\d+(?:\.\d{1,2})?)/i);
  if (direct) savingsAmount = Number(direct[1]) || 0;

  if (!savingsAmount) {
    const negative = Number(lineTotal) < 0 ? Math.abs(Number(lineTotal)) : 0;
    if (negative) savingsAmount = negative;
  }

  const bogo = /bogo|buy\s*one\s*get\s*one|2\s*for\s*1|two\s*for\s*one/i.test(text);
  if (!savingsAmount && bogo && Number(unitPrice) > 0) savingsAmount = Number(unitPrice);

  return Number(savingsAmount.toFixed(2));
}

export function deriveReceiptSavingsSummary(items = []) {
  return Number(items.reduce((sum, item) => sum + (Number(item.savings_amount) || 0), 0).toFixed(2));
}

export function extractCardLast4(rawText = "") {
  const text = String(rawText || "");
  const patterns = [
    /(?:visa|mastercard|master card|amex|american express|discover|debit|credit|card)[^0-9]{0,24}(\d{4})/i,
    /(?:ending\s*in|last\s*4|last\s*four|acct\.?|account)[^0-9]{0,12}(\d{4})/i,
    /\*{2,}\s*(\d{4})/,
    /x{2,}\s*(\d{4})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function merchantSimilarityScore(receiptMerchant = "", txMerchant = "") {
  const a = normalizeWhitespace(receiptMerchant).toLowerCase();
  const b = normalizeWhitespace(txMerchant).toLowerCase();
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.7;
  const aWords = new Set(a.split(/\s+/));
  const bWords = new Set(b.split(/\s+/));
  const overlap = [...aWords].filter((w) => bWords.has(w)).length;
  return overlap ? overlap / Math.max(aWords.size, bWords.size) : 0;
}

export function matchReceiptToTransaction({
  receipt,
  transactions = [],
  paymentInstruments = [],
}) {
  const amount = Number(receipt?.total) || 0;
  const merchant = receipt?.merchant || "";
  const cardLast4 = receipt?.cardLast4 || null;
  const receiptDate = receipt?.date ? new Date(receipt.date) : null;

  let best = null;

  for (const tx of transactions) {
    const txAmount = Number(tx.amount) || 0;
    const amountDelta = Math.abs(txAmount - amount);
    if (amount && amountDelta > 2.01) continue;

    let score = 0;
    if (amount) score += Math.max(0, 1 - amountDelta / Math.max(amount, 1)) * 50;

    if (receiptDate && tx.date) {
      const txDate = new Date(tx.date);
      const dayDelta = Math.abs((txDate - receiptDate) / 86400000);
      if (dayDelta <= 3) score += Math.max(0, 1 - dayDelta / 3) * 20;
    }

    score += merchantSimilarityScore(merchant, tx.merchant) * 20;

    if (cardLast4) {
      const instrument = paymentInstruments.find((row) => row.account_id === tx.accountId && String(row.last4 || "") === String(cardLast4));
      if (instrument) score += 25;
    }

    if (!best || score > best.score) best = { tx, score };
  }

  if (!best || best.score < 35) return null;
  return best.tx;
}

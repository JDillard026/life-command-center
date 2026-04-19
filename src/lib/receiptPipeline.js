import { AnalyzeExpenseCommand, TextractClient } from "@aws-sdk/client-textract";

function pad2(value) {
  return String(value).padStart(2, "0");
}

export function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

function roundMoney(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

function cleanString(value) {
  return String(value || "").trim();
}

function cleanMerchant(value) {
  return cleanString(value).replace(/\s+/g, " ");
}

export function normalizeMerchant(value) {
  return cleanMerchant(value).toLowerCase();
}

function extFromName(fileName = "") {
  const clean = cleanString(fileName);
  const match = clean.match(/\.([a-zA-Z0-9]+)$/);
  return match ? match[1].toLowerCase() : "jpg";
}

export function buildReceiptStoragePath(userId, fileName = "receipt.jpg") {
  const now = new Date();
  const ext = extFromName(fileName);
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return `${userId}/spending/${now.getFullYear()}/${pad2(now.getMonth() + 1)}/${id}.${ext}`;
}

function firstPresent(...values) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && !value.trim()) continue;
    return value;
  }
  return null;
}

function moneyFromValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return roundMoney(value);
  }

  const raw = cleanString(value);
  if (!raw) return null;

  const normalized = raw.replace(/,/g, "").match(/-?\d+(?:\.\d{1,2})?/);
  if (!normalized) return null;

  const num = Number(normalized[0]);
  return Number.isFinite(num) ? roundMoney(num) : null;
}

function normalizeDate(value) {
  if (!value) return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
  }

  const raw = cleanString(value);
  if (!raw) return null;

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const slashMatch = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (slashMatch) {
    const month = Number(slashMatch[1]);
    const day = Number(slashMatch[2]);
    const year = Number(slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2000 && year <= 2100) {
      return `${year}-${pad2(month)}-${pad2(day)}`;
    }
  }

  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) return null;
  return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
}

function normalizeLast4(value) {
  const raw = cleanString(value);
  if (!raw) return "";
  const match = raw.match(/(\d{4})(?!.*\d)/);
  return match ? match[1] : "";
}

function guessCategoryFromText(text) {
  const value = cleanString(text).toLowerCase();
  if (!value) return "misc";
  if (/(grocery|walmart|publix|aldi|kroger|costco|sam\'s|sams|whole foods)/.test(value)) return "groceries";
  if (/(shell|sunoco|chevron|exxon|bp|fuel|gas)/.test(value)) return "gas";
  if (/(restaurant|cafe|coffee|starbucks|mcdonald|burger|pizza|grill|barbecue|dining|doordash|ubereats)/.test(value)) return "eating_out";
  if (/(electric|water|utility|internet|phone|comcast|spectrum|at&t|verizon|t-mobile)/.test(value)) return "utilities";
  if (/(mortgage|rent|hoa|property)/.test(value)) return "housing";
  if (/(loan|credit card|interest|finance)/.test(value)) return "debt";
  if (/(doctor|pharmacy|clinic|medical|cvs|walgreens)/.test(value)) return "health";
  if (/(amazon|target|best buy|mall|shopping|apparel|clothing|beauty|home depot|lowe)/.test(value)) return "shopping";
  return "misc";
}

function guessNeedWant(name) {
  const value = cleanString(name).toLowerCase();
  if (!value) return "unknown";
  if (/(milk|bread|egg|water|rice|beans|vegetable|fruit|gas|fuel|medicine|prescription|soap|detergent|trash bag|diaper)/.test(value)) {
    return "need";
  }
  if (/(candy|soda|snack|chips|dessert|ice cream|beer|wine|liquor|toy|game|makeup|gift|coffee|energy drink)/.test(value)) {
    return "want";
  }
  return "unknown";
}

function isDiscountLabel(value) {
  return /(discount|coupon|promo|savings|reward|markdown|member|loyalty|offer|deal)/i.test(cleanString(value));
}

function summarizePricingBreakdown(root, items, fallbackTotal) {
  const subtotalExplicit = moneyFromValue(
    firstPresent(
      root?.subtotal,
      root?.sub_total,
      root?.pre_tax_total,
      root?.item_total,
      root?.merchandise_total,
      root?.breakdown?.subtotal
    )
  );

  const tax = moneyFromValue(
    firstPresent(root?.tax, root?.tax_total, root?.sales_tax, root?.breakdown?.tax)
  ) ?? 0;

  const tip = moneyFromValue(
    firstPresent(root?.tip, root?.gratuity, root?.breakdown?.tip)
  ) ?? 0;

  const fees = moneyFromValue(
    firstPresent(
      root?.fees,
      root?.fee,
      root?.service_charge,
      root?.service_fee,
      root?.delivery_fee,
      root?.breakdown?.fees
    )
  ) ?? 0;

  const explicitDiscounts = moneyFromValue(
    firstPresent(
      root?.discount,
      root?.discount_total,
      root?.coupon,
      root?.coupon_total,
      root?.savings,
      root?.promotion,
      root?.breakdown?.discounts,
      root?.breakdown?.savings
    )
  );

  let detectedDiscounts = 0;
  let positiveItemSubtotal = 0;

  for (const item of items || []) {
    const lineTotal = Number(item?.lineTotal ?? item?.unitPrice ?? 0) || 0;
    const isDiscount = lineTotal < 0 || isDiscountLabel(item?.name);

    if (isDiscount) {
      detectedDiscounts += Math.abs(lineTotal);
    } else if (lineTotal > 0) {
      positiveItemSubtotal += lineTotal;
    }
  }

  const discounts = explicitDiscounts ?? detectedDiscounts;
  const subtotal = subtotalExplicit ?? (positiveItemSubtotal > 0 ? roundMoney(positiveItemSubtotal) : null);
  const total = moneyFromValue(firstPresent(root?.total, root?.grand_total, root?.receipt_total, root?.amount_total, root?.amount, root?.breakdown?.total, fallbackTotal)) ?? 0;

  return {
    subtotal: subtotal ?? 0,
    tax,
    tip,
    fees,
    discounts,
    total,
    savingsEstimate: discounts,
  };
}

export function normalizeReceiptItems(rawItems = []) {
  if (!Array.isArray(rawItems)) return [];

  return rawItems
    .map((item) => {
      const name = cleanString(
        firstPresent(item?.name, item?.description, item?.label, item?.text, item?.product)
      );
      const qty = Number(firstPresent(item?.qty, item?.quantity, item?.count, 1)) || 1;
      const unitPrice = moneyFromValue(firstPresent(item?.unit_price, item?.unitPrice, item?.price_each, item?.price));
      const lineTotal = moneyFromValue(firstPresent(item?.line_total, item?.lineTotal, item?.total, item?.amount, unitPrice ? qty * unitPrice : null));

      if (!name && !lineTotal) return null;

      return {
        name: name || "Receipt item",
        qty,
        unitPrice: unitPrice ?? null,
        lineTotal: lineTotal ?? null,
        categoryGuess: guessCategoryFromText(name),
        needWant: guessNeedWant(name),
        priceScore: null,
      };
    })
    .filter(Boolean);
}

export function normalizeReceiptOcrPayload(payload) {
  const root = payload?.receipt || payload?.document || payload?.data || payload || {};
  const merchantRaw = cleanMerchant(
    firstPresent(
      root?.merchant,
      root?.vendor,
      root?.store,
      root?.store_name,
      root?.merchant_name,
      payload?.merchant,
      payload?.vendor
    )
  );

  const total = moneyFromValue(
    firstPresent(
      root?.total,
      root?.grand_total,
      root?.receipt_total,
      root?.amount_total,
      root?.amount,
      payload?.total,
      payload?.amount
    )
  );

  const receiptDate = normalizeDate(
    firstPresent(
      root?.date,
      root?.purchase_date,
      root?.transaction_date,
      root?.receipt_date,
      payload?.date
    )
  );

  const cardLast4 = normalizeLast4(
    firstPresent(
      root?.card_last4,
      root?.last4,
      root?.payment_card_last4,
      root?.card,
      root?.payment_method,
      payload?.card_last4,
      payload?.last4
    )
  );

  const rawItems = firstPresent(root?.items, root?.line_items, root?.products, payload?.items) || [];
  const items = normalizeReceiptItems(rawItems);

  const merchantNormalized = normalizeMerchant(merchantRaw);
  const guessedCategoryId = guessCategoryFromText(`${merchantRaw} ${items.map((item) => item.name).join(" ")}`);
  const breakdown = summarizePricingBreakdown(root, items, total);

  return {
    merchantRaw,
    merchantNormalized,
    total: breakdown.total ?? total ?? 0,
    receiptDate: receiptDate || todayISO(),
    cardLast4,
    items,
    breakdown,
    guessedCategoryId,
    rawOcrJson: payload,
  };
}


function hasAwsTextractConfig() {
  return Boolean(
    process.env.AWS_REGION &&
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY
  );
}

function buildTextractClient() {
  return new TextractClient({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      ...(process.env.AWS_SESSION_TOKEN
        ? { sessionToken: process.env.AWS_SESSION_TOKEN }
        : {}),
    },
  });
}

function textractFieldValue(field) {
  return cleanString(
    firstPresent(
      field?.ValueDetection?.Text,
      field?.LabelDetection?.Text,
      field?.Type?.Text
    )
  );
}

function textractSummaryLookup(summaryFields = []) {
  const lookup = new Map();

  for (const field of summaryFields) {
    const key = cleanString(field?.Type?.Text).toUpperCase();
    const value = textractFieldValue(field);
    if (!key || !value) continue;
    if (!lookup.has(key)) lookup.set(key, []);
    lookup.get(key).push(value);
  }

  return lookup;
}

function textractFirst(lookup, ...keys) {
  for (const key of keys) {
    const values = lookup.get(String(key || "").toUpperCase());
    if (values?.length) return values[0];
  }
  return null;
}

function parseTextractItems(expenseDocument) {
  const groups = expenseDocument?.LineItemGroups || [];
  const items = [];

  for (const group of groups) {
    for (const lineItem of group?.LineItems || []) {
      const fields = lineItem?.LineItemExpenseFields || [];
      const lookup = new Map();

      for (const field of fields) {
        const key = cleanString(field?.Type?.Text).toUpperCase();
        const value = textractFieldValue(field);
        if (!key || !value) continue;
        lookup.set(key, value);
      }

      items.push({
        name:
          lookup.get("ITEM") ||
          lookup.get("DESCRIPTION") ||
          lookup.get("PRODUCT_CODE") ||
          "Receipt item",
        qty: moneyFromValue(lookup.get("QUANTITY")) || 1,
        unit_price:
          moneyFromValue(lookup.get("UNIT_PRICE")) ||
          moneyFromValue(lookup.get("PRICE")) ||
          null,
        line_total:
          moneyFromValue(lookup.get("PRICE")) ||
          moneyFromValue(lookup.get("AMOUNT")) ||
          moneyFromValue(lookup.get("TOTAL")) ||
          null,
      });
    }
  }

  return items;
}

function extractTextractPayload(response) {
  const expenseDocument = response?.ExpenseDocuments?.[0] || null;
  if (!expenseDocument) {
    throw new Error("AWS Textract returned no expense document.");
  }

  const summaryLookup = textractSummaryLookup(expenseDocument.SummaryFields || []);
  const rawItems = parseTextractItems(expenseDocument);

  const merchant = firstPresent(
    textractFirst(summaryLookup, "VENDOR_NAME"),
    textractFirst(summaryLookup, "RECEIVER_NAME"),
    textractFirst(summaryLookup, "SUPPLIER_NAME"),
    textractFirst(summaryLookup, "STORE_NAME")
  );

  const total = firstPresent(
    textractFirst(summaryLookup, "TOTAL"),
    textractFirst(summaryLookup, "AMOUNT_DUE"),
    textractFirst(summaryLookup, "SUBTOTAL")
  );

  const receiptDate = firstPresent(
    textractFirst(summaryLookup, "INVOICE_RECEIPT_DATE"),
    textractFirst(summaryLookup, "DATE"),
    textractFirst(summaryLookup, "TRANSACTION_DATE")
  );

  const cardLast4 = firstPresent(
    textractFirst(summaryLookup, "LAST4"),
    textractFirst(summaryLookup, "CARD_LAST4"),
    textractFirst(summaryLookup, "ACCOUNT_NUMBER")
  );

  return normalizeReceiptOcrPayload({
    receipt: {
      merchant,
      total,
      date: receiptDate,
      card_last4: cardLast4,
      subtotal: textractFirst(summaryLookup, "SUBTOTAL"),
      tax: textractFirst(summaryLookup, "TAX"),
      discount: firstPresent(
        textractFirst(summaryLookup, "DISCOUNT"),
        textractFirst(summaryLookup, "COUPON"),
        textractFirst(summaryLookup, "PROMOTION")
      ),
      tip: firstPresent(
        textractFirst(summaryLookup, "TIP"),
        textractFirst(summaryLookup, "GRATUITY")
      ),
      fees: firstPresent(
        textractFirst(summaryLookup, "SERVICE_CHARGE"),
        textractFirst(summaryLookup, "SERVICE_FEE"),
        textractFirst(summaryLookup, "DELIVERY_FEE")
      ),
      items: rawItems,
    },
    textract: response,
  });
}

async function callAwsTextractReceiptOcr({ fileBuffer }) {
  const client = buildTextractClient();
  const command = new AnalyzeExpenseCommand({
    Document: {
      Bytes: fileBuffer,
    },
  });

  const response = await client.send(command);
  return extractTextractPayload(response);
}

export async function callReceiptOcr({ fileBuffer, fileName, contentType }) {
  if (hasAwsTextractConfig()) {
    return callAwsTextractReceiptOcr({ fileBuffer, fileName, contentType });
  }

  const url = process.env.RECEIPT_OCR_API_URL;
  const apiKey = process.env.RECEIPT_OCR_API_KEY;
  const authHeader = cleanString(process.env.RECEIPT_OCR_AUTH_HEADER || "x-api-key");

  if (!url || !apiKey) {
    throw new Error(
      "Receipt OCR is not configured. Add AWS Textract envs or RECEIPT_OCR_API_URL / RECEIPT_OCR_API_KEY."
    );
  }

  const body = {
    file_base64: Buffer.from(fileBuffer).toString("base64"),
    file_name: fileName,
    content_type: contentType || "application/octet-stream",
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [authHeader]: apiKey,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Receipt OCR failed (${response.status}).`);
  }

  const json = await response.json();
  return normalizeReceiptOcrPayload(json);
}

function merchantTextForTransaction(tx) {
  return cleanString(firstPresent(tx?.merchant, tx?.note, "")).toLowerCase();
}

function dayDiff(a, b) {
  const left = normalizeDate(a);
  const right = normalizeDate(b);
  if (!left || !right) return 999;
  const leftDate = new Date(`${left}T00:00:00Z`);
  const rightDate = new Date(`${right}T00:00:00Z`);
  return Math.round(Math.abs(leftDate.getTime() - rightDate.getTime()) / 86400000);
}

export function scoreTransactionReceiptMatch(transaction, receipt) {
  const txAmount = Number(transaction?.amount) || 0;
  const receiptAmount = Number(receipt?.total) || 0;
  if (!(txAmount > 0) || !(receiptAmount > 0)) return 0;

  let score = 0;
  const amountDiff = Math.abs(txAmount - receiptAmount);
  if (amountDiff <= 0.01) score += 80;
  else if (amountDiff <= 1) score += 55;
  else if (amountDiff <= 3) score += 25;
  else return 0;

  const days = dayDiff(transaction?.date || transaction?.tx_date, receipt?.receiptDate);
  if (days === 0) score += 35;
  else if (days <= 2) score += 20;
  else if (days <= 7) score += 5;

  const txLast4 = normalizeLast4(transaction?.card_last4 || transaction?.cardLast4 || transaction?.payment_method || transaction?.paymentMethod);
  if (receipt?.cardLast4 && txLast4 && receipt.cardLast4 === txLast4) {
    score += 30;
  }

  const txMerchant = merchantTextForTransaction(transaction);
  const receiptMerchant = cleanString(receipt?.merchantNormalized || receipt?.merchantRaw).toLowerCase();
  if (txMerchant && receiptMerchant) {
    if (txMerchant.includes(receiptMerchant) || receiptMerchant.includes(txMerchant)) {
      score += 15;
    }
  }

  return score;
}

export function pickBestTransactionMatch(transactions = [], receipt) {
  const scored = (transactions || [])
    .map((transaction) => ({
      transaction,
      score: scoreTransactionReceiptMatch(transaction, receipt),
    }))
    .filter((entry) => entry.score >= 70)
    .sort((a, b) => b.score - a.score);

  return scored[0] || null;
}

export function buildReceiptTransactionPayload({ userId, receiptId, receipt, matchedAccount }) {
  const nowIso = new Date().toISOString();
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    user_id: userId,
    type: "expense",
    amount: roundMoney(receipt.total),
    category_id: receipt.guessedCategoryId || "misc",
    tx_date: receipt.receiptDate || todayISO(),
    tx_time: null,
    merchant: receipt.merchantRaw || "Receipt scan",
    note: receipt.cardLast4 ? `Receipt scan • card ${receipt.cardLast4}` : "Receipt scan",
    payment_method: receipt.cardLast4 ? `Card • ${receipt.cardLast4}` : "Receipt Scan",
    account_name: matchedAccount?.name || "",
    source_type: "receipt",
    receipt_id: receiptId,
    external_transaction_id: null,
    external_account_id: matchedAccount?.external_account_id || null,
    card_last4: receipt.cardLast4 || null,
    match_status: matchedAccount ? "account_matched" : "unmatched",
    merchant_normalized: receipt.merchantNormalized || null,
    created_at: nowIso,
    updated_at: nowIso,
  };
}

export async function createSignedReceiptUrl(supabaseAdmin, bucketName, storagePath, expiresIn = 604800) {
  const { data, error } = await supabaseAdmin.storage
    .from(bucketName)
    .createSignedUrl(storagePath, expiresIn);

  if (error) {
    throw new Error(error.message || "Could not create receipt URL.");
  }

  return data?.signedUrl || "";
}

export async function findMatchingAccountByLast4(supabaseAdmin, userId, cardLast4) {
  if (!cardLast4) return null;

  const { data, error } = await supabaseAdmin
    .from("accounts")
    .select("id,name,balance,card_last4,external_account_id,institution_name")
    .eq("user_id", userId)
    .eq("card_last4", cardLast4)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Could not search accounts.");
  }

  return data || null;
}

export async function loadTransactionCandidates(supabaseAdmin, userId, receiptDate) {
  let query = supabaseAdmin
    .from("spending_transactions")
    .select("id,amount,merchant,note,tx_date,payment_method,card_last4,source_type")
    .eq("user_id", userId)
    .order("tx_date", { ascending: false })
    .limit(120);

  if (receiptDate) {
    const anchor = new Date(`${receiptDate}T00:00:00Z`);
    const start = new Date(anchor);
    const end = new Date(anchor);
    start.setDate(start.getDate() - 7);
    end.setDate(end.getDate() + 7);
    query = query.gte("tx_date", normalizeDate(start)).lte("tx_date", normalizeDate(end));
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message || "Could not load transaction candidates.");
  }

  return data || [];
}

export async function postReceiptExpenseLedger({ supabaseAdmin, userId, account, transaction }) {
  if (!account?.id) return null;

  const currentBalance = Number(account.balance) || 0;
  const amount = roundMoney(transaction.amount);
  if (!(amount > 0)) return null;

  const nextBalance = roundMoney(currentBalance - amount);
  const createdAt = transaction.created_at || new Date().toISOString();
  const ledgerId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const { error: accountError } = await supabaseAdmin
    .from("accounts")
    .update({
      balance: nextBalance,
      updated_at: createdAt,
    })
    .eq("id", account.id)
    .eq("user_id", userId);

  if (accountError) {
    throw new Error(accountError.message || "Could not update account balance for receipt transaction.");
  }

  const { error: ledgerError } = await supabaseAdmin.from("account_transactions").insert([
    {
      id: ledgerId,
      user_id: userId,
      account_id: account.id,
      kind: "withdraw",
      amount,
      delta: -amount,
      resulting_balance: nextBalance,
      note: transaction.note || transaction.merchant || "Receipt expense",
      related_account_id: null,
      related_account_name: null,
      source_type: "spending_transaction",
      source_id: transaction.id,
      created_at: createdAt,
    },
  ]);

  if (ledgerError) {
    throw new Error(ledgerError.message || "Could not write receipt ledger row.");
  }

  return {
    nextBalance,
    ledgerId,
  };
}

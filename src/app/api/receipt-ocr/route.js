import { NextResponse } from "next/server";
import { AnalyzeExpenseCommand, TextractClient } from "@aws-sdk/client-textract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REGION =
  process.env.AWS_REGION ||
  process.env.AWS_DEFAULT_REGION ||
  process.env.TEXTRACT_AWS_REGION;

function buildClient() {
  if (!REGION) {
    throw new Error("Missing AWS_REGION for receipt OCR.");
  }

  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const sessionToken = process.env.AWS_SESSION_TOKEN;

  return new TextractClient({
    region: REGION,
    ...(accessKeyId && secretAccessKey
      ? {
          credentials: {
            accessKeyId,
            secretAccessKey,
            ...(sessionToken ? { sessionToken } : {}),
          },
        }
      : {}),
  });
}

function normalizeWhitespace(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function parseMoney(value) {
  const raw = String(value || "").replace(/[^0-9.\-]/g, "");
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDateToIso(value) {
  const text = normalizeWhitespace(value);
  if (!text) return "";

  const native = new Date(text);
  if (!Number.isNaN(native.getTime())) {
    return native.toISOString().slice(0, 10);
  }

  const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    const [, mm, dd, yy] = slashMatch;
    const year = yy.length === 2 ? `20${yy}` : yy;
    return `${year.padStart(4, "0")}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }

  return "";
}

function average(values) {
  const clean = values.filter((n) => Number.isFinite(n));
  if (!clean.length) return null;
  return clean.reduce((sum, n) => sum + n, 0) / clean.length;
}

function summaryMap(summaryFields = []) {
  const map = new Map();
  for (const field of summaryFields) {
    const type = normalizeWhitespace(field?.Type?.Text).toUpperCase();
    const value = normalizeWhitespace(field?.ValueDetection?.Text);
    const confidence = average([
      Number(field?.Type?.Confidence),
      Number(field?.ValueDetection?.Confidence),
    ]);
    if (!type || !value) continue;
    if (!map.has(type)) {
      map.set(type, []);
    }
    map.get(type).push({ value, confidence });
  }
  return map;
}

function getFirstSummaryValue(map, keys = []) {
  for (const key of keys) {
    const hit = map.get(key);
    if (hit?.[0]?.value) return hit[0].value;
  }
  return "";
}

function getFirstSummaryMoney(map, keys = []) {
  const value = getFirstSummaryValue(map, keys);
  return parseMoney(value);
}

function normalizeLineItems(lineItemGroups = []) {
  const items = [];

  for (const group of lineItemGroups) {
    for (const line of group?.LineItems || []) {
      const fields = new Map();
      const confidences = [];

      for (const field of line?.LineItemExpenseFields || []) {
        const type = normalizeWhitespace(field?.Type?.Text).toUpperCase();
        const value = normalizeWhitespace(field?.ValueDetection?.Text);
        const confidence = average([
          Number(field?.Type?.Confidence),
          Number(field?.ValueDetection?.Confidence),
        ]);
        if (Number.isFinite(confidence)) confidences.push(confidence);
        if (type && value && !fields.has(type)) {
          fields.set(type, value);
        }
      }

      const itemName =
        fields.get("ITEM") ||
        fields.get("EXPENSE_ROW") ||
        fields.get("DESCRIPTION") ||
        "";
      const quantity = parseMoney(fields.get("QUANTITY")) || 1;
      const unitPrice =
        parseMoney(fields.get("PRICE")) ??
        parseMoney(fields.get("UNIT_PRICE")) ??
        parseMoney(fields.get("RATE"));
      const lineTotal =
        parseMoney(fields.get("AMOUNT")) ??
        parseMoney(fields.get("TOTAL")) ??
        parseMoney(fields.get("PRICE")) ??
        (Number.isFinite(unitPrice) ? quantity * unitPrice : 0);

      if (!itemName && !Number.isFinite(lineTotal)) continue;

      items.push({
        itemName: itemName || "Receipt item",
        quantity,
        unitPrice: Number.isFinite(unitPrice) ? Number(unitPrice.toFixed(2)) : 0,
        lineTotal: Number.isFinite(lineTotal) ? Number(lineTotal.toFixed(2)) : 0,
        note: "",
        confidence: average(confidences),
      });
    }
  }

  return items;
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No receipt file was provided." }, { status: 400 });
    }

    if (!file.size) {
      return NextResponse.json({ error: "The receipt file is empty." }, { status: 400 });
    }

    const supported = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/tiff",
      "application/pdf",
    ];

    if (file.type && !supported.includes(file.type)) {
      return NextResponse.json(
        { error: "Receipt OCR supports PNG, JPEG, TIFF, and PDF files." },
        { status: 400 }
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "This file is too large for synchronous receipt OCR. Keep it under 10 MB." },
        { status: 400 }
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const client = buildClient();
    const response = await client.send(
      new AnalyzeExpenseCommand({
        Document: {
          Bytes: bytes,
        },
      })
    );

    const expense = response?.ExpenseDocuments?.[0];
    if (!expense) {
      return NextResponse.json(
        { error: "OCR ran, but no receipt data was returned." },
        { status: 422 }
      );
    }

    const summary = summaryMap(expense.SummaryFields || []);
    const items = normalizeLineItems(expense.LineItemGroups || []);

    const merchant = getFirstSummaryValue(summary, ["VENDOR_NAME", "NAME"]);
    const dateText = getFirstSummaryValue(summary, ["INVOICE_RECEIPT_DATE", "DATE"]);
    const subtotal = getFirstSummaryMoney(summary, ["SUBTOTAL"]);
    const tax = getFirstSummaryMoney(summary, ["TAX", "TAX_AMOUNT"]);
    const total = getFirstSummaryMoney(summary, ["TOTAL", "AMOUNT_DUE"]);

    const summaryConf = [];
    for (const entries of summary.values()) {
      for (const entry of entries) {
        if (Number.isFinite(entry.confidence)) summaryConf.push(entry.confidence);
      }
    }
    const itemConfs = items.map((item) => item.confidence).filter((n) => Number.isFinite(n));

    return NextResponse.json({
      merchant,
      date: parseDateToIso(dateText),
      subtotal: Number.isFinite(subtotal) ? subtotal : null,
      tax: Number.isFinite(tax) ? tax : null,
      total: Number.isFinite(total) ? total : null,
      items: items.map((item) => ({
        itemName: item.itemName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
        note: item.note,
      })),
      ocr: {
        provider: "aws_textract_analyze_expense",
        providerLabel: "AWS Textract",
        pages: Number(response?.DocumentMetadata?.Pages) || 1,
        summaryFieldCount: expense?.SummaryFields?.length || 0,
        itemCount: items.length,
        confidence: average([...summaryConf, ...itemConfs]),
        scannedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Receipt OCR failed." },
      { status: 500 }
    );
  }
}

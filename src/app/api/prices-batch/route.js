import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TTL_MS = 1000 * 60 * 2;
const memoryCache = new Map();

function toNum(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeSymbol(value) {
  return String(value || "").trim().toUpperCase();
}

function makeKey(symbols) {
  return symbols.join(",");
}

function getCached(key) {
  const hit = memoryCache.get(key);
  if (!hit) return null;

  if (Date.now() - hit.ts > TTL_MS) {
    memoryCache.delete(key);
    return null;
  }

  return hit.data;
}

function setCached(key, data) {
  memoryCache.set(key, {
    ts: Date.now(),
    data,
  });
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const symbols = String(searchParams.get("symbols") || "")
      .split(",")
      .map(normalizeSymbol)
      .filter(Boolean);

    if (!symbols.length) {
      return NextResponse.json({
        prices: {},
        error: "",
        rateLimited: false,
      });
    }

    const dedupedSymbols = [...new Set(symbols)];
    const cacheKey = makeKey(dedupedSymbols);
    const cached = getCached(cacheKey);

    if (cached) {
      return NextResponse.json({
        ...cached,
        cached: true,
      });
    }

    const apiKey =
      process.env.FMP_API_KEY ||
      process.env.NEXT_PUBLIC_FMP_API_KEY ||
      process.env.FINANCIAL_MODELING_PREP_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        prices: cached?.prices || {},
        error: "Missing FMP API key.",
        rateLimited: false,
      });
    }

    const url =
      `https://financialmodelingprep.com/stable/quote` +
      `?symbol=${encodeURIComponent(dedupedSymbols.join(","))}` +
      `&apikey=${encodeURIComponent(apiKey)}`;

    const res = await fetch(url, {
      cache: "no-store",
    });

    if (res.status === 429) {
      return NextResponse.json({
        prices: cached?.prices || {},
        error: "Batch prices temporarily unavailable.",
        rateLimited: true,
      });
    }

    const text = await res.text();

    if (!res.ok) {
      return NextResponse.json({
        prices: cached?.prices || {},
        error: `FMP batch request failed: ${res.status}`,
        details: text,
        rateLimited: false,
      });
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json({
        prices: cached?.prices || {},
        error: "FMP batch route returned non-JSON.",
        details: text,
        rateLimited: false,
      });
    }

    if (!Array.isArray(data)) {
      return NextResponse.json({
        prices: cached?.prices || {},
        error: "Unexpected batch price response.",
        details: data,
        rateLimited: false,
      });
    }

    const prices = {};

    for (const row of data) {
      const symbol = normalizeSymbol(row?.symbol);
      if (!symbol) continue;

      const price = toNum(row?.price);
      const change = toNum(row?.change);
      const changesPercentage =
        toNum(row?.changesPercentage) ??
        toNum(row?.changePercent) ??
        toNum(row?.percent_change);

      if (price === null || price <= 0) continue;

      prices[symbol] = {
        price,
        change,
        changesPercentage,
      };
    }

    const payload = {
      prices,
      error: "",
      rateLimited: false,
    };

    setCached(cacheKey, payload);

    return NextResponse.json(payload);
  } catch (err) {
    console.error("prices-batch route error", err);

    return NextResponse.json({
      prices: {},
      error: err?.message || "Failed to load batch prices.",
      rateLimited: false,
    });
  }
}
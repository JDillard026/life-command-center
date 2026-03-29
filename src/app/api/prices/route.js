import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TTL_MS = 1000 * 30;
const memoryCache = new Map();

function toNum(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeSymbol(value) {
  return String(value || "").trim().toUpperCase();
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
    const symbol = normalizeSymbol(searchParams.get("symbol"));

    if (!symbol) {
      return NextResponse.json(
        { error: "Missing symbol", rateLimited: false },
        { status: 400 }
      );
    }

    const cached = getCached(symbol);
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
      return NextResponse.json(
        { error: "Missing FMP API key", rateLimited: false },
        { status: 500 }
      );
    }

    const url =
      `https://financialmodelingprep.com/stable/quote` +
      `?symbol=${encodeURIComponent(symbol)}` +
      `&apikey=${encodeURIComponent(apiKey)}`;

    const res = await fetch(url, { cache: "no-store" });

    if (res.status === 429) {
      if (cached) {
        return NextResponse.json({
          ...cached,
          error: "",
          rateLimited: true,
          cached: true,
        });
      }

      return NextResponse.json(
        {
          error: "Live quote temporarily unavailable.",
          rateLimited: true,
        },
        { status: 200 }
      );
    }

    const text = await res.text();

    if (!res.ok) {
      return NextResponse.json(
        {
          error: `FMP request failed: ${res.status}`,
          details: text,
          rateLimited: false,
        },
        { status: 502 }
      );
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        {
          error: "FMP returned non-JSON",
          details: text,
          rateLimited: false,
        },
        { status: 502 }
      );
    }

    const row = Array.isArray(data) ? data[0] : data;

    const price = toNum(row?.price);
    const change = toNum(row?.change);
    const changesPercentage =
      toNum(row?.changesPercentage) ??
      toNum(row?.changePercent) ??
      toNum(row?.percent_change);

    const open = toNum(row?.open);
    const dayLow = toNum(row?.dayLow);
    const dayHigh = toNum(row?.dayHigh);
    const yearHigh = toNum(row?.yearHigh);
    const yearLow = toNum(row?.yearLow);
    const volume = toNum(row?.volume);
    const avgVolume = toNum(row?.avgVolume);
    const marketCap = toNum(row?.marketCap);
    const previousClose = toNum(row?.previousClose);
    const exchange = row?.exchangeShortName || row?.exchange || null;
    const name = row?.name || null;

    if (price === null || price <= 0) {
      return NextResponse.json(
        {
          error: "Price unavailable",
          details: row || null,
          rateLimited: false,
        },
        { status: 404 }
      );
    }

    const payload = {
      symbol,
      name,
      exchange,
      price,
      change,
      changesPercentage,
      open,
      previousClose,
      dayLow,
      dayHigh,
      yearLow,
      yearHigh,
      volume,
      avgVolume,
      marketCap,
      rateLimited: false,
      error: "",
    };

    setCached(symbol, payload);

    return NextResponse.json(payload);
  } catch (err) {
    console.error("prices route error", err);

    return NextResponse.json(
      {
        error: err?.message || "Price fetch failed",
        rateLimited: false,
      },
      { status: 500 }
    );
  }
}
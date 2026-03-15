import { NextResponse } from "next/server";

function toNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = String(searchParams.get("symbol") || "").trim().toUpperCase();

    if (!symbol) {
      return NextResponse.json({ error: "Missing symbol" }, { status: 400 });
    }

    const apiKey = process.env.FMP_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "Missing FMP_API_KEY" }, { status: 500 });
    }

    const url =
      `https://financialmodelingprep.com/stable/quote` +
      `?symbol=${encodeURIComponent(symbol)}` +
      `&apikey=${encodeURIComponent(apiKey)}`;

    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();

    console.log("FMP STATUS:", res.status);
    console.log("FMP RAW:", text);

    if (!res.ok) {
      return NextResponse.json(
        { error: `FMP request failed: ${res.status}`, details: text },
        { status: 502 }
      );
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "FMP returned non-JSON", details: text },
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
        { error: "Price unavailable", details: data },
        { status: 404 }
      );
    }

    return NextResponse.json({
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
      raw: row,
    });
  } catch (err) {
    console.error("PRICES ROUTE ERROR:", err);
    return NextResponse.json(
      { error: err?.message || "Price fetch failed" },
      { status: 500 }
    );
  }
}
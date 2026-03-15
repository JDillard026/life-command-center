import { NextResponse } from "next/server";

const INTRADAY_INTERVALS = new Set(["1m", "5m", "15m", "30m", "1h", "4h"]);

const FMP_INTRADAY_MAP = {
  "1m": "1min",
  "5m": "5min",
  "15m": "15min",
  "30m": "30min",
  "1h": "1hour",
  "4h": "4hour",
};

const RANGE_TO_DAYS = {
  "1D": 2,
  "5D": 7,
  "1M": 31,
  "3M": 93,
  "6M": 186,
  "1Y": 366,
  "ALL": 3650,
};

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function subtractDays(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function normalizeRows(rows = []) {
  return rows
    .map((r) => ({
      time: String(r.date || r.datetime || r.timestamp || ""),
      open: Number(r.open),
      high: Number(r.high),
      low: Number(r.low),
      close: Number(r.close),
      volume: Number(r.volume),
    }))
    .filter(
      (r) =>
        r.time &&
        Number.isFinite(r.open) &&
        Number.isFinite(r.high) &&
        Number.isFinite(r.low) &&
        Number.isFinite(r.close)
    )
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
}

async function fetchRaw(url) {
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();

  let raw = null;
  try {
    raw = JSON.parse(text);
  } catch {
    raw = null;
  }

  return { res, text, raw };
}

function extractRows(raw) {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.historical)) return raw.historical;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const symbol = String(searchParams.get("symbol") || "")
      .trim()
      .toUpperCase();

    const range = String(searchParams.get("range") || "1M")
      .trim()
      .toUpperCase();

    const requestedInterval = String(searchParams.get("interval") || "1D")
      .trim()
      .toLowerCase();

    if (!symbol) {
      return NextResponse.json({ error: "Missing symbol." }, { status: 400 });
    }

    const apiKey = process.env.FMP_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing FMP_API_KEY." }, { status: 500 });
    }

    let interval = requestedInterval;
    if (!INTRADAY_INTERVALS.has(interval)) {
      interval = "1D";
    }

    if (["3M", "6M", "1Y", "ALL"].includes(range)) {
      interval = "1D";
    }

    if (range === "1M" && !["1h", "1D"].includes(interval)) {
      interval = "1h";
    }

    if (range === "5D" && !["5m", "15m", "30m", "1h"].includes(interval)) {
      interval = "15m";
    }

    if (range === "1D" && !["1m", "5m", "15m", "30m", "1h"].includes(interval)) {
      interval = "5m";
    }

    const to = new Date();
    const from = subtractDays(RANGE_TO_DAYS[range] || 31);

    let rows = [];
    let source = "eod";
    let actualInterval = interval;
    let notice = "";

    // Try intraday first when requested
    if (interval !== "1D") {
      const fmpInterval = FMP_INTRADAY_MAP[interval];

      const intradayUrl =
        `https://financialmodelingprep.com/stable/historical-chart/${fmpInterval}` +
        `?symbol=${encodeURIComponent(symbol)}` +
        `&from=${isoDate(from)}` +
        `&to=${isoDate(to)}` +
        `&apikey=${encodeURIComponent(apiKey)}`;

      const intraday = await fetchRaw(intradayUrl);

      if (intraday.res.ok) {
        rows = extractRows(intraday.raw);
        source = "intraday";
      } else {
        // fallback to EOD instead of leaving chart dead
        notice =
          "Intraday data is not available on the current FMP plan. Falling back to daily candles.";

        actualInterval = "1D";
      }
    }

    // EOD path or fallback path
    if (!rows.length) {
      const eodUrl =
        `https://financialmodelingprep.com/stable/historical-price-eod/full` +
        `?symbol=${encodeURIComponent(symbol)}` +
        `&from=${isoDate(from)}` +
        `&to=${isoDate(to)}` +
        `&apikey=${encodeURIComponent(apiKey)}`;

      const eod = await fetchRaw(eodUrl);

      if (!eod.res.ok) {
        throw new Error(
          `Chart request failed: ${eod.res.status} ${String(eod.text).slice(0, 180)}`
        );
      }

      rows = extractRows(eod.raw);
      source = "eod";
    }

    const candles = normalizeRows(rows);

    const volume = candles.map((r) => ({
      time: r.time,
      value: Number.isFinite(r.volume) ? r.volume : 0,
      color: r.close >= r.open ? "rgba(34,197,94,0.45)" : "rgba(239,68,68,0.45)",
    }));

    const line = candles.map((r) => ({
      time: r.time,
      value: r.close,
    }));

    return NextResponse.json({
      symbol,
      range,
      interval: actualInterval,
      source,
      notice,
      candles,
      volume,
      line,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Failed to load chart data." },
      { status: 500 }
    );
  }
}
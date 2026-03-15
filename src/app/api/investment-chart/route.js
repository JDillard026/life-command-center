import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = String(searchParams.get("symbol") || "").trim().toUpperCase();
    const range = String(searchParams.get("range") || "6M").trim().toUpperCase();

    if (!symbol) {
      return NextResponse.json({ error: "Missing symbol." }, { status: 400 });
    }

    const apiKey = process.env.FMP_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing FMP_API_KEY." }, { status: 500 });
    }

    const to = new Date();
    const from = new Date();

    switch (range) {
      case "1M":
        from.setMonth(from.getMonth() - 1);
        break;
      case "3M":
        from.setMonth(from.getMonth() - 3);
        break;
      case "6M":
        from.setMonth(from.getMonth() - 6);
        break;
      case "1Y":
        from.setFullYear(from.getFullYear() - 1);
        break;
      case "ALL":
        from.setFullYear(from.getFullYear() - 10);
        break;
      default:
        from.setMonth(from.getMonth() - 6);
        break;
    }

    const fromStr = from.toISOString().slice(0, 10);
    const toStr = to.toISOString().slice(0, 10);

    const url =
      `https://financialmodelingprep.com/stable/historical-price-eod/full` +
      `?symbol=${encodeURIComponent(symbol)}` +
      `&from=${fromStr}` +
      `&to=${toStr}` +
      `&apikey=${encodeURIComponent(apiKey)}`;

    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();

    console.log("CHART STATUS:", res.status);
    console.log("CHART RAW:", text.slice(0, 400));

    if (!res.ok) {
      return NextResponse.json(
        { error: `Chart request failed: ${res.status}`, details: text },
        { status: 502 }
      );
    }

    let raw;
    try {
      raw = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "Chart API returned non-JSON", details: text },
        { status: 502 }
      );
    }

    let rows = [];
    if (Array.isArray(raw)) rows = raw;
    else if (Array.isArray(raw?.historical)) rows = raw.historical;
    else if (Array.isArray(raw?.data)) rows = raw.data;

    const candles = rows
      .map((r) => ({
        time: String(r.date || ""),
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
      .sort((a, b) => a.time.localeCompare(b.time));

    const volume = candles.map((r) => ({
      time: r.time,
      value: Number.isFinite(r.volume) ? r.volume : 0,
      color: r.close >= r.open ? "rgba(34,197,94,.45)" : "rgba(239,68,68,.45)",
    }));

    const line = candles.map((r) => ({
      time: r.time,
      value: r.close,
    }));

    return NextResponse.json({
      symbol,
      range,
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
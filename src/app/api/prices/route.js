import { NextResponse } from "next/server";

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
    const price = Number(row?.price);

    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.json(
        { error: "Price unavailable", details: data },
        { status: 404 }
      );
    }

    return NextResponse.json({ symbol, price });
  } catch (err) {
    console.error("PRICES ROUTE ERROR:", err);
    return NextResponse.json(
      { error: err?.message || "Price fetch failed" },
      { status: 500 }
    );
  }
}

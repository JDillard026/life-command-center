import { NextResponse } from "next/server";

export async function GET(req) {
  try {

    const { searchParams } = new URL(req.url);
    const symbols = String(searchParams.get("symbols") || "")
      .split(",")
      .map(s => s.trim().toUpperCase())
      .filter(Boolean);

    if (!symbols.length) {
      return NextResponse.json({ prices: {} });
    }

    const apiKey = process.env.FMP_API_KEY;

    const url =
      `https://financialmodelingprep.com/stable/quote?symbol=${symbols.join(",")}&apikey=${apiKey}`;

    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();

    if (!Array.isArray(data)) {
      return NextResponse.json({ prices: {} });
    }

    const prices = {};

    for (const row of data) {
      if (row.symbol && row.price) {
        prices[row.symbol] = Number(row.price);
      }
    }

    return NextResponse.json({ prices });

  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Failed to load prices." },
      { status: 500 }
    );
  }
}
import { NextResponse } from "next/server"

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const symbol = searchParams.get("symbol")

    if (!symbol) {
      return NextResponse.json({ error: "Missing symbol" }, { status: 400 })
    }

    const key = process.env.FMP_API_KEY

    if (!key) {
      return NextResponse.json({ error: "Missing FMP API key" }, { status: 500 })
    }

    const url = `https://financialmodelingprep.com/stable/historical-price-eod/light?symbol=${encodeURIComponent(
      symbol
    )}&apikey=${key}`

    const res = await fetch(url, { cache: "no-store" })
    const data = await res.json()

    const row = Array.isArray(data) ? data[0] : null
    const price = Number(row?.close)

    if (Number.isFinite(price) && price > 0) {
      return NextResponse.json({ price })
    }

    return NextResponse.json(
      {
        price: null,
        error: "No usable EOD price returned",
      },
      { status: 200 }
    )
  } catch (err) {
    return NextResponse.json(
      {
        price: null,
        error: err?.message || "Unknown error",
      },
      { status: 500 }
    )
  }
}
import { NextResponse } from "next/server"

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const symbol = searchParams.get("symbol")

    if (!symbol) {
      return NextResponse.json({ error: "Missing symbol" }, { status: 400 })
    }

    const key = process.env.ALPHAVANTAGE_API_KEY

    if (!key) {
      return NextResponse.json({ error: "Missing API key" }, { status: 500 })
    }

    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(
      symbol
    )}&apikey=${key}`

    const res = await fetch(url, { cache: "no-store" })
    const data = await res.json()

    const rawPrice = data?.["Global Quote"]?.["05. price"]
    const price = Number(rawPrice)

    if (Number.isFinite(price) && price > 0) {
      return NextResponse.json({ price })
    }

    return NextResponse.json(
      {
        price: null,
        error: "No usable price returned",
        debug: data,
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
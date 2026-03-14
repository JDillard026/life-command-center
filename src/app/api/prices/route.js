import { NextResponse } from "next/server"

export async function GET(req){

  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get("symbol")

  if(!symbol){
    return NextResponse.json({ error: "Missing symbol" })
  }

  const key = process.env.ALPHAVANTAGE_API_KEY

  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${key}`

  const res = await fetch(url)
  const data = await res.json()

  const price = data["Global Quote"]?.["05. price"]

  return NextResponse.json({
    price: Number(price)
  })

}
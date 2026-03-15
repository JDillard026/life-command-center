"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

function money(n) {
  const num = Number(n)
  if (!Number.isFinite(num)) return "—"
  return num.toLocaleString(undefined, { style: "currency", currency: "USD" })
}

const STARTER_MARKET = [
  { symbol: "AAPL", name: "Apple Inc.", type: "Stock", exchange: "NASDAQ", sector: "Technology" },
  { symbol: "MSFT", name: "Microsoft Corporation", type: "Stock", exchange: "NASDAQ", sector: "Technology" },
  { symbol: "NVDA", name: "NVIDIA Corporation", type: "Stock", exchange: "NASDAQ", sector: "Technology" },
  { symbol: "AMZN", name: "Amazon.com, Inc.", type: "Stock", exchange: "NASDAQ", sector: "Consumer Cyclical" },
  { symbol: "GOOGL", name: "Alphabet Inc.", type: "Stock", exchange: "NASDAQ", sector: "Communication Services" },
  { symbol: "META", name: "Meta Platforms, Inc.", type: "Stock", exchange: "NASDAQ", sector: "Communication Services" },
  { symbol: "TSLA", name: "Tesla, Inc.", type: "Stock", exchange: "NASDAQ", sector: "Consumer Cyclical" },
  { symbol: "AMD", name: "Advanced Micro Devices, Inc.", type: "Stock", exchange: "NASDAQ", sector: "Technology" },
  { symbol: "AVGO", name: "Broadcom Inc.", type: "Stock", exchange: "NASDAQ", sector: "Technology" },
  { symbol: "NFLX", name: "Netflix, Inc.", type: "Stock", exchange: "NASDAQ", sector: "Communication Services" },
  { symbol: "JPM", name: "JPMorgan Chase & Co.", type: "Stock", exchange: "NYSE", sector: "Financial Services" },
  { symbol: "V", name: "Visa Inc.", type: "Stock", exchange: "NYSE", sector: "Financial Services" },
  { symbol: "MA", name: "Mastercard Incorporated", type: "Stock", exchange: "NYSE", sector: "Financial Services" },
  { symbol: "BRK.B", name: "Berkshire Hathaway Inc.", type: "Stock", exchange: "NYSE", sector: "Financial Services" },
  { symbol: "WMT", name: "Walmart Inc.", type: "Stock", exchange: "NYSE", sector: "Consumer Defensive" },
  { symbol: "COST", name: "Costco Wholesale Corporation", type: "Stock", exchange: "NASDAQ", sector: "Consumer Defensive" },
  { symbol: "LLY", name: "Eli Lilly and Company", type: "Stock", exchange: "NYSE", sector: "Healthcare" },
  { symbol: "JNJ", name: "Johnson & Johnson", type: "Stock", exchange: "NYSE", sector: "Healthcare" },
  { symbol: "XOM", name: "Exxon Mobil Corporation", type: "Stock", exchange: "NYSE", sector: "Energy" },
  { symbol: "CVX", name: "Chevron Corporation", type: "Stock", exchange: "NYSE", sector: "Energy" },
  { symbol: "SPY", name: "SPDR S&P 500 ETF Trust", type: "ETF", exchange: "NYSE Arca", sector: "Index ETF" },
  { symbol: "VOO", name: "Vanguard S&P 500 ETF", type: "ETF", exchange: "NYSE Arca", sector: "Index ETF" },
  { symbol: "IVV", name: "iShares Core S&P 500 ETF", type: "ETF", exchange: "NYSE Arca", sector: "Index ETF" },
  { symbol: "QQQ", name: "Invesco QQQ Trust", type: "ETF", exchange: "NASDAQ", sector: "Index ETF" },
  { symbol: "VTI", name: "Vanguard Total Stock Market ETF", type: "ETF", exchange: "NYSE Arca", sector: "Index ETF" },
  { symbol: "SCHD", name: "Schwab U.S. Dividend Equity ETF", type: "ETF", exchange: "NYSE Arca", sector: "Dividend ETF" },
  { symbol: "DIA", name: "SPDR Dow Jones Industrial Average ETF Trust", type: "ETF", exchange: "NYSE Arca", sector: "Index ETF" },
  { symbol: "IWM", name: "iShares Russell 2000 ETF", type: "ETF", exchange: "NYSE Arca", sector: "Index ETF" },
  { symbol: "ARKK", name: "ARK Innovation ETF", type: "ETF", exchange: "NYSE Arca", sector: "Thematic ETF" },
  { symbol: "SOXX", name: "iShares Semiconductor ETF", type: "ETF", exchange: "NASDAQ", sector: "Sector ETF" },
]

export default function MarketSymbolPage({ params }) {
  const symbol = decodeURIComponent(params?.symbol || "").toUpperCase()
  const [price, setPrice] = useState(null)

  const asset = useMemo(() => {
    return STARTER_MARKET.find((x) => x.symbol.toUpperCase() === symbol) || null
  }, [symbol])

  useEffect(() => {
    async function loadPrice() {
      if (!symbol) return

      try {
        const res = await fetch(`/api/prices?symbol=${encodeURIComponent(symbol)}`)
        const data = await res.json()

        if (Number.isFinite(Number(data?.price)) && Number(data.price) > 0) {
          setPrice(Number(data.price))
        } else {
          setPrice(null)
        }
      } catch (err) {
        console.error("price fetch failed", err)
        setPrice(null)
      }
    }

    loadPrice()
  }, [symbol])

  if (!asset) {
    return (
      <main style={{ padding: "36px 28px 44px", maxWidth: "1280px", margin: "0 auto" }}>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontWeight: 900 }}>Market symbol not found in starter list.</div>
          <div className="muted" style={{ marginTop: 8 }}>
            Once live market search is added, this page can support far more public assets.
          </div>
          <div style={{ marginTop: 14 }}>
            <Link href="/investments/discover" className="btn">
              Back to Discover
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main style={{ padding: "36px 28px 44px", maxWidth: "1280px", margin: "0 auto" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr .9fr",
          gap: 18,
          alignItems: "start",
        }}
      >
        <div style={{ display: "grid", gap: 18 }}>
          <div className="card" style={{ padding: 18 }}>
            <div className="muted" style={{ fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.16em" }}>
              Market Asset
            </div>

            <h1
              style={{
                margin: "10px 0 0",
                fontSize: "clamp(2rem, 4vw, 3rem)",
                lineHeight: 1.04,
                fontWeight: 950,
              }}
            >
              {asset.symbol}
            </h1>

            <div style={{ marginTop: 10, fontWeight: 850, fontSize: 18 }}>
              {asset.name}
            </div>

            <div className="muted" style={{ marginTop: 10, fontSize: 14 }}>
              {asset.type} • {asset.exchange} • {asset.sector}
            </div>

            <div style={{ height: 18 }} />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 12,
              }}
            >
              <StatCard title="Live Price" value={price ? money(price) : "Unavailable"} sub="Uses your current quote endpoint if available." />
              <StatCard title="Asset Type" value={asset.type} sub="Public market classification." />
              <StatCard title="Exchange" value={asset.exchange} sub="Primary exchange in starter data." />
            </div>

            <div style={{ height: 18 }} />

            <FakeChart />
          </div>
        </div>

        <div style={{ display: "grid", gap: 18 }}>
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontWeight: 950, fontSize: 20 }}>About this market page</div>
            <div className="muted" style={{ marginTop: 10, lineHeight: 1.5 }}>
              This is the public market asset screen. It is separate from your owned asset screen on purpose.
            </div>

            <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
              <MiniPoint title="Public page" sub="Works even if you do not own the asset yet." />
              <MiniPoint title="Scalable" sub="Later this can hold real chart history, quote stats, and news." />
              <MiniPoint title="Correct architecture" sub="Keeps market discovery separate from your portfolio tracking." />
            </div>
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href="/investments/discover" className="btn">
                Back to Discover
              </Link>
              <Link href="/investments" className="btnGhost">
                Portfolio
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

function StatCard({ title, value, sub }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em" }}>
        {title}
      </div>
      <div style={{ marginTop: 10, fontWeight: 950, fontSize: 22 }}>
        {value}
      </div>
      <div className="muted" style={{ marginTop: 10, fontSize: 13, lineHeight: 1.45 }}>
        {sub}
      </div>
    </div>
  )
}

function FakeChart() {
  return (
    <div
      style={{
        position: "relative",
        height: 360,
        borderRadius: 24,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,.08)",
        background:
          "linear-gradient(180deg, rgba(34,197,94,.14) 0%, rgba(34,197,94,.04) 40%, rgba(255,255,255,.02) 100%)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)",
          backgroundSize: "100% 72px, 72px 100%",
          pointerEvents: "none",
        }}
      />

      <svg viewBox="0 0 1000 360" preserveAspectRatio="none" style={{ width: "100%", height: "100%", display: "block" }}>
        <defs>
          <linearGradient id="chartFillMarket" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(34,197,94,.50)" />
            <stop offset="100%" stopColor="rgba(34,197,94,0)" />
          </linearGradient>
        </defs>

        <path
          d="M0,255 C70,245 120,218 180,208 C250,196 300,224 360,186 C420,148 470,126 530,142 C600,160 655,190 720,155 C785,120 850,86 915,78 C945,74 975,60 1000,42 L1000,360 L0,360 Z"
          fill="url(#chartFillMarket)"
        />
        <path
          d="M0,255 C70,245 120,218 180,208 C250,196 300,224 360,186 C420,148 470,126 530,142 C600,160 655,190 720,155 C785,120 850,86 915,78 C945,74 975,60 1000,42"
          fill="none"
          stroke="rgba(74,222,128,.95)"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

function MiniPoint({ title, sub }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,.08)",
        background: "rgba(255,255,255,.03)",
        borderRadius: 16,
        padding: 14,
      }}
    >
      <div style={{ fontWeight: 850 }}>{title}</div>
      <div className="muted" style={{ marginTop: 6, fontSize: 13, lineHeight: 1.45 }}>
        {sub}
      </div>
    </div>
  )
}
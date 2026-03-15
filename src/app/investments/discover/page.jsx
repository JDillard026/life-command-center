"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

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

function money(n) {
  const num = Number(n)
  if (!Number.isFinite(num)) return "—"
  return num.toLocaleString(undefined, { style: "currency", currency: "USD" })
}

export default function DiscoverInvestmentsPage() {
  const [query, setQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState("ALL")
  const [savedSymbols, setSavedSymbols] = useState([])
  const [status, setStatus] = useState("")
  const [error, setError] = useState("")
  const [addingSymbol, setAddingSymbol] = useState("")

  useEffect(() => {
    async function loadOwnedAssets() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { data, error } = await supabase
        .from("investment_assets")
        .select("symbol")
        .eq("user_id", user.id)

      if (error) {
        console.error(error)
        return
      }

      setSavedSymbols((data || []).map((x) => String(x.symbol || "").toUpperCase()))
    }

    loadOwnedAssets()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()

    let list = STARTER_MARKET

    if (typeFilter !== "ALL") {
      list = list.filter((item) => item.type === typeFilter)
    }

    if (q) {
      list = list.filter((item) => {
        return (
          item.symbol.toLowerCase().includes(q) ||
          item.name.toLowerCase().includes(q) ||
          item.exchange.toLowerCase().includes(q) ||
          item.sector.toLowerCase().includes(q)
        )
      })
    }

    return list.slice(0, 30)
  }, [query, typeFilter])

  async function addAsset(item) {
    setStatus("")
    setError("")
    setAddingSymbol(item.symbol)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError("You must be logged in.")
        setAddingSymbol("")
        return
      }

      const symbol = String(item.symbol || "").toUpperCase().trim()

      if (!symbol) {
        setError("Invalid symbol.")
        setAddingSymbol("")
        return
      }

      if (savedSymbols.includes(symbol)) {
        setError(`${symbol} is already in your portfolio.`)
        setAddingSymbol("")
        return
      }

      const { data, error } = await supabase
        .from("investment_assets")
        .insert({
          user_id: user.id,
          symbol,
          asset_type: item.type === "ETF" ? "etf" : "stock",
          account: "Main",
        })
        .select()
        .single()

      if (error) {
        console.error(error)
        setError(`Could not add ${symbol}.`)
        setAddingSymbol("")
        return
      }

      setSavedSymbols((prev) => [...prev, symbol])
      setStatus(`${data.symbol} added to portfolio.`)
    } catch (err) {
      console.error(err)
      setError("Something went wrong adding the asset.")
    }

    setAddingSymbol("")
  }

  return (
    <main
      style={{
        padding: "36px 28px 44px",
        maxWidth: "1280px",
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 16,
          alignItems: "end",
          marginBottom: 24,
        }}
      >
        <div>
          <div
            className="muted"
            style={{
              fontSize: 12,
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: "0.16em",
              marginBottom: 10,
            }}
          >
            Investments
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "clamp(2rem, 4vw, 3rem)",
              lineHeight: 1.04,
              fontWeight: 950,
            }}
          >
            Discover Market Assets
          </h1>

          <div className="muted" style={{ marginTop: 10, fontSize: 15, maxWidth: 820 }}>
            Search public stocks and ETFs, preview symbols, and add them to your portfolio.
            This first version uses a starter market list now and can be swapped to live market search later.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/investments" className="btnGhost">
            Portfolio
          </Link>
        </div>
      </div>

      {(status || error) && (
        <div className="card" style={{ padding: 14, marginBottom: 18 }}>
          <div style={{ fontWeight: 900 }}>{error ? "Fix this" : "Status"}</div>
          <div className="muted" style={{ marginTop: 6 }}>{error || status}</div>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.45fr .85fr",
          gap: 18,
          marginBottom: 18,
        }}
      >
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontWeight: 950, fontSize: 20 }}>Search Market</div>
          <div className="muted" style={{ marginTop: 6, fontSize: 14 }}>
            Search by ticker, company, exchange, or sector.
          </div>

          <div style={{ height: 16 }} />

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              className="input"
              placeholder="Search AAPL, Apple, VOO, Nvidia..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ minWidth: 320, flex: 1 }}
            />

            <select
              className="input"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{ minWidth: 160 }}
            >
              <option value="ALL">All Types</option>
              <option value="Stock">Stocks</option>
              <option value="ETF">ETFs</option>
            </select>
          </div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontWeight: 950, fontSize: 20 }}>Module Status</div>
          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            <MiniPoint
              title="Search UI ready"
              sub="You can search through the starter market list now."
            />
            <MiniPoint
              title="Portfolio add ready"
              sub="Add Asset writes directly into investment_assets."
            />
            <MiniPoint
              title="Live data later"
              sub="Replace starter list with real provider search when ready."
            />
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1.3fr .8fr .9fr .9fr 230px",
            gap: 12,
            padding: "16px 18px",
            borderBottom: "1px solid rgba(255,255,255,.08)",
            fontWeight: 900,
            color: "rgba(255,255,255,.75)",
          }}
        >
          <div>Symbol</div>
          <div>Name</div>
          <div>Type</div>
          <div>Exchange</div>
          <div>Sector</div>
          <div>Action</div>
        </div>

        {filtered.length ? (
          filtered.map((item) => {
            const alreadyOwned = savedSymbols.includes(item.symbol)

            return (
              <div
                key={item.symbol}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1.3fr .8fr .9fr .9fr 230px",
                  gap: 12,
                  padding: "16px 18px",
                  borderBottom: "1px solid rgba(255,255,255,.08)",
                  alignItems: "center",
                }}
              >
                <div style={{ fontWeight: 900 }}>{item.symbol}</div>
                <div>
                  <div style={{ fontWeight: 800 }}>{item.name}</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    Public market asset
                  </div>
                </div>
                <div>{item.type}</div>
                <div>{item.exchange}</div>
                <div>{item.sector}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link href={`/market/${encodeURIComponent(item.symbol)}`} className="btnGhost">
                    View Market
                  </Link>

                  <button
                    className={alreadyOwned ? "btnGhost" : "btn"}
                    onClick={() => addAsset(item)}
                    disabled={alreadyOwned || addingSymbol === item.symbol}
                    style={{
                      opacity: alreadyOwned || addingSymbol === item.symbol ? 0.75 : 1,
                      cursor: alreadyOwned || addingSymbol === item.symbol ? "not-allowed" : "pointer",
                    }}
                  >
                    {alreadyOwned
                      ? "Already Added"
                      : addingSymbol === item.symbol
                        ? "Adding..."
                        : "Add Asset"}
                  </button>
                </div>
              </div>
            )
          })
        ) : (
          <div style={{ padding: 18 }}>
            <EmptyState
              title="No matches found"
              sub="Try a ticker, company name, ETF, exchange, or sector."
            />
          </div>
        )}
      </div>

      <div style={{ height: 18 }} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 16,
        }}
      >
        <MetricCard
          title="Loaded Market Set"
          value={String(STARTER_MARKET.length)}
          sub="Starter symbols currently available in this local discovery version."
        />
        <MetricCard
          title="Showing Results"
          value={String(filtered.length)}
          sub="Filtered results based on your current search and type selection."
        />
        <MetricCard
          title="Owned Matches"
          value={String(filtered.filter((x) => savedSymbols.includes(x.symbol)).length)}
          sub="Assets in the current results that already exist in your portfolio."
        />
      </div>
    </main>
  )
}

function MetricCard({ title, value, sub }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div
        className="muted"
        style={{
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
        }}
      >
        {title}
      </div>
      <div style={{ marginTop: 10, fontSize: 22, fontWeight: 950 }}>
        {value}
      </div>
      <div className="muted" style={{ marginTop: 10, fontSize: 13, lineHeight: 1.45 }}>
        {sub}
      </div>
    </div>
  )
}

function EmptyState({ title, sub }) {
  return (
    <div
      style={{
        borderRadius: 16,
        border: "1px dashed rgba(255,255,255,.16)",
        padding: "24px 18px",
        background: "rgba(255,255,255,.02)",
        textAlign: "center",
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 16 }}>{title}</div>
      <div className="muted" style={{ marginTop: 8, fontSize: 14, lineHeight: 1.45 }}>
        {sub}
      </div>
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
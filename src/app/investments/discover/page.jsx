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

    return list.slice(0, 24)
  }, [query, typeFilter])

  const stats = useMemo(() => {
    const stocks = STARTER_MARKET.filter((x) => x.type === "Stock").length
    const etfs = STARTER_MARKET.filter((x) => x.type === "ETF").length
    const ownedMatches = filtered.filter((x) => savedSymbols.includes(x.symbol)).length

    return {
      total: STARTER_MARKET.length,
      stocks,
      etfs,
      showing: filtered.length,
      ownedMatches,
    }
  }, [filtered, savedSymbols])

  const quickPicks = useMemo(() => {
    const picks = ["AAPL", "NVDA", "TSLA", "VOO", "QQQ", "AVGO", "SPY", "SCHD"]
    return STARTER_MARKET.filter((x) => picks.includes(x.symbol))
  }, [])

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

  function setQuickQuery(next) {
    setQuery(next)
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
              fontSize: "clamp(2.2rem, 4vw, 3.4rem)",
              lineHeight: 1.02,
              fontWeight: 950,
            }}
          >
            Discover Market Assets
          </h1>

          <div className="muted" style={{ marginTop: 10, fontSize: 15, maxWidth: 860 }}>
            Search public stocks and ETFs, scan stronger names fast, and add them straight into your portfolio.
            This version uses a premium starter market list now and is ready to be upgraded into live symbol search later.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
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
          alignItems: "stretch",
        }}
      >
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 950, fontSize: 22 }}>Search Market</div>
          <div className="muted" style={{ marginTop: 6, fontSize: 14 }}>
            Search by ticker, company, exchange, or sector.
          </div>

          <div style={{ height: 16 }} />

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              className="input"
              placeholder="Search AAPL, Apple, VOO, Nvidia, ETF, NASDAQ..."
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

          <div style={{ height: 14 }} />

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <QuickChip label="AAPL" onClick={() => setQuickQuery("AAPL")} />
            <QuickChip label="NVDA" onClick={() => setQuickQuery("NVDA")} />
            <QuickChip label="VOO" onClick={() => setQuickQuery("VOO")} />
            <QuickChip label="QQQ" onClick={() => setQuickQuery("QQQ")} />
            <QuickChip label="Technology" onClick={() => setQuickQuery("Technology")} />
            <QuickChip label="Dividend ETF" onClick={() => setQuickQuery("Dividend ETF")} />
            <QuickChip label="NYSE" onClick={() => setQuickQuery("NYSE")} />
            <QuickChip label="Reset" onClick={() => {
              setQuery("")
              setTypeFilter("ALL")
            }} />
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 950, fontSize: 22 }}>Scanner Snapshot</div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 12,
              marginTop: 16,
            }}
          >
            <MiniStat title="Loaded" value={String(stats.total)} />
            <MiniStat title="Showing" value={String(stats.showing)} />
            <MiniStat title="Stocks" value={String(stats.stocks)} />
            <MiniStat title="ETFs" value={String(stats.etfs)} />
          </div>

          <div style={{ height: 14 }} />

          <div style={{ display: "grid", gap: 10 }}>
            <MiniPoint
              title="Fast scanning"
              sub="Search flow is built for fast symbol hunting instead of a boring spreadsheet feel."
            />
            <MiniPoint
              title="Portfolio aware"
              sub="Already-owned symbols are recognized immediately."
            />
            <MiniPoint
              title="Live-ready architecture"
              sub="Swap starter data for real provider search later without redoing the whole UI."
            />
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 20, marginBottom: 18 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <div>
            <div style={{ fontWeight: 950, fontSize: 22 }}>Quick Picks</div>
            <div className="muted" style={{ marginTop: 6, fontSize: 14 }}>
              Fast access to popular names and ETFs traders usually care about first.
            </div>
          </div>

          <div className="muted" style={{ fontSize: 13 }}>
            Click a chip to search faster.
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          {quickPicks.map((item) => {
            const alreadyOwned = savedSymbols.includes(item.symbol)

            return (
              <button
                key={item.symbol}
                onClick={() => setQuickQuery(item.symbol)}
                style={{
                  textAlign: "left",
                  borderRadius: 18,
                  border: "1px solid rgba(255,255,255,.08)",
                  background: "linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.025))",
                  padding: "14px 16px",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <div style={{ fontWeight: 950, fontSize: 18 }}>{item.symbol}</div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 900,
                      padding: "4px 8px",
                      borderRadius: 999,
                      background: alreadyOwned ? "rgba(74,222,128,.14)" : "rgba(255,255,255,.06)",
                      color: alreadyOwned ? "#86efac" : "rgba(255,255,255,.82)",
                      border: "1px solid rgba(255,255,255,.08)",
                    }}
                  >
                    {alreadyOwned ? "Owned" : item.type}
                  </span>
                </div>

                <div style={{ marginTop: 8, fontWeight: 700 }}>
                  {item.name}
                </div>

                <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                  {item.exchange} • {item.sector}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <div>
            <div style={{ fontWeight: 950, fontSize: 22 }}>Market Results</div>
            <div className="muted" style={{ marginTop: 6, fontSize: 14 }}>
              Clean scan results with fast actions.
            </div>
          </div>

          <div className="muted" style={{ fontSize: 13 }}>
            Owned matches in current results: {stats.ownedMatches}
          </div>
        </div>

        {filtered.length ? (
          <div style={{ display: "grid", gap: 12 }}>
            {filtered.map((item) => {
              const alreadyOwned = savedSymbols.includes(item.symbol)
              const isAdding = addingSymbol === item.symbol

              return (
                <div
                  key={item.symbol}
                  style={{
                    border: "1px solid rgba(255,255,255,.08)",
                    background: "linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02))",
                    borderRadius: 22,
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.2fr 1fr auto",
                      gap: 16,
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                        <div style={{ fontWeight: 950, fontSize: 22 }}>{item.symbol}</div>

                        <span style={pillStyle()}>
                          {item.type}
                        </span>

                        <span style={pillStyle()}>
                          {item.exchange}
                        </span>

                        <span style={pillStyle(alreadyOwned ? "#86efac" : undefined, alreadyOwned ? "rgba(74,222,128,.14)" : undefined)}>
                          {alreadyOwned ? "Already in Portfolio" : item.sector}
                        </span>
                      </div>

                      <div style={{ marginTop: 10, fontWeight: 800, fontSize: 16 }}>
                        {item.name}
                      </div>

                      <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>
                        Public market asset • ready for market page view and one-click portfolio add
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                        gap: 10,
                      }}
                    >
                      <MiniBox label="Type" value={item.type} />
                      <MiniBox label="Sector" value={item.sector} />
                    </div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <Link href={`/market/${encodeURIComponent(item.symbol)}`} className="btnGhost">
                        View Market
                      </Link>

                      <button
                        className={alreadyOwned ? "btnGhost" : "btn"}
                        onClick={() => addAsset(item)}
                        disabled={alreadyOwned || isAdding}
                        style={{
                          minWidth: 140,
                          opacity: alreadyOwned || isAdding ? 0.78 : 1,
                          cursor: alreadyOwned || isAdding ? "not-allowed" : "pointer",
                        }}
                      >
                        {alreadyOwned ? "Added" : isAdding ? "Adding..." : "Add Asset"}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <EmptyState
            title="No matches found"
            sub="Try a ticker, company name, ETF, exchange, or sector."
          />
        )}
      </div>

      <div style={{ height: 18 }} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 16,
        }}
      >
        <MetricCard
          title="Loaded Universe"
          value={String(stats.total)}
          sub="Starter symbols currently loaded into this local scanner."
        />
        <MetricCard
          title="Results Showing"
          value={String(stats.showing)}
          sub="Filtered from your current query and type filter."
        />
        <MetricCard
          title="Owned Matches"
          value={String(stats.ownedMatches)}
          sub="Symbols in your filtered results already in portfolio."
        />
        <MetricCard
          title="Scanner Mode"
          value="Ready"
          sub="Built to switch into real live market symbol search later."
        />
      </div>
    </main>
  )
}

function pillStyle(color = "rgba(255,255,255,.82)", background = "rgba(255,255,255,.06)") {
  return {
    fontSize: 11,
    fontWeight: 900,
    padding: "5px 9px",
    borderRadius: 999,
    background,
    color,
    border: "1px solid rgba(255,255,255,.08)",
    whiteSpace: "nowrap",
  }
}

function QuickChip({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,.08)",
        background: "rgba(255,255,255,.04)",
        padding: "8px 12px",
        fontWeight: 800,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
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

function MiniStat({ title, value }) {
  return (
    <div
      style={{
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,.08)",
        background: "rgba(255,255,255,.03)",
        padding: 14,
      }}
    >
      <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em" }}>
        {title}
      </div>
      <div style={{ marginTop: 8, fontWeight: 950, fontSize: 22 }}>
        {value}
      </div>
    </div>
  )
}

function MiniBox({ label, value }) {
  return (
    <div
      style={{
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,.08)",
        background: "rgba(255,255,255,.025)",
        padding: 12,
      }}
    >
      <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em" }}>
        {label}
      </div>
      <div style={{ marginTop: 7, fontWeight: 800 }}>
        {value}
      </div>
    </div>
  )
}

function EmptyState({ title, sub }) {
  return (
    <div
      style={{
        borderRadius: 18,
        border: "1px dashed rgba(255,255,255,.16)",
        padding: "28px 20px",
        background: "rgba(255,255,255,.02)",
        textAlign: "center",
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 18 }}>{title}</div>
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
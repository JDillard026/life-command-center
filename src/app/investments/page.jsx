"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

function money(n) {
  const num = Number(n)
  if (!Number.isFinite(num)) return "—"
  return num.toLocaleString(undefined, { style: "currency", currency: "USD" })
}

function fmtNumber(n) {
  const num = Number(n)
  if (!Number.isFinite(num)) return "—"
  return num.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

export default function InvestmentsPage() {
  const [assets, setAssets] = useState([])
  const [txns, setTxns] = useState([])
  const [prices, setPrices] = useState({})
  const [tab, setTab] = useState("overview")
  const [loadingPrices, setLoadingPrices] = useState(false)
  const [status, setStatus] = useState("")
  const [error, setError] = useState("")

  const [symbol, setSymbol] = useState("")
  const [txnAsset, setTxnAsset] = useState("")
  const [txnQty, setTxnQty] = useState("")
  const [txnPrice, setTxnPrice] = useState("")

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { data: assetRows, error: assetError } = await supabase
        .from("investment_assets")
        .select("*")
        .eq("user_id", user.id)

      const { data: txnRows, error: txnError } = await supabase
        .from("investment_transactions")
        .select("*")
        .eq("user_id", user.id)

      if (assetError || txnError) {
        setError("Failed loading investments data.")
        return
      }

      setAssets(assetRows || [])
      setTxns(txnRows || [])
    }

    load()
  }, [])

  useEffect(() => {
    async function loadPrices() {
      if (!assets.length) {
        setPrices({})
        return
      }

      setLoadingPrices(true)

      const nextPrices = {}

      for (const a of assets) {
        if (!a.symbol || a.asset_type === "cash") continue

        try {
          const res = await fetch(`/api/prices?symbol=${a.symbol}`)
          const data = await res.json()

          if (Number.isFinite(Number(data?.price)) && Number(data.price) > 0) {
            nextPrices[a.symbol] = Number(data.price)
          }
        } catch (err) {
          console.error("price fetch failed for", a.symbol, err)
        }
      }

      setPrices(nextPrices)
      setLoadingPrices(false)
    }

    loadPrices()
  }, [assets])

  async function addAsset() {
    setError("")
    setStatus("")

    if (!symbol.trim()) {
      setError("Enter a symbol first.")
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from("investment_assets")
      .insert({
        user_id: user.id,
        asset_type: "stock",
        symbol: symbol.toUpperCase().trim(),
        account: "Main",
      })
      .select()
      .single()

    if (error) {
      console.error(error)
      setError("Could not add asset.")
      return
    }

    setAssets((prev) => [data, ...prev])
    setSymbol("")
    setStatus("Asset added.")
  }

  async function addTrade() {
    setError("")
    setStatus("")

    if (!txnAsset || !txnQty || !txnPrice) {
      setError("Pick an asset and enter quantity + price.")
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from("investment_transactions")
      .insert({
        user_id: user.id,
        asset_id: txnAsset,
        txn_type: "BUY",
        txn_date: new Date().toISOString().slice(0, 10),
        qty: Number(txnQty),
        price: Number(txnPrice),
      })
      .select()
      .single()

    if (error) {
      console.error(error)
      setError("Could not add trade.")
      return
    }

    setTxns((prev) => [data, ...prev])
    setTxnQty("")
    setTxnPrice("")
    setStatus("Trade added.")
  }

  const portfolio = useMemo(() => {
    let totalValue = 0
    let totalCost = 0

    const holdings = []

    for (const a of assets) {
      const list = txns.filter((t) => t.asset_id === a.id)

      let shares = 0
      let cost = 0

      for (const t of list) {
        if (t.txn_type === "BUY") {
          shares += Number(t.qty)
          cost += Number(t.qty) * Number(t.price)
        }

        if (t.txn_type === "SELL") {
          shares -= Number(t.qty)
        }
      }

      const livePrice = Number(prices[a.symbol])
      const hasLivePrice = Number.isFinite(livePrice) && livePrice > 0
      const value = hasLivePrice ? shares * livePrice : null
      const pnl = hasLivePrice ? value - cost : null

      if (hasLivePrice) totalValue += value
      totalCost += cost

      holdings.push({
        ...a,
        shares,
        cost,
        value,
        pnl,
        livePrice,
        hasLivePrice,
      })
    }

    const totalPnl = totalValue - totalCost
    const hasAnyLivePrices = holdings.some((h) => h.hasLivePrice)

    return { holdings, totalValue, totalCost, totalPnl, hasAnyLivePrices }
  }, [assets, txns, prices])

  return (
    <main
      style={{
        padding: "36px 28px 44px",
        maxWidth: "1180px",
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
            Portfolio Command
          </h1>

          <div className="muted" style={{ marginTop: 10, fontSize: 15, maxWidth: 760 }}>
            Clean portfolio tracking with Supabase-backed assets and trades. Live pricing can be layered back in later.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <TabBtn active={tab === "overview"} onClick={() => setTab("overview")}>Overview</TabBtn>
          <TabBtn active={tab === "holdings"} onClick={() => setTab("holdings")}>Holdings</TabBtn>
          <TabBtn active={tab === "transactions"} onClick={() => setTab("transactions")}>Transactions</TabBtn>
        </div>
      </div>

      {(status || error) && (
        <div className="card" style={{ padding: 14, marginBottom: 18 }}>
          <div style={{ fontWeight: 900 }}>{error ? "Fix this" : "Status"}</div>
          <div className="muted" style={{ marginTop: 6 }}>{error || status}</div>
        </div>
      )}

      {tab === "overview" && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 16,
              marginBottom: 18,
            }}
          >
            <MetricCard
              title="Tracked Value"
              value={portfolio.hasAnyLivePrices ? money(portfolio.totalValue) : "Price unavailable"}
              sub={loadingPrices ? "Checking prices..." : "Will update once usable price data is available."}
            />

            <MetricCard
              title="Total Cost Basis"
              value={money(portfolio.totalCost)}
              sub="Based on your recorded buy trades."
            />

            <MetricCard
              title="Portfolio P/L"
              value={portfolio.hasAnyLivePrices ? money(portfolio.totalPnl) : "Pending live data"}
              sub={portfolio.hasAnyLivePrices ? (portfolio.totalPnl >= 0 ? "Portfolio above cost basis." : "Portfolio below cost basis.") : "P/L will calculate when pricing is active."}
              valueTone={portfolio.hasAnyLivePrices ? (portfolio.totalPnl >= 0 ? "good" : "bad") : "default"}
            />
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontWeight: 950, fontSize: 20 }}>Portfolio Snapshot</div>
            <div className="muted" style={{ marginTop: 6, fontSize: 14 }}>
              This section is intentionally clean right now. Next pass can add charts, allocation, and daily movement.
            </div>

            <div style={{ height: 16 }} />

            {!portfolio.holdings.length ? (
              <EmptyState
                title="No investments yet"
                sub="Add your first asset, then log a trade to start building your portfolio."
              />
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {portfolio.holdings.slice(0, 5).map((h) => (
                  <div key={h.id} className="card" style={{ padding: 14 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr", gap: 12 }}>
                      <div>
                        <div style={{ fontWeight: 900 }}>{h.symbol}</div>
                        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                          {h.account || "Main"} • {h.asset_type || "stock"}
                        </div>
                      </div>
                      <div>
                        <div className="muted" style={{ fontSize: 12 }}>Shares</div>
                        <div style={{ fontWeight: 850, marginTop: 4 }}>{fmtNumber(h.shares)}</div>
                      </div>
                      <div>
                        <div className="muted" style={{ fontSize: 12 }}>Cost</div>
                        <div style={{ fontWeight: 850, marginTop: 4 }}>{money(h.cost)}</div>
                      </div>
                      <div>
                        <div className="muted" style={{ fontSize: 12 }}>Live Value</div>
                        <div style={{ fontWeight: 850, marginTop: 4 }}>
                          {h.hasLivePrice ? money(h.value) : "Pending"}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {tab === "holdings" && (
        <>
          <div className="card" style={{ padding: 18, marginBottom: 18 }}>
            <div style={{ fontWeight: 950, fontSize: 20, marginBottom: 14 }}>Add Asset</div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input
                className="input"
                placeholder="Symbol (VOO, QQQ)"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                style={{ minWidth: 240 }}
              />
              <button className="btn" onClick={addAsset}>Add Asset</button>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <TableHeader cols={["Symbol", "Shares", "Cost Basis", "Live Price", "Value", "P/L"]} />

            {portfolio.holdings.length ? (
              portfolio.holdings.map((h) => (
                <div
                  key={h.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.3fr 1fr 1fr 1fr 1fr 1fr",
                    gap: 12,
                    padding: "16px 18px",
                    borderBottom: "1px solid rgba(255,255,255,.08)",
                    alignItems: "center",
                  }}
                >
                  <div style={{ fontWeight: 900 }}>{h.symbol}</div>
                  <div>{fmtNumber(h.shares)}</div>
                  <div>{money(h.cost)}</div>
                  <div>{h.hasLivePrice ? money(h.livePrice) : "Unavailable"}</div>
                  <div>{h.hasLivePrice ? money(h.value) : "Pending"}</div>
                  <div style={{ color: h.hasLivePrice ? (h.pnl >= 0 ? "#4ade80" : "#f87171") : "inherit", fontWeight: 850 }}>
                    {h.hasLivePrice ? money(h.pnl) : "Pending"}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: 18 }}>
                <EmptyState
                  title="No holdings yet"
                  sub="Add an asset above to start your portfolio."
                />
              </div>
            )}
          </div>
        </>
      )}

      {tab === "transactions" && (
        <>
          <div className="card" style={{ padding: 18, marginBottom: 18 }}>
            <div style={{ fontWeight: 950, fontSize: 20, marginBottom: 14 }}>Add Trade</div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <select
                className="input"
                value={txnAsset}
                onChange={(e) => setTxnAsset(e.target.value)}
                style={{ minWidth: 220 }}
              >
                <option value="">Select Asset</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.symbol}
                  </option>
                ))}
              </select>

              <input
                className="input"
                placeholder="Qty"
                value={txnQty}
                onChange={(e) => setTxnQty(e.target.value)}
                style={{ minWidth: 120 }}
              />

              <input
                className="input"
                placeholder="Price"
                value={txnPrice}
                onChange={(e) => setTxnPrice(e.target.value)}
                style={{ minWidth: 120 }}
              />

              <button className="btn" onClick={addTrade}>Add Trade</button>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <TableHeader cols={["Type", "Asset", "Qty", "Price", "Date"]} />

            {txns.length ? (
              txns.map((t) => {
                const asset = assets.find((a) => a.id === t.asset_id)
                return (
                  <div
                    key={t.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr",
                      gap: 12,
                      padding: "16px 18px",
                      borderBottom: "1px solid rgba(255,255,255,.08)",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ fontWeight: 850 }}>{t.txn_type}</div>
                    <div>{asset?.symbol || "—"}</div>
                    <div>{fmtNumber(t.qty)}</div>
                    <div>{money(t.price)}</div>
                    <div>{t.txn_date}</div>
                  </div>
                )
              })
            ) : (
              <div style={{ padding: 18 }}>
                <EmptyState
                  title="No trades yet"
                  sub="Add your first transaction to build cost basis and position size."
                />
              </div>
            )}
          </div>
        </>
      )}
    </main>
  )
}

function TabBtn({ active, children, onClick }) {
  return (
    <button
      className={active ? "btn" : "btnGhost"}
      onClick={onClick}
      style={{ minWidth: 110 }}
    >
      {children}
    </button>
  )
}

function MetricCard({ title, value, sub, valueTone = "default" }) {
  const toneColor =
    valueTone === "good" ? "#4ade80" :
    valueTone === "bad" ? "#f87171" :
    "inherit"

  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em" }}>
        {title}
      </div>
      <div style={{ marginTop: 10, fontSize: 20, fontWeight: 950, color: toneColor }}>
        {value}
      </div>
      <div className="muted" style={{ marginTop: 10, fontSize: 13, lineHeight: 1.45 }}>
        {sub}
      </div>
    </div>
  )
}

function TableHeader({ cols }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))`,
        gap: 12,
        padding: "16px 18px",
        borderBottom: "1px solid rgba(255,255,255,.08)",
        fontWeight: 900,
        color: "rgba(255,255,255,.75)",
      }}
    >
      {cols.map((c) => (
        <div key={c}>{c}</div>
      ))}
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
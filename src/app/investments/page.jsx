"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

export default function InvestmentsPage() {
  const [assets, setAssets] = useState([])
  const [txns, setTxns] = useState([])
  const [prices, setPrices] = useState({})
  const [tab, setTab] = useState("overview")
  const [loadingPrices, setLoadingPrices] = useState(false)

  const [symbol, setSymbol] = useState("")
  const [txnAsset, setTxnAsset] = useState("")
  const [txnQty, setTxnQty] = useState("")
  const [txnPrice, setTxnPrice] = useState("")

  /* ---------------- LOAD DATA ---------------- */

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data: assetRows } = await supabase
        .from("investment_assets")
        .select("*")
        .eq("user_id", user.id)

      const { data: txnRows } = await supabase
        .from("investment_transactions")
        .select("*")
        .eq("user_id", user.id)

      setAssets(assetRows || [])
      setTxns(txnRows || [])
    }

    load()
  }, [])

  /* ---------------- LOAD LIVE PRICES ---------------- */

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

  /* ---------------- ADD ASSET ---------------- */

  async function addAsset() {
    if (!symbol.trim()) return

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
      return
    }

    setAssets((prev) => [data, ...prev])
    setSymbol("")
  }

  /* ---------------- ADD TRADE ---------------- */

  async function addTrade() {
    if (!txnAsset || !txnQty || !txnPrice) return

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
      return
    }

    setTxns((prev) => [data, ...prev])
    setTxnQty("")
    setTxnPrice("")
  }

  /* ---------------- PORTFOLIO CALC ---------------- */

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

      const livePrice = Number(prices[a.symbol]) || 0
      const value = shares * livePrice

      totalValue += value
      totalCost += cost

      holdings.push({
        ...a,
        shares,
        cost,
        value,
        livePrice,
      })
    }

    const pnl = totalValue - totalCost

    return { holdings, totalValue, totalCost, pnl }
  }, [assets, txns, prices])

  return (
    <main
      style={{
        padding: "40px",
        maxWidth: "1100px",
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "30px",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: "600", margin: 0 }}>Investments</h1>
          <div style={{ opacity: 0.75, marginTop: 6 }}>
            Live portfolio tracking with Supabase-backed assets and trades.
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button onClick={() => setTab("overview")}>Overview</button>
          <button onClick={() => setTab("holdings")}>Holdings</button>
          <button onClick={() => setTab("transactions")}>Transactions</button>
        </div>
      </div>

      {tab === "overview" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: "20px",
          }}
        >
          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ marginTop: 0 }}>Total Value</h3>
            <div style={{ fontSize: 28, fontWeight: 700 }}>${portfolio.totalValue.toFixed(2)}</div>
            <div style={{ opacity: 0.75, marginTop: 8 }}>
              {loadingPrices ? "Refreshing prices..." : "Using live market prices"}
            </div>
          </div>

          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ marginTop: 0 }}>Total Cost</h3>
            <div style={{ fontSize: 28, fontWeight: 700 }}>${portfolio.totalCost.toFixed(2)}</div>
            <div style={{ opacity: 0.75, marginTop: 8 }}>Based on recorded buy trades</div>
          </div>

          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ marginTop: 0 }}>P/L</h3>
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: portfolio.pnl >= 0 ? "#22c55e" : "#ef4444",
              }}
            >
              ${portfolio.pnl.toFixed(2)}
            </div>
            <div style={{ opacity: 0.75, marginTop: 8 }}>
              {portfolio.pnl >= 0 ? "Portfolio in profit" : "Portfolio below cost basis"}
            </div>
          </div>
        </div>
      )}

      {tab === "holdings" && (
        <div>
          <div
            className="card"
            style={{
              padding: 18,
              marginBottom: 24,
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <input
              placeholder="Symbol (VOO, QQQ)"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              style={{ minWidth: 220 }}
            />

            <button onClick={addAsset}>Add Asset</button>
          </div>

          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr 1fr",
                padding: "14px 18px",
                borderBottom: "1px solid #2a2a2a",
                fontWeight: 700,
                opacity: 0.8,
              }}
            >
              <div>Symbol</div>
              <div>Shares</div>
              <div>Live Price</div>
              <div>Value</div>
            </div>

            {portfolio.holdings.map((h) => (
              <div
                key={h.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr 1fr",
                  padding: "14px 18px",
                  borderBottom: "1px solid #2a2a2a",
                }}
              >
                <div>{h.symbol}</div>
                <div>{h.shares}</div>
                <div>${h.livePrice.toFixed(2)}</div>
                <div>${h.value.toFixed(2)}</div>
              </div>
            ))}

            {!portfolio.holdings.length && (
              <div style={{ padding: 18, opacity: 0.75 }}>No holdings yet.</div>
            )}
          </div>
        </div>
      )}

      {tab === "transactions" && (
        <div>
          <div
            className="card"
            style={{
              padding: 18,
              marginBottom: 24,
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <select value={txnAsset} onChange={(e) => setTxnAsset(e.target.value)}>
              <option value="">Select Asset</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.symbol}
                </option>
              ))}
            </select>

            <input
              placeholder="Qty"
              value={txnQty}
              onChange={(e) => setTxnQty(e.target.value)}
            />

            <input
              placeholder="Price"
              value={txnPrice}
              onChange={(e) => setTxnPrice(e.target.value)}
            />

            <button onClick={addTrade}>Add Trade</button>
          </div>

          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr 1fr",
                padding: "14px 18px",
                borderBottom: "1px solid #2a2a2a",
                fontWeight: 700,
                opacity: 0.8,
              }}
            >
              <div>Type</div>
              <div>Qty</div>
              <div>Price</div>
              <div>Date</div>
            </div>

            {txns.map((t) => (
              <div
                key={t.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr 1fr",
                  padding: "14px 18px",
                  borderBottom: "1px solid #2a2a2a",
                }}
              >
                <div>{t.txn_type}</div>
                <div>{t.qty}</div>
                <div>${Number(t.price).toFixed(2)}</div>
                <div>{t.txn_date}</div>
              </div>
            ))}

            {!txns.length && <div style={{ padding: 18, opacity: 0.75 }}>No transactions yet.</div>}
          </div>
        </div>
      )}
    </main>
  )
}
"use client"

import Link from "next/link"
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

export default function InvestmentAssetDetailPage({ params }) {
  const assetId = params?.id

  const [asset, setAsset] = useState(null)
  const [txns, setTxns] = useState([])
  const [price, setPrice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError("")

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError("You must be logged in.")
        setLoading(false)
        return
      }

      const { data: assetRow, error: assetError } = await supabase
        .from("investment_assets")
        .select("*")
        .eq("id", assetId)
        .eq("user_id", user.id)
        .single()

      if (assetError || !assetRow) {
        console.error(assetError)
        setError("Asset not found.")
        setLoading(false)
        return
      }

      const { data: txnRows, error: txnError } = await supabase
        .from("investment_transactions")
        .select("*")
        .eq("asset_id", assetId)
        .eq("user_id", user.id)
        .order("txn_date", { ascending: false })

      if (txnError) {
        console.error(txnError)
        setError("Failed loading asset transactions.")
        setLoading(false)
        return
      }

      setAsset(assetRow)
      setTxns(txnRows || [])

      if (assetRow.symbol) {
        try {
          const res = await fetch(`/api/prices?symbol=${encodeURIComponent(assetRow.symbol)}`)
          const data = await res.json()

          if (Number.isFinite(Number(data?.price)) && Number(data.price) > 0) {
            setPrice(Number(data.price))
          }
        } catch (err) {
          console.error("price fetch failed", err)
        }
      }

      setLoading(false)
    }

    load()
  }, [assetId])

  const position = useMemo(() => {
    let shares = 0
    let cost = 0

    for (const t of txns) {
      const qty = Number(t.qty) || 0
      const px = Number(t.price) || 0

      if (t.txn_type === "BUY") {
        shares += qty
        cost += qty * px
      }

      if (t.txn_type === "SELL") {
        shares -= qty
      }
    }

    const avgCost = shares > 0 ? cost / shares : 0
    const hasLivePrice = Number.isFinite(price) && price > 0
    const marketValue = hasLivePrice ? shares * price : null
    const pnl = hasLivePrice ? marketValue - cost : null
    const pnlPct = hasLivePrice && cost > 0 ? ((marketValue - cost) / cost) * 100 : null

    return {
      shares,
      cost,
      avgCost,
      hasLivePrice,
      marketValue,
      pnl,
      pnlPct,
    }
  }, [txns, price])

  if (loading) {
    return (
      <main style={{ padding: "36px 28px 44px", maxWidth: "1280px", margin: "0 auto" }}>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontWeight: 900 }}>Loading asset...</div>
        </div>
      </main>
    )
  }

  if (error || !asset) {
    return (
      <main style={{ padding: "36px 28px 44px", maxWidth: "1280px", margin: "0 auto" }}>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontWeight: 900 }}>{error || "Asset not found."}</div>
          <div style={{ marginTop: 14 }}>
            <Link href="/investments" className="btn">
              Back to Investments
            </Link>
          </div>
        </div>
      </main>
    )
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
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 22,
        }}
      >
        <div>
          <div
            className="muted"
            style={{
              fontSize: 12,
              fontWeight: 900,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}
          >
            Asset Detail
          </div>

          <h1
            style={{
              margin: "8px 0 0",
              fontSize: "clamp(2rem, 4vw, 3rem)",
              lineHeight: 1.03,
              fontWeight: 950,
            }}
          >
            {asset.symbol || "Asset"}
          </h1>

          <div className="muted" style={{ marginTop: 10, fontSize: 14 }}>
            {asset.account || "Main"} • {asset.asset_type || "stock"}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <Link href="/investments" className="btnGhost">
            Back
          </Link>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.55fr .95fr",
          gap: 18,
          alignItems: "start",
        }}
      >
        <div style={{ display: "grid", gap: 18 }}>
          <div className="card" style={{ padding: 18 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "start",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div
                  className="muted"
                  style={{
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                  }}
                >
                  Live Price
                </div>
                <div style={{ fontSize: 32, fontWeight: 950, marginTop: 8 }}>
                  {position.hasLivePrice ? money(price) : "Unavailable"}
                </div>
                <div
                  style={{
                    marginTop: 10,
                    fontWeight: 850,
                    color:
                      position.hasLivePrice && Number.isFinite(position.pnl)
                        ? position.pnl >= 0
                          ? "#4ade80"
                          : "#f87171"
                        : "rgba(255,255,255,.65)",
                  }}
                >
                  {position.hasLivePrice && Number.isFinite(position.pnlPct)
                    ? `${position.pnl >= 0 ? "+" : ""}${position.pnlPct.toFixed(2)}% vs cost basis`
                    : "Live comparison will show when pricing is available"}
                </div>
              </div>

              <div
                style={{
                  minWidth: 220,
                  border: "1px solid rgba(255,255,255,.08)",
                  background: "rgba(255,255,255,.03)",
                  borderRadius: 18,
                  padding: 14,
                }}
              >
                <div
                  className="muted"
                  style={{
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                  }}
                >
                  Position Value
                </div>
                <div style={{ fontWeight: 900, fontSize: 24, marginTop: 8 }}>
                  {position.hasLivePrice ? money(position.marketValue) : "Pending"}
                </div>
              </div>
            </div>

            <div style={{ height: 18 }} />

            <FakeChart />
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontWeight: 950, fontSize: 20 }}>Transaction History</div>
            <div className="muted" style={{ marginTop: 6, fontSize: 14 }}>
              All trades tied to this asset.
            </div>

            <div style={{ height: 16 }} />

            {txns.length ? (
              <div style={{ display: "grid", gap: 10 }}>
                {txns.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      border: "1px solid rgba(255,255,255,.08)",
                      background: "rgba(255,255,255,.02)",
                      borderRadius: 16,
                      padding: 14,
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr 1fr",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div className="muted" style={{ fontSize: 12 }}>Type</div>
                      <div style={{ marginTop: 4, fontWeight: 850 }}>{t.txn_type}</div>
                    </div>

                    <div>
                      <div className="muted" style={{ fontSize: 12 }}>Qty</div>
                      <div style={{ marginTop: 4, fontWeight: 850 }}>{fmtNumber(t.qty)}</div>
                    </div>

                    <div>
                      <div className="muted" style={{ fontSize: 12 }}>Price</div>
                      <div style={{ marginTop: 4, fontWeight: 850 }}>{money(t.price)}</div>
                    </div>

                    <div>
                      <div className="muted" style={{ fontSize: 12 }}>Date</div>
                      <div style={{ marginTop: 4, fontWeight: 850 }}>{t.txn_date}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No transactions yet"
                sub="This asset exists, but there are no trades recorded on it yet."
              />
            )}
          </div>
        </div>

        <div style={{ display: "grid", gap: 18 }}>
          <StatCard
            title="Shares Owned"
            value={fmtNumber(position.shares)}
            sub="Current net shares from your transactions."
          />
          <StatCard
            title="Cost Basis"
            value={money(position.cost)}
            sub="Total capital tracked in recorded buy trades."
          />
          <StatCard
            title="Average Cost"
            value={position.shares > 0 ? money(position.avgCost) : "—"}
            sub="Average cost per active share."
          />
          <StatCard
            title="Unrealized P/L"
            value={position.hasLivePrice ? money(position.pnl) : "Pending"}
            sub="Based on live price minus current cost basis."
            tone={position.hasLivePrice ? (position.pnl >= 0 ? "good" : "bad") : "default"}
          />

          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontWeight: 950, fontSize: 20 }}>What this page is ready for</div>
            <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
              <MiniPoint
                title="Real history chart"
                sub="Needs a history API endpoint, not just single-price quotes."
              />
              <MiniPoint
                title="Day change"
                sub="Easy to add once your provider returns open / previous close."
              />
              <MiniPoint
                title="Ticker news"
                sub="Best added after pricing and chart data are stable."
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

function StatCard({ title, value, sub, tone = "default" }) {
  const color =
    tone === "good" ? "#4ade80" :
    tone === "bad" ? "#f87171" :
    "inherit"

  return (
    <div className="card" style={{ padding: 18 }}>
      <div
        className="muted"
        style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em" }}
      >
        {title}
      </div>
      <div style={{ marginTop: 10, fontWeight: 950, fontSize: 24, color }}>
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
          <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(34,197,94,.50)" />
            <stop offset="100%" stopColor="rgba(34,197,94,0)" />
          </linearGradient>
        </defs>

        <path
          d="M0,260 C80,250 120,220 170,210 C230,198 270,230 330,205 C390,180 430,120 490,135 C555,150 590,190 650,175 C720,158 760,110 820,92 C890,70 940,82 1000,38 L1000,360 L0,360 Z"
          fill="url(#chartFill)"
        />
        <path
          d="M0,260 C80,250 120,220 170,210 C230,198 270,230 330,205 C390,180 430,120 490,135 C555,150 590,190 650,175 C720,158 760,110 820,92 C890,70 940,82 1000,38"
          fill="none"
          stroke="rgba(74,222,128,.95)"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </svg>

      <div
        style={{
          position: "absolute",
          left: 18,
          bottom: 14,
          right: 18,
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          color: "rgba(255,255,255,.60)",
          fontWeight: 700,
        }}
      >
        <span>1D</span>
        <span>1W</span>
        <span>1M</span>
        <span>3M</span>
        <span>1Y</span>
        <span>ALL</span>
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
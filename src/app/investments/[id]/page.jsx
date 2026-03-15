"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

function money(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

function fmtNumber(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function pct(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return `${num >= 0 ? "+" : ""}${num.toFixed(2)}%`;
}

function fmtDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return String(value);
  return d.toLocaleDateString();
}

function toneByValue(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return "neutral";
  return n > 0 ? "good" : "bad";
}

function glowPanelStyle(tone = "neutral", strong = false) {
  if (tone === "good") {
    return {
      border: "1px solid rgba(34,197,94,.18)",
      background:
        "linear-gradient(180deg, rgba(34,197,94,.12) 0%, rgba(255,255,255,.03) 100%)",
      boxShadow: strong
        ? "0 0 26px rgba(34,197,94,.12), inset 0 0 0 1px rgba(34,197,94,.06)"
        : "0 0 18px rgba(34,197,94,.08)",
    };
  }

  if (tone === "bad") {
    return {
      border: "1px solid rgba(239,68,68,.18)",
      background:
        "linear-gradient(180deg, rgba(239,68,68,.12) 0%, rgba(255,255,255,.03) 100%)",
      boxShadow: strong
        ? "0 0 26px rgba(239,68,68,.12), inset 0 0 0 1px rgba(239,68,68,.06)"
        : "0 0 18px rgba(239,68,68,.08)",
    };
  }

  return {
    border: "1px solid rgba(255,255,255,.08)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,.04) 0%, rgba(255,255,255,.025) 100%)",
    boxShadow: strong ? "0 0 18px rgba(96,165,250,.08)" : "none",
  };
}

export default function InvestmentAssetPage() {
  const params = useParams();
  const assetId = params?.id;

  const [asset, setAsset] = useState(null);
  const [txns, setTxns] = useState([]);
  const [livePrice, setLivePrice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("You must be logged in.");
        setLoading(false);
        return;
      }

      const { data: assetRow, error: assetError } = await supabase
        .from("investment_assets")
        .select("*")
        .eq("id", assetId)
        .eq("user_id", user.id)
        .single();

      if (assetError || !assetRow) {
        console.error(assetError);
        setError("Could not load asset.");
        setLoading(false);
        return;
      }

      const { data: txnRows, error: txnError } = await supabase
        .from("investment_transactions")
        .select("*")
        .eq("asset_id", assetId)
        .eq("user_id", user.id)
        .order("txn_date", { ascending: true });

      if (txnError) {
        console.error(txnError);
        setError("Could not load transactions.");
        setLoading(false);
        return;
      }

      setAsset(assetRow);
      setTxns(txnRows || []);
      setLoading(false);
    }

    if (assetId) load();
  }, [assetId]);

  useEffect(() => {
    async function loadPrice() {
      const symbol = String(asset?.symbol || "").toUpperCase().trim();

      if (!symbol) {
        setLivePrice(null);
        return;
      }

      setLoadingPrice(true);

      try {
        const res = await fetch(`/api/prices?symbol=${encodeURIComponent(symbol)}`);
        const data = await res.json();

        if (res.ok && Number.isFinite(Number(data?.price)) && Number(data.price) > 0) {
          setLivePrice(Number(data.price));
        } else {
          setLivePrice(null);
        }
      } catch (err) {
        console.error("price fetch failed", err);
        setLivePrice(null);
      }

      setLoadingPrice(false);
    }

    if (asset?.symbol) loadPrice();
  }, [asset]);

  const breakdown = useMemo(() => {
    const ordered = [...txns].sort((a, b) => {
      const ad = new Date(a.txn_date || 0).getTime();
      const bd = new Date(b.txn_date || 0).getTime();
      return ad - bd;
    });

    let shares = 0;
    let remainingBasis = 0;
    let totalBoughtShares = 0;
    let totalSoldShares = 0;
    let totalBuyCost = 0;
    let totalSellProceeds = 0;
    let costRemovedBySells = 0;
    let realizedPnl = 0;

    const rows = ordered.map((t) => {
      const qty = Number(t.qty) || 0;
      const price = Number(t.price) || 0;
      const txnType = String(t.txn_type || "").toUpperCase();

      const avgCostBefore = shares > 0 ? remainingBasis / shares : 0;
      let basisRemoved = 0;
      let realizedOnTxn = 0;
      let sharesAfter = shares;
      let basisAfter = remainingBasis;

      if (qty > 0 && price >= 0) {
        if (txnType === "BUY") {
          totalBoughtShares += qty;
          totalBuyCost += qty * price;

          sharesAfter = shares + qty;
          basisAfter = remainingBasis + qty * price;
        } else if (txnType === "SELL") {
          const sellQty = Math.min(qty, shares);

          totalSoldShares += qty;
          totalSellProceeds += qty * price;

          if (sellQty > 0) {
            basisRemoved = sellQty * avgCostBefore;
            realizedOnTxn = sellQty * price - basisRemoved;

            costRemovedBySells += basisRemoved;
            realizedPnl += realizedOnTxn;

            sharesAfter = shares - sellQty;
            basisAfter = remainingBasis - basisRemoved;

            if (sharesAfter <= 0 || basisAfter < 0.000001) {
              sharesAfter = 0;
              basisAfter = 0;
            }
          }
        }
      }

      const row = {
        ...t,
        qty,
        price,
        txnType,
        avgCostBefore,
        basisRemoved,
        realizedOnTxn,
        sharesBefore: shares,
        sharesAfter,
        basisBefore: remainingBasis,
        basisAfter,
      };

      shares = sharesAfter;
      remainingBasis = basisAfter;

      return row;
    });

    const hasLivePrice = Number.isFinite(Number(livePrice)) && Number(livePrice) > 0;
    const live = hasLivePrice ? Number(livePrice) : null;
    const currentValue = hasLivePrice ? shares * live : null;
    const unrealizedPnl = hasLivePrice ? currentValue - remainingBasis : null;
    const unrealizedPct =
      hasLivePrice && remainingBasis > 0
        ? ((currentValue - remainingBasis) / remainingBasis) * 100
        : null;
    const avgRemainingCost = shares > 0 ? remainingBasis / shares : 0;

    const purchasePrice =
      totalBoughtShares > 0 ? totalBuyCost / totalBoughtShares : null;

    const priceChange =
      hasLivePrice && Number.isFinite(Number(purchasePrice))
        ? live - Number(purchasePrice)
        : null;

    const priceChangePct =
      hasLivePrice &&
      Number.isFinite(Number(purchasePrice)) &&
      Number(purchasePrice) > 0
        ? ((live - Number(purchasePrice)) / Number(purchasePrice)) * 100
        : null;

    return {
      rows,
      totalBoughtShares,
      totalSoldShares,
      remainingShares: shares,
      totalBuyCost,
      totalSellProceeds,
      costRemovedBySells,
      remainingBasis,
      realizedPnl,
      avgRemainingCost,
      hasLivePrice,
      livePrice: live,
      currentValue,
      unrealizedPnl,
      unrealizedPct,
      purchasePrice,
      priceChange,
      priceChangePct,
    };
  }, [txns, livePrice]);

  const assetTone = breakdown.hasLivePrice
    ? toneByValue(breakdown.unrealizedPnl)
    : "neutral";

  const priceTone = toneByValue(breakdown.priceChange);
  const realizedTone = toneByValue(breakdown.realizedPnl);

  if (loading) {
    return (
      <main style={{ padding: "36px 28px 44px", maxWidth: "1320px", margin: "0 auto" }}>
        <div className="card" style={{ padding: 18 }}>
          Loading asset...
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ padding: "36px 28px 44px", maxWidth: "1320px", margin: "0 auto" }}>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontWeight: 900 }}>Fix this</div>
          <div className="muted" style={{ marginTop: 8 }}>{error}</div>
        </div>
      </main>
    );
  }

  if (!asset) {
    return (
      <main style={{ padding: "36px 28px 44px", maxWidth: "1320px", margin: "0 auto" }}>
        <div className="card" style={{ padding: 18 }}>
          Asset not found.
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        padding: "36px 28px 44px",
        maxWidth: "1320px",
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
            Asset Detail
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "clamp(2rem, 4vw, 3rem)",
              lineHeight: 1.04,
              fontWeight: 950,
            }}
          >
            {asset.symbol || "Unknown"} Breakdown
          </h1>

          <div className="muted" style={{ marginTop: 10, fontSize: 15, maxWidth: 800 }}>
            This page shows the actual math behind the position so you can see why the asset is up or down.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Link href="/investments" className="btnGhost">
            Back to Investments
          </Link>
          <Link href={`/market/${encodeURIComponent(asset.symbol || "")}`} className="btn">
            Open Market
          </Link>
        </div>
      </div>

      <div
        className="card"
        style={{
          padding: 20,
          marginBottom: 18,
          borderRadius: 26,
          background:
            assetTone === "good"
              ? "linear-gradient(180deg, rgba(34,197,94,.10), rgba(255,255,255,.02))"
              : assetTone === "bad"
                ? "linear-gradient(180deg, rgba(239,68,68,.10), rgba(255,255,255,.02))"
                : "linear-gradient(180deg, rgba(96,165,250,.10), rgba(255,255,255,.02))",
          border:
            assetTone === "good"
              ? "1px solid rgba(34,197,94,.16)"
              : assetTone === "bad"
                ? "1px solid rgba(239,68,68,.16)"
                : "1px solid rgba(255,255,255,.08)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.15fr .85fr",
            gap: 18,
            alignItems: "center",
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
              }}
            >
              Position Pulse
            </div>

            <div style={{ marginTop: 10, fontSize: "clamp(2rem, 4vw, 3.1rem)", fontWeight: 950 }}>
              {breakdown.hasLivePrice ? money(breakdown.currentValue) : "Waiting on live data"}
            </div>

            <div
              style={{
                marginTop: 10,
                fontSize: 16,
                fontWeight: 850,
                color:
                  assetTone === "good"
                    ? "#4ade80"
                    : assetTone === "bad"
                      ? "#f87171"
                      : "rgba(255,255,255,.85)",
              }}
            >
              {breakdown.hasLivePrice
                ? `${money(breakdown.unrealizedPnl)} unrealized • ${
                    breakdown.unrealizedPct != null ? pct(breakdown.unrealizedPct) : "—"
                  }`
                : loadingPrice
                  ? "Checking live market price..."
                  : "Live price unavailable."}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            <PulseMiniCard
              label="Remaining Shares"
              value={fmtNumber(breakdown.remainingShares)}
              sub="Current position size"
            />
            <PulseMiniCard
              label="Transactions"
              value={String(txns.length)}
              sub="Recorded asset trades"
            />
            <PulseMiniCard
              label="Live Price"
              value={breakdown.hasLivePrice ? money(breakdown.livePrice) : "Pending"}
              sub="Current market quote"
            />
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 16,
          marginBottom: 18,
        }}
      >
        <MetricCard
          title="Total Bought Shares"
          value={fmtNumber(breakdown.totalBoughtShares)}
          sub={`Buy cost: ${money(breakdown.totalBuyCost)}`}
          tone="neutral"
          strong
        />

        <MetricCard
          title="Total Sold Shares"
          value={fmtNumber(breakdown.totalSoldShares)}
          sub={`Sell proceeds: ${money(breakdown.totalSellProceeds)}`}
          tone="neutral"
          strong
        />

        <MetricCard
          title="Remaining Basis"
          value={money(breakdown.remainingBasis)}
          sub="Basis still attached to remaining shares."
          tone="neutral"
          strong
        />

        <MetricCard
          title="Avg Remaining Cost"
          value={breakdown.remainingShares > 0 ? money(breakdown.avgRemainingCost) : "—"}
          sub="Average cost per remaining share."
          tone="neutral"
          strong
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 16,
          marginBottom: 18,
        }}
      >
        <MetricCard
          title="Cost Removed By Sells"
          value={money(breakdown.costRemovedBySells)}
          sub="Basis taken off through sell transactions."
          tone="neutral"
          strong
        />

        <MetricCard
          title="Realized P/L"
          value={money(breakdown.realizedPnl)}
          sub="Closed gain/loss from sells."
          tone={realizedTone}
          valueTone={realizedTone}
          strong
        />

        <MetricCard
          title="Current Value"
          value={breakdown.hasLivePrice ? money(breakdown.currentValue) : "Pending"}
          sub="Remaining shares × live price."
          tone="neutral"
          strong
        />

        <MetricCard
          title="Unrealized P/L"
          value={breakdown.hasLivePrice ? money(breakdown.unrealizedPnl) : "Pending"}
          sub={
            breakdown.hasLivePrice
              ? breakdown.unrealizedPct != null
                ? pct(breakdown.unrealizedPct)
                : "Waiting on basis math"
              : "Shows once live price is available."
          }
          tone={assetTone}
          valueTone={assetTone}
          strong
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 16,
          marginBottom: 18,
        }}
      >
        <MetricCard
          title="Purchase Price"
          value={
            Number.isFinite(Number(breakdown.purchasePrice))
              ? money(breakdown.purchasePrice)
              : "—"
          }
          sub="Average price paid across recorded buys."
          tone="neutral"
          strong
        />

        <MetricCard
          title="Current Price"
          value={breakdown.hasLivePrice ? money(breakdown.livePrice) : "Pending"}
          sub="Latest market quote for this symbol."
          tone="neutral"
          strong
        />

        <MetricCard
          title="Price Change"
          value={
            Number.isFinite(Number(breakdown.priceChange))
              ? money(breakdown.priceChange)
              : "—"
          }
          sub={
            Number.isFinite(Number(breakdown.priceChangePct))
              ? pct(breakdown.priceChangePct)
              : "Price comparison unavailable."
          }
          tone={priceTone}
          valueTone={priceTone}
          strong
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 18,
          marginBottom: 18,
        }}
      >
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontWeight: 950, fontSize: 22 }}>Position Summary</div>
          <div className="muted" style={{ marginTop: 6, fontSize: 14 }}>
            Straight math. No guessing.
          </div>

          <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
            <MiniPoint
              title="Bought"
              sub={`${fmtNumber(breakdown.totalBoughtShares)} shares for ${money(
                breakdown.totalBuyCost
              )}`}
            />
            <MiniPoint
              title="Sold"
              sub={`${fmtNumber(breakdown.totalSoldShares)} shares for ${money(
                breakdown.totalSellProceeds
              )}`}
            />
            <MiniPoint
              title="Remaining"
              sub={`${fmtNumber(breakdown.remainingShares)} shares with ${money(
                breakdown.remainingBasis
              )} basis`}
            />
            <MiniPoint
              title="Price Comparison"
              sub={`Paid ${
                Number.isFinite(Number(breakdown.purchasePrice))
                  ? money(breakdown.purchasePrice)
                  : "—"
              } vs now ${
                breakdown.hasLivePrice ? money(breakdown.livePrice) : "Pending"
              }`}
            />
            <MiniPoint
              title="Realized vs Unrealized"
              sub={`Realized ${money(breakdown.realizedPnl)} • Unrealized ${
                breakdown.hasLivePrice ? money(breakdown.unrealizedPnl) : "Pending"
              }`}
            />
          </div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontWeight: 950, fontSize: 22 }}>Read This Correctly</div>

          <div
            className="muted"
            style={{ marginTop: 8, lineHeight: 1.5 }}
          >
            Remaining basis is what is still attached to the shares you have left.
            Realized P/L is what you already locked in on sells.
            Unrealized P/L is what the remaining position is worth versus its remaining basis.
          </div>

          <div
            style={{
              display: "grid",
              gap: 10,
              marginTop: 16,
            }}
          >
            <MiniPoint
              title="Accounting method"
              sub="Average-cost sell handling."
            />

            <MiniPoint
              title="Live pricing"
              sub={
                loadingPrice
                  ? "Refreshing current quote."
                  : "Uses your live price route when available."
              }
            />

            <MiniPoint
              title="Why this matters"
              sub="This page exposes incorrect trade entries immediately instead of hiding them in portfolio totals."
            />
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 18, marginBottom: 18 }}>
        <div style={{ fontWeight: 950, fontSize: 22 }}>Transaction Timeline</div>
        <div className="muted" style={{ marginTop: 6, fontSize: 14 }}>
          Read the position from top to bottom. This is the story of the asset.
        </div>

        <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
          {breakdown.rows.length ? (
            breakdown.rows.map((t) => {
              const tone =
                t.txnType === "BUY" ? "good" : t.txnType === "SELL" ? "bad" : "neutral";

              return (
                <div
                  key={`timeline-${t.id}`}
                  style={{
                    borderRadius: 18,
                    padding: 16,
                    ...glowPanelStyle(tone, false),
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ fontWeight: 950, fontSize: 17 }}>
                      {t.txnType} {fmtNumber(t.qty)} shares @ {money(t.price)}
                    </div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      {fmtDate(t.txn_date)}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                      gap: 10,
                      marginTop: 12,
                    }}
                  >
                    <TimelineStat label="Shares Before" value={fmtNumber(t.sharesBefore)} />
                    <TimelineStat label="Shares After" value={fmtNumber(t.sharesAfter)} />
                    <TimelineStat label="Basis Before" value={money(t.basisBefore)} />
                    <TimelineStat label="Basis After" value={money(t.basisAfter)} />
                  </div>

                  {t.txnType === "SELL" ? (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                        gap: 10,
                        marginTop: 12,
                      }}
                    >
                      <TimelineStat label="Basis Removed" value={money(t.basisRemoved)} />
                      <TimelineStat label="Avg Cost Before" value={money(t.avgCostBefore)} />
                      <TimelineStat
                        label="Realized On Trade"
                        value={money(t.realizedOnTxn)}
                        tone={toneByValue(t.realizedOnTxn)}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : (
            <EmptyState
              title="No transactions yet"
              sub="This asset needs recorded buys or sells before the breakdown can show real math."
            />
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "120px 120px 120px 150px 150px 150px 150px 150px",
            gap: 12,
            padding: "16px 18px",
            borderBottom: "1px solid rgba(255,255,255,.08)",
            fontWeight: 900,
            color: "rgba(255,255,255,.75)",
          }}
        >
          <div>Type</div>
          <div>Qty</div>
          <div>Price</div>
          <div>Date</div>
          <div>Basis Removed</div>
          <div>Realized P/L</div>
          <div>Shares After</div>
          <div>Basis After</div>
        </div>

        {breakdown.rows.length ? (
          breakdown.rows.map((t) => {
            const tone =
              t.txnType === "BUY" ? "good" : t.txnType === "SELL" ? "bad" : "neutral";

            return (
              <div
                key={t.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "120px 120px 120px 150px 150px 150px 150px 150px",
                  gap: 12,
                  padding: "16px 18px",
                  borderBottom: "1px solid rgba(255,255,255,.08)",
                  alignItems: "center",
                  background:
                    tone === "good"
                      ? "linear-gradient(90deg, rgba(34,197,94,.05), transparent 28%)"
                      : tone === "bad"
                        ? "linear-gradient(90deg, rgba(239,68,68,.05), transparent 28%)"
                        : "transparent",
                }}
              >
                <div
                  style={{
                    fontWeight: 850,
                    color:
                      tone === "good"
                        ? "#4ade80"
                        : tone === "bad"
                          ? "#f87171"
                          : "inherit",
                  }}
                >
                  {t.txnType}
                </div>

                <div>{fmtNumber(t.qty)}</div>
                <div>{money(t.price)}</div>
                <div>{t.txn_date || "—"}</div>
                <div>{t.txnType === "SELL" ? money(t.basisRemoved) : "—"}</div>
                <div
                  style={{
                    color:
                      t.txnType === "SELL"
                        ? toneByValue(t.realizedOnTxn) === "good"
                          ? "#4ade80"
                          : toneByValue(t.realizedOnTxn) === "bad"
                            ? "#f87171"
                            : "inherit"
                        : "inherit",
                    fontWeight: t.txnType === "SELL" ? 850 : 400,
                  }}
                >
                  {t.txnType === "SELL" ? money(t.realizedOnTxn) : "—"}
                </div>
                <div>{fmtNumber(t.sharesAfter)}</div>
                <div>{money(t.basisAfter)}</div>
              </div>
            );
          })
        ) : (
          <div style={{ padding: 18 }}>
            <EmptyState
              title="No transactions yet"
              sub="This asset needs recorded buys or sells before the breakdown can show real math."
            />
          </div>
        )}
      </div>
    </main>
  );
}

function MetricCard({
  title,
  value,
  sub,
  valueTone = "default",
  tone = "neutral",
  strong = false,
}) {
  const toneColor =
    valueTone === "good"
      ? "#4ade80"
      : valueTone === "bad"
        ? "#f87171"
        : "inherit";

  return (
    <div
      style={{
        borderRadius: 22,
        padding: 18,
        ...glowPanelStyle(tone, strong),
      }}
    >
      <div
        className="muted"
        style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em" }}
      >
        {title}
      </div>
      <div style={{ marginTop: 10, fontSize: 20, fontWeight: 950, color: toneColor }}>
        {value}
      </div>
      <div className="muted" style={{ marginTop: 10, fontSize: 13, lineHeight: 1.45 }}>
        {sub}
      </div>
    </div>
  );
}

function PulseMiniCard({ label, value, sub }) {
  return (
    <div
      style={{
        borderRadius: 18,
        padding: 14,
        border: "1px solid rgba(255,255,255,.08)",
        background: "rgba(255,255,255,.035)",
      }}
    >
      <div
        className="muted"
        style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em" }}
      >
        {label}
      </div>
      <div style={{ marginTop: 8, fontWeight: 950, fontSize: 22 }}>{value}</div>
      <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>{sub}</div>
    </div>
  );
}

function TimelineStat({ label, value, tone = "neutral" }) {
  const color =
    tone === "good"
      ? "#4ade80"
      : tone === "bad"
        ? "#f87171"
        : "rgba(255,255,255,.92)";

  return (
    <div
      style={{
        borderRadius: 14,
        padding: 12,
        border: "1px solid rgba(255,255,255,.07)",
        background: "rgba(255,255,255,.025)",
      }}
    >
      <div
        className="muted"
        style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}
      >
        {label}
      </div>
      <div style={{ marginTop: 6, fontWeight: 900, color }}>
        {value}
      </div>
    </div>
  );
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
  );
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
  );
}
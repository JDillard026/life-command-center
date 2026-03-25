"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const DISPLAY_FONT = 'Georgia, "Times New Roman", serif';

function money(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function fmtNumber(n, digits = 4) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, {
    maximumFractionDigits: digits,
  });
}

function pct(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return `${num >= 0 ? "+" : ""}${num.toFixed(2)}%`;
}

function shortDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return String(value);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function toneByValue(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return "neutral";
  return n > 0 ? "good" : "bad";
}

function toneVars(tone = "neutral") {
  if (tone === "good") {
    return {
      border: "rgba(92, 247, 184, 0.18)",
      glow: "rgba(92, 247, 184, 0.12)",
      accent: "#95f7ca",
      top: "rgba(92, 247, 184, 0.10)",
    };
  }
  if (tone === "bad") {
    return {
      border: "rgba(255, 126, 169, 0.18)",
      glow: "rgba(255, 126, 169, 0.12)",
      accent: "#ffb3cb",
      top: "rgba(255, 126, 169, 0.10)",
    };
  }
  return {
    border: "rgba(225, 235, 255, 0.14)",
    glow: "rgba(133, 173, 255, 0.10)",
    accent: "rgba(255,255,255,.92)",
    top: "rgba(109, 146, 255, 0.10)",
  };
}

function pageShell() {
  return {
    minHeight: "100vh",
    maxWidth: 1480,
    margin: "0 auto",
    padding: "24px 20px 56px",
    color: "rgba(255,255,255,.96)",
    background: `
      radial-gradient(circle at 12% 8%, rgba(85,135,255,.08) 0%, rgba(0,0,0,0) 24%),
      radial-gradient(circle at 78% 6%, rgba(255,255,255,.04) 0%, rgba(0,0,0,0) 18%),
      radial-gradient(circle at 50% 36%, rgba(99, 135, 255, .04) 0%, rgba(0,0,0,0) 28%)
    `,
  };
}

function glass(tone = "neutral", radius = 28) {
  const t = toneVars(tone);

  return {
    position: "relative",
    overflow: "hidden",
    borderRadius: radius,
    border: `1px solid ${t.border}`,
    background: `
      linear-gradient(180deg, rgba(255,255,255,.10) 0%, rgba(255,255,255,.045) 10%, rgba(255,255,255,.01) 20%, rgba(255,255,255,0) 34%),
      radial-gradient(circle at top left, ${t.top} 0%, rgba(255,255,255,0) 28%),
      linear-gradient(180deg, rgba(9,14,28,.28) 0%, rgba(7,11,22,.16) 100%)
    `,
    boxShadow: `
      0 0 0 1px rgba(255,255,255,.02) inset,
      0 14px 38px rgba(0,0,0,.14),
      0 0 20px ${t.glow}
    `,
    backdropFilter: "blur(26px)",
    WebkitBackdropFilter: "blur(26px)",
  };
}

function heroRail() {
  return {
    ...glass("neutral", 34),
    padding: "26px 24px 24px",
  };
}

function overlineStyle(color = "rgba(255,255,255,.56)") {
  return {
    fontSize: 11,
    letterSpacing: "0.28em",
    textTransform: "uppercase",
    fontWeight: 800,
    color,
  };
}

function actionBtn(primary = false) {
  return {
    height: 42,
    padding: "0 14px",
    borderRadius: 999,
    border: primary
      ? "1px solid rgba(255,255,255,.28)"
      : "1px solid rgba(255,255,255,.10)",
    background: primary
      ? "linear-gradient(180deg, rgba(255,255,255,.95) 0%, rgba(233,239,248,.88) 100%)"
      : "linear-gradient(180deg, rgba(255,255,255,.08) 0%, rgba(255,255,255,.03) 100%)",
    color: primary ? "#0b1220" : "rgba(255,255,255,.94)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    fontWeight: 800,
    fontSize: 14,
    cursor: "pointer",
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
          basisRemoved = sellQty * avgCostBefore;
          realizedOnTxn = sellQty * price - basisRemoved;

          totalSoldShares += sellQty;
          totalSellProceeds += sellQty * price;
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

      shares = sharesAfter;
      remainingBasis = basisAfter;

      return {
        ...t,
        qty,
        price,
        txnType,
        avgCostBefore,
        basisRemoved,
        realizedOnTxn,
        sharesAfter,
        basisAfter,
      };
    });

    const avgRemainingCost = shares > 0 ? remainingBasis / shares : null;
    const currentValue =
      Number.isFinite(Number(livePrice)) && shares > 0 ? Number(livePrice) * shares : null;
    const unrealizedPnl =
      currentValue != null ? Number(currentValue) - Number(remainingBasis) : null;
    const unrealizedPct =
      currentValue != null && remainingBasis > 0
        ? ((Number(currentValue) - Number(remainingBasis)) / Number(remainingBasis)) * 100
        : null;
    const avgPurchasePrice =
      totalBoughtShares > 0 ? totalBuyCost / totalBoughtShares : null;

    return {
      rows,
      remainingShares: shares,
      remainingBasis,
      totalBoughtShares,
      totalSoldShares,
      totalBuyCost,
      totalSellProceeds,
      costRemovedBySells,
      realizedPnl,
      avgRemainingCost,
      currentValue,
      unrealizedPnl,
      unrealizedPct,
      avgPurchasePrice,
    };
  }, [txns, livePrice]);

  const assetTone = toneByValue(breakdown.unrealizedPnl);

  if (!loading && !asset) {
    return (
      <main style={pageShell()}>
        <div style={{ ...glass("neutral", 24), padding: 18 }}>Asset not found.</div>
      </main>
    );
  }

  return (
    <main style={pageShell()}>
      {error ? (
        <div style={{ ...glass("bad", 22), padding: 14, marginBottom: 14 }}>
          <div style={{ fontWeight: 800, color: "#ffcade" }}>{error}</div>
        </div>
      ) : null}

      <section style={heroRail()}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 18,
            alignItems: "end",
          }}
        >
          <div>
            <div style={overlineStyle("rgba(190,255,223,.84)")}>Asset Detail</div>

            <h1
              style={{
                margin: "10px 0 0",
                fontFamily: DISPLAY_FONT,
                fontSize: "clamp(2.6rem, 5vw, 4.8rem)",
                lineHeight: 0.95,
                letterSpacing: "-0.05em",
                fontWeight: 700,
                color: "rgba(255,255,255,.98)",
              }}
            >
              {asset?.symbol || "Unknown"} Breakdown
            </h1>

            <div
              style={{
                marginTop: 14,
                maxWidth: 820,
                fontSize: 15,
                lineHeight: 1.7,
                color: "rgba(255,255,255,.76)",
              }}
            >
              This page shows the actual math behind the position so you can see why the asset is up
              or down.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Link href="/investments" style={actionBtn(false)}>
              Back to Investments
            </Link>
            <Link href={`/market/${encodeURIComponent(asset?.symbol || "")}`} style={actionBtn(true)}>
              Open Market
            </Link>
          </div>
        </div>
      </section>

      <section
        style={{
          ...glass(assetTone, 32),
          padding: 18,
          marginTop: 14,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,1.1fr) minmax(320px,.9fr)",
            gap: 18,
            alignItems: "center",
          }}
        >
          <div>
            <div style={overlineStyle("rgba(255,255,255,.46)")}>Position Pulse</div>

            <div
              style={{
                marginTop: 12,
                fontFamily: DISPLAY_FONT,
                fontSize: "clamp(2rem, 4vw, 3.4rem)",
                lineHeight: 0.96,
                fontWeight: 700,
                letterSpacing: "-0.05em",
                color: assetTone === "bad" ? "#ffbdd0" : "rgba(255,255,255,.98)",
              }}
            >
              {money(breakdown.currentValue || 0)}
            </div>

            <div
              style={{
                marginTop: 12,
                fontSize: 16,
                fontWeight: 800,
                color: assetTone === "good" ? "#9df4cb" : assetTone === "bad" ? "#ffbdd0" : "rgba(255,255,255,.82)",
              }}
            >
              {money(breakdown.unrealizedPnl || 0)} unrealized{" "}
              {breakdown.unrealizedPct != null ? `• ${pct(breakdown.unrealizedPct)}` : "• —"}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            <MetricMini title="Remaining Shares" value={fmtNumber(breakdown.remainingShares)} />
            <MetricMini title="Transactions" value={String(txns.length)} />
            <MetricMini
              title="Live Price"
              value={
                loadingPrice
                  ? "Loading"
                  : Number.isFinite(Number(livePrice))
                    ? money(livePrice)
                    : "Pending"
              }
            />
          </div>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 14,
          marginTop: 14,
        }}
      >
        <MetricCard title="Total Bought Shares" value={fmtNumber(breakdown.totalBoughtShares)} sub={`Buy cost: ${money(breakdown.totalBuyCost)}`} />
        <MetricCard title="Total Sold Shares" value={fmtNumber(breakdown.totalSoldShares)} sub={`Sell proceeds: ${money(breakdown.totalSellProceeds)}`} />
        <MetricCard title="Remaining Basis" value={money(breakdown.remainingBasis)} sub="Basis still attached to remaining shares." />
        <MetricCard title="Avg Remaining Cost" value={breakdown.avgRemainingCost != null ? money(breakdown.avgRemainingCost) : "—"} sub="Average cost per remaining share." />
        <MetricCard title="Cost Removed by Sells" value={money(breakdown.costRemovedBySells)} sub="Basis taken off through sell transactions." />
        <MetricCard title="Realized P/L" value={money(breakdown.realizedPnl)} sub="Closed gain/loss from sells." tone={toneByValue(breakdown.realizedPnl)} />
        <MetricCard title="Current Value" value={money(breakdown.currentValue || 0)} sub="Remaining shares × live price." tone={assetTone} />
        <MetricCard title="Unrealized P/L" value={money(breakdown.unrealizedPnl || 0)} sub={breakdown.unrealizedPct != null ? pct(breakdown.unrealizedPct) : "Waiting on basis math"} tone={assetTone} />
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 14,
          marginTop: 14,
        }}
      >
        <div style={{ ...glass("neutral", 30), padding: 18 }}>
          <div
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: 22,
              fontWeight: 700,
              color: "rgba(255,255,255,.96)",
            }}
          >
            Position Summary
          </div>
          <div style={{ marginTop: 6, fontSize: 14, color: "rgba(255,255,255,.66)" }}>
            Straight math. No guessing.
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
            <SummaryBlock tone="good" label="Bought" value={`${fmtNumber(breakdown.totalBoughtShares)} shares for ${money(breakdown.totalBuyCost)}`} />
            <SummaryBlock tone="bad" label="Sold" value={`${fmtNumber(breakdown.totalSoldShares)} shares for ${money(breakdown.totalSellProceeds)}`} />
            <SummaryBlock label="Still Attached" value={`${fmtNumber(breakdown.remainingShares)} shares carrying ${money(breakdown.remainingBasis)} of basis`} />
            <SummaryBlock label="Current Mark" value={Number.isFinite(Number(livePrice)) ? `${money(livePrice)} live price` : "Live price pending"} />
          </div>
        </div>

        <div style={{ ...glass("neutral", 30), padding: 18 }}>
          <div
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: 22,
              fontWeight: 700,
              color: "rgba(255,255,255,.96)",
            }}
          >
            Read This Correctly
          </div>
          <div
            style={{
              marginTop: 12,
              fontSize: 15,
              lineHeight: 1.7,
              color: "rgba(255,255,255,.76)",
            }}
          >
            Remaining basis is what is still attached to the shares you have left. Realized P/L is
            what you already locked in on sells. Unrealized P/L is what the remaining position is
            worth versus its remaining basis.
          </div>

          <div style={{ ...glass("neutral", 22), padding: 14, marginTop: 16 }}>
            <div style={overlineStyle("rgba(255,255,255,.46)")}>Accounting Method</div>
            <div style={{ marginTop: 10, fontSize: 14, color: "rgba(255,255,255,.82)" }}>
              Average-cost sell handling.
            </div>
          </div>
        </div>
      </section>

      <section
        style={{
          ...glass("neutral", 32),
          padding: 18,
          marginTop: 14,
        }}
      >
        <div
          style={{
            fontFamily: DISPLAY_FONT,
            fontSize: 22,
            fontWeight: 700,
            color: "rgba(255,255,255,.96)",
          }}
        >
          Transaction Ledger
        </div>
        <div style={{ marginTop: 6, fontSize: 14, color: "rgba(255,255,255,.66)" }}>
          This is the row-by-row position math.
        </div>

        <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
          {breakdown.rows.length ? (
            breakdown.rows.map((row) => {
              const tone = row.txnType === "SELL" ? "bad" : "good";

              return (
                <div
                  key={row.id}
                  style={{
                    ...glass(tone, 22),
                    padding: 14,
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto minmax(0,1fr) auto",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        height: 28,
                        padding: "0 10px",
                        borderRadius: 999,
                        border: `1px solid ${toneVars(tone).border}`,
                        background: "rgba(255,255,255,.04)",
                        color: tone === "bad" ? "#ffbdd0" : "#9df4cb",
                        display: "inline-flex",
                        alignItems: "center",
                        fontSize: 11,
                        fontWeight: 800,
                      }}
                    >
                      {row.txnType}
                    </div>

                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: "rgba(255,255,255,.94)" }}>
                        {fmtNumber(row.qty)} shares @ {money(row.price)}
                      </div>
                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 12,
                          lineHeight: 1.6,
                          color: "rgba(255,255,255,.62)",
                        }}
                      >
                        Avg cost before: {money(row.avgCostBefore)} • Basis removed: {money(row.basisRemoved)} • Realized on txn: {money(row.realizedOnTxn)} • Shares after: {fmtNumber(row.sharesAfter)} • Basis after: {money(row.basisAfter)}
                      </div>
                    </div>

                    <div style={{ fontSize: 12, color: "rgba(255,255,255,.58)", fontWeight: 700 }}>
                      {shortDate(row.txn_date)}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <EmptyState title="No transactions yet" sub="Once you record buys or sells, the full ledger math will show here." />
          )}
        </div>
      </section>

      {loading ? (
        <div style={{ marginTop: 14 }}>
          <EmptyState title="Loading asset..." sub="Pulling symbol data and transaction history." />
        </div>
      ) : null}
    </main>
  );
}

function MetricMini({ title, value }) {
  return (
    <div style={{ ...glass("neutral", 22), padding: 14 }}>
      <div style={overlineStyle("rgba(255,255,255,.42)")}>{title}</div>
      <div
        style={{
          marginTop: 10,
          fontFamily: DISPLAY_FONT,
          fontSize: 18,
          fontWeight: 700,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function MetricCard({ title, value, sub, tone = "neutral" }) {
  return (
    <div style={{ ...glass(tone, 26), padding: 18 }}>
      <div style={overlineStyle("rgba(255,255,255,.44)")}>{title}</div>
      <div
        style={{
          marginTop: 12,
          fontFamily: DISPLAY_FONT,
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          color:
            tone === "good"
              ? "#9df4cb"
              : tone === "bad"
                ? "#ffbdd0"
                : "rgba(255,255,255,.98)",
        }}
      >
        {value}
      </div>
      <div style={{ marginTop: 14, fontSize: 14, lineHeight: 1.55, color: "rgba(255,255,255,.66)" }}>
        {sub}
      </div>
    </div>
  );
}

function SummaryBlock({ label, value, tone = "neutral" }) {
  return (
    <div style={{ ...glass(tone, 22), padding: 14 }}>
      <div style={{ fontWeight: 900, fontSize: 16, color: "rgba(255,255,255,.95)" }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.6, color: "rgba(255,255,255,.70)" }}>
        {value}
      </div>
    </div>
  );
}

function EmptyState({ title, sub }) {
  return (
    <div style={{ ...glass("neutral", 22), padding: 18 }}>
      <div style={{ fontWeight: 800, fontSize: 16, color: "rgba(255,255,255,.94)" }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.6, color: "rgba(255,255,255,.62)" }}>
        {sub}
      </div>
    </div>
  );
}
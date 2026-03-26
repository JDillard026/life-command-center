"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BadgeDollarSign,
  ExternalLink,
  Layers3,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import GlassPane from "../../components/GlassPane";

export const dynamic = "force-dynamic";

const FONT_STACK =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

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
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toneMeta(tone = "neutral") {
  if (tone === "green") {
    return {
      text: "#97efc7",
      border: "rgba(143,240,191,0.16)",
      glow: "rgba(110,229,173,0.10)",
      dot: "#8ef4bb",
      pillBg: "rgba(8,18,12,0.42)",
      iconBg: "rgba(12,22,17,0.72)",
    };
  }

  if (tone === "red") {
    return {
      text: "#ffb4c5",
      border: "rgba(255,132,163,0.16)",
      glow: "rgba(255,108,145,0.10)",
      dot: "#ff96ae",
      pillBg: "rgba(18,8,11,0.42)",
      iconBg: "rgba(24,11,15,0.72)",
    };
  }

  if (tone === "amber") {
    return {
      text: "#f5cf88",
      border: "rgba(255,204,112,0.16)",
      glow: "rgba(255,194,92,0.10)",
      dot: "#ffd089",
      pillBg: "rgba(18,14,8,0.42)",
      iconBg: "rgba(24,18,11,0.72)",
    };
  }

  return {
    text: "#f7fbff",
    border: "rgba(214,226,255,0.13)",
    glow: "rgba(140,170,255,0.08)",
    dot: "#f7fbff",
    pillBg: "rgba(10,14,21,0.40)",
    iconBg: "rgba(12,16,24,0.72)",
  };
}

function toneByValue(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return "neutral";
  return n > 0 ? "green" : "red";
}

function overlineStyle() {
  return {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: ".22em",
    fontWeight: 800,
    color: "rgba(255,255,255,0.42)",
  };
}

function mutedStyle() {
  return {
    fontSize: 13,
    lineHeight: 1.5,
    color: "rgba(255,255,255,0.64)",
  };
}

function MiniPill({ children, tone = "neutral" }) {
  const meta = toneMeta(tone);

  return (
    <div
      style={{
        minHeight: 32,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "0 11px",
        borderRadius: 999,
        border: `1px solid ${meta.border}`,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.035), 0 0 10px ${meta.glow}`,
        color: tone === "neutral" ? "rgba(255,255,255,0.88)" : meta.text,
        fontSize: 11,
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
  );
}

function ActionLink({ href, children }) {
  return (
    <Link
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        minHeight: 40,
        padding: "10px 13px",
        borderRadius: 14,
        border: "1px solid rgba(214,226,255,0.10)",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012))",
        color: "#f7fbff",
        textDecoration: "none",
        fontWeight: 800,
        fontSize: 13,
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.04), 0 10px 18px rgba(0,0,0,0.12)",
      }}
    >
      {children}
    </Link>
  );
}

function PaneHeader({ title, subcopy, right }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 12,
        flexWrap: "wrap",
        marginBottom: 12,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 18,
            lineHeight: 1.1,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "#fff",
          }}
        >
          {title}
        </div>

        {subcopy ? <div style={{ ...mutedStyle(), marginTop: 4 }}>{subcopy}</div> : null}
      </div>

      {right || null}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, detail, tone = "neutral" }) {
  const meta = toneMeta(tone);

  return (
    <GlassPane tone={tone} size="card" style={{ height: "100%" }}>
      <div
        style={{
          minHeight: 132,
          display: "grid",
          gridTemplateRows: "auto auto 1fr",
          gap: 8,
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 13,
            display: "grid",
            placeItems: "center",
            border: `1px solid ${meta.border}`,
            background: meta.iconBg,
            color: tone === "neutral" ? "#fff" : meta.text,
            boxShadow: `0 0 12px ${meta.glow}`,
          }}
        >
          <Icon size={16} />
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={overlineStyle()}>{label}</div>
          <div
            style={{
              marginTop: 8,
              fontSize: "clamp(20px, 2.7vw, 30px)",
              lineHeight: 1,
              fontWeight: 850,
              letterSpacing: "-0.05em",
              color: tone === "neutral" ? "#fff" : meta.text,
              overflowWrap: "anywhere",
            }}
          >
            {value}
          </div>
        </div>

        <div style={mutedStyle()}>{detail}</div>
      </div>
    </GlassPane>
  );
}

function TradeRow({ txn, avgCostBefore, realizedOnTxn, basisRemoved }) {
  const type = String(txn.txn_type || "").toUpperCase();
  const tone = type === "SELL" ? toneByValue(realizedOnTxn) : "neutral";
  const meta = toneMeta(tone);

  return (
    <div
      style={{
        minHeight: 84,
        display: "grid",
        gridTemplateColumns: "52px minmax(0, 1fr) auto",
        gap: 12,
        alignItems: "center",
        padding: "12px 14px",
        borderRadius: 18,
        border: `1px solid ${meta.border}`,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          display: "grid",
          placeItems: "center",
          border: `1px solid ${meta.border}`,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.012))",
          color: type === "SELL" ? meta.text : "#fff",
          fontWeight: 900,
          fontSize: 13,
        }}
      >
        {type}
      </div>

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: "#fff",
            lineHeight: 1.25,
          }}
        >
          {fmtNumber(txn.qty)} shares @ {money(txn.price)}
        </div>

        <div style={{ marginTop: 4, ...mutedStyle() }}>
          {shortDate(txn.txn_date)} • Avg cost before trade: {money(avgCostBefore)}
        </div>

        {type === "SELL" ? (
          <div
            style={{
              marginTop: 4,
              fontSize: 12,
              fontWeight: 700,
              color: tone === "neutral" ? "rgba(255,255,255,0.66)" : meta.text,
              lineHeight: 1.35,
            }}
          >
            Basis removed: {money(basisRemoved)} • Realized: {signedMoney(realizedOnTxn)}
          </div>
        ) : null}
      </div>

      <div
        style={{
          fontSize: 14,
          fontWeight: 800,
          color: type === "SELL" ? meta.text : "#fff",
          whiteSpace: "nowrap",
        }}
      >
        {money(toNum(txn.qty) * toNum(txn.price))}
      </div>
    </div>
  );
}

function signedMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  const abs = Math.abs(num).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
  if (num > 0) return `+${abs}`;
  if (num < 0) return `-${abs}`;
  return abs;
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
        const res = await fetch(`/api/prices?symbol=${encodeURIComponent(symbol)}`, {
          cache: "no-store",
        });
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
      const qty = toNum(t.qty);
      const price = toNum(t.price);
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
          totalSoldShares += qty;
          totalSellProceeds += qty * price;
          basisRemoved = avgCostBefore * qty;
          costRemovedBySells += basisRemoved;
          realizedOnTxn = qty * price - basisRemoved;
          realizedPnl += realizedOnTxn;
          sharesAfter = shares - qty;
          basisAfter = remainingBasis - basisRemoved;
        }
      }

      shares = sharesAfter;
      remainingBasis = basisAfter;

      return {
        ...t,
        avgCostBefore,
        basisRemoved,
        realizedOnTxn,
        sharesAfter,
        basisAfter,
      };
    });

    const remainingShares = shares;
    const currentValue =
      Number.isFinite(Number(livePrice)) && Number(livePrice) > 0
        ? remainingShares * Number(livePrice)
        : null;

    const avgCostRemaining =
      remainingShares > 0 ? remainingBasis / remainingShares : 0;

    const unrealizedPnl =
      currentValue != null ? currentValue - remainingBasis : null;

    const unrealizedPct =
      currentValue != null && remainingBasis > 0
        ? ((currentValue - remainingBasis) / remainingBasis) * 100
        : null;

    return {
      rows,
      remainingShares,
      remainingBasis,
      avgCostRemaining,
      realizedPnl,
      totalBoughtShares,
      totalSoldShares,
      totalBuyCost,
      totalSellProceeds,
      costRemovedBySells,
      currentValue,
      unrealizedPnl,
      unrealizedPct,
    };
  }, [txns, livePrice]);

  const assetTone =
    breakdown.unrealizedPnl == null ? "neutral" : toneByValue(breakdown.unrealizedPnl);

  if (loading) {
    return (
      <main style={{ padding: "18px 0 28px", fontFamily: FONT_STACK }}>
        <div style={{ width: "min(100%, 1320px)", margin: "0 auto" }}>
          <GlassPane size="card">
            <div style={{ fontWeight: 800, fontSize: 18, color: "#fff" }}>
              Loading asset.
            </div>
          </GlassPane>
        </div>
      </main>
    );
  }

  if (error || !asset) {
    return (
      <main style={{ padding: "18px 0 28px", fontFamily: FONT_STACK }}>
        <div style={{ width: "min(100%, 1320px)", margin: "0 auto" }}>
          <GlassPane tone="red" size="card">
            <div style={{ fontWeight: 800, fontSize: 18, color: "#fff" }}>
              {error || "Could not load asset."}
            </div>
          </GlassPane>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="assetRoot">
        <div className="assetInner">
          <GlassPane size="card">
            <div className="assetHeroGrid">
              <div style={{ minWidth: 0 }}>
                <div style={overlineStyle()}>Position Detail</div>

                <div
                  style={{
                    marginTop: 8,
                    fontSize: "clamp(24px, 3.2vw, 34px)",
                    lineHeight: 1.02,
                    fontWeight: 850,
                    letterSpacing: "-0.05em",
                    color: "#fff",
                  }}
                >
                  {asset.symbol || "Unknown"} Breakdown
                </div>

                <div style={{ marginTop: 10, ...mutedStyle(), maxWidth: 760 }}>
                  This page shows the actual math behind the position so you can see why the
                  asset is up or down.
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  justifyContent: "flex-end",
                }}
              >
                <MiniPill tone={assetTone}>
                  {loadingPrice ? "Loading price" : livePrice ? money(livePrice) : "No live price"}
                </MiniPill>
                <ActionLink href="/investments">
                  <ArrowLeft size={14} /> Back
                </ActionLink>
                <ActionLink href={`/market/${encodeURIComponent(asset.symbol || "")}`}>
                  Open Market <ExternalLink size={14} />
                </ActionLink>
              </div>
            </div>
          </GlassPane>

          <section className="assetMetrics">
            <MetricCard
              icon={Wallet}
              label="Current Value"
              value={breakdown.currentValue != null ? money(breakdown.currentValue) : "—"}
              detail="Live value of remaining shares."
              tone={assetTone}
            />
            <MetricCard
              icon={TrendingUp}
              label="Unrealized P/L"
              value={breakdown.unrealizedPnl != null ? signedMoney(breakdown.unrealizedPnl) : "—"}
              detail={
                breakdown.unrealizedPct != null
                  ? `${pct(breakdown.unrealizedPct)} on remaining basis.`
                  : "Needs live price to calculate."
              }
              tone={assetTone}
            />
            <MetricCard
              icon={Layers3}
              label="Remaining Shares"
              value={fmtNumber(breakdown.remainingShares)}
              detail={`Avg remaining cost: ${money(breakdown.avgCostRemaining)}`}
              tone="neutral"
            />
            <MetricCard
              icon={BadgeDollarSign}
              label="Realized P/L"
              value={signedMoney(breakdown.realizedPnl)}
              detail="Closed result from completed sell activity."
              tone={toneByValue(breakdown.realizedPnl)}
            />
          </section>

          <section className="assetMain">
            <div className="assetLeftCol">
              <GlassPane tone={assetTone} size="card">
                <PaneHeader
                  title="Position Pulse"
                  subcopy="The exact stack behind your remaining position."
                  right={<MiniPill tone={assetTone}>{asset.asset_type || "asset"}</MiniPill>}
                />

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: 8,
                  }}
                >
                  <MiniMetric title="Remaining Basis" value={money(breakdown.remainingBasis)} />
                  <MiniMetric title="Bought Shares" value={fmtNumber(breakdown.totalBoughtShares)} />
                  <MiniMetric title="Sold Shares" value={fmtNumber(breakdown.totalSoldShares)} />
                  <MiniMetric title="Buy Cost" value={money(breakdown.totalBuyCost)} />
                  <MiniMetric title="Sell Proceeds" value={money(breakdown.totalSellProceeds)} />
                  <MiniMetric title="Basis Removed" value={money(breakdown.costRemovedBySells)} />
                </div>
              </GlassPane>

              <GlassPane size="card">
                <PaneHeader
                  title="Transaction Ledger"
                  subcopy="The exact trades feeding the math above."
                  right={<MiniPill>{txns.length} trades</MiniPill>}
                />

                <div style={{ display: "grid", gap: 8 }}>
                  {breakdown.rows.length === 0 ? (
                    <div style={{ ...mutedStyle(), padding: "6px 2px" }}>
                      No trades logged for this asset yet.
                    </div>
                  ) : (
                    breakdown.rows
                      .slice()
                      .reverse()
                      .map((row) => (
                        <TradeRow
                          key={row.id}
                          txn={row}
                          avgCostBefore={row.avgCostBefore}
                          realizedOnTxn={row.realizedOnTxn}
                          basisRemoved={row.basisRemoved}
                        />
                      ))
                  )}
                </div>
              </GlassPane>
            </div>

            <div className="assetRightCol">
              <GlassPane size="card">
                <PaneHeader
                  title="Snapshot"
                  subcopy="Fast readout of the live position state."
                />

                <div style={{ display: "grid", gap: 8 }}>
                  <SnapshotRow
                    label="Symbol"
                    value={String(asset.symbol || "—").toUpperCase()}
                  />
                  <SnapshotRow
                    label="Account"
                    value={asset.account || "—"}
                  />
                  <SnapshotRow
                    label="Asset Type"
                    value={asset.asset_type || "—"}
                  />
                  <SnapshotRow
                    label="Live Price"
                    value={loadingPrice ? "Loading..." : livePrice ? money(livePrice) : "—"}
                  />
                  <SnapshotRow
                    label="Unrealized"
                    value={
                      breakdown.unrealizedPnl != null
                        ? `${signedMoney(breakdown.unrealizedPnl)}${
                            breakdown.unrealizedPct != null ? ` • ${pct(breakdown.unrealizedPct)}` : ""
                          }`
                        : "—"
                    }
                  />
                </div>
              </GlassPane>

              <GlassPane size="card">
                <PaneHeader
                  title="Next Moves"
                  subcopy="Fast paths back into the rest of the investments workflow."
                />

                <div style={{ display: "grid", gap: 8 }}>
                  <ActionLink href="/investments">
                    Back to Investments <ArrowRight size={14} />
                  </ActionLink>
                  <ActionLink href="/investments/discover">
                    Discover Assets <ArrowRight size={14} />
                  </ActionLink>
                  <ActionLink href={`/market/${encodeURIComponent(asset.symbol || "")}`}>
                    Open Market View <ArrowRight size={14} />
                  </ActionLink>
                </div>
              </GlassPane>
            </div>
          </section>
        </div>
      </main>

      <style jsx global>{`
        .assetRoot {
          position: relative;
          z-index: 1;
          padding: 18px 0 28px;
          font-family: ${FONT_STACK};
        }

        .assetInner {
          width: min(100%, 1320px);
          margin: 0 auto;
          display: grid;
          gap: 14px;
        }

        .assetHeroGrid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 14px;
        }

        .assetMetrics {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          align-items: stretch;
        }

        .assetMain {
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.85fr);
          gap: 14px;
          align-items: start;
        }

        .assetLeftCol,
        .assetRightCol {
          display: grid;
          gap: 14px;
          min-width: 0;
        }

        @media (max-width: 1260px) {
          .assetMetrics {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .assetMain {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 860px) {
          .assetRoot {
            padding: 10px 0 22px;
          }

          .assetInner {
            gap: 12px;
          }

          .assetHeroGrid {
            grid-template-columns: 1fr;
          }

          .assetMetrics {
            grid-template-columns: 1fr;
            gap: 10px;
          }
        }
      `}</style>
    </>
  );
}

function MiniMetric({ title, value }) {
  return (
    <div
      style={{
        minHeight: 78,
        borderRadius: 16,
        border: "1px solid rgba(214,226,255,0.10)",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.032), rgba(255,255,255,0.01))",
        padding: 13,
      }}
    >
      <div style={overlineStyle()}>{title}</div>
      <div
        style={{
          marginTop: 7,
          fontSize: 18,
          fontWeight: 850,
          letterSpacing: "-0.04em",
          color: "#fff",
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function SnapshotRow({ label, value }) {
  return (
    <div
      style={{
        minHeight: 56,
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        gap: 10,
        alignItems: "center",
        padding: "10px 12px",
        borderRadius: 16,
        border: "1px solid rgba(214,226,255,0.10)",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
      }}
    >
      <div style={{ ...overlineStyle(), color: "rgba(255,255,255,0.52)" }}>{label}</div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 800,
          color: "#fff",
          textAlign: "right",
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </div>
    </div>
  );
}
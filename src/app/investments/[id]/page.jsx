"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import InvestmentChart from "@/components/ui/InvestmentChart";

const RANGE_OPTIONS = ["1D", "5D", "1M", "3M", "6M", "1Y", "ALL"];

const INTERVALS_BY_RANGE = {
  "1D": ["1m", "5m", "15m", "30m", "1h"],
  "5D": ["5m", "15m", "30m", "1h"],
  "1M": ["1h", "1D"],
  "3M": ["1D"],
  "6M": ["1D"],
  "1Y": ["1D"],
  "ALL": ["1D"],
};

function money(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, { style: "currency", currency: "USD" });
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

function toNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toMarkerTime(value) {
  if (!value) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    const ts = Date.parse(trimmed);
    if (!Number.isNaN(ts)) {
      return Math.floor(ts / 1000);
    }
  }

  if (value instanceof Date) {
    return Math.floor(value.getTime() / 1000);
  }

  if (typeof value === "number") return value;

  return null;
}

function timeToSortable(time) {
  if (typeof time === "string") {
    const parsed = Date.parse(time);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return Number(time) || 0;
}

export default function InvestmentAssetDetailPage({ params }) {
  const assetId = params?.id;

  const [asset, setAsset] = useState(null);
  const [txns, setTxns] = useState([]);
  const [price, setPrice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [chartRange, setChartRange] = useState("1D");
  const [chartInterval, setChartInterval] = useState("5m");
  const [chartMode, setChartMode] = useState("candles");
  const [chartData, setChartData] = useState([]);
  const [chartVolume, setChartVolume] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState("");
  const [chartNotice, setChartNotice] = useState("");

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
        setError("Asset not found.");
        setLoading(false);
        return;
      }

      const { data: txnRows, error: txnError } = await supabase
        .from("investment_transactions")
        .select("*")
        .eq("asset_id", assetId)
        .eq("user_id", user.id)
        .order("txn_date", { ascending: false });

      if (txnError) {
        console.error(txnError);
        setError("Failed loading asset transactions.");
        setLoading(false);
        return;
      }

      setAsset(assetRow);
      setTxns(txnRows || []);

      if (assetRow.symbol) {
        try {
          const res = await fetch(`/api/prices?symbol=${encodeURIComponent(assetRow.symbol)}`);
          const data = await res.json();

          if (res.ok && Number.isFinite(Number(data?.price)) && Number(data.price) > 0) {
            setPrice(Number(data.price));
          } else {
            setPrice(null);
          }
        } catch (err) {
          console.error("price fetch failed", err);
          setPrice(null);
        }
      }

      setLoading(false);
    }

    load();
  }, [assetId]);

  useEffect(() => {
    const allowed = INTERVALS_BY_RANGE[chartRange] || ["1D"];
    if (!allowed.includes(chartInterval)) {
      setChartInterval(allowed[0]);
    }
  }, [chartRange, chartInterval]);

  useEffect(() => {
    async function loadChart() {
      if (!asset?.symbol) {
        setChartData([]);
        setChartVolume([]);
        setChartError("");
        setChartNotice("");
        return;
      }

      setChartLoading(true);
      setChartError("");
      setChartNotice("");

      try {
        const res = await fetch(
          `/api/investment-chart?symbol=${encodeURIComponent(asset.symbol)}&range=${encodeURIComponent(
            chartRange
          )}&interval=${encodeURIComponent(chartInterval)}`
        );

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error || "Failed to load chart.");
        }

        setChartData(Array.isArray(data?.candles) ? data.candles : []);
        setChartVolume(Array.isArray(data?.volume) ? data.volume : []);
        setChartNotice(data?.notice || "");
      } catch (err) {
        console.error(err);
        setChartData([]);
        setChartVolume([]);
        setChartError(err?.message || "Failed to load chart.");
      } finally {
        setChartLoading(false);
      }
    }

    loadChart();
  }, [asset?.symbol, chartRange, chartInterval]);

  const position = useMemo(() => {
    let shares = 0;
    let activeCost = 0;
    let realizedPnl = 0;

    const ordered = [...txns].sort((a, b) => {
      const at = Date.parse(String(a.txn_date || "")) || 0;
      const bt = Date.parse(String(b.txn_date || "")) || 0;
      return at - bt;
    });

    for (const t of ordered) {
      const qty = Number(t.qty) || 0;
      const px = Number(t.price) || 0;
      const txnType = String(t.txn_type || "").toUpperCase();

      if (txnType === "BUY") {
        shares += qty;
        activeCost += qty * px;
      }

      if (txnType === "SELL") {
        const avgBeforeSell = shares > 0 ? activeCost / shares : 0;
        realizedPnl += qty * (px - avgBeforeSell);
        shares -= qty;
        activeCost -= qty * avgBeforeSell;

        if (shares < 0) shares = 0;
        if (activeCost < 0) activeCost = 0;
      }
    }

    const avgCost = shares > 0 ? activeCost / shares : 0;
    const hasLivePrice = Number.isFinite(price) && price > 0;
    const marketValue = hasLivePrice ? shares * price : null;
    const pnl = hasLivePrice ? marketValue - activeCost : null;
    const pnlPct =
      hasLivePrice && activeCost > 0 ? ((marketValue - activeCost) / activeCost) * 100 : null;

    return {
      shares,
      cost: activeCost,
      avgCost,
      realizedPnl,
      hasLivePrice,
      marketValue,
      pnl,
      pnlPct,
    };
  }, [txns, price]);

  const lineData = useMemo(() => {
    return Array.isArray(chartData)
      ? chartData.map((c) => ({
          time: c.time,
          value: c.close,
        }))
      : [];
  }, [chartData]);

  const chartStats = useMemo(() => {
    if (!Array.isArray(chartData) || chartData.length === 0) {
      return {
        open: null,
        high: null,
        low: null,
        close: null,
        volume: null,
        change: null,
        changePct: null,
      };
    }

    const first = chartData[0];
    const last = chartData[chartData.length - 1];

    const highs = chartData.map((c) => Number(c.high)).filter(Number.isFinite);
    const lows = chartData.map((c) => Number(c.low)).filter(Number.isFinite);

    const open = Number(first?.open);
    const close = Number(last?.close);
    const high = highs.length ? Math.max(...highs) : null;
    const low = lows.length ? Math.min(...lows) : null;

    const volume =
      Array.isArray(chartVolume) && chartVolume.length
        ? chartVolume.reduce((sum, v) => sum + (Number(v?.value) || 0), 0)
        : Number(last?.volume);

    const change =
      Number.isFinite(open) && Number.isFinite(close) ? close - open : null;

    const changePct =
      Number.isFinite(open) && open !== 0 && Number.isFinite(close)
        ? ((close - open) / open) * 100
        : null;

    return {
      open: Number.isFinite(open) ? open : null,
      high: Number.isFinite(high) ? high : null,
      low: Number.isFinite(low) ? low : null,
      close: Number.isFinite(close) ? close : null,
      volume: Number.isFinite(volume) ? volume : null,
      change,
      changePct,
    };
  }, [chartData, chartVolume]);

  const tradeMarkers = useMemo(() => {
    if (!Array.isArray(txns) || txns.length === 0) return [];

    return [...txns]
      .map((t) => {
        const txnType = String(t.txn_type || "").toUpperCase();
        const qty = toNum(t.qty);
        const px = toNum(t.price);
        const txnDate = t.txn_date;
        const time = toMarkerTime(txnDate);

        if (!time) return null;
        if (txnType !== "BUY" && txnType !== "SELL") return null;

        const isBuy = txnType === "BUY";

        return {
          time,
          position: isBuy ? "belowBar" : "aboveBar",
          color: isBuy ? "#22c55e" : "#ef4444",
          shape: isBuy ? "arrowUp" : "arrowDown",
          text: `${isBuy ? "B" : "S"} ${qty !== null ? fmtNumber(qty) : ""}${px !== null ? ` @ ${money(px)}` : ""}`,
        };
      })
      .filter(Boolean)
      .sort((a, b) => timeToSortable(a.time) - timeToSortable(b.time));
  }, [txns]);

  const chartPriceLines = useMemo(() => {
    const lines = [];

    if (position.shares > 0 && Number.isFinite(position.avgCost) && position.avgCost > 0) {
      lines.push({
        price: position.avgCost,
        color: "rgba(96,165,250,.95)",
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: "Avg Cost",
      });
    }

    if (Number.isFinite(price) && price > 0) {
      lines.push({
        price,
        color: "rgba(255,255,255,.55)",
        lineWidth: 1,
        lineStyle: 0,
        axisLabelVisible: true,
        title: "Live",
      });
    }

    return lines;
  }, [position.avgCost, position.shares, price]);

  const buyCount = useMemo(
    () => txns.filter((t) => String(t.txn_type || "").toUpperCase() === "BUY").length,
    [txns]
  );

  const sellCount = useMemo(
    () => txns.filter((t) => String(t.txn_type || "").toUpperCase() === "SELL").length,
    [txns]
  );

  const allowedIntervals = INTERVALS_BY_RANGE[chartRange] || ["1D"];

  if (loading) {
    return (
      <main style={{ padding: "32px 24px 40px", maxWidth: "1440px", margin: "0 auto" }}>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontWeight: 900 }}>Loading asset...</div>
        </div>
      </main>
    );
  }

  if (error || !asset) {
    return (
      <main style={{ padding: "32px 24px 40px", maxWidth: "1440px", margin: "0 auto" }}>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontWeight: 900 }}>{error || "Asset not found."}</div>
          <div style={{ marginTop: 14 }}>
            <Link href="/investments" className="btn">
              Back to Investments
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        padding: "32px 24px 40px",
        maxWidth: "1440px",
        margin: "0 auto",
        overflowX: "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          gap: 16,
          alignItems: "end",
          marginBottom: 24,
        }}
      >
        <div style={{ minWidth: 0 }}>
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
            {asset.symbol}
          </h1>

          <div className="muted" style={{ marginTop: 10, fontSize: 15, maxWidth: 760 }}>
            Dedicated trader view for this holding. Intraday controls live here, not on the main portfolio dashboard.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Link href="/investments" className="btnGhost">
            Back to Portfolio
          </Link>
          <Link href="/investments/discover" className="btnGhost">
            Discover
          </Link>
        </div>
      </div>

      <div
        className="card"
        style={{
          padding: 18,
          marginBottom: 18,
          borderRadius: 24,
          border: "1px solid rgba(255,255,255,.08)",
          background: "linear-gradient(180deg, rgba(59,130,246,.12), rgba(255,255,255,.02))",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 340px",
            gap: 18,
            alignItems: "start",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "flex-start",
                flexWrap: "wrap",
                marginBottom: 12,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 950, fontSize: 24 }}>{asset.symbol}</div>
                <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
                  {asset.account || "Main"} • {asset.asset_type || "stock"} • {txns.length} trade{txns.length === 1 ? "" : "s"}
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "nowrap",
                overflowX: "auto",
                paddingBottom: 8,
                marginBottom: 12,
                scrollbarWidth: "thin",
              }}
            >
              <button
                className={chartMode === "candles" ? "btn" : "btnGhost"}
                onClick={() => setChartMode("candles")}
                style={{ minWidth: 96, flex: "0 0 auto" }}
              >
                Candles
              </button>

              <button
                className={chartMode === "line" ? "btn" : "btnGhost"}
                onClick={() => setChartMode("line")}
                style={{ minWidth: 82, flex: "0 0 auto" }}
              >
                Line
              </button>

              <div
                style={{
                  width: 1,
                  alignSelf: "stretch",
                  background: "rgba(255,255,255,.08)",
                  margin: "0 2px",
                  flex: "0 0 auto",
                }}
              />

              {RANGE_OPTIONS.map((r) => (
                <button
                  key={r}
                  className={chartRange === r ? "btn" : "btnGhost"}
                  onClick={() => setChartRange(r)}
                  style={{ minWidth: 64, flex: "0 0 auto" }}
                >
                  {r}
                </button>
              ))}

              <div
                style={{
                  width: 1,
                  alignSelf: "stretch",
                  background: "rgba(255,255,255,.08)",
                  margin: "0 2px",
                  flex: "0 0 auto",
                }}
              />

              {allowedIntervals.map((i) => (
                <button
                  key={i}
                  className={chartInterval === i ? "btn" : "btnGhost"}
                  onClick={() => setChartInterval(i)}
                  style={{ minWidth: 64, flex: "0 0 auto" }}
                >
                  {i}
                </button>
              ))}
            </div>

            {chartNotice && (
              <div
                className="card"
                style={{
                  padding: 12,
                  marginBottom: 12,
                  borderRadius: 14,
                  background: "rgba(250,204,21,.08)",
                  border: "1px solid rgba(250,204,21,.18)",
                }}
              >
                <div style={{ fontWeight: 900 }}>Chart fallback active</div>
                <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
                  {chartNotice}
                </div>
              </div>
            )}

            <div
              className="card"
              style={{
                padding: 10,
                borderRadius: 22,
                background: "rgba(255,255,255,.03)",
                border: "1px solid rgba(255,255,255,.06)",
                minHeight: 650,
                display: "grid",
                gridTemplateRows: "1fr auto",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  borderRadius: 18,
                  overflow: "hidden",
                  minHeight: 560,
                  background: "rgba(7,10,18,.82)",
                  border: "1px solid rgba(255,255,255,.04)",
                }}
              >
                {chartLoading ? (
                  <div className="muted" style={{ padding: 16 }}>Loading chart...</div>
                ) : chartError ? (
                  <div style={{ padding: 16 }}>
                    <div style={{ fontWeight: 900 }}>Chart error</div>
                    <div className="muted" style={{ marginTop: 6 }}>{chartError}</div>
                  </div>
                ) : chartMode === "candles" && chartData.length >= 2 ? (
                  <InvestmentChart
                    data={chartData}
                    volumeData={chartVolume}
                    mode="candles"
                    height={590}
                    markers={tradeMarkers}
                    priceLines={chartPriceLines}
                  />
                ) : chartMode === "line" && lineData.length >= 2 ? (
                  <InvestmentChart
                    data={lineData}
                    volumeData={[]}
                    mode="line"
                    height={590}
                    markers={tradeMarkers}
                    priceLines={chartPriceLines}
                  />
                ) : (
                  <div style={{ padding: 16 }}>
                    <div style={{ fontWeight: 900 }}>Not enough historical data</div>
                    <div className="muted" style={{ marginTop: 6 }}>
                      This page is ready for minute and higher timeframes, but the chart route must return data for the selected range and interval.
                    </div>
                  </div>
                )}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: 10,
                  marginTop: 10,
                }}
              >
                <ChartMiniStat label="Open" value={money(chartStats.open)} />
                <ChartMiniStat label="High" value={money(chartStats.high)} />
                <ChartMiniStat label="Low" value={money(chartStats.low)} />
                <ChartMiniStat label="Close" value={money(chartStats.close)} />
                <ChartMiniStat
                  label="Change"
                  value={
                    chartStats.change !== null
                      ? `${money(chartStats.change)} • ${pct(chartStats.changePct)}`
                      : "—"
                  }
                  tone={
                    chartStats.change !== null
                      ? chartStats.change >= 0
                        ? "good"
                        : "bad"
                      : "default"
                  }
                />
                <ChartMiniStat
                  label="Volume"
                  value={
                    Number.isFinite(chartStats.volume)
                      ? Number(chartStats.volume).toLocaleString()
                      : "—"
                  }
                />
              </div>
            </div>
          </div>

          <div style={{ width: "100%", minWidth: 0, display: "grid", gap: 12 }}>
            <MetricCard
              title="Live Price"
              value={position.hasLivePrice ? money(price) : "Unavailable"}
              sub="Latest quote returned by your pricing route."
            />

            <MetricCard
              title="Position Value"
              value={position.hasLivePrice ? money(position.marketValue) : "Pending"}
              sub="Current holding value from shares × live price."
            />

            <MetricCard
              title="Unrealized P/L"
              value={position.hasLivePrice ? money(position.pnl) : "Pending"}
              sub={
                position.hasLivePrice && Number.isFinite(position.pnlPct)
                  ? `${position.pnl >= 0 ? "+" : ""}${position.pnlPct.toFixed(2)}% vs cost basis`
                  : "P/L updates when live price is available."
              }
              valueTone={
                position.hasLivePrice
                  ? position.pnl >= 0
                    ? "good"
                    : "bad"
                  : "default"
              }
            />

            <MetricCard
              title="Realized P/L"
              value={money(position.realizedPnl)}
              sub="Profit or loss already locked in from sell transactions."
              valueTone={
                Number.isFinite(position.realizedPnl)
                  ? position.realizedPnl >= 0
                    ? "good"
                    : "bad"
                  : "default"
              }
            />

            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 12 }}>Position Detail</div>

              <div style={{ display: "grid", gap: 10 }}>
                <InfoRow label="Shares Owned" value={fmtNumber(position.shares)} />
                <InfoRow label="Cost Basis" value={money(position.cost)} />
                <InfoRow
                  label="Average Cost"
                  value={position.shares > 0 ? money(position.avgCost) : "—"}
                />
                <InfoRow
                  label="Live Price"
                  value={position.hasLivePrice ? money(price) : "Unavailable"}
                />
                <InfoRow
                  label="Position Value"
                  value={position.hasLivePrice ? money(position.marketValue) : "Pending"}
                />
                <InfoRow
                  label="Unrealized P/L"
                  value={position.hasLivePrice ? money(position.pnl) : "Pending"}
                  tone={
                    position.hasLivePrice
                      ? position.pnl >= 0
                        ? "good"
                        : "bad"
                      : "default"
                  }
                />
                <InfoRow
                  label="Realized P/L"
                  value={money(position.realizedPnl)}
                  tone={
                    Number.isFinite(position.realizedPnl)
                      ? position.realizedPnl >= 0
                        ? "good"
                        : "bad"
                      : "default"
                  }
                />
              </div>
            </div>

            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 12 }}>Trade Overlay</div>
              <div style={{ display: "grid", gap: 10 }}>
                <InfoRow label="Buy Markers" value={String(buyCount)} />
                <InfoRow label="Sell Markers" value={String(sellCount)} />
                <InfoRow
                  label="Avg Cost Line"
                  value={position.shares > 0 ? money(position.avgCost) : "—"}
                />
              </div>
            </div>

            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 12 }}>Coming Soon • Buy / Sell</div>
              <div className="muted" style={{ fontSize: 13, lineHeight: 1.55, marginBottom: 14 }}>
                This area is reserved for future order entry. Later you will be able to place a buy or sale, review quantity, estimated cost, and confirm before saving the trade.
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 10,
                }}
              >
                <DisabledActionCard
                  title="Buy Order"
                  sub="Coming soon"
                  tone="good"
                />
                <DisabledActionCard
                  title="Sell Order"
                  sub="Coming soon"
                  tone="bad"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.15fr) minmax(300px, 0.95fr)",
          gap: 18,
        }}
      >
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontWeight: 950, fontSize: 20 }}>Transaction History</div>
          <div className="muted" style={{ marginTop: 8, fontSize: 14 }}>
            Full trade history for this holding.
          </div>

          <div style={{ height: 16 }} />

          {txns.length ? (
            <div style={{ display: "grid", gap: 10 }}>
              {txns.map((t) => {
                const txnType = String(t.txn_type || "").toUpperCase();
                const isBuy = txnType === "BUY";

                return (
                  <div
                    key={t.id}
                    style={{
                      border: `1px solid ${
                        isBuy
                          ? "rgba(34,197,94,.16)"
                          : txnType === "SELL"
                            ? "rgba(239,68,68,.16)"
                            : "rgba(255,255,255,.08)"
                      }`,
                      background: isBuy
                        ? "linear-gradient(180deg, rgba(34,197,94,.08), rgba(255,255,255,.03))"
                        : txnType === "SELL"
                          ? "linear-gradient(180deg, rgba(239,68,68,.08), rgba(255,255,255,.03))"
                          : "rgba(255,255,255,.03)",
                      borderRadius: 16,
                      padding: 14,
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr 1fr",
                        gap: 12,
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div className="muted" style={{ fontSize: 12 }}>Type</div>
                        <div
                          style={{
                            marginTop: 4,
                            fontWeight: 900,
                            color: isBuy
                              ? "#4ade80"
                              : txnType === "SELL"
                                ? "#f87171"
                                : "rgba(255,255,255,.92)",
                          }}
                        >
                          {t.txn_type}
                        </div>
                      </div>

                      <div>
                        <div className="muted" style={{ fontSize: 12 }}>Qty</div>
                        <div style={{ marginTop: 4, fontWeight: 900 }}>{fmtNumber(t.qty)}</div>
                      </div>

                      <div>
                        <div className="muted" style={{ fontSize: 12 }}>Price</div>
                        <div style={{ marginTop: 4, fontWeight: 900 }}>{money(t.price)}</div>
                      </div>

                      <div>
                        <div className="muted" style={{ fontSize: 12 }}>Date</div>
                        <div style={{ marginTop: 4, fontWeight: 900 }}>{t.txn_date}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="No transactions yet"
              sub="This holding exists, but no trades are recorded yet."
            />
          )}
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontWeight: 950, fontSize: 20 }}>Next Upgrade Stack</div>
          <div className="muted" style={{ marginTop: 8, lineHeight: 1.5 }}>
            This screen is now set up for true trader-style expansion.
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
            <MiniPoint title="Entry / exit markers" sub="Buys and sells now plot directly on the chart." />
            <MiniPoint title="Average cost line" sub="See your average entry price against current market action." />
            <MiniPoint title="OHLC hover stats" sub="Next step is live hover values under the crosshair." />
            <MiniPoint title="Trading terminal" sub="Buy and sell controls are staged with a coming soon section." />
          </div>
        </div>
      </div>
    </main>
  );
}

function MetricCard({ title, value, sub, valueTone = "default" }) {
  const toneColor =
    valueTone === "good"
      ? "#4ade80"
      : valueTone === "bad"
      ? "#f87171"
      : "inherit";

  return (
    <div className="card" style={{ padding: 18 }}>
      <div
        className="muted"
        style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em" }}
      >
        {title}
      </div>
      <div style={{ marginTop: 10, fontSize: 22, fontWeight: 950, color: toneColor }}>
        {value}
      </div>
      <div className="muted" style={{ marginTop: 10, fontSize: 13, lineHeight: 1.45 }}>
        {sub}
      </div>
    </div>
  );
}

function ChartMiniStat({ label, value, tone = "default" }) {
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
        border: "1px solid rgba(255,255,255,.08)",
        background: "rgba(255,255,255,.03)",
        padding: 12,
      }}
    >
      <div
        className="muted"
        style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em" }}
      >
        {label}
      </div>
      <div style={{ marginTop: 8, fontWeight: 900, color }}>
        {value}
      </div>
    </div>
  );
}

function DisabledActionCard({ title, sub, tone = "default" }) {
  const border =
    tone === "good"
      ? "1px solid rgba(34,197,94,.16)"
      : tone === "bad"
        ? "1px solid rgba(239,68,68,.16)"
        : "1px solid rgba(255,255,255,.08)";

  const background =
    tone === "good"
      ? "linear-gradient(180deg, rgba(34,197,94,.08), rgba(255,255,255,.03))"
      : tone === "bad"
        ? "linear-gradient(180deg, rgba(239,68,68,.08), rgba(255,255,255,.03))"
        : "rgba(255,255,255,.03)";

  return (
    <div
      style={{
        border,
        background,
        borderRadius: 16,
        padding: 14,
        opacity: 0.9,
      }}
    >
      <div style={{ fontWeight: 900 }}>{title}</div>
      <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
        {sub}
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

function InfoRow({ label, value, tone = "default" }) {
  const color =
    tone === "good"
      ? "#4ade80"
      : tone === "bad"
        ? "#f87171"
        : "rgba(255,255,255,.92)";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 10,
        alignItems: "center",
        paddingBottom: 8,
        borderBottom: "1px solid rgba(255,255,255,.06)",
      }}
    >
      <div className="muted" style={{ fontSize: 13 }}>{label}</div>
      <div style={{ fontWeight: 900, color }}>{value}</div>
    </div>
  );
}
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import InvestmentChart from "@/components/ui/InvestmentChart";

const RANGE_OPTIONS = ["1D", "5D", "1M", "3M", "6M", "1Y", "ALL"];
const MODE_OPTIONS = [
  { key: "line", label: "Line" },
  { key: "candles", label: "Candles" },
];

function money(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function pct(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  const sign = num > 0 ? "+" : "";
  return `${sign}${num.toFixed(2)}%`;
}

function signedMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  const sign = num > 0 ? "+" : "";
  return `${sign}${money(num)}`;
}

function compactNumber(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(num);
}

function toneClass(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "text-white";
  if (num > 0) return "text-emerald-300";
  if (num < 0) return "text-red-300";
  return "text-white";
}

function rangeText(low, high, formatter = money) {
  const lowNum = Number(low);
  const highNum = Number(high);
  if (!Number.isFinite(lowNum) || !Number.isFinite(highNum)) return "—";
  return `${formatter(lowNum)} - ${formatter(highNum)}`;
}

function glowStyleByValue(value, strong = false) {
  const num = Number(value);

  if (!Number.isFinite(num) || num === 0) {
    return {
      border: "1px solid rgba(255,255,255,.08)",
      background:
        "linear-gradient(180deg, rgba(255,255,255,.05) 0%, rgba(255,255,255,.025) 100%)",
      boxShadow: strong
        ? "0 0 0 1px rgba(255,255,255,.04), 0 12px 34px rgba(0,0,0,.28)"
        : "0 10px 24px rgba(0,0,0,.22)",
    };
  }

  if (num > 0) {
    return {
      border: "1px solid rgba(34,197,94,.24)",
      background:
        "linear-gradient(180deg, rgba(34,197,94,.18) 0%, rgba(34,197,94,.05) 100%)",
      boxShadow: strong
        ? "0 0 0 1px rgba(34,197,94,.14), 0 0 30px rgba(34,197,94,.18), 0 16px 40px rgba(0,0,0,.34)"
        : "0 0 22px rgba(34,197,94,.12), 0 12px 28px rgba(0,0,0,.24)",
    };
  }

  return {
    border: "1px solid rgba(239,68,68,.24)",
    background:
      "linear-gradient(180deg, rgba(239,68,68,.18) 0%, rgba(239,68,68,.05) 100%)",
    boxShadow: strong
      ? "0 0 0 1px rgba(239,68,68,.14), 0 0 30px rgba(239,68,68,.18), 0 16px 40px rgba(0,0,0,.34)"
      : "0 0 22px rgba(239,68,68,.12), 0 12px 28px rgba(0,0,0,.24)",
  };
}

function activeButtonStyle(type = "blue") {
  if (type === "green") {
    return {
      boxShadow:
        "0 0 18px rgba(34,197,94,.22), inset 0 0 0 1px rgba(34,197,94,.18)",
      borderColor: "rgba(34,197,94,.28)",
    };
  }

  if (type === "red") {
    return {
      boxShadow:
        "0 0 18px rgba(239,68,68,.22), inset 0 0 0 1px rgba(239,68,68,.18)",
      borderColor: "rgba(239,68,68,.28)",
    };
  }

  return {
    boxShadow:
      "0 0 18px rgba(96,165,250,.22), inset 0 0 0 1px rgba(96,165,250,.18)",
    borderColor: "rgba(96,165,250,.28)",
  };
}

export default function MarketSymbolPage({ params }) {
  const symbol = decodeURIComponent(params?.symbol || "").toUpperCase().trim();

  const [asset, setAsset] = useState(null);
  const [quote, setQuote] = useState({
    price: null,
    change: null,
    changesPercentage: null,
    open: null,
    previousClose: null,
    dayLow: null,
    dayHigh: null,
    yearLow: null,
    yearHigh: null,
    volume: null,
    avgVolume: null,
    marketCap: null,
    exchange: null,
    name: null,
  });

  const [isFavorite, setIsFavorite] = useState(false);
  const [isOwned, setIsOwned] = useState(false);

  const [range, setRange] = useState("1M");
  const [mode, setMode] = useState("line");

  const [chartLine, setChartLine] = useState([]);
  const [chartCandles, setChartCandles] = useState([]);
  const [chartVolume, setChartVolume] = useState([]);
  const [chartNotice, setChartNotice] = useState("");
  const [chartMeta, setChartMeta] = useState({ interval: "", source: "" });

  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      setStatus("");

      if (!symbol) {
        setError("Missing market symbol.");
        setLoading(false);
        return;
      }

      try {
        const { data: authData } = await supabase.auth.getUser();
        const user = authData?.user || null;

        const searchRes = await fetch(
          `/api/market-search?query=${encodeURIComponent(symbol)}&type=ALL&limit=12`
        );
        const searchData = await searchRes.json();

        if (!searchRes.ok) {
          throw new Error(searchData?.error || "Failed to load market symbol.");
        }

        const rows = Array.isArray(searchData?.results) ? searchData.results : [];
        const exact =
          rows.find((x) => String(x.symbol || "").toUpperCase() === symbol) ||
          rows[0] ||
          {
            symbol,
            name: symbol,
            type: "Stock",
            exchange: "—",
            currency: "USD",
          };

        setAsset(exact);

        try {
          const priceRes = await fetch(`/api/prices?symbol=${encodeURIComponent(symbol)}`);
          const priceData = await priceRes.json();

          if (priceRes.ok && Number.isFinite(Number(priceData?.price))) {
            setQuote({
              price: Number.isFinite(Number(priceData?.price)) ? Number(priceData.price) : null,
              change: Number.isFinite(Number(priceData?.change)) ? Number(priceData.change) : null,
              changesPercentage: Number.isFinite(Number(priceData?.changesPercentage))
                ? Number(priceData.changesPercentage)
                : null,
              open: Number.isFinite(Number(priceData?.open)) ? Number(priceData.open) : null,
              previousClose: Number.isFinite(Number(priceData?.previousClose))
                ? Number(priceData.previousClose)
                : null,
              dayLow: Number.isFinite(Number(priceData?.dayLow)) ? Number(priceData.dayLow) : null,
              dayHigh: Number.isFinite(Number(priceData?.dayHigh)) ? Number(priceData.dayHigh) : null,
              yearLow: Number.isFinite(Number(priceData?.yearLow)) ? Number(priceData.yearLow) : null,
              yearHigh: Number.isFinite(Number(priceData?.yearHigh)) ? Number(priceData.yearHigh) : null,
              volume: Number.isFinite(Number(priceData?.volume)) ? Number(priceData.volume) : null,
              avgVolume: Number.isFinite(Number(priceData?.avgVolume))
                ? Number(priceData.avgVolume)
                : null,
              marketCap: Number.isFinite(Number(priceData?.marketCap))
                ? Number(priceData.marketCap)
                : null,
              exchange: priceData?.exchange || null,
              name: priceData?.name || null,
            });
          } else {
            setQuote({
              price: null,
              change: null,
              changesPercentage: null,
              open: null,
              previousClose: null,
              dayLow: null,
              dayHigh: null,
              yearLow: null,
              yearHigh: null,
              volume: null,
              avgVolume: null,
              marketCap: null,
              exchange: null,
              name: null,
            });
          }
        } catch (err) {
          console.error("price fetch failed", err);
          setQuote({
            price: null,
            change: null,
            changesPercentage: null,
            open: null,
            previousClose: null,
            dayLow: null,
            dayHigh: null,
            yearLow: null,
            yearHigh: null,
            volume: null,
            avgVolume: null,
            marketCap: null,
            exchange: null,
            name: null,
          });
        }

        if (user) {
          const [
            { data: favoriteRows, error: favoriteError },
            { data: assetRows, error: assetError },
          ] = await Promise.all([
            supabase
              .from("investment_favorites")
              .select("id,symbol")
              .eq("user_id", user.id)
              .eq("symbol", symbol),
            supabase
              .from("investment_assets")
              .select("id,symbol")
              .eq("user_id", user.id)
              .eq("symbol", symbol),
          ]);

          if (favoriteError) console.error(favoriteError);
          if (assetError) console.error(assetError);

          setIsFavorite(Array.isArray(favoriteRows) && favoriteRows.length > 0);
          setIsOwned(Array.isArray(assetRows) && assetRows.length > 0);
        } else {
          setIsFavorite(false);
          setIsOwned(false);
        }
      } catch (err) {
        console.error(err);
        setError(err?.message || "Failed to load market symbol.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [symbol]);

  useEffect(() => {
    async function loadChart() {
      if (!symbol) return;

      setChartLoading(true);
      setChartNotice("");

      try {
        const res = await fetch(
          `/api/investment-chart?symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(range)}`
        );
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error || "Failed to load chart.");
        }

        setChartLine(Array.isArray(data?.line) ? data.line : []);
        setChartCandles(Array.isArray(data?.candles) ? data.candles : []);
        setChartVolume(Array.isArray(data?.volume) ? data.volume : []);
        setChartNotice(data?.notice || "");
        setChartMeta({
          interval: data?.interval || "",
          source: data?.source || "",
        });
      } catch (err) {
        console.error(err);
        setChartLine([]);
        setChartCandles([]);
        setChartVolume([]);
        setChartNotice(err?.message || "Failed to load chart.");
      } finally {
        setChartLoading(false);
      }
    }

    loadChart();
  }, [symbol, range]);

  const assetTypeLabel = useMemo(() => {
    const raw = String(asset?.type || "").toUpperCase();
    if (raw.includes("ETF")) return "ETF";
    if (raw.includes("FUND")) return "Fund";
    if (raw.includes("CRYPTO")) return "Crypto";
    return raw || "Stock";
  }, [asset]);

  const chartData = mode === "candles" ? chartCandles : chartLine;
  const changeTone = toneClass(quote.change);
  const moveType =
    Number.isFinite(Number(quote.change)) && Number(quote.change) !== 0
      ? Number(quote.change) > 0
        ? "green"
        : "red"
      : "blue";

  async function toggleFavorite() {
    setWorking(true);
    setError("");
    setStatus("");

    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user || null;

      if (!user) {
        setError("You must be logged in.");
        setWorking(false);
        return;
      }

      if (isFavorite) {
        const { error } = await supabase
          .from("investment_favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("symbol", symbol);

        if (error) throw error;

        setIsFavorite(false);
        setStatus(`${symbol} removed from favorites.`);
      } else {
        const { error } = await supabase
          .from("investment_favorites")
          .insert({
            user_id: user.id,
            symbol,
            name: asset?.name || quote?.name || symbol,
            asset_type: assetTypeLabel.toLowerCase(),
          });

        if (error) throw error;

        setIsFavorite(true);
        setStatus(`${symbol} added to favorites.`);
      }
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to update favorite.");
    } finally {
      setWorking(false);
    }
  }

  async function addToPortfolio() {
    setWorking(true);
    setError("");
    setStatus("");

    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user || null;

      if (!user) {
        setError("You must be logged in.");
        setWorking(false);
        return;
      }

      if (isOwned) {
        setStatus(`${symbol} is already in your portfolio.`);
        setWorking(false);
        return;
      }

      const { error } = await supabase.from("investment_assets").insert({
        user_id: user.id,
        symbol,
        asset_type: assetTypeLabel.toLowerCase() === "etf" ? "etf" : "stock",
        account: "Main",
      });

      if (error) throw error;

      setIsOwned(true);
      setStatus(`${symbol} added to portfolio.`);
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to add asset.");
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <main style={{ padding: "36px 28px 44px", maxWidth: "1280px", margin: "0 auto" }}>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontWeight: 900 }}>Loading market symbol...</div>
        </div>
      </main>
    );
  }

  if (error && !asset) {
    return (
      <main style={{ padding: "36px 28px 44px", maxWidth: "1280px", margin: "0 auto" }}>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontWeight: 900 }}>{error}</div>
          <div style={{ marginTop: 14 }}>
            <Link href="/investments/discover" className="btn">
              Back to Discover
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={{ padding: "36px 28px 44px", maxWidth: "1280px", margin: "0 auto" }}>
      {(status || error) && (
        <div className="card" style={{ padding: 14, marginBottom: 18 }}>
          <div style={{ fontWeight: 900 }}>{error ? "Fix this" : "Status"}</div>
          <div className="muted" style={{ marginTop: 6 }}>{error || status}</div>
        </div>
      )}

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
            <div
              className="muted"
              style={{
                fontSize: 12,
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "0.16em",
              }}
            >
              Market Asset
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                alignItems: "flex-start",
                marginTop: 10,
                flexWrap: "wrap",
              }}
            >
              <div>
                <h1
                  style={{
                    margin: "0",
                    fontSize: "clamp(2rem, 4vw, 3rem)",
                    lineHeight: 1.04,
                    fontWeight: 950,
                  }}
                >
                  {symbol}
                </h1>

                <div style={{ marginTop: 10, fontWeight: 850, fontSize: 18 }}>
                  {asset?.name || quote?.name || symbol}
                </div>

                <div className="muted" style={{ marginTop: 10, fontSize: 14 }}>
                  {assetTypeLabel} • {asset?.exchange || quote?.exchange || "—"} • {asset?.currency || "USD"}
                </div>
              </div>

              <div
                style={{
                  minWidth: 250,
                  padding: 16,
                  borderRadius: 18,
                  ...glowStyleByValue(quote.change, true),
                }}
              >
                <div
                  className="muted"
                  style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em" }}
                >
                  Live Price
                </div>
                <div style={{ marginTop: 8, fontWeight: 950, fontSize: 34 }}>
                  {quote.price !== null ? money(quote.price) : "Unavailable"}
                </div>

                <div className={changeTone} style={{ marginTop: 8, fontWeight: 900, fontSize: 15 }}>
                  {quote.change !== null ? signedMoney(quote.change) : "—"}
                  {"  "}
                  {quote.changesPercentage !== null ? `(${pct(quote.changesPercentage)})` : ""}
                </div>
              </div>
            </div>

            <div style={{ height: 18 }} />

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {MODE_OPTIONS.map((option) => {
                  const active = mode === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setMode(option.key)}
                      className={active ? "btn" : "btnGhost"}
                      style={active ? activeButtonStyle(moveType) : {}}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {RANGE_OPTIONS.map((option) => {
                  const active = range === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setRange(option)}
                      className={active ? "btn" : "btnGhost"}
                      style={active ? activeButtonStyle("blue") : {}}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ height: 18 }} />

            <div
              style={{
                border: "1px solid rgba(255,255,255,.08)",
                borderRadius: 24,
                overflow: "hidden",
                background: "rgba(255,255,255,.02)",
                minHeight: 560,
              }}
            >
              {chartLoading ? (
                <div style={{ padding: 24, fontWeight: 900 }}>Loading chart...</div>
              ) : chartData.length > 0 ? (
                <InvestmentChart
                  data={chartData}
                  volumeData={mode === "candles" ? chartVolume : []}
                  mode={mode}
                  height={560}
                />
              ) : (
                <div style={{ padding: 24, fontWeight: 900 }}>No chart data available.</div>
              )}
            </div>

            {(chartNotice || chartMeta.interval || chartMeta.source) && (
              <div
                className="muted"
                style={{
                  marginTop: 12,
                  fontSize: 13,
                  lineHeight: 1.45,
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                {chartMeta.interval ? <span>Interval: {chartMeta.interval}</span> : null}
                {chartMeta.source ? <span>Source: {chartMeta.source}</span> : null}
                {chartNotice ? <span>{chartNotice}</span> : null}
              </div>
            )}

            <div style={{ height: 18 }} />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 12,
              }}
            >
              <GlowStatCard
                title="Day Change"
                value={quote.change !== null ? signedMoney(quote.change) : "—"}
                sub={quote.changesPercentage !== null ? pct(quote.changesPercentage) : "Daily move"}
                glowValue={quote.change}
                strong
              />
              <GlowStatCard
                title="Live Price"
                value={quote.price !== null ? money(quote.price) : "Unavailable"}
                sub="Real quote route"
                glowValue={quote.change}
              />
              <GlowStatCard
                title="Open / Prev Close"
                value={
                  quote.open !== null || quote.previousClose !== null
                    ? `${quote.open !== null ? money(quote.open) : "—"} / ${quote.previousClose !== null ? money(quote.previousClose) : "—"}`
                    : "—"
                }
                sub="Open / previous close"
                glowValue={quote.change}
              />
              <GlowStatCard
                title="Day Range"
                value={rangeText(quote.dayLow, quote.dayHigh)}
                sub="Intraday low / high"
                glowValue={quote.change}
              />
              <StatCard
                title="52W Range"
                value={rangeText(quote.yearLow, quote.yearHigh)}
                sub="Year low / high"
              />
              <StatCard
                title="Volume"
                value={quote.volume !== null ? compactNumber(quote.volume) : "—"}
                sub={
                  quote.avgVolume !== null
                    ? `Avg ${compactNumber(quote.avgVolume)}`
                    : "Average volume unavailable"
                }
              />
              <StatCard
                title="Market Cap"
                value={quote.marketCap !== null ? compactNumber(quote.marketCap) : "—"}
                sub="Company size"
              />
              <StatCard
                title="Asset Type"
                value={assetTypeLabel}
                sub={`${asset?.exchange || quote?.exchange || "—"} exchange`}
              />
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 18 }}>
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontWeight: 950, fontSize: 20 }}>Actions</div>

            <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
              <button
                className="btn"
                onClick={addToPortfolio}
                disabled={working || isOwned}
                style={{
                  opacity: working || isOwned ? 0.75 : 1,
                  ...(isOwned ? activeButtonStyle("green") : {}),
                }}
              >
                {isOwned ? "Already in Portfolio" : working ? "Working..." : "Add to Portfolio"}
              </button>

              <button
                className="btnGhost"
                onClick={toggleFavorite}
                disabled={working}
                style={{
                  opacity: working ? 0.75 : 1,
                  ...(isFavorite ? activeButtonStyle("blue") : {}),
                }}
              >
                {isFavorite ? "Remove Favorite" : "Add to Favorites"}
              </button>

              <Link href="/investments/discover" className="btnGhost">
                Back to Discover
              </Link>

              <Link href="/investments" className="btnGhost">
                Portfolio
              </Link>
            </div>
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontWeight: 950, fontSize: 20 }}>About this market page</div>
            <div className="muted" style={{ marginTop: 10, lineHeight: 1.5 }}>
              This page keeps the public-market identity but now visually matches the rest of LCC much better.
            </div>

            <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
              <MiniPoint title="Interactive feel" sub="Price and movement stats glow based on gain/loss." />
              <MiniPoint title="Real stats" sub="Uses real quote data for open, previous close, ranges, volume, and market cap." />
              <MiniPoint title="Correct split" sub="This page is public market view. Owned-position detail stays on the asset page." />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function StatCard({ title, value, sub }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div
        className="muted"
        style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em" }}
      >
        {title}
      </div>
      <div style={{ marginTop: 10, fontWeight: 950, fontSize: 22 }}>
        {value}
      </div>
      <div className="muted" style={{ marginTop: 10, fontSize: 13, lineHeight: 1.45 }}>
        {sub}
      </div>
    </div>
  );
}

function GlowStatCard({ title, value, sub, glowValue, strong = false }) {
  const glow = glowStyleByValue(glowValue, strong);

  return (
    <div
      style={{
        padding: 16,
        borderRadius: 18,
        ...glow,
      }}
    >
      <div
        className="muted"
        style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em" }}
      >
        {title}
      </div>
      <div style={{ marginTop: 10, fontWeight: 950, fontSize: 22 }}>
        {value}
      </div>
      <div className="muted" style={{ marginTop: 10, fontSize: 13, lineHeight: 1.45 }}>
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
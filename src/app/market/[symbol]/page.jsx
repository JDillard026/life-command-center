"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeDollarSign,
  ExternalLink,
  Newspaper,
  Plus,
  Star,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import InvestmentChart from "@/components/ui/InvestmentChart";
import GlassPane from "../../components/GlassPane";

export const dynamic = "force-dynamic";

const RANGE_OPTIONS = ["1D", "5D", "1M", "3M", "6M", "1Y", "ALL"];
const MODE_OPTIONS = [
  { key: "line", label: "Line" },
  { key: "candles", label: "Candles" },
];

const EMPTY_QUOTE = {
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
};

function toNum(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function signedMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
  if (n > 0) return `+${abs}`;
  if (n < 0) return `-${abs}`;
  return abs;
}

function pct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function compactNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(n);
}

function fullDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return String(value);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toneByValue(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return "neutral";
  return n > 0 ? "green" : "red";
}

function toneMeta(tone = "neutral") {
  if (tone === "green") {
    return {
      text: "#97efc7",
      border: "rgba(143,240,191,0.16)",
      glow: "rgba(110,229,173,0.10)",
      iconBg: "rgba(12,22,17,0.72)",
      softBg: "rgba(10,20,14,0.32)",
    };
  }

  if (tone === "red") {
    return {
      text: "#ffb4c5",
      border: "rgba(255,132,163,0.16)",
      glow: "rgba(255,108,145,0.10)",
      iconBg: "rgba(24,11,15,0.72)",
      softBg: "rgba(24,12,16,0.32)",
    };
  }

  if (tone === "amber") {
    return {
      text: "#f5cf88",
      border: "rgba(255,204,112,0.16)",
      glow: "rgba(255,194,92,0.10)",
      iconBg: "rgba(24,18,11,0.72)",
      softBg: "rgba(24,18,11,0.32)",
    };
  }

  return {
    text: "#f7fbff",
    border: "rgba(214,226,255,0.13)",
    glow: "rgba(140,170,255,0.08)",
    iconBg: "rgba(12,16,24,0.72)",
    softBg: "rgba(10,14,21,0.30)",
  };
}

function resolveAssetType(raw) {
  const value = String(raw || "").toUpperCase();
  if (value.includes("ETF")) return "ETF";
  if (value.includes("FUND")) return "Fund";
  if (value.includes("CRYPTO")) return "Crypto";
  return value || "Stock";
}

function overlineStyle() {
  return {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: ".18em",
    fontWeight: 800,
    color: "rgba(255,255,255,0.42)",
  };
}

function mutedStyle() {
  return {
    fontSize: 12.5,
    lineHeight: 1.5,
    color: "rgba(255,255,255,0.62)",
  };
}

function buttonStyle({ primary = false, danger = false, disabled = false } = {}) {
  return {
    minHeight: 40,
    padding: "0 12px",
    borderRadius: 14,
    border: danger
      ? "1px solid rgba(255,132,163,0.16)"
      : primary
        ? "1px solid rgba(255,255,255,0.18)"
        : "1px solid rgba(214,226,255,0.10)",
    background: disabled
      ? "rgba(255,255,255,0.04)"
      : danger
        ? "linear-gradient(180deg, rgba(255,132,163,0.08), rgba(255,132,163,0.03))"
        : primary
          ? "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(233,239,248,0.88))"
          : "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012))",
    color: disabled
      ? "rgba(255,255,255,0.42)"
      : danger
        ? "#ffd4df"
        : primary
          ? "#0b1220"
          : "#f7fbff",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    fontWeight: 800,
    fontSize: 13,
    cursor: disabled ? "not-allowed" : "pointer",
    textDecoration: "none",
  };
}

function MiniPill({ children, tone = "neutral" }) {
  const meta = toneMeta(tone);

  return (
    <div
      style={{
        minHeight: 30,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "0 11px",
        borderRadius: 999,
        border: `1px solid ${meta.border}`,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
        color: tone === "neutral" ? "rgba(255,255,255,0.88)" : meta.text,
        fontSize: 11,
        fontWeight: 800,
        whiteSpace: "nowrap",
        boxShadow: `0 0 10px ${meta.glow}`,
      }}
    >
      {children}
    </div>
  );
}

function ActionLink({ href, children }) {
  return (
    <Link href={href} style={buttonStyle()}>
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
            lineHeight: 1.05,
            fontWeight: 850,
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
          minHeight: 120,
          display: "grid",
          gridTemplateRows: "auto auto 1fr",
          gap: 8,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            display: "grid",
            placeItems: "center",
            border: `1px solid ${meta.border}`,
            background: meta.iconBg,
            color: tone === "neutral" ? "#fff" : meta.text,
          }}
        >
          <Icon size={16} />
        </div>

        <div>
          <div style={overlineStyle()}>{label}</div>
          <div
            style={{
              marginTop: 8,
              fontSize: "clamp(20px, 2.1vw, 30px)",
              lineHeight: 1,
              fontWeight: 900,
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

function SnapshotRow({ label, value }) {
  return (
    <div
      style={{
        minHeight: 54,
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

function EmptyBlock({ title, detail }) {
  return (
    <div
      style={{
        minHeight: 170,
        display: "grid",
        placeItems: "center",
        borderRadius: 20,
        border: "1px solid rgba(214,226,255,0.10)",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01))",
      }}
    >
      <div style={{ maxWidth: 360, padding: 18 }}>
        <div
          style={{
            fontSize: 17,
            fontWeight: 850,
            color: "#fff",
            textAlign: "center",
          }}
        >
          {title}
        </div>
        <div style={{ marginTop: 8, ...mutedStyle(), textAlign: "center" }}>{detail}</div>
      </div>
    </div>
  );
}

function HeadlineRow({ item }) {
  return (
    <a href={item.url || "#"} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
      <div
        style={{
          minHeight: 88,
          display: "grid",
          gridTemplateColumns: "38px minmax(0, 1fr) auto",
          gap: 12,
          alignItems: "start",
          padding: "12px 13px",
          borderRadius: 18,
          border: "1px solid rgba(214,226,255,0.10)",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            display: "grid",
            placeItems: "center",
            border: "1px solid rgba(214,226,255,0.10)",
            background: "rgba(10,14,21,0.46)",
            color: "#f7fbff",
          }}
        >
          <Newspaper size={15} />
        </div>

        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 800,
              color: "#fff",
              lineHeight: 1.35,
              overflowWrap: "anywhere",
            }}
          >
            {item.title || "Untitled headline"}
          </div>
          <div style={{ marginTop: 5, ...mutedStyle() }}>
            {item.text || item.site || "Market story"}
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 10.5,
              fontWeight: 800,
              color: "rgba(255,255,255,0.44)",
              textTransform: "uppercase",
              letterSpacing: ".14em",
            }}
          >
            {(item.site || "Source") + " • " + fullDateTime(item.publishedDate)}
          </div>
        </div>

        <div style={{ color: "rgba(255,255,255,0.50)" }}>
          <ExternalLink size={14} />
        </div>
      </div>
    </a>
  );
}

export default function MarketSymbolPage() {
  const params = useParams();
  const symbol = decodeURIComponent(String(params?.symbol || ""))
    .toUpperCase()
    .trim();

  const [asset, setAsset] = useState(null);
  const [quote, setQuote] = useState(EMPTY_QUOTE);
  const [quoteError, setQuoteError] = useState("");
  const [isFavorite, setIsFavorite] = useState(false);
  const [isOwned, setIsOwned] = useState(false);

  const [range, setRange] = useState("1M");
  const [mode, setMode] = useState("line");

  const [chartLine, setChartLine] = useState([]);
  const [chartCandles, setChartCandles] = useState([]);
  const [chartVolume, setChartVolume] = useState([]);
  const [chartNotice, setChartNotice] = useState("");
  const [chartMeta, setChartMeta] = useState({ interval: "", source: "" });
  const [chartError, setChartError] = useState("");

  const [news, setNews] = useState([]);
  const [newsError, setNewsError] = useState("");

  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const assetTypeLabel = useMemo(() => resolveAssetType(asset?.type || ""), [asset]);
  const quoteTone = toneByValue(quote?.changesPercentage ?? quote?.change ?? 0);
  const quoteMeta = toneMeta(quoteTone);
  const chartData = mode === "candles" ? chartCandles : chartLine;
  const resolvedName = asset?.name || quote?.name || symbol;
  const resolvedExchange = asset?.exchange || quote?.exchange || "—";

  useEffect(() => {
    let cancelled = false;

    async function loadBase() {
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

        let nextAsset = {
          symbol,
          name: symbol,
          type: "Stock",
          exchange: "—",
          currency: "USD",
        };

        try {
          const searchRes = await fetch(
            `/api/market-search?query=${encodeURIComponent(symbol)}&type=ALL&limit=12`,
            { cache: "no-store" }
          );
          const searchData = await searchRes.json();

          if (searchRes.ok) {
            const rows = Array.isArray(searchData?.results) ? searchData.results : [];
            const exact =
              rows.find((x) => String(x.symbol || "").toUpperCase() === symbol) || rows[0];

            if (exact) nextAsset = exact;
          }
        } catch (err) {
          console.error("market search failed", err);
        }

        if (!cancelled) {
          setAsset(nextAsset);
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

          if (!cancelled) {
            setIsFavorite(Array.isArray(favoriteRows) && favoriteRows.length > 0);
            setIsOwned(Array.isArray(assetRows) && assetRows.length > 0);
          }
        } else if (!cancelled) {
          setIsFavorite(false);
          setIsOwned(false);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setError(err?.message || "Failed to load market symbol.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadBase();

    return () => {
      cancelled = true;
    };
  }, [symbol]);

  useEffect(() => {
    let cancelled = false;

    async function loadQuote() {
      if (!symbol) return;

      setQuote(EMPTY_QUOTE);
      setQuoteError("");

      try {
        const res = await fetch(`/api/prices?symbol=${encodeURIComponent(symbol)}`, {
          cache: "no-store",
        });
        const data = await res.json();

        if (cancelled) return;

        if (!res.ok || data?.error) {
          setQuoteError(data?.error || "Live quote temporarily unavailable.");
          return;
        }

        const price = toNum(data?.price);
        if (price === null || price <= 0) {
          setQuoteError("Live quote temporarily unavailable.");
          return;
        }

        setQuote({
          price,
          change: toNum(data?.change),
          changesPercentage:
            toNum(data?.changesPercentage) ??
            toNum(data?.changePercent) ??
            toNum(data?.percent_change),
          open: toNum(data?.open),
          previousClose: toNum(data?.previousClose),
          dayLow: toNum(data?.dayLow),
          dayHigh: toNum(data?.dayHigh),
          yearLow: toNum(data?.yearLow),
          yearHigh: toNum(data?.yearHigh),
          volume: toNum(data?.volume),
          avgVolume: toNum(data?.avgVolume),
          marketCap: toNum(data?.marketCap),
          exchange: data?.exchange || null,
          name: data?.name || null,
        });
      } catch (err) {
        if (cancelled) return;
        console.error("price fetch failed", err);
        setQuoteError("Live quote temporarily unavailable.");
      }
    }

    loadQuote();

    return () => {
      cancelled = true;
    };
  }, [symbol]);

  useEffect(() => {
    let cancelled = false;

    async function loadChart() {
      if (!symbol) return;

      setChartLoading(true);
      setChartError("");
      setChartNotice("");

      try {
        const res = await fetch(
          `/api/investment-chart?symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(range)}`,
          { cache: "no-store" }
        );
        const data = await res.json();

        if (cancelled) return;

        if (!res.ok || data?.error) {
          setChartError(data?.error || "Chart temporarily unavailable.");
          return;
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
        if (cancelled) return;
        console.error("chart fetch failed", err);
        setChartError("Chart temporarily unavailable.");
      } finally {
        if (!cancelled) setChartLoading(false);
      }
    }

    loadChart();

    return () => {
      cancelled = true;
    };
  }, [symbol, range]);

  useEffect(() => {
    let cancelled = false;

    async function loadNews() {
      if (!symbol) return;

      setNews([]);
      setNewsError("");

      try {
        const res = await fetch(
          `/api/stock-news?symbols=${encodeURIComponent(symbol)}&limit=6`,
          { cache: "no-store" }
        );
        const data = await res.json();

        if (cancelled) return;

        if (Array.isArray(data?.articles)) {
          setNews(data.articles);
        }

        if (data?.error) {
          setNewsError(data.error);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("news fetch failed", err);
        setNewsError("Research headlines temporarily unavailable.");
      }
    }

    loadNews();

    return () => {
      cancelled = true;
    };
  }, [symbol]);

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
        const { error: deleteError } = await supabase
          .from("investment_favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("symbol", symbol);

        if (deleteError) throw deleteError;

        setIsFavorite(false);
        setStatus(`${symbol} removed from favorites.`);
      } else {
        const { error: insertError } = await supabase.from("investment_favorites").insert({
          user_id: user.id,
          symbol,
          name: resolvedName,
          asset_type: assetTypeLabel.toLowerCase(),
        });

        if (insertError) throw insertError;

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

      const { error: insertError } = await supabase.from("investment_assets").insert({
        user_id: user.id,
        symbol,
        name: resolvedName,
        asset_type: assetTypeLabel.toLowerCase() === "etf" ? "etf" : "stock",
        account: "Brokerage",
      });

      if (insertError) throw insertError;

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
      <main className="marketRoot">
        <div className="marketInner">
          <GlassPane size="card">
            <div style={{ fontWeight: 800, fontSize: 18, color: "#fff" }}>
              Loading market asset.
            </div>
          </GlassPane>
        </div>
      </main>
    );
  }

  if (error && !asset) {
    return (
      <main className="marketRoot">
        <div className="marketInner">
          <GlassPane tone="red" size="card">
            <div style={{ fontWeight: 800, fontSize: 18, color: "#fff" }}>{error}</div>
            <div style={{ marginTop: 12 }}>
              <ActionLink href="/investments/discover">
                Back to Discover <ArrowRight size={14} />
              </ActionLink>
            </div>
          </GlassPane>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="marketRoot">
        <div className="marketInner">
          {(status || error) && (
            <GlassPane tone={error ? "red" : "green"} size="card">
              <div style={{ fontWeight: 800, fontSize: 14, color: "#fff" }}>
                {error || status}
              </div>
            </GlassPane>
          )}

          <GlassPane size="card">
            <div className="marketHeroGrid">
              <div style={{ minWidth: 0 }}>
                <div style={overlineStyle()}>Stocks / Market View</div>

                <div
                  style={{
                    marginTop: 8,
                    fontSize: "clamp(28px, 3.2vw, 40px)",
                    lineHeight: 0.96,
                    fontWeight: 950,
                    letterSpacing: "-0.06em",
                    color: "#fff",
                  }}
                >
                  {symbol}
                </div>

                <div
                  style={{
                    marginTop: 8,
                    fontSize: 18,
                    fontWeight: 800,
                    color: "#fff",
                    overflowWrap: "anywhere",
                  }}
                >
                  {resolvedName}
                </div>

                <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <MiniPill>{assetTypeLabel}</MiniPill>
                  <MiniPill>{resolvedExchange}</MiniPill>
                  <MiniPill tone={quoteTone}>
                    {quote.price !== null ? money(quote.price) : "Price unavailable"}
                  </MiniPill>
                </div>

                <div style={{ marginTop: 10, ...mutedStyle(), maxWidth: 760 }}>
                  Tight public market view for quote, chart, headlines, and quick actions. No fake
                  brokerage clutter.
                </div>
              </div>

              <div className="heroSide">
                <div
                  style={{
                    padding: 16,
                    borderRadius: 18,
                    border: `1px solid ${quoteMeta.border}`,
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015))",
                    boxShadow: `0 0 18px ${quoteMeta.glow}`,
                  }}
                >
                  <div style={overlineStyle()}>Live Price</div>
                  <div
                    style={{
                      marginTop: 8,
                      fontWeight: 950,
                      fontSize: 34,
                      lineHeight: 1,
                      color: quoteTone === "neutral" ? "#fff" : quoteMeta.text,
                    }}
                  >
                    {quote.price !== null ? money(quote.price) : "—"}
                  </div>

                  <div
                    style={{
                      marginTop: 8,
                      fontWeight: 800,
                      fontSize: 14,
                      color:
                        quoteTone === "neutral" ? "rgba(255,255,255,0.72)" : quoteMeta.text,
                    }}
                  >
                    {quote.change !== null ? signedMoney(quote.change) : "—"}
                    {quote.changesPercentage !== null ? ` • ${pct(quote.changesPercentage)}` : ""}
                  </div>

                  {quoteError ? (
                    <div style={{ marginTop: 10, fontSize: 12, color: "rgba(255,255,255,0.58)" }}>
                      {quoteError}
                    </div>
                  ) : null}
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <ActionLink href="/investments/discover">
                    <ArrowLeft size={14} /> Discover
                  </ActionLink>
                  <ActionLink href="/investments">
                    Portfolio <ArrowRight size={14} />
                  </ActionLink>
                </div>
              </div>
            </div>
          </GlassPane>

          <section className="marketMetrics">
            <MetricCard
              icon={Wallet}
              label="Price"
              value={quote.price !== null ? money(quote.price) : "—"}
              detail="Latest quote from your live price route."
              tone={quoteTone}
            />
            <MetricCard
              icon={TrendingUp}
              label="Day Change"
              value={quote.change !== null ? signedMoney(quote.change) : "—"}
              detail={
                quote.changesPercentage !== null
                  ? `${pct(quote.changesPercentage)} on the day.`
                  : "Daily move unavailable."
              }
              tone={quoteTone}
            />
            <MetricCard
              icon={BadgeDollarSign}
              label="Market Cap"
              value={quote.marketCap !== null ? compactNumber(quote.marketCap) : "—"}
              detail="Company size."
              tone="neutral"
            />
            <MetricCard
              icon={TrendingDown}
              label="Volume"
              value={quote.volume !== null ? compactNumber(quote.volume) : "—"}
              detail={
                quote.avgVolume !== null
                  ? `Avg ${compactNumber(quote.avgVolume)}`
                  : "Average volume unavailable."
              }
              tone="neutral"
            />
          </section>

          <section className="marketMain">
            <div className="marketLeftCol">
              <GlassPane size="card">
                <PaneHeader
                  title="Chart"
                  subcopy="Keep the market page useful even when the chart provider is weak."
                  right={
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {MODE_OPTIONS.map((option) => (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => setMode(option.key)}
                          style={buttonStyle({ primary: mode === option.key })}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  }
                />

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                  {RANGE_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setRange(option)}
                      style={buttonStyle({ primary: range === option })}
                    >
                      {option}
                    </button>
                  ))}
                </div>

                <div
                  style={{
                    border: "1px solid rgba(214,226,255,0.10)",
                    borderRadius: 22,
                    overflow: "hidden",
                    background: "rgba(255,255,255,0.02)",
                    minHeight: 430,
                  }}
                >
                  {chartLoading ? (
                    <div style={{ padding: 24, fontWeight: 900, color: "#fff" }}>
                      Loading chart...
                    </div>
                  ) : chartData.length > 0 ? (
                    <InvestmentChart
                      data={chartData}
                      volumeData={mode === "candles" ? chartVolume : []}
                      mode={mode}
                      height={430}
                    />
                  ) : (
                    <EmptyBlock
                      title="No chart data available"
                      detail={chartError || "The chart route returned nothing usable right now."}
                    />
                  )}
                </div>

                {(chartNotice || chartMeta.interval || chartMeta.source) && (
                  <div style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap", ...mutedStyle() }}>
                    {chartMeta.interval ? <span>Interval: {chartMeta.interval}</span> : null}
                    {chartMeta.source ? <span>Source: {chartMeta.source}</span> : null}
                    {chartNotice ? <span>{chartNotice}</span> : null}
                  </div>
                )}
              </GlassPane>

              <GlassPane size="card">
                <PaneHeader
                  title="Research headlines"
                  subcopy="News should stay readable instead of blowing the layout apart."
                  right={<MiniPill>{news.length} stories</MiniPill>}
                />

                {news.length ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    {news.slice(0, 5).map((item, index) => (
                      <HeadlineRow key={`${item.url}-${index}`} item={item} />
                    ))}
                  </div>
                ) : (
                  <EmptyBlock
                    title="No headlines returned"
                    detail={newsError || "Research headlines temporarily unavailable."}
                  />
                )}
              </GlassPane>
            </div>

            <div className="marketRightCol">
              <GlassPane size="card">
                <PaneHeader
                  title="Actions"
                  subcopy="Clear public-market actions only."
                />

                <div style={{ display: "grid", gap: 10 }}>
                  <button
                    type="button"
                    onClick={addToPortfolio}
                    disabled={working || isOwned}
                    style={buttonStyle({ primary: isOwned, disabled: working || isOwned })}
                  >
                    <Plus size={14} />
                    {isOwned ? "Already in Portfolio" : working ? "Working..." : "Add to Portfolio"}
                  </button>

                  <button
                    type="button"
                    onClick={toggleFavorite}
                    disabled={working}
                    style={buttonStyle({ primary: isFavorite, disabled: working })}
                  >
                    <Star size={14} />
                    {isFavorite ? "Remove Favorite" : "Add to Favorites"}
                  </button>

                  <ActionLink href="/investments/discover">
                    Back to Discover <ArrowRight size={14} />
                  </ActionLink>
                </div>
              </GlassPane>

              <GlassPane size="card">
                <PaneHeader title="Snapshot" subcopy="Fast market readout." />

                <div style={{ display: "grid", gap: 8 }}>
                  <SnapshotRow label="Symbol" value={symbol || "—"} />
                  <SnapshotRow label="Asset Type" value={assetTypeLabel} />
                  <SnapshotRow label="Exchange" value={resolvedExchange} />
                  <SnapshotRow
                    label="Open / Prev Close"
                    value={
                      quote.open !== null || quote.previousClose !== null
                        ? `${quote.open !== null ? money(quote.open) : "—"} / ${
                            quote.previousClose !== null ? money(quote.previousClose) : "—"
                          }`
                        : "—"
                    }
                  />
                  <SnapshotRow
                    label="Day Range"
                    value={
                      quote.dayLow !== null || quote.dayHigh !== null
                        ? `${quote.dayLow !== null ? money(quote.dayLow) : "—"} / ${
                            quote.dayHigh !== null ? money(quote.dayHigh) : "—"
                          }`
                        : "—"
                    }
                  />
                  <SnapshotRow
                    label="52W Range"
                    value={
                      quote.yearLow !== null || quote.yearHigh !== null
                        ? `${quote.yearLow !== null ? money(quote.yearLow) : "—"} / ${
                            quote.yearHigh !== null ? money(quote.yearHigh) : "—"
                          }`
                        : "—"
                    }
                  />
                </div>
              </GlassPane>
            </div>
          </section>
        </div>
      </main>

      <style jsx global>{`
        .marketRoot {
          position: relative;
          z-index: 1;
          padding: 16px 0 26px;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .marketInner {
          width: min(100%, 1380px);
          margin: 0 auto;
          display: grid;
          gap: 12px;
        }

        .marketHeroGrid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(250px, 300px);
          gap: 14px;
          align-items: start;
        }

        .heroSide {
          display: grid;
          gap: 10px;
          align-content: start;
        }

        .marketMetrics {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          align-items: stretch;
        }

        .marketMain {
          display: grid;
          grid-template-columns: minmax(0, 1.34fr) minmax(320px, 0.78fr);
          gap: 12px;
          align-items: start;
        }

        .marketLeftCol,
        .marketRightCol {
          display: grid;
          gap: 12px;
          min-width: 0;
        }

        @media (max-width: 1260px) {
          .marketMetrics {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .marketMain,
          .marketHeroGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .marketRoot {
            padding: 10px 0 20px;
          }

          .marketInner {
            gap: 10px;
          }

          .marketMetrics {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}
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

function money(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function pct(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return `${num >= 0 ? "+" : ""}${num.toFixed(2)}%`;
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

function compactNumber(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(num);
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

function buttonStyle({ primary = false, disabled = false } = {}) {
  return {
    minHeight: 42,
    padding: "0 12px",
    borderRadius: 14,
    border: primary
      ? "1px solid rgba(255,255,255,0.18)"
      : "1px solid rgba(214,226,255,0.10)",
    background: disabled
      ? "rgba(255,255,255,0.04)"
      : primary
      ? "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(233,239,248,0.88))"
      : "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012))",
    color: disabled ? "rgba(255,255,255,0.42)" : primary ? "#0b1220" : "#f7fbff",
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

function resolveAssetType(raw) {
  const value = String(raw || "").toUpperCase();
  if (value.includes("ETF")) return "ETF";
  if (value.includes("FUND")) return "Fund";
  if (value.includes("CRYPTO")) return "Crypto";
  return value || "Stock";
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

function HeadlineRow({ item }) {
  return (
    <a
      href={item.url || "#"}
      target="_blank"
      rel="noreferrer"
      style={{ textDecoration: "none" }}
    >
      <div
        style={{
          minHeight: 90,
          display: "grid",
          gridTemplateColumns: "40px minmax(0, 1fr) auto",
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
            width: 40,
            height: 40,
            borderRadius: 12,
            display: "grid",
            placeItems: "center",
            border: "1px solid rgba(214,226,255,0.10)",
            background: "rgba(10,14,21,0.46)",
            color: "#f7fbff",
          }}
        >
          <Newspaper size={16} />
        </div>

        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
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
              fontSize: 11,
              fontWeight: 800,
              color: "rgba(255,255,255,0.44)",
              textTransform: "uppercase",
              letterSpacing: ".14em",
            }}
          >
            {(item.site || "Source") + " • " + fullDateTime(item.publishedDate)}
          </div>
        </div>

        <div style={{ color: "rgba(255,255,255,0.52)" }}>
          <ExternalLink size={14} />
        </div>
      </div>
    </a>
  );
}

function EmptyState({ title, detail }) {
  return (
    <div
      style={{
        minHeight: 140,
        display: "grid",
        placeItems: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div
          style={{
            fontSize: 17,
            fontWeight: 800,
            color: "#fff",
            textAlign: "center",
          }}
        >
          {title}
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: 13,
            lineHeight: 1.55,
            color: "rgba(255,255,255,0.64)",
            textAlign: "center",
          }}
        >
          {detail}
        </div>
      </div>
    </div>
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

  const assetTypeLabel = useMemo(() => {
    return resolveAssetType(asset?.type || "");
  }, [asset]);

  const chartData = mode === "candles" ? chartCandles : chartLine;
  const quoteTone = toneByValue(quote?.changesPercentage ?? quote?.change ?? 0);

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

            if (exact) {
              nextAsset = exact;
            }
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
        if (!cancelled) {
          setError(err?.message || "Failed to load market symbol.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
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

        if (Array.isArray(data?.line)) setChartLine(data.line);
        if (Array.isArray(data?.candles)) setChartCandles(data.candles);
        if (Array.isArray(data?.volume)) setChartVolume(data.volume);

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
        if (!cancelled) {
          setChartLoading(false);
        }
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

      setNewsError("");

      try {
        const res = await fetch(
          `/api/stock-news?symbols=${encodeURIComponent(symbol)}&limit=6`,
          { cache: "no-store" }
        );
        const data = await res.json();

        if (cancelled) return;

        if (Array.isArray(data?.articles) && data.articles.length > 0) {
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
        const { error } = await supabase
          .from("investment_favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("symbol", symbol);

        if (error) throw error;

        setIsFavorite(false);
        setStatus(`${symbol} removed from favorites.`);
      } else {
        const { error } = await supabase.from("investment_favorites").insert({
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
        name: asset?.name || quote?.name || symbol,
        asset_type: assetTypeLabel.toLowerCase() === "etf" ? "etf" : "stock",
        account: "Brokerage",
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
      <main style={{ padding: "18px 0 28px", fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        <div style={{ width: "min(100%, 1380px)", margin: "0 auto" }}>
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
      <main style={{ padding: "18px 0 28px", fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        <div style={{ width: "min(100%, 1380px)", margin: "0 auto" }}>
          <GlassPane tone="red" size="card">
            <div style={{ fontWeight: 800, fontSize: 18, color: "#fff" }}>
              {error}
            </div>
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
                <div style={overlineStyle()}>Public Market View</div>

                <div
                  style={{
                    marginTop: 8,
                    fontSize: "clamp(28px, 3.5vw, 40px)",
                    lineHeight: 0.98,
                    fontWeight: 900,
                    letterSpacing: "-0.06em",
                    color: "#fff",
                  }}
                >
                  {symbol}
                </div>

                <div
                  style={{
                    marginTop: 8,
                    fontSize: 17,
                    fontWeight: 800,
                    color: "#fff",
                    overflowWrap: "anywhere",
                  }}
                >
                  {asset?.name || quote?.name || symbol}
                </div>

                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <MiniPill>{assetTypeLabel}</MiniPill>
                  <MiniPill>{asset?.exchange || quote?.exchange || "—"}</MiniPill>
                  <MiniPill tone={quoteTone}>
                    {quote.price !== null ? money(quote.price) : "Price unavailable"}
                  </MiniPill>
                </div>

                <div style={{ marginTop: 10, ...mutedStyle(), maxWidth: 760 }}>
                  This is the public market page for the symbol. It stays usable even when quote,
                  chart, or news providers misbehave.
                </div>
              </div>

              <div
                style={{
                  minWidth: 260,
                  display: "grid",
                  gap: 10,
                  alignContent: "start",
                }}
              >
                <div
                  style={{
                    padding: 16,
                    borderRadius: 18,
                    border: `1px solid ${toneMeta(quoteTone).border}`,
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015))",
                    boxShadow: `0 0 20px ${toneMeta(quoteTone).glow}`,
                  }}
                >
                  <div style={overlineStyle()}>Live Price</div>
                  <div
                    style={{
                      marginTop: 8,
                      fontWeight: 950,
                      fontSize: 34,
                      color: quoteTone === "neutral" ? "#fff" : toneMeta(quoteTone).text,
                    }}
                  >
                    {quote.price !== null ? money(quote.price) : "—"}
                  </div>

                  <div
                    style={{
                      marginTop: 8,
                      fontWeight: 800,
                      fontSize: 14,
                      color: quoteTone === "neutral" ? "rgba(255,255,255,0.72)" : toneMeta(quoteTone).text,
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
                    <ArrowLeft size={14} /> Research Desk
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
              detail="Latest quote returned by your price route."
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
                  subcopy="Keep the chart area alive even if the provider has a moment."
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
                    borderRadius: 24,
                    overflow: "hidden",
                    background: "rgba(255,255,255,0.02)",
                    minHeight: 520,
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
                      height={520}
                    />
                  ) : (
                    <div style={{ padding: 24, fontWeight: 900, color: "#fff" }}>
                      No chart data available.
                    </div>
                  )}
                </div>

                {(chartError || chartNotice || chartMeta.interval || chartMeta.source) && (
                  <div
                    style={{
                      marginTop: 12,
                      display: "flex",
                      gap: 12,
                      flexWrap: "wrap",
                      ...mutedStyle(),
                    }}
                  >
                    {chartMeta.interval ? <span>Interval: {chartMeta.interval}</span> : null}
                    {chartMeta.source ? <span>Source: {chartMeta.source}</span> : null}
                    {chartNotice ? <span>{chartNotice}</span> : null}
                    {chartError ? <span>{chartError}</span> : null}
                  </div>
                )}
              </GlassPane>

              <GlassPane size="card">
                <PaneHeader
                  title="Research headlines"
                  subcopy="This should not disappear every time one request gets rate limited."
                  right={<MiniPill>{news.length} stories</MiniPill>}
                />

                <div style={{ display: "grid", gap: 8 }}>
                  {news.length === 0 ? (
                    <EmptyState
                      title="No headlines returned"
                      detail={newsError || "Research headlines temporarily unavailable."}
                    />
                  ) : (
                    news.map((item, index) => (
                      <HeadlineRow key={`${item.url}-${index}`} item={item} />
                    ))
                  )}
                </div>

                {newsError && news.length > 0 ? (
                  <div style={{ marginTop: 10, ...mutedStyle() }}>{newsError}</div>
                ) : null}
              </GlassPane>
            </div>

            <div className="marketRightCol">
              <GlassPane size="card">
                <PaneHeader
                  title="Actions"
                  subcopy="Public market actions, not owned-position math."
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

                  <ActionLink href={`/investments/discover`}>
                    Back to Discover <ArrowRight size={14} />
                  </ActionLink>
                </div>
              </GlassPane>

              <GlassPane size="card">
                <PaneHeader
                  title="Snapshot"
                  subcopy="Fast market readout."
                />

                <div style={{ display: "grid", gap: 8 }}>
                  <SnapshotRow label="Symbol" value={symbol || "—"} />
                  <SnapshotRow label="Asset Type" value={assetTypeLabel} />
                  <SnapshotRow label="Exchange" value={asset?.exchange || quote?.exchange || "—"} />
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
          padding: 18px 0 28px;
          font-family: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        }

        .marketInner {
          width: min(100%, 1380px);
          margin: 0 auto;
          display: grid;
          gap: 14px;
        }

        .marketHeroGrid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 14px;
        }

        .marketMetrics {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          align-items: stretch;
        }

        .marketMain {
          display: grid;
          grid-template-columns: minmax(0, 1.4fr) minmax(340px, 0.82fr);
          gap: 14px;
          align-items: start;
        }

        .marketLeftCol,
        .marketRightCol {
          display: grid;
          gap: 14px;
          min-width: 0;
        }

        @media (max-width: 1260px) {
          .marketMetrics {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .marketMain {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 860px) {
          .marketRoot {
            padding: 10px 0 22px;
          }

          .marketInner {
            gap: 12px;
          }

          .marketHeroGrid,
          .marketMetrics {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  BookOpenText,
  ExternalLink,
  Newspaper,
  Plus,
  Star,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import GlassPane from "../components/GlassPane";

export const dynamic = "force-dynamic";

const FONT_STACK =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const BOARD_SYMBOLS = [
  { symbol: "SPY", label: "S&P 500" },
  { symbol: "QQQ", label: "Nasdaq 100" },
  { symbol: "DIA", label: "Dow 30" },
  { symbol: "IWM", label: "Russell 2000" },
];

const NEWS_TTL_MS = 1000 * 60 * 5;
const newsResponseCache = new Map();
const newsInFlightKeys = new Set();

function getCachedNews(key) {
  const hit = newsResponseCache.get(key);
  if (!hit) return null;

  if (Date.now() - hit.ts > NEWS_TTL_MS) {
    newsResponseCache.delete(key);
    return null;
  }

  return hit.data;
}

function setCachedNews(key, data) {
  newsResponseCache.set(key, {
    ts: Date.now(),
    data,
  });
}

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
  });
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

function monthLabel() {
  return new Date().toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function initials(label = "") {
  const clean = String(label || "").trim();
  if (!clean) return "—";
  return clean
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();
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

function inputStyle() {
  return {
    height: 46,
    borderRadius: 14,
    border: "1px solid rgba(214,226,255,0.10)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.012)), rgba(8,12,20,0.76)",
    color: "#f7fbff",
    padding: "0 12px",
    outline: "none",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.035)",
    width: "100%",
  };
}

function buttonStyle({ primary = false, disabled = false } = {}) {
  return {
    minHeight: 46,
    padding: "0 14px",
    borderRadius: 14,
    border: primary
      ? "1px solid rgba(255,255,255,0.18)"
      : "1px solid rgba(214,226,255,0.10)",
    background: disabled
      ? "rgba(255,255,255,0.04)"
      : primary
      ? "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(229,236,248,0.88))"
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
    boxShadow: primary ? "0 10px 22px rgba(255,255,255,0.08)" : undefined,
  };
}

function parseBatchPrices(json) {
  const out = {};

  function assign(symbol, raw) {
    const sym = String(symbol || "").trim().toUpperCase();
    if (!sym) return;

    if (typeof raw === "number") {
      out[sym] = {
        price: Number.isFinite(raw) ? raw : null,
        change: null,
        changesPercentage: null,
      };
      return;
    }

    if (raw && typeof raw === "object") {
      out[sym] = {
        price: Number.isFinite(Number(raw.price)) ? Number(raw.price) : null,
        change: Number.isFinite(Number(raw.change)) ? Number(raw.change) : null,
        changesPercentage: Number.isFinite(
          Number(raw.changesPercentage ?? raw.changePercent ?? raw.percent_change)
        )
          ? Number(raw.changesPercentage ?? raw.changePercent ?? raw.percent_change)
          : null,
      };
    }
  }

  if (Array.isArray(json)) {
    json.forEach((row) => assign(row?.symbol ?? row?.ticker, row));
  }

  if (Array.isArray(json?.quotes)) {
    json.quotes.forEach((row) => assign(row?.symbol ?? row?.ticker, row));
  }

  if (Array.isArray(json?.data)) {
    json.data.forEach((row) => assign(row?.symbol ?? row?.ticker, row));
  }

  if (json?.prices && typeof json.prices === "object") {
    Object.entries(json.prices).forEach(([symbol, raw]) => assign(symbol, raw));
  }

  if (json && typeof json === "object" && !Array.isArray(json)) {
    Object.entries(json).forEach(([symbol, raw]) => {
      if (!out[String(symbol).toUpperCase()]) assign(symbol, raw);
    });
  }

  return out;
}

function sameNewsArticles(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i += 1) {
    const aKey = `${a[i]?.url || ""}__${a[i]?.publishedDate || ""}__${a[i]?.title || ""}`;
    const bKey = `${b[i]?.url || ""}__${b[i]?.publishedDate || ""}__${b[i]?.title || ""}`;
    if (aKey !== bKey) return false;
  }

  return true;
}

export default function InvestmentsPage() {
  const [assets, setAssets] = useState([]);
  const [txns, setTxns] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [prices, setPrices] = useState({});
  const [news, setNews] = useState([]);
  const [newsError, setNewsError] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [symbol, setSymbol] = useState("");
  const [tradeAssetId, setTradeAssetId] = useState("");
  const [tradeType, setTradeType] = useState("BUY");
  const [tradeQty, setTradeQty] = useState("");
  const [tradePrice, setTradePrice] = useState("");
  const [tradeDate, setTradeDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        setError("You must be logged in.");
        return;
      }

      const [assetRes, txnRes, favoriteRes] = await Promise.all([
        supabase
          .from("investment_assets")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),

        supabase
          .from("investment_transactions")
          .select("*")
          .eq("user_id", user.id)
          .order("txn_date", { ascending: false }),

        supabase
          .from("investment_favorites")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      if (assetRes.error || txnRes.error || favoriteRes.error) {
        console.error(assetRes.error || txnRes.error || favoriteRes.error);
        setError("Failed loading investment data.");
        setLoading(false);
        return;
      }

      const assetRows = assetRes.data || [];
      setAssets(assetRows);
      setTxns(txnRes.data || []);
      setFavorites(favoriteRes.data || []);
      setTradeAssetId(assetRows[0]?.id || "");
      setLoading(false);
    }

    load();
  }, []);

  const watchSymbols = useMemo(() => {
    return [
      ...new Set(
        [
          ...assets.map((a) => String(a.symbol || "").toUpperCase().trim()),
          ...favorites.map((f) => String(f.symbol || "").toUpperCase().trim()),
          ...BOARD_SYMBOLS.map((x) => x.symbol),
        ].filter(Boolean)
      ),
    ];
  }, [assets, favorites]);

  useEffect(() => {
    let cancelled = false;

    async function loadPrices() {
      if (!watchSymbols.length) {
        setPrices({});
        return;
      }

      const nextPrices = {};

      try {
        const batchRes = await fetch(
          `/api/prices-batch?symbols=${encodeURIComponent(watchSymbols.join(","))}`,
          { cache: "no-store" }
        );
        const batchData = await batchRes.json();

        if (cancelled) return;

        if (batchRes.ok) {
          Object.assign(nextPrices, parseBatchPrices(batchData));
        }
      } catch (err) {
        if (cancelled) return;
        console.error("batch price fetch failed", err);
      }

      const missing = watchSymbols.filter((sym) => {
        const row = nextPrices[sym];
        return !row || !Number.isFinite(Number(row.price)) || Number(row.price) <= 0;
      });

      if (missing.length) {
        await Promise.all(
          missing.map(async (sym) => {
            try {
              const res = await fetch(`/api/prices?symbol=${encodeURIComponent(sym)}`, {
                cache: "no-store",
              });
              const data = await res.json();

              if (!cancelled && res.ok && !data?.error) {
                nextPrices[sym] = {
                  price: Number.isFinite(Number(data?.price)) ? Number(data.price) : null,
                  change: Number.isFinite(Number(data?.change)) ? Number(data.change) : null,
                  changesPercentage: Number.isFinite(
                    Number(data?.changesPercentage ?? data?.changePercent ?? data?.percent_change)
                  )
                    ? Number(
                        data?.changesPercentage ?? data?.changePercent ?? data?.percent_change
                      )
                    : null,
                };
              }
            } catch (err) {
              if (cancelled) return;
              console.error(`single price fetch failed for ${sym}`, err);
            }
          })
        );
      }

      if (!cancelled) {
        setPrices(nextPrices);
      }
    }

    loadPrices();

    return () => {
      cancelled = true;
    };
  }, [watchSymbols]);

  const portfolio = useMemo(() => {
    const txnsByAsset = {};
    for (const txn of txns) {
      const key = txn.asset_id;
      txnsByAsset[key] = txnsByAsset[key] || [];
      txnsByAsset[key].push(txn);
    }

    let totalValue = 0;
    let totalCost = 0;
    let totalRealizedPnl = 0;
    let totalDayMove = 0;

    const holdings = assets.map((asset) => {
      const ledger = [...(txnsByAsset[asset.id] || [])].sort((a, b) => {
        const ad = new Date(a.txn_date || 0).getTime();
        const bd = new Date(b.txn_date || 0).getTime();
        return ad - bd;
      });

      let shares = 0;
      let remainingBasis = 0;
      let realizedPnl = 0;

      for (const txn of ledger) {
        const qty = toNum(txn.qty);
        const price = toNum(txn.price);
        const type = String(txn.txn_type || "").toUpperCase();

        if (type === "BUY") {
          shares += qty;
          remainingBasis += qty * price;
          continue;
        }

        if (type === "SELL" && qty > 0) {
          const avgCost = shares > 0 ? remainingBasis / shares : 0;
          const qtySold = Math.min(shares, qty);
          shares -= qtySold;
          remainingBasis -= avgCost * qtySold;
          realizedPnl += qtySold * price - avgCost * qtySold;
        }
      }

      const sym = String(asset.symbol || "").toUpperCase().trim();
      const quote = prices[sym] || null;
      const livePrice = Number.isFinite(Number(quote?.price)) ? Number(quote.price) : null;
      const dayChange = Number.isFinite(Number(quote?.change)) ? Number(quote.change) : null;
      const dayPct = Number.isFinite(Number(quote?.changesPercentage))
        ? Number(quote.changesPercentage)
        : null;

      const hasLivePrice = Number.isFinite(livePrice) && livePrice > 0;
      const value = hasLivePrice ? shares * livePrice : 0;
      const pnl = hasLivePrice ? value - remainingBasis : null;
      const pnlPct =
        hasLivePrice && remainingBasis > 0 ? ((value - remainingBasis) / remainingBasis) * 100 : null;
      const positionDayMove =
        hasLivePrice && Number.isFinite(dayChange) ? shares * dayChange : 0;

      if (hasLivePrice) totalValue += value;
      totalCost += remainingBasis;
      totalRealizedPnl += realizedPnl;
      totalDayMove += positionDayMove;

      return {
        ...asset,
        shares,
        remainingBasis,
        livePrice,
        hasLivePrice,
        value,
        pnl,
        pnlPct,
        txCount: ledger.length,
        dayChange,
        dayPct,
        positionDayMove,
      };
    });

    return {
      holdings: [...holdings].sort((a, b) => toNum(b.value) - toNum(a.value)),
      totalValue,
      totalCost,
      totalRealizedPnl,
      totalPnl: totalValue - totalCost,
      totalDayMove,
      totalDayPct:
        totalValue - totalDayMove > 0 ? (totalDayMove / (totalValue - totalDayMove)) * 100 : null,
    };
  }, [assets, txns, prices]);

  const openPositions = useMemo(() => {
    return portfolio.holdings.filter((h) => toNum(h.shares) > 0);
  }, [portfolio.holdings]);

  const alerts = useMemo(() => {
    return openPositions.filter((h) => !h.hasLivePrice || toNum(h.pnl) < 0);
  }, [openPositions]);

  const heroTone = useMemo(() => {
    return toneByValue(portfolio.totalPnl);
  }, [portfolio.totalPnl]);

  const newsSymbols = useMemo(() => {
    const topOwned = openPositions.slice(0, 4).map((h) => String(h.symbol || "").toUpperCase());
    const watch = favorites.slice(0, 3).map((f) => String(f.symbol || "").toUpperCase());
    return [...new Set([...topOwned, ...watch, "SPY"])].filter(Boolean).slice(0, 6);
  }, [openPositions, favorites]);

  const newsSymbolsKey = useMemo(() => {
    return newsSymbols.join(",");
  }, [newsSymbols]);

  useEffect(() => {
    let cancelled = false;

    async function loadNews() {
      if (!newsSymbolsKey) return;

      const cached = getCachedNews(newsSymbolsKey);
      if (cached) {
        if (!cancelled) {
          if (Array.isArray(cached.articles) && cached.articles.length > 0) {
            setNews((prev) => (sameNewsArticles(prev, cached.articles) ? prev : cached.articles));
          }
          setNewsError(cached.error || "");
        }
        return;
      }

      if (newsInFlightKeys.has(newsSymbolsKey)) return;
      newsInFlightKeys.add(newsSymbolsKey);
      setNewsError("");

      try {
        const res = await fetch(
          `/api/stock-news?symbols=${encodeURIComponent(newsSymbolsKey)}&limit=10`,
          { cache: "no-store" }
        );
        const data = await res.json();

        if (cancelled) return;

        const payload = {
          articles: Array.isArray(data?.articles) ? data.articles : [],
          error: data?.error || "",
        };

        setCachedNews(newsSymbolsKey, payload);

        if (payload.articles.length > 0) {
          setNews((prev) => (sameNewsArticles(prev, payload.articles) ? prev : payload.articles));
        }

        setNewsError(payload.error);
      } catch (err) {
        if (cancelled) return;
        console.error("news fetch failed", err);

        const payload = {
          articles: [],
          error: "Research headlines temporarily unavailable.",
        };

        setCachedNews(newsSymbolsKey, payload);
        setNewsError(payload.error);
      } finally {
        newsInFlightKeys.delete(newsSymbolsKey);
      }
    }

    loadNews();

    return () => {
      cancelled = true;
    };
  }, [newsSymbolsKey]);

  const recentTxns = useMemo(() => {
    return [...txns]
      .sort((a, b) => {
        const ad = new Date(a.txn_date || 0).getTime();
        const bd = new Date(b.txn_date || 0).getTime();
        return bd - ad;
      })
      .slice(0, 6);
  }, [txns]);

  const assetMap = useMemo(() => {
    const map = new Map();
    assets.forEach((asset) => map.set(asset.id, asset));
    return map;
  }, [assets]);

  async function addAsset() {
    const clean = String(symbol || "").toUpperCase().trim();
    if (!clean) return;

    setStatus("");
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("You must be logged in.");
        return;
      }

      const exists = assets.some((a) => String(a.symbol || "").toUpperCase() === clean);
      if (exists) {
        setError(`${clean} is already in your portfolio.`);
        return;
      }

      const { data, error: insertError } = await supabase
        .from("investment_assets")
        .insert({
          user_id: user.id,
          symbol: clean,
          asset_type: "stock",
          account: "Brokerage",
        })
        .select()
        .single();

      if (insertError) {
        console.error(insertError);
        setError(`Could not add ${clean}.`);
        return;
      }

      setAssets((prev) => [data, ...prev]);
      setTradeAssetId(data.id);
      setSymbol("");
      setStatus(`${clean} added to the board.`);
    } catch (err) {
      console.error(err);
      setError("Failed adding the asset.");
    }
  }

  async function logTrade() {
    setStatus("");
    setError("");

    const qty = toNum(tradeQty, NaN);
    const price = toNum(tradePrice, NaN);

    if (!tradeAssetId) {
      setError("Pick an asset first.");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Enter a valid quantity.");
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setError("Enter a valid price.");
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("You must be logged in.");
        return;
      }

      const { data, error: insertError } = await supabase
        .from("investment_transactions")
        .insert({
          user_id: user.id,
          asset_id: tradeAssetId,
          txn_type: tradeType,
          qty,
          price,
          txn_date: tradeDate,
        })
        .select()
        .single();

      if (insertError) {
        console.error(insertError);
        setError("Could not save trade.");
        return;
      }

      setTxns((prev) => [data, ...prev]);
      setTradeQty("");
      setTradePrice("");
      setStatus(`${tradeType} saved to portfolio ledger.`);
    } catch (err) {
      console.error(err);
      setError("Failed saving trade.");
    }
  }

  if (loading) {
    return (
      <main style={{ padding: "18px 0 28px", fontFamily: FONT_STACK }}>
        <div style={{ width: "min(100%, 1380px)", margin: "0 auto" }}>
          <GlassPane size="card">
            <div style={{ fontWeight: 800, fontSize: 18, color: "#fff" }}>
              Loading investments desk.
            </div>
          </GlassPane>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="investRoot">
        <div className="investInner">
          <GlassPane size="card">
            <div className="investHeroGrid">
              <div style={{ minWidth: 0 }}>
                <div style={overlineStyle()}>Investments Desk</div>

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
                  Brokerage-grade board
                </div>

                <div
                  style={{
                    marginTop: 12,
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <MiniPill>{monthLabel()}</MiniPill>
                  <MiniPill tone={heroTone}>{openPositions.length} open positions</MiniPill>
                  <MiniPill tone={alerts.length ? "amber" : "green"}>
                    {alerts.length ? `${alerts.length} signals` : "Desk clear"}
                  </MiniPill>
                </div>

                <div style={{ marginTop: 12, ...mutedStyle(), maxWidth: 820 }}>
                  Real portfolio tracking, live quotes, watchlist flow, and a research/news rail
                  that stays up instead of acting flaky.
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
                <ActionLink href="/investments/discover">
                  Research Desk <ArrowRight size={14} />
                </ActionLink>
                <ActionLink
                  href={
                    openPositions[0] ? `/market/${openPositions[0].symbol}` : "/investments/discover"
                  }
                >
                  Open Market <ExternalLink size={14} />
                </ActionLink>
              </div>
            </div>
          </GlassPane>

          {(status || error) && (
            <GlassPane tone={error ? "red" : "green"} size="card">
              <div style={{ fontWeight: 800, fontSize: 14, color: "#fff" }}>
                {error || status}
              </div>
            </GlassPane>
          )}

          <section className="investMetrics">
            <MetricCard
              icon={Wallet}
              label="Portfolio Value"
              value={money(portfolio.totalValue)}
              detail="Live value across open positions on the desk."
              tone="neutral"
            />
            <MetricCard
              icon={Activity}
              label="Day Move"
              value={signedMoney(portfolio.totalDayMove)}
              detail={
                portfolio.totalDayPct != null
                  ? `${pct(portfolio.totalDayPct)} across live-priced positions.`
                  : "Waiting on live quotes."
              }
              tone={toneByValue(portfolio.totalDayMove)}
            />
            <MetricCard
              icon={TrendingUp}
              label="Unrealized P/L"
              value={signedMoney(portfolio.totalPnl)}
              detail="Current value minus remaining cost basis."
              tone={toneByValue(portfolio.totalPnl)}
            />
            <MetricCard
              icon={Star}
              label="Watchlist"
              value={String(favorites.length)}
              detail="Saved names ready for research and routing."
              tone="neutral"
            />
          </section>

          <section className="investMain">
            <div className="investLeftCol">
              <GlassPane size="card">
                <PaneHeader
                  title="Market board"
                  subcopy="Fast index read without leaving the portfolio screen."
                  right={<MiniPill>Live quote strip</MiniPill>}
                />

                <div className="marketBoardGrid">
                  {BOARD_SYMBOLS.map((item) => {
                    const quote = prices[item.symbol] || {};
                    const tone = toneByValue(quote?.changesPercentage ?? quote?.change);
                    return (
                      <MarketBoardCard
                        key={item.symbol}
                        symbol={item.symbol}
                        label={item.label}
                        quote={quote}
                        tone={tone}
                      />
                    );
                  })}
                </div>
              </GlassPane>

              <GlassPane size="card">
                <PaneHeader
                  title="Open positions"
                  subcopy="Your biggest live holdings with serious brokerage-style presentation."
                  right={<MiniPill>{openPositions.length} active</MiniPill>}
                />

                <div style={{ display: "grid", gap: 8 }}>
                  {openPositions.length === 0 ? (
                    <EmptyState
                      title="No open positions yet"
                      detail="Add a symbol and log your first fill so the desk has something real to track."
                      linkHref="/investments/discover"
                      linkLabel="Open research desk"
                    />
                  ) : (
                    openPositions
                      .slice(0, 8)
                      .map((item) => <HoldingRow key={item.id} item={item} />)
                  )}
                </div>
              </GlassPane>

              <GlassPane size="card">
                <PaneHeader
                  title="Research headlines"
                  subcopy="Live stock-news feed for the names sitting closest to your book."
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

            <div className="investRightCol">
              <GlassPane tone={alerts.length ? "amber" : "green"} size="card">
                <PaneHeader
                  title="Signals"
                  subcopy="Fast pressure checks, not a loud toy dashboard."
                  right={
                    <MiniPill tone={alerts.length ? "amber" : "green"}>
                      {alerts.length ? `${alerts.length} live` : "Clean"}
                    </MiniPill>
                  }
                />

                <div style={{ display: "grid", gap: 8 }}>
                  {alerts.length === 0 ? (
                    <SignalRow
                      tone="green"
                      title="Portfolio looks stable"
                      detail="All open positions are live priced and none are red right now."
                      value="Clear"
                    />
                  ) : (
                    alerts.slice(0, 4).map((item) => (
                      <SignalRow
                        key={item.id}
                        tone={!item.hasLivePrice ? "amber" : "red"}
                        title={item.symbol}
                        detail={
                          !item.hasLivePrice
                            ? "No live quote returned for this holding."
                            : `${signedMoney(item.pnl)} unrealized • ${item.shares.toLocaleString(undefined, {
                                maximumFractionDigits: 4,
                              })} shares`
                        }
                        value={!item.hasLivePrice ? "Pending" : signedMoney(item.pnl)}
                      />
                    ))
                  )}
                </div>
              </GlassPane>

              <GlassPane size="card">
                <PaneHeader
                  title="Order ticket"
                  subcopy="Professional ticket layout now. It logs to your portfolio ledger until you swap in a live broker route."
                  right={<MiniPill tone="amber">Portfolio route</MiniPill>}
                />

                <div style={{ display: "grid", gap: 10 }}>
                  <Field label="Quick add symbol">
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1fr) auto",
                        gap: 8,
                      }}
                    >
                      <input
                        value={symbol}
                        onChange={(e) => setSymbol(e.target.value)}
                        placeholder="AAPL"
                        style={inputStyle()}
                      />
                      <button type="button" onClick={addAsset} style={buttonStyle()}>
                        <Plus size={14} /> Add
                      </button>
                    </div>
                  </Field>

                  <Field label="Asset">
                    <select
                      value={tradeAssetId}
                      onChange={(e) => setTradeAssetId(e.target.value)}
                      style={inputStyle()}
                    >
                      <option value="">Select asset</option>
                      {assets.map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.symbol}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      gap: 8,
                    }}
                  >
                    <Field label="Side">
                      <select
                        value={tradeType}
                        onChange={(e) => setTradeType(e.target.value)}
                        style={inputStyle()}
                      >
                        <option value="BUY">BUY</option>
                        <option value="SELL">SELL</option>
                      </select>
                    </Field>

                    <Field label="Trade date">
                      <input
                        type="date"
                        value={tradeDate}
                        onChange={(e) => setTradeDate(e.target.value)}
                        style={inputStyle()}
                      />
                    </Field>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      gap: 8,
                    }}
                  >
                    <Field label="Quantity">
                      <input
                        type="number"
                        step="0.0001"
                        value={tradeQty}
                        onChange={(e) => setTradeQty(e.target.value)}
                        placeholder="0.0000"
                        style={inputStyle()}
                      />
                    </Field>

                    <Field label="Price">
                      <input
                        type="number"
                        step="0.01"
                        value={tradePrice}
                        onChange={(e) => setTradePrice(e.target.value)}
                        placeholder="0.00"
                        style={inputStyle()}
                      />
                    </Field>
                  </div>

                  <button
                    type="button"
                    onClick={logTrade}
                    style={buttonStyle({ primary: true })}
                  >
                    Route fill to ledger <ArrowRight size={14} />
                  </button>
                </div>
              </GlassPane>

              <GlassPane size="card">
                <PaneHeader
                  title="Watchlist"
                  subcopy="Saved names with fast market access."
                  right={<MiniPill>{favorites.length} saved</MiniPill>}
                />

                <div style={{ display: "grid", gap: 8 }}>
                  {favorites.length === 0 ? (
                    <EmptyState
                      title="No saved names"
                      detail="Use the research desk to start building a serious watchlist."
                      linkHref="/investments/discover"
                      linkLabel="Go discover"
                    />
                  ) : (
                    favorites
                      .slice(0, 6)
                      .map((item) => (
                        <FavoriteRow
                          key={item.id}
                          item={item}
                          quote={prices[String(item.symbol).toUpperCase()] || null}
                        />
                      ))
                  )}
                </div>
              </GlassPane>

              <GlassPane size="card">
                <PaneHeader
                  title="Recent fills"
                  subcopy="Latest activity landing in your portfolio ledger."
                  right={<MiniPill>{recentTxns.length} shown</MiniPill>}
                />

                <div style={{ display: "grid", gap: 8 }}>
                  {recentTxns.length === 0 ? (
                    <EmptyState
                      title="No fills yet"
                      detail="Your fills will show here once you start logging trades."
                    />
                  ) : (
                    recentTxns.map((txn) => (
                      <TradeRow key={txn.id} txn={txn} assetMap={assetMap} />
                    ))
                  )}
                </div>
              </GlassPane>
            </div>
          </section>
        </div>
      </main>

      <style jsx global>{`
        .investRoot {
          position: relative;
          z-index: 1;
          padding: 18px 0 28px;
          font-family: ${FONT_STACK};
        }

        .investInner {
          width: min(100%, 1380px);
          margin: 0 auto;
          display: grid;
          gap: 14px;
        }

        .investHeroGrid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 14px;
        }

        .investMetrics {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          align-items: stretch;
        }

        .investMain {
          display: grid;
          grid-template-columns: minmax(0, 1.42fr) minmax(360px, 0.88fr);
          gap: 14px;
          align-items: start;
        }

        .investLeftCol,
        .investRightCol {
          display: grid;
          gap: 14px;
          min-width: 0;
        }

        .marketBoardGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }

        @media (max-width: 1260px) {
          .investMetrics,
          .marketBoardGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .investMain {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 860px) {
          .investRoot {
            padding: 10px 0 22px;
          }

          .investInner {
            gap: 12px;
          }

          .investHeroGrid,
          .investMetrics,
          .marketBoardGrid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
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
          minHeight: 138,
          display: "grid",
          gridTemplateRows: "auto auto 1fr",
          gap: 8,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 14,
            display: "grid",
            placeItems: "center",
            border: `1px solid ${meta.border}`,
            background: meta.iconBg,
            color: tone === "neutral" ? "#fff" : meta.text,
            boxShadow: `0 0 12px ${meta.glow}`,
          }}
        >
          <Icon size={17} />
        </div>

        <div>
          <div style={overlineStyle()}>{label}</div>
          <div
            style={{
              marginTop: 8,
              fontSize: "clamp(22px, 2.8vw, 34px)",
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

function MarketBoardCard({ symbol, label, quote, tone }) {
  const meta = toneMeta(tone);
  const price = Number.isFinite(Number(quote?.price)) ? Number(quote.price) : null;
  const change = Number.isFinite(Number(quote?.change)) ? Number(quote.change) : null;
  const changePct = Number.isFinite(Number(quote?.changesPercentage))
    ? Number(quote.changesPercentage)
    : null;

  return (
    <Link
      href={`/market/${encodeURIComponent(symbol)}`}
      style={{
        textDecoration: "none",
      }}
    >
      <div
        style={{
          minHeight: 122,
          padding: 14,
          borderRadius: 18,
          border: `1px solid ${meta.border}`,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.035), 0 0 12px ${meta.glow}`,
          display: "grid",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={overlineStyle()}>{label}</div>
            <div
              style={{
                marginTop: 6,
                fontSize: 18,
                fontWeight: 850,
                letterSpacing: "-0.03em",
                color: "#fff",
              }}
            >
              {symbol}
            </div>
          </div>

          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 10,
              display: "grid",
              placeItems: "center",
              border: `1px solid ${meta.border}`,
              background: meta.iconBg,
              color: tone === "neutral" ? "#fff" : meta.text,
            }}
          >
            {tone === "red" ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
          </div>
        </div>

        <div
          style={{
            fontSize: 22,
            lineHeight: 1,
            fontWeight: 900,
            letterSpacing: "-0.05em",
            color: tone === "neutral" ? "#fff" : meta.text,
          }}
        >
          {price != null ? money(price) : "—"}
        </div>

        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: tone === "neutral" ? "rgba(255,255,255,0.62)" : meta.text,
          }}
        >
          {change != null ? signedMoney(change) : "Waiting"}{" "}
          {changePct != null ? `• ${pct(changePct)}` : ""}
        </div>
      </div>
    </Link>
  );
}

function HoldingRow({ item }) {
  const tone = item.hasLivePrice ? toneByValue(item.pnl) : "amber";
  const meta = toneMeta(tone);

  return (
    <Link
      href={`/investments/${item.id}`}
      style={{
        display: "grid",
        gridTemplateColumns: "52px minmax(0, 1fr) auto",
        gap: 12,
        alignItems: "center",
        minHeight: 82,
        padding: "12px 14px",
        borderRadius: 18,
        textDecoration: "none",
        border: `1px solid ${meta.border}`,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.035), 0 0 12px ${meta.glow}`,
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 15,
          display: "grid",
          placeItems: "center",
          border: `1px solid ${meta.border}`,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.012))",
          color: tone === "neutral" ? "#fff" : meta.text,
          fontWeight: 900,
          fontSize: 13,
          letterSpacing: ".06em",
        }}
      >
        {initials(item.symbol)}
      </div>

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 850,
            color: "#fff",
            lineHeight: 1.2,
            overflowWrap: "anywhere",
          }}
        >
          {item.symbol}
        </div>

        <div style={{ marginTop: 4, ...mutedStyle() }}>
          {item.shares.toLocaleString(undefined, { maximumFractionDigits: 4 })} shares •{" "}
          {item.hasLivePrice ? money(item.livePrice) : "No live price"}
        </div>

        <div style={{ marginTop: 4, fontSize: 12, color: "rgba(255,255,255,0.54)" }}>
          Basis {money(item.remainingBasis)} • Day {signedMoney(item.positionDayMove)}
        </div>
      </div>

      <div style={{ textAlign: "right" }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 850,
            color: "#fff",
            whiteSpace: "nowrap",
          }}
        >
          {money(item.value)}
        </div>

        <div
          style={{
            marginTop: 3,
            fontSize: 12,
            fontWeight: 800,
            color: item.hasLivePrice ? meta.text : "rgba(255,255,255,0.58)",
            whiteSpace: "nowrap",
          }}
        >
          {item.hasLivePrice ? `${signedMoney(item.pnl)} • ${pct(item.pnlPct)}` : "Pending"}
        </div>
      </div>
    </Link>
  );
}

function HeadlineRow({ item }) {
  const symbol =
    Array.isArray(item.symbols) && item.symbols.length ? item.symbols[0] : item.symbol || "";

  return (
    <a
      href={item.url || "#"}
      target="_blank"
      rel="noreferrer"
      style={{
        textDecoration: "none",
      }}
    >
      <div
        style={{
          minHeight: 92,
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

        <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
          {symbol ? <MiniPill>{String(symbol).toUpperCase()}</MiniPill> : null}
          <div style={{ color: "rgba(255,255,255,0.52)" }}>
            <ExternalLink size={14} />
          </div>
        </div>
      </div>
    </a>
  );
}

function SignalRow({ title, detail, tone = "neutral", value }) {
  const meta = toneMeta(tone);

  return (
    <div
      style={{
        minHeight: 62,
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        gap: 10,
        alignItems: "center",
        padding: "10px 12px",
        borderRadius: 16,
        border: `1px solid ${meta.border}`,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: "#fff",
            lineHeight: 1.25,
            overflowWrap: "anywhere",
          }}
        >
          {title}
        </div>
        <div
          style={{
            marginTop: 3,
            fontSize: 12,
            color: "rgba(255,255,255,0.58)",
            lineHeight: 1.35,
          }}
        >
          {detail}
        </div>
      </div>

      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          color: tone === "neutral" ? "rgba(255,255,255,0.86)" : meta.text,
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function FavoriteRow({ item, quote }) {
  const sym = String(item.symbol || "").toUpperCase();
  const tone = toneByValue(quote?.changesPercentage ?? quote?.change ?? 0);
  const meta = toneMeta(tone);

  return (
    <Link
      href={`/market/${encodeURIComponent(sym)}`}
      style={{
        textDecoration: "none",
      }}
    >
      <div
        style={{
          minHeight: 64,
          display: "grid",
          gridTemplateColumns: "38px minmax(0, 1fr) auto",
          gap: 10,
          alignItems: "center",
          padding: "10px 12px",
          borderRadius: 16,
          border: `1px solid ${meta.border}`,
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
            border: `1px solid ${meta.border}`,
            background: meta.iconBg,
            color: tone === "neutral" ? "#fff" : meta.text,
          }}
        >
          <BookOpenText size={15} />
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 850, color: "#fff" }}>{sym}</div>
          <div style={{ marginTop: 3, fontSize: 12, color: "rgba(255,255,255,0.58)" }}>
            {item.name || item.asset_type || "Watchlist name"}
          </div>
        </div>

        <div
          style={{
            textAlign: "right",
            fontSize: 12,
            fontWeight: 800,
            color: tone === "neutral" ? "rgba(255,255,255,0.76)" : meta.text,
            whiteSpace: "nowrap",
          }}
        >
          {Number.isFinite(Number(quote?.price)) ? money(quote.price) : "—"}
        </div>
      </div>
    </Link>
  );
}

function TradeRow({ txn, assetMap }) {
  const type = String(txn.txn_type || "").toUpperCase();
  const tone = type === "SELL" ? "green" : "neutral";
  const meta = toneMeta(tone);
  const sym = assetMap.get(txn.asset_id)?.symbol || "—";

  return (
    <div
      style={{
        minHeight: 68,
        display: "grid",
        gridTemplateColumns: "42px minmax(0, 1fr) auto",
        gap: 12,
        alignItems: "center",
        padding: "10px 12px",
        borderRadius: 16,
        border: `1px solid ${meta.border}`,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 13,
          display: "grid",
          placeItems: "center",
          border: `1px solid ${meta.border}`,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.012))",
          color: type === "SELL" ? "#8ef4bb" : "#f7fbff",
          fontWeight: 900,
          fontSize: 12,
        }}
      >
        {type === "SELL" ? "S" : "B"}
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", lineHeight: 1.25 }}>
          {sym} {type}
        </div>
        <div style={{ marginTop: 3, ...mutedStyle() }}>
          {toNum(txn.qty).toLocaleString(undefined, { maximumFractionDigits: 4 })} @{" "}
          {money(txn.price)} • {shortDate(txn.txn_date)}
        </div>
      </div>

      <div
        style={{
          fontSize: 14,
          fontWeight: 800,
          color: type === "SELL" ? "#97efc7" : "#fff",
          whiteSpace: "nowrap",
        }}
      >
        {money(toNum(txn.qty) * toNum(txn.price))}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <div style={overlineStyle()}>{label}</div>
      {children}
    </label>
  );
}

function EmptyState({ title, detail, linkHref, linkLabel }) {
  return (
    <div
      style={{
        minHeight: 150,
        display: "grid",
        placeItems: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", textAlign: "center" }}>
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

        {linkHref && linkLabel ? (
          <div style={{ marginTop: 14, display: "flex", justifyContent: "center" }}>
            <ActionLink href={linkHref}>
              {linkLabel} <ArrowRight size={14} />
            </ActionLink>
          </div>
        ) : null}
      </div>
    </div>
  );
}
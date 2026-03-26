"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ExternalLink,
  Plus,
  Search,
  Star,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import GlassPane from "../../components/GlassPane";

export const dynamic = "force-dynamic";

const FONT_STACK =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const DEFAULT_UNIVERSE = {
  popularStocks: [
    { symbol: "AAPL", name: "Apple Inc.", type: "Stock", exchange: "NASDAQ" },
    { symbol: "MSFT", name: "Microsoft Corporation", type: "Stock", exchange: "NASDAQ" },
    { symbol: "NVDA", name: "NVIDIA Corporation", type: "Stock", exchange: "NASDAQ" },
    { symbol: "AMZN", name: "Amazon.com, Inc.", type: "Stock", exchange: "NASDAQ" },
    { symbol: "GOOGL", name: "Alphabet Inc.", type: "Stock", exchange: "NASDAQ" },
    { symbol: "META", name: "Meta Platforms, Inc.", type: "Stock", exchange: "NASDAQ" },
    { symbol: "TSLA", name: "Tesla, Inc.", type: "Stock", exchange: "NASDAQ" },
    { symbol: "AMD", name: "Advanced Micro Devices, Inc.", type: "Stock", exchange: "NASDAQ" },
  ],
  popularEtfs: [
    { symbol: "VOO", name: "Vanguard S&P 500 ETF", type: "ETF", exchange: "NYSE Arca" },
    { symbol: "QQQ", name: "Invesco QQQ Trust", type: "ETF", exchange: "NASDAQ" },
    { symbol: "VTI", name: "Vanguard Total Stock Market ETF", type: "ETF", exchange: "NYSE Arca" },
    { symbol: "SCHD", name: "Schwab U.S. Dividend Equity ETF", type: "ETF", exchange: "NYSE Arca" },
    { symbol: "SOXX", name: "iShares Semiconductor ETF", type: "ETF", exchange: "NASDAQ" },
    { symbol: "SPY", name: "SPDR S&P 500 ETF Trust", type: "ETF", exchange: "NYSE Arca" },
  ],
  sectorEtfs: [
    { symbol: "XLK", name: "Technology Select Sector SPDR Fund", type: "ETF", exchange: "NYSE Arca" },
    { symbol: "XLF", name: "Financial Select Sector SPDR Fund", type: "ETF", exchange: "NYSE Arca" },
    { symbol: "XLE", name: "Energy Select Sector SPDR Fund", type: "ETF", exchange: "NYSE Arca" },
    { symbol: "XLV", name: "Health Care Select Sector SPDR Fund", type: "ETF", exchange: "NYSE Arca" },
    { symbol: "XLY", name: "Consumer Discretionary Select Sector SPDR Fund", type: "ETF", exchange: "NYSE Arca" },
    { symbol: "XLI", name: "Industrial Select Sector SPDR Fund", type: "ETF", exchange: "NYSE Arca" },
  ],
};

function toNum(v, fallback = null) {
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

function quotePriceText(quote) {
  if (!quote) return "Loading";
  const price = toNum(quote.price);
  if (!Number.isFinite(price) || price <= 0) return "Pending";
  return money(price);
}

function quoteChangeText(quote) {
  if (!quote) return "Waiting on quote";

  const change = toNum(quote.change);
  const pct = toNum(quote.changesPercentage);

  if (!Number.isFinite(change) && !Number.isFinite(pct)) return "Live quote";
  if (!Number.isFinite(change) && Number.isFinite(pct)) {
    return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
  }
  if (Number.isFinite(change) && !Number.isFinite(pct)) {
    return `${change >= 0 ? "+" : ""}${money(change)}`;
  }
  return `${change >= 0 ? "+" : ""}${money(change)} • ${
    pct >= 0 ? "+" : ""
  }${pct.toFixed(2)}%`;
}

function toneByChange(value) {
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

function parseBatchPrices(json) {
  const out = {};

  function assign(symbol, raw) {
    const sym = String(symbol || "").trim().toUpperCase();
    if (!sym) return;

    if (typeof raw === "number") {
      out[sym] = {
        price: toNum(raw),
        change: null,
        changesPercentage: null,
      };
      return;
    }

    if (raw && typeof raw === "object") {
      out[sym] = {
        price: toNum(raw.price),
        change: toNum(raw.change),
        changesPercentage: toNum(
          raw.changesPercentage ?? raw.changePercent ?? raw.percent_change
        ),
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

function AssetCard({
  item,
  quote,
  owned,
  favorited,
  busy,
  onToggleFavorite,
  onAddAsset,
  onOpenMarket,
}) {
  const tone = toneByChange(quote?.changesPercentage ?? quote?.change ?? 0);
  const meta = toneMeta(tone);

  return (
    <GlassPane tone={tone} size="card" style={{ height: "100%" }}>
      <div
        style={{
          minHeight: 218,
          display: "grid",
          gridTemplateRows: "auto auto 1fr auto",
          gap: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "start",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={overlineStyle()}>{item.type}</div>
            <div
              style={{
                marginTop: 6,
                fontSize: 18,
                fontWeight: 850,
                letterSpacing: "-0.03em",
                color: "#fff",
                overflowWrap: "anywhere",
              }}
            >
              {item.symbol}
            </div>
          </div>

          <MiniPill tone={tone}>{owned ? "Owned" : "Watch"}</MiniPill>
        </div>

        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "rgba(255,255,255,0.88)",
              lineHeight: 1.35,
              overflowWrap: "anywhere",
            }}
          >
            {item.name}
          </div>
          <div style={{ marginTop: 4, ...mutedStyle() }}>{item.exchange}</div>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <div
            style={{
              fontSize: 26,
              fontWeight: 850,
              letterSpacing: "-0.05em",
              color: tone === "neutral" ? "#fff" : meta.text,
            }}
          >
            {quotePriceText(quote)}
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: tone === "neutral" ? "rgba(255,255,255,0.64)" : meta.text,
              lineHeight: 1.35,
            }}
          >
            {quoteChangeText(quote)}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={onAddAsset}
            disabled={busy || owned}
            style={buttonStyle(owned || busy)}
          >
            <Plus size={14} />
            {owned ? "Added" : "Add"}
          </button>

          <button
            type="button"
            onClick={onToggleFavorite}
            disabled={busy}
            style={buttonStyle(busy)}
          >
            <Star size={14} />
            {favorited ? "Saved" : "Save"}
          </button>

          <Link href={onOpenMarket} style={marketBtnStyle()}>
            <ExternalLink size={14} />
            Open
          </Link>
        </div>
      </div>
    </GlassPane>
  );
}

function UniverseSection({
  title,
  sub,
  items,
  prices,
  savedSymbols,
  favorites,
  addingSymbol,
  favoriteSymbol,
  onAddAsset,
  onAddFavorite,
  onRemoveFavorite,
}) {
  return (
    <GlassPane size="card">
      <PaneHeader title={title} subcopy={sub} right={<MiniPill>{items.length} items</MiniPill>} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 12,
        }}
      >
        {items.map((item) => {
          const sym = String(item.symbol || "").toUpperCase();
          const alreadyOwned = savedSymbols.includes(sym);
          const alreadyFavorite = favorites.some(
            (f) => String(f.symbol || "").toUpperCase() === sym
          );

          return (
            <AssetCard
              key={sym}
              item={item}
              quote={prices[sym] || null}
              owned={alreadyOwned}
              favorited={alreadyFavorite}
              busy={addingSymbol === sym || favoriteSymbol === sym}
              onToggleFavorite={() =>
                alreadyFavorite ? onRemoveFavorite(sym) : onAddFavorite(item)
              }
              onAddAsset={() => onAddAsset(item)}
              onOpenMarket={`/market/${encodeURIComponent(item.symbol)}`}
            />
          );
        })}
      </div>
    </GlassPane>
  );
}

export default function DiscoverInvestmentsPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [savedSymbols, setSavedSymbols] = useState([]);
  const [prices, setPrices] = useState({});
  const [loadingResults, setLoadingResults] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [addingSymbol, setAddingSymbol] = useState("");
  const [favoriteSymbol, setFavoriteSymbol] = useState("");

  const defaultUniverse = useMemo(() => {
    return [
      ...DEFAULT_UNIVERSE.popularStocks,
      ...DEFAULT_UNIVERSE.popularEtfs,
      ...DEFAULT_UNIVERSE.sectorEtfs,
    ];
  }, []);

  const searchMode = query.trim().length >= 2;

  useEffect(() => {
    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const [assetRes, favoriteRes] = await Promise.all([
        supabase.from("investment_assets").select("symbol").eq("user_id", user.id),
        supabase
          .from("investment_favorites")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      if (assetRes.error || favoriteRes.error) {
        console.error(assetRes.error || favoriteRes.error);
        setError("Failed loading discover data.");
        return;
      }

      setSavedSymbols((assetRes.data || []).map((x) => String(x.symbol || "").toUpperCase()));
      setFavorites(favoriteRes.data || []);
    }

    loadData();
  }, []);

  useEffect(() => {
    if (!searchMode) {
      setResults([]);
      setLoadingResults(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoadingResults(true);
      setError("");

      try {
        const res = await fetch(
          `/api/market-search?query=${encodeURIComponent(query)}&type=ALL&limit=24`,
          { cache: "no-store" }
        );
        const data = await res.json();

        if (!res.ok) throw new Error(data?.error || "Failed to search market.");
        setResults(Array.isArray(data?.results) ? data.results : []);
      } catch (err) {
        console.error(err);
        setResults([]);
        setError(err?.message || "Failed to search market.");
      } finally {
        setLoadingResults(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, searchMode]);

  const activeRows = useMemo(() => {
    return searchMode ? results : defaultUniverse;
  }, [searchMode, results, defaultUniverse]);

  useEffect(() => {
    async function loadPrices() {
      const symbols = [
        ...new Set(
          [
            ...activeRows.map((x) => String(x.symbol || "").toUpperCase()),
            ...favorites.map((x) => String(x.symbol || "").toUpperCase()),
          ].filter(Boolean)
        ),
      ];

      if (!symbols.length) {
        setPrices({});
        return;
      }

      const nextPrices = {};

      try {
        const batchRes = await fetch(
          `/api/prices-batch?symbols=${encodeURIComponent(symbols.join(","))}`,
          { cache: "no-store" }
        );
        const batchData = await batchRes.json();

        if (batchRes.ok) {
          Object.assign(nextPrices, parseBatchPrices(batchData));
        }
      } catch (err) {
        console.error("batch price fetch failed", err);
      }

      const missing = symbols.filter((sym) => {
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

              if (res.ok) {
                nextPrices[sym] = {
                  price: toNum(data?.price),
                  change: toNum(data?.change),
                  changesPercentage: toNum(
                    data?.changesPercentage ?? data?.changePercent ?? data?.percent_change
                  ),
                };
              }
            } catch (err) {
              console.error(`single price fetch failed for ${sym}`, err);
            }
          })
        );
      }

      setPrices(nextPrices);
    }

    loadPrices();
  }, [activeRows, favorites]);

  const stats = useMemo(() => {
    const ownedMatches = activeRows.filter((x) =>
      savedSymbols.includes(String(x.symbol || "").toUpperCase())
    ).length;

    const favoriteMatches = activeRows.filter((x) =>
      favorites.some(
        (f) => String(f.symbol || "").toUpperCase() === String(x.symbol || "").toUpperCase()
      )
    ).length;

    const etfs = activeRows.filter((x) => String(x.type || "").toUpperCase() === "ETF").length;

    return {
      showing: activeRows.length,
      ownedMatches,
      favoriteMatches,
      etfs,
    };
  }, [activeRows, savedSymbols, favorites]);

  async function addAsset(item) {
    setStatus("");
    setError("");
    setAddingSymbol(item.symbol);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("You must be logged in.");
        setAddingSymbol("");
        return;
      }

      const symbol = String(item.symbol || "").toUpperCase().trim();

      if (!symbol) {
        setError("Invalid symbol.");
        setAddingSymbol("");
        return;
      }

      if (savedSymbols.includes(symbol)) {
        setError(`${symbol} is already in your portfolio.`);
        setAddingSymbol("");
        return;
      }

      const { data, error } = await supabase
        .from("investment_assets")
        .insert({
          user_id: user.id,
          symbol,
          name: item.name,
          asset_type: String(item.type || "").toUpperCase() === "ETF" ? "etf" : "stock",
          account: "Main",
        })
        .select()
        .single();

      if (error) {
        console.error(error);
        setError(`Could not add ${symbol}.`);
        setAddingSymbol("");
        return;
      }

      setSavedSymbols((prev) => [...prev, String(data.symbol || "").toUpperCase()]);
      setStatus(`${data.symbol} added to portfolio.`);
    } catch (err) {
      console.error(err);
      setError("Something went wrong adding the asset.");
    }

    setAddingSymbol("");
  }

  async function addFavorite(item) {
    setStatus("");
    setError("");
    setFavoriteSymbol(item.symbol);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("You must be logged in.");
        setFavoriteSymbol("");
        return;
      }

      const symbol = String(item.symbol || "").toUpperCase().trim();

      if (!symbol) {
        setError("Invalid symbol.");
        setFavoriteSymbol("");
        return;
      }

      const alreadyFavorite = favorites.some(
        (f) => String(f.symbol || "").toUpperCase() === symbol
      );

      if (alreadyFavorite) {
        setError(`${symbol} is already in favorites.`);
        setFavoriteSymbol("");
        return;
      }

      const { data, error } = await supabase
        .from("investment_favorites")
        .insert({
          user_id: user.id,
          symbol,
          name: item.name,
          asset_type: String(item.type || "").toUpperCase() === "ETF" ? "etf" : "stock",
        })
        .select()
        .single();

      if (error) {
        console.error(error);
        setError(`Could not favorite ${symbol}.`);
        setFavoriteSymbol("");
        return;
      }

      setFavorites((prev) => [data, ...prev]);
      setStatus(`${data.symbol} added to favorites.`);
    } catch (err) {
      console.error(err);
      setError("Something went wrong adding the favorite.");
    }

    setFavoriteSymbol("");
  }

  async function removeFavoriteBySymbol(symbol) {
    setStatus("");
    setError("");
    setFavoriteSymbol(symbol);

    const favorite = favorites.find(
      (f) => String(f.symbol || "").toUpperCase() === String(symbol || "").toUpperCase()
    );

    if (!favorite) {
      setFavoriteSymbol("");
      return;
    }

    const { error } = await supabase.from("investment_favorites").delete().eq("id", favorite.id);

    if (error) {
      console.error(error);
      setError(`Could not remove ${symbol} from favorites.`);
      setFavoriteSymbol("");
      return;
    }

    setFavorites((prev) => prev.filter((f) => f.id !== favorite.id));
    setStatus(`${symbol} removed from favorites.`);
    setFavoriteSymbol("");
  }

  return (
    <>
      <main className="discoverRoot">
        <div className="discoverInner">
          <GlassPane size="card">
            <div className="discoverHeroGrid">
              <div style={{ minWidth: 0 }}>
                <div style={overlineStyle()}>Investments Discover</div>

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
                  Discover Market Assets
                </div>

                <div style={{ marginTop: 10, ...mutedStyle(), maxWidth: 760 }}>
                  Search public symbols fast, scan your core universe, and add holdings or
                  favorites without ugly heavy cards.
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
                <MiniPill>{searchMode ? "Search mode" : "Default universe"}</MiniPill>
                <ActionLink href="/investments">
                  Overview <ArrowRight size={14} />
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

          <section className="discoverMetrics">
            <MetricCard label="Visible Results" value={String(stats.showing)} detail="Current result count on the board." />
            <MetricCard label="Owned Matches" value={String(stats.ownedMatches)} detail="Symbols already sitting in your portfolio." />
            <MetricCard label="Favorites" value={String(stats.favoriteMatches)} detail="Visible rows already saved to favorites." />
            <MetricCard label="ETF Count" value={String(stats.etfs)} detail="ETF rows in the current visible set." />
          </section>

          <GlassPane size="card">
            <PaneHeader
              title="Search Market"
              subcopy="Use ticker or company name. Search opens after 2 characters."
              right={<MiniPill>{searchMode ? "Live search" : "Ready"}</MiniPill>}
            />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto",
                gap: 10,
              }}
            >
              <div style={{ position: "relative" }}>
                <Search
                  size={16}
                  style={{
                    position: "absolute",
                    left: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "rgba(255,255,255,0.46)",
                  }}
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by ticker or company name..."
                  style={{
                    ...inputStyle(),
                    paddingLeft: 40,
                  }}
                />
              </div>

              <button
                type="button"
                onClick={() => setQuery("")}
                style={buttonStyle(false)}
              >
                Clear
              </button>
            </div>
          </GlassPane>

          {searchMode ? (
            <GlassPane size="card">
              <PaneHeader
                title="Search Results"
                subcopy={
                  loadingResults
                    ? "Searching live market results."
                    : `Matches: ${results.length}`
                }
              />

              {results.length ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                    gap: 12,
                  }}
                >
                  {results.map((item) => {
                    const sym = String(item.symbol || "").toUpperCase();
                    const alreadyOwned = savedSymbols.includes(sym);
                    const alreadyFavorite = favorites.some(
                      (f) => String(f.symbol || "").toUpperCase() === sym
                    );

                    return (
                      <AssetCard
                        key={`${item.symbol}-${item.exchange}`}
                        item={item}
                        quote={prices[sym] || null}
                        owned={alreadyOwned}
                        favorited={alreadyFavorite}
                        busy={addingSymbol === sym || favoriteSymbol === sym}
                        onToggleFavorite={() =>
                          alreadyFavorite
                            ? removeFavoriteBySymbol(sym)
                            : addFavorite(item)
                        }
                        onAddAsset={() => addAsset(item)}
                        onOpenMarket={`/market/${encodeURIComponent(item.symbol)}`}
                      />
                    );
                  })}
                </div>
              ) : loadingResults ? (
                <EmptyState
                  title="Searching..."
                  detail="Pulling live symbols from your market provider."
                />
              ) : (
                <EmptyState
                  title="No matches found"
                  detail="Try a ticker or company name."
                />
              )}
            </GlassPane>
          ) : (
            <>
              <UniverseSection
                title="Popular Stocks"
                sub="Core high-interest names people usually track first."
                items={DEFAULT_UNIVERSE.popularStocks}
                prices={prices}
                savedSymbols={savedSymbols}
                favorites={favorites}
                addingSymbol={addingSymbol}
                favoriteSymbol={favoriteSymbol}
                onAddAsset={addAsset}
                onAddFavorite={addFavorite}
                onRemoveFavorite={removeFavoriteBySymbol}
              />

              <UniverseSection
                title="Popular ETFs"
                sub="Broad market and growth ETF names for fast portfolio setup."
                items={DEFAULT_UNIVERSE.popularEtfs}
                prices={prices}
                savedSymbols={savedSymbols}
                favorites={favorites}
                addingSymbol={addingSymbol}
                favoriteSymbol={favoriteSymbol}
                onAddAsset={addAsset}
                onAddFavorite={addFavorite}
                onRemoveFavorite={removeFavoriteBySymbol}
              />

              <UniverseSection
                title="Sector ETFs"
                sub="Focused sector coverage when you want a tighter theme or tilt."
                items={DEFAULT_UNIVERSE.sectorEtfs}
                prices={prices}
                savedSymbols={savedSymbols}
                favorites={favorites}
                addingSymbol={addingSymbol}
                favoriteSymbol={favoriteSymbol}
                onAddAsset={addAsset}
                onAddFavorite={addFavorite}
                onRemoveFavorite={removeFavoriteBySymbol}
              />
            </>
          )}
        </div>
      </main>

      <style jsx global>{`
        .discoverRoot {
          position: relative;
          z-index: 1;
          padding: 18px 0 28px;
          font-family: ${FONT_STACK};
        }

        .discoverInner {
          width: min(100%, 1320px);
          margin: 0 auto;
          display: grid;
          gap: 14px;
        }

        .discoverHeroGrid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 14px;
        }

        .discoverMetrics {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          align-items: stretch;
        }

        @media (max-width: 1260px) {
          .discoverMetrics {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 860px) {
          .discoverRoot {
            padding: 10px 0 22px;
          }

          .discoverInner {
            gap: 12px;
          }

          .discoverHeroGrid {
            grid-template-columns: 1fr;
          }

          .discoverMetrics {
            grid-template-columns: 1fr;
            gap: 10px;
          }
        }
      `}</style>
    </>
  );
}

function MetricCard({ label, value, detail }) {
  return (
    <GlassPane size="card" style={{ height: "100%" }}>
      <div
        style={{
          minHeight: 120,
          display: "grid",
          gridTemplateRows: "auto auto 1fr",
          gap: 8,
        }}
      >
        <div style={overlineStyle()}>{label}</div>

        <div
          style={{
            fontSize: "clamp(22px, 2.8vw, 34px)",
            lineHeight: 1,
            fontWeight: 850,
            letterSpacing: "-0.05em",
            color: "#fff",
            overflowWrap: "anywhere",
          }}
        >
          {value}
        </div>

        <div style={mutedStyle()}>{detail}</div>
      </div>
    </GlassPane>
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

function buttonStyle(disabled = false) {
  return {
    minHeight: 40,
    padding: "0 12px",
    borderRadius: 14,
    border: "1px solid rgba(214,226,255,0.10)",
    background: disabled
      ? "rgba(255,255,255,0.03)"
      : "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012))",
    color: disabled ? "rgba(255,255,255,0.42)" : "#f7fbff",
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

function marketBtnStyle() {
  return {
    minHeight: 40,
    padding: "0 12px",
    borderRadius: 14,
    border: "1px solid rgba(214,226,255,0.10)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012))",
    color: "#f7fbff",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    fontWeight: 800,
    fontSize: 13,
    textDecoration: "none",
  };
}
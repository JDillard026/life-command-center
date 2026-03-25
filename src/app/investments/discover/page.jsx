"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const DISPLAY_FONT = 'Georgia, "Times New Roman", serif';

const DEFAULT_UNIVERSE = {
  popularStocks: [
    { symbol: "AAPL", name: "Apple Inc.", type: "Stock", exchange: "NASDAQ", currency: "USD" },
    { symbol: "MSFT", name: "Microsoft Corporation", type: "Stock", exchange: "NASDAQ", currency: "USD" },
    { symbol: "NVDA", name: "NVIDIA Corporation", type: "Stock", exchange: "NASDAQ", currency: "USD" },
    { symbol: "AMZN", name: "Amazon.com, Inc.", type: "Stock", exchange: "NASDAQ", currency: "USD" },
    { symbol: "GOOGL", name: "Alphabet Inc.", type: "Stock", exchange: "NASDAQ", currency: "USD" },
    { symbol: "META", name: "Meta Platforms, Inc.", type: "Stock", exchange: "NASDAQ", currency: "USD" },
    { symbol: "TSLA", name: "Tesla, Inc.", type: "Stock", exchange: "NASDAQ", currency: "USD" },
    { symbol: "AVGO", name: "Broadcom Inc.", type: "Stock", exchange: "NASDAQ", currency: "USD" },
    { symbol: "JPM", name: "JPMorgan Chase & Co.", type: "Stock", exchange: "NYSE", currency: "USD" },
    { symbol: "COST", name: "Costco Wholesale Corporation", type: "Stock", exchange: "NASDAQ", currency: "USD" },
    { symbol: "AMD", name: "Advanced Micro Devices, Inc.", type: "Stock", exchange: "NASDAQ", currency: "USD" },
    { symbol: "NFLX", name: "Netflix, Inc.", type: "Stock", exchange: "NASDAQ", currency: "USD" },
  ],
  popularEtfs: [
    { symbol: "SPY", name: "SPDR S&P 500 ETF Trust", type: "ETF", exchange: "NYSE Arca", currency: "USD" },
    { symbol: "VOO", name: "Vanguard S&P 500 ETF", type: "ETF", exchange: "NYSE Arca", currency: "USD" },
    { symbol: "IVV", name: "iShares Core S&P 500 ETF", type: "ETF", exchange: "NYSE Arca", currency: "USD" },
    { symbol: "QQQ", name: "Invesco QQQ Trust", type: "ETF", exchange: "NASDAQ", currency: "USD" },
    { symbol: "VTI", name: "Vanguard Total Stock Market ETF", type: "ETF", exchange: "NYSE Arca", currency: "USD" },
    { symbol: "SCHD", name: "Schwab U.S. Dividend Equity ETF", type: "ETF", exchange: "NYSE Arca", currency: "USD" },
    { symbol: "DIA", name: "SPDR Dow Jones Industrial Average ETF Trust", type: "ETF", exchange: "NYSE Arca", currency: "USD" },
    { symbol: "IWM", name: "iShares Russell 2000 ETF", type: "ETF", exchange: "NYSE Arca", currency: "USD" },
    { symbol: "SOXX", name: "iShares Semiconductor ETF", type: "ETF", exchange: "NASDAQ", currency: "USD" },
  ],
  sectorEtfs: [
    { symbol: "XLK", name: "Technology Select Sector SPDR Fund", type: "ETF", exchange: "NYSE Arca", currency: "USD" },
    { symbol: "XLF", name: "Financial Select Sector SPDR Fund", type: "ETF", exchange: "NYSE Arca", currency: "USD" },
    { symbol: "XLE", name: "Energy Select Sector SPDR Fund", type: "ETF", exchange: "NYSE Arca", currency: "USD" },
    { symbol: "XLV", name: "Health Care Select Sector SPDR Fund", type: "ETF", exchange: "NYSE Arca", currency: "USD" },
    { symbol: "XLY", name: "Consumer Discretionary Select Sector SPDR Fund", type: "ETF", exchange: "NYSE Arca", currency: "USD" },
    { symbol: "XLP", name: "Consumer Staples Select Sector SPDR Fund", type: "ETF", exchange: "NYSE Arca", currency: "USD" },
    { symbol: "XLI", name: "Industrial Select Sector SPDR Fund", type: "ETF", exchange: "NYSE Arca", currency: "USD" },
    { symbol: "XLU", name: "Utilities Select Sector SPDR Fund", type: "ETF", exchange: "NYSE Arca", currency: "USD" },
  ],
};

function money(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
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
  return `${change >= 0 ? "+" : ""}${money(change)} • ${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

function toneByChange(value) {
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
  if (tone === "violet") {
    return {
      border: "rgba(176, 122, 255, 0.18)",
      glow: "rgba(176, 122, 255, 0.10)",
      accent: "#ddc1ff",
      top: "rgba(176, 122, 255, 0.10)",
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

function pill(active = false) {
  return {
    height: 40,
    padding: "0 16px",
    borderRadius: 999,
    border: active
      ? "1px solid rgba(255,255,255,.28)"
      : "1px solid rgba(255,255,255,.10)",
    background: active
      ? "linear-gradient(180deg, rgba(255,255,255,.94) 0%, rgba(236,241,248,.88) 100%)"
      : "linear-gradient(180deg, rgba(255,255,255,.08) 0%, rgba(255,255,255,.04) 100%)",
    color: active ? "#0b1220" : "rgba(255,255,255,.92)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    fontWeight: 800,
    fontSize: 14,
    whiteSpace: "nowrap",
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

function inputBase() {
  return {
    height: 50,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(255,255,255,.05)",
    color: "rgba(255,255,255,.96)",
    padding: "0 14px",
    outline: "none",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,.04)",
  };
}

export default function DiscoverInvestmentsPage() {
  const [query, setQuery] = useState("");
  const [savedSymbols, setSavedSymbols] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [results, setResults] = useState([]);
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

      const { data: assetData, error: assetError } = await supabase
        .from("investment_assets")
        .select("symbol")
        .eq("user_id", user.id);

      const { data: favoriteData, error: favoriteError } = await supabase
        .from("investment_favorites")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (assetError || favoriteError) {
        console.error(assetError || favoriteError);
        setError("Failed loading discover data.");
        return;
      }

      setSavedSymbols((assetData || []).map((x) => String(x.symbol || "").toUpperCase()));
      setFavorites(favoriteData || []);
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
          `/api/market-search?query=${encodeURIComponent(query)}&type=ALL&limit=24`
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
          ]
        ),
      ].filter(Boolean);

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

        if (batchRes.ok && batchData?.prices && typeof batchData.prices === "object") {
          for (const sym of Object.keys(batchData.prices)) {
            const raw = batchData.prices[sym];

            if (raw && typeof raw === "object") {
              nextPrices[sym] = {
                price: toNum(raw.price),
                change: toNum(raw.change),
                changesPercentage: toNum(
                  raw.changesPercentage ?? raw.changePercent ?? raw.percent_change
                ),
              };
            } else {
              nextPrices[sym] = {
                price: toNum(raw),
                change: null,
                changesPercentage: null,
              };
            }
          }
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

      setPrices((prev) => ({ ...prev, ...nextPrices }));
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

      setSavedSymbols((prev) => [...prev, symbol]);
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

      const alreadyFavorite = favorites.some((f) => String(f.symbol || "").toUpperCase() === symbol);

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
    <main style={pageShell()}>
      <style jsx>{`
        input::placeholder {
          color: rgba(255, 255, 255, 0.42);
        }
      `}</style>

      <section style={heroRail()}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 18,
            alignItems: "start",
          }}
        >
          <div>
            <div style={overlineStyle("rgba(190,255,223,.84)")}>Life Command Center</div>

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
              Discover Market Assets
            </h1>

            <div
              style={{
                marginTop: 14,
                maxWidth: 780,
                fontSize: 15,
                lineHeight: 1.7,
                color: "rgba(255,255,255,.76)",
              }}
            >
              Search public symbols fast, scan your core universe, and add holdings or favorites
              without ugly heavy cards.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Link href="/investments" style={pill(false)}>
              Portfolio
            </Link>
          </div>
        </div>
      </section>

      {(status || error) && (
        <section
          style={{
            ...glass(error ? "bad" : "good", 22),
            padding: "12px 16px",
            marginTop: 14,
          }}
        >
          <div style={{ fontWeight: 800, color: error ? "#ffcade" : "#dffff1" }}>
            {error || status}
          </div>
        </section>
      )}

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1.7fr) minmax(320px,.9fr)",
          gap: 14,
          marginTop: 14,
        }}
      >
        <div style={{ ...glass("neutral", 30), padding: 20 }}>
          <div
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: 22,
              fontWeight: 700,
              color: "rgba(255,255,255,.96)",
            }}
          >
            Market Universe
          </div>
          <div style={{ marginTop: 6, fontSize: 14, color: "rgba(255,255,255,.66)" }}>
            Curated default universe loaded on first open.
          </div>

          <div style={{ marginTop: 16 }}>
            <input
              style={{ ...inputBase(), width: "100%" }}
              placeholder="Search AAPL, Apple, VOO, Nvidia..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div style={{ marginTop: 10, fontSize: 13, color: "rgba(255,255,255,.58)" }}>
            {loadingResults
              ? "Searching live market symbols..."
              : searchMode
                ? `Matches: ${results.length}`
                : "Showing your default market universe."}
          </div>
        </div>

        <div style={{ ...glass("neutral", 30), padding: 20 }}>
          <div
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: 22,
              fontWeight: 700,
              color: "rgba(255,255,255,.96)",
            }}
          >
            Scanner Snapshot
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 12,
              marginTop: 18,
            }}
          >
            <StatMini title="Showing" value={String(stats.showing)} />
            <StatMini title="Owned" value={String(stats.ownedMatches)} tone="good" />
            <StatMini title="Favs" value={String(stats.favoriteMatches)} tone="violet" />
            <StatMini title="ETFs" value={String(stats.etfs)} />
          </div>
        </div>
      </section>

      <section
        style={{
          ...glass("neutral", 30),
          padding: 20,
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
          Favorites
        </div>
        <div style={{ marginTop: 6, fontSize: 14, color: "rgba(255,255,255,.66)" }}>
          Quick-access symbols pinned from Discover.
        </div>

        <div style={{ marginTop: 16 }}>
          {favorites.length ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 12,
              }}
            >
              {favorites.slice(0, 8).map((f) => {
                const sym = String(f.symbol || "").toUpperCase();
                const quote = prices[sym] || null;

                return (
                  <AssetCard
                    key={f.id}
                    item={{
                      symbol: sym,
                      name: f.name || sym,
                      type: String(f.asset_type || "").toUpperCase() === "ETF" ? "ETF" : "Stock",
                      exchange: "Saved",
                    }}
                    quote={quote}
                    owned={savedSymbols.includes(sym)}
                    favorited
                    busy={favoriteSymbol === sym}
                    onToggleFavorite={() => removeFavoriteBySymbol(sym)}
                    onAddAsset={() => {}}
                    onOpenMarket={`/market/${encodeURIComponent(sym)}`}
                    addDisabled
                    favoriteLabel="Remove"
                  />
                );
              })}
            </div>
          ) : (
            <EmptyState title="No favorites yet" sub="Favorite any symbol below to pin it here." />
          )}
        </div>
      </section>

      {!searchMode ? (
        <div style={{ display: "grid", gap: 14, marginTop: 14 }}>
          <UniverseSection
            title="Popular Stocks"
            sub="Big names most people actually care about first."
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
            sub="Core broad market funds and index favorites."
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
            sub="Fast sector exposure without picking individual names."
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
        </div>
      ) : (
        <section
          style={{
            ...glass("neutral", 30),
            padding: 20,
            marginTop: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <div>
              <div style={{ fontWeight: 950, fontSize: 22 }}>Search Results</div>
              <div style={{ marginTop: 6, fontSize: 14, color: "rgba(255,255,255,.66)" }}>
                Live market results for your query.
              </div>
            </div>

            <div style={{ fontSize: 13, color: "rgba(255,255,255,.58)" }}>
              Matches: {results.length}
            </div>
          </div>

          {results.length ? (
            <div style={{ display: "grid", gap: 12 }}>
              {results.map((item) => {
                const sym = String(item.symbol || "").toUpperCase();
                const alreadyOwned = savedSymbols.includes(sym);
                const alreadyFavorite = favorites.some(
                  (f) => String(f.symbol || "").toUpperCase() === sym
                );
                const isAdding = addingSymbol === sym;
                const isFavBusy = favoriteSymbol === sym;
                const quote = prices[sym] || null;

                return (
                  <SearchRow
                    key={`${item.symbol}-${item.exchange}`}
                    item={item}
                    quote={quote}
                    owned={alreadyOwned}
                    favorited={alreadyFavorite}
                    addBusy={isAdding}
                    favoriteBusy={isFavBusy}
                    onAddAsset={() => addAsset(item)}
                    onToggleFavorite={() =>
                      alreadyFavorite ? removeFavoriteBySymbol(sym) : addFavorite(item)
                    }
                  />
                );
              })}
            </div>
          ) : loadingResults ? (
            <EmptyState title="Searching..." sub="Pulling live symbols from your market provider." />
          ) : (
            <EmptyState title="No matches found" sub="Try a ticker or company name." />
          )}
        </section>
      )}
    </main>
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
    <section style={{ ...glass("neutral", 30), padding: 20 }}>
      <div style={{ fontWeight: 950, fontSize: 22 }}>{title}</div>
      <div style={{ marginTop: 6, fontSize: 14, color: "rgba(255,255,255,.66)" }}>{sub}</div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 12,
          marginTop: 16,
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
    </section>
  );
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
  addDisabled = false,
  favoriteLabel,
}) {
  const tone = toneByChange(quote?.change);

  return (
    <div
      style={{
        ...glass(tone, 24),
        padding: 16,
        minHeight: 250,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "start",
        }}
      >
        <div>
          <div style={{ fontWeight: 950, fontSize: 18 }}>{item.symbol}</div>
          <div style={{ marginTop: 4, fontSize: 12, color: "rgba(255,255,255,.58)" }}>
            {item.type} • {item.exchange}
          </div>
        </div>

        <button style={actionBtn(false)} onClick={onToggleFavorite} disabled={busy}>
          {busy ? "..." : favoriteLabel || (favorited ? "Saved" : "Favorite")}
        </button>
      </div>

      <div
        style={{
          marginTop: 12,
          minHeight: 44,
          fontSize: 15,
          lineHeight: 1.45,
          fontWeight: 700,
          color: "rgba(255,255,255,.90)",
        }}
      >
        {item.name}
      </div>

      <div
        style={{
          marginTop: 14,
          padding: 12,
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,.07)",
          background: "rgba(255,255,255,.03)",
        }}
      >
        <div style={overlineStyle("rgba(255,255,255,.42)")}>Live Price</div>
        <div
          style={{
            marginTop: 8,
            fontFamily: DISPLAY_FONT,
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: "-0.04em",
          }}
        >
          {quotePriceText(quote)}
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            color:
              tone === "good"
                ? "#9df4cb"
                : tone === "bad"
                  ? "#ffbdd0"
                  : "rgba(255,255,255,.58)",
          }}
        >
          {quoteChangeText(quote)}
        </div>
      </div>

      <div style={{ marginTop: "auto", display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 14 }}>
        <Link href={onOpenMarket} style={actionBtn(false)}>
          Market
        </Link>

        <button
          style={actionBtn(true)}
          onClick={onAddAsset}
          disabled={owned || busy || addDisabled}
        >
          {owned ? "Added" : busy ? "..." : "Add"}
        </button>
      </div>
    </div>
  );
}

function SearchRow({
  item,
  quote,
  owned,
  favorited,
  addBusy,
  favoriteBusy,
  onAddAsset,
  onToggleFavorite,
}) {
  const tone = toneByChange(quote?.change);

  return (
    <div style={{ ...glass(tone, 24), padding: 16 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1.2fr) minmax(220px,.8fr) auto",
          gap: 16,
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ fontWeight: 950, fontSize: 22, letterSpacing: "-0.03em" }}>
              {item.symbol}
            </div>
            <Tag>{item.type || "Stock"}</Tag>
            <Tag>{item.exchange || "—"}</Tag>
            {favorited ? <Tag tone="good">Favorited</Tag> : null}
          </div>

          <div
            style={{
              marginTop: 10,
              fontSize: 16,
              fontWeight: 800,
              color: "rgba(255,255,255,.92)",
            }}
          >
            {item.name}
          </div>

          <div
            style={{
              marginTop: 8,
              fontSize: 13,
              color:
                tone === "good"
                  ? "#9df4cb"
                  : tone === "bad"
                    ? "#ffbdd0"
                    : "rgba(255,255,255,.58)",
            }}
          >
            {quoteChangeText(quote)}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 10,
          }}
        >
          <InfoMini label="Live Price" value={quotePriceText(quote)} tone={tone} />
          <InfoMini label="Status" value={owned ? "Owned" : favorited ? "Favorite" : "Available"} />
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Link href={`/market/${encodeURIComponent(item.symbol)}`} style={actionBtn(false)}>
            View Market
          </Link>

          <button style={actionBtn(false)} onClick={onToggleFavorite} disabled={favoriteBusy}>
            {favoriteBusy ? "Working..." : favorited ? "Unfavorite" : "Favorite"}
          </button>

          <button style={actionBtn(true)} onClick={onAddAsset} disabled={owned || addBusy}>
            {owned ? "Added" : addBusy ? "Adding..." : "Add Asset"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatMini({ title, value, tone = "neutral" }) {
  return (
    <div style={{ ...glass(tone, 22), padding: 14, minHeight: 90 }}>
      <div style={overlineStyle("rgba(255,255,255,.42)")}>{title}</div>
      <div
        style={{
          marginTop: 10,
          fontFamily: DISPLAY_FONT,
          fontSize: 20,
          fontWeight: 700,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function InfoMini({ label, value, tone = "neutral" }) {
  return (
    <div style={{ ...glass(tone, 20), padding: 12 }}>
      <div style={overlineStyle("rgba(255,255,255,.42)")}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 14, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function Tag({ children, tone = "neutral" }) {
  const t = toneVars(tone);

  return (
    <span
      style={{
        height: 26,
        padding: "0 10px",
        borderRadius: 999,
        border: `1px solid ${t.border}`,
        background: "rgba(255,255,255,.04)",
        color: tone === "good" ? "#9df4cb" : t.accent,
        display: "inline-flex",
        alignItems: "center",
        fontSize: 11,
        fontWeight: 800,
      }}
    >
      {children}
    </span>
  );
}

function EmptyState({ title, sub }) {
  return (
    <div style={{ ...glass("neutral", 22), padding: 20, textAlign: "center" }}>
      <div style={{ fontWeight: 800, fontSize: 16, color: "rgba(255,255,255,.94)" }}>{title}</div>
      <div
        style={{
          marginTop: 8,
          fontSize: 14,
          lineHeight: 1.6,
          color: "rgba(255,255,255,.62)",
        }}
      >
        {sub}
      </div>
    </div>
  );
}
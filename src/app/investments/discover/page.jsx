"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

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
  return num.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function toNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function changeTone(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return "neutral";
  return n > 0 ? "up" : "down";
}

function tintVars(tone = "neutral") {
  if (tone === "up") {
    return {
      border: "rgba(16,185,129,.24)",
      glow: "rgba(16,185,129,.16)",
      top: "rgba(16,185,129,.10)",
      text: "#86efac",
    };
  }

  if (tone === "down") {
    return {
      border: "rgba(244,63,94,.24)",
      glow: "rgba(244,63,94,.16)",
      top: "rgba(244,63,94,.10)",
      text: "#fda4af",
    };
  }

  return {
    border: "rgba(59,130,246,.18)",
    glow: "rgba(59,130,246,.12)",
    top: "rgba(59,130,246,.07)",
    text: "rgba(255,255,255,.92)",
  };
}

function shellPanel(tone = "neutral", strong = false) {
  const t = tintVars(tone);

  return {
    borderRadius: 26,
    border: `1px solid ${t.border}`,
    background: `
      radial-gradient(circle at top left, ${t.top} 0%, rgba(255,255,255,0) 26%),
      linear-gradient(180deg, rgba(5,10,22,.94) 0%, rgba(3,8,20,.98) 100%)
    `,
    boxShadow: strong
      ? `0 0 0 1px rgba(255,255,255,.02) inset, 0 18px 55px rgba(0,0,0,.42), 0 0 34px ${t.glow}`
      : `0 0 0 1px rgba(255,255,255,.02) inset, 0 16px 42px rgba(0,0,0,.34), 0 0 20px ${t.glow}`,
    backdropFilter: "blur(10px)",
  };
}

function softPanel(tone = "neutral") {
  const t = tintVars(tone);

  return {
    borderRadius: 22,
    border: `1px solid ${t.border}`,
    background: `
      radial-gradient(circle at top left, ${t.top} 0%, rgba(255,255,255,0) 24%),
      linear-gradient(180deg, rgba(7,12,26,.90) 0%, rgba(4,9,22,.96) 100%)
    `,
    boxShadow: `0 14px 32px rgba(0,0,0,.28), 0 0 18px ${t.glow}`,
  };
}

function microPanel(tone = "neutral") {
  const t = tintVars(tone);

  return {
    borderRadius: 18,
    border: `1px solid ${t.border}`,
    background: `
      radial-gradient(circle at top left, ${t.top} 0%, rgba(255,255,255,0) 28%),
      linear-gradient(180deg, rgba(10,15,30,.86) 0%, rgba(5,9,20,.94) 100%)
    `,
    boxShadow: `0 10px 24px rgba(0,0,0,.24), 0 0 14px ${t.glow}`,
  };
}

function priceTextFromQuote(quote) {
  if (!quote) return "Loading";
  const price = toNum(quote.price);
  if (!Number.isFinite(price) || price <= 0) return "Pending";
  return money(price);
}

function changeTextFromQuote(quote) {
  if (!quote) return "Waiting on quote";
  const change = toNum(quote.change);
  const pct = toNum(quote.changesPercentage);

  if (!Number.isFinite(change) && !Number.isFinite(pct)) return "Live quote";
  if (!Number.isFinite(change) && Number.isFinite(pct)) return `${pct > 0 ? "+" : ""}${pct.toFixed(2)}%`;
  if (Number.isFinite(change) && !Number.isFinite(pct)) return `${change > 0 ? "+" : ""}${money(change)}`;

  return `${change > 0 ? "+" : ""}${money(change)} • ${pct > 0 ? "+" : ""}${pct.toFixed(2)}%`;
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

        if (!res.ok) {
          throw new Error(data?.error || "Failed to search market.");
        }

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
        ...new Set([
          ...activeRows.map((x) => String(x.symbol || "").toUpperCase()),
          ...favorites.map((x) => String(x.symbol || "").toUpperCase()),
        ]),
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
              const singleRes = await fetch(`/api/prices?symbol=${encodeURIComponent(sym)}`, {
                cache: "no-store",
              });
              const singleData = await singleRes.json();

              if (singleRes.ok) {
                nextPrices[sym] = {
                  price: toNum(singleData?.price),
                  change: toNum(singleData?.change),
                  changesPercentage: toNum(
                    singleData?.changesPercentage ??
                      singleData?.changePercent ??
                      singleData?.percent_change
                  ),
                };
              }
            } catch (err) {
              console.error(`single price fetch failed for ${sym}`, err);
            }
          })
        );
      }

      setPrices((prev) => ({
        ...prev,
        ...nextPrices,
      }));
    }

    loadPrices();
  }, [activeRows, favorites]);

  const stats = useMemo(() => {
    const ownedMatches = activeRows.filter((x) =>
      savedSymbols.includes(String(x.symbol || "").toUpperCase())
    ).length;

    const favoriteMatches = activeRows.filter((x) =>
      favorites.some(
        (f) =>
          String(f.symbol || "").toUpperCase() === String(x.symbol || "").toUpperCase()
      )
    ).length;

    const stocks = activeRows.filter(
      (x) => String(x.type || "").toUpperCase() === "STOCK"
    ).length;

    const etfs = activeRows.filter(
      (x) => String(x.type || "").toUpperCase() === "ETF"
    ).length;

    return {
      showing: activeRows.length,
      ownedMatches,
      favoriteMatches,
      stocks,
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

    const { error } = await supabase
      .from("investment_favorites")
      .delete()
      .eq("id", favorite.id);

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
    <main
      style={{
        background:
          "radial-gradient(circle at top left, rgba(37,99,235,.10) 0%, rgba(0,0,0,0) 22%), radial-gradient(circle at top right, rgba(168,85,247,.06) 0%, rgba(0,0,0,0) 22%), linear-gradient(180deg, #030712 0%, #050a16 100%)",
        padding: "34px 28px 46px",
        maxWidth: "1280px",
        margin: "0 auto",
        color: "rgba(255,255,255,.96)",
        minHeight: "100vh",
      }}
    >
      <div
        style={{
          ...shellPanel("neutral", true),
          padding: 22,
          marginBottom: 18,
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 16,
          alignItems: "end",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: "0.22em",
              marginBottom: 8,
              color: "rgba(134,239,172,.82)",
            }}
          >
            Life Command Center
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "clamp(2.1rem, 4vw, 3.2rem)",
              lineHeight: 1.02,
              fontWeight: 950,
              letterSpacing: "-0.03em",
            }}
          >
            Discover Market Assets
          </h1>

          <div
            style={{
              marginTop: 10,
              fontSize: 15,
              maxWidth: 860,
              color: "rgba(255,255,255,.68)",
            }}
          >
            Search public symbols fast, scan your core universe, and add holdings or favorites without the ugly old card style.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Link href="/investments" className="btnGhost">
            Portfolio
          </Link>
        </div>
      </div>

      {(status || error) && (
        <div
          style={{
            ...softPanel(error ? "down" : "up"),
            padding: 14,
            marginBottom: 18,
          }}
        >
          <div style={{ fontWeight: 900 }}>{error ? "Fix this" : "Status"}</div>
          <div style={{ marginTop: 6, color: "rgba(255,255,255,.70)" }}>{error || status}</div>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.45fr .85fr",
          gap: 18,
          marginBottom: 18,
          alignItems: "stretch",
        }}
      >
        <div style={{ ...shellPanel("neutral", false), padding: 20 }}>
          <div style={{ fontWeight: 950, fontSize: 22 }}>
            {searchMode ? "Search Market" : "Market Universe"}
          </div>
          <div style={{ marginTop: 6, fontSize: 14, color: "rgba(255,255,255,.66)" }}>
            {searchMode
              ? "Live search by symbol or company name."
              : "Curated default universe loaded on first open."}
          </div>

          <div style={{ height: 16 }} />

          <input
            className="input"
            placeholder="Search AAPL, Apple, VOO, Nvidia..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: "100%",
              background: "rgba(255,255,255,.04)",
              border: "1px solid rgba(255,255,255,.10)",
              borderRadius: 16,
            }}
          />

          <div style={{ marginTop: 10, fontSize: 12, color: "rgba(255,255,255,.56)" }}>
            {loadingResults
              ? "Searching live market symbols..."
              : searchMode
                ? "Showing live search results."
                : "Showing your default market universe."}
          </div>
        </div>

        <div style={{ ...shellPanel("neutral", false), padding: 20 }}>
          <div style={{ fontWeight: 950, fontSize: 22 }}>Scanner Snapshot</div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 12,
              marginTop: 16,
            }}
          >
            <MiniStat title="Showing" value={String(stats.showing)} tone="neutral" />
            <MiniStat title="Owned" value={String(stats.ownedMatches)} tone="up" />
            <MiniStat title="Favs" value={String(stats.favoriteMatches)} tone="up" />
            <MiniStat title="ETFs" value={String(stats.etfs)} tone="neutral" />
          </div>
        </div>
      </div>

      <div style={{ ...shellPanel("neutral", false), padding: 20, marginBottom: 18 }}>
        <div style={{ fontWeight: 950, fontSize: 22 }}>Favorites</div>
        <div style={{ marginTop: 6, fontSize: 14, color: "rgba(255,255,255,.66)" }}>
          Quick-access symbols pinned from Discover.
        </div>

        <div style={{ height: 16 }} />

        {favorites.length ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
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
                    type: String(f.asset_type || "stock").toUpperCase() === "ETF" ? "ETF" : "Stock",
                    exchange: "Saved",
                  }}
                  quote={quote}
                  owned={savedSymbols.includes(sym)}
                  favorited={true}
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
          <EmptyState
            title="No favorites yet"
            sub="Favorite any symbol below to pin it here."
          />
        )}
      </div>

      {!searchMode ? (
        <div style={{ display: "grid", gap: 18 }}>
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
            sub="Core index funds and broad market favorites."
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
        <div style={{ ...shellPanel("neutral", false), padding: 20 }}>
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
            <EmptyState
              title="Searching..."
              sub="Pulling live symbols from your market provider."
            />
          ) : (
            <EmptyState
              title="No matches found"
              sub="Try a ticker or company name."
            />
          )}
        </div>
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
    <div style={{ ...shellPanel("neutral", false), padding: 20 }}>
      <div style={{ fontWeight: 950, fontSize: 22 }}>{title}</div>
      <div style={{ marginTop: 6, fontSize: 14, color: "rgba(255,255,255,.66)" }}>{sub}</div>

      <div style={{ height: 16 }} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        {items.map((item) => {
          const sym = String(item.symbol || "").toUpperCase();
          const alreadyOwned = savedSymbols.includes(sym);
          const alreadyFavorite = favorites.some(
            (f) => String(f.symbol || "").toUpperCase() === sym
          );
          const quote = prices[sym] || null;

          return (
            <AssetCard
              key={sym}
              item={item}
              quote={quote}
              owned={alreadyOwned}
              favorited={alreadyFavorite}
              busy={addingSymbol === sym || favoriteSymbol === sym}
              onToggleFavorite={() =>
                alreadyFavorite ? onRemoveFavorite(sym) : onAddFavorite(item)
              }
              onAddAsset={() => onAddAsset(item)}
              onOpenMarket={`/market/${encodeURIComponent(sym)}`}
            />
          );
        })}
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
  const tone = changeTone(quote?.change);

  return (
    <div
      style={{
        ...softPanel(tone),
        padding: 16,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr .9fr auto",
          gap: 16,
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ fontWeight: 950, fontSize: 22 }}>{item.symbol}</div>
            <span style={pillStyle()}>{item.type || "Stock"}</span>
            <span style={pillStyle()}>{item.exchange || "—"}</span>
            <span
              style={pillStyle(
                favorited ? "#86efac" : "rgba(255,255,255,.82)",
                favorited ? "rgba(74,222,128,.14)" : "rgba(255,255,255,.06)"
              )}
            >
              {favorited ? "Favorited" : item.currency || "USD"}
            </span>
          </div>

          <div style={{ marginTop: 10, fontWeight: 800, fontSize: 16 }}>
            {item.name}
          </div>

          <div
            style={{
              marginTop: 8,
              fontSize: 13,
              color:
                tone === "up"
                  ? "#86efac"
                  : tone === "down"
                    ? "#fda4af"
                    : "rgba(255,255,255,.60)",
            }}
          >
            {changeTextFromQuote(quote)}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 10,
          }}
        >
          <MiniBox label="Live Price" value={priceTextFromQuote(quote)} tone={tone} />
          <MiniBox label="Status" value={owned ? "Owned" : favorited ? "Favorite" : "Available"} tone="neutral" />
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Link href={`/market/${encodeURIComponent(item.symbol)}`} className="btnGhost">
            View Market
          </Link>

          <button
            className="btnGhost"
            onClick={onToggleFavorite}
            disabled={favoriteBusy}
            style={{ minWidth: 110, opacity: favoriteBusy ? 0.75 : 1 }}
          >
            {favoriteBusy ? "Working..." : favorited ? "Unfavorite" : "Favorite"}
          </button>

          <button
            className={owned ? "btnGhost" : "btn"}
            onClick={onAddAsset}
            disabled={owned || addBusy}
            style={{
              minWidth: 110,
              opacity: owned || addBusy ? 0.75 : 1,
              cursor: owned || addBusy ? "not-allowed" : "pointer",
            }}
          >
            {owned ? "Added" : addBusy ? "Adding..." : "Add Asset"}
          </button>
        </div>
      </div>
    </div>
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
  const tone = changeTone(quote?.change);

  return (
    <div
      style={{
        ...microPanel(tone),
        padding: 14,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div style={{ fontWeight: 950, fontSize: 18 }}>{item.symbol}</div>
          <div style={{ marginTop: 4, fontSize: 12, color: "rgba(255,255,255,.56)" }}>
            {item.type} • {item.exchange}
          </div>
        </div>

        <button
          className="btnGhost"
          onClick={onToggleFavorite}
          disabled={busy}
        >
          {busy ? "..." : favoriteLabel || (favorited ? "Saved" : "Favorite")}
        </button>
      </div>

      <div style={{ marginTop: 10, fontWeight: 800, minHeight: 42 }}>
        {item.name}
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,.54)" }}>Live Price</div>
        <div style={{ marginTop: 4, fontWeight: 900, fontSize: 20 }}>
          {priceTextFromQuote(quote)}
        </div>
        <div
          style={{
            marginTop: 6,
            fontSize: 12,
            minHeight: 18,
            color:
              tone === "up"
                ? "#86efac"
                : tone === "down"
                  ? "#fda4af"
                  : "rgba(255,255,255,.56)",
          }}
        >
          {changeTextFromQuote(quote)}
        </div>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link href={onOpenMarket} className="btnGhost">
          Market
        </Link>

        {!addDisabled && (
          <button
            className={owned ? "btnGhost" : "btn"}
            onClick={onAddAsset}
            disabled={owned || busy}
            style={{ opacity: owned || busy ? 0.75 : 1 }}
          >
            {owned ? "Added" : busy ? "..." : "Add"}
          </button>
        )}
      </div>
    </div>
  );
}

function pillStyle(color = "rgba(255,255,255,.82)", background = "rgba(255,255,255,.06)") {
  return {
    fontSize: 11,
    fontWeight: 900,
    padding: "5px 9px",
    borderRadius: 999,
    background,
    color,
    border: "1px solid rgba(255,255,255,.08)",
    whiteSpace: "nowrap",
  };
}

function MiniStat({ title, value, tone = "neutral" }) {
  return (
    <div
      style={{
        ...microPanel(tone),
        padding: 14,
      }}
    >
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "rgba(255,255,255,.54)",
        }}
      >
        {title}
      </div>
      <div style={{ marginTop: 8, fontWeight: 950, fontSize: 22 }}>
        {value}
      </div>
    </div>
  );
}

function MiniBox({ label, value, tone = "neutral" }) {
  return (
    <div
      style={{
        ...microPanel(tone),
        padding: 12,
      }}
    >
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "rgba(255,255,255,.54)",
        }}
      >
        {label}
      </div>
      <div style={{ marginTop: 7, fontWeight: 800 }}>
        {value}
      </div>
    </div>
  );
}

function EmptyState({ title, sub }) {
  return (
    <div
      style={{
        borderRadius: 20,
        border: "1px dashed rgba(255,255,255,.14)",
        padding: "26px 18px",
        background:
          "linear-gradient(180deg, rgba(8,13,26,.84) 0%, rgba(4,8,18,.94) 100%)",
        textAlign: "center",
        boxShadow: "0 14px 32px rgba(0,0,0,.24)",
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 16 }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.45, color: "rgba(255,255,255,.62)" }}>
        {sub}
      </div>
    </div>
  );
}
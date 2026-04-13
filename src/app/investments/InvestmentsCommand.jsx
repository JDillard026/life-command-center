"use client";

import { useEffect, useMemo, useState } from "react";
import GlassPane from "../components/GlassPane";
import styles from "./InvestmentsPage.module.css";
import { supabase } from "@/lib/supabaseClient";
import {
  BOARD_SYMBOLS,
  DESK_TABS,
  NEWS_TTL_MS,
  buildPortfolio,
  parseBatchPrices,
  sameNewsArticles,
  toneByValue,
  toNum,
} from "./investments.helpers";
import {
  SummaryStrip,
  NavigatorPane,
  CommandBoard,
} from "./investments.components";

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

export default function InvestmentsCommand() {
  const [assets, setAssets] = useState([]);
  const [txns, setTxns] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [prices, setPrices] = useState({});
  const [news, setNews] = useState([]);
  const [newsError, setNewsError] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [boardTab, setBoardTab] = useState("dashboard");
  const [filter, setFilter] = useState("open");
  const [sort, setSort] = useState("value");
  const [search, setSearch] = useState("");

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
      setSelectedAssetId(assetRows[0]?.id || "");
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

  const portfolio = useMemo(() => buildPortfolio(assets, txns, prices), [assets, txns, prices]);

  const openPositions = useMemo(() => {
    return portfolio.holdings.filter((h) => toNum(h.shares) > 0);
  }, [portfolio.holdings]);

  const alerts = useMemo(() => {
    return openPositions.filter((h) => !h.hasLivePrice || toNum(h.pnl) < 0);
  }, [openPositions]);

  const assetMap = useMemo(() => {
    const map = new Map();
    assets.forEach((asset) => map.set(asset.id, asset));
    return map;
  }, [assets]);

  const recentTxns = useMemo(() => {
    return [...txns]
      .sort((a, b) => {
        const ad = new Date(a.txn_date || 0).getTime();
        const bd = new Date(b.txn_date || 0).getTime();
        return bd - ad;
      })
      .slice(0, 6);
  }, [txns]);

  const selectedHolding = useMemo(() => {
    return (
      portfolio.holdings.find((item) => item.id === selectedAssetId) ||
      portfolio.holdings[0] ||
      null
    );
  }, [portfolio.holdings, selectedAssetId]);

  useEffect(() => {
    if (!selectedHolding && portfolio.holdings.length) {
      setSelectedAssetId(portfolio.holdings[0].id);
    }
  }, [selectedHolding, portfolio.holdings]);

  useEffect(() => {
    if (!tradeAssetId && assets.length) {
      setTradeAssetId(assets[0].id);
    }
  }, [tradeAssetId, assets]);

  const visibleAssets = useMemo(() => {
    const q = search.trim().toLowerCase();
    const favoriteSet = new Set(
      favorites.map((f) => String(f.symbol || "").toUpperCase().trim())
    );

    let list = [...portfolio.holdings].filter((item) => {
      const symbolText = String(item.symbol || "").toLowerCase();
      const accountText = String(item.account || "").toLowerCase();

      if (q && !`${symbolText} ${accountText}`.includes(q)) return false;

      if (filter === "open" && !(toNum(item.shares) > 0)) return false;
      if (filter === "watch" && !favoriteSet.has(String(item.symbol || "").toUpperCase())) return false;
      if (filter === "red" && !(toNum(item.pnl) < 0 || !item.hasLivePrice)) return false;

      return true;
    });

    if (sort === "symbol") {
      list.sort((a, b) => String(a.symbol || "").localeCompare(String(b.symbol || "")));
      return list;
    }

    if (sort === "pnl") {
      list.sort((a, b) => toNum(b.pnl, -Infinity) - toNum(a.pnl, -Infinity));
      return list;
    }

    if (sort === "activity") {
      list.sort((a, b) => toNum(b.txCount) - toNum(a.txCount));
      return list;
    }

    list.sort((a, b) => toNum(b.value) - toNum(a.value));
    return list;
  }, [portfolio.holdings, favorites, search, filter, sort]);

  const newsSymbols = useMemo(() => {
    const selected = selectedHolding?.symbol ? [String(selectedHolding.symbol).toUpperCase()] : [];
    const topOwned = openPositions.slice(0, 4).map((h) => String(h.symbol || "").toUpperCase());
    const watch = favorites.slice(0, 3).map((f) => String(f.symbol || "").toUpperCase());

    return [...new Set([...selected, ...topOwned, ...watch, "SPY"])].filter(Boolean).slice(0, 6);
  }, [selectedHolding, openPositions, favorites]);

  const newsSymbolsKey = useMemo(() => newsSymbols.join(","), [newsSymbols]);

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
      setSelectedAssetId(data.id);
      setBoardTab("ticket");
      setSymbol("");
      setStatus(`${clean} added to the desk.`);
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
      setBoardTab("positions");
      setStatus(`${tradeType} saved to portfolio ledger.`);
    } catch (err) {
      console.error(err);
      setError("Failed saving trade.");
    }
  }

  if (loading) {
    return (
      <main className={styles.page}>
        <GlassPane className={styles.gatePanel}>
          <div className={styles.gateText}>Loading investments desk.</div>
        </GlassPane>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      {(status || error) && (
        <GlassPane className={styles.statusStrip}>
          <div className={styles.statusTitle}>{error ? "Desk error" : "Desk update"}</div>
          <div className={styles.statusText}>{error || status}</div>
        </GlassPane>
      )}

      <SummaryStrip
        portfolio={portfolio}
        openPositions={openPositions}
        favorites={favorites}
        selectedHolding={selectedHolding}
      />

      <div className={styles.workspace}>
        <div className={styles.leftCol}>
          <NavigatorPane
            visibleAssets={visibleAssets}
            selectedHolding={selectedHolding}
            search={search}
            setSearch={setSearch}
            filter={filter}
            setFilter={setFilter}
            sort={sort}
            setSort={setSort}
            onSelectAsset={setSelectedAssetId}
          />
        </div>

        <div className={styles.mainCol}>
          <CommandBoard
            selectedHolding={selectedHolding}
            portfolio={portfolio}
            prices={prices}
            alerts={alerts}
            openPositions={openPositions}
            news={news}
            newsError={newsError}
            favorites={favorites}
            recentTxns={recentTxns}
            assetMap={assetMap}
            boardTab={DESK_TABS.includes(boardTab) ? boardTab : "dashboard"}
            setBoardTab={setBoardTab}
            assets={assets}
            tradeAssetId={tradeAssetId}
            setTradeAssetId={setTradeAssetId}
            tradeType={tradeType}
            setTradeType={setTradeType}
            tradeQty={tradeQty}
            setTradeQty={setTradeQty}
            tradePrice={tradePrice}
            setTradePrice={setTradePrice}
            tradeDate={tradeDate}
            setTradeDate={setTradeDate}
            symbol={symbol}
            setSymbol={setSymbol}
            addAsset={addAsset}
            logTrade={logTrade}
          />
        </div>
      </div>
    </main>
  );
}
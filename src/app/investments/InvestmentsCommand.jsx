
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import GlassPane from "../components/GlassPane";
import styles from "./InvestmentsPage.module.css";
import {
  ActionBtn,
  ActionLink,
  BoardCard,
  EmptyState,
  FillRow,
  HoldingRow,
  MiniPill,
  NewsRow,
  WatchRow,
} from "./investments.components";
import {
  BOARD_SYMBOLS,
  asSymbol,
  buildPortfolio,
  money,
  moneyTight,
  monthLabel,
  parseBatchPrices,
  pct,
  signedMoney,
  toneByValue,
  toneMeta,
  toNum,
} from "./investments.helpers";

export default function InvestmentsCommand() {
  const router = useRouter();

  const [assets, setAssets] = useState([]);
  const [txns, setTxns] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [prices, setPrices] = useState({});
  const [news, setNews] = useState([]);

  const [loading, setLoading] = useState(true);
  const [workspaceError, setWorkspaceError] = useState("");
  const [status, setStatus] = useState("");
  const [working, setWorking] = useState(false);

  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [holdingSearch, setHoldingSearch] = useState("");
  const [holdingToneFilter, setHoldingToneFilter] = useState("all");

  const [quickSymbol, setQuickSymbol] = useState("");
  const [tradeAssetId, setTradeAssetId] = useState("");
  const [tradeType, setTradeType] = useState("BUY");
  const [tradeQty, setTradeQty] = useState("");
  const [tradePrice, setTradePrice] = useState("");
  const [tradeDate, setTradeDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspace() {
      setLoading(true);
      setWorkspaceError("");
      setStatus("");

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          if (!cancelled) {
            setWorkspaceError("You must be logged in.");
            setLoading(false);
          }
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
          throw assetRes.error || txnRes.error || favoriteRes.error;
        }

        if (cancelled) return;

        const nextAssets = assetRes.data || [];
        const nextTxns = txnRes.data || [];
        const nextFavorites = favoriteRes.data || [];

        setAssets(nextAssets);
        setTxns(nextTxns);
        setFavorites(nextFavorites);
        setTradeAssetId(nextAssets[0]?.id || "");
        setSelectedAssetId(nextAssets[0]?.id || "");
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setWorkspaceError("Failed loading investment workspace.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, []);

  const watchSymbols = useMemo(() => {
    return [
      ...new Set(
        [
          ...assets.map((asset) => asSymbol(asset.symbol)),
          ...favorites.map((item) => asSymbol(item.symbol)),
          ...BOARD_SYMBOLS.map((item) => item.symbol),
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

      try {
        const response = await fetch(
          `/api/prices-batch?symbols=${encodeURIComponent(watchSymbols.join(","))}`,
          { cache: "no-store" }
        );
        const json = await response.json();

        if (cancelled) return;
        setPrices(response.ok ? parseBatchPrices(json) : {});
      } catch (error) {
        if (cancelled) return;
        console.error("portfolio price batch failed", error);
        setPrices({});
      }
    }

    loadPrices();

    return () => {
      cancelled = true;
    };
  }, [watchSymbols]);

  const portfolio = useMemo(() => buildPortfolio(assets, txns, prices), [assets, txns, prices]);

  const openPositions = useMemo(() => {
    return portfolio.holdings.filter((item) => toNum(item.shares) > 0);
  }, [portfolio.holdings]);

  const selectedHolding = useMemo(() => {
    return (
      portfolio.holdings.find((item) => item.id === selectedAssetId) ||
      openPositions[0] ||
      portfolio.holdings[0] ||
      null
    );
  }, [portfolio.holdings, openPositions, selectedAssetId]);

  useEffect(() => {
    if (!selectedHolding && portfolio.holdings.length) {
      setSelectedAssetId(portfolio.holdings[0].id);
    }
  }, [selectedHolding, portfolio.holdings]);

  useEffect(() => {
    if (!tradeAssetId && assets.length) {
      setTradeAssetId(assets[0]?.id || "");
    }
  }, [tradeAssetId, assets]);

  const selectedQuote = useMemo(() => {
    if (!selectedHolding) return null;
    return prices[asSymbol(selectedHolding.symbol)] || null;
  }, [selectedHolding, prices]);

  const recentTxns = useMemo(() => {
    return [...txns]
      .sort((a, b) => new Date(b.txn_date || 0).getTime() - new Date(a.txn_date || 0).getTime())
      .slice(0, 8);
  }, [txns]);

  const assetMap = useMemo(() => {
    const map = new Map();
    assets.forEach((asset) => map.set(asset.id, asset));
    return map;
  }, [assets]);

  const visibleHoldings = useMemo(() => {
    const query = holdingSearch.trim().toLowerCase();
    const watchedSet = new Set(favorites.map((item) => asSymbol(item.symbol)));

    return openPositions.filter((item) => {
      const haystack = `${item.symbol} ${item.account || ""}`.toLowerCase();
      if (query && !haystack.includes(query)) return false;
      if (holdingToneFilter === "red" && !(item.hasLivePrice && toNum(item.pnl) < 0)) return false;
      if (holdingToneFilter === "green" && !(item.hasLivePrice && toNum(item.pnl) > 0)) return false;
      if (holdingToneFilter === "watch" && !watchedSet.has(asSymbol(item.symbol))) return false;
      return true;
    });
  }, [openPositions, favorites, holdingSearch, holdingToneFilter]);

  const newsSymbols = useMemo(() => {
    return [
      ...new Set(
        [
          selectedHolding?.symbol,
          ...openPositions.slice(0, 3).map((item) => item.symbol),
          ...favorites.slice(0, 2).map((item) => item.symbol),
          "SPY",
        ]
          .map(asSymbol)
          .filter(Boolean)
      ),
    ].slice(0, 6);
  }, [selectedHolding, openPositions, favorites]);

  useEffect(() => {
    let cancelled = false;

    async function loadNews() {
      if (!newsSymbols.length) {
        setNews([]);
        return;
      }

      try {
        const response = await fetch(
          `/api/stock-news?symbols=${encodeURIComponent(newsSymbols.join(","))}&limit=8`,
          { cache: "no-store" }
        );
        const json = await response.json();

        if (cancelled) return;
        setNews(response.ok && Array.isArray(json?.articles) ? json.articles : []);
      } catch (error) {
        if (cancelled) return;
        console.error("portfolio news failed", error);
        setNews([]);
      }
    }

    loadNews();

    return () => {
      cancelled = true;
    };
  }, [newsSymbols]);

  async function addAsset() {
    const clean = asSymbol(quickSymbol);
    if (!clean) return;

    setWorking(true);
    setWorkspaceError("");
    setStatus("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setWorkspaceError("You must be logged in.");
        setWorking(false);
        return;
      }

      const existing = assets.find((asset) => asSymbol(asset.symbol) === clean);
      if (existing) {
        setSelectedAssetId(existing.id);
        setTradeAssetId(existing.id);
        setQuickSymbol("");
        setStatus(`${clean} is already on your desk.`);
        setWorking(false);
        return;
      }

      const { data, error } = await supabase
        .from("investment_assets")
        .insert({
          user_id: user.id,
          symbol: clean,
          asset_type: "stock",
          account: "Brokerage",
        })
        .select()
        .single();

      if (error) throw error;

      setAssets((prev) => [data, ...prev]);
      setSelectedAssetId(data.id);
      setTradeAssetId(data.id);
      setQuickSymbol("");
      setStatus(`${clean} added to portfolio.`);
    } catch (error) {
      console.error(error);
      setWorkspaceError(`Could not add ${clean}.`);
    } finally {
      setWorking(false);
    }
  }

  async function logTrade() {
    const qty = toNum(tradeQty, NaN);
    const price = toNum(tradePrice, NaN);

    setWorking(true);
    setWorkspaceError("");
    setStatus("");

    try {
      if (!tradeAssetId) throw new Error("Pick an asset first.");
      if (!Number.isFinite(qty) || qty <= 0) throw new Error("Enter a valid quantity.");
      if (!Number.isFinite(price) || price <= 0) throw new Error("Enter a valid price.");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setWorkspaceError("You must be logged in.");
        setWorking(false);
        return;
      }

      const { data, error } = await supabase
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

      if (error) throw error;

      setTxns((prev) => [data, ...prev]);
      setTradeQty("");
      setTradePrice("");
      setStatus(`${tradeType} saved to portfolio ledger.`);
    } catch (error) {
      console.error(error);
      setWorkspaceError(error?.message || "Could not save trade.");
    } finally {
      setWorking(false);
    }
  }

  async function deleteAsset(assetId) {
    const target = assets.find((item) => item.id === assetId);
    const symbol = asSymbol(target?.symbol);
    if (!target || !symbol) return;

    const confirmed = window.confirm(
      `Delete ${symbol} from the desk?\n\nThis removes the asset and every trade tied to it.`
    );

    if (!confirmed) return;

    setWorking(true);
    setWorkspaceError("");
    setStatus("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setWorkspaceError("You must be logged in.");
        setWorking(false);
        return;
      }

      const favoriteDelete = await supabase
        .from("investment_favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("symbol", symbol);

      if (favoriteDelete.error) console.error(favoriteDelete.error);

      const txnDelete = await supabase
        .from("investment_transactions")
        .delete()
        .eq("user_id", user.id)
        .eq("asset_id", assetId);

      if (txnDelete.error) throw txnDelete.error;

      const assetDelete = await supabase
        .from("investment_assets")
        .delete()
        .eq("user_id", user.id)
        .eq("id", assetId);

      if (assetDelete.error) throw assetDelete.error;

      const remainingAssets = assets.filter((item) => item.id !== assetId);
      setAssets(remainingAssets);
      setTxns((prev) => prev.filter((txn) => txn.asset_id !== assetId));
      setFavorites((prev) => prev.filter((item) => asSymbol(item.symbol) !== symbol));
      setSelectedAssetId(remainingAssets[0]?.id || "");
      setTradeAssetId(remainingAssets[0]?.id || "");
      setStatus(`${symbol} deleted from portfolio.`);
    } catch (error) {
      console.error(error);
      setWorkspaceError("Could not delete the position.");
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <main className={styles.page}>
        <GlassPane className={styles.deskSurface}>
          <div className={styles.emptyTitle}>Loading portfolio desk.</div>
        </GlassPane>
      </main>
    );
  }

  const selectedTone = toneByValue(
    selectedHolding?.hasLivePrice ? selectedHolding?.pnl : selectedQuote?.changesPercentage ?? 0
  );
  const selectedMeta = toneMeta(selectedTone);

  return (
    <main className={styles.page}>
      {(status || workspaceError) && (
        <GlassPane className={styles.statusStrip}>
          <div className={styles.statusTitle}>
            {workspaceError ? "portfolio error" : "portfolio update"}
          </div>
          <div className={styles.statusText}>{workspaceError || status}</div>
        </GlassPane>
      )}

      <GlassPane className={styles.topStrip}>
        <div className={styles.topMain}>
          <div>
            <div className={styles.pageMicro}>Invest / Portfolio</div>
            <div className={styles.pageName}>Portfolio</div>
            <div className={styles.pageSub}>
              Live book first. Research and routing second. No fake dashboard treatment.
            </div>
          </div>

          <div className={styles.pageActions}>
            <ActionLink href="/investments/discover" variant="primary">
              Discover <ArrowRight size={14} />
            </ActionLink>
            <ActionLink href="/investments/auto">
              Auto Invest <Sparkles size={14} />
            </ActionLink>
          </div>
        </div>

        <div className={styles.inlineMetricStrip}>
          <div className={styles.inlineMetricCell}>
            <div className={styles.inlineMetricLabel}>Value</div>
            <div className={styles.inlineMetricValue}>{moneyTight(portfolio.totalValue)}</div>
            <div className={styles.inlineMetricNote}>{monthLabel()}</div>
          </div>

          <div className={styles.inlineMetricCell}>
            <div className={styles.inlineMetricLabel}>Day move</div>
            <div
              className={styles.inlineMetricValue}
              style={{ color: toneMeta(toneByValue(portfolio.totalDayMove)).text }}
            >
              {signedMoney(portfolio.totalDayMove)}
            </div>
            <div className={styles.inlineMetricNote}>
              {portfolio.totalDayPct != null ? pct(portfolio.totalDayPct) : "waiting"}
            </div>
          </div>

          <div className={styles.inlineMetricCell}>
            <div className={styles.inlineMetricLabel}>Unrealized</div>
            <div
              className={styles.inlineMetricValue}
              style={{ color: toneMeta(toneByValue(portfolio.totalPnl)).text }}
            >
              {signedMoney(portfolio.totalPnl)}
            </div>
            <div className={styles.inlineMetricNote}>book P/L</div>
          </div>

          <div className={styles.inlineMetricCell}>
            <div className={styles.inlineMetricLabel}>Cost basis</div>
            <div className={styles.inlineMetricValue}>{moneyTight(portfolio.totalCost)}</div>
            <div className={styles.inlineMetricNote}>capital at work</div>
          </div>

          <div className={styles.inlineMetricCell}>
            <div className={styles.inlineMetricLabel}>Positions</div>
            <div className={styles.inlineMetricValue}>{openPositions.length}</div>
            <div className={styles.inlineMetricNote}>open names</div>
          </div>
        </div>
      </GlassPane>

      <div className={styles.deskGrid}>
        <GlassPane className={styles.deskSurface}>
          <div className={styles.surfaceHeader}>
            <div>
              <div className={styles.surfaceTitle}>
                {selectedHolding ? selectedHolding.symbol : "Holdings"}
              </div>
              <div className={styles.surfaceSub}>
                {selectedHolding
                  ? `${selectedHolding.account || "Brokerage"} • ${selectedHolding.txCount} fills`
                  : "Add a symbol and start routing fills."}
              </div>
            </div>

            {selectedHolding ? (
              <div className={styles.focusStackFlat}>
                <div
                  className={styles.focusHeadline}
                  style={{ color: selectedTone === "neutral" ? "#fff" : selectedMeta.text }}
                >
                  {selectedHolding.hasLivePrice ? money(selectedHolding.livePrice) : "—"}
                </div>
                <div
                  className={styles.surfaceSub}
                  style={{ color: selectedTone === "neutral" ? "rgba(255,255,255,0.66)" : selectedMeta.text }}
                >
                  {selectedQuote?.change != null
                    ? `${signedMoney(selectedQuote.change)} • ${pct(selectedQuote.changesPercentage)}`
                    : "quote route waiting"}
                </div>
              </div>
            ) : (
              <MiniPill tone="amber">No open positions</MiniPill>
            )}
          </div>

          {selectedHolding ? (
            <div className={styles.focusSubgrid}>
              <div className={styles.focusCell}>
                <div className={styles.inlineMetricLabel}>Shares</div>
                <div className={styles.focusValue}>
                  {toNum(selectedHolding.shares).toLocaleString(undefined, {
                    maximumFractionDigits: 4,
                  })}
                </div>
              </div>
              <div className={styles.focusCell}>
                <div className={styles.inlineMetricLabel}>Value</div>
                <div className={styles.focusValue}>{money(selectedHolding.value)}</div>
              </div>
              <div className={styles.focusCell}>
                <div className={styles.inlineMetricLabel}>Basis</div>
                <div className={styles.focusValue}>{money(selectedHolding.remainingBasis)}</div>
              </div>
              <div className={styles.focusCell}>
                <div className={styles.inlineMetricLabel}>P/L</div>
                <div
                  className={styles.focusValue}
                  style={{ color: selectedHolding.hasLivePrice ? selectedMeta.text : "#fff" }}
                >
                  {selectedHolding.hasLivePrice ? signedMoney(selectedHolding.pnl) : "Pending"}
                </div>
              </div>
            </div>
          ) : null}

          <div className={styles.surfaceDivider} />

          <div className={styles.compactFormRow}>
            <input
              className={styles.compactField}
              placeholder="Quick add symbol"
              value={quickSymbol}
              onChange={(event) => setQuickSymbol(event.target.value)}
            />
            <ActionBtn variant="primary" onClick={addAsset} disabled={working}>
              Add
            </ActionBtn>

            <select
              className={styles.compactSelect}
              value={tradeAssetId}
              onChange={(event) => setTradeAssetId(event.target.value)}
            >
              <option value="">Asset</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.symbol}
                </option>
              ))}
            </select>

            <select
              className={styles.compactSelect}
              value={tradeType}
              onChange={(event) => setTradeType(event.target.value)}
            >
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>

            <input
              className={styles.compactField}
              type="number"
              step="0.0001"
              value={tradeQty}
              onChange={(event) => setTradeQty(event.target.value)}
              placeholder="Qty"
            />

            <input
              className={styles.compactField}
              type="number"
              step="0.01"
              value={tradePrice}
              onChange={(event) => setTradePrice(event.target.value)}
              placeholder="Price"
            />

            <input
              className={styles.compactField}
              type="date"
              value={tradeDate}
              onChange={(event) => setTradeDate(event.target.value)}
            />

            <ActionBtn variant="primary" onClick={logTrade} disabled={working}>
              Route fill
            </ActionBtn>
          </div>

          <div className={styles.slimToolbar}>
            <input
              className={styles.slimSearch}
              placeholder="Search symbol or account"
              value={holdingSearch}
              onChange={(event) => setHoldingSearch(event.target.value)}
            />

            <div className={styles.slimChipRow}>
              {["all", "red", "green", "watch"].map((filter) => (
                <button
                  key={filter}
                  type="button"
                  className={
                    filter === holdingToneFilter
                      ? `${styles.rangeButton} ${styles.rangeButtonActive}`
                      : styles.rangeButton
                  }
                  onClick={() => setHoldingToneFilter(filter)}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.tableArea}>
            {visibleHoldings.length ? (
              <div className={styles.holdingsStack}>
                {visibleHoldings.map((item) => (
                  <HoldingRow
                    key={item.id}
                    item={item}
                    selected={item.id === selectedHolding?.id}
                    onSelect={() => setSelectedAssetId(item.id)}
                    onOpenMarket={() => router.push(`/market/${encodeURIComponent(item.symbol)}`)}
                    onDelete={() => deleteAsset(item.id)}
                  />
                ))}
              </div>
            ) : (
              <div className={styles.quietEmpty}>
                <div className={styles.emptyTitle}>No holdings match that view</div>
                <div className={styles.emptyText}>
                  Clear the search or switch the chip. This surface is for active positions only.
                </div>
              </div>
            )}
          </div>

          <div className={styles.surfaceDivider} />

          <div className={styles.surfaceHeader}>
            <div>
              <div className={styles.surfaceTitle}>Tape</div>
              <div className={styles.surfaceSub}>Broad market board kept on the desk, not split into another product.</div>
            </div>
          </div>

          <div className={styles.boardGrid}>
            {BOARD_SYMBOLS.map((item) => (
              <BoardCard
                key={item.symbol}
                symbol={item.symbol}
                label={item.label}
                quote={prices[item.symbol] || null}
                href={`/market/${encodeURIComponent(item.symbol)}`}
              />
            ))}
          </div>
        </GlassPane>

        <div className={styles.railColumn}>
          <GlassPane className={styles.railSurface}>
            <div className={styles.surfaceHeader}>
              <div>
                <div className={styles.surfaceTitle}>Watchlist</div>
                <div className={styles.surfaceSub}>Saved names ready for quick market view.</div>
              </div>
              <MiniPill>{favorites.length}</MiniPill>
            </div>

            {favorites.length ? (
              <div className={styles.watchList}>
                {favorites.slice(0, 6).map((item) => (
                  <WatchRow
                    key={item.id}
                    symbol={asSymbol(item.symbol)}
                    name={item.name || item.asset_type || "Watchlist"}
                    quote={prices[asSymbol(item.symbol)] || null}
                    href={`/market/${encodeURIComponent(asSymbol(item.symbol))}`}
                  />
                ))}
              </div>
            ) : (
              <div className={styles.quietEmpty}>
                <div className={styles.emptyTitle}>No saved names</div>
                <div className={styles.emptyText}>Use Discover to build the watchlist.</div>
              </div>
            )}

            <div className={styles.surfaceDivider} />

            <div className={styles.surfaceHeader}>
              <div>
                <div className={styles.surfaceTitle}>Recent fills</div>
                <div className={styles.surfaceSub}>Latest ledger activity.</div>
              </div>
              <MiniPill>{recentTxns.length}</MiniPill>
            </div>

            {recentTxns.length ? (
              <div className={styles.fillList}>
                {recentTxns.map((txn) => (
                  <FillRow key={txn.id} txn={txn} assetMap={assetMap} />
                ))}
              </div>
            ) : (
              <div className={styles.quietEmpty}>
                <div className={styles.emptyTitle}>No fills yet</div>
                <div className={styles.emptyText}>Route the first trade and it lands here.</div>
              </div>
            )}
          </GlassPane>

          <GlassPane className={styles.railSurface}>
            <div className={styles.surfaceHeader}>
              <div>
                <div className={styles.surfaceTitle}>Headlines</div>
                <div className={styles.surfaceSub}>Research flow around the live book.</div>
              </div>
              <MiniPill>{news.length} stories</MiniPill>
            </div>

            {news.length ? (
              <div className={styles.newsList}>
                {news.slice(0, 6).map((item, index) => (
                  <NewsRow key={`${item.url}-${index}`} item={item} />
                ))}
              </div>
            ) : (
              <div className={styles.quietEmpty}>
                <div className={styles.emptyTitle}>No headlines returned</div>
                <div className={styles.emptyText}>The news route came back empty.</div>
              </div>
            )}
          </GlassPane>
        </div>
      </div>
    </main>
  );
}

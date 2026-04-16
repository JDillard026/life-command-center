
"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ExternalLink, Plus, Star } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import GlassPane from "../../components/GlassPane";
import styles from "../InvestmentsPage.module.css";
import {
  ActionBtn,
  ActionLink,
  BoardCard,
  MiniPill,
  NewsRow,
  SearchResultRow,
  WatchRow,
} from "../investments.components";
import {
  BOARD_SYMBOLS,
  DISCOVER_QUICK_SEARCHES,
  DISCOVER_TYPES,
  asSymbol,
  buildDiscoverDecision,
  compactNumber,
  money,
  normalizeMarketResults,
  parseBatchPrices,
  pct,
  signedMoney,
  toneByValue,
  toneMeta,
} from "../investments.helpers";

export const dynamic = "force-dynamic";

function ScoreCard({ label, value, note, tone = "neutral" }) {
  const meta = toneMeta(tone);

  return (
    <div className={styles.decisionCard}>
      <div className={styles.decisionLabel}>{label}</div>
      <div
        className={styles.decisionValue}
        style={{ color: tone === "neutral" ? "#fff" : meta.text }}
      >
        {value}
      </div>
      <div className={styles.decisionNote}>{note}</div>
    </div>
  );
}

function ReasonBlock({ title, items }) {
  return (
    <div className={styles.bulletCard}>
      <div className={styles.bulletTitle}>{title}</div>
      <ul className={styles.bulletList}>
        {items.map((item) => (
          <li key={item} className={styles.bulletItem}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function InvestmentsDiscoverPage() {
  const [assets, setAssets] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [quotes, setQuotes] = useState({});
  const [news, setNews] = useState([]);

  const [query, setQuery] = useState("");
  const [type, setType] = useState("ALL");
  const [results, setResults] = useState([]);
  const [selectedSymbol, setSelectedSymbol] = useState("");

  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspace() {
      setLoadingWorkspace(true);
      setError("");

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          if (!cancelled) {
            setLoadingWorkspace(false);
            setError("You must be logged in.");
          }
          return;
        }

        const [assetRes, favoriteRes] = await Promise.all([
          supabase
            .from("investment_assets")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("investment_favorites")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
        ]);

        if (assetRes.error || favoriteRes.error) {
          throw assetRes.error || favoriteRes.error;
        }

        if (cancelled) return;
        setAssets(assetRes.data || []);
        setFavorites(favoriteRes.data || []);
      } catch (loadError) {
        console.error(loadError);
        if (!cancelled) setError("Failed loading discover workspace.");
      } finally {
        if (!cancelled) setLoadingWorkspace(false);
      }
    }

    loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, []);

  const ownedSymbols = useMemo(
    () => new Set(assets.map((asset) => asSymbol(asset.symbol)).filter(Boolean)),
    [assets]
  );

  const favoriteSymbols = useMemo(
    () => new Set(favorites.map((item) => asSymbol(item.symbol)).filter(Boolean)),
    [favorites]
  );

  const selectedResult = useMemo(() => {
    return results.find((item) => item.symbol === selectedSymbol) || results[0] || null;
  }, [results, selectedSymbol]);

  const watchSymbols = useMemo(() => {
    return [
      ...new Set(
        [
          ...BOARD_SYMBOLS.map((item) => item.symbol),
          ...results.slice(0, 12).map((item) => asSymbol(item.symbol)),
          ...favorites.slice(0, 8).map((item) => asSymbol(item.symbol)),
          ...assets.slice(0, 8).map((item) => asSymbol(item.symbol)),
          selectedResult?.symbol,
        ].filter(Boolean)
      ),
    ];
  }, [results, favorites, assets, selectedResult]);

  useEffect(() => {
    let cancelled = false;

    async function loadPrices() {
      if (!watchSymbols.length) {
        setQuotes({});
        return;
      }

      try {
        const response = await fetch(
          `/api/prices-batch?symbols=${encodeURIComponent(watchSymbols.join(","))}`,
          { cache: "no-store" }
        );
        const json = await response.json();

        if (cancelled) return;
        setQuotes(response.ok ? parseBatchPrices(json) : {});
      } catch (priceError) {
        if (cancelled) return;
        console.error("discover price batch failed", priceError);
        setQuotes({});
      }
    }

    loadPrices();

    return () => {
      cancelled = true;
    };
  }, [watchSymbols]);

  useEffect(() => {
    let cancelled = false;

    async function loadNews() {
      if (!selectedResult?.symbol) {
        setNews([]);
        return;
      }

      try {
        const response = await fetch(
          `/api/stock-news?symbols=${encodeURIComponent(selectedResult.symbol)}&limit=6`,
          { cache: "no-store" }
        );
        const json = await response.json();

        if (cancelled) return;
        setNews(response.ok && Array.isArray(json?.articles) ? json.articles : []);
      } catch (newsLoadError) {
        if (cancelled) return;
        console.error("discover news failed", newsLoadError);
        setNews([]);
      }
    }

    loadNews();

    return () => {
      cancelled = true;
    };
  }, [selectedResult]);

  async function runSearch(nextQuery = query, nextType = type) {
    const clean = String(nextQuery || "").trim();

    setLoadingSearch(true);
    setStatus("");
    setError("");

    try {
      if (!clean) {
        setResults([]);
        setSelectedSymbol("");
        setLoadingSearch(false);
        return;
      }

      const response = await fetch(
        `/api/market-search?query=${encodeURIComponent(clean)}&type=${encodeURIComponent(nextType)}&limit=24`,
        { cache: "no-store" }
      );
      const json = await response.json();

      if (!response.ok) {
        setError(json?.error || "Search failed.");
        setLoadingSearch(false);
        return;
      }

      const nextResults = normalizeMarketResults(json?.results || []);
      setResults(nextResults);
      setSelectedSymbol(nextResults[0]?.symbol || "");
    } catch (searchError) {
      console.error(searchError);
      setError("Search failed.");
    } finally {
      setLoadingSearch(false);
    }
  }

  async function addToDesk(symbol) {
    const clean = asSymbol(symbol);
    if (!clean) return;

    setWorking(true);
    setStatus("");
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("You must be logged in.");
        setWorking(false);
        return;
      }

      if (ownedSymbols.has(clean)) {
        setStatus(`${clean} is already on your desk.`);
        setWorking(false);
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

      if (insertError) throw insertError;

      setAssets((prev) => [data, ...prev]);
      setStatus(`${clean} added to portfolio.`);
    } catch (saveError) {
      console.error(saveError);
      setError(`Could not add ${clean}.`);
    } finally {
      setWorking(false);
    }
  }

  async function toggleWatch(row) {
    const symbol = asSymbol(row?.symbol);
    if (!symbol) return;

    setWorking(true);
    setStatus("");
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("You must be logged in.");
        setWorking(false);
        return;
      }

      const existing = favorites.find((item) => asSymbol(item.symbol) === symbol);

      if (existing) {
        const { error: deleteError } = await supabase
          .from("investment_favorites")
          .delete()
          .eq("id", existing.id)
          .eq("user_id", user.id);

        if (deleteError) throw deleteError;

        setFavorites((prev) => prev.filter((item) => item.id !== existing.id));
        setStatus(`${symbol} removed from watchlist.`);
        setWorking(false);
        return;
      }

      const { data, error: insertError } = await supabase
        .from("investment_favorites")
        .insert({
          user_id: user.id,
          symbol,
          name: row?.name || symbol,
          asset_type: row?.type || "Stock",
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setFavorites((prev) => [data, ...prev]);
      setStatus(`${symbol} added to watchlist.`);
    } catch (watchError) {
      console.error(watchError);
      setError(`Could not update ${symbol}.`);
    } finally {
      setWorking(false);
    }
  }

  const selectedQuote = selectedResult ? quotes[selectedResult.symbol] || null : null;
  const selectedTone = toneByValue(selectedQuote?.changesPercentage ?? selectedQuote?.change ?? 0);
  const selectedMeta = toneMeta(selectedTone);

  const decision = useMemo(() => {
    if (!selectedResult) return null;
    return buildDiscoverDecision({
      row: selectedResult,
      quote: selectedQuote,
      newsCount: news.length,
      owned: ownedSymbols.has(selectedResult.symbol),
      watched: favoriteSymbols.has(selectedResult.symbol),
    });
  }, [selectedResult, selectedQuote, news.length, ownedSymbols, favoriteSymbols]);

  return (
    <main className={styles.page}>
      {(status || error) && (
        <GlassPane className={styles.statusStrip}>
          <div className={styles.statusTitle}>{error ? "discover error" : "discover update"}</div>
          <div className={styles.statusText}>{error || status}</div>
        </GlassPane>
      )}

      <GlassPane className={styles.topStrip}>
        <div className={styles.topMain}>
          <div>
            <div className={styles.pageMicro}>Invest / Discover Intelligence</div>
            <div className={styles.pageName}>Discover</div>
            <div className={styles.pageSub}>
              Search, compare, understand the stock, and decide whether the setup fits long-term or trader logic.
            </div>
          </div>

          <div className={styles.pageActions}>
            <ActionLink href="/investments" variant="primary">
              Portfolio <ArrowRight size={14} />
            </ActionLink>
          </div>
        </div>

        <div className={styles.compactSearchRow}>
          <div className={styles.searchDock}>
            <input
              className={styles.compactField}
              placeholder="Search ticker or company"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select
              className={styles.compactSelect}
              value={type}
              onChange={(event) => setType(event.target.value)}
            >
              {DISCOVER_TYPES.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
            <ActionBtn variant="primary" onClick={() => runSearch()}>
              Search
            </ActionBtn>
          </div>

          <div className={styles.slimChipRow}>
            {DISCOVER_QUICK_SEARCHES.map((chip) => (
              <button
                key={chip}
                type="button"
                className={styles.rangeButton}
                onClick={() => {
                  setQuery(chip);
                  runSearch(chip, type);
                }}
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.inlineMetricStrip}>
          <div className={styles.inlineMetricCell}>
            <div className={styles.inlineMetricLabel}>Desk names</div>
            <div className={styles.inlineMetricValue}>{assets.length}</div>
            <div className={styles.inlineMetricNote}>already tracked</div>
          </div>
          <div className={styles.inlineMetricCell}>
            <div className={styles.inlineMetricLabel}>Watchlist</div>
            <div className={styles.inlineMetricValue}>{favorites.length}</div>
            <div className={styles.inlineMetricNote}>saved</div>
          </div>
          <div className={styles.inlineMetricCell}>
            <div className={styles.inlineMetricLabel}>Results</div>
            <div className={styles.inlineMetricValue}>{results.length}</div>
            <div className={styles.inlineMetricNote}>current search</div>
          </div>
          <div className={styles.inlineMetricCell}>
            <div className={styles.inlineMetricLabel}>Workspace</div>
            <div className={styles.inlineMetricValue}>{loadingWorkspace ? "..." : "Ready"}</div>
            <div className={styles.inlineMetricNote}>decision engine live</div>
          </div>
        </div>
      </GlassPane>

      <div className={styles.deskGrid}>
        <GlassPane className={styles.deskSurface}>
          <div className={styles.surfaceHeader}>
            <div>
              <div className={styles.surfaceTitle}>Results</div>
              <div className={styles.surfaceSub}>Selected symbol drives the intelligence panel.</div>
            </div>
            <MiniPill>{results.length} results</MiniPill>
          </div>

          <div className={styles.tableArea}>
            {loadingSearch ? (
              <div className={styles.quietEmpty}>
                <div className={styles.emptyTitle}>Searching market</div>
                <div className={styles.emptyText}>Pulling the result set now.</div>
              </div>
            ) : results.length ? (
              <div className={styles.resultList}>
                {results.map((row) => (
                  <SearchResultRow
                    key={`${row.symbol}-${row.exchange}`}
                    row={row}
                    quote={quotes[row.symbol] || null}
                    selected={row.symbol === selectedResult?.symbol}
                    owned={ownedSymbols.has(row.symbol)}
                    watched={favoriteSymbols.has(row.symbol)}
                    onSelect={() => setSelectedSymbol(row.symbol)}
                  />
                ))}
              </div>
            ) : (
              <div className={styles.quietEmpty}>
                <div className={styles.emptyTitle}>Search a ticker or company</div>
                <div className={styles.emptyText}>
                  Use the search bar or a quick chip. This page is for understanding the stock, not just locating it.
                </div>
              </div>
            )}
          </div>
        </GlassPane>

        <GlassPane className={styles.deskSurface}>
          {selectedResult && decision ? (
            <>
              <div className={styles.surfaceHeader}>
                <div>
                  <div className={styles.surfaceTitle}>{selectedResult.symbol}</div>
                  <div className={styles.surfaceSub}>
                    {selectedResult.name} • {selectedResult.exchange || "Market"} • {selectedResult.type || "Stock"}
                  </div>
                </div>

                <div className={styles.focusStackFlat}>
                  <div
                    className={styles.focusHeadline}
                    style={{ color: selectedTone === "neutral" ? "#fff" : selectedMeta.text }}
                  >
                    {selectedQuote?.price != null ? money(selectedQuote.price) : "—"}
                  </div>
                  <div
                    className={styles.surfaceSub}
                    style={{ color: selectedTone === "neutral" ? "rgba(255,255,255,0.66)" : selectedMeta.text }}
                  >
                    {selectedQuote?.change != null
                      ? `${signedMoney(selectedQuote.change)} • ${pct(selectedQuote.changesPercentage)}`
                      : "waiting on quote"}
                  </div>
                </div>
              </div>

              <div className={styles.pageActions}>
                <ActionBtn
                  variant="primary"
                  onClick={() => addToDesk(selectedResult.symbol)}
                  disabled={working || ownedSymbols.has(selectedResult.symbol)}
                >
                  <Plus size={14} />
                  {ownedSymbols.has(selectedResult.symbol) ? "On Desk" : "Add to Desk"}
                </ActionBtn>

                <ActionBtn onClick={() => toggleWatch(selectedResult)} disabled={working}>
                  <Star size={14} />
                  {favoriteSymbols.has(selectedResult.symbol) ? "Watching" : "Save Watch"}
                </ActionBtn>

                <ActionLink href={`/market/${encodeURIComponent(selectedResult.symbol)}`}>
                  Open Market <ExternalLink size={14} />
                </ActionLink>
              </div>

              <div className={styles.surfaceDivider} />

              <div className={styles.decisionGrid}>
                <ScoreCard
                  label="Overall"
                  value={decision.overallScore}
                  note={decision.style === "trader" ? "best read as a trader setup" : "best read as a long-term setup"}
                  tone={decision.overallScore >= 70 ? "green" : decision.overallScore < 55 ? "red" : "amber"}
                />
                <ScoreCard
                  label="Long-term"
                  value={decision.longTermScore}
                  note="quality / size / stability"
                  tone={decision.longTermScore >= 70 ? "green" : decision.longTermScore < 55 ? "red" : "amber"}
                />
                <ScoreCard
                  label="Trader"
                  value={decision.traderScore}
                  note="movement / liquidity / attention"
                  tone={decision.traderScore >= 70 ? "green" : decision.traderScore < 55 ? "red" : "amber"}
                />
                <ScoreCard
                  label="Entry"
                  value={decision.entryScore}
                  note="how clean the current entry looks"
                  tone={decision.entryScore >= 65 ? "green" : decision.entryScore < 50 ? "red" : "amber"}
                />
              </div>

              <div className={styles.verdictStrip}>
                <div>
                  <div className={styles.verdictTitle}>{decision.verdict}</div>
                  <div className={styles.verdictText}>{decision.verdictSub}</div>
                </div>
                <MiniPill tone="blue">light model</MiniPill>
              </div>

              <div className={styles.bulletGrid}>
                <ReasonBlock title="Why now" items={decision.whyNow} />
                <ReasonBlock title="Why not now" items={decision.whyNot} />
                <ReasonBlock title="Watch for" items={decision.watchFor} />
              </div>

              <div className={styles.surfaceDivider} />

              <div className={styles.focusSubgrid}>
                <div className={styles.focusCell}>
                  <div className={styles.inlineMetricLabel}>Market cap</div>
                  <div className={styles.focusValue}>
                    {selectedQuote?.marketCap != null ? compactNumber(selectedQuote.marketCap) : "—"}
                  </div>
                </div>
                <div className={styles.focusCell}>
                  <div className={styles.inlineMetricLabel}>Volume</div>
                  <div className={styles.focusValue}>
                    {selectedQuote?.volume != null ? compactNumber(selectedQuote.volume) : "—"}
                  </div>
                </div>
                <div className={styles.focusCell}>
                  <div className={styles.inlineMetricLabel}>Exchange</div>
                  <div className={styles.focusValue}>{selectedResult.exchange || "—"}</div>
                </div>
                <div className={styles.focusCell}>
                  <div className={styles.inlineMetricLabel}>Type</div>
                  <div className={styles.focusValue}>{selectedResult.type || "Stock"}</div>
                </div>
              </div>

              <div className={styles.surfaceDivider} />

              <div className={styles.surfaceHeader}>
                <div>
                  <div className={styles.surfaceTitle}>Headlines</div>
                  <div className={styles.surfaceSub}>
                    Catalysts that might strengthen or weaken the current setup.
                  </div>
                </div>
                <MiniPill>{news.length} stories</MiniPill>
              </div>

              {news.length ? (
                <div className={styles.newsList}>
                  {news.map((item, index) => (
                    <NewsRow key={`${item.url}-${index}`} item={item} />
                  ))}
                </div>
              ) : (
                <div className={styles.quietEmpty}>
                  <div className={styles.emptyTitle}>No headlines returned</div>
                  <div className={styles.emptyText}>The news route came back empty for this symbol.</div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className={styles.surfaceHeader}>
                <div>
                  <div className={styles.surfaceTitle}>Discover intelligence</div>
                  <div className={styles.surfaceSub}>
                    Search a stock and this side turns into the explanation engine.
                  </div>
                </div>
              </div>

              <div className={styles.quietEmpty}>
                <div className={styles.emptyTitle}>No symbol selected</div>
                <div className={styles.emptyText}>
                  Search a stock, click a result, and this panel will break down whether it looks stronger for long-term ownership or for trading.
                </div>
              </div>

              <div className={styles.surfaceDivider} />

              <div className={styles.surfaceHeader}>
                <div>
                  <div className={styles.surfaceTitle}>Watchlist</div>
                  <div className={styles.surfaceSub}>Saved names ready for later.</div>
                </div>
                <MiniPill>{favorites.length}</MiniPill>
              </div>

              {favorites.length ? (
                <div className={styles.watchList}>
                  {favorites.slice(0, 4).map((item) => (
                    <WatchRow
                      key={item.id}
                      symbol={asSymbol(item.symbol)}
                      name={item.name || item.asset_type || "Watchlist"}
                      quote={quotes[asSymbol(item.symbol)] || null}
                      href={`/market/${encodeURIComponent(asSymbol(item.symbol))}`}
                    />
                  ))}
                </div>
              ) : null}

              <div className={styles.surfaceDivider} />

              <div className={styles.surfaceHeader}>
                <div>
                  <div className={styles.surfaceTitle}>Tape</div>
                  <div className={styles.surfaceSub}>Macro names worth keeping visible.</div>
                </div>
              </div>

              <div className={styles.boardGrid}>
                {BOARD_SYMBOLS.slice(0, 4).map((item) => (
                  <BoardCard
                    key={item.symbol}
                    symbol={item.symbol}
                    label={item.label}
                    quote={quotes[item.symbol] || null}
                    href={`/market/${encodeURIComponent(item.symbol)}`}
                  />
                ))}
              </div>
            </>
          )}
        </GlassPane>
      </div>
    </main>
  );
}

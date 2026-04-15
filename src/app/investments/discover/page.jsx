"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpenText,
  ExternalLink,
  Newspaper,
  Plus,
  Search,
  Star,
  Wallet,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import GlassPane from "../../components/GlassPane";
import styles from "../InvestmentsPage.module.css";
import { ActionBtn, ActionLink, MiniPill } from "../investments.components";
import {
  BOARD_SYMBOLS,
  DISCOVER_QUICK_SEARCHES,
  DISCOVER_TYPES,
  asSymbol,
  fullDateTime,
  money,
  normalizeMarketResults,
  parseBatchPrices,
  pct,
  signedMoney,
  toneByValue,
  toneMeta,
} from "../investments.helpers";

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function EmptyState({ title, detail }) {
  return (
    <div className={styles.emptyState}>
      <div>
        <div className={styles.emptyTitle}>{title}</div>
        <div className={styles.emptyText}>{detail}</div>
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
      className={styles.feedItem}
    >
      <div className={styles.feedIconWrap}>
        <Newspaper size={16} />
      </div>

      <div className={styles.feedMain}>
        <div className={styles.feedTitle}>{item.title || "Untitled headline"}</div>
        <div className={styles.feedSub}>{item.text || item.site || "Market story"}</div>
        <div className={styles.feedMeta}>
          {(item.site || "Source") + " • " + fullDateTime(item.publishedDate)}
        </div>
      </div>

      <div className={styles.feedRight}>
        <ExternalLink size={14} className={styles.feedLinkIcon} />
      </div>
    </a>
  );
}

function ResultRow({ row, quote, selected, onClick, owned, watched }) {
  const tone = toneByValue(quote?.changesPercentage ?? quote?.change ?? 0);
  const meta = toneMeta(tone);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(styles.navigatorRow, selected && styles.navigatorRowActive)}
      style={{
        borderColor: selected ? meta.border : undefined,
        boxShadow: selected ? `0 0 18px ${meta.glow}` : undefined,
      }}
    >
      <div
        className={styles.navigatorAccent}
        style={{ background: selected ? meta.text : "transparent" }}
      />

      <div
        className={styles.navigatorAvatar}
        style={{
          borderColor: meta.border,
          background: meta.iconBg,
          color: tone === "neutral" ? "#fff" : meta.text,
        }}
      >
        {row.symbol.slice(0, 2)}
      </div>

      <div className={styles.navigatorMain}>
        <div className={styles.navigatorTop}>
          <div className={styles.navigatorName}>{row.symbol}</div>
          <div className={styles.navigatorAmount}>
            {Number.isFinite(Number(quote?.price)) ? money(quote.price) : "—"}
          </div>
        </div>

        <div className={styles.navigatorMeta}>
          {row.name} • {row.exchange || "Market"} • {row.currency || "USD"}
        </div>

        <div className={styles.navigatorBadges}>
          <MiniPill>{row.type || "Stock"}</MiniPill>
          {quote?.changesPercentage != null ? (
            <MiniPill tone={tone}>{pct(quote.changesPercentage)}</MiniPill>
          ) : null}
          {owned ? <MiniPill tone="green">on desk</MiniPill> : null}
          {watched ? <MiniPill tone="amber">watching</MiniPill> : null}
        </div>
      </div>
    </button>
  );
}

function DeskRow({ asset }) {
  return (
    <Link href={`/investments/${asset.id}`} className={styles.favoriteRow}>
      <div className={styles.favoriteIcon}>
        <Wallet size={14} />
      </div>
      <div className={styles.favoriteMain}>
        <div className={styles.favoriteName}>{asSymbol(asset.symbol)}</div>
        <div className={styles.favoriteSub}>{asset.account || "Brokerage"}</div>
      </div>
      <div className={styles.favoritePrice}>Desk</div>
    </Link>
  );
}

function WatchRow({ row, quote }) {
  const tone = toneByValue(quote?.changesPercentage ?? quote?.change ?? 0);
  const meta = toneMeta(tone);

  return (
    <Link href={`/market/${asSymbol(row.symbol)}`} className={styles.favoriteRow}>
      <div
        className={styles.favoriteIcon}
        style={{
          borderColor: meta.border,
          background: meta.iconBg,
          color: tone === "neutral" ? "#fff" : meta.text,
        }}
      >
        <Star size={14} />
      </div>
      <div className={styles.favoriteMain}>
        <div className={styles.favoriteName}>{asSymbol(row.symbol)}</div>
        <div className={styles.favoriteSub}>{row.name || "Saved name"}</div>
      </div>
      <div
        className={styles.favoritePrice}
        style={{ color: tone === "neutral" ? "rgba(255,255,255,0.76)" : meta.text }}
      >
        {Number.isFinite(Number(quote?.price)) ? money(quote.price) : "—"}
      </div>
    </Link>
  );
}

function BoardCard({ symbol, label, quote }) {
  const tone = toneByValue(quote?.changesPercentage ?? quote?.change ?? 0);
  const meta = toneMeta(tone);

  return (
    <Link href={`/market/${symbol}`} className={styles.marketCard}>
      <div className={styles.marketCardTop}>
        <div>
          <div className={styles.marketLabel}>{label}</div>
          <div className={styles.marketSymbol}>{symbol}</div>
        </div>

        <div
          className={styles.marketIcon}
          style={{
            borderColor: meta.border,
            background: meta.iconBg,
            color: tone === "neutral" ? "#fff" : meta.text,
          }}
        >
          <BookOpenText size={14} />
        </div>
      </div>

      <div className={styles.marketPrice}>
        {Number.isFinite(Number(quote?.price)) ? money(quote.price) : "—"}
      </div>

      <div
        className={styles.marketMove}
        style={{ color: tone === "neutral" ? "rgba(255,255,255,0.62)" : meta.text }}
      >
        {Number.isFinite(Number(quote?.change)) ? signedMoney(quote.change) : "Waiting"}
        {Number.isFinite(Number(quote?.changesPercentage))
          ? ` • ${pct(quote.changesPercentage)}`
          : ""}
      </div>
    </Link>
  );
}

function SnapshotStat({ label, value, note }) {
  return (
    <div className={styles.summaryStat}>
      <div className={styles.summaryLabel}>{label}</div>
      <div className={styles.summaryValue}>{value}</div>
      <div className={styles.summaryHint}>{note}</div>
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
          console.error(assetRes.error || favoriteRes.error);
          if (!cancelled) {
            setError("Failed loading research workspace.");
            setLoadingWorkspace(false);
          }
          return;
        }

        if (!cancelled) {
          setAssets(assetRes.data || []);
          setFavorites(favoriteRes.data || []);
          setLoadingWorkspace(false);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError("Failed loading research workspace.");
          setLoadingWorkspace(false);
        }
      }
    }

    loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, []);

  const ownedSymbols = useMemo(() => {
    return new Set(assets.map((asset) => asSymbol(asset.symbol)).filter(Boolean));
  }, [assets]);

  const favoriteSymbols = useMemo(() => {
    return new Set(favorites.map((row) => asSymbol(row.symbol)).filter(Boolean));
  }, [favorites]);

  const selectedResult = useMemo(() => {
    return results.find((row) => row.symbol === selectedSymbol) || results[0] || null;
  }, [results, selectedSymbol]);

  const watchSymbols = useMemo(() => {
    const resultSymbols = results.slice(0, 16).map((row) => asSymbol(row.symbol));
    const saved = favorites.slice(0, 10).map((row) => asSymbol(row.symbol));
    const owned = assets.slice(0, 10).map((row) => asSymbol(row.symbol));
    const selected = selectedResult?.symbol ? [asSymbol(selectedResult.symbol)] : [];

    return [
      ...new Set([
        ...BOARD_SYMBOLS.map((b) => b.symbol),
        ...resultSymbols,
        ...saved,
        ...owned,
        ...selected,
      ]),
    ].filter(Boolean);
  }, [results, favorites, assets, selectedResult]);

  useEffect(() => {
    let cancelled = false;

    async function loadPrices() {
      if (!watchSymbols.length) {
        setQuotes({});
        return;
      }

      try {
        const res = await fetch(
          `/api/prices-batch?symbols=${encodeURIComponent(watchSymbols.join(","))}`,
          { cache: "no-store" }
        );
        const data = await res.json();

        if (!cancelled && res.ok) {
          setQuotes(parseBatchPrices(data));
        }
      } catch (err) {
        if (cancelled) return;
        console.error("discover price batch failed", err);
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
      const symbol = asSymbol(selectedResult?.symbol);
      if (!symbol) {
        setNews([]);
        return;
      }

      try {
        const res = await fetch(
          `/api/stock-news?symbols=${encodeURIComponent(symbol)}&limit=6`,
          { cache: "no-store" }
        );
        const data = await res.json();

        if (!cancelled) {
          setNews(res.ok && Array.isArray(data?.articles) ? data.articles : []);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("discover news failed", err);
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

      const res = await fetch(
        `/api/market-search?query=${encodeURIComponent(clean)}&type=${encodeURIComponent(nextType)}&limit=24`,
        { cache: "no-store" }
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Search failed.");
        setLoadingSearch(false);
        return;
      }

      const nextResults = normalizeMarketResults(data?.results || []);
      setResults(nextResults);
      setSelectedSymbol(nextResults[0]?.symbol || "");
    } catch (err) {
      console.error(err);
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

      if (insertError) {
        console.error(insertError);
        setError(`Could not add ${clean}.`);
        setWorking(false);
        return;
      }

      setAssets((prev) => [data, ...prev]);
      setStatus(`${clean} added to your portfolio desk.`);
    } catch (err) {
      console.error(err);
      setError("Failed adding the symbol.");
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

        if (deleteError) {
          console.error(deleteError);
          setError(`Could not remove ${symbol} from watchlist.`);
          setWorking(false);
          return;
        }

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

      if (insertError) {
        console.error(insertError);
        setError(`Could not save ${symbol} to watchlist.`);
        setWorking(false);
        return;
      }

      setFavorites((prev) => [data, ...prev]);
      setStatus(`${symbol} added to watchlist.`);
    } catch (err) {
      console.error(err);
      setError("Failed updating watchlist.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <main className={styles.page}>
      {(status || error) && (
        <GlassPane className={styles.statusStrip}>
          <div className={styles.statusTitle}>{error ? "Research error" : "Research update"}</div>
          <div className={styles.statusText}>{error || status}</div>
        </GlassPane>
      )}

      <GlassPane className={styles.summaryStrip}>
        <div className={styles.summaryInner}>
          <div className={styles.titleBlock}>
            <div className={styles.eyebrow}>Stocks / Research Desk</div>
            <div className={styles.pageTitleRow}>
              <div className={styles.pageTitle}>Discover</div>
              <MiniPill tone="blue">lab</MiniPill>
            </div>
            <div className={styles.workspaceCopy}>
              Search, compare, save, and push names into the portfolio desk without the page feeling empty or fake.
            </div>
          </div>

          <div className={styles.summaryStats}>
            <SnapshotStat label="Positions" value={assets.length} note="on your desk" />
            <SnapshotStat label="Watchlist" value={favorites.length} note="saved names" />
            <SnapshotStat label="Results" value={results.length} note="search universe" />
            <SnapshotStat label="Focus" value={selectedResult?.symbol || "—"} note={selectedResult?.type || "no symbol selected"} />
            <SnapshotStat label="Workspace" value={loadingWorkspace ? "..." : "Ready"} note="research route live" />
          </div>

          <div className={styles.summaryRight}>
            <ActionLink href="/investments">
              Portfolio Desk <ArrowRight size={14} />
            </ActionLink>
          </div>
        </div>
      </GlassPane>

      <div className={styles.workspace}>
        <div className={styles.leftCol}>
          <GlassPane className={styles.navigatorPane}>
            <div className={styles.paneHeader}>
              <div>
                <div className={styles.paneTitle}>Search universe</div>
                <div className={styles.paneSub}>Find stocks and ETFs fast.</div>
              </div>
              <MiniPill>{results.length} results</MiniPill>
            </div>

            <form
              className={styles.queueToolbar}
              onSubmit={(e) => {
                e.preventDefault();
                runSearch();
              }}
            >
              <label className={styles.searchWrap}>
                <Search size={14} />
                <input
                  className={styles.searchInput}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search AAPL, Nvidia, VOO..."
                />
              </label>

              <div className={styles.fieldActionRow}>
                <select
                  className={styles.field}
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  {DISCOVER_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>

                <ActionBtn type="submit" variant="primary">
                  Search
                </ActionBtn>
              </div>
            </form>

            <div className={styles.chipRow} style={{ marginBottom: 8 }}>
              {DISCOVER_QUICK_SEARCHES.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={cx(styles.chipButton, query === value && styles.chipButtonActive)}
                  onClick={() => {
                    setQuery(value);
                    runSearch(value, type);
                  }}
                >
                  {value}
                </button>
              ))}
            </div>

            {loadingSearch ? (
              <EmptyState title="Searching market" detail="Pulling symbol results now." />
            ) : results.length ? (
              <div className={styles.navigatorList}>
                {results.map((row) => (
                  <ResultRow
                    key={`${row.symbol}-${row.exchange}`}
                    row={row}
                    quote={quotes[row.symbol] || null}
                    selected={row.symbol === selectedResult?.symbol}
                    onClick={() => setSelectedSymbol(row.symbol)}
                    owned={ownedSymbols.has(row.symbol)}
                    watched={favoriteSymbols.has(row.symbol)}
                  />
                ))}
              </div>
            ) : (
              <div style={{ display: "grid", gap: 8, minHeight: 0, overflow: "auto", paddingRight: 2 }}>
                <div className={styles.panel}>
                  <div className={styles.paneHeader}>
                    <div>
                      <div className={styles.paneTitle}>Already on desk</div>
                      <div className={styles.paneSub}>Names you already track.</div>
                    </div>
                    <MiniPill>{assets.length}</MiniPill>
                  </div>

                  {assets.length ? (
                    <div className={styles.feedList}>
                      {assets.slice(0, 4).map((asset) => (
                        <DeskRow key={asset.id} asset={asset} />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="Search the market"
                      detail="Use a ticker, company name, or one of the quick chips."
                    />
                  )}
                </div>

                <div className={styles.panel}>
                  <div className={styles.paneHeader}>
                    <div>
                      <div className={styles.paneTitle}>Saved names</div>
                      <div className={styles.paneSub}>Watchlist names ready for later.</div>
                    </div>
                    <MiniPill>{favorites.length}</MiniPill>
                  </div>

                  {favorites.length ? (
                    <div className={styles.feedList}>
                      {favorites.slice(0, 4).map((row) => (
                        <WatchRow
                          key={row.id}
                          row={row}
                          quote={quotes[asSymbol(row.symbol)] || null}
                        />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="No saved names yet"
                      detail="Search a name and hit Save Watch to build the list."
                    />
                  )}
                </div>
              </div>
            )}
          </GlassPane>
        </div>

        <div className={styles.mainCol}>
          <GlassPane className={styles.focusPane}>
            {selectedResult ? (
              <div className={styles.focusStack}>
                <div className={styles.focusHeader}>
                  <div>
                    <div className={styles.eyebrow}>Research focus</div>
                    <div className={styles.focusTitle}>{selectedResult.symbol}</div>
                    <div className={styles.focusMeta}>
                      {selectedResult.name} • {selectedResult.exchange || "Market"} • {selectedResult.type || "Stock"}
                    </div>
                  </div>

                  <div className={styles.focusHeaderRight}>
                    <div className={styles.focusBadges}>
                      <MiniPill>{selectedResult.type}</MiniPill>
                      {Number.isFinite(Number(quotes[selectedResult.symbol]?.changesPercentage)) ? (
                        <MiniPill tone={toneByValue(quotes[selectedResult.symbol]?.changesPercentage)}>
                          {pct(quotes[selectedResult.symbol]?.changesPercentage)}
                        </MiniPill>
                      ) : null}
                    </div>

                    <div className={styles.focusActionRow}>
                      <ActionBtn
                        variant="primary"
                        onClick={() => addToDesk(selectedResult.symbol)}
                        disabled={working || ownedSymbols.has(selectedResult.symbol)}
                      >
                        <Plus size={14} />
                        {ownedSymbols.has(selectedResult.symbol) ? "On Desk" : "Add to Desk"}
                      </ActionBtn>

                      <ActionBtn
                        onClick={() => toggleWatch(selectedResult)}
                        disabled={working}
                      >
                        <Star size={14} />
                        {favoriteSymbols.has(selectedResult.symbol) ? "Watching" : "Save Watch"}
                      </ActionBtn>

                      <ActionLink href={`/market/${encodeURIComponent(selectedResult.symbol)}`}>
                        Open Market <ExternalLink size={14} />
                      </ActionLink>
                    </div>
                  </div>
                </div>

                <div className={styles.splitLayout}>
                  <div className={styles.panel}>
                    <div className={styles.metricGrid}>
                      <div className={styles.metricCard}>
                        <div className={styles.metricIcon}>
                          <Wallet size={16} />
                        </div>
                        <div className={styles.metricLabel}>Price</div>
                        <div className={styles.metricValue}>
                          {Number.isFinite(Number(quotes[selectedResult.symbol]?.price))
                            ? money(quotes[selectedResult.symbol]?.price)
                            : "—"}
                        </div>
                        <div className={styles.metricSub}>Live quote</div>
                      </div>

                      <div className={styles.metricCard}>
                        <div className={styles.metricIcon}>
                          <BookOpenText size={16} />
                        </div>
                        <div className={styles.metricLabel}>Daily Move</div>
                        <div
                          className={styles.metricValue}
                          style={{
                            color: toneMeta(
                              toneByValue(
                                quotes[selectedResult.symbol]?.changesPercentage ??
                                  quotes[selectedResult.symbol]?.change ??
                                  0
                              )
                            ).text,
                          }}
                        >
                          {Number.isFinite(Number(quotes[selectedResult.symbol]?.change))
                            ? signedMoney(quotes[selectedResult.symbol]?.change)
                            : "—"}
                        </div>
                        <div className={styles.metricSub}>
                          {Number.isFinite(Number(quotes[selectedResult.symbol]?.changesPercentage))
                            ? pct(quotes[selectedResult.symbol]?.changesPercentage)
                            : "waiting"}
                        </div>
                      </div>

                      <div className={styles.metricCard}>
                        <div className={styles.metricIcon}>
                          <Search size={16} />
                        </div>
                        <div className={styles.metricLabel}>Exchange</div>
                        <div className={styles.metricValue}>{selectedResult.exchange || "—"}</div>
                        <div className={styles.metricSub}>{selectedResult.currency || "USD"}</div>
                      </div>

                      <div className={styles.metricCard}>
                        <div className={styles.metricIcon}>
                          <Star size={16} />
                        </div>
                        <div className={styles.metricLabel}>Status</div>
                        <div className={styles.metricValue}>
                          {ownedSymbols.has(selectedResult.symbol)
                            ? "Owned"
                            : favoriteSymbols.has(selectedResult.symbol)
                              ? "Watching"
                              : "Research"}
                        </div>
                        <div className={styles.metricSub}>workspace relationship</div>
                      </div>
                    </div>

                    <div style={{ marginTop: 10 }}>
                      <div className={styles.paneHeader}>
                        <div>
                          <div className={styles.paneTitle}>Headlines</div>
                          <div className={styles.paneSub}>
                            Live symbol news for {selectedResult.symbol}.
                          </div>
                        </div>
                        <MiniPill>{news.length} stories</MiniPill>
                      </div>

                      {news.length ? (
                        <div className={styles.feedList}>
                          {news.slice(0, 4).map((item, index) => (
                            <HeadlineRow key={`${item.url}-${index}`} item={item} />
                          ))}
                        </div>
                      ) : (
                        <EmptyState
                          title="No headlines yet"
                          detail="Search another name or wait for the news route to return."
                        />
                      )}
                    </div>
                  </div>

                  <div className={styles.asideStack}>
                    <div className={styles.panel}>
                      <div className={styles.paneHeader}>
                        <div>
                          <div className={styles.paneTitle}>Board watch</div>
                          <div className={styles.paneSub}>Keep a few macro names visible.</div>
                        </div>
                      </div>

                      <div className={styles.marketBoardGrid}>
                        {BOARD_SYMBOLS.slice(0, 4).map((item) => (
                          <BoardCard
                            key={item.symbol}
                            symbol={item.symbol}
                            label={item.label}
                            quote={quotes[item.symbol] || null}
                          />
                        ))}
                      </div>
                    </div>

                    <div className={styles.panel}>
                      <div className={styles.paneHeader}>
                        <div>
                          <div className={styles.paneTitle}>Quick routes</div>
                          <div className={styles.paneSub}>Fast next steps.</div>
                        </div>
                      </div>

                      <div className={styles.ctaStack}>
                        <ActionLink href="/investments">
                          Portfolio Desk <ArrowRight size={14} />
                        </ActionLink>
                        <ActionLink href={`/market/${encodeURIComponent(selectedResult.symbol)}`}>
                          Open Market <ExternalLink size={14} />
                        </ActionLink>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.focusStack}>
                <div className={styles.focusHeader}>
                  <div>
                    <div className={styles.eyebrow}>Research desk</div>
                    <div className={styles.focusTitle}>Find the next stock</div>
                    <div className={styles.focusMeta}>
                      This page stays useful before search instead of just sitting there dead.
                    </div>
                  </div>

                  <div className={styles.focusHeaderRight}>
                    <div className={styles.focusBadges}>
                      <MiniPill tone="blue">search</MiniPill>
                      <MiniPill tone="amber">watchlist</MiniPill>
                    </div>
                  </div>
                </div>

                <div className={styles.splitLayout}>
                  <div className={styles.panel}>
                    <div className={styles.paneHeader}>
                      <div>
                        <div className={styles.paneTitle}>Market board</div>
                        <div className={styles.paneSub}>Starter market view without wasted space.</div>
                      </div>
                    </div>

                    <div className={styles.marketBoardGrid}>
                      {BOARD_SYMBOLS.map((item) => (
                        <BoardCard
                          key={item.symbol}
                          symbol={item.symbol}
                          label={item.label}
                          quote={quotes[item.symbol] || null}
                        />
                      ))}
                    </div>
                  </div>

                  <div className={styles.asideStack}>
                    <div className={styles.panel}>
                      <div className={styles.paneHeader}>
                        <div>
                          <div className={styles.paneTitle}>Owned positions</div>
                          <div className={styles.paneSub}>What is already on your desk.</div>
                        </div>
                        <MiniPill>{assets.length}</MiniPill>
                      </div>

                      {assets.length ? (
                        <div className={styles.feedList}>
                          {assets.slice(0, 6).map((asset) => (
                            <DeskRow key={asset.id} asset={asset} />
                          ))}
                        </div>
                      ) : (
                        <EmptyState
                          title="No positions yet"
                          detail="Search something and add it to the desk."
                        />
                      )}
                    </div>

                    <div className={styles.panel}>
                      <div className={styles.paneHeader}>
                        <div>
                          <div className={styles.paneTitle}>Watchlist</div>
                          <div className={styles.paneSub}>Saved names ready for later.</div>
                        </div>
                        <MiniPill>{favorites.length}</MiniPill>
                      </div>

                      {favorites.length ? (
                        <div className={styles.feedList}>
                          {favorites.slice(0, 6).map((row) => (
                            <WatchRow
                              key={row.id}
                              row={row}
                              quote={quotes[asSymbol(row.symbol)] || null}
                            />
                          ))}
                        </div>
                      ) : (
                        <EmptyState
                          title="No saved names"
                          detail="Search a name and hit Save Watch."
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </GlassPane>
        </div>
      </div>
    </main>
  );
}
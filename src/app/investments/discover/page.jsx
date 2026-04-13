"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeDollarSign,
  BookOpenText,
  ExternalLink,
  Layers3,
  Newspaper,
  Plus,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import GlassPane from "../../components/GlassPane";
import styles from "../InvestmentsPage.module.css";
import {
  fullDateTime,
  money,
  pct,
  shortDate,
  signedMoney,
  toneByValue,
  toneMeta,
  toNum,
} from "../investments.helpers";

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function MiniPill({ children, tone = "neutral" }) {
  const meta = toneMeta(tone);

  return (
    <div
      className={styles.miniPill}
      style={{
        borderColor: meta.border,
        color: tone === "neutral" ? "rgba(255,255,255,0.9)" : meta.text,
        boxShadow: `0 0 12px ${meta.glow}`,
      }}
    >
      {children}
    </div>
  );
}

function ActionLink({ href, children }) {
  return (
    <Link href={href} className={styles.actionLink}>
      {children}
    </Link>
  );
}

function ActionBtn({
  children,
  onClick,
  variant = "ghost",
  disabled = false,
  type = "button",
  full = false,
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        styles.actionBtn,
        variant === "primary" && styles.actionBtnPrimary,
        variant === "danger" && styles.actionBtnDanger,
        full && styles.actionBtnFull
      )}
    >
      {children}
    </button>
  );
}

function PaneHeader({ title, subcopy, right }) {
  return (
    <div className={styles.paneHeader}>
      <div style={{ minWidth: 0 }}>
        <div className={styles.paneTitle}>{title}</div>
        {subcopy ? <div className={styles.paneSub}>{subcopy}</div> : null}
      </div>
      {right || null}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className={styles.fieldWrap}>
      <span>{label}</span>
      {children}
    </label>
  );
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

function TradeLedgerRow({ row, selected, onClick }) {
  const type = String(row.txn_type || "").toUpperCase();
  const tone = type === "SELL" ? toneByValue(row.realizedOnTxn) : "neutral";
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
          color: type === "SELL" ? meta.text : "#fff",
        }}
      >
        {type === "SELL" ? "S" : "B"}
      </div>

      <div className={styles.navigatorMain}>
        <div className={styles.navigatorTop}>
          <div className={styles.navigatorName}>
            {type} • {toNum(row.qty).toLocaleString(undefined, { maximumFractionDigits: 4 })}
          </div>
          <div className={styles.navigatorAmount}>{money(toNum(row.qty) * toNum(row.price))}</div>
        </div>

        <div className={styles.navigatorMeta}>
          {money(row.price)} • {shortDate(row.txn_date)}
        </div>

        <div className={styles.navigatorBadges}>
          <MiniPill tone={tone}>{type}</MiniPill>
          {type === "SELL" ? (
            <MiniPill tone={tone}>{signedMoney(row.realizedOnTxn)}</MiniPill>
          ) : (
            <MiniPill>basis build</MiniPill>
          )}
        </div>
      </div>
    </button>
  );
}

export default function InvestmentAssetPage() {
  const params = useParams();
  const assetId = params?.id;

  const [asset, setAsset] = useState(null);
  const [txns, setTxns] = useState([]);
  const [livePrice, setLivePrice] = useState(null);
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [selectedTradeId, setSelectedTradeId] = useState("");
  const [boardTab, setBoardTab] = useState("overview");

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
        setError("You must be logged in.");
        setLoading(false);
        return;
      }

      const { data: assetRow, error: assetError } = await supabase
        .from("investment_assets")
        .select("*")
        .eq("id", assetId)
        .eq("user_id", user.id)
        .single();

      if (assetError || !assetRow) {
        console.error(assetError);
        setError("Could not load asset.");
        setLoading(false);
        return;
      }

      const { data: txnRows, error: txnError } = await supabase
        .from("investment_transactions")
        .select("*")
        .eq("asset_id", assetId)
        .eq("user_id", user.id)
        .order("txn_date", { ascending: true });

      if (txnError) {
        console.error(txnError);
        setError("Could not load transactions.");
        setLoading(false);
        return;
      }

      setAsset(assetRow);
      setTxns(txnRows || []);
      setSelectedTradeId((txnRows || []).length ? txnRows[txnRows.length - 1].id : "");
      setLoading(false);
    }

    if (assetId) load();
  }, [assetId]);

  useEffect(() => {
    async function loadPrice() {
      const symbol = String(asset?.symbol || "").toUpperCase().trim();
      if (!symbol) {
        setLivePrice(null);
        return;
      }

      setLoadingPrice(true);

      try {
        const res = await fetch(`/api/prices?symbol=${encodeURIComponent(symbol)}`, {
          cache: "no-store",
        });
        const data = await res.json();

        if (res.ok && Number.isFinite(Number(data?.price)) && Number(data.price) > 0) {
          setLivePrice(Number(data.price));
        } else {
          setLivePrice(null);
        }
      } catch (err) {
        console.error("price fetch failed", err);
        setLivePrice(null);
      }

      setLoadingPrice(false);
    }

    if (asset?.symbol) loadPrice();
  }, [asset]);

  useEffect(() => {
    async function loadNews() {
      const symbol = String(asset?.symbol || "").toUpperCase().trim();
      if (!symbol) {
        setNews([]);
        return;
      }

      try {
        const res = await fetch(
          `/api/stock-news?symbols=${encodeURIComponent(symbol)}&limit=8`,
          { cache: "no-store" }
        );
        const data = await res.json();
        setNews(res.ok && Array.isArray(data?.articles) ? data.articles : []);
      } catch (err) {
        console.error("news fetch failed", err);
        setNews([]);
      }
    }

    if (asset?.symbol) loadNews();
  }, [asset]);

  const breakdown = useMemo(() => {
    const ordered = [...txns].sort((a, b) => {
      const ad = new Date(a.txn_date || 0).getTime();
      const bd = new Date(b.txn_date || 0).getTime();
      return ad - bd;
    });

    let shares = 0;
    let remainingBasis = 0;
    let totalBoughtShares = 0;
    let totalSoldShares = 0;
    let totalBuyCost = 0;
    let totalSellProceeds = 0;
    let costRemovedBySells = 0;
    let realizedPnl = 0;

    const rows = ordered.map((t) => {
      const qty = toNum(t.qty);
      const price = toNum(t.price);
      const txnType = String(t.txn_type || "").toUpperCase();

      const avgCostBefore = shares > 0 ? remainingBasis / shares : 0;
      let basisRemoved = 0;
      let realizedOnTxn = 0;
      let sharesAfter = shares;
      let basisAfter = remainingBasis;

      if (qty > 0 && price >= 0) {
        if (txnType === "BUY") {
          totalBoughtShares += qty;
          totalBuyCost += qty * price;
          sharesAfter = shares + qty;
          basisAfter = remainingBasis + qty * price;
        } else if (txnType === "SELL") {
          totalSoldShares += qty;
          totalSellProceeds += qty * price;
          basisRemoved = avgCostBefore * qty;
          costRemovedBySells += basisRemoved;
          realizedOnTxn = qty * price - basisRemoved;
          realizedPnl += realizedOnTxn;
          sharesAfter = shares - qty;
          basisAfter = remainingBasis - basisRemoved;
        }
      }

      shares = sharesAfter;
      remainingBasis = basisAfter;

      return {
        ...t,
        avgCostBefore,
        basisRemoved,
        realizedOnTxn,
        sharesAfter,
        basisAfter,
      };
    });

    const remainingShares = shares;
    const currentValue =
      Number.isFinite(Number(livePrice)) && Number(livePrice) > 0
        ? remainingShares * Number(livePrice)
        : null;

    const avgCostRemaining = remainingShares > 0 ? remainingBasis / remainingShares : 0;

    const unrealizedPnl = currentValue != null ? currentValue - remainingBasis : null;

    const unrealizedPct =
      currentValue != null && remainingBasis > 0
        ? ((currentValue - remainingBasis) / remainingBasis) * 100
        : null;

    return {
      rows,
      remainingShares,
      remainingBasis,
      avgCostRemaining,
      realizedPnl,
      totalBoughtShares,
      totalSoldShares,
      totalBuyCost,
      totalSellProceeds,
      costRemovedBySells,
      currentValue,
      unrealizedPnl,
      unrealizedPct,
    };
  }, [txns, livePrice]);

  const assetTone =
    breakdown.unrealizedPnl == null ? "neutral" : toneByValue(breakdown.unrealizedPnl);

  const selectedTrade =
    breakdown.rows.find((row) => row.id === selectedTradeId) ||
    breakdown.rows[breakdown.rows.length - 1] ||
    null;

  async function logTrade() {
    setStatus("");
    setError("");

    const qty = toNum(tradeQty, NaN);
    const price = toNum(tradePrice, NaN);

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
          asset_id: assetId,
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

      setTxns((prev) => [...prev, data]);
      setSelectedTradeId(data.id);
      setTradeQty("");
      setTradePrice("");
      setBoardTab("ledger");
      setStatus(`${tradeType} saved to ledger.`);
    } catch (err) {
      console.error(err);
      setError("Failed saving trade.");
    }
  }

  if (loading) {
    return (
      <main className={styles.page}>
        <GlassPane className={styles.gatePanel}>
          <div className={styles.gateText}>Loading position.</div>
        </GlassPane>
      </main>
    );
  }

  if (error || !asset) {
    return (
      <main className={styles.page}>
        <GlassPane className={styles.statusStrip}>
          <div className={styles.statusTitle}>Position error</div>
          <div className={styles.statusText}>{error || "Could not load asset."}</div>
        </GlassPane>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      {(status || error) && (
        <GlassPane className={styles.statusStrip}>
          <div className={styles.statusTitle}>{error ? "Position error" : "Position update"}</div>
          <div className={styles.statusText}>{error || status}</div>
        </GlassPane>
      )}

      <GlassPane className={styles.summaryStrip}>
        <div className={styles.summaryInner}>
          <div className={styles.titleBlock}>
            <div className={styles.eyebrow}>Investments / Position</div>
            <div className={styles.pageTitleRow}>
              <div className={styles.pageTitle}>{String(asset.symbol || "—").toUpperCase()}</div>
              <MiniPill tone={assetTone}>{asset.asset_type || "asset"}</MiniPill>
            </div>
            <div className={styles.workspaceCopy}>
              One-symbol command page with live value, full ledger, research, and routing.
            </div>
          </div>

          <div className={styles.summaryStats}>
            <div className={styles.summaryStat}>
              <div className={styles.summaryLabel}>Current Value</div>
              <div className={styles.summaryValue}>
                {breakdown.currentValue != null ? money(breakdown.currentValue) : "—"}
              </div>
              <div className={styles.summaryHint}>{asset.account || "Brokerage"}</div>
            </div>

            <div className={styles.summaryStat}>
              <div className={styles.summaryLabel}>Unrealized P/L</div>
              <div
                className={styles.summaryValue}
                style={{ color: toneMeta(assetTone).text }}
              >
                {breakdown.unrealizedPnl != null ? signedMoney(breakdown.unrealizedPnl) : "—"}
              </div>
              <div className={styles.summaryHint}>
                {breakdown.unrealizedPct != null ? pct(breakdown.unrealizedPct) : "needs live quote"}
              </div>
            </div>

            <div className={styles.summaryStat}>
              <div className={styles.summaryLabel}>Remaining Shares</div>
              <div className={styles.summaryValue}>
                {breakdown.remainingShares.toLocaleString(undefined, {
                  maximumFractionDigits: 4,
                })}
              </div>
              <div className={styles.summaryHint}>avg cost {money(breakdown.avgCostRemaining)}</div>
            </div>

            <div className={styles.summaryStat}>
              <div className={styles.summaryLabel}>Realized P/L</div>
              <div
                className={styles.summaryValue}
                style={{ color: toneMeta(toneByValue(breakdown.realizedPnl)).text }}
              >
                {signedMoney(breakdown.realizedPnl)}
              </div>
              <div className={styles.summaryHint}>closed result</div>
            </div>

            <div className={styles.summaryStat}>
              <div className={styles.summaryLabel}>Ledger Rows</div>
              <div className={styles.summaryValue}>{breakdown.rows.length}</div>
              <div className={styles.summaryHint}>
                {loadingPrice ? "price loading" : livePrice ? money(livePrice) : "no live price"}
              </div>
            </div>
          </div>

          <div className={styles.summaryRight}>
            <MiniPill tone={assetTone}>{asset.symbol}</MiniPill>
            <ActionLink href="/investments">
              <ArrowLeft size={14} /> Back
            </ActionLink>
            <ActionLink href={`/market/${encodeURIComponent(asset.symbol || "")}`}>
              Open Market <ExternalLink size={14} />
            </ActionLink>
          </div>
        </div>
      </GlassPane>

      <div className={styles.workspace}>
        <div className={styles.leftCol}>
          <GlassPane className={styles.navigatorPane}>
            <PaneHeader
              title="Trade ledger"
              subcopy="Every fill feeding this position."
              right={<MiniPill>{breakdown.rows.length} rows</MiniPill>}
            />

            {breakdown.rows.length ? (
              <div className={styles.navigatorList}>
                {[...breakdown.rows].reverse().map((row) => (
                  <TradeLedgerRow
                    key={row.id}
                    row={row}
                    selected={row.id === selectedTrade?.id}
                    onClick={() => {
                      setSelectedTradeId(row.id);
                      setBoardTab("ledger");
                    }}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No trades logged"
                detail="Use the ticket to start building this position."
              />
            )}
          </GlassPane>
        </div>

        <div className={styles.mainCol}>
          <GlassPane className={styles.focusPane}>
            <div className={styles.focusStack}>
              <div className={styles.focusHeader}>
                <div>
                  <div className={styles.eyebrow}>Position command</div>
                  <div className={styles.focusTitle}>
                    {String(asset.symbol || "—").toUpperCase()} view
                  </div>
                  <div className={styles.focusMeta}>
                    {asset.account || "Brokerage"} • {asset.asset_type || "asset"} • {breakdown.rows.length} ledger rows
                  </div>
                </div>

                <div className={styles.focusHeaderRight}>
                  <div className={styles.focusBadges}>
                    <MiniPill tone={assetTone}>
                      {loadingPrice ? "Loading price" : livePrice ? money(livePrice) : "No live price"}
                    </MiniPill>
                    <MiniPill tone={toneByValue(breakdown.realizedPnl)}>
                      {signedMoney(breakdown.realizedPnl)}
                    </MiniPill>
                  </div>
                </div>
              </div>

              <div className={styles.tabRow}>
                {["overview", "ledger", "research", "ticket"].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={cx(styles.tab, boardTab === tab && styles.tabActive)}
                    onClick={() => setBoardTab(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className={styles.tabStage}>
                {boardTab === "overview" ? (
                  <div className={styles.splitLayout}>
                    <div className={styles.panel}>
                      <PaneHeader
                        title="Position stack"
                        subcopy="What is actually sitting in this name right now."
                        right={<MiniPill tone={assetTone}>{asset.symbol}</MiniPill>}
                      />

                      <div className={styles.metricGrid}>
                        <div className={styles.metricCard}>
                          <div className={styles.metricIcon}>
                            <Wallet size={16} />
                          </div>
                          <div className={styles.metricLabel}>Current Value</div>
                          <div className={styles.metricValue}>
                            {breakdown.currentValue != null ? money(breakdown.currentValue) : "—"}
                          </div>
                          <div className={styles.metricSub}>Live value of remaining shares.</div>
                        </div>

                        <div className={styles.metricCard}>
                          <div className={styles.metricIcon}>
                            <TrendingUp size={16} />
                          </div>
                          <div className={styles.metricLabel}>Unrealized</div>
                          <div
                            className={styles.metricValue}
                            style={{ color: toneMeta(assetTone).text }}
                          >
                            {breakdown.unrealizedPnl != null ? signedMoney(breakdown.unrealizedPnl) : "—"}
                          </div>
                          <div className={styles.metricSub}>
                            {breakdown.unrealizedPct != null ? pct(breakdown.unrealizedPct) : "Needs live quote"}
                          </div>
                        </div>

                        <div className={styles.metricCard}>
                          <div className={styles.metricIcon}>
                            <Layers3 size={16} />
                          </div>
                          <div className={styles.metricLabel}>Remaining Shares</div>
                          <div className={styles.metricValue}>
                            {breakdown.remainingShares.toLocaleString(undefined, {
                              maximumFractionDigits: 4,
                            })}
                          </div>
                          <div className={styles.metricSub}>Avg cost {money(breakdown.avgCostRemaining)}</div>
                        </div>

                        <div className={styles.metricCard}>
                          <div className={styles.metricIcon}>
                            <BadgeDollarSign size={16} />
                          </div>
                          <div className={styles.metricLabel}>Realized</div>
                          <div
                            className={styles.metricValue}
                            style={{ color: toneMeta(toneByValue(breakdown.realizedPnl)).text }}
                          >
                            {signedMoney(breakdown.realizedPnl)}
                          </div>
                          <div className={styles.metricSub}>Closed result from sells.</div>
                        </div>
                      </div>

                      <div className={styles.heroPanel}>
                        <div className={styles.heroTop}>
                          <div>
                            <div className={styles.metricLabel}>Remaining basis</div>
                            <div className={styles.heroValue}>{money(breakdown.remainingBasis)}</div>
                            <div className={styles.heroSub}>
                              Buy cost {money(breakdown.totalBuyCost)} • Sell proceeds {money(breakdown.totalSellProceeds)}
                            </div>
                          </div>

                          <div className={styles.heroMiniGrid}>
                            <div className={styles.heroMiniCard}>
                              <div className={styles.metricLabel}>Bought shares</div>
                              <div className={styles.heroMiniValue}>
                                {breakdown.totalBoughtShares.toLocaleString(undefined, {
                                  maximumFractionDigits: 4,
                                })}
                              </div>
                            </div>
                            <div className={styles.heroMiniCard}>
                              <div className={styles.metricLabel}>Sold shares</div>
                              <div className={styles.heroMiniValue}>
                                {breakdown.totalSoldShares.toLocaleString(undefined, {
                                  maximumFractionDigits: 4,
                                })}
                              </div>
                            </div>
                            <div className={styles.heroMiniCard}>
                              <div className={styles.metricLabel}>Basis removed</div>
                              <div className={styles.heroMiniValue}>{money(breakdown.costRemovedBySells)}</div>
                            </div>
                            <div className={styles.heroMiniCard}>
                              <div className={styles.metricLabel}>Live price</div>
                              <div className={styles.heroMiniValue}>
                                {loadingPrice ? "Loading..." : livePrice ? money(livePrice) : "—"}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className={styles.asideStack}>
                      <div className={styles.panel}>
                        <PaneHeader
                          title="Selected trade"
                          subcopy="Fast read on the highlighted fill."
                        />

                        {selectedTrade ? (
                          <div className={styles.infoList}>
                            <div className={styles.infoRow}>
                              <span>Side</span>
                              <span>{selectedTrade.txn_type}</span>
                            </div>
                            <div className={styles.infoRow}>
                              <span>Date</span>
                              <span>{shortDate(selectedTrade.txn_date)}</span>
                            </div>
                            <div className={styles.infoRow}>
                              <span>Quantity</span>
                              <span>
                                {toNum(selectedTrade.qty).toLocaleString(undefined, {
                                  maximumFractionDigits: 4,
                                })}
                              </span>
                            </div>
                            <div className={styles.infoRow}>
                              <span>Price</span>
                              <span>{money(selectedTrade.price)}</span>
                            </div>
                            <div className={styles.infoRow}>
                              <span>Avg cost before</span>
                              <span>{money(selectedTrade.avgCostBefore)}</span>
                            </div>
                            <div className={styles.infoRow}>
                              <span>Realized on row</span>
                              <span
                                style={{
                                  color: toneMeta(toneByValue(selectedTrade.realizedOnTxn)).text,
                                }}
                              >
                                {String(selectedTrade.txn_type).toUpperCase() === "SELL"
                                  ? signedMoney(selectedTrade.realizedOnTxn)
                                  : "—"}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <EmptyState
                            title="No selected trade"
                            detail="Pick a row from the ledger on the left."
                          />
                        )}
                      </div>

                      <div className={styles.panel}>
                        <PaneHeader
                          title="Next moves"
                          subcopy="Fast paths through the section."
                        />
                        <div className={styles.ctaStack}>
                          <ActionLink href="/investments">
                            Back to Investments <ArrowRight size={14} />
                          </ActionLink>
                          <ActionLink href="/investments/discover">
                            Research Desk <ArrowRight size={14} />
                          </ActionLink>
                          <ActionLink href={`/market/${encodeURIComponent(asset.symbol || "")}`}>
                            Open Market View <ArrowRight size={14} />
                          </ActionLink>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {boardTab === "ledger" ? (
                  <div className={styles.splitLayout}>
                    <div className={styles.panel}>
                      <PaneHeader
                        title="Ledger breakdown"
                        subcopy="The exact math behind the position."
                        right={<MiniPill>{breakdown.rows.length} rows</MiniPill>}
                      />

                      {selectedTrade ? (
                        <div className={styles.feedList}>
                          <div className={styles.tradeRow}>
                            <div className={styles.tradeIcon}>
                              {String(selectedTrade.txn_type).toUpperCase() === "SELL" ? "S" : "B"}
                            </div>

                            <div className={styles.tradeMain}>
                              <div className={styles.tradeName}>
                                {String(selectedTrade.txn_type).toUpperCase()} •{" "}
                                {toNum(selectedTrade.qty).toLocaleString(undefined, {
                                  maximumFractionDigits: 4,
                                })}{" "}
                                @ {money(selectedTrade.price)}
                              </div>
                              <div className={styles.tradeSub}>
                                {shortDate(selectedTrade.txn_date)} • Avg cost before{" "}
                                {money(selectedTrade.avgCostBefore)}
                              </div>
                            </div>

                            <div className={styles.tradeValue}>
                              {money(toNum(selectedTrade.qty) * toNum(selectedTrade.price))}
                            </div>
                          </div>

                          <div className={styles.infoList}>
                            <div className={styles.infoRow}>
                              <span>Shares after</span>
                              <span>
                                {toNum(selectedTrade.sharesAfter).toLocaleString(undefined, {
                                  maximumFractionDigits: 4,
                                })}
                              </span>
                            </div>
                            <div className={styles.infoRow}>
                              <span>Basis after</span>
                              <span>{money(selectedTrade.basisAfter)}</span>
                            </div>
                            <div className={styles.infoRow}>
                              <span>Basis removed</span>
                              <span>{money(selectedTrade.basisRemoved)}</span>
                            </div>
                            <div className={styles.infoRow}>
                              <span>Realized on row</span>
                              <span
                                style={{
                                  color: toneMeta(toneByValue(selectedTrade.realizedOnTxn)).text,
                                }}
                              >
                                {String(selectedTrade.txn_type).toUpperCase() === "SELL"
                                  ? signedMoney(selectedTrade.realizedOnTxn)
                                  : "—"}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <EmptyState
                          title="No ledger row selected"
                          detail="Pick a ledger row from the left."
                        />
                      )}
                    </div>

                    <div className={styles.asideStack}>
                      <div className={styles.panel}>
                        <PaneHeader
                          title="Position snapshot"
                          subcopy="Whole-position readout."
                        />
                        <div className={styles.infoList}>
                          <div className={styles.infoRow}>
                            <span>Remaining shares</span>
                            <span>
                              {breakdown.remainingShares.toLocaleString(undefined, {
                                maximumFractionDigits: 4,
                              })}
                            </span>
                          </div>
                          <div className={styles.infoRow}>
                            <span>Remaining basis</span>
                            <span>{money(breakdown.remainingBasis)}</span>
                          </div>
                          <div className={styles.infoRow}>
                            <span>Current value</span>
                            <span>
                              {breakdown.currentValue != null ? money(breakdown.currentValue) : "—"}
                            </span>
                          </div>
                          <div className={styles.infoRow}>
                            <span>Unrealized</span>
                            <span
                              style={{ color: toneMeta(assetTone).text }}
                            >
                              {breakdown.unrealizedPnl != null ? signedMoney(breakdown.unrealizedPnl) : "—"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {boardTab === "research" ? (
                  <div className={styles.splitLayout}>
                    <div className={styles.panel}>
                      <PaneHeader
                        title="Research headlines"
                        subcopy={`Live symbol news for ${asset.symbol}.`}
                        right={<MiniPill>{news.length} stories</MiniPill>}
                      />

                      {news.length ? (
                        <div className={styles.feedList}>
                          {news.map((item, index) => (
                            <HeadlineRow key={`${item.url}-${index}`} item={item} />
                          ))}
                        </div>
                      ) : (
                        <EmptyState
                          title="No headlines returned"
                          detail="Once the news route is live, this rail fills with symbol coverage."
                        />
                      )}
                    </div>

                    <div className={styles.asideStack}>
                      <div className={styles.panel}>
                        <PaneHeader
                          title="Research routes"
                          subcopy="Fast paths out of the position page."
                        />
                        <div className={styles.ctaStack}>
                          <ActionLink href={`/market/${encodeURIComponent(asset.symbol || "")}`}>
                            Open Market View <ExternalLink size={14} />
                          </ActionLink>
                          <ActionLink href="/investments/discover">
                            Open Research Desk <ArrowRight size={14} />
                          </ActionLink>
                        </div>
                      </div>

                      <div className={styles.panel}>
                        <PaneHeader
                          title="Context"
                          subcopy="What this position belongs to."
                        />
                        <div className={styles.infoList}>
                          <div className={styles.infoRow}>
                            <span>Symbol</span>
                            <span>{String(asset.symbol || "—").toUpperCase()}</span>
                          </div>
                          <div className={styles.infoRow}>
                            <span>Account</span>
                            <span>{asset.account || "Brokerage"}</span>
                          </div>
                          <div className={styles.infoRow}>
                            <span>Asset type</span>
                            <span>{asset.asset_type || "—"}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {boardTab === "ticket" ? (
                  <div className={styles.splitLayout}>
                    <div className={styles.panel}>
                      <PaneHeader
                        title="Trade ticket"
                        subcopy="Looks like a real ticket, writes to your portfolio ledger."
                        right={<MiniPill tone="amber">ledger route</MiniPill>}
                      />

                      <div className={styles.formStack}>
                        <div className={styles.formGrid2}>
                          <Field label="Side">
                            <select
                              value={tradeType}
                              onChange={(e) => setTradeType(e.target.value)}
                              className={styles.field}
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
                              className={styles.field}
                            />
                          </Field>
                        </div>

                        <div className={styles.formGrid2}>
                          <Field label="Quantity">
                            <input
                              type="number"
                              step="0.0001"
                              value={tradeQty}
                              onChange={(e) => setTradeQty(e.target.value)}
                              placeholder="0.0000"
                              className={styles.field}
                            />
                          </Field>

                          <Field label="Price">
                            <input
                              type="number"
                              step="0.01"
                              value={tradePrice}
                              onChange={(e) => setTradePrice(e.target.value)}
                              placeholder="0.00"
                              className={styles.field}
                            />
                          </Field>
                        </div>

                        <ActionBtn variant="primary" onClick={logTrade} full>
                          <Plus size={14} /> Save Trade
                        </ActionBtn>
                      </div>
                    </div>

                    <div className={styles.asideStack}>
                      <div className={styles.panel}>
                        <PaneHeader
                          title="Ticket context"
                          subcopy="What this ticket is attached to."
                        />
                        <div className={styles.infoList}>
                          <div className={styles.infoRow}>
                            <span>Symbol</span>
                            <span>{String(asset.symbol || "—").toUpperCase()}</span>
                          </div>
                          <div className={styles.infoRow}>
                            <span>Live price</span>
                            <span>{loadingPrice ? "Loading..." : livePrice ? money(livePrice) : "—"}</span>
                          </div>
                          <div className={styles.infoRow}>
                            <span>Remaining shares</span>
                            <span>
                              {breakdown.remainingShares.toLocaleString(undefined, {
                                maximumFractionDigits: 4,
                              })}
                            </span>
                          </div>
                          <div className={styles.infoRow}>
                            <span>Current basis</span>
                            <span>{money(breakdown.remainingBasis)}</span>
                          </div>
                        </div>
                      </div>

                      <div className={styles.panel}>
                        <PaneHeader
                          title="Next path"
                          subcopy="Where this flow goes."
                        />
                        <div className={styles.ctaStack}>
                          <ActionLink href="/investments">
                            Back to desk <ArrowRight size={14} />
                          </ActionLink>
                          <ActionLink href={`/market/${encodeURIComponent(asset.symbol || "")}`}>
                            Open market <ExternalLink size={14} />
                          </ActionLink>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </GlassPane>
        </div>
      </div>
    </main>
  );
}
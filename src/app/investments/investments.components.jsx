"use client";

import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BookOpenText,
  ExternalLink,
  Newspaper,
  Plus,
  Search,
  Star,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import GlassPane from "../components/GlassPane";
import styles from "./InvestmentsPage.module.css";
import {
  BOARD_SYMBOLS,
  DESK_TABS,
  fullDateTime,
  initials,
  money,
  monthLabel,
  pct,
  shortDate,
  signedMoney,
  toneByValue,
  toneMeta,
  toNum,
} from "./investments.helpers";

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

export function MiniPill({ children, tone = "neutral" }) {
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

export function ActionLink({ href, children }) {
  return (
    <Link href={href} className={styles.actionLink}>
      {children}
    </Link>
  );
}

export function ActionBtn({
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

function MetricCard({ icon: Icon, label, value, detail, tone = "neutral" }) {
  const meta = toneMeta(tone);

  return (
    <div className={styles.metricCard}>
      <div
        className={styles.metricIcon}
        style={{
          borderColor: meta.border,
          color: tone === "neutral" ? "#fff" : meta.text,
          boxShadow: `0 0 10px ${meta.glow}`,
          background: meta.iconBg,
        }}
      >
        <Icon size={16} />
      </div>

      <div className={styles.metricLabel}>{label}</div>
      <div
        className={styles.metricValue}
        style={{ color: tone === "neutral" ? "#fff" : meta.text }}
      >
        {value}
      </div>
      <div className={styles.metricSub}>{detail}</div>
    </div>
  );
}

function EmptyState({ title, detail, linkHref, linkLabel }) {
  return (
    <div className={styles.emptyState}>
      <div>
        <div className={styles.emptyTitle}>{title}</div>
        <div className={styles.emptyText}>{detail}</div>
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

function Field({ label, children }) {
  return (
    <label className={styles.fieldWrap}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function AssetRow({ item, selected, onClick }) {
  const tone = item.hasLivePrice ? toneByValue(item.pnl) : "amber";
  const meta = toneMeta(tone);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(styles.navigatorRow, selected && styles.navigatorRowActive)}
      style={{
        borderColor: selected ? meta.border : undefined,
        boxShadow: selected ? `0 0 22px ${meta.glow}` : undefined,
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
          color: tone === "neutral" ? "#fff" : meta.text,
          background: meta.iconBg,
        }}
      >
        {initials(item.symbol)}
      </div>

      <div className={styles.navigatorMain}>
        <div className={styles.navigatorTop}>
          <div className={styles.navigatorName}>{item.symbol}</div>
          <div className={styles.navigatorAmount}>{money(item.value)}</div>
        </div>

        <div className={styles.navigatorMeta}>
          {item.shares.toLocaleString(undefined, { maximumFractionDigits: 4 })} shares •{" "}
          {item.hasLivePrice ? money(item.livePrice) : "No live price"}
        </div>

        <div className={styles.navigatorBadges}>
          <MiniPill tone={tone}>
            {item.hasLivePrice ? signedMoney(item.pnl) : "Pending"}
          </MiniPill>
          <MiniPill tone={toneByValue(item.dayPct ?? item.dayChange ?? 0)}>
            {item.dayPct != null ? pct(item.dayPct) : "Waiting"}
          </MiniPill>
          <MiniPill>{item.account || "Brokerage"}</MiniPill>
        </div>
      </div>
    </button>
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
    <Link href={`/market/${encodeURIComponent(symbol)}`} className={styles.marketCard}>
      <div className={styles.marketCardTop}>
        <div style={{ minWidth: 0 }}>
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
          {tone === "red" ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
        </div>
      </div>

      <div
        className={styles.marketPrice}
        style={{ color: tone === "neutral" ? "#fff" : meta.text }}
      >
        {price != null ? money(price) : "—"}
      </div>

      <div
        className={styles.marketMove}
        style={{ color: tone === "neutral" ? "rgba(255,255,255,0.62)" : meta.text }}
      >
        {change != null ? signedMoney(change) : "Waiting"}{" "}
        {changePct != null ? `• ${pct(changePct)}` : ""}
      </div>
    </Link>
  );
}

function HoldingRow({ item }) {
  const tone = item.hasLivePrice ? toneByValue(item.pnl) : "amber";
  const meta = toneMeta(tone);

  return (
    <Link href={`/investments/${item.id}`} className={styles.holdingRow}>
      <div
        className={styles.holdingAvatar}
        style={{
          borderColor: meta.border,
          background: meta.iconBg,
          color: tone === "neutral" ? "#fff" : meta.text,
        }}
      >
        {initials(item.symbol)}
      </div>

      <div className={styles.holdingMain}>
        <div className={styles.holdingName}>{item.symbol}</div>
        <div className={styles.holdingMeta}>
          {item.shares.toLocaleString(undefined, { maximumFractionDigits: 4 })} shares •{" "}
          {item.hasLivePrice ? money(item.livePrice) : "No live price"}
        </div>
        <div className={styles.holdingSub}>
          Basis {money(item.remainingBasis)} • Day {signedMoney(item.positionDayMove)}
        </div>
      </div>

      <div className={styles.holdingRight}>
        <div className={styles.holdingValue}>{money(item.value)}</div>
        <div
          className={styles.holdingPnl}
          style={{
            color: item.hasLivePrice ? meta.text : "rgba(255,255,255,0.58)",
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
        {symbol ? <MiniPill>{String(symbol).toUpperCase()}</MiniPill> : null}
        <ExternalLink size={14} className={styles.feedLinkIcon} />
      </div>
    </a>
  );
}

function SignalRow({ title, detail, tone = "neutral", value }) {
  const meta = toneMeta(tone);

  return (
    <div className={styles.signalRow} style={{ borderColor: meta.border }}>
      <div style={{ minWidth: 0 }}>
        <div className={styles.signalTitle}>{title}</div>
        <div className={styles.signalDetail}>{detail}</div>
      </div>

      <div
        className={styles.signalValue}
        style={{ color: tone === "neutral" ? "rgba(255,255,255,0.86)" : meta.text }}
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
    <Link href={`/market/${encodeURIComponent(sym)}`} className={styles.favoriteRow}>
      <div
        className={styles.favoriteIcon}
        style={{
          borderColor: meta.border,
          background: meta.iconBg,
          color: tone === "neutral" ? "#fff" : meta.text,
        }}
      >
        <BookOpenText size={15} />
      </div>

      <div className={styles.favoriteMain}>
        <div className={styles.favoriteName}>{sym}</div>
        <div className={styles.favoriteSub}>{item.name || item.asset_type || "Watchlist name"}</div>
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

function TradeRow({ txn, assetMap }) {
  const type = String(txn.txn_type || "").toUpperCase();
  const tone = type === "SELL" ? "green" : "neutral";
  const meta = toneMeta(tone);
  const sym = assetMap.get(txn.asset_id)?.symbol || "—";

  return (
    <div className={styles.tradeRow} style={{ borderColor: meta.border }}>
      <div
        className={styles.tradeIcon}
        style={{
          borderColor: meta.border,
          color: type === "SELL" ? "#8ef4bb" : "#f7fbff",
        }}
      >
        {type === "SELL" ? "S" : "B"}
      </div>

      <div className={styles.tradeMain}>
        <div className={styles.tradeName}>
          {sym} {type}
        </div>
        <div className={styles.tradeSub}>
          {toNum(txn.qty).toLocaleString(undefined, { maximumFractionDigits: 4 })} @{" "}
          {money(txn.price)} • {shortDate(txn.txn_date)}
        </div>
      </div>

      <div className={styles.tradeValue}>{money(toNum(txn.qty) * toNum(txn.price))}</div>
    </div>
  );
}

export function SummaryStrip({
  portfolio,
  openPositions,
  favorites,
  selectedHolding,
}) {
  const heroTone = toneByValue(portfolio.totalPnl);

  return (
    <GlassPane className={styles.summaryStrip}>
      <div className={styles.summaryInner}>
        <div className={styles.titleBlock}>
          <div className={styles.eyebrow}>Money / Investments</div>
          <div className={styles.pageTitleRow}>
            <div className={styles.pageTitle}>Investments</div>
            <MiniPill tone="green">desk</MiniPill>
          </div>
          <div className={styles.workspaceCopy}>
            Brokerage-style tracking, internal order routing, live quotes, and research.
          </div>
        </div>

        <div className={styles.summaryStats}>
          <div className={styles.summaryStat}>
            <div className={styles.summaryLabel}>Portfolio Value</div>
            <div className={styles.summaryValue}>{money(portfolio.totalValue)}</div>
            <div className={styles.summaryHint}>{monthLabel()}</div>
          </div>

          <div className={styles.summaryStat}>
            <div className={styles.summaryLabel}>Day Move</div>
            <div
              className={styles.summaryValue}
              style={{ color: toneMeta(toneByValue(portfolio.totalDayMove)).text }}
            >
              {signedMoney(portfolio.totalDayMove)}
            </div>
            <div className={styles.summaryHint}>
              {portfolio.totalDayPct != null ? pct(portfolio.totalDayPct) : "Waiting on live quotes"}
            </div>
          </div>

          <div className={styles.summaryStat}>
            <div className={styles.summaryLabel}>Unrealized P/L</div>
            <div
              className={styles.summaryValue}
              style={{ color: toneMeta(heroTone).text }}
            >
              {signedMoney(portfolio.totalPnl)}
            </div>
            <div className={styles.summaryHint}>value minus remaining basis</div>
          </div>

          <div className={styles.summaryStat}>
            <div className={styles.summaryLabel}>Positions</div>
            <div className={styles.summaryValue}>{openPositions.length}</div>
            <div className={styles.summaryHint}>open holdings</div>
          </div>

          <div className={styles.summaryStat}>
            <div className={styles.summaryLabel}>Watchlist</div>
            <div className={styles.summaryValue}>{favorites.length}</div>
            <div className={styles.summaryHint}>saved names</div>
          </div>
        </div>

        <div className={styles.summaryRight}>
          <MiniPill tone={heroTone}>
            {portfolio.totalPnl >= 0 ? "desk green" : "desk red"}
          </MiniPill>
          {selectedHolding ? (
            <MiniPill tone={toneByValue(selectedHolding.pnl)}>
              {selectedHolding.symbol}
            </MiniPill>
          ) : (
            <MiniPill>starter</MiniPill>
          )}
        </div>
      </div>
    </GlassPane>
  );
}

export function NavigatorPane({
  visibleAssets,
  selectedHolding,
  search,
  setSearch,
  filter,
  setFilter,
  sort,
  setSort,
  onSelectAsset,
}) {
  return (
    <GlassPane className={styles.navigatorPane}>
      <PaneHeader
        title="Asset navigator"
        subcopy="Choose the symbol you want to command."
        right={<MiniPill>{visibleAssets.length} showing</MiniPill>}
      />

      <div className={styles.queueToolbar}>
        <label className={styles.searchWrap}>
          <Search size={14} />
          <input
            className={styles.searchInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search symbols..."
          />
        </label>

        <div className={styles.scopeTabs}>
          <button
            type="button"
            className={cx(styles.scopeTab, filter === "open" && styles.scopeTabActive)}
            onClick={() => setFilter("open")}
          >
            Open
          </button>
          <button
            type="button"
            className={cx(styles.scopeTab, filter === "all" && styles.scopeTabActive)}
            onClick={() => setFilter("all")}
          >
            All
          </button>
          <button
            type="button"
            className={cx(styles.scopeTab, filter === "watch" && styles.scopeTabActive)}
            onClick={() => setFilter("watch")}
          >
            Watch
          </button>
          <button
            type="button"
            className={cx(styles.scopeTab, filter === "red" && styles.scopeTabActive)}
            onClick={() => setFilter("red")}
          >
            Red
          </button>
        </div>

        <div className={styles.navigatorControls}>
          <select
            className={styles.field}
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="value">By value</option>
            <option value="pnl">By P/L</option>
            <option value="symbol">By symbol</option>
            <option value="activity">By activity</option>
          </select>
        </div>
      </div>

      {visibleAssets.length ? (
        <div className={styles.navigatorList}>
          {visibleAssets.map((item) => (
            <AssetRow
              key={item.id}
              item={item}
              selected={item.id === selectedHolding?.id}
              onClick={() => onSelectAsset(item.id)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No symbols found"
          detail="Add a symbol to start building your desk."
        />
      )}
    </GlassPane>
  );
}

function DashboardTab({
  portfolio,
  prices,
  selectedHolding,
  alerts,
  openPositions,
  news,
  newsError,
}) {
  const quote = selectedHolding
    ? prices[String(selectedHolding.symbol || "").toUpperCase()] || {}
    : {};
  const priceTone = toneByValue(quote?.changesPercentage ?? quote?.change ?? selectedHolding?.pnl ?? 0);

  return (
    <div className={styles.splitLayout}>
      <div className={styles.panel}>
        {selectedHolding ? (
          <>
            <PaneHeader
              title={`${selectedHolding.symbol} command`}
              subcopy={`${selectedHolding.asset_type || "stock"} • ${selectedHolding.account || "Brokerage"} • ${selectedHolding.txCount} fills`}
              right={
                <div className={styles.inlineRow}>
                  <MiniPill tone={priceTone}>
                    {quote?.changesPercentage != null ? pct(quote.changesPercentage) : "live"}
                  </MiniPill>
                  <MiniPill tone={toneByValue(selectedHolding.pnl)}>
                    {selectedHolding.hasLivePrice ? signedMoney(selectedHolding.pnl) : "pending"}
                  </MiniPill>
                </div>
              }
            />

            <div className={styles.heroPanel}>
              <div className={styles.heroTop}>
                <div>
                  <div className={styles.metricLabel}>Live price</div>
                  <div
                    className={styles.heroValue}
                    style={{ color: toneMeta(priceTone).text }}
                  >
                    {selectedHolding.hasLivePrice ? money(selectedHolding.livePrice) : "—"}
                  </div>
                  <div className={styles.heroSub}>
                    {quote?.change != null
                      ? `${signedMoney(quote.change)} • ${pct(quote.changesPercentage)} today`
                      : "Waiting on quote"}
                  </div>
                </div>

                <div className={styles.heroMiniGrid}>
                  <div className={styles.heroMiniCard}>
                    <div className={styles.metricLabel}>Shares</div>
                    <div className={styles.heroMiniValue}>
                      {selectedHolding.shares.toLocaleString(undefined, {
                        maximumFractionDigits: 4,
                      })}
                    </div>
                  </div>
                  <div className={styles.heroMiniCard}>
                    <div className={styles.metricLabel}>Position value</div>
                    <div className={styles.heroMiniValue}>{money(selectedHolding.value)}</div>
                  </div>
                  <div className={styles.heroMiniCard}>
                    <div className={styles.metricLabel}>Remaining basis</div>
                    <div className={styles.heroMiniValue}>{money(selectedHolding.remainingBasis)}</div>
                  </div>
                  <div className={styles.heroMiniCard}>
                    <div className={styles.metricLabel}>Unrealized</div>
                    <div
                      className={styles.heroMiniValue}
                      style={{ color: toneMeta(toneByValue(selectedHolding.pnl)).text }}
                    >
                      {selectedHolding.hasLivePrice ? signedMoney(selectedHolding.pnl) : "—"}
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.marketBoardGrid}>
                {BOARD_SYMBOLS.map((item) => {
                  const q = prices[item.symbol] || {};
                  const tone = toneByValue(q?.changesPercentage ?? q?.change);
                  return (
                    <MarketBoardCard
                      key={item.symbol}
                      symbol={item.symbol}
                      label={item.label}
                      quote={q}
                      tone={tone}
                    />
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <EmptyState
            title="No selected symbol"
            detail="Add an asset and the desk will light up."
          />
        )}
      </div>

      <div className={styles.asideStack}>
        <div className={styles.panel}>
          <PaneHeader
            title="Signals"
            subcopy="Fast pressure checks, not a toy dashboard."
            right={
              <MiniPill tone={alerts.length ? "amber" : "green"}>
                {alerts.length ? `${alerts.length} live` : "clean"}
              </MiniPill>
            }
          />

          <div className={styles.infoList}>
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
        </div>

        <div className={styles.panel}>
          <PaneHeader
            title="Research headlines"
            subcopy="Fast read for the names near your book."
            right={<MiniPill>{news.length} stories</MiniPill>}
          />

          {news.length ? (
            <div className={styles.feedList}>
              {news.slice(0, 5).map((item, index) => (
                <HeadlineRow key={`${item.url}-${index}`} item={item} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No headlines returned"
              detail={newsError || "Research headlines temporarily unavailable."}
            />
          )}
        </div>

        <div className={styles.panel}>
          <PaneHeader
            title="Desk snapshot"
            subcopy="Whole-book read without leaving the command view."
          />

          <div className={styles.infoList}>
            <div className={styles.infoRow}>
              <span>Portfolio value</span>
              <span>{money(portfolio.totalValue)}</span>
            </div>
            <div className={styles.infoRow}>
              <span>Open positions</span>
              <span>{openPositions.length}</span>
            </div>
            <div className={styles.infoRow}>
              <span>Unrealized P/L</span>
              <span style={{ color: toneMeta(toneByValue(portfolio.totalPnl)).text }}>
                {signedMoney(portfolio.totalPnl)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PositionsTab({ openPositions, assetMap, recentTxns, selectedHolding }) {
  return (
    <div className={styles.splitLayout}>
      <div className={styles.panel}>
        <PaneHeader
          title="Open positions"
          subcopy="Your live holdings with brokerage-style presentation."
          right={<MiniPill>{openPositions.length} active</MiniPill>}
        />

        {openPositions.length ? (
          <div className={styles.feedList}>
            {openPositions.slice(0, 12).map((item) => (
              <HoldingRow key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No open positions yet"
            detail="Add a symbol and log your first fill so the desk has something real to track."
            linkHref="/investments/discover"
            linkLabel="Open research desk"
          />
        )}
      </div>

      <div className={styles.asideStack}>
        <div className={styles.panel}>
          <PaneHeader
            title="Recent fills"
            subcopy="Latest activity hitting your ledger."
            right={<MiniPill>{recentTxns.length} shown</MiniPill>}
          />

          {recentTxns.length ? (
            <div className={styles.feedList}>
              {recentTxns.map((txn) => (
                <TradeRow key={txn.id} txn={txn} assetMap={assetMap} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No fills yet"
              detail="Your fills will show here once you start logging trades."
            />
          )}
        </div>

        <div className={styles.panel}>
          <PaneHeader
            title="Selected position"
            subcopy="Fast context panel."
          />

          {selectedHolding ? (
            <div className={styles.infoList}>
              <div className={styles.infoRow}>
                <span>Symbol</span>
                <span>{selectedHolding.symbol}</span>
              </div>
              <div className={styles.infoRow}>
                <span>Shares</span>
                <span>
                  {selectedHolding.shares.toLocaleString(undefined, {
                    maximumFractionDigits: 4,
                  })}
                </span>
              </div>
              <div className={styles.infoRow}>
                <span>Value</span>
                <span>{money(selectedHolding.value)}</span>
              </div>
              <div className={styles.infoRow}>
                <span>P/L</span>
                <span style={{ color: toneMeta(toneByValue(selectedHolding.pnl)).text }}>
                  {selectedHolding.hasLivePrice ? signedMoney(selectedHolding.pnl) : "Pending"}
                </span>
              </div>
            </div>
          ) : (
            <EmptyState
              title="No selected position"
              detail="Pick a position from the navigator."
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ResearchTab({ news, newsError, favorites, prices, selectedHolding }) {
  return (
    <div className={styles.splitLayout}>
      <div className={styles.panel}>
        <PaneHeader
          title="Research headlines"
          subcopy={
            selectedHolding
              ? `News flow around ${selectedHolding.symbol} and nearby names.`
              : "Live stock-news feed for the symbols closest to your desk."
          }
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
            detail={newsError || "Research headlines temporarily unavailable."}
          />
        )}
      </div>

      <div className={styles.asideStack}>
        <div className={styles.panel}>
          <PaneHeader
            title="Watchlist"
            subcopy="Saved names with fast market access."
            right={<MiniPill>{favorites.length} saved</MiniPill>}
          />

          {favorites.length ? (
            <div className={styles.feedList}>
              {favorites.slice(0, 8).map((item) => (
                <FavoriteRow
                  key={item.id}
                  item={item}
                  quote={prices[String(item.symbol).toUpperCase()] || null}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No saved names"
              detail="Use the research desk to start building a serious watchlist."
              linkHref="/investments/discover"
              linkLabel="Go discover"
            />
          )}
        </div>

        <div className={styles.panel}>
          <PaneHeader
            title="Research routes"
            subcopy="Fast paths without breaking desk flow."
          />
          <div className={styles.ctaStack}>
            <ActionLink href="/investments/discover">
              Research desk <ArrowRight size={14} />
            </ActionLink>
            <ActionLink href={selectedHolding ? `/market/${selectedHolding.symbol}` : "/investments/discover"}>
              Open market <ExternalLink size={14} />
            </ActionLink>
          </div>
        </div>
      </div>
    </div>
  );
}

function TicketTab({
  assets,
  assetMap,
  tradeAssetId,
  setTradeAssetId,
  tradeType,
  setTradeType,
  tradeQty,
  setTradeQty,
  tradePrice,
  setTradePrice,
  tradeDate,
  setTradeDate,
  symbol,
  setSymbol,
  addAsset,
  logTrade,
  recentTxns,
}) {
  return (
    <div className={styles.splitLayout}>
      <div className={styles.panel}>
        <PaneHeader
          title="Order ticket"
          subcopy="Logs to your internal portfolio ledger now. Live broker route later."
          right={<MiniPill tone="amber">portfolio route</MiniPill>}
        />

        <div className={styles.formStack}>
          <Field label="Quick add symbol">
            <div className={styles.fieldActionRow}>
              <input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="AAPL"
                className={styles.field}
              />
              <ActionBtn onClick={addAsset}>
                <Plus size={14} /> Add
              </ActionBtn>
            </div>
          </Field>

          <Field label="Asset">
            <select
              value={tradeAssetId}
              onChange={(e) => setTradeAssetId(e.target.value)}
              className={styles.field}
            >
              <option value="">Select asset</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.symbol}
                </option>
              ))}
            </select>
          </Field>

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
            Route fill to ledger <ArrowRight size={14} />
          </ActionBtn>
        </div>
      </div>

      <div className={styles.asideStack}>
        <div className={styles.panel}>
          <PaneHeader
            title="Recent fills"
            subcopy="What just landed in your route."
            right={<MiniPill>{recentTxns.length} shown</MiniPill>}
          />

          {recentTxns.length ? (
            <div className={styles.feedList}>
              {recentTxns.map((txn) => (
                <TradeRow key={txn.id} txn={txn} assetMap={assetMap} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No fills yet"
              detail="Log a trade and it will appear here."
            />
          )}
        </div>

        <div className={styles.panel}>
          <PaneHeader
            title="Route notes"
            subcopy="What this ticket is designed for."
          />
          <div className={styles.infoList}>
            <div className={styles.infoRow}>
              <span>Execution</span>
              <span>Internal ledger only</span>
            </div>
            <div className={styles.infoRow}>
              <span>Cash settlement</span>
              <span>Later</span>
            </div>
            <div className={styles.infoRow}>
              <span>Broker API</span>
              <span>Future phase</span>
            </div>
            <div className={styles.infoRow}>
              <span>Use now</span>
              <span>Track buy / sell / hold flow</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WatchlistTab({ favorites, prices, selectedHolding }) {
  return (
    <div className={styles.splitLayout}>
      <div className={styles.panel}>
        <PaneHeader
          title="Watchlist"
          subcopy="Saved names ready for research and future routing."
          right={<MiniPill>{favorites.length} saved</MiniPill>}
        />

        {favorites.length ? (
          <div className={styles.feedList}>
            {favorites.map((item) => (
              <FavoriteRow
                key={item.id}
                item={item}
                quote={prices[String(item.symbol).toUpperCase()] || null}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No saved names"
            detail="Use the research desk to build a serious watchlist."
            linkHref="/investments/discover"
            linkLabel="Go discover"
          />
        )}
      </div>

      <div className={styles.asideStack}>
        <div className={styles.panel}>
          <PaneHeader
            title="Market board"
            subcopy="Fast macro read without leaving watch mode."
          />
          <div className={styles.marketBoardGrid}>
            {BOARD_SYMBOLS.map((item) => {
              const q = prices[item.symbol] || {};
              const tone = toneByValue(q?.changesPercentage ?? q?.change);
              return (
                <MarketBoardCard
                  key={item.symbol}
                  symbol={item.symbol}
                  label={item.label}
                  quote={q}
                  tone={tone}
                />
              );
            })}
          </div>
        </div>

        <div className={styles.panel}>
          <PaneHeader
            title="Next path"
            subcopy="Where to go from here."
          />
          <div className={styles.ctaStack}>
            <ActionLink href="/investments/discover">
              Research desk <ArrowRight size={14} />
            </ActionLink>
            <ActionLink href={selectedHolding ? `/market/${selectedHolding.symbol}` : "/investments/discover"}>
              Open market <ExternalLink size={14} />
            </ActionLink>
          </div>
        </div>
      </div>
    </div>
  );
}

function ZeroStateDesk({ symbol, setSymbol, addAsset }) {
  return (
    <GlassPane className={styles.focusPane}>
      <div className={styles.focusStack}>
        <div className={styles.focusHeader}>
          <div>
            <div className={styles.eyebrow}>Investments starter</div>
            <div className={styles.focusTitle}>Build the desk first</div>
            <div className={styles.focusMeta}>
              Live pricing, research, and order routing are ready to wake up once you add symbols.
            </div>
          </div>

          <div className={styles.focusHeaderRight}>
            <div className={styles.focusBadges}>
              <MiniPill tone="green">starter</MiniPill>
              <MiniPill tone="amber">ledger route</MiniPill>
            </div>
          </div>
        </div>

        <div className={styles.metricGrid}>
          <MetricCard
            icon={Wallet}
            label="Portfolio route"
            value="Internal"
            detail="Track positions and fills before broker rails exist."
            tone="green"
          />
          <MetricCard
            icon={Activity}
            label="Live prices"
            value="Ready"
            detail="Quotes start flowing as soon as symbols hit the desk."
            tone="blue"
          />
          <MetricCard
            icon={Star}
            label="Watchlist"
            value="Ready"
            detail="Saved names can feed future trade routing."
            tone="amber"
          />
          <MetricCard
            icon={BookOpenText}
            label="Research"
            value="Live"
            detail="News and market paths are already part of the structure."
            tone="neutral"
          />
        </div>

        <div className={styles.splitLayout}>
          <div className={styles.panel}>
            <PaneHeader
              title="Quick start"
              subcopy="Add a symbol and wake the desk up."
            />

            <div className={styles.formStack}>
              <Field label="Starter symbol">
                <div className={styles.fieldActionRow}>
                  <input
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    placeholder="AAPL"
                    className={styles.field}
                  />
                  <ActionBtn variant="primary" onClick={addAsset}>
                    <Plus size={14} /> Add
                  </ActionBtn>
                </div>
              </Field>

              <div className={styles.ctaStack}>
                <ActionLink href="/investments/discover">
                  Open research desk <ArrowRight size={14} />
                </ActionLink>
              </div>
            </div>
          </div>

          <div className={styles.asideStack}>
            <div className={styles.panel}>
              <PaneHeader
                title="Starter market board"
                subcopy="Macro names worth keeping in view."
              />
              <div className={styles.marketBoardGrid}>
                {BOARD_SYMBOLS.map((item) => (
                  <div key={item.symbol} className={styles.marketCard}>
                    <div className={styles.marketCardTop}>
                      <div>
                        <div className={styles.marketLabel}>{item.label}</div>
                        <div className={styles.marketSymbol}>{item.symbol}</div>
                      </div>
                      <div className={styles.marketIcon}>
                        <Activity size={14} />
                      </div>
                    </div>
                    <div className={styles.marketPrice}>Live once loaded</div>
                    <div className={styles.marketMove}>Quote rail wakes up after symbols land</div>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.panel}>
              <PaneHeader
                title="What comes next"
                subcopy="The desk is already structured for the future build."
              />
              <div className={styles.infoList}>
                <div className={styles.infoRow}>
                  <span>Dashboard</span>
                  <span>Selected symbol command</span>
                </div>
                <div className={styles.infoRow}>
                  <span>Positions</span>
                  <span>Live holdings board</span>
                </div>
                <div className={styles.infoRow}>
                  <span>Research</span>
                  <span>News + market flow</span>
                </div>
                <div className={styles.infoRow}>
                  <span>Ticket</span>
                  <span>Internal buy / sell routing</span>
                </div>
                <div className={styles.infoRow}>
                  <span>Future phase</span>
                  <span>Real broker rails</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </GlassPane>
  );
}

export function CommandBoard(props) {
  const {
    selectedHolding,
    portfolio,
    prices,
    alerts,
    openPositions,
    news,
    newsError,
    favorites,
    recentTxns,
    assetMap,
    boardTab,
    setBoardTab,
    assets,
    tradeAssetId,
    setTradeAssetId,
    tradeType,
    setTradeType,
    tradeQty,
    setTradeQty,
    tradePrice,
    setTradePrice,
    tradeDate,
    setTradeDate,
    symbol,
    setSymbol,
    addAsset,
    logTrade,
  } = props;

  if (!selectedHolding && assets.length === 0) {
    return <ZeroStateDesk symbol={symbol} setSymbol={setSymbol} addAsset={addAsset} />;
  }

  const selectedSymbol = selectedHolding?.symbol;
  const openMarketHref = selectedSymbol
    ? `/market/${selectedSymbol}`
    : "/investments/discover";

  return (
    <GlassPane className={styles.focusPane}>
      <div className={styles.focusStack}>
        <div className={styles.focusHeader}>
          <div>
            <div className={styles.eyebrow}>Investments command</div>
            <div className={styles.focusTitle}>
              {selectedSymbol || "Desk starter"}
            </div>
            <div className={styles.focusMeta}>
              {selectedHolding
                ? `${selectedHolding.asset_type || "stock"} • ${selectedHolding.account || "Brokerage"} • ${selectedHolding.txCount} fills`
                : "Add a symbol and start routing fills into the ledger."}
            </div>
          </div>

          <div className={styles.focusHeaderRight}>
            <div className={styles.focusBadges}>
              {selectedHolding ? (
                <>
                  <MiniPill tone={toneByValue(selectedHolding.pnl)}>
                    {selectedHolding.hasLivePrice ? signedMoney(selectedHolding.pnl) : "pending"}
                  </MiniPill>
                  <MiniPill tone={toneByValue(selectedHolding.dayPct ?? selectedHolding.dayChange ?? 0)}>
                    {selectedHolding.dayPct != null ? pct(selectedHolding.dayPct) : "live"}
                  </MiniPill>
                </>
              ) : (
                <MiniPill tone="amber">starter</MiniPill>
              )}
            </div>

            <div className={styles.focusActionRow}>
              <ActionLink href="/investments/discover">
                Research <ArrowRight size={14} />
              </ActionLink>
              <ActionLink href={openMarketHref}>
                Open Market <ExternalLink size={14} />
              </ActionLink>
            </div>
          </div>
        </div>

        <div className={styles.tabRow}>
          {DESK_TABS.map((tab) => (
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
          {boardTab === "dashboard" ? (
            <DashboardTab
              portfolio={portfolio}
              prices={prices}
              selectedHolding={selectedHolding}
              alerts={alerts}
              openPositions={openPositions}
              news={news}
              newsError={newsError}
            />
          ) : null}

          {boardTab === "positions" ? (
            <PositionsTab
              openPositions={openPositions}
              assetMap={assetMap}
              recentTxns={recentTxns}
              selectedHolding={selectedHolding}
            />
          ) : null}

          {boardTab === "research" ? (
            <ResearchTab
              news={news}
              newsError={newsError}
              favorites={favorites}
              prices={prices}
              selectedHolding={selectedHolding}
            />
          ) : null}

          {boardTab === "ticket" ? (
            <TicketTab
              assets={assets}
              assetMap={assetMap}
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
              recentTxns={recentTxns}
            />
          ) : null}

          {boardTab === "watchlist" ? (
            <WatchlistTab
              favorites={favorites}
              prices={prices}
              selectedHolding={selectedHolding}
            />
          ) : null}
        </div>
      </div>
    </GlassPane>
  );
}
"use client";

import Link from "next/link";
import {
  Activity,
  ArrowRight,
  ExternalLink,
  Newspaper,
  Search,
  Star,
  TrendingDown,
  TrendingUp,
  Trash2,
} from "lucide-react";
import GlassPane from "../components/GlassPane";
import styles from "./InvestmentsPage.module.css";
import {
  initials,
  money,
  pct,
  shortDate,
  signedMoney,
  toneByValue,
  toneMeta,
  toNum,
} from "./investments.helpers";

export function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

export function MiniPill({ children, tone = "neutral", icon = null }) {
  const meta = toneMeta(tone);

  return (
    <span
      className={styles.pill}
      style={{
        borderColor: meta.border,
        color: tone === "neutral" ? "rgba(255,255,255,0.9)" : meta.text,
        background: `linear-gradient(180deg, ${meta.softBg}, rgba(255,255,255,0.01))`,
        boxShadow: `0 0 14px ${meta.glow}`,
      }}
    >
      {icon}
      {children}
    </span>
  );
}

export function ActionBtn({
  children,
  onClick,
  variant = "ghost",
  type = "button",
  disabled = false,
  full = false,
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        styles.button,
        variant === "primary" && styles.buttonPrimary,
        variant === "danger" && styles.buttonDanger,
        full && styles.buttonFull
      )}
    >
      {children}
    </button>
  );
}

export function ActionLink({ href, children, variant = "ghost" }) {
  return (
    <Link
      href={href}
      className={cx(
        styles.button,
        styles.linkButton,
        variant === "primary" && styles.buttonPrimary
      )}
    >
      {children}
    </Link>
  );
}

export function SectionCard({ title, subcopy, right, className = "", children }) {
  return (
    <GlassPane className={cx(styles.sectionCard, className)}>
      <div className={styles.cardHeader}>
        <div>
          <div className={styles.cardTitle}>{title}</div>
          {subcopy ? <div className={styles.cardSub}>{subcopy}</div> : null}
        </div>
        {right || null}
      </div>
      {children}
    </GlassPane>
  );
}

export function StatCard({ label, value, note, tone = "neutral" }) {
  const meta = toneMeta(tone);

  return (
    <GlassPane className={styles.statCard}>
      <div className={styles.statLabel}>{label}</div>
      <div
        className={styles.statValue}
        style={{ color: tone === "neutral" ? "#ffffff" : meta.text }}
      >
        {value}
      </div>
      <div className={styles.statNote}>{note}</div>
    </GlassPane>
  );
}

export function EmptyState({ title, detail, compact = false }) {
  return (
    <div className={cx(styles.emptyState, compact && styles.emptyStateCompact)}>
      <div>
        <div className={styles.emptyTitle}>{title}</div>
        <div className={styles.emptyText}>{detail}</div>
      </div>
    </div>
  );
}

export function BoardCard({ symbol, label, quote, href }) {
  const tone = toneByValue(quote?.changesPercentage ?? quote?.change ?? 0);
  const meta = toneMeta(tone);
  const Icon = tone === "red" ? TrendingDown : TrendingUp;

  return (
    <Link href={href} className={styles.boardCard}>
      <div className={styles.boardTop}>
        <div>
          <div className={styles.boardLabel}>{label}</div>
          <div className={styles.boardSymbol}>{symbol}</div>
        </div>

        <div
          className={styles.boardIcon}
          style={{
            borderColor: meta.border,
            background: meta.iconBg,
            color: tone === "neutral" ? "#fff" : meta.text,
          }}
        >
          <Icon size={14} />
        </div>
      </div>

      <div className={styles.boardPrice}>
        {Number.isFinite(Number(quote?.price)) ? money(quote.price) : "—"}
      </div>

      <div
        className={styles.boardMove}
        style={{ color: tone === "neutral" ? "rgba(255,255,255,0.64)" : meta.text }}
      >
        {Number.isFinite(Number(quote?.change)) ? signedMoney(quote.change) : "Waiting"}
        {Number.isFinite(Number(quote?.changesPercentage))
          ? ` • ${pct(quote.changesPercentage)}`
          : ""}
      </div>
    </Link>
  );
}

export function WatchRow({ symbol, name, quote, href, status = "" }) {
  const tone = toneByValue(quote?.changesPercentage ?? quote?.change ?? 0);
  const meta = toneMeta(tone);

  return (
    <Link href={href} className={styles.watchRow}>
      <div
        className={styles.watchIcon}
        style={{
          borderColor: meta.border,
          background: meta.iconBg,
          color: tone === "neutral" ? "#fff" : meta.text,
        }}
      >
        <Star size={14} />
      </div>

      <div className={styles.watchMain}>
        <div className={styles.watchTitle}>{symbol}</div>
        <div className={styles.watchSub}>{name || status || "Saved name"}</div>
      </div>

      <div className={styles.watchRight}>
        <div
          className={styles.watchPrice}
          style={{ color: tone === "neutral" ? "rgba(255,255,255,0.82)" : meta.text }}
        >
          {Number.isFinite(Number(quote?.price)) ? money(quote.price) : "—"}
        </div>
        {status ? <div className={styles.watchTag}>{status}</div> : null}
      </div>
    </Link>
  );
}

export function NewsRow({ item }) {
  const symbol =
    Array.isArray(item?.symbols) && item.symbols.length
      ? String(item.symbols[0]).toUpperCase()
      : item?.symbol
        ? String(item.symbol).toUpperCase()
        : "";

  return (
    <a
      href={item?.url || "#"}
      target="_blank"
      rel="noreferrer"
      className={styles.newsRow}
    >
      <div className={styles.newsIcon}>
        <Newspaper size={15} />
      </div>

      <div className={styles.newsMain}>
        <div className={styles.newsTitle}>{item?.title || "Untitled headline"}</div>
        <div className={styles.newsText}>{item?.text || item?.site || "Market story"}</div>
        <div className={styles.newsMeta}>
          {(item?.site || "Source") + " • " + shortDate(item?.publishedDate)}
        </div>
      </div>

      <div className={styles.newsRight}>
        {symbol ? <MiniPill>{symbol}</MiniPill> : null}
        <ExternalLink size={13} />
      </div>
    </a>
  );
}

export function FillRow({ txn, assetMap }) {
  const type = String(txn?.txn_type || "").toUpperCase();
  const tone = type === "SELL" ? "red" : "green";
  const meta = toneMeta(tone);
  const symbol = assetMap.get(txn?.asset_id)?.symbol || "—";

  return (
    <div className={styles.fillRow}>
      <div
        className={styles.fillIcon}
        style={{
          borderColor: meta.border,
          background: meta.iconBg,
          color: meta.text,
        }}
      >
        {type === "SELL" ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
      </div>

      <div className={styles.fillMain}>
        <div className={styles.fillTitle}>
          {symbol} {type}
        </div>
        <div className={styles.fillSub}>
          {toNum(txn?.qty).toLocaleString(undefined, { maximumFractionDigits: 4 })} @{" "}
          {money(txn?.price)} • {shortDate(txn?.txn_date)}
        </div>
      </div>

      <div className={styles.fillValue}>{money(toNum(txn?.qty) * toNum(txn?.price))}</div>
    </div>
  );
}

export function HoldingRow({
  item,
  selected = false,
  onSelect,
  onOpenMarket,
  onDelete,
}) {
  const tone = item?.hasLivePrice ? toneByValue(item?.pnl) : "amber";
  const meta = toneMeta(tone);

  return (
    <div
      className={cx(styles.holdingRow, selected && styles.holdingRowSelected)}
      style={{
        borderColor: selected ? meta.border : undefined,
        boxShadow: selected ? `0 0 24px ${meta.glow}` : undefined,
      }}
    >
      <button type="button" className={styles.holdingCellMain} onClick={onSelect}>
        <div
          className={styles.holdingAvatar}
          style={{
            borderColor: meta.border,
            background: meta.iconBg,
            color: tone === "neutral" ? "#fff" : meta.text,
          }}
        >
          {initials(item?.symbol)}
        </div>

        <div className={styles.holdingCopy}>
          <div className={styles.holdingSymbol}>{item?.symbol}</div>
          <div className={styles.holdingName}>
            {item?.account || "Brokerage"} • {item?.txCount || 0} fills
          </div>
        </div>
      </button>

      <div className={styles.holdingMetric}>
        <div className={styles.holdingMetricValue}>
          {toNum(item?.shares).toLocaleString(undefined, { maximumFractionDigits: 4 })}
        </div>
        <div className={styles.holdingMetricLabel}>shares</div>
      </div>

      <div className={styles.holdingMetric}>
        <div className={styles.holdingMetricValue}>{money(item?.value)}</div>
        <div className={styles.holdingMetricLabel}>value</div>
      </div>

      <div className={styles.holdingMetric}>
        <div className={styles.holdingMetricValue}>{money(item?.remainingBasis)}</div>
        <div className={styles.holdingMetricLabel}>basis</div>
      </div>

      <div className={styles.holdingMetric}>
        <div
          className={styles.holdingMetricValue}
          style={{ color: item?.hasLivePrice ? meta.text : "rgba(255,255,255,0.62)" }}
        >
          {item?.hasLivePrice ? signedMoney(item?.pnl) : "Pending"}
        </div>
        <div className={styles.holdingMetricLabel}>
          {item?.pnlPct != null ? pct(item?.pnlPct) : "no quote"}
        </div>
      </div>

      <div className={styles.holdingActions}>
        <button type="button" className={styles.inlineAction} onClick={onOpenMarket}>
          Open
        </button>
        <button type="button" className={styles.inlineActionDanger} onClick={onDelete}>
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

export function SearchResultRow({
  row,
  quote,
  selected = false,
  owned = false,
  watched = false,
  onSelect,
}) {
  const tone = toneByValue(quote?.changesPercentage ?? quote?.change ?? 0);
  const meta = toneMeta(tone);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cx(styles.resultRow, selected && styles.resultRowSelected)}
      style={{
        borderColor: selected ? meta.border : undefined,
        boxShadow: selected ? `0 0 24px ${meta.glow}` : undefined,
      }}
    >
      <div
        className={styles.resultAvatar}
        style={{
          borderColor: meta.border,
          background: meta.iconBg,
          color: tone === "neutral" ? "#fff" : meta.text,
        }}
      >
        {row.symbol.slice(0, 2)}
      </div>

      <div className={styles.resultCopy}>
        <div className={styles.resultTop}>
          <div className={styles.resultSymbol}>{row.symbol}</div>
          <div className={styles.resultPrice}>
            {Number.isFinite(Number(quote?.price)) ? money(quote.price) : "—"}
          </div>
        </div>
        <div className={styles.resultName}>
          {row.name} • {row.exchange || "Market"} • {row.type || "Stock"}
        </div>
        <div className={styles.resultBadges}>
          <MiniPill>{row.type || "Stock"}</MiniPill>
          {Number.isFinite(Number(quote?.changesPercentage)) ? (
            <MiniPill tone={tone}>
              {pct(quote.changesPercentage)}
            </MiniPill>
          ) : null}
          {owned ? <MiniPill tone="green">owned</MiniPill> : null}
          {watched ? <MiniPill tone="amber">watching</MiniPill> : null}
        </div>
      </div>
    </button>
  );
}

export function SearchToolbar({
  query,
  setQuery,
  type,
  setType,
  types,
  onSubmit,
  chips = [],
  onQuickPick,
}) {
  return (
    <form
      className={styles.searchToolbar}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label className={styles.searchBox}>
        <Search size={15} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search ticker or company"
          className={styles.searchInput}
        />
      </label>

      <select
        value={type}
        onChange={(event) => setType(event.target.value)}
        className={styles.selectField}
      >
        {types.map((entry) => (
          <option key={entry} value={entry}>
            {entry}
          </option>
        ))}
      </select>

      <ActionBtn type="submit" variant="primary">
        Search
      </ActionBtn>

      {chips.length ? (
        <div className={styles.chipRow}>
          {chips.map((chip) => (
            <button
              key={chip}
              type="button"
              className={styles.chipButton}
              onClick={() => onQuickPick(chip)}
            >
              {chip}
            </button>
          ))}
        </div>
      ) : null}
    </form>
  );
}

export function SignalRow({ title, detail, value, tone = "neutral", icon = null }) {
  const meta = toneMeta(tone);

  return (
    <div
      className={styles.signalRow}
      style={{
        borderColor: meta.border,
        background: `linear-gradient(180deg, ${meta.softBg}, rgba(255,255,255,0.01))`,
      }}
    >
      <div className={styles.signalIcon}>
        {icon || <Activity size={14} />}
      </div>
      <div className={styles.signalMain}>
        <div className={styles.signalTitle}>{title}</div>
        <div className={styles.signalText}>{detail}</div>
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

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Landmark,
  PencilLine,
  PiggyBank,
  Plus,
  Receipt,
  Save,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import GlassPane from "../components/GlassPane";
import styles from "./IncomePage.module.css";
import {
  dateLabel,
  fmtMonthLabel,
  formatAgo,
  money,
  niceSourceLabel,
  pct,
  shortMoney,
  timeLabel,
  toneMeta,
} from "./income.helpers";

function cx(...names) {
  return names.filter(Boolean).join(" ");
}

function accountIcon(name = "") {
  const value = String(name || "").toLowerCase();
  if (value.includes("save")) return <PiggyBank size={15} />;
  if (value.includes("cash")) return <Wallet size={15} />;
  return <Landmark size={15} />;
}

function MiniPill({ children, tone = "neutral" }) {
  const meta = toneMeta(tone);

  return (
    <div
      className={styles.miniPill}
      style={{
        borderColor: meta.border,
        color: tone === "neutral" ? "rgba(255,255,255,0.88)" : meta.text,
        boxShadow: `0 0 18px ${meta.glow}`,
      }}
    >
      {children}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = "ghost",
  type = "button",
  full = false,
  disabled = false,
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        styles.button,
        variant === "primary"
          ? styles.buttonPrimary
          : variant === "danger"
          ? styles.buttonDanger
          : styles.buttonGhost,
        full && styles.buttonFull
      )}
    >
      {children}
    </button>
  );
}

export function Toast({ error, status, warning, onClearError }) {
  if (!error && !status && !warning) return null;

  return (
    <div className={styles.toastStack}>
      {status ? (
        <div className={`${styles.toast} ${styles.toastSuccess}`}>
          <CheckCircle2 size={14} />
          {status}
        </div>
      ) : null}

      {warning ? (
        <div className={`${styles.toast} ${styles.toastWarn}`}>
          <AlertTriangle size={14} />
          {warning}
        </div>
      ) : null}

      {error ? (
        <div className={`${styles.toast} ${styles.toastError}`}>
          <AlertTriangle size={14} />
          <span className={styles.toastText}>{error}</span>
          <button
            type="button"
            onClick={onClearError}
            className={styles.toastClose}
            aria-label="Dismiss"
          >
            <X size={12} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function ModalShell({
  open,
  title,
  subcopy,
  onClose,
  children,
  footer,
  className,
}) {
  useEffect(() => {
    if (!open) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };

    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={styles.modalOverlay}>
      <button type="button" className={styles.modalBackdrop} onClick={onClose} />
      <div className={cx(styles.modal, className)}>
        <div className={styles.modalHead}>
          <div>
            <div className={styles.modalTitle}>{title}</div>
            {subcopy ? <div className={styles.modalSub}>{subcopy}</div> : null}
          </div>

          <button type="button" onClick={onClose} className={styles.closeButton} aria-label="Close">
            <X size={14} />
          </button>
        </div>

        <div className={styles.modalBody}>{children}</div>

        {footer ? <div className={styles.modalFoot}>{footer}</div> : null}
      </div>
    </div>
  );
}

export function SummaryStrip({ summary, selectedEntry, settings }) {
  return (
    <GlassPane className={styles.summaryStrip}>
      <div className={styles.summaryInner}>
        <div className={styles.titleBlock}>
          <div className={styles.eyebrow}>Money / Income</div>

          <div className={styles.pageTitleRow}>
            <div className={styles.pageTitle}>Income</div>
            <MiniPill tone="green">command</MiniPill>
          </div>

          <div className={styles.workspaceCopy}>
            One workspace for deposited income, payday planning, routing, and pace control.
          </div>
        </div>

        <div className={styles.summaryStats}>
          <div className={styles.summaryStat}>
            <div className={styles.summaryLabel}>Received</div>
            <div className={styles.summaryValue}>{shortMoney(summary.monthTotal)}</div>
            <div className={styles.summaryHint}>{fmtMonthLabel(summary.targetMonth)}</div>
          </div>

          <div className={styles.summaryStat}>
            <div className={styles.summaryLabel}>Left To Goal</div>
            <div className={styles.summaryValue}>{shortMoney(summary.remaining)}</div>
            <div className={styles.summaryHint}>monthly target gap</div>
          </div>

          <div className={styles.summaryStat}>
            <div className={styles.summaryLabel}>Projected Finish</div>
            <div className={styles.summaryValue}>{shortMoney(summary.projectedThisMonth)}</div>
            <div className={styles.summaryHint}>scheduled + bonus</div>
          </div>

          <div className={styles.summaryStat}>
            <div className={styles.summaryLabel}>Upcoming</div>
            <div className={styles.summaryValue}>{summary.upcomingScheduled.length}</div>
            <div className={styles.summaryHint}>scheduled paydays</div>
          </div>

          <div className={styles.summaryStat}>
            <div className={styles.summaryLabel}>Selected</div>
            <div className={styles.summaryValue}>
              {selectedEntry?.amount != null ? shortMoney(selectedEntry.amount) : "—"}
            </div>
            <div className={styles.summaryHint}>{selectedEntry?.source || "no entry selected"}</div>
          </div>
        </div>

        <div className={styles.summaryRight}>
          <MiniPill tone={summary.shortByProjection > 0 ? "warn" : "good"}>
            {summary.shortByProjection > 0 ? `${shortMoney(summary.shortByProjection)} short` : "target clears"}
          </MiniPill>
          <MiniPill tone={summary.behindBy > 0 ? "warn" : "good"}>
            {summary.behindBy > 0 ? `${shortMoney(summary.behindBy)} behind pace` : `${shortMoney(summary.aheadBy)} ahead`}
          </MiniPill>
          <MiniPill tone="blue">{summary.routedCount} routed</MiniPill>
          <MiniPill tone="blue">{settings.schedule.toLowerCase().replaceAll("_", " ")}</MiniPill>
        </div>
      </div>
    </GlassPane>
  );
}

function QueueRow({ entry, selected, onSelect }) {
  const tone =
    entry.type === "received"
      ? "good"
      : entry.type === "scheduled"
      ? "warn"
      : "blue";
  const meta = toneMeta(tone);

  return (
    <button
      type="button"
      className={cx(styles.queueRow, selected && styles.queueRowActive)}
      onClick={onSelect}
    >
      <div
        className={styles.queueAccent}
        style={{ background: selected ? meta.text : "transparent" }}
      />

      <div
        className={styles.queueIcon}
        style={{
          color: meta.text,
          borderColor: meta.border,
          boxShadow: `0 0 18px ${meta.glow}`,
        }}
      >
        {entry.type === "received" ? <Receipt size={15} /> : entry.type === "scheduled" ? <CalendarDays size={15} /> : <Clock3 size={15} />}
      </div>

      <div className={styles.queueMain}>
        <div className={styles.queueTop}>
          <div className={styles.queueName}>{entry.source}</div>
          <div className={styles.queueAmount}>
            {entry.amount != null ? money(entry.amount) : "Projected"}
          </div>
        </div>

        <div className={styles.queueBottom}>
          <div className={styles.queueMeta}>
            <span>{dateLabel(entry.date)}</span>
            <span>•</span>
            <span>{entry.label}</span>
            {entry.accountName ? (
              <>
                <span>•</span>
                <span>{entry.accountName}</span>
              </>
            ) : null}
          </div>

          <div className={styles.queueBadges}>
            {entry.type === "received" ? <MiniPill tone="good">Posted</MiniPill> : null}
            {entry.type === "scheduled" ? <MiniPill tone="warn">Scheduled</MiniPill> : null}
            {entry.type === "projected" ? <MiniPill tone="blue">Projected</MiniPill> : null}
          </div>
        </div>
      </div>

      <ChevronRight size={14} className={styles.queueChevron} />
    </button>
  );
}

export function QueuePane({
  entries,
  selectedEntry,
  onSelect,
  search,
  setSearch,
  filter,
  setFilter,
  viewMonth,
}) {
  return (
    <GlassPane className={styles.queuePane}>
      <div className={styles.paneHeader}>
        <div>
          <div className={styles.paneTitle}>Income navigator</div>
          <div className={styles.paneSub}>Choose a deposit or payday to command.</div>
        </div>
      </div>

      <div className={styles.queueToolbar}>
        <label className={styles.searchWrap}>
          <Search size={14} />
          <input
            className={styles.searchInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search income…"
          />
          {search ? (
            <button type="button" className={styles.searchClear} onClick={() => setSearch("")} aria-label="Clear search">
              <X size={12} />
            </button>
          ) : null}
        </label>

        <div className={styles.filterRow}>
          {[
            ["all", "All"],
            ["received", "Received"],
            ["scheduled", "Scheduled"],
            ["projected", "Projected"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={cx(styles.filterChip, filter === value && styles.filterChipActive)}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className={styles.queueMetaRow}>
          <span>{fmtMonthLabel(viewMonth)}</span>
          <span>{entries.length} showing</span>
        </div>
      </div>

      <div className={styles.queueList}>
        {entries.length ? (
          entries.map((entry) => (
            <QueueRow
              key={entry.key}
              entry={entry}
              selected={entry.key === selectedEntry?.key}
              onSelect={() => onSelect(entry.key)}
            />
          ))
        ) : (
          <div className={styles.paneEmpty}>No matching income rows.</div>
        )}
      </div>
    </GlassPane>
  );
}

function TopMetric({ label, value, sub, tone = "neutral" }) {
  const toneClass =
    tone === "good"
      ? styles.valuePositive
      : tone === "warn"
      ? styles.valueWarning
      : tone === "bad"
      ? styles.valueNegative
      : "";

  return (
    <div className={styles.metricCard}>
      <div className={styles.metricLabel}>{label}</div>
      <div className={cx(styles.metricValue, toneClass)}>{value}</div>
      <div className={styles.metricSub}>{sub}</div>
    </div>
  );
}

function TabBtn({ label, active, onClick }) {
  return (
    <button type="button" className={cx(styles.tab, active && styles.tabActive)} onClick={onClick}>
      {label}
    </button>
  );
}

function QuickInfoRow({ label, value, tone = "neutral" }) {
  const color =
    tone === "good"
      ? "#97efc7"
      : tone === "warn"
      ? "#f5cf88"
      : tone === "bad"
      ? "#ff646b"
      : tone === "blue"
      ? "#bcd7ff"
      : "#fff";

  return (
    <div className={styles.infoRow}>
      <span>{label}</span>
      <span style={{ color }}>{value}</span>
    </div>
  );
}

function DepositRow({ item, onEdit, onDelete }) {
  return (
    <div className={styles.dataRow}>
      <div className={styles.dataMain}>
        <div className={styles.dataTitle}>{niceSourceLabel(item.source)}</div>
        <div className={styles.dataSub}>
          {dateLabel(item.date)} • {item.accountName || "No routing"} • {formatAgo(item.createdAt)}
        </div>
        {item.note ? <div className={styles.dataNote}>{item.note}</div> : null}
      </div>

      <div className={styles.dataRight}>
        <div className={`${styles.dataAmount} ${styles.valuePositive}`}>{money(item.amount)}</div>
        <div className={styles.rowActions}>
          <Button onClick={() => onEdit(item)}>Edit</Button>
          <Button variant="danger" onClick={() => onDelete(item.id)}>
            <Trash2 size={13} />
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

function ScheduledRow({ item, paydayEventTime, onReceive, onDelete }) {
  return (
    <div className={styles.dataRow}>
      <div className={styles.dataMain}>
        <div className={styles.dataTitle}>{niceSourceLabel(item.source)}</div>
        <div className={styles.dataSub}>
          {dateLabel(item.pay_date)} • Scheduled • {item.account_name || "No routing"}
        </div>
        <div className={styles.dataSub}>
          {item.calendar_event_id ? `Calendar • ${timeLabel(paydayEventTime)}` : "No calendar event"}
        </div>
        {item.note ? <div className={styles.dataNote}>{item.note}</div> : null}
      </div>

      <div className={styles.dataRight}>
        <div className={`${styles.dataAmount} ${styles.valueWarning}`}>{money(item.expected_amount)}</div>
        <div className={styles.rowActions}>
          <Button variant="primary" onClick={() => onReceive(item)}>
            <Sparkles size={13} />
            Mark received
          </Button>
          <Button variant="danger" onClick={() => onDelete(item.id)}>
            <Trash2 size={13} />
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

function BreakdownRow({ row, monthTotal }) {
  const width = pct(row.total, monthTotal);
  return (
    <div className={styles.mixRow}>
      <div className={styles.mixLabel}>{row.label}</div>
      <div className={styles.mixBarTrack}>
        <div className={styles.mixBarFill} style={{ width: `${Math.max(width, 6)}%` }} />
      </div>
      <div className={styles.mixAmount}>{money(row.total)}</div>
    </div>
  );
}

function ForecastChip({ item }) {
  return <div className={styles.forecastChip}>{dateLabel(item.pay_date)}</div>;
}

function SelectedEntryCard({ entry }) {
  if (!entry) {
    return (
      <div className={styles.heroDetailCard}>
        <div className={styles.panelTitle}>Income command</div>
        <div className={styles.panelSub}>Select a row from the left to inspect it here.</div>
      </div>
    );
  }

  const tone =
    entry.type === "received" ? "good" : entry.type === "scheduled" ? "warn" : "blue";

  return (
    <div className={styles.heroDetailCard}>
      <div className={styles.heroDetailTop}>
        <div>
          <div className={styles.balanceLabel}>Selected entry</div>
          <div className={styles.heroEntryTitle}>{entry.source}</div>
        </div>
        <MiniPill tone={tone}>{entry.label}</MiniPill>
      </div>

      <div className={styles.heroEntryAmount}>{entry.amount != null ? money(entry.amount) : "Projected"}</div>

      <div className={styles.infoList}>
        <QuickInfoRow label="Date" value={dateLabel(entry.date)} tone="blue" />
        <QuickInfoRow label="Routing" value={entry.accountName || "No routing"} />
        <QuickInfoRow label="Note" value={entry.note || "No note"} />
      </div>
    </div>
  );
}

export function FocusPane({
  selectedEntry,
  summary,
  settings,
  accounts,
  tab,
  setTab,
  receivedItems,
  scheduledItems,
  sourceBreakdown,
  projectedOnly,
  onOpenNewReceived,
  onOpenNewScheduled,
  onEditDeposit,
  onDeleteDeposit,
  onMarkScheduledReceived,
  onDeleteScheduled,
  toolsPanel,
}) {
  const [toolsOpen, setToolsOpen] = useState(false);

  useEffect(() => {
    setToolsOpen(false);
  }, [selectedEntry?.key]);

  const nextAccount = accounts.find((account) => account.id === settings.defaultAccountId) || null;

  return (
    <>
      <GlassPane className={styles.focusPane}>
        <div className={styles.focusStack}>
          <div className={styles.focusHeader}>
            <div>
              <div className={styles.eyebrow}>Income command</div>
              <div className={styles.focusTitle}>{selectedEntry?.source || fmtMonthLabel(summary.targetMonth)}</div>
              <div className={styles.focusMeta}>
                {selectedEntry
                  ? `${selectedEntry.label} • ${dateLabel(selectedEntry.date)}`
                  : "Control deposits, payday planning, and month pace from one place."}
              </div>
            </div>

            <div className={styles.focusHeaderRight}>
              <div className={styles.focusBadges}>
                <MiniPill tone={summary.shortByProjection > 0 ? "warn" : "good"}>
                  {summary.shortByProjection > 0 ? "Below projection" : "On pace"}
                </MiniPill>
                {nextAccount ? <MiniPill tone="blue">{nextAccount.name}</MiniPill> : null}
              </div>

              <div className={styles.focusActionRow}>
                <Button variant="primary" onClick={onOpenNewReceived}>
                  <Plus size={14} />
                  New
                </Button>
                <Button onClick={onOpenNewScheduled}>
                  <CalendarDays size={14} />
                  Schedule
                </Button>
                <Button variant={toolsOpen ? "primary" : "ghost"} onClick={() => setToolsOpen(true)}>
                  <SlidersHorizontal size={14} />
                  Tools
                </Button>
              </div>
            </div>
          </div>

          <div className={styles.bankHero}>
            <div className={styles.bankHeroMain}>
              <div className={styles.balanceLabel}>Month received</div>
              <div className={styles.balanceValue}>{money(summary.monthTotal)}</div>

              <div className={styles.balanceBadgeRow}>
                <MiniPill tone={summary.behindBy > 0 ? "warn" : "good"}>
                  {summary.behindBy > 0 ? `${money(summary.behindBy)} behind` : `${money(summary.aheadBy)} ahead`}
                </MiniPill>
                <MiniPill tone={summary.shortByProjection > 0 ? "warn" : "good"}>
                  {summary.shortByProjection > 0 ? `${money(summary.shortByProjection)} short` : "projection clears"}
                </MiniPill>
              </div>

              <div className={styles.workspaceCopy}>
                This view answers what landed, what is still expected, where income routed, and whether the month is on track.
              </div>
            </div>

            <SelectedEntryCard entry={selectedEntry} />
          </div>

          <div className={styles.metricGrid}>
            <TopMetric
              label="Left to Goal"
              value={money(summary.remaining)}
              sub="Monthly target gap"
              tone={summary.remaining > 0 ? "warn" : "good"}
            />
            <TopMetric
              label="Projected Finish"
              value={money(summary.projectedThisMonth)}
              sub={summary.shortByProjection > 0 ? "Current path still short" : "Projected to clear target"}
              tone={summary.shortByProjection > 0 ? "warn" : "good"}
            />
            <TopMetric
              label="Need Per Day"
              value={money(summary.neededPerDay)}
              sub="Remaining daily pace"
              tone="blue"
            />
            <TopMetric
              label="Next Payday"
              value={summary.nextScheduled ? dateLabel(summary.nextScheduled.pay_date) : summary.nextProjected ? dateLabel(summary.nextProjected.pay_date) : "Clear"}
              sub={summary.nextScheduled ? niceSourceLabel(summary.nextScheduled.source) : summary.nextProjected ? "Projected schedule" : "No upcoming payday"}
              tone={summary.nextScheduled ? "warn" : "blue"}
            />
          </div>

          <div className={styles.tabsRow}>
            <TabBtn label="Command" active={tab === "command"} onClick={() => setTab("command")} />
            <TabBtn label="Received" active={tab === "received"} onClick={() => setTab("received")} />
            <TabBtn label="Scheduled" active={tab === "scheduled"} onClick={() => setTab("scheduled")} />
            <TabBtn label="Outlook" active={tab === "outlook"} onClick={() => setTab("outlook")} />
          </div>

          <div className={styles.tabStage}>
            {tab === "command" ? (
              <div className={styles.splitLayoutFill}>
                <div className={`${styles.panel} ${styles.panelFill}`}>
                  <div className={styles.panelHeader}>
                    <div>
                      <div className={styles.panelTitle}>Month control</div>
                      <div className={styles.panelSub}>The fastest read on how the month is shaping up.</div>
                    </div>
                    <MiniPill tone="good">{fmtMonthLabel(summary.targetMonth)}</MiniPill>
                  </div>

                  <div className={styles.infoList}>
                    <QuickInfoRow label="Received" value={money(summary.monthTotal)} tone="good" />
                    <QuickInfoRow label="Target" value={money(summary.goalNum)} />
                    <QuickInfoRow label="Remaining" value={money(summary.remaining)} tone={summary.remaining > 0 ? "warn" : "good"} />
                    <QuickInfoRow label="Projected finish" value={money(summary.projectedThisMonth)} tone={summary.shortByProjection > 0 ? "warn" : "good"} />
                    <QuickInfoRow label="Last 7 days" value={money(summary.last7Total)} tone="blue" />
                    <QuickInfoRow label="Deposit streak" value={`${summary.depositStreak} day${summary.depositStreak === 1 ? "" : "s"}`} tone="blue" />
                  </div>
                </div>

                <div className={styles.asideStackFill}>
                  <div className={`${styles.panel} ${styles.panelFillCompact}`}>
                    <div className={styles.panelHeader}>
                      <div>
                        <div className={styles.panelTitle}>Routing default</div>
                        <div className={styles.panelSub}>Where one-tap deposits are aimed right now.</div>
                      </div>
                    </div>

                    <div className={styles.routeCard}>
                      <div className={styles.routeIcon}>{accountIcon(nextAccount?.name)}</div>
                      <div>
                        <div className={styles.routeTitle}>{nextAccount?.name || "No default account"}</div>
                        <div className={styles.panelSub}>
                          {nextAccount ? money(nextAccount.balance) : "Deposits can still be logged without routing."}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={`${styles.panel} ${styles.panelFillCompact}`}>
                    <div className={styles.panelHeader}>
                      <div>
                        <div className={styles.panelTitle}>Fast actions</div>
                        <div className={styles.panelSub}>Create the next move without leaving the page.</div>
                      </div>
                    </div>

                    <div className={styles.actionGrid}>
                      <Button variant="primary" full onClick={onOpenNewReceived}>
                        <Plus size={14} />
                        Log received income
                      </Button>
                      <Button full onClick={onOpenNewScheduled}>
                        <CalendarDays size={14} />
                        Schedule payday
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {tab === "received" ? (
              <div className={styles.singlePanelFill}>
                <div className={`${styles.panel} ${styles.panelFill}`}>
                  <div className={styles.panelHeader}>
                    <div>
                      <div className={styles.panelTitle}>Received deposits</div>
                      <div className={styles.panelSub}>What was actually logged for this month.</div>
                    </div>
                    <MiniPill tone="good">{receivedItems.length} rows</MiniPill>
                  </div>

                  {receivedItems.length ? (
                    <div className={`${styles.dataList} ${styles.scrollRegion}`}>
                      {receivedItems.map((item) => (
                        <DepositRow
                          key={item.id}
                          item={item}
                          onEdit={onEditDeposit}
                          onDelete={onDeleteDeposit}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className={styles.paneEmpty}>No deposits recorded for this month.</div>
                  )}
                </div>
              </div>
            ) : null}

            {tab === "scheduled" ? (
              <div className={styles.singlePanelFill}>
                <div className={`${styles.panel} ${styles.panelFill}`}>
                  <div className={styles.panelHeader}>
                    <div>
                      <div className={styles.panelTitle}>Scheduled paydays</div>
                      <div className={styles.panelSub}>What is still expected to come in.</div>
                    </div>
                    <MiniPill tone="warn">{scheduledItems.length} active</MiniPill>
                  </div>

                  {scheduledItems.length ? (
                    <div className={`${styles.dataList} ${styles.scrollRegion}`}>
                      {scheduledItems.map((item) => (
                        <ScheduledRow
                          key={item.id}
                          item={item}
                          paydayEventTime={settings.paydayEventTime}
                          onReceive={onMarkScheduledReceived}
                          onDelete={onDeleteScheduled}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className={styles.paneEmpty}>No scheduled paydays for this month.</div>
                  )}
                </div>
              </div>
            ) : null}

            {tab === "outlook" ? (
              <div className={styles.splitLayoutFill}>
                <div className={`${styles.panel} ${styles.panelFill}`}>
                  <div className={styles.panelHeader}>
                    <div>
                      <div className={styles.panelTitle}>Source mix</div>
                      <div className={styles.panelSub}>Which income streams carried the month so far.</div>
                    </div>
                  </div>

                  {sourceBreakdown.length ? (
                    <div className={`${styles.flowMixGrid} ${styles.scrollRegion}`}>
                      {sourceBreakdown.map((row) => (
                        <BreakdownRow key={row.label} row={row} monthTotal={summary.monthTotal} />
                      ))}
                    </div>
                  ) : (
                    <div className={styles.paneEmpty}>No source data for this month yet.</div>
                  )}
                </div>

                <div className={`${styles.panel} ${styles.panelFill}`}>
                  <div className={styles.panelHeader}>
                    <div>
                      <div className={styles.panelTitle}>Projected paydays</div>
                      <div className={styles.panelSub}>Expected dates not yet turned into scheduled rows.</div>
                    </div>
                    <MiniPill tone="blue">{projectedOnly.length} dates</MiniPill>
                  </div>

                  {projectedOnly.length ? (
                    <div className={styles.forecastGrid}>
                      {projectedOnly.map((item) => (
                        <ForecastChip key={item.id} item={item} />
                      ))}
                    </div>
                  ) : (
                    <div className={styles.paneEmpty}>All projected dates already have scheduled rows.</div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {toolsOpen ? (
          <div className={styles.commandDrawerWrap}>
            <button type="button" className={styles.commandDrawerBackdrop} onClick={() => setToolsOpen(false)} aria-label="Close drawer" />
            <aside className={styles.commandDrawer}>
              <div className={styles.drawerHeader}>
                <div>
                  <div className={styles.panelTitle}>Income tools</div>
                  <div className={styles.panelSub}>Settings, schedule defaults, and deeper month context.</div>
                </div>
                <button type="button" className={styles.closeButton} onClick={() => setToolsOpen(false)} aria-label="Close">
                  <X size={16} />
                </button>
              </div>

              <div className={styles.drawerBody}>{toolsPanel}</div>
            </aside>
          </div>
        ) : null}
      </GlassPane>
    </>
  );
}
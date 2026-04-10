"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Landmark,
  PiggyBank,
  Plus,
  Save,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import GlassPane from "../components/GlassPane";
import styles from "./AccountsPage.module.css";
import {
  accountTone,
  amountFromBill,
  billTitle,
  flowBucket,
  fmtMoney,
  formatAgo,
  normalizeAccountType,
  riskMeta,
  safeNum,
  shortDate,
  toneMeta,
} from "./accounts.helpers";

function cx(...names) {
  return names.filter(Boolean).join(" ");
}

function getAccountIcon(type = "") {
  const value = String(type || "").toLowerCase();
  if (value.includes("savings")) return <PiggyBank size={15} />;
  if (value.includes("credit")) return <CreditCard size={15} />;
  if (value.includes("cash")) return <Wallet size={15} />;
  return <Landmark size={15} />;
}

function bucketForFilter(tx) {
  const bucket = flowBucket(tx);
  if (bucket === "Income") return "income";
  if (bucket === "Bills") return "bills";
  if (bucket === "Transfers") return "transfers";
  if (bucket === "Adjustments") return "adjustments";
  return "spending";
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
        variant === "primary" ? styles.buttonPrimary : styles.buttonGhost,
        full && styles.buttonFull
      )}
    >
      {children}
    </button>
  );
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

export function Toast({ error, status, onClearError }) {
  if (!error && !status) return null;

  return (
    <div className={styles.toastStack}>
      {status ? (
        <div className={`${styles.toast} ${styles.toastSuccess}`}>
          <CheckCircle2 size={14} />
          {status}
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

export function ModalShell({ open, title, subcopy, onClose, children, footer }) {
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
      <div className={styles.modal}>
        <div className={styles.modalHead}>
          <div>
            <div className={styles.modalTitle}>{title}</div>
            {subcopy ? <div className={styles.modalSub}>{subcopy}</div> : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <div className={styles.modalBody}>{children}</div>

        {footer ? <div className={styles.modalFoot}>{footer}</div> : null}
      </div>
    </div>
  );
}

export function SummaryStrip({
  accounts,
  totalCash,
  checkingTotal,
  savingsTotal,
  atRiskCount,
  selectedAccount,
  selectedSummary,
  selectedRisk,
}) {
  return (
    <GlassPane className={styles.summaryStrip}>
      <div className={styles.summaryInner}>
        <div className={styles.titleBlock}>
          <div className={styles.eyebrow}>Money / Accounts</div>

          <div className={styles.pageTitleRow}>
            <div className={styles.pageTitle}>Accounts</div>
            <MiniPill tone="green">live</MiniPill>
          </div>

          <div className={styles.workspaceCopy}>
            Bank-style account control with forecast, buffer logic, and shared ledger flow.
          </div>
        </div>

        <div className={styles.summaryStats}>
          <div className={styles.summaryStat}>
            <div className={styles.summaryLabel}>Accounts</div>
            <div className={styles.summaryValue}>{accounts.length}</div>
            <div className={styles.summaryHint}>tracked</div>
          </div>

          <div className={styles.summaryStat}>
            <div className={styles.summaryLabel}>Checking</div>
            <div className={styles.summaryValue}>{fmtMoney(checkingTotal)}</div>
            <div className={styles.summaryHint}>cash traffic</div>
          </div>

          <div className={styles.summaryStat}>
            <div className={styles.summaryLabel}>Savings</div>
            <div className={styles.summaryValue}>{fmtMoney(savingsTotal)}</div>
            <div className={styles.summaryHint}>held aside</div>
          </div>

          <div className={styles.summaryStat}>
            <div className={styles.summaryLabel}>Selected</div>
            <div className={styles.summaryValue}>
              {selectedAccount ? fmtMoney(selectedAccount.balance) : "—"}
            </div>
            <div className={styles.summaryHint}>
              {selectedAccount?.name || "no account selected"}
            </div>
          </div>

          <div className={styles.summaryStat}>
            <div className={styles.summaryLabel}>Forecast 14D</div>
            <div className={styles.summaryValue}>
              {selectedSummary ? fmtMoney(selectedSummary.projected14) : "—"}
            </div>
            <div className={styles.summaryHint}>projected path</div>
          </div>
        </div>

        <div className={styles.summaryRight}>
          {selectedAccount ? (
            <MiniPill tone={selectedRisk?.chipTone || "blue"}>
              {selectedAccount.name}
            </MiniPill>
          ) : null}
          <MiniPill tone={selectedRisk?.chipTone || "blue"}>
            {selectedRisk?.label || "Stable"}
          </MiniPill>
          <MiniPill tone={atRiskCount > 0 ? "amber" : "green"}>
            {atRiskCount} at risk
          </MiniPill>
          <MiniPill tone="green">{fmtMoney(totalCash)} total cash</MiniPill>
        </div>
      </div>
    </GlassPane>
  );
}

function AccountQueueRow({ account, summary, selected, onSelect, isPrimary }) {
  const risk = riskMeta(summary);
  const tone = risk.chipTone || accountTone(account.account_type);
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
        {getAccountIcon(account.account_type)}
      </div>

      <div className={styles.queueMain}>
        <div className={styles.queueTop}>
          <div className={styles.queueName}>{account.name || "Account"}</div>
          <div className={styles.queueAmount}>{fmtMoney(account.balance)}</div>
        </div>

        <div className={styles.queueBottom}>
          <div className={styles.queueMeta}>
            <span>{normalizeAccountType(account.account_type)}</span>
            <span>•</span>
            <span
              style={{
                color: safeNum(summary?.last30Delta, 0) >= 0 ? "#97efc7" : "#ff646b",
              }}
            >
              {safeNum(summary?.last30Delta, 0) >= 0 ? "+" : ""}
              {fmtMoney(summary?.last30Delta)} 30D
            </span>
            <span>•</span>
            <span>{fmtMoney(summary?.projected14)} 14D</span>
          </div>

          <div className={styles.queueBadges}>
            {isPrimary ? <MiniPill tone="green">Primary</MiniPill> : null}
            {summary?.riskLevel === "warning" ? <MiniPill tone="amber">Watch</MiniPill> : null}
            {summary?.riskLevel === "critical" ? <MiniPill tone="red">Critical</MiniPill> : null}
          </div>
        </div>
      </div>

      <ChevronRight size={14} className={styles.queueChevron} />
    </button>
  );
}

export function QueuePane({
  visibleAccounts,
  summaryById,
  selectedAccount,
  onSelect,
  accountSearch,
  setAccountSearch,
  accountFilter,
  setAccountFilter,
  defaultAccountId,
}) {
  return (
    <GlassPane className={styles.queuePane}>
      <div className={styles.paneHeader}>
        <div>
          <div className={styles.paneTitle}>Account navigator</div>
          <div className={styles.paneSub}>Choose the account you want to command.</div>
        </div>
      </div>

      <div className={styles.queueToolbar}>
        <label className={styles.searchWrap}>
          <Search size={14} />
          <input
            className={styles.searchInput}
            value={accountSearch}
            onChange={(e) => setAccountSearch(e.target.value)}
            placeholder="Search accounts…"
          />
          {accountSearch ? (
            <button
              type="button"
              className={styles.searchClear}
              onClick={() => setAccountSearch("")}
              aria-label="Clear search"
            >
              <X size={12} />
            </button>
          ) : null}
        </label>

        <select
          className={styles.field}
          value={accountFilter}
          onChange={(e) => setAccountFilter(e.target.value)}
        >
          <option value="all">All accounts</option>
          <option value="checking">Checking</option>
          <option value="savings">Savings</option>
          <option value="credit">Credit</option>
          <option value="cash">Cash</option>
          <option value="at_risk">At risk</option>
        </select>
      </div>

      <div className={styles.queueList}>
        {visibleAccounts.length ? (
          visibleAccounts.map((account) => (
            <AccountQueueRow
              key={account.id}
              account={account}
              summary={summaryById[account.id]}
              selected={account.id === selectedAccount?.id}
              isPrimary={defaultAccountId === account.id}
              onSelect={() => onSelect(account.id)}
            />
          ))
        ) : (
          <div className={styles.paneEmpty}>No accounts found.</div>
        )}
      </div>
    </GlassPane>
  );
}

function BalanceBars({ bars = [] }) {
  if (!bars.length) {
    return <div className={styles.barsEmpty}>No recent balance movement yet.</div>;
  }

  return (
    <div className={styles.barWrap}>
      {bars.map((bar) => (
        <div
          key={bar.key}
          className={styles.barCol}
          title={`${bar.label} • ${fmtMoney(bar.value)}`}
        >
          <div className={styles.barFill} style={{ height: bar.height }} />
        </div>
      ))}
    </div>
  );
}

function TopMetric({ label, value, sub, tone = "neutral" }) {
  const toneClass =
    tone === "green"
      ? styles.valuePositive
      : tone === "amber"
      ? styles.valueWarning
      : tone === "red"
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
    <button
      type="button"
      className={cx(styles.tab, active && styles.tabActive)}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function FilterChip({ label, active, onClick }) {
  return (
    <button
      type="button"
      className={cx(styles.filterChip, active && styles.filterChipActive)}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function TransactionRowButton({ tx, onClick }) {
  const delta = safeNum(tx.delta, 0);
  const positive = delta >= 0;
  const bucket = flowBucket(tx);

  return (
    <button type="button" className={styles.rowButton} onClick={onClick}>
      <div className={cx(styles.dataRow, styles.clickableRow)}>
        <div className={styles.dataMain}>
          <div className={styles.dataTitle}>{tx.note || bucket}</div>
          <div className={styles.dataSub}>
            {shortDate(tx.created_at)} • {bucket} • {formatAgo(tx.created_at)}
            {tx.related_account_name ? ` • ${tx.related_account_name}` : ""}
          </div>
        </div>

        <div className={styles.dataRight}>
          <div
            className={styles.dataAmount}
            style={{ color: positive ? "#97efc7" : "#ff646b" }}
          >
            {positive ? "+" : ""}
            {fmtMoney(delta)}
          </div>
          <div className={styles.dataSub}>Bal {fmtMoney(tx.resulting_balance)}</div>
        </div>
      </div>
    </button>
  );
}

function ForecastEventRow({ event }) {
  const positive = event.kind === "income";

  return (
    <div className={styles.dataRow}>
      <div className={styles.dataMain}>
        <div className={styles.dataTitle}>{event.label}</div>
        <div className={styles.dataSub}>
          {shortDate(event.date)} • {positive ? "Incoming" : "Outgoing"}
        </div>
      </div>

      <div className={styles.dataRight}>
        <div
          className={styles.dataAmount}
          style={{ color: positive ? "#97efc7" : "#f5cf88" }}
        >
          {event.delta >= 0 ? "+" : ""}
          {fmtMoney(event.delta)}
        </div>
        <div
          className={styles.dataSub}
          style={{ color: safeNum(event.afterBalance, 0) < 0 ? "#ff646b" : undefined }}
        >
          After {fmtMoney(event.afterBalance)}
        </div>
      </div>
    </div>
  );
}

function QuickInfoRow({ label, value, tone = "neutral" }) {
  const color =
    tone === "green"
      ? "#97efc7"
      : tone === "amber"
      ? "#f5cf88"
      : tone === "red"
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

function FlowMixRow({ item, totalAbs }) {
  const amount = safeNum(item.total, 0);
  const width = `${Math.max((Math.abs(amount) / Math.max(totalAbs, 1)) * 100, 6)}%`;
  const positive = amount >= 0;

  return (
    <div className={styles.mixRow}>
      <div className={styles.mixLabel}>{item.label}</div>

      <div className={styles.mixBarTrack}>
        <div
          className={styles.mixBarFill}
          style={{
            width,
            background: positive
              ? "linear-gradient(90deg, rgba(116, 231, 174, 0.92), rgba(116, 231, 174, 0.28))"
              : "linear-gradient(90deg, rgba(255, 99, 107, 0.92), rgba(255, 99, 107, 0.24))",
          }}
        />
      </div>

      <div
        className={styles.mixAmount}
        style={{ color: positive ? "#97efc7" : "#ff646b" }}
      >
        {positive ? "+" : ""}
        {fmtMoney(amount)}
      </div>
    </div>
  );
}

function TransactionDetail({ tx }) {
  if (!tx) return null;

  const bucket = flowBucket(tx);
  const delta = safeNum(tx.delta, 0);
  const positive = delta >= 0;

  return (
    <div className={styles.detailModalGrid}>
      <div className={styles.detailModalCard}>
        <div className={styles.metricLabel}>Movement</div>
        <div
          className={styles.detailModalAmount}
          style={{ color: positive ? "#97efc7" : "#ff646b" }}
        >
          {positive ? "+" : ""}
          {fmtMoney(delta)}
        </div>
        <div className={styles.modalSub}>Signed delta posted to this account.</div>
      </div>

      <div className={styles.detailModalCard}>
        <div className={styles.metricLabel}>Bucket</div>
        <div className={styles.detailModalValue}>{bucket}</div>
        <div className={styles.modalSub}>How this movement is being grouped on the page.</div>
      </div>

      <div className={styles.detailInfoList}>
        <QuickInfoRow label="Date" value={shortDate(tx.created_at)} />
        <QuickInfoRow label="When" value={formatAgo(tx.created_at)} />
        <QuickInfoRow label="Kind" value={tx.kind || "—"} />
        <QuickInfoRow label="Source Type" value={tx.source_type || "—"} />
        <QuickInfoRow label="Amount Field" value={fmtMoney(tx.amount)} />
        <QuickInfoRow label="Resulting Balance" value={fmtMoney(tx.resulting_balance)} />
        <QuickInfoRow
          label="Linked Account"
          value={tx.related_account_name || "None"}
        />
        <QuickInfoRow label="Source ID" value={tx.source_id || "—"} />
      </div>

      <div className={styles.detailNoteCard}>
        <div className={styles.panelTitle}>Note</div>
        <div className={styles.detailNoteText}>{tx.note || "No note attached."}</div>
      </div>
    </div>
  );
}

export function FocusPane({
  selectedAccount,
  selectedSummary,
  selectedBars,
  tab,
  setTab,
  defaultAccountId,
  busy,
  onCreate,
  onSetPrimary,
  onAdjust,
  onTransfer,
}) {
  const [toolsOpen, setToolsOpen] = useState(false);
  const [activityFilter, setActivityFilter] = useState("all");
  const [selectedTx, setSelectedTx] = useState(null);

  useEffect(() => {
    setToolsOpen(false);
    setActivityFilter("all");
    setSelectedTx(null);
  }, [selectedAccount?.id]);

  const risk = riskMeta(selectedSummary);

  const flowMixTotal = useMemo(() => {
    if (!selectedSummary?.flowMix?.length) return 1;
    return Math.max(
      selectedSummary.flowMix.reduce(
        (sum, item) => sum + Math.abs(safeNum(item.total, 0)),
        0
      ),
      1
    );
  }, [selectedSummary]);

  const filteredTransactions = useMemo(() => {
    const rows = selectedSummary?.recentTransactions || [];
    if (activityFilter === "all") return rows;
    return rows.filter((tx) => bucketForFilter(tx) === activityFilter);
  }, [selectedSummary, activityFilter]);

  if (!selectedAccount || !selectedSummary) {
    return (
      <GlassPane className={styles.focusPane}>
        <div className={styles.focusEmpty}>Select an account.</div>
      </GlassPane>
    );
  }

  return (
    <>
      <GlassPane className={styles.focusPane}>
        <div className={styles.focusStack}>
          <div className={styles.focusHeader}>
            <div>
              <div className={styles.eyebrow}>Account command</div>
              <div className={styles.focusTitle}>{selectedAccount.name || "Account"}</div>
              <div className={styles.focusMeta}>
                {normalizeAccountType(selectedAccount.account_type)} • Updated{" "}
                {formatAgo(selectedAccount.updated_at)}
              </div>
            </div>

            <div className={styles.focusHeaderRight}>
              <div className={styles.focusBadges}>
                {defaultAccountId === selectedAccount.id ? (
                  <MiniPill tone="green">Primary</MiniPill>
                ) : null}
                <MiniPill tone={risk.chipTone}>{risk.label}</MiniPill>
              </div>

              <div className={styles.focusActionRow}>
                <Button onClick={onCreate} disabled={busy}>
                  <Plus size={14} />
                  New
                </Button>

                <Button onClick={onAdjust} disabled={busy}>
                  <Save size={14} />
                  Adjust
                </Button>

                <Button onClick={onTransfer} disabled={busy}>
                  <ArrowRightLeft size={14} />
                  Transfer
                </Button>

                <Button
                  variant={toolsOpen ? "primary" : "ghost"}
                  onClick={() => setToolsOpen(true)}
                >
                  <SlidersHorizontal size={14} />
                  Tools
                </Button>
              </div>
            </div>
          </div>

          <div className={styles.bankHero}>
            <div className={styles.bankHeroMain}>
              <div className={styles.balanceLabel}>Available balance</div>
              <div className={styles.balanceValue}>{fmtMoney(selectedAccount.balance)}</div>

              <div className={styles.balanceBadgeRow}>
                <MiniPill tone={safeNum(selectedSummary.last30Delta, 0) >= 0 ? "green" : "red"}>
                  {safeNum(selectedSummary.last30Delta, 0) >= 0 ? "+" : ""}
                  {fmtMoney(selectedSummary.last30Delta)} 30D
                </MiniPill>
                <MiniPill tone={risk.chipTone}>
                  {selectedSummary.projectedLowPoint < 0 ? "Pressure ahead" : "Healthy path"}
                </MiniPill>
              </div>

              <div className={styles.workspaceCopy}>
                This account view answers what is here now, what changed it, what hits next, and
                whether it stays safe.
              </div>
            </div>

            <div className={styles.bankHeroTrend}>
              <div className={styles.trendHeader}>
                <div>
                  <div className={styles.balanceLabel}>Balance trend</div>
                  <div className={styles.trendTitle}>Last 14 days</div>
                </div>
                <MiniPill tone="blue">live</MiniPill>
              </div>
              <BalanceBars bars={selectedBars} />
            </div>
          </div>

          <div className={styles.metricGrid}>
            <TopMetric
              label="Forecast 14D"
              value={fmtMoney(selectedSummary.projected14)}
              sub="Two-week forward balance"
              tone={
                selectedSummary.projected14 < 0
                  ? "red"
                  : selectedSummary.projected14 < selectedSummary.safeBuffer
                  ? "amber"
                  : "green"
              }
            />

            <TopMetric
              label="Safe Buffer"
              value={fmtMoney(selectedSummary.safeBuffer)}
              sub="Local warning line"
            />

            <TopMetric
              label="Next Debit"
              value={selectedSummary.nextBill ? shortDate(selectedSummary.nextBill.due_date) : "Clear"}
              sub={
                selectedSummary.nextBill
                  ? `${billTitle(selectedSummary.nextBill)} • ${fmtMoney(
                      amountFromBill(selectedSummary.nextBill)
                    )}`
                  : "No linked outgoing bill"
              }
              tone={selectedSummary.nextBill ? "amber" : "neutral"}
            />

            <TopMetric
              label="Next Credit"
              value={
                selectedSummary.nextIncome
                  ? shortDate(selectedSummary.nextIncome.deposit_date)
                  : "None"
              }
              sub={
                selectedSummary.nextIncome
                  ? `${selectedSummary.nextIncome.source} • ${fmtMoney(
                      selectedSummary.nextIncome.amount
                    )}`
                  : "No scheduled incoming deposit"
              }
              tone={selectedSummary.nextIncome ? "green" : "neutral"}
            />
          </div>

          <div className={styles.tabsRow}>
            <TabBtn
              label="Transactions"
              active={tab === "transactions"}
              onClick={() => setTab("transactions")}
            />
            <TabBtn label="Cash Story" active={tab === "story"} onClick={() => setTab("story")} />
            <TabBtn label="Linked Flow" active={tab === "recurring"} onClick={() => setTab("recurring")} />
            <TabBtn label="Forecast" active={tab === "forecast"} onClick={() => setTab("forecast")} />
          </div>

          <div className={styles.tabStage}>
            {tab === "transactions" ? (
              <div className={styles.splitLayoutFill}>
                <div className={`${styles.panel} ${styles.panelFill}`}>
                  <div className={styles.panelHeader}>
                    <div>
                      <div className={styles.panelTitle}>Recent activity</div>
                      <div className={styles.panelSub}>What actually hit this account.</div>
                    </div>
                    <MiniPill tone="neutral">{filteredTransactions.length} rows</MiniPill>
                  </div>

                  <div className={styles.filterRow}>
                    <FilterChip
                      label="All"
                      active={activityFilter === "all"}
                      onClick={() => setActivityFilter("all")}
                    />
                    <FilterChip
                      label="Income"
                      active={activityFilter === "income"}
                      onClick={() => setActivityFilter("income")}
                    />
                    <FilterChip
                      label="Bills"
                      active={activityFilter === "bills"}
                      onClick={() => setActivityFilter("bills")}
                    />
                    <FilterChip
                      label="Spending"
                      active={activityFilter === "spending"}
                      onClick={() => setActivityFilter("spending")}
                    />
                    <FilterChip
                      label="Transfers"
                      active={activityFilter === "transfers"}
                      onClick={() => setActivityFilter("transfers")}
                    />
                    <FilterChip
                      label="Adjustments"
                      active={activityFilter === "adjustments"}
                      onClick={() => setActivityFilter("adjustments")}
                    />
                  </div>

                  {filteredTransactions.length ? (
                    <div className={`${styles.dataList} ${styles.scrollRegion}`}>
                      {filteredTransactions.map((tx) => (
                        <TransactionRowButton
                          key={tx.id}
                          tx={tx}
                          onClick={() => setSelectedTx(tx)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className={styles.paneEmpty}>No matching activity for this filter.</div>
                  )}
                </div>

                <div className={styles.asideStackFill}>
                  <div className={`${styles.panel} ${styles.panelFill}`}>
                    <div className={styles.panelHeader}>
                      <div>
                        <div className={styles.panelTitle}>Cash story</div>
                        <div className={styles.panelSub}>Why the balance is here right now.</div>
                      </div>
                    </div>

                    <div className={styles.infoList}>
                      <QuickInfoRow label="Start of month" value={fmtMoney(selectedSummary.startBalance)} />
                      <QuickInfoRow label="Income added" value={`+${fmtMoney(selectedSummary.monthIncome)}`} tone="green" />
                      <QuickInfoRow label="Bills paid" value={`-${fmtMoney(selectedSummary.monthBills)}`} tone="amber" />
                      <QuickInfoRow label="Spending" value={`-${fmtMoney(selectedSummary.monthSpending)}`} tone="red" />
                      <QuickInfoRow
                        label="Transfers"
                        value={`${safeNum(selectedSummary.monthTransfersNet, 0) >= 0 ? "+" : ""}${fmtMoney(
                          selectedSummary.monthTransfersNet
                        )}`}
                        tone={safeNum(selectedSummary.monthTransfersNet, 0) >= 0 ? "green" : "red"}
                      />
                      <QuickInfoRow label="Current balance" value={fmtMoney(selectedAccount.balance)} />
                    </div>
                  </div>

                  <div className={`${styles.panel} ${styles.panelFillCompact}`}>
                    <div className={styles.panelHeader}>
                      <div>
                        <div className={styles.panelTitle}>Next movement</div>
                        <div className={styles.panelSub}>What is most likely to hit this account next.</div>
                      </div>
                    </div>

                    <div className={styles.infoList}>
                      <QuickInfoRow
                        label="Next credit"
                        value={
                          selectedSummary.nextIncome
                            ? `${selectedSummary.nextIncome.source} • ${shortDate(
                                selectedSummary.nextIncome.deposit_date
                              )}`
                            : "None scheduled"
                        }
                        tone={selectedSummary.nextIncome ? "green" : "neutral"}
                      />
                      <QuickInfoRow
                        label="Next debit"
                        value={
                          selectedSummary.nextBill
                            ? `${billTitle(selectedSummary.nextBill)} • ${shortDate(
                                selectedSummary.nextBill.due_date
                              )}`
                            : "Clear"
                        }
                        tone={selectedSummary.nextBill ? "amber" : "green"}
                      />
                      <QuickInfoRow
                        label="Projected low point"
                        value={fmtMoney(selectedSummary.projectedLowPoint)}
                        tone={selectedSummary.projectedLowPoint < 0 ? "red" : "amber"}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {tab === "story" ? (
              <div className={styles.splitLayoutFill}>
                <div className={`${styles.panel} ${styles.panelFill}`}>
                  <div className={styles.panelHeader}>
                    <div>
                      <div className={styles.panelTitle}>Cash story</div>
                      <div className={styles.panelSub}>Why the balance looks the way it does.</div>
                    </div>
                    <MiniPill tone="green">month to date</MiniPill>
                  </div>

                  <div className={styles.storyGrid}>
                    <div className={styles.storyCard}>
                      <div className={styles.balanceLabel}>Start</div>
                      <div className={styles.storyValue}>{fmtMoney(selectedSummary.startBalance)}</div>
                      <div className={styles.storySub}>Opening month balance.</div>
                    </div>

                    <div className={styles.storyCard}>
                      <div className={styles.balanceLabel}>Current</div>
                      <div className={styles.storyValue}>{fmtMoney(selectedAccount.balance)}</div>
                      <div className={styles.storySub}>Where the account stands now.</div>
                    </div>

                    <div className={`${styles.storyCard} ${styles.storyCardGreen}`}>
                      <div className={styles.balanceLabel}>Income</div>
                      <div className={`${styles.storyValue} ${styles.valuePositive}`}>
                        +{fmtMoney(selectedSummary.monthIncome)}
                      </div>
                      <div className={styles.storySub}>Deposits and positive flow.</div>
                    </div>

                    <div className={`${styles.storyCard} ${styles.storyCardAmber}`}>
                      <div className={styles.balanceLabel}>Bills</div>
                      <div className={`${styles.storyValue} ${styles.valueWarning}`}>
                        -{fmtMoney(selectedSummary.monthBills)}
                      </div>
                      <div className={styles.storySub}>Bill traffic through the ledger.</div>
                    </div>

                    <div className={`${styles.storyCard} ${styles.storyCardRed}`}>
                      <div className={styles.balanceLabel}>Spending</div>
                      <div className={`${styles.storyValue} ${styles.valueNegative}`}>
                        -{fmtMoney(selectedSummary.monthSpending)}
                      </div>
                      <div className={styles.storySub}>Card / cash / manual outflow.</div>
                    </div>

                    <div className={styles.storyCard}>
                      <div className={styles.balanceLabel}>Transfers</div>
                      <div className={styles.storyValue}>
                        {safeNum(selectedSummary.monthTransfersNet, 0) >= 0 ? "+" : ""}
                        {fmtMoney(selectedSummary.monthTransfersNet)}
                      </div>
                      <div className={styles.storySub}>Net moved in or out.</div>
                    </div>
                  </div>
                </div>

                <div className={`${styles.panel} ${styles.panelFill}`}>
                  <div className={styles.panelHeader}>
                    <div>
                      <div className={styles.panelTitle}>Flow mix</div>
                      <div className={styles.panelSub}>What dominated this account’s movement this month.</div>
                    </div>
                  </div>

                  {selectedSummary.flowMix.length ? (
                    <div className={`${styles.flowMixGrid} ${styles.scrollRegion}`}>
                      {selectedSummary.flowMix.map((item) => (
                        <FlowMixRow key={item.label} item={item} totalAbs={flowMixTotal} />
                      ))}
                    </div>
                  ) : (
                    <div className={styles.paneEmpty}>No flow mix data yet.</div>
                  )}
                </div>
              </div>
            ) : null}

            {tab === "recurring" ? (
              <div className={styles.splitLayoutFill}>
                <div className={`${styles.panel} ${styles.panelFill}`}>
                  <div className={styles.panelHeader}>
                    <div>
                      <div className={styles.panelTitle}>Scheduled income</div>
                      <div className={styles.panelSub}>Deposits still expected to land here.</div>
                    </div>
                    <MiniPill tone="green">{selectedSummary.scheduledDeposits.length} items</MiniPill>
                  </div>

                  {selectedSummary.scheduledDeposits.length ? (
                    <div className={`${styles.dataList} ${styles.scrollRegion}`}>
                      {selectedSummary.scheduledDeposits.map((row) => (
                        <div key={row.id} className={styles.dataRow}>
                          <div className={styles.dataMain}>
                            <div className={styles.dataTitle}>{row.source}</div>
                            <div className={styles.dataSub}>
                              {shortDate(row.deposit_date)} • Scheduled income
                            </div>
                          </div>
                          <div className={styles.dataAmount} style={{ color: "#97efc7" }}>
                            +{fmtMoney(row.amount)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.paneEmpty}>No scheduled income linked here.</div>
                  )}
                </div>

                <div className={`${styles.panel} ${styles.panelFill}`}>
                  <div className={styles.panelHeader}>
                    <div>
                      <div className={styles.panelTitle}>Upcoming debits</div>
                      <div className={styles.panelSub}>Outgoing pressure assigned to this account.</div>
                    </div>
                    <MiniPill tone="amber">{selectedSummary.upcomingBills.length} items</MiniPill>
                  </div>

                  {selectedSummary.upcomingBills.length ? (
                    <div className={`${styles.dataList} ${styles.scrollRegion}`}>
                      {selectedSummary.upcomingBills.map((bill) => (
                        <div key={bill.id} className={styles.dataRow}>
                          <div className={styles.dataMain}>
                            <div className={styles.dataTitle}>{billTitle(bill)}</div>
                            <div className={styles.dataSub}>
                              {shortDate(bill.due_date)} •{" "}
                              {String(bill.frequency || "monthly").replaceAll("_", " ")}
                            </div>
                          </div>
                          <div className={styles.dataAmount} style={{ color: "#f5cf88" }}>
                            -{fmtMoney(amountFromBill(bill))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.paneEmpty}>No linked recurring outgoing items.</div>
                  )}
                </div>
              </div>
            ) : null}

            {tab === "forecast" ? (
              <div className={styles.singlePanelFill}>
                <div className={`${styles.panel} ${styles.panelFill}`}>
                  <div className={styles.panelHeader}>
                    <div>
                      <div className={styles.panelTitle}>30 day forecast</div>
                      <div className={styles.panelSub}>
                        Projected sequence from current balance, scheduled income, and linked bills.
                      </div>
                    </div>

                    <MiniPill
                      tone={
                        selectedSummary.projectedLowPoint < 0
                          ? "red"
                          : selectedSummary.projectedLowPoint < selectedSummary.safeBuffer
                          ? "amber"
                          : "green"
                      }
                    >
                      Low {fmtMoney(selectedSummary.projectedLowPoint)}
                    </MiniPill>
                  </div>

                  {selectedSummary.projectionEvents.length ? (
                    <div className={`${styles.dataList} ${styles.scrollRegion}`}>
                      {selectedSummary.projectionEvents.slice(0, 28).map((event) => (
                        <ForecastEventRow key={event.id} event={event} />
                      ))}
                    </div>
                  ) : (
                    <div className={styles.paneEmpty}>
                      No forecast movement detected in the next 30 days.
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {toolsOpen ? (
          <div className={styles.commandDrawerWrap}>
            <button
              type="button"
              className={styles.commandDrawerBackdrop}
              onClick={() => setToolsOpen(false)}
              aria-label="Close drawer"
            />
            <aside className={styles.commandDrawer}>
              <div className={styles.drawerHeader}>
                <div>
                  <div className={styles.panelTitle}>Account tools</div>
                  <div className={styles.panelSub}>
                    Secondary controls and deeper account context.
                  </div>
                </div>

                <button
                  type="button"
                  className={styles.closeButton}
                  onClick={() => setToolsOpen(false)}
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>

              <div className={styles.drawerBody}>
                <div className={styles.detailCardFill}>
                  <div className={styles.panelHeader}>
                    <div>
                      <div className={styles.panelTitle}>Snapshot</div>
                      <div className={styles.panelSub}>Fast read for this account.</div>
                    </div>
                    <MiniPill tone={risk.chipTone}>{risk.label}</MiniPill>
                  </div>

                  <div className={styles.infoList}>
                    <QuickInfoRow label="Balance" value={fmtMoney(selectedAccount.balance)} />
                    <QuickInfoRow label="Safe Buffer" value={fmtMoney(selectedSummary.safeBuffer)} />
                    <QuickInfoRow
                      label="Forecast 14D"
                      value={fmtMoney(selectedSummary.projected14)}
                      tone={
                        selectedSummary.projected14 < 0
                          ? "red"
                          : selectedSummary.projected14 < selectedSummary.safeBuffer
                          ? "amber"
                          : "green"
                      }
                    />
                    <QuickInfoRow
                      label="Month End"
                      value={fmtMoney(selectedSummary.projectedMonthEnd)}
                      tone={
                        selectedSummary.projectedMonthEnd < 0
                          ? "red"
                          : selectedSummary.projectedMonthEnd < selectedSummary.safeBuffer
                          ? "amber"
                          : "green"
                      }
                    />
                    <QuickInfoRow
                      label="Low Point"
                      value={fmtMoney(selectedSummary.projectedLowPoint)}
                      tone={selectedSummary.projectedLowPoint < 0 ? "red" : "amber"}
                    />
                  </div>

                  <div className={styles.detailActions}>
                    <Button
                      variant="ghost"
                      onClick={onSetPrimary}
                      disabled={busy || defaultAccountId === selectedAccount.id}
                    >
                      <Sparkles size={14} />
                      Make Primary
                    </Button>
                  </div>
                </div>

                <div className={styles.detailCardFill}>
                  <div className={styles.panelHeader}>
                    <div>
                      <div className={styles.panelTitle}>Linked flow notes</div>
                      <div className={styles.panelSub}>What is routed in and out.</div>
                    </div>
                  </div>

                  <div className={styles.infoList}>
                    <QuickInfoRow
                      label="Scheduled deposits"
                      value={String(selectedSummary.scheduledDeposits.length)}
                      tone="green"
                    />
                    <QuickInfoRow
                      label="Upcoming debits"
                      value={String(selectedSummary.upcomingBills.length)}
                      tone="amber"
                    />
                    <QuickInfoRow
                      label="Next credit"
                      value={
                        selectedSummary.nextIncome
                          ? shortDate(selectedSummary.nextIncome.deposit_date)
                          : "None"
                      }
                      tone={selectedSummary.nextIncome ? "green" : "neutral"}
                    />
                    <QuickInfoRow
                      label="Next debit"
                      value={
                        selectedSummary.nextBill
                          ? shortDate(selectedSummary.nextBill.due_date)
                          : "Clear"
                      }
                      tone={selectedSummary.nextBill ? "amber" : "green"}
                    />
                  </div>
                </div>

                <div className={styles.detailCardFill}>
                  <div className={styles.panelHeader}>
                    <div>
                      <div className={styles.panelTitle}>Connection readiness</div>
                      <div className={styles.panelSub}>Manual now, connected later.</div>
                    </div>
                    <MiniPill tone="blue">sync-ready</MiniPill>
                  </div>

                  <div className={styles.ruleList}>
                    <div className={styles.ruleRow}>
                      <ShieldAlert size={13} />
                      <div className={styles.ruleCopy}>
                        Shared ledger writes already centralize balance changes.
                      </div>
                    </div>

                    <div className={styles.ruleRow}>
                      <ShieldAlert size={13} />
                      <div className={styles.ruleCopy}>
                        Source tracing is already in place for future imported transactions.
                      </div>
                    </div>

                    <div className={styles.ruleRow}>
                      <ShieldAlert size={13} />
                      <div className={styles.ruleCopy}>
                        Connected, syncing, failed, and review states can layer on later without ripping this page apart.
                      </div>
                    </div>

                    <div className={styles.ruleRow}>
                      <ShieldAlert size={13} />
                      <div className={styles.ruleCopy}>
                        Manual entry remains the fallback, not the forever workflow.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        ) : null}
      </GlassPane>

      <ModalShell
        open={!!selectedTx}
        title="Transaction detail"
        subcopy="Deeper view of the selected account movement."
        onClose={() => setSelectedTx(null)}
        footer={<Button onClick={() => setSelectedTx(null)}>Close</Button>}
      >
        <TransactionDetail tx={selectedTx} />
      </ModalShell>
    </>
  );
}
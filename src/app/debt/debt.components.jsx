"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Copy,
  Info,
  Link2,
  PencilLine,
  Plus,
  Receipt,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  TrendingDown,
  X,
  Zap,
} from "lucide-react";
import GlassPane from "../components/GlassPane";
import styles from "./DebtPage.module.css";
import {
  FREQS,
  STRATEGY_OPTIONS,
  accountTypeLabel,
  amortize,
  dueText,
  money,
  moneyTight,
  monthlyInterest,
  monthlyMinimumPayment,
  monthlyScheduledPayment,
  payoffLabel,
  safeNum,
  shortDate,
  strategySubtitle,
  toneMeta,
} from "./debt.helpers";

function cx(...names) {
  return names.filter(Boolean).join(" ");
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

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };

    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previous;
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

function SectionTitle({ title, sub }) {
  return (
    <div>
      <div className={styles.panelTitle}>{title}</div>
      {sub ? <div className={styles.panelSub}>{sub}</div> : null}
    </div>
  );
}

export function SummaryStrip({
  metrics,
  targetDebt,
  selectedDebt,
  selectedSummary,
}) {
  return (
    <GlassPane className={styles.summaryStrip}>
      <div className={styles.summaryInner}>
        <div className={styles.titleBlock}>
          <div className={styles.eyebrow}>Money / Debt</div>

          <div className={styles.pageTitleRow}>
            <div className={styles.pageTitle}>Debt</div>
            <MiniPill tone="green">command</MiniPill>
          </div>

          <div className={styles.workspaceCopy}>
            The one workspace for payoff pressure, linked bill flow, and debt attack order.
          </div>
        </div>

        <div className={styles.summaryStats}>
          <div className={styles.summaryStat}>
            <div className={styles.summaryLabel}>Active</div>
            <div className={styles.summaryValue}>{metrics.activeCount}</div>
            <div className={styles.summaryHint}>tracked profiles</div>
          </div>

          <div className={styles.summaryStat}>
            <div className={styles.summaryLabel}>Balance</div>
            <div className={styles.summaryValue}>{money(metrics.totalBalance)}</div>
            <div className={styles.summaryHint}>active debt load</div>
          </div>

          <div className={styles.summaryStat}>
            <div className={styles.summaryLabel}>Monthly Plan</div>
            <div className={styles.summaryValue}>{money(metrics.totalPlan)}</div>
            <div className={styles.summaryHint}>minimum + extra</div>
          </div>

          <div className={styles.summaryStat}>
            <div className={styles.summaryLabel}>Paid This Month</div>
            <div className={styles.summaryValue}>{money(metrics.paidThisMonth)}</div>
            <div className={styles.summaryHint}>synced from bills</div>
          </div>

          <div className={styles.summaryStat}>
            <div className={styles.summaryLabel}>Selected</div>
            <div className={styles.summaryValue}>
              {selectedDebt ? money(selectedDebt.balance) : "—"}
            </div>
            <div className={styles.summaryHint}>
              {selectedDebt?.name || "no debt selected"}
            </div>
          </div>
        </div>

        <div className={styles.summaryRight}>
          {targetDebt ? <MiniPill tone="blue">{targetDebt.name}</MiniPill> : null}
          <MiniPill tone={metrics.overdueCount > 0 ? "red" : "green"}>
            {metrics.overdueCount} overdue
          </MiniPill>
          <MiniPill tone={metrics.highAprCount > 0 ? "amber" : "green"}>
            {metrics.highAprCount} high APR
          </MiniPill>
          <MiniPill tone="amber">{moneyTight(metrics.monthlyBleed)} / mo interest</MiniPill>
          {selectedSummary?.underwater ? <MiniPill tone="red">plan too low</MiniPill> : null}
        </div>
      </div>
    </GlassPane>
  );
}

function DebtQueueRow({ debt, summary, selected, rank, target, onSelect }) {
  const tone = summary?.status?.tone || "blue";
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

      <div className={styles.queueMain}>
        <div className={styles.queueTop}>
          <div className={styles.queueNameWrap}>
            <span className={styles.queueRank}>#{rank}</span>
            <div className={styles.queueName}>{debt.name}</div>
          </div>
          <div className={styles.queueAmount}>{money(debt.balance)}</div>
        </div>

        <div className={styles.queueMeta}>
          <span>{debt.category || "Uncategorized"}</span>
          <span>•</span>
          <span style={{ color: meta.text }}>{summary?.status?.label || "No date"}</span>
          <span>•</span>
          <span>{safeNum(debt.aprPct)}% APR</span>
        </div>

        <div className={styles.queueBottom}>
          <div className={styles.queueHint}>
            {moneyTight(summary?.monthlyPlan)} / mo • {summary?.payoffBase}
          </div>

          <div className={styles.queueBadges}>
            {target ? <MiniPill tone="blue">Target</MiniPill> : null}
            {summary?.riskLevel === "critical" ? <MiniPill tone="red">Critical</MiniPill> : null}
            {summary?.riskLevel === "warning" ? <MiniPill tone="amber">Watch</MiniPill> : null}
            {debt.autopay ? <MiniPill tone="green">Auto</MiniPill> : null}
          </div>
        </div>
      </div>

      <ChevronRight size={14} className={styles.queueChevron} />
    </button>
  );
}

export function QueuePane({
  visibleDebts,
  summaryById,
  selectedDebt,
  onSelect,
  search,
  setSearch,
  scope,
  setScope,
  strategy,
  setStrategy,
  targetDebtId,
}) {
  return (
    <GlassPane className={styles.queuePane}>
      <div className={styles.paneHeader}>
        <SectionTitle
          title="Debt navigator"
          sub="Choose the debt you want to command."
        />
      </div>

      <div className={styles.queueToolbar}>
        <label className={styles.searchWrap}>
          <Search size={14} />
          <input
            className={styles.searchInput}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search debt…"
          />
          {search ? (
            <button
              type="button"
              className={styles.searchClear}
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              <X size={12} />
            </button>
          ) : null}
        </label>

        <div className={styles.scopeRow}>
          {["active", "all", "inactive"].map((item) => (
            <button
              key={item}
              type="button"
              className={cx(styles.scopeTab, scope === item && styles.scopeTabActive)}
              onClick={() => setScope(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <select
          className={styles.field}
          value={strategy}
          onChange={(event) => setStrategy(event.target.value)}
        >
          {STRATEGY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.queueList}>
        {visibleDebts.length ? (
          visibleDebts.map((debt, index) => (
            <DebtQueueRow
              key={debt.id}
              debt={debt}
              summary={summaryById[debt.id]}
              rank={index + 1}
              selected={debt.id === selectedDebt?.id}
              target={targetDebtId === debt.id}
              onSelect={() => onSelect(debt.id)}
            />
          ))
        ) : (
          <div className={styles.paneEmpty}>No debt profiles found.</div>
        )}
      </div>
    </GlassPane>
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

function LinkedBillRow({ bill }) {
  return (
    <div className={styles.dataRow}>
      <div className={styles.dataMain}>
        <div className={styles.dataTitle}>{bill.name}</div>
        <div className={styles.dataSub}>
          {bill.category || "No category"} • {shortDate(bill.dueDate)}
        </div>
      </div>

      <div className={styles.dataRight}>
        <div className={styles.dataAmount}>{money(bill.amount)}</div>
        <div className={styles.dataSub}>{bill.frequency || "monthly"}</div>
      </div>
    </div>
  );
}

function PaymentRow({ payment, accountNameById, selectedDebtId }) {
  const sourceLabel = payment.billId === selectedDebtId ? "Debt legacy" : "From bill";

  return (
    <div className={styles.dataRow}>
      <div className={styles.dataMain}>
        <div className={styles.dataTitle}>{moneyTight(payment.amount)}</div>
        <div className={styles.dataSub}>
          {shortDate(payment.paymentDate)} • {accountNameById.get(payment.accountId) || "No account"}
        </div>
      </div>

      <div className={styles.dataRight}>
        <div className={styles.dataAmount}>{sourceLabel}</div>
        <div className={styles.dataSub}>{payment.note || "No note"}</div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, tone = "neutral" }) {
  const toneClass =
    tone === "green"
      ? styles.valuePositive
      : tone === "amber"
      ? styles.valueWarning
      : tone === "red"
      ? styles.valueNegative
      : "";

  return (
    <div className={styles.infoRow}>
      <span>{label}</span>
      <strong className={toneClass}>{value}</strong>
    </div>
  );
}

function QuickToolsDrawer({
  open,
  onClose,
  selectedDebt,
  selectedSummary,
  metrics,
  alerts,
  strategy,
  onSetStrategy,
  onOpenBills,
}) {
  useEffect(() => {
    if (!open) return;

    const onKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !selectedDebt || !selectedSummary) return null;

  return (
    <div className={styles.commandDrawerWrap}>
      <button
        type="button"
        className={styles.commandDrawerBackdrop}
        onClick={onClose}
        aria-label="Close drawer"
      />
      <aside className={styles.commandDrawer}>
        <div className={styles.drawerHeader}>
          <SectionTitle
            title="Debt tools"
            sub="Secondary controls and deeper debt context."
          />

          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className={styles.drawerBody}>
          <div className={styles.detailCardFill}>
            <div className={styles.panelHeader}>
              <SectionTitle title="Snapshot" sub="Fast read for the selected debt." />
              <MiniPill tone={selectedSummary.status.tone}>{selectedSummary.status.label}</MiniPill>
            </div>

            <div className={styles.infoList}>
              <InfoRow label="Balance" value={money(selectedDebt.balance)} />
              <InfoRow label="Monthly plan" value={moneyTight(selectedSummary.monthlyPlan)} />
              <InfoRow
                label="Interest / mo"
                value={moneyTight(selectedSummary.monthlyBleed)}
                tone="amber"
              />
              <InfoRow
                label="Payoff est."
                value={selectedSummary.payoffBase}
                tone={selectedSummary.underwater ? "red" : "green"}
              />
              <InfoRow
                label="Linked bills"
                value={String(selectedSummary.linkedBillsCount)}
                tone="blue"
              />
            </div>
          </div>

          <div className={styles.detailCardFill}>
            <div className={styles.panelHeader}>
              <SectionTitle title="Attack order" sub={strategySubtitle(strategy)} />
              <MiniPill tone="blue">{STRATEGY_OPTIONS.find((item) => item.value === strategy)?.label}</MiniPill>
            </div>

            <div className={styles.ruleList}>
              {STRATEGY_OPTIONS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={cx(styles.strategyButton, strategy === item.value && styles.strategyButtonActive)}
                  onClick={() => onSetStrategy(item.value)}
                >
                  <Sparkles size={13} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.detailCardFill}>
            <div className={styles.panelHeader}>
              <SectionTitle title="Pressure scan" sub="What needs attention across the stack." />
            </div>

            <div className={styles.infoList}>
              <InfoRow label="Total overdue" value={String(metrics.overdueCount)} tone={metrics.overdueCount ? "red" : "green"} />
              <InfoRow label="High APR" value={String(metrics.highAprCount)} tone={metrics.highAprCount ? "amber" : "green"} />
              <InfoRow label="Underwater plans" value={String(alerts.lowPayment.length)} tone={alerts.lowPayment.length ? "red" : "green"} />
            </div>
          </div>

          <div className={styles.detailCardFill}>
            <div className={styles.panelHeader}>
              <SectionTitle title="Ownership" sub="Where money-posting responsibility lives." />
            </div>

            <div className={styles.ruleList}>
              <div className={styles.ruleRow}>
                <ShieldAlert size={13} />
                <div className={styles.ruleCopy}>
                  Bills owns live payment posting and account ledger movement.
                </div>
              </div>

              <div className={styles.ruleRow}>
                <ShieldAlert size={13} />
                <div className={styles.ruleCopy}>
                  Debt reads synced bill-payment history and legacy debt-only rows.
                </div>
              </div>

              <div className={styles.ruleRow}>
                <ShieldAlert size={13} />
                <div className={styles.ruleCopy}>
                  Linked bills are the bridge between payoff tracking and real-world money flow.
                </div>
              </div>

              <div className={styles.detailActions}>
                <Button onClick={onOpenBills}>
                  <Link2 size={14} />
                  Open Bills
                </Button>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

export function FocusPane({
  selectedDebt,
  selectedSummary,
  summaryById,
  accounts,
  metrics,
  alerts,
  tab,
  setTab,
  strategy,
  setStrategy,
  simBoost,
  setSimBoost,
  targetDebtId,
  busy,
  onCreate,
  onEdit,
  onDuplicate,
  onToggle,
  onDelete,
  onOpenBills,
}) {
  const [toolsOpen, setToolsOpen] = useState(false);

  useEffect(() => {
    setToolsOpen(false);
  }, [selectedDebt?.id]);

  const accountNameById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account.name])),
    [accounts]
  );

  if (!selectedDebt || !selectedSummary) {
    return (
      <GlassPane className={styles.focusPane}>
        <div className={styles.focusEmpty}>Select a debt profile.</div>
      </GlassPane>
    );
  }

  const linkedAccount = accounts.find((account) => account.id === selectedDebt.accountId) || null;
  const dueDays = useMemo(() => {
    return selectedSummary?.status ? null : null;
  }, [selectedSummary]);

  const attackExtra = Math.max(0, safeNum(simBoost, 0));
  const simulatedPayment = selectedSummary.monthlyPlan + attackExtra;
  const currentPlan = amortize(
    selectedDebt.balance,
    selectedDebt.aprPct,
    selectedSummary.monthlyPlan
  );
  const boostedPlan = amortize(selectedDebt.balance, selectedDebt.aprPct, simulatedPayment);
  const monthsSaved =
    currentPlan.months !== Infinity && boostedPlan.months !== Infinity
      ? Math.max(0, currentPlan.months - boostedPlan.months)
      : 0;
  const interestSaved =
    currentPlan.totalInterest !== Infinity && boostedPlan.totalInterest !== Infinity
      ? Math.max(0, currentPlan.totalInterest - boostedPlan.totalInterest)
      : 0;

  return (
    <>
      <GlassPane className={styles.focusPane}>
        <div className={styles.focusStack}>
          <div className={styles.focusHeader}>
            <div>
              <div className={styles.eyebrow}>Debt command</div>
              <div className={styles.focusTitle}>{selectedDebt.name}</div>
              <div className={styles.focusMeta}>
                {selectedDebt.category || "No category"} • Updated {shortDate(selectedDebt.updatedAt)}
              </div>
            </div>

            <div className={styles.focusHeaderRight}>
              <div className={styles.focusBadges}>
                {targetDebtId === selectedDebt.id ? <MiniPill tone="blue">Target</MiniPill> : null}
                <MiniPill tone={selectedSummary.status.tone}>{selectedSummary.status.label}</MiniPill>
              </div>

              <div className={styles.focusActionRow}>
                <Button onClick={onCreate} disabled={busy}>
                  <Plus size={14} />
                  New
                </Button>

                <Button onClick={onEdit} disabled={busy}>
                  <PencilLine size={14} />
                  Edit
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

          <div className={styles.heroShell}>
            <div className={styles.hero}>
              <div className={styles.heroTop}>
                <div>
                  <div className={styles.heroLabel}>Current balance</div>
                  <div className={styles.heroValue}>{money(selectedDebt.balance)}</div>
                </div>

                <div className={styles.heroBadges}>
                  <MiniPill tone={selectedSummary.status.tone}>{selectedSummary.status.label}</MiniPill>
                  <MiniPill tone={selectedDebt.autopay ? "green" : "neutral"}>
                    {selectedDebt.autopay ? "Auto flag" : "Manual"}
                  </MiniPill>
                </div>
              </div>

              <div className={styles.heroCopy}>
                This debt view answers what is owed, what it costs monthly, what bills feed it,
                and how fast it can be attacked.
              </div>
            </div>

            <div className={styles.heroAside}>
              <div className={styles.panelHeader}>
                <SectionTitle title="Cycle pulse" sub="Current payment cycle status." />
                <MiniPill tone={selectedSummary.status.tone}>{selectedSummary.status.label}</MiniPill>
              </div>

              <div className={styles.infoList}>
                <InfoRow label="Due" value={shortDate(selectedDebt.dueDate)} />
                <InfoRow
                  label="Status"
                  value={selectedSummary.status.label}
                  tone={selectedSummary.status.tone}
                />
                <InfoRow label="Pay from" value={selectedSummary.linkedAccountName} />
                <InfoRow label="Last paid" value={shortDate(selectedDebt.lastPaidDate)} tone="green" />
              </div>
            </div>
          </div>

          <div className={styles.metricGrid}>
            <TopMetric
              label="Monthly plan"
              value={money(selectedSummary.monthlyPlan)}
              sub="Minimum plus recurring extra"
              tone="amber"
            />
            <TopMetric
              label="Interest / month"
              value={moneyTight(selectedSummary.monthlyBleed)}
              sub="Carrying cost at current balance"
              tone={selectedSummary.monthlyBleed > 0 ? "red" : "green"}
            />
            <TopMetric
              label="Linked bills"
              value={String(selectedSummary.linkedBillsCount)}
              sub="Real bill traffic pointed at this debt"
              tone={selectedSummary.linkedBillsCount ? "blue" : "neutral"}
            />
            <TopMetric
              label="Payoff est."
              value={selectedSummary.payoffBase}
              sub={
                selectedSummary.underwater
                  ? "Current plan is not beating interest"
                  : "Current recurring plan"
              }
              tone={selectedSummary.underwater ? "red" : "green"}
            />
          </div>

          <div className={styles.tabsRow}>
            <TabBtn label="Payoff" active={tab === "payoff"} onClick={() => setTab("payoff")} />
            <TabBtn label="Linked Flow" active={tab === "flow"} onClick={() => setTab("flow")} />
            <TabBtn label="History" active={tab === "history"} onClick={() => setTab("history")} />
            <TabBtn label="Profile" active={tab === "profile"} onClick={() => setTab("profile")} />
          </div>

          <div className={styles.tabStage}>
            {tab === "payoff" ? (
              <div className={styles.splitLayoutFill}>
                <div className={`${styles.panel} ${styles.panelFill}`}>
                  <div className={styles.panelHeader}>
                    <SectionTitle
                      title="Attack simulator"
                      sub="See what a stronger monthly push does."
                    />
                    <MiniPill tone="green">live math</MiniPill>
                  </div>

                  <div className={styles.formGrid}>
                    <label className={styles.fieldWrap}>
                      <span>Base minimum</span>
                      <input
                        className={styles.field}
                        value={moneyTight(monthlyMinimumPayment(selectedDebt))}
                        readOnly
                      />
                    </label>

                    <label className={styles.fieldWrap}>
                      <span>Current plan</span>
                      <input
                        className={styles.field}
                        value={moneyTight(selectedSummary.monthlyPlan)}
                        readOnly
                      />
                    </label>

                    <label className={styles.fieldWrap}>
                      <span>Add extra</span>
                      <input
                        className={styles.field}
                        value={simBoost}
                        onChange={(event) => setSimBoost(event.target.value)}
                        placeholder="0.00"
                        inputMode="decimal"
                      />
                    </label>

                    <label className={styles.fieldWrap}>
                      <span>Simulated plan</span>
                      <input
                        className={styles.field}
                        value={moneyTight(simulatedPayment)}
                        readOnly
                      />
                    </label>
                  </div>

                  <div className={styles.filterRow}>
                    {[50, 100, 250, 500].map((boost) => (
                      <button
                        key={boost}
                        type="button"
                        className={styles.filterChip}
                        onClick={() => setSimBoost(String(boost))}
                      >
                        +{money(boost)}
                      </button>
                    ))}
                  </div>

                  <div className={styles.storyGrid}>
                    <div className={styles.storyCard}>
                      <div className={styles.balanceLabel}>Months saved</div>
                      <div className={styles.storyValue}>{monthsSaved}</div>
                      <div className={styles.storySub}>Against the current recurring plan.</div>
                    </div>

                    <div className={styles.storyCard}>
                      <div className={styles.balanceLabel}>Interest saved</div>
                      <div className={`${styles.storyValue} ${styles.valuePositive}`}>
                        {moneyTight(interestSaved)}
                      </div>
                      <div className={styles.storySub}>Estimated from amortized payoff math.</div>
                    </div>

                    <div className={styles.storyCard}>
                      <div className={styles.balanceLabel}>Current payoff</div>
                      <div className={styles.storyValue}>{selectedSummary.payoffBase}</div>
                      <div className={styles.storySub}>With the current minimum plus extra plan.</div>
                    </div>

                    <div className={styles.storyCard}>
                      <div className={styles.balanceLabel}>Boosted payoff</div>
                      <div className={`${styles.storyValue} ${styles.valueWarning}`}>
                        {payoffLabel(selectedDebt.balance, selectedDebt.aprPct, simulatedPayment)}
                      </div>
                      <div className={styles.storySub}>With the simulated monthly attack amount.</div>
                    </div>
                  </div>
                </div>

                <div className={styles.asideStackFill}>
                  <div className={`${styles.panel} ${styles.panelFillCompact}`}>
                    <div className={styles.panelHeader}>
                      <SectionTitle
                        title="Target context"
                        sub={strategySubtitle(strategy)}
                      />
                      {targetDebtId === selectedDebt.id ? (
                        <MiniPill tone="blue">Current target</MiniPill>
                      ) : null}
                    </div>

                    <div className={styles.infoList}>
                      <InfoRow label="APR" value={`${safeNum(selectedDebt.aprPct)}%`} />
                      <InfoRow label="Balance" value={money(selectedDebt.balance)} />
                      <InfoRow label="Strategy" value={STRATEGY_OPTIONS.find((item) => item.value === strategy)?.label || "Avalanche"} tone="blue" />
                      <InfoRow label="Rule" value={strategySubtitle(strategy)} tone="amber" />
                    </div>
                  </div>

                  <div className={`${styles.panel} ${styles.panelFillCompact}`}>
                    <div className={styles.panelHeader}>
                      <SectionTitle
                        title="Pressure note"
                        sub="Why this debt matters right now."
                      />
                    </div>

                    <div className={styles.noteText}>
                      {selectedSummary.underwater
                        ? "This plan is not beating monthly interest. Raise the payment or refinance pressure will continue to compound."
                        : safeNum(selectedDebt.aprPct) >= 20
                        ? "APR is high enough that this debt still deserves close attention even if the plan is technically beating interest."
                        : "The current plan is viable. What matters now is keeping linked bill flow accurate and attacking in the right order."}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {tab === "flow" ? (
              <div className={styles.splitLayoutFill}>
                <div className={`${styles.panel} ${styles.panelFill}`}>
                  <div className={styles.panelHeader}>
                    <SectionTitle
                      title="Linked bill flow"
                      sub="Bills that route real money pressure into this debt."
                    />
                    <MiniPill tone="blue">{selectedSummary.linkedBillsCount} linked</MiniPill>
                  </div>

                  {selectedSummary.linkedBills.length ? (
                    <div className={`${styles.dataList} ${styles.scrollRegion}`}>
                      {selectedSummary.linkedBills.map((bill) => (
                        <LinkedBillRow key={bill.id} bill={bill} />
                      ))}
                    </div>
                  ) : (
                    <div className={styles.paneEmpty}>No linked bills attached yet.</div>
                  )}
                </div>

                <div className={styles.asideStackFill}>
                  <div className={`${styles.panel} ${styles.panelFillCompact}`}>
                    <div className={styles.panelHeader}>
                      <SectionTitle
                        title="Linked account"
                        sub="The account this profile points to."
                      />
                    </div>

                    <div className={styles.infoList}>
                      <InfoRow label="Account" value={selectedSummary.linkedAccountName} />
                      <InfoRow
                        label="Type"
                        value={linkedAccount ? accountTypeLabel(linkedAccount.type) : "None"}
                      />
                      <InfoRow
                        label="Balance"
                        value={linkedAccount ? money(linkedAccount.balance) : "—"}
                        tone="green"
                      />
                    </div>
                  </div>

                  <div className={`${styles.panel} ${styles.panelFillCompact}`}>
                    <div className={styles.panelHeader}>
                      <SectionTitle
                        title="Ownership"
                        sub="How debt and bills split responsibility."
                      />
                    </div>

                    <div className={styles.noteText}>
                      Bills posts payments and touches accounts. Debt tracks the payoff profile,
                      reads synced history, and stays clean as the planning layer.
                    </div>

                    <div className={styles.detailActions}>
                      <Button onClick={onOpenBills}>
                        <Link2 size={14} />
                        Open Bills
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {tab === "history" ? (
              <div className={styles.singlePanelFill}>
                <div className={`${styles.panel} ${styles.panelFill}`}>
                  <div className={styles.panelHeader}>
                    <SectionTitle
                      title="Payment history"
                      sub="Synced bill payment rows and legacy debt-only rows."
                    />
                    <MiniPill tone="neutral">{selectedSummary.history.length} rows</MiniPill>
                  </div>

                  {selectedSummary.history.length ? (
                    <div className={`${styles.dataList} ${styles.scrollRegion}`}>
                      {selectedSummary.history.map((payment) => (
                        <PaymentRow
                          key={payment.id}
                          payment={payment}
                          accountNameById={accountNameById}
                          selectedDebtId={selectedDebt.id}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className={styles.paneEmpty}>No payment history synced yet.</div>
                  )}
                </div>
              </div>
            ) : null}

            {tab === "profile" ? (
              <div className={styles.splitLayoutFill}>
                <div className={`${styles.panel} ${styles.panelFillCompact}`}>
                  <div className={styles.panelHeader}>
                    <SectionTitle title="Debt profile" sub="Stored settings for this payoff profile." />
                  </div>

                  <div className={styles.infoList}>
                    <InfoRow label="Category" value={selectedDebt.category || "None"} />
                    <InfoRow label="Due date" value={shortDate(selectedDebt.dueDate)} />
                    <InfoRow label="Frequency" value={FREQS.find((item) => item.value === selectedDebt.frequency)?.label || selectedDebt.frequency} />
                    <InfoRow label="Autopay flag" value={selectedDebt.autopay ? "Enabled" : "Disabled"} />
                    <InfoRow label="Last paid" value={shortDate(selectedDebt.lastPaidDate)} tone="green" />
                    <InfoRow label="Statement amount" value={moneyTight(selectedDebt.amount)} />
                  </div>

                  <div className={styles.noteCard}>
                    <div className={styles.sectionTitle}>Notes</div>
                    <div className={styles.noteText}>{selectedDebt.notes || "No notes attached."}</div>
                  </div>
                </div>

                <div className={`${styles.panel} ${styles.panelFillCompact}`}>
                  <div className={styles.panelHeader}>
                    <SectionTitle title="Actions" sub="Keep secondary controls out of the main workspace." />
                  </div>

                  <div className={styles.ruleList}>
                    <button type="button" className={styles.actionRowButton} onClick={onEdit}>
                      <PencilLine size={14} />
                      <span>Edit debt profile</span>
                    </button>
                    <button type="button" className={styles.actionRowButton} onClick={onDuplicate}>
                      <Copy size={14} />
                      <span>Duplicate debt profile</span>
                    </button>
                    <button type="button" className={styles.actionRowButton} onClick={onToggle}>
                      <Zap size={14} />
                      <span>{selectedDebt.active ? "Archive selected debt" : "Reactivate selected debt"}</span>
                    </button>
                    <button type="button" className={styles.actionRowButton} onClick={onDelete}>
                      <Trash2 size={14} />
                      <span>Delete selected debt</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <QuickToolsDrawer
          open={toolsOpen}
          onClose={() => setToolsOpen(false)}
          selectedDebt={selectedDebt}
          selectedSummary={selectedSummary}
          metrics={metrics}
          alerts={alerts}
          strategy={strategy}
          onSetStrategy={setStrategy}
          onOpenBills={onOpenBills}
        />
      </GlassPane>
    </>
  );
}

export function DebtEditorModal({
  open,
  mode,
  form,
  setForm,
  onClose,
  onSave,
  saving,
  accounts,
}) {
  const payAccounts = accounts.filter((account) => !String(account.type || "").toLowerCase().includes("invest"));

  return (
    <ModalShell
      open={open}
      title={mode === "create" ? "Create Debt Profile" : "Edit Debt Profile"}
      subcopy={
        mode === "create"
          ? "Build the payoff profile now. Bills can link to it later."
          : "Update the payoff profile without cluttering the main debt workspace."
      }
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={onSave} disabled={saving}>
            {saving ? "Saving…" : mode === "create" ? "Create" : "Save"}
          </Button>
        </>
      }
    >
      <div className={styles.formGrid}>
        <label className={styles.fieldWrap}>
          <span>Debt Name</span>
          <input
            className={styles.field}
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Mortgage, loan, card…"
          />
        </label>

        <label className={styles.fieldWrap}>
          <span>Category</span>
          <input
            className={styles.field}
            value={form.category}
            onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
            placeholder="Housing, auto, card…"
          />
        </label>

        <label className={styles.fieldWrap}>
          <span>Balance</span>
          <input
            className={styles.field}
            value={form.balance}
            onChange={(event) => setForm((prev) => ({ ...prev, balance: event.target.value }))}
            placeholder="0.00"
            inputMode="decimal"
          />
        </label>

        <label className={styles.fieldWrap}>
          <span>APR %</span>
          <input
            className={styles.field}
            value={form.aprPct}
            onChange={(event) => setForm((prev) => ({ ...prev, aprPct: event.target.value }))}
            placeholder="0"
            inputMode="decimal"
          />
        </label>

        <label className={styles.fieldWrap}>
          <span>Minimum Payment</span>
          <input
            className={styles.field}
            value={form.minPay}
            onChange={(event) => setForm((prev) => ({ ...prev, minPay: event.target.value }))}
            placeholder="0.00"
            inputMode="decimal"
          />
        </label>

        <label className={styles.fieldWrap}>
          <span>Extra Payment</span>
          <input
            className={styles.field}
            value={form.extraPay}
            onChange={(event) => setForm((prev) => ({ ...prev, extraPay: event.target.value }))}
            placeholder="0.00"
            inputMode="decimal"
          />
        </label>

        <label className={styles.fieldWrap}>
          <span>Due Date</span>
          <input
            className={styles.field}
            type="date"
            value={form.dueDate}
            onChange={(event) => setForm((prev) => ({ ...prev, dueDate: event.target.value }))}
          />
        </label>

        <label className={styles.fieldWrap}>
          <span>Frequency</span>
          <select
            className={styles.field}
            value={form.frequency}
            onChange={(event) => setForm((prev) => ({ ...prev, frequency: event.target.value }))}
          >
            {FREQS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.fieldWrap}>
          <span>Statement Amount</span>
          <input
            className={styles.field}
            value={form.amount}
            onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
            placeholder="Optional"
            inputMode="decimal"
          />
        </label>

        <label className={styles.fieldWrap}>
          <span>Linked Account</span>
          <select
            className={styles.field}
            value={form.accountId}
            onChange={(event) => setForm((prev) => ({ ...prev, accountId: event.target.value }))}
          >
            <option value="">No account</option>
            {payAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} · {accountTypeLabel(account.type)} · {money(account.balance)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.toggleRow}>
        <Button
          variant={form.autopay ? "primary" : "ghost"}
          onClick={() => setForm((prev) => ({ ...prev, autopay: !prev.autopay }))}
        >
          <Zap size={14} />
          {form.autopay ? "Autopay On" : "Autopay Off"}
        </Button>
      </div>

      <label className={styles.fieldWrap}>
        <span>Notes</span>
        <textarea
          className={styles.field}
          value={form.notes}
          onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
          rows={4}
          placeholder="Optional notes…"
        />
      </label>
    </ModalShell>
  );
}

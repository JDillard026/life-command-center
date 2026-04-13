"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Copy,
  Link2,
  PencilLine,
  Plus,
  Save,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import GlassPane from "../components/GlassPane";
import styles from "./BillsPage.module.css";
import {
  FREQS,
  billStatus,
  dueText,
  formatFrequencyLabel,
  isInvestment,
  money,
  moneyTight,
  safeNum,
  shortDate,
  toneMeta,
} from "./bills.helpers";

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
        color: tone === "neutral" ? "rgba(255,255,255,0.9)" : meta.text,
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

export function SummaryStrip({ metrics, selectedBill, selectedSummary }) {
  const selectedStatus =
    selectedSummary?.status || (selectedBill ? billStatus(selectedBill) : null);

  return (
    <GlassPane className={styles.summaryStrip}>
      <div className={styles.summaryInner}>
        <div className={styles.titleBlock}>
          <div className={styles.eyebrow}>Money / Bills</div>

          <div className={styles.pageTitleRow}>
            <div className={styles.pageTitle}>Bills</div>
            <MiniPill tone="green">command</MiniPill>
          </div>

          <div className={styles.workspaceCopy}>
            One bill workspace for pressure, due control, payments, debt linkage,
            and account impact.
          </div>
        </div>

        <div className={styles.summaryStats}>
          <div className={styles.summaryStat}>
            <div className={styles.summaryLabel}>Active</div>
            <div className={styles.summaryValue}>{metrics.activeCount}</div>
            <div className={styles.summaryHint}>tracked bills</div>
          </div>

          <div className={styles.summaryStat}>
            <div className={styles.summaryLabel}>Monthly Load</div>
            <div className={styles.summaryValue}>{money(metrics.monthlyPressure)}</div>
            <div className={styles.summaryHint}>normalized impact</div>
          </div>

          <div className={styles.summaryStat}>
            <div className={`${styles.summaryValue} ${styles.valuePositive}`}>
              {money(metrics.paidThisMonth)}
            </div>
            <div className={styles.summaryLabel}>Paid This Month</div>
            <div className={styles.summaryHint}>payments logged</div>
          </div>

          <div className={styles.summaryStat}>
            <div
              className={`${styles.summaryValue} ${
                metrics.dueSoonCount ? styles.valueWarning : ""
              }`}
            >
              {metrics.dueSoonCount}
            </div>
            <div className={styles.summaryLabel}>Due Soon</div>
            <div className={styles.summaryHint}>within 7 days</div>
          </div>

          <div className={styles.summaryStat}>
            <div
              className={`${styles.summaryValue} ${
                metrics.overdueCount ? styles.valueNegative : ""
              }`}
            >
              {metrics.overdueCount}
            </div>
            <div className={styles.summaryLabel}>Overdue</div>
            <div className={styles.summaryHint}>needs attention</div>
          </div>
        </div>

        <div className={styles.summaryRight}>
          {selectedBill ? (
            <MiniPill tone={selectedStatus?.tone || "blue"}>{selectedBill.name}</MiniPill>
          ) : null}
          {selectedStatus ? (
            <MiniPill tone={selectedStatus.tone}>{selectedStatus.label}</MiniPill>
          ) : null}
          <MiniPill
            tone={
              metrics.overdueCount > 0
                ? "red"
                : metrics.dueSoonCount > 0
                ? "amber"
                : "green"
            }
          >
            {metrics.nextBill ? `Next ${metrics.nextBill.name}` : "Queue clear"}
          </MiniPill>
        </div>
      </div>
    </GlassPane>
  );
}

function ScopeTab({ label, active, onClick }) {
  return (
    <button
      type="button"
      className={cx(styles.scopeTab, active && styles.scopeTabActive)}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function BillQueueRow({ bill, summary, selected, onSelect }) {
  const status = summary?.status || billStatus(bill);
  const meta = toneMeta(status.tone);

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
          <div className={styles.queueName}>{bill.name || "Bill"}</div>
          <div className={styles.queueAmount}>{money(bill.amount)}</div>
        </div>

        <div className={styles.queueBottom}>
          <div className={styles.queueMeta}>
            <span>{bill.category || "Uncategorized"}</span>
            <span>•</span>
            <span style={{ color: meta.text }}>{status.label}</span>
            <span>•</span>
            <span>{money(summary?.monthlyImpact)}</span>
          </div>

          <div className={styles.queueBadges}>
            {bill.autopay ? <MiniPill tone="green">Auto</MiniPill> : null}
            {bill.linkedDebtId ? <MiniPill tone="blue">Debt</MiniPill> : null}
            {!bill.active ? <MiniPill tone="blue">Inactive</MiniPill> : null}
          </div>
        </div>
      </div>

      <ChevronRight size={14} className={styles.queueChevron} />
    </button>
  );
}

export function QueuePane({
  visibleBills,
  summaryById,
  selectedBill,
  onSelect,
  search,
  setSearch,
  scope,
  setScope,
  sortBy,
  setSortBy,
}) {
  return (
    <GlassPane className={styles.queuePane}>
      <div className={styles.paneHeader}>
        <div>
          <div className={styles.paneTitle}>Bill navigator</div>
          <div className={styles.paneSub}>Choose the bill you want to command.</div>
        </div>
      </div>

      <div className={styles.queueToolbar}>
        <label className={styles.searchWrap}>
          <Search size={14} />
          <input
            className={styles.searchInput}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search bills..."
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

        <div className={styles.scopeTabs}>
          <ScopeTab label="Active" active={scope === "active"} onClick={() => setScope("active")} />
          <ScopeTab label="All" active={scope === "all"} onClick={() => setScope("all")} />
          <ScopeTab
            label="Inactive"
            active={scope === "inactive"}
            onClick={() => setScope("inactive")}
          />
        </div>

        <div className={styles.queueMetaRow}>
          <div className={styles.paneSub}>{visibleBills.length} showing</div>
          <select
            className={styles.field}
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
          >
            <option value="due_asc">By due date</option>
            <option value="amount_desc">By amount</option>
            <option value="name_asc">By name</option>
            <option value="updated_desc">Recently updated</option>
          </select>
        </div>
      </div>

      <div className={styles.queueList}>
        {visibleBills.length ? (
          visibleBills.map((bill) => (
            <BillQueueRow
              key={bill.id}
              bill={bill}
              summary={summaryById[bill.id]}
              selected={bill.id === selectedBill?.id}
              onSelect={() => onSelect(bill.id)}
            />
          ))
        ) : (
          <div className={styles.paneEmpty}>No bills found.</div>
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

function InfoRow({ label, value, tone = "neutral" }) {
  const color =
    tone === "green"
      ? "#97efc7"
      : tone === "amber"
      ? "#f5cf88"
      : tone === "red"
      ? "#ff646b"
      : tone === "blue"
      ? "#bcd7ff"
      : "rgba(255,255,255,0.96)";

  return (
    <div className={styles.infoRow}>
      <span>{label}</span>
      <span style={{ color }}>{value}</span>
    </div>
  );
}

function PaymentHistoryList({ payments, deletingId, onDeletePayment }) {
  if (!payments.length) {
    return <div className={styles.paneEmpty}>No payment history yet.</div>;
  }

  return (
    <div className={styles.dataList}>
      {payments.map((payment) => (
        <div key={payment.id} className={styles.dataRow}>
          <div className={styles.dataMain}>
            <div className={styles.dataTitle}>{moneyTight(payment.amount)}</div>
            <div className={styles.dataSub}>{shortDate(payment.paymentDate)}</div>
            {payment.note ? <div className={styles.noteText}>{payment.note}</div> : null}
          </div>

          <div className={styles.historyActionRow}>
            <MiniPill tone="green">Paid</MiniPill>
            <Button
              variant="danger"
              onClick={() => onDeletePayment(payment)}
              disabled={deletingId === payment.id}
            >
              <Trash2 size={13} />
              {deletingId === payment.id ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ScheduleList({ items }) {
  if (!items.length) {
    return <div className={styles.paneEmpty}>No future schedule built yet.</div>;
  }

  return (
    <div className={styles.dataList}>
      {items.map((item) => {
        const meta = toneMeta(item.tone);
        return (
          <div key={item.id} className={styles.dataRow}>
            <div className={styles.dataMain}>
              <div className={styles.dataTitle}>{shortDate(item.dueDate)}</div>
              <div className={styles.dataSub} style={{ color: meta.text }}>
                {item.label}
              </div>
            </div>
            <div className={styles.dataAmount}>-{money(item.amount)}</div>
          </div>
        );
      })}
    </div>
  );
}

function DebtPanel({ selectedSummary, onOpenEdit }) {
  const linkedDebt = selectedSummary?.linkedDebt || null;

  if (!linkedDebt) {
    return (
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <div className={styles.panelTitle}>Linked debt</div>
            <div className={styles.panelSub}>Optional payoff tracking connection.</div>
          </div>
        </div>

        <div className={styles.paneEmpty}>No debt profile linked to this bill yet.</div>

        <div className={styles.detailActions}>
          <Button onClick={onOpenEdit}>
            <Link2 size={14} />
            Link debt
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <div className={styles.panelTitle}>Linked debt</div>
          <div className={styles.panelSub}>Debt progress and payoff pressure.</div>
        </div>
        <MiniPill tone="blue">connected</MiniPill>
      </div>

      <div className={styles.infoList}>
        <InfoRow label="Debt" value={linkedDebt.name} tone="blue" />
        <InfoRow label="Balance" value={money(linkedDebt.balance)} tone="red" />
        <InfoRow label="APR" value={`${safeNum(linkedDebt.aprPct)}%`} />
        <InfoRow
          label="Interest / mo"
          value={moneyTight(selectedSummary?.monthlyInterest)}
          tone="amber"
        />
        <InfoRow
          label="Plan"
          value={`${moneyTight(selectedSummary?.debtPlan)}/mo`}
          tone="green"
        />
        <InfoRow label="Payoff est." value={selectedSummary?.payoff || "—"} tone="green" />
      </div>

      <div className={styles.detailActions}>
        <Button onClick={onOpenEdit}>
          <PencilLine size={14} />
          Manage link
        </Button>
      </div>
    </div>
  );
}

function PayPreviewCard({ label, value, sub, tone = "neutral" }) {
  const toneClass =
    tone === "green"
      ? styles.valuePositive
      : tone === "amber"
      ? styles.valueWarning
      : tone === "red"
      ? styles.valueNegative
      : "";

  return (
    <div className={styles.previewCard}>
      <div className={styles.previewLabel}>{label}</div>
      <div className={cx(styles.previewValue, toneClass)}>{value}</div>
      <div className={styles.previewText}>{sub}</div>
    </div>
  );
}

function SignalCard({ signals }) {
  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <div className={styles.panelTitle}>Signals</div>
          <div className={styles.panelSub}>What matters right now on this bill.</div>
        </div>
        <MiniPill tone={signals.some((x) => x.tone === "red") ? "red" : "blue"}>
          {signals.length} active
        </MiniPill>
      </div>

      <div className={styles.infoList}>
        {signals.map((item) => (
          <InfoRow key={item.label} label={item.label} value={item.value} tone={item.tone} />
        ))}
      </div>
    </div>
  );
}

export function FocusPane({
  selectedBill,
  selectedSummary,
  payAccounts,
  draft,
  setDraft,
  payBusy,
  onPay,
  onOpenCreate,
  onOpenEdit,
  onDuplicate,
  onToggle,
  onDelete,
  onDeletePayment,
  deletingPaymentId,
  busy,
}) {
  const [tab, setTab] = useState("command");
  const [toolsOpen, setToolsOpen] = useState(false);

  useEffect(() => {
    setTab("command");
    setToolsOpen(false);
  }, [selectedBill?.id]);

  const payFromAccount = useMemo(
    () => payAccounts.find((account) => account.id === draft.accountId) || null,
    [payAccounts, draft.accountId]
  );

  if (!selectedBill || !selectedSummary) {
    return (
      <GlassPane className={styles.focusPane}>
        <div className={styles.focusEmpty}>Select a bill.</div>
      </GlassPane>
    );
  }

  const status = selectedSummary.status;
  const linkedDebt = selectedSummary.linkedDebt || null;
  const previewAmount = Math.max(0, safeNum(draft.amount || selectedBill.amount, 0));
  const afterDebtBalance = linkedDebt
    ? Math.max(0, safeNum(linkedDebt.balance, 0) - previewAmount)
    : null;

  const signals = [
    {
      label: "Status",
      value: status.label,
      tone: status.tone,
    },
    {
      label: "Due",
      value: shortDate(selectedBill.dueDate),
      tone: status.tone,
    },
    {
      label: "Autopay Flag",
      value: selectedBill.autopay ? "On" : "Off",
      tone: selectedBill.autopay ? "green" : "neutral",
    },
    {
      label: "Debt Link",
      value: linkedDebt ? "Connected" : "Not linked",
      tone: linkedDebt ? "blue" : "neutral",
    },
    {
      label: "Payment History",
      value: `${selectedSummary.paymentsCount} logged`,
      tone: selectedSummary.paymentsCount ? "green" : "amber",
    },
  ];

  return (
    <GlassPane className={styles.focusPane}>
      <div className={styles.focusStack}>
        <div className={styles.focusHeader}>
          <div>
            <div className={styles.eyebrow}>Bill command</div>
            <div className={styles.focusTitle}>{selectedBill.name || "Bill"}</div>
            <div className={styles.focusMeta}>
              {selectedSummary.accountName || "No account"} • {selectedBill.category || "Uncategorized"} • Due{" "}
              {shortDate(selectedBill.dueDate)}
            </div>
          </div>

          <div className={styles.focusHeaderRight}>
            <div className={styles.focusBadges}>
              <MiniPill tone={status.tone}>{status.label}</MiniPill>
              {selectedBill.autopay ? <MiniPill tone="green">Auto flag</MiniPill> : null}
              {linkedDebt ? <MiniPill tone="blue">Debt linked</MiniPill> : null}
            </div>

            <div className={styles.focusActionRow}>
              <Button onClick={onOpenCreate} disabled={busy}>
                <Plus size={14} />
                New
              </Button>
              <Button onClick={onOpenEdit} disabled={busy}>
                <PencilLine size={14} />
                Edit
              </Button>
              <Button variant={toolsOpen ? "primary" : "ghost"} onClick={() => setToolsOpen(true)}>
                <SlidersHorizontal size={14} />
                Tools
              </Button>
            </div>
          </div>
        </div>

        <div className={styles.commandMetricGrid}>
          <TopMetric
            label="Current Amount"
            value={money(selectedBill.amount)}
            sub="Amount due on this bill"
          />
          <TopMetric
            label="Status"
            value={status.label}
            sub={dueText(selectedSummary.daysUntil)}
            tone={status.tone}
          />
          <TopMetric
            label="Paid This Month"
            value={money(selectedSummary.paidThisMonth)}
            sub="Month-to-date bill payments"
            tone="green"
          />
          <TopMetric
            label={linkedDebt ? "Linked Debt" : "Pay From"}
            value={linkedDebt ? money(selectedSummary.linkedDebtBalance) : selectedSummary.accountName || "None"}
            sub={linkedDebt ? selectedSummary.payoff : "Payment source account"}
            tone={linkedDebt ? "red" : "blue"}
          />
        </div>

        <div className={styles.tabsRow}>
          <TabBtn label="Command" active={tab === "command"} onClick={() => setTab("command")} />
          <TabBtn label="Schedule" active={tab === "schedule"} onClick={() => setTab("schedule")} />
          <TabBtn label="History" active={tab === "history"} onClick={() => setTab("history")} />
          <TabBtn label="Debt" active={tab === "debt"} onClick={() => setTab("debt")} />
        </div>

        <div className={styles.tabStage}>
          {tab === "command" ? (
            <div className={styles.splitLayoutFill}>
              <div className={`${styles.panel} ${styles.panelFill}`}>
                <div className={styles.panelHeader}>
                  <div>
                    <div className={styles.panelTitle}>Payment command</div>
                    <div className={styles.panelSub}>
                      Main action first. Log the payment and push the write through the system.
                    </div>
                  </div>
                  <MiniPill tone="green">live write</MiniPill>
                </div>

                <div className={styles.formGrid3}>
                  <label className={styles.fieldWrap}>
                    <span>Amount</span>
                    <input
                      className={styles.field}
                      value={draft.amount}
                      onChange={(event) =>
                        setDraft((prev) => ({ ...prev, amount: event.target.value }))
                      }
                      placeholder="0.00"
                      inputMode="decimal"
                    />
                  </label>

                  <label className={styles.fieldWrap}>
                    <span>Payment Date</span>
                    <input
                      type="date"
                      className={styles.field}
                      value={draft.paymentDate}
                      onChange={(event) =>
                        setDraft((prev) => ({ ...prev, paymentDate: event.target.value }))
                      }
                    />
                  </label>

                  <label className={styles.fieldWrap}>
                    <span>Pay From</span>
                    <select
                      className={styles.field}
                      value={draft.accountId}
                      onChange={(event) =>
                        setDraft((prev) => ({ ...prev, accountId: event.target.value }))
                      }
                    >
                      <option value="">No account</option>
                      {payAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name} · {money(account.balance)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className={styles.fieldWrap}>
                  <span>Note</span>
                  <input
                    className={styles.field}
                    value={draft.note}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, note: event.target.value }))
                    }
                    placeholder="Optional note..."
                  />
                </label>

                <label className={styles.checkRow}>
                  <input
                    type="checkbox"
                    checked={draft.advanceDue}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, advanceDue: event.target.checked }))
                    }
                  />
                  <span>Advance next due date after payment</span>
                </label>

                <div className={styles.previewGrid}>
                  <PayPreviewCard
                    label="Ledger write"
                    value={`-${money(previewAmount)}`}
                    sub={
                      payFromAccount
                        ? `${payFromAccount.name} gets hit`
                        : "No account selected"
                    }
                    tone={payFromAccount ? "red" : "neutral"}
                  />
                  <PayPreviewCard
                    label="Bill status"
                    value={selectedSummary.status.isPaid ? "Already paid" : "Will update"}
                    sub="Bill history and month totals refresh"
                    tone="green"
                  />
                  <PayPreviewCard
                    label="Debt after pay"
                    value={linkedDebt ? money(afterDebtBalance) : "No debt"}
                    sub={
                      linkedDebt
                        ? `${money(previewAmount)} applied toward linked debt`
                        : "No linked debt profile"
                    }
                    tone={linkedDebt ? "amber" : "neutral"}
                  />
                </div>

                <div className={styles.detailActions}>
                  <Button variant="primary" onClick={onPay} disabled={payBusy}>
                    <Save size={14} />
                    {payBusy ? "Saving..." : "Mark Paid"}
                  </Button>
                </div>
              </div>

              <div className={styles.asideStackFill}>
                <SignalCard signals={signals} />

                <div className={styles.panel}>
                  <div className={styles.panelHeader}>
                    <div>
                      <div className={styles.panelTitle}>Write-through path</div>
                      <div className={styles.panelSub}>What this action touches.</div>
                    </div>
                    <MiniPill tone="blue">system</MiniPill>
                  </div>

                  <div className={styles.infoList}>
                    <InfoRow label="Bill payment row" value="logged" tone="green" />
                    <InfoRow label="Account ledger" value="written" tone="red" />
                    <InfoRow label="Spending mirror" value="expense row" tone="amber" />
                    <InfoRow label="Calendar mirror" value="done event" tone="blue" />
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {tab === "schedule" ? (
            <div className={styles.splitLayoutFill}>
              <div className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div>
                    <div className={styles.panelTitle}>Upcoming schedule</div>
                    <div className={styles.panelSub}>Where this bill is headed from here.</div>
                  </div>
                  <MiniPill tone="amber">next 6</MiniPill>
                </div>

                <ScheduleList items={selectedSummary.forwardSchedule || []} />
              </div>

              <div className={styles.asideStackFill}>
                <div className={styles.panel}>
                  <div className={styles.panelHeader}>
                    <div>
                      <div className={styles.panelTitle}>Due logic</div>
                      <div className={styles.panelSub}>How the system sees this bill right now.</div>
                    </div>
                  </div>
                  <div className={styles.infoList}>
                    <InfoRow label="Status" value={status.label} tone={status.tone} />
                    <InfoRow label="Due date" value={shortDate(selectedBill.dueDate)} tone={status.tone} />
                    <InfoRow
                      label="Advance due on pay"
                      value={draft.advanceDue ? "On" : "Off"}
                      tone={draft.advanceDue ? "green" : "neutral"}
                    />
                    <InfoRow
                      label="One-time"
                      value={selectedBill.frequency === "one_time" ? "Yes" : "No"}
                    />
                  </div>
                </div>

                <div className={styles.panel}>
                  <div className={styles.panelHeader}>
                    <div>
                      <div className={styles.panelTitle}>Cycle pulse</div>
                      <div className={styles.panelSub}>Current cycle boundaries.</div>
                    </div>
                  </div>
                  <div className={styles.infoList}>
                    <InfoRow label="Cycle start" value={shortDate(selectedSummary.cycleStart)} />
                    <InfoRow label="Cycle end" value={shortDate(selectedSummary.cycleEnd)} />
                    <InfoRow label="Frequency" value={formatFrequencyLabel(selectedBill.frequency)} />
                    <InfoRow label="Last paid" value={shortDate(selectedBill.lastPaidDate)} tone="green" />
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {tab === "history" ? (
            <div className={styles.splitLayoutFill}>
              <div className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div>
                    <div className={styles.panelTitle}>Payment history</div>
                    <div className={styles.panelSub}>
                      Every logged payment for this bill.
                    </div>
                  </div>
                  <MiniPill tone="green">{selectedSummary.paymentsCount} rows</MiniPill>
                </div>

                <PaymentHistoryList
                  payments={selectedSummary.payments || []}
                  deletingId={deletingPaymentId}
                  onDeletePayment={onDeletePayment}
                />
              </div>

              <div className={styles.asideStackFill}>
                <div className={styles.panel}>
                  <div className={styles.panelHeader}>
                    <div>
                      <div className={styles.panelTitle}>History snapshot</div>
                      <div className={styles.panelSub}>Fast totals for this bill.</div>
                    </div>
                  </div>
                  <div className={styles.infoList}>
                    <InfoRow
                      label="Payments logged"
                      value={String(selectedSummary.paymentsCount)}
                    />
                    <InfoRow
                      label="Total paid"
                      value={money(selectedSummary.totalPaid)}
                      tone="green"
                    />
                    <InfoRow
                      label="Paid this month"
                      value={money(selectedSummary.paidThisMonth)}
                      tone="green"
                    />
                    <InfoRow
                      label="Most recent"
                      value={shortDate(selectedSummary.lastPayment?.paymentDate)}
                      tone="blue"
                    />
                  </div>
                </div>

                <div className={styles.noteCard}>
                  <div className={styles.panelTitle}>Notes</div>
                  <div className={styles.noteText}>
                    {selectedBill.notes || "No notes attached."}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {tab === "debt" ? (
            <div className={styles.splitLayoutFill}>
              <DebtPanel selectedSummary={selectedSummary} onOpenEdit={onOpenEdit} />

              <div className={styles.asideStackFill}>
                <div className={styles.panel}>
                  <div className={styles.panelHeader}>
                    <div>
                      <div className={styles.panelTitle}>Debt signal</div>
                      <div className={styles.panelSub}>Only matters when linked to debt.</div>
                    </div>
                  </div>
                  <div className={styles.infoList}>
                    <InfoRow
                      label="Debt linked"
                      value={linkedDebt ? "Yes" : "No"}
                      tone={linkedDebt ? "blue" : "neutral"}
                    />
                    <InfoRow
                      label="Debt balance"
                      value={linkedDebt ? money(linkedDebt.balance) : "—"}
                      tone="red"
                    />
                    <InfoRow
                      label="Payoff est."
                      value={linkedDebt ? selectedSummary.payoff : "—"}
                      tone="green"
                    />
                    <InfoRow
                      label="Plan"
                      value={linkedDebt ? `${moneyTight(selectedSummary.debtPlan)}/mo` : "—"}
                      tone="amber"
                    />
                  </div>
                </div>

                <div className={styles.panel}>
                  <div className={styles.panelHeader}>
                    <div>
                      <div className={styles.panelTitle}>Bill story</div>
                      <div className={styles.panelSub}>Base facts tied to the debt link.</div>
                    </div>
                  </div>
                  <div className={styles.infoList}>
                    <InfoRow label="Bill amount" value={money(selectedBill.amount)} />
                    <InfoRow label="Monthly impact" value={money(selectedSummary.monthlyImpact)} tone="amber" />
                    <InfoRow label="Frequency" value={formatFrequencyLabel(selectedBill.frequency)} />
                    <InfoRow label="Linked account" value={selectedSummary.accountName || "None"} tone="blue" />
                  </div>
                </div>
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
                <div className={styles.panelTitle}>Bill tools</div>
                <div className={styles.panelSub}>
                  Secondary controls tucked off the main surface.
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
                    <div className={styles.panelSub}>Fast read for the selected bill.</div>
                  </div>
                  <MiniPill tone={status.tone}>{status.label}</MiniPill>
                </div>

                <div className={styles.infoList}>
                  <InfoRow label="Amount" value={money(selectedBill.amount)} />
                  <InfoRow
                    label="Due"
                    value={shortDate(selectedBill.dueDate)}
                    tone={status.tone}
                  />
                  <InfoRow
                    label="Frequency"
                    value={formatFrequencyLabel(selectedBill.frequency)}
                  />
                  <InfoRow
                    label="Monthly impact"
                    value={money(selectedSummary.monthlyImpact)}
                    tone="amber"
                  />
                  <InfoRow
                    label="Account"
                    value={selectedSummary.accountName || "None"}
                    tone="blue"
                  />
                </div>
              </div>

              <div className={styles.detailCardFill}>
                <div className={styles.panelHeader}>
                  <div>
                    <div className={styles.panelTitle}>Quick actions</div>
                    <div className={styles.panelSub}>
                      Important actions that do not need to stay visible all the time.
                    </div>
                  </div>
                </div>

                <div className={styles.actionStack}>
                  <Button onClick={onDuplicate} disabled={busy} full>
                    <Copy size={14} />
                    Duplicate bill
                  </Button>
                  <Button onClick={onToggle} disabled={busy} full>
                    <Zap size={14} />
                    {selectedBill.active ? "Archive bill" : "Activate bill"}
                  </Button>
                  <Button variant="danger" onClick={onDelete} disabled={busy} full>
                    <Trash2 size={14} />
                    Delete bill
                  </Button>
                </div>
              </div>

              <div className={styles.detailCardFill}>
                <div className={styles.panelHeader}>
                  <div>
                    <div className={styles.panelTitle}>Readiness notes</div>
                    <div className={styles.panelSub}>
                      What the page already supports and what the flags mean.
                    </div>
                  </div>
                  <MiniPill tone="blue">system</MiniPill>
                </div>

                <div className={styles.ruleList}>
                  <div className={styles.ruleRow}>
                    <ShieldAlert size={13} />
                    <div className={styles.ruleCopy}>
                      Payments write through the shared account ledger, not just the bill table.
                    </div>
                  </div>
                  <div className={styles.ruleRow}>
                    <ShieldAlert size={13} />
                    <div className={styles.ruleCopy}>
                      Spending and calendar mirrors stay attached to each logged payment.
                    </div>
                  </div>
                  <div className={styles.ruleRow}>
                    <ShieldAlert size={13} />
                    <div className={styles.ruleCopy}>
                      Autopay here is a stored flag and UI signal, not a background scheduler.
                    </div>
                  </div>
                  <div className={styles.ruleRow}>
                    <ShieldAlert size={13} />
                    <div className={styles.ruleCopy}>
                      Debt linkage keeps Bills and Debt acting like one system instead of two fake pages.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </GlassPane>
  );
}

function DebtSection({ form, setForm, debtProfiles, accounts }) {
  const usableAccounts = accounts.filter((account) => !isInvestment(account.type));

  return (
    <div className={styles.sectionCard}>
      <div className={styles.sectionTitle}>Debt setup</div>

      <div className={styles.toggleRow}>
        <Button
          variant={!form.isDebtBill ? "primary" : "ghost"}
          onClick={() =>
            setForm((prev) => ({
              ...prev,
              isDebtBill: false,
              debtMode: "none",
              linkedDebtId: "",
            }))
          }
        >
          Fixed bill
        </Button>

        <Button
          variant={form.isDebtBill ? "primary" : "ghost"}
          onClick={() =>
            setForm((prev) => ({
              ...prev,
              isDebtBill: true,
              debtMode:
                prev.debtMode === "none"
                  ? debtProfiles.length
                    ? "link_existing"
                    : "create_new"
                  : prev.debtMode,
            }))
          }
        >
          Debt payoff
        </Button>
      </div>

      {form.isDebtBill ? (
        <div className={styles.formStack}>
          <div className={styles.toggleRow}>
            <Button
              variant={form.debtMode === "link_existing" ? "primary" : "ghost"}
              onClick={() => setForm((prev) => ({ ...prev, debtMode: "link_existing" }))}
            >
              Link existing
            </Button>
            <Button
              variant={form.debtMode === "create_new" ? "primary" : "ghost"}
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  debtMode: "create_new",
                  linkedDebtId: "",
                }))
              }
            >
              Create new
            </Button>
          </div>

          {form.debtMode === "link_existing" ? (
            <label className={styles.fieldWrap}>
              <span>Debt profile</span>
              <select
                className={styles.field}
                value={form.linkedDebtId}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, linkedDebtId: event.target.value }))
                }
              >
                <option value="">Select debt</option>
                {debtProfiles.map((debt) => (
                  <option key={debt.id} value={debt.id}>
                    {debt.name} · {money(debt.balance)} · {safeNum(debt.aprPct)}% APR
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {form.debtMode === "create_new" ? (
            <>
              <div className={styles.formGrid4}>
                <label className={styles.fieldWrap}>
                  <span>Name</span>
                  <input
                    className={styles.field}
                    value={form.newDebtName}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, newDebtName: event.target.value }))
                    }
                    placeholder="Capital One"
                  />
                </label>

                <label className={styles.fieldWrap}>
                  <span>Balance</span>
                  <input
                    className={styles.field}
                    value={form.newDebtBalance}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, newDebtBalance: event.target.value }))
                    }
                    inputMode="decimal"
                    placeholder="0.00"
                  />
                </label>

                <label className={styles.fieldWrap}>
                  <span>APR %</span>
                  <input
                    className={styles.field}
                    value={form.newDebtAprPct}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, newDebtAprPct: event.target.value }))
                    }
                    inputMode="decimal"
                    placeholder="0"
                  />
                </label>

                <label className={styles.fieldWrap}>
                  <span>Min pay</span>
                  <input
                    className={styles.field}
                    value={form.newDebtMinPay}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, newDebtMinPay: event.target.value }))
                    }
                    inputMode="decimal"
                    placeholder="0.00"
                  />
                </label>
              </div>

              <div className={styles.formGrid4}>
                <label className={styles.fieldWrap}>
                  <span>Extra pay</span>
                  <input
                    className={styles.field}
                    value={form.newDebtExtraPay}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, newDebtExtraPay: event.target.value }))
                    }
                    inputMode="decimal"
                    placeholder="0.00"
                  />
                </label>

                <label className={styles.fieldWrap}>
                  <span>Due date</span>
                  <input
                    type="date"
                    className={styles.field}
                    value={form.newDebtDueDate}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, newDebtDueDate: event.target.value }))
                    }
                  />
                </label>

                <label className={styles.fieldWrap}>
                  <span>Frequency</span>
                  <select
                    className={styles.field}
                    value={form.newDebtFrequency}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, newDebtFrequency: event.target.value }))
                    }
                  >
                    {FREQS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.fieldWrap}>
                  <span>Account</span>
                  <select
                    className={styles.field}
                    value={form.newDebtAccountId}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, newDebtAccountId: event.target.value }))
                    }
                  >
                    <option value="">None</option>
                    {usableAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className={styles.fieldWrap}>
                <span>Notes</span>
                <textarea
                  className={`${styles.field} ${styles.textarea}`}
                  value={form.newDebtNotes}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, newDebtNotes: event.target.value }))
                  }
                  placeholder="Optional..."
                  rows={3}
                />
              </label>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function BillEditorModal({
  open,
  mode,
  form,
  setForm,
  onClose,
  onSave,
  saving,
  accounts,
  debtProfiles,
}) {
  const payAccounts = accounts.filter((account) => !isInvestment(account.type));

  return (
    <ModalShell
      open={open}
      title={mode === "create" ? "Create Bill" : "Edit Bill"}
      subcopy={
        mode === "create"
          ? "Create the bill shell now. Payments, debt sync, spending mirrors, and account impact will run through the shared logic."
          : "Update the bill, due logic, and debt linkage without leaving the command page."
      }
      onClose={onClose}
      className={styles.modalWide}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={onSave} disabled={saving}>
            {saving ? "Saving..." : mode === "create" ? "Create bill" : "Save changes"}
          </Button>
        </>
      }
    >
      <div className={styles.sectionCard}>
        <div className={styles.sectionTitle}>Bill details</div>

        <label className={styles.fieldWrap}>
          <span>Bill name</span>
          <input
            className={styles.field}
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Rent, insurance, phone..."
          />
        </label>

        <div className={styles.formGrid3}>
          <label className={styles.fieldWrap}>
            <span>Amount</span>
            <input
              className={styles.field}
              value={form.amount}
              onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
              inputMode="decimal"
              placeholder="0.00"
            />
          </label>

          <label className={styles.fieldWrap}>
            <span>Due date</span>
            <input
              type="date"
              className={styles.field}
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
              {FREQS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className={styles.formGrid2}>
          <label className={styles.fieldWrap}>
            <span>Category</span>
            <input
              className={styles.field}
              value={form.category}
              onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
              placeholder="Housing, utility, subscriptions..."
            />
          </label>

          <label className={styles.fieldWrap}>
            <span>Account</span>
            <select
              className={styles.field}
              value={form.accountId}
              onChange={(event) => setForm((prev) => ({ ...prev, accountId: event.target.value }))}
            >
              <option value="">No account</option>
              {payAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} · {money(account.balance)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className={styles.toggleRow}>
          <Button
            variant={form.autopay ? "primary" : "ghost"}
            onClick={() => setForm((prev) => ({ ...prev, autopay: true }))}
          >
            <Zap size={14} />
            Auto flag on
          </Button>
          <Button
            variant={!form.autopay ? "primary" : "ghost"}
            onClick={() => setForm((prev) => ({ ...prev, autopay: false }))}
          >
            <X size={14} />
            Auto flag off
          </Button>
        </div>

        <label className={styles.fieldWrap}>
          <span>Notes</span>
          <textarea
            className={`${styles.field} ${styles.textarea}`}
            value={form.notes}
            onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
            placeholder="Optional notes..."
            rows={3}
          />
        </label>
      </div>

      <DebtSection form={form} setForm={setForm} debtProfiles={debtProfiles} accounts={accounts} />
    </ModalShell>
  );
}
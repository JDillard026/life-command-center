"use client";

import * as React from "react";
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  Camera,
  CheckCircle2,
  Copy,
  MoreHorizontal,
  PiggyBank,
  Plus,
  Receipt,
  Save,
  Search,
  SlidersHorizontal,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import GlassPane from "../components/GlassPane";
import {
  clamp,
  fmtTime,
  formatFileSize,
  merchantInsight,
  merchantPresetForName,
  money,
  shortDate,
  statusTone,
  toneForType,
  isBillManagedTransaction,
} from "./spending.helpers";
import styles from "./SpendingPage.module.css";

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function iconForType(type) {
  if (type === "income") return ArrowUpRight;
  if (type === "transfer") return ArrowLeftRight;
  return ArrowDownRight;
}

function toneClass(tone) {
  if (tone === "green") return styles.toneGreen;
  if (tone === "red") return styles.toneRed;
  if (tone === "amber") return styles.toneAmber;
  if (tone === "blue") return styles.toneBlue;
  return styles.toneNeutral;
}

function classificationTone(value) {
  if (value === "need") return "green";
  if (value === "want") return "amber";
  if (value === "waste") return "red";
  return "blue";
}

function selectedCategoryRowMeta(selectedBudget, selectedForecast) {
  if (!selectedBudget || selectedBudget <= 0) {
    return { budget: 0, forecast: selectedForecast, status: "No budget" };
  }
  if (selectedForecast >= selectedBudget) {
    return { budget: selectedBudget, forecast: selectedForecast, status: "Over" };
  }
  if (selectedForecast >= selectedBudget * 0.85) {
    return { budget: selectedBudget, forecast: selectedForecast, status: "Near" };
  }
  return { budget: selectedBudget, forecast: selectedForecast, status: "OK" };
}

function verdictForTransaction(tx, selectedCategoryRow, insight) {
  if (!tx) {
    return {
      tone: "neutral",
      label: "No selection",
      reason: "Choose a row to inspect the purchase.",
      bullets: [],
    };
  }

  if (tx.type === "income") {
    return {
      tone: "green",
      label: "Income event",
      reason: "This row adds cash instead of taking it away.",
      bullets: ["Money is entering the system.", "Judge what it funds next."],
    };
  }

  if (tx.type === "transfer") {
    return {
      tone: "blue",
      label: "Transfer event",
      reason: "This is money movement between accounts, not outside spend.",
      bullets: ["Check the origin and destination.", "Do not judge this like a purchase."],
    };
  }

  const budget = Number(selectedCategoryRow?.budget || 0);
  const forecast = Number(selectedCategoryRow?.forecast || 0);
  const visits = Number(insight?.visits || 1);
  const avg = Number(insight?.avg || tx.amount || 0);
  const fixedObligation = isBillManagedTransaction(tx);

  if (fixedObligation && budget > 0 && forecast <= budget) {
    return {
      tone: "amber",
      label: "Fixed obligation",
      reason:
        "This spend is required. The category system around it matters more than the purchase itself.",
      bullets: ["Protect this lane first.", "Reduce optional purchases around it."],
    };
  }

  if (!budget || selectedCategoryRow?.status === "No budget") {
    return {
      tone: "red",
      label: "Bad purchase",
      reason: "This category is absorbing money without a budget guardrail.",
      bullets: ["Set a budget for this category.", "Decide if this merchant belongs somewhere tighter."],
    };
  }

  if (
    selectedCategoryRow?.status === "Over" ||
    tx.amount > Math.max(avg * 1.35, budget * 0.35) ||
    visits >= 4
  ) {
    return {
      tone: "red",
      label: "Bad purchase",
      reason:
        "This row is creating pressure. Either the category is stretched, the merchant repeats too often, or the ticket was too large.",
      bullets: ["Cut a similar purchase this period.", "Move money on purpose if you keep it."],
    };
  }

  if (selectedCategoryRow?.status === "Near") {
    return {
      tone: "amber",
      label: "Watch it",
      reason: "This purchase still fits, but the category is getting close to the edge.",
      bullets: ["Do not repeat it casually.", "Watch the next purchase in this lane."],
    };
  }

  return {
    tone: "green",
    label: "Good purchase",
    reason: "The purchase stayed inside the current lane and did not create obvious pressure.",
    bullets: ["This fits the present plan.", "Keep repeating only while the lane stays controlled."],
  };
}

export function MerchantMark({ merchant, size = "md" }) {
  const preset = merchantPresetForName(merchant);
  return (
    <div
      className={cx(
        styles.merchantMark,
        styles[`merchantMark_${preset.tone}`],
        size === "lg" ? styles.merchantMarkLg : ""
      )}
      title={preset.name || merchant || "Merchant"}
    >
      {preset.label}
    </div>
  );
}

export function Pill({ children, tone = "neutral" }) {
  return <span className={cx(styles.pill, styles[`pill_${tone}`])}>{children}</span>;
}

export function ActionBtn({
  children,
  onClick,
  variant = "subtle",
  full = false,
  type = "button",
  disabled = false,
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        styles.actionBtn,
        styles[`actionBtn_${variant}`],
        full ? styles.actionBtnFull : ""
      )}
    >
      {children}
    </button>
  );
}

function SectionHeader({ title, subcopy, right }) {
  return (
    <div className={styles.sectionHeader}>
      <div>
        <div className={styles.sectionTitle}>{title}</div>
        {subcopy ? <div className={styles.sectionSub}>{subcopy}</div> : null}
      </div>
      {right ? <div className={styles.sectionRight}>{right}</div> : null}
    </div>
  );
}

function EmptyCard({ title, body, action }) {
  return (
    <div className={styles.emptyCard}>
      <div className={styles.emptyCardTitle}>{title}</div>
      <div className={styles.emptyCardBody}>{body}</div>
      {action ? <div className={styles.emptyAction}>{action}</div> : null}
    </div>
  );
}

function InsightStat({ label, value, subcopy, tone = "neutral" }) {
  return (
    <div className={cx(styles.insightStat, toneClass(tone))}>
      <span>{label}</span>
      <strong>{value}</strong>
      {subcopy ? <div className={styles.insightStatSub}>{subcopy}</div> : null}
    </div>
  );
}

function ReceiptAttachmentCard({ receipt, itemCount = 0, compact = false }) {
  const when = receipt?.capturedAt || receipt?.createdAt;
  const dateLabel = when
    ? new Date(when).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "Stored";

  return (
    <div className={cx(styles.receiptAttachmentCard, compact ? styles.receiptAttachmentCardCompact : "")}>
      <div className={styles.receiptAttachmentTop}>
        <div>
          <div className={styles.receiptAttachmentName}>{receipt.fileName || "Receipt"}</div>
          <div className={styles.receiptAttachmentMeta}>
            {dateLabel} · {formatFileSize(receipt.fileSize)} · {itemCount} line items
          </div>
        </div>
        <Pill tone="blue">{receipt.receiptStatus || "attached"}</Pill>
      </div>

      <div className={styles.metricStripCompact}>
        <div className={styles.metricCompact}>
          <span>Total</span>
          <strong>{receipt.receiptTotal != null ? money(receipt.receiptTotal) : "—"}</strong>
        </div>
        <div className={styles.metricCompact}>
          <span>Need</span>
          <strong>{money(receipt.spentNeededTotal || 0)}</strong>
        </div>
        <div className={styles.metricCompact}>
          <span>Want/Waste</span>
          <strong>
            {money((receipt.spentWantedTotal || 0) + (receipt.spentWasteTotal || 0))}
          </strong>
        </div>
        <div className={styles.metricCompact}>
          <span>Review</span>
          <strong>{money(receipt.spentReviewTotal || 0)}</strong>
        </div>
      </div>

      {receipt.previewUrl ? (
        <a className={styles.textLink} href={receipt.previewUrl} target="_blank" rel="noreferrer">
          Open stored file
        </a>
      ) : null}
    </div>
  );
}

function ReceiptItemList({ selectedReceipts, selectedReceiptItemsByReceiptId, compact = false }) {
  const allItems = selectedReceipts.flatMap(
    (receipt) => selectedReceiptItemsByReceiptId.get(receipt.id) || []
  );

  if (!allItems.length) return null;

  return (
    <div className={styles.receiptReviewList}>
      {allItems.map((item) => (
        <div key={item.id} className={cx(styles.receiptReviewRow, compact ? styles.receiptReviewRowCompact : "") }>
          <div>
            <div className={styles.receiptReviewName}>{item.itemName}</div>
            <div className={styles.receiptReviewMeta}>
              Qty {item.quantity} · {item.unitPrice != null ? money(item.unitPrice) : "—"} each
            </div>
            {!compact ? (
              <div className={styles.receiptReviewTags}>
                <Pill tone={classificationTone(item.classification)}>{item.classification}</Pill>
                <Pill tone={item.priceSignal === "good" ? "green" : item.priceSignal === "high" ? "red" : item.priceSignal === "fair" ? "amber" : "blue"}>
                  {item.priceSignal === "high" ? "high price" : item.priceSignal === "good" ? "good price" : item.priceSignal || "neutral"}
                </Pill>
                {item.coachFlag && item.coachFlag !== "normal" ? (
                  <Pill tone={item.coachFlag === "overspent" || item.coachFlag === "stop" ? "red" : item.coachFlag === "good-price" ? "green" : "amber"}>
                    {item.coachFlag.replace("-", " ")}
                  </Pill>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className={styles.receiptReviewRight}>
            {compact ? <Pill tone={classificationTone(item.classification)}>{item.classification}</Pill> : null}
            <strong>{money(item.lineTotal)}</strong>
          </div>
        </div>
      ))}
    </div>
  );
}

function ModeTabs({ mode, setMode }) {
  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: Wallet },
    { id: "breakdown", label: "Transaction Breakdown", icon: ArrowLeftRight },
    { id: "receipt", label: "Receipt Lab", icon: Camera },
    { id: "coach", label: "Coach", icon: PiggyBank },
  ];
  return (
    <div className={styles.modeTabs}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            className={cx(styles.modeTab, mode === tab.id ? styles.modeTabActive : "")}
            onClick={() => setMode(tab.id)}
          >
            <Icon size={14} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function CompactReceiptTile({
  hasReceipt,
  receipts,
  selectedReceiptItemsByReceiptId,
  onOpen,
}) {
  const allItems = receipts.flatMap((receipt) => selectedReceiptItemsByReceiptId.get(receipt.id) || []);
  const total = receipts.reduce((sum, receipt) => sum + (Number(receipt.receiptTotal) || 0), 0);

  return (
    <button type="button" className={styles.compactReceiptTile} onClick={onOpen}>
      <div className={styles.compactReceiptIcon}>
        <Camera size={16} />
      </div>
      <div className={styles.compactReceiptBody}>
        <div className={styles.compactReceiptTitle}>{hasReceipt ? "Receipt attached" : "Add receipt"}</div>
        <div className={styles.compactReceiptCopy}>
          {hasReceipt
            ? `${allItems.length} items · ${money(total)} total`
            : "Tap to scan or upload and open the receipt breakdown."}
        </div>
      </div>
      <div className={styles.compactReceiptMeta}>
        <Pill tone={hasReceipt ? "green" : "blue"}>{hasReceipt ? "View" : "Camera"}</Pill>
      </div>
    </button>
  );
}

function ReceiptLabPane({
  selectedTx,
  selectedReceipts,
  selectedReceiptItemsByReceiptId,
  onOpenReceipt,
}) {
  const hasReceipt = selectedReceipts.length > 0;
  const allItems = selectedReceipts.flatMap((receipt) => selectedReceiptItemsByReceiptId.get(receipt.id) || []);
  const need = allItems
    .filter((item) => item.classification === "need")
    .reduce((sum, item) => sum + (Number(item.lineTotal) || 0), 0);
  const wantWaste = allItems
    .filter((item) => item.classification === "want" || item.classification === "waste")
    .reduce((sum, item) => sum + (Number(item.lineTotal) || 0), 0);

  return (
    <div className={styles.workspaceBody}>
      <div className={styles.workspaceGridReceipt}>
        <div className={styles.storyCard}>
          <SectionHeader
            title="Receipt breakdown"
            subcopy="Camera-first receipt intake with expandable detail."
            right={
              <ActionBtn variant="primary" onClick={onOpenReceipt}>
                <Camera size={14} />
                {hasReceipt ? "Open receipt" : "Add receipt"}
              </ActionBtn>
            }
          />

          <CompactReceiptTile
            hasReceipt={hasReceipt}
            receipts={selectedReceipts}
            selectedReceiptItemsByReceiptId={selectedReceiptItemsByReceiptId}
            onOpen={onOpenReceipt}
          />

          {hasReceipt ? (
            <div className={styles.receiptMiniGrid}>
              {selectedReceipts.slice(0, 1).map((receipt) => (
                <ReceiptAttachmentCard
                  key={receipt.id}
                  receipt={receipt}
                  itemCount={(selectedReceiptItemsByReceiptId.get(receipt.id) || []).length}
                  compact
                />
              ))}
            </div>
          ) : (
            <div className={styles.receiptEmptyHint}>
              <div className={styles.helperListItem}>
                Tap the camera tile to add the receipt for this transaction.
              </div>
            </div>
          )}
        </div>

        <div className={styles.storyCard}>
          <SectionHeader
            title="Receipt signal"
            subcopy="Tight read on what the attached receipt is saying."
          />
          <div className={styles.receiptSignalGrid}>
            <InsightStat label="Status" value={hasReceipt ? "Attached" : "Missing"} subcopy="Receipt state" tone={hasReceipt ? "green" : "amber"} />
            <InsightStat label="Items" value={String(allItems.length)} subcopy="Extracted line items" tone="blue" />
            <InsightStat label="Need" value={money(need)} subcopy="Necessary items" tone="green" />
            <InsightStat label="Want/Waste" value={money(wantWaste)} subcopy="Coach focus later" tone="amber" />
          </div>
        </div>
      </div>

      <div className={styles.storyCard}>
        <SectionHeader title="Item preview" subcopy="Small preview here. Full breakdown opens when you click the receipt tile." />
        {hasReceipt ? (
          <ReceiptItemList
            selectedReceipts={selectedReceipts}
            selectedReceiptItemsByReceiptId={selectedReceiptItemsByReceiptId}
            compact
          />
        ) : (
          <EmptyCard
            title="No receipt attached"
            body="Keep the landing page clean. Add the receipt and the full breakdown opens in a focused window instead of dumping a giant box here."
            action={
              <ActionBtn variant="primary" onClick={onOpenReceipt}>
                <Camera size={14} />
                Add receipt
              </ActionBtn>
            }
          />
        )}
      </div>
    </div>
  );
}

function SpendCoachPane({
  selectedTx,
  selectedBudget,
  selectedForecast,
  selectedReceipts,
  selectedReceiptItemsByReceiptId,
  visibleTransactions,
  categoriesById,
}) {
  const accountTxs = visibleTransactions.filter(
    (tx) => tx.type === "expense" && tx.accountId && tx.accountId === selectedTx?.accountId
  );
  const accountSpend = accountTxs.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
  const totalVisibleExpense = visibleTransactions
    .filter((tx) => tx.type === "expense")
    .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
  const accountShare = totalVisibleExpense > 0 ? accountSpend / totalVisibleExpense : 0;
  const categoryName = categoriesById.get(selectedTx?.categoryId)?.name || "Uncategorized";
  const receiptItems = selectedReceipts.flatMap((receipt) => selectedReceiptItemsByReceiptId.get(receipt.id) || []);
  const hotItems = receiptItems.filter((item) => item.coachFlag === "overspent" || item.coachFlag === "stop" || item.classification === "waste");
  const goodItems = receiptItems.filter((item) => item.coachFlag === "good-price");
  const wantItems = receiptItems.filter((item) => item.classification === "want");

  const warnings = [];
  if (selectedBudget <= 0) warnings.push("No budget guardrail on this category yet.");
  if (selectedBudget > 0 && selectedForecast > selectedBudget) {
    warnings.push(`This category is over by ${money(selectedForecast - selectedBudget)}.`);
  }
  if ((selectedTx?.amount || 0) >= 250) warnings.push("This is a large ticket. Slow down before repeating it.");
  if (!selectedReceipts.length) warnings.push("No receipt attached. You are missing product-level detail.");
  if (accountTxs.length >= 4 || accountShare >= 0.45) {
    warnings.push(`${selectedTx?.accountName || "This account"} is carrying too much visible spend right now.`);
  }
  if (isBillManagedTransaction(selectedTx)) {
    warnings.push("This purchase came from the bills lane. Do not casually stack optional spend around it.");
  }
  if (hotItems.length) {
    warnings.push(`${hotItems.length} receipt item${hotItems.length > 1 ? "s look" : " looks"} overpriced or wasteful.`);
  }

  return (
    <div className={styles.workspaceBody}>
      <div className={styles.workspaceGridCoach}>
        <div className={styles.storyCard}>
          <SectionHeader title="Stop bleeding" subcopy="This is the blunt lane. What needs attention first." />
          <div className={styles.coachLead}>
            <div className={styles.coachLeadTitle}>
              {warnings[0] || "No immediate damage signal in the current view."}
            </div>
            <div className={styles.coachLeadCopy}>
              {hotItems.length
                ? `${hotItems.length} receipt item${hotItems.length > 1 ? "s are" : " is"} marked as overspent / waste automatically.`
                : "This page is looking for over-budget lanes, overpriced items, waste flags, and account concentration."}
            </div>
          </div>
          <div className={styles.helperList}>
            {warnings.length ? warnings.map((warning) => (
              <div key={warning} className={styles.helperListItem}>{warning}</div>
            )) : <div className={styles.helperListItem}>Nothing is screaming red in this view.</div>}
          </div>
        </div>

        <div className={styles.storyCard}>
          <SectionHeader title="Pressure read" subcopy="Current lane and account strain." />
          <div className={styles.coachStatsGrid}>
            <InsightStat label="Category" value={categoryName} subcopy="Active lane" tone="blue" />
            <InsightStat label="Forecast" value={money(selectedForecast)} subcopy={selectedBudget > 0 ? `Budget ${money(selectedBudget)}` : "No budget"} tone={selectedBudget > 0 && selectedForecast > selectedBudget ? "red" : "green"} />
            <InsightStat label="Account share" value={`${Math.round(accountShare * 100)}%`} subcopy="Of visible expense" tone={accountShare >= 0.45 ? "amber" : "blue"} />
            <InsightStat label="Receipt" value={selectedReceipts.length ? "Attached" : "Missing"} subcopy="Product-level detail" tone={selectedReceipts.length ? "green" : "amber"} />
          </div>
        </div>
      </div>

      <div className={styles.storyGridWide}>
        <div className={styles.storyCard}>
          <SectionHeader title="Auto item coach" subcopy="This is what the receipt itself is saying." />
          <div className={styles.helperList}>
            {hotItems.length ? hotItems.slice(0, 4).map((item) => (
              <div key={item.id} className={styles.helperListItem}>
                {item.itemName} · {money(item.lineTotal)} · {item.coachFlag === "stop" ? "waste" : "overspent"}
              </div>
            )) : <div className={styles.helperListItem}>No auto-flagged overspent / waste items in the selected receipt.</div>}
            {goodItems.length ? <div className={styles.helperListItem}>{goodItems.length} item{goodItems.length > 1 ? "s look" : " looks"} like a good price.</div> : null}
            {wantItems.length ? <div className={styles.helperListItem}>{wantItems.length} item{wantItems.length > 1 ? "s are" : " is"} tagged as wants.</div> : null}
          </div>
        </div>

        <div className={styles.storyCard}>
          <SectionHeader title="What to do next" subcopy="Actual action queue." />
          <div className={styles.helperList}>
            <div className={styles.helperListItem}>Cut the next optional purchase in this lane if the forecast stays over budget.</div>
            <div className={styles.helperListItem}>Use Receipt Lab to verify the OCR if any item looks wrong.</div>
            <div className={styles.helperListItem}>Let the coach auto-tags do the first pass, then only override what is clearly wrong.</div>
          </div>
        </div>
      </div>
    </div>
  );
}


function formatRailAccountLine(tx) {
  if (!tx) return "Account";
  if (tx.type === "transfer") {
    const from = tx.accountName || tx.account || "From account";
    const to = tx.transferAccountName || "To account";
    return `${from} → ${to}`;
  }
  const account = tx.accountName || tx.account || "Account";
  const category = tx.categoryName || "";
  return category ? `${account} · ${category}` : account;
}

function NotificationBell({ notifications = [], onOpenTarget }) {
  const [open, setOpen] = React.useState(false);
  const unreadCount = notifications.filter((item) => item.tone !== "green").length;

  React.useEffect(() => {
    function handleClick(event) {
      if (!event.target.closest?.(`.${styles.notificationWrap}`)) {
        setOpen(false);
      }
    }
    if (open) window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [open]);

  return (
    <div className={styles.notificationWrap}>
      <button type="button" className={styles.notificationButton} onClick={() => setOpen((v) => !v)}>
        <Wallet size={15} />
        {unreadCount > 0 ? <span className={styles.notificationBadge}>{unreadCount}</span> : null}
      </button>

      {open ? (
        <div className={styles.notificationMenu}>
          <div className={styles.notificationMenuHeader}>Alerts</div>
          <div className={styles.notificationMenuList}>
            {notifications.map((item) => (
              <button
                key={item.id}
                type="button"
                className={styles.notificationItem}
                onClick={() => {
                  setOpen(false);
                  onOpenTarget?.(item.target || "dashboard");
                }}
              >
                <span className={cx(styles.notificationTone, styles[`pill_${item.tone || "neutral"}`])} />
                <div className={styles.notificationCopy}>
                  <strong>{item.title}</strong>
                  <span>{item.body}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CategoryMixCard({ rows = [] }) {
  const positiveRows = rows.filter((row) => Number(row.forecast) > 0).slice(0, 5);
  const total = positiveRows.reduce((sum, row) => sum + Number(row.forecast || 0), 0);
  const fallback = "conic-gradient(from 220deg, rgba(106,138,255,0.7) 0 100%)";
  let cursor = 0;
  const colors = [
    'rgba(122, 150, 255, 0.95)',
    'rgba(104, 214, 180, 0.92)',
    'rgba(255, 180, 116, 0.92)',
    'rgba(255, 125, 125, 0.92)',
    'rgba(188, 146, 255, 0.92)',
  ];
  const stops = positiveRows.map((row, index) => {
    const pct = total > 0 ? (Number(row.forecast || 0) / total) * 100 : 0;
    const start = cursor;
    cursor += pct;
    return `${colors[index % colors.length]} ${start}% ${cursor}%`;
  });
  const gradient = stops.length ? `conic-gradient(from 220deg, ${stops.join(', ')})` : fallback;

  return (
    <div className={styles.mixWrap}>
      <div className={styles.mixDonut} style={{ background: gradient }}>
        <div className={styles.mixDonutInner}>
          <strong>{positiveRows.length || 0}</strong>
          <span>lanes</span>
        </div>
      </div>
      <div className={styles.mixLegend}>
        {positiveRows.length ? positiveRows.map((row, index) => (
          <div key={row.categoryId} className={styles.mixLegendRow}>
            <span className={styles.mixDot} style={{ background: colors[index % colors.length] }} />
            <span>{row.category.name}</span>
            <strong>{money(row.forecast)}</strong>
          </div>
        )) : <div className={styles.helperListItem}>No visible category pressure yet.</div>}
      </div>
    </div>
  );
}

function DashboardOverviewPane({ totals, expenseTrend, forecastRemaining, totalsByCategory, topMerchants, selectedTx, selectedReceipts, onStartReceiptDraft, onOpenReceiptViewer, onOpenComposer }) {
  const overCount = totalsByCategory.filter((row) => row.budget > 0 && row.forecast > row.budget).length;
  const receiptMissing = selectedTx ? !selectedReceipts.length : true;
  const receiptAction = selectedTx
    ? selectedReceipts.length
      ? onOpenReceiptViewer
      : () => onStartReceiptDraft(selectedTx)
    : onOpenComposer;

  return (
    <div className={styles.workspaceBody}>
      <div className={styles.workspaceHeaderCompact}>
        <div>
          <div className={styles.workspaceTitle}>Dashboard</div>
          <div className={styles.workspaceSub}>This is the command view. It should feel alive, not like one transaction took over the page.</div>
        </div>
        <div className={styles.inlineActions}>
          <ActionBtn onClick={receiptAction}><Camera size={14} />{selectedTx ? (selectedReceipts.length ? 'Open receipt' : 'Add receipt') : 'Add receipt'}</ActionBtn>
          <ActionBtn variant="primary" onClick={onOpenComposer}><Plus size={14} />Add spend</ActionBtn>
        </div>
      </div>

      <div className={styles.dashboardGrid}>
        <div className={styles.boardCard}>
          <SectionHeader title="Category mix" subcopy="Where the visible money is going right now." />
          <CategoryMixCard rows={totalsByCategory} />
        </div>

        <div className={styles.boardCard}>
          <SectionHeader title="Pressure board" subcopy="High-level status instead of one selected purchase." />
          <div className={styles.coachStatsGrid}>
            <InsightStat label="Spent" value={money(totals.expense)} subcopy={`${expenseTrend.value} vs prior`} tone="red" />
            <InsightStat label="Forecast left" value={money(forecastRemaining)} subcopy="Budget room left" tone={forecastRemaining < 0 ? 'red' : 'green'} />
            <InsightStat label="Over lanes" value={String(overCount)} subcopy="Categories over budget" tone={overCount ? 'amber' : 'green'} />
            <InsightStat label="Receipt focus" value={receiptMissing ? 'Missing' : 'Attached'} subcopy="Selected row receipt state" tone={receiptMissing ? 'amber' : 'green'} />
          </div>
        </div>

        <div className={styles.boardCard}>
          <SectionHeader title="Merchant pressure" subcopy="Top places draining the period." />
          <MerchantRadar rows={topMerchants.slice(0, 5)} />
        </div>

        <div className={styles.boardCard}>
          <SectionHeader title="Command notes" subcopy="What this page is for." />
          <div className={styles.helperList}>
            <div className={styles.helperListItem}>Dashboard is overview first.</div>
            <div className={styles.helperListItem}>Transaction Breakdown is where a clicked row becomes the main subject.</div>
            <div className={styles.helperListItem}>Receipt Lab is where AWS OCR lives.</div>
            <div className={styles.helperListItem}>Coach is where the blunt warnings live.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TopStrip({ totals, expenseTrend, forecastRemaining, period, setPeriod, onOpenComposer, onOpenControls, search, setSearch, activePage, setActivePage, notifications }) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const pages = [
    { id: "dashboard", label: "Dashboard" },
    { id: "breakdown", label: "Transaction Breakdown" },
    { id: "receipt", label: "Receipt Lab" },
    { id: "coach", label: "Coach" },
  ];

  return (
    <div className={styles.topShell}>
      <div className={styles.topBar}>
        <div className={styles.topBrandWrap}>
          <div className={styles.eyebrow}>Money / Spending</div>
          <h1 className={styles.pageTitle}>Spending</h1>
        </div>

        <div className={styles.topSearchBox}>
          <Search size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search merchants, notes, categories, accounts, amounts, dates, receipts, tags..."
          />
          {search ? (
            <button type="button" className={styles.iconButton} onClick={() => setSearch("")}>
              <X size={12} />
            </button>
          ) : null}
        </div>

        <div className={styles.topActions}>
          <NotificationBell notifications={notifications} onOpenTarget={setActivePage} />
          <ActionBtn variant="primary" onClick={onOpenComposer}><Plus size={14} />New</ActionBtn>
        </div>
      </div>

      <div className={styles.kpiRow}>
        <div className={styles.kpiCard}>
          <span>Spent</span>
          <strong>{money(totals.expense)}</strong>
          <small>{expenseTrend.value} vs prior</small>
        </div>
        <div className={styles.kpiCard}>
          <span>Income</span>
          <strong>{money(totals.income)}</strong>
          <small>Money landed</small>
        </div>
        <div className={styles.kpiCard}>
          <span>Planned</span>
          <strong>{money(totals.plannedExpense)}</strong>
          <small>Pending pressure</small>
        </div>
        <div className={styles.kpiCard}>
          <span>Forecast</span>
          <strong className={totals.forecastNet < 0 ? styles.textRed : styles.textGreen}>{money(totals.forecastNet)}</strong>
          <small>{money(forecastRemaining)} left</small>
        </div>
      </div>

      <div className={styles.pageNavRow}>
        <div className={styles.modeTabs}>
          {pages.map((page) => (
            <button key={page.id} type="button" className={cx(styles.modeTab, activePage === page.id ? styles.modeTabActive : "")} onClick={() => setActivePage(page.id)}>
              {page.label}
            </button>
          ))}
        </div>

        <div className={styles.topTools}>
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className={styles.topSelect}>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="year">This Year</option>
          </select>
          <div className={styles.actionMenuWrap}>
            <button type="button" className={styles.iconButton} onClick={() => setMenuOpen((v) => !v)}>
              <MoreHorizontal size={14} />
            </button>
            {menuOpen ? (
              <div className={styles.actionMenu}>
                <button type="button" className={styles.actionMenuItem} onClick={() => { setMenuOpen(false); onOpenComposer?.(); }}>
                  <Plus size={14} /> New transaction
                </button>
                <button type="button" className={styles.actionMenuItem} onClick={() => { setMenuOpen(false); onOpenControls?.(); }}>
                  <PiggyBank size={14} /> Controls
                </button>
                <button type="button" className={styles.actionMenuItem} onClick={() => { setMenuOpen(false); setSearch?.(""); }}>
                  <X size={14} /> Clear search
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function FeedPane({
  typeFilter,
  setTypeFilter,
  categoryFilter,
  setCategoryFilter,
  groupFilter,
  setGroupFilter,
  categories,
  groups,
  transactions,
  plannedItems,
  receiptCountsByTransaction,
  selectedRecord,
  onSelect,
}) {
  const [filtersOpen, setFiltersOpen] = React.useState(false);

  return (
    <GlassPane tone="neutral" size="card" className={styles.feedPane}>
      <SectionHeader
        title="Transaction rail"
        subcopy="Fast scan list with compact rows."
        right={<Pill tone="blue">{transactions.length + plannedItems.length}</Pill>}
      />

      <div className={styles.inlineActions}>
        <ActionBtn onClick={() => setFiltersOpen((prev) => !prev)}>
          <SlidersHorizontal size={14} />
          Filters
        </ActionBtn>
      </div>

      {filtersOpen ? (
        <div className={styles.filterPanel}>
          <div className={styles.filterGrid}>
            <div className={styles.fieldBlock}>
              <label className={styles.fieldLabel}>Type</label>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={styles.field}>
                <option value="all">All types</option>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
                <option value="transfer">Transfer</option>
              </select>
            </div>
            <div className={styles.fieldBlock}>
              <label className={styles.fieldLabel}>Category</label>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={styles.field}>
                <option value="all">All categories</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </div>
            <div className={styles.fieldBlock}>
              <label className={styles.fieldLabel}>Group</label>
              <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className={styles.field}>
                {groups.map((group) => <option key={group} value={group}>{group}</option>)}
              </select>
            </div>
          </div>
        </div>
      ) : null}

      <div className={styles.feedList}>
        {transactions.map((tx) => {
          const selected = selectedRecord.kind === "tx" && selectedRecord.id === tx.id;
          const tone = toneForType(tx.type);
          const Icon = iconForType(tx.type);
          const receiptCount = receiptCountsByTransaction?.get(String(tx.id)) || 0;

          return (
            <button key={tx.id} type="button" className={cx(styles.feedRow, selected ? styles.feedRowActive : "")} onClick={() => onSelect({ kind: "tx", id: tx.id })}>
              <MerchantMark merchant={tx.merchant || tx.note || tx.type} />
              <div className={styles.feedMain}>
                <div className={styles.feedTop}>
                  <div className={styles.feedTitle}>
                    <span className={styles.feedName}>{tx.merchant || tx.note || tx.type}</span>
                    <span className={styles.feedMicro}>{formatRailAccountLine(tx)}</span>
                  </div>
                  <div className={styles.feedRight}>
                    {receiptCount > 0 ? <span className={styles.feedBadge}><Receipt size={11} />{receiptCount}</span> : null}
                    <div className={cx(styles.feedAmount, styles[`feedAmount_${tone}`])}>{money(tx.amount)}</div>
                  </div>
                </div>
                <div className={styles.feedMeta}>
                  <Icon size={12} />
                  {shortDate(tx.date)} · {fmtTime(tx.time)} · {tx.type}
                  {tx.paymentMethod ? ` · ${tx.paymentMethod}` : ""}
                  {isBillManagedTransaction(tx) ? " · bills-owned" : ""}
                </div>
              </div>
            </button>
          );
        })}

        {plannedItems.length ? <div className={styles.feedDivider}>Planned items</div> : null}

        {plannedItems.map((item) => {
          const selected = selectedRecord.kind === "planned" && selectedRecord.id === item.id;
          return (
            <button key={item.id} type="button" className={cx(styles.feedRow, selected ? styles.feedRowActive : "")} onClick={() => onSelect({ kind: "planned", id: item.id })}>
              <div className={cx(styles.merchantMark, styles.merchantMark_amber)}><Receipt size={15} /></div>
              <div className={styles.feedMain}>
                <div className={styles.feedTop}>
                  <div className={styles.feedTitle}>
                    <span className={styles.feedName}>{item.merchant || item.note || "Planned item"}</span>
                    <span className={styles.feedMicro}>planned pressure</span>
                  </div>
                  <div className={cx(styles.feedAmount, styles.feedAmount_amber)}>{money(item.amount)}</div>
                </div>
                <div className={styles.feedMeta}><Receipt size={12} />{shortDate(item.date)} · {fmtTime(item.time)}</div>
              </div>
            </button>
          );
        })}

        {!transactions.length && !plannedItems.length ? <EmptyCard title="Nothing here" body="No rows match the current filters." /> : null}
      </div>
    </GlassPane>
  );
}

function SelectedTransactionHero({ selectedTx, verdict }) {
  return (
    <div className={styles.heroCard}>
      <div className={styles.heroTop}>
        <div className={styles.heroIdentity}>
          <MerchantMark merchant={selectedTx.merchant || selectedTx.note || selectedTx.type} size="lg" />
          <div className={styles.heroText}>
            <div className={styles.heroName}>{selectedTx.merchant || selectedTx.note || selectedTx.type}</div>
            <div className={styles.heroMeta}>
              {selectedTx.accountName || selectedTx.account || "Account"} · {shortDate(selectedTx.date)} · {fmtTime(selectedTx.time)}
              {isBillManagedTransaction(selectedTx) ? " · bills-owned" : ""}
            </div>
          </div>
        </div>

        <div className={styles.heroRight}>
          <Pill tone={verdict.tone}>{verdict.label}</Pill>
          <div className={styles.heroAmount}>{money(selectedTx.amount)}</div>
        </div>
      </div>

      <div className={styles.heroReason}>{verdict.reason}</div>

      <div className={styles.heroTagRow}>
        {verdict.bullets.map((item) => (
          <span key={item} className={styles.softTag}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

export function MainWorkspacePane({
  mode,
  setMode,
  selectedTx,
  selectedPlanned,
  categoriesById,
  visibleTransactions,
  selectedCategory,
  selectedBudget,
  selectedSpent,
  selectedPlannedTotal,
  selectedForecast,
  selectedLoadPct,
  selectedReceipts,
  selectedReceiptItemsByReceiptId,
  topMerchants,
  totals,
  expenseTrend,
  forecastRemaining,
  totalsByCategory,
  onStartReceiptDraft,
  onOpenReceiptViewer,
  onDuplicateTransaction,
  onDeleteTransaction,
  onOpenComposer,
  onOpenControls,
  onConvertPlanned,
  onDeletePlanned,
  convertAccountId,
  setConvertAccountId,
  accounts,
}) {
  const [actionOpen, setActionOpen] = React.useState(false);

  if (selectedPlanned) {
    const category = categoriesById.get(selectedPlanned.categoryId) || null;
    return (
      <GlassPane tone="neutral" size="card" className={styles.workspacePane}>
        <div className={styles.workspaceHeaderCompact}>
          <div>
            <div className={styles.workspaceTitle}>Planned item</div>
            <div className={styles.workspaceSub}>Convert or delete future pressure here.</div>
          </div>
        </div>
        <div className={styles.heroCard}>
          <div className={styles.heroTop}>
            <div className={styles.heroIdentity}>
              <div className={cx(styles.merchantMark, styles.merchantMark_amber, styles.merchantMarkLg)}><Receipt size={18} /></div>
              <div className={styles.heroText}>
                <div className={styles.heroName}>{selectedPlanned.merchant || selectedPlanned.note || "Planned item"}</div>
                <div className={styles.heroMeta}>{shortDate(selectedPlanned.date)} · {fmtTime(selectedPlanned.time)} · {category?.name || "Uncategorized"}</div>
              </div>
            </div>
            <div className={styles.heroAmount}>{money(selectedPlanned.amount)}</div>
          </div>
        </div>
        <div className={styles.storyGrid}>
          <div className={styles.storyCard}>
            <SectionHeader title="Convert to real spend" subcopy="Choose the account that should absorb this purchase." />
            <div className={styles.fieldBlock}>
              <label className={styles.fieldLabel}>To account</label>
              <select className={styles.field} value={convertAccountId} onChange={(e) => setConvertAccountId(e.target.value)}>
                {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
            </div>
            <div className={styles.inlineActions}>
              <ActionBtn variant="primary" onClick={onConvertPlanned}><Wallet size={14} />Convert</ActionBtn>
              <ActionBtn variant="danger" onClick={onDeletePlanned}><Trash2 size={14} />Delete</ActionBtn>
            </div>
          </div>
          <div className={styles.storyCard}>
            <SectionHeader title="Why it matters" subcopy="Planned items still count as future pressure." />
            <div className={styles.helperBlock}>Keep planned pressure visible until it becomes real spend or gets deleted.</div>
          </div>
        </div>
      </GlassPane>
    );
  }

  const insight = merchantInsight(visibleTransactions, categoriesById, selectedTx?.merchant);
  const categoryMeta = selectedCategoryRowMeta(selectedBudget, selectedForecast);
  const verdict = verdictForTransaction(selectedTx, categoryMeta, insight);
  const laneTone = statusTone(categoryMeta.status);
  const categoryRemaining = Number(selectedBudget || 0) - Number(selectedForecast || 0);
  const hasReceipt = selectedReceipts.length > 0;

  return (
    <GlassPane tone="neutral" size="card" className={styles.workspacePane}>
      {mode === "dashboard" ? (
        <DashboardOverviewPane
          totals={totals}
          expenseTrend={expenseTrend}
          forecastRemaining={forecastRemaining}
          totalsByCategory={totalsByCategory}
          topMerchants={topMerchants}
          selectedTx={selectedTx}
          selectedReceipts={selectedReceipts}
          onStartReceiptDraft={onStartReceiptDraft}
          onOpenReceiptViewer={onOpenReceiptViewer}
          onOpenComposer={onOpenComposer}
        />
      ) : null}

      {mode === "breakdown" ? (
        <>
          <div className={styles.workspaceHeader}>
            <div>
              <div className={styles.workspaceTitle}>Transaction Breakdown</div>
              <div className={styles.workspaceSub}>This is where a clicked row becomes the main subject.</div>
            </div>
            <div className={styles.actionMenuWrap}>
              <button type="button" className={styles.iconButton} onClick={() => setActionOpen((prev) => !prev)}><MoreHorizontal size={14} /></button>
              {actionOpen ? (
                <div className={styles.actionMenu}>
                  <button type="button" className={styles.actionMenuItem} onClick={() => { setActionOpen(false); onDuplicateTransaction(); }}><Copy size={14} /> Duplicate</button>
                  <button type="button" className={styles.actionMenuItem} onClick={() => { setActionOpen(false); hasReceipt ? onOpenReceiptViewer() : onStartReceiptDraft(selectedTx); }}><Camera size={14} /> {hasReceipt ? "Open receipt" : "Add receipt"}</button>
                  <button type="button" className={styles.actionMenuItem} onClick={() => { setActionOpen(false); onOpenControls(); }}><PiggyBank size={14} /> Controls</button>
                  <button type="button" className={styles.actionMenuItemDanger} onClick={() => { setActionOpen(false); onDeleteTransaction(); }}><Trash2 size={14} /> Delete</button>
                </div>
              ) : null}
            </div>
          </div>

          {selectedTx ? <SelectedTransactionHero selectedTx={selectedTx} verdict={verdict} /> : <EmptyCard title="No transaction selected" body="Choose a transaction from the rail." />}

          {selectedTx ? (
            <div className={styles.workspaceBody}>
              <div className={styles.breakdownGrid}>
                <div className={styles.storyCard}>
                  <SectionHeader title="Purchase read" subcopy="What this row says about the purchase." />
                  <div className={styles.breakdownStatGrid}>
                    <InsightStat label="Category" value={selectedCategory?.name || "Uncategorized"} subcopy="Where the purchase landed" tone="blue" />
                    <InsightStat label="Lane status" value={laneTone.label} subcopy={selectedBudget > 0 ? `${money(categoryRemaining)} left` : "No budget yet"} tone={laneTone.tone} />
                    <InsightStat label="Merchant repeat" value={String(insight?.visits || 1)} subcopy={insight ? `avg ${money(insight.avg)}` : "First visible row"} tone={insight?.visits >= 4 ? "red" : insight?.visits >= 2 ? "amber" : "green"} />
                  </div>
                </div>
                <div className={styles.storyCard}>
                  <SectionHeader title="Category pressure" subcopy="How this purchase affects the lane." />
                  <div className={styles.breakdownMetricGrid}>
                    <div className={styles.metricCompact}><span>Spent</span><strong>{money(selectedSpent)}</strong></div>
                    <div className={styles.metricCompact}><span>Planned</span><strong>{money(selectedPlannedTotal)}</strong></div>
                    <div className={styles.metricCompact}><span>Budget</span><strong>{money(selectedBudget)}</strong></div>
                    <div className={styles.metricCompact}><span>Forecast</span><strong>{money(selectedForecast)}</strong></div>
                  </div>
                  <div className={styles.progressTrack}><div className={cx(styles.progressFill, toneClass(laneTone.tone))} style={{ width: `${clamp(selectedLoadPct || 0, 0, 100)}%` }} /></div>
                  <div className={styles.helperText}>{selectedBudget > 0 ? `${money(selectedForecast)} forecast against ${money(selectedBudget)} in this category.` : "This category has no budget guardrail yet."}</div>
                </div>
                <div className={styles.storyCard}>
                  <SectionHeader title="Receipt tile" subcopy="Keep it small and premium unless clicked." />
                  <CompactReceiptTile hasReceipt={hasReceipt} receipts={selectedReceipts} selectedReceiptItemsByReceiptId={selectedReceiptItemsByReceiptId} onOpen={hasReceipt ? onOpenReceiptViewer : () => onStartReceiptDraft(selectedTx)} />
                </div>
                <div className={styles.storyCard}>
                  <SectionHeader title="Merchant behavior" subcopy="What this brand is doing in the current visible history." />
                  <div className={styles.helperList}>
                    <div className={styles.helperListItem}>{insight ? `${insight.visits} visible visits · avg ${money(insight.avg)}` : "No repeat pattern yet."}</div>
                    <div className={styles.helperListItem}>{insight ? `${money(insight.total)} visible in ${insight.topCategory}.` : "Waiting for more history."}</div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {mode === "receipt" ? <ReceiptLabPane selectedTx={selectedTx} selectedReceipts={selectedReceipts} selectedReceiptItemsByReceiptId={selectedReceiptItemsByReceiptId} onOpenReceipt={hasReceipt ? onOpenReceiptViewer : () => onStartReceiptDraft(selectedTx)} /> : null}
      {mode === "coach" ? <SpendCoachPane selectedTx={selectedTx} selectedBudget={selectedBudget} selectedForecast={selectedForecast} selectedReceipts={selectedReceipts} selectedReceiptItemsByReceiptId={selectedReceiptItemsByReceiptId} visibleTransactions={visibleTransactions} categoriesById={categoriesById} /> : null}
    </GlassPane>
  );
}

function ReceiptClassificationToggle({ value, onChange }) {
  const choices = [
    { value: "need", label: "Need" },
    { value: "want", label: "Want" },
    { value: "waste", label: "Waste" },
    { value: "review", label: "Review" },
  ];

  return (
    <div className={styles.classificationToggle}>
      {choices.map((choice) => (
        <button
          key={choice.value}
          type="button"
          className={cx(
            styles.classificationChip,
            value === choice.value ? styles.classificationChipActive : "",
            styles[`classificationChip_${choice.value}`]
          )}
          onClick={() => onChange(choice.value)}
        >
          {choice.label}
        </button>
      ))}
    </div>
  );
}

function ReceiptDraftEditor({
  receiptDraft,
  receiptDraftSummary,
  categories,
  accounts,
  onClearReceiptDraft,
  onReceiptFileChosen,
  onReceiptDraftChange,
  onReceiptDraftAddLine,
  onReceiptDraftUpdateLine,
  onReceiptDraftRemoveLine,
  onSaveReceiptDraft,
  saving,
  ocrRunning,
  ocrError,
  ocrMeta,
  onRetryOcr,
}) {
  return (
    <div className={styles.sheetSections}>
      <div className={styles.receiptWorkbench}>
        <div className={styles.sheetSection}>
          <SectionHeader
            title="Receipt items"
            subcopy="Left side is the actual extracted purchase lines. The system auto-tags need / want / waste and price signals first."
            right={<ActionBtn onClick={onReceiptDraftAddLine}><Plus size={13} />Add line</ActionBtn>}
          />

          <div className={styles.inlineActions}>
            <label className={styles.cameraAction}>
              <input
                className={styles.hiddenInput}
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onReceiptFileChosen(file);
                  e.target.value = "";
                }}
              />
              <Camera size={14} />
              {receiptDraft.file ? "Replace receipt" : "Scan / upload receipt"}
            </label>

            <ActionBtn onClick={onClearReceiptDraft}>
              <X size={13} />
              Clear draft
            </ActionBtn>
          </div>

          {receiptDraft.file || ocrRunning || ocrError || ocrMeta ? (
            <div className={styles.ocrBanner}>
              <div>
                <div className={styles.ocrBannerTitle}>
                  {ocrRunning
                    ? "Scanning receipt with OCR…"
                    : ocrError
                    ? "OCR needs attention"
                    : "OCR scan complete"}
                </div>
                <div className={styles.ocrBannerMeta}>
                  {ocrRunning
                    ? "AWS Textract is reading merchant, totals, and line items now."
                    : ocrError
                    ? ocrError
                    : ocrMeta
                    ? `${ocrMeta.providerLabel || "AWS Textract"} · ${ocrMeta.itemCount || 0} items · ${ocrMeta.summaryFieldCount || 0} summary fields`
                    : "Upload a receipt to start OCR."}
                </div>
              </div>

              {receiptDraft.file && !ocrRunning ? (
                <ActionBtn onClick={onRetryOcr}>
                  <Camera size={13} />
                  Rescan
                </ActionBtn>
              ) : null}
            </div>
          ) : null}

          <div className={styles.formGrid2}>
            <div className={styles.fieldBlock}>
              <label className={styles.fieldLabel}>Merchant</label>
              <input className={styles.field} value={receiptDraft.merchant} onChange={(e) => onReceiptDraftChange("merchant", e.target.value)} placeholder="Walmart, Publix, Shell…" />
            </div>

            <div className={styles.fieldBlock}>
              <label className={styles.fieldLabel}>Date</label>
              <input className={styles.field} type="date" value={receiptDraft.date} onChange={(e) => onReceiptDraftChange("date", e.target.value)} />
            </div>
          </div>

          <div className={styles.formGrid3}>
            <div className={styles.fieldBlock}>
              <label className={styles.fieldLabel}>Account</label>
              <select className={styles.field} value={receiptDraft.accountId} onChange={(e) => onReceiptDraftChange("accountId", e.target.value)}>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.name}</option>
                ))}
              </select>
            </div>

            <div className={styles.fieldBlock}>
              <label className={styles.fieldLabel}>Category</label>
              <select className={styles.field} value={receiptDraft.categoryId} onChange={(e) => onReceiptDraftChange("categoryId", e.target.value)}>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </div>

            <div className={styles.fieldBlock}>
              <label className={styles.fieldLabel}>Method</label>
              <input className={styles.field} value={receiptDraft.paymentMethod} onChange={(e) => onReceiptDraftChange("paymentMethod", e.target.value)} placeholder="Card" />
            </div>
          </div>

          <div className={styles.receiptLineList}>
            {receiptDraft.items.map((item, index) => (
              <div key={item.id} className={styles.receiptLineRow}>
                <div className={styles.receiptLineHeader}>
                  <div className={styles.receiptLineIndex}>Item {index + 1}</div>
                  <button type="button" className={styles.iconButton} onClick={() => onReceiptDraftRemoveLine(item.id)}>
                    <Trash2 size={13} />
                  </button>
                </div>

                <div className={styles.receiptLineGrid}>
                  <div className={styles.fieldBlock}>
                    <label className={styles.fieldLabel}>Item name</label>
                    <input className={styles.field} value={item.itemName} onChange={(e) => onReceiptDraftUpdateLine(item.id, { itemName: e.target.value })} placeholder="Milk, chips, shampoo…" />
                  </div>
                  <div className={styles.fieldBlock}>
                    <label className={styles.fieldLabel}>Qty</label>
                    <input className={styles.field} value={item.quantity} onChange={(e) => onReceiptDraftUpdateLine(item.id, { quantity: e.target.value })} />
                  </div>
                  <div className={styles.fieldBlock}>
                    <label className={styles.fieldLabel}>Unit / line price</label>
                    <input className={styles.field} value={item.unitPrice} onChange={(e) => onReceiptDraftUpdateLine(item.id, { unitPrice: e.target.value })} placeholder="0.00" />
                  </div>
                </div>

                <div className={styles.receiptReviewTags}>
                  <Pill tone={classificationTone(item.classification)}>{item.classification}</Pill>
                  <Pill tone={item.priceSignal === "good" ? "green" : item.priceSignal === "high" ? "red" : item.priceSignal === "fair" ? "amber" : "blue"}>
                    {item.priceSignal === "high" ? "high price" : item.priceSignal === "good" ? "good price" : item.priceSignal || "neutral"}
                  </Pill>
                  {item.coachFlag && item.coachFlag !== "normal" ? (
                    <Pill tone={item.coachFlag === "overspent" || item.coachFlag === "stop" ? "red" : item.coachFlag === "good-price" ? "green" : "amber"}>
                      {item.coachFlag.replace("-", " ")}
                    </Pill>
                  ) : null}
                </div>

                <div className={styles.fieldBlock}>
                  <label className={styles.fieldLabel}>Line note</label>
                  <input className={styles.field} value={item.note || ""} onChange={(e) => onReceiptDraftUpdateLine(item.id, { note: e.target.value })} placeholder="Optional note" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.receiptWorkbenchPreview}>
          <div className={styles.sheetSection}>
            <SectionHeader title="Receipt image" subcopy="Right side is the actual receipt so you can compare the OCR against the source." />
            <div className={styles.receiptPreviewBox}>
              {receiptDraft.previewUrl ? (
                receiptDraft.file?.type?.startsWith("image/") ? (
                  <img src={receiptDraft.previewUrl} alt="Receipt preview" className={styles.receiptPreviewImage} />
                ) : (
                  <div className={styles.receiptPreviewFallback}>
                    <Receipt size={22} />
                    <span>{receiptDraft.fileName || "Receipt PDF"}</span>
                  </div>
                )
              ) : (
                <div className={styles.receiptPreviewFallback}>
                  <Camera size={22} />
                  <span>Add a receipt image or PDF</span>
                </div>
              )}
            </div>

            <div className={styles.receiptTotalsGrid}>
              <div className={styles.receiptTotalCard}><span>Subtotal</span><strong>{money(receiptDraftSummary.subtotal)}</strong></div>
              <div className={styles.receiptTotalCard}><span>Tax</span><strong>{money(receiptDraftSummary.tax)}</strong></div>
              <div className={styles.receiptTotalCard}><span>Total</span><strong>{money(receiptDraftSummary.total)}</strong></div>
              <div className={styles.receiptTotalCard}><span>Items</span><strong>{receiptDraftSummary.count}</strong></div>
            </div>

            <div className={styles.receiptBreakdownList}>
              <div className={styles.breakdownRow}><span>Needed spend</span><strong>{money(receiptDraftSummary.need)}</strong></div>
              <div className={styles.breakdownRow}><span>Wanted spend</span><strong>{money(receiptDraftSummary.want)}</strong></div>
              <div className={styles.breakdownRow}><span>Waste spend</span><strong>{money(receiptDraftSummary.waste)}</strong></div>
              <div className={styles.breakdownRow}><span>Overspent items</span><strong>{money(receiptDraftSummary.overspent)}</strong></div>
              <div className={styles.breakdownRow}><span>Good-price items</span><strong>{money(receiptDraftSummary.goodPrice)}</strong></div>
            </div>

            <ActionBtn variant="primary" full onClick={onSaveReceiptDraft} disabled={saving}>
              <Save size={13} />
              {saving ? "Saving receipt…" : "Save receipt as transaction"}
            </ActionBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

export function QuickAddModal({
  open,
  onClose,
  mode,
  setMode,
  qaType,
  setQaType,
  qaAmount,
  setQaAmount,
  qaDate,
  setQaDate,
  qaTime,
  setQaTime,
  qaCategoryId,
  setQaCategoryId,
  qaMerchant,
  setQaMerchant,
  qaNote,
  setQaNote,
  qaPayment,
  setQaPayment,
  qaAccountId,
  setQaAccountId,
  qaTransferToAccountId,
  setQaTransferToAccountId,
  accounts,
  categories,
  saving,
  onAddNow,
  onAddPlanned,
}) {
  if (!open) return null;

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modalCard}>
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalEyebrow}>New entry</div>
            <div className={styles.modalTitle}>Quick add</div>
          </div>
          <button type="button" className={styles.iconButton} onClick={onClose}><X size={14} /></button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.tabRow}>
            {[
              { value: "now", label: "Now" },
              { value: "planned", label: "Planned" },
            ].map((item) => (
              <button key={item.value} type="button" className={cx(styles.tab, mode === item.value ? styles.tabActive : "")} onClick={() => setMode(item.value)}>
                {item.label}
              </button>
            ))}
          </div>

          <div className={styles.tabRow}>
            {[
              { value: "expense", label: "Expense" },
              { value: "income", label: "Income" },
              { value: "transfer", label: "Transfer" },
            ].map((item) => (
              <button key={item.value} type="button" className={cx(styles.tab, qaType === item.value ? styles.tabActive : "")} onClick={() => setQaType(item.value)}>
                {item.label}
              </button>
            ))}
          </div>

          <div className={styles.formGrid3}>
            <div className={styles.fieldBlock}>
              <label className={styles.fieldLabel}>Amount</label>
              <input className={styles.field} value={qaAmount} onChange={(e) => setQaAmount(e.target.value)} placeholder="0.00" inputMode="decimal" />
            </div>
            <div className={styles.fieldBlock}>
              <label className={styles.fieldLabel}>Date</label>
              <input className={styles.field} type="date" value={qaDate} onChange={(e) => setQaDate(e.target.value)} />
            </div>
            <div className={styles.fieldBlock}>
              <label className={styles.fieldLabel}>Time</label>
              <input className={styles.field} type="time" value={qaTime} onChange={(e) => setQaTime(e.target.value)} />
            </div>
          </div>

          <div className={styles.formGrid3}>
            <div className={styles.fieldBlock}>
              <label className={styles.fieldLabel}>Category</label>
              <select className={styles.field} value={qaCategoryId} onChange={(e) => setQaCategoryId(e.target.value)}>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </div>
            <div className={styles.fieldBlock}>
              <label className={styles.fieldLabel}>From account</label>
              <select className={styles.field} value={qaAccountId} onChange={(e) => setQaAccountId(e.target.value)}>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.name}</option>
                ))}
              </select>
            </div>
            <div className={styles.fieldBlock}>
              <label className={styles.fieldLabel}>Method</label>
              <input className={styles.field} value={qaPayment} onChange={(e) => setQaPayment(e.target.value)} placeholder="Card, ACH, Cash…" />
            </div>
          </div>

          {qaType === "transfer" ? (
            <div className={styles.fieldBlock}>
              <label className={styles.fieldLabel}>To account</label>
              <select className={styles.field} value={qaTransferToAccountId} onChange={(e) => setQaTransferToAccountId(e.target.value)}>
                {accounts.filter((account) => account.id !== qaAccountId).map((account) => (
                  <option key={account.id} value={account.id}>{account.name}</option>
                ))}
              </select>
            </div>
          ) : null}

          <div className={styles.fieldBlock}>
            <label className={styles.fieldLabel}>Merchant / source</label>
            <input className={styles.field} value={qaMerchant} onChange={(e) => setQaMerchant(e.target.value)} placeholder="Merchant or source" />
          </div>

          <div className={styles.fieldBlock}>
            <label className={styles.fieldLabel}>Note</label>
            <textarea className={styles.fieldArea} value={qaNote} onChange={(e) => setQaNote(e.target.value)} rows={4} placeholder="Optional note" />
          </div>
        </div>

        <div className={styles.modalFooter}>
          <ActionBtn onClick={onClose}>Cancel</ActionBtn>
          <ActionBtn variant="primary" onClick={mode === "planned" ? onAddPlanned : onAddNow} disabled={saving}>
            <Plus size={14} />
            {saving ? "Saving…" : mode === "planned" ? "Save planned item" : "Post transaction"}
          </ActionBtn>
        </div>
      </div>
    </div>
  );
}

export function ManageSheet({
  open,
  onClose,
  totalsByCategory,
  budgetEditorCategoryId,
  setBudgetEditorCategoryId,
  budgetEditorValue,
  setBudgetEditorValue,
  budgetMode,
  onSaveBudgetValue,
  newCategoryName,
  setNewCategoryName,
  newCategoryGroup,
  setNewCategoryGroup,
  groups,
  onSaveCategory,
  saving,
}) {
  if (!open) return null;

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modalCard}>
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalEyebrow}>Hidden controls</div>
            <div className={styles.modalTitle}>Category & budget controls</div>
          </div>
          <button type="button" className={styles.iconButton} onClick={onClose}><X size={14} /></button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.storyCard}>
            <SectionHeader title="Budget lane" subcopy={`Adjust budgets for the current ${budgetMode} view.`} />

            <div className={styles.formGrid2}>
              <div className={styles.fieldBlock}>
                <label className={styles.fieldLabel}>Category</label>
                <select className={styles.field} value={budgetEditorCategoryId} onChange={(e) => setBudgetEditorCategoryId(e.target.value)}>
                  {totalsByCategory.map((row) => (
                    <option key={row.categoryId} value={row.categoryId}>{row.category.name}</option>
                  ))}
                </select>
              </div>
              <div className={styles.fieldBlock}>
                <label className={styles.fieldLabel}>Budget value</label>
                <input className={styles.field} value={budgetEditorValue} onChange={(e) => setBudgetEditorValue(e.target.value)} placeholder="0.00" inputMode="decimal" />
              </div>
            </div>

            <ActionBtn variant="primary" onClick={onSaveBudgetValue} disabled={saving}><PiggyBank size={14} />Save budget</ActionBtn>
          </div>

          <div className={styles.storyCard}>
            <SectionHeader title="Add category" subcopy="Expand the system without cluttering the landing page." />

            <div className={styles.formGrid2}>
              <div className={styles.fieldBlock}>
                <label className={styles.fieldLabel}>Category name</label>
                <input className={styles.field} value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Streaming, Childcare, Pets…" />
              </div>
              <div className={styles.fieldBlock}>
                <label className={styles.fieldLabel}>Group</label>
                <select className={styles.field} value={newCategoryGroup} onChange={(e) => setNewCategoryGroup(e.target.value)}>
                  {groups.filter((group) => group !== "All").map((group) => (
                    <option key={group} value={group}>{group}</option>
                  ))}
                </select>
              </div>
            </div>

            <ActionBtn onClick={onSaveCategory} disabled={saving}><Save size={14} />Save category</ActionBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ReceiptDraftModal(props) {
  const { open, onClose } = props;
  if (!open) return null;

  return (
    <div className={styles.modalBackdrop}>
      <div className={cx(styles.modalCard, styles.modalCardWide)}>
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalEyebrow}>Receipt lab</div>
            <div className={styles.modalTitle}>Receipt breakdown</div>
          </div>
          <button type="button" className={styles.iconButton} onClick={onClose}><X size={14} /></button>
        </div>

        <div className={styles.modalBody}>
          <ReceiptDraftEditor {...props} />
        </div>
      </div>
    </div>
  );
}

export function ReceiptViewerModal({
  open,
  onClose,
  selectedTx,
  selectedReceipts,
  selectedReceiptItemsByReceiptId,
  onEditReceipt,
}) {
  if (!open || !selectedTx) return null;

  const allItems = selectedReceipts.flatMap((receipt) => selectedReceiptItemsByReceiptId.get(receipt.id) || []);

  return (
    <div className={styles.modalBackdrop}>
      <div className={cx(styles.modalCard, styles.modalCardWide)}>
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalEyebrow}>Receipt view</div>
            <div className={styles.modalTitle}>{selectedTx.merchant || selectedTx.note || "Receipt"}</div>
          </div>
          <div className={styles.inlineActions}>
            <ActionBtn variant="primary" onClick={onEditReceipt}><Camera size={14} />Edit receipt</ActionBtn>
            <button type="button" className={styles.iconButton} onClick={onClose}><X size={14} /></button>
          </div>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.receiptWorkbench}>
            <div className={styles.sheetSection}>
              <SectionHeader title="Extracted items" subcopy="Left side is the actual line-item read from the receipt." />
              <ReceiptItemList
                selectedReceipts={selectedReceipts}
                selectedReceiptItemsByReceiptId={selectedReceiptItemsByReceiptId}
              />
            </div>

            <div className={styles.receiptWorkbenchPreview}>
              <div className={styles.sheetSection}>
                <SectionHeader title="Receipt image" subcopy="Right side is the source receipt so you can compare it fast." />
                <div className={styles.stackRows}>
                  {selectedReceipts.map((receipt) => (
                    <div key={receipt.id} className={styles.receiptSourceCard}>
                      <ReceiptAttachmentCard
                        receipt={receipt}
                        itemCount={(selectedReceiptItemsByReceiptId.get(receipt.id) || []).length}
                      />
                      {receipt.previewUrl && receipt.isImage ? (
                        <div className={styles.receiptPreviewBox}>
                          <img src={receipt.previewUrl} alt={receipt.fileName || "Receipt"} className={styles.receiptPreviewImage} />
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
                <div className={styles.helperListItem}>{allItems.length} stored line items</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MerchantRadar({ rows }) {
  if (!rows?.length) {
    return <EmptyCard title="No merchant pattern yet" body="Post or load transactions to build merchant behavior." />;
  }

  return (
    <div className={styles.radarList}>
      {rows.map((row) => (
        <div key={row.merchant} className={styles.radarRow}>
          <MerchantMark merchant={row.merchant} />
          <div className={styles.radarMain}>
            <div className={styles.radarTop}>
              <span>{row.merchant}</span>
              <strong>{money(row.total)}</strong>
            </div>
            <div className={styles.radarMeta}>{row.count} visits · avg {money(row.avg)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ToastStack({ status, pageError, onClearError }) {
  if (!status && !pageError) return null;

  return (
    <div className={styles.toastStack}>
      {status ? (
        <div className={cx(styles.toast, styles.toastOk)}>
          <CheckCircle2 size={14} />
          {status}
        </div>
      ) : null}

      {pageError ? (
        <div className={cx(styles.toast, styles.toastError)}>
          <X size={14} />
          {pageError}
          <button type="button" className={styles.iconButton} onClick={onClearError}><X size={12} /></button>
        </div>
      ) : null}
    </div>
  );
}

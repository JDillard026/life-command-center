"use client";

import * as React from "react";
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  Bell,
  Copy,
  MoreHorizontal,
  PiggyBank,
  Plus,
  Receipt,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import GlassPane from "../components/GlassPane";
import {
  fmtTime,
  money,
  shortDate,
  toneForType,
  statusTone,
  isBillManagedTransaction,
} from "./spending.helpers";
import styles from "./SpendingPage.module.css";

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function clampLocal(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function merchantPresetForNameLocal(merchant) {
  const labelSource = String(merchant || "?").trim();
  const first = labelSource.slice(0, 1).toUpperCase() || "?";
  const name = labelSource.toLowerCase();

  let tone = "neutral";
  if (/(walmart|target|publix|costco|aldi|kroger|amazon)/.test(name)) tone = "blue";
  else if (/(shell|chevron|exxon|bp|sunoco|gas)/.test(name)) tone = "amber";
  else if (/(mortgage|rent|loan|insurance|bill|payment|utility)/.test(name)) tone = "red";
  else if (/(payroll|deposit|salary|income)/.test(name)) tone = "green";

  return { label: first, tone };
}

function iconForType(type) {
  if (type === "income") return ArrowUpRight;
  if (type === "transfer") return ArrowLeftRight;
  return ArrowDownRight;
}

export function MerchantMark({ merchant, size = "md" }) {
  const preset = merchantPresetForNameLocal(merchant);
  return (
    <div
      className={cx(
        styles.merchantMark,
        styles[`merchantMark_${preset.tone}`],
        size === "lg" ? styles.merchantMarkLg : ""
      )}
      title={merchant || "Merchant"}
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
      className={cx(styles.actionBtn, styles[`actionBtn_${variant}`], full ? styles.actionBtnFull : "")}
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
    <div className={cx(styles.insightStat, styles[`toneBlock_${tone}`])}>
      <span>{label}</span>
      <strong>{value}</strong>
      {subcopy ? <div className={styles.insightStatSub}>{subcopy}</div> : null}
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

function verdictForTransaction(tx, budgetRow, merchantVisits = 1, merchantAvg = 0) {
  if (!tx) {
    return {
      tone: "neutral",
      label: "No selection",
      reason: "Pick a row from the rail to inspect it.",
      bullets: [],
    };
  }

  if (tx.type === "income") {
    return {
      tone: "green",
      label: "Income event",
      reason: "This adds money instead of taking it away.",
      bullets: ["Money is coming in.", "Judge where it should go next."],
    };
  }

  if (tx.type === "transfer") {
    return {
      tone: "blue",
      label: "Transfer event",
      reason: "This is money movement between accounts, not outside spend.",
      bullets: ["Check source and destination.", "Do not judge it like shopping."],
    };
  }

  let red = 0;
  let amber = 0;

  if (!budgetRow?.budget) red += 1;
  if ((budgetRow?.forecast || 0) > (budgetRow?.budget || 0) && budgetRow?.budget > 0) red += 1;
  if ((budgetRow?.forecast || 0) >= (budgetRow?.budget || 0) * 0.85 && budgetRow?.budget > 0) amber += 1;
  if (merchantVisits >= 4) red += 1;
  if (tx.amount >= Math.max(merchantAvg * 1.35, 120)) amber += 1;
  if (tx.amount >= Math.max(merchantAvg * 1.65, 220)) red += 1;
  if (isBillManagedTransaction(tx)) amber += 1;

  if (red >= 2) {
    return {
      tone: "red",
      label: "Pressure purchase",
      reason: "This purchase is creating real pressure in the current view.",
      bullets: ["Do not repeat it casually.", "Find a cheaper move for next time."],
    };
  }

  if (red >= 1 || amber >= 2) {
    return {
      tone: "amber",
      label: "Watch it",
      reason: "This is not broken yet, but the next similar purchase could tip the lane.",
      bullets: ["Slow down in this lane.", "Use the coach suggestions before buying again."],
    };
  }

  return {
    tone: "green",
    label: "Good purchase",
    reason: "This purchase does not look like the thing currently hurting the month.",
    bullets: ["Fits the lane right now.", "Keep it controlled."],
  };
}

function CategoryMixCard({ rows = [], totalExpense = 0 }) {
  const positiveRows = rows.filter((row) => Number(row.forecast) > 0).slice(0, 6);
  let cursor = 0;
  const stops = positiveRows.map((row) => {
    const pct = totalExpense > 0 ? (Number(row.forecast || 0) / totalExpense) * 100 : 0;
    const start = cursor;
    cursor += pct;
    return `${row.category?.color || "#7aa0ff"} ${start}% ${cursor}%`;
  });
  const gradient = stops.length
    ? `conic-gradient(from 220deg, ${stops.join(", ")})`
    : "conic-gradient(from 220deg, rgba(122,160,255,0.72) 0 100%)";

  return (
    <div className={styles.mixWrap}>
      <div className={styles.mixDonut} style={{ background: gradient }}>
        <div className={styles.mixDonutInner}>
          <strong>{money(totalExpense || 0)}</strong>
          <span>Total spent</span>
        </div>
      </div>
      <div className={styles.mixLegend}>
        {positiveRows.length ? (
          positiveRows.map((row) => (
            <div key={row.categoryId} className={styles.mixLegendRow}>
              <span className={styles.mixDot} style={{ background: row.category?.color || "#7aa0ff" }} />
              <span>{row.category?.name || "Category"}</span>
              <strong>{money(row.forecast || 0)}</strong>
            </div>
          ))
        ) : (
          <EmptyCard title="No category mix yet" body="Add spending and budgets to light this section up." />
        )}
      </div>
    </div>
  );
}

function BudgetPressureCard({ rows = [] }) {
  if (!rows.length) {
    return <EmptyCard title="No budget pressure" body="Set budgets or add spending to light this up." />;
  }

  return (
    <div className={styles.stackGrid}>
      {rows.slice(0, 4).map((row) => {
        const usedPct = row.budget > 0 ? clampLocal(row.pctUsed || 0, 0, 100) : 0;
        return (
          <div key={row.categoryId} className={styles.metricCard}>
            <div className={styles.metricCardTop}>
              <div>
                <div className={styles.metricCardTitle}>{row.category.name}</div>
                <div className={styles.metricCardMeta}>
                  {money(row.forecast)} / {money(row.budget || 0)}
                </div>
              </div>
              <Pill tone={row.status?.tone || "neutral"}>
                {row.budget > 0 ? `${Math.round(row.pctUsed || 0)}%` : "No budget"}
              </Pill>
            </div>
            <div className={styles.progressTrack}>
              <div
                className={cx(styles.progressFill, styles[`toneFill_${row.status?.tone || "neutral"}`])}
                style={{ width: `${usedPct}%` }}
              />
            </div>
            <div className={styles.metricCardMeta}>
              {row.budget > 0
                ? row.amountLeft >= 0
                  ? `${money(row.amountLeft)} left`
                  : `${money(Math.abs(row.amountLeft))} over`
                : "No budget guardrail"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MerchantPressure({ rows = [] }) {
  if (!rows.length) {
    return <EmptyCard title="No merchant pressure" body="Visible merchant patterns will show up here." />;
  }

  return (
    <div className={styles.stackGrid}>
      {rows.slice(0, 4).map((row) => (
        <div key={row.merchant} className={styles.merchantRow}>
          <MerchantMark merchant={row.merchant} />
          <div className={styles.merchantRowMain}>
            <div className={styles.merchantRowTop}>
              <span>{row.merchant}</span>
              <strong>{money(row.total)}</strong>
            </div>
            <div className={styles.merchantRowMeta}>{row.count} visits · avg {money(row.avg)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AlertsCard({ notifications = [] }) {
  if (!notifications.length) {
    return <EmptyCard title="No alerts" body="Visible spending is stable in the current view." />;
  }

  return (
    <div className={styles.stackGrid}>
      {notifications.slice(0, 3).map((item) => (
        <div key={item.id} className={styles.alertRow}>
          <div className={styles.alertIconWrap}>
            <TriangleAlert size={14} />
          </div>
          <div className={styles.alertCopy}>
            <strong>{item.title}</strong>
            <span>{item.body}</span>
          </div>
          <Pill tone={item.tone || "neutral"}>{item.target || "page"}</Pill>
        </div>
      ))}
    </div>
  );
}

function OpportunityCard({ betterBuyIdeas = [] }) {
  const strongest = betterBuyIdeas[0] || null;

  if (!strongest) {
    return <EmptyCard title="No savings read yet" body="Select a transaction to generate the next fix and savings callout." />;
  }

  return (
    <div className={styles.opportunityCard}>
      <div className={styles.opportunityTop}>
        <div>
          <div className={styles.opportunityTitle}>{strongest.title}</div>
          <div className={styles.opportunityBody}>{strongest.body}</div>
        </div>
        <Pill tone={strongest.tone || "neutral"}>{strongest.impact}</Pill>
      </div>
      <div className={styles.opportunityMeta}>Next fix</div>
    </div>
  );
}

function ShoppingListCard({ queuedIdeas = [] }) {
  if (!queuedIdeas.length) {
    return (
      <EmptyCard
        title="Shopping list is empty"
        body="Queue better-buy ideas from Coach so this becomes a real working list instead of dead space."
      />
    );
  }

  return (
    <div className={styles.stackGrid}>
      {queuedIdeas.slice(0, 4).map((idea) => (
        <div key={idea.id} className={styles.queueRowCard}>
          <div className={styles.queueRowTop}>
            <div>
              <div className={styles.queueRowTitle}>{idea.title}</div>
              <div className={styles.queueRowMeta}>{idea.impact}</div>
            </div>
            <Pill tone={idea.tone || "neutral"}>saved</Pill>
          </div>
          <div className={styles.queueRowBody}>{idea.body}</div>
        </div>
      ))}
    </div>
  );
}

function SelectedDock({ selectedTx, selectedBudgetRow, categoriesById, merchantStats }) {
  if (!selectedTx) {
    return <EmptyCard title="No row selected" body="Pick a row from the transaction rail." />;
  }

  const verdict = verdictForTransaction(
    selectedTx,
    selectedBudgetRow,
    merchantStats?.visits || 1,
    merchantStats?.avg || 0
  );
  const laneTone = selectedBudgetRow?.status?.tone || "neutral";
  const laneLabel =
    statusTone(selectedBudgetRow?.status?.label || selectedBudgetRow?.status || "OK")?.label ||
    selectedBudgetRow?.status?.label ||
    "OK";

  return (
    <div className={styles.dockCard}>
      <div className={styles.heroTop}>
        <div className={styles.heroIdentity}>
          <MerchantMark merchant={selectedTx.merchant || selectedTx.note || selectedTx.type} size="lg" />
          <div className={styles.heroText}>
            <div className={styles.heroName}>{selectedTx.merchant || selectedTx.note || selectedTx.type}</div>
            <div className={styles.heroMeta}>
              {selectedTx.accountName || selectedTx.account || "Account"} · {shortDate(selectedTx.date)} · {fmtTime(selectedTx.time)}
            </div>
          </div>
        </div>
        <div className={styles.heroRight}>
          <Pill tone={verdict.tone}>{verdict.label}</Pill>
          <div className={styles.heroAmount}>{money(selectedTx.amount)}</div>
        </div>
      </div>

      <div className={styles.heroReason}>{verdict.reason}</div>

      <div className={styles.dockGrid}>
        <InsightStat
          label="Category"
          value={categoriesById.get(selectedTx.categoryId)?.name || "Uncategorized"}
          subcopy="Active lane"
          tone="blue"
        />
        <InsightStat
          label="Lane status"
          value={laneLabel}
          subcopy={selectedBudgetRow?.budget ? `${money(selectedBudgetRow.amountLeft || 0)} left` : "No budget"}
          tone={laneTone}
        />
        <InsightStat
          label="Merchant cadence"
          value={`${merchantStats?.visits || 1}x`}
          subcopy={merchantStats?.avg ? `avg ${money(merchantStats.avg)}` : "first visible row"}
          tone={(merchantStats?.visits || 0) >= 4 ? "red" : (merchantStats?.visits || 0) >= 2 ? "amber" : "green"}
        />
      </div>
    </div>
  );
}

function DashboardPane({
  totals,
  notifications,
  topMerchants,
  totalsByCategory,
  selectedTx,
  selectedBudgetRow,
  categoriesById,
  merchantStats,
  betterBuyIdeas,
}) {
  const visibleExpense = totalsByCategory.reduce((sum, row) => sum + (Number(row.forecast) || 0), 0);

  return (
    <div className={styles.dashboardLayout}>
      <div className={styles.storyCard}>
        <SectionHeader title="Where your money is going" subcopy="Visible category mix in the current view." />
        <CategoryMixCard rows={totalsByCategory} totalExpense={visibleExpense || totals.expense} />
      </div>

      <div className={styles.storyCard}>
        <SectionHeader title="Budget pressure" subcopy="The hot lanes that actually matter right now." />
        <BudgetPressureCard rows={totalsByCategory} />
      </div>

      <div className={styles.storyCard}>
        <SectionHeader title="Smart alerts" subcopy="What needs attention first." />
        <AlertsCard notifications={notifications} />
      </div>

      <div className={styles.storyCard}>
        <SectionHeader title="Top spending merchants" subcopy="Where the visible money is draining." />
        <MerchantPressure rows={topMerchants} />
      </div>

      <div className={styles.storyCard}>
        <SectionHeader title="Potential savings" subcopy="What you should fix next." />
        <OpportunityCard betterBuyIdeas={betterBuyIdeas} />
      </div>

      <div className={styles.dashboardDock}>
        <SelectedDock
          selectedTx={selectedTx}
          selectedBudgetRow={selectedBudgetRow}
          categoriesById={categoriesById}
          merchantStats={merchantStats}
        />
      </div>
    </div>
  );
}

function BreakdownPane({
  selectedTx,
  selectedPlanned,
  selectedBudgetRow,
  categoriesById,
  merchantStats,
  onEditTransaction,
  onDuplicateTransaction,
  onDeleteTransaction,
  onEditPlanned,
  onConvertPlanned,
  onDeletePlanned,
}) {
  const [menuOpen, setMenuOpen] = React.useState(false);

  if (selectedPlanned) {
    return (
      <div className={styles.workspaceBody}>
        <div className={styles.detailHeader}>
          <div>
            <div className={styles.sectionTitle}>Planned item</div>
            <div className={styles.sectionSub}>Future pressure docked into a focused detail view.</div>
          </div>
          <div className={styles.actionMenuWrap}>
            <button type="button" className={styles.iconButton} onClick={() => setMenuOpen((v) => !v)}>
              <MoreHorizontal size={14} />
            </button>
            {menuOpen ? (
              <div className={styles.actionMenu}>
                <button type="button" className={styles.actionMenuItem} onClick={() => { setMenuOpen(false); onEditPlanned(); }}>
                  <Sparkles size={14} /> Edit planned item
                </button>
                <button type="button" className={styles.actionMenuItem} onClick={() => { setMenuOpen(false); onConvertPlanned(); }}>
                  <Receipt size={14} /> Convert to spend
                </button>
                <button type="button" className={styles.actionMenuItemDanger} onClick={() => { setMenuOpen(false); onDeletePlanned(); }}>
                  <Trash2 size={14} /> Delete planned item
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <EmptyCard title={selectedPlanned.merchant || selectedPlanned.note || "Planned item"} body="Use the menu to edit, convert, or delete this planned row." />
      </div>
    );
  }

  if (!selectedTx) {
    return <EmptyCard title="No transaction selected" body="Pick a row from the rail to open breakdown." />;
  }

  const verdict = verdictForTransaction(
    selectedTx,
    selectedBudgetRow,
    merchantStats?.visits || 1,
    merchantStats?.avg || 0
  );
  const laneTone = selectedBudgetRow?.status?.tone || "neutral";
  const laneLabel =
    statusTone(selectedBudgetRow?.status?.label || selectedBudgetRow?.status || "OK")?.label ||
    selectedBudgetRow?.status?.label ||
    "OK";

  return (
    <div className={styles.workspaceBody}>
      <div className={styles.detailHeader}>
        <div>
          <div className={styles.sectionTitle}>Transaction breakdown</div>
          <div className={styles.sectionSub}>Facts, numbers, pressure, and the blunt read.</div>
        </div>
        <div className={styles.actionMenuWrap}>
          <button type="button" className={styles.iconButton} onClick={() => setMenuOpen((v) => !v)}>
            <MoreHorizontal size={14} />
          </button>
          {menuOpen ? (
            <div className={styles.actionMenu}>
              <button type="button" className={styles.actionMenuItem} onClick={() => { setMenuOpen(false); onEditTransaction(); }}>
                <Sparkles size={14} /> Edit transaction
              </button>
              <button type="button" className={styles.actionMenuItem} onClick={() => { setMenuOpen(false); onDuplicateTransaction(); }}>
                <Copy size={14} /> Duplicate
              </button>
              <button type="button" className={styles.actionMenuItemDanger} onClick={() => { setMenuOpen(false); onDeleteTransaction(); }}>
                <Trash2 size={14} /> Delete
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <SelectedDock
        selectedTx={selectedTx}
        selectedBudgetRow={selectedBudgetRow}
        categoriesById={categoriesById}
        merchantStats={merchantStats}
      />

      <div className={styles.storyGrid}>
        <div className={styles.storyCard}>
          <SectionHeader title="Purchase read" subcopy="What this purchase is actually doing." />
          <div className={styles.statGrid}>
            <InsightStat label="Category" value={categoriesById.get(selectedTx.categoryId)?.name || "Uncategorized"} subcopy="lane" tone="blue" />
            <InsightStat label="Lane status" value={laneLabel} subcopy={selectedBudgetRow?.budget ? `${money(selectedBudgetRow.amountLeft || 0)} left` : "No budget"} tone={laneTone} />
            <InsightStat label="Merchant cadence" value={`${merchantStats?.visits || 1}x`} subcopy={merchantStats?.avg ? `avg ${money(merchantStats.avg)}` : "first visible row"} tone={(merchantStats?.visits || 0) >= 4 ? "red" : (merchantStats?.visits || 0) >= 2 ? "amber" : "green"} />
          </div>
        </div>

        <div className={styles.storyCard}>
          <SectionHeader title="Budget impact" subcopy="Show the lane math, not fluff." />
          <div className={styles.metricList}>
            <div className={styles.metricInline}><span>Spent</span><strong>{money(selectedBudgetRow?.spent || 0)}</strong></div>
            <div className={styles.metricInline}><span>Planned</span><strong>{money(selectedBudgetRow?.planned || 0)}</strong></div>
            <div className={styles.metricInline}><span>Budget</span><strong>{money(selectedBudgetRow?.budget || 0)}</strong></div>
            <div className={styles.metricInline}><span>Forecast</span><strong>{money(selectedBudgetRow?.forecast || 0)}</strong></div>
          </div>
          <div className={styles.progressTrack}>
            <div className={cx(styles.progressFill, styles[`toneFill_${laneTone}`])} style={{ width: `${clampLocal(selectedBudgetRow?.pctUsed || 0, 0, 100)}%` }} />
          </div>
          <div className={styles.sectionSub}>{verdict.reason}</div>
        </div>
      </div>
    </div>
  );
}

function ShoppingPane({ betterBuyIdeas = [], queuedIdeas = [], onQueueIdea }) {
  return (
    <div className={styles.workspaceBody}>
      <div className={styles.storyGrid}>
        <div className={styles.storyCard}>
          <SectionHeader title="Shopping list" subcopy="Saved ideas you actually come back to later." right={<Pill tone="blue">{queuedIdeas.length}</Pill>} />
          <ShoppingListCard queuedIdeas={queuedIdeas} />
        </div>

        <div className={styles.storyCard}>
          <SectionHeader title="Better buys" subcopy="What to fix and where to look next." />
          <div className={styles.stackGrid}>
            {betterBuyIdeas.length ? (
              betterBuyIdeas.map((idea) => (
                <div key={idea.id} className={styles.ideaCard}>
                  <div className={styles.ideaTopRow}>
                    <div>
                      <div className={styles.ideaTitle}>{idea.title}</div>
                      <div className={styles.ideaBody}>{idea.body}</div>
                    </div>
                    <Pill tone={idea.tone || "neutral"}>{idea.impact}</Pill>
                  </div>
                  <ActionBtn variant="primary" onClick={() => onQueueIdea(idea)}>
                    <ShoppingCart size={14} /> Add to shopping list
                  </ActionBtn>
                </div>
              ))
            ) : (
              <EmptyCard title="No better-buy ideas yet" body="Select a transaction to generate a fix." />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CoachPane({ selectedTx, selectedBudgetRow, merchantStats, betterBuyIdeas = [], queuedIdeas = [], onQueueIdea, categoriesById }) {
  if (!selectedTx) {
    return <EmptyCard title="No transaction selected" body="Pick a transaction to open Coach." />;
  }

  const verdict = verdictForTransaction(
    selectedTx,
    selectedBudgetRow,
    merchantStats?.visits || 1,
    merchantStats?.avg || 0
  );
  const categoryName = categoriesById.get(selectedTx.categoryId)?.name || "Uncategorized";

  return (
    <div className={styles.workspaceBody}>
      <div className={styles.storyGrid}>
        <div className={styles.storyCard}>
          <SectionHeader title="Blunt read" subcopy="This is where the page judges the row." />
          <div className={styles.coachLead}>
            <div className={styles.coachLeadTitle}>{verdict.label}</div>
            <div className={styles.sectionSub}>{verdict.reason}</div>
          </div>
          <div className={styles.helperList}>
            {verdict.bullets.map((item) => (
              <div key={item} className={styles.helperListItem}>{item}</div>
            ))}
          </div>
        </div>

        <div className={styles.storyCard}>
          <SectionHeader title="Pressure read" subcopy="Current lane and merchant strain." />
          <div className={styles.statGrid}>
            <InsightStat label="Category" value={categoryName} subcopy="active lane" tone="blue" />
            <InsightStat label="Forecast" value={money(selectedBudgetRow?.forecast || 0)} subcopy={`budget ${money(selectedBudgetRow?.budget || 0)}`} tone={selectedBudgetRow?.status?.tone || "neutral"} />
            <InsightStat label="Merchant repeat" value={`${merchantStats?.visits || 1}x`} subcopy={merchantStats?.avg ? `avg ${money(merchantStats.avg)}` : "first visible row"} tone={(merchantStats?.visits || 0) >= 4 ? "red" : "amber"} />
          </div>
        </div>
      </div>

      <div className={styles.storyGrid}>
        <div className={styles.storyCard}>
          <SectionHeader title="What to do next" subcopy="Actual next moves, not filler." />
          <div className={styles.stackGrid}>
            {betterBuyIdeas.length ? (
              betterBuyIdeas.map((idea) => (
                <div key={idea.id} className={styles.ideaCard}>
                  <div className={styles.ideaTopRow}>
                    <div>
                      <div className={styles.ideaTitle}>{idea.title}</div>
                      <div className={styles.ideaBody}>{idea.body}</div>
                    </div>
                    <Pill tone={idea.tone || "neutral"}>{idea.impact}</Pill>
                  </div>
                  <ActionBtn variant="primary" onClick={() => onQueueIdea(idea)}>
                    <ShoppingCart size={14} /> Add to shopping list
                  </ActionBtn>
                </div>
              ))
            ) : (
              <EmptyCard title="No ideas yet" body="Select a pressure purchase to generate the next fix." />
            )}
          </div>
        </div>

        <div className={styles.storyCard}>
          <SectionHeader title="Shopping list snapshot" subcopy="Keep the saved ideas visible from Coach too." />
          <ShoppingListCard queuedIdeas={queuedIdeas} />
        </div>
      </div>
    </div>
  );
}


export function TopStrip({
  totals,
  expenseTrend,
  forecastRemaining,
  totalsByCategory,
  period,
  setPeriod,
  search,
  setSearch,
  onOpenComposer,
  onOpenControls,
  onScanReceipt,
  receiptBusy = false,
}) {
  const overBudgetRows = totalsByCategory.filter((row) => row.budget > 0 && row.forecast > row.budget);
  const overBudgetAmount = overBudgetRows.reduce(
    (sum, row) => sum + Math.max(0, Number(row.forecast) - Number(row.budget)),
    0
  );

  return (
    <div className={styles.topShell}>
      <div className={styles.topBar}>
        <div className={styles.topIdentity}>
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
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className={styles.topSelect}>
            <option value="week">This week</option>
            <option value="month">This month</option>
            <option value="year">This year</option>
          </select>
          <button type="button" className={styles.notificationButton} onClick={onOpenControls} title="Page controls">
            <SlidersHorizontal size={15} />
          </button>
          <button type="button" className={styles.notificationButton}>
            <Bell size={15} />
            {overBudgetRows.length ? <span className={styles.notificationBadge}>{overBudgetRows.length}</span> : null}
          </button>
          <ActionBtn onClick={onScanReceipt} disabled={receiptBusy}>
            <Receipt size={14} />
            {receiptBusy ? "Opening camera..." : "Scan receipt"}
          </ActionBtn>
          <ActionBtn variant="primary" onClick={onOpenComposer}><Plus size={14} />Add transaction</ActionBtn>
        </div>
      </div>

      <div className={styles.kpiRow}>
        <div className={styles.kpiCard}>
          <span>Spent this month</span>
          <strong style={{ letterSpacing: "-0.04em", lineHeight: 1 }}>{money(totals.expense || 0)}</strong>
          <small>{expenseTrend?.value || "0%"} vs prior month</small>
        </div>
        <div className={styles.kpiCard}>
          <span>Income</span>
          <strong style={{ letterSpacing: "-0.04em", lineHeight: 1 }}>{money(totals.income || 0)}</strong>
          <small>Money in</small>
        </div>
        <div className={styles.kpiCard}>
          <span>Planned</span>
          <strong style={{ letterSpacing: "-0.04em", lineHeight: 1 }}>{money(totals.plannedExpense || 0)}</strong>
          <small>Future pressure</small>
        </div>
        <div className={styles.kpiCard}>
          <span>Forecast left</span>
          <strong className={forecastRemaining < 0 ? styles.textRed : styles.textGreen} style={{ letterSpacing: "-0.04em", lineHeight: 1 }}>{money(forecastRemaining || 0)}</strong>
          <small>Budget room left</small>
        </div>
        <div className={styles.kpiCard}>
          <span>Over budget</span>
          <strong className={overBudgetAmount > 0 ? styles.textRed : styles.textGreen} style={{ letterSpacing: "-0.04em", lineHeight: 1 }}>{money(overBudgetAmount)}</strong>
          <small>{overBudgetRows.length} hot lanes</small>
        </div>
      </div>
    </div>
  );
}

function ItemFeedRow({ item, selected, onClick }) {
  return (
    <button
      type="button"
      className={cx(styles.feedRow, selected ? styles.feedRowActive : "")}
      onClick={onClick}
    >
      <MerchantMark merchant={item.merchant || item.name || "Item"} />
      <div className={styles.feedMain}>
        <div className={styles.feedTop}>
          <div className={styles.feedTitle}>
            <span className={styles.feedName}>{item.name}</span>
            <span className={styles.feedMicro}>{item.merchant || "Receipt item"}</span>
          </div>
          <div className={styles.feedAmount} style={{ letterSpacing: "-0.03em", lineHeight: 1 }}>{money(item.lineTotal || item.unitPrice || 0)}</div>
        </div>
        <div className={styles.feedMeta}>
          <Receipt size={12} />
          {shortDate(item.receiptDate)} · qty {item.qty || 1}
          {item.needWant ? ` · ${item.needWant}` : ""}
          {item.cardLast4 ? ` · card ${item.cardLast4}` : ""}
        </div>
      </div>
    </button>
  );
}

export function FeedPane({
  railMode = "transactions",
  setRailMode,
  transactions = [],
  plannedItems = [],
  receiptItems = [],
  selectedRecord = { kind: "tx", id: null },
  onSelect,
  onOpenTransactionSheet,
}) {
  const [feedFilter, setFeedFilter] = React.useState("all");

  const filteredTransactions = React.useMemo(() => {
    if (feedFilter === "expense") return transactions.filter((tx) => tx.type === "expense");
    if (feedFilter === "income") return transactions.filter((tx) => tx.type === "income");
    if (feedFilter === "planned") return [];
    return transactions;
  }, [transactions, feedFilter]);

  const showPlanned = feedFilter === "all" || feedFilter === "planned";

  return (
    <GlassPane tone="neutral" size="card" className={styles.feedPane}>
      <SectionHeader
        title={railMode === "items" ? "Receipt items" : "Transactions"}
        subcopy={railMode === "items" ? "See every item pulled from receipts." : "Fast rail for row selection"}
        right={<Pill tone="blue">{railMode === "items" ? receiptItems.length : transactions.length + plannedItems.length}</Pill>}
      />

      <div className={styles.feedTabs}>
        {[
          { id: "transactions", label: "Transactions" },
          { id: "items", label: "Items" },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            className={cx(styles.feedTab, railMode === item.id ? styles.feedTabActive : "")}
            onClick={() => setRailMode(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {railMode === "transactions" ? (
        <>
          <div className={styles.feedTabs}>
            {[
              { id: "all", label: "All" },
              { id: "expense", label: "Expenses" },
              { id: "income", label: "Income" },
              { id: "planned", label: "Planned" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                className={cx(styles.feedTab, feedFilter === item.id ? styles.feedTabActive : "")}
                onClick={() => setFeedFilter(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className={styles.feedList}>
            {filteredTransactions.map((tx) => {
              const selected = selectedRecord.kind === "tx" && selectedRecord.id === tx.id;
              const tone = toneForType(tx.type);
              const Icon = iconForType(tx.type);

              return (
                <button
                  key={tx.id}
                  type="button"
                  className={cx(styles.feedRow, selected ? styles.feedRowActive : "")}
                  style={{ minHeight: 88, paddingTop: 12, paddingBottom: 12 }}
                  onClick={() => onSelect({ kind: "tx", id: tx.id })}
                >
                  <MerchantMark merchant={tx.merchant || tx.note || tx.type} />
                  <div className={styles.feedMain}>
                    <div className={styles.feedTop}>
                      <div className={styles.feedTitle}>
                        <span className={styles.feedName}>{tx.merchant || tx.note || tx.type}</span>
                        <span className={styles.feedMicro}>{formatRailAccountLine(tx)}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div className={cx(styles.feedAmount, styles[`feedAmount_${tone}`])} style={{ letterSpacing: "-0.03em", lineHeight: 1 }}>{money(tx.amount)}</div>
                        <button
                          type="button"
                          className={styles.iconButton}
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpenTransactionSheet?.(tx);
                          }}
                          title="Transaction tools"
                        >
                          <MoreHorizontal size={14} />
                        </button>
                      </div>
                    </div>

                    <div className={styles.feedMeta}>
                      <Icon size={12} />
                      {shortDate(tx.date)} · {fmtTime(tx.time)} · {tx.type}
                      {tx.paymentMethod ? ` · ${tx.paymentMethod}` : ""}
                      {tx.sourceType === "receipt" ? " · receipt" : ""}
                      {tx.receiptId ? " · attached" : ""}
                    </div>
                  </div>
                </button>
              );
            })}

            {showPlanned && plannedItems.length ? <div className={styles.feedDivider}>Planned</div> : null}

            {showPlanned && plannedItems.map((item) => {
              const selected = selectedRecord.kind === "planned" && selectedRecord.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={cx(styles.feedRow, selected ? styles.feedRowActive : "")}
                  style={{ minHeight: 84, paddingTop: 12, paddingBottom: 12 }}
                  onClick={() => onSelect({ kind: "planned", id: item.id })}
                >
                  <div className={cx(styles.merchantMark, styles.merchantMark_amber)}>
                    <Receipt size={15} />
                  </div>
                  <div className={styles.feedMain}>
                    <div className={styles.feedTop}>
                      <div className={styles.feedTitle}>
                        <span className={styles.feedName}>{item.merchant || item.note || "Planned item"}</span>
                        <span className={styles.feedMicro}>planned pressure</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div className={cx(styles.feedAmount, styles.feedAmount_amber)} style={{ letterSpacing: "-0.03em", lineHeight: 1 }}>{money(item.amount)}</div>
                        <button
                          type="button"
                          className={styles.iconButton}
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpenTransactionSheet?.(item, "planned");
                          }}
                          title="Planned tools"
                        >
                          <MoreHorizontal size={14} />
                        </button>
                      </div>
                    </div>
                    <div className={styles.feedMeta}>
                      <Receipt size={12} />
                      {shortDate(item.date)} · {fmtTime(item.time)}
                    </div>
                  </div>
                </button>
              );
            })}

            {!filteredTransactions.length && !(showPlanned && plannedItems.length) ? (
              <EmptyCard title="Nothing visible" body="No rows match the current rail filter." />
            ) : null}
          </div>
        </>
      ) : (
        <div className={styles.feedList}>
          {(receiptItems || []).map((item) => (
            <ItemFeedRow
              key={item.id}
              item={item}
              selected={selectedRecord.kind === "item" && selectedRecord.id === item.id}
              onClick={() => onSelect({ kind: "item", id: item.id })}
            />
          ))}
          {!receiptItems.length ? (
            <EmptyCard title="No receipt items yet" body="Scan a receipt and the individual line items will show up here." />
          ) : null}
        </div>
      )}
    </GlassPane>
  );
}

function ItemWorkspace({ selectedItem, itemStats }) {
  if (!selectedItem) {
    return <EmptyCard title="No item selected" body="Switch the left rail to Items and pick a receipt item." />;
  }

  return (
    <div className={styles.workspaceBody}>
      <div className={styles.storyGrid}>
        <div className={styles.storyCard}>
          <SectionHeader title="Item detail" subcopy="This is the individual receipt line, not the whole transaction." />
          <div className={styles.dockCard}>
            <div className={styles.heroTop}>
              <div className={styles.heroIdentity}>
                <MerchantMark merchant={selectedItem.merchant || selectedItem.name} size="lg" />
                <div className={styles.heroText}>
                  <div className={styles.heroName}>{selectedItem.name}</div>
                  <div className={styles.heroMeta}>{selectedItem.merchant || "Receipt"} · {shortDate(selectedItem.receiptDate)} · qty {selectedItem.qty || 1}</div>
                </div>
              </div>
              <div className={styles.heroRight}>
                <Pill tone={selectedItem.needWant === "need" ? "green" : selectedItem.needWant === "want" ? "amber" : "neutral"}>{selectedItem.needWant || "unscored"}</Pill>
                <div className={styles.heroAmount} style={{ letterSpacing: "-0.04em", lineHeight: 1 }}>{money(selectedItem.lineTotal || selectedItem.unitPrice || 0)}</div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.storyCard}>
          <SectionHeader title="Your history" subcopy="Real history from your own scanned receipts." />
          <div className={styles.statGrid}>
            <InsightStat label="This month" value={`${itemStats.monthCount}x`} subcopy="bought" tone="blue" />
            <InsightStat label="This year" value={`${itemStats.yearCount}x`} subcopy="bought" tone="green" />
            <InsightStat label="Avg price" value={money(itemStats.avgPrice)} subcopy="your own receipts" tone="amber" />
          </div>
        </div>
      </div>

      <div className={styles.storyGrid}>
        <div className={styles.storyCard}>
          <SectionHeader title="Price read" subcopy="Real stats first. Store comparison comes later." />
          <div className={styles.metricList}>
            <div className={styles.metricInline}><span>Lowest you paid</span><strong>{money(itemStats.lowPrice)}</strong></div>
            <div className={styles.metricInline}><span>Highest you paid</span><strong>{money(itemStats.highPrice)}</strong></div>
            <div className={styles.metricInline}><span>Last paid</span><strong>{money(selectedItem.lineTotal || selectedItem.unitPrice || 0)}</strong></div>
          </div>
          <div className={styles.sectionSub}>No outside cheaper-store engine is wired yet, so this view sticks to real data you actually have.</div>
        </div>

        <div className={styles.storyCard}>
          <SectionHeader title="Receipt source" subcopy="Where this item came from." />
          {selectedItem.imageUrl ? (
            <img
              src={selectedItem.imageUrl}
              alt={selectedItem.name}
              style={{ width: "100%", borderRadius: 18, border: "1px solid rgba(255,255,255,0.08)", objectFit: "cover", maxHeight: 320 }}
            />
          ) : (
            <EmptyCard title="No preview" body="The receipt image is not available for this item yet." />
          )}
        </div>
      </div>
    </div>
  );
}

export function MainWorkspacePane({
  mode,
  setMode,
  railMode,
  totals,
  notifications,
  topMerchants,
  totalsByCategory,
  selectedTx,
  selectedPlanned,
  selectedBudgetRow,
  selectedItem,
  itemStats,
  categoriesById,
  merchantStats,
  betterBuyIdeas,
  queuedIdeas,
  onQueueIdea,
  onEditTransaction,
  onDuplicateTransaction,
  onDeleteTransaction,
  onEditPlanned,
  onConvertPlanned,
  onDeletePlanned,
  membershipLevel = "free",
}) {
  const isPremium = membershipLevel !== "free";
  const tabs = [
    { id: "dashboard", label: "Total" },
    { id: "breakdown", label: railMode === "items" ? "Item detail" : "Breakdown" },
    { id: "shopping", label: "Shopping List" },
    { id: "coach", label: "Coach" },
  ];

  return (
    <GlassPane tone="neutral" size="card" className={styles.workspacePane}>
      <div className={styles.sectionHeader} style={{ marginBottom: 12 }}>
        <div>
          <div className={styles.sectionTitle}>{railMode === "items" ? "Item workspace" : "Spending workspace"}</div>
          <div className={styles.sectionSub}>{railMode === "items" ? "Individual receipt item view" : "Main page views moved into the workspace where they belong"}</div>
        </div>
        <div className={styles.modeTabs}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={cx(styles.modeTab, mode === tab.id ? styles.modeTabActive : "")}
              onClick={() => setMode(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {railMode === "items" ? (
        <ItemWorkspace selectedItem={selectedItem} itemStats={itemStats} />
      ) : null}

      {railMode === "transactions" && mode === "dashboard" ? (
        <DashboardPane
          totals={totals}
          notifications={isPremium ? notifications : []}
          topMerchants={topMerchants}
          totalsByCategory={totalsByCategory}
          selectedTx={selectedTx}
          selectedBudgetRow={selectedBudgetRow}
          categoriesById={categoriesById}
          merchantStats={merchantStats}
          betterBuyIdeas={isPremium ? betterBuyIdeas : []}
        />
      ) : null}

      {railMode === "transactions" && mode === "breakdown" ? (
        <BreakdownPane
          selectedTx={selectedTx}
          selectedPlanned={selectedPlanned}
          selectedBudgetRow={selectedBudgetRow}
          categoriesById={categoriesById}
          merchantStats={merchantStats}
          onEditTransaction={onEditTransaction}
          onDuplicateTransaction={onDuplicateTransaction}
          onDeleteTransaction={onDeleteTransaction}
          onEditPlanned={onEditPlanned}
          onConvertPlanned={onConvertPlanned}
          onDeletePlanned={onDeletePlanned}
        />
      ) : null}

      {railMode === "transactions" && mode === "shopping" ? (
        isPremium ? (
          <ShoppingPane betterBuyIdeas={betterBuyIdeas} queuedIdeas={queuedIdeas} onQueueIdea={onQueueIdea} />
        ) : (
          <EmptyCard title="Membership required" body="Shopping intelligence is part of the paid plan." />
        )
      ) : null}

      {railMode === "transactions" && mode === "coach" ? (
        isPremium ? (
          <CoachPane
            selectedTx={selectedTx}
            selectedBudgetRow={selectedBudgetRow}
            merchantStats={merchantStats}
            betterBuyIdeas={betterBuyIdeas}
            queuedIdeas={queuedIdeas}
            onQueueIdea={onQueueIdea}
            categoriesById={categoriesById}
          />
        ) : (
          <EmptyCard title="Membership required" body="Coach is part of the paid plan." />
        )
      ) : null}
    </GlassPane>
  );
}

export function ReceiptExtractionModal({
  open,
  busy,
  draft,
  setDraft,
  onClose,
  onCreate,
  onMatch,
  onSaveReceiptOnly,
}) {
  if (!open || !draft) return null;

  const candidates = draft.candidates || [];
  const canMatch = Boolean(draft.selectedCandidateId);

  function patch(field, value) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modalCard} style={{ width: "min(920px, 94vw)", maxWidth: 920, borderRadius: 28 }}>
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalEyebrow}>Receipt OCR extraction</div>
            <div className={styles.modalTitle}>Review before creating the transaction</div>
          </div>
          <button type="button" className={styles.iconButton} onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <div style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 16 }}>
            <div className={styles.storyCard}>
              <SectionHeader title="Extracted fields" subcopy="Edit anything wrong before saving." />
              <div className={styles.formGrid2}>
                <div className={styles.fieldBlock}>
                  <label className={styles.fieldLabel}>Merchant</label>
                  <input className={styles.field} value={draft.merchant || ""} onChange={(e) => patch("merchant", e.target.value)} />
                </div>
                <div className={styles.fieldBlock}>
                  <label className={styles.fieldLabel}>Total</label>
                  <input className={styles.field} value={draft.total ?? ""} onChange={(e) => patch("total", e.target.value)} inputMode="decimal" />
                </div>
                <div className={styles.fieldBlock}>
                  <label className={styles.fieldLabel}>Date</label>
                  <input className={styles.field} type="date" value={draft.receiptDate || ""} onChange={(e) => patch("receiptDate", e.target.value)} />
                </div>
                <div className={styles.fieldBlock}>
                  <label className={styles.fieldLabel}>Card last 4</label>
                  <input className={styles.field} value={draft.cardLast4 || ""} onChange={(e) => patch("cardLast4", e.target.value)} maxLength={4} />
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <SectionHeader title="Extracted items" subcopy="Receipt line items pulled from OCR." />
                {(draft.items || []).length ? (
                  <div className={styles.stackGrid}>
                    {draft.items.map((item, idx) => (
                      <div key={`${item.name}-${idx}`} className={styles.merchantRow}>
                        <MerchantMark merchant={item.name} />
                        <div className={styles.merchantRowMain}>
                          <div className={styles.merchantRowTop}>
                            <span>{item.name}</span>
                            <strong>{money(item.lineTotal || item.unitPrice || 0)}</strong>
                          </div>
                          <div className={styles.merchantRowMeta}>qty {item.qty || 1}{item.needWant ? ` · ${item.needWant}` : ""}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyCard title="No items extracted" body="The OCR got the receipt shell but not the line items." />
                )}
              </div>
            </div>

            <div className={styles.storyCard}>
              <SectionHeader title="Receipt + match review" subcopy="Use a match if it found the right transaction." />
              {draft.imageUrl ? (
                <img src={draft.imageUrl} alt="Receipt preview" style={{ width: "100%", borderRadius: 18, border: "1px solid rgba(255,255,255,0.08)", objectFit: "contain", background: "rgba(5,8,14,0.8)", maxHeight: 320 }} />
              ) : (
                <EmptyCard title="No preview" body="Receipt image preview was not returned." />
              )}

              <div style={{ marginTop: 16 }}>
                <SectionHeader title="Suggested matches" subcopy={draft.matchedAccountName ? `Account hint: ${draft.matchedAccountName}` : "No account hint found yet."} />
                {candidates.length ? (
                  <div className={styles.stackGrid}>
                    {candidates.map((candidate) => (
                      <button
                        key={candidate.id}
                        type="button"
                        className={styles.queueRowCard}
                        onClick={() => patch("selectedCandidateId", candidate.id)}
                        style={{ textAlign: "left", borderColor: draft.selectedCandidateId === candidate.id ? "rgba(122,160,255,0.48)" : undefined }}
                      >
                        <div className={styles.queueRowTop}>
                          <div>
                            <div className={styles.queueRowTitle}>{candidate.merchant}</div>
                            <div className={styles.queueRowMeta}>{candidate.date} · {money(candidate.amount)}</div>
                          </div>
                          <Pill tone={candidate.score >= 85 ? "green" : candidate.score >= 60 ? "amber" : "neutral"}>{candidate.score}%</Pill>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <EmptyCard title="No match suggestions" body="Create a new transaction from this receipt or save the receipt only." />
                )}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <ActionBtn onClick={onClose}>Cancel</ActionBtn>
          <ActionBtn onClick={onSaveReceiptOnly} disabled={busy}>Save receipt only</ActionBtn>
          <ActionBtn onClick={onMatch} disabled={busy || !canMatch}>Match selected</ActionBtn>
          <ActionBtn variant="primary" onClick={onCreate} disabled={busy}>Create transaction</ActionBtn>
        </div>
      </div>
    </div>
  );
}

export function TransactionDetailSheet({
  open,
  type = "transaction",
  record,
  receiptItems = [],
  membershipLevel = "free",
  onClose,
  onEditTransaction,
  onDuplicateTransaction,
  onDeleteTransaction,
  onEditPlanned,
  onConvertPlanned,
  onDeletePlanned,
  onOpenReceiptCapture,
}) {
  if (!open || !record) return null;

  const isPremium = membershipLevel !== "free";
  const amount = type === "planned" ? record.amount : record.amount;
  const receiptPreview = receiptItems.find((item) => item.imageUrl)?.imageUrl || "";

  return (
    <div className={styles.modalBackdrop} style={{ justifyContent: "flex-end", padding: 16 }}>
      <div className={styles.modalCard} style={{ width: "min(780px, 92vw)", maxWidth: 780, height: "calc(100vh - 32px)", overflow: "auto", borderRadius: 28 }}>
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalEyebrow}>{type === "planned" ? "Planned item" : "Transaction detail"}</div>
            <div className={styles.modalTitle}>{record.merchant || record.note || "Entry"}</div>
          </div>
          <button type="button" className={styles.iconButton} onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.dockCard}>
            <div className={styles.heroTop}>
              <div className={styles.heroIdentity}>
                <MerchantMark merchant={record.merchant || record.note || "Entry"} size="lg" />
                <div className={styles.heroText}>
                  <div className={styles.heroName}>{record.merchant || record.note || "Entry"}</div>
                  <div className={styles.heroMeta}>{shortDate(record.date)} · {fmtTime(record.time)} · {type === "planned" ? "planned" : record.type}</div>
                </div>
              </div>
              <div className={styles.heroRight}>
                <div className={styles.heroAmount} style={{ letterSpacing: "-0.04em", lineHeight: 1 }}>{money(amount || 0)}</div>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.08fr 0.92fr", gap: 16 }}>
            <div className={styles.storyCard}>
              <SectionHeader title="Breakdown" subcopy="Use hidden tools here, not on the main page." />
              <div className={styles.modalFooter} style={{ padding: 0, justifyContent: "flex-start", marginBottom: 12 }}>
                {type === "planned" ? (
                  <>
                    <ActionBtn onClick={onEditPlanned}>Edit</ActionBtn>
                    <ActionBtn onClick={onConvertPlanned}>Convert</ActionBtn>
                    <ActionBtn variant="danger" onClick={onDeletePlanned}>Delete</ActionBtn>
                  </>
                ) : (
                  <>
                    <ActionBtn onClick={onEditTransaction}>Edit</ActionBtn>
                    <ActionBtn onClick={onDuplicateTransaction}>Duplicate</ActionBtn>
                    <ActionBtn onClick={onOpenReceiptCapture}><Receipt size={14} /> Add / View receipt</ActionBtn>
                    <ActionBtn variant="danger" onClick={onDeleteTransaction}>Delete</ActionBtn>
                  </>
                )}
              </div>
              <div className={styles.metricList}>
                <div className={styles.metricInline}><span>Account</span><strong>{record.accountName || record.account || "—"}</strong></div>
                <div className={styles.metricInline}><span>Method</span><strong>{record.paymentMethod || "—"}</strong></div>
                <div className={styles.metricInline}><span>Note</span><strong>{record.note || "—"}</strong></div>
              </div>

              <div style={{ marginTop: 18 }}>
                <SectionHeader title="Receipt items" subcopy="Attached items for this transaction." />
                {receiptItems.length ? (
                  <div className={styles.stackGrid}>
                    {receiptItems.map((item) => (
                      <div key={item.id} className={styles.merchantRow}>
                        <MerchantMark merchant={item.name} />
                        <div className={styles.merchantRowMain}>
                          <div className={styles.merchantRowTop}>
                            <span>{item.name}</span>
                            <strong>{money(item.lineTotal || item.unitPrice || 0)}</strong>
                          </div>
                          <div className={styles.merchantRowMeta}>qty {item.qty || 1}{item.needWant ? ` · ${item.needWant}` : ""}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyCard title="No receipt items" body="Attach or scan a receipt to populate item breakdown here." />
                )}
              </div>
            </div>

            <div className={styles.storyCard}>
              <SectionHeader title="Receipt preview" subcopy={isPremium ? "Receipt image and paid insights." : "Receipt image visible. Paid insights stay locked."} />
              {receiptPreview ? (
                <img src={receiptPreview} alt="Receipt" style={{ width: "100%", borderRadius: 18, border: "1px solid rgba(255,255,255,0.08)", objectFit: "contain", background: "rgba(5,8,14,0.8)", maxHeight: 420 }} />
              ) : (
                <EmptyCard title="No receipt preview" body="Use Add / View receipt to attach one." />
              )}
              <div style={{ marginTop: 16 }}>
                {isPremium ? (
                  <div className={styles.metricList}>
                    <div className={styles.metricInline}><span>Attached items</span><strong>{receiptItems.length}</strong></div>
                    <div className={styles.metricInline}><span>Receipt connected</span><strong>{receiptItems.length ? "Yes" : "No"}</strong></div>
                  </div>
                ) : (
                  <EmptyCard title="Membership required" body="Advanced receipt intelligence is part of the paid plan." />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ReceiptCaptureModal({ open, busy, onClose, onFileReady }) {
  const videoRef = React.useRef(null);
  const inputRef = React.useRef(null);
  const streamRef = React.useRef(null);
  const [cameraError, setCameraError] = React.useState("");
  const [cameraReady, setCameraReady] = React.useState(false);

  React.useEffect(() => {
    if (!open) return undefined;

    let stopped = false;

    async function startCamera() {
      if (!navigator?.mediaDevices?.getUserMedia) {
        setCameraError("Direct camera is not available here. Use upload fallback.");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });

        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setCameraReady(true);
        setCameraError("");
      } catch {
        setCameraReady(false);
        setCameraError("Camera permission failed or is blocked. Use upload fallback.");
      }
    }

    startCamera();

    return () => {
      stopped = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      setCameraReady(false);
    };
  }, [open]);

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) return;

    const file = new File([blob], `receipt-${Date.now()}.jpg`, { type: "image/jpeg" });
    onFileReady?.(file);
  }

  function handleFallbackPick(event) {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    if (!file) return;
    onFileReady?.(file);
  }

  if (!open) return null;

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modalCard}>
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalEyebrow}>Receipt capture</div>
            <div className={styles.modalTitle}>Camera first, files second</div>
          </div>
          <button type="button" className={styles.iconButton} onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <div style={{ borderRadius: 18, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(6,10,18,0.88)", minHeight: 320, display: "grid", placeItems: "center" }}>
            {cameraReady ? (
              <video ref={videoRef} playsInline muted style={{ width: "100%", height: 360, objectFit: "cover" }} />
            ) : (
              <div style={{ padding: 24, textAlign: "center", color: "rgba(255,255,255,0.72)" }}>
                {cameraError || "Starting camera..."}
              </div>
            )}
          </div>

          <div className={styles.sectionSub} style={{ marginTop: 12 }}>
            On phones this opens a real camera view first. Upload from files stays as fallback.
          </div>
        </div>

        <div className={styles.modalFooter}>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            onChange={handleFallbackPick}
          />
          <ActionBtn onClick={() => inputRef.current?.click()} disabled={busy}>Upload instead</ActionBtn>
          <ActionBtn variant="primary" onClick={capturePhoto} disabled={busy || !cameraReady}>
            {busy ? "Processing..." : "Capture receipt"}
          </ActionBtn>
        </div>
      </div>
    </div>
  );
}

export function QuickEntryModal({
  open,
  onClose,
  saving,
  composerKind,
  draft,
  setDraft,
  categories,
  accounts,
  onSave,
}) {
  if (!open) return null;

  const isPlanned = composerKind === "create_planned" || composerKind === "edit_planned";
  const isEdit = composerKind === "edit_tx" || composerKind === "edit_planned";

  function setField(key, value) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modalCard}>
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalEyebrow}>{isEdit ? "Edit entry" : "New entry"}</div>
            <div className={styles.modalTitle}>{isPlanned ? "Planned spend" : "Transaction"}</div>
          </div>
          <button type="button" className={styles.iconButton} onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <div className={styles.modalBody}>
          {!isPlanned ? (
            <div className={styles.tabRow}>
              {[
                ["expense", "Expense"],
                ["income", "Income"],
                ["transfer", "Transfer"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={cx(styles.tab, draft.type === value ? styles.tabActive : "")}
                  onClick={() => setField("type", value)}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}

          <div className={styles.formGrid3}>
            <div className={styles.fieldBlock}>
              <label className={styles.fieldLabel}>Amount</label>
              <input className={styles.field} value={draft.amount} onChange={(e) => setField("amount", e.target.value)} placeholder="0.00" inputMode="decimal" />
            </div>
            <div className={styles.fieldBlock}>
              <label className={styles.fieldLabel}>Date</label>
              <input className={styles.field} type="date" value={draft.date} onChange={(e) => setField("date", e.target.value)} />
            </div>
            <div className={styles.fieldBlock}>
              <label className={styles.fieldLabel}>Time</label>
              <input className={styles.field} type="time" value={draft.time} onChange={(e) => setField("time", e.target.value)} />
            </div>
          </div>

          <div className={styles.formGrid2}>
            <div className={styles.fieldBlock}>
              <label className={styles.fieldLabel}>Category</label>
              <select className={styles.field} value={draft.categoryId} onChange={(e) => setField("categoryId", e.target.value)}>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </div>

            {!isPlanned ? (
              <div className={styles.fieldBlock}>
                <label className={styles.fieldLabel}>From account</label>
                <select className={styles.field} value={draft.accountId} onChange={(e) => setField("accountId", e.target.value)}>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>{account.name}</option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          {!isPlanned && draft.type === "transfer" ? (
            <div className={styles.fieldBlock}>
              <label className={styles.fieldLabel}>To account</label>
              <select className={styles.field} value={draft.transferAccountId} onChange={(e) => setField("transferAccountId", e.target.value)}>
                {accounts.filter((account) => account.id !== draft.accountId).map((account) => (
                  <option key={account.id} value={account.id}>{account.name}</option>
                ))}
              </select>
            </div>
          ) : null}

          <div className={styles.fieldBlock}>
            <label className={styles.fieldLabel}>Merchant / source</label>
            <input className={styles.field} value={draft.merchant} onChange={(e) => setField("merchant", e.target.value)} placeholder="Merchant or source" />
          </div>

          {!isPlanned ? (
            <div className={styles.fieldBlock}>
              <label className={styles.fieldLabel}>Method</label>
              <input className={styles.field} value={draft.paymentMethod} onChange={(e) => setField("paymentMethod", e.target.value)} placeholder="Card, Cash, ACH..." />
            </div>
          ) : null}

          <div className={styles.fieldBlock}>
            <label className={styles.fieldLabel}>Note</label>
            <textarea className={styles.fieldArea} rows={4} value={draft.note} onChange={(e) => setField("note", e.target.value)} placeholder="Optional note" />
          </div>
        </div>

        <div className={styles.modalFooter}>
          <ActionBtn onClick={onClose}>Cancel</ActionBtn>
          <ActionBtn variant="primary" onClick={onSave} disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Save changes" : "Save"}
          </ActionBtn>
        </div>
      </div>
    </div>
  );
}

export function ControlModal({
  open,
  onClose,
  saving,
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
  subscriptionCandidates = [],
}) {
  if (!open) return null;

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modalCard}>
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalEyebrow}>Controls</div>
            <div className={styles.modalTitle}>Category & budget controls</div>
          </div>
          <button type="button" className={styles.iconButton} onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.storyCard}>
            <SectionHeader title="Budget controls" subcopy={`Adjust budgets for the current ${budgetMode} view.`} />
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
            <ActionBtn variant="primary" onClick={onSaveBudgetValue} disabled={saving}>Save budget</ActionBtn>
          </div>

          <div className={styles.storyCard}>
            <SectionHeader title="Add category" subcopy="Expand the system without cluttering the main page." />
            <div className={styles.formGrid2}>
              <div className={styles.fieldBlock}>
                <label className={styles.fieldLabel}>Category name</label>
                <input className={styles.field} value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Streaming, Pets, Household..." />
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
            <ActionBtn onClick={onSaveCategory} disabled={saving}>Save category</ActionBtn>
          </div>

          <div className={styles.storyCard}>
            <SectionHeader title="Subscription review" subcopy="Recurring review lane kept outside real spend until you decide." />
            <div className={styles.stackGrid}>
              {subscriptionCandidates.length ? subscriptionCandidates.map((item) => (
                <div key={item.id} className={styles.queueRowCard}>
                  <div className={styles.queueRowTop}>
                    <div>
                      <div className={styles.queueRowTitle}>{item.merchant}</div>
                      <div className={styles.queueRowMeta}>{item.count} similar charges · avg {money(item.avg)}</div>
                    </div>
                    <Pill tone="blue">review</Pill>
                  </div>
                </div>
              )) : (
                <EmptyCard title="No subscription candidates" body="Repeated merchant patterns will show up here." />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ToastStack({ status, pageError, onClearError }) {
  if (!status && !pageError) return null;

  return (
    <div className={styles.toastStack}>
      {status ? <div className={cx(styles.toast, styles.toastOk)}>{status}</div> : null}
      {pageError ? (
        <div className={cx(styles.toast, styles.toastError)}>
          {pageError}
          <button type="button" className={styles.iconButton} onClick={onClearError}>
            <X size={12} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
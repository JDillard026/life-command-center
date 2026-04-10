
"use client";

import * as React from "react";
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarClock,
  Camera,
  CheckCircle2,
  Copy,
  CreditCard,
  FolderKanban,
  PiggyBank,
  Plus,
  Receipt,
  Save,
  Search,
  Sparkles,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import GlassPane from "../components/GlassPane";
import {
  MOBILE_SECTIONS,
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

function verdictForTransaction(tx, selectedCategoryRow, insight) {
  if (!tx) return { tone: "neutral", label: "No selection", reason: "Choose a row to judge.", bullets: [] };
  if (tx.type === "income") return { tone: "green", label: "Income event", reason: "This row adds cash instead of taking it away.", bullets: ["Count it toward account growth.", "Use it to cover upcoming pressure or goals."] };
  if (tx.type === "transfer") return { tone: "blue", label: "Transfer event", reason: "This is movement between accounts, not outside spend.", bullets: ["Make sure the destination account is correct.", "Do not judge this like a purchase."] };

  const budget = Number(selectedCategoryRow?.budget || 0);
  const forecast = Number(selectedCategoryRow?.forecast || 0);
  const visits = Number(insight?.visits || 1);
  const avg = Number(insight?.avg || tx.amount || 0);
  const fixedObligation = isBillManagedTransaction(tx);

  if (fixedObligation && budget > 0 && forecast <= budget) return { tone: "amber", label: "Fixed obligation", reason: "This spend is required. Judge the system around it, not the transaction itself.", bullets: ["Protect the category budget first.", "Build around it instead of trying to cut it after the fact."] };
  if (!budget || selectedCategoryRow?.status === "No budget") return { tone: "red", label: "Bad purchase", reason: "There is no budget guardrail set for this category, so the row is landing without protection.", bullets: ["Set a budget for this category.", "Decide whether this merchant belongs in a tighter category."] };
  if (selectedCategoryRow?.status === "Over" || tx.amount > Math.max(avg * 1.35, budget * 0.35) || visits >= 4) return { tone: "red", label: "Bad purchase", reason: "This row is adding real pressure. Either the category is stretched, the merchant is repeating, or the ticket was too large.", bullets: ["Cut a similar purchase this period.", "Tighten the category budget or move money deliberately."] };
  if (selectedCategoryRow?.status === "Near") return { tone: "amber", label: "Watch it", reason: "This spend is still allowed, but the category is getting close to the edge.", bullets: ["Do not repeat this casually.", "Watch the rest of the category for the period."] };
  return { tone: "green", label: "Good purchase", reason: "The row stayed inside the current budget lane and did not create obvious pressure.", bullets: ["This fits the present plan.", "Keep repeating only if the category remains controlled."] };
}

export function MerchantMark({ merchant, size = "md" }) {
  const preset = merchantPresetForName(merchant);
  return <div className={cx(styles.merchantMark, styles[`merchantMark_${preset.tone}`], size === "lg" ? styles.merchantMarkLg : "")}>{preset.label}</div>;
}

export function Pill({ children, tone = "neutral" }) {
  return <span className={cx(styles.pill, styles[`pill_${tone}`])}>{children}</span>;
}

export function ActionBtn({ children, onClick, variant = "ghost", full = false, type = "button", disabled = false }) {
  return <button type={type} onClick={onClick} disabled={disabled} className={cx(styles.actionBtn, styles[`actionBtn_${variant}`], full ? styles.actionBtnFull : "")}>{children}</button>;
}

function SectionHeader({ title, subcopy, right }) {
  return <div className={styles.sectionHeader}><div><div className={styles.sectionTitle}>{title}</div>{subcopy ? <div className={styles.sectionSub}>{subcopy}</div> : null}</div>{right ? <div className={styles.sectionRight}>{right}</div> : null}</div>;
}

function EmptyCard({ title, body, action }) {
  return <div className={styles.emptyCard}><div className={styles.emptyCardTitle}>{title}</div><div className={styles.emptyCardBody}>{body}</div>{action ? <div className={styles.emptyAction}>{action}</div> : null}</div>;
}

function MiniMetric({ label, value, subcopy, tone = "neutral", icon: Icon }) {
  return <div className={cx(styles.miniMetric, toneClass(tone))}><div className={styles.miniMetricTop}><span className={styles.miniMetricLabel}>{label}</span>{Icon ? <span className={styles.miniMetricIcon}><Icon size={14} /></span> : null}</div><div className={styles.miniMetricValue}>{value}</div>{subcopy ? <div className={styles.miniMetricSub}>{subcopy}</div> : null}</div>;
}

function TrendBars({ data }) {
  const rows = data?.length ? data : [{ key: "empty", label: "—", value: 0 }];
  const max = Math.max(...rows.map((row) => Number(row.value) || 0), 1);
  return <div className={styles.trendBars}>{rows.map((row) => { const pct = Math.max(8, ((Number(row.value) || 0) / max) * 100); return <div key={row.key} className={styles.trendBarCol}><div className={styles.trendBarTrack}><div className={styles.trendBarFill} style={{ height: `${pct}%` }} /></div><div className={styles.trendBarLabel}>{row.label}</div></div>; })}</div>;
}

function CategoryRow({ row }) {
  const tone = statusTone(row.status);
  return <div className={styles.categoryRow}><div className={styles.categoryRowMain}><div className={styles.categoryRowTop}><div><div className={styles.categoryName}>{row.category.name}</div><div className={styles.categoryMeta}>{money(row.spent)} actual · {money(row.planned)} planned · {money(row.budget)} budget</div></div><Pill tone={tone.tone}>{tone.label}</Pill></div><div className={styles.progressTrack}><div className={cx(styles.progressFill, toneClass(tone.tone))} style={{ width: `${clamp(row.pct || 0, 0, 100)}%` }} /></div></div></div>;
}

function MerchantRadar({ rows }) {
  if (!rows?.length) return <EmptyCard title="Merchant radar" body="No merchant pattern is available for this range yet." />;
  return <div className={styles.radarList}>{rows.map((row) => <div key={row.merchant} className={styles.radarRow}><MerchantMark merchant={row.merchant} /><div className={styles.radarMain}><div className={styles.radarTop}><span>{row.merchant}</span><strong>{money(row.total)}</strong></div><div className={styles.radarMeta}>{row.count} visits · avg {money(row.avg)}</div></div></div>)}</div>;
}

function ReceiptAttachmentCard({ receipt, itemCount = 0 }) {
  const when = receipt?.capturedAt || receipt?.createdAt;
  const dateLabel = when ? new Date(when).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "Stored";
  return <div className={styles.receiptAttachmentCard}><div className={styles.receiptAttachmentTop}><div><div className={styles.receiptAttachmentName}>{receipt.fileName || "Receipt"}</div><div className={styles.receiptAttachmentMeta}>{dateLabel} · {formatFileSize(receipt.fileSize)} · {itemCount} line items</div></div><Pill tone="blue">{receipt.receiptStatus || "attached"}</Pill></div><div className={styles.metricStripCompact}><div className={styles.metricCompact}><span>Total</span><strong>{receipt.receiptTotal != null ? money(receipt.receiptTotal) : "—"}</strong></div><div className={styles.metricCompact}><span>Need</span><strong>{money(receipt.spentNeededTotal || 0)}</strong></div><div className={styles.metricCompact}><span>Want/Waste</span><strong>{money((receipt.spentWantedTotal || 0) + (receipt.spentWasteTotal || 0))}</strong></div></div>{receipt.previewUrl ? <a className={styles.textLink} href={receipt.previewUrl} target="_blank" rel="noreferrer">Open stored file</a> : null}</div>;
}

function ReceiptItemList({ selectedReceipts, selectedReceiptItemsByReceiptId }) {
  const allItems = selectedReceipts.flatMap((receipt) => selectedReceiptItemsByReceiptId.get(receipt.id) || []);
  if (!allItems.length) return null;
  return <div className={styles.receiptReviewList}>{allItems.map((item) => <div key={item.id} className={styles.receiptReviewRow}><div><div className={styles.receiptReviewName}>{item.itemName}</div><div className={styles.receiptReviewMeta}>Qty {item.quantity} · {item.unitPrice != null ? money(item.unitPrice) : "—"} each</div></div><div className={styles.receiptReviewRight}><Pill tone={classificationTone(item.classification)}>{item.classification}</Pill><strong>{money(item.lineTotal)}</strong></div></div>)}</div>;
}

function OverviewView({ totals, expenseTrend, trendData, topMerchants, upcomingItems, totalsByCategory, selectedCategory, receiptCoverage }) {
  const goodRows = totalsByCategory.filter((row) => row.forecast > 0 && row.budget > 0 && row.status === "OK").slice(0, 3);
  const badRows = totalsByCategory.filter((row) => row.forecast > 0 && (row.status === "Over" || row.status === "Near" || row.budget <= 0)).slice(0, 3);
  const hotRows = totalsByCategory.filter((row) => row.forecast > 0).slice(0, 6);

  return <div className={styles.stageScroll}>
    <div className={styles.summaryGrid}>
      <MiniMetric label="Spent" value={money(totals.expense)} subcopy="This period expense total" icon={CreditCard} />
      <MiniMetric label="Income" value={money(totals.income)} subcopy="Money added from this page" icon={ArrowUpRight} tone="green" />
      <MiniMetric label="Planned" value={money(totals.plannedExpense)} subcopy="Future spend still ahead" icon={CalendarClock} tone="amber" />
      <MiniMetric label="Receipt coverage" value={`${receiptCoverage.covered}/${receiptCoverage.total}`} subcopy="Expense rows with receipt detail" tone={receiptCoverage.covered > 0 ? "blue" : "neutral"} icon={Receipt} />
    </div>
    <div className={styles.cardGrid3}>
      <div className={styles.contentCard}><SectionHeader title="Good purchase lane" subcopy="Categories staying controlled in the active window." />{goodRows.length ? goodRows.map((row) => <CategoryRow key={row.categoryId} row={row} />) : <EmptyCard title="Nothing landed here" body="No category is clearly winning yet in this view." />}</div>
      <div className={styles.contentCard}><SectionHeader title="Bad purchase lane" subcopy="Where the page thinks money is getting weaker." />{badRows.length ? badRows.map((row) => <CategoryRow key={row.categoryId} row={row} />) : <EmptyCard title="Clean so far" body="No category is flashing warning pressure yet." />}</div>
      <div className={styles.contentCard}><SectionHeader title="Upcoming pressure" subcopy="Planned items that still need cash behind them." />{upcomingItems?.length ? <div className={styles.plannedList}>{upcomingItems.slice(0, 4).map((item) => <div key={item.id} className={styles.plannedRow}><div><div className={styles.plannedName}>{item.merchant || item.note || "Planned item"}</div><div className={styles.plannedMeta}>{shortDate(item.date)} · {fmtTime(item.time)}</div></div><strong>{money(item.amount)}</strong></div>)}</div> : <EmptyCard title="Nothing planned" body="There are no future items in the active range." />}</div>
    </div>
    <div className={styles.stageGridWide}>
      <div className={styles.contentCard}><SectionHeader title="Category pressure board" subcopy="Where the month is winning and where it is getting weaker." right={<Pill tone="green">coach mode</Pill>} /><div className={styles.stackRows}>{hotRows.length ? hotRows.map((row) => <CategoryRow key={row.categoryId} row={row} />) : <EmptyCard title="No category load" body="Post or plan some transactions to build pressure tracking." />}</div></div>
      <div className={styles.contentCard}><SectionHeader title="Spend rhythm" subcopy="Expense pace by day or month." right={<Pill tone={expenseTrend.positive ? "amber" : "green"}>{expenseTrend.value}</Pill>} /><TrendBars data={trendData} /></div>
    </div>
    <div className={styles.stageGridWide}>
      <div className={styles.contentCard}><SectionHeader title="Merchant radar" subcopy="Where most of the money is going." /><MerchantRadar rows={topMerchants} /></div>
      <div className={styles.contentCard}><SectionHeader title="How this page works" subcopy="Keep the page strategic and move detail into the transaction sheet." />{selectedCategory ? <div className={styles.guidanceList}><div className={styles.guidanceItem}><strong>Click a row</strong><span>Every transaction opens a detail sheet instead of dumping receipt junk into the main layout.</span></div><div className={styles.guidanceItem}><strong>No receipt attached</strong><span>The sheet prompts the user to add one with the camera button.</span></div><div className={styles.guidanceItem}><strong>Receipt attached</strong><span>The sheet shows line-item need / want / waste breakdown immediately.</span></div></div> : <EmptyCard title="Nothing selected" body="Pick any row in the transaction board to inspect it." />}</div>
    </div>
  </div>;
}

function DonutChart({ rows }) {
  const active = rows.filter((row) => row.forecast > 0).slice(0, 6);
  const total = active.reduce((sum, row) => sum + row.forecast, 0) || 1;
  let cursor = 0;
  const segments = active.map((row) => {
    const start = cursor;
    const end = cursor + (row.forecast / total) * 100;
    cursor = end;
    return `${row.category.color || "#94a3b8"} ${start}% ${end}%`;
  });
  const gradient = active.length ? `conic-gradient(${segments.join(", ")})` : "conic-gradient(#243042 0% 100%)";
  return <div className={styles.donutShell}><div className={styles.donutChart} style={{ background: gradient }}><div className={styles.donutCenter}><strong>{money(total)}</strong><span>Forecast spend</span></div></div><div className={styles.donutLegend}>{active.length ? active.map((row) => <div key={row.categoryId} className={styles.legendRow}><span className={styles.legendSwatch} style={{ background: row.category.color || "#94a3b8" }} /><span className={styles.legendName}>{row.category.name}</span><strong>{money(row.forecast)}</strong></div>) : <EmptyCard title="No category load" body="The donut will fill once expense categories have data." />}</div></div>;
}

function CategoryLabView({ totalsByCategory, budgetLoad, forecastRemaining, topMerchants, budgetEditorCategoryId, setBudgetEditorCategoryId, budgetEditorValue, setBudgetEditorValue, budgetMode, onSaveBudgetValue, newCategoryName, setNewCategoryName, newCategoryGroup, setNewCategoryGroup, groups, onSaveCategory, saving }) {
  const activeRows = totalsByCategory.filter((row) => row.forecast > 0 || row.budget > 0);
  return <div className={styles.stageScroll}>
    <div className={styles.stageGridWide}>
      <div className={styles.contentCard}><SectionHeader title="Category mix" subcopy="Professional view of where spending pressure is concentrated." right={<Pill tone={forecastRemaining < 0 ? "red" : "green"}>{money(forecastRemaining)} left</Pill>} /><DonutChart rows={activeRows} /></div>
      <div className={styles.contentCard}><SectionHeader title="Master controls" subcopy={`Adjust budgets for the current ${budgetMode} view.`} right={<Pill tone={budgetLoad >= 100 ? "red" : budgetLoad >= 85 ? "amber" : "green"}>{Math.round(budgetLoad)}% loaded</Pill>} /><div className={styles.formGrid2}><div className={styles.fieldBlock}><label className={styles.fieldLabel}>Category</label><select className={styles.field} value={budgetEditorCategoryId} onChange={(e) => setBudgetEditorCategoryId(e.target.value)}>{totalsByCategory.map((row) => <option key={row.categoryId} value={row.categoryId}>{row.category.name}</option>)}</select></div><div className={styles.fieldBlock}><label className={styles.fieldLabel}>Budget value</label><input className={styles.field} value={budgetEditorValue} onChange={(e) => setBudgetEditorValue(e.target.value)} placeholder="0.00" inputMode="decimal" /></div></div><ActionBtn variant="primary" onClick={onSaveBudgetValue} disabled={saving}><PiggyBank size={13} />Save budget</ActionBtn><div className={styles.sectionDivider} /><SectionHeader title="Add category" subcopy="Expand the system without leaving the page." /><div className={styles.formGrid2}><div className={styles.fieldBlock}><label className={styles.fieldLabel}>Category name</label><input className={styles.field} value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Streaming, Childcare, Pets…" /></div><div className={styles.fieldBlock}><label className={styles.fieldLabel}>Group</label><select className={styles.field} value={newCategoryGroup} onChange={(e) => setNewCategoryGroup(e.target.value)}>{groups.filter((group) => group !== "All").map((group) => <option key={group} value={group}>{group}</option>)}</select></div></div><ActionBtn onClick={onSaveCategory} disabled={saving}><Save size={13} />Save category</ActionBtn></div>
    </div>
    <div className={styles.stageGridWide}>
      <div className={styles.contentCard}><SectionHeader title="Category pressure tracker" subcopy="All visible categories ranked by forecast pressure." /><div className={styles.stackRows}>{activeRows.length ? activeRows.map((row) => <CategoryRow key={row.categoryId} row={row} />) : <EmptyCard title="No category pressure" body="Create or post spend to start the tracker." />}</div></div>
      <div className={styles.contentCard}><SectionHeader title="Merchant radar" subcopy="Use this to see which brands are repeatedly absorbing cash." /><MerchantRadar rows={topMerchants} /></div>
    </div>
  </div>;
}

function CapturePanel({ mode, setMode, qaType, setQaType, qaAmount, setQaAmount, qaDate, setQaDate, qaTime, setQaTime, qaCategoryId, setQaCategoryId, qaMerchant, setQaMerchant, qaNote, setQaNote, qaPayment, setQaPayment, qaAccountId, setQaAccountId, qaTransferToAccountId, setQaTransferToAccountId, accounts, categories, saving, onAddNow, onAddPlanned }) {
  return <div className={styles.contentCard}><SectionHeader title="Quick assist" subcopy="Post now or schedule planned pressure without leaving the page." /><div className={styles.tabRow}>{[{ value: "now", label: "Now" }, { value: "planned", label: "Planned" }].map((item) => <button key={item.value} type="button" className={cx(styles.tab, mode === item.value ? styles.tabActive : "")} onClick={() => setMode(item.value)}>{item.label}</button>)}</div><div className={styles.tabRow}>{[{ value: "expense", label: "Expense" }, { value: "income", label: "Income" }, { value: "transfer", label: "Transfer" }].map((item) => <button key={item.value} type="button" className={cx(styles.tab, qaType === item.value ? styles.tabActive : "")} onClick={() => setQaType(item.value)}>{item.label}</button>)}</div><div className={styles.formGrid3}><div className={styles.fieldBlock}><label className={styles.fieldLabel}>Amount</label><input className={styles.field} value={qaAmount} onChange={(e) => setQaAmount(e.target.value)} placeholder="0.00" inputMode="decimal" /></div><div className={styles.fieldBlock}><label className={styles.fieldLabel}>Date</label><input className={styles.field} type="date" value={qaDate} onChange={(e) => setQaDate(e.target.value)} /></div><div className={styles.fieldBlock}><label className={styles.fieldLabel}>Time</label><input className={styles.field} type="time" value={qaTime} onChange={(e) => setQaTime(e.target.value)} /></div></div><div className={styles.formGrid3}><div className={styles.fieldBlock}><label className={styles.fieldLabel}>Category</label><select className={styles.field} value={qaCategoryId} onChange={(e) => setQaCategoryId(e.target.value)}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div><div className={styles.fieldBlock}><label className={styles.fieldLabel}>From account</label><select className={styles.field} value={qaAccountId} onChange={(e) => setQaAccountId(e.target.value)}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></div><div className={styles.fieldBlock}><label className={styles.fieldLabel}>Method</label><input className={styles.field} value={qaPayment} onChange={(e) => setQaPayment(e.target.value)} placeholder="Card, ACH, Cash…" /></div></div>{qaType === "transfer" ? <div className={styles.fieldBlock}><label className={styles.fieldLabel}>To account</label><select className={styles.field} value={qaTransferToAccountId} onChange={(e) => setQaTransferToAccountId(e.target.value)}>{accounts.filter((account) => account.id !== qaAccountId).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></div> : null}<div className={styles.fieldBlock}><label className={styles.fieldLabel}>Merchant / source</label><input className={styles.field} value={qaMerchant} onChange={(e) => setQaMerchant(e.target.value)} placeholder="Merchant or source" /></div><div className={styles.fieldBlock}><label className={styles.fieldLabel}>Note</label><textarea className={styles.fieldArea} value={qaNote} onChange={(e) => setQaNote(e.target.value)} rows={4} placeholder="Optional note" /></div><ActionBtn variant="primary" onClick={mode === "planned" ? onAddPlanned : onAddNow} disabled={saving} full><Plus size={13} />{saving ? "Saving…" : mode === "planned" ? "Save planned item" : "Post transaction"}</ActionBtn></div>;
}

function FocusedInsightsPanel({ topMerchants, selectedCategory, selectedSpent, selectedPlannedTotal, selectedBudget, selectedForecast, selectedLoadPct, upcomingItems }) {
  return <div className={styles.contentCard}><SectionHeader title="Focused insights" subcopy="Use this area to keep the operator honest." /><div className={styles.metricStrip}><div className={styles.metricCard}><span>Selected category</span><strong>{selectedCategory?.name || "None"}</strong></div><div className={styles.metricCard}><span>Spent</span><strong>{money(selectedSpent)}</strong></div><div className={styles.metricCard}><span>Planned</span><strong>{money(selectedPlannedTotal)}</strong></div><div className={styles.metricCard}><span>Budget</span><strong>{money(selectedBudget)}</strong></div></div><div className={styles.progressTrack}><div className={cx(styles.progressFill, selectedLoadPct >= 100 ? styles.toneRed : selectedLoadPct >= 85 ? styles.toneAmber : styles.toneGreen)} style={{ width: `${clamp(selectedLoadPct || 0, 0, 100)}%` }} /></div><div className={styles.noteBox}>{selectedCategory ? `${money(selectedForecast)} forecast against ${money(selectedBudget)} in the selected category.` : "Choose a category or row to focus insights."}</div><div className={styles.sectionDivider} /><SectionHeader title="Top merchants" subcopy="Repeat brands inside the current view." /><MerchantRadar rows={topMerchants.slice(0, 4)} /><div className={styles.sectionDivider} /><SectionHeader title="Upcoming pressure" subcopy="Future items that still need coverage." />{upcomingItems?.length ? <div className={styles.plannedList}>{upcomingItems.slice(0, 4).map((item) => <div key={item.id} className={styles.plannedRow}><div><div className={styles.plannedName}>{item.merchant || item.note || "Planned item"}</div><div className={styles.plannedMeta}>{shortDate(item.date)}</div></div><strong>{money(item.amount)}</strong></div>)}</div> : <EmptyCard title="No upcoming pressure" body="Nothing future-dated is waiting right now." />}</div>;
}

function ReceiptClassificationToggle({ value, onChange }) {
  const choices = [{ value: "need", label: "Need" }, { value: "want", label: "Want" }, { value: "waste", label: "Waste" }, { value: "review", label: "Review" }];
  return <div className={styles.classificationToggle}>{choices.map((choice) => <button key={choice.value} type="button" className={cx(styles.classificationChip, value === choice.value ? styles.classificationChipActive : "", styles[`classificationChip_${choice.value}`])} onClick={() => onChange(choice.value)}>{choice.label}</button>)}</div>;
}

function ReceiptDraftEditor({ receiptDraft, receiptDraftSummary, categories, accounts, onClearReceiptDraft, onReceiptFileChosen, onReceiptDraftChange, onReceiptDraftAddLine, onReceiptDraftUpdateLine, onReceiptDraftRemoveLine, onSaveReceiptDraft, saving }) {
  return <div className={styles.sheetSections}>
    <div className={styles.sheetSection}><SectionHeader title="Receipt draft" subcopy="Camera-first receipt review." right={<Pill tone={receiptDraftSummary.review > 0 ? "amber" : "green"}>{receiptDraftSummary.review > 0 ? "needs review" : "ready"}</Pill>} /><div className={styles.inlineActions}><label className={styles.cameraAction}><input className={styles.hiddenInput} type="file" accept="image/*,.pdf" onChange={(e) => { const file = e.target.files?.[0]; if (file) onReceiptFileChosen(file); e.target.value = ""; }} /><Camera size={14} />{receiptDraft.file ? "Replace receipt" : "Scan / upload receipt"}</label><ActionBtn onClick={onClearReceiptDraft}><X size={13} />Clear draft</ActionBtn></div><div className={styles.receiptPreviewBox}>{receiptDraft.previewUrl ? (receiptDraft.file?.type?.startsWith("image/") ? <img src={receiptDraft.previewUrl} alt="Receipt preview" className={styles.receiptPreviewImage} /> : <div className={styles.receiptPreviewFallback}><Receipt size={22} /><span>{receiptDraft.fileName || "Receipt PDF"}</span></div>) : <div className={styles.receiptPreviewFallback}><Camera size={22} /><span>Add a receipt image or PDF</span></div>}</div><div className={styles.formGrid2}><div className={styles.fieldBlock}><label className={styles.fieldLabel}>Merchant</label><input className={styles.field} value={receiptDraft.merchant} onChange={(e) => onReceiptDraftChange("merchant", e.target.value)} placeholder="Walmart, Publix, Shell…" /></div><div className={styles.fieldBlock}><label className={styles.fieldLabel}>Date</label><input className={styles.field} type="date" value={receiptDraft.date} onChange={(e) => onReceiptDraftChange("date", e.target.value)} /></div></div><div className={styles.formGrid3}><div className={styles.fieldBlock}><label className={styles.fieldLabel}>Account</label><select className={styles.field} value={receiptDraft.accountId} onChange={(e) => onReceiptDraftChange("accountId", e.target.value)}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></div><div className={styles.fieldBlock}><label className={styles.fieldLabel}>Category</label><select className={styles.field} value={receiptDraft.categoryId} onChange={(e) => onReceiptDraftChange("categoryId", e.target.value)}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div><div className={styles.fieldBlock}><label className={styles.fieldLabel}>Method</label><input className={styles.field} value={receiptDraft.paymentMethod} onChange={(e) => onReceiptDraftChange("paymentMethod", e.target.value)} placeholder="Card" /></div></div><div className={styles.formGrid2}><div className={styles.fieldBlock}><label className={styles.fieldLabel}>Time</label><input className={styles.field} type="time" value={receiptDraft.time} onChange={(e) => onReceiptDraftChange("time", e.target.value)} /></div><div className={styles.fieldBlock}><label className={styles.fieldLabel}>Tax</label><input className={styles.field} value={receiptDraft.tax} onChange={(e) => onReceiptDraftChange("tax", e.target.value)} placeholder="0.00" inputMode="decimal" /></div></div><div className={styles.fieldBlock}><label className={styles.fieldLabel}>Note</label><textarea className={styles.fieldArea} rows={3} value={receiptDraft.note} onChange={(e) => onReceiptDraftChange("note", e.target.value)} placeholder="Anything about this trip that matters later." /></div></div>
    <div className={styles.sheetSection}><SectionHeader title="Line items" subcopy="Every item gets a real classification." right={<ActionBtn onClick={onReceiptDraftAddLine}><Plus size={13} />Add line</ActionBtn>} /><div className={styles.receiptLineList}>{receiptDraft.items.map((item, index) => <div key={item.id} className={styles.receiptLineRow}><div className={styles.receiptLineHeader}><div className={styles.receiptLineIndex}>Item {index + 1}</div><button type="button" className={styles.iconButton} onClick={() => onReceiptDraftRemoveLine(item.id)}><Trash2 size={13} /></button></div><div className={styles.receiptLineGrid}><div className={styles.fieldBlock}><label className={styles.fieldLabel}>Item name</label><input className={styles.field} value={item.itemName} onChange={(e) => onReceiptDraftUpdateLine(item.id, { itemName: e.target.value })} placeholder="Milk, chips, shampoo…" /></div><div className={styles.fieldBlock}><label className={styles.fieldLabel}>Qty</label><input className={styles.field} value={item.quantity} onChange={(e) => onReceiptDraftUpdateLine(item.id, { quantity: e.target.value })} /></div><div className={styles.fieldBlock}><label className={styles.fieldLabel}>Unit price</label><input className={styles.field} value={item.unitPrice} onChange={(e) => onReceiptDraftUpdateLine(item.id, { unitPrice: e.target.value })} placeholder="0.00" /></div></div><ReceiptClassificationToggle value={item.classification} onChange={(value) => onReceiptDraftUpdateLine(item.id, { classification: value })} /><div className={styles.fieldBlock}><label className={styles.fieldLabel}>Line note</label><input className={styles.field} value={item.note || ""} onChange={(e) => onReceiptDraftUpdateLine(item.id, { note: e.target.value })} placeholder="Optional note" /></div></div>)}</div></div>
    <div className={styles.sheetSection}><SectionHeader title="Receipt totals" subcopy="This is what actually becomes the expense." /><div className={styles.receiptTotalsGrid}><div className={styles.receiptTotalCard}><span>Subtotal</span><strong>{money(receiptDraftSummary.subtotal)}</strong></div><div className={styles.receiptTotalCard}><span>Tax</span><strong>{money(receiptDraftSummary.tax)}</strong></div><div className={styles.receiptTotalCard}><span>Total</span><strong>{money(receiptDraftSummary.total)}</strong></div><div className={styles.receiptTotalCard}><span>Items</span><strong>{receiptDraftSummary.count}</strong></div></div><div className={styles.receiptBreakdownList}><div className={styles.breakdownRow}><span>Needed spend</span><strong>{money(receiptDraftSummary.need)}</strong></div><div className={styles.breakdownRow}><span>Wanted spend</span><strong>{money(receiptDraftSummary.want)}</strong></div><div className={styles.breakdownRow}><span>Waste spend</span><strong>{money(receiptDraftSummary.waste)}</strong></div><div className={styles.breakdownRow}><span>Review spend</span><strong>{money(receiptDraftSummary.review)}</strong></div></div><ActionBtn variant="primary" full onClick={onSaveReceiptDraft} disabled={saving}><Save size={13} />{saving ? "Saving receipt…" : "Save receipt as transaction"}</ActionBtn></div>
  </div>;
}

function TransactionDetailSheet({ open, onClose, selectedTx, selectedPlanned, categoriesById, allTransactions, selectedCategoryRow, selectedReceipts, selectedReceiptItemsByReceiptId, onDuplicate, onDelete, onStartReceiptDraft, receiptDraft, receiptDraftSummary, categories, accounts, onClearReceiptDraft, onReceiptFileChosen, onReceiptDraftChange, onReceiptDraftAddLine, onReceiptDraftUpdateLine, onReceiptDraftRemoveLine, onSaveReceiptDraft, saving, convertAccountId, setConvertAccountId, onConvertPlanned, onDeletePlanned }) {
  if (!open) return null;

  if (receiptDraft) {
    return <div className={styles.detailOverlay}><div className={styles.detailSheet}><div className={styles.detailSheetHeader}><div><div className={styles.detailSheetEyebrow}>Receipt Lab</div><div className={styles.detailSheetTitle}>Receipt review</div></div><button type="button" className={styles.iconButton} onClick={onClose}><X size={14} /></button></div><ReceiptDraftEditor receiptDraft={receiptDraft} receiptDraftSummary={receiptDraftSummary} categories={categories} accounts={accounts} onClearReceiptDraft={onClearReceiptDraft} onReceiptFileChosen={onReceiptFileChosen} onReceiptDraftChange={onReceiptDraftChange} onReceiptDraftAddLine={onReceiptDraftAddLine} onReceiptDraftUpdateLine={onReceiptDraftUpdateLine} onReceiptDraftRemoveLine={onReceiptDraftRemoveLine} onSaveReceiptDraft={onSaveReceiptDraft} saving={saving} /></div></div>;
  }

  if (!selectedTx && !selectedPlanned) return null;

  if (selectedPlanned) {
    const category = categoriesById.get(selectedPlanned.categoryId);
    return <div className={styles.detailOverlay}><div className={styles.detailSheet}><div className={styles.detailSheetHeader}><div><div className={styles.detailSheetEyebrow}>Planned item</div><div className={styles.detailSheetTitle}>{selectedPlanned.merchant || selectedPlanned.note || "Planned item"}</div></div><button type="button" className={styles.iconButton} onClick={onClose}><X size={14} /></button></div><div className={styles.sheetSections}><div className={styles.sheetSection}><div className={styles.metricStripCompact}><div className={styles.metricCompact}><span>Amount</span><strong>{money(selectedPlanned.amount)}</strong></div><div className={styles.metricCompact}><span>Date</span><strong>{shortDate(selectedPlanned.date)}</strong></div><div className={styles.metricCompact}><span>Category</span><strong>{category?.name || "Uncategorized"}</strong></div></div></div><div className={styles.sheetSection}><SectionHeader title="Convert planned item" subcopy="Post it to an account when it becomes real spend." /><div className={styles.fieldBlock}><label className={styles.fieldLabel}>To account</label><select className={styles.field} value={convertAccountId} onChange={(e) => setConvertAccountId(e.target.value)}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></div><div className={styles.inlineActions}><ActionBtn variant="primary" onClick={onConvertPlanned}><Wallet size={13} />Convert to transaction</ActionBtn><ActionBtn variant="danger" onClick={onDeletePlanned}><Trash2 size={13} />Delete planned</ActionBtn></div></div></div></div></div>;
  }

  const category = categoriesById.get(selectedTx.categoryId);
  const insight = merchantInsight(allTransactions, categoriesById, selectedTx.merchant);
  const verdict = verdictForTransaction(selectedTx, selectedCategoryRow, insight);
  const status = statusTone(selectedCategoryRow?.status || "No budget");

  return <div className={styles.detailOverlay}><div className={styles.detailSheet}><div className={styles.detailSheetHeader}><div><div className={styles.detailSheetEyebrow}>Transaction detail</div><div className={styles.detailSheetTitle}>{selectedTx.merchant || selectedTx.note || selectedTx.type}</div></div><button type="button" className={styles.iconButton} onClick={onClose}><X size={14} /></button></div><div className={styles.sheetSections}>
    <div className={styles.sheetSection}><div className={styles.verdictHero}><div className={styles.verdictHead}><div className={styles.verdictIdentity}><MerchantMark merchant={selectedTx.merchant || selectedTx.note || selectedTx.type} size="lg" /><div><div className={styles.verdictLabel}>Purchase verdict</div><div className={styles.verdictValue}>{money(selectedTx.amount)}</div><div className={styles.verdictMeta}>{shortDate(selectedTx.date)} · {fmtTime(selectedTx.time)} · {selectedTx.accountName || selectedTx.account || "Account"}</div></div></div><Pill tone={verdict.tone}>{verdict.label}</Pill></div><div className={styles.callout}><div className={styles.calloutTitle}>{verdict.label}</div><div className={styles.calloutBody}>{verdict.reason}</div></div><div className={styles.tagRow}>{verdict.bullets.map((item) => <span key={item} className={styles.softTag}>{item}</span>)}</div></div></div>
    <div className={styles.sheetSection}><SectionHeader title="Core details" subcopy="Everything important without leaving the page." right={<Pill tone={status.tone}>{status.label}</Pill>} /><div className={styles.metricStripCompact}><div className={styles.metricCompact}><span>Category</span><strong>{category?.name || "Uncategorized"}</strong></div><div className={styles.metricCompact}><span>Method</span><strong>{selectedTx.paymentMethod || "—"}</strong></div><div className={styles.metricCompact}><span>Account</span><strong>{selectedTx.accountName || selectedTx.account || "—"}</strong></div></div><div className={styles.inlineActions}><ActionBtn onClick={onDuplicate}><Copy size={13} />Duplicate</ActionBtn><ActionBtn variant="danger" onClick={onDelete}><Trash2 size={13} />Delete</ActionBtn></div></div>
    <div className={styles.sheetSection}><SectionHeader title="Receipt breakdown" subcopy="If a receipt exists, break it down here. If not, prompt the user cleanly." right={<Pill tone={selectedReceipts.length ? "green" : "neutral"}>{selectedReceipts.length ? "receipt attached" : "no receipt"}</Pill>} />{selectedReceipts.length ? <><div className={styles.stackRows}>{selectedReceipts.map((receipt) => <ReceiptAttachmentCard key={receipt.id} receipt={receipt} itemCount={(selectedReceiptItemsByReceiptId.get(receipt.id) || []).length} />)}</div><ReceiptItemList selectedReceipts={selectedReceipts} selectedReceiptItemsByReceiptId={selectedReceiptItemsByReceiptId} /></> : <EmptyCard title="No receipt attached" body="Use the camera button to scan or upload a receipt for this transaction." action={<ActionBtn variant="primary" onClick={() => onStartReceiptDraft(selectedTx)}><Camera size={13} />Add receipt</ActionBtn>} />}</div>
  </div></div></div>;
}

export function TopStrip({ totals, expenseTrend, forecastRemaining, accounts, period, setPeriod, mobileSection, setMobileSection, feedCount }) {
  return <>
    <div className={styles.topStrip}>
      <div className={styles.topIdentity}><div className={styles.eyebrow}>Money / Spending</div><h1 className={styles.pageTitle}>Spending Intelligence</h1><p className={styles.pageSub}>Keep the main page strategic. Click a transaction to open a clean detail sheet. If a receipt exists, show the line-item breakdown. If it does not, prompt the user to add one with the camera icon.</p></div>
      <div className={styles.kpiRow}><div className={styles.kpiCard}><span>Spent</span><strong>{money(totals.expense)}</strong></div><div className={styles.kpiCard}><span>Income</span><strong>{money(totals.income)}</strong></div><div className={styles.kpiCard}><span>Planned</span><strong>{money(totals.plannedExpense)}</strong></div><div className={styles.kpiCard}><span>Forecast</span><strong className={totals.forecastNet < 0 ? styles.textRed : styles.textGreen}>{money(totals.forecastNet)}</strong></div></div>
      <div className={styles.topControls}><select value={period} onChange={(e) => setPeriod(e.target.value)} className={styles.topSelect}><option value="week">This Week</option><option value="month">This Month</option><option value="year">This Year</option></select><Pill tone={expenseTrend.positive ? "amber" : "green"}>{expenseTrend.value} vs prior</Pill><Pill tone={forecastRemaining < 0 ? "red" : "green"}>{money(forecastRemaining)} remaining</Pill><Pill tone="blue">{accounts.length} accounts</Pill><Pill tone="neutral">{feedCount} rows</Pill></div>
    </div>
    <div className={styles.mobileTabs}>{MOBILE_SECTIONS.map((item) => <button key={item.value} type="button" className={cx(styles.mobileTab, mobileSection === item.value ? styles.mobileTabActive : "")} onClick={() => setMobileSection(item.value)}>{item.label}</button>)}</div>
  </>;
}

export function FeedPane({ search, setSearch, typeFilter, setTypeFilter, categoryFilter, setCategoryFilter, groupFilter, setGroupFilter, categories, groups, transactions, plannedItems, receiptCountsByTransaction, selectedRecord, onSelect }) {
  return <GlassPane tone="neutral" size="card" className={styles.sidePane}><SectionHeader title="Transaction board" subcopy="Click a row to open its detail sheet." right={<Pill tone="blue">{transactions.length + plannedItems.length}</Pill>} /><div className={styles.feedTools}><div className={styles.searchBox}><Search size={14} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search merchant, note, account…" />{search ? <button type="button" className={styles.iconButton} onClick={() => setSearch("")}><X size={12} /></button> : null}</div><div className={styles.filterGrid}><select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={styles.field}><option value="all">All types</option><option value="expense">Expense</option><option value="income">Income</option><option value="transfer">Transfer</option></select><select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={styles.field}><option value="all">All categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div><div className={styles.chipRow}>{groups.map((group) => <button key={group} type="button" className={cx(styles.chip, groupFilter === group ? styles.chipActive : "")} onClick={() => setGroupFilter(group)}>{group}</button>)}</div></div><div className={styles.feedList}>{transactions.map((tx) => { const selected = selectedRecord.kind === "tx" && selectedRecord.id === tx.id; const tone = toneForType(tx.type); const Icon = iconForType(tx.type); const receiptCount = receiptCountsByTransaction?.get(String(tx.id)) || 0; return <button key={tx.id} type="button" className={cx(styles.feedRow, selected ? styles.feedRowActive : "")} onClick={() => onSelect({ kind: "tx", id: tx.id })}><MerchantMark merchant={tx.merchant || tx.note || tx.type} /><div className={styles.feedMain}><div className={styles.feedTop}><div className={styles.feedNameRow}><span className={styles.feedName}>{tx.merchant || tx.note || tx.type}</span><span className={styles.feedMicro}>{tx.type === "transfer" ? `${tx.accountName} → ${tx.transferAccountName || "Account"}` : tx.accountName || tx.account || "Account"}</span>{receiptCount > 0 ? <span className={styles.feedBadge}><Receipt size={11} />{receiptCount}</span> : null}</div><div className={cx(styles.feedAmount, styles[`feedAmount_${tone}`])}>{money(tx.amount)}</div></div><div className={styles.feedMeta}><Icon size={12} />{shortDate(tx.date)} · {fmtTime(tx.time)} · {tx.type}{isBillManagedTransaction(tx) ? " · bills-owned" : ""}</div></div></button>; })}{plannedItems.length ? <div className={styles.feedDivider}>Planned pressure</div> : null}{plannedItems.map((item) => { const selected = selectedRecord.kind === "planned" && selectedRecord.id === item.id; return <button key={item.id} type="button" className={cx(styles.feedRow, selected ? styles.feedRowActive : "")} onClick={() => onSelect({ kind: "planned", id: item.id })}><div className={cx(styles.merchantMark, styles.merchantMark_amber)}><CalendarClock size={15} /></div><div className={styles.feedMain}><div className={styles.feedTop}><div className={styles.feedNameRow}><span className={styles.feedName}>{item.merchant || item.note || "Planned item"}</span><span className={styles.feedMicro}>planned</span></div><div className={cx(styles.feedAmount, styles.feedAmount_amber)}>{money(item.amount)}</div></div><div className={styles.feedMeta}><CalendarClock size={12} />{shortDate(item.date)} · {fmtTime(item.time)}</div></div></button>; })}{!transactions.length && !plannedItems.length ? <EmptyCard title="Nothing here" body="No rows match the current filters." /> : null}</div></GlassPane>;
}

export function StudioPane(props) {
  const { tab, setTab, totals, expenseTrend, trendDataRows, topMerchants, upcomingItems, totalsByCategory, selectedTx, selectedPlanned, categoriesById, selectedCategory, receiptCoverage, detailSheetOpen, onCloseDetailSheet, receiptFeatureReady, receiptDraft, receiptDraftSummary, selectedReceipts, selectedReceiptItemsByReceiptId, onStartReceiptDraft } = props;
  const selectedCategoryId = selectedTx?.categoryId || selectedPlanned?.categoryId || "";
  const selectedCategoryRow = totalsByCategory.find((row) => row.categoryId === selectedCategoryId) || null;
  const stageTabs = [{ value: "overview", label: "Overview" }, { value: "categoryLab", label: "Category Lab" }, { value: "command", label: "Command" }];
  const [actionTray, setActionTray] = React.useState("");
  const toggleTray = (value) => setActionTray((prev) => prev === value ? "" : value);

  return <GlassPane tone="neutral" size="card" className={styles.stagePane}>
    <SectionHeader title="Spending studio" subcopy="Keep the workspace strategic. Use the detail sheet for row-by-row judgment and receipt breakdown." right={<div className={styles.studioActions}><div className={styles.tabRow}>{stageTabs.map((item) => <button key={item.value} type="button" className={cx(styles.tab, tab === item.value ? styles.tabActive : "")} onClick={() => { setTab(item.value); setActionTray(""); }}>{item.label}</button>)}</div><ActionBtn onClick={() => toggleTray("new")}><Plus size={13} />New</ActionBtn><ActionBtn onClick={() => toggleTray("tools")}><FolderKanban size={13} />Tools</ActionBtn></div>} />
    {actionTray === "new" ? <div className={styles.actionTray}><button type="button" className={styles.actionTrayItem} onClick={() => { onStartReceiptDraft(selectedTx || null); setActionTray(""); }}><Camera size={14} />Scan receipt</button><button type="button" className={styles.actionTrayItem} onClick={() => { props.setMode("now"); props.setQaType("expense"); props.setToolPanel("capture"); setTab("command"); setActionTray(""); }}><CreditCard size={14} />Add expense</button><button type="button" className={styles.actionTrayItem} onClick={() => { props.setMode("planned"); props.setQaType("expense"); props.setToolPanel("capture"); setTab("command"); setActionTray(""); }}><CalendarClock size={14} />Add planned</button></div> : null}
    {actionTray === "tools" ? <div className={styles.actionTray}><button type="button" className={styles.actionTrayItem} onClick={() => { setTab("categoryLab"); setActionTray(""); }}><PiggyBank size={14} />Budget lab</button><button type="button" className={styles.actionTrayItem} onClick={() => { setActionTray(""); props.setToolPanel("insights"); setTab("command"); }}><Sparkles size={14} />Insights</button></div> : null}
    {tab === "overview" ? <OverviewView totals={totals} expenseTrend={expenseTrend} trendData={trendDataRows} topMerchants={topMerchants} upcomingItems={upcomingItems} totalsByCategory={totalsByCategory} selectedCategory={selectedCategory} receiptCoverage={receiptCoverage} /> : null}
    {tab === "categoryLab" ? <CategoryLabView totalsByCategory={totalsByCategory} budgetLoad={props.budgetLoad} forecastRemaining={props.forecastRemaining} topMerchants={topMerchants} budgetEditorCategoryId={props.budgetEditorCategoryId} setBudgetEditorCategoryId={props.setBudgetEditorCategoryId} budgetEditorValue={props.budgetEditorValue} setBudgetEditorValue={props.setBudgetEditorValue} budgetMode={props.budgetMode} onSaveBudgetValue={props.onSaveBudgetValue} newCategoryName={props.newCategoryName} setNewCategoryName={props.setNewCategoryName} newCategoryGroup={props.newCategoryGroup} setNewCategoryGroup={props.setNewCategoryGroup} groups={props.groups} onSaveCategory={props.onSaveCategory} saving={props.saving} /> : null}
    {tab === "command" ? <div className={styles.commandGrid}><CapturePanel {...props} /><FocusedInsightsPanel topMerchants={topMerchants} selectedCategory={props.selectedCategory} selectedSpent={props.selectedSpent} selectedPlannedTotal={props.selectedPlannedTotal} selectedBudget={props.selectedBudget} selectedForecast={props.selectedForecast} selectedLoadPct={props.selectedLoadPct} upcomingItems={upcomingItems} /></div> : null}
    <TransactionDetailSheet open={detailSheetOpen} onClose={onCloseDetailSheet} selectedTx={selectedTx} selectedPlanned={selectedPlanned} categoriesById={categoriesById} allTransactions={props.allTransactions} selectedCategoryRow={selectedCategoryRow} selectedReceipts={selectedReceipts} selectedReceiptItemsByReceiptId={selectedReceiptItemsByReceiptId} onDuplicate={props.onDuplicateTransaction} onDelete={props.onDeleteTransaction} onStartReceiptDraft={onStartReceiptDraft} receiptDraft={receiptDraft} receiptDraftSummary={receiptDraftSummary} categories={props.categories} accounts={props.accounts} onClearReceiptDraft={props.onClearReceiptDraft} onReceiptFileChosen={props.onReceiptFileChosen} onReceiptDraftChange={props.onReceiptDraftChange} onReceiptDraftAddLine={props.onReceiptDraftAddLine} onReceiptDraftUpdateLine={props.onReceiptDraftUpdateLine} onReceiptDraftRemoveLine={props.onReceiptDraftRemoveLine} onSaveReceiptDraft={props.onSaveReceiptDraft} saving={props.saving} convertAccountId={props.convertAccountId} setConvertAccountId={props.setConvertAccountId} onConvertPlanned={props.onConvertPlanned} onDeletePlanned={props.onDeletePlanned} />
  </GlassPane>;
}

export function ToolsPane(props) {
  return <GlassPane tone="neutral" size="card" className={styles.stagePane}><SectionHeader title="Command tools" subcopy="Mobile command center for capture and insights." /><div className={styles.commandGrid}><CapturePanel {...props} /><FocusedInsightsPanel topMerchants={props.topMerchants} selectedCategory={props.selectedCategory} selectedSpent={props.selectedSpent} selectedPlannedTotal={props.selectedPlannedTotal} selectedBudget={props.selectedBudget} selectedForecast={props.selectedForecast} selectedLoadPct={props.selectedLoadPct} upcomingItems={props.upcomingItems || []} /></div></GlassPane>;
}

export function ToastStack({ status, pageError, onClearError }) {
  if (!status && !pageError) return null;
  return <div className={styles.toastStack}>{status ? <div className={cx(styles.toast, styles.toastOk)}><CheckCircle2 size={14} />{status}</div> : null}{pageError ? <div className={cx(styles.toast, styles.toastError)}><X size={14} />{pageError}<button type="button" className={styles.iconButton} onClick={onClearError}><X size={12} /></button></div> : null}</div>;
}

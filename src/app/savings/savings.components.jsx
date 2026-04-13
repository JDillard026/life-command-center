"use client";

import {
  Archive,
  ArrowUpRight,
  ChevronRight,
  Copy,
  Download,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Undo2,
  Upload,
} from "lucide-react";
import GlassPane from "../components/GlassPane";
import styles from "./SavingsPage.module.css";
import {
  GOAL_PRESETS,
  PRIORITY_OPTIONS,
  QUICK_AMOUNTS,
  BOARD_TABS,
  amountLeft,
  dueLabel,
  dueTone,
  fmtDate,
  fmtMoney,
  fmtMoneyTight,
  formatAgo,
  fundingMood,
  goalInitials,
  paceNeed,
  parseMoneyInput,
  pct,
  priorityTone,
  progressPercent,
  progressTone,
  recentProjection,
  resolvedGoalName,
  toneMeta,
} from "./savings.helpers";

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
        boxShadow: `0 0 16px ${meta.glow}`,
      }}
    >
      {children}
    </div>
  );
}

export function ActionBtn({
  children,
  onClick,
  variant = "ghost",
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

function ProgressBar({ fill = 0, tone = "neutral" }) {
  const normalized = Math.max(0, Math.min(100, Number(fill) || 0));
  const toneMap = {
    neutral: "linear-gradient(90deg, rgba(96,165,250,.95), rgba(147,197,253,.95))",
    green: "linear-gradient(90deg, rgba(74,222,128,.95), rgba(167,243,208,.95))",
    amber: "linear-gradient(90deg, rgba(251,191,36,.95), rgba(253,230,138,.95))",
    red: "linear-gradient(90deg, rgba(248,113,113,.95), rgba(252,165,165,.95))",
  };

  return (
    <div className={styles.progress}>
      <div
        className={styles.progressFill}
        style={{
          width: `${normalized}%`,
          background: toneMap[tone] || toneMap.neutral,
        }}
      />
    </div>
  );
}

function StatCard({ label, value, sub, tone = "neutral" }) {
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

function InfoRow({ label, value, tone = "neutral" }) {
  const color =
    tone === "green"
      ? "#97efc7"
      : tone === "amber"
      ? "#f5cf88"
      : tone === "red"
      ? "#ffb4c5"
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

function EmptyState({ title, copy, minHeight = 160 }) {
  return (
    <div className={styles.emptyState} style={{ minHeight }}>
      <div>
        <div className={styles.emptyTitle}>{title}</div>
        <div className={styles.emptyText}>{copy}</div>
      </div>
    </div>
  );
}

export function SummaryStrip({
  totals,
  focusMode,
  monthLabel,
  activeGoals,
  selectedGoal,
  heroTone,
}) {
  return (
    <GlassPane className={styles.summaryStrip}>
      <div className={styles.summaryInner}>
        <div className={styles.titleBlock}>
          <div className={styles.eyebrow}>Money / Savings</div>
          <div className={styles.pageTitleRow}>
            <div className={styles.pageTitle}>Savings</div>
            <MiniPill tone="green">command</MiniPill>
          </div>
          <div className={styles.workspaceCopy}>
            Make saving feel rewarding, visible, and hard to ignore.
          </div>
        </div>

        <div className={styles.summaryStats}>
          <div className={styles.summaryStat}>
            <div className={styles.summaryLabel}>Saved</div>
            <div className={styles.summaryValue}>{fmtMoney(totals.totalCurrent)}</div>
            <div className={styles.summaryHint}>{monthLabel}</div>
          </div>

          <div className={styles.summaryStat}>
            <div className={styles.summaryLabel}>Target</div>
            <div className={styles.summaryValue}>{fmtMoney(totals.totalTarget)}</div>
            <div className={styles.summaryHint}>active board</div>
          </div>

          <div className={styles.summaryStat}>
            <div className={styles.summaryLabel}>Still Needed</div>
            <div className={styles.summaryValue}>{fmtMoney(totals.totalLeft)}</div>
            <div className={styles.summaryHint}>to fully fund</div>
          </div>

          <div className={styles.summaryStat}>
            <div className={styles.summaryLabel}>Funding Health</div>
            <div className={styles.summaryValue}>{pct(totals.completion)}</div>
            <div className={styles.summaryHint}>{totals.fundedCount} funded</div>
          </div>

          <div className={styles.summaryStat}>
            <div className={styles.summaryLabel}>Pressure</div>
            <div className={styles.summaryValue}>
              {totals.dueSoonCount + totals.overdueCount}
            </div>
            <div className={styles.summaryHint}>
              {totals.overdueCount > 0 ? `${totals.overdueCount} overdue` : "watch list"}
            </div>
          </div>
        </div>

        <div className={styles.summaryRight}>
          <MiniPill tone={heroTone}>{focusMode}</MiniPill>
          <MiniPill tone="green">{activeGoals.length} active goals</MiniPill>
          {selectedGoal ? (
            <MiniPill tone={progressTone(selectedGoal)}>
              {selectedGoal.name}
            </MiniPill>
          ) : null}
        </div>
      </div>
    </GlassPane>
  );
}

function GoalRow({
  goal,
  selected,
  priority,
  onSelect,
  onDuplicate,
  onArchive,
  onDelete,
}) {
  const dueStatusTone = dueTone(goal);
  const progressStatusTone = progressTone(goal);
  const meta = toneMeta(
    dueStatusTone === "red"
      ? "red"
      : progressStatusTone === "green"
      ? "green"
      : "neutral"
  );
  const projection = recentProjection(goal);

  return (
    <div
      className={cx(styles.queueRow, selected && styles.queueRowActive)}
      onClick={onSelect}
      style={{
        borderColor: selected ? meta.border : undefined,
        boxShadow: selected ? `0 0 24px ${meta.glow}` : undefined,
      }}
    >
      <div
        className={styles.queueAccent}
        style={{ background: selected ? meta.text : "transparent" }}
      />

      <div
        className={styles.goalAvatar}
        style={{
          borderColor: meta.border,
          color: dueStatusTone === "neutral" ? "#fff" : meta.text,
          boxShadow: `0 0 12px ${meta.glow}`,
        }}
      >
        {goalInitials(goal.name)}
      </div>

      <div className={styles.queueMain}>
        <div className={styles.queueTop}>
          <div className={styles.queueName}>{goal.name || "Untitled goal"}</div>
          <div className={styles.queueAmount}>{fmtMoney(goal.target)}</div>
        </div>

        <div className={styles.queueMeta}>
          {fmtMoney(goal.current)} saved • {fmtMoney(amountLeft(goal))} left • {projection.text}
        </div>

        <div className={styles.queueBadges}>
          {priority ? <MiniPill tone="amber">Rank #{priority}</MiniPill> : null}
          <MiniPill tone={priorityTone(goal.priority)}>{goal.priority}</MiniPill>
          <MiniPill tone={dueStatusTone}>{dueLabel(goal)}</MiniPill>
          <MiniPill tone={progressStatusTone}>{pct(progressPercent(goal))}</MiniPill>
          {goal.archived ? <MiniPill>Archived</MiniPill> : null}
        </div>

        <div style={{ marginTop: 10 }}>
          <ProgressBar fill={progressPercent(goal)} tone={progressStatusTone} />
        </div>
      </div>

      <div className={styles.queueActions} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={styles.iconBtn}
          onClick={onDuplicate}
          aria-label="Duplicate goal"
          title="Duplicate goal"
        >
          <Copy size={14} />
        </button>
        <button
          type="button"
          className={styles.iconBtn}
          onClick={onArchive}
          aria-label={goal.archived ? "Unarchive goal" : "Archive goal"}
          title={goal.archived ? "Unarchive goal" : "Archive goal"}
        >
          <Archive size={14} />
        </button>
        <button
          type="button"
          className={cx(styles.iconBtn, styles.iconBtnDanger)}
          onClick={onDelete}
          aria-label="Delete goal"
          title="Delete goal"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <ChevronRight size={14} className={styles.queueChevron} />
    </div>
  );
}

export function RosterPane({
  visibleGoals,
  selectedGoal,
  priorityMap,
  search,
  setSearch,
  filter,
  setFilter,
  sort,
  setSort,
  focusMode,
  setFocusMode,
  onSelectGoal,
  onDuplicate,
  onArchive,
  onDelete,
}) {
  return (
    <GlassPane className={styles.queuePane}>
      <PaneHeader
        title="Goal navigator"
        subcopy="Choose the goal you want to command."
        right={<MiniPill>{visibleGoals.length} showing</MiniPill>}
      />

      <div className={styles.queueToolbar}>
        <label className={styles.searchWrap}>
          <Search size={14} />
          <input
            className={styles.searchInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search goals..."
          />
        </label>

        <div className={styles.scopeTabs}>
          <button
            type="button"
            className={cx(styles.scopeTab, filter === "active" && styles.scopeTabActive)}
            onClick={() => setFilter("active")}
          >
            Active
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
            className={cx(styles.scopeTab, filter === "archived" && styles.scopeTabActive)}
            onClick={() => setFilter("archived")}
          >
            Archived
          </button>
          <button
            type="button"
            className={cx(styles.scopeTab, filter === "due" && styles.scopeTabActive)}
            onClick={() => setFilter("due")}
          >
            Due soon
          </button>
        </div>

        <div className={styles.queueMetaRow}>
          <select
            className={styles.field}
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="priority">Priority</option>
            <option value="due">Due first</option>
            <option value="left">Amount left</option>
            <option value="progress">Least funded</option>
            <option value="updated">Recently updated</option>
            <option value="name">Name</option>
          </select>

          <div className={styles.focusModeRow}>
            <button
              type="button"
              className={cx(styles.filterChip, focusMode === "deadline" && styles.filterChipActive)}
              onClick={() => setFocusMode("deadline")}
            >
              deadline
            </button>
            <button
              type="button"
              className={cx(styles.filterChip, focusMode === "gap" && styles.filterChipActive)}
              onClick={() => setFocusMode("gap")}
            >
              gap
            </button>
            <button
              type="button"
              className={cx(styles.filterChip, focusMode === "progress" && styles.filterChipActive)}
              onClick={() => setFocusMode("progress")}
            >
              progress
            </button>
          </div>
        </div>
      </div>

      {visibleGoals.length ? (
        <div className={styles.queueList}>
          {visibleGoals.map((goal) => (
            <GoalRow
              key={goal.id}
              goal={goal}
              selected={goal.id === selectedGoal?.id}
              priority={priorityMap.get(goal.id) ?? null}
              onSelect={() => onSelectGoal(goal.id)}
              onDuplicate={() => onDuplicate(goal)}
              onArchive={() => onArchive(goal)}
              onDelete={() => onDelete(goal.id)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No goals found"
          copy="Clear filters or add a new savings goal."
          minHeight={220}
        />
      )}
    </GlassPane>
  );
}

function GoalMix({ goals }) {
  if (!goals.length) {
    return (
      <EmptyState
        title="No active goals"
        copy="Add goals to build the savings mix."
        minHeight={140}
      />
    );
  }

  const total = goals.reduce((sum, g) => sum + Number(g.current || 0), 0);

  return (
    <div className={styles.mixGrid}>
      {goals.slice(0, 7).map((goal) => {
        const share = total > 0 ? (Number(goal.current || 0) / total) * 100 : 0;

        return (
          <div key={goal.id} className={styles.mixRow}>
            <div className={styles.mixLabel}>{goal.name}</div>
            <div className={styles.mixTrack}>
              <div
                className={styles.mixFill}
                style={{ width: `${Math.max(4, share)}%` }}
              />
            </div>
            <div className={styles.mixAmount}>{fmtMoney(goal.current)}</div>
          </div>
        );
      })}
    </div>
  );
}

function FocusGoalPanel({
  goal,
  priority,
  saving,
  onDuplicate,
  onArchive,
  onDelete,
  onQuickAdd,
  onUndoLast,
  customAmount,
  customNote,
  setCustomAmount,
  setCustomNote,
  onCustomAdd,
}) {
  if (!goal) {
    return (
      <div className={styles.panel}>
        <PaneHeader
          title="Focus goal"
          subcopy="Choose one from the roster to work it here."
        />
        <EmptyState
          title="No goal selected"
          copy="Pick one from the roster on the left."
          minHeight={220}
        />
      </div>
    );
  }

  const dueStatusTone = dueTone(goal);
  const progressStatusTone = progressTone(goal);
  const left = amountLeft(goal);
  const need = paceNeed(goal);
  const projection = recentProjection(goal);
  const mood = fundingMood(goal);

  return (
    <div className={styles.panel}>
      <PaneHeader
        title={goal.name || "Untitled goal"}
        subcopy="Focused controls for the goal you are actively touching."
        right={
          <div className={styles.inlineRow}>
            {priority ? <MiniPill tone="amber">Rank #{priority}</MiniPill> : null}
            <MiniPill tone={priorityTone(goal.priority)}>{goal.priority}</MiniPill>
            <MiniPill tone={dueStatusTone}>{dueLabel(goal)}</MiniPill>
            {goal.archived ? <MiniPill>Archived</MiniPill> : null}
            {saving ? <MiniPill tone="amber">Saving...</MiniPill> : null}
          </div>
        }
      />

      <div className={styles.focusShell}>
        <div className={styles.metricLabel}>Current saved</div>

        <div
          className={styles.focusValue}
          style={{ color: progressStatusTone === "green" ? "#97efc7" : "#fff" }}
        >
          {fmtMoney(goal.current)}
        </div>

        <div className={styles.focusSub}>
          Target {fmtMoney(goal.target)} • Updated {formatAgo(goal.updatedAt)}
        </div>

        <div className={styles.infoGrid}>
          <div className={styles.infoCell}>
            <div className={styles.metricLabel}>Left</div>
            <div className={styles.infoValue}>{fmtMoney(left)}</div>
            <div className={styles.infoSub}>Still needed to finish</div>
          </div>

          <div className={styles.infoCell}>
            <div className={styles.metricLabel}>Progress</div>
            <div className={styles.infoValue}>{pct(progressPercent(goal))}</div>
            <div className={styles.infoSub}>Of total target</div>
          </div>

          <div className={styles.infoCell}>
            <div className={styles.metricLabel}>Monthly pace</div>
            <div className={styles.infoValue}>
              {need.perMonth !== null ? fmtMoney(need.perMonth) : "—"}
            </div>
            <div className={styles.infoSub}>
              {goal.dueDate ? "Needed to hit due date" : "No due date assigned"}
            </div>
          </div>

          <div className={styles.infoCell}>
            <div className={styles.metricLabel}>Projection</div>
            <div className={styles.infoValue}>{projection.text}</div>
            <div className={styles.infoSub}>Based on recent contribution pace</div>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <ProgressBar fill={progressPercent(goal)} tone={progressStatusTone} />
        </div>

        <div className={styles.moodCard}>
          <div className={styles.moodTop}>
            <Sparkles size={15} />
            <span>{mood.title}</span>
          </div>
          <div className={styles.moodCopy}>{mood.copy}</div>
        </div>

        <div className={styles.quickChipRow}>
          {QUICK_AMOUNTS.map((amount) => (
            <ActionBtn key={amount} onClick={() => onQuickAdd(amount)}>
              +{fmtMoney(amount)}
            </ActionBtn>
          ))}
        </div>

        <div className={styles.contributionGrid}>
          <input
            className={styles.field}
            inputMode="decimal"
            placeholder="Custom amount"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
          />

          <input
            className={styles.field}
            placeholder="Note (optional)"
            value={customNote}
            onChange={(e) => setCustomNote(e.target.value)}
          />

          <ActionBtn variant="primary" onClick={onCustomAdd}>
            Add
          </ActionBtn>
        </div>

        <div className={cx(styles.actionGrid, styles.actionGridTight)}>
          <ActionBtn onClick={onDuplicate} full>
            <Copy size={14} /> Duplicate
          </ActionBtn>
          <ActionBtn onClick={onUndoLast} full>
            <Undo2 size={14} /> Undo last
          </ActionBtn>
          <ActionBtn onClick={onArchive} full>
            <Archive size={14} /> {goal.archived ? "Unarchive" : "Archive"}
          </ActionBtn>
          <ActionBtn variant="danger" onClick={onDelete} full>
            <Trash2 size={14} /> Delete
          </ActionBtn>
        </div>
      </div>
    </div>
  );
}

function GoalEditorPanel({ goal, saving, onPatch }) {
  if (!goal) {
    return (
      <div className={styles.panel}>
        <PaneHeader
          title="Goal details"
          subcopy="Select a goal to edit the deeper fields."
        />
        <EmptyState
          title="No goal selected"
          copy="Choose one from the roster to edit it here."
          minHeight={180}
        />
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <PaneHeader
        title="Goal details"
        subcopy="This section autosaves as you type."
        right={saving ? <MiniPill tone="amber">Saving...</MiniPill> : null}
      />

      <div className={styles.formStack}>
        <div className={styles.formGrid3}>
          <div className={styles.fieldWrap}>
            <span>Goal name</span>
            <input
              className={styles.field}
              value={goal.name}
              onChange={(e) => onPatch({ name: e.target.value })}
            />
          </div>

          <div className={styles.fieldWrap}>
            <span>Priority</span>
            <select
              className={styles.field}
              value={goal.priority}
              onChange={(e) => onPatch({ priority: e.target.value })}
            >
              {PRIORITY_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.fieldWrap}>
            <span>Due date</span>
            <input
              className={styles.field}
              type="date"
              value={goal.dueDate || ""}
              onChange={(e) => onPatch({ dueDate: e.target.value })}
            />
          </div>
        </div>

        <div className={styles.formGrid3}>
          <div className={styles.fieldWrap}>
            <span>Current saved</span>
            <input
              className={styles.field}
              value={String(goal.current || "")}
              onChange={(e) => onPatch({ current: Number(e.target.value) || 0 })}
            />
          </div>

          <div className={styles.fieldWrap}>
            <span>Target</span>
            <input
              className={styles.field}
              value={String(goal.target || "")}
              onChange={(e) => onPatch({ target: Number(e.target.value) || 0 })}
            />
          </div>

          <div className={styles.fieldWrap}>
            <span>Archived</span>
            <select
              className={styles.field}
              value={goal.archived ? "yes" : "no"}
              onChange={(e) => onPatch({ archived: e.target.value === "yes" })}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
        </div>

        <div className={styles.infoCell}>
          <div className={styles.metricLabel}>Computed read</div>
          <div className={styles.infoValue}>
            {fmtMoney(goal.current)} / {fmtMoney(goal.target)} • {pct(progressPercent(goal))}
          </div>
          <div className={styles.infoSub}>
            {dueLabel(goal)} • {fmtMoney(amountLeft(goal))} left
          </div>
        </div>
      </div>
    </div>
  );
}

function AddGoalPanel({ adding, setAdding, onAdd, saving }) {
  return (
    <div className={styles.panel}>
      <PaneHeader
        title="Add goal"
        subcopy="Make starting a goal feel fast enough that you actually do it."
        right={
          <MiniPill>
            <Plus size={13} /> New
          </MiniPill>
        }
      />

      <div className={styles.formStack}>
        <div className={styles.inlineRow}>
          {GOAL_PRESETS.slice(0, 5).map((item) => (
            <ActionBtn
              key={item}
              variant={adding.preset === item ? "primary" : "ghost"}
              onClick={() => setAdding((p) => ({ ...p, preset: item }))}
            >
              {item === "Truck / Car Fund" ? "Truck / Car" : item}
            </ActionBtn>
          ))}
          <ActionBtn
            variant={adding.preset === "Other" ? "primary" : "ghost"}
            onClick={() => setAdding((p) => ({ ...p, preset: "Other" }))}
          >
            Other
          </ActionBtn>
        </div>

        {adding.preset === "Other" ? (
          <div className={styles.fieldWrap}>
            <span>Goal name</span>
            <input
              className={styles.field}
              placeholder="New goal name..."
              value={adding.customName}
              onChange={(e) =>
                setAdding((p) => ({ ...p, customName: e.target.value }))
              }
            />
          </div>
        ) : null}

        <div className={styles.fieldWrap}>
          <span>Resolved goal</span>
          <input
            className={styles.field}
            value={resolvedGoalName(adding.preset, adding.customName)}
            readOnly
          />
        </div>

        <div className={styles.formGrid2}>
          <div className={styles.fieldWrap}>
            <span>Target</span>
            <input
              className={styles.field}
              inputMode="decimal"
              placeholder="0.00"
              value={adding.target}
              onChange={(e) => setAdding((p) => ({ ...p, target: e.target.value }))}
            />
          </div>

          <div className={styles.fieldWrap}>
            <span>Starting saved</span>
            <input
              className={styles.field}
              inputMode="decimal"
              placeholder="0.00"
              value={adding.current}
              onChange={(e) => setAdding((p) => ({ ...p, current: e.target.value }))}
            />
          </div>
        </div>

        <div className={styles.formGrid2}>
          <div className={styles.fieldWrap}>
            <span>Due date</span>
            <input
              className={styles.field}
              type="date"
              value={adding.dueDate}
              onChange={(e) => setAdding((p) => ({ ...p, dueDate: e.target.value }))}
            />
          </div>

          <div className={styles.fieldWrap}>
            <span>Priority</span>
            <select
              className={styles.field}
              value={adding.priority}
              onChange={(e) => setAdding((p) => ({ ...p, priority: e.target.value }))}
            >
              {PRIORITY_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        </div>

        <ActionBtn variant="primary" onClick={onAdd} full disabled={saving}>
          <Plus size={14} /> {saving ? "Saving..." : "Add goal"}
        </ActionBtn>
      </div>
    </div>
  );
}

function ContributionsPanel({
  selectedGoal,
  selectedContributions,
  contributionFeed,
  customAmount,
  customNote,
  setCustomAmount,
  setCustomNote,
  onCustomAdd,
  onQuickAdd,
}) {
  return (
    <div className={styles.splitLayoutFill}>
      <div className={styles.panel}>
        <PaneHeader
          title="Contribution history"
          subcopy={
            selectedGoal
              ? `History for ${selectedGoal.name}`
              : "Select a goal to view its contribution history."
          }
          right={
            selectedGoal ? (
              <MiniPill tone="green">{selectedContributions.length} rows</MiniPill>
            ) : null
          }
        />

        {selectedGoal ? (
          selectedContributions.length ? (
            <div className={styles.feedList}>
              {selectedContributions.map((entry) => (
                <div key={entry.id} className={styles.feedItem}>
                  <div className={styles.feedTop}>
                    <div>
                      <div className={styles.feedTitle}>{fmtMoneyTight(entry.amount)}</div>
                      <div className={styles.feedSub}>
                        {fmtDate(entry.date)}
                        {entry.note ? ` • ${entry.note}` : ""}
                      </div>
                    </div>
                    <MiniPill tone="green">added</MiniPill>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No contributions yet"
              copy="Use the quick adds or custom amount to start the history."
              minHeight={220}
            />
          )
        ) : (
          <EmptyState
            title="No goal selected"
            copy="Pick a goal from the left roster."
            minHeight={220}
          />
        )}
      </div>

      <div className={styles.asideStackFill}>
        <div className={styles.panel}>
          <PaneHeader
            title="Quick add"
            subcopy="Fast inputs without leaving the page."
          />

          {selectedGoal ? (
            <>
              <div className={styles.quickChipRow}>
                {QUICK_AMOUNTS.map((amount) => (
                  <ActionBtn key={amount} onClick={() => onQuickAdd(amount)}>
                    +{fmtMoney(amount)}
                  </ActionBtn>
                ))}
              </div>

              <div className={styles.contributionGrid}>
                <input
                  className={styles.field}
                  inputMode="decimal"
                  placeholder="Custom amount"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                />
                <input
                  className={styles.field}
                  placeholder="Note"
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                />
                <ActionBtn variant="primary" onClick={onCustomAdd}>
                  Add
                </ActionBtn>
              </div>
            </>
          ) : (
            <EmptyState
              title="No goal selected"
              copy="Pick a goal before adding contribution rows."
              minHeight={140}
            />
          )}
        </div>

        <div className={styles.panel}>
          <PaneHeader
            title="Recent board feed"
            subcopy="Latest adds across all active goals."
          />

          {contributionFeed.length ? (
            <div className={styles.feedList}>
              {contributionFeed.map((item) => (
                <div key={item.id} className={styles.feedItem}>
                  <div className={styles.feedTop}>
                    <div>
                      <div className={styles.feedTitle}>{item.goalName}</div>
                      <div className={styles.feedSub}>
                        {fmtDate(item.date)}
                        {item.note ? ` • ${item.note}` : ""}
                      </div>
                    </div>
                    <MiniPill tone="green">{fmtMoneyTight(item.amount)}</MiniPill>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No contributions logged"
              copy="The board feed will populate as you start adding money."
              minHeight={140}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function PlannerPanel({
  selectedGoal,
  plannerPushValue,
  setPlannerPushValue,
  plannerSimulation,
}) {
  const selectedNeed = selectedGoal ? paceNeed(selectedGoal) : null;
  const selectedMood = selectedGoal ? fundingMood(selectedGoal) : null;

  return (
    <div className={styles.splitLayoutFill}>
      <div className={styles.panel}>
        <PaneHeader
          title="Finish planner"
          subcopy="Run a monthly push and see how fast the goal closes."
          right={
            selectedGoal ? (
              <MiniPill tone={recentProjection(selectedGoal).tone}>
                {recentProjection(selectedGoal).text}
              </MiniPill>
            ) : null
          }
        />

        {selectedGoal ? (
          <div className={styles.plannerGrid}>
            <div className={styles.infoCell}>
              <div className={styles.metricLabel}>Left to fund</div>
              <div className={styles.infoValue}>{fmtMoney(amountLeft(selectedGoal))}</div>
              <div className={styles.infoSub}>Gap still open on this goal</div>
            </div>

            <div className={styles.infoCell}>
              <div className={styles.metricLabel}>Due date</div>
              <div className={styles.infoValue}>
                {selectedGoal.dueDate ? fmtDate(selectedGoal.dueDate) : "No due date"}
              </div>
              <div className={styles.infoSub}>{dueLabel(selectedGoal)}</div>
            </div>

            <div className={styles.infoCell}>
              <div className={styles.metricLabel}>Needed / month</div>
              <div className={styles.infoValue}>
                {selectedNeed?.perMonth !== null ? fmtMoney(selectedNeed.perMonth) : "—"}
              </div>
              <div className={styles.infoSub}>To land by the due date</div>
            </div>

            <div className={styles.infoCell}>
              <div className={styles.metricLabel}>Needed / week</div>
              <div className={styles.infoValue}>
                {selectedNeed?.perWeek !== null ? fmtMoney(selectedNeed.perWeek) : "—"}
              </div>
              <div className={styles.infoSub}>Shorter pace read</div>
            </div>

            <div className={styles.plannerControl}>
              <div className={styles.metricLabel}>Simulated monthly add</div>
              <div className={styles.plannerInputRow}>
                <input
                  className={styles.field}
                  inputMode="decimal"
                  placeholder="0.00"
                  value={plannerPushValue}
                  onChange={(e) => setPlannerPushValue(e.target.value)}
                />
                <ActionBtn
                  onClick={() =>
                    setPlannerPushValue(String(Math.round(selectedNeed?.perMonth || 0)))
                  }
                >
                  Use needed pace
                </ActionBtn>
              </div>
            </div>

            <div className={styles.plannerResult}>
              <div className={styles.metricLabel}>Simulated finish</div>
              <div className={styles.plannerValue}>
                {plannerSimulation?.finishLabel || "—"}
              </div>
              <div className={styles.infoSub}>
                {plannerSimulation?.months !== null && plannerSimulation?.months !== undefined
                  ? `${plannerSimulation.months} month${plannerSimulation.months === 1 ? "" : "s"} at that push`
                  : "Set a monthly push to run the finish simulation."}
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            title="No goal selected"
            copy="Pick a goal to run the finish planner."
            minHeight={220}
          />
        )}
      </div>

      <div className={styles.asideStackFill}>
        <div className={styles.panel}>
          <PaneHeader
            title="Recommended move"
            subcopy="Blunt next move based on where this goal sits."
          />

          {selectedGoal && selectedMood ? (
            <div className={styles.moodCard} style={{ marginTop: 0 }}>
              <div className={styles.moodTop}>
                <Sparkles size={15} />
                <span>{selectedMood.title}</span>
              </div>
              <div className={styles.moodCopy}>{selectedMood.copy}</div>
            </div>
          ) : (
            <EmptyState
              title="No goal selected"
              copy="Pick a goal to get a planner recommendation."
              minHeight={140}
            />
          )}
        </div>

        <div className={styles.panel}>
          <PaneHeader
            title="Board snapshot"
            subcopy="The planner still respects the whole board."
          />
          {selectedGoal ? (
            <div className={styles.infoList}>
              <InfoRow label="Target" value={fmtMoney(selectedGoal.target)} />
              <InfoRow label="Saved" value={fmtMoney(selectedGoal.current)} tone="green" />
              <InfoRow label="Left" value={fmtMoney(amountLeft(selectedGoal))} tone="amber" />
              <InfoRow
                label="Funding health"
                value={pct(progressPercent(selectedGoal))}
                tone={progressTone(selectedGoal)}
              />
            </div>
          ) : (
            <EmptyState
              title="No goal selected"
              copy="Pick a goal to see board snapshot."
              minHeight={140}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ToolsPanel({
  adding,
  setAdding,
  onAddGoal,
  addingBusy,
  selectedGoal,
  selectedSaving,
  onPatchGoal,
  onDuplicateGoal,
  onToggleArchiveGoal,
  onDeleteGoal,
  onSetBoardTab,
  ioText,
  setIoText,
  onExportGoals,
  onImportGoals,
}) {
  return (
    <div className={styles.splitLayoutFill}>
      <div className={styles.asideStackFill}>
        <AddGoalPanel
          adding={adding}
          setAdding={setAdding}
          onAdd={onAddGoal}
          saving={addingBusy}
        />

        <GoalEditorPanel
          goal={selectedGoal}
          saving={selectedSaving}
          onPatch={onPatchGoal}
        />
      </div>

      <div className={styles.asideStackFill}>
        <div className={styles.panel}>
          <PaneHeader
            title="Import / export"
            subcopy="Move the board in and out without losing your work."
          />

          <div className={styles.inlineRow} style={{ marginBottom: 10 }}>
            <ActionBtn onClick={onExportGoals}>
              <Download size={14} /> Export
            </ActionBtn>
            <ActionBtn onClick={onImportGoals}>
              <Upload size={14} /> Import / Replace
            </ActionBtn>
          </div>

          <textarea
            className={styles.field}
            rows={8}
            placeholder="Paste exported JSON here to import..."
            value={ioText}
            onChange={(e) => setIoText(e.target.value)}
          />
        </div>

        <div className={styles.panel}>
          <PaneHeader
            title="Board tools"
            subcopy="Fast utility actions for the selected goal."
          />

          {selectedGoal ? (
            <div className={styles.actionGrid}>
              <ActionBtn onClick={() => onDuplicateGoal(selectedGoal)} full>
                <Copy size={14} /> Duplicate
              </ActionBtn>
              <ActionBtn onClick={() => onToggleArchiveGoal(selectedGoal)} full>
                <Archive size={14} /> {selectedGoal.archived ? "Unarchive" : "Archive"}
              </ActionBtn>
              <ActionBtn variant="danger" onClick={() => onDeleteGoal(selectedGoal.id)} full>
                <Trash2 size={14} /> Delete
              </ActionBtn>
              <ActionBtn onClick={() => onSetBoardTab("focus")} full>
                <ArrowUpRight size={14} /> Back to focus
              </ActionBtn>
            </div>
          ) : (
            <EmptyState
              title="No goal selected"
              copy="Pick a goal to use board tools."
              minHeight={140}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ZeroStateCommand({
  adding,
  setAdding,
  onAddGoal,
  addingBusy,
}) {
  const resolvedName = resolvedGoalName(adding.preset, adding.customName) || "New goal";
  const target = Number.isFinite(parseMoneyInput(adding.target))
    ? parseMoneyInput(adding.target)
    : 0;
  const current = Number.isFinite(parseMoneyInput(adding.current))
    ? parseMoneyInput(adding.current)
    : 0;
  const left = Math.max(0, target - current);

  return (
    <GlassPane className={styles.focusPane}>
      <div className={styles.focusStack}>
        <div className={styles.focusHeader}>
          <div>
            <div className={styles.eyebrow}>Savings starter</div>
            <div className={styles.focusTitle}>Start your first goal</div>
            <div className={styles.focusMeta}>
              The page is structured right now. It just needs real goals to come alive.
            </div>
          </div>

          <div className={styles.focusHeaderRight}>
            <div className={styles.focusBadges}>
              <MiniPill tone="green">quick start</MiniPill>
              <MiniPill tone="amber">zero state</MiniPill>
            </div>
          </div>
        </div>

        <div className={styles.metricGrid}>
          <StatCard
            label="Resolved Goal"
            value={resolvedName}
            sub="The active starter target"
            tone="green"
          />
          <StatCard
            label="Target"
            value={fmtMoney(target)}
            sub="What you want this goal to reach"
            tone="amber"
          />
          <StatCard
            label="Starting Saved"
            value={fmtMoney(current)}
            sub="What is already sitting there"
            tone="green"
          />
          <StatCard
            label="Still Needed"
            value={fmtMoney(left)}
            sub="Gap after starting balance"
            tone={left > 0 ? "amber" : "green"}
          />
        </div>

        <div className={styles.splitLayoutFill}>
          <AddGoalPanel
            adding={adding}
            setAdding={setAdding}
            onAdd={onAddGoal}
            saving={addingBusy}
          />

          <div className={styles.asideStackFill}>
            <div className={styles.panel}>
              <PaneHeader
                title="Best first goals"
                subcopy="Start with something real so saving feels useful immediately."
              />

              <div className={styles.infoList}>
                <InfoRow
                  label="Emergency fund"
                  value="Best first move"
                  tone="green"
                />
                <InfoRow
                  label="Car / repair fund"
                  value="Protects against random hits"
                  tone="amber"
                />
                <InfoRow
                  label="Vacation"
                  value="Fun target that keeps momentum"
                  tone="blue"
                />
                <InfoRow
                  label="House projects"
                  value="Good when you know the next expense"
                  tone="neutral"
                />
              </div>

              <div className={styles.quickChipRow} style={{ marginTop: 12 }}>
                {GOAL_PRESETS.slice(0, 4).map((item) => (
                  <ActionBtn
                    key={item}
                    variant={adding.preset === item ? "primary" : "ghost"}
                    onClick={() => setAdding((p) => ({ ...p, preset: item }))}
                  >
                    {item === "Truck / Car Fund" ? "Truck / Car" : item}
                  </ActionBtn>
                ))}
              </div>
            </div>

            <div className={styles.panel}>
              <PaneHeader
                title="What happens next"
                subcopy="Once you add one goal, the page becomes way more useful."
              />

              <div className={styles.infoList}>
                <InfoRow label="Dashboard" value="Focus goal + mix + signals" tone="blue" />
                <InfoRow label="Focus" value="Quick adds and finish-line math" tone="green" />
                <InfoRow label="Contributions" value="History and board feed" tone="amber" />
                <InfoRow label="Planner" value="Monthly pace and finish estimate" tone="blue" />
                <InfoRow label="Tools" value="Import / export and board actions" tone="neutral" />
              </div>

              <div className={styles.moodCard}>
                <div className={styles.moodTop}>
                  <Sparkles size={15} />
                  <span>Make saving visible</span>
                </div>
                <div className={styles.moodCopy}>
                  This page should feel like progress, not a dead spreadsheet. Add one real
                  goal and it starts acting like the rest of the app.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </GlassPane>
  );
}

export function CommandBoard({
  boardTab,
  setBoardTab,
  selectedGoal,
  selectedPriority,
  selectedSaving,
  selectedContributions,
  contributionFeed,
  plannerPushValue,
  setPlannerPushValue,
  plannerSimulation,
  activeGoals,
  customAmount,
  customNote,
  setCustomAmount,
  setCustomNote,
  adding,
  setAdding,
  addingBusy,
  ioText,
  setIoText,
  onAddGoal,
  onPatchGoal,
  onDuplicateGoal,
  onToggleArchiveGoal,
  onDeleteGoal,
  onQuickAdd,
  onUndoLast,
  onCustomAdd,
  onExportGoals,
  onImportGoals,
}) {
  if (!selectedGoal) {
    return (
      <ZeroStateCommand
        adding={adding}
        setAdding={setAdding}
        onAddGoal={onAddGoal}
        addingBusy={addingBusy}
      />
    );
  }

  const selectedNeed = paceNeed(selectedGoal);
  const selectedProjection = recentProjection(selectedGoal);
  const selectedMood = fundingMood(selectedGoal);

  return (
    <GlassPane className={styles.focusPane}>
      <div className={styles.focusStack}>
        <div className={styles.focusHeader}>
          <div>
            <div className={styles.eyebrow}>Savings command</div>
            <div className={styles.focusTitle}>{selectedGoal.name}</div>
            <div className={styles.focusMeta}>
              {selectedGoal.priority} • {selectedGoal.dueDate ? fmtDate(selectedGoal.dueDate) : "No due date"} • Updated{" "}
              {formatAgo(selectedGoal.updatedAt)}
            </div>
          </div>

          <div className={styles.focusHeaderRight}>
            <div className={styles.focusBadges}>
              <MiniPill tone={priorityTone(selectedGoal.priority)}>{selectedGoal.priority}</MiniPill>
              <MiniPill tone={dueTone(selectedGoal)}>{dueLabel(selectedGoal)}</MiniPill>
              <MiniPill tone={progressTone(selectedGoal)}>{pct(progressPercent(selectedGoal))}</MiniPill>
            </div>

            <div className={styles.focusActionRow}>
              <ActionBtn onClick={() => setBoardTab("tools")}>
                <Plus size={14} /> New goal
              </ActionBtn>
              <ActionBtn onClick={() => setBoardTab("focus")}>
                Edit
              </ActionBtn>
            </div>
          </div>
        </div>

        <div className={styles.metricGrid}>
          <StatCard
            label="Saved"
            value={fmtMoney(selectedGoal.current)}
            sub="Current balance on this goal"
            tone="green"
          />
          <StatCard
            label="Left"
            value={fmtMoney(amountLeft(selectedGoal))}
            sub="Still needed to finish"
            tone={amountLeft(selectedGoal) > 0 ? "amber" : "green"}
          />
          <StatCard
            label="Per Month"
            value={selectedNeed.perMonth !== null ? fmtMoney(selectedNeed.perMonth) : "—"}
            sub="Needed pace to hit due date"
            tone="amber"
          />
          <StatCard
            label="Projection"
            value={selectedProjection.text}
            sub={selectedMood.copy}
            tone={selectedProjection.tone}
          />
        </div>

        <div className={styles.tabsRow}>
          {BOARD_TABS.map((tab) => (
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
            <div className={styles.splitLayoutFill}>
              <FocusGoalPanel
                goal={selectedGoal}
                priority={selectedPriority}
                saving={selectedSaving}
                onDuplicate={() => onDuplicateGoal(selectedGoal)}
                onArchive={() => onToggleArchiveGoal(selectedGoal)}
                onDelete={() => onDeleteGoal(selectedGoal.id)}
                onQuickAdd={onQuickAdd}
                onUndoLast={onUndoLast}
                customAmount={customAmount}
                customNote={customNote}
                setCustomAmount={setCustomAmount}
                setCustomNote={setCustomNote}
                onCustomAdd={onCustomAdd}
              />

              <div className={styles.asideStackFill}>
                <div className={styles.panel}>
                  <PaneHeader
                    title="Signals"
                    subcopy="What matters right now on the selected goal."
                    right={<MiniPill tone={selectedMood.tone}>{selectedMood.title}</MiniPill>}
                  />
                  <div className={styles.infoList}>
                    <InfoRow label="Priority" value={selectedGoal.priority} tone={priorityTone(selectedGoal.priority)} />
                    <InfoRow label="Due" value={selectedGoal.dueDate ? fmtDate(selectedGoal.dueDate) : "None"} tone={dueTone(selectedGoal)} />
                    <InfoRow label="Projection" value={selectedProjection.text} tone={selectedProjection.tone} />
                    <InfoRow
                      label="Per month"
                      value={selectedNeed.perMonth !== null ? fmtMoney(selectedNeed.perMonth) : "—"}
                      tone="amber"
                    />
                    <InfoRow label="Last update" value={formatAgo(selectedGoal.updatedAt)} />
                  </div>
                </div>

                <div className={styles.panel}>
                  <PaneHeader
                    title="Goal mix"
                    subcopy="Where the current saved money is sitting."
                    right={<MiniPill tone="blue">{activeGoals.length} lanes</MiniPill>}
                  />
                  <GoalMix goals={activeGoals} />
                </div>
              </div>
            </div>
          ) : null}

          {boardTab === "focus" ? (
            <div className={styles.splitLayoutFill}>
              <FocusGoalPanel
                goal={selectedGoal}
                priority={selectedPriority}
                saving={selectedSaving}
                onDuplicate={() => onDuplicateGoal(selectedGoal)}
                onArchive={() => onToggleArchiveGoal(selectedGoal)}
                onDelete={() => onDeleteGoal(selectedGoal.id)}
                onQuickAdd={onQuickAdd}
                onUndoLast={onUndoLast}
                customAmount={customAmount}
                customNote={customNote}
                setCustomAmount={setCustomAmount}
                setCustomNote={setCustomNote}
                onCustomAdd={onCustomAdd}
              />

              <div className={styles.asideStackFill}>
                <GoalEditorPanel
                  goal={selectedGoal}
                  saving={selectedSaving}
                  onPatch={onPatchGoal}
                />

                <div className={styles.panel}>
                  <PaneHeader
                    title="Finish line"
                    subcopy="What it takes to close this goal."
                    right={<MiniPill tone={progressTone(selectedGoal)}>{pct(progressPercent(selectedGoal))}</MiniPill>}
                  />
                  <div className={styles.infoList}>
                    <InfoRow label="Target" value={fmtMoney(selectedGoal.target)} />
                    <InfoRow label="Saved" value={fmtMoney(selectedGoal.current)} tone="green" />
                    <InfoRow label="Left" value={fmtMoney(amountLeft(selectedGoal))} tone="amber" />
                    <InfoRow
                      label="Per week"
                      value={selectedNeed.perWeek !== null ? fmtMoney(selectedNeed.perWeek) : "—"}
                      tone="amber"
                    />
                    <InfoRow
                      label="Per day"
                      value={selectedNeed.perDay !== null ? fmtMoney(selectedNeed.perDay) : "—"}
                      tone="amber"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {boardTab === "contributions" ? (
            <ContributionsPanel
              selectedGoal={selectedGoal}
              selectedContributions={selectedContributions}
              contributionFeed={contributionFeed}
              customAmount={customAmount}
              customNote={customNote}
              setCustomAmount={setCustomAmount}
              setCustomNote={setCustomNote}
              onCustomAdd={onCustomAdd}
              onQuickAdd={onQuickAdd}
            />
          ) : null}

          {boardTab === "planner" ? (
            <PlannerPanel
              selectedGoal={selectedGoal}
              plannerPushValue={plannerPushValue}
              setPlannerPushValue={setPlannerPushValue}
              plannerSimulation={plannerSimulation}
            />
          ) : null}

          {boardTab === "tools" ? (
            <ToolsPanel
              adding={adding}
              setAdding={setAdding}
              onAddGoal={onAddGoal}
              addingBusy={addingBusy}
              selectedGoal={selectedGoal}
              selectedSaving={selectedSaving}
              onPatchGoal={onPatchGoal}
              onDuplicateGoal={onDuplicateGoal}
              onToggleArchiveGoal={onToggleArchiveGoal}
              onDeleteGoal={onDeleteGoal}
              onSetBoardTab={setBoardTab}
              ioText={ioText}
              setIoText={setIoText}
              onExportGoals={onExportGoals}
              onImportGoals={onImportGoals}
            />
          ) : null}
        </div>
      </div>
    </GlassPane>
  );
}
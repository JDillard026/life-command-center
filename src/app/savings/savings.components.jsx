"use client";

import { useEffect, useRef, useState } from "react";
import {
  Archive,
  ChevronDown,
  Copy,
  Download,
  Ellipsis,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Undo2,
  Upload,
  WandSparkles,
} from "lucide-react";
import GlassPane from "../components/GlassPane";
import styles from "./SavingsPage.module.css";
import {
  GOAL_PRESETS,
  PRIORITY_OPTIONS,
  QUICK_AMOUNTS,
  WORKSPACE_TABS,
  amountLeft,
  dueLabel,
  dueTone,
  fmtDate,
  fmtMoney,
  fmtMoneyTight,
  formatAgo,
  fundingMood,
  goalInitials,
  last30ContributionTotal,
  nextMilestonePct,
  paceNeed,
  pct,
  priorityTone,
  progressPercent,
  progressTone,
  recentProjection,
  resolvedGoalName,
  thisMonthContributionTotal,
  toneMeta,
} from "./savings.helpers";

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function titleize(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function Button({
  children,
  variant = "ghost",
  full = false,
  icon: Icon,
  className = "",
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      className={cx(
        styles.button,
        variant === "primary" && styles.buttonPrimary,
        variant === "danger" && styles.buttonDanger,
        variant === "ghost" && styles.buttonGhost,
        full && styles.buttonFull,
        className
      )}
      {...props}
    >
      {Icon ? <Icon size={15} /> : null}
      {children}
    </button>
  );
}

function MiniPill({ children, tone = "neutral" }) {
  const meta = toneMeta(tone);

  return (
    <div
      className={styles.tonePill}
      style={{
        borderColor: meta.border,
        color: tone === "neutral" ? "rgba(255,255,255,0.94)" : meta.text,
        boxShadow: `0 0 18px ${meta.glow}`,
      }}
    >
      {children}
    </div>
  );
}

function PaneHeader({ title, subcopy, right }) {
  return (
    <div className={styles.paneHeader}>
      <div>
        <div className={styles.paneTitle}>{title}</div>
        {subcopy ? <div className={styles.paneSub}>{subcopy}</div> : null}
      </div>
      {right ? <div className={styles.paneRight}>{right}</div> : null}
    </div>
  );
}

function MetricCard({ label, value, subcopy, tone = "neutral" }) {
  return (
    <div className={styles.metricCard}>
      <div className={styles.metricLabel}>{label}</div>
      <div
        className={cx(
          styles.metricValue,
          tone === "green" && styles.valuePositive,
          tone === "amber" && styles.valueWarning,
          tone === "red" && styles.valueNegative
        )}
      >
        {value}
      </div>
      <div className={styles.metricSub}>{subcopy}</div>
    </div>
  );
}

function ProgressTrack({ fill = 0, tone = "neutral" }) {
  const safeFill = Math.max(0, Math.min(100, Number(fill) || 0));

  const background =
    tone === "green"
      ? "linear-gradient(90deg, rgba(90, 228, 151, 0.98), rgba(146, 247, 194, 0.92))"
      : tone === "amber"
      ? "linear-gradient(90deg, rgba(247, 186, 74, 0.98), rgba(255, 221, 146, 0.92))"
      : tone === "red"
      ? "linear-gradient(90deg, rgba(255, 116, 145, 0.98), rgba(255, 175, 197, 0.92))"
      : "linear-gradient(90deg, rgba(125, 170, 255, 0.98), rgba(177, 205, 255, 0.92))";

  return (
    <div className={styles.progress}>
      <div
        className={styles.progressFill}
        style={{
          width: `${safeFill}%`,
          background,
        }}
      />
    </div>
  );
}

function EmptyState({ title, copy, action }) {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyTitle}>{title}</div>
      <div className={styles.emptyText}>{copy}</div>
      {action ? <div style={{ marginTop: 12 }}>{action}</div> : null}
    </div>
  );
}

function SignalRow({ label, value, tone = "neutral" }) {
  return (
    <div className={styles.signalRow}>
      <span className={styles.signalLabel}>{label}</span>
      <span
        className={cx(
          styles.signalValue,
          tone === "green" && styles.valuePositive,
          tone === "amber" && styles.valueWarning,
          tone === "red" && styles.valueNegative
        )}
      >
        {value}
      </span>
    </div>
  );
}

function OverflowMenu({ items = [] }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(event.target)) setOpen(false);
    }

    function handleEscape(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div className={styles.menuWrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.menuButton}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        aria-label="More actions"
      >
        <Ellipsis size={16} />
      </button>

      {open ? (
        <div className={styles.menuPopover}>
          {items.map((item, index) => {
            const Icon = item.icon;

            return (
              <button
                key={`${item.label}-${index}`}
                type="button"
                className={cx(
                  styles.menuItem,
                  item.tone === "danger" && styles.menuItemDanger
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  item.onClick?.();
                }}
              >
                {Icon ? <Icon size={14} /> : null}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function GoalRow({
  goal,
  selected,
  priority,
  onSelect,
  onDuplicateGoal,
  onToggleArchiveGoal,
  onDeleteGoal,
}) {
  const progressToneValue = progressTone(goal);
  const dueToneValue = dueTone(goal);
  const projection = recentProjection(goal);

  return (
    <div
      className={cx(styles.goalRow, selected && styles.goalRowSelected)}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect();
      }}
    >
      <div className={styles.goalAccent} />
      <div className={styles.goalAvatar}>{goalInitials(goal.name)}</div>

      <div className={styles.goalRowMain}>
        <div className={styles.goalRowTop}>
          <div className={styles.goalRowName}>{goal.name || "Untitled goal"}</div>
          <div className={styles.goalRowAmount}>{fmtMoney(goal.target)}</div>
        </div>

        <div className={styles.goalMeta}>
          {fmtMoney(goal.current)} saved • {fmtMoney(amountLeft(goal))} left •{" "}
          {projection.text}
        </div>

        <div className={styles.tagRow}>
          {priority ? <MiniPill tone="amber">Rank #{priority}</MiniPill> : null}
          <MiniPill tone={priorityTone(goal.priority)}>{goal.priority}</MiniPill>
          <MiniPill tone={dueToneValue}>{dueLabel(goal)}</MiniPill>
          <MiniPill tone={progressToneValue}>{pct(progressPercent(goal))}</MiniPill>
          {goal.archived ? <MiniPill tone="neutral">Archived</MiniPill> : null}
        </div>

        <div className={styles.goalProgress}>
          <ProgressTrack
            fill={progressPercent(goal)}
            tone={progressToneValue}
          />
        </div>
      </div>

      <OverflowMenu
        items={[
          {
            label: "Duplicate",
            icon: Copy,
            onClick: () => onDuplicateGoal(goal),
          },
          {
            label: goal.archived ? "Unarchive" : "Archive",
            icon: Archive,
            onClick: () => onToggleArchiveGoal(goal),
          },
          {
            label: "Delete",
            icon: Trash2,
            tone: "danger",
            onClick: () => onDeleteGoal(goal.id),
          },
        ]}
      />
    </div>
  );
}

function ActivityList({ items = [], showGoalName = false, emptyTitle, emptyCopy }) {
  if (!items.length) {
    return <EmptyState title={emptyTitle} copy={emptyCopy} />;
  }

  return (
    <div className={styles.historyList}>
      {items.map((item) => (
        <div key={item.id} className={styles.historyItem}>
          <div className={styles.historyTop}>
            <div>
              <div className={styles.historyTitle}>
                {showGoalName ? item.goalName : fmtMoneyTight(item.amount)}
              </div>
              <div className={styles.historySub}>
                {showGoalName ? fmtMoneyTight(item.amount) : fmtDate(item.date)}
                {item.note ? ` • ${item.note}` : ""}
              </div>
            </div>

            <div className={styles.historyAmount}>
              {showGoalName ? fmtDate(item.date) : "Added"}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function SavingsTopBar({
  totals,
  selectedGoal,
  monthLabel,
  createOpen,
  utilityOpen,
  onToggleCreate,
  onToggleUtilities,
}) {
  return (
    <GlassPane className={styles.topBar}>
      <div className={styles.topBarInner}>
        <div className={styles.titleBlock}>
          <div className={styles.eyebrow}>Money / Savings Command</div>

          <div className={styles.pageTitleRow}>
            <div className={styles.pageTitle}>Savings</div>
            <MiniPill tone="green">Live board</MiniPill>
            {selectedGoal ? (
              <MiniPill tone={progressTone(selectedGoal)}>
                {selectedGoal.name}
              </MiniPill>
            ) : null}
          </div>

          <div className={styles.pageCopy}>
            Push real goals forward, track pace, and make saving feel visible.
          </div>
        </div>

        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>Saved</div>
            <div className={styles.summaryValue}>{fmtMoney(totals.totalCurrent)}</div>
            <div className={styles.summaryHint}>{monthLabel}</div>
          </div>

          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>Open gap</div>
            <div className={styles.summaryValue}>{fmtMoney(totals.totalLeft)}</div>
            <div className={styles.summaryHint}>{totals.activeCount} active goals</div>
          </div>

          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>This month</div>
            <div className={styles.summaryValue}>{fmtMoney(totals.thisMonthAdded)}</div>
            <div className={styles.summaryHint}>added to goals</div>
          </div>

          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>Watchlist</div>
            <div className={styles.summaryValue}>
              {totals.dueSoonCount + totals.overdueCount}
            </div>
            <div className={styles.summaryHint}>
              {totals.overdueCount > 0
                ? `${totals.overdueCount} overdue`
                : `${totals.dueSoonCount} due soon`}
            </div>
          </div>
        </div>

        <div className={styles.summaryActions}>
          <Button
            variant={createOpen ? "primary" : "ghost"}
            icon={Plus}
            onClick={onToggleCreate}
          >
            New goal
          </Button>

          <Button
            variant={utilityOpen ? "primary" : "ghost"}
            icon={WandSparkles}
            onClick={onToggleUtilities}
          >
            Utilities
          </Button>
        </div>
      </div>
    </GlassPane>
  );
}

export function GoalNavigator({
  goals = [],
  selectedGoalId,
  onSelectGoal,
  search,
  setSearch,
  filter,
  setFilter,
  sort,
  setSort,
  priorityMap,
  onDuplicateGoal,
  onToggleArchiveGoal,
  onDeleteGoal,
}) {
  const list = Array.isArray(goals) ? goals : [];

  return (
    <GlassPane className={styles.navigatorPane}>
      <PaneHeader
        title="Goal navigator"
        subcopy="Choose the goal you want to command."
        right={<MiniPill tone="neutral">{list.length} showing</MiniPill>}
      />

      <label className={styles.searchWrap}>
        <Search size={15} />
        <input
          className={styles.searchInput}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search goals..."
        />
      </label>

      <div className={styles.filterRow}>
        <button
          type="button"
          className={cx(styles.filterChip, filter === "active" && styles.filterChipActive)}
          onClick={() => setFilter("active")}
        >
          Active
        </button>

        <button
          type="button"
          className={cx(styles.filterChip, filter === "all" && styles.filterChipActive)}
          onClick={() => setFilter("all")}
        >
          All
        </button>

        <button
          type="button"
          className={cx(
            styles.filterChip,
            filter === "archived" && styles.filterChipActive
          )}
          onClick={() => setFilter("archived")}
        >
          Archived
        </button>

        <button
          type="button"
          className={cx(styles.filterChip, filter === "due" && styles.filterChipActive)}
          onClick={() => setFilter("due")}
        >
          Due soon
        </button>
      </div>

      <select
        className={styles.field}
        value={sort}
        onChange={(e) => setSort(e.target.value)}
      >
        <option value="priority">Priority</option>
        <option value="due">Due first</option>
        <option value="gap">Biggest gap</option>
        <option value="progress">Least funded</option>
        <option value="updated">Recently updated</option>
        <option value="name">Name</option>
      </select>

      {list.length ? (
        <div className={styles.goalList}>
          {list.map((goal) => (
            <GoalRow
              key={goal.id}
              goal={goal}
              selected={goal.id === selectedGoalId}
              priority={priorityMap.get(goal.id) ?? null}
              onSelect={() => onSelectGoal(goal.id)}
              onDuplicateGoal={onDuplicateGoal}
              onToggleArchiveGoal={onToggleArchiveGoal}
              onDeleteGoal={onDeleteGoal}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No goals found"
          copy="Clear the filters or create a new goal."
        />
      )}
    </GlassPane>
  );
}

export function GoalWorkspace({
  selectedGoal,
  selectedPriority,
  selectedSaving,
  workspaceTab,
  setWorkspaceTab,
  selectedContributions,
  boardFeed,
  plannerPushValue,
  setPlannerPushValue,
  plannerSimulation,
  customAmount,
  customNote,
  setCustomAmount,
  setCustomNote,
  onCustomAdd,
  onQuickAdd,
  onUndoLast,
  onOpenCreate,
}) {
  if (!selectedGoal) {
    return (
      <GlassPane className={styles.commandPane}>
        <div className={styles.commandShell}>
          <EmptyState
            title="No savings goal selected"
            copy="Create your first goal and this page will turn into a live funding board."
            action={
              <Button variant="primary" icon={Plus} onClick={onOpenCreate}>
                Create first goal
              </Button>
            }
          />
        </div>
      </GlassPane>
    );
  }

  const need = paceNeed(selectedGoal);
  const projection = recentProjection(selectedGoal);
  const mood = fundingMood(selectedGoal);
  const progressToneValue = progressTone(selectedGoal);
  const nextMilestone = nextMilestonePct(selectedGoal);
  const thisMonth = thisMonthContributionTotal(selectedGoal);
  const last30 = last30ContributionTotal(selectedGoal);

  return (
    <GlassPane className={styles.commandPane}>
      <div className={styles.commandShell}>
        <div className={styles.commandHeader}>
          <div className={styles.commandNameBlock}>
            <div className={styles.eyebrow}>Active goal</div>
            <div className={styles.commandName}>{selectedGoal.name}</div>
            <div className={styles.commandMeta}>
              {selectedGoal.priority} •{" "}
              {selectedGoal.dueDate ? fmtDate(selectedGoal.dueDate) : "No due date"} •
              Updated {formatAgo(selectedGoal.updatedAt)}
            </div>
          </div>

          <div className={styles.commandActions}>
            {selectedPriority ? (
              <MiniPill tone="amber">Rank #{selectedPriority}</MiniPill>
            ) : null}
            <MiniPill tone={priorityTone(selectedGoal.priority)}>
              {selectedGoal.priority}
            </MiniPill>
            <MiniPill tone={dueTone(selectedGoal)}>{dueLabel(selectedGoal)}</MiniPill>
            <MiniPill tone={progressToneValue}>
              {pct(progressPercent(selectedGoal))}
            </MiniPill>
            {selectedSaving ? <MiniPill tone="amber">Saving...</MiniPill> : null}
          </div>
        </div>

        <div className={styles.tabRow}>
          {WORKSPACE_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={cx(styles.tab, workspaceTab === tab && styles.tabActive)}
              onClick={() => setWorkspaceTab(tab)}
            >
              {titleize(tab)}
            </button>
          ))}
        </div>

        <div className={styles.heroGrid}>
          <MetricCard
            label="Saved"
            value={fmtMoney(selectedGoal.current)}
            subcopy="Current balance on this goal"
            tone="green"
          />
          <MetricCard
            label="Still needed"
            value={fmtMoney(amountLeft(selectedGoal))}
            subcopy="Gap left to fully fund"
            tone={amountLeft(selectedGoal) > 0 ? "amber" : "green"}
          />
          <MetricCard
            label="Per month"
            value={need.perMonth !== null ? fmtMoney(need.perMonth) : "—"}
            subcopy="Needed pace to hit the date"
            tone="amber"
          />
          <MetricCard
            label="Projection"
            value={projection.text}
            subcopy={mood.copy}
            tone={projection.tone}
          />
        </div>

        {workspaceTab === "dashboard" ? (
          <div className={styles.stageGrid}>
            <div className={styles.stageMain}>
              <div className={styles.card}>
                <PaneHeader
                  title="Contribution command"
                  subcopy="Fast funding controls for the goal you are actively touching."
                  right={<MiniPill tone={mood.tone}>{mood.title}</MiniPill>}
                />

                <div className={styles.moodCard}>
                  <div className={styles.moodTop}>
                    <Sparkles size={15} />
                    <span>{mood.title}</span>
                  </div>
                  <div className={styles.moodCopy}>{mood.copy}</div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <ProgressTrack
                    fill={progressPercent(selectedGoal)}
                    tone={progressToneValue}
                  />
                </div>

                <div className={styles.quickRow}>
                  {QUICK_AMOUNTS.map((amount) => (
                    <Button key={amount} onClick={() => onQuickAdd(amount)}>
                      +{fmtMoney(amount)}
                    </Button>
                  ))}
                </div>

                <div className={styles.inputRow}>
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
                  <Button variant="primary" onClick={onCustomAdd}>
                    Add
                  </Button>
                </div>

                <div style={{ marginTop: 10 }}>
                  <Button icon={Undo2} onClick={onUndoLast}>
                    Undo last contribution
                  </Button>
                </div>
              </div>

              <div className={styles.card}>
                <PaneHeader
                  title="Recent goal activity"
                  subcopy={`Latest contributions for ${selectedGoal.name}.`}
                />
                <ActivityList
                  items={selectedContributions.slice(0, 8)}
                  emptyTitle="No contributions yet"
                  emptyCopy="Use quick adds or a custom amount to start the history."
                />
              </div>
            </div>

            <div className={styles.stageSide}>
              <div className={styles.card}>
                <PaneHeader
                  title="Live read"
                  subcopy="What matters right now on this goal."
                />
                <div className={styles.signalList}>
                  <SignalRow
                    label="Priority"
                    value={selectedGoal.priority}
                    tone={priorityTone(selectedGoal.priority)}
                  />
                  <SignalRow
                    label="Due"
                    value={selectedGoal.dueDate ? fmtDate(selectedGoal.dueDate) : "None"}
                    tone={dueTone(selectedGoal)}
                  />
                  <SignalRow
                    label="Projection"
                    value={projection.text}
                    tone={projection.tone}
                  />
                  <SignalRow
                    label="Needed / week"
                    value={need.perWeek !== null ? fmtMoney(need.perWeek) : "—"}
                    tone="amber"
                  />
                  <SignalRow
                    label="Next milestone"
                    value={nextMilestone ? `${nextMilestone}%` : "Complete"}
                    tone={nextMilestone ? "blue" : "green"}
                  />
                </div>
              </div>

              <div className={styles.card}>
                <PaneHeader
                  title="Momentum"
                  subcopy="Short-term pace on the selected goal."
                />
                <div className={styles.signalList}>
                  <SignalRow
                    label="This month"
                    value={fmtMoney(thisMonth)}
                    tone="green"
                  />
                  <SignalRow
                    label="Last 30 days"
                    value={fmtMoney(last30)}
                    tone="green"
                  />
                  <SignalRow
                    label="Saved"
                    value={fmtMoney(selectedGoal.current)}
                    tone="green"
                  />
                  <SignalRow
                    label="Open gap"
                    value={fmtMoney(amountLeft(selectedGoal))}
                    tone="amber"
                  />
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {workspaceTab === "history" ? (
          <div className={styles.stageGrid}>
            <div className={styles.stageMain}>
              <div className={styles.card}>
                <PaneHeader
                  title="Contribution history"
                  subcopy={`Full history for ${selectedGoal.name}.`}
                  right={
                    <MiniPill tone="green">
                      {selectedContributions.length} rows
                    </MiniPill>
                  }
                />
                <ActivityList
                  items={selectedContributions}
                  emptyTitle="No contribution history"
                  emptyCopy="Once you start adding money, history will show up here."
                />
              </div>
            </div>

            <div className={styles.stageSide}>
              <div className={styles.card}>
                <PaneHeader
                  title="Board feed"
                  subcopy="Latest adds across all active goals."
                />
                <ActivityList
                  items={boardFeed}
                  showGoalName
                  emptyTitle="No board activity"
                  emptyCopy="As contributions are logged, the feed will populate here."
                />
              </div>
            </div>
          </div>
        ) : null}

        {workspaceTab === "planner" ? (
          <div className={styles.stageGrid}>
            <div className={styles.stageMain}>
              <div className={styles.card}>
                <PaneHeader
                  title="Finish planner"
                  subcopy="Run a monthly funding scenario and see how fast this closes."
                  right={<MiniPill tone={projection.tone}>{projection.text}</MiniPill>}
                />

                <div className={styles.inputRow}>
                  <input
                    className={styles.field}
                    inputMode="decimal"
                    placeholder="Monthly add"
                    value={plannerPushValue}
                    onChange={(e) => setPlannerPushValue(e.target.value)}
                  />
                  <Button
                    onClick={() =>
                      setPlannerPushValue(
                        need.perMonth !== null ? String(Math.round(need.perMonth)) : ""
                      )
                    }
                  >
                    Use needed pace
                  </Button>
                </div>

                <div className={styles.heroGrid} style={{ marginTop: 12 }}>
                  <MetricCard
                    label="Needed / month"
                    value={need.perMonth !== null ? fmtMoney(need.perMonth) : "—"}
                    subcopy="To finish by the due date"
                    tone="amber"
                  />
                  <MetricCard
                    label="Needed / week"
                    value={need.perWeek !== null ? fmtMoney(need.perWeek) : "—"}
                    subcopy="Short-term pace read"
                    tone="amber"
                  />
                  <MetricCard
                    label="Scenario finish"
                    value={plannerSimulation?.finishLabel || "—"}
                    subcopy={
                      plannerSimulation?.months !== null &&
                      plannerSimulation?.months !== undefined
                        ? `${plannerSimulation.months} month${
                            plannerSimulation.months === 1 ? "" : "s"
                          } at that push`
                        : "Enter a monthly amount to simulate the finish."
                    }
                    tone={plannerSimulation?.tone || "neutral"}
                  />
                  <MetricCard
                    label="Gap left"
                    value={fmtMoney(amountLeft(selectedGoal))}
                    subcopy="Still open on this goal"
                    tone="amber"
                  />
                </div>
              </div>
            </div>

            <div className={styles.stageSide}>
              <div className={styles.card}>
                <PaneHeader
                  title="Pressure read"
                  subcopy="Blunt snapshot of the pace you need."
                />
                <div className={styles.signalList}>
                  <SignalRow
                    label="Mood"
                    value={mood.title}
                    tone={mood.tone}
                  />
                  <SignalRow
                    label="Due status"
                    value={dueLabel(selectedGoal)}
                    tone={dueTone(selectedGoal)}
                  />
                  <SignalRow
                    label="Progress"
                    value={pct(progressPercent(selectedGoal))}
                    tone={progressToneValue}
                  />
                  <SignalRow
                    label="Still needed"
                    value={fmtMoney(amountLeft(selectedGoal))}
                    tone="amber"
                  />
                </div>
              </div>

              <div className={styles.card}>
                <PaneHeader
                  title="Recommendation"
                  subcopy="What the board is basically telling you."
                />
                <div className={styles.moodCard}>
                  <div className={styles.moodTop}>
                    <Sparkles size={15} />
                    <span>{mood.title}</span>
                  </div>
                  <div className={styles.moodCopy}>{mood.copy}</div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </GlassPane>
  );
}

export function SavingsRightRail({
  createOpen,
  onToggleCreate,
  goalDraft,
  setGoalDraft,
  onAddGoal,
  addingBusy,
  selectedGoal,
  selectedSaving,
  onPatchGoal,
  onDuplicateGoal,
  onToggleArchiveGoal,
  onDeleteGoal,
  utilityOpen,
  onToggleUtilities,
  ioText,
  setIoText,
  onExportGoals,
  onImportGoals,
}) {
  const selectedNeed = selectedGoal ? paceNeed(selectedGoal) : null;

  return (
    <GlassPane className={styles.rightRailPane}>
      <div className={styles.rightRailStack}>
        <div className={styles.card}>
          <PaneHeader
            title="New goal"
            subcopy="Fast enough that you will actually use it."
            right={
              <button
                type="button"
                className={styles.menuButton}
                onClick={onToggleCreate}
                aria-label="Toggle new goal panel"
              >
                <ChevronDown size={16} />
              </button>
            }
          />

          {createOpen ? (
            <div className={styles.formStack}>
              <div className={styles.fieldWrap}>
                <span className={styles.fieldLabel}>Preset</span>
                <select
                  className={styles.field}
                  value={goalDraft.preset}
                  onChange={(e) =>
                    setGoalDraft((prev) => ({
                      ...prev,
                      preset: e.target.value,
                    }))
                  }
                >
                  {GOAL_PRESETS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              {goalDraft.preset === "Other" ? (
                <div className={styles.fieldWrap}>
                  <span className={styles.fieldLabel}>Custom name</span>
                  <input
                    className={styles.field}
                    value={goalDraft.customName}
                    onChange={(e) =>
                      setGoalDraft((prev) => ({
                        ...prev,
                        customName: e.target.value,
                      }))
                    }
                    placeholder="Goal name..."
                  />
                </div>
              ) : null}

              <div className={styles.fieldWrap}>
                <span className={styles.fieldLabel}>Resolved name</span>
                <input
                  className={styles.field}
                  value={resolvedGoalName(goalDraft.preset, goalDraft.customName)}
                  readOnly
                />
              </div>

              <div className={styles.fieldGrid2}>
                <div className={styles.fieldWrap}>
                  <span className={styles.fieldLabel}>Target</span>
                  <input
                    className={styles.field}
                    inputMode="decimal"
                    value={goalDraft.target}
                    onChange={(e) =>
                      setGoalDraft((prev) => ({
                        ...prev,
                        target: e.target.value,
                      }))
                    }
                    placeholder="0.00"
                  />
                </div>

                <div className={styles.fieldWrap}>
                  <span className={styles.fieldLabel}>Starting saved</span>
                  <input
                    className={styles.field}
                    inputMode="decimal"
                    value={goalDraft.current}
                    onChange={(e) =>
                      setGoalDraft((prev) => ({
                        ...prev,
                        current: e.target.value,
                      }))
                    }
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className={styles.fieldGrid2}>
                <div className={styles.fieldWrap}>
                  <span className={styles.fieldLabel}>Due date</span>
                  <input
                    className={styles.field}
                    type="date"
                    value={goalDraft.dueDate}
                    onChange={(e) =>
                      setGoalDraft((prev) => ({
                        ...prev,
                        dueDate: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className={styles.fieldWrap}>
                  <span className={styles.fieldLabel}>Priority</span>
                  <select
                    className={styles.field}
                    value={goalDraft.priority}
                    onChange={(e) =>
                      setGoalDraft((prev) => ({
                        ...prev,
                        priority: e.target.value,
                      }))
                    }
                  >
                    {PRIORITY_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <Button
                variant="primary"
                icon={Plus}
                onClick={onAddGoal}
                full
                disabled={addingBusy}
              >
                {addingBusy ? "Saving..." : "Add goal"}
              </Button>
            </div>
          ) : null}
        </div>

        <div className={styles.card}>
          <PaneHeader
            title="Goal details"
            subcopy="Autosaves as you type."
            right={
              selectedGoal ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {selectedSaving ? <MiniPill tone="amber">Saving...</MiniPill> : null}
                  <OverflowMenu
                    items={[
                      {
                        label: "Duplicate",
                        icon: Copy,
                        onClick: () => onDuplicateGoal(selectedGoal),
                      },
                      {
                        label: selectedGoal.archived ? "Unarchive" : "Archive",
                        icon: Archive,
                        onClick: () => onToggleArchiveGoal(selectedGoal),
                      },
                      {
                        label: "Delete",
                        icon: Trash2,
                        tone: "danger",
                        onClick: () => onDeleteGoal(selectedGoal.id),
                      },
                    ]}
                  />
                </div>
              ) : null
            }
          />

          {selectedGoal ? (
            <div className={styles.formStack}>
              <div className={styles.fieldWrap}>
                <span className={styles.fieldLabel}>Goal name</span>
                <input
                  className={styles.field}
                  value={selectedGoal.name}
                  onChange={(e) => onPatchGoal({ name: e.target.value })}
                />
              </div>

              <div className={styles.fieldGrid2}>
                <div className={styles.fieldWrap}>
                  <span className={styles.fieldLabel}>Priority</span>
                  <select
                    className={styles.field}
                    value={selectedGoal.priority}
                    onChange={(e) => onPatchGoal({ priority: e.target.value })}
                  >
                    {PRIORITY_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.fieldWrap}>
                  <span className={styles.fieldLabel}>Due date</span>
                  <input
                    className={styles.field}
                    type="date"
                    value={selectedGoal.dueDate || ""}
                    onChange={(e) => onPatchGoal({ dueDate: e.target.value })}
                  />
                </div>
              </div>

              <div className={styles.fieldGrid2}>
                <div className={styles.fieldWrap}>
                  <span className={styles.fieldLabel}>Current saved</span>
                  <input
                    className={styles.field}
                    inputMode="decimal"
                    value={String(selectedGoal.current ?? "")}
                    onChange={(e) =>
                      onPatchGoal({
                        current:
                          e.target.value === "" ? 0 : Number(e.target.value) || 0,
                      })
                    }
                  />
                </div>

                <div className={styles.fieldWrap}>
                  <span className={styles.fieldLabel}>Target</span>
                  <input
                    className={styles.field}
                    inputMode="decimal"
                    value={String(selectedGoal.target ?? "")}
                    onChange={(e) =>
                      onPatchGoal({
                        target:
                          e.target.value === "" ? 0 : Number(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>

              <div className={styles.divider} />

              <div className={styles.signalList}>
                <SignalRow
                  label="Saved / target"
                  value={`${fmtMoney(selectedGoal.current)} / ${fmtMoney(
                    selectedGoal.target
                  )}`}
                  tone="green"
                />
                <SignalRow
                  label="Progress"
                  value={pct(progressPercent(selectedGoal))}
                  tone={progressTone(selectedGoal)}
                />
                <SignalRow
                  label="Still needed"
                  value={fmtMoney(amountLeft(selectedGoal))}
                  tone="amber"
                />
                <SignalRow
                  label="Needed / month"
                  value={
                    selectedNeed?.perMonth !== null
                      ? fmtMoney(selectedNeed.perMonth)
                      : "—"
                  }
                  tone="amber"
                />
              </div>
            </div>
          ) : (
            <EmptyState
              title="No goal selected"
              copy="Pick a goal from the navigator to edit details here."
            />
          )}
        </div>

        <div className={styles.card}>
          <PaneHeader
            title="Utilities"
            subcopy="Import, export, and board-level helpers."
            right={
              <button
                type="button"
                className={styles.menuButton}
                onClick={onToggleUtilities}
                aria-label="Toggle utilities panel"
              >
                <ChevronDown size={16} />
              </button>
            }
          />

          {utilityOpen ? (
            <div className={styles.formStack}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Button icon={Download} onClick={onExportGoals}>
                  Export
                </Button>
                <Button icon={Upload} onClick={onImportGoals}>
                  Import / Replace
                </Button>
              </div>

              <textarea
                className={styles.field}
                rows={8}
                value={ioText}
                onChange={(e) => setIoText(e.target.value)}
                placeholder="Paste exported JSON here to replace the current board..."
              />
            </div>
          ) : null}
        </div>
      </div>
    </GlassPane>
  );
}
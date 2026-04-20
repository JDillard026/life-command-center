"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import GlassPane from "../components/GlassPane";
import styles from "./SavingsPage.module.css";
import { supabase } from "@/lib/supabaseClient";
import {
  DEFAULT_GOAL_DRAFT,
  amountLeft,
  fmtMonthLabel,
  mapGoalRow,
  mapGoalToRow,
  monthKeyFromISO,
  normalizeImportedGoal,
  parseMoneyInput,
  priorityRank,
  progressPercent,
  projectedFinishByMonthly,
  safeNum,
  sortContributionsDesc,
  thisMonthContributionTotal,
  todayISO,
  uid,
} from "./savings.helpers";
import {
  GoalNavigator,
  GoalWorkspace,
  SavingsRightRail,
  SavingsTopBar,
} from "./savings.components";

export default function SavingsCommand() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("active");
  const [sort, setSort] = useState("priority");
  const [selectedGoalId, setSelectedGoalId] = useState("");
  const [workspaceTab, setWorkspaceTab] = useState("dashboard");

  const [createOpen, setCreateOpen] = useState(false);
  const [utilityOpen, setUtilityOpen] = useState(false);
  const [goalDraft, setGoalDraft] = useState({ ...DEFAULT_GOAL_DRAFT });

  const [savingIds, setSavingIds] = useState({});
  const [pageError, setPageError] = useState("");
  const [addingBusy, setAddingBusy] = useState(false);

  const [customContribution, setCustomContribution] = useState({});
  const [customContributionNote, setCustomContributionNote] = useState({});
  const [plannerMonthlyPush, setPlannerMonthlyPush] = useState({});
  const [ioText, setIoText] = useState("");

  const rowSaveTimers = useRef({});

  async function getCurrentUser() {
    if (!supabase) return null;

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      console.error("getUser error:", error);
      return null;
    }

    return user ?? null;
  }

  async function loadSavingsPage() {
    if (!supabase) {
      setPageError("Supabase is not configured.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setPageError("");

    const user = await getCurrentUser();

    if (!user) {
      setUserId(null);
      setGoals([]);
      setSelectedGoalId("");
      setLoading(false);
      return;
    }

    setUserId(user.id);

    const { data, error } = await supabase
      .from("savings_goals")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("load savings error:", error);
      setPageError(error.message || "Failed to load savings goals.");
      setGoals([]);
      setSelectedGoalId("");
      setLoading(false);
      return;
    }

    const mappedGoals = (data || []).map(mapGoalRow);

    setGoals(mappedGoals);
    setSelectedGoalId((prev) => prev || mappedGoals[0]?.id || "");
    setLoading(false);
  }

  useEffect(() => {
    loadSavingsPage();

    if (!supabase) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadSavingsPage();
    });

    return () => {
      subscription?.unsubscribe?.();
      Object.values(rowSaveTimers.current).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    if (!goals.length) {
      setSelectedGoalId("");
      setCreateOpen(true);
      return;
    }

    const exists = goals.some((goal) => goal.id === selectedGoalId);
    if (!exists) setSelectedGoalId(goals[0]?.id || "");
  }, [goals, selectedGoalId]);

  async function persistGoal(nextGoal) {
    if (!supabase || !userId) return;

    setSavingIds((prev) => ({ ...prev, [nextGoal.id]: true }));

    const { error } = await supabase
      .from("savings_goals")
      .upsert(mapGoalToRow(nextGoal, userId), { onConflict: "id" });

    if (error) {
      console.error("save goal error:", error);
      setPageError(error.message || "Failed to save goal.");
    }

    setSavingIds((prev) => ({ ...prev, [nextGoal.id]: false }));
  }

  function scheduleGoalSave(nextGoal) {
    if (rowSaveTimers.current[nextGoal.id]) {
      clearTimeout(rowSaveTimers.current[nextGoal.id]);
    }

    rowSaveTimers.current[nextGoal.id] = setTimeout(() => {
      persistGoal(nextGoal);
    }, 320);
  }

  function updateGoal(id, patch) {
    setGoals((prev) => {
      let changed = null;

      const next = prev.map((goal) => {
        if (goal.id !== id) return goal;

        changed = {
          ...goal,
          ...patch,
          updatedAt: new Date().toISOString(),
        };

        return changed;
      });

      if (changed) scheduleGoalSave(changed);
      return next;
    });
  }

  async function addGoalFromDraft() {
    if (!supabase || !userId || addingBusy) return;

    const name =
      goalDraft.preset === "Other"
        ? String(goalDraft.customName || "").trim()
        : goalDraft.preset;

    const target = safeNum(parseMoneyInput(goalDraft.target), NaN);
    const current = safeNum(parseMoneyInput(goalDraft.current || "0"), 0);

    if (!name) {
      alert("Goal name is required.");
      return;
    }

    if (!Number.isFinite(target) || target <= 0) {
      alert("Target must be greater than 0.");
      return;
    }

    if (!Number.isFinite(current) || current < 0) {
      alert("Starting saved must be 0 or more.");
      return;
    }

    const nextGoal = {
      id: uid(),
      name,
      target,
      current,
      dueDate: goalDraft.dueDate || "",
      priority: goalDraft.priority || "Medium",
      archived: false,
      createdAt: Date.now(),
      updatedAt: new Date().toISOString(),
      contributions:
        current > 0
          ? [
              {
                id: uid(),
                date: todayISO(),
                amount: current,
                note: "Starting balance",
              },
            ]
          : [],
    };

    setAddingBusy(true);
    setGoals((prev) => [nextGoal, ...prev]);
    setSelectedGoalId(nextGoal.id);
    setWorkspaceTab("dashboard");

    const { error } = await supabase
      .from("savings_goals")
      .insert(mapGoalToRow(nextGoal, userId));

    if (error) {
      console.error("add goal error:", error);
      await loadSavingsPage();
      setPageError(error.message || "Failed to add goal.");
    } else {
      setGoalDraft({ ...DEFAULT_GOAL_DRAFT });
      setCreateOpen(false);
    }

    setAddingBusy(false);
  }

  async function removeGoal(id) {
    if (!supabase || !userId) return;
    if (typeof window !== "undefined" && !window.confirm("Delete this goal?")) {
      return;
    }

    if (rowSaveTimers.current[id]) {
      clearTimeout(rowSaveTimers.current[id]);
    }

    const nextGoals = goals.filter((goal) => goal.id !== id);
    setGoals(nextGoals);

    if (selectedGoalId === id) {
      setSelectedGoalId(nextGoals[0]?.id || "");
    }

    const { error } = await supabase
      .from("savings_goals")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      console.error("delete goal error:", error);
      setPageError(error.message || "Failed to delete goal.");
      await loadSavingsPage();
    }
  }

  async function duplicateGoal(goal) {
    if (!supabase || !userId || !goal) return;

    const cloned = {
      ...goal,
      id: uid(),
      name: `${goal.name || "Goal"} Copy`,
      createdAt: Date.now(),
      updatedAt: new Date().toISOString(),
      contributions: Array.isArray(goal.contributions)
        ? goal.contributions.map((entry) => ({
            ...entry,
            id: uid(),
          }))
        : [],
    };

    setGoals((prev) => [cloned, ...prev]);
    setSelectedGoalId(cloned.id);

    const { error } = await supabase
      .from("savings_goals")
      .insert(mapGoalToRow(cloned, userId));

    if (error) {
      console.error("duplicate goal error:", error);
      setPageError(error.message || "Failed to duplicate goal.");
      await loadSavingsPage();
    }
  }

  function toggleArchiveGoal(goal) {
    if (!goal) return;
    updateGoal(goal.id, { archived: !goal.archived });
  }

  function applyContribution(goalId, amount, note = "") {
    const parsed = safeNum(amount, NaN);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      alert("Contribution amount must be greater than 0.");
      return;
    }

    setGoals((prev) => {
      let changed = null;

      const next = prev.map((goal) => {
        if (goal.id !== goalId) return goal;

        const entry = {
          id: uid(),
          date: todayISO(),
          amount: parsed,
          note: String(note || "").trim(),
        };

        changed = {
          ...goal,
          current: safeNum(goal.current, 0) + parsed,
          contributions: [entry, ...(Array.isArray(goal.contributions) ? goal.contributions : [])],
          updatedAt: new Date().toISOString(),
        };

        return changed;
      });

      if (changed) scheduleGoalSave(changed);
      return next;
    });

    setCustomContribution((prev) => ({ ...prev, [goalId]: "" }));
    setCustomContributionNote((prev) => ({ ...prev, [goalId]: "" }));
  }

  function undoLastContribution(goalId) {
    setGoals((prev) => {
      let changed = null;

      const next = prev.map((goal) => {
        if (goal.id !== goalId) return goal;

        const list = Array.isArray(goal.contributions) ? [...goal.contributions] : [];
        if (!list.length) return goal;

        const [last, ...rest] = list;

        changed = {
          ...goal,
          current: Math.max(0, safeNum(goal.current, 0) - safeNum(last.amount, 0)),
          contributions: rest,
          updatedAt: new Date().toISOString(),
        };

        return changed;
      });

      if (changed) scheduleGoalSave(changed);
      return next;
    });
  }

  async function exportGoals() {
    const payload = JSON.stringify(goals, null, 2);
    setIoText(payload);

    try {
      await navigator.clipboard.writeText(payload);
    } catch {}
  }

  async function importReplaceGoals() {
    if (!supabase || !userId) return;

    let parsed;
    try {
      parsed = JSON.parse(ioText || "[]");
    } catch {
      setPageError("Import failed: invalid JSON.");
      return;
    }

    if (!Array.isArray(parsed)) {
      setPageError("Import failed: JSON must be an array of goals.");
      return;
    }

    if (typeof window !== "undefined") {
      const okay = window.confirm("Replace all current savings goals?");
      if (!okay) return;
    }

    const normalized = parsed.map((item) => normalizeImportedGoal(item));

    setGoals(normalized);
    setSelectedGoalId(normalized[0]?.id || "");

    const { error: deleteError } = await supabase
      .from("savings_goals")
      .delete()
      .eq("user_id", userId);

    if (deleteError) {
      console.error("import delete error:", deleteError);
      setPageError(deleteError.message || "Failed while clearing current goals.");
      await loadSavingsPage();
      return;
    }

    if (normalized.length > 0) {
      const rows = normalized.map((goal) => mapGoalToRow(goal, userId));

      const { error: insertError } = await supabase
        .from("savings_goals")
        .upsert(rows, { onConflict: "id" });

      if (insertError) {
        console.error("import insert error:", insertError);
        setPageError(insertError.message || "Import failed.");
        await loadSavingsPage();
      }
    }
  }

  const activeGoals = useMemo(() => goals.filter((goal) => !goal.archived), [goals]);

  const rankedActiveGoals = useMemo(() => {
    const rows = [...activeGoals];

    rows.sort((a, b) => {
      const aFunded = amountLeft(a) <= 0 ? 1 : 0;
      const bFunded = amountLeft(b) <= 0 ? 1 : 0;
      if (aFunded !== bFunded) return aFunded - bFunded;

      const aDue = a.dueDate
        ? new Date(`${a.dueDate}T00:00:00`).getTime()
        : Number.POSITIVE_INFINITY;
      const bDue = b.dueDate
        ? new Date(`${b.dueDate}T00:00:00`).getTime()
        : Number.POSITIVE_INFINITY;

      if (aDue !== bDue) return aDue - bDue;

      const pr = priorityRank(a.priority) - priorityRank(b.priority);
      if (pr !== 0) return pr;

      return amountLeft(b) - amountLeft(a);
    });

    return rows;
  }, [activeGoals]);

  const priorityMap = useMemo(() => {
    const map = new Map();
    rankedActiveGoals.forEach((goal, index) => {
      map.set(goal.id, index + 1);
    });
    return map;
  }, [rankedActiveGoals]);

  const visibleGoals = useMemo(() => {
    const query = search.trim().toLowerCase();

    let list = goals.filter((goal) => {
      if (filter === "active" && goal.archived) return false;
      if (filter === "archived" && !goal.archived) return false;

      if (filter === "due") {
        const dueDays = goal.dueDate
          ? Math.round(
              (new Date(`${goal.dueDate}T00:00:00`).getTime() -
                new Date(
                  new Date().getFullYear(),
                  new Date().getMonth(),
                  new Date().getDate()
                ).getTime()) /
                86400000
            )
          : null;

        if (!(dueDays !== null && dueDays >= 0 && dueDays <= 14 && amountLeft(goal) > 0)) {
          return false;
        }
      }

      if (!query) return true;

      return [goal.name, goal.priority, goal.dueDate]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });

    if (sort === "priority") {
      list.sort((a, b) => {
        const ar = priorityMap.get(a.id) ?? 999;
        const br = priorityMap.get(b.id) ?? 999;
        if (ar !== br) return ar - br;
        return amountLeft(b) - amountLeft(a);
      });
      return list;
    }

    if (sort === "due") {
      list.sort((a, b) => {
        const ad = a.dueDate
          ? new Date(`${a.dueDate}T00:00:00`).getTime()
          : Number.POSITIVE_INFINITY;
        const bd = b.dueDate
          ? new Date(`${b.dueDate}T00:00:00`).getTime()
          : Number.POSITIVE_INFINITY;
        return ad - bd;
      });
      return list;
    }

    if (sort === "gap") {
      list.sort((a, b) => amountLeft(b) - amountLeft(a));
      return list;
    }

    if (sort === "progress") {
      list.sort((a, b) => progressPercent(a) - progressPercent(b));
      return list;
    }

    if (sort === "updated") {
      list.sort(
        (a, b) =>
          new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
      );
      return list;
    }

    if (sort === "name") {
      list.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
      return list;
    }

    return list;
  }, [goals, filter, search, sort, priorityMap]);

  const selectedGoal =
    goals.find((goal) => goal.id === selectedGoalId) || visibleGoals[0] || null;

  const selectedPriority = selectedGoal
    ? priorityMap.get(selectedGoal.id) ?? null
    : null;

  const selectedSaving = selectedGoal ? !!savingIds[selectedGoal.id] : false;

  const selectedContributions = useMemo(() => {
    if (!selectedGoal) return [];
    return sortContributionsDesc(
      Array.isArray(selectedGoal.contributions) ? selectedGoal.contributions : []
    );
  }, [selectedGoal]);

  const boardFeed = useMemo(() => {
    return activeGoals
      .flatMap((goal) =>
        (Array.isArray(goal.contributions) ? goal.contributions : []).map((entry) => ({
          id: `${goal.id}-${entry.id}`,
          goalId: goal.id,
          goalName: goal.name,
          amount: safeNum(entry.amount, 0),
          note: entry.note || "",
          date: entry.date || "",
        }))
      )
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
      .slice(0, 12);
  }, [activeGoals]);

  const totals = useMemo(() => {
    const totalCurrent = activeGoals.reduce(
      (sum, goal) => sum + safeNum(goal.current, 0),
      0
    );

    const totalTarget = activeGoals.reduce(
      (sum, goal) => sum + safeNum(goal.target, 0),
      0
    );

    const totalLeft = Math.max(0, totalTarget - totalCurrent);

    const today = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      new Date().getDate()
    ).getTime();

    const dueSoonCount = activeGoals.filter((goal) => {
      if (!goal.dueDate || amountLeft(goal) <= 0) return false;
      const diff = Math.round(
        (new Date(`${goal.dueDate}T00:00:00`).getTime() - today) / 86400000
      );
      return diff >= 0 && diff <= 14;
    }).length;

    const overdueCount = activeGoals.filter((goal) => {
      if (!goal.dueDate || amountLeft(goal) <= 0) return false;
      const diff = Math.round(
        (new Date(`${goal.dueDate}T00:00:00`).getTime() - today) / 86400000
      );
      return diff < 0;
    }).length;

    const thisMonthAdded = activeGoals.reduce(
      (sum, goal) => sum + thisMonthContributionTotal(goal),
      0
    );

    return {
      totalCurrent,
      totalTarget,
      totalLeft,
      activeCount: activeGoals.length,
      archivedCount: goals.filter((goal) => goal.archived).length,
      dueSoonCount,
      overdueCount,
      thisMonthAdded,
    };
  }, [activeGoals, goals]);

  const monthLabel = fmtMonthLabel(monthKeyFromISO(todayISO()));

  const plannerPushValue = selectedGoal
    ? plannerMonthlyPush[selectedGoal.id] ?? ""
    : "";

  const plannerSimulation = selectedGoal
    ? projectedFinishByMonthly(selectedGoal, parseMoneyInput(plannerPushValue))
    : null;

  if (loading) {
    return (
      <main className={styles.page}>
        <GlassPane className={styles.loadingPane}>
          <div className={styles.loadingText}>Loading savings.</div>
        </GlassPane>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      {pageError ? (
        <GlassPane className={styles.errorStrip}>
          <div className={styles.errorTitle}>Savings error</div>
          <div className={styles.errorText}>{pageError}</div>
        </GlassPane>
      ) : null}

      <SavingsTopBar
        totals={totals}
        selectedGoal={selectedGoal}
        monthLabel={monthLabel}
        createOpen={createOpen}
        utilityOpen={utilityOpen}
        onToggleCreate={() => setCreateOpen((prev) => !prev)}
        onToggleUtilities={() => setUtilityOpen((prev) => !prev)}
      />

      <div className={styles.workspace}>
        <div className={styles.leftCol}>
          <GoalNavigator
            goals={visibleGoals}
            selectedGoalId={selectedGoalId}
            onSelectGoal={setSelectedGoalId}
            search={search}
            setSearch={setSearch}
            filter={filter}
            setFilter={setFilter}
            sort={sort}
            setSort={setSort}
            priorityMap={priorityMap}
            onDuplicateGoal={duplicateGoal}
            onToggleArchiveGoal={toggleArchiveGoal}
            onDeleteGoal={removeGoal}
          />
        </div>

        <div className={styles.mainCol}>
          <GoalWorkspace
            selectedGoal={selectedGoal}
            selectedPriority={selectedPriority}
            selectedSaving={selectedSaving}
            workspaceTab={workspaceTab}
            setWorkspaceTab={setWorkspaceTab}
            selectedContributions={selectedContributions}
            boardFeed={boardFeed}
            plannerPushValue={plannerPushValue}
            setPlannerPushValue={(value) => {
              if (!selectedGoal) return;
              setPlannerMonthlyPush((prev) => ({
                ...prev,
                [selectedGoal.id]: value,
              }));
            }}
            plannerSimulation={plannerSimulation}
            customAmount={selectedGoal ? customContribution[selectedGoal.id] ?? "" : ""}
            customNote={selectedGoal ? customContributionNote[selectedGoal.id] ?? "" : ""}
            setCustomAmount={(value) => {
              if (!selectedGoal) return;
              setCustomContribution((prev) => ({
                ...prev,
                [selectedGoal.id]: value,
              }));
            }}
            setCustomNote={(value) => {
              if (!selectedGoal) return;
              setCustomContributionNote((prev) => ({
                ...prev,
                [selectedGoal.id]: value,
              }));
            }}
            onCustomAdd={() => {
              if (!selectedGoal) return;
              applyContribution(
                selectedGoal.id,
                parseMoneyInput(customContribution[selectedGoal.id] ?? ""),
                customContributionNote[selectedGoal.id] ?? ""
              );
            }}
            onQuickAdd={(amount) => {
              if (!selectedGoal) return;
              applyContribution(selectedGoal.id, amount, "Quick add");
            }}
            onUndoLast={() => {
              if (!selectedGoal) return;
              undoLastContribution(selectedGoal.id);
            }}
            onOpenCreate={() => setCreateOpen(true)}
          />
        </div>

        <div className={styles.rightCol}>
          <SavingsRightRail
            createOpen={createOpen}
            onToggleCreate={() => setCreateOpen((prev) => !prev)}
            goalDraft={goalDraft}
            setGoalDraft={setGoalDraft}
            onAddGoal={addGoalFromDraft}
            addingBusy={addingBusy}
            selectedGoal={selectedGoal}
            selectedSaving={selectedSaving}
            onPatchGoal={(patch) => {
              if (!selectedGoal) return;
              updateGoal(selectedGoal.id, patch);
            }}
            onDuplicateGoal={duplicateGoal}
            onToggleArchiveGoal={toggleArchiveGoal}
            onDeleteGoal={removeGoal}
            utilityOpen={utilityOpen}
            onToggleUtilities={() => setUtilityOpen((prev) => !prev)}
            ioText={ioText}
            setIoText={setIoText}
            onExportGoals={exportGoals}
            onImportGoals={importReplaceGoals}
          />
        </div>
      </div>
    </main>
  );
}
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import GlassPane from "../components/GlassPane";
import styles from "./SavingsPage.module.css";
import { supabase } from "@/lib/supabaseClient";
import {
  amountLeft,
  fmtMonthLabel,
  mapGoalRow,
  mapGoalToRow,
  monthKeyFromISO,
  parseMoneyInput,
  priorityRank,
  progressPercent,
  projectedFinishByMonthly,
  recentProjection,
  resolvedGoalName,
  safeNum,
  todayISO,
  uid,
} from "./savings.helpers";
import {
  SummaryStrip,
  RosterPane,
  CommandBoard,
} from "./savings.components";

export default function SavingsCommand() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("active");
  const [sort, setSort] = useState("priority");
  const [showArchived, setShowArchived] = useState(false);
  const [focusMode, setFocusMode] = useState("deadline");
  const [selectedGoalId, setSelectedGoalId] = useState("");
  const [boardTab, setBoardTab] = useState("dashboard");

  const [savingIds, setSavingIds] = useState({});
  const [pageError, setPageError] = useState("");
  const [addingBusy, setAddingBusy] = useState(false);
  const [ioText, setIoText] = useState("");

  const [adding, setAdding] = useState({
    preset: "Emergency Fund",
    customName: "",
    target: "",
    current: "",
    dueDate: "",
    priority: "Medium",
  });

  const [customContribution, setCustomContribution] = useState({});
  const [customContributionNote, setCustomContributionNote] = useState({});
  const [plannerMonthlyPush, setPlannerMonthlyPush] = useState({});

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
      setPageError(error.message || "Failed to load savings.");
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
      return;
    }

    const exists = goals.some((g) => g.id === selectedGoalId);
    if (!exists) {
      setSelectedGoalId(goals[0]?.id || "");
    }
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
    }, 300);
  }

  function updateGoal(id, patch) {
    setGoals((prev) => {
      const nextRows = prev.map((g) =>
        g.id === id
          ? { ...g, ...patch, updatedAt: new Date().toISOString() }
          : g
      );
      const changed = nextRows.find((g) => g.id === id);
      if (changed) scheduleGoalSave(changed);
      return nextRows;
    });
  }

  async function addGoalFromForm() {
    if (!supabase || !userId || addingBusy) return;

    const name = resolvedGoalName(adding.preset, adding.customName);
    const target = safeNum(parseMoneyInput(adding.target), NaN);
    const current = safeNum(parseMoneyInput(adding.current || "0"), 0);

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

    const next = {
      id: uid(),
      name,
      target,
      current,
      dueDate: adding.dueDate || "",
      priority: adding.priority || "Medium",
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
    setGoals((prev) => [next, ...prev]);
    setSelectedGoalId(next.id);
    setBoardTab("focus");

    const { error } = await supabase
      .from("savings_goals")
      .insert(mapGoalToRow(next, userId));

    if (error) {
      console.error("add goal error:", error);
      await loadSavingsPage();
    } else {
      setAdding({
        preset: "Emergency Fund",
        customName: "",
        target: "",
        current: "",
        dueDate: "",
        priority: "Medium",
      });
    }

    setAddingBusy(false);
  }

  async function removeGoal(id) {
    if (!supabase || !userId) return;
    if (typeof window !== "undefined" && !window.confirm("Delete this goal?")) return;

    const nextGoals = goals.filter((g) => g.id !== id);
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
      await loadSavingsPage();
    }
  }

  async function duplicateGoal(goal) {
    if (!supabase || !userId) return;

    const cloned = {
      ...goal,
      id: uid(),
      name: `${goal.name || "Goal"} Copy`,
      createdAt: Date.now(),
      updatedAt: new Date().toISOString(),
      contributions: Array.isArray(goal.contributions)
        ? goal.contributions.map((item) => ({
            ...item,
            id: uid(),
          }))
        : [],
    };

    setGoals((prev) => [cloned, ...prev]);
    setSelectedGoalId(cloned.id);
    setBoardTab("focus");

    const { error } = await supabase
      .from("savings_goals")
      .insert(mapGoalToRow(cloned, userId));

    if (error) {
      console.error("duplicate goal error:", error);
      await loadSavingsPage();
    }
  }

  function toggleArchiveGoal(goal) {
    updateGoal(goal.id, { archived: !goal.archived });
  }

  function applyContribution(goalId, amount, note = "") {
    const parsedAmount = safeNum(amount, NaN);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      alert("Contribution amount must be greater than 0.");
      return;
    }

    setGoals((prev) => {
      const nextRows = prev.map((goal) => {
        if (goal.id !== goalId) return goal;

        const entry = {
          id: uid(),
          date: todayISO(),
          amount: parsedAmount,
          note: String(note || "").trim(),
        };

        return {
          ...goal,
          current: safeNum(goal.current, 0) + parsedAmount,
          contributions: [entry, ...(Array.isArray(goal.contributions) ? goal.contributions : [])],
          updatedAt: new Date().toISOString(),
        };
      });

      const changed = nextRows.find((g) => g.id === goalId);
      if (changed) scheduleGoalSave(changed);

      return nextRows;
    });

    setCustomContribution((prev) => ({ ...prev, [goalId]: "" }));
    setCustomContributionNote((prev) => ({ ...prev, [goalId]: "" }));
  }

  function undoLastContribution(goalId) {
    setGoals((prev) => {
      const nextRows = prev.map((goal) => {
        if (goal.id !== goalId) return goal;
        const list = Array.isArray(goal.contributions) ? goal.contributions : [];
        if (!list.length) return goal;

        const [last, ...rest] = list;

        return {
          ...goal,
          current: Math.max(0, safeNum(goal.current, 0) - safeNum(last.amount, 0)),
          contributions: rest,
          updatedAt: new Date().toISOString(),
        };
      });

      const changed = nextRows.find((g) => g.id === goalId);
      if (changed) scheduleGoalSave(changed);

      return nextRows;
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
      const okay = window.confirm("Replace all current savings goals for this account?");
      if (!okay) return;
    }

    const normalized = parsed.map((goal) => ({
      id: goal.id ?? uid(),
      name: String(goal.name ?? "").trim(),
      target: safeNum(goal.target, 0),
      current: safeNum(goal.current, 0),
      dueDate: goal.dueDate || "",
      priority: goal.priority || "Medium",
      archived: !!goal.archived,
      createdAt: goal.createdAt ?? Date.now(),
      updatedAt: new Date().toISOString(),
      contributions: Array.isArray(goal.contributions) ? goal.contributions : [],
    }));

    setGoals(normalized);
    setSelectedGoalId(normalized[0]?.id || "");

    const { error: deleteError } = await supabase
      .from("savings_goals")
      .delete()
      .eq("user_id", userId);

    if (deleteError) {
      console.error("import delete savings goals error:", deleteError);
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
        console.error("import upsert savings goals error:", insertError);
        setPageError(insertError.message || "Import failed.");
        await loadSavingsPage();
      }
    }
  }

  const activeGoals = useMemo(() => goals.filter((g) => !g.archived), [goals]);

  const totals = useMemo(() => {
    const totalCurrent = activeGoals.reduce((sum, g) => sum + safeNum(g.current), 0);
    const totalTarget = activeGoals.reduce((sum, g) => sum + safeNum(g.target), 0);
    const totalLeft = Math.max(0, totalTarget - totalCurrent);
    const completion = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0;

    const fundedCount = activeGoals.filter((g) => amountLeft(g) <= 0).length;
    const dueSoonCount = activeGoals.filter((g) => {
      const d = Number.isFinite(new Date(g.dueDate).getTime()) ? null : null;
      const remaining = amountLeft(g);
      const diff = g.dueDate ? Math.round((new Date(`${g.dueDate}T00:00:00`).getTime() - new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime()) / 86400000) : null;
      return diff !== null && diff >= 0 && diff <= 14 && remaining > 0;
    }).length;

    const overdueCount = activeGoals.filter((g) => {
      const diff = g.dueDate ? Math.round((new Date(`${g.dueDate}T00:00:00`).getTime() - new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime()) / 86400000) : null;
      return diff !== null && diff < 0 && amountLeft(g) > 0;
    }).length;

    return {
      totalCurrent,
      totalTarget,
      totalLeft,
      completion,
      fundedCount,
      dueSoonCount,
      overdueCount,
    };
  }, [activeGoals]);

  const rankedGoals = useMemo(() => {
    const rows = [...activeGoals];

    if (focusMode === "gap") {
      rows.sort((a, b) => {
        const leftDiff = amountLeft(b) - amountLeft(a);
        if (leftDiff !== 0) return leftDiff;
        return priorityRank(a.priority) - priorityRank(b.priority);
      });
    } else if (focusMode === "progress") {
      rows.sort((a, b) => {
        const progressDiff = progressPercent(a) - progressPercent(b);
        if (progressDiff !== 0) return progressDiff;
        return amountLeft(b) - amountLeft(a);
      });
    } else {
      rows.sort((a, b) => {
        const aFunded = amountLeft(a) <= 0 ? 1 : 0;
        const bFunded = amountLeft(b) <= 0 ? 1 : 0;
        if (aFunded !== bFunded) return aFunded - bFunded;

        const ad = a.dueDate
          ? Math.round(
              (new Date(`${a.dueDate}T00:00:00`).getTime() -
                new Date(
                  new Date().getFullYear(),
                  new Date().getMonth(),
                  new Date().getDate()
                ).getTime()) /
                86400000
            )
          : Number.POSITIVE_INFINITY;

        const bd = b.dueDate
          ? Math.round(
              (new Date(`${b.dueDate}T00:00:00`).getTime() -
                new Date(
                  new Date().getFullYear(),
                  new Date().getMonth(),
                  new Date().getDate()
                ).getTime()) /
                86400000
            )
          : Number.POSITIVE_INFINITY;

        if (ad !== bd) return ad - bd;

        const pr = priorityRank(a.priority) - priorityRank(b.priority);
        if (pr !== 0) return pr;

        return amountLeft(b) - amountLeft(a);
      });
    }

    return rows.map((g, i) => ({
      ...g,
      priorityRank: i + 1,
    }));
  }, [activeGoals, focusMode]);

  const priorityMap = useMemo(() => {
    const map = new Map();
    rankedGoals.forEach((g) => map.set(g.id, g.priorityRank));
    return map;
  }, [rankedGoals]);

  const visibleGoals = useMemo(() => {
    const q = search.trim().toLowerCase();

    let list = goals.filter((g) => {
      if (filter === "active" && g.archived) return false;
      if (filter === "archived" && !g.archived) return false;
      if (filter === "due") {
        const diff = g.dueDate
          ? Math.round(
              (new Date(`${g.dueDate}T00:00:00`).getTime() -
                new Date(
                  new Date().getFullYear(),
                  new Date().getMonth(),
                  new Date().getDate()
                ).getTime()) /
                86400000
            )
          : null;
        if (!(diff !== null && diff <= 14 && amountLeft(g) > 0)) return false;
      }

      if (!showArchived && filter !== "archived" && g.archived) return false;

      if (!q) return true;

      return [g.name, g.priority, g.dueDate]
        .join(" ")
        .toLowerCase()
        .includes(q);
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

    if (sort === "left") {
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
          new Date(b.updatedAt || 0).getTime() -
          new Date(a.updatedAt || 0).getTime()
      );
      return list;
    }

    if (sort === "name") {
      list.sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""))
      );
      return list;
    }

    list.sort((a, b) => {
      const ad = a.dueDate
        ? Math.round(
            (new Date(`${a.dueDate}T00:00:00`).getTime() -
              new Date(
                new Date().getFullYear(),
                new Date().getMonth(),
                new Date().getDate()
              ).getTime()) /
              86400000
          )
        : 9999;

      const bd = b.dueDate
        ? Math.round(
            (new Date(`${b.dueDate}T00:00:00`).getTime() -
              new Date(
                new Date().getFullYear(),
                new Date().getMonth(),
                new Date().getDate()
              ).getTime()) /
              86400000
          )
        : 9999;

      return ad - bd;
    });

    return list;
  }, [goals, showArchived, filter, search, sort, priorityMap]);

  const selectedGoal =
    goals.find((g) => g.id === selectedGoalId) || visibleGoals[0] || null;

  const selectedPriority = selectedGoal
    ? priorityMap.get(selectedGoal.id) ?? null
    : null;

  const selectedSaving = selectedGoal ? !!savingIds[selectedGoal.id] : false;

  const selectedContributions = useMemo(() => {
    if (!selectedGoal) return [];
    return (Array.isArray(selectedGoal.contributions) ? selectedGoal.contributions : [])
      .slice()
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  }, [selectedGoal]);

  const contributionFeed = useMemo(() => {
    const items = activeGoals.flatMap((goal) =>
      (Array.isArray(goal.contributions) ? goal.contributions : []).map((entry) => ({
        id: entry.id,
        goalId: goal.id,
        goalName: goal.name,
        amount: safeNum(entry.amount),
        note: entry.note || "",
        date: entry.date || "",
      }))
    );

    return items
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 10);
  }, [activeGoals]);

  const monthLabel = fmtMonthLabel(monthKeyFromISO(todayISO()));

  const heroTone =
    totals.overdueCount > 0
      ? "red"
      : totals.dueSoonCount > 0
      ? "amber"
      : "green";

  const plannerPushValue = selectedGoal
    ? plannerMonthlyPush[selectedGoal.id] ?? ""
    : "";

  const plannerSimulation = selectedGoal
    ? projectedFinishByMonthly(selectedGoal, parseMoneyInput(plannerPushValue))
    : null;

  if (loading) {
    return (
      <main className={styles.page}>
        <GlassPane className={styles.gatePanel}>
          <div className={styles.gateText}>Loading savings.</div>
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

      <SummaryStrip
        totals={totals}
        focusMode={focusMode}
        monthLabel={monthLabel}
        activeGoals={activeGoals}
        selectedGoal={selectedGoal}
        heroTone={heroTone}
      />

      <div className={styles.workspace}>
        <div className={styles.leftCol}>
          <RosterPane
            visibleGoals={visibleGoals}
            selectedGoal={selectedGoal}
            priorityMap={priorityMap}
            search={search}
            setSearch={setSearch}
            filter={filter}
            setFilter={setFilter}
            sort={sort}
            setSort={setSort}
            focusMode={focusMode}
            setFocusMode={setFocusMode}
            onSelectGoal={setSelectedGoalId}
            onDuplicate={duplicateGoal}
            onArchive={toggleArchiveGoal}
            onDelete={removeGoal}
          />
        </div>

        <div className={styles.mainCol}>
          <CommandBoard
            boardTab={boardTab}
            setBoardTab={setBoardTab}
            selectedGoal={selectedGoal}
            selectedPriority={selectedPriority}
            selectedSaving={selectedSaving}
            selectedContributions={selectedContributions}
            contributionFeed={contributionFeed}
            plannerPushValue={plannerPushValue}
            setPlannerPushValue={(value) =>
              selectedGoal &&
              setPlannerMonthlyPush((prev) => ({
                ...prev,
                [selectedGoal.id]: value,
              }))
            }
            plannerSimulation={plannerSimulation}
            activeGoals={activeGoals}
            customAmount={selectedGoal ? customContribution[selectedGoal.id] ?? "" : ""}
            customNote={selectedGoal ? customContributionNote[selectedGoal.id] ?? "" : ""}
            setCustomAmount={(value) =>
              selectedGoal &&
              setCustomContribution((prev) => ({
                ...prev,
                [selectedGoal.id]: value,
              }))
            }
            setCustomNote={(value) =>
              selectedGoal &&
              setCustomContributionNote((prev) => ({
                ...prev,
                [selectedGoal.id]: value,
              }))
            }
            adding={adding}
            setAdding={setAdding}
            addingBusy={addingBusy}
            ioText={ioText}
            setIoText={setIoText}
            onAddGoal={addGoalFromForm}
            onPatchGoal={(patch) => selectedGoal && updateGoal(selectedGoal.id, patch)}
            onDuplicateGoal={duplicateGoal}
            onToggleArchiveGoal={toggleArchiveGoal}
            onDeleteGoal={removeGoal}
            onQuickAdd={(amount) =>
              selectedGoal && applyContribution(selectedGoal.id, amount, "Quick add")
            }
            onUndoLast={() => selectedGoal && undoLastContribution(selectedGoal.id)}
            onCustomAdd={() =>
              selectedGoal &&
              applyContribution(
                selectedGoal.id,
                parseMoneyInput(customContribution[selectedGoal.id] ?? ""),
                customContributionNote[selectedGoal.id] ?? ""
              )
            }
            onExportGoals={exportGoals}
            onImportGoals={importReplaceGoals}
          />
        </div>
      </div>
    </main>
  );
}
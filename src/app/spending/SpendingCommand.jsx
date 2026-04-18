
"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  DEFAULT_BUDGETS,
  DEFAULT_CATEGORIES,
  applyLedgerForTransaction,
  buildLedgerMap,
  budgetStatus,
  deleteCalendarEventBySource,
  emptySelection,
  getPreviousRange,
  inRange,
  mapAccountRowToClient,
  mapCategoryClientToRow,
  mapCategoryRowToClient,
  mapPlannedClientToRow,
  mapPlannedRowToClient,
  mapTransactionClientToRow,
  mapTransactionRowToClient,
  money,
  parseMoneyInput,
  periodBounds,
  roundMoneyValue,
  todayISO,
  trendMeta,
  uid,
  upsertCalendarEventForPlanned,
  upsertCalendarEventForTransaction,
} from "./spending.helpers";
import {
  ControlModal,
  FeedPane,
  MainWorkspacePane,
  QuickEntryModal,
  ToastStack,
  TopStrip,
} from "./spending.components";
import styles from "./SpendingPage.module.css";

function computeTotals(filteredTransactions, filteredPlanned) {
  let expense = 0;
  let income = 0;
  let transfer = 0;

  filteredTransactions.forEach((tx) => {
    if (tx.type === "expense") expense += Number(tx.amount) || 0;
    if (tx.type === "income") income += Number(tx.amount) || 0;
    if (tx.type === "transfer") transfer += Number(tx.amount) || 0;
  });

  const plannedExpense = filteredPlanned.reduce(
    (sum, planned) => sum + (Number(planned.amount) || 0),
    0
  );

  return {
    expense: roundMoneyValue(expense),
    income: roundMoneyValue(income),
    transfer: roundMoneyValue(transfer),
    plannedExpense: roundMoneyValue(plannedExpense),
  };
}

function emptyDraft(kind = "transaction", categories = [], accounts = []) {
  return {
    kind,
    id: "",
    type: "expense",
    amount: "",
    date: todayISO(),
    time: "",
    categoryId: categories[0]?.id || "groceries",
    merchant: "",
    note: "",
    paymentMethod: "Card",
    accountId: accounts[0]?.id || "",
    transferAccountId:
      accounts.find((account) => account.id !== (accounts[0]?.id || ""))?.id || "",
  };
}

function draftFromTransaction(tx, categories = [], accounts = []) {
  const draft = emptyDraft("transaction", categories, accounts);
  return {
    ...draft,
    id: tx.id,
    type: tx.type || "expense",
    amount: String(tx.amount ?? ""),
    date: tx.date || todayISO(),
    time: tx.time || "",
    categoryId: tx.categoryId || draft.categoryId,
    merchant: tx.merchant || "",
    note: tx.note || "",
    paymentMethod: tx.paymentMethod || "Card",
    accountId: tx.accountId || draft.accountId,
    transferAccountId: tx.transferAccountId || draft.transferAccountId,
  };
}

function draftFromPlanned(planned, categories = [], accounts = []) {
  const draft = emptyDraft("planned", categories, accounts);
  return {
    ...draft,
    id: planned.id,
    amount: String(planned.amount ?? ""),
    date: planned.date || todayISO(),
    time: planned.time || "",
    categoryId: planned.categoryId || draft.categoryId,
    merchant: planned.merchant || "",
    note: planned.note || "",
  };
}

function computeTopMerchants(rows = []) {
  const map = new Map();

  rows.forEach((row) => {
    if (row.type !== "expense") return;
    const merchant = String(row.merchant || "").trim();
    if (!merchant) return;
    const entry = map.get(merchant) || { merchant, total: 0, count: 0 };
    entry.total = roundMoneyValue(entry.total + (Number(row.amount) || 0));
    entry.count += 1;
    map.set(merchant, entry);
  });

  return Array.from(map.values())
    .sort((a, b) => b.total - a.total || b.count - a.count)
    .map((row) => ({
      ...row,
      avg: row.count > 0 ? roundMoneyValue(row.total / row.count) : 0,
    }));
}

function createBetterBuyIdeas({ selectedTx, selectedBudgetRow, topMerchants = [], categoriesById }) {
  const ideas = [];
  if (!selectedTx || selectedTx.type !== "expense") return ideas;

  const categoryName = categoriesById.get(selectedTx.categoryId)?.name || "this lane";

  if ((selectedBudgetRow?.budget || 0) > 0 && (selectedBudgetRow?.forecast || 0) > (selectedBudgetRow?.budget || 0)) {
    ideas.push({
      id: `budget-${selectedTx.id}`,
      title: `Reduce the next ${categoryName} ticket`,
      body: `${categoryName} is already over budget. The next repeat purchase should target a lower-cost option or get delayed.`,
      impact: `Potential savings: ${money(Math.max(5, roundMoneyValue(selectedTx.amount * 0.2)))}`,
      tone: "bad",
    });
  }

  const merchantRow = topMerchants.find(
    (row) => String(row.merchant || "").toLowerCase() === String(selectedTx.merchant || "").toLowerCase()
  );

  if (merchantRow && merchantRow.count >= 3) {
    ideas.push({
      id: `merchant-${selectedTx.id}`,
      title: `You keep spending at ${selectedTx.merchant || "this merchant"}`,
      body: `This merchant is showing repeat pressure. Save a cheaper substitute or a different store before the next run.`,
      impact: `Potential savings: ${money(Math.max(4, roundMoneyValue(merchantRow.avg * 0.12)))}`,
      tone: "watch",
    });
  }

  if (selectedTx.amount >= 40) {
    ideas.push({
      id: `price-${selectedTx.id}`,
      title: `Target a lower price next time`,
      body: `This ticket is large enough that even a modest price drop matters. Save a better option into Shopping List.`,
      impact: `Potential savings: ${money(Math.max(3, roundMoneyValue(selectedTx.amount * 0.15)))}`,
      tone: "good",
    });
  }

  if (!ideas.length) {
    ideas.push({
      id: `generic-${selectedTx.id}`,
      title: `Create a cheaper fallback option`,
      body: `This purchase is not a disaster, but you still want a better default next time.`,
      impact: `Potential savings: ${money(Math.max(2, roundMoneyValue(selectedTx.amount * 0.08)))}`,
      tone: "good",
    });
  }

  return ideas.slice(0, 4);
}

function buildSubscriptionCandidates(transactions) {
  const grouped = new Map();

  transactions
    .filter((tx) => tx.type === "expense" && tx.merchant)
    .forEach((tx) => {
      const key = String(tx.merchant).trim().toLowerCase();
      const entry = grouped.get(key) || {
        id: key,
        merchant: tx.merchant,
        count: 0,
        total: 0,
      };
      entry.count += 1;
      entry.total += Number(tx.amount) || 0;
      grouped.set(key, entry);
    });

  return Array.from(grouped.values())
    .filter((entry) => entry.count >= 2)
    .map((entry) => ({
      ...entry,
      avg: roundMoneyValue(entry.total / entry.count),
    }))
    .sort((a, b) => b.count - a.count || b.avg - a.avg)
    .slice(0, 6);
}

export default function SpendingCommand() {
  const [user, setUser] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [pageError, setPageError] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const [period, setPeriod] = React.useState("month");
  const [search, setSearch] = React.useState("");
  const [workspaceMode, setWorkspaceMode] = React.useState("dashboard");
  const [selectedRecord, setSelectedRecord] = React.useState(emptySelection());

  const [categories, setCategories] = React.useState(DEFAULT_CATEGORIES);
  const [budgets, setBudgets] = React.useState(DEFAULT_BUDGETS);
  const [accounts, setAccounts] = React.useState([]);
  const [transactions, setTransactions] = React.useState([]);
  const [plannedItems, setPlannedItems] = React.useState([]);

  const [composerOpen, setComposerOpen] = React.useState(false);
  const [composerKind, setComposerKind] = React.useState("create_tx");
  const [composerDraft, setComposerDraft] = React.useState(emptyDraft());
  const [controlsOpen, setControlsOpen] = React.useState(false);

  const [newCategoryName, setNewCategoryName] = React.useState("");
  const [newCategoryGroup, setNewCategoryGroup] = React.useState("Other");
  const [budgetEditorCategoryId, setBudgetEditorCategoryId] = React.useState("");
  const [budgetEditorValue, setBudgetEditorValue] = React.useState("");
  const [queuedIdeas, setQueuedIdeas] = React.useState([]);

  const range = React.useMemo(() => periodBounds(period), [period]);

  const categoriesById = React.useMemo(() => {
    const map = new Map();
    categories.forEach((category) => map.set(category.id, category));
    return map;
  }, [categories]);

  const groups = React.useMemo(() => {
    const names = Array.from(new Set(categories.map((category) => category.group || "Other")));
    return ["All", ...names];
  }, [categories]);

  const loadAll = React.useCallback(
    async (preferredSelection = null) => {
      setLoading(true);
      setPageError("");

      try {
        const {
          data: { user: currentUser },
          error: userErr,
        } = await supabase.auth.getUser();

        if (userErr) throw userErr;
        setUser(currentUser || null);

        if (!currentUser) {
          setAccounts([]);
          setTransactions([]);
          setPlannedItems([]);
          setLoading(false);
          return;
        }

        const [catRes, budgetRes, accountRes, txRes, plannedRes, ledgerRes] = await Promise.all([
          supabase
            .from("spending_categories")
            .select("*")
            .eq("user_id", currentUser.id)
            .order("group_name")
            .order("name"),
          supabase.from("spending_budgets").select("*").eq("user_id", currentUser.id),
          supabase
            .from("accounts")
            .select("id,name,account_type,balance")
            .eq("user_id", currentUser.id)
            .order("name"),
          supabase
            .from("spending_transactions")
            .select("*")
            .eq("user_id", currentUser.id)
            .order("tx_date", { ascending: false })
            .order("tx_time", { ascending: false })
            .order("created_at", { ascending: false }),
          supabase
            .from("spending_planned_items")
            .select("*")
            .eq("user_id", currentUser.id)
            .order("planned_date", { ascending: true })
            .order("planned_time", { ascending: true })
            .order("created_at", { ascending: false }),
          supabase
            .from("account_transactions")
            .select("source_id,account_id,related_account_id,related_account_name,delta,kind,source_type")
            .eq("user_id", currentUser.id)
            .eq("source_type", "spending_transaction"),
        ]);

        if (catRes.error) throw catRes.error;
        if (budgetRes.error) throw budgetRes.error;
        if (accountRes.error) throw accountRes.error;
        if (txRes.error) throw txRes.error;
        if (plannedRes.error) throw plannedRes.error;
        if (ledgerRes.error) throw ledgerRes.error;

        const loadedCategories =
          (catRes.data || []).length > 0
            ? (catRes.data || []).map(mapCategoryRowToClient)
            : DEFAULT_CATEGORIES;

        const nextBudgets = { weekly: {}, monthly: {}, yearly: {} };
        if ((budgetRes.data || []).length > 0) {
          for (const row of budgetRes.data || []) {
            if (!nextBudgets[row.period_mode]) continue;
            nextBudgets[row.period_mode][row.category_id] = Number(row.amount) || 0;
          }
        } else {
          nextBudgets.weekly = { ...DEFAULT_BUDGETS.weekly };
          nextBudgets.monthly = { ...DEFAULT_BUDGETS.monthly };
          nextBudgets.yearly = { ...DEFAULT_BUDGETS.yearly };
        }

        const loadedAccounts = (accountRes.data || []).map(mapAccountRowToClient);
        const ledgerMap = buildLedgerMap(ledgerRes.data || []);

        const loadedTransactions = (txRes.data || [])
          .map((row) => mapTransactionRowToClient(row, ledgerMap.get(String(row.id)) || []))
          .sort((a, b) => {
            if (b.date !== a.date) return String(b.date).localeCompare(String(a.date));
            if ((b.time || "") !== (a.time || "")) {
              return String(b.time || "").localeCompare(String(a.time || ""));
            }
            return Number(b.createdAt || 0) - Number(a.createdAt || 0);
          });

        const loadedPlanned = (plannedRes.data || [])
          .map(mapPlannedRowToClient)
          .sort((a, b) => {
            if (a.date !== b.date) return String(a.date).localeCompare(String(b.date));
            if ((a.time || "") !== (b.time || "")) {
              return String(a.time || "").localeCompare(String(b.time || ""));
            }
            return Number(a.createdAt || 0) - Number(b.createdAt || 0);
          });

        setCategories(loadedCategories);
        setBudgets(nextBudgets);
        setAccounts(loadedAccounts);
        setTransactions(loadedTransactions);
        setPlannedItems(loadedPlanned);

        setBudgetEditorCategoryId((prev) =>
          loadedCategories.some((category) => category.id === prev)
            ? prev
            : loadedCategories[0]?.id || ""
        );

        setSelectedRecord((prev) => {
          if (
            preferredSelection &&
            ((preferredSelection.kind === "tx" &&
              loadedTransactions.some((tx) => tx.id === preferredSelection.id)) ||
              (preferredSelection.kind === "planned" &&
                loadedPlanned.some((planned) => planned.id === preferredSelection.id)))
          ) {
            return preferredSelection;
          }

          const stillExists =
            (prev.kind === "tx" && loadedTransactions.some((tx) => tx.id === prev.id)) ||
            (prev.kind === "planned" && loadedPlanned.some((planned) => planned.id === prev.id));

          if (stillExists) return prev;
          if (loadedTransactions[0]) return { kind: "tx", id: loadedTransactions[0].id };
          if (loadedPlanned[0]) return { kind: "planned", id: loadedPlanned[0].id };
          return emptySelection();
        });
      } catch (err) {
        setPageError(err?.message || "Failed to load spending page.");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  React.useEffect(() => {
    loadAll();
  }, [loadAll]);

  React.useEffect(() => {
    if (!status) return;
    const id = setTimeout(() => setStatus(""), 3200);
    return () => clearTimeout(id);
  }, [status]);

  const filteredTransactions = React.useMemo(() => {
    const q = search.trim().toLowerCase();

    return transactions
      .filter((tx) => inRange(tx.date, range.start, range.end))
      .filter((tx) => {
        if (!q) return true;
        const categoryName = categoriesById.get(tx.categoryId)?.name || "";
        return `${tx.merchant} ${tx.note} ${tx.date} ${tx.time} ${categoryName} ${tx.amount} ${tx.paymentMethod} ${tx.account}`
          .toLowerCase()
          .includes(q);
      });
  }, [transactions, range, search, categoriesById]);

  const filteredPlanned = React.useMemo(() => {
    const q = search.trim().toLowerCase();

    return plannedItems
      .filter((planned) => inRange(planned.date, range.start, range.end))
      .filter((planned) => {
        if (!q) return true;
        const categoryName = categoriesById.get(planned.categoryId)?.name || "";
        return `${planned.merchant} ${planned.note} ${planned.date} ${planned.time} ${categoryName} ${planned.amount}`
          .toLowerCase()
          .includes(q);
      });
  }, [plannedItems, range, search, categoriesById]);

  const previousRange = React.useMemo(() => getPreviousRange(period, range), [period, range]);
  const previousTransactions = React.useMemo(
    () => transactions.filter((tx) => inRange(tx.date, previousRange.start, previousRange.end)),
    [transactions, previousRange]
  );

  const totals = React.useMemo(
    () => computeTotals(filteredTransactions, filteredPlanned),
    [filteredTransactions, filteredPlanned]
  );
  const previousExpense = React.useMemo(
    () =>
      roundMoneyValue(
        previousTransactions.reduce((sum, tx) => {
          return tx.type === "expense" ? sum + (Number(tx.amount) || 0) : sum;
        }, 0)
      ),
    [previousTransactions]
  );
  const expenseTrend = React.useMemo(
    () => trendMeta(totals.expense, previousExpense),
    [totals.expense, previousExpense]
  );

  const topMerchants = React.useMemo(
    () => computeTopMerchants(filteredTransactions).slice(0, 8),
    [filteredTransactions]
  );

  const totalsByCategory = React.useMemo(
    () =>
      categories
        .map((category) => {
          const spent = roundMoneyValue(
            filteredTransactions
              .filter((tx) => tx.type === "expense" && tx.categoryId === category.id)
              .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0)
          );

          const planned = roundMoneyValue(
            filteredPlanned
              .filter((planned) => planned.categoryId === category.id)
              .reduce((sum, planned) => sum + (Number(planned.amount) || 0), 0)
          );

          const forecast = roundMoneyValue(spent + planned);
          const budget = roundMoneyValue(Number(budgets?.[range.budgetMode]?.[category.id] || 0));

          return {
            categoryId: category.id,
            category,
            spent,
            planned,
            forecast,
            budget,
            status: budgetStatus(forecast, budget),
            pctUsed: budget > 0 ? roundMoneyValue((forecast / budget) * 100) : 0,
            amountLeft: budget > 0 ? roundMoneyValue(budget - forecast) : 0,
          };
        })
        .filter((row) => row.spent > 0 || row.planned > 0 || row.budget > 0)
        .sort((a, b) => {
          const aTone = a.status === "Over" ? 3 : a.status === "Near" ? 2 : 1;
          const bTone = b.status === "Over" ? 3 : b.status === "Near" ? 2 : 1;
          return bTone - aTone || Number(b.forecast) - Number(a.forecast);
        }),
    [categories, filteredTransactions, filteredPlanned, budgets, range.budgetMode]
  );

  const forecastRemaining = React.useMemo(() => {
    const budgetTotal = totalsByCategory.reduce((sum, row) => sum + (row.budget || 0), 0);
    const forecast = totalsByCategory.reduce((sum, row) => sum + (row.forecast || 0), 0);
    return roundMoneyValue(budgetTotal - forecast);
  }, [totalsByCategory]);

  const selectedTx = React.useMemo(
    () => (selectedRecord.kind === "tx" ? transactions.find((tx) => tx.id === selectedRecord.id) || null : null),
    [selectedRecord, transactions]
  );

  const selectedPlanned = React.useMemo(
    () =>
      selectedRecord.kind === "planned"
        ? plannedItems.find((planned) => planned.id === selectedRecord.id) || null
        : null,
    [selectedRecord, plannedItems]
  );

  const selectedBudgetRow = React.useMemo(() => {
    const categoryId = selectedTx?.categoryId || selectedPlanned?.categoryId || "";
    return totalsByCategory.find((row) => row.categoryId === categoryId) || null;
  }, [selectedTx, selectedPlanned, totalsByCategory]);

  const merchantStats = React.useMemo(() => {
    if (!selectedTx?.merchant) return null;
    const match = topMerchants.find(
      (row) => String(row.merchant || "").toLowerCase() === String(selectedTx.merchant || "").toLowerCase()
    );
    return match ? { ...match, visits: match.count } : null;
  }, [selectedTx, topMerchants]);

  const notifications = React.useMemo(() => {
    const items = [];

    totalsByCategory
      .filter((row) => row.budget > 0 && row.forecast > row.budget)
      .slice(0, 4)
      .forEach((row) => {
        const overBy = roundMoneyValue(row.forecast - row.budget);
        items.push({
          id: `over-${row.categoryId}`,
          tone: "red",
          target: "dashboard",
          title: `${row.category.name} is over budget`,
          body: `${money(overBy)} over in the current view.`,
        });
      });

    if (selectedTx) {
      items.push({
        id: `detail-${selectedTx.id}`,
        tone: "blue",
        target: "breakdown",
        title: "Direct row tools are live",
        body: "Use the selected row to edit, judge, duplicate, or delete it.",
      });
    }

    if (totals.plannedExpense > 0) {
      items.push({
        id: "planned-pressure",
        tone: "amber",
        target: "shopping",
        title: "Planned spending is active",
        body: `${money(totals.plannedExpense)} in future pressure is still sitting ahead.`,
      });
    }

    if (!items.length) {
      items.push({
        id: "all-clear",
        tone: "green",
        target: "shopping",
        title: "No hard alerts right now",
        body: "Visible spending is stable in the current view.",
      });
    }

    return items;
  }, [totalsByCategory, selectedTx, totals.plannedExpense]);

  const betterBuyIdeas = React.useMemo(
    () =>
      createBetterBuyIdeas({
        selectedTx,
        selectedBudgetRow,
        topMerchants,
        categoriesById,
      }),
    [selectedTx, selectedBudgetRow, topMerchants, categoriesById]
  );

  const subscriptionCandidates = React.useMemo(
    () => buildSubscriptionCandidates(transactions),
    [transactions]
  );

  function queueIdea(idea) {
    setQueuedIdeas((prev) => {
      if (prev.some((entry) => entry.id === idea.id)) return prev;
      return [...prev, idea];
    });
    setStatus("Queued for shopping list.");
  }

  function openCreateTransaction() {
    setComposerKind("create_tx");
    setComposerDraft(emptyDraft("transaction", categories, accounts));
    setComposerOpen(true);
  }

  function openEditTransaction(tx) {
    if (!tx) return;
    setComposerKind("edit_tx");
    setComposerDraft(draftFromTransaction(tx, categories, accounts));
    setComposerOpen(true);
  }

  function openEditPlanned(planned) {
    if (!planned) return;
    setComposerKind("edit_planned");
    setComposerDraft(draftFromPlanned(planned, categories, accounts));
    setComposerOpen(true);
  }

  function duplicateTransaction(tx) {
    if (!tx) return;
    const nextDraft = draftFromTransaction(tx, categories, accounts);
    nextDraft.id = "";
    nextDraft.date = todayISO();
    setComposerKind("create_tx");
    setComposerDraft(nextDraft);
    setComposerOpen(true);
    setStatus("Loaded row into composer.");
  }

  async function createSyncedTransaction(tx) {
    if (!user) throw new Error("Missing user.");

    const { data: savedRow, error } = await supabase
      .from("spending_transactions")
      .insert([mapTransactionClientToRow(tx, user.id)])
      .select()
      .single();

    if (error) throw error;

    const savedTx = mapTransactionRowToClient(savedRow, []);

    await applyLedgerForTransaction({
      userId: user.id,
      tx: savedTx,
      accounts,
    });

    await upsertCalendarEventForTransaction(
      savedTx,
      user.id,
      categoriesById.get(savedTx.categoryId) || null
    );

    return savedTx;
  }

  async function saveTransactionCreate() {
    const amount = parseMoneyInput(composerDraft.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Enter a valid amount.");
    }
    if (!composerDraft.accountId) {
      throw new Error("Choose an account.");
    }
    if (
      composerDraft.type === "transfer" &&
      (!composerDraft.transferAccountId || composerDraft.transferAccountId === composerDraft.accountId)
    ) {
      throw new Error("Choose a different transfer account.");
    }

    const sourceAccount = accounts.find((account) => account.id === composerDraft.accountId) || null;
    const transferAccount =
      accounts.find((account) => account.id === composerDraft.transferAccountId) || null;

    const tx = {
      id: uid(),
      type: composerDraft.type,
      amount: roundMoneyValue(amount),
      categoryId: composerDraft.categoryId || null,
      date: composerDraft.date || todayISO(),
      time: composerDraft.time || "",
      merchant: composerDraft.merchant.trim(),
      note: composerDraft.note.trim(),
      paymentMethod: composerDraft.paymentMethod || "Card",
      account:
        composerDraft.type === "transfer"
          ? `${sourceAccount?.name || ""} → ${transferAccount?.name || ""}`
          : sourceAccount?.name || "",
      accountId: sourceAccount?.id || "",
      accountName: sourceAccount?.name || "",
      transferAccountId: transferAccount?.id || "",
      transferAccountName: transferAccount?.name || "",
      createdAt: Date.now(),
    };

    const savedTx = await createSyncedTransaction(tx);
    setComposerOpen(false);
    setStatus("Transaction posted.");
    await loadAll({ kind: "tx", id: savedTx.id });
  }

  async function saveTransactionUpdate() {
    if (!user || !composerDraft.id) throw new Error("Missing transaction.");
    const existingTx = transactions.find((tx) => tx.id === composerDraft.id);
    if (!existingTx) throw new Error("That transaction no longer exists.");

    const amount = parseMoneyInput(composerDraft.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Enter a valid amount.");
    }
    if (!composerDraft.accountId) {
      throw new Error("Choose an account.");
    }
    if (
      composerDraft.type === "transfer" &&
      (!composerDraft.transferAccountId || composerDraft.transferAccountId === composerDraft.accountId)
    ) {
      throw new Error("Choose a different transfer account.");
    }

    const sourceAccount = accounts.find((account) => account.id === composerDraft.accountId) || null;
    const transferAccount =
      accounts.find((account) => account.id === composerDraft.transferAccountId) || null;

    const updatedTx = {
      ...existingTx,
      type: composerDraft.type,
      amount: roundMoneyValue(amount),
      categoryId: composerDraft.categoryId || null,
      date: composerDraft.date || todayISO(),
      time: composerDraft.time || "",
      merchant: composerDraft.merchant.trim(),
      note: composerDraft.note.trim(),
      paymentMethod: composerDraft.paymentMethod || "Card",
      account:
        composerDraft.type === "transfer"
          ? `${sourceAccount?.name || ""} → ${transferAccount?.name || ""}`
          : sourceAccount?.name || "",
      accountId: sourceAccount?.id || "",
      accountName: sourceAccount?.name || "",
      transferAccountId: transferAccount?.id || "",
      transferAccountName: transferAccount?.name || "",
    };

    let reversed = false;

    try {
      await applyLedgerForTransaction({
        userId: user.id,
        tx: existingTx,
        accounts,
        reverse: true,
        sourceIdOverride: `${existingTx.id}_edit_reverse`,
      });
      reversed = true;

      const { data: savedRow, error } = await supabase
        .from("spending_transactions")
        .update(mapTransactionClientToRow(updatedTx, user.id))
        .eq("id", existingTx.id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;

      const savedTx = mapTransactionRowToClient(savedRow, []);

      await applyLedgerForTransaction({
        userId: user.id,
        tx: savedTx,
        accounts,
        sourceIdOverride: `${savedTx.id}_edit_apply`,
      });

      await upsertCalendarEventForTransaction(
        savedTx,
        user.id,
        categoriesById.get(savedTx.categoryId) || null
      );

      setComposerOpen(false);
      setStatus("Transaction updated.");
      await loadAll({ kind: "tx", id: savedTx.id });
    } catch (err) {
      if (reversed) {
        try {
          await applyLedgerForTransaction({
            userId: user.id,
            tx: existingTx,
            accounts,
            sourceIdOverride: `${existingTx.id}_edit_restore`,
          });
        } catch {
          // best effort only
        }
      }
      throw err;
    }
  }

  async function savePlannedCreate() {
    if (!user) throw new Error("Missing user.");

    const amount = parseMoneyInput(composerDraft.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Enter a valid planned amount.");
    }

    const planned = {
      id: uid(),
      amount: roundMoneyValue(amount),
      categoryId: composerDraft.categoryId || null,
      date: composerDraft.date || todayISO(),
      time: composerDraft.time || "",
      merchant: composerDraft.merchant.trim(),
      note: composerDraft.note.trim(),
      createdAt: Date.now(),
    };

    const { data: savedRow, error } = await supabase
      .from("spending_planned_items")
      .insert([mapPlannedClientToRow(planned, user.id)])
      .select()
      .single();

    if (error) throw error;

    const savedPlanned = mapPlannedRowToClient(savedRow);

    await upsertCalendarEventForPlanned(
      savedPlanned,
      user.id,
      categoriesById.get(savedPlanned.categoryId) || null
    );

    setComposerOpen(false);
    setStatus("Planned item saved.");
    await loadAll({ kind: "planned", id: savedPlanned.id });
  }

  async function savePlannedUpdate() {
    if (!user || !composerDraft.id) throw new Error("Missing planned item.");

    const amount = parseMoneyInput(composerDraft.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Enter a valid planned amount.");
    }

    const planned = {
      id: composerDraft.id,
      amount: roundMoneyValue(amount),
      categoryId: composerDraft.categoryId || null,
      date: composerDraft.date || todayISO(),
      time: composerDraft.time || "",
      merchant: composerDraft.merchant.trim(),
      note: composerDraft.note.trim(),
    };

    const { data: savedRow, error } = await supabase
      .from("spending_planned_items")
      .update(mapPlannedClientToRow(planned, user.id))
      .eq("id", planned.id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) throw error;

    const savedPlanned = mapPlannedRowToClient(savedRow);

    await upsertCalendarEventForPlanned(
      savedPlanned,
      user.id,
      categoriesById.get(savedPlanned.categoryId) || null
    );

    setComposerOpen(false);
    setStatus("Planned item updated.");
    await loadAll({ kind: "planned", id: savedPlanned.id });
  }

  async function saveComposer() {
    setSaving(true);
    setPageError("");

    try {
      if (composerKind === "create_tx") await saveTransactionCreate();
      if (composerKind === "edit_tx") await saveTransactionUpdate();
      if (composerKind === "create_planned") await savePlannedCreate();
      if (composerKind === "edit_planned") await savePlannedUpdate();
    } catch (err) {
      setPageError(err?.message || "Failed to save entry.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTransaction(txId) {
    if (!user || !txId) return;
    const tx = transactions.find((entry) => entry.id === txId);
    if (!tx) return;
    if (!window.confirm("Delete this transaction?")) return;

    setSaving(true);
    setPageError("");

    try {
      await applyLedgerForTransaction({
        userId: user.id,
        tx,
        accounts,
        reverse: true,
        sourceIdOverride: `${tx.id}_delete_reverse`,
      });

      const { error } = await supabase
        .from("spending_transactions")
        .delete()
        .eq("id", txId)
        .eq("user_id", user.id);

      if (error) throw error;

      await deleteCalendarEventBySource(
        user.id,
        tx.type === "income" ? "income" : "spending",
        txId
      );

      setStatus("Transaction deleted.");
      await loadAll();
    } catch (err) {
      setPageError(err?.message || "Failed to delete transaction.");
    } finally {
      setSaving(false);
    }
  }

  async function convertPlanned(planned) {
    if (!user || !planned) return;
    const account = accounts[0];
    if (!account) {
      setPageError("Add an account first.");
      return;
    }

    setSaving(true);
    setPageError("");

    try {
      const tx = {
        id: uid(),
        type: "expense",
        amount: roundMoneyValue(planned.amount),
        categoryId: planned.categoryId || null,
        date: planned.date || todayISO(),
        time: planned.time || "",
        merchant: planned.merchant || "",
        note: planned.note || "",
        paymentMethod: "Card",
        account: account.name,
        accountId: account.id,
        accountName: account.name,
        transferAccountId: "",
        transferAccountName: "",
        createdAt: Date.now(),
      };

      const savedTx = await createSyncedTransaction(tx);

      const { error: deleteError } = await supabase
        .from("spending_planned_items")
        .delete()
        .eq("id", planned.id)
        .eq("user_id", user.id);

      if (deleteError) throw deleteError;

      await deleteCalendarEventBySource(user.id, "planned_expense", planned.id);

      setStatus("Planned item converted to transaction.");
      await loadAll({ kind: "tx", id: savedTx.id });
    } catch (err) {
      setPageError(err?.message || "Failed to convert planned item.");
    } finally {
      setSaving(false);
    }
  }

  async function deletePlanned(plannedId) {
    if (!user || !plannedId) return;
    if (!window.confirm("Delete this planned item?")) return;

    setSaving(true);
    setPageError("");

    try {
      const { error } = await supabase
        .from("spending_planned_items")
        .delete()
        .eq("id", plannedId)
        .eq("user_id", user.id);

      if (error) throw error;

      await deleteCalendarEventBySource(user.id, "planned_expense", plannedId);
      setStatus("Planned item deleted.");
      await loadAll();
    } catch (err) {
      setPageError(err?.message || "Failed to delete planned item.");
    } finally {
      setSaving(false);
    }
  }

  async function saveBudgetValue() {
    if (!user || !budgetEditorCategoryId) return;

    const amount = parseMoneyInput(budgetEditorValue);
    if (!Number.isFinite(amount) || amount < 0) {
      setPageError("Enter a valid budget amount.");
      return;
    }

    setSaving(true);
    setPageError("");

    try {
      const payload = {
        user_id: user.id,
        category_id: budgetEditorCategoryId,
        period_mode: range.budgetMode,
        amount: roundMoneyValue(amount),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("spending_budgets")
        .upsert([payload], { onConflict: "user_id,category_id,period_mode" });

      if (error) throw error;

      setBudgetEditorValue("");
      setStatus("Budget saved.");
      await loadAll();
    } catch (err) {
      setPageError(err?.message || "Failed to save budget.");
    } finally {
      setSaving(false);
    }
  }

  async function saveCategory() {
    if (!user) return;

    const name = String(newCategoryName || "").trim();
    const group = String(newCategoryGroup || "Other").trim() || "Other";

    if (!name) {
      setPageError("Category name required.");
      return;
    }

    setSaving(true);
    setPageError("");

    try {
      const category = {
        id: uid(),
        name,
        group,
        color: "#94a3b8",
        isBudgeted: true,
      };

      const { error } = await supabase
        .from("spending_categories")
        .upsert([mapCategoryClientToRow(category, user.id)]);

      if (error) throw error;

      setNewCategoryName("");
      setNewCategoryGroup("Other");
      setStatus("Category added.");
      await loadAll();
    } catch (err) {
      setPageError(err?.message || "Failed to save category.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className={styles.loadingState}>Loading spending…</main>;
  if (!user) return <main className={styles.loadingState}>Sign in to use spending.</main>;

  return (
    <main className={styles.page}>
      <TopStrip
        totals={totals}
        expenseTrend={expenseTrend}
        forecastRemaining={forecastRemaining}
        totalsByCategory={totalsByCategory}
        period={period}
        setPeriod={setPeriod}
        search={search}
        setSearch={setSearch}
        mode={workspaceMode}
        setMode={setWorkspaceMode}
        onOpenComposer={openCreateTransaction}
        onOpenControls={() => setControlsOpen(true)}
      />

      <div className={styles.workspace}>
        <section className={styles.workspaceFeed}>
          <FeedPane
            transactions={filteredTransactions}
            plannedItems={filteredPlanned}
            selectedRecord={selectedRecord}
            onSelect={setSelectedRecord}
          />
        </section>

        <section className={styles.workspaceMain}>
          <MainWorkspacePane
            mode={workspaceMode}
            totals={totals}
            notifications={notifications}
            topMerchants={topMerchants}
            totalsByCategory={totalsByCategory}
            selectedTx={selectedTx}
            selectedPlanned={selectedPlanned}
            selectedBudgetRow={selectedBudgetRow}
            categoriesById={categoriesById}
            merchantStats={merchantStats}
            betterBuyIdeas={betterBuyIdeas}
            queuedIdeas={queuedIdeas}
            onQueueIdea={queueIdea}
            onOpenComposer={openCreateTransaction}
            onOpenControls={() => setControlsOpen(true)}
            onEditTransaction={() => selectedTx && openEditTransaction(selectedTx)}
            onDuplicateTransaction={() => selectedTx && duplicateTransaction(selectedTx)}
            onDeleteTransaction={() => selectedTx && deleteTransaction(selectedTx.id)}
            onEditPlanned={() => selectedPlanned && openEditPlanned(selectedPlanned)}
            onConvertPlanned={() => selectedPlanned && convertPlanned(selectedPlanned)}
            onDeletePlanned={() => selectedPlanned && deletePlanned(selectedPlanned.id)}
          />
        </section>
      </div>

      <QuickEntryModal
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        saving={saving}
        composerKind={composerKind}
        draft={composerDraft}
        setDraft={setComposerDraft}
        categories={categories}
        accounts={accounts}
        onSave={saveComposer}
      />

      <ControlModal
        open={controlsOpen}
        onClose={() => setControlsOpen(false)}
        saving={saving}
        totalsByCategory={totalsByCategory}
        budgetEditorCategoryId={budgetEditorCategoryId}
        setBudgetEditorCategoryId={setBudgetEditorCategoryId}
        budgetEditorValue={budgetEditorValue}
        setBudgetEditorValue={setBudgetEditorValue}
        budgetMode={range.budgetMode}
        onSaveBudgetValue={saveBudgetValue}
        newCategoryName={newCategoryName}
        setNewCategoryName={setNewCategoryName}
        newCategoryGroup={newCategoryGroup}
        setNewCategoryGroup={setNewCategoryGroup}
        groups={groups}
        onSaveCategory={saveCategory}
        subscriptionCandidates={subscriptionCandidates}
      />

      <ToastStack status={status} pageError={pageError} onClearError={() => setPageError("")} />
    </main>
  );
}

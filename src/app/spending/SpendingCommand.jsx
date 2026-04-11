"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  DEFAULT_BUDGETS,
  DEFAULT_CATEGORIES,
  applyLedgerForTransaction,
  buildLedgerMap,
  buildTopMerchants,
  budgetStatus,
  deleteCalendarEventBySource,
  emptySelection,
  getPreviousRange,
  hydrateReceiptUrls,
  inRange,
  mapAccountRowToClient,
  mapCategoryClientToRow,
  mapCategoryRowToClient,
  mapPlannedClientToRow,
  mapPlannedRowToClient,
  mapTransactionClientToRow,
  mapTransactionRowToClient,
  money,
  autoClassifyReceiptItem,
  autoCoachFlag,
  autoPriceSignal,
  shouldIgnoreReceiptItemName,
  parseMoneyInput,
  periodBounds,
  roundMoneyValue,
  sanitizeUploadFileName,
  sumExpenses,
  todayISO,
  topCategoryGroups,
  trendMeta,
  uid,
  upsertCalendarEventForPlanned,
  upsertCalendarEventForTransaction,
} from "./spending.helpers";
import {
  FeedPane,
  MainWorkspacePane,
  ManageSheet,
  QuickAddModal,
  ReceiptDraftModal,
  ReceiptViewerModal,
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
    forecastNet: roundMoneyValue(income - expense - plannedExpense),
  };
}

function emptyReceiptLine() {
  return {
    id: uid(),
    itemName: "",
    quantity: "1",
    unitPrice: "",
    lineTotal: 0,
    classification: "review",
    note: "",
  };
}

function toSignedNumber(value, fallback = 0) {
  const raw = parseMoneyInput(value);
  if (!Number.isFinite(raw)) return fallback;
  return raw;
}

function toPositiveNumber(value, fallback = 0) {
  const raw = parseMoneyInput(value);
  if (!Number.isFinite(raw) || raw < 0) return fallback;
  return raw;
}

function toQuantity(value) {
  const raw = Number(String(value ?? "").replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  return raw;
}

function computeLineTotal(item) {
  const explicit = parseMoneyInput(item?.lineTotal);
  if (Number.isFinite(explicit)) return roundMoneyValue(explicit);
  return roundMoneyValue(toQuantity(item?.quantity) * toSignedNumber(item?.unitPrice, 0));
}

function normalizeReceiptLine(line = {}) {
  const itemName = String(line.itemName || "");
  const quantity = String(line.quantity ?? "1");
  const unitPrice = String(line.unitPrice ?? "");
  const lineTotal = computeLineTotal({ ...line, itemName, quantity, unitPrice });
  const classification =
    ["need", "want", "waste", "review"].includes(line.classification)
      ? line.classification
      : autoClassifyReceiptItem({
          itemName,
          merchantName: line.merchantName || "",
          lineTotal,
        });
  const priceSignal =
    ["good", "fair", "high", "neutral"].includes(line.priceSignal)
      ? line.priceSignal
      : autoPriceSignal({
          itemName,
          merchantName: line.merchantName || "",
          unitPrice,
          lineTotal,
        });
  const coachFlag =
    ["good-price", "watch", "overspent", "stop", "normal"].includes(line.coachFlag)
      ? line.coachFlag
      : autoCoachFlag({ classification, priceSignal, lineTotal });

  return {
    id: line.id || uid(),
    itemName,
    quantity,
    unitPrice,
    lineTotal,
    classification,
    priceSignal,
    coachFlag,
    includeInMath: line.includeInMath !== false,
    note: String(line.note || ""),
  };
}

function buildReceiptDraft(seed = null, categories = [], accounts = []) {
  return {
    id: uid(),
    file: null,
    previewUrl: "",
    fileName: "",
    merchant: seed?.merchant || "",
    date: seed?.date || todayISO(),
    time: seed?.time || "",
    accountId: seed?.accountId || accounts[0]?.id || "",
    categoryId: seed?.categoryId || categories[0]?.id || "",
    paymentMethod: seed?.paymentMethod || "Card",
    note: seed?.note || "",
    tax: "",
    ocrSubtotal: null,
    ocrTotal: null,
    ocrDiscount: null,
    items: [emptyReceiptLine()],
  };
}

function computeReceiptDraftSummary(draft) {
  const items = Array.isArray(draft?.items) ? draft.items.map(normalizeReceiptLine) : [];
  const mathItems = items.filter((line) => line.includeInMath !== false);
  const subtotalFromItems = roundMoneyValue(
    mathItems.reduce((sum, line) => sum + (Number(line.lineTotal) || 0), 0)
  );
  const subtotal =
    Number.isFinite(Number(draft?.ocrSubtotal)) ? roundMoneyValue(Number(draft.ocrSubtotal)) : subtotalFromItems;
  const tax =
    Number.isFinite(Number(draft?.tax)) ? roundMoneyValue(Number(draft.tax)) : 0;
  const total =
    Number.isFinite(Number(draft?.ocrTotal)) ? roundMoneyValue(Number(draft.ocrTotal)) : roundMoneyValue(subtotal + tax);
  const buckets = { need: 0, want: 0, waste: 0, review: 0, overspent: 0, goodPrice: 0 };

  mathItems.forEach((line) => {
    const key = ["need", "want", "waste", "review"].includes(line.classification)
      ? line.classification
      : "review";
    const amount = Math.max(0, Number(line.lineTotal) || 0);
    buckets[key] = roundMoneyValue(buckets[key] + amount);
    if (line.coachFlag === "overspent") {
      buckets.overspent = roundMoneyValue(buckets.overspent + amount);
    }
    if (line.coachFlag === "good-price") {
      buckets.goodPrice = roundMoneyValue(buckets.goodPrice + amount);
    }
  });

  return {
    count: items.filter((line) => line.itemName.trim() || Number(line.lineTotal) !== 0).length,
    subtotal,
    tax,
    total,
    discount: Number.isFinite(Number(draft?.ocrDiscount)) ? roundMoneyValue(Number(draft.ocrDiscount)) : 0,
    ...buckets,
  };
}

function mapReceiptItemRowToClient(row) {
  return {
    id: row.id,
    receiptId: row.receipt_id,
    userId: row.user_id,
    lineIndex: Number(row.line_index) || 0,
    itemName: row.item_name || "",
    rawText: row.raw_text || "",
    quantity: Number(row.quantity) || 1,
    unitPrice: row.unit_price != null ? Number(row.unit_price) : 0,
    lineTotal: Number(row.line_total) || 0,
    classification: row.classification || "review",
    priceSignal: row.price_signal || "neutral",
    coachFlag: row.coach_flag || "normal",
    classificationConfidence:
      row.classification_confidence != null ? Number(row.classification_confidence) : null,
    categoryHint: row.category_hint || "",
    merchantRuleHit: row.merchant_rule_hit || "",
    note: row.note || "",
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

export default function SpendingCommand() {
  const [user, setUser] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [pageError, setPageError] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const [period, setPeriod] = React.useState("month");
  const [search, setSearch] = React.useState("");
  const [groupFilter, setGroupFilter] = React.useState("All");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [selectedRecord, setSelectedRecord] = React.useState(emptySelection());
  const [workspaceMode, setWorkspaceMode] = React.useState("dashboard");

  const [categories, setCategories] = React.useState(DEFAULT_CATEGORIES);
  const [budgets, setBudgets] = React.useState(DEFAULT_BUDGETS);
  const [accounts, setAccounts] = React.useState([]);
  const [transactions, setTransactions] = React.useState([]);
  const [plannedItems, setPlannedItems] = React.useState([]);
  const [receipts, setReceipts] = React.useState([]);
  const [receiptItems, setReceiptItems] = React.useState([]);
  const [receiptFeatureReady, setReceiptFeatureReady] = React.useState(true);
  const [receiptDraft, setReceiptDraft] = React.useState(null);
  const [receiptViewerOpen, setReceiptViewerOpen] = React.useState(false);
  const [ocrRunning, setOcrRunning] = React.useState(false);
  const [ocrError, setOcrError] = React.useState("");
  const [ocrMeta, setOcrMeta] = React.useState(null);

  const [composerOpen, setComposerOpen] = React.useState(false);
  const [controlsOpen, setControlsOpen] = React.useState(false);

  const [mode, setMode] = React.useState("now");
  const [qaType, setQaType] = React.useState("expense");
  const [qaAmount, setQaAmount] = React.useState("");
  const [qaDate, setQaDate] = React.useState(todayISO());
  const [qaTime, setQaTime] = React.useState("");
  const [qaCategoryId, setQaCategoryId] = React.useState("groceries");
  const [qaMerchant, setQaMerchant] = React.useState("");
  const [qaNote, setQaNote] = React.useState("");
  const [qaPayment, setQaPayment] = React.useState("Card");
  const [qaAccountId, setQaAccountId] = React.useState("");
  const [qaTransferToAccountId, setQaTransferToAccountId] = React.useState("");
  const [convertAccountId, setConvertAccountId] = React.useState("");

  const [newCategoryName, setNewCategoryName] = React.useState("");
  const [newCategoryGroup, setNewCategoryGroup] = React.useState("Other");
  const [budgetEditorCategoryId, setBudgetEditorCategoryId] = React.useState("");
  const [budgetEditorValue, setBudgetEditorValue] = React.useState("");

  const range = React.useMemo(() => periodBounds(period), [period]);

  const categoriesById = React.useMemo(() => {
    const map = new Map();
    categories.forEach((category) => map.set(category.id, category));
    return map;
  }, [categories]);

  const groups = React.useMemo(() => topCategoryGroups(categories), [categories]);

  const clearQuickAdd = React.useCallback(() => {
    setQaAmount("");
    setQaDate(todayISO());
    setQaTime("");
    setQaMerchant("");
    setQaNote("");
    setQaPayment("Card");
    setQaType("expense");
    setQaCategoryId(categories[0]?.id || "groceries");
    setQaAccountId(accounts[0]?.id || "");
    setQaTransferToAccountId(
      accounts.find((account) => account.id !== (accounts[0]?.id || ""))?.id || ""
    );
    setMode("now");
  }, [accounts, categories]);

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
          setReceipts([]);
          setReceiptItems([]);
          setReceiptFeatureReady(true);
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

        let loadedReceipts = [];
        let loadedReceiptItems = [];
        let nextReceiptFeatureReady = true;

        try {
          const [receiptRowsRes, receiptItemsRes] = await Promise.all([
            supabase
              .from("spending_receipts")
              .select("*")
              .eq("user_id", currentUser.id)
              .order("captured_at", { ascending: false })
              .order("created_at", { ascending: false }),
            supabase
              .from("spending_receipt_items")
              .select("*")
              .eq("user_id", currentUser.id)
              .order("created_at", { ascending: false }),
          ]);

          if (receiptRowsRes.error) throw receiptRowsRes.error;
          if (receiptItemsRes.error) throw receiptItemsRes.error;

          loadedReceipts = await hydrateReceiptUrls(receiptRowsRes.data || []);
          loadedReceiptItems = (receiptItemsRes.data || []).map(mapReceiptItemRowToClient);
        } catch (receiptErr) {
          const msg = String(receiptErr?.message || "");
          const code = String(receiptErr?.code || "");

          if (
            code === "42P01" ||
            msg.includes("spending_receipts") ||
            msg.includes("spending_receipt_items") ||
            msg.includes("relation") ||
            msg.includes("does not exist")
          ) {
            nextReceiptFeatureReady = false;
            loadedReceipts = [];
            loadedReceiptItems = [];
          } else {
            throw receiptErr;
          }
        }

        setCategories(loadedCategories);
        setBudgets(nextBudgets);
        setAccounts(loadedAccounts);
        setTransactions(loadedTransactions);
        setPlannedItems(loadedPlanned);
        setReceipts(loadedReceipts);
        setReceiptItems(loadedReceiptItems);
        setReceiptFeatureReady(nextReceiptFeatureReady);

        const resolvedCategoryId =
          loadedCategories.some((category) => category.id === qaCategoryId)
            ? qaCategoryId
            : loadedCategories[0]?.id || "groceries";

        const firstAccountId = loadedAccounts[0]?.id || "";
        const resolvedAccountId =
          loadedAccounts.some((account) => account.id === qaAccountId)
            ? qaAccountId
            : firstAccountId;

        setQaCategoryId(resolvedCategoryId);
        setQaAccountId(resolvedAccountId);
        setQaTransferToAccountId((prev) => {
          const stillGood =
            prev &&
            loadedAccounts.some((account) => account.id === prev) &&
            prev !== resolvedAccountId;

          if (stillGood) return prev;
          return loadedAccounts.find((account) => account.id !== resolvedAccountId)?.id || "";
        });

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
    [qaAccountId, qaCategoryId]
  );

  React.useEffect(() => {
    loadAll();
  }, [loadAll]);

  React.useEffect(() => {
    if (!status) return;
    const id = setTimeout(() => setStatus(""), 3200);
    return () => clearTimeout(id);
  }, [status]);

  React.useEffect(() => {
    if (!categories.length) return;
    if (categories.some((category) => category.id === qaCategoryId)) return;
    setQaCategoryId(categories[0].id);
  }, [categories, qaCategoryId]);

  React.useEffect(() => {
    if (!accounts.length) {
      setQaAccountId("");
      return;
    }
    setQaAccountId((prev) =>
      accounts.some((account) => account.id === prev) ? prev : accounts[0].id
    );
  }, [accounts]);

  React.useEffect(() => {
    if (accounts.length < 2) {
      setQaTransferToAccountId("");
      return;
    }
    setQaTransferToAccountId((prev) => {
      if (prev && accounts.some((account) => account.id === prev) && prev !== qaAccountId) {
        return prev;
      }
      return accounts.find((account) => account.id !== qaAccountId)?.id || "";
    });
  }, [accounts, qaAccountId]);

  React.useEffect(() => {
    if (!accounts.length) {
      setConvertAccountId("");
      return;
    }
    setConvertAccountId((prev) =>
      accounts.some((account) => account.id === prev) ? prev : accounts[0].id
    );
  }, [accounts]);

  React.useEffect(() => {
    return () => {
      if (receiptDraft?.previewUrl) {
        URL.revokeObjectURL(receiptDraft.previewUrl);
      }
    };
  }, [receiptDraft?.previewUrl]);

  const filteredTransactions = React.useMemo(() => {
    const q = search.trim().toLowerCase();

    return transactions
      .filter((tx) => inRange(tx.date, range.start, range.end))
      .filter((tx) => (typeFilter === "all" ? true : tx.type === typeFilter))
      .filter((tx) => (categoryFilter === "all" ? true : tx.categoryId === categoryFilter))
      .filter((tx) => {
        const groupName = categoriesById.get(tx.categoryId)?.group || "Other";
        return groupFilter === "All" ? true : groupName === groupFilter;
      })
      .filter((tx) => {
        if (!q) return true;
        const categoryName = categoriesById.get(tx.categoryId)?.name || "";
        return `${tx.merchant} ${tx.note} ${tx.date} ${tx.time} ${categoryName} ${tx.amount} ${tx.paymentMethod} ${tx.account}`
          .toLowerCase()
          .includes(q);
      });
  }, [transactions, range, typeFilter, categoryFilter, groupFilter, search, categoriesById]);


  const enrichedTransactions = React.useMemo(
    () =>
      filteredTransactions.map((tx) => ({
        ...tx,
        categoryName: categoriesById.get(tx.categoryId)?.name || "",
      })),
    [filteredTransactions, categoriesById]
  );

  const filteredPlanned = React.useMemo(() => {
    const q = search.trim().toLowerCase();

    return plannedItems
      .filter((planned) => inRange(planned.date, range.start, range.end))
      .filter((planned) => (categoryFilter === "all" ? true : planned.categoryId === categoryFilter))
      .filter((planned) => {
        const groupName = categoriesById.get(planned.categoryId)?.group || "Other";
        return groupFilter === "All" ? true : groupName === groupFilter;
      })
      .filter((planned) => {
        if (!q) return true;
        const categoryName = categoriesById.get(planned.categoryId)?.name || "";
        return `${planned.merchant} ${planned.note} ${planned.date} ${planned.time} ${categoryName} ${planned.amount}`
          .toLowerCase()
          .includes(q);
      });
  }, [plannedItems, range, categoryFilter, groupFilter, search, categoriesById]);

  const previousRange = React.useMemo(() => getPreviousRange(period, range), [period, range]);
  const previousTransactions = React.useMemo(
    () => transactions.filter((tx) => inRange(tx.date, previousRange.start, previousRange.end)),
    [transactions, previousRange]
  );

  const totals = React.useMemo(
    () => computeTotals(filteredTransactions, filteredPlanned),
    [filteredTransactions, filteredPlanned]
  );
  const previousExpense = React.useMemo(() => sumExpenses(previousTransactions), [previousTransactions]);
  const expenseTrend = React.useMemo(
    () => trendMeta(totals.expense, previousExpense),
    [totals.expense, previousExpense]
  );
  const topMerchants = React.useMemo(
    () => buildTopMerchants(filteredTransactions),
    [filteredTransactions]
  );

  const receiptsByTransaction = React.useMemo(() => {
    const map = new Map();
    receipts.forEach((receipt) => {
      const key = String(receipt.transactionId || "");
      if (!key) return;
      const list = map.get(key) || [];
      list.push(receipt);
      map.set(key, list);
    });
    return map;
  }, [receipts]);

  const receiptItemsByReceiptId = React.useMemo(() => {
    const map = new Map();
    receiptItems.forEach((item) => {
      const key = String(item.receiptId || "");
      if (!key) return;
      const list = map.get(key) || [];
      list.push(item);
      map.set(key, list);
    });
    return map;
  }, [receiptItems]);

  const receiptCountsByTransaction = React.useMemo(() => {
    const map = new Map();
    receiptsByTransaction.forEach((list, key) => map.set(key, list.length));
    return map;
  }, [receiptsByTransaction]);

  const plannedByCategory = React.useMemo(() => {
    const map = new Map();
    filteredPlanned.forEach((planned) => {
      map.set(
        planned.categoryId || "uncat",
        roundMoneyValue((map.get(planned.categoryId || "uncat") || 0) + roundMoneyValue(planned.amount))
      );
    });
    return map;
  }, [filteredPlanned]);

  const totalsByCategory = React.useMemo(
    () =>
      categories
        .map((category) => {
          const spent = roundMoneyValue(
            filteredTransactions
              .filter((tx) => tx.type === "expense" && tx.categoryId === category.id)
              .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0)
          );

          const planned = roundMoneyValue(plannedByCategory.get(category.id) || 0);
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
            pct: budget > 0 ? Math.max(0, Math.min((forecast / budget) * 100, 100)) : 0,
          };
        })
        .sort((a, b) => b.forecast - a.forecast),
    [categories, filteredTransactions, plannedByCategory, budgets, range.budgetMode]
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

  const selectedCategory = React.useMemo(() => {
    const categoryId =
      selectedTx?.categoryId ||
      selectedPlanned?.categoryId ||
      receiptDraft?.categoryId ||
      budgetEditorCategoryId ||
      categories[0]?.id ||
      "";

    return categories.find((category) => category.id === categoryId) || null;
  }, [selectedTx, selectedPlanned, receiptDraft?.categoryId, budgetEditorCategoryId, categories]);

  const selectedBudget = React.useMemo(
    () => (selectedCategory ? Number(budgets?.[range.budgetMode]?.[selectedCategory.id] || 0) : 0),
    [selectedCategory, budgets, range.budgetMode]
  );

  const selectedSpent = React.useMemo(() => {
    if (!selectedCategory) return 0;
    const row = totalsByCategory.find((item) => item.categoryId === selectedCategory.id);
    return Number(row?.spent || 0);
  }, [selectedCategory, totalsByCategory]);

  const selectedPlannedTotal = React.useMemo(
    () => (selectedCategory ? Number(plannedByCategory.get(selectedCategory.id) || 0) : 0),
    [selectedCategory, plannedByCategory]
  );

  const selectedReceipts = React.useMemo(
    () => (selectedTx ? receiptsByTransaction.get(String(selectedTx.id)) || [] : []),
    [receiptsByTransaction, selectedTx]
  );

  const selectedReceiptItemsByReceiptId = React.useMemo(() => {
    const map = new Map();
    selectedReceipts.forEach((receipt) => {
      map.set(receipt.id, receiptItemsByReceiptId.get(receipt.id) || []);
    });
    return map;
  }, [selectedReceipts, receiptItemsByReceiptId]);

  const selectedForecast = roundMoneyValue(selectedSpent + selectedPlannedTotal);
  const selectedLoadPct = selectedBudget > 0 ? (selectedForecast / selectedBudget) * 100 : 0;

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
          body: overBy > 0 ? `${money(overBy)} over in the current ${range.label.toLowerCase()} view.` : "Category pressure is above target.",
        });
      });

    if (selectedTx && !selectedReceipts.length) {
      items.push({
        id: `receipt-${selectedTx.id}`,
        tone: "amber",
        target: "receipt",
        title: "Selected transaction has no receipt",
        body: `${selectedTx.merchant || selectedTx.note || "This transaction"} is missing receipt detail.`,
      });
    }

    if (totals.plannedExpense > 0) {
      items.push({
        id: "planned-pressure",
        tone: "blue",
        target: "dashboard",
        title: "Planned spending is active",
        body: `${money(totals.plannedExpense)} in planned pressure is still sitting ahead.`,
      });
    }

    if (!items.length) {
      items.push({
        id: "all-clear",
        tone: "green",
        target: "dashboard",
        title: "No hard alerts right now",
        body: "Visible spending is stable in the current view.",
      });
    }

    return items.slice(0, 6);
  }, [totalsByCategory, selectedTx, selectedReceipts, totals.plannedExpense, range.label]);


  function resetOcrState() {
    setOcrRunning(false);
    setOcrError("");
    setOcrMeta(null);
  }

  function applyOcrToDraft(baseDraft, ocrPayload) {
    if (!baseDraft || !ocrPayload) return baseDraft;

    const normalizedItems = Array.isArray(ocrPayload.items)
      ? ocrPayload.items
          .map((item) => {
            const rawName = item.itemName || item.rawText || "";
            if (shouldIgnoreReceiptItemName(rawName)) return null;
            const parsed = normalizeReceiptLine({
              id: uid(),
              itemName: rawName,
              quantity: item.quantity != null ? String(item.quantity) : "1",
              unitPrice: item.unitPrice != null ? String(item.unitPrice) : "",
              lineTotal: item.lineTotal != null ? String(item.lineTotal) : "",
              merchantName: ocrPayload.merchant || baseDraft.merchant,
              classification: item.classification,
              priceSignal: item.priceSignal,
              coachFlag: item.coachFlag,
              note: item.note || "",
              includeInMath: item.includeInMath !== false,
            });
            return parsed;
          })
          .filter(Boolean)
      : [];

    const ocrTax =
      ocrPayload.tax != null && Number.isFinite(Number(ocrPayload.tax))
        ? roundMoneyValue(Number(ocrPayload.tax))
        : baseDraft.tax;

    const explicitSubtotal =
      ocrPayload.subtotal != null && Number.isFinite(Number(ocrPayload.subtotal))
        ? roundMoneyValue(Number(ocrPayload.subtotal))
        : null;

    const explicitTotal =
      ocrPayload.total != null && Number.isFinite(Number(ocrPayload.total))
        ? roundMoneyValue(Number(ocrPayload.total))
        : null;

    const explicitDiscount =
      ocrPayload.discount != null && Number.isFinite(Number(ocrPayload.discount))
        ? roundMoneyValue(Number(ocrPayload.discount))
        : null;

    return {
      ...baseDraft,
      merchant: ocrPayload.merchant || baseDraft.merchant,
      date: ocrPayload.date || baseDraft.date,
      tax: ocrTax != null ? String(ocrTax) : baseDraft.tax,
      ocrSubtotal: explicitSubtotal,
      ocrTotal: explicitTotal,
      ocrDiscount: explicitDiscount,
      items: normalizedItems.length ? normalizedItems : baseDraft.items,
    };
  }

  async function runReceiptOcr(file) {
    if (!file) return;

    setOcrRunning(true);
    setOcrError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/receipt-ocr", {
        method: "POST",
        body: formData,
      });

      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(payload?.error || "Receipt OCR failed.");
      }

      setReceiptDraft((prev) => {
        const base = prev || buildReceiptDraft(selectedTx || null, categories, accounts);
        return applyOcrToDraft(base, payload);
      });

      setOcrMeta(payload?.ocr || null);
      setStatus(payload?.items?.length ? "Receipt scanned and items extracted." : "Receipt scanned.");
    } catch (err) {
      setOcrError(err?.message || "Receipt OCR failed.");
    } finally {
      setOcrRunning(false);
    }
  }

  async function rerunReceiptOcr() {
    if (!receiptDraft?.file) return;
    await runReceiptOcr(receiptDraft.file);
  }

  function openComposerBlank() {
    clearQuickAdd();
    setComposerOpen(true);
  }

  function startReceiptDraft(seedTx = null) {
    setReceiptViewerOpen(false);
    resetOcrState();
    setReceiptDraft(buildReceiptDraft(seedTx, categories, accounts));
  }

  function clearReceiptDraft() {
    if (receiptDraft?.previewUrl) {
      URL.revokeObjectURL(receiptDraft.previewUrl);
    }
    resetOcrState();
    setReceiptDraft(null);
  }

  function changeReceiptDraft(field, value) {
    setReceiptDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  async function chooseReceiptFile(file) {
    if (!file) return;

    resetOcrState();

    setReceiptDraft((prev) => {
      const base = prev || buildReceiptDraft(selectedTx || null, categories, accounts);
      if (base.previewUrl) {
        URL.revokeObjectURL(base.previewUrl);
      }
      return {
        ...base,
        file,
        fileName: file.name,
        previewUrl: URL.createObjectURL(file),
      };
    });

    await runReceiptOcr(file);
  }

  function addReceiptDraftLine() {
    setReceiptDraft((prev) =>
      prev ? { ...prev, items: [...prev.items, emptyReceiptLine()] } : prev
    );
  }

  function updateReceiptDraftLine(lineId, patch) {
    setReceiptDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((line) =>
          line.id === lineId ? normalizeReceiptLine({ ...line, ...patch, merchantName: receiptDraft?.merchant || "" }) : line
        ),
      };
    });
  }

  function removeReceiptDraftLine(lineId) {
    setReceiptDraft((prev) => {
      if (!prev) return prev;
      const nextItems = prev.items.filter((line) => line.id !== lineId);
      return { ...prev, items: nextItems.length ? nextItems : [emptyReceiptLine()] };
    });
  }

  async function rollbackInsertedTransaction(txId) {
    if (!user || !txId) return;
    try {
      await supabase.from("spending_transactions").delete().eq("id", txId).eq("user_id", user.id);
    } catch {
      // best effort cleanup only
    }
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

    try {
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
    } catch (syncErr) {
      await rollbackInsertedTransaction(savedTx.id);

      try {
        await deleteCalendarEventBySource(
          user.id,
          savedTx.type === "income" ? "income" : "spending",
          savedTx.id
        );
      } catch {
        // cleanup only
      }

      throw new Error(syncErr?.message || "The transaction failed during account sync.");
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

  async function addNow() {
    if (!user) return;

    const amount = parseMoneyInput(qaAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPageError("Enter a valid amount.");
      return;
    }
    if (!qaAccountId) {
      setPageError("Choose an account.");
      return;
    }
    if (qaType === "transfer" && (!qaTransferToAccountId || qaTransferToAccountId === qaAccountId)) {
      setPageError("Choose a different transfer account.");
      return;
    }

    const sourceAccount = accounts.find((account) => account.id === qaAccountId) || null;
    const transferAccount = accounts.find((account) => account.id === qaTransferToAccountId) || null;

    const tx = {
      id: uid(),
      type: qaType,
      amount: roundMoneyValue(amount),
      categoryId: qaCategoryId || null,
      date: qaDate || todayISO(),
      time: qaTime || "",
      merchant: qaMerchant.trim(),
      note: qaNote.trim(),
      paymentMethod: qaPayment,
      account:
        qaType === "transfer"
          ? `${sourceAccount?.name || ""} → ${transferAccount?.name || ""}`
          : sourceAccount?.name || "",
      accountId: sourceAccount?.id || "",
      accountName: sourceAccount?.name || "",
      transferAccountId: transferAccount?.id || "",
      transferAccountName: transferAccount?.name || "",
      createdAt: Date.now(),
    };

    setSaving(true);
    setPageError("");

    try {
      const savedTx = await createSyncedTransaction(tx);
      clearQuickAdd();
      setComposerOpen(false);
      setStatus(
        `${qaType === "income" ? "Income" : qaType === "transfer" ? "Transfer" : "Expense"} posted.`
      );
      await loadAll({ kind: "tx", id: savedTx.id });
    } catch (err) {
      setPageError(err?.message || "Failed to add transaction.");
    } finally {
      setSaving(false);
    }
  }

  async function addPlanned() {
    if (!user) return;

    const amount = parseMoneyInput(qaAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPageError("Enter a valid planned amount.");
      return;
    }

    const planned = {
      id: uid(),
      amount: roundMoneyValue(amount),
      categoryId: qaCategoryId || null,
      date: qaDate || todayISO(),
      time: qaTime || "",
      merchant: qaMerchant.trim(),
      note: qaNote.trim(),
      createdAt: Date.now(),
    };

    setSaving(true);
    setPageError("");

    try {
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

      clearQuickAdd();
      setComposerOpen(false);
      setStatus("Planned item saved.");
      await loadAll({ kind: "planned", id: savedPlanned.id });
    } catch (err) {
      setPageError(err?.message || "Failed to save planned item.");
    } finally {
      setSaving(false);
    }
  }

  function duplicateTransaction(tx) {
    if (!tx) return;

    setQaType(tx.type || "expense");
    setQaAmount(String(tx.amount || ""));
    setQaDate(todayISO());
    setQaTime(tx.time || "");
    setQaCategoryId(tx.categoryId || categories[0]?.id || "");
    setQaMerchant(tx.merchant || "");
    setQaNote(tx.note || "");
    setQaPayment(tx.paymentMethod || "Card");
    setQaAccountId(tx.accountId || accounts[0]?.id || "");
    setQaTransferToAccountId(
      tx.transferAccountId ||
        accounts.find((account) => account.id !== (tx.accountId || accounts[0]?.id || ""))?.id ||
        ""
    );
    setMode("now");
    setComposerOpen(true);
    setStatus("Loaded row into quick add.");
  }

  async function deleteTransaction(txId) {
    if (!user || !txId) return;

    const tx = transactions.find((entry) => entry.id === txId);
    if (!tx) return;
    if (!window.confirm("Delete this transaction?")) return;

    setSaving(true);
    setPageError("");

    try {
      const reverseTx = {
        ...tx,
        id: `${tx.id}_delete_reverse`,
      };

      await applyLedgerForTransaction({
        userId: user.id,
        tx: reverseTx,
        accounts,
        reverse: true,
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
    if (!user || !planned || !convertAccountId) return;

    const account = accounts.find((entry) => entry.id === convertAccountId);
    if (!account) {
      setPageError("Choose an account for conversion.");
      return;
    }

    const tx = {
      id: uid(),
      type: "expense",
      amount: roundMoneyValue(planned.amount),
      categoryId: planned.categoryId || null,
      date: planned.date,
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

    setSaving(true);
    setPageError("");

    try {
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

  async function saveReceiptDraft() {
    if (!user || !receiptDraft) return;
    if (!receiptFeatureReady) {
      setPageError("Receipt storage is not ready yet.");
      return;
    }

    const account = accounts.find((entry) => entry.id === receiptDraft.accountId);
    if (!account) {
      setPageError("Choose an account for this receipt.");
      return;
    }
    if (!receiptDraft.file) {
      setPageError("Add a receipt image or PDF first.");
      return;
    }
    if (!String(receiptDraft.merchant || "").trim()) {
      setPageError("Merchant is required.");
      return;
    }

    const cleanedItems = receiptDraft.items
      .map(normalizeReceiptLine)
      .filter((line) => line.itemName.trim() || Number(line.lineTotal) > 0);

    if (!cleanedItems.length) {
      setPageError("Add at least one receipt line item.");
      return;
    }

    const summary = computeReceiptDraftSummary({
      ...receiptDraft,
      items: cleanedItems,
    });

    if (!(summary.total > 0)) {
      setPageError("Receipt total must be greater than zero.");
      return;
    }

    setSaving(true);
    setPageError("");

    try {
      const tx = {
        id: uid(),
        type: "expense",
        amount: roundMoneyValue(summary.total),
        categoryId: receiptDraft.categoryId || null,
        date: receiptDraft.date || todayISO(),
        time: receiptDraft.time || "",
        merchant: String(receiptDraft.merchant || "").trim(),
        note: String(receiptDraft.note || "").trim(),
        paymentMethod: receiptDraft.paymentMethod || "Card",
        account: account.name,
        accountId: account.id,
        accountName: account.name,
        transferAccountId: "",
        transferAccountName: "",
        createdAt: Date.now(),
      };

      const savedTx = await createSyncedTransaction(tx);

      let partialFailure = "";

      try {
        const bucket = "spending-receipts";
        const file = receiptDraft.file;
        const cleanName = sanitizeUploadFileName(file.name);
        const storagePath = `${user.id}/${savedTx.id}/${Date.now()}_${cleanName}`;

        const { error: uploadErr } = await supabase.storage
          .from(bucket)
          .upload(storagePath, file, {
            upsert: false,
            contentType: file.type || undefined,
          });

        if (uploadErr) throw uploadErr;

        const receiptPayload = {
          id: uid(),
          user_id: user.id,
          transaction_id: savedTx.id,
          file_name: file.name,
          mime_type: file.type || "application/octet-stream",
          file_size: file.size || 0,
          storage_bucket: bucket,
          storage_path: storagePath,
          receipt_status: summary.review > 0 ? "reviewed" : "posted",
          merchant_name: String(receiptDraft.merchant || "").trim(),
          receipt_total: roundMoneyValue(summary.total),
          subtotal: roundMoneyValue(summary.subtotal),
          tax_amount: roundMoneyValue(summary.tax),
          spent_needed_total: roundMoneyValue(summary.need),
          spent_wanted_total: roundMoneyValue(summary.want),
          spent_waste_total: roundMoneyValue(summary.waste),
          spent_review_total: roundMoneyValue(summary.review),
          note: String(receiptDraft.note || "").trim(),
          captured_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data: savedReceipt, error: receiptSaveErr } = await supabase
          .from("spending_receipts")
          .insert([receiptPayload])
          .select()
          .single();

        if (receiptSaveErr) throw receiptSaveErr;

        const itemsPayload = cleanedItems.map((item, index) => ({
          id: uid(),
          receipt_id: savedReceipt.id,
          user_id: user.id,
          line_index: index + 1,
          item_name: String(item.itemName || `Item ${index + 1}`).trim(),
          raw_text: String(item.itemName || "").trim(),
          quantity: toQuantity(item.quantity),
          unit_price: roundMoneyValue(toPositiveNumber(item.unitPrice, 0)),
          line_total: roundMoneyValue(item.lineTotal || 0),
          classification: item.classification || "review",
          price_signal: item.priceSignal || "neutral",
          coach_flag: item.coachFlag || "normal",
          classification_confidence: null,
          category_hint: categoriesById.get(receiptDraft.categoryId || "")?.name || null,
          merchant_rule_hit: null,
          note: String(item.note || "").trim(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));

        const { error: itemsErr } = await supabase
          .from("spending_receipt_items")
          .insert(itemsPayload);

        if (itemsErr) throw itemsErr;
      } catch (receiptErr) {
        partialFailure =
          receiptErr?.message || "Receipt detail failed to save after the transaction posted.";
      }

      clearReceiptDraft();
      setStatus(
        partialFailure
          ? "Transaction posted, but receipt detail failed."
          : "Receipt saved as transaction."
      );

      if (partialFailure) {
        setPageError(partialFailure);
      }

      await loadAll({ kind: "tx", id: savedTx.id });
      setWorkspaceMode("receipt");
    } catch (err) {
      setPageError(err?.message || "Failed to save receipt transaction.");
    } finally {
      setSaving(false);
    }
  }

  const receiptDraftSummary = React.useMemo(
    () => computeReceiptDraftSummary(receiptDraft),
    [receiptDraft]
  );

  if (loading) return <main className={styles.loadingState}>Loading spending…</main>;
  if (!user) return <main className={styles.loadingState}>Sign in to use spending.</main>;

  return (
    <main className={styles.page}>
      <TopStrip
        totals={totals}
        expenseTrend={expenseTrend}
        forecastRemaining={forecastRemaining}
        period={period}
        setPeriod={setPeriod}
        onOpenComposer={openComposerBlank}
        search={search}
        setSearch={setSearch}
        activePage={workspaceMode}
        setActivePage={setWorkspaceMode}
        notifications={notifications}
      />

      <div className={styles.workspace}>
        <section className={styles.workspaceFeed}>
          <FeedPane
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
            categoryFilter={categoryFilter}
            setCategoryFilter={setCategoryFilter}
            groupFilter={groupFilter}
            setGroupFilter={setGroupFilter}
            categories={categories}
            groups={groups}
            transactions={enrichedTransactions.slice(0, 80)}
            plannedItems={filteredPlanned.slice(0, 40)}
            receiptCountsByTransaction={receiptCountsByTransaction}
            selectedRecord={selectedRecord}
            onSelect={(next) => {
              setSelectedRecord(next);
              setReceiptViewerOpen(false);
            }}
          />
        </section>

        <section className={styles.workspaceMain}>
          <MainWorkspacePane
            mode={workspaceMode}
            setMode={setWorkspaceMode}
            selectedTx={selectedTx}
            selectedPlanned={selectedPlanned}
            categoriesById={categoriesById}
            visibleTransactions={enrichedTransactions}
            selectedCategory={selectedCategory}
            selectedBudget={selectedBudget}
            selectedSpent={selectedSpent}
            selectedPlannedTotal={selectedPlannedTotal}
            selectedForecast={selectedForecast}
            selectedLoadPct={selectedLoadPct}
            selectedReceipts={selectedReceipts}
            selectedReceiptItemsByReceiptId={selectedReceiptItemsByReceiptId}
            topMerchants={topMerchants}
            totals={totals}
            expenseTrend={expenseTrend}
            forecastRemaining={forecastRemaining}
            totalsByCategory={totalsByCategory}
            onStartReceiptDraft={startReceiptDraft}
            onOpenReceiptViewer={() => setReceiptViewerOpen(true)}
            onDuplicateTransaction={() => selectedTx && duplicateTransaction(selectedTx)}
            onDeleteTransaction={() => selectedTx && deleteTransaction(selectedTx.id)}
            onOpenComposer={openComposerBlank}
            onOpenControls={() => setControlsOpen(true)}
            onConvertPlanned={() => selectedPlanned && convertPlanned(selectedPlanned)}
            onDeletePlanned={() => selectedPlanned && deletePlanned(selectedPlanned.id)}
            convertAccountId={convertAccountId}
            setConvertAccountId={setConvertAccountId}
            accounts={accounts}
          />
        </section>
      </div>

      <QuickAddModal
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        mode={mode}
        setMode={setMode}
        qaType={qaType}
        setQaType={setQaType}
        qaAmount={qaAmount}
        setQaAmount={setQaAmount}
        qaDate={qaDate}
        setQaDate={setQaDate}
        qaTime={qaTime}
        setQaTime={setQaTime}
        qaCategoryId={qaCategoryId}
        setQaCategoryId={setQaCategoryId}
        qaMerchant={qaMerchant}
        setQaMerchant={setQaMerchant}
        qaNote={qaNote}
        setQaNote={setQaNote}
        qaPayment={qaPayment}
        setQaPayment={setQaPayment}
        qaAccountId={qaAccountId}
        setQaAccountId={setQaAccountId}
        qaTransferToAccountId={qaTransferToAccountId}
        setQaTransferToAccountId={setQaTransferToAccountId}
        accounts={accounts}
        categories={categories}
        saving={saving}
        onAddNow={addNow}
        onAddPlanned={addPlanned}
      />

      <ManageSheet
        open={controlsOpen}
        onClose={() => setControlsOpen(false)}
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
        saving={saving}
      />

      <ReceiptDraftModal
        open={Boolean(receiptDraft)}
        onClose={clearReceiptDraft}
        receiptDraft={receiptDraft}
        receiptDraftSummary={receiptDraftSummary}
        categories={categories}
        accounts={accounts}
        onClearReceiptDraft={clearReceiptDraft}
        onReceiptFileChosen={chooseReceiptFile}
        onReceiptDraftChange={changeReceiptDraft}
        onReceiptDraftAddLine={addReceiptDraftLine}
        onReceiptDraftUpdateLine={updateReceiptDraftLine}
        onReceiptDraftRemoveLine={removeReceiptDraftLine}
        onSaveReceiptDraft={saveReceiptDraft}
        saving={saving}
        ocrRunning={ocrRunning}
        ocrError={ocrError}
        ocrMeta={ocrMeta}
        onRetryOcr={rerunReceiptOcr}
      />

      <ReceiptViewerModal
        open={receiptViewerOpen}
        onClose={() => setReceiptViewerOpen(false)}
        selectedTx={selectedTx}
        selectedReceipts={selectedReceipts}
        selectedReceiptItemsByReceiptId={selectedReceiptItemsByReceiptId}
        onEditReceipt={() => startReceiptDraft(selectedTx)}
      />

      <ToastStack status={status} pageError={pageError} onClearError={() => setPageError("")} />
    </main>
  );
}

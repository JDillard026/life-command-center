"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import GlassPane from "../components/GlassPane";
import { supabase } from "@/lib/supabaseClient";
import { writeAccountDelta } from "@/lib/accountLedger";
import {
  BillEditorModal,
  FocusPane,
  QueuePane,
  SummaryStrip,
  Toast,
} from "./bills.components";
import styles from "./BillsPage.module.css";
import {
  billStatus,
  buildBillSummaries,
  calendarMirrorRow,
  compareIsoDates,
  editorState,
  emptyBillForm,
  isInvestment,
  isoDate,
  ledgerTs,
  mapAcct,
  mapBill,
  mapPayment,
  monthKeyOf,
  moWeight,
  nextDueFromFreq,
  parseMoneyInput,
  paymentDraftState,
  prevDueFromFreq,
  rewindDueNTimes,
  round2,
  safeNum,
  shouldAdvance,
  spendingRow,
  uid,
} from "./bills.helpers";

export default function BillsCommand() {
  const [bills, setBills] = useState([]);
  const [debtProfiles, setDebtProfiles] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [defaultAccountId, setDefaultAccountId] = useState("");
  const [selectedBillId, setSelectedBillId] = useState("");

  const [search, setSearch] = useState("");
  const [scope, setScope] = useState("active");
  const [sortBy, setSortBy] = useState("due_asc");
  const [mobileSection, setMobileSection] = useState("command");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pageError, setPageError] = useState("");
  const [status, setStatus] = useState("");
  const [userId, setUserId] = useState(null);

  const [editorMode, setEditorMode] = useState("");
  const [billForm, setBillForm] = useState(emptyBillForm(""));
  const [paymentDraft, setPaymentDraft] = useState(paymentDraftState(null, ""));
  const [deletingPaymentId, setDeletingPaymentId] = useState("");

  useEffect(() => {
    if (!status) return;
    const id = setTimeout(() => setStatus(""), 3200);
    return () => clearTimeout(id);
  }, [status]);

  const loadBillsPage = useCallback(async (preferredBillId = "") => {
    if (!supabase) {
      setLoading(false);
      setPageError("Missing Supabase environment variables.");
      return;
    }

    setLoading(true);
    setPageError("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.user) {
        setUserId(null);
        setBills([]);
        setDebtProfiles([]);
        setAccounts([]);
        setPayments([]);
        setDefaultAccountId("");
        setSelectedBillId("");
        setLoading(false);
        return;
      }

      const uidValue = session.user.id;
      setUserId(uidValue);

      const [billsRes, debtRes, accountsRes, settingsRes, paymentsRes] = await Promise.all([
        supabase
          .from("bills")
          .select("*")
          .eq("user_id", uidValue)
          .eq("type", "noncontrollable")
          .order("due_date", { ascending: true }),
        supabase
          .from("bills")
          .select("*")
          .eq("user_id", uidValue)
          .eq("type", "controllable")
          .order("name", { ascending: true }),
        supabase
          .from("accounts")
          .select("*")
          .eq("user_id", uidValue)
          .order("name", { ascending: true }),
        supabase
          .from("account_settings")
          .select("primary_account_id")
          .eq("user_id", uidValue)
          .maybeSingle(),
        supabase
          .from("bill_payments")
          .select("*")
          .eq("user_id", uidValue)
          .order("payment_date", { ascending: false })
          .order("created_at", { ascending: false }),
      ]);

      if (billsRes.error) throw billsRes.error;
      if (debtRes.error) throw debtRes.error;
      if (accountsRes.error) throw accountsRes.error;
      if (settingsRes.error) throw settingsRes.error;
      if (paymentsRes.error) throw paymentsRes.error;

      const nextBills = (billsRes.data || []).map(mapBill);
      const nextDebtProfiles = (debtRes.data || []).map(mapBill);
      const nextAccounts = (accountsRes.data || []).map(mapAcct);
      const nextPayments = (paymentsRes.data || []).map(mapPayment);
      const nextDefaultAccountId = settingsRes.data?.primary_account_id || "";

      setBills(nextBills);
      setDebtProfiles(nextDebtProfiles);
      setAccounts(nextAccounts);
      setPayments(nextPayments);
      setDefaultAccountId(nextDefaultAccountId);

      setSelectedBillId((previous) => {
        const nextId =
          preferredBillId && nextBills.some((bill) => bill.id === preferredBillId)
            ? preferredBillId
            : previous && nextBills.some((bill) => bill.id === previous)
            ? previous
            : nextBills[0]?.id || "";
        return nextId;
      });
    } catch (err) {
      setPageError(err?.message || "Failed to load bills.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function run() {
      if (!mounted) return;
      await loadBillsPage();
    }

    run();

    return () => {
      mounted = false;
    };
  }, [loadBillsPage]);

  const payAccounts = useMemo(
    () => accounts.filter((account) => !isInvestment(account.type)),
    [accounts]
  );

  const summaryById = useMemo(
    () =>
      buildBillSummaries({
        bills,
        payments,
        debtProfiles,
        accounts,
      }),
    [bills, payments, debtProfiles, accounts]
  );

  const visibleBills = useMemo(() => {
    const q = search.trim().toLowerCase();

    const filtered = bills.filter((bill) => {
      if (scope === "active" && !bill.active) return false;
      if (scope === "inactive" && bill.active) return false;
      if (!q) return true;

      return [bill.name, bill.category, bill.notes]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });

    if (sortBy === "amount_desc") {
      return [...filtered].sort((a, b) => safeNum(b.amount) - safeNum(a.amount));
    }

    if (sortBy === "name_asc") {
      return [...filtered].sort((a, b) => String(a.name).localeCompare(String(b.name)));
    }

    if (sortBy === "updated_desc") {
      return [...filtered].sort(
        (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
      );
    }

    return [...filtered].sort((a, b) => compareIsoDates(a.dueDate, b.dueDate));
  }, [bills, search, scope, sortBy]);

  useEffect(() => {
    if (!visibleBills.length) {
      setSelectedBillId("");
      return;
    }

    const exists = visibleBills.some((bill) => bill.id === selectedBillId);
    if (!exists) {
      setSelectedBillId(visibleBills[0].id);
    }
  }, [visibleBills, selectedBillId]);

  const selectedBill =
    bills.find((bill) => bill.id === selectedBillId) || visibleBills[0] || null;
  const selectedSummary = selectedBill ? summaryById[selectedBill.id] : null;
  const selectedLinkedDebt = selectedSummary?.linkedDebt || null;

  useEffect(() => {
    if (!selectedBill) {
      setBillForm(emptyBillForm(defaultAccountId));
      setPaymentDraft(paymentDraftState(null, defaultAccountId));
      return;
    }

    setBillForm(editorState(selectedBill, selectedLinkedDebt, defaultAccountId));
    setPaymentDraft(
      paymentDraftState(selectedBill, selectedBill.accountId || defaultAccountId || "")
    );
  }, [selectedBill?.id, selectedLinkedDebt?.id, defaultAccountId]);

  useEffect(() => {
    if (selectedBillId) setMobileSection("command");
  }, [selectedBillId]);

  const metrics = useMemo(() => {
    const activeBills = bills.filter((bill) => bill.active);
    const monthKey = monthKeyOf(isoDate());

    const dueSoonCount = activeBills.filter((bill) => {
      const summary = summaryById[bill.id];
      const days = summary?.daysUntil;
      return Number.isFinite(days) && days >= 0 && days <= 7 && !summary?.status?.isPaid;
    }).length;

    const overdueCount = activeBills.filter((bill) => {
      const summary = summaryById[bill.id];
      const days = summary?.daysUntil;
      return Number.isFinite(days) && days < 0 && !summary?.status?.isPaid;
    }).length;

    const nextBill =
      [...activeBills]
        .filter((bill) => !summaryById[bill.id]?.status?.isPaid)
        .sort((a, b) => {
          const aDays = summaryById[a.id]?.daysUntil;
          const bDays = summaryById[b.id]?.daysUntil;
          const aValue = Number.isFinite(aDays) ? aDays : 999999;
          const bValue = Number.isFinite(bDays) ? bDays : 999999;
          return aValue - bValue;
        })[0] || null;

    return {
      activeCount: activeBills.length,
      linkedDebtCount: activeBills.filter((bill) => !!bill.linkedDebtId).length,
      monthlyPressure: round2(
        activeBills.reduce((sum, bill) => sum + moWeight(bill.amount, bill.frequency), 0)
      ),
      paidThisMonth: round2(
        payments
          .filter((payment) => monthKeyOf(payment.paymentDate) === monthKey)
          .reduce((sum, payment) => sum + safeNum(payment.amount), 0)
      ),
      dueSoonCount,
      overdueCount,
      nextBill,
    };
  }, [bills, payments, summaryById]);

  async function getCalendarProfileId() {
    if (!userId) return null;

    const { data, error } = await supabase
      .from("calendar_profiles")
      .select("id, is_default, created_at")
      .eq("user_id", userId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1);

    if (error) throw error;
    return data?.[0]?.id ?? null;
  }

  async function upsertCalendarMirror(paymentId, bill, amount, paymentDate, paymentNote) {
    if (!userId) return;

    const profileId = await getCalendarProfileId();
    const payload = calendarMirrorRow(
      paymentId,
      userId,
      profileId,
      bill,
      amount,
      paymentDate,
      paymentNote
    );

    const { data: existing, error: findError } = await supabase
      .from("calendar_events")
      .select("id")
      .eq("user_id", userId)
      .eq("source", "spending")
      .eq("source_id", paymentId)
      .maybeSingle();

    if (findError) throw findError;

    if (existing?.id) {
      const { error } = await supabase
        .from("calendar_events")
        .update(payload)
        .eq("id", existing.id)
        .eq("user_id", userId);
      if (error) throw error;
      return;
    }

    const { error } = await supabase.from("calendar_events").insert([payload]);
    if (error) throw error;
  }

  async function deleteCalendarMirror(paymentId) {
    if (!userId) return;
    const { error } = await supabase
      .from("calendar_events")
      .delete()
      .eq("user_id", userId)
      .eq("source", "spending")
      .eq("source_id", paymentId);
    if (error) throw error;
  }

  function openCreate() {
    setBillForm(emptyBillForm(defaultAccountId));
    setEditorMode("create");
  }

  function openEdit() {
    if (!selectedBill) return;
    setBillForm(editorState(selectedBill, selectedLinkedDebt, defaultAccountId));
    setEditorMode("edit");
  }

  async function createLinkedDebtIfNeeded(form) {
    if (!form.isDebtBill) return { debtId: null, createdDebtId: null };

    if (form.debtMode === "link_existing") {
      return { debtId: form.linkedDebtId || null, createdDebtId: null };
    }

    const name = String(form.newDebtName || "").trim();
    const balance = parseMoneyInput(form.newDebtBalance);
    const aprPct = parseMoneyInput(form.newDebtAprPct || "0");
    const minPay = parseMoneyInput(form.newDebtMinPay || "0");
    const extraPay = parseMoneyInput(form.newDebtExtraPay || "0");

    if (!name) throw new Error("Debt name required.");
    if (!Number.isFinite(balance) || balance < 0) {
      throw new Error("Debt balance must be 0 or greater.");
    }
    if (!Number.isFinite(minPay) || minPay < 0) {
      throw new Error("Minimum payment must be 0 or greater.");
    }
    if (!Number.isFinite(extraPay) || extraPay < 0) {
      throw new Error("Extra payment must be 0 or greater.");
    }

    const debtId = uid();

    const { error } = await supabase.from("bills").insert({
      id: debtId,
      user_id: userId,
      name,
      type: "controllable",
      frequency: form.newDebtFrequency || "monthly",
      due_date: form.newDebtDueDate || null,
      amount: round2(Number.isFinite(minPay) ? minPay : 0),
      active: true,
      notes: form.newDebtNotes || "",
      balance: round2(balance),
      apr_pct: round2(Number.isFinite(aprPct) ? aprPct : 0),
      min_pay: round2(minPay),
      extra_pay: round2(extraPay),
      autopay: form.newDebtAutopay === true,
      category: form.newDebtCategory || "",
      account_id: form.newDebtAccountId || null,
      linked_debt_id: null,
      last_paid_date: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (error) throw error;

    return { debtId, createdDebtId: debtId };
  }

  async function addBill() {
    if (!supabase || !userId || busy) return;

    const name = String(billForm.name || "").trim();
    const amount = parseMoneyInput(billForm.amount || "0");

    if (!name) {
      setPageError("Bill name required.");
      return;
    }

    if (!Number.isFinite(amount) || amount < 0) {
      setPageError("Amount must be 0 or greater.");
      return;
    }

    if (billForm.isDebtBill && billForm.debtMode === "link_existing" && !billForm.linkedDebtId) {
      setPageError("Select a debt profile or create a new one.");
      return;
    }

    setBusy(true);
    setPageError("");

    let createdDebtId = null;

    try {
      const debtInfo = await createLinkedDebtIfNeeded(billForm);
      createdDebtId = debtInfo.createdDebtId;
      const billId = uid();

      const { error } = await supabase.from("bills").insert({
        id: billId,
        user_id: userId,
        name,
        type: "noncontrollable",
        frequency: billForm.frequency || "monthly",
        due_date: billForm.dueDate || null,
        amount: round2(amount),
        active: true,
        notes: billForm.notes || "",
        balance: round2(amount),
        apr_pct: 0,
        min_pay: 0,
        extra_pay: 0,
        autopay: billForm.autopay === true,
        category: billForm.category || "",
        account_id: billForm.accountId || null,
        linked_debt_id: debtInfo.debtId || null,
        last_paid_date: billForm.lastPaidDate || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      setEditorMode("");
      setBillForm(emptyBillForm(defaultAccountId));
      setStatus("Bill created.");
      await loadBillsPage(billId);
    } catch (err) {
      if (createdDebtId) {
        await supabase.from("bills").delete().eq("id", createdDebtId).eq("user_id", userId);
      }
      setPageError(err?.message || "Could not create bill.");
    } finally {
      setBusy(false);
    }
  }

  async function saveBill() {
    if (!supabase || !userId || !selectedBill || busy) return;

    const name = String(billForm.name || "").trim();
    const amount = parseMoneyInput(billForm.amount || "0");

    if (!name) {
      setPageError("Bill name required.");
      return;
    }

    if (!Number.isFinite(amount) || amount < 0) {
      setPageError("Amount must be 0 or greater.");
      return;
    }

    if (billForm.isDebtBill && billForm.debtMode === "link_existing" && !billForm.linkedDebtId) {
      setPageError("Select a debt profile or create a new one.");
      return;
    }

    setBusy(true);
    setPageError("");

    let createdDebtId = null;

    try {
      let nextLinkedDebtId = null;

      if (billForm.isDebtBill) {
        if (billForm.debtMode === "link_existing") {
          nextLinkedDebtId = billForm.linkedDebtId || null;
        } else {
          const debtInfo = await createLinkedDebtIfNeeded(billForm);
          nextLinkedDebtId = debtInfo.debtId;
          createdDebtId = debtInfo.createdDebtId;
        }
      }

      const { error } = await supabase
        .from("bills")
        .update({
          name,
          frequency: billForm.frequency || "monthly",
          due_date: billForm.dueDate || null,
          amount: round2(amount),
          notes: billForm.notes || "",
          category: billForm.category || "",
          account_id: billForm.accountId || null,
          autopay: billForm.autopay === true,
          linked_debt_id: nextLinkedDebtId,
          last_paid_date: billForm.lastPaidDate || null,
          balance: round2(
            selectedBill.linkedDebtId
              ? safeNum(selectedBill.balance)
              : Math.max(
                  0,
                  Math.min(safeNum(selectedBill.balance, selectedBill.amount), round2(amount))
                )
          ),
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedBill.id)
        .eq("user_id", userId);

      if (error) throw error;

      setEditorMode("");
      setStatus("Bill saved.");
      await loadBillsPage(selectedBill.id);
    } catch (err) {
      if (createdDebtId) {
        await supabase.from("bills").delete().eq("id", createdDebtId).eq("user_id", userId);
      }
      setPageError(err?.message || "Could not save bill.");
    } finally {
      setBusy(false);
    }
  }

  async function duplicateBill() {
    if (!supabase || !userId || !selectedBill || busy) return;

    setBusy(true);
    setPageError("");

    try {
      const cloneId = uid();
      const { error } = await supabase.from("bills").insert({
        id: cloneId,
        user_id: userId,
        name: `${selectedBill.name} Copy`,
        type: "noncontrollable",
        frequency: selectedBill.frequency || "monthly",
        due_date: selectedBill.dueDate || null,
        amount: round2(selectedBill.amount),
        active: selectedBill.active !== false,
        notes: selectedBill.notes || "",
        balance: round2(selectedBill.amount),
        apr_pct: 0,
        min_pay: 0,
        extra_pay: 0,
        autopay: selectedBill.autopay === true,
        category: selectedBill.category || "",
        account_id: selectedBill.accountId || null,
        linked_debt_id: null,
        last_paid_date: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      setStatus("Bill duplicated.");
      await loadBillsPage(cloneId);
    } catch (err) {
      setPageError(err?.message || "Could not duplicate bill.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleBillActive() {
    if (!supabase || !userId || !selectedBill || busy) return;

    setBusy(true);
    setPageError("");

    try {
      const { error } = await supabase
        .from("bills")
        .update({
          active: !selectedBill.active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedBill.id)
        .eq("user_id", userId);

      if (error) throw error;

      setStatus(selectedBill.active ? "Bill archived." : "Bill activated.");
      await loadBillsPage(selectedBill.id);
    } catch (err) {
      setPageError(err?.message || "Could not update bill.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteBill() {
    if (!supabase || !userId || !selectedBill || busy) return;
    if (typeof window !== "undefined" && !window.confirm(`Delete ${selectedBill.name}?`)) return;

    setBusy(true);
    setPageError("");

    const relatedPayments = payments
      .filter((payment) => payment.billId === selectedBill.id)
      .sort(
        (a, b) =>
          compareIsoDates(b.paymentDate, a.paymentDate) ||
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );

    const linkedDebtNow =
      debtProfiles.find((debt) => debt.id === (selectedBill.linkedDebtId || "")) || null;
    const rollbackPosts = [];
    let debtUpdated = false;

    try {
      for (const payment of relatedPayments) {
        if (!payment.accountId) continue;
        await writeAccountDelta({
          userId,
          accountId: payment.accountId,
          delta: round2(payment.amount),
          kind: "bill_payment_delete",
          amount: round2(payment.amount),
          note: `${selectedBill.name || "Bill"} payment removed with bill delete`,
          sourceType: "bill_payment_delete",
          sourceId: `${payment.id}:bill-delete`,
          createdAt: new Date().toISOString(),
        });
        rollbackPosts.push(payment);
      }

      if (linkedDebtNow && relatedPayments.length) {
        const removedIds = new Set(relatedPayments.map((payment) => payment.id));
        const remainingDebtPayments = payments
          .filter(
            (payment) =>
              !removedIds.has(payment.id) &&
              (payment.linkedDebtId === linkedDebtNow.id || payment.billId === linkedDebtNow.id)
          )
          .sort(
            (a, b) =>
              compareIsoDates(b.paymentDate, a.paymentDate) ||
              new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
          );

        const totalRemoved = round2(
          relatedPayments.reduce((sum, payment) => sum + safeNum(payment.amount), 0)
        );

        const nextDebtDue = remainingDebtPayments.length
          ? String(linkedDebtNow.frequency || "").toLowerCase() === "one_time"
            ? linkedDebtNow.dueDate || ""
            : nextDueFromFreq(remainingDebtPayments[0].paymentDate, linkedDebtNow.frequency)
          : rewindDueNTimes(
              linkedDebtNow.dueDate || selectedBill.dueDate || isoDate(),
              linkedDebtNow.frequency,
              relatedPayments.length
            );

        const { error: debtError } = await supabase
          .from("bills")
          .update({
            balance: round2(Math.max(0, safeNum(linkedDebtNow.balance) + totalRemoved)),
            last_paid_date: remainingDebtPayments[0]?.paymentDate || null,
            due_date: nextDebtDue || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", linkedDebtNow.id)
          .eq("user_id", userId);

        if (debtError) throw debtError;
        debtUpdated = true;
      }

      if (relatedPayments.length) {
        const paymentIds = relatedPayments.map((payment) => payment.id);
        const { error: spendingError } = await supabase
          .from("spending_transactions")
          .delete()
          .in("id", paymentIds)
          .eq("user_id", userId);
        if (spendingError) throw spendingError;

        for (const paymentId of paymentIds) {
          await deleteCalendarMirror(paymentId).catch(() => {});
        }

        const { error: paymentsError } = await supabase
          .from("bill_payments")
          .delete()
          .eq("user_id", userId)
          .eq("bill_id", selectedBill.id);
        if (paymentsError) throw paymentsError;
      }

      const { error: billError } = await supabase
        .from("bills")
        .delete()
        .eq("user_id", userId)
        .eq("id", selectedBill.id)
        .eq("type", "noncontrollable");

      if (billError) throw billError;

      setEditorMode("");
      setStatus("Bill deleted.");
      await loadBillsPage();
    } catch (err) {
      if (linkedDebtNow && debtUpdated) {
        await supabase
          .from("bills")
          .update({
            balance: linkedDebtNow.balance,
            last_paid_date: linkedDebtNow.lastPaidDate || null,
            due_date: linkedDebtNow.dueDate || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", linkedDebtNow.id)
          .eq("user_id", userId);
      }

      for (const payment of rollbackPosts) {
        try {
          await writeAccountDelta({
            userId,
            accountId: payment.accountId,
            delta: -round2(payment.amount),
            kind: "bill_payment_delete_rollback",
            amount: round2(payment.amount),
            note: `${selectedBill.name || "Bill"} delete rollback`,
            sourceType: "bill_payment_delete_rollback",
            sourceId: `${payment.id}:bill-delete-rollback`,
            createdAt: new Date().toISOString(),
          });
        } catch {}
      }

      setPageError(err?.message || "Could not delete bill.");
      await loadBillsPage(selectedBill.id);
    } finally {
      setBusy(false);
    }
  }

  async function makePayment() {
    if (!supabase || !userId || !selectedBill || paymentDraft.saving) return;

    const amount = parseMoneyInput(paymentDraft.amount);
    const paymentDate = paymentDraft.paymentDate || isoDate();
    const paymentAccountId = paymentDraft.accountId || "";
    const paymentNote = String(paymentDraft.note || "").trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      setPageError("Payment amount must be greater than 0.");
      return;
    }

    const paymentId = uid();
    const linkedDebtNow =
      debtProfiles.find((debt) => debt.id === (selectedBill.linkedDebtId || "")) || null;

    const nextLastPaid = paymentDate || selectedBill.lastPaidDate || null;
    const nextDue = shouldAdvance(selectedBill, paymentDate, paymentDraft.advanceDue)
      ? nextDueFromFreq(paymentDate || selectedBill.dueDate || isoDate(), selectedBill.frequency)
      : selectedBill.dueDate || "";

    const currentBillBalance = safeNum(selectedBill.balance, selectedBill.amount);
    const nextBalance = round2(
      selectedBill.linkedDebtId
        ? Math.max(0, currentBillBalance - amount)
        : Math.max(0, Math.min(safeNum(selectedBill.amount), currentBillBalance - amount))
    );

    const nextDebtBalance = linkedDebtNow
      ? round2(Math.max(0, safeNum(linkedDebtNow.balance) - amount))
      : 0;

    const nextDebtDue = linkedDebtNow
      ? shouldAdvance(linkedDebtNow, paymentDate, paymentDraft.advanceDue)
        ? nextDueFromFreq(paymentDate || linkedDebtNow.dueDate || isoDate(), linkedDebtNow.frequency)
        : linkedDebtNow.dueDate || ""
      : "";

    setPaymentDraft((prev) => ({ ...prev, saving: true }));
    setPageError("");

    let ledgerPosted = false;
    let spendingInserted = false;
    let calendarInserted = false;
    let billUpdated = false;
    let debtUpdated = false;

    try {
      const { error: paymentInsertError } = await supabase.from("bill_payments").insert({
        id: paymentId,
        user_id: userId,
        bill_id: selectedBill.id,
        linked_debt_id: selectedBill.linkedDebtId || null,
        amount: round2(amount),
        payment_date: paymentDate,
        payment_account_id: paymentAccountId || null,
        note: paymentNote || null,
      });
      if (paymentInsertError) throw paymentInsertError;

      if (paymentAccountId) {
        await writeAccountDelta({
          userId,
          accountId: paymentAccountId,
          delta: -round2(amount),
          kind: "bill_payment",
          amount: round2(amount),
          note: `${selectedBill.name || "Bill"}${paymentNote ? ` • ${paymentNote}` : ""}`,
          sourceType: "bill_payment",
          sourceId: paymentId,
          createdAt: ledgerTs(paymentDate),
        });
        ledgerPosted = true;
      }

      const { error: billError } = await supabase
        .from("bills")
        .update({
          last_paid_date: nextLastPaid || null,
          due_date: nextDue || null,
          balance: nextBalance,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedBill.id)
        .eq("user_id", userId);
      if (billError) throw billError;
      billUpdated = true;

      if (linkedDebtNow) {
        const { error: debtError } = await supabase
          .from("bills")
          .update({
            balance: nextDebtBalance,
            last_paid_date: paymentDate,
            due_date: nextDebtDue || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", linkedDebtNow.id)
          .eq("user_id", userId);
        if (debtError) throw debtError;
        debtUpdated = true;
      }

      const payAccount = accounts.find((account) => account.id === paymentAccountId) || null;
      const spendRow = spendingRow(
        paymentId,
        userId,
        selectedBill,
        amount,
        paymentDate,
        payAccount?.name || "",
        paymentNote
      );

      const { error: spendingError } = await supabase
        .from("spending_transactions")
        .insert([spendRow]);
      if (spendingError) throw spendingError;
      spendingInserted = true;

      try {
        await upsertCalendarMirror(paymentId, selectedBill, amount, paymentDate, paymentNote);
        calendarInserted = true;
      } catch (calendarErr) {
        console.error("Calendar mirror failed", calendarErr);
      }

      setPaymentDraft(paymentDraftState(null, selectedBill.accountId || defaultAccountId || ""));
      setStatus(linkedDebtNow ? "Paid and debt synced." : "Payment logged.");
      await loadBillsPage(selectedBill.id);
    } catch (err) {
      if (calendarInserted) await deleteCalendarMirror(paymentId).catch(() => {});
      if (spendingInserted) {
        await supabase
          .from("spending_transactions")
          .delete()
          .eq("id", paymentId)
          .eq("user_id", userId);
      }

      if (linkedDebtNow && debtUpdated) {
        await supabase
          .from("bills")
          .update({
            balance: linkedDebtNow.balance,
            last_paid_date: linkedDebtNow.lastPaidDate || null,
            due_date: linkedDebtNow.dueDate || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", linkedDebtNow.id)
          .eq("user_id", userId);
      }

      if (billUpdated) {
        await supabase
          .from("bills")
          .update({
            last_paid_date: selectedBill.lastPaidDate || null,
            due_date: selectedBill.dueDate || null,
            balance: selectedBill.balance,
            updated_at: new Date().toISOString(),
          })
          .eq("id", selectedBill.id)
          .eq("user_id", userId);
      }

      if (ledgerPosted && paymentAccountId) {
        try {
          await writeAccountDelta({
            userId,
            accountId: paymentAccountId,
            delta: round2(amount),
            kind: "bill_payment_rollback",
            amount: round2(amount),
            note: `${selectedBill.name || "Bill"} rollback`,
            sourceType: "bill_payment_rollback",
            sourceId: paymentId,
            createdAt: new Date().toISOString(),
          });
        } catch {}
      }

      await supabase.from("bill_payments").delete().eq("id", paymentId).eq("user_id", userId);
      setPageError(err?.message || "Could not save payment.");
      setPaymentDraft((prev) => ({ ...prev, saving: false }));
      await loadBillsPage(selectedBill.id);
    }
  }

  async function deletePayment(payment) {
    if (!supabase || !userId || !payment || deletingPaymentId) return;
    if (typeof window !== "undefined" && !window.confirm("Delete this payment?")) return;

    setDeletingPaymentId(payment.id);
    setPageError("");

    const currentBill = bills.find((bill) => bill.id === payment.billId) || null;
    const linkedDebtNow =
      debtProfiles.find(
        (debt) => debt.id === (payment.linkedDebtId || currentBill?.linkedDebtId || "")
      ) || null;

    const remainingBillPayments = payments
      .filter((row) => row.billId === payment.billId && row.id !== payment.id)
      .sort(
        (a, b) =>
          compareIsoDates(b.paymentDate, a.paymentDate) ||
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );

    const remainingDebtPayments = linkedDebtNow
      ? payments
          .filter(
            (row) =>
              row.id !== payment.id &&
              (row.linkedDebtId === linkedDebtNow.id || row.billId === linkedDebtNow.id)
          )
          .sort(
            (a, b) =>
              compareIsoDates(b.paymentDate, a.paymentDate) ||
              new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
          )
      : [];

    let ledgerRollbackPosted = false;
    let billUpdated = false;
    let debtUpdated = false;

    try {
      if (payment.accountId) {
        await writeAccountDelta({
          userId,
          accountId: payment.accountId,
          delta: round2(payment.amount),
          kind: "bill_payment_delete",
          amount: round2(payment.amount),
          note: `${currentBill?.name || "Bill"} payment deleted`,
          sourceType: "bill_payment_delete",
          sourceId: payment.id,
          createdAt: new Date().toISOString(),
        });
        ledgerRollbackPosted = true;
      }

      if (currentBill) {
        const latestRemaining = remainingBillPayments[0] || null;
        const wasLatest = currentBill.lastPaidDate === payment.paymentDate;
        const restoredBalance = round2(
          Math.min(
            safeNum(currentBill.amount),
            Math.max(0, safeNum(currentBill.balance, currentBill.amount) + safeNum(payment.amount))
          )
        );

        let nextDue = currentBill.dueDate || "";
        if (latestRemaining?.paymentDate) {
          nextDue =
            String(currentBill.frequency || "").toLowerCase() === "one_time"
              ? currentBill.dueDate || ""
              : nextDueFromFreq(latestRemaining.paymentDate, currentBill.frequency);
        } else if (
          wasLatest &&
          String(currentBill.frequency || "").toLowerCase() !== "one_time" &&
          currentBill.dueDate
        ) {
          nextDue = prevDueFromFreq(currentBill.dueDate, currentBill.frequency);
        }

        const { error: billError } = await supabase
          .from("bills")
          .update({
            balance: restoredBalance,
            last_paid_date: latestRemaining?.paymentDate || null,
            due_date: nextDue || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", currentBill.id)
          .eq("user_id", userId);
        if (billError) throw billError;
        billUpdated = true;
      }

      if (linkedDebtNow) {
        const latestRemainingDebt = remainingDebtPayments[0] || null;
        const wasLatestDebt = linkedDebtNow.lastPaidDate === payment.paymentDate;

        let nextDebtDue = linkedDebtNow.dueDate || "";
        if (latestRemainingDebt?.paymentDate) {
          nextDebtDue =
            String(linkedDebtNow.frequency || "").toLowerCase() === "one_time"
              ? linkedDebtNow.dueDate || ""
              : nextDueFromFreq(latestRemainingDebt.paymentDate, linkedDebtNow.frequency);
        } else if (
          wasLatestDebt &&
          String(linkedDebtNow.frequency || "").toLowerCase() !== "one_time" &&
          linkedDebtNow.dueDate
        ) {
          nextDebtDue = prevDueFromFreq(linkedDebtNow.dueDate, linkedDebtNow.frequency);
        }

        const { error: debtError } = await supabase
          .from("bills")
          .update({
            balance: round2(Math.max(0, safeNum(linkedDebtNow.balance) + safeNum(payment.amount))),
            last_paid_date: latestRemainingDebt?.paymentDate || null,
            due_date: nextDebtDue || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", linkedDebtNow.id)
          .eq("user_id", userId);
        if (debtError) throw debtError;
        debtUpdated = true;
      }

      const { error: spendingDeleteError } = await supabase
        .from("spending_transactions")
        .delete()
        .eq("id", payment.id)
        .eq("user_id", userId);
      if (spendingDeleteError) throw spendingDeleteError;

      await deleteCalendarMirror(payment.id).catch(() => {});

      const { error: paymentDeleteError } = await supabase
        .from("bill_payments")
        .delete()
        .eq("id", payment.id)
        .eq("user_id", userId);
      if (paymentDeleteError) throw paymentDeleteError;

      setStatus(linkedDebtNow ? "Payment deleted and debt resynced." : "Payment deleted.");
      await loadBillsPage(currentBill?.id || selectedBillId);
    } catch (err) {
      if (currentBill && billUpdated) {
        await supabase
          .from("bills")
          .update({
            last_paid_date: currentBill.lastPaidDate || null,
            due_date: currentBill.dueDate || null,
            balance: currentBill.balance,
            updated_at: new Date().toISOString(),
          })
          .eq("id", currentBill.id)
          .eq("user_id", userId);
      }

      if (linkedDebtNow && debtUpdated) {
        await supabase
          .from("bills")
          .update({
            last_paid_date: linkedDebtNow.lastPaidDate || null,
            due_date: linkedDebtNow.dueDate || null,
            balance: linkedDebtNow.balance,
            updated_at: new Date().toISOString(),
          })
          .eq("id", linkedDebtNow.id)
          .eq("user_id", userId);
      }

      if (payment.accountId && ledgerRollbackPosted) {
        try {
          await writeAccountDelta({
            userId,
            accountId: payment.accountId,
            delta: -round2(payment.amount),
            kind: "bill_payment_delete_rollback",
            amount: round2(payment.amount),
            note: `${currentBill?.name || "Bill"} delete rollback`,
            sourceType: "bill_payment_delete_rollback",
            sourceId: `${payment.id}:payment-delete-rollback`,
            createdAt: new Date().toISOString(),
          });
        } catch {}
      }

      setPageError(err?.message || "Could not delete payment.");
      await loadBillsPage(currentBill?.id || selectedBillId);
    } finally {
      setDeletingPaymentId("");
    }
  }

  if (loading) {
    return (
      <main className={styles.page}>
        <GlassPane className={styles.gatePanel}>
          <div className={styles.gateText}>Loading bill command…</div>
        </GlassPane>
      </main>
    );
  }

  if (!userId) {
    return (
      <main className={styles.page}>
        <GlassPane className={styles.gatePanel}>
          <div className={styles.gateText}>Sign in to use bills.</div>
        </GlassPane>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <Toast error={pageError} status={status} onClearError={() => setPageError("")} />

      <SummaryStrip metrics={metrics} selectedBill={selectedBill} selectedSummary={selectedSummary} />

      <div className={styles.mobileTabs}>
        {[
          { value: "list", label: "Bills" },
          { value: "command", label: "Command" },
        ].map((item) => (
          <button
            key={item.value}
            type="button"
            className={`${styles.mobileTab} ${
              mobileSection === item.value ? styles.mobileTabActive : ""
            }`}
            onClick={() => setMobileSection(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className={styles.workspace}>
        <section
          className={`${styles.workspaceCol} ${styles.leftCol} ${
            mobileSection === "list" ? styles.workspaceColShow : ""
          }`}
        >
          <QueuePane
            visibleBills={visibleBills}
            summaryById={summaryById}
            selectedBill={selectedBill}
            onSelect={(billId) => {
              setSelectedBillId(billId);
              setMobileSection("command");
            }}
            search={search}
            setSearch={setSearch}
            scope={scope}
            setScope={setScope}
            sortBy={sortBy}
            setSortBy={setSortBy}
          />
        </section>

        <section
          className={`${styles.workspaceCol} ${styles.mainCol} ${
            mobileSection === "command" ? styles.workspaceColShow : ""
          }`}
        >
          <FocusPane
            selectedBill={selectedBill}
            selectedSummary={selectedSummary}
            payAccounts={payAccounts}
            draft={paymentDraft}
            setDraft={setPaymentDraft}
            payBusy={paymentDraft.saving}
            onPay={makePayment}
            onOpenCreate={openCreate}
            onOpenEdit={openEdit}
            onDuplicate={duplicateBill}
            onToggle={toggleBillActive}
            onDelete={deleteBill}
            onDeletePayment={deletePayment}
            deletingPaymentId={deletingPaymentId}
            busy={busy}
          />
        </section>
      </div>

      <BillEditorModal
        open={editorMode === "create" || editorMode === "edit"}
        mode={editorMode === "edit" ? "edit" : "create"}
        form={billForm}
        setForm={setBillForm}
        onClose={() => setEditorMode("")}
        onSave={editorMode === "edit" ? saveBill : addBill}
        saving={busy}
        accounts={accounts}
        debtProfiles={debtProfiles}
      />
    </main>
  );
}

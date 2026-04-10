"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import GlassPane from "../components/GlassPane";
import { supabase } from "@/lib/supabaseClient";
import {
  DebtEditorModal,
  FocusPane,
  QueuePane,
  SummaryStrip,
  Toast,
} from "./debt.components";
import styles from "./DebtPage.module.css";
import {
  buildDebtForm,
  buildDebtSummaries,
  compareIsoDates,
  daysUntil,
  isInvestmentAccountType,
  mapAccount,
  mapDebt,
  mapPayment,
  monthKeyOf,
  monthlyInterest,
  monthlyScheduledPayment,
  parseMoneyInput,
  round2,
  safeNum,
  sortForStrategy,
  uid,
} from "./debt.helpers";

export default function DebtCommand() {
  const [debts, setDebts] = useState([]);
  const [linkedBills, setLinkedBills] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [defaultAccountId, setDefaultAccountId] = useState("");
  const [selectedDebtId, setSelectedDebtId] = useState("");

  const [search, setSearch] = useState("");
  const [scope, setScope] = useState("active");
  const [strategy, setStrategy] = useState("avalanche");
  const [tab, setTab] = useState("payoff");
  const [mobileSection, setMobileSection] = useState("command");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pageError, setPageError] = useState("");
  const [status, setStatus] = useState("");
  const [userId, setUserId] = useState(null);

  const [openModal, setOpenModal] = useState("");
  const [debtForm, setDebtForm] = useState(buildDebtForm(null, ""));
  const [simBoost, setSimBoost] = useState("100");

  useEffect(() => {
    if (!status) return;
    const id = setTimeout(() => setStatus(""), 3200);
    return () => clearTimeout(id);
  }, [status]);

  const loadDebtPage = useCallback(async (preferredDebtId = "") => {
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
        setDebts([]);
        setLinkedBills([]);
        setAccounts([]);
        setPayments([]);
        setDefaultAccountId("");
        setSelectedDebtId("");
        setLoading(false);
        return;
      }

      const uidValue = session.user.id;
      setUserId(uidValue);

      const [debtsRes, linkedBillsRes, accountsRes, settingsRes, paymentsRes] = await Promise.all([
        supabase
          .from("bills")
          .select("*")
          .eq("user_id", uidValue)
          .eq("type", "controllable")
          .order("name", { ascending: true }),
        supabase
          .from("bills")
          .select("*")
          .eq("user_id", uidValue)
          .eq("type", "noncontrollable")
          .not("linked_debt_id", "is", null)
          .order("due_date", { ascending: true }),
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

      if (debtsRes.error) throw debtsRes.error;
      if (linkedBillsRes.error) throw linkedBillsRes.error;
      if (accountsRes.error) throw accountsRes.error;
      if (settingsRes.error) throw settingsRes.error;
      if (paymentsRes.error) throw paymentsRes.error;

      const nextDebts = (debtsRes.data || []).map(mapDebt);
      const nextLinkedBills = (linkedBillsRes.data || []).map(mapDebt);
      const nextAccounts = (accountsRes.data || []).map(mapAccount);
      const nextPayments = (paymentsRes.data || []).map(mapPayment);
      const nextDefaultAccountId = settingsRes.data?.primary_account_id || "";

      setDebts(nextDebts);
      setLinkedBills(nextLinkedBills);
      setAccounts(nextAccounts);
      setPayments(nextPayments);
      setDefaultAccountId(nextDefaultAccountId);

      setSelectedDebtId((previous) => {
        const nextId =
          preferredDebtId && nextDebts.some((debt) => debt.id === preferredDebtId)
            ? preferredDebtId
            : previous && nextDebts.some((debt) => debt.id === previous)
            ? previous
            : nextDebts[0]?.id || "";
        return nextId;
      });
    } catch (err) {
      setPageError(err?.message || "Failed to load debt.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function run() {
      if (!mounted) return;
      await loadDebtPage();
    }

    run();

    return () => {
      mounted = false;
    };
  }, [loadDebtPage]);

  const summaryById = useMemo(
    () =>
      buildDebtSummaries({
        debts,
        linkedBills,
        payments,
        accounts,
      }),
    [debts, linkedBills, payments, accounts]
  );

  const visibleDebts = useMemo(() => {
    const q = search.trim().toLowerCase();

    const filtered = debts.filter((debt) => {
      if (scope === "active" && !debt.active) return false;
      if (scope === "inactive" && debt.active) return false;
      if (!q) return true;

      return [debt.name, debt.category, debt.notes]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });

    return sortForStrategy(filtered, strategy);
  }, [debts, search, scope, strategy]);

  useEffect(() => {
    if (!visibleDebts.length) {
      setSelectedDebtId("");
      return;
    }

    const exists = visibleDebts.some((debt) => debt.id === selectedDebtId);
    if (!exists) {
      setSelectedDebtId(visibleDebts[0].id);
    }
  }, [visibleDebts, selectedDebtId]);

  const selectedDebt =
    debts.find((debt) => debt.id === selectedDebtId) ||
    visibleDebts[0] ||
    null;

  const selectedSummary = selectedDebt ? summaryById[selectedDebt.id] : null;

  const activeDebts = useMemo(() => debts.filter((debt) => debt.active), [debts]);

  const targetDebt = useMemo(() => {
    const candidates = activeDebts.filter((debt) => safeNum(debt.balance) > 0);
    return sortForStrategy(candidates, strategy)[0] || null;
  }, [activeDebts, strategy]);

  useEffect(() => {
    if (!selectedDebt) {
      setDebtForm(buildDebtForm(null, defaultAccountId));
      return;
    }

    setDebtForm(buildDebtForm(selectedDebt, defaultAccountId));
    setSimBoost(String(Math.max(0, safeNum(selectedDebt.extraPay, 0) || 100)));
  }, [selectedDebt, defaultAccountId]);

  useEffect(() => {
    if (selectedDebtId) setMobileSection("command");
  }, [selectedDebtId]);

  const metrics = useMemo(() => {
    const active = debts.filter((debt) => debt.active);
    const currentMonthKey = monthKeyOf(new Date().toISOString());

    const totalBalance = round2(
      active.reduce((sum, debt) => sum + safeNum(debt.balance), 0)
    );

    const totalPlan = round2(
      active.reduce((sum, debt) => sum + monthlyScheduledPayment(debt), 0)
    );

    const monthlyBleed = round2(
      active.reduce((sum, debt) => sum + monthlyInterest(debt.balance, debt.aprPct), 0)
    );

    const paidThisMonth = round2(
      payments
        .filter((payment) => monthKeyOf(payment.paymentDate) === currentMonthKey)
        .reduce((sum, payment) => sum + safeNum(payment.amount), 0)
    );

    const overdueCount = active.filter((debt) => {
      const days = daysUntil(debt.dueDate);
      return Number.isFinite(days) && days < 0;
    }).length;

    const highAprCount = active.filter((debt) => safeNum(debt.aprPct) >= 20).length;

    return {
      activeCount: active.length,
      totalBalance,
      totalPlan,
      monthlyBleed,
      paidThisMonth,
      overdueCount,
      highAprCount,
    };
  }, [debts, payments]);

  const alerts = useMemo(() => {
    const overdue = activeDebts.filter((debt) => {
      const days = daysUntil(debt.dueDate);
      return Number.isFinite(days) && days < 0;
    });

    const highApr = activeDebts.filter((debt) => safeNum(debt.aprPct) >= 20);

    const lowPayment = activeDebts.filter((debt) => {
      const summary = summaryById[debt.id];
      return summary?.underwater;
    });

    return { overdue, highApr, lowPayment };
  }, [activeDebts, summaryById]);

  async function createDebt() {
    if (!supabase || !userId || busy) return;

    const name = String(debtForm.name || "").trim();
    const balance = round2(parseMoneyInput(debtForm.balance));
    const aprPct = round2(parseMoneyInput(debtForm.aprPct || "0"));
    const minPay = round2(parseMoneyInput(debtForm.minPay || "0"));
    const extraPay = round2(parseMoneyInput(debtForm.extraPay || "0"));
    const amount = round2(parseMoneyInput(debtForm.amount || debtForm.minPay || "0"));

    if (!name) {
      setPageError("Debt name required.");
      return;
    }

    if (!Number.isFinite(balance) || balance < 0) {
      setPageError("Balance must be 0 or greater.");
      return;
    }

    if (!Number.isFinite(minPay) || minPay < 0) {
      setPageError("Minimum payment must be 0 or greater.");
      return;
    }

    if (!Number.isFinite(extraPay) || extraPay < 0) {
      setPageError("Extra payment must be 0 or greater.");
      return;
    }

    setBusy(true);
    setPageError("");

    try {
      const debtId = uid();

      const { error } = await supabase.from("bills").insert({
        id: debtId,
        user_id: userId,
        name,
        type: "controllable",
        frequency: debtForm.frequency || "monthly",
        due_date: debtForm.dueDate || null,
        amount: round2(Number.isFinite(amount) ? amount : 0),
        active: true,
        balance: round2(balance),
        min_pay: round2(minPay),
        extra_pay: round2(extraPay),
        apr_pct: round2(Number.isFinite(aprPct) ? aprPct : 0),
        autopay: debtForm.autopay === true,
        category: debtForm.category || "",
        notes: debtForm.notes || "",
        account_id: debtForm.accountId || null,
        linked_debt_id: null,
        last_paid_date: debtForm.lastPaidDate || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      setOpenModal("");
      setDebtForm(buildDebtForm(null, defaultAccountId));
      setStatus("Debt profile created.");
      setSelectedDebtId(debtId);
      await loadDebtPage(debtId);
    } catch (err) {
      setPageError(err?.message || "Could not create debt profile.");
    } finally {
      setBusy(false);
    }
  }

  async function saveDebt() {
    if (!supabase || !userId || !selectedDebt || busy) return;

    const name = String(debtForm.name || "").trim();
    const balance = round2(parseMoneyInput(debtForm.balance));
    const aprPct = round2(parseMoneyInput(debtForm.aprPct || "0"));
    const minPay = round2(parseMoneyInput(debtForm.minPay || "0"));
    const extraPay = round2(parseMoneyInput(debtForm.extraPay || "0"));
    const amount = round2(parseMoneyInput(debtForm.amount || debtForm.minPay || "0"));

    if (!name) {
      setPageError("Debt name required.");
      return;
    }

    if (!Number.isFinite(balance) || balance < 0) {
      setPageError("Balance must be 0 or greater.");
      return;
    }

    if (!Number.isFinite(minPay) || minPay < 0) {
      setPageError("Minimum payment must be 0 or greater.");
      return;
    }

    if (!Number.isFinite(extraPay) || extraPay < 0) {
      setPageError("Extra payment must be 0 or greater.");
      return;
    }

    setBusy(true);
    setPageError("");

    try {
      const { error } = await supabase
        .from("bills")
        .update({
          name,
          frequency: debtForm.frequency || "monthly",
          due_date: debtForm.dueDate || null,
          amount: round2(Number.isFinite(amount) ? amount : 0),
          balance: round2(balance),
          min_pay: round2(minPay),
          extra_pay: round2(extraPay),
          apr_pct: round2(Number.isFinite(aprPct) ? aprPct : 0),
          autopay: debtForm.autopay === true,
          category: debtForm.category || "",
          notes: debtForm.notes || "",
          account_id: debtForm.accountId || null,
          last_paid_date: debtForm.lastPaidDate || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedDebt.id)
        .eq("user_id", userId);

      if (error) throw error;

      setOpenModal("");
      setStatus("Debt profile saved.");
      await loadDebtPage(selectedDebt.id);
    } catch (err) {
      setPageError(err?.message || "Could not save debt profile.");
    } finally {
      setBusy(false);
    }
  }

  async function duplicateDebt() {
    if (!supabase || !userId || !selectedDebt || busy) return;

    setBusy(true);
    setPageError("");

    try {
      const duplicateId = uid();

      const { error } = await supabase.from("bills").insert({
        id: duplicateId,
        user_id: userId,
        name: `${selectedDebt.name} Copy`,
        type: "controllable",
        frequency: selectedDebt.frequency || "monthly",
        due_date: selectedDebt.dueDate || null,
        amount: round2(selectedDebt.amount),
        active: selectedDebt.active !== false,
        balance: round2(selectedDebt.balance),
        min_pay: round2(selectedDebt.minPay),
        extra_pay: round2(selectedDebt.extraPay),
        apr_pct: round2(selectedDebt.aprPct),
        autopay: selectedDebt.autopay === true,
        category: selectedDebt.category || "",
        notes: selectedDebt.notes || "",
        account_id: selectedDebt.accountId || null,
        linked_debt_id: null,
        last_paid_date: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      setStatus("Debt duplicated.");
      await loadDebtPage(duplicateId);
    } catch (err) {
      setPageError(err?.message || "Could not duplicate debt.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive() {
    if (!supabase || !userId || !selectedDebt || busy) return;

    setBusy(true);
    setPageError("");

    try {
      const { error } = await supabase
        .from("bills")
        .update({
          active: !selectedDebt.active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedDebt.id)
        .eq("user_id", userId);

      if (error) throw error;

      setStatus(selectedDebt.active ? "Debt archived." : "Debt activated.");
      await loadDebtPage(selectedDebt.id);
    } catch (err) {
      setPageError(err?.message || "Could not update debt.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteDebt() {
    if (!supabase || !userId || !selectedDebt || busy) return;

    const ok =
      typeof window === "undefined"
        ? true
        : window.confirm(
            `Delete ${selectedDebt.name || "this debt"}?\n\nThis will unlink bills attached to it and remove debt-only history rows.`
          );

    if (!ok) return;

    setBusy(true);
    setPageError("");

    try {
      const { error: unlinkBillsError } = await supabase
        .from("bills")
        .update({ linked_debt_id: null, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("linked_debt_id", selectedDebt.id);
      if (unlinkBillsError) throw unlinkBillsError;

      const { error: unlinkPaymentRefsError } = await supabase
        .from("bill_payments")
        .update({ linked_debt_id: null })
        .eq("user_id", userId)
        .eq("linked_debt_id", selectedDebt.id);
      if (unlinkPaymentRefsError) throw unlinkPaymentRefsError;

      const { error: deleteDebtPaymentsError } = await supabase
        .from("bill_payments")
        .delete()
        .eq("user_id", userId)
        .eq("bill_id", selectedDebt.id);
      if (deleteDebtPaymentsError) throw deleteDebtPaymentsError;

      const { error: deleteDebtError } = await supabase
        .from("bills")
        .delete()
        .eq("user_id", userId)
        .eq("id", selectedDebt.id)
        .eq("type", "controllable");
      if (deleteDebtError) throw deleteDebtError;

      setStatus("Debt deleted.");
      setOpenModal("");
      await loadDebtPage();
    } catch (err) {
      setPageError(err?.message || "Could not delete debt.");
      await loadDebtPage(selectedDebt.id);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className={styles.page}>
        <GlassPane className={styles.gatePanel}>
          <div className={styles.gateText}>Loading debt command…</div>
        </GlassPane>
      </main>
    );
  }

  if (!userId) {
    return (
      <main className={styles.page}>
        <GlassPane className={styles.gatePanel}>
          <div className={styles.gateText}>Sign in to use debt.</div>
        </GlassPane>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <Toast error={pageError} status={status} onClearError={() => setPageError("")} />

      <SummaryStrip
        metrics={metrics}
        targetDebt={targetDebt}
        selectedDebt={selectedDebt}
        selectedSummary={selectedSummary}
      />

      <div className={styles.mobileTabs}>
        {[
          { value: "list", label: "Debt" },
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
            visibleDebts={visibleDebts}
            summaryById={summaryById}
            selectedDebt={selectedDebt}
            onSelect={(debtId) => {
              setSelectedDebtId(debtId);
              setMobileSection("command");
            }}
            search={search}
            setSearch={setSearch}
            scope={scope}
            setScope={setScope}
            strategy={strategy}
            setStrategy={setStrategy}
            targetDebtId={targetDebt?.id || ""}
          />
        </section>

        <section
          className={`${styles.workspaceCol} ${styles.mainCol} ${
            mobileSection === "command" ? styles.workspaceColShow : ""
          }`}
        >
          <FocusPane
            selectedDebt={selectedDebt}
            selectedSummary={selectedSummary}
            summaryById={summaryById}
            accounts={accounts}
            metrics={metrics}
            alerts={alerts}
            tab={tab}
            setTab={setTab}
            strategy={strategy}
            setStrategy={setStrategy}
            simBoost={simBoost}
            setSimBoost={setSimBoost}
            targetDebtId={targetDebt?.id || ""}
            busy={busy}
            onCreate={() => {
              setDebtForm(buildDebtForm(null, defaultAccountId));
              setOpenModal("create");
            }}
            onEdit={() => {
              setDebtForm(buildDebtForm(selectedDebt, defaultAccountId));
              setOpenModal("edit");
            }}
            onDuplicate={duplicateDebt}
            onToggle={toggleActive}
            onDelete={deleteDebt}
            onOpenBills={() => {
              if (typeof window !== "undefined") window.location.href = "/bills";
            }}
          />
        </section>
      </div>

      <DebtEditorModal
        open={openModal === "create" || openModal === "edit"}
        mode={openModal === "create" ? "create" : "edit"}
        form={debtForm}
        setForm={setDebtForm}
        onClose={() => setOpenModal("")}
        onSave={openModal === "create" ? createDebt : saveDebt}
        saving={busy}
        accounts={accounts.filter((account) => !isInvestmentAccountType(account.type))}
      />
    </main>
  );
}

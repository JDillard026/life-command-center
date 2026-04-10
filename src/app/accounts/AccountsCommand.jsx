"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import GlassPane from "../components/GlassPane";
import { supabase } from "@/lib/supabaseClient";
import { writeAccountDelta, writeAccountTransfer } from "@/lib/accountLedger";
import {
  allowsNegativeOpeningBalance,
  buildAccountSummaries,
  buildBalanceBars,
  emptyAdjustForm,
  emptyCreateForm,
  emptyTransferForm,
  isCashLikeAccount,
  normalizeAccountType,
  parseMoneyInput,
  riskMeta,
  round2,
  safeNum,
  typeMatches,
  uid,
} from "./accounts.helpers";
import {
  Button,
  FocusPane,
  ModalShell,
  QueuePane,
  SummaryStrip,
  Toast,
} from "./accounts.components";
import styles from "./AccountsPage.module.css";

export default function AccountsCommand() {
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [bills, setBills] = useState([]);
  const [incomeRows, setIncomeRows] = useState([]);
  const [defaultAccountId, setDefaultAccountId] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");

  const [accountSearch, setAccountSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  const [tab, setTab] = useState("transactions");
  const [mobileSection, setMobileSection] = useState("command");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pageError, setPageError] = useState("");
  const [status, setStatus] = useState("");
  const [userId, setUserId] = useState(null);

  const [openModal, setOpenModal] = useState("");
  const [createForm, setCreateForm] = useState(emptyCreateForm());
  const [adjustForm, setAdjustForm] = useState(emptyAdjustForm(null));
  const [transferForm, setTransferForm] = useState(emptyTransferForm("", []));

  useEffect(() => {
    if (!status) return;
    const id = setTimeout(() => setStatus(""), 3200);
    return () => clearTimeout(id);
  }, [status]);

  const loadAccountsPage = useCallback(async () => {
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
        setAccounts([]);
        setTransactions([]);
        setBills([]);
        setIncomeRows([]);
        setDefaultAccountId("");
        setSelectedAccountId("");
        setLoading(false);
        return;
      }

      const uidValue = session.user.id;
      setUserId(uidValue);

      const [accountsRes, txRes, settingsRes, billsRes, incomeRes] = await Promise.all([
        supabase
          .from("accounts")
          .select("id, user_id, name, account_type, balance, safe_buffer, updated_at")
          .eq("user_id", uidValue)
          .order("name", { ascending: true }),

        supabase
          .from("account_transactions")
          .select(
            "id, user_id, account_id, kind, amount, delta, resulting_balance, note, related_account_id, related_account_name, source_type, source_id, created_at"
          )
          .eq("user_id", uidValue)
          .order("created_at", { ascending: false }),

        supabase
          .from("account_settings")
          .select("primary_account_id")
          .eq("user_id", uidValue)
          .maybeSingle(),

        supabase
          .from("bills")
          .select(
            "id, user_id, name, type, frequency, due_date, amount, active, balance, min_pay, extra_pay, apr_pct, category, notes, account_id, last_paid_date"
          )
          .eq("user_id", uidValue)
          .order("due_date", { ascending: true }),

        supabase
          .from("income_deposits")
          .select(
            "id, user_id, deposit_date, source, amount, note, account_id, account_name, created_at, updated_at"
          )
          .eq("user_id", uidValue)
          .order("deposit_date", { ascending: true }),
      ]);

      if (accountsRes.error) throw accountsRes.error;
      if (txRes.error) throw txRes.error;
      if (settingsRes.error) throw settingsRes.error;
      if (billsRes.error) throw billsRes.error;
      if (incomeRes.error) throw incomeRes.error;

      setAccounts(accountsRes.data || []);
      setTransactions(txRes.data || []);
      setBills(billsRes.data || []);
      setIncomeRows(incomeRes.data || []);
      setDefaultAccountId(settingsRes.data?.primary_account_id || "");
    } catch (err) {
      setPageError(err?.message || "Failed to load accounts page.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function run() {
      if (!mounted) return;
      await loadAccountsPage();
    }

    run();

    return () => {
      mounted = false;
    };
  }, [loadAccountsPage]);

  const summaryById = useMemo(
    () =>
      buildAccountSummaries({
        accounts,
        transactions,
        bills,
        incomeRows,
        defaultAccountId,
      }),
    [accounts, transactions, bills, incomeRows, defaultAccountId]
  );

  const totalCash = useMemo(
    () =>
      round2(
        accounts
          .filter((account) => isCashLikeAccount(account.account_type))
          .reduce((sum, account) => sum + safeNum(account.balance, 0), 0)
      ),
    [accounts]
  );

  const checkingTotal = useMemo(
    () =>
      round2(
        accounts
          .filter((account) =>
            String(account.account_type || "").toLowerCase().includes("checking")
          )
          .reduce((sum, account) => sum + safeNum(account.balance, 0), 0)
      ),
    [accounts]
  );

  const savingsTotal = useMemo(
    () =>
      round2(
        accounts
          .filter((account) =>
            String(account.account_type || "").toLowerCase().includes("savings")
          )
          .reduce((sum, account) => sum + safeNum(account.balance, 0), 0)
      ),
    [accounts]
  );

  const atRiskCount = useMemo(
    () => accounts.filter((account) => summaryById[account.id]?.atRisk).length,
    [accounts, summaryById]
  );

  const visibleAccounts = useMemo(() => {
    const q = accountSearch.trim().toLowerCase();

    const filtered = accounts.filter((account) => {
      const summary = summaryById[account.id];

      if (accountFilter === "at_risk" && !summary?.atRisk) return false;
      if (accountFilter !== "all" && accountFilter !== "at_risk") {
        if (!typeMatches(account.account_type, accountFilter)) return false;
      }

      if (!q) return true;

      return [account.name, normalizeAccountType(account.account_type)]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });

    const riskRank = { critical: 3, warning: 2, stable: 1 };

    return filtered.sort((a, b) => {
      const aPrimary = a.id === defaultAccountId ? 1 : 0;
      const bPrimary = b.id === defaultAccountId ? 1 : 0;
      if (aPrimary !== bPrimary) return bPrimary - aPrimary;

      const aRisk = riskRank[summaryById[a.id]?.riskLevel || "stable"] || 0;
      const bRisk = riskRank[summaryById[b.id]?.riskLevel || "stable"] || 0;
      if (aRisk !== bRisk) return bRisk - aRisk;

      return Math.abs(safeNum(b.balance, 0)) - Math.abs(safeNum(a.balance, 0));
    });
  }, [accounts, accountSearch, accountFilter, summaryById, defaultAccountId]);

  useEffect(() => {
    if (!visibleAccounts.length) {
      setSelectedAccountId("");
      return;
    }

    const exists = visibleAccounts.some((account) => account.id === selectedAccountId);
    if (!exists) {
      const preferred =
        visibleAccounts.find((account) => account.id === defaultAccountId) ||
        visibleAccounts[0];
      setSelectedAccountId(preferred.id);
    }
  }, [visibleAccounts, selectedAccountId, defaultAccountId]);

  const selectedAccount =
    accounts.find((account) => account.id === selectedAccountId) ||
    visibleAccounts[0] ||
    null;

  const selectedSummary = selectedAccount ? summaryById[selectedAccount.id] : null;
  const selectedRisk = riskMeta(selectedSummary);

  const selectedBars = useMemo(() => {
    if (!selectedSummary || !selectedAccount) return [];
    return buildBalanceBars(selectedSummary.transactions, selectedAccount.balance, 14);
  }, [selectedSummary, selectedAccount]);

  useEffect(() => {
    if (!selectedAccount) return;

    setTransferForm((prev) => {
      const keep =
        prev.toAccountId &&
        prev.toAccountId !== selectedAccount.id &&
        accounts.some((account) => account.id === prev.toAccountId);

      if (keep) return prev;
      return emptyTransferForm(selectedAccount.id, accounts);
    });

    setAdjustForm(emptyAdjustForm(selectedAccount));
  }, [selectedAccount, accounts]);

  useEffect(() => {
    if (selectedAccountId) setMobileSection("command");
  }, [selectedAccountId]);

  async function setPrimaryAccount() {
    if (!supabase || !userId || !selectedAccount || busy) return;

    setBusy(true);
    setPageError("");

    try {
      const { error } = await supabase.from("account_settings").upsert(
        {
          user_id: userId,
          primary_account_id: selectedAccount.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      if (error) throw error;

      setStatus("Primary account updated.");
      await loadAccountsPage();
    } catch (err) {
      setPageError(err?.message || "Could not set primary account.");
    } finally {
      setBusy(false);
    }
  }

  async function createAccount() {
    if (!supabase || !userId || busy) return;

    const name = String(createForm.name || "").trim();
    const safeBuffer = round2(parseMoneyInput(createForm.safe_buffer));
    const openingBalance = round2(parseMoneyInput(createForm.opening_balance));
    const hasOpeningText = String(createForm.opening_balance || "").trim() !== "";
    const allowNegativeOpening = allowsNegativeOpeningBalance(createForm.account_type);

    if (!name) {
      setPageError("Account name required.");
      return;
    }

    if (!Number.isFinite(safeBuffer) || safeBuffer < 0) {
      setPageError("Safe buffer must be 0 or greater.");
      return;
    }

    if (
      hasOpeningText &&
      (!Number.isFinite(openingBalance) ||
        (!allowNegativeOpening && openingBalance < 0))
    ) {
      setPageError(
        allowNegativeOpening
          ? "Enter a valid opening balance."
          : "Opening balance must be 0 or greater."
      );
      return;
    }

    setBusy(true);
    setPageError("");

    const accountId = uid();

    try {
      const { error: insertError } = await supabase.from("accounts").insert({
        id: accountId,
        user_id: userId,
        name,
        account_type: createForm.account_type || "checking",
        balance: 0,
        safe_buffer: round2(safeBuffer),
        updated_at: new Date().toISOString(),
      });

      if (insertError) throw insertError;

      const cleanOpening = Number.isFinite(openingBalance) ? openingBalance : 0;

      if (cleanOpening !== 0) {
        try {
          await writeAccountDelta({
            userId,
            accountId,
            delta: cleanOpening,
            kind: "opening_balance",
            amount: Math.abs(cleanOpening),
            note: "Opening balance",
            sourceType: "opening_balance",
            sourceId: accountId,
          });
        } catch (openingErr) {
          await supabase.from("accounts").delete().eq("id", accountId).eq("user_id", userId);
          throw openingErr;
        }
      }

      setCreateForm(emptyCreateForm());
      setOpenModal("");
      setStatus("Account created.");
      setSelectedAccountId(accountId);
      await loadAccountsPage();
    } catch (err) {
      setPageError(err?.message || "Could not create account.");
    } finally {
      setBusy(false);
    }
  }

  async function addManualAdjustment() {
    if (!supabase || !userId || !selectedAccount || busy) return;

    const rawAmount = round2(parseMoneyInput(adjustForm.amount));
    const note = String(adjustForm.note || "").trim();
    const parsedBuffer = round2(parseMoneyInput(adjustForm.safe_buffer));
    const hasBufferInput = Number.isFinite(parsedBuffer) && parsedBuffer >= 0;
    const balanceChangeValid = Number.isFinite(rawAmount) && rawAmount > 0;
    const signedDelta = balanceChangeValid
      ? adjustForm.mode === "subtract"
        ? -Math.abs(rawAmount)
        : Math.abs(rawAmount)
      : 0;

    const originalSafeBuffer = round2(safeNum(selectedAccount.safe_buffer, 150));
    const nextSafeBuffer = hasBufferInput ? parsedBuffer : originalSafeBuffer;
    const hasBufferChange = nextSafeBuffer !== originalSafeBuffer;
    const hasBalanceChange = signedDelta !== 0;

    if (!hasBalanceChange && !hasBufferChange) {
      setPageError("Enter an adjustment amount or change the safe buffer.");
      return;
    }

    if (!hasBufferInput) {
      setPageError("Enter a valid safe buffer.");
      return;
    }

    setBusy(true);
    setPageError("");

    try {
      if (hasBalanceChange) {
        await writeAccountDelta({
          userId,
          accountId: selectedAccount.id,
          delta: signedDelta,
          kind: adjustForm.mode === "subtract" ? "manual_debit" : "manual_credit",
          amount: Math.abs(rawAmount),
          note: note || "Manual adjustment",
          sourceType: "manual_adjustment",
          sourceId: uid(),
        });
      }

      if (hasBufferChange) {
        const { error } = await supabase
          .from("accounts")
          .update({
            safe_buffer: nextSafeBuffer,
            updated_at: new Date().toISOString(),
          })
          .eq("id", selectedAccount.id)
          .eq("user_id", userId);

        if (error) throw error;
      }

      setAdjustForm(emptyAdjustForm(selectedAccount));
      setOpenModal("");
      setStatus(hasBalanceChange ? "Adjustment applied." : "Safe buffer updated.");
      await loadAccountsPage();
    } catch (err) {
      setPageError(err?.message || "Could not apply changes.");
      await loadAccountsPage();
    } finally {
      setBusy(false);
    }
  }

  async function submitTransfer() {
    if (!userId || !selectedAccount || busy) return;

    const amount = round2(parseMoneyInput(transferForm.amount));
    const note = String(transferForm.note || "").trim();
    const target = accounts.find((account) => account.id === transferForm.toAccountId);

    if (!target || target.id === selectedAccount.id) {
      setPageError("Choose a different account for the transfer.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setPageError("Enter a valid transfer amount.");
      return;
    }

    setBusy(true);
    setPageError("");

    try {
      await writeAccountTransfer({
        userId,
        fromAccountId: selectedAccount.id,
        toAccountId: target.id,
        amount,
        note: note || `Transfer to ${target.name}`,
        sourceType: "manual_transfer",
        sourceId: uid(),
      });

      setTransferForm(emptyTransferForm(selectedAccount.id, accounts));
      setOpenModal("");
      setStatus("Transfer completed.");
      await loadAccountsPage();
    } catch (err) {
      setPageError(err?.message || "Could not complete transfer.");
      await loadAccountsPage();
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className={styles.page}>
        <GlassPane className={styles.gatePanel}>
          <div className={styles.gateText}>Loading account command…</div>
        </GlassPane>
      </main>
    );
  }

  if (!userId) {
    return (
      <main className={styles.page}>
        <GlassPane className={styles.gatePanel}>
          <div className={styles.gateText}>Sign in to use accounts.</div>
        </GlassPane>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <Toast error={pageError} status={status} onClearError={() => setPageError("")} />

      <SummaryStrip
        accounts={accounts}
        totalCash={totalCash}
        checkingTotal={checkingTotal}
        savingsTotal={savingsTotal}
        atRiskCount={atRiskCount}
        selectedAccount={selectedAccount}
        selectedSummary={selectedSummary}
        selectedRisk={selectedRisk}
      />

      <div className={styles.mobileTabs}>
        {[
          { value: "list", label: "Accounts" },
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
            visibleAccounts={visibleAccounts}
            summaryById={summaryById}
            selectedAccount={selectedAccount}
            onSelect={(accountId) => {
              setSelectedAccountId(accountId);
              setMobileSection("command");
            }}
            accountSearch={accountSearch}
            setAccountSearch={setAccountSearch}
            accountFilter={accountFilter}
            setAccountFilter={setAccountFilter}
            defaultAccountId={defaultAccountId}
          />
        </section>

        <section
          className={`${styles.workspaceCol} ${styles.mainCol} ${
            mobileSection === "command" ? styles.workspaceColShow : ""
          }`}
        >
          <FocusPane
            selectedAccount={selectedAccount}
            selectedSummary={selectedSummary}
            selectedBars={selectedBars}
            tab={tab}
            setTab={setTab}
            defaultAccountId={defaultAccountId}
            busy={busy}
            onCreate={() => {
              setCreateForm(emptyCreateForm());
              setOpenModal("create");
            }}
            onSetPrimary={setPrimaryAccount}
            onAdjust={() => {
              setAdjustForm(emptyAdjustForm(selectedAccount));
              setOpenModal("adjust");
            }}
            onTransfer={() => {
              setTransferForm(emptyTransferForm(selectedAccount?.id || "", accounts));
              setOpenModal("transfer");
            }}
          />
        </section>
      </div>

      <ModalShell
        open={openModal === "create"}
        title="Create Account"
        subcopy="Build the account shell now. Opening balance still routes through the shared ledger. Credit-style accounts can start below zero."
        onClose={() => setOpenModal("")}
        footer={
          <>
            <Button onClick={() => setOpenModal("")}>Cancel</Button>
            <Button variant="primary" onClick={createAccount} disabled={busy}>
              {busy ? "Saving…" : "Create"}
            </Button>
          </>
        }
      >
        <div className={styles.formGrid}>
          <label className={styles.fieldWrap}>
            <span>Account Name</span>
            <input
              className={styles.field}
              value={createForm.name}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Checking, emergency fund, credit card…"
            />
          </label>

          <label className={styles.fieldWrap}>
            <span>Account Type</span>
            <select
              className={styles.field}
              value={createForm.account_type}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, account_type: e.target.value }))
              }
            >
              <option value="checking">Checking</option>
              <option value="savings">Savings</option>
              <option value="cash">Cash</option>
              <option value="credit">Credit</option>
              <option value="investment">Investment</option>
            </select>
          </label>

          <label className={styles.fieldWrap}>
            <span>Opening Balance</span>
            <input
              className={styles.field}
              value={createForm.opening_balance}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, opening_balance: e.target.value }))
              }
              placeholder="0.00"
              inputMode="decimal"
            />
          </label>

          <label className={styles.fieldWrap}>
            <span>Safe Buffer</span>
            <input
              className={styles.field}
              value={createForm.safe_buffer}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, safe_buffer: e.target.value }))
              }
              placeholder="150.00"
              inputMode="decimal"
            />
          </label>
        </div>
      </ModalShell>

      <ModalShell
        open={openModal === "adjust"}
        title="Adjust Account / Safe Buffer"
        subcopy="Balance changes post through the ledger. Safe buffer changes update the account record only."
        onClose={() => setOpenModal("")}
        footer={
          <>
            <Button onClick={() => setOpenModal("")}>Cancel</Button>
            <Button variant="primary" onClick={addManualAdjustment} disabled={busy}>
              {busy ? "Saving…" : "Apply"}
            </Button>
          </>
        }
      >
        <div className={styles.toggleRow}>
          <Button
            variant={adjustForm.mode === "add" ? "primary" : "ghost"}
            onClick={() => setAdjustForm((prev) => ({ ...prev, mode: "add" }))}
          >
            Add
          </Button>
          <Button
            variant={adjustForm.mode === "subtract" ? "primary" : "ghost"}
            onClick={() => setAdjustForm((prev) => ({ ...prev, mode: "subtract" }))}
          >
            Subtract
          </Button>
        </div>

        <div className={styles.formGrid}>
          <label className={styles.fieldWrap}>
            <span>Adjustment Amount</span>
            <input
              className={styles.field}
              value={adjustForm.amount}
              onChange={(e) =>
                setAdjustForm((prev) => ({ ...prev, amount: e.target.value }))
              }
              placeholder="0.00"
              inputMode="decimal"
            />
          </label>

          <label className={styles.fieldWrap}>
            <span>Safe Buffer</span>
            <input
              className={styles.field}
              value={adjustForm.safe_buffer}
              onChange={(e) =>
                setAdjustForm((prev) => ({ ...prev, safe_buffer: e.target.value }))
              }
              placeholder="150.00"
              inputMode="decimal"
            />
          </label>
        </div>

        <label className={styles.fieldWrap}>
          <span>Note</span>
          <input
            className={styles.field}
            value={adjustForm.note}
            onChange={(e) => setAdjustForm((prev) => ({ ...prev, note: e.target.value }))}
            placeholder="Optional note…"
          />
        </label>
      </ModalShell>

      <ModalShell
        open={openModal === "transfer"}
        title="Transfer Between Accounts"
        subcopy="Moves cash through the shared transfer writer so both balances and both ledger rows stay aligned."
        onClose={() => setOpenModal("")}
        footer={
          <>
            <Button onClick={() => setOpenModal("")}>Cancel</Button>
            <Button variant="primary" onClick={submitTransfer} disabled={busy}>
              {busy ? "Sending…" : "Transfer"}
            </Button>
          </>
        }
      >
        <div className={styles.formGrid}>
          <label className={styles.fieldWrap}>
            <span>From</span>
            <input className={styles.field} value={selectedAccount?.name || ""} readOnly />
          </label>

          <label className={styles.fieldWrap}>
            <span>To</span>
            <select
              className={styles.field}
              value={transferForm.toAccountId}
              onChange={(e) =>
                setTransferForm((prev) => ({ ...prev, toAccountId: e.target.value }))
              }
            >
              <option value="">Choose account</option>
              {accounts
                .filter((account) => account.id !== selectedAccount?.id)
                .map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
            </select>
          </label>

          <label className={styles.fieldWrap}>
            <span>Amount</span>
            <input
              className={styles.field}
              value={transferForm.amount}
              onChange={(e) =>
                setTransferForm((prev) => ({ ...prev, amount: e.target.value }))
              }
              placeholder="0.00"
              inputMode="decimal"
            />
          </label>

          <label className={styles.fieldWrap}>
            <span>Note</span>
            <input
              className={styles.field}
              value={transferForm.note}
              onChange={(e) =>
                setTransferForm((prev) => ({ ...prev, note: e.target.value }))
              }
              placeholder="Optional note…"
            />
          </label>
        </div>
      </ModalShell>
    </main>
  );
}
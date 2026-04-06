import { supabase } from "@/lib/supabaseClient";

/**
 * STEP 1 MONEY ENGINE
 *
 * This is the single shared client-side balance / ledger writer.
 *
 * Important honesty:
 * - This is stronger than the old helper because every page can route through one file.
 * - It still is NOT a true SQL transaction.
 * - True database-atomic money posting should become an RPC / server-side transaction later.
 *
 * For now this file gives us:
 * - one balance mutation path
 * - one ledger write path
 * - shared rollback behavior on failure
 * - shared source_type / source_id tracing
 */

function round2(n) {
  return Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
}

function safeNum(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function uid() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

function ensureSupabase() {
  if (!supabase) {
    throw new Error("Supabase client is not available.");
  }
}

function normalizeTimestamp(value) {
  const d = value ? new Date(value) : new Date();
  if (!Number.isFinite(d.getTime())) {
    throw new Error("Invalid createdAt timestamp.");
  }
  return d.toISOString();
}

function requireUserId(userId) {
  if (!userId) throw new Error("Missing userId.");
}

function requireAccountId(accountId, label = "accountId") {
  if (!accountId) throw new Error(`Missing ${label}.`);
}

function normalizeLedgerAmount(amount, delta) {
  const explicit = Number(amount);
  if (Number.isFinite(explicit)) return round2(explicit);
  return round2(Math.abs(safeNum(delta, 0)));
}

async function getOwnedAccount(userId, accountId) {
  ensureSupabase();
  requireUserId(userId);
  requireAccountId(accountId);

  const res = await supabase
    .from("accounts")
    .select("id, user_id, name, account_type, balance, safe_buffer, updated_at")
    .eq("id", accountId)
    .eq("user_id", userId)
    .single();

  if (res.error || !res.data) {
    throw new Error("Account not found.");
  }

  return res.data;
}

async function getOwnedAccounts(userId, accountIds) {
  ensureSupabase();
  requireUserId(userId);

  const ids = [...new Set((accountIds || []).filter(Boolean))];
  if (!ids.length) return [];

  const res = await supabase
    .from("accounts")
    .select("id, user_id, name, account_type, balance, safe_buffer, updated_at")
    .eq("user_id", userId)
    .in("id", ids);

  if (res.error) {
    throw new Error(res.error.message || "Could not load accounts.");
  }

  const rows = res.data || [];
  if (rows.length !== ids.length) {
    throw new Error("One or more accounts were not found.");
  }

  return rows;
}

async function updateOwnedAccountBalance({
  userId,
  accountId,
  nextBalance,
  updatedAt,
}) {
  const res = await supabase
    .from("accounts")
    .update({
      balance: round2(nextBalance),
      updated_at: updatedAt,
    })
    .eq("id", accountId)
    .eq("user_id", userId);

  if (res.error) {
    throw new Error(res.error.message || "Could not update account balance.");
  }
}

async function revertOwnedAccountBalances(userId, snapshots) {
  if (!Array.isArray(snapshots) || !snapshots.length) return;

  for (const snapshot of snapshots) {
    try {
      await supabase
        .from("accounts")
        .update({
          balance: round2(snapshot.balance),
          updated_at: snapshot.updated_at || new Date().toISOString(),
        })
        .eq("id", snapshot.id)
        .eq("user_id", userId);
    } catch {
      // best effort rollback only
    }
  }
}

function buildLedgerRow({
  userId,
  accountId,
  kind,
  amount,
  delta,
  resultingBalance,
  note = "",
  relatedAccountId = null,
  relatedAccountName = null,
  sourceType = "manual_entry",
  sourceId = null,
  createdAt,
}) {
  return {
    id: uid(),
    user_id: userId,
    account_id: accountId,
    kind: kind || "entry",
    amount: normalizeLedgerAmount(amount, delta),
    delta: round2(delta),
    resulting_balance: round2(resultingBalance),
    note: note || kind || "",
    related_account_id: relatedAccountId,
    related_account_name: relatedAccountName,
    source_type: sourceType || "manual_entry",
    source_id: sourceId || uid(),
    created_at: createdAt,
  };
}

/**
 * Generic shared batch writer.
 *
 * entries shape:
 * [
 *   {
 *     accountId,
 *     delta,
 *     kind,
 *     amount,
 *     note,
 *     relatedAccountId,
 *     relatedAccountName
 *   }
 * ]
 */
export async function writeAccountBatch({
  userId,
  entries,
  sourceType = "manual_batch",
  sourceId = null,
  createdAt = new Date().toISOString(),
}) {
  ensureSupabase();
  requireUserId(userId);

  const list = Array.isArray(entries) ? entries.filter(Boolean) : [];
  if (!list.length) {
    throw new Error("No account entries were provided.");
  }

  const isoCreatedAt = normalizeTimestamp(createdAt);
  const sharedSourceId = sourceId || uid();

  const accountIds = list.map((entry) => {
    requireAccountId(entry.accountId);
    return entry.accountId;
  });

  const ownedAccounts = await getOwnedAccounts(userId, accountIds);
  const accountsById = new Map(ownedAccounts.map((row) => [row.id, row]));

  const originalSnapshots = ownedAccounts.map((row) => ({
    id: row.id,
    balance: round2(safeNum(row.balance, 0)),
    updated_at: row.updated_at || isoCreatedAt,
  }));

  const workingBalances = new Map(
    ownedAccounts.map((row) => [row.id, round2(safeNum(row.balance, 0))])
  );

  const finalBalances = new Map();
  const ledgerRows = [];

  for (const entry of list) {
    const account = accountsById.get(entry.accountId);
    if (!account) {
      throw new Error("Account not found.");
    }

    const cleanDelta = round2(safeNum(entry.delta, 0));
    const previousBalance = round2(workingBalances.get(entry.accountId));
    const nextBalance = round2(previousBalance + cleanDelta);

    workingBalances.set(entry.accountId, nextBalance);
    finalBalances.set(entry.accountId, nextBalance);

    ledgerRows.push(
      buildLedgerRow({
        userId,
        accountId: entry.accountId,
        kind: entry.kind,
        amount: entry.amount,
        delta: cleanDelta,
        resultingBalance: nextBalance,
        note: entry.note,
        relatedAccountId: entry.relatedAccountId ?? null,
        relatedAccountName: entry.relatedAccountName ?? null,
        sourceType,
        sourceId: sharedSourceId,
        createdAt: isoCreatedAt,
      })
    );
  }

  const touchedAccounts = [...finalBalances.entries()].map(([accountId, balance]) => ({
    accountId,
    balance,
  }));

  try {
    for (const touched of touchedAccounts) {
      await updateOwnedAccountBalance({
        userId,
        accountId: touched.accountId,
        nextBalance: touched.balance,
        updatedAt: isoCreatedAt,
      });
    }

    const insertRes = await supabase
      .from("account_transactions")
      .insert(ledgerRows)
      .select(
        "id, user_id, account_id, kind, amount, delta, resulting_balance, note, related_account_id, related_account_name, source_type, source_id, created_at"
      );

    if (insertRes.error) {
      throw new Error(
        insertRes.error.message || "Could not insert account transaction rows."
      );
    }

    const updatedAccounts = ownedAccounts.map((account) => ({
      ...account,
      balance: finalBalances.has(account.id)
        ? round2(finalBalances.get(account.id))
        : round2(safeNum(account.balance, 0)),
      updated_at: isoCreatedAt,
    }));

    return {
      ok: true,
      sourceId: sharedSourceId,
      accounts: updatedAccounts,
      transactions: insertRes.data || [],
      accountMap: Object.fromEntries(
        updatedAccounts.map((account) => [account.id, account])
      ),
    };
  } catch (error) {
    await revertOwnedAccountBalances(userId, originalSnapshots);
    throw error;
  }
}

export async function writeAccountDelta({
  userId,
  accountId,
  delta,
  kind,
  amount,
  note = "",
  sourceType = "manual_entry",
  sourceId = null,
  relatedAccountId = null,
  relatedAccountName = null,
  createdAt = new Date().toISOString(),
}) {
  requireAccountId(accountId);

  const result = await writeAccountBatch({
    userId,
    sourceType,
    sourceId,
    createdAt,
    entries: [
      {
        accountId,
        delta,
        kind,
        amount,
        note,
        relatedAccountId,
        relatedAccountName,
      },
    ],
  });

  const account = result.accountMap[accountId] || null;
  const transaction = result.transactions?.[0] || null;

  return {
    ok: true,
    sourceId: result.sourceId,
    account,
    transaction,
    accounts: result.accounts,
    transactions: result.transactions,
  };
}

export async function writeAccountTransfer({
  userId,
  fromAccountId,
  toAccountId,
  amount,
  note = "",
  sourceType = "manual_transfer",
  sourceId = null,
  createdAt = new Date().toISOString(),
}) {
  ensureSupabase();
  requireUserId(userId);
  requireAccountId(fromAccountId, "fromAccountId");
  requireAccountId(toAccountId, "toAccountId");

  if (fromAccountId === toAccountId) {
    throw new Error("Transfer accounts must differ.");
  }

  const cleanAmount = round2(safeNum(amount, 0));
  if (!Number.isFinite(cleanAmount) || cleanAmount <= 0) {
    throw new Error("Transfer amount must be greater than zero.");
  }

  const [fromAccount, toAccount] = await Promise.all([
    getOwnedAccount(userId, fromAccountId),
    getOwnedAccount(userId, toAccountId),
  ]);

  const result = await writeAccountBatch({
    userId,
    sourceType,
    sourceId: sourceId || uid(),
    createdAt,
    entries: [
      {
        accountId: fromAccountId,
        delta: -cleanAmount,
        kind: "transfer_out",
        amount: cleanAmount,
        note: note || `Transfer to ${toAccount.name || "destination account"}`,
        relatedAccountId: toAccount.id,
        relatedAccountName: toAccount.name || "",
      },
      {
        accountId: toAccountId,
        delta: cleanAmount,
        kind: "transfer_in",
        amount: cleanAmount,
        note: note || `Transfer from ${fromAccount.name || "source account"}`,
        relatedAccountId: fromAccount.id,
        relatedAccountName: fromAccount.name || "",
      },
    ],
  });

  return {
    ok: true,
    sourceId: result.sourceId,
    fromAccount: result.accountMap[fromAccountId] || null,
    toAccount: result.accountMap[toAccountId] || null,
    accounts: result.accounts,
    transactions: result.transactions,
  };
}

/**
 * Shared income posting helper for paycheck splits.
 *
 * splits shape:
 * [
 *   { accountId, amount, accountName? }
 * ]
 */
export async function writeIncomeDepositSplits({
  userId,
  splits,
  source = "Income",
  note = "",
  sourceType = "income_deposit",
  sourceId = null,
  createdAt = new Date().toISOString(),
}) {
  ensureSupabase();
  requireUserId(userId);

  const cleanSplits = Array.isArray(splits)
    ? splits
        .filter((split) => split?.accountId && safeNum(split.amount, 0) > 0)
        .map((split) => ({
          accountId: split.accountId,
          amount: round2(split.amount),
          accountName: split.accountName || "",
        }))
    : [];

  if (!cleanSplits.length) {
    throw new Error("No valid income splits were provided.");
  }

  const accounts = await getOwnedAccounts(
    userId,
    cleanSplits.map((split) => split.accountId)
  );
  const namesById = new Map(accounts.map((account) => [account.id, account.name || "Account"]));

  const result = await writeAccountBatch({
    userId,
    sourceType,
    sourceId: sourceId || uid(),
    createdAt,
    entries: cleanSplits.map((split) => ({
      accountId: split.accountId,
      delta: round2(split.amount),
      kind: "income",
      amount: round2(split.amount),
      note: `${source || "Income"}${note ? ` • ${note}` : ""}`,
      relatedAccountId: null,
      relatedAccountName: split.accountName || namesById.get(split.accountId) || "",
    })),
  });

  return {
    ok: true,
    sourceId: result.sourceId,
    totalAmount: round2(
      cleanSplits.reduce((sum, split) => sum + safeNum(split.amount, 0), 0)
    ),
    splits: cleanSplits.map((split) => ({
      ...split,
      accountName: split.accountName || namesById.get(split.accountId) || "Account",
    })),
    accounts: result.accounts,
    transactions: result.transactions,
  };
}

/**
 * Backward-friendly aliases so page rewrites can move over cleanly.
 */
export const applyAccountDelta = writeAccountDelta;
export const applyAccountTransfer = writeAccountTransfer;
export const postIncomeDepositSplits = writeIncomeDepositSplits;

export {
  getOwnedAccount,
  getOwnedAccounts,
  round2,
  safeNum,
  uid as createSourceId,
};
import { supabase } from "@/lib/supabaseClient";

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

async function getOwnedAccount(userId, accountId) {
  const res = await supabase
    .from("accounts")
    .select("id, user_id, name, balance, updated_at")
    .eq("id", accountId)
    .eq("user_id", userId)
    .single();

  if (res.error || !res.data) {
    throw new Error("Account not found.");
  }

  return res.data;
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
  if (!supabase) throw new Error("Supabase client is not available.");
  if (!userId) throw new Error("Missing userId.");
  if (!accountId) throw new Error("Missing accountId.");

  const account = await getOwnedAccount(userId, accountId);
  const nextBalance = round2(safeNum(account.balance, 0) + safeNum(delta, 0));
  const effectiveAmount = round2(
    Number.isFinite(Number(amount)) ? amount : Math.abs(safeNum(delta, 0))
  );

  const updateRes = await supabase
    .from("accounts")
    .update({
      balance: nextBalance,
      updated_at: createdAt,
    })
    .eq("id", accountId)
    .eq("user_id", userId);

  if (updateRes.error) {
    throw new Error(updateRes.error.message || "Could not update account balance.");
  }

  const insertRes = await supabase
    .from("account_transactions")
    .insert({
      user_id: userId,
      account_id: accountId,
      kind,
      amount: effectiveAmount,
      delta: round2(delta),
      resulting_balance: nextBalance,
      note: note || kind,
      related_account_id: relatedAccountId,
      related_account_name: relatedAccountName,
      source_type: sourceType,
      source_id: sourceId || uid(),
      created_at: createdAt,
    })
    .select(
      "id, user_id, account_id, kind, amount, delta, resulting_balance, note, related_account_id, related_account_name, source_type, source_id, created_at"
    )
    .single();

  if (insertRes.error) {
    throw new Error(insertRes.error.message || "Could not insert account transaction.");
  }

  return {
    account: {
      ...account,
      balance: nextBalance,
      updated_at: createdAt,
    },
    transaction: insertRes.data,
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
  if (!supabase) throw new Error("Supabase client is not available.");
  if (!userId) throw new Error("Missing userId.");
  if (!fromAccountId || !toAccountId) throw new Error("Missing transfer account id.");
  if (fromAccountId === toAccountId) throw new Error("Transfer accounts must differ.");

  const cleanAmount = round2(amount);
  if (!Number.isFinite(cleanAmount) || cleanAmount <= 0) {
    throw new Error("Transfer amount must be greater than zero.");
  }

  const [fromAccount, toAccount] = await Promise.all([
    getOwnedAccount(userId, fromAccountId),
    getOwnedAccount(userId, toAccountId),
  ]);

  const fromNextBalance = round2(safeNum(fromAccount.balance, 0) - cleanAmount);
  const toNextBalance = round2(safeNum(toAccount.balance, 0) + cleanAmount);
  const sharedSourceId = sourceId || uid();

  const fromUpdate = await supabase
    .from("accounts")
    .update({
      balance: fromNextBalance,
      updated_at: createdAt,
    })
    .eq("id", fromAccountId)
    .eq("user_id", userId);

  if (fromUpdate.error) {
    throw new Error(fromUpdate.error.message || "Could not update source account.");
  }

  const toUpdate = await supabase
    .from("accounts")
    .update({
      balance: toNextBalance,
      updated_at: createdAt,
    })
    .eq("id", toAccountId)
    .eq("user_id", userId);

  if (toUpdate.error) {
    throw new Error(toUpdate.error.message || "Could not update destination account.");
  }

  const txInsert = await supabase
    .from("account_transactions")
    .insert([
      {
        user_id: userId,
        account_id: fromAccountId,
        kind: "transfer_out",
        amount: cleanAmount,
        delta: -cleanAmount,
        resulting_balance: fromNextBalance,
        note: note || `Transfer to ${toAccount.name}`,
        related_account_id: toAccount.id,
        related_account_name: toAccount.name || "",
        source_type: sourceType,
        source_id: sharedSourceId,
        created_at: createdAt,
      },
      {
        user_id: userId,
        account_id: toAccountId,
        kind: "transfer_in",
        amount: cleanAmount,
        delta: cleanAmount,
        resulting_balance: toNextBalance,
        note: note || `Transfer from ${fromAccount.name}`,
        related_account_id: fromAccount.id,
        related_account_name: fromAccount.name || "",
        source_type: sourceType,
        source_id: sharedSourceId,
        created_at: createdAt,
      },
    ])
    .select(
      "id, user_id, account_id, kind, amount, delta, resulting_balance, note, related_account_id, related_account_name, source_type, source_id, created_at"
    );

  if (txInsert.error) {
    throw new Error(txInsert.error.message || "Could not insert transfer ledger rows.");
  }

  return {
    fromAccount: {
      ...fromAccount,
      balance: fromNextBalance,
      updated_at: createdAt,
    },
    toAccount: {
      ...toAccount,
      balance: toNextBalance,
      updated_at: createdAt,
    },
    transactions: txInsert.data || [],
  };
}
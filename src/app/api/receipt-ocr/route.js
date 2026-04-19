import { NextResponse } from "next/server";
import {
  buildReceiptStoragePath,
  buildReceiptTransactionPayload,
  callReceiptOcr,
  createSignedReceiptUrl,
  findMatchingAccountByLast4,
  loadTransactionCandidates,
  normalizeMerchant,
  postReceiptExpenseLedger,
  scoreTransactionReceiptMatch,
} from "@/lib/receiptPipeline";
import {
  createSupabaseAdminClient,
  createSupabaseRequestClient,
} from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function uid() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function round2(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

function jsonError(message, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

async function getRequestContext(request) {
  const authorization = request.headers.get("authorization") || "";
  const requestClient = createSupabaseRequestClient(authorization);

  let admin = null;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    admin = null;
  }

  const {
    data: { user },
    error,
  } = await requestClient.auth.getUser();

  if (error || !user?.id) {
    throw new Error("Unauthorized receipt request.");
  }

  const db = admin || requestClient;
  const storage = admin || requestClient;

  return { authorization, requestClient, admin, db, storage, user };
}

function buildCandidatePreview(transaction, receipt) {
  return {
    id: transaction.id,
    merchant: transaction.merchant || transaction.note || "Transaction",
    amount: round2(transaction.amount),
    txDate: transaction.tx_date || "",
    date: transaction.tx_date || "",
    paymentMethod: transaction.payment_method || "",
    cardLast4: transaction.card_last4 || "",
    sourceType: transaction.source_type || "manual",
    score: scoreTransactionReceiptMatch(transaction, receipt),
  };
}

async function handlePreview(request) {
  const { db, storage, user } = await getRequestContext(request);
  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || typeof file.arrayBuffer !== "function") {
    return jsonError("Missing receipt file.", 400);
  }

  const fileName = file.name || "receipt.jpg";
  const contentType = file.type || "image/jpeg";
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const bucketName = process.env.SUPABASE_RECEIPTS_BUCKET || "receipts";
  const storagePath = buildReceiptStoragePath(user.id, fileName);

  const { error: uploadError } = await storage.storage
    .from(bucketName)
    .upload(storagePath, fileBuffer, {
      contentType,
      upsert: false,
      cacheControl: "3600",
    });

  if (uploadError) {
    return jsonError(uploadError.message || "Could not upload receipt image.", 500);
  }

  const receipt = await callReceiptOcr({
    fileBuffer,
    fileName,
    contentType,
  });

  const matchedAccount = await findMatchingAccountByLast4(db, user.id, receipt.cardLast4);
  const imageUrl = await createSignedReceiptUrl(storage, bucketName, storagePath);
  const receiptId = uid();

  const receiptRow = {
    id: receiptId,
    user_id: user.id,
    storage_path: storagePath,
    image_url: imageUrl,
    ocr_status: "parsed",
    merchant_raw: receipt.merchantRaw || "",
    merchant_normalized: receipt.merchantNormalized || normalizeMerchant(receipt.merchantRaw || ""),
    receipt_total: round2(receipt.total),
    receipt_date: receipt.receiptDate || null,
    card_last4: receipt.cardLast4 || null,
    matched_transaction_id: null,
    matched_account_id: matchedAccount?.id || null,
    source_confidence: null,
    raw_ocr_json: receipt.rawOcrJson || {},
  };

  const { error: receiptInsertError } = await db
    .from("spending_receipts")
    .insert([receiptRow]);

  if (receiptInsertError) {
    return jsonError(receiptInsertError.message || "Could not save receipt metadata.", 500);
  }

  const itemRows = (receipt.items || []).map((item) => ({
    id: uid(),
    receipt_id: receiptId,
    user_id: user.id,
    name: item.name || "Receipt item",
    qty: Number(item.qty) || 1,
    unit_price: item.unitPrice ?? null,
    line_total: item.lineTotal ?? null,
    category_guess: item.categoryGuess || null,
    need_want: item.needWant || null,
    price_score: item.priceScore || null,
  }));

  if (itemRows.length) {
    const { error: itemsError } = await db
      .from("spending_receipt_items")
      .insert(itemRows);

    if (itemsError) {
      return jsonError(itemsError.message || "Could not save receipt items.", 500);
    }
  }

  const candidatesRaw = await loadTransactionCandidates(db, user.id, receipt.receiptDate);
  const candidates = candidatesRaw
    .map((transaction) => buildCandidatePreview(transaction, receipt))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const suggestedMatch = candidates.find((entry) => entry.score >= 70) || candidates[0] || null;

  return NextResponse.json({
    ok: true,
    receipt: {
      receiptId,
      merchant: receipt.merchantRaw || "",
      total: round2(receipt.total),
      receiptDate: receipt.receiptDate || "",
      cardLast4: receipt.cardLast4 || "",
      imageUrl,
      matchedAccountId: matchedAccount?.id || "",
      matchedAccountName: matchedAccount?.name || "",
      items: receipt.items || [],
      breakdown: receipt.breakdown || null,
      candidates,
      suggestedMatchId: suggestedMatch?.id || "",
    },
  });
}

async function handleCommit(request) {
  const { db, user } = await getRequestContext(request);
  const body = await request.json();

  const receiptId = String(body?.receiptId || "").trim();
  const commitMode = String(body?.commitMode || "create").trim();
  const transactionId = String(body?.transactionId || "").trim();
  const merchant = String(body?.merchant || "").trim();
  const total = round2(body?.total);
  const receiptDate = String(body?.receiptDate || "").trim();
  const cardLast4 = String(body?.cardLast4 || "").trim();

  if (!receiptId) {
    return jsonError("Missing receipt id.", 400);
  }

  const { data: existingReceipt, error: receiptError } = await db
    .from("spending_receipts")
    .select("*")
    .eq("id", receiptId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (receiptError || !existingReceipt) {
    return jsonError("Receipt not found.", 404);
  }

  const matchedAccount = await findMatchingAccountByLast4(db, user.id, cardLast4 || existingReceipt.card_last4 || "");
  const normalizedMerchant = normalizeMerchant(merchant || existingReceipt.merchant_raw || "");

  const receiptPatch = {
    merchant_raw: merchant || existingReceipt.merchant_raw || "",
    merchant_normalized: normalizedMerchant || null,
    receipt_total: total || existingReceipt.receipt_total || 0,
    receipt_date: receiptDate || existingReceipt.receipt_date || null,
    card_last4: cardLast4 || existingReceipt.card_last4 || null,
    matched_account_id: matchedAccount?.id || null,
    updated_at: new Date().toISOString(),
  };

  if (commitMode === "receipt_only") {
    const { error: updateError } = await db
      .from("spending_receipts")
      .update({
        ...receiptPatch,
        ocr_status: "saved",
      })
      .eq("id", receiptId)
      .eq("user_id", user.id);

    if (updateError) {
      return jsonError(updateError.message || "Could not save receipt.", 500);
    }

    return NextResponse.json({ ok: true, match: { transactionId: null } });
  }

  if (commitMode === "match") {
    if (!transactionId) {
      return jsonError("Choose a transaction to match.", 400);
    }

    const txPatch = {
      receipt_id: receiptId,
      match_status: "receipt_matched",
      merchant_normalized: normalizedMerchant || null,
    };

    if (cardLast4) txPatch.card_last4 = cardLast4;

    const { error: txError } = await db
      .from("spending_transactions")
      .update(txPatch)
      .eq("id", transactionId)
      .eq("user_id", user.id);

    if (txError) {
      return jsonError(txError.message || "Could not match receipt to transaction.", 500);
    }

    const { error: receiptUpdateError } = await db
      .from("spending_receipts")
      .update({
        ...receiptPatch,
        matched_transaction_id: transactionId,
        ocr_status: "matched",
      })
      .eq("id", receiptId)
      .eq("user_id", user.id);

    if (receiptUpdateError) {
      return jsonError(receiptUpdateError.message || "Could not update receipt match.", 500);
    }

    return NextResponse.json({ ok: true, match: { transactionId } });
  }

  const receiptModel = {
    merchantRaw: merchant || existingReceipt.merchant_raw || "Receipt scan",
    merchantNormalized: normalizedMerchant || null,
    total: total || existingReceipt.receipt_total || 0,
    receiptDate: receiptDate || existingReceipt.receipt_date || null,
    cardLast4: cardLast4 || existingReceipt.card_last4 || "",
    guessedCategoryId: "misc",
  };

  const txPayload = buildReceiptTransactionPayload({
    userId: user.id,
    receiptId,
    receipt: receiptModel,
    matchedAccount,
  });

  const { data: createdTx, error: createError } = await db
    .from("spending_transactions")
    .insert([txPayload])
    .select("id,amount,merchant,tx_date,account_name,card_last4,created_at")
    .single();

  if (createError || !createdTx) {
    return jsonError(createError?.message || "Could not create transaction from receipt.", 500);
  }

  if (matchedAccount) {
    await postReceiptExpenseLedger({
      supabaseAdmin: db,
      userId: user.id,
      account: matchedAccount,
      transaction: {
        ...txPayload,
        ...createdTx,
      },
    });
  }

  const { error: finalReceiptError } = await db
    .from("spending_receipts")
    .update({
      ...receiptPatch,
      matched_transaction_id: createdTx.id,
      ocr_status: "created",
    })
    .eq("id", receiptId)
    .eq("user_id", user.id);

  if (finalReceiptError) {
    return jsonError(finalReceiptError.message || "Could not finalize receipt transaction.", 500);
  }

  return NextResponse.json({
    ok: true,
    match: {
      transactionId: createdTx.id,
    },
  });
}

export async function POST(request) {
  try {
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      return await handlePreview(request);
    }

    if (contentType.includes("application/json")) {
      return await handleCommit(request);
    }

    return jsonError("Unsupported receipt request type.", 415);
  } catch (error) {
    return jsonError(error?.message || "Receipt OCR request failed.", 500);
  }
}

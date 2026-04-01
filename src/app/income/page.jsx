"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  BadgeDollarSign,
  CalendarClock,
  Copy,
  Landmark,
  MoreHorizontal,
  Plus,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import GlassPane from "../components/GlassPane";

const META_PREFIX = "__LCC_META__";

function uid() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

function round2(n) {
  return Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
}

function safeNum(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function parseMoneyInput(v) {
  const cleaned = String(v ?? "").replace(/[^0-9.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : NaN;
}

function fmtMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "$0";
  return num.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function fmtMoneyTight(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "$0.00";
  return num.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

function fmtWhen(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatAgo(value) {
  if (!value) return "—";
  const ms = Date.now() - new Date(value).getTime();
  const minutes = Math.round(ms / 60000);

  if (!Number.isFinite(minutes)) return "—";
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function monthInputToday() {
  return new Date().toISOString().slice(0, 7);
}

function dateInputToday() {
  return new Date().toISOString().slice(0, 10);
}

function monthKeyOf(dateValue) {
  if (!dateValue) return "";
  return String(dateValue).slice(0, 7);
}

function prettyMonth(monthKey) {
  if (!monthKey) return "No month";
  const [year, month] = String(monthKey).split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  if (!Number.isFinite(d.getTime())) return monthKey;
  return d.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function shortDate(dateValue) {
  if (!dateValue) return "—";
  const d = new Date(`${dateValue}T12:00:00`);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isFutureDate(dateValue) {
  if (!dateValue) return false;
  const target = new Date(`${dateValue}T12:00:00`);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  return target.getTime() > today.getTime();
}

function sourceInitial(source = "") {
  const clean = String(source).trim();
  return clean ? clean[0].toUpperCase() : "I";
}

function toneMeta(tone = "neutral") {
  if (tone === "green") {
    return {
      text: "#97efc7",
      border: "rgba(143, 240, 191, 0.18)",
      glow: "rgba(110, 229, 173, 0.10)",
      bg: "rgba(11, 22, 17, 0.66)",
    };
  }

  if (tone === "blue") {
    return {
      text: "#bcd7ff",
      border: "rgba(143, 177, 255, 0.18)",
      glow: "rgba(110, 163, 255, 0.10)",
      bg: "rgba(10, 16, 28, 0.66)",
    };
  }

  if (tone === "amber") {
    return {
      text: "#f5cf88",
      border: "rgba(255, 204, 112, 0.18)",
      glow: "rgba(255, 194, 92, 0.10)",
      bg: "rgba(22, 17, 11, 0.66)",
    };
  }

  if (tone === "red") {
    return {
      text: "#ffb4c5",
      border: "rgba(255, 132, 163, 0.18)",
      glow: "rgba(255, 108, 145, 0.10)",
      bg: "rgba(22, 11, 15, 0.66)",
    };
  }

  return {
    text: "#f7fbff",
    border: "rgba(214, 226, 255, 0.14)",
    glow: "rgba(140, 170, 255, 0.08)",
    bg: "rgba(10, 15, 24, 0.66)",
  };
}

function MiniPill({ children, tone = "neutral" }) {
  const meta = toneMeta(tone);

  return (
    <div
      style={{
        minHeight: 30,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "0 10px",
        borderRadius: 999,
        border: `1px solid ${meta.border}`,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012))",
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.03), 0 0 10px ${meta.glow}`,
        color: tone === "neutral" ? "rgba(255,255,255,0.88)" : meta.text,
        fontSize: 11,
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
  );
}

function PaneHeader({ title, subcopy, right }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 10,
        flexWrap: "wrap",
        marginBottom: 10,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 17,
            lineHeight: 1.08,
            fontWeight: 850,
            letterSpacing: "-0.035em",
            color: "#fff",
          }}
        >
          {title}
        </div>

        {subcopy ? (
          <div
            style={{
              marginTop: 3,
              fontSize: 12,
              lineHeight: 1.45,
              color: "rgba(255,255,255,0.60)",
            }}
          >
            {subcopy}
          </div>
        ) : null}
      </div>

      {right || null}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, detail, tone = "neutral" }) {
  const meta = toneMeta(tone);

  return (
    <GlassPane
      tone={tone === "blue" ? "neutral" : tone}
      size="card"
      style={{ height: "100%" }}
    >
      <div
        style={{
          minHeight: 112,
          display: "grid",
          gridTemplateRows: "auto auto 1fr",
          gap: 7,
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 12,
            display: "grid",
            placeItems: "center",
            border: `1px solid ${meta.border}`,
            background: meta.bg,
            color: tone === "neutral" ? "#fff" : meta.text,
            boxShadow: `0 0 10px ${meta.glow}`,
          }}
        >
          <Icon size={15} />
        </div>

        <div>
          <div
            style={{
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: ".2em",
              fontWeight: 800,
              color: "rgba(255,255,255,0.40)",
            }}
          >
            {label}
          </div>

          <div
            style={{
              marginTop: 8,
              fontSize: "clamp(18px, 2.2vw, 28px)",
              lineHeight: 1,
              fontWeight: 850,
              letterSpacing: "-0.05em",
              color: tone === "neutral" ? "#fff" : meta.text,
            }}
          >
            {value}
          </div>
        </div>

        <div
          style={{
            fontSize: 11.5,
            lineHeight: 1.4,
            color: "rgba(255,255,255,0.60)",
          }}
        >
          {detail}
        </div>
      </div>
    </GlassPane>
  );
}

function ActionBtn({
  children,
  onClick,
  variant = "ghost",
  full = false,
  type = "button",
  disabled = false,
}) {
  const isPrimary = variant === "primary";
  const isDanger = variant === "danger";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="incomeActionBtn"
      style={{
        width: full ? "100%" : undefined,
        border: isDanger
          ? "1px solid rgba(255,132,163,0.18)"
          : isPrimary
          ? "1px solid rgba(143,177,255,0.18)"
          : "1px solid rgba(214,226,255,0.10)",
        background: isDanger
          ? "linear-gradient(180deg, rgba(255,132,163,0.10), rgba(255,132,163,0.05))"
          : isPrimary
          ? "linear-gradient(180deg, rgba(143,177,255,0.14), rgba(143,177,255,0.06))"
          : "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012))",
        color: isDanger ? "#ffd3df" : "#f7fbff",
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

function ProgressBar({ fill = 0, tone = "neutral" }) {
  const normalized = Math.max(0, Math.min(100, safeNum(fill)));
  const toneMap = {
    neutral: "linear-gradient(90deg, rgba(96,165,250,.95), rgba(147,197,253,.95))",
    green: "linear-gradient(90deg, rgba(74,222,128,.95), rgba(167,243,208,.95))",
    blue: "linear-gradient(90deg, rgba(96,165,250,.95), rgba(191,219,254,.95))",
    amber: "linear-gradient(90deg, rgba(251,191,36,.95), rgba(253,230,138,.95))",
    red: "linear-gradient(90deg, rgba(248,113,113,.95), rgba(252,165,165,.95))",
  };

  return (
    <div className="incomeProgress">
      <div
        className="incomeProgressFill"
        style={{
          width: `${normalized}%`,
          background: toneMap[tone] || toneMap.neutral,
        }}
      />
    </div>
  );
}

function emptySplitLine(defaultAccountId = "") {
  return {
    id: uid(),
    accountId: defaultAccountId || "",
    amount: "",
  };
}

function getAccountName(accounts, accountId) {
  return accounts.find((a) => a.id === accountId)?.name || "Account";
}

function getSplitTotal(lines) {
  return round2(
    lines.reduce((sum, line) => {
      return sum + safeNum(parseMoneyInput(line.amount), 0);
    }, 0)
  );
}

function sanitizeMeta(meta = {}) {
  const clean = {};

  if (meta.status === "scheduled") {
    clean.status = "scheduled";
  }

  if (Array.isArray(meta.splits) && meta.splits.length) {
    clean.splits = meta.splits
      .filter((split) => split?.accountId && safeNum(split.amount, 0) > 0)
      .map((split) => ({
        accountId: split.accountId,
        accountName: split.accountName || "",
        amount: round2(split.amount),
      }));
  }

  if (meta.posted) clean.posted = true;
  if (meta.postedAt) clean.postedAt = meta.postedAt;

  return clean;
}

function encodeStoredNote(userNote, meta = {}) {
  const cleanNote = String(userNote ?? "").trim();
  const cleanMeta = sanitizeMeta(meta);

  if (!Object.keys(cleanMeta).length) {
    return cleanNote || null;
  }

  const payload = encodeURIComponent(JSON.stringify(cleanMeta));
  return `${cleanNote ? `${cleanNote}\n\n` : ""}${META_PREFIX}${payload}`;
}

function extractStoredNote(rawNote) {
  const text = String(rawNote ?? "");
  const idx = text.indexOf(META_PREFIX);

  if (idx === -1) {
    return { userNote: text, meta: {} };
  }

  const userNote = text.slice(0, idx).trimEnd();
  const payload = text.slice(idx + META_PREFIX.length);

  try {
    const parsed = JSON.parse(decodeURIComponent(payload));
    return { userNote, meta: parsed || {} };
  } catch {
    return { userNote, meta: {} };
  }
}

function mapIncomeRow(row) {
  const { userNote, meta } = extractStoredNote(row.note);
  const status =
    meta?.status === "scheduled"
      ? "scheduled"
      : isFutureDate(row.deposit_date)
      ? "scheduled"
      : "received";

  return {
    id: row.id,
    user_id: row.user_id,
    source: row.source ?? "",
    amount: safeNum(row.amount, 0),
    note: userNote ?? "",
    deposit_date: row.deposit_date ?? dateInputToday(),
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
    status,
    posted: !!meta?.posted,
    postedAt: meta?.postedAt ?? null,
    splits: Array.isArray(meta?.splits)
      ? meta.splits.map((split) => ({
          accountId: split.accountId,
          accountName: split.accountName || "",
          amount: safeNum(split.amount, 0),
        }))
      : [],
  };
}

function mapIncomeToRow(item, userId) {
  return {
    user_id: userId,
    source: item.source ?? "",
    amount: safeNum(item.amount, 0),
    note: encodeStoredNote(item.note, {
      status: item.status,
      posted: item.posted,
      postedAt: item.postedAt,
      splits: item.splits,
    }),
    deposit_date: item.deposit_date || dateInputToday(),
  };
}

function isScheduledItem(item) {
  return item?.status === "scheduled";
}

function splitSummaryText(item) {
  if (!item?.splits?.length) return "No split plan";
  if (item.splits.length === 1) {
    return `${item.splits[0].accountName || "1 account"} • ${fmtMoneyTight(
      item.splits[0].amount
    )}`;
  }
  return `${item.splits.length} accounts • ${fmtMoneyTight(
    item.splits.reduce((sum, split) => sum + safeNum(split.amount), 0)
  )}`;
}

function SplitPlanner({
  title = "Split Plan",
  accounts,
  lines,
  setLines,
  grossAmount,
  locked = false,
  defaultAccountName = "",
}) {
  const gross = safeNum(parseMoneyInput(grossAmount), 0);
  const allocated = getSplitTotal(lines);
  const remaining = round2(gross - allocated);

  function patchLine(id, patch) {
    setLines((prev) => prev.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setLines((prev) => [...prev, emptySplitLine()]);
  }

  function removeLine(id) {
    setLines((prev) => {
      const next = prev.filter((line) => line.id !== id);
      return next.length ? next : [emptySplitLine()];
    });
  }

  return (
    <div className="incomeSplitWrap">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div className="incomeTinyLabel" style={{ marginBottom: 4 }}>
            {title}
          </div>
          <div className="incomeInfoSub" style={{ marginTop: 0 }}>
            Split one paycheck across accounts by exact dollar amount.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <MiniPill tone="blue">{fmtMoneyTight(allocated)} allocated</MiniPill>
          <MiniPill tone={remaining === 0 ? "green" : "amber"}>
            {fmtMoneyTight(remaining)} remaining
          </MiniPill>
        </div>
      </div>

      {accounts.length ? (
        <div className="incomeSplitList">
          {lines.map((line, index) => (
            <div key={line.id} className="incomeSplitRow">
              <select
                className="incomeField"
                value={line.accountId}
                disabled={locked}
                onChange={(e) => patchLine(line.id, { accountId: e.target.value })}
              >
                <option value="">Select account</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>

              <input
                className="incomeField"
                inputMode="decimal"
                placeholder="0.00"
                value={line.amount}
                disabled={locked}
                onChange={(e) => patchLine(line.id, { amount: e.target.value })}
              />

              <button
                type="button"
                className="incomeIconBtn"
                disabled={locked || lines.length === 1}
                onClick={() => removeLine(line.id)}
                aria-label={`Remove split ${index + 1}`}
                title="Remove split"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <ActionBtn onClick={addLine} disabled={locked}>
              <Plus size={14} /> Add Split
            </ActionBtn>
          </div>
        </div>
      ) : (
        <div className="incomeInfoCell">
          <div className="incomeTinyLabel">No accounts loaded</div>
          <div className="incomeInfoSub">
            Add accounts first if you want paycheck splits. Default account:{" "}
            {defaultAccountName || "not set"}.
          </div>
        </div>
      )}
    </div>
  );
}

function AdvancedRouting({ children }) {
  return (
    <details className="incomeDetailsBlock">
      <summary className="incomeDetailsToggle">
        <span>Advanced routing</span>
        <MoreHorizontal size={14} />
      </summary>
      <div className="incomeDetailsBody">{children}</div>
    </details>
  );
}

function CompactIncomeRow({
  item,
  selected,
  maxAmount,
  menuOpen,
  onSelect,
  onToggleMenu,
  onDuplicate,
  onDelete,
}) {
  const scheduled = isScheduledItem(item);
  const posted = !!item.posted;
  const tone = scheduled ? "blue" : "green";
  const meta = toneMeta(tone);
  const fill = maxAmount > 0 ? (safeNum(item.amount) / maxAmount) * 100 : 0;

  return (
    <div
      className="incomeCompactRow"
      onClick={onSelect}
      style={{
        borderColor: selected ? meta.border : "rgba(255,255,255,0.07)",
        boxShadow: selected
          ? `inset 0 1px 0 rgba(255,255,255,0.03), 0 0 0 1px rgba(255,255,255,0.01), 0 0 24px ${meta.glow}`
          : "inset 0 1px 0 rgba(255,255,255,0.025)",
      }}
    >
      <div
        className="incomeCompactAvatar"
        style={{
          borderColor: meta.border,
          color: tone === "neutral" ? "#fff" : meta.text,
          boxShadow: `0 0 12px ${meta.glow}`,
        }}
      >
        {sourceInitial(item.source)}
      </div>

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div className="incomeCompactTitle">{item.source || "Income"}</div>
          <MiniPill tone={scheduled ? "blue" : "green"}>
            {scheduled ? "Scheduled" : "Received"}
          </MiniPill>
          <MiniPill tone={posted ? "green" : "amber"}>
            {posted ? "Posted" : "Unposted"}
          </MiniPill>
        </div>

        <div className="incomeCompactSub">
          {shortDate(item.deposit_date)} • {splitSummaryText(item)} • Updated{" "}
          {formatAgo(item.updated_at || item.created_at)}
        </div>

        <div style={{ marginTop: 10 }}>
          <ProgressBar fill={fill} tone={tone} />
        </div>
      </div>

      <div className="incomeCompactValue">{fmtMoney(item.amount)}</div>

      <div
        className="incomeMenuWrap"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <button
          type="button"
          className="incomeIconBtn"
          aria-label="More actions"
          title="More actions"
          onClick={onToggleMenu}
        >
          <MoreHorizontal size={14} />
        </button>

        {menuOpen ? (
          <div className="incomeMenuPanel">
            <button type="button" className="incomeMenuItem" onClick={onDuplicate}>
              <Copy size={14} />
              Duplicate
            </button>
            <button type="button" className="incomeMenuItem danger" onClick={onDelete}>
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SelectedIncomeCard({
  item,
  editor,
  setEditor,
  accounts,
  defaultAccountName,
  saving,
  menuOpen,
  setMenuOpen,
  onSave,
  onDuplicate,
  onDelete,
  onPostToAccounts,
}) {
  if (!item) {
    return (
      <GlassPane size="card" style={{ height: "100%" }}>
        <PaneHeader
          title="Selected Income"
          subcopy="Choose one from the roster to work it here."
        />
        <div className="incomeEmptyState" style={{ minHeight: 300 }}>
          <div>
            <div className="incomeEmptyTitle">No income selected</div>
            <div className="incomeEmptyText">
              Pick one from the roster on the left.
            </div>
          </div>
        </div>
      </GlassPane>
    );
  }

  const scheduled = editor.status === "scheduled";
  const tone = scheduled ? "blue" : "green";
  const meta = toneMeta(tone);
  const posted = !!editor.posted;
  const lockFinancialFields = posted;

  return (
    <GlassPane
      tone={tone === "blue" ? "neutral" : tone}
      size="card"
      style={{ height: "100%" }}
    >
      <PaneHeader
        title={item.source || "Income"}
        subcopy="Focused controls for the income entry you are actively touching."
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <MiniPill tone={scheduled ? "blue" : "green"}>
              {scheduled ? "Scheduled" : "Received"}
            </MiniPill>
            <MiniPill tone={posted ? "green" : "amber"}>
              {posted ? "Posted" : "Unposted"}
            </MiniPill>
            {saving ? <MiniPill tone="amber">Saving...</MiniPill> : null}

            <div className="incomeMenuWrap">
              <button
                type="button"
                className="incomeIconBtn"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-label="More actions"
                title="More actions"
              >
                <MoreHorizontal size={14} />
              </button>

              {menuOpen ? (
                <div className="incomeMenuPanel incomeMenuPanelRight">
                  {!posted ? (
                    <button
                      type="button"
                      className="incomeMenuItem"
                      onClick={() => {
                        setMenuOpen(false);
                        onPostToAccounts();
                      }}
                    >
                      <Landmark size={14} />
                      {scheduled ? "Mark Received + Post" : "Post To Accounts"}
                    </button>
                  ) : null}

                  <button
                    type="button"
                    className="incomeMenuItem"
                    onClick={() => {
                      setMenuOpen(false);
                      onDuplicate();
                    }}
                  >
                    <Copy size={14} />
                    Duplicate
                  </button>

                  <button
                    type="button"
                    className="incomeMenuItem danger"
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete();
                    }}
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        }
      />

      <div className="incomeFocusBox">
        <div className="incomeTinyLabel">Current Amount</div>

        <div
          style={{
            marginTop: 8,
            fontSize: "clamp(30px, 4vw, 46px)",
            lineHeight: 1,
            fontWeight: 850,
            letterSpacing: "-0.05em",
            color: tone === "neutral" ? "#fff" : meta.text,
          }}
        >
          {fmtMoney(editor.amount)}
        </div>

        <div
          style={{
            marginTop: 10,
            fontSize: 12,
            color: "rgba(255,255,255,0.58)",
          }}
        >
          Updated {fmtWhen(item.updated_at || item.created_at)}
        </div>

        <div className="incomeInfoGrid" style={{ marginTop: 14 }}>
          <div className="incomeInfoCell">
            <div className="incomeTinyLabel">Date</div>
            <div className="incomeInfoValue">{shortDate(editor.deposit_date)}</div>
            <div className="incomeInfoSub">Deposit date on record</div>
          </div>

          <div className="incomeInfoCell">
            <div className="incomeTinyLabel">Split Total</div>
            <div className="incomeInfoValue">
              {fmtMoneyTight(getSplitTotal(editor.splits))}
            </div>
            <div className="incomeInfoSub">{splitSummaryText(editor)}</div>
          </div>
        </div>

        {posted ? (
          <div className="incomeInfoCell" style={{ marginTop: 12 }}>
            <div className="incomeTinyLabel">Posted To Accounts</div>
            <div className="incomeInfoValue">
              {editor.postedAt ? fmtWhen(editor.postedAt) : "Yes"}
            </div>
            <div className="incomeInfoSub">
              This income already hit account balances. Core money fields are locked so you do
              not create a mismatch.
            </div>
          </div>
        ) : null}

        <div className="incomeFormStack" style={{ marginTop: 14 }}>
          <div>
            <div className="incomeTinyLabel">Status</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <ActionBtn
                variant={editor.status === "received" ? "primary" : "ghost"}
                onClick={() => setEditor((prev) => ({ ...prev, status: "received" }))}
                disabled={lockFinancialFields}
              >
                Received
              </ActionBtn>
              <ActionBtn
                variant={editor.status === "scheduled" ? "primary" : "ghost"}
                onClick={() => setEditor((prev) => ({ ...prev, status: "scheduled" }))}
                disabled={lockFinancialFields}
              >
                Scheduled
              </ActionBtn>
            </div>
          </div>

          <div>
            <div className="incomeTinyLabel">Source</div>
            <input
              className="incomeField"
              value={editor.source}
              disabled={lockFinancialFields}
              onChange={(e) =>
                setEditor((prev) => ({
                  ...prev,
                  source: e.target.value,
                }))
              }
              placeholder="Paycheck"
            />
          </div>

          <div className="incomeFormGrid2">
            <div>
              <div className="incomeTinyLabel">Amount</div>
              <input
                className="incomeField"
                inputMode="decimal"
                value={editor.amount}
                disabled={lockFinancialFields}
                onChange={(e) =>
                  setEditor((prev) => ({
                    ...prev,
                    amount: e.target.value,
                  }))
                }
                placeholder="0.00"
              />
            </div>

            <div>
              <div className="incomeTinyLabel">Deposit Date</div>
              <input
                type="date"
                className="incomeField"
                value={editor.deposit_date}
                disabled={lockFinancialFields}
                onChange={(e) =>
                  setEditor((prev) => ({
                    ...prev,
                    deposit_date: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div>
            <div className="incomeTinyLabel">Notes</div>
            <textarea
              className="incomeField"
              rows={5}
              value={editor.note}
              onChange={(e) =>
                setEditor((prev) => ({
                  ...prev,
                  note: e.target.value,
                }))
              }
              placeholder="Optional deposit note..."
            />
          </div>

          <AdvancedRouting>
            <SplitPlanner
              title="Split Planner"
              accounts={accounts}
              lines={editor.splits}
              setLines={(updater) =>
                setEditor((prev) => ({
                  ...prev,
                  splits: typeof updater === "function" ? updater(prev.splits) : updater,
                }))
              }
              grossAmount={editor.amount}
              locked={lockFinancialFields}
              defaultAccountName={defaultAccountName}
            />
          </AdvancedRouting>

          <div className="incomeActionGridSingle">
            <ActionBtn variant="primary" onClick={onSave} full disabled={saving}>
              <Save size={14} /> Save
            </ActionBtn>
          </div>
        </div>
      </div>
    </GlassPane>
  );
}

function AddIncomeCard({
  form,
  setForm,
  accounts,
  defaultAccountName,
  accountCount,
  saving,
  onAdd,
}) {
  return (
    <GlassPane size="card" style={{ height: "100%" }}>
      <PaneHeader
        title="Add Income"
        subcopy="Keep this fast and clean."
        right={
          <MiniPill>
            <Plus size={13} /> New
          </MiniPill>
        }
      />

      <div className="incomeFormStack">
        <div>
          <div className="incomeTinyLabel">Status</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <ActionBtn
              variant={form.status === "received" ? "primary" : "ghost"}
              onClick={() => setForm((prev) => ({ ...prev, status: "received" }))}
            >
              Received
            </ActionBtn>
            <ActionBtn
              variant={form.status === "scheduled" ? "primary" : "ghost"}
              onClick={() => setForm((prev) => ({ ...prev, status: "scheduled" }))}
            >
              Scheduled
            </ActionBtn>
          </div>
        </div>

        <div>
          <div className="incomeTinyLabel">Source</div>
          <input
            className="incomeField"
            placeholder="Paycheck"
            value={form.source}
            onChange={(e) => setForm((prev) => ({ ...prev, source: e.target.value }))}
          />
        </div>

        <div className="incomeFormGrid2">
          <div>
            <div className="incomeTinyLabel">Amount</div>
            <input
              className="incomeField"
              inputMode="decimal"
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
            />
          </div>

          <div>
            <div className="incomeTinyLabel">Date</div>
            <input
              type="date"
              className="incomeField"
              value={form.deposit_date}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  deposit_date: e.target.value,
                }))
              }
            />
          </div>
        </div>

        <div>
          <div className="incomeTinyLabel">Notes</div>
          <textarea
            className="incomeField"
            rows={4}
            placeholder="Optional note..."
            value={form.note}
            onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
          />
        </div>

        <AdvancedRouting>
          <SplitPlanner
            title="Split Planner"
            accounts={accounts}
            lines={form.splits}
            setLines={(updater) =>
              setForm((prev) => ({
                ...prev,
                splits: typeof updater === "function" ? updater(prev.splits) : updater,
              }))
            }
            grossAmount={form.amount}
            defaultAccountName={defaultAccountName}
          />
        </AdvancedRouting>

        <div className="incomeInfoCell">
          <div className="incomeTinyLabel">Default Deposit Account</div>
          <div className="incomeInfoValue">
            {defaultAccountName || "No default account"}
          </div>
          <div className="incomeInfoSub">
            {accountCount} account{accountCount === 1 ? "" : "s"} loaded
          </div>
        </div>

        <div className="incomeActionGridSingle">
          <ActionBtn variant="primary" onClick={onAdd} full disabled={saving}>
            <Plus size={14} /> {saving ? "Saving..." : "Add Income"}
          </ActionBtn>
        </div>
      </div>
    </GlassPane>
  );
}

function IntelItem({ title, subcopy, right, tone = "neutral", onClick }) {
  return (
    <div className="incomeIntelItem">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div className="incomeIntelTitle">{title}</div>
          <div className="incomeIntelSub">{subcopy}</div>
        </div>

        {right ? <MiniPill tone={tone}>{right}</MiniPill> : null}
      </div>

      {onClick ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <ActionBtn onClick={onClick}>Focus</ActionBtn>
        </div>
      ) : null}
    </div>
  );
}

export default function IncomePage() {
  const [items, setItems] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [defaultAccountId, setDefaultAccountId] = useState("");
  const [defaultAccountName, setDefaultAccountName] = useState("");
  const [selectedIncomeId, setSelectedIncomeId] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("recent");
  const [monthValue, setMonthValue] = useState(monthInputToday());
  const [loading, setLoading] = useState(true);
  const [savingSelected, setSavingSelected] = useState(false);
  const [addingBusy, setAddingBusy] = useState(false);
  const [userId, setUserId] = useState(null);
  const [rowMenuId, setRowMenuId] = useState("");
  const [selectedMenuOpen, setSelectedMenuOpen] = useState(false);

  const [editor, setEditor] = useState({
    source: "",
    amount: "",
    deposit_date: dateInputToday(),
    note: "",
    status: "received",
    posted: false,
    postedAt: null,
    splits: [emptySplitLine()],
  });

  const [form, setForm] = useState({
    source: "Paycheck",
    amount: "",
    deposit_date: dateInputToday(),
    note: "",
    status: "received",
    splits: [emptySplitLine()],
  });

  function makeFallbackSplit(totalAmount) {
    if (!defaultAccountId || totalAmount <= 0) return [];
    return [
      {
        accountId: defaultAccountId,
        accountName: defaultAccountName || getAccountName(accounts, defaultAccountId),
        amount: round2(totalAmount),
      },
    ];
  }

  function validateAndPrepareSplits(totalAmount, splitLines) {
    const target = round2(totalAmount);
    const rawTouched = splitLines.filter(
      (line) => String(line.accountId || "").trim() || String(line.amount || "").trim()
    );

    if (!rawTouched.length) {
      return {
        splits: makeFallbackSplit(target),
        error: null,
      };
    }

    const merged = new Map();

    for (const line of rawTouched) {
      const accountId = String(line.accountId || "").trim();
      const amount = round2(parseMoneyInput(line.amount));

      if (!accountId) {
        return { splits: [], error: "Every split needs an account." };
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        return { splits: [], error: "Every split amount must be more than 0." };
      }

      const account = accounts.find((a) => a.id === accountId);
      if (!account) {
        return { splits: [], error: "One of the selected accounts is missing." };
      }

      const existing = merged.get(accountId);
      if (existing) {
        existing.amount = round2(existing.amount + amount);
      } else {
        merged.set(accountId, {
          accountId,
          accountName: account.name || "Account",
          amount,
        });
      }
    }

    const splits = [...merged.values()];
    const allocated = round2(
      splits.reduce((sum, split) => sum + safeNum(split.amount, 0), 0)
    );

    if (Math.abs(allocated - target) > 0.009) {
      return {
        splits: [],
        error: `Split total must match the paycheck amount exactly. Difference: ${fmtMoneyTight(
          target - allocated
        )}`,
      };
    }

    return { splits, error: null };
  }

  async function loadIncomePage() {
    if (!supabase) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      setUserId(null);
      setItems([]);
      setAccounts([]);
      setDefaultAccountId("");
      setDefaultAccountName("");
      setSelectedIncomeId("");
      setLoading(false);
      return;
    }

    setUserId(session.user.id);

    const [incomeRes, accountsRes, settingsRes] = await Promise.all([
      supabase
        .from("income_deposits")
        .select("id, user_id, source, amount, note, deposit_date, created_at, updated_at")
        .eq("user_id", session.user.id)
        .order("deposit_date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("accounts")
        .select("id, name, account_type, balance, updated_at")
        .eq("user_id", session.user.id)
        .order("name", { ascending: true }),
      supabase
        .from("account_settings")
        .select("primary_account_id")
        .eq("user_id", session.user.id)
        .maybeSingle(),
    ]);

    if (incomeRes.error) console.error("load income error:", incomeRes.error);
    if (accountsRes.error) console.error("load accounts error:", accountsRes.error);
    if (settingsRes.error) console.error("load account settings error:", settingsRes.error);

    const loadedItems = (incomeRes.data || []).map(mapIncomeRow);
    const loadedAccounts = accountsRes.data || [];
    const primaryAccountId = settingsRes.data?.primary_account_id || "";
    const primaryAccount =
      loadedAccounts.find((account) => account.id === primaryAccountId) || null;

    setItems(loadedItems);
    setAccounts(loadedAccounts);
    setDefaultAccountId(primaryAccountId || "");
    setDefaultAccountName(primaryAccount?.name || "");
    setSelectedIncomeId((prev) => prev || loadedItems[0]?.id || "");
    setLoading(false);
  }

  useEffect(() => {
    loadIncomePage();

    if (!supabase) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadIncomePage();
    });

    return () => {
      subscription?.unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    setForm((prev) => {
      const untouched =
        prev.splits.length === 1 &&
        !String(prev.splits[0]?.accountId || "").trim() &&
        !String(prev.splits[0]?.amount || "").trim();

      if (!untouched) return prev;

      return {
        ...prev,
        splits: [emptySplitLine(defaultAccountId)],
      };
    });
  }, [defaultAccountId]);

  const monthItems = useMemo(() => {
    return items.filter((item) => monthKeyOf(item.deposit_date) === monthValue);
  }, [items, monthValue]);

  const receivedItems = useMemo(() => {
    return monthItems.filter((item) => !isScheduledItem(item));
  }, [monthItems]);

  const scheduledItems = useMemo(() => {
    return monthItems.filter((item) => isScheduledItem(item));
  }, [monthItems]);

  const totals = useMemo(() => {
    const received = receivedItems.reduce((sum, item) => sum + safeNum(item.amount), 0);
    const scheduled = scheduledItems.reduce((sum, item) => sum + safeNum(item.amount), 0);

    return {
      received,
      scheduled,
      projected: received + scheduled,
      count: monthItems.length,
    };
  }, [receivedItems, scheduledItems, monthItems]);

  const nextScheduled = useMemo(() => {
    return [...scheduledItems].sort((a, b) => {
      return new Date(a.deposit_date).getTime() - new Date(b.deposit_date).getTime();
    })[0];
  }, [scheduledItems]);

  const sourceBreakdown = useMemo(() => {
    const map = new Map();

    monthItems.forEach((item) => {
      const key = item.source || "Income";
      map.set(key, (map.get(key) || 0) + safeNum(item.amount));
    });

    return [...map.entries()]
      .map(([source, total]) => ({ source, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [monthItems]);

  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();

    let list = monthItems.filter((item) => {
      if (filter === "received" && isScheduledItem(item)) return false;
      if (filter === "scheduled" && !isScheduledItem(item)) return false;

      if (!q) return true;

      return [item.source, item.note, shortDate(item.deposit_date), splitSummaryText(item)]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });

    if (sort === "amount") {
      list.sort((a, b) => safeNum(b.amount) - safeNum(a.amount));
      return list;
    }

    if (sort === "source") {
      list.sort((a, b) => String(a.source || "").localeCompare(String(b.source || "")));
      return list;
    }

    if (sort === "date") {
      list.sort(
        (a, b) =>
          new Date(a.deposit_date || 0).getTime() - new Date(b.deposit_date || 0).getTime()
      );
      return list;
    }

    list.sort(
      (a, b) =>
        new Date(b.deposit_date || 0).getTime() - new Date(a.deposit_date || 0).getTime()
    );
    return list;
  }, [monthItems, filter, search, sort]);

  useEffect(() => {
    if (!visibleItems.length) {
      setSelectedIncomeId("");
      return;
    }

    const exists = visibleItems.some((item) => item.id === selectedIncomeId);
    if (!exists) {
      setSelectedIncomeId(visibleItems[0].id);
    }
  }, [visibleItems, selectedIncomeId]);

  const selectedItem =
    items.find((item) => item.id === selectedIncomeId) || visibleItems[0] || null;

  useEffect(() => {
    setRowMenuId("");
    setSelectedMenuOpen(false);
  }, [selectedIncomeId]);

  useEffect(() => {
    if (!selectedItem) {
      setEditor({
        source: "",
        amount: "",
        deposit_date: dateInputToday(),
        note: "",
        status: "received",
        posted: false,
        postedAt: null,
        splits: [emptySplitLine(defaultAccountId)],
      });
      return;
    }

    setEditor({
      source: selectedItem.source || "",
      amount: String(selectedItem.amount ?? ""),
      deposit_date: selectedItem.deposit_date || dateInputToday(),
      note: selectedItem.note || "",
      status: selectedItem.status || "received",
      posted: !!selectedItem.posted,
      postedAt: selectedItem.postedAt || null,
      splits:
        selectedItem.splits?.length
          ? selectedItem.splits.map((split) => ({
              id: uid(),
              accountId: split.accountId,
              amount: String(split.amount ?? ""),
            }))
          : [emptySplitLine(defaultAccountId)],
    });
  }, [selectedItem?.id, defaultAccountId]);

  const maxVisibleAmount = useMemo(() => {
    return visibleItems.reduce((max, item) => Math.max(max, safeNum(item.amount)), 0);
  }, [visibleItems]);

  const showInsights = monthItems.length > 0;

  async function applySplitsToAccounts({ incomeId, source, note, splits }) {
    if (!supabase || !userId || !splits.length) {
      return { ok: true };
    }

    const nextAccounts = accounts.map((account) => ({ ...account }));
    const txRows = [];

    for (const split of splits) {
      const account = nextAccounts.find((a) => a.id === split.accountId);
      if (!account) {
        return { ok: false, error: "Split account not found." };
      }

      const newBalance = round2(safeNum(account.balance, 0) + safeNum(split.amount, 0));

      const { error: updateError } = await supabase
        .from("accounts")
        .update({
          balance: newBalance,
          updated_at: new Date().toISOString(),
        })
        .eq("id", split.accountId)
        .eq("user_id", userId);

      if (updateError) {
        console.error("account balance update error:", updateError);
        return { ok: false, error: "Could not update account balances." };
      }

      account.balance = newBalance;

      txRows.push({
        user_id: userId,
        account_id: split.accountId,
        kind: "income",
        amount: round2(split.amount),
        delta: round2(split.amount),
        resulting_balance: newBalance,
        note: `${source || "Income"}${note ? ` • ${note}` : ""}`,
        related_account_id: null,
        related_account_name: null,
        source_type: "income_deposit",
        source_id: incomeId,
        created_at: new Date().toISOString(),
      });
    }

    if (txRows.length) {
      const { error: txError } = await supabase.from("account_transactions").insert(txRows);
      if (txError) {
        console.error("account transaction insert error:", txError);
        return { ok: false, error: "Could not write account transaction rows." };
      }
    }

    setAccounts(nextAccounts);
    return { ok: true };
  }

  async function addIncome() {
    if (!supabase || !userId || addingBusy) return;

    const amount = round2(parseMoneyInput(form.amount));
    const source = String(form.source || "").trim();
    const depositDate = form.deposit_date || dateInputToday();

    if (!source || !Number.isFinite(amount) || amount <= 0) return;

    const splitCheck = validateAndPrepareSplits(amount, form.splits);
    if (splitCheck.error) {
      window.alert(splitCheck.error);
      return;
    }

    setAddingBusy(true);

    const payload = mapIncomeToRow(
      {
        source,
        amount,
        note: form.note.trim(),
        deposit_date: depositDate,
        status: form.status,
        posted: false,
        postedAt: null,
        splits: splitCheck.splits,
      },
      userId
    );

    const res = await supabase
      .from("income_deposits")
      .insert(payload)
      .select("id, user_id, source, amount, note, deposit_date, created_at, updated_at")
      .single();

    if (res.error) {
      console.error("add income error:", res.error);
      await loadIncomePage();
      setAddingBusy(false);
      return;
    }

    let nextRow = mapIncomeRow(res.data);

    if (nextRow.status === "received" && !nextRow.posted) {
      const postRes = await applySplitsToAccounts({
        incomeId: nextRow.id,
        source: nextRow.source,
        note: nextRow.note,
        splits: nextRow.splits,
      });

      if (postRes.ok) {
        const postedItem = {
          ...nextRow,
          posted: true,
          postedAt: new Date().toISOString(),
        };

        const updateRes = await supabase
          .from("income_deposits")
          .update(
            mapIncomeToRow(
              {
                ...postedItem,
              },
              userId
            )
          )
          .eq("id", nextRow.id)
          .eq("user_id", userId)
          .select("id, user_id, source, amount, note, deposit_date, created_at, updated_at")
          .single();

        if (!updateRes.error && updateRes.data) {
          nextRow = mapIncomeRow(updateRes.data);
        } else {
          nextRow = postedItem;
        }
      } else {
        window.alert(postRes.error || "Could not post the split to accounts.");
      }
    }

    setItems((prev) => [nextRow, ...prev]);
    setSelectedIncomeId(nextRow.id);
    setForm({
      source: "Paycheck",
      amount: "",
      deposit_date: dateInputToday(),
      note: "",
      status: "received",
      splits: [emptySplitLine(defaultAccountId)],
    });
    setAddingBusy(false);
  }

  async function saveSelectedIncome() {
    if (!supabase || !userId || !selectedItem || savingSelected) return;

    const amount = round2(parseMoneyInput(editor.amount));
    const source = String(editor.source || "").trim();
    const depositDate = editor.deposit_date || dateInputToday();

    if (!source || !Number.isFinite(amount) || amount <= 0) return;

    const splitCheck = validateAndPrepareSplits(amount, editor.splits);
    if (splitCheck.error) {
      window.alert(splitCheck.error);
      return;
    }

    setSavingSelected(true);

    const payload = {
      ...mapIncomeToRow(
        {
          source,
          amount,
          note: editor.note.trim(),
          deposit_date: depositDate,
          status: editor.status,
          posted: editor.posted,
          postedAt: editor.postedAt,
          splits: splitCheck.splits,
        },
        userId
      ),
      updated_at: new Date().toISOString(),
    };

    const res = await supabase
      .from("income_deposits")
      .update(payload)
      .eq("id", selectedItem.id)
      .eq("user_id", userId)
      .select("id, user_id, source, amount, note, deposit_date, created_at, updated_at")
      .single();

    if (res.error) {
      console.error("save income error:", res.error);
      await loadIncomePage();
      setSavingSelected(false);
      return;
    }

    const nextItem = mapIncomeRow(res.data);

    setItems((prev) => prev.map((item) => (item.id === selectedItem.id ? nextItem : item)));

    setSavingSelected(false);
  }

  async function postSelectedIncomeToAccounts() {
    if (!supabase || !userId || !selectedItem || savingSelected) return;
    if (editor.posted) return;

    const amount = round2(parseMoneyInput(editor.amount));
    const source = String(editor.source || "").trim();
    const depositDate = editor.deposit_date || dateInputToday();

    if (!source || !Number.isFinite(amount) || amount <= 0) return;

    const splitCheck = validateAndPrepareSplits(amount, editor.splits);
    if (splitCheck.error) {
      window.alert(splitCheck.error);
      return;
    }

    setSavingSelected(true);

    const postRes = await applySplitsToAccounts({
      incomeId: selectedItem.id,
      source,
      note: editor.note.trim(),
      splits: splitCheck.splits,
    });

    if (!postRes.ok) {
      window.alert(postRes.error || "Could not post to accounts.");
      setSavingSelected(false);
      return;
    }

    const payload = {
      ...mapIncomeToRow(
        {
          source,
          amount,
          note: editor.note.trim(),
          deposit_date: depositDate,
          status: "received",
          posted: true,
          postedAt: new Date().toISOString(),
          splits: splitCheck.splits,
        },
        userId
      ),
      updated_at: new Date().toISOString(),
    };

    const res = await supabase
      .from("income_deposits")
      .update(payload)
      .eq("id", selectedItem.id)
      .eq("user_id", userId)
      .select("id, user_id, source, amount, note, deposit_date, created_at, updated_at")
      .single();

    if (res.error) {
      console.error("post income update error:", res.error);
      await loadIncomePage();
      setSavingSelected(false);
      return;
    }

    const nextItem = mapIncomeRow(res.data);

    setItems((prev) => prev.map((item) => (item.id === selectedItem.id ? nextItem : item)));

    setSavingSelected(false);
  }

  async function duplicateIncomeFromItem(item) {
    if (!supabase || !userId) return;

    const payload = mapIncomeToRow(
      {
        source: item.source || "Income",
        amount: safeNum(item.amount, 0),
        note: item.note || "",
        deposit_date: item.deposit_date || dateInputToday(),
        status: item.status || "received",
        posted: false,
        postedAt: null,
        splits: item.splits || [],
      },
      userId
    );

    const res = await supabase
      .from("income_deposits")
      .insert(payload)
      .select("id, user_id, source, amount, note, deposit_date, created_at, updated_at")
      .single();

    if (res.error) {
      console.error("duplicate income error:", res.error);
      await loadIncomePage();
      return;
    }

    const nextRow = mapIncomeRow(res.data);
    setItems((prev) => [nextRow, ...prev]);
    setSelectedIncomeId(nextRow.id);
  }

  async function removeIncomeById(id) {
    if (!supabase || !userId) return;

    const target = items.find((item) => item.id === id);
    if (!target) return;

    if (target.posted) {
      window.alert(
        "Posted income is locked because it already changed account balances. Duplicate it or add a correcting entry instead."
      );
      return;
    }

    if (typeof window !== "undefined" && !window.confirm("Delete this income entry?")) {
      return;
    }

    const { error } = await supabase
      .from("income_deposits")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      console.error("delete income error:", error);
      await loadIncomePage();
      return;
    }

    const nextItems = items.filter((item) => item.id !== id);
    setItems(nextItems);

    if (selectedIncomeId === id) {
      setSelectedIncomeId(nextItems[0]?.id || "");
    }
  }

  async function duplicateSelectedIncome() {
    if (!selectedItem || savingSelected) return;
    setSavingSelected(true);
    await duplicateIncomeFromItem(selectedItem);
    setSavingSelected(false);
  }

  async function removeSelectedIncome() {
    if (!selectedItem || savingSelected) return;
    setSavingSelected(true);
    await removeIncomeById(selectedItem.id);
    setSavingSelected(false);
  }

  async function duplicateRowIncome(item) {
    setRowMenuId("");
    await duplicateIncomeFromItem(item);
  }

  async function removeRowIncome(id) {
    setRowMenuId("");
    await removeIncomeById(id);
  }

  if (loading) {
    return (
      <main className="incomePage">
        <div className="incomePageShell">
          <GlassPane size="card">
            <div style={{ fontWeight: 800, fontSize: 18, color: "#fff" }}>
              Loading income.
            </div>
          </GlassPane>
        </div>
        <style jsx global>{globalStyles}</style>
      </main>
    );
  }

  return (
    <>
      <main
        className="incomePage"
        onClick={() => {
          if (rowMenuId) setRowMenuId("");
          if (selectedMenuOpen) setSelectedMenuOpen(false);
        }}
      >
        <div className="incomePageShell">
          <GlassPane size="card">
            <div className="incomeHeroGrid">
              <div style={{ minWidth: 0 }}>
                <div className="incomeEyebrow">Life Command Center</div>
                <div className="incomeHeroTitle">Income Command</div>
                <div className="incomeHeroSub">
                  Clean income routing, exact paycheck splits, and a tighter layout that stops
                  wasting space.
                </div>

                <div className="incomePillRow">
                  <MiniPill>{monthItems.length} income items</MiniPill>
                  <MiniPill>{prettyMonth(monthValue)}</MiniPill>
                  <MiniPill tone="green">{receivedItems.length} received</MiniPill>
                  <MiniPill tone="blue">{scheduledItems.length} scheduled</MiniPill>
                </div>
              </div>

              <div className="incomeHeroSide">
                <MiniPill>{fmtWhen(new Date().toISOString())}</MiniPill>
                <MiniPill tone="green">{fmtMoney(totals.received)} received</MiniPill>
                <MiniPill tone={totals.scheduled > 0 ? "blue" : "neutral"}>
                  {fmtMoney(totals.scheduled)} pending
                </MiniPill>
              </div>
            </div>
          </GlassPane>

          <section className="incomeMetricGrid">
            <StatCard
              icon={Landmark}
              label="Received This Month"
              value={fmtMoney(totals.received)}
              detail="Actual deposited income."
              tone="green"
            />
            <StatCard
              icon={CalendarClock}
              label="Scheduled This Month"
              value={fmtMoney(totals.scheduled)}
              detail="Planned income that has not posted yet."
              tone="blue"
            />
            <StatCard
              icon={BadgeDollarSign}
              label="Next Payday"
              value={nextScheduled ? shortDate(nextScheduled.deposit_date) : "—"}
              detail={
                nextScheduled
                  ? `${nextScheduled.source || "Deposit"} • ${fmtMoneyTight(
                      nextScheduled.amount
                    )}`
                  : "No payday scheduled."
              }
              tone="amber"
            />
            <StatCard
              icon={ArrowUpRight}
              label="Projected Total"
              value={fmtMoney(totals.projected)}
              detail={`${totals.count} income item${totals.count === 1 ? "" : "s"} in ${prettyMonth(
                monthValue
              )}.`}
              tone="neutral"
            />
          </section>

          <section className="incomeWorkspaceGrid">
            <GlassPane size="card" style={{ height: "100%" }}>
              <PaneHeader
                title="Income Roster"
                subcopy="Compact list on the left. Work the selected income on the right."
                right={<MiniPill>{visibleItems.length} showing</MiniPill>}
              />

              <div className="incomeRosterControls">
                <div className="incomeSearchWrap">
                  <Search size={15} />
                  <input
                    className="incomeField incomeSearchField"
                    placeholder="Search income"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                <input
                  type="month"
                  className="incomeField"
                  value={monthValue}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setMonthValue(e.target.value)}
                />

                <select
                  className="incomeField"
                  value={filter}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">All income</option>
                  <option value="received">Received only</option>
                  <option value="scheduled">Scheduled only</option>
                </select>

                <select
                  className="incomeField"
                  value={sort}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="recent">Recent first</option>
                  <option value="amount">Amount high → low</option>
                  <option value="source">Source</option>
                  <option value="date">Date ascending</option>
                </select>
              </div>

              {visibleItems.length ? (
                <div className="incomeRosterListCompact">
                  {visibleItems.map((item) => (
                    <CompactIncomeRow
                      key={item.id}
                      item={item}
                      selected={item.id === selectedItem?.id}
                      maxAmount={maxVisibleAmount}
                      menuOpen={rowMenuId === item.id}
                      onSelect={() => {
                        setSelectedIncomeId(item.id);
                        setRowMenuId("");
                      }}
                      onToggleMenu={() =>
                        setRowMenuId((prev) => (prev === item.id ? "" : item.id))
                      }
                      onDuplicate={() => duplicateRowIncome(item)}
                      onDelete={() => removeRowIncome(item.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="incomeEmptyState">
                  <div>
                    <div className="incomeEmptyTitle">No income found</div>
                    <div className="incomeEmptyText">
                      Clear filters or add a new deposit.
                    </div>
                  </div>
                </div>
              )}
            </GlassPane>

            <SelectedIncomeCard
              item={selectedItem}
              editor={editor}
              setEditor={setEditor}
              accounts={accounts}
              defaultAccountName={defaultAccountName}
              saving={savingSelected}
              menuOpen={selectedMenuOpen}
              setMenuOpen={setSelectedMenuOpen}
              onSave={saveSelectedIncome}
              onDuplicate={duplicateSelectedIncome}
              onDelete={removeSelectedIncome}
              onPostToAccounts={postSelectedIncomeToAccounts}
            />

            <AddIncomeCard
              form={form}
              setForm={setForm}
              accounts={accounts}
              defaultAccountName={defaultAccountName}
              accountCount={accounts.length}
              saving={addingBusy}
              onAdd={addIncome}
            />
          </section>

          {showInsights ? (
            <section className="incomeSectionGrid">
              {scheduledItems.length ? (
                <GlassPane size="card" style={{ height: "100%" }}>
                  <PaneHeader
                    title="Upcoming Deposits"
                    subcopy="Scheduled paychecks and split plans waiting to hit."
                    right={
                      <MiniPill tone="blue">
                        {scheduledItems.length} item{scheduledItems.length === 1 ? "" : "s"}
                      </MiniPill>
                    }
                  />

                  <div className="incomeIntelList">
                    {scheduledItems
                      .slice()
                      .sort(
                        (a, b) =>
                          new Date(a.deposit_date).getTime() -
                          new Date(b.deposit_date).getTime()
                      )
                      .slice(0, 5)
                      .map((item) => (
                        <IntelItem
                          key={item.id}
                          title={item.source || "Income"}
                          subcopy={`${shortDate(item.deposit_date)} • ${fmtMoneyTight(
                            item.amount
                          )} • ${splitSummaryText(item)}`}
                          right="Scheduled"
                          tone="blue"
                          onClick={() => setSelectedIncomeId(item.id)}
                        />
                      ))}
                  </div>
                </GlassPane>
              ) : (
                <GlassPane size="card" style={{ height: "100%" }}>
                  <PaneHeader
                    title="Source Breakdown"
                    subcopy="See which income source is carrying the month."
                    right={
                      <MiniPill>
                        {sourceBreakdown.length} source
                        {sourceBreakdown.length === 1 ? "" : "s"}
                      </MiniPill>
                    }
                  />

                  {sourceBreakdown.length ? (
                    <div className="incomeIntelList">
                      {sourceBreakdown.map((row) => (
                        <div key={row.source} className="incomeIntelItem">
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 10,
                              alignItems: "flex-start",
                              flexWrap: "wrap",
                            }}
                          >
                            <div>
                              <div className="incomeIntelTitle">{row.source}</div>
                              <div className="incomeIntelSub">
                                Total in {prettyMonth(monthValue)}
                              </div>
                            </div>

                            <MiniPill tone="green">{fmtMoney(row.total)}</MiniPill>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="incomeEmptyState incomeInlineEmpty">
                      <div>
                        <div className="incomeEmptyTitle">No source data</div>
                        <div className="incomeEmptyText">
                          Add deposits to build a source breakdown.
                        </div>
                      </div>
                    </div>
                  )}
                </GlassPane>
              )}

              <GlassPane size="card" style={{ height: "100%" }}>
                <PaneHeader
                  title="Recent Activity"
                  subcopy="Quick history of the most recent income changes."
                  right={<MiniPill>{monthItems.length} entries</MiniPill>}
                />

                <div className="incomeIntelList">
                  {monthItems.slice(0, 5).map((item) => (
                    <IntelItem
                      key={item.id}
                      title={item.source || "Income"}
                      subcopy={`${fmtMoneyTight(item.amount)} • ${shortDate(
                        item.deposit_date
                      )} • ${splitSummaryText(item)} • Updated ${formatAgo(
                        item.updated_at || item.created_at
                      )}`}
                      right={isScheduledItem(item) ? "Scheduled" : "Received"}
                      tone={isScheduledItem(item) ? "blue" : "green"}
                      onClick={() => setSelectedIncomeId(item.id)}
                    />
                  ))}
                </div>
              </GlassPane>
            </section>
          ) : null}
        </div>
      </main>

      <style jsx global>{globalStyles}</style>
    </>
  );
}

const globalStyles = `
  .incomePage {
    width: 100%;
    min-width: 0;
    color: var(--lcc-text);
    font-family: var(--lcc-font-sans);
  }

  .incomePageShell {
    width: 100%;
    max-width: none;
    margin: 0;
    padding: 12px 0 20px;
    display: grid;
    gap: 14px;
  }

  .incomeEyebrow {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: .22em;
    font-weight: 800;
    color: rgba(255,255,255,0.42);
  }

  .incomeHeroTitle {
    margin-top: 8px;
    font-size: clamp(24px, 3.2vw, 34px);
    line-height: 1.02;
    font-weight: 850;
    letter-spacing: -0.05em;
    color: #fff;
  }

  .incomeHeroSub {
    margin-top: 8px;
    font-size: 13px;
    line-height: 1.55;
    color: rgba(255,255,255,0.62);
    max-width: 840px;
  }

  .incomeHeroGrid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 14px;
    align-items: start;
  }

  .incomeHeroSide {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
    align-content: flex-start;
  }

  .incomePillRow {
    margin-top: 12px;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .incomeMetricGrid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
  }

  .incomeWorkspaceGrid {
    display: grid;
    grid-template-columns: minmax(520px, 1.5fr) minmax(400px, 1fr) minmax(320px, 0.82fr);
    gap: 14px;
    align-items: stretch;
  }

  .incomeWorkspaceGrid > * {
    min-width: 0;
    height: 100%;
  }

  .incomeSectionGrid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 14px;
    align-items: stretch;
  }

  .incomeSectionGrid > * {
    min-width: 0;
    height: 100%;
  }

  .incomeRosterControls {
    display: grid;
    grid-template-columns: 1.28fr 0.92fr 0.9fr 0.9fr;
    gap: 10px;
    margin-bottom: 10px;
  }

  .incomeSearchWrap {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    border-radius: 14px;
    border: 1px solid rgba(214,226,255,0.10);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012)),
      rgba(8, 12, 20, 0.76);
    color: rgba(255,255,255,0.58);
    padding: 0 12px;
  }

  .incomeSearchField {
    min-height: 42px !important;
    border: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
    padding: 0 !important;
  }

  .incomeRosterListCompact {
    display: grid;
    gap: 10px;
    min-height: 640px;
    max-height: 640px;
    overflow: auto;
    padding-right: 2px;
  }

  .incomeCompactRow {
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr) auto auto;
    gap: 10px;
    align-items: center;
    min-height: 110px;
    padding: 12px 14px;
    border-radius: 18px;
    border: 1px solid rgba(255,255,255,0.07);
    background:
      linear-gradient(180deg, rgba(8,13,24,0.78), rgba(4,8,16,0.72));
    cursor: pointer;
    transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
  }

  .incomeCompactRow:hover {
    transform: translateY(-1px);
  }

  .incomeCompactAvatar {
    width: 42px;
    height: 42px;
    border-radius: 14px;
    display: grid;
    place-items: center;
    border: 1px solid rgba(255,255,255,0.08);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012)),
      rgba(9, 14, 23, 0.68);
    font-size: 12px;
    font-weight: 800;
    letter-spacing: .05em;
  }

  .incomeCompactTitle {
    font-size: 13.5px;
    font-weight: 800;
    color: #fff;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  .incomeCompactSub {
    margin-top: 4px;
    font-size: 11.5px;
    color: rgba(255,255,255,0.54);
    line-height: 1.35;
  }

  .incomeCompactValue {
    font-size: 15px;
    font-weight: 850;
    color: #fff;
    white-space: nowrap;
  }

  .incomeMenuWrap {
    position: relative;
  }

  .incomeMenuPanel {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    z-index: 40;
    min-width: 190px;
    border-radius: 16px;
    border: 1px solid rgba(214,226,255,0.12);
    background:
      linear-gradient(180deg, rgba(12,18,30,0.96), rgba(7,11,20,0.94));
    box-shadow:
      0 18px 45px rgba(0,0,0,0.42),
      inset 0 1px 0 rgba(255,255,255,0.03);
    padding: 8px;
    display: grid;
    gap: 6px;
  }

  .incomeMenuPanelRight {
    right: 0;
  }

  .incomeMenuItem {
    width: 100%;
    min-height: 38px;
    border-radius: 12px;
    border: 1px solid rgba(214,226,255,0.08);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012));
    color: rgba(247,251,255,0.9);
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    cursor: pointer;
    font: inherit;
    font-size: 12px;
    font-weight: 800;
  }

  .incomeMenuItem.danger {
    border-color: rgba(255,132,163,0.18);
    color: #ffd3df;
  }

  .incomeIconBtn {
    width: 34px;
    height: 34px;
    border-radius: 12px;
    border: 1px solid rgba(214,226,255,0.10);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012));
    color: rgba(247,251,255,0.88);
    display: grid;
    place-items: center;
    cursor: pointer;
  }

  .incomeFocusBox {
    border-radius: 22px;
    border: 1px solid rgba(214,226,255,0.12);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01));
    padding: 15px;
    min-height: 100%;
  }

  .incomeInfoGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .incomeInfoCell {
    border-radius: 18px;
    border: 1px solid rgba(255,255,255,0.05);
    background: rgba(255,255,255,0.025);
    padding: 11px;
  }

  .incomeInfoValue {
    font-size: 0.96rem;
    font-weight: 900;
    line-height: 1.15;
    color: #fff;
  }

  .incomeInfoSub {
    margin-top: 5px;
    color: rgba(255,255,255,0.62);
    font-size: 0.79rem;
    line-height: 1.4;
  }

  .incomeSplitWrap {
    display: grid;
    gap: 10px;
  }

  .incomeSplitList {
    display: grid;
    gap: 10px;
  }

  .incomeSplitRow {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(130px, 0.42fr) auto;
    gap: 10px;
    align-items: center;
  }

  .incomeProgress {
    height: 8px;
    border-radius: 999px;
    overflow: hidden;
    background: rgba(255,255,255,0.1);
  }

  .incomeProgressFill {
    height: 100%;
    border-radius: 999px;
    transition: width 0.4s ease;
  }

  .incomeActionGridSingle {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .incomeFormStack {
    display: grid;
    gap: 12px;
  }

  .incomeFormGrid2 {
    display: grid;
    gap: 10px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .incomeTinyLabel {
    display: block;
    margin-bottom: 8px;
    font-size: 10px;
    color: rgba(255,255,255,0.46);
    text-transform: uppercase;
    letter-spacing: .16em;
    font-weight: 800;
  }

  .incomeField {
    width: 100%;
    min-height: 44px;
    border-radius: 14px;
    border: 1px solid rgba(214,226,255,0.10);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012)),
      rgba(8, 12, 20, 0.76);
    color: var(--lcc-text);
    padding: 0 13px;
    outline: none;
    font: inherit;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
    transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
  }

  .incomeField:focus {
    border-color: rgba(143,177,255,0.30);
    box-shadow:
      0 0 0 4px rgba(79,114,255,0.08),
      inset 0 1px 0 rgba(255,255,255,0.035);
  }

  .incomeField::placeholder {
    color: rgba(225,233,245,0.38);
  }

  .incomeField option {
    background: #08111f;
    color: #f4f7ff;
  }

  .incomeField:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  textarea.incomeField {
    min-height: 96px;
    resize: vertical;
    padding: 12px 13px;
  }

  .incomeActionBtn {
    min-height: 40px;
    padding: 10px 13px;
    border-radius: 14px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 800;
    line-height: 1;
    transition: transform 160ms ease, border-color 160ms ease, background 160ms ease, box-shadow 160ms ease;
  }

  .incomeActionBtn:hover {
    transform: translateY(-1px);
  }

  .incomeDetailsBlock {
    border-radius: 16px;
    border: 1px solid rgba(214,226,255,0.08);
    background: rgba(255,255,255,0.02);
    overflow: hidden;
  }

  .incomeDetailsToggle {
    list-style: none;
    cursor: pointer;
    min-height: 46px;
    padding: 0 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    color: rgba(247,251,255,0.88);
    font-size: 12px;
    font-weight: 800;
  }

  .incomeDetailsToggle::-webkit-details-marker {
    display: none;
  }

  .incomeDetailsBody {
    padding: 0 12px 12px;
  }

  .incomeIntelList {
    display: grid;
    gap: 10px;
    min-height: 320px;
    max-height: 320px;
    overflow: auto;
    padding-right: 2px;
  }

  .incomeIntelItem {
    border-radius: 18px;
    border: 1px solid rgba(255,255,255,0.07);
    background:
      linear-gradient(180deg, rgba(8,13,24,0.78), rgba(4,8,16,0.72));
    padding: 12px;
    display: grid;
    gap: 10px;
  }

  .incomeIntelTitle {
    font-size: 13px;
    font-weight: 800;
    color: #fff;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }

  .incomeIntelSub {
    margin-top: 4px;
    font-size: 11.5px;
    color: rgba(255,255,255,0.54);
    line-height: 1.35;
  }

  .incomeEmptyState {
    min-height: 150px;
    display: grid;
    place-items: center;
    text-align: center;
    padding: 14px;
  }

  .incomeInlineEmpty {
    min-height: 320px;
  }

  .incomeEmptyTitle {
    font-size: 16px;
    font-weight: 850;
    color: #fff;
  }

  .incomeEmptyText {
    margin-top: 6px;
    font-size: 13px;
    line-height: 1.5;
    color: rgba(255,255,255,0.60);
    max-width: 360px;
  }

  @media (max-width: 1560px) {
    .incomeWorkspaceGrid {
      grid-template-columns: minmax(450px, 1.32fr) minmax(380px, 1fr) minmax(300px, 0.82fr);
    }
  }

  @media (max-width: 1380px) {
    .incomeMetricGrid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .incomeWorkspaceGrid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .incomeWorkspaceGrid > :nth-child(3) {
      grid-column: 1 / -1;
    }

    .incomeRosterControls {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 1100px) {
    .incomeHeroGrid,
    .incomeWorkspaceGrid,
    .incomeSectionGrid {
      grid-template-columns: 1fr;
    }

    .incomeHeroSide {
      justify-content: flex-start;
    }
  }

  @media (max-width: 1024px) {
    .incomeInfoGrid,
    .incomeFormGrid2,
    .incomeSplitRow,
    .incomeRosterControls {
      grid-template-columns: 1fr;
    }

    .incomeCompactRow {
      grid-template-columns: 42px minmax(0, 1fr);
    }

    .incomeCompactValue {
      white-space: normal;
    }

    .incomeRosterListCompact,
    .incomeIntelList {
      min-height: 0;
      max-height: none;
    }
  }

  @media (max-width: 760px) {
    .incomePageShell {
      padding: 8px 0 14px;
    }

    .incomeMetricGrid {
      grid-template-columns: 1fr;
    }
  }
`;
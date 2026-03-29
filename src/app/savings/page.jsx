"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  CalendarClock,
  Copy,
  Download,
  PiggyBank,
  Plus,
  Search,
  Target,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import GlassPane from "../components/GlassPane";

const GOAL_PRESETS = [
  "Emergency Fund",
  "Vacation",
  "Truck / Car Fund",
  "House Projects",
  "Christmas / Gifts",
  "Taxes",
  "Investing (Cash to Brokerage)",
  "Other",
];

const PRIORITY_OPTIONS = ["High", "Medium", "Low"];
const QUICK_AMOUNTS = [25, 100, 250, 500];

function uid() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
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

function pct(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "0%";
  return `${Math.round(num)}%`;
}

function isoDate(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function todayISO() {
  return isoDate(new Date());
}

function monthKeyFromISO(iso) {
  const s = String(iso || "");
  return s.length >= 7 ? s.slice(0, 7) : "";
}

function fmtMonthLabel(ym) {
  if (!ym || ym.length < 7) return "—";
  const [y, m] = ym.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return ym;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
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

function daysUntil(iso) {
  if (!iso) return null;
  const now = new Date();
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  const due = new Date(`${iso}T00:00:00`).getTime();
  if (!Number.isFinite(due)) return null;
  return Math.round((due - today) / 86400000);
}

function progressPercent(goal) {
  const target = safeNum(goal?.target, 0);
  const current = safeNum(goal?.current, 0);
  if (target <= 0) return 0;
  return Math.max(0, Math.min(100, (current / target) * 100));
}

function amountLeft(goal) {
  return Math.max(0, safeNum(goal?.target, 0) - safeNum(goal?.current, 0));
}

function priorityRank(priority) {
  if (priority === "High") return 0;
  if (priority === "Medium") return 1;
  return 2;
}

function dueLabel(goal) {
  if (!goal?.dueDate) return "No due date";
  const d = daysUntil(goal.dueDate);
  if (d === null) return "No due date";
  if (d < 0) return `${Math.abs(d)}d overdue`;
  if (d === 0) return "Due today";
  if (d === 1) return "Due tomorrow";
  return `Due in ${d}d`;
}

function progressTone(goal) {
  const value = progressPercent(goal);
  if (value >= 100) return "green";
  if (value >= 65) return "green";
  if (value >= 30) return "amber";
  return "neutral";
}

function dueTone(goal) {
  const d = daysUntil(goal?.dueDate);
  if (d === null) return "neutral";
  if (d < 0) return "red";
  if (d === 0) return "red";
  if (d <= 7) return "amber";
  return "green";
}

function priorityTone(priority) {
  if (priority === "High") return "red";
  if (priority === "Medium") return "amber";
  return "neutral";
}

function toneByValue(value, inverse = false) {
  const num = safeNum(value, 0);
  if (num === 0) return "neutral";
  if (inverse) return num > 0 ? "red" : "green";
  return num > 0 ? "green" : "red";
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

function goalInitials(name = "") {
  const clean = String(name).trim();
  if (!clean) return "SG";
  const parts = clean.split(/\s+/).slice(0, 2);
  return parts
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function paceNeed(goal) {
  const left = amountLeft(goal);
  const d = daysUntil(goal?.dueDate);

  if (left <= 0 || d === null) {
    return {
      perDay: null,
      perWeek: null,
      perMonth: null,
    };
  }

  const safeDays = Math.max(1, d);

  return {
    perDay: left / safeDays,
    perWeek: left / (safeDays / 7),
    perMonth: left / (safeDays / 30),
  };
}

function recentProjection(goal) {
  const list = Array.isArray(goal?.contributions) ? goal.contributions : [];

  if (amountLeft(goal) <= 0) {
    return {
      text: "Already funded",
      tone: "green",
    };
  }

  if (list.length < 2) {
    return {
      text: "Need more history",
      tone: "neutral",
    };
  }

  const recent = list
    .slice()
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")))
    .slice(-8);

  const dates = recent
    .map((item) => new Date(`${item.date}T00:00:00`).getTime())
    .filter((n) => Number.isFinite(n));

  const total = recent.reduce((sum, item) => sum + safeNum(item.amount, 0), 0);

  if (dates.length < 2 || total <= 0) {
    return {
      text: "Need more history",
      tone: "neutral",
    };
  }

  const first = Math.min(...dates);
  const last = Math.max(...dates);
  const spanDays = Math.max(1, Math.round((last - first) / 86400000) + 1);
  const perDay = total / spanDays;

  if (!Number.isFinite(perDay) || perDay <= 0) {
    return {
      text: "Need more history",
      tone: "neutral",
    };
  }

  const left = amountLeft(goal);
  const daysToFinish = Math.ceil(left / perDay);
  const finish = new Date();
  finish.setDate(finish.getDate() + daysToFinish);

  return {
    text: `At this pace, around ${finish.toLocaleDateString()}`,
    tone: daysToFinish <= 60 ? "green" : "amber",
  };
}

function resolvedGoalName(preset, customName) {
  if (preset && preset !== "Other") return preset;
  return String(customName || "").trim();
}

function mapGoalRow(row) {
  return {
    id: row.id,
    name: String(row.name ?? "").trim(),
    target: safeNum(row.target_amount, 0),
    current: safeNum(row.current_amount, 0),
    dueDate: row.target_date || "",
    priority: row.priority || "Medium",
    archived: !!row.archived,
    createdAt:
      row.created_at_ms ??
      (row.created_at ? new Date(row.created_at).getTime() : Date.now()),
    updatedAt: row.updated_at || row.created_at || null,
    contributions: Array.isArray(row.contributions) ? row.contributions : [],
  };
}

function mapGoalToRow(goal, userId) {
  return {
    id: goal.id,
    user_id: userId,
    name: String(goal.name ?? "").trim(),
    target_amount: safeNum(goal.target, 0),
    current_amount: safeNum(goal.current, 0),
    target_date: goal.dueDate || null,
    category: "general",
    notes: "",
    priority: goal.priority || "Medium",
    archived: !!goal.archived,
    contributions: Array.isArray(goal.contributions) ? goal.contributions : [],
    created_at_ms: goal.createdAt ?? Date.now(),
    updated_at: new Date().toISOString(),
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

function StatCard({ icon: Icon, label, value, detail, tone = "neutral", badge = "" }) {
  const meta = toneMeta(tone);

  return (
    <GlassPane tone={tone} size="card" style={{ height: "100%" }}>
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

          {badge ? (
            <div style={{ marginTop: 6 }}>
              <MiniPill tone={tone}>{badge}</MiniPill>
            </div>
          ) : null}

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
      className="savingsActionBtn"
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
    amber: "linear-gradient(90deg, rgba(251,191,36,.95), rgba(253,230,138,.95))",
    red: "linear-gradient(90deg, rgba(248,113,113,.95), rgba(252,165,165,.95))",
  };

  return (
    <div className="savingsProgress">
      <div
        className="savingsProgressFill"
        style={{
          width: `${normalized}%`,
          background: toneMap[tone] || toneMap.neutral,
        }}
      />
    </div>
  );
}

function CompactGoalRow({
  goal,
  selected,
  priority,
  onSelect,
  onDuplicate,
  onArchive,
  onDelete,
}) {
  const dueStatusTone = dueTone(goal);
  const progressStatusTone = progressTone(goal);
  const meta = toneMeta(
    dueStatusTone === "red"
      ? "red"
      : progressStatusTone === "green"
      ? "green"
      : "neutral"
  );
  const projection = recentProjection(goal);

  return (
    <div
      className="savingsCompactRow"
      onClick={onSelect}
      style={{
        borderColor: selected ? meta.border : "rgba(255,255,255,0.07)",
        boxShadow: selected
          ? `inset 0 1px 0 rgba(255,255,255,0.03), 0 0 0 1px rgba(255,255,255,0.01), 0 0 24px ${meta.glow}`
          : "inset 0 1px 0 rgba(255,255,255,0.025)",
      }}
    >
      <div
        className="savingsCompactAvatar"
        style={{
          borderColor: meta.border,
          color: dueStatusTone === "neutral" ? "#fff" : meta.text,
          boxShadow: `0 0 12px ${meta.glow}`,
        }}
      >
        {goalInitials(goal.name)}
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
          <div className="savingsCompactTitle">{goal.name || "Untitled goal"}</div>
          <MiniPill tone={priorityTone(goal.priority)}>{goal.priority}</MiniPill>
          <MiniPill tone={dueStatusTone}>{dueLabel(goal)}</MiniPill>
          <MiniPill tone={progressStatusTone}>{pct(progressPercent(goal))}</MiniPill>
          {priority ? <MiniPill tone="amber">Rank #{priority}</MiniPill> : null}
          {goal.archived ? <MiniPill>Archived</MiniPill> : null}
        </div>

        <div className="savingsCompactSub">
          {fmtMoney(goal.current)} saved • {fmtMoney(amountLeft(goal))} left •{" "}
          {projection.text} • Updated {formatAgo(goal.updatedAt)}
        </div>

        <div style={{ marginTop: 10 }}>
          <ProgressBar fill={progressPercent(goal)} tone={progressStatusTone} />
        </div>
      </div>

      <div className="savingsCompactValue">{fmtMoney(goal.target)}</div>

      <div className="savingsCompactActions" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="savingsIconBtn"
          onClick={onDuplicate}
          aria-label="Duplicate goal"
          title="Duplicate goal"
        >
          <Copy size={14} />
        </button>
        <button
          type="button"
          className="savingsIconBtn"
          onClick={onArchive}
          aria-label={goal.archived ? "Unarchive goal" : "Archive goal"}
          title={goal.archived ? "Unarchive goal" : "Archive goal"}
        >
          <Archive size={14} />
        </button>
        <button
          type="button"
          className="savingsIconBtn savingsDangerBtn"
          onClick={onDelete}
          aria-label="Delete goal"
          title="Delete goal"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function FocusGoalCard({
  goal,
  priority,
  saving,
  onDuplicate,
  onArchive,
  onDelete,
  onQuickAdd,
  onUndoLast,
  customAmount,
  customNote,
  setCustomAmount,
  setCustomNote,
  onCustomAdd,
}) {
  if (!goal) {
    return (
      <GlassPane size="card">
        <PaneHeader
          title="Focus Goal"
          subcopy="Choose one from the roster to work it here."
        />
        <div className="savingsEmptyState" style={{ minHeight: 170 }}>
          <div>
            <div className="savingsEmptyTitle">No goal selected</div>
            <div className="savingsEmptyText">
              Pick one from the roster on the left.
            </div>
          </div>
        </div>
      </GlassPane>
    );
  }

  const dueStatusTone = dueTone(goal);
  const progressStatusTone = progressTone(goal);
  const left = amountLeft(goal);
  const need = paceNeed(goal);
  const projection = recentProjection(goal);

  return (
    <GlassPane tone={progressStatusTone} size="card" style={{ height: "100%" }}>
      <PaneHeader
        title={goal.name || "Untitled goal"}
        subcopy="Focused controls for the goal you are actively touching."
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {priority ? <MiniPill tone="amber">Rank #{priority}</MiniPill> : null}
            <MiniPill tone={priorityTone(goal.priority)}>{goal.priority}</MiniPill>
            <MiniPill tone={dueStatusTone}>{dueLabel(goal)}</MiniPill>
            {goal.archived ? <MiniPill>Archived</MiniPill> : null}
            {saving ? <MiniPill tone="amber">Saving...</MiniPill> : null}
          </div>
        }
      />

      <div className="savingsFocusBox">
        <div className="savingsTinyLabel">Current Saved</div>

        <div
          style={{
            marginTop: 8,
            fontSize: "clamp(30px, 4vw, 46px)",
            lineHeight: 1,
            fontWeight: 850,
            letterSpacing: "-0.05em",
            color: progressStatusTone === "green" ? "#97efc7" : "#fff",
          }}
        >
          {fmtMoney(goal.current)}
        </div>

        <div
          style={{
            marginTop: 10,
            fontSize: 12,
            color: "rgba(255,255,255,0.58)",
          }}
        >
          Target {fmtMoney(goal.target)} • Updated {formatAgo(goal.updatedAt)}
        </div>

        <div className="savingsInfoGrid" style={{ marginTop: 14 }}>
          <div className="savingsInfoCell">
            <div className="savingsTinyLabel">Left</div>
            <div className="savingsInfoValue">{fmtMoney(left)}</div>
            <div className="savingsInfoSub">Still needed to finish</div>
          </div>

          <div className="savingsInfoCell">
            <div className="savingsTinyLabel">Progress</div>
            <div className="savingsInfoValue">{pct(progressPercent(goal))}</div>
            <div className="savingsInfoSub">Of total target</div>
          </div>

          <div className="savingsInfoCell">
            <div className="savingsTinyLabel">Monthly Pace</div>
            <div className="savingsInfoValue">
              {need.perMonth !== null ? fmtMoney(need.perMonth) : "—"}
            </div>
            <div className="savingsInfoSub">
              {goal.dueDate ? "Needed to hit due date" : "No due date assigned"}
            </div>
          </div>

          <div className="savingsInfoCell">
            <div className="savingsTinyLabel">Projection</div>
            <div className="savingsInfoValue">{projection.text}</div>
            <div className="savingsInfoSub">Based on recent contribution pace</div>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <ProgressBar fill={progressPercent(goal)} tone={progressStatusTone} />
        </div>

        <div className="savingsQuickChipRow" style={{ marginTop: 14 }}>
          {QUICK_AMOUNTS.map((amount) => (
            <ActionBtn key={amount} onClick={() => onQuickAdd(amount)}>
              +{fmtMoney(amount)}
            </ActionBtn>
          ))}
        </div>

        <div className="savingsContributionGrid" style={{ marginTop: 12 }}>
          <input
            className="savingsField"
            inputMode="decimal"
            placeholder="Custom amount"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
          />

          <input
            className="savingsField"
            placeholder="Note (optional)"
            value={customNote}
            onChange={(e) => setCustomNote(e.target.value)}
          />

          <ActionBtn variant="primary" onClick={onCustomAdd}>
            Add
          </ActionBtn>
        </div>

        <div className="savingsActionGrid savingsActionGridTight" style={{ marginTop: 14 }}>
          <ActionBtn onClick={onDuplicate} full>
            <Copy size={14} /> Duplicate
          </ActionBtn>
          <ActionBtn onClick={onUndoLast} full>
            Undo Last
          </ActionBtn>
          <ActionBtn onClick={onArchive} full>
            <Archive size={14} /> {goal.archived ? "Unarchive" : "Archive"}
          </ActionBtn>
          <ActionBtn variant="danger" onClick={onDelete} full>
            <Trash2 size={14} /> Delete
          </ActionBtn>
        </div>
      </div>
    </GlassPane>
  );
}

function AddGoalCard({ adding, setAdding, onAdd, saving }) {
  return (
    <GlassPane size="card" style={{ height: "100%" }}>
      <PaneHeader
        title="Add Goal"
        subcopy="Keep this fast and simple."
        right={
          <MiniPill>
            <Plus size={13} /> New
          </MiniPill>
        }
      />

      <div className="savingsFormStack">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {GOAL_PRESETS.slice(0, 4).map((item) => (
            <ActionBtn
              key={item}
              variant={adding.preset === item ? "primary" : "ghost"}
              onClick={() => setAdding((p) => ({ ...p, preset: item }))}
            >
              {item === "Truck / Car Fund" ? "Truck / Car" : item}
            </ActionBtn>
          ))}
          <ActionBtn
            variant={adding.preset === "Other" ? "primary" : "ghost"}
            onClick={() => setAdding((p) => ({ ...p, preset: "Other" }))}
          >
            Other
          </ActionBtn>
        </div>

        {adding.preset === "Other" ? (
          <div>
            <div className="savingsTinyLabel">Goal Name</div>
            <input
              className="savingsField"
              placeholder="New goal name..."
              value={adding.customName}
              onChange={(e) =>
                setAdding((p) => ({ ...p, customName: e.target.value }))
              }
            />
          </div>
        ) : null}

        <div>
          <div className="savingsTinyLabel">Resolved Goal</div>
          <input
            className="savingsField"
            value={resolvedGoalName(adding.preset, adding.customName)}
            readOnly
          />
        </div>

        <div className="savingsFormGrid2">
          <div>
            <div className="savingsTinyLabel">Target</div>
            <input
              className="savingsField"
              inputMode="decimal"
              placeholder="0.00"
              value={adding.target}
              onChange={(e) => setAdding((p) => ({ ...p, target: e.target.value }))}
            />
          </div>

          <div>
            <div className="savingsTinyLabel">Starting Saved</div>
            <input
              className="savingsField"
              inputMode="decimal"
              placeholder="0.00"
              value={adding.current}
              onChange={(e) => setAdding((p) => ({ ...p, current: e.target.value }))}
            />
          </div>
        </div>

        <div className="savingsFormGrid2">
          <div>
            <div className="savingsTinyLabel">Due Date</div>
            <input
              className="savingsField"
              type="date"
              value={adding.dueDate}
              onChange={(e) => setAdding((p) => ({ ...p, dueDate: e.target.value }))}
            />
          </div>

          <div>
            <div className="savingsTinyLabel">Priority</div>
            <select
              className="savingsField"
              value={adding.priority}
              onChange={(e) => setAdding((p) => ({ ...p, priority: e.target.value }))}
            >
              {PRIORITY_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="savingsActionGrid">
          <ActionBtn variant="primary" onClick={onAdd} full disabled={saving}>
            <Plus size={14} /> {saving ? "Saving..." : "Add Goal"}
          </ActionBtn>
        </div>
      </div>
    </GlassPane>
  );
}

function GoalEditorCard({ goal, saving, onPatch }) {
  if (!goal) {
    return (
      <GlassPane size="card">
        <PaneHeader
          title="Goal Details"
          subcopy="Select a goal to edit the deeper fields."
        />
        <div className="savingsEmptyState" style={{ minHeight: 150 }}>
          <div>
            <div className="savingsEmptyTitle">No goal selected</div>
            <div className="savingsEmptyText">
              Choose one from the roster to edit it here.
            </div>
          </div>
        </div>
      </GlassPane>
    );
  }

  return (
    <GlassPane size="card">
      <PaneHeader
        title="Goal Details"
        subcopy="This section autosaves as you type."
        right={saving ? <MiniPill tone="amber">Saving...</MiniPill> : null}
      />

      <div className="savingsFormStack">
        <div className="savingsFormGrid3">
          <div>
            <div className="savingsTinyLabel">Goal Name</div>
            <input
              className="savingsField"
              value={goal.name}
              onChange={(e) => onPatch({ name: e.target.value })}
            />
          </div>

          <div>
            <div className="savingsTinyLabel">Priority</div>
            <select
              className="savingsField"
              value={goal.priority}
              onChange={(e) => onPatch({ priority: e.target.value })}
            >
              {PRIORITY_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="savingsTinyLabel">Due Date</div>
            <input
              className="savingsField"
              type="date"
              value={goal.dueDate || ""}
              onChange={(e) => onPatch({ dueDate: e.target.value })}
            />
          </div>
        </div>

        <div className="savingsFormGrid3">
          <div>
            <div className="savingsTinyLabel">Current Saved</div>
            <input
              className="savingsField"
              value={String(goal.current || "")}
              onChange={(e) =>
                onPatch({ current: safeNum(parseMoneyInput(e.target.value), 0) })
              }
            />
          </div>

          <div>
            <div className="savingsTinyLabel">Target</div>
            <input
              className="savingsField"
              value={String(goal.target || "")}
              onChange={(e) =>
                onPatch({ target: safeNum(parseMoneyInput(e.target.value), 0) })
              }
            />
          </div>

          <div>
            <div className="savingsTinyLabel">Archived</div>
            <select
              className="savingsField"
              value={goal.archived ? "yes" : "no"}
              onChange={(e) => onPatch({ archived: e.target.value === "yes" })}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
        </div>

        <div className="savingsInfoCell">
          <div className="savingsTinyLabel">Computed Read</div>
          <div className="savingsInfoValue">
            {fmtMoney(goal.current)} / {fmtMoney(goal.target)} • {pct(progressPercent(goal))}
          </div>
          <div className="savingsInfoSub" style={{ marginTop: 6 }}>
            {dueLabel(goal)} • {fmtMoney(amountLeft(goal))} left
          </div>
        </div>
      </div>
    </GlassPane>
  );
}

export default function SavingsPage() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("active");
  const [sort, setSort] = useState("priority");
  const [showArchived, setShowArchived] = useState(false);
  const [focusMode, setFocusMode] = useState("deadline");
  const [selectedGoalId, setSelectedGoalId] = useState("");
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

    const { error } = await supabase
      .from("savings_goals")
      .insert(mapGoalToRow(cloned, userId));

    if (error) {
      console.error("duplicate goal error:", error);
      await loadSavingsPage();
    }
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
      const okay = window.confirm(
        "Replace all current savings goals for this account?"
      );
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

  const activeGoals = useMemo(
    () => goals.filter((g) => !g.archived),
    [goals]
  );

  const totals = useMemo(() => {
    const totalCurrent = activeGoals.reduce(
      (sum, g) => sum + safeNum(g.current),
      0
    );
    const totalTarget = activeGoals.reduce(
      (sum, g) => sum + safeNum(g.target),
      0
    );
    const totalLeft = Math.max(0, totalTarget - totalCurrent);
    const completion =
      totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0;

    const fundedCount = activeGoals.filter((g) => amountLeft(g) <= 0).length;
    const dueSoonCount = activeGoals.filter((g) => {
      const d = daysUntil(g.dueDate);
      return d !== null && d >= 0 && d <= 14 && amountLeft(g) > 0;
    }).length;

    const overdueCount = activeGoals.filter((g) => {
      const d = daysUntil(g.dueDate);
      return d !== null && d < 0 && amountLeft(g) > 0;
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

        const ad = daysUntil(a.dueDate);
        const bd = daysUntil(b.dueDate);
        const aDue = ad === null ? Number.POSITIVE_INFINITY : ad;
        const bDue = bd === null ? Number.POSITIVE_INFINITY : bd;
        if (aDue !== bDue) return aDue - bDue;

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
        const d = daysUntil(g.dueDate);
        if (!(d !== null && d <= 14 && amountLeft(g) > 0)) return false;
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
      list.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
      return list;
    }

    list.sort((a, b) => {
      const ad = daysUntil(a.dueDate);
      const bd = daysUntil(b.dueDate);
      return safeNum(ad, 9999) - safeNum(bd, 9999);
    });
    return list;
  }, [goals, showArchived, filter, search, sort, priorityMap]);

  const selectedGoal =
    goals.find((g) => g.id === selectedGoalId) || visibleGoals[0] || null;

  const selectedPriority = selectedGoal
    ? priorityMap.get(selectedGoal.id) ?? null
    : null;

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
      .slice(0, 6);
  }, [activeGoals]);

  const monthLabel = fmtMonthLabel(monthKeyFromISO(todayISO()));

  const focusText = useMemo(() => {
    if (!activeGoals.length) {
      return "No goals yet. Add one and start filling the page with real data.";
    }

    if (totals.overdueCount > 0) {
      return `${totals.overdueCount} goal${totals.overdueCount === 1 ? "" : "s"} overdue. Fix those first.`;
    }

    const firstOpen = rankedGoals.find((g) => amountLeft(g) > 0);
    if (firstOpen) return `${firstOpen.name} is the main focus right now.`;

    return "Everything funded. Keep it that way.";
  }, [activeGoals, totals.overdueCount, rankedGoals]);

  const heroTone =
    totals.overdueCount > 0
      ? "red"
      : totals.dueSoonCount > 0
      ? "amber"
      : "green";

  if (loading) {
    return (
      <main className="savingsPage">
        <div className="savingsPageShell">
          <GlassPane size="card">
            <div style={{ fontWeight: 800, fontSize: 18, color: "#fff" }}>
              Loading savings.
            </div>
          </GlassPane>
        </div>
        <style jsx global>{globalStyles}</style>
      </main>
    );
  }

  return (
    <>
      <main className="savingsPage">
        <div className="savingsPageShell">
          {pageError ? (
            <GlassPane tone="red" size="card">
              <div style={{ fontWeight: 800, fontSize: 16, color: "#fff" }}>
                Savings error
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 13,
                  color: "rgba(255,255,255,0.74)",
                }}
              >
                {pageError}
              </div>
            </GlassPane>
          ) : null}

          <GlassPane size="card">
            <div className="savingsHeroGrid">
              <div style={{ minWidth: 0 }}>
                <div className="savingsEyebrow">Life Command Center</div>
                <div className="savingsHeroTitle">Savings Command</div>
                <div className="savingsHeroSub">
                  Cleaner savings pressure, tighter controls, stronger focus logic,
                  and a layout that actually fills the page instead of leaving dead space.
                </div>

                <div className="savingsPillRow">
                  <MiniPill>{activeGoals.length} active goals</MiniPill>
                  <MiniPill>{monthLabel}</MiniPill>
                  <MiniPill>{GOAL_PRESETS.length - 1} presets</MiniPill>
                  <MiniPill>{PRIORITY_OPTIONS.length} priorities</MiniPill>
                </div>
              </div>

              <div className="savingsHeroSide">
                <MiniPill>{focusMode}</MiniPill>
                <MiniPill tone="green">{fmtMoney(totals.totalCurrent)} saved</MiniPill>
                <MiniPill tone={heroTone}>{totals.dueSoonCount} due soon</MiniPill>
              </div>
            </div>
          </GlassPane>

          <section className="savingsMetricGrid">
            <StatCard
              icon={PiggyBank}
              label="Saved"
              value={fmtMoney(totals.totalCurrent)}
              detail={`${activeGoals.length} active goal${activeGoals.length === 1 ? "" : "s"} on the board.`}
              tone="green"
            />
            <StatCard
              icon={Target}
              label="Target"
              value={fmtMoney(totals.totalTarget)}
              detail="All active savings targets added together."
              tone="neutral"
            />
            <StatCard
              icon={Wallet}
              label="Still Needed"
              value={fmtMoney(totals.totalLeft)}
              detail="Total gap left before the active board is fully funded."
              tone={totals.totalLeft > 0 ? "amber" : "green"}
            />
            <StatCard
              icon={TrendingUp}
              label="Funding Health"
              value={pct(totals.completion)}
              detail="Overall completion across active savings goals."
              tone={toneByValue(totals.completion - 50)}
              badge={`${totals.fundedCount} funded`}
            />
            <StatCard
              icon={CalendarClock}
              label="Due Soon"
              value={String(totals.dueSoonCount)}
              detail={focusText}
              tone={heroTone}
              badge={totals.overdueCount > 0 ? `${totals.overdueCount} overdue` : ""}
            />
          </section>

          <GlassPane size="card">
            <PaneHeader
              title="Savings Controls"
              subcopy="Tune focus order and whether archived goals stay in view."
            />

            <div className="savingsControlsGrid">
              <div>
                <div className="savingsTinyLabel">Focus Order</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <ActionBtn
                    variant={focusMode === "deadline" ? "primary" : "ghost"}
                    onClick={() => setFocusMode("deadline")}
                  >
                    Deadline
                  </ActionBtn>
                  <ActionBtn
                    variant={focusMode === "gap" ? "primary" : "ghost"}
                    onClick={() => setFocusMode("gap")}
                  >
                    Biggest Gap
                  </ActionBtn>
                  <ActionBtn
                    variant={focusMode === "progress" ? "primary" : "ghost"}
                    onClick={() => setFocusMode("progress")}
                  >
                    Least Funded
                  </ActionBtn>
                </div>
              </div>

              <div>
                <div className="savingsTinyLabel">Quick Read</div>
                <input className="savingsField" readOnly value={focusText} />
              </div>

              <div>
                <div className="savingsTinyLabel">Show Archived</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <ActionBtn
                    variant={!showArchived ? "primary" : "ghost"}
                    onClick={() => setShowArchived(false)}
                  >
                    Hide
                  </ActionBtn>
                  <ActionBtn
                    variant={showArchived ? "primary" : "ghost"}
                    onClick={() => setShowArchived(true)}
                  >
                    Show
                  </ActionBtn>
                </div>
              </div>
            </div>
          </GlassPane>

          <section className="savingsWorkspaceGrid">
            <GlassPane size="card" style={{ height: "100%" }}>
              <PaneHeader
                title="Goal Roster"
                subcopy="Scroll the roster, select the one you want, and work it in the center."
                right={<MiniPill>{visibleGoals.length} showing</MiniPill>}
              />

              <div className="savingsRosterControls">
                <div className="savingsSearchWrap">
                  <Search size={15} />
                  <input
                    className="savingsField savingsSearchField"
                    placeholder="Search goal"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <select
                  className="savingsField"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="active">Active only</option>
                  <option value="all">All goals</option>
                  <option value="archived">Archived</option>
                  <option value="due">Due soon</option>
                </select>

                <select
                  className="savingsField"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="priority">Priority</option>
                  <option value="due">Due first</option>
                  <option value="left">Amount left</option>
                  <option value="progress">Least funded</option>
                  <option value="updated">Recently updated</option>
                  <option value="name">Name</option>
                </select>
              </div>

              {visibleGoals.length ? (
                <div className="savingsRosterListCompact">
                  {visibleGoals.map((goal) => (
                    <CompactGoalRow
                      key={goal.id}
                      goal={goal}
                      selected={goal.id === selectedGoal?.id}
                      priority={priorityMap.get(goal.id) ?? null}
                      onSelect={() => setSelectedGoalId(goal.id)}
                      onDuplicate={() => duplicateGoal(goal)}
                      onArchive={() => updateGoal(goal.id, { archived: !goal.archived })}
                      onDelete={() => removeGoal(goal.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="savingsEmptyState">
                  <div>
                    <div className="savingsEmptyTitle">No goals found</div>
                    <div className="savingsEmptyText">
                      Clear filters or add a new savings goal.
                    </div>
                  </div>
                </div>
              )}
            </GlassPane>

            <FocusGoalCard
              goal={selectedGoal}
              priority={selectedPriority}
              saving={selectedGoal ? !!savingIds[selectedGoal.id] : false}
              onDuplicate={() => selectedGoal && duplicateGoal(selectedGoal)}
              onArchive={() =>
                selectedGoal &&
                updateGoal(selectedGoal.id, { archived: !selectedGoal.archived })
              }
              onDelete={() => selectedGoal && removeGoal(selectedGoal.id)}
              onQuickAdd={(amount) =>
                selectedGoal && applyContribution(selectedGoal.id, amount, "Quick add")
              }
              onUndoLast={() => selectedGoal && undoLastContribution(selectedGoal.id)}
              customAmount={selectedGoal ? customContribution[selectedGoal.id] ?? "" : ""}
              customNote={selectedGoal ? customContributionNote[selectedGoal.id] ?? "" : ""}
              setCustomAmount={(value) =>
                selectedGoal &&
                setCustomContribution((prev) => ({ ...prev, [selectedGoal.id]: value }))
              }
              setCustomNote={(value) =>
                selectedGoal &&
                setCustomContributionNote((prev) => ({ ...prev, [selectedGoal.id]: value }))
              }
              onCustomAdd={() =>
                selectedGoal &&
                applyContribution(
                  selectedGoal.id,
                  parseMoneyInput(customContribution[selectedGoal.id] ?? ""),
                  customContributionNote[selectedGoal.id] ?? ""
                )
              }
            />

            <AddGoalCard
              adding={adding}
              setAdding={setAdding}
              onAdd={addGoalFromForm}
              saving={addingBusy}
            />
          </section>

          <section className="savingsLowerGrid">
            <GlassPane size="card" style={{ height: "100%" }}>
              <PaneHeader
                title="Savings Snapshot"
                subcopy="Quick board read plus import and export."
              />

              <div className="savingsSnapshotGrid">
                <div className="savingsSnapshotRow">
                  <span>Total saved</span>
                  <strong>{fmtMoney(totals.totalCurrent)}</strong>
                </div>
                <div className="savingsSnapshotRow">
                  <span>Total target</span>
                  <strong>{fmtMoney(totals.totalTarget)}</strong>
                </div>
                <div className="savingsSnapshotRow">
                  <span>Total left</span>
                  <strong>{fmtMoney(totals.totalLeft)}</strong>
                </div>
                <div className="savingsSnapshotRow">
                  <span>Funding health</span>
                  <strong>{pct(totals.completion)}</strong>
                </div>
                <div className="savingsSnapshotRow">
                  <span>Due soon</span>
                  <strong>{totals.dueSoonCount}</strong>
                </div>
                <div className="savingsSnapshotRow">
                  <span>Recent contributions</span>
                  <strong>{contributionFeed.length}</strong>
                </div>
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <ActionBtn onClick={exportGoals}>
                  <Download size={14} /> Export
                </ActionBtn>
                <ActionBtn onClick={importReplaceGoals}>
                  Import / Replace
                </ActionBtn>
              </div>

              <div style={{ marginTop: 12 }}>
                <textarea
                  className="savingsField"
                  rows={6}
                  placeholder="Paste exported JSON here to import..."
                  value={ioText}
                  onChange={(e) => setIoText(e.target.value)}
                />
              </div>

              <div style={{ marginTop: 12 }}>
                <div className="savingsTinyLabel" style={{ marginBottom: 8 }}>
                  Recent Contributions
                </div>

                {contributionFeed.length ? (
                  <div className="savingsIntelList savingsFeedList">
                    {contributionFeed.map((item) => (
                      <div key={item.id} className="savingsIntelItem">
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
                            <div className="savingsIntelTitle">{item.goalName}</div>
                            <div className="savingsIntelSub">
                              {fmtDate(item.date)}
                              {item.note ? ` • ${item.note}` : ""}
                            </div>
                          </div>

                          <MiniPill tone="green">{fmtMoneyTight(item.amount)}</MiniPill>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="savingsEmptyText">
                    No recent contributions logged.
                  </div>
                )}
              </div>
            </GlassPane>

            <GoalEditorCard
              goal={selectedGoal}
              saving={selectedGoal ? !!savingIds[selectedGoal.id] : false}
              onPatch={(patch) => selectedGoal && updateGoal(selectedGoal.id, patch)}
            />
          </section>
        </div>
      </main>

      <style jsx global>{globalStyles}</style>
    </>
  );
}

const globalStyles = `
  .savingsPage {
    width: 100%;
    min-width: 0;
    color: var(--lcc-text);
    font-family: var(--lcc-font-sans);
  }

  .savingsPageShell {
    width: 100%;
    max-width: none;
    margin: 0;
    padding: 12px 0 20px;
    display: grid;
    gap: 14px;
  }

  .savingsEyebrow {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: .22em;
    font-weight: 800;
    color: rgba(255,255,255,0.42);
  }

  .savingsHeroTitle {
    margin-top: 8px;
    font-size: clamp(24px, 3.2vw, 34px);
    line-height: 1.02;
    font-weight: 850;
    letter-spacing: -0.05em;
    color: #fff;
  }

  .savingsHeroSub {
    margin-top: 8px;
    font-size: 13px;
    line-height: 1.55;
    color: rgba(255,255,255,0.62);
    max-width: 840px;
  }

  .savingsHeroGrid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 14px;
    align-items: start;
  }

  .savingsHeroSide {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
    align-content: flex-start;
  }

  .savingsPillRow {
    margin-top: 12px;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .savingsMetricGrid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 14px;
  }

  .savingsControlsGrid {
    display: grid;
    grid-template-columns: minmax(0, 1.02fr) minmax(0, 1.1fr) minmax(250px, 0.42fr);
    gap: 14px;
    align-items: end;
  }

  .savingsWorkspaceGrid {
    display: grid;
    grid-template-columns: minmax(500px, 1.45fr) minmax(420px, 1.18fr) minmax(360px, 1fr);
    gap: 14px;
    align-items: stretch;
  }

  .savingsWorkspaceGrid > * {
    min-width: 0;
    height: 100%;
  }

  .savingsLowerGrid {
    display: grid;
    grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
    gap: 14px;
    align-items: start;
  }

  .savingsLowerGrid > * {
    min-width: 0;
  }

  .savingsRosterControls {
    display: grid;
    grid-template-columns: 1.32fr 0.84fr 0.88fr;
    gap: 10px;
    margin-bottom: 10px;
  }

  .savingsSearchWrap {
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

  .savingsSearchField {
    min-height: 42px !important;
    border: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
    padding: 0 !important;
  }

  .savingsRosterListCompact {
    display: grid;
    gap: 10px;
    min-height: 720px;
    max-height: 720px;
    overflow: auto;
    padding-right: 2px;
  }

  .savingsCompactRow {
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr) auto auto;
    gap: 10px;
    align-items: center;
    min-height: 118px;
    padding: 12px 14px;
    border-radius: 18px;
    border: 1px solid rgba(255,255,255,0.07);
    background:
      linear-gradient(180deg, rgba(8,13,24,0.78), rgba(4,8,16,0.72));
    cursor: pointer;
    transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
  }

  .savingsCompactRow:hover {
    transform: translateY(-1px);
  }

  .savingsCompactAvatar {
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

  .savingsCompactTitle {
    font-size: 13.5px;
    font-weight: 800;
    color: #fff;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  .savingsCompactSub {
    margin-top: 4px;
    font-size: 11.5px;
    color: rgba(255,255,255,0.54);
    line-height: 1.35;
  }

  .savingsCompactValue {
    font-size: 15px;
    font-weight: 850;
    color: #fff;
    white-space: nowrap;
  }

  .savingsCompactActions {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .savingsIconBtn {
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

  .savingsDangerBtn {
    border-color: rgba(255,132,163,0.18);
    color: #ffd3df;
  }

  .savingsFocusBox {
    border-radius: 22px;
    border: 1px solid rgba(214,226,255,0.12);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01));
    padding: 15px;
    min-height: 100%;
  }

  .savingsInfoGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .savingsInfoCell {
    border-radius: 18px;
    border: 1px solid rgba(255,255,255,0.05);
    background: rgba(255,255,255,0.025);
    padding: 11px;
  }

  .savingsInfoValue {
    font-size: 0.96rem;
    font-weight: 900;
    line-height: 1.15;
    color: #fff;
    overflow-wrap: anywhere;
  }

  .savingsInfoSub {
    margin-top: 5px;
    color: rgba(255,255,255,0.62);
    font-size: 0.79rem;
    line-height: 1.4;
  }

  .savingsProgress {
    height: 8px;
    border-radius: 999px;
    overflow: hidden;
    background: rgba(255,255,255,0.1);
  }

  .savingsProgressFill {
    height: 100%;
    border-radius: 999px;
    transition: width 0.4s ease;
  }

  .savingsActionGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .savingsActionGridTight {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .savingsFormStack {
    display: grid;
    gap: 12px;
  }

  .savingsFormGrid2,
  .savingsFormGrid3 {
    display: grid;
    gap: 10px;
  }

  .savingsFormGrid2 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .savingsFormGrid3 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .savingsContributionGrid {
    display: grid;
    grid-template-columns: 180px minmax(0, 1fr) 130px;
    gap: 10px;
  }

  .savingsTinyLabel {
    display: block;
    margin-bottom: 8px;
    font-size: 10px;
    color: rgba(255,255,255,0.46);
    text-transform: uppercase;
    letter-spacing: .16em;
    font-weight: 800;
  }

  .savingsField {
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

  .savingsField:focus {
    border-color: rgba(143,177,255,0.30);
    box-shadow:
      0 0 0 4px rgba(79,114,255,0.08),
      inset 0 1px 0 rgba(255,255,255,0.035);
  }

  .savingsField::placeholder {
    color: rgba(225,233,245,0.38);
  }

  .savingsField option {
    background: #08111f;
    color: #f4f7ff;
  }

  textarea.savingsField {
    min-height: 110px;
    resize: vertical;
    padding: 12px 13px;
  }

  .savingsActionBtn {
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

  .savingsActionBtn:hover {
    transform: translateY(-1px);
  }

  .savingsSnapshotGrid {
    display: grid;
    gap: 8px;
  }

  .savingsSnapshotRow {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 14px;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.03);
    color: rgba(255,255,255,0.78);
  }

  .savingsQuickChipRow {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .savingsIntelList {
    display: grid;
    gap: 10px;
    min-height: 0;
    max-height: 360px;
    overflow: auto;
    padding-right: 2px;
  }

  .savingsFeedList {
    max-height: 300px;
  }

  .savingsIntelItem {
    border-radius: 18px;
    border: 1px solid rgba(255,255,255,0.07);
    background:
      linear-gradient(180deg, rgba(8,13,24,0.78), rgba(4,8,16,0.72));
    padding: 12px;
    display: grid;
    gap: 10px;
  }

  .savingsIntelTitle {
    font-size: 13px;
    font-weight: 800;
    color: #fff;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }

  .savingsIntelSub {
    margin-top: 4px;
    font-size: 11.5px;
    color: rgba(255,255,255,0.54);
    line-height: 1.35;
  }

  .savingsEmptyState {
    min-height: 150px;
    display: grid;
    place-items: center;
    text-align: center;
    padding: 14px;
  }

  .savingsEmptyTitle {
    font-size: 16px;
    font-weight: 850;
    color: #fff;
  }

  .savingsEmptyText {
    margin-top: 6px;
    font-size: 13px;
    line-height: 1.5;
    color: rgba(255,255,255,0.60);
    max-width: 360px;
  }

  @media (max-width: 1560px) {
    .savingsWorkspaceGrid {
      grid-template-columns: minmax(440px, 1.22fr) minmax(390px, 1fr) minmax(320px, 0.9fr);
    }
  }

  @media (max-width: 1420px) {
    .savingsControlsGrid {
      grid-template-columns: 1fr;
    }

    .savingsWorkspaceGrid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .savingsWorkspaceGrid > :nth-child(3) {
      grid-column: 1 / -1;
    }

    .savingsLowerGrid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 1260px) {
    .savingsMetricGrid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .savingsRosterListCompact {
      min-height: 580px;
      max-height: 580px;
    }
  }

  @media (max-width: 1100px) {
    .savingsHeroGrid,
    .savingsWorkspaceGrid {
      grid-template-columns: 1fr;
    }

    .savingsHeroSide {
      justify-content: flex-start;
    }
  }

  @media (max-width: 1024px) {
    .savingsRosterControls,
    .savingsInfoGrid,
    .savingsFormGrid2,
    .savingsFormGrid3,
    .savingsActionGrid,
    .savingsActionGridTight,
    .savingsContributionGrid {
      grid-template-columns: 1fr;
    }

    .savingsCompactRow {
      grid-template-columns: 42px minmax(0, 1fr);
    }

    .savingsCompactValue {
      white-space: normal;
    }

    .savingsCompactActions {
      grid-column: 2;
      justify-content: flex-start;
    }

    .savingsRosterListCompact,
    .savingsIntelList {
      min-height: 0;
      max-height: none;
    }
  }

  @media (max-width: 760px) {
    .savingsPageShell {
      padding: 8px 0 14px;
    }

    .savingsMetricGrid,
    .savingsLowerGrid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .savingsMetricGrid,
    .savingsActionGrid,
    .savingsActionGridTight {
      grid-template-columns: 1fr;
    }
  }
`;
"use client";

import * as React from "react";
import { supabase } from "@/lib/supabaseClient";
import GlassPane from "../components/GlassPane";
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

export const dynamic = "force-dynamic";

const TONE = {
  green: "#9ef0c0",
  red: "#ffb2c2",
  amber: "#ffd089",
  blue: "#9fd7ff",
  white: "#f7fbff",
};

function uid() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  );
}

function money(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseISO(iso) {
  const [y, m, d] = String(iso || "")
    .split("-")
    .map(Number);

  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function toISODate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function startOfMonthISO(iso) {
  const d = parseISO(iso) ?? new Date();
  return toISODate(new Date(d.getFullYear(), d.getMonth(), 1));
}

function addMonthsISO(monthStartISO, delta) {
  const d = parseISO(monthStartISO) ?? new Date();
  return toISODate(new Date(d.getFullYear(), d.getMonth() + delta, 1));
}

function addDaysISO(iso, delta) {
  const d = parseISO(iso) ?? new Date();
  d.setDate(d.getDate() + delta);
  return toISODate(d);
}

function startOfWeekISO(iso, weekStartsOn = 0) {
  const d = parseISO(iso) ?? new Date();
  const day = d.getDay();
  const diff = (day - weekStartsOn + 7) % 7;
  d.setDate(d.getDate() - diff);
  return toISODate(d);
}

function monthLabel(monthStartISO) {
  const d = parseISO(monthStartISO) ?? new Date();
  return d.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function fmtLongDate(iso) {
  const d = parseISO(iso);
  if (!d) return "";
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function fmtShortDate(iso) {
  const d = parseISO(iso);
  if (!d) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function weekdayShort(i) {
  const base = new Date(2021, 7, 1 + i);
  return base.toLocaleDateString(undefined, { weekday: "short" });
}

function fmtTime(hhmm) {
  if (!hhmm) return "All day";
  const [h, m] = String(hhmm).split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function timeSortValue(hhmm) {
  if (!hhmm) return -1;
  const [h, m] = String(hhmm).split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return -1;
  return h * 60 + m;
}

function isTodayISO(iso) {
  return iso === todayISO();
}

function inSameMonth(dayISO, monthStartISO) {
  const d = parseISO(dayISO);
  const m = parseISO(monthStartISO);
  if (!d || !m) return false;
  return d.getFullYear() === m.getFullYear() && d.getMonth() === m.getMonth();
}

function parseMoneyInput(v) {
  const cleaned = String(v ?? "").replace(/[^0-9.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : NaN;
}

function mapProfileRow(row) {
  return {
    id: row.id,
    name: row.name || "Default",
    is_default: Boolean(row.is_default),
    color: row.color || "#94a3b8",
  };
}

function mapEventRow(row) {
  return {
    id: row.id,
    profile_id: row.profile_id || "",
    title: row.title || "",
    event_date: row.event_date,
    event_time: row.event_time || "",
    end_time: row.end_time || "",
    category: row.category || "General",
    flow: row.flow || "none",
    amount: Number(row.amount || 0),
    note: row.note || "",
    status: row.status || "scheduled",
    color: row.color || "#94a3b8",
    source: row.source || "manual",
    source_id: row.source_id || "",
    source_table: row.source_table || "",
    auto_created: Boolean(row.auto_created),
    transaction_type: row.transaction_type || null,
  };
}

function emptyEvent(dateISO, profileId = "") {
  return {
    id: "",
    profile_id: profileId,
    title: "",
    event_date: dateISO,
    event_time: "",
    end_time: "",
    category: "General",
    flow: "none",
    amount: "",
    note: "",
    status: "scheduled",
    color: "#94a3b8",
    source: "manual",
    source_id: "",
    source_table: "",
    auto_created: false,
    transaction_type: null,
  };
}

function paydayTemplate(dateISO, profileId = "") {
  return {
    ...emptyEvent(dateISO, profileId),
    title: "Payday",
    event_time: "09:00",
    category: "Payday",
    flow: "income",
    color: "#22c55e",
    transaction_type: "income",
  };
}

function expenseTemplate(dateISO, profileId = "") {
  return {
    ...emptyEvent(dateISO, profileId),
    title: "Expense",
    category: "Expense",
    flow: "expense",
    color: "#ef4444",
    transaction_type: "expense",
  };
}

function toneMeta(tone = "neutral") {
  if (tone === "green") {
    return {
      text: "#9ef0c0",
      border: "rgba(158,240,192,0.18)",
      glow: "rgba(158,240,192,0.12)",
      dot: "#8ef4bb",
      pillBg: "rgba(8,18,12,0.36)",
    };
  }

  if (tone === "amber") {
    return {
      text: "#ffd089",
      border: "rgba(255,208,137,0.18)",
      glow: "rgba(255,208,137,0.12)",
      dot: "#ffd089",
      pillBg: "rgba(18,14,8,0.36)",
    };
  }

  if (tone === "red") {
    return {
      text: "#ffb2c2",
      border: "rgba(255,178,194,0.18)",
      glow: "rgba(255,178,194,0.12)",
      dot: "#ff96ae",
      pillBg: "rgba(18,8,11,0.36)",
    };
  }

  if (tone === "blue") {
    return {
      text: "#9fd7ff",
      border: "rgba(159,215,255,0.18)",
      glow: "rgba(159,215,255,0.12)",
      dot: "#9fd7ff",
      pillBg: "rgba(8,14,20,0.36)",
    };
  }

  return {
    text: "#f7fbff",
    border: "rgba(214,226,255,0.14)",
    glow: "rgba(214,226,255,0.10)",
    dot: "#f7fbff",
    pillBg: "rgba(10,14,21,0.36)",
  };
}

function toneForEvent(ev) {
  const source = String(ev?.source || "");
  const flow = String(ev?.flow || "none").toLowerCase();
  const category = String(ev?.category || "").toLowerCase();
  const title = String(ev?.title || "").toLowerCase();

  if (
    flow === "income" ||
    category === "payday" ||
    source === "income" ||
    title.includes("payday") ||
    title.includes("income")
  ) {
    return {
      tone: "green",
      label: "Income",
      line: TONE.green,
    };
  }

  if (source === "planned_expense") {
    return {
      tone: "amber",
      label: "Planned",
      line: TONE.amber,
    };
  }

  if (flow === "expense" || source === "spending") {
    return {
      tone: "red",
      label: "Expense",
      line: TONE.red,
    };
  }

  return {
    tone: "blue",
    label: "General",
    line: TONE.blue,
  };
}

function sourceLabel(ev) {
  if (ev.source === "spending") return "Synced from Spending";
  if (ev.source === "planned_expense") return "Synced planned item";
  if (ev.source === "income") return "Synced income";
  return "Manual event";
}

function eyebrowStyle() {
  return {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: ".22em",
    fontWeight: 900,
    color: "rgba(255,255,255,0.40)",
  };
}

function mutedStyle() {
  return {
    fontSize: 12,
    color: "rgba(255,255,255,0.60)",
    lineHeight: 1.45,
  };
}

function StatusDot({ tone = "neutral", size = 8 }) {
  const meta = toneMeta(tone);

  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: meta.dot,
        boxShadow: `0 0 14px ${meta.glow}`,
        flexShrink: 0,
      }}
    />
  );
}

function MiniPill({ children, tone = "neutral" }) {
  const meta = toneMeta(tone);

  return (
    <div
      style={{
        minHeight: 34,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "0 12px",
        borderRadius: 999,
        border: `1px solid ${meta.border}`,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012))",
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), 0 0 14px ${meta.glow}`,
        color: tone === "neutral" ? "rgba(255,255,255,0.86)" : meta.text,
        fontSize: 11,
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
  );
}

function GhostButton({ children, onClick, icon, active = false, style, type = "button" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      style={{
        minHeight: 40,
        padding: "10px 14px",
        borderRadius: 15,
        border: active
          ? "1px solid rgba(214,226,255,0.16)"
          : "1px solid rgba(214,226,255,0.10)",
        background: active
          ? "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.018))"
          : "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012))",
        color: "#fff",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        fontSize: 13,
        fontWeight: 900,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
        cursor: "pointer",
        ...style,
      }}
    >
      {icon || null}
      {children}
    </button>
  );
}

function SolidButton({ children, onClick, icon, style, type = "button" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      style={{
        minHeight: 40,
        padding: "10px 14px",
        borderRadius: 15,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "#f7fbff",
        color: "#09111f",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        fontSize: 13,
        fontWeight: 900,
        cursor: "pointer",
        ...style,
      }}
    >
      {icon || null}
      {children}
    </button>
  );
}

function FieldLabel({ children }) {
  return (
    <label
      style={{
        display: "block",
        marginBottom: 8,
        fontSize: 12,
        color: "rgba(255,255,255,0.72)",
        fontWeight: 700,
      }}
    >
      {children}
    </label>
  );
}

function FieldInput(props) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        minHeight: 44,
        borderRadius: 16,
        border: "1px solid rgba(214,226,255,0.10)",
        background: "rgba(255,255,255,0.04)",
        color: "#fff",
        padding: "0 14px",
        outline: "none",
        ...props.style,
      }}
    />
  );
}

function FieldTextarea(props) {
  return (
    <textarea
      {...props}
      style={{
        width: "100%",
        minHeight: 120,
        borderRadius: 16,
        border: "1px solid rgba(214,226,255,0.10)",
        background: "rgba(255,255,255,0.04)",
        color: "#fff",
        padding: "12px 14px",
        outline: "none",
        resize: "vertical",
        ...props.style,
      }}
    />
  );
}

function FieldSelect({ children, value, onChange, style }) {
  return (
    <div style={{ position: "relative" }}>
      <select
        value={value}
        onChange={onChange}
        style={{
          width: "100%",
          minHeight: 44,
          borderRadius: 16,
          border: "1px solid rgba(214,226,255,0.10)",
          background: "rgba(255,255,255,0.04)",
          color: "#fff",
          padding: "0 40px 0 14px",
          appearance: "none",
          outline: "none",
          ...style,
        }}
      >
        {children}
      </select>

      <ChevronDown
        size={16}
        style={{
          position: "absolute",
          right: 12,
          top: "50%",
          transform: "translateY(-50%)",
          color: "rgba(255,255,255,0.54)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

function SearchBox({ value, onChange }) {
  return (
    <div style={{ position: "relative" }}>
      <Search
        size={16}
        style={{
          position: "absolute",
          left: 12,
          top: "50%",
          transform: "translateY(-50%)",
          color: "rgba(255,255,255,0.45)",
          pointerEvents: "none",
        }}
      />
      <FieldInput
        value={value}
        onChange={onChange}
        placeholder="Search events..."
        style={{ paddingLeft: 38 }}
      />
    </div>
  );
}

function HeaderBar({
  monthLabelText,
  profileName,
  focusTitle,
  focusTone,
  onManage,
  onToday,
  onAdd,
}) {
  return (
    <GlassPane size="hero">
      <div className="lccCalHeroGrid">
        <div style={{ minWidth: 0 }}>
          <div style={eyebrowStyle()}>Live calendar board</div>

          <div
            style={{
              marginTop: 8,
              fontSize: "clamp(28px, 4vw, 40px)",
              lineHeight: 0.96,
              fontWeight: 950,
              letterSpacing: "-0.05em",
              color: "#fff",
            }}
          >
            Calendar Command
          </div>

          <div
            style={{
              marginTop: 10,
              display: "flex",
              alignItems: "center",
              gap: 10,
              minWidth: 0,
            }}
          >
            <StatusDot tone={focusTone} />
            <div
              style={{
                ...mutedStyle(),
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {focusTitle}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          <MiniPill>{monthLabelText}</MiniPill>
          <MiniPill>{profileName || "Calendar profile"}</MiniPill>
          <GhostButton onClick={onManage}>Manage</GhostButton>
          <GhostButton onClick={onToday}>Today</GhostButton>
          <SolidButton onClick={onAdd} icon={<Plus size={15} />}>
            Add Event
          </SolidButton>
        </div>
      </div>
    </GlassPane>
  );
}

function MetricCard({ label, value, detail, tone = "neutral" }) {
  const meta = toneMeta(tone);

  return (
    <GlassPane tone={tone} size="card" style={{ height: "100%" }}>
      <div
        style={{
          minHeight: 118,
          height: "100%",
          display: "grid",
          gridTemplateRows: "auto auto 1fr",
          gap: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            alignItems: "center",
          }}
        >
          <div style={eyebrowStyle()}>{label}</div>
          <StatusDot tone={tone} size={9} />
        </div>

        <div
          style={{
            fontSize: "clamp(28px, 3vw, 40px)",
            lineHeight: 0.96,
            fontWeight: 950,
            letterSpacing: "-0.055em",
            color: tone === "neutral" ? "#fff" : meta.text,
          }}
        >
          {value}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            color: "rgba(255,255,255,0.62)",
            fontSize: 12,
            lineHeight: 1.4,
          }}
        >
          {detail}
        </div>
      </div>
    </GlassPane>
  );
}

function PaneHeader({ title, subcopy, right }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 12,
        flexWrap: "wrap",
        marginBottom: 14,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 20,
            lineHeight: 1,
            fontWeight: 900,
            letterSpacing: "-0.03em",
            color: "#fff",
          }}
        >
          {title}
        </div>

        {subcopy ? <div style={{ ...mutedStyle(), marginTop: 6 }}>{subcopy}</div> : null}
      </div>

      {right || null}
    </div>
  );
}

function FilterChip({ children, active = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        minHeight: 34,
        padding: "7px 12px",
        borderRadius: 13,
        border: active
          ? "1px solid rgba(214,226,255,0.14)"
          : "1px solid rgba(255,255,255,0.06)",
        background: active
          ? "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.014))"
          : "rgba(255,255,255,0.01)",
        color: active ? "#fff" : "rgba(255,255,255,0.66)",
        fontWeight: 800,
        fontSize: 12,
        boxShadow: active ? "inset 0 1px 0 rgba(255,255,255,0.05)" : "none",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function DotBadge({ children, tone = "neutral" }) {
  const meta = toneMeta(tone);

  return (
    <span
      style={{
        minHeight: 23,
        display: "inline-flex",
        alignItems: "center",
        padding: "0 8px",
        borderRadius: 999,
        border: `1px solid ${meta.border}`,
        background: meta.pillBg,
        color: tone === "neutral" ? "rgba(255,255,255,0.84)" : meta.text,
        fontSize: 10,
        fontWeight: 900,
        letterSpacing: ".12em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function EventPreview({ ev }) {
  const t = toneForEvent(ev);

  return (
    <div
      style={{
        display: "flex",
        minWidth: 0,
        alignItems: "center",
        gap: 8,
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: t.line,
          boxShadow: `0 0 10px ${t.line}`,
          flexShrink: 0,
        }}
      />

      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "rgba(255,255,255,0.66)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {ev.event_time ? `${fmtTime(ev.event_time)} · ` : ""}
        {ev.title}
      </div>
    </div>
  );
}

function DayCell({ dayISO, monthStart, events, selected, onOpen }) {
  const sameMonth = inSameMonth(dayISO, monthStart);
  const today = isTodayISO(dayISO);

  const incomeTotal = events
    .filter((ev) => String(ev.flow) === "income")
    .reduce((sum, ev) => sum + Number(ev.amount || 0), 0);

  const expenseTotal = events
    .filter((ev) => String(ev.flow) === "expense" && ev.source !== "planned_expense")
    .reduce((sum, ev) => sum + Number(ev.amount || 0), 0);

  const plannedTotal = events
    .filter((ev) => ev.source === "planned_expense")
    .reduce((sum, ev) => sum + Number(ev.amount || 0), 0);

  return (
    <button
      type="button"
      onClick={() => onOpen(dayISO)}
      style={{
        minHeight: 170,
        padding: 16,
        borderRadius: 24,
        textAlign: "left",
        border: selected
          ? "1px solid rgba(255,255,255,0.18)"
          : today
          ? "1px solid rgba(158,240,192,0.24)"
          : "1px solid rgba(255,255,255,0.09)",
        background: selected
          ? "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.016)), rgba(7,10,16,0.12)"
          : "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.010)), rgba(7,10,16,0.10)",
        boxShadow: selected
          ? "inset 0 1px 0 rgba(255,255,255,0.10), 0 18px 36px rgba(0,0,0,0.14), 0 0 18px rgba(255,255,255,0.04)"
          : today
          ? "inset 0 1px 0 rgba(255,255,255,0.08), 0 18px 36px rgba(0,0,0,0.14), 0 0 18px rgba(158,240,192,0.05)"
          : "inset 0 1px 0 rgba(255,255,255,0.06), 0 18px 36px rgba(0,0,0,0.12)",
        opacity: sameMonth ? 1 : 0.38,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 950,
              lineHeight: 1,
              color: "#fff",
            }}
          >
            {parseISO(dayISO)?.getDate()}
          </div>

          <div
            style={{
              marginTop: 4,
              fontSize: 11,
              color: "rgba(255,255,255,0.35)",
            }}
          >
            {dayISO}
          </div>
        </div>

        {events.length > 0 ? (
          <div
            style={{
              minWidth: 28,
              height: 28,
              borderRadius: 999,
              display: "grid",
              placeItems: "center",
              padding: "0 8px",
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.06)",
              fontSize: 11,
              fontWeight: 900,
              color: "#fff",
            }}
          >
            {events.length}
          </div>
        ) : null}
      </div>

      <div
        style={{
          marginTop: 12,
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
        }}
      >
        {incomeTotal > 0 ? <DotBadge tone="green">+ {money(incomeTotal)}</DotBadge> : null}
        {expenseTotal > 0 ? <DotBadge tone="red">- {money(expenseTotal)}</DotBadge> : null}
        {plannedTotal > 0 ? <DotBadge tone="amber">{money(plannedTotal)}</DotBadge> : null}
      </div>

      {events.length > 0 ? (
        <div
          style={{
            marginTop: 12,
            display: "grid",
            gap: 6,
          }}
        >
          {events.slice(0, 2).map((ev) => (
            <EventPreview key={ev.id} ev={ev} />
          ))}

          {events.length > 2 ? (
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: "rgba(255,255,255,0.36)",
              }}
            >
              +{events.length - 2} more
            </div>
          ) : null}
        </div>
      ) : null}
    </button>
  );
}

function ActionMenu({ children }) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    function close() {
      setOpen(false);
    }

    if (!open) return undefined;
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);

  return (
    <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          border: "1px solid rgba(214,226,255,0.10)",
          background: "rgba(255,255,255,0.04)",
          color: "rgba(255,255,255,0.84)",
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
        }}
      >
        …
      </button>

      {open ? (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 42,
            zIndex: 10,
            width: 210,
            borderRadius: 18,
            border: "1px solid rgba(214,226,255,0.10)",
            background: "rgba(10,16,28,0.96)",
            padding: 8,
            boxShadow: "0 20px 50px rgba(0,0,0,0.45)",
            backdropFilter: "blur(18px)",
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

function MenuButton({ children, onClick, tone = "default", icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        minHeight: 38,
        borderRadius: 12,
        border: "none",
        background: "transparent",
        color:
          tone === "danger"
            ? "#ffb2c2"
            : tone === "success"
            ? "#9ef0c0"
            : "rgba(255,255,255,0.86)",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "0 10px",
        fontSize: 13,
        fontWeight: 800,
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      {icon || null}
      {children}
    </button>
  );
}

function TimelineItem({ ev, onEdit, onDelete, onDuplicate }) {
  const t = toneForEvent(ev);
  const meta = toneMeta(t.tone);

  return (
    <div style={{ position: "relative", paddingLeft: 42 }}>
      <div
        style={{
          position: "absolute",
          left: 13,
          top: 0,
          bottom: -24,
          width: 1,
          background: "rgba(255,255,255,0.10)",
        }}
      />

      <div
        style={{
          position: "absolute",
          left: 0,
          top: 16,
          width: 28,
          height: 28,
          borderRadius: 999,
          display: "grid",
          placeItems: "center",
          border: `1px solid ${meta.border}`,
          background: "rgba(10,16,28,0.86)",
        }}
      >
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: 999,
            background: t.line,
            boxShadow: `0 0 15px ${t.line}88`,
          }}
        />
      </div>

      <div
        style={{
          borderRadius: 22,
          border: `1px solid ${meta.border}`,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012)), rgba(7,10,16,0.10)",
          boxShadow: `0 0 0 1px rgba(255,255,255,0.02), 0 0 20px ${meta.glow}`,
          padding: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 900,
                  color: "#fff",
                  minWidth: 0,
                }}
              >
                {ev.title}
              </div>

              <DotBadge tone={t.tone}>{t.label}</DotBadge>
              <DotBadge tone={ev.auto_created ? "neutral" : "blue"}>
                {ev.auto_created ? "Synced" : "Manual"}
              </DotBadge>
            </div>

            <div
              style={{
                marginTop: 10,
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
              }}
            >
              <DotBadge tone="neutral">{fmtTime(ev.event_time)}</DotBadge>
              {ev.end_time ? <DotBadge tone="neutral">Ends {fmtTime(ev.end_time)}</DotBadge> : null}
              {ev.amount ? <DotBadge tone={t.tone}>{money(ev.amount)}</DotBadge> : null}
              {ev.category ? <DotBadge tone="neutral">{ev.category}</DotBadge> : null}
              <DotBadge tone="neutral">{sourceLabel(ev)}</DotBadge>
            </div>

            {ev.note ? (
              <div
                style={{
                  marginTop: 12,
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: "rgba(255,255,255,0.66)",
                }}
              >
                {ev.note}
              </div>
            ) : null}
          </div>

          <ActionMenu>
            {ev.auto_created ? (
              <>
                <MenuButton
                  onClick={() => onDuplicate(ev)}
                  tone="success"
                  icon={<Copy size={15} />}
                >
                  Copy as manual event
                </MenuButton>
                <div
                  style={{
                    padding: "8px 10px",
                    fontSize: 11,
                    lineHeight: 1.5,
                    color: "rgba(255,255,255,0.45)",
                  }}
                >
                  Edit or delete this from the source module so sync stays clean.
                </div>
              </>
            ) : (
              <>
                <MenuButton onClick={() => onEdit(ev)} icon={<Pencil size={15} />}>
                  Edit
                </MenuButton>
                <MenuButton
                  onClick={() => onDelete(ev)}
                  tone="danger"
                  icon={<Trash2 size={15} />}
                >
                  Delete
                </MenuButton>
              </>
            )}
          </ActionMenu>
        </div>
      </div>
    </div>
  );
}

function ModalShell({ open, title, onClose, children, width = "min(860px, 100%)" }) {
  React.useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.68)",
        backdropFilter: "blur(10px)",
        padding: 20,
      }}
    >
      <div style={{ width }}>
        <GlassPane size="hero">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 18,
            }}
          >
            <div
              style={{
                fontSize: 22,
                fontWeight: 950,
                color: "#fff",
                letterSpacing: "-0.03em",
              }}
            >
              {title}
            </div>

            <GhostButton onClick={onClose} icon={<X size={15} />}>
              Close
            </GhostButton>
          </div>

          {children}
        </GlassPane>
      </div>
    </div>
  );
}

function DayPopup({
  open,
  onClose,
  selectedDate,
  events,
  dayIn,
  dayOut,
  dayPlanned,
  onAdd,
  onPayday,
  onExpense,
  onEdit,
  onDelete,
  onDuplicate,
}) {
  React.useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const allDay = events.filter((ev) => !ev.event_time);
  const timed = events.filter((ev) => !!ev.event_time);

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 78,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.60)",
        backdropFilter: "blur(10px)",
        padding: 18,
      }}
    >
      <div style={{ width: "min(1040px, 100%)", maxHeight: "88vh" }}>
        <GlassPane size="hero" style={{ height: "100%", overflow: "hidden" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              maxHeight: "calc(88vh - 36px)",
            }}
          >
            <div style={{ borderBottom: "1px solid rgba(255,255,255,0.10)", paddingBottom: 18 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 14,
                }}
              >
                <div>
                  <div style={eyebrowStyle()}>Selected day</div>
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: "clamp(24px, 3vw, 32px)",
                      fontWeight: 950,
                      color: "#fff",
                      letterSpacing: "-0.04em",
                    }}
                  >
                    {fmtLongDate(selectedDate)}
                  </div>

                  <div
                    style={{
                      marginTop: 12,
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                    }}
                  >
                    <DotBadge tone="green">In {money(dayIn)}</DotBadge>
                    <DotBadge tone="red">Out {money(dayOut)}</DotBadge>
                    <DotBadge tone="amber">Planned {money(dayPlanned)}</DotBadge>
                    <DotBadge tone="neutral">{events.length} events</DotBadge>
                  </div>
                </div>

                <GhostButton onClick={onClose} icon={<X size={15} />}>
                  Close
                </GhostButton>
              </div>

              <div
                style={{
                  marginTop: 14,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <SolidButton onClick={() => onAdd(selectedDate)} icon={<Plus size={15} />}>
                  Add Event
                </SolidButton>
                <GhostButton onClick={() => onPayday(selectedDate)}>+ Payday</GhostButton>
                <GhostButton onClick={() => onExpense(selectedDate)}>+ Expense</GhostButton>
              </div>
            </div>

            <div
              style={{
                flex: 1,
                overflowY: "auto",
                paddingTop: 18,
              }}
            >
              {events.length === 0 ? (
                <GlassPane size="card">
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 900,
                      color: "#fff",
                    }}
                  >
                    No events for this day
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 13,
                      color: "rgba(255,255,255,0.62)",
                    }}
                  >
                    Add something manually or let the synced items land here.
                  </div>
                </GlassPane>
              ) : (
                <div style={{ display: "grid", gap: 24 }}>
                  {allDay.length > 0 ? (
                    <div>
                      <div style={{ ...eyebrowStyle(), marginBottom: 12 }}>All day</div>
                      <div style={{ display: "grid", gap: 16 }}>
                        {allDay.map((ev) => (
                          <TimelineItem
                            key={ev.id}
                            ev={ev}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onDuplicate={onDuplicate}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {timed.length > 0 ? (
                    <div>
                      <div style={{ ...eyebrowStyle(), marginBottom: 12 }}>Timed</div>
                      <div style={{ display: "grid", gap: 16 }}>
                        {timed.map((ev) => (
                          <TimelineItem
                            key={ev.id}
                            ev={ev}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onDuplicate={onDuplicate}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </GlassPane>
      </div>
    </div>
  );
}

function QueueCard({ ev, onOpen }) {
  const tone = toneForEvent(ev);

  return (
    <button
      type="button"
      onClick={() => onOpen(ev)}
      style={{
        textAlign: "left",
        padding: 14,
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,0.08)",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012))",
        cursor: "pointer",
        minHeight: 110,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "flex-start",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              color: "#fff",
              fontWeight: 900,
              fontSize: 14,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {ev.title}
          </div>

          <div style={{ ...mutedStyle(), marginTop: 4 }}>
            {fmtShortDate(ev.event_date)}
            {ev.event_time ? ` · ${fmtTime(ev.event_time)}` : " · All day"}
          </div>
        </div>

        <StatusDot tone={tone.tone} size={10} />
      </div>

      <div
        style={{
          marginTop: 10,
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        <DotBadge tone={tone.tone}>{tone.label}</DotBadge>
        {ev.amount ? <DotBadge tone={tone.tone}>{money(ev.amount)}</DotBadge> : null}
        {ev.category ? <DotBadge tone="neutral">{ev.category}</DotBadge> : null}
      </div>
    </button>
  );
}

export default function CalendarPage() {
  const [loading, setLoading] = React.useState(true);
  const [pageError, setPageError] = React.useState("");
  const [status, setStatus] = React.useState("");

  const [user, setUser] = React.useState(null);
  const [profiles, setProfiles] = React.useState([]);
  const [profileId, setProfileId] = React.useState("");

  const [monthStart, setMonthStart] = React.useState(startOfMonthISO(todayISO()));
  const [selectedDate, setSelectedDate] = React.useState(todayISO());

  const [events, setEvents] = React.useState([]);
  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState("All");

  const [dayPopupOpen, setDayPopupOpen] = React.useState(false);
  const [manageOpen, setManageOpen] = React.useState(false);
  const [editorOpen, setEditorOpen] = React.useState(false);

  const [newProfileName, setNewProfileName] = React.useState("");
  const [newProfileColor, setNewProfileColor] = React.useState("#8b5cf6");
  const [draft, setDraft] = React.useState(emptyEvent(todayISO(), ""));

  React.useEffect(() => {
    if (!status) return undefined;
    const id = window.setTimeout(() => setStatus(""), 3200);
    return () => window.clearTimeout(id);
  }, [status]);

  const refreshEvents = React.useCallback(async () => {
    if (!user || !profileId) return;

    try {
      setPageError("");
      const gridStart = startOfWeekISO(monthStart, 0);
      const gridEnd = addDaysISO(gridStart, 41);

      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .eq("user_id", user.id)
        .eq("profile_id", profileId)
        .gte("event_date", gridStart)
        .lte("event_date", gridEnd)
        .order("event_date", { ascending: true })
        .order("event_time", { ascending: true });

      if (error) throw error;
      setEvents((data || []).map(mapEventRow));
    } catch (err) {
      setPageError(err?.message || "Failed to load events.");
    }
  }, [user, profileId, monthStart]);

  const refreshProfiles = React.useCallback(async (userId) => {
    const { data, error } = await supabase
      .from("calendar_profiles")
      .select("*")
      .eq("user_id", userId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });

    if (error) throw error;
    return (data || []).map(mapProfileRow);
  }, []);

  React.useEffect(() => {
    let alive = true;

    async function boot() {
      try {
        setLoading(true);
        setPageError("");

        const {
          data: { user: currentUser },
          error: userErr,
        } = await supabase.auth.getUser();

        if (userErr) throw userErr;
        if (!alive) return;

        setUser(currentUser || null);

        if (!currentUser) {
          setLoading(false);
          return;
        }

        let loadedProfiles = await refreshProfiles(currentUser.id);

        if (loadedProfiles.length === 0) {
          const fallback = {
            id: uid(),
            user_id: currentUser.id,
            name: "Default",
            is_default: true,
            color: "#94a3b8",
          };

          const { data: inserted, error: createErr } = await supabase
            .from("calendar_profiles")
            .insert([fallback])
            .select()
            .single();

          if (createErr) throw createErr;
          loadedProfiles = [mapProfileRow(inserted)];
        }

        if (!alive) return;

        setProfiles(loadedProfiles);

        const chosen =
          loadedProfiles.find((p) => p.is_default)?.id || loadedProfiles[0]?.id || "";

        setProfileId(chosen);
        setDraft((prev) => ({ ...prev, profile_id: chosen }));
      } catch (err) {
        if (!alive) return;
        setPageError(err?.message || "Failed to load calendar.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    boot();

    return () => {
      alive = false;
    };
  }, [refreshProfiles]);

  React.useEffect(() => {
    refreshEvents();
  }, [refreshEvents]);

  const activeProfile = React.useMemo(
    () => profiles.find((p) => p.id === profileId) || profiles[0] || null,
    [profiles, profileId]
  );

  const monthGridDays = React.useMemo(() => {
    const firstCell = startOfWeekISO(monthStart, 0);
    return Array.from({ length: 42 }, (_, i) => addDaysISO(firstCell, i));
  }, [monthStart]);

  const filteredEvents = React.useMemo(() => {
    const q = search.trim().toLowerCase();

    return events.filter((ev) => {
      const category = String(ev.category || "").toLowerCase();
      const flow = String(ev.flow || "").toLowerCase();
      const source = String(ev.source || "").toLowerCase();
      const title = String(ev.title || "").toLowerCase();

      if (filter === "Paydays") {
        if (
          !(
            flow === "income" ||
            category === "payday" ||
            source === "income" ||
            title.includes("payday") ||
            title.includes("income")
          )
        ) {
          return false;
        }
      } else if (filter === "Expenses") {
        if (!(flow === "expense" || source === "spending")) return false;
      } else if (filter === "Planned") {
        if (source !== "planned_expense") return false;
      } else if (filter === "Manual") {
        if (source !== "manual") return false;
      }

      if (!q) return true;

      const hay = [
        ev.title,
        ev.note,
        ev.category,
        ev.flow,
        ev.source,
        ev.event_date,
        ev.event_time,
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [events, search, filter]);

  const filteredEventsByDate = React.useMemo(() => {
    const map = new Map();

    for (const ev of filteredEvents) {
      const key = ev.event_date;
      const arr = map.get(key) || [];
      arr.push(ev);
      map.set(key, arr);
    }

    for (const [key, arr] of map.entries()) {
      map.set(
        key,
        [...arr].sort((a, b) => {
          const aTime = timeSortValue(a.event_time);
          const bTime = timeSortValue(b.event_time);
          if (aTime !== bTime) return aTime - bTime;
          return String(a.title).localeCompare(String(b.title));
        })
      );
    }

    return map;
  }, [filteredEvents]);

  const selectedDayEvents = React.useMemo(() => {
    return [...(filteredEventsByDate.get(selectedDate) || [])].sort((a, b) => {
      const aTime = timeSortValue(a.event_time);
      const bTime = timeSortValue(b.event_time);
      if (aTime !== bTime) return aTime - bTime;
      return String(a.title).localeCompare(String(b.title));
    });
  }, [filteredEventsByDate, selectedDate]);

  const visibleMonthEvents = React.useMemo(
    () => filteredEvents.filter((ev) => inSameMonth(ev.event_date, monthStart)),
    [filteredEvents, monthStart]
  );

  const monthIncome = React.useMemo(
    () =>
      visibleMonthEvents
        .filter((ev) => String(ev.flow) === "income")
        .reduce((sum, ev) => sum + Number(ev.amount || 0), 0),
    [visibleMonthEvents]
  );

  const monthExpense = React.useMemo(
    () =>
      visibleMonthEvents
        .filter((ev) => String(ev.flow) === "expense" && ev.source !== "planned_expense")
        .reduce((sum, ev) => sum + Number(ev.amount || 0), 0),
    [visibleMonthEvents]
  );

  const monthPlanned = React.useMemo(
    () =>
      visibleMonthEvents
        .filter((ev) => ev.source === "planned_expense")
        .reduce((sum, ev) => sum + Number(ev.amount || 0), 0),
    [visibleMonthEvents]
  );

  const selectedDayIn = React.useMemo(
    () =>
      selectedDayEvents
        .filter((ev) => String(ev.flow) === "income")
        .reduce((sum, ev) => sum + Number(ev.amount || 0), 0),
    [selectedDayEvents]
  );

  const selectedDayOut = React.useMemo(
    () =>
      selectedDayEvents
        .filter((ev) => String(ev.flow) === "expense" && ev.source !== "planned_expense")
        .reduce((sum, ev) => sum + Number(ev.amount || 0), 0),
    [selectedDayEvents]
  );

  const selectedDayPlanned = React.useMemo(
    () =>
      selectedDayEvents
        .filter((ev) => ev.source === "planned_expense")
        .reduce((sum, ev) => sum + Number(ev.amount || 0), 0),
    [selectedDayEvents]
  );

  const monthManualCount = React.useMemo(
    () => visibleMonthEvents.filter((ev) => ev.source === "manual").length,
    [visibleMonthEvents]
  );

  const nextFocus = React.useMemo(() => {
    const nowDate = todayISO();
    const nowMinutes = (() => {
      const d = new Date();
      return d.getHours() * 60 + d.getMinutes();
    })();

    const sorted = [...filteredEvents].sort((a, b) => {
      if (a.event_date !== b.event_date) {
        return String(a.event_date).localeCompare(String(b.event_date));
      }

      const aTime = timeSortValue(a.event_time);
      const bTime = timeSortValue(b.event_time);
      if (aTime !== bTime) return aTime - bTime;
      return String(a.title).localeCompare(String(b.title));
    });

    return (
      sorted.find((ev) => {
        if (ev.event_date > nowDate) return true;
        if (ev.event_date < nowDate) return false;
        if (!ev.event_time) return true;
        return timeSortValue(ev.event_time) >= nowMinutes;
      }) || null
    );
  }, [filteredEvents]);

  const focusTitle = nextFocus
    ? `${fmtShortDate(nextFocus.event_date)}${
        nextFocus.event_time ? ` · ${fmtTime(nextFocus.event_time)}` : ""
      } · ${nextFocus.title}`
    : "Nothing upcoming inside this visible calendar range";

  const focusTone = nextFocus ? toneForEvent(nextFocus).tone : "neutral";

  const upcomingEvents = React.useMemo(() => {
    const nowDate = todayISO();
    const nowMinutes = (() => {
      const d = new Date();
      return d.getHours() * 60 + d.getMinutes();
    })();

    return [...filteredEvents]
      .filter((ev) => {
        if (ev.event_date > nowDate) return true;
        if (ev.event_date < nowDate) return false;
        if (!ev.event_time) return true;
        return timeSortValue(ev.event_time) >= nowMinutes;
      })
      .sort((a, b) => {
        if (a.event_date !== b.event_date) {
          return String(a.event_date).localeCompare(String(b.event_date));
        }
        const aTime = timeSortValue(a.event_time);
        const bTime = timeSortValue(b.event_time);
        if (aTime !== bTime) return aTime - bTime;
        return String(a.title).localeCompare(String(b.title));
      })
      .slice(0, 8);
  }, [filteredEvents]);

  const openEditorForNew = React.useCallback(
    (dateISO = selectedDate) => {
      setDraft(emptyEvent(dateISO, profileId));
      setEditorOpen(true);
    },
    [profileId, selectedDate]
  );

  const openEditorForPayday = React.useCallback(
    (dateISO = selectedDate) => {
      setDraft(paydayTemplate(dateISO, profileId));
      setEditorOpen(true);
    },
    [profileId, selectedDate]
  );

  const openEditorForExpense = React.useCallback(
    (dateISO = selectedDate) => {
      setDraft(expenseTemplate(dateISO, profileId));
      setEditorOpen(true);
    },
    [profileId, selectedDate]
  );

  const openEditorForEdit = React.useCallback((ev) => {
    setDraft({
      ...ev,
      amount: ev.amount ? String(ev.amount) : "",
    });
    setEditorOpen(true);
  }, []);

  const openDuplicate = React.useCallback(
    (ev) => {
      setDraft({
        ...ev,
        id: "",
        profile_id: profileId || ev.profile_id || "",
        amount: ev.amount ? String(ev.amount) : "",
        source: "manual",
        source_id: "",
        source_table: "",
        auto_created: false,
      });
      setEditorOpen(true);
    },
    [profileId]
  );

  async function handleSaveEvent(e) {
    e?.preventDefault?.();

    if (!user) return;
    if (!draft.profile_id) {
      setPageError("Pick a calendar profile first.");
      return;
    }

    if (!draft.title.trim()) {
      setPageError("Event title is required.");
      return;
    }

    if (!draft.event_date) {
      setPageError("Event date is required.");
      return;
    }

    if (draft.end_time && draft.event_time && draft.end_time < draft.event_time) {
      setPageError("End time cannot be earlier than start time.");
      return;
    }

    try {
      setPageError("");
      const parsedAmount = parseMoneyInput(draft.amount);

      const payload = {
        user_id: user.id,
        profile_id: draft.profile_id,
        title: draft.title.trim(),
        event_date: draft.event_date,
        event_time: draft.event_time || null,
        end_time: draft.end_time || null,
        category: draft.category || "General",
        flow: draft.flow || "none",
        amount: Number.isFinite(parsedAmount) ? parsedAmount : 0,
        note: draft.note?.trim() || "",
        status: draft.status || "scheduled",
        color: draft.color || "#94a3b8",
        source: "manual",
        source_id: "",
        source_table: "",
        auto_created: false,
        transaction_type:
          draft.flow === "income"
            ? "income"
            : draft.flow === "expense"
            ? "expense"
            : null,
      };

      if (draft.id) {
        const { error } = await supabase
          .from("calendar_events")
          .update(payload)
          .eq("id", draft.id)
          .eq("user_id", user.id);

        if (error) throw error;
        setStatus("Event updated.");
      } else {
        const insertPayload = {
          id: uid(),
          ...payload,
        };

        const { error } = await supabase.from("calendar_events").insert([insertPayload]);
        if (error) throw error;
        setStatus("Event created.");
      }

      setEditorOpen(false);
      await refreshEvents();
      setSelectedDate(draft.event_date);
      setDayPopupOpen(true);
    } catch (err) {
      setPageError(err?.message || "Failed to save event.");
    }
  }

  async function handleDeleteEvent(ev) {
    if (!user || !ev?.id) return;
    if (ev.auto_created) {
      setPageError("Synced events should be changed from their source module.");
      return;
    }

    const ok = window.confirm(`Delete "${ev.title}"?`);
    if (!ok) return;

    try {
      setPageError("");
      const { error } = await supabase
        .from("calendar_events")
        .delete()
        .eq("id", ev.id)
        .eq("user_id", user.id);

      if (error) throw error;
      setStatus("Event deleted.");
      await refreshEvents();
    } catch (err) {
      setPageError(err?.message || "Failed to delete event.");
    }
  }

  async function handleCreateProfile() {
    if (!user) return;
    const name = newProfileName.trim();
    if (!name) {
      setPageError("Profile name is required.");
      return;
    }

    try {
      setPageError("");
      const isFirst = profiles.length === 0;
      const payload = {
        id: uid(),
        user_id: user.id,
        name,
        color: newProfileColor || "#8b5cf6",
        is_default: isFirst,
      };

      const { data, error } = await supabase
        .from("calendar_profiles")
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      const mapped = mapProfileRow(data);
      const nextProfiles = [...profiles, mapped];
      setProfiles(nextProfiles);
      setNewProfileName("");
      setNewProfileColor("#8b5cf6");

      if (isFirst || !profileId) {
        setProfileId(mapped.id);
        setDraft((prev) => ({ ...prev, profile_id: mapped.id }));
      }

      setStatus("Profile created.");
    } catch (err) {
      setPageError(err?.message || "Failed to create profile.");
    }
  }

  async function handleSetDefaultProfile(id) {
    if (!user) return;

    try {
      setPageError("");

      const { error: clearErr } = await supabase
        .from("calendar_profiles")
        .update({ is_default: false })
        .eq("user_id", user.id);

      if (clearErr) throw clearErr;

      const { error: setErr } = await supabase
        .from("calendar_profiles")
        .update({ is_default: true })
        .eq("user_id", user.id)
        .eq("id", id);

      if (setErr) throw setErr;

      const loaded = await refreshProfiles(user.id);
      setProfiles(loaded);
      setProfileId(id);
      setDraft((prev) => ({ ...prev, profile_id: id }));
      setStatus("Default profile updated.");
    } catch (err) {
      setPageError(err?.message || "Failed to update default profile.");
    }
  }

  async function handleDeleteProfile(id) {
    if (!user) return;
    if (profiles.length <= 1) {
      setPageError("Keep at least one calendar profile.");
      return;
    }

    const target = profiles.find((p) => p.id === id);
    const ok = window.confirm(`Delete profile "${target?.name || "this profile"}"?`);
    if (!ok) return;

    try {
      setPageError("");

      const { error: eventsErr } = await supabase
        .from("calendar_events")
        .delete()
        .eq("user_id", user.id)
        .eq("profile_id", id);

      if (eventsErr) throw eventsErr;

      const { error: profileErr } = await supabase
        .from("calendar_profiles")
        .delete()
        .eq("user_id", user.id)
        .eq("id", id);

      if (profileErr) throw profileErr;

      let loaded = await refreshProfiles(user.id);

      if (!loaded.some((p) => p.is_default) && loaded[0]) {
        const replacement = loaded[0];
        await supabase
          .from("calendar_profiles")
          .update({ is_default: true })
          .eq("user_id", user.id)
          .eq("id", replacement.id);

        loaded = await refreshProfiles(user.id);
      }

      setProfiles(loaded);
      const nextId = loaded.find((p) => p.is_default)?.id || loaded[0]?.id || "";
      setProfileId(nextId);
      setDraft((prev) => ({ ...prev, profile_id: nextId }));
      setStatus("Profile deleted.");
    } catch (err) {
      setPageError(err?.message || "Failed to delete profile.");
    }
  }

  function goToday() {
    const t = todayISO();
    setMonthStart(startOfMonthISO(t));
    setSelectedDate(t);
    setDayPopupOpen(false);
  }

  function shiftMonth(delta) {
    const nextMonth = addMonthsISO(monthStart, delta);
    setMonthStart(nextMonth);

    if (!inSameMonth(selectedDate, nextMonth)) {
      setSelectedDate(nextMonth);
    }
  }

  function openDay(dayISO) {
    setSelectedDate(dayISO);
    setDayPopupOpen(true);
  }

  function openFromQueue(ev) {
    setSelectedDate(ev.event_date);
    setDayPopupOpen(true);
  }

  if (loading) {
    return (
      <main className="lccCalRoot">
        <div className="lccCalInner">
          <GlassPane size="hero">
            <div style={{ color: "#fff", fontWeight: 900, fontSize: 20 }}>
              Loading calendar…
            </div>
          </GlassPane>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="lccCalRoot">
        <div className="lccCalInner">
          <GlassPane size="hero">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                color: "#fff",
                fontWeight: 900,
                fontSize: 20,
              }}
            >
              <AlertTriangle size={18} />
              Sign in to use your calendar
            </div>
          </GlassPane>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="lccCalRoot">
        <div className="lccCalInner">
          <HeaderBar
            monthLabelText={monthLabel(monthStart)}
            profileName={activeProfile?.name || "Default"}
            focusTitle={focusTitle}
            focusTone={focusTone}
            onManage={() => setManageOpen(true)}
            onToday={goToday}
            onAdd={() => openEditorForNew(selectedDate)}
          />

          {pageError ? (
            <GlassPane tone="red" size="card">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  color: "#ffb2c2",
                  fontWeight: 900,
                }}
              >
                <AlertTriangle size={16} />
                {pageError}
              </div>
            </GlassPane>
          ) : null}

          {status ? (
            <GlassPane tone="green" size="card">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  color: "#9ef0c0",
                  fontWeight: 900,
                }}
              >
                <StatusDot tone="green" size={9} />
                {status}
              </div>
            </GlassPane>
          ) : null}

          <section className="lccCalMetrics">
            <MetricCard
              label="Month inflow"
              value={money(monthIncome)}
              detail="Visible income events in the current month view."
              tone="green"
            />
            <MetricCard
              label="Month outflow"
              value={money(monthExpense)}
              detail="Actual expense hits in the current month view."
              tone="red"
            />
            <MetricCard
              label="Planned spending"
              value={money(monthPlanned)}
              detail="Planned expense items currently landing in this month."
              tone="amber"
            />
            <MetricCard
              label="Visible events"
              value={String(visibleMonthEvents.length)}
              detail={`${monthManualCount} manual entries across this month view.`}
              tone="blue"
            />
          </section>

          <GlassPane size="card">
            <PaneHeader
              title="Controls"
              subcopy="Move the month, switch profiles, then filter what actually matters."
            />

            <div className="lccCalControlsRow">
              <GhostButton onClick={() => shiftMonth(-1)} icon={<ChevronLeft size={15} />}>
                Prev
              </GhostButton>

              <MiniPill>{monthLabel(monthStart)}</MiniPill>

              <GhostButton onClick={() => shiftMonth(1)} icon={<ChevronRight size={15} />}>
                Next
              </GhostButton>

              <div style={{ minWidth: 180 }}>
                <FieldSelect
                  value={profileId}
                  onChange={(e) => {
                    setProfileId(e.target.value);
                    setDraft((prev) => ({ ...prev, profile_id: e.target.value }));
                  }}
                >
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </FieldSelect>
              </div>

              <div style={{ minWidth: 240 }}>
                <SearchBox value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>

            <div
              style={{
                marginTop: 14,
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              {["All", "Paydays", "Expenses", "Planned", "Manual"].map((chip) => (
                <FilterChip
                  key={chip}
                  active={filter === chip}
                  onClick={() => setFilter(chip)}
                >
                  {chip}
                </FilterChip>
              ))}
            </div>
          </GlassPane>

          <GlassPane size="hero">
            <PaneHeader
              title="Month grid"
              subcopy="Tap a day to open the popup timeline."
              right={
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <DotBadge tone="green">Income</DotBadge>
                  <DotBadge tone="red">Expense</DotBadge>
                  <DotBadge tone="amber">Planned</DotBadge>
                  <DotBadge tone="neutral">{fmtLongDate(selectedDate)}</DotBadge>
                </div>
              }
            />

            <div style={{ overflowX: "auto", paddingBottom: 4 }}>
              <div style={{ minWidth: 960 }}>
                <div className="lccCalWeekdays">
                  {Array.from({ length: 7 }, (_, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "0 4px 0 6px",
                        fontSize: 11,
                        fontWeight: 900,
                        textTransform: "uppercase",
                        letterSpacing: ".16em",
                        color: "rgba(255,255,255,0.36)",
                      }}
                    >
                      {weekdayShort(i)}
                    </div>
                  ))}
                </div>

                <div className="lccCalGrid">
                  {monthGridDays.map((dayISO) => (
                    <DayCell
                      key={dayISO}
                      dayISO={dayISO}
                      monthStart={monthStart}
                      events={filteredEventsByDate.get(dayISO) || []}
                      selected={selectedDate === dayISO}
                      onOpen={openDay}
                    />
                  ))}
                </div>
              </div>
            </div>
          </GlassPane>

          <GlassPane size="card">
            <PaneHeader
              title="Upcoming queue"
              subcopy="Next visible events from this loaded date window."
              right={<MiniPill>{upcomingEvents.length} loaded</MiniPill>}
            />

            {upcomingEvents.length === 0 ? (
              <div style={mutedStyle()}>No upcoming items match the current filter.</div>
            ) : (
              <div className="lccCalQueueGrid">
                {upcomingEvents.map((ev) => (
                  <QueueCard key={ev.id} ev={ev} onOpen={openFromQueue} />
                ))}
              </div>
            )}
          </GlassPane>
        </div>
      </main>

      <DayPopup
        open={dayPopupOpen}
        onClose={() => setDayPopupOpen(false)}
        selectedDate={selectedDate}
        events={selectedDayEvents}
        dayIn={selectedDayIn}
        dayOut={selectedDayOut}
        dayPlanned={selectedDayPlanned}
        onAdd={openEditorForNew}
        onPayday={openEditorForPayday}
        onExpense={openEditorForExpense}
        onEdit={openEditorForEdit}
        onDelete={handleDeleteEvent}
        onDuplicate={openDuplicate}
      />

      <ModalShell
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        title="Manage calendar profiles"
        width="min(920px, 100%)"
      >
        <div className="lccCalManageGrid">
          <div>
            <div style={{ ...eyebrowStyle(), marginBottom: 12 }}>Profiles</div>

            <div style={{ display: "grid", gap: 12 }}>
              {profiles.map((profile) => {
                const active = profile.id === profileId;
                return (
                  <div
                    key={profile.id}
                    style={{
                      padding: 16,
                      borderRadius: 20,
                      border: active
                        ? "1px solid rgba(214,226,255,0.16)"
                        : "1px solid rgba(255,255,255,0.08)",
                      background:
                        "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012))",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            flexWrap: "wrap",
                          }}
                        >
                          <span
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: 999,
                              background: profile.color,
                              boxShadow: `0 0 14px ${profile.color}88`,
                              flexShrink: 0,
                            }}
                          />
                          <div
                            style={{
                              fontSize: 16,
                              fontWeight: 900,
                              color: "#fff",
                            }}
                          >
                            {profile.name}
                          </div>
                          {profile.is_default ? <DotBadge tone="green">Default</DotBadge> : null}
                          {active ? <DotBadge tone="blue">Active</DotBadge> : null}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {!profile.is_default ? (
                          <GhostButton onClick={() => handleSetDefaultProfile(profile.id)}>
                            Make default
                          </GhostButton>
                        ) : null}
                        {!active ? (
                          <GhostButton onClick={() => setProfileId(profile.id)}>Use</GhostButton>
                        ) : null}
                        {profiles.length > 1 ? (
                          <GhostButton
                            onClick={() => handleDeleteProfile(profile.id)}
                            style={{ color: "#ffb2c2", borderColor: "rgba(255,178,194,0.18)" }}
                          >
                            Delete
                          </GhostButton>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <GlassPane size="card">
            <div style={{ ...eyebrowStyle(), marginBottom: 12 }}>Create profile</div>

            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <FieldLabel>Name</FieldLabel>
                <FieldInput
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  placeholder="Family budget, Work, Personal..."
                />
              </div>

              <div>
                <FieldLabel>Accent color</FieldLabel>
                <FieldInput
                  type="color"
                  value={newProfileColor}
                  onChange={(e) => setNewProfileColor(e.target.value)}
                  style={{
                    padding: 6,
                    minHeight: 52,
                    background: "rgba(255,255,255,0.03)",
                  }}
                />
              </div>

              <SolidButton onClick={handleCreateProfile} icon={<Plus size={15} />}>
                Add profile
              </SolidButton>

              <div style={mutedStyle()}>
                Profiles let you split calendars without dumping everything into one messy view.
              </div>
            </div>
          </GlassPane>
        </div>
      </ModalShell>

      <ModalShell
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={draft.id ? "Edit event" : "Create event"}
        width="min(980px, 100%)"
      >
        <form onSubmit={handleSaveEvent}>
          {draft.auto_created ? (
            <GlassPane tone="amber" size="card" style={{ marginBottom: 16 }}>
              <div style={{ color: "#ffd089", fontWeight: 800 }}>
                This was originally a synced event. Saving here will convert it into a manual event.
              </div>
            </GlassPane>
          ) : null}

          <div className="lccCalEditorGrid">
            <div style={{ gridColumn: "1 / -1" }}>
              <FieldLabel>Title</FieldLabel>
              <FieldInput
                value={draft.title}
                onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Event title"
              />
            </div>

            <div>
              <FieldLabel>Date</FieldLabel>
              <FieldInput
                type="date"
                value={draft.event_date}
                onChange={(e) => setDraft((prev) => ({ ...prev, event_date: e.target.value }))}
              />
            </div>

            <div>
              <FieldLabel>Profile</FieldLabel>
              <FieldSelect
                value={draft.profile_id}
                onChange={(e) => setDraft((prev) => ({ ...prev, profile_id: e.target.value }))}
              >
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </FieldSelect>
            </div>

            <div>
              <FieldLabel>Start time</FieldLabel>
              <FieldInput
                type="time"
                value={draft.event_time}
                onChange={(e) => setDraft((prev) => ({ ...prev, event_time: e.target.value }))}
              />
            </div>

            <div>
              <FieldLabel>End time</FieldLabel>
              <FieldInput
                type="time"
                value={draft.end_time}
                onChange={(e) => setDraft((prev) => ({ ...prev, end_time: e.target.value }))}
              />
            </div>

            <div>
              <FieldLabel>Category</FieldLabel>
              <FieldSelect
                value={draft.category}
                onChange={(e) => setDraft((prev) => ({ ...prev, category: e.target.value }))}
              >
                {["General", "Payday", "Expense", "Bill", "Reminder", "Personal"].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </FieldSelect>
            </div>

            <div>
              <FieldLabel>Flow</FieldLabel>
              <FieldSelect
                value={draft.flow}
                onChange={(e) => setDraft((prev) => ({ ...prev, flow: e.target.value }))}
              >
                <option value="none">None</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </FieldSelect>
            </div>

            <div>
              <FieldLabel>Amount</FieldLabel>
              <FieldInput
                value={draft.amount}
                onChange={(e) => setDraft((prev) => ({ ...prev, amount: e.target.value }))}
                placeholder="$0"
                inputMode="decimal"
              />
            </div>

            <div>
              <FieldLabel>Status</FieldLabel>
              <FieldSelect
                value={draft.status}
                onChange={(e) => setDraft((prev) => ({ ...prev, status: e.target.value }))}
              >
                <option value="scheduled">Scheduled</option>
                <option value="done">Done</option>
                <option value="skipped">Skipped</option>
              </FieldSelect>
            </div>

            <div>
              <FieldLabel>Color</FieldLabel>
              <FieldInput
                type="color"
                value={draft.color}
                onChange={(e) => setDraft((prev) => ({ ...prev, color: e.target.value }))}
                style={{
                  padding: 6,
                  minHeight: 52,
                  background: "rgba(255,255,255,0.03)",
                }}
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <FieldLabel>Notes</FieldLabel>
              <FieldTextarea
                value={draft.note}
                onChange={(e) => setDraft((prev) => ({ ...prev, note: e.target.value }))}
                placeholder="Context, reminder, details..."
              />
            </div>
          </div>

          <div
            style={{
              marginTop: 18,
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              justifyContent: "space-between",
            }}
          >
            <div style={mutedStyle()}>
              Manual saves write into <span style={{ color: "#fff" }}>calendar_events</span>.
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <GhostButton onClick={() => setEditorOpen(false)}>Cancel</GhostButton>
              <SolidButton type="submit" icon={<Plus size={15} />}>
                {draft.id ? "Save Changes" : "Create Event"}
              </SolidButton>
            </div>
          </div>
        </form>
      </ModalShell>

      <style jsx global>{`
        .lccCalRoot {
          width: 100%;
          padding: 0 0 28px;
          font-family: var(--lcc-font-sans);
          box-sizing: border-box;
        }

        .lccCalInner {
          width: 100%;
          max-width: none;
          margin: 0;
          display: grid;
          gap: 16px;
          box-sizing: border-box;
        }

        .lccCalHeroGrid {
          min-height: 96px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 14px;
          align-items: center;
        }

        .lccCalMetrics {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }

        .lccCalControlsRow {
          display: grid;
          grid-template-columns: auto auto auto minmax(180px, 220px) minmax(240px, 1fr);
          gap: 12px;
          align-items: center;
        }

        .lccCalWeekdays {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 10px;
        }

        .lccCalGrid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 12px;
        }

        .lccCalQueueGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .lccCalManageGrid {
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
          gap: 18px;
        }

        .lccCalEditorGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        @media (max-width: 1320px) {
          .lccCalMetrics {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .lccCalQueueGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .lccCalControlsRow {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 980px) {
          .lccCalHeroGrid,
          .lccCalManageGrid,
          .lccCalEditorGrid,
          .lccCalMetrics,
          .lccCalQueueGrid,
          .lccCalControlsRow {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .lccCalRoot {
            padding: 0 0 18px;
          }
        }
      `}</style>
    </>
  );
}
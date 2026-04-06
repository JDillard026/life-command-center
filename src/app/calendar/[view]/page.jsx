"use client";

import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
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
  green: "#8ef4bb",
  red: "#ff9fb2",
  amber: "#ffd089",
  blue: "#8ecbff",
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
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function safeNum(n, fallback = 0) {
  const num = Number(n);
  return Number.isFinite(num) ? num : fallback;
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
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
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
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function weekdayShort(i) {
  const base = new Date(2021, 7, 1 + i);
  return base.toLocaleDateString(undefined, { weekday: "short" });
}

function fmtTime(hhmm) {
  if (!hhmm) return "All day";
  const [h, m] = String(hhmm)
    .split(":")
    .map(Number);
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
  const [h, m] = String(hhmm)
    .split(":")
    .map(Number);
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

function buildFetchWindow(monthStart) {
  const firstVisible = startOfWeekISO(monthStart, 0);
  const lastVisible = addDaysISO(firstVisible, 41);
  return {
    gridStart: firstVisible,
    gridEnd: lastVisible,
    loadStart: addDaysISO(firstVisible, -14),
    loadEnd: addDaysISO(lastVisible, 84),
  };
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
    amount: safeNum(row.amount, 0),
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

function isSourceOwnedEvent(ev) {
  const source = String(ev?.source || "manual").toLowerCase();
  const sourceTable = String(ev?.source_table || "").toLowerCase();
  const txType = String(ev?.transaction_type || "").toLowerCase();

  return Boolean(
    ev?.auto_created ||
      (source && source !== "manual") ||
      sourceTable ||
      ev?.source_id ||
      txType
  );
}

function isManualEvent(ev) {
  return !isSourceOwnedEvent(ev);
}

function isBillEvent(ev) {
  const source = String(ev?.source || "").toLowerCase();
  const sourceTable = String(ev?.source_table || "").toLowerCase();
  const category = String(ev?.category || "").toLowerCase();
  return source === "bill" || sourceTable === "bills" || category === "bill";
}

function isIncomeEvent(ev) {
  const source = String(ev?.source || "").toLowerCase();
  const sourceTable = String(ev?.source_table || "").toLowerCase();
  const flow = String(ev?.flow || "").toLowerCase();
  const category = String(ev?.category || "").toLowerCase();
  const title = String(ev?.title || "").toLowerCase();
  const txType = String(ev?.transaction_type || "").toLowerCase();

  return (
    flow === "income" ||
    txType === "income" ||
    source === "income" ||
    sourceTable === "income_deposits" ||
    category === "payday" ||
    title.includes("payday") ||
    title.includes("income")
  );
}

function isPlannedExpenseEvent(ev) {
  return String(ev?.source || "").toLowerCase() === "planned_expense";
}

function isExpenseEvent(ev) {
  const source = String(ev?.source || "").toLowerCase();
  const sourceTable = String(ev?.source_table || "").toLowerCase();
  const flow = String(ev?.flow || "").toLowerCase();
  const txType = String(ev?.transaction_type || "").toLowerCase();

  if (isIncomeEvent(ev) || isPlannedExpenseEvent(ev)) return false;

  return (
    flow === "expense" ||
    txType === "expense" ||
    source === "spending" ||
    sourceTable === "spending_transactions" ||
    isBillEvent(ev)
  );
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
      text: "#8ef4bb",
      border: "rgba(142,244,187,0.18)",
      softBorder: "rgba(142,244,187,0.12)",
      bg: "rgba(15,30,22,0.78)",
      glow: "rgba(142,244,187,0.12)",
      dot: "#8ef4bb",
    };
  }
  if (tone === "amber") {
    return {
      text: "#ffd089",
      border: "rgba(255,208,137,0.18)",
      softBorder: "rgba(255,208,137,0.12)",
      bg: "rgba(34,24,12,0.78)",
      glow: "rgba(255,208,137,0.10)",
      dot: "#ffd089",
    };
  }
  if (tone === "red") {
    return {
      text: "#ff9fb2",
      border: "rgba(255,159,178,0.18)",
      softBorder: "rgba(255,159,178,0.12)",
      bg: "rgba(34,14,18,0.78)",
      glow: "rgba(255,159,178,0.10)",
      dot: "#ff9fb2",
    };
  }
  if (tone === "blue") {
    return {
      text: "#8ecbff",
      border: "rgba(142,203,255,0.18)",
      softBorder: "rgba(142,203,255,0.12)",
      bg: "rgba(12,20,34,0.78)",
      glow: "rgba(142,203,255,0.10)",
      dot: "#8ecbff",
    };
  }
  return {
    text: "#f7fbff",
    border: "rgba(214,226,255,0.12)",
    softBorder: "rgba(214,226,255,0.08)",
    bg: "rgba(18,22,30,0.78)",
    glow: "rgba(214,226,255,0.06)",
    dot: "#f7fbff",
  };
}

function toneForEvent(ev) {
  if (isIncomeEvent(ev)) {
    return { tone: "green", label: "Income", line: TONE.green };
  }

  if (isBillEvent(ev)) {
    return { tone: "amber", label: "Bill", line: TONE.amber };
  }

  if (isPlannedExpenseEvent(ev)) {
    return { tone: "amber", label: "Planned", line: TONE.amber };
  }

  if (isExpenseEvent(ev)) {
    return { tone: "red", label: "Expense", line: TONE.red };
  }

  return { tone: "blue", label: isManualEvent(ev) ? "Manual" : "General", line: TONE.blue };
}

function sourceLabel(ev) {
  const source = String(ev?.source || "").toLowerCase();
  const sourceTable = String(ev?.source_table || "").toLowerCase();

  if (source === "income" || sourceTable === "income_deposits") return "Synced from Income";
  if (source === "spending" || sourceTable === "spending_transactions") return "Synced from Spending";
  if (source === "bill" || sourceTable === "bills") return "Synced from Bills";
  if (source === "planned_expense") return "Synced planned item";
  if (isSourceOwnedEvent(ev)) return "Source-owned sync";
  return "Manual event";
}

function buildRoute(view, selectedDate, monthStart, profileId) {
  const qp = new URLSearchParams();
  if (selectedDate) qp.set("date", selectedDate);
  if (monthStart) qp.set("month", monthStart);
  if (profileId) qp.set("profile", profileId);
  const query = qp.toString();
  return `/calendar/${view}${query ? `?${query}` : ""}`;
}

function eyebrowStyle() {
  return {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: ".16em",
    fontWeight: 800,
    color: "rgba(255,255,255,0.42)",
  };
}

function mutedStyle() {
  return {
    fontSize: 12,
    color: "rgba(255,255,255,0.58)",
    lineHeight: 1.45,
  };
}

function cls(...parts) {
  return parts.filter(Boolean).join(" ");
}

function Panel({ children, className = "", accent = "default", style }) {
  return (
    <div
      className={cls("calOpsPanel", accent !== "default" && `accent-${accent}`, className)}
      style={style}
    >
      {children}
    </div>
  );
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
        boxShadow: `0 0 16px ${meta.glow}`,
        flexShrink: 0,
      }}
    />
  );
}

function Tag({ children, tone = "neutral" }) {
  const meta = toneMeta(tone);
  return (
    <span
      style={{
        minHeight: 24,
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "0 9px",
        borderRadius: 999,
        border: `1px solid ${meta.softBorder}`,
        background: meta.bg,
        color: tone === "neutral" ? "rgba(255,255,255,0.86)" : meta.text,
        fontSize: 10.5,
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

function SurfaceButton({
  children,
  onClick,
  icon,
  active = false,
  tone = "default",
  type = "button",
  style,
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={cls("calOpsBtn", active && "active", tone !== "default" && `tone-${tone}`)}
      style={style}
    >
      {icon || null}
      {children}
    </button>
  );
}

function PrimaryButton({ children, onClick, icon, type = "button", style }) {
  return (
    <button type={type} onClick={onClick} className="calOpsBtn calOpsBtnPrimary" style={style}>
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
  return <input {...props} className={cls("calOpsField", props.className)} />;
}

function FieldTextarea(props) {
  return <textarea {...props} className={cls("calOpsField", "calOpsTextarea", props.className)} />;
}

function FieldSelect({ children, value, onChange, style }) {
  return (
    <div style={{ position: "relative" }}>
      <select value={value} onChange={onChange} className="calOpsField calOpsSelect" style={style}>
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

function SearchBox({ value, onChange, placeholder = "Search events..." }) {
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
        placeholder={placeholder}
        style={{ paddingLeft: 38 }}
      />
    </div>
  );
}

function PanelHeader({ title, subcopy, right, dense = false }) {
  return (
    <div className={cls("calOpsPanelHead", dense && "dense")}>
      <div style={{ minWidth: 0 }}>
        <div className="calOpsPanelTitle">{title}</div>
        {subcopy ? <div style={{ ...mutedStyle(), marginTop: 6 }}>{subcopy}</div> : null}
      </div>
      {right || null}
    </div>
  );
}

function FilterChip({ children, active = false, onClick }) {
  return (
    <button type="button" onClick={onClick} className={cls("calOpsFilterChip", active && "active")}>
      {children}
    </button>
  );
}

function MetricBlock({ label, value, subcopy, tone = "neutral" }) {
  const meta = toneMeta(tone);
  return (
    <div
      className="calOpsMetricBlock"
      style={{
        borderColor: meta.softBorder,
      }}
    >
      <div style={eyebrowStyle()}>{label}</div>
      <div
        style={{
          marginTop: 8,
          fontSize: 18,
          lineHeight: 1,
          fontWeight: 950,
          letterSpacing: "-0.04em",
          color: tone === "neutral" ? "#fff" : meta.text,
        }}
      >
        {value}
      </div>
      {subcopy ? <div style={{ ...mutedStyle(), marginTop: 8 }}>{subcopy}</div> : null}
    </div>
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
      <button type="button" onClick={() => setOpen((v) => !v)} className="calOpsIconBtn">
        …
      </button>

      {open ? <div className="calOpsMenu">{children}</div> : null}
    </div>
  );
}

function MenuButton({ children, onClick, tone = "default", icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cls("calOpsMenuBtn", tone !== "default" && `tone-${tone}`)}
    >
      {icon || null}
      {children}
    </button>
  );
}

function HeaderBar({
  monthLabelText,
  profileName,
  focusTitle,
  focusTone,
  view,
  visibleMonthCount,
  onSwitchView,
  onManage,
  onToday,
  onAdd,
}) {
  return (
    <section className="calOpsHero">
      <div className="calOpsHeroMain">
        <div style={eyebrowStyle()}>Finance calendar</div>
        <div className="calOpsHeroTitle">Calendar Command</div>
        <div className="calOpsHeroSub">
          <StatusDot tone={focusTone} />
          <span>{focusTitle}</span>
        </div>
      </div>

      <div className="calOpsHeroStats">
        <div className="calOpsHeroStat">
          <span>Month</span>
          <strong>{monthLabelText}</strong>
        </div>
        <div className="calOpsHeroStat">
          <span>Profile</span>
          <strong>{profileName || "Default"}</strong>
        </div>
        <div className="calOpsHeroStat">
          <span>Visible</span>
          <strong>{visibleMonthCount}</strong>
        </div>
      </div>

      <div className="calOpsHeroActions">
        <div className="calOpsRouteToggle">
          <button
            type="button"
            className={cls("calOpsRouteBtn", view === "agenda" && "active")}
            onClick={() => onSwitchView("agenda")}
          >
            Agenda
          </button>
          <button
            type="button"
            className={cls("calOpsRouteBtn", view === "month" && "active")}
            onClick={() => onSwitchView("month")}
          >
            Month
          </button>
        </div>
        <SurfaceButton onClick={onManage}>Manage</SurfaceButton>
        <SurfaceButton onClick={onToday}>Today</SurfaceButton>
        <PrimaryButton onClick={onAdd} icon={<Plus size={15} />}>
          Add Event
        </PrimaryButton>
      </div>
    </section>
  );
}

function QueueRow({ ev, onOpen }) {
  const t = toneForEvent(ev);
  return (
    <button type="button" onClick={() => onOpen(ev)} className="calOpsQueueRow">
      <div className="calOpsQueueRowLeft">
        <StatusDot tone={t.tone} size={9} />
        <div style={{ minWidth: 0 }}>
          <div className="calOpsQueueTitle">{ev.title}</div>
          <div className="calOpsQueueMeta">
            {fmtShortDate(ev.event_date)}
            {ev.event_time ? ` · ${fmtTime(ev.event_time)}` : " · All day"}
          </div>
        </div>
      </div>
      {ev.amount ? <Tag tone={t.tone}>{money(ev.amount)}</Tag> : null}
    </button>
  );
}

function NavigatorRail({
  monthStart,
  shiftMonth,
  goToday,
  profileId,
  setProfileId,
  profiles,
  setDraftProfile,
  search,
  setSearch,
  filter,
  setFilter,
  selectedDate,
  selectedDayIn,
  selectedDayOut,
  selectedDayPlanned,
  selectedDayEvents,
  upcomingEvents,
  onOpenQueueEvent,
}) {
  return (
    <div className="calOpsLeftRail">
      <Panel className="calOpsRailMain">
        <PanelHeader
          title="Navigator"
          subcopy="Lock the month, pick the profile, then move fast."
          right={<Tag>{monthLabel(monthStart)}</Tag>}
        />

        <div className="calOpsRailSection">
          <div className="calOpsMonthButtons">
            <SurfaceButton onClick={() => shiftMonth(-1)} icon={<ChevronLeft size={15} />}>
              Prev
            </SurfaceButton>
            <SurfaceButton onClick={goToday} icon={<CalendarDays size={15} />}>
              Today
            </SurfaceButton>
            <SurfaceButton onClick={() => shiftMonth(1)} icon={<ChevronRight size={15} />}>
              Next
            </SurfaceButton>
          </div>
        </div>

        <div className="calOpsRailSection">
          <FieldLabel>Profile</FieldLabel>
          <FieldSelect
            value={profileId}
            onChange={(e) => {
              setProfileId(e.target.value);
              setDraftProfile(e.target.value);
            }}
          >
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </FieldSelect>
        </div>

        <div className="calOpsRailSection">
          <FieldLabel>Search</FieldLabel>
          <SearchBox
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search visible events..."
          />
        </div>

        <div className="calOpsRailSection">
          <FieldLabel>Filters</FieldLabel>
          <div className="calOpsFilterWrap">
            {["All", "Paydays", "Expenses", "Planned", "Manual"].map((chip) => (
              <FilterChip key={chip} active={filter === chip} onClick={() => setFilter(chip)}>
                {chip}
              </FilterChip>
            ))}
          </div>
        </div>

        <div className="calOpsRailSection calOpsFocusInline">
          <div style={eyebrowStyle()}>Selected focus</div>
          <div className="calOpsFocusTitle">{fmtLongDate(selectedDate)}</div>
          <div className="calOpsFocusTags">
            <Tag tone="green">In {money(selectedDayIn)}</Tag>
            <Tag tone="red">Out {money(selectedDayOut)}</Tag>
            <Tag tone="amber">Planned {money(selectedDayPlanned)}</Tag>
            <Tag>{selectedDayEvents.length} events</Tag>
          </div>
        </div>
      </Panel>

      <Panel className="calOpsQueuePanel">
        <PanelHeader title="Upcoming queue" subcopy="Next visible items in the current feed." dense />
        {upcomingEvents.length === 0 ? (
          <div style={mutedStyle()}>No upcoming items match the current filter.</div>
        ) : (
          <div className="calOpsQueueList">
            {upcomingEvents.map((ev) => (
              <QueueRow key={ev.id} ev={ev} onOpen={onOpenQueueEvent} />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function TimelineItem({ ev, onEdit, onDelete, onDuplicate }) {
  const t = toneForEvent(ev);
  const sourceOwned = isSourceOwnedEvent(ev);

  return (
    <div className="calAgendaItem">
      <div className="calAgendaItemLine" style={{ background: t.line }} />
      <div className="calAgendaTimeCol">
        <div className="calAgendaTimeMain">{ev.event_time ? fmtTime(ev.event_time) : "All day"}</div>
        <div className="calAgendaTimeSub">
          {ev.end_time ? `Ends ${fmtTime(ev.end_time)}` : sourceLabel(ev)}
        </div>
      </div>

      <div className="calAgendaItemCard">
        <div className="calAgendaItemTop">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="calAgendaItemTitleRow">
              <div className="calAgendaItemTitle">{ev.title}</div>
              <Tag tone={t.tone}>{t.label}</Tag>
              <Tag tone={sourceOwned ? "neutral" : "blue"}>
                {sourceOwned ? "Synced" : "Manual"}
              </Tag>
              {ev.category ? <Tag>{ev.category}</Tag> : null}
            </div>

            <div className="calAgendaItemMetaRow">
              {ev.amount ? <Tag tone={t.tone}>{money(ev.amount)}</Tag> : null}
              <Tag>{ev.status || "Scheduled"}</Tag>
            </div>

            {ev.note ? <div className="calAgendaItemNote">{ev.note}</div> : null}
          </div>

          <ActionMenu>
            {sourceOwned ? (
              <>
                <MenuButton onClick={() => onDuplicate(ev)} tone="success" icon={<Copy size={15} />}>
                  Copy as manual event
                </MenuButton>
                <div className="calOpsMenuHint">
                  Change synced items from the source module so calendar stays clean.
                </div>
              </>
            ) : (
              <>
                <MenuButton onClick={() => onEdit(ev)} icon={<Pencil size={15} />}>
                  Edit
                </MenuButton>
                <MenuButton onClick={() => onDelete(ev)} tone="danger" icon={<Trash2 size={15} />}>
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

function AgendaEmptyTimeline() {
  const rows = [
    { label: "6 AM", text: "Morning window open" },
    { label: "9 AM", text: "No scheduled hits" },
    { label: "12 PM", text: "Open middle of day" },
    { label: "3 PM", text: "No timed items" },
    { label: "6 PM", text: "Evening window open" },
    { label: "All day", text: "Add a manual event or let synced activity land here" },
  ];

  return (
    <div className="calAgendaEmptyTimeline">
      {rows.map((row) => (
        <div key={row.label} className="calAgendaEmptyLane">
          <div className="calAgendaEmptyTime">{row.label}</div>
          <div className="calAgendaEmptyTrack">
            <div className="calAgendaEmptyTrackLine" />
            <div className="calAgendaEmptyCard">
              <div className="calAgendaEmptyCardText">{row.text}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AgendaBoard({
  selectedDate,
  selectedDayEvents,
  selectedDayIn,
  selectedDayOut,
  selectedDayPlanned,
  selectedDayManualCount,
  selectedDaySyncedCount,
  selectedDayTimedCount,
  selectedDayAllDayCount,
  selectedFirstTimed,
  selectedLastTimed,
  onAdd,
  onPayday,
  onExpense,
  onEdit,
  onDelete,
  onDuplicate,
}) {
  const net = selectedDayIn - selectedDayOut;

  return (
    <div className="calOpsCenter">
      <Panel className="calAgendaShell">
        <div className="calAgendaTopBar">
          <div>
            <div style={eyebrowStyle()}>Agenda workspace</div>
            <div className="calAgendaDate">{fmtLongDate(selectedDate)}</div>
            <div style={{ ...mutedStyle(), marginTop: 7 }}>
              {selectedDayTimedCount > 0
                ? `${fmtTime(selectedFirstTimed)} → ${fmtTime(selectedLastTimed)}`
                : "All-day focus"}
            </div>
          </div>

          <div className="calAgendaActions">
            <SurfaceButton onClick={() => onPayday(selectedDate)}>+ Payday</SurfaceButton>
            <SurfaceButton onClick={() => onExpense(selectedDate)}>+ Expense</SurfaceButton>
            <PrimaryButton onClick={() => onAdd(selectedDate)} icon={<Plus size={15} />}>
              Add Event
            </PrimaryButton>
          </div>
        </div>

        <div className="calAgendaSummaryRow">
          <MetricBlock label="Income" value={money(selectedDayIn)} subcopy="Money-in on this day." tone="green" />
          <MetricBlock label="Outflow" value={money(selectedDayOut)} subcopy="Actual expense hits." tone="red" />
          <MetricBlock
            label="Planned"
            value={money(selectedDayPlanned)}
            subcopy="Scheduled planned items."
            tone="amber"
          />
          <MetricBlock
            label="Net"
            value={money(net)}
            subcopy={`${selectedDayManualCount} manual · ${selectedDaySyncedCount} synced`}
            tone={net >= 0 ? "green" : "red"}
          />
        </div>

        <div className="calAgendaBoard">
          <div className="calAgendaBoardHead">
            <div className="calAgendaBoardTitle">Selected day timeline</div>
            <div className="calAgendaBoardTags">
              <Tag>{selectedDayEvents.length} events</Tag>
              <Tag>{selectedDayTimedCount} timed</Tag>
              <Tag>{selectedDayAllDayCount} all day</Tag>
            </div>
          </div>

          {selectedDayEvents.length === 0 ? (
            <AgendaEmptyTimeline />
          ) : (
            <div className="calAgendaList">
              {selectedDayEvents.map((ev) => (
                <TimelineItem
                  key={ev.id}
                  ev={ev}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onDuplicate={onDuplicate}
                />
              ))}
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}

function MonthDayCell({ dayISO, monthStart, events, selected, onOpen }) {
  const sameMonth = inSameMonth(dayISO, monthStart);
  const today = isTodayISO(dayISO);

  const incomeCount = events.filter((ev) => String(ev.flow) === "income").length;
  const expenseCount = events.filter(
    (ev) => String(ev.flow) === "expense" && ev.source !== "planned_expense"
  ).length;
  const plannedCount = events.filter((ev) => ev.source === "planned_expense").length;

  const dots = [
    ...Array.from({ length: Math.min(incomeCount, 2) }, (_, i) => ({ key: `g${i}`, tone: "green" })),
    ...Array.from({ length: Math.min(expenseCount, 2) }, (_, i) => ({ key: `r${i}`, tone: "red" })),
    ...Array.from({ length: Math.min(plannedCount, 2) }, (_, i) => ({ key: `a${i}`, tone: "amber" })),
  ].slice(0, 5);

  return (
    <button
      type="button"
      onClick={() => onOpen(dayISO)}
      className={cls("calMonthCell", selected && "selected", today && "today", !sameMonth && "muted")}
    >
      <div className="calMonthCellTop">
        <div>
          <div className="calMonthCellNumber">{parseISO(dayISO)?.getDate()}</div>
          <div className="calMonthCellIso">{dayISO}</div>
        </div>
        {events.length > 0 ? <div className="calMonthCellCount">{events.length}</div> : null}
      </div>

      <div className="calMonthCellFoot">
        {events.length > 0 ? (
          <>
            <div className="calMonthDotStrip">
              {dots.map((dot) => (
                <span
                  key={dot.key}
                  className="calMonthDot"
                  style={{
                    background: toneMeta(dot.tone).dot,
                    boxShadow: `0 0 10px ${toneMeta(dot.tone).glow}`,
                  }}
                />
              ))}
            </div>

            <div className="calMonthMiniList">
              {events.slice(0, 2).map((ev) => {
                const tone = toneForEvent(ev);
                return (
                  <div key={ev.id} className="calMonthMiniRow">
                    <span
                      className="calMonthMiniRowDot"
                      style={{
                        background: tone.line,
                        boxShadow: `0 0 10px ${tone.line}66`,
                      }}
                    />
                    <span className="calMonthMiniRowText">
                      {ev.event_time ? `${fmtTime(ev.event_time)} · ` : ""}
                      {ev.title}
                    </span>
                  </div>
                );
              })}
            </div>

            {events.length > 2 ? <div className="calMonthPreviewMore">+{events.length - 2} more</div> : null}
          </>
        ) : (
          <div className="calMonthCellEmpty">No events</div>
        )}
      </div>
    </button>
  );
}

function MonthBoard({
  monthStart,
  monthGridDays,
  filteredEventsByDate,
  selectedDate,
  monthDaysActive,
  visibleMonthCount,
  onOpenDay,
}) {
  return (
    <div className="calOpsCenter">
      <Panel className="calMonthShell">
        <div className="calMonthTopBar">
          <div>
            <div style={eyebrowStyle()}>Month board</div>
            <div className="calMonthTitle">{monthLabel(monthStart)}</div>
            <div style={{ ...mutedStyle(), marginTop: 7 }}>
              Scan the board, jump to the date, then flip into Agenda to work it.
            </div>
          </div>

          <div className="calMonthTopStats">
            <div className="calMonthTopStat">
              <span>Active days</span>
              <strong>{monthDaysActive}</strong>
            </div>
            <div className="calMonthTopStat">
              <span>Total items</span>
              <strong>{visibleMonthCount}</strong>
            </div>
          </div>
        </div>

        <div className="calMonthBoardFrame">
          <div className="calMonthWeekdays">
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className="calMonthWeekday">
                {weekdayShort(i)}
              </div>
            ))}
          </div>

          <div className="calMonthGrid">
            {monthGridDays.map((dayISO) => (
              <MonthDayCell
                key={dayISO}
                dayISO={dayISO}
                monthStart={monthStart}
                events={filteredEventsByDate.get(dayISO) || []}
                selected={selectedDate === dayISO}
                onOpen={onOpenDay}
              />
            ))}
          </div>
        </div>
      </Panel>
    </div>
  );
}

function AgendaRightRail({
  selectedDate,
  selectedDayEvents,
  selectedDayIn,
  selectedDayOut,
  selectedDayPlanned,
  selectedDayManualCount,
  selectedDaySyncedCount,
  upcomingEvents,
  onAdd,
  onPayday,
  onExpense,
  onManage,
}) {
  const net = selectedDayIn - selectedDayOut;

  return (
    <div className="calOpsRightRail">
      <Panel>
        <PanelHeader title="Command rail" subcopy="Actions and signal for the selected day." />

        <div className="calOpsActionStack compact">
          <SurfaceButton onClick={() => onAdd(selectedDate)}>Add Event</SurfaceButton>
          <SurfaceButton onClick={() => onPayday(selectedDate)}>Add Payday</SurfaceButton>
          <SurfaceButton onClick={() => onExpense(selectedDate)}>Add Expense</SurfaceButton>
          <SurfaceButton onClick={onManage}>Manage Profiles</SurfaceButton>
        </div>

        <div className="calOpsDivider" />

        <div className="calOpsSignalList">
          <div className="calOpsSignalRow">
            <span>Date</span>
            <strong>{fmtShortDate(selectedDate)}</strong>
          </div>
          <div className="calOpsSignalRow">
            <span>Income</span>
            <strong style={{ color: toneMeta("green").text }}>{money(selectedDayIn)}</strong>
          </div>
          <div className="calOpsSignalRow">
            <span>Outflow</span>
            <strong style={{ color: toneMeta("red").text }}>{money(selectedDayOut)}</strong>
          </div>
          <div className="calOpsSignalRow">
            <span>Planned</span>
            <strong style={{ color: toneMeta("amber").text }}>{money(selectedDayPlanned)}</strong>
          </div>
          <div className="calOpsSignalRow">
            <span>Net</span>
            <strong style={{ color: net >= 0 ? toneMeta("green").text : toneMeta("red").text }}>
              {money(net)}
            </strong>
          </div>
          <div className="calOpsSignalRow">
            <span>Manual / Synced</span>
            <strong>
              {selectedDayManualCount} / {selectedDaySyncedCount}
            </strong>
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Linked flow" subcopy="What is on this day and what comes next." />

        <div className="calOpsSubsectionTitle">Selected day pipeline</div>
        {selectedDayEvents.length === 0 ? (
          <div style={mutedStyle()}>Nothing linked to this day yet.</div>
        ) : (
          <div className="calOpsMiniList">
            {selectedDayEvents.slice(0, 4).map((ev) => {
              const t = toneForEvent(ev);
              return (
                <div key={ev.id} className="calOpsMiniRow">
                  <div className="calOpsMiniRowLeft">
                    <StatusDot tone={t.tone} size={8} />
                    <div style={{ minWidth: 0 }}>
                      <div className="calOpsMiniRowTitle">{ev.title}</div>
                      <div className="calOpsMiniRowMeta">
                        {fmtTime(ev.event_time)} • {sourceLabel(ev)}
                      </div>
                    </div>
                  </div>
                  {ev.amount ? <Tag tone={t.tone}>{money(ev.amount)}</Tag> : null}
                </div>
              );
            })}
          </div>
        )}

        <div className="calOpsDivider" />

        <div className="calOpsSubsectionTitle">Next hits</div>
        {upcomingEvents.length === 0 ? (
          <div style={mutedStyle()}>No upcoming hits inside the visible range.</div>
        ) : (
          <div className="calOpsMiniList">
            {upcomingEvents.slice(0, 4).map((ev) => {
              const t = toneForEvent(ev);
              return (
                <div key={ev.id} className="calOpsMiniRow">
                  <div className="calOpsMiniRowLeft">
                    <StatusDot tone={t.tone} size={8} />
                    <div style={{ minWidth: 0 }}>
                      <div className="calOpsMiniRowTitle">{ev.title}</div>
                      <div className="calOpsMiniRowMeta">
                        {fmtShortDate(ev.event_date)} • {fmtTime(ev.event_time)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}

function MonthRightRail({
  monthIncome,
  monthExpense,
  monthPlanned,
  monthManualCount,
  selectedDate,
  selectedDayEvents,
  selectedDayManualCount,
  selectedDaySyncedCount,
  nextFocus,
  monthDaysActive,
  visibleMonthCount,
  onOpenAgenda,
}) {
  const focusTone = nextFocus ? toneForEvent(nextFocus).tone : "neutral";

  return (
    <div className="calOpsRightRail">
      <Panel>
        <PanelHeader
          title="Month intelligence"
          subcopy="Totals plus selected-day readout."
          right={<PrimaryButton onClick={onOpenAgenda}>Open Agenda</PrimaryButton>}
        />

        <div className="calOpsSignalList">
          <div className="calOpsSignalRow">
            <span>Month inflow</span>
            <strong style={{ color: toneMeta("green").text }}>{money(monthIncome)}</strong>
          </div>
          <div className="calOpsSignalRow">
            <span>Month outflow</span>
            <strong style={{ color: toneMeta("red").text }}>{money(monthExpense)}</strong>
          </div>
          <div className="calOpsSignalRow">
            <span>Planned</span>
            <strong style={{ color: toneMeta("amber").text }}>{money(monthPlanned)}</strong>
          </div>
          <div className="calOpsSignalRow">
            <span>Manual items</span>
            <strong>{monthManualCount}</strong>
          </div>
          <div className="calOpsSignalRow">
            <span>Active days</span>
            <strong>{monthDaysActive}</strong>
          </div>
          <div className="calOpsSignalRow">
            <span>Total items</span>
            <strong>{visibleMonthCount}</strong>
          </div>
        </div>

        <div className="calOpsDivider" />

        <div className="calOpsSubsectionTitle">Selected day preview</div>
        <div className="calOpsSignalList" style={{ marginBottom: 12 }}>
          <div className="calOpsSignalRow">
            <span>Selected date</span>
            <strong>{fmtShortDate(selectedDate)}</strong>
          </div>
          <div className="calOpsSignalRow">
            <span>Events</span>
            <strong>{selectedDayEvents.length}</strong>
          </div>
          <div className="calOpsSignalRow">
            <span>Manual / Synced</span>
            <strong>
              {selectedDayManualCount} / {selectedDaySyncedCount}
            </strong>
          </div>
        </div>

        {selectedDayEvents.length === 0 ? (
          <div style={mutedStyle()}>No selected-day events yet.</div>
        ) : (
          <div className="calOpsMiniList">
            {selectedDayEvents.slice(0, 4).map((ev) => {
              const t = toneForEvent(ev);
              return (
                <div key={ev.id} className="calOpsMiniRow">
                  <div className="calOpsMiniRowLeft">
                    <StatusDot tone={t.tone} size={8} />
                    <div style={{ minWidth: 0 }}>
                      <div className="calOpsMiniRowTitle">{ev.title}</div>
                      <div className="calOpsMiniRowMeta">
                        {fmtTime(ev.event_time)} • {sourceLabel(ev)}
                      </div>
                    </div>
                  </div>
                  {ev.amount ? <Tag tone={t.tone}>{money(ev.amount)}</Tag> : null}
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel>
        <PanelHeader title="Next focus" subcopy="Next thing coming up inside the visible feed." />
        {nextFocus ? (
          <div className="calOpsFocusCard">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <StatusDot tone={focusTone} size={10} />
              <div className="calOpsFocusCardTitle">{nextFocus.title}</div>
            </div>

            <div className="calOpsFocusCardTags">
              <Tag tone={focusTone}>{toneForEvent(nextFocus).label}</Tag>
              <Tag>{fmtShortDate(nextFocus.event_date)}</Tag>
              <Tag>{fmtTime(nextFocus.event_time)}</Tag>
              {nextFocus.amount ? <Tag tone={focusTone}>{money(nextFocus.amount)}</Tag> : null}
            </div>

            <div style={{ ...mutedStyle(), marginTop: 10 }}>{nextFocus.note || sourceLabel(nextFocus)}</div>
          </div>
        ) : (
          <div style={mutedStyle()}>Nothing upcoming inside this visible range.</div>
        )}
      </Panel>
    </div>
  );
}

function ModalShell({ open, title, onClose, children, width = "min(920px, 100%)" }) {
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
      className="calOpsModalBackdrop"
    >
      <div className="calOpsModalWrap" style={{ width }}>
        <div className="calOpsModalCard">
          <div className="calOpsModalHead">
            <div className="calOpsModalTitle">{title}</div>
            <SurfaceButton onClick={onClose} icon={<X size={15} />}>
              Close
            </SurfaceButton>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export default function CalendarCommandSubpage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const viewParam = Array.isArray(params?.view) ? params.view[0] : params?.view;
  const view = viewParam === "month" ? "month" : "agenda";

  const initialDateFromQuery = searchParams.get("date") || todayISO();
  const initialMonthFromQuery =
    searchParams.get("month") || startOfMonthISO(initialDateFromQuery);
  const initialProfileFromQuery = searchParams.get("profile") || "";

  const [loading, setLoading] = React.useState(true);
  const [pageError, setPageError] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [user, setUser] = React.useState(null);

  const [profiles, setProfiles] = React.useState([]);
  const [profileId, setProfileId] = React.useState(initialProfileFromQuery);
  const [monthStart, setMonthStart] = React.useState(initialMonthFromQuery);
  const [selectedDate, setSelectedDate] = React.useState(initialDateFromQuery);

  const [events, setEvents] = React.useState([]);
  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState("All");

  const [manageOpen, setManageOpen] = React.useState(false);
  const [editorOpen, setEditorOpen] = React.useState(false);

  const [newProfileName, setNewProfileName] = React.useState("");
  const [newProfileColor, setNewProfileColor] = React.useState("#8b5cf6");
  const [draft, setDraft] = React.useState(emptyEvent(todayISO(), ""));

  const fetchWindow = React.useMemo(() => buildFetchWindow(monthStart), [monthStart]);

  React.useEffect(() => {
    if (!status) return undefined;
    const id = window.setTimeout(() => setStatus(""), 3200);
    return () => window.clearTimeout(id);
  }, [status]);

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

  const refreshEvents = React.useCallback(async () => {
    if (!user || !profileId) return;

    try {
      setPageError("");
      const { loadStart, loadEnd } = buildFetchWindow(monthStart);
      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .eq("user_id", user.id)
        .eq("profile_id", profileId)
        .gte("event_date", loadStart)
        .lte("event_date", loadEnd)
        .order("event_date", { ascending: true })
        .order("event_time", { ascending: true });

      if (error) throw error;
      setEvents((data || []).map(mapEventRow));
    } catch (err) {
      setPageError(err?.message || "Failed to load events.");
    }
  }, [user, profileId, monthStart]);

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
          (initialProfileFromQuery &&
            loadedProfiles.find((p) => p.id === initialProfileFromQuery)?.id) ||
          loadedProfiles.find((p) => p.is_default)?.id ||
          loadedProfiles[0]?.id ||
          "";

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
  }, [refreshProfiles, initialProfileFromQuery]);

  React.useEffect(() => {
    refreshEvents();
  }, [refreshEvents]);

  React.useEffect(() => {
    const next = new URLSearchParams();
    if (selectedDate) next.set("date", selectedDate);
    if (monthStart) next.set("month", monthStart);
    if (profileId) next.set("profile", profileId);

    const nextQuery = next.toString();
    const currentQuery = searchParams.toString();

    if (nextQuery !== currentQuery) {
      router.replace(`/calendar/${view}?${nextQuery}`, { scroll: false });
    }
  }, [selectedDate, monthStart, profileId, view, router, searchParams]);

  const activeProfile = React.useMemo(
    () => profiles.find((p) => p.id === profileId) || profiles[0] || null,
    [profiles, profileId]
  );

  const monthGridDays = React.useMemo(
    () => Array.from({ length: 42 }, (_, i) => addDaysISO(fetchWindow.gridStart, i)),
    [fetchWindow.gridStart]
  );

  const filteredEvents = React.useMemo(() => {
    const q = search.trim().toLowerCase();

    return events.filter((ev) => {
      const category = String(ev.category || "").toLowerCase();
      const flow = String(ev.flow || "").toLowerCase();
      const source = String(ev.source || "").toLowerCase();
      const title = String(ev.title || "").toLowerCase();

      if (filter === "Paydays" && !isIncomeEvent(ev)) return false;
      if (filter === "Expenses" && !isExpenseEvent(ev)) return false;
      if (filter === "Planned" && !isPlannedExpenseEvent(ev)) return false;
      if (filter === "Manual" && !isManualEvent(ev)) return false;

      if (!q) return true;

      const hay = [
        ev.title,
        ev.note,
        ev.category,
        ev.flow,
        ev.source,
        ev.event_date,
        ev.event_time,
        money(ev.amount),
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

  const selectedDayEvents = React.useMemo(
    () =>
      [...(filteredEventsByDate.get(selectedDate) || [])].sort((a, b) => {
        const aTime = timeSortValue(a.event_time);
        const bTime = timeSortValue(b.event_time);
        if (aTime !== bTime) return aTime - bTime;
        return String(a.title).localeCompare(String(b.title));
      }),
    [filteredEventsByDate, selectedDate]
  );

  const visibleMonthEvents = React.useMemo(
    () => filteredEvents.filter((ev) => inSameMonth(ev.event_date, monthStart)),
    [filteredEvents, monthStart]
  );

  const visibleMonthCount = visibleMonthEvents.length;

  const monthDaysActive = React.useMemo(
    () => new Set(visibleMonthEvents.map((ev) => ev.event_date)).size,
    [visibleMonthEvents]
  );

  const monthIncome = React.useMemo(
    () =>
      visibleMonthEvents
        .filter((ev) => isIncomeEvent(ev))
        .reduce((sum, ev) => sum + safeNum(ev.amount, 0), 0),
    [visibleMonthEvents]
  );

  const monthExpense = React.useMemo(
    () =>
      visibleMonthEvents
        .filter((ev) => isExpenseEvent(ev))
        .reduce((sum, ev) => sum + safeNum(ev.amount, 0), 0),
    [visibleMonthEvents]
  );

  const monthPlanned = React.useMemo(
    () =>
      visibleMonthEvents
        .filter((ev) => isPlannedExpenseEvent(ev))
        .reduce((sum, ev) => sum + safeNum(ev.amount, 0), 0),
    [visibleMonthEvents]
  );

  const monthManualCount = React.useMemo(
    () => visibleMonthEvents.filter((ev) => isManualEvent(ev)).length,
    [visibleMonthEvents]
  );

  const selectedDayIn = React.useMemo(
    () =>
      selectedDayEvents
        .filter((ev) => isIncomeEvent(ev))
        .reduce((sum, ev) => sum + safeNum(ev.amount, 0), 0),
    [selectedDayEvents]
  );

  const selectedDayOut = React.useMemo(
    () =>
      selectedDayEvents
        .filter((ev) => isExpenseEvent(ev))
        .reduce((sum, ev) => sum + safeNum(ev.amount, 0), 0),
    [selectedDayEvents]
  );

  const selectedDayPlanned = React.useMemo(
    () =>
      selectedDayEvents
        .filter((ev) => isPlannedExpenseEvent(ev))
        .reduce((sum, ev) => sum + safeNum(ev.amount, 0), 0),
    [selectedDayEvents]
  );

  const selectedDayManualCount = React.useMemo(
    () => selectedDayEvents.filter((ev) => isManualEvent(ev)).length,
    [selectedDayEvents]
  );

  const selectedDaySyncedCount = selectedDayEvents.length - selectedDayManualCount;

  const selectedDayTimedCount = React.useMemo(
    () => selectedDayEvents.filter((ev) => !!ev.event_time).length,
    [selectedDayEvents]
  );

  const selectedDayAllDayCount = selectedDayEvents.length - selectedDayTimedCount;

  const selectedFirstTimed = React.useMemo(() => {
    const first = selectedDayEvents.find((ev) => !!ev.event_time);
    return first?.event_time || "";
  }, [selectedDayEvents]);

  const selectedLastTimed = React.useMemo(() => {
    const timed = [...selectedDayEvents].filter((ev) => !!ev.event_time);
    const last = timed[timed.length - 1];
    return last?.end_time || last?.event_time || "";
  }, [selectedDayEvents]);

  const nextFocus = React.useMemo(() => {
    const nowDate = todayISO();
    const nowMinutes = (() => {
      const d = new Date();
      return d.getHours() * 60 + d.getMinutes();
    })();

    const sorted = [...filteredEvents].sort((a, b) => {
      if (a.event_date !== b.event_date) return String(a.event_date).localeCompare(String(b.event_date));
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
        if (a.event_date !== b.event_date) return String(a.event_date).localeCompare(String(b.event_date));
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
    if (isSourceOwnedEvent(ev)) {
      setPageError("Source-owned events should be changed from Bills, Income, or Spending. Copy it as manual if you want a calendar-only version.");
      return;
    }
    setDraft({ ...ev, amount: ev.amount ? String(ev.amount) : "" });
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
    if (!draft.profile_id) return setPageError("Pick a calendar profile first.");
    if (!draft.title.trim()) return setPageError("Event title is required.");
    if (!draft.event_date) return setPageError("Event date is required.");
    if (draft.end_time && draft.event_time && draft.end_time < draft.event_time) {
      return setPageError("End time cannot be earlier than start time.");
    }
    if (draft.id && isSourceOwnedEvent(draft)) {
      return setPageError("Source-owned events must be changed from Bills, Income, or Spending. Copy it as manual first if needed.");
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
        const { error } = await supabase
          .from("calendar_events")
          .insert([{ id: uid(), ...payload }]);
        if (error) throw error;
        setStatus("Event created.");
      }

      setEditorOpen(false);
      setMonthStart(startOfMonthISO(draft.event_date));
      setSelectedDate(draft.event_date);
      await refreshEvents();
    } catch (err) {
      setPageError(err?.message || "Failed to save event.");
    }
  }

  async function handleDeleteEvent(ev) {
    if (!user || !ev?.id) return;
    if (isSourceOwnedEvent(ev)) {
      return setPageError("Source-owned events should be changed from Bills, Income, or Spending.");
    }
    if (!window.confirm(`Delete "${ev.title}"?`)) return;

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
    if (!name) return setPageError("Profile name is required.");

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
    if (profiles.length <= 1) return setPageError("Keep at least one calendar profile.");

    const target = profiles.find((p) => p.id === id);
    if (!window.confirm(`Delete profile "${target?.name || "this profile"}"?`)) return;

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
        const { error: repairErr } = await supabase
          .from("calendar_profiles")
          .update({ is_default: true })
          .eq("user_id", user.id)
          .eq("id", replacement.id);
        if (repairErr) throw repairErr;
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
  }

  function openFromQueue(ev) {
    const nextMonth = startOfMonthISO(ev.event_date);
    setMonthStart(nextMonth);
    setSelectedDate(ev.event_date);
    router.push(buildRoute("agenda", ev.event_date, nextMonth, profileId || ev.profile_id));
  }

  function switchView(nextView) {
    router.push(buildRoute(nextView, selectedDate, monthStart, profileId));
  }

  function openAgendaFromMonth() {
    router.push(buildRoute("agenda", selectedDate, monthStart, profileId));
  }

  if (loading) {
    return (
      <>
        <main className="calOpsRoot">
          <div className="calOpsInner">
            <Panel>
              <div style={{ color: "#fff", fontWeight: 900, fontSize: 20 }}>Loading calendar…</div>
            </Panel>
          </div>
        </main>
        <style jsx global>{globalStyles}</style>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <main className="calOpsRoot">
          <div className="calOpsInner">
            <Panel accent="danger">
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
            </Panel>
          </div>
        </main>
        <style jsx global>{globalStyles}</style>
      </>
    );
  }

  return (
    <>
      <main className="calOpsRoot">
        <div className="calOpsInner">
          <HeaderBar
            monthLabelText={monthLabel(monthStart)}
            profileName={activeProfile?.name || "Default"}
            focusTitle={focusTitle}
            focusTone={focusTone}
            view={view}
            visibleMonthCount={visibleMonthCount}
            onSwitchView={switchView}
            onManage={() => setManageOpen(true)}
            onToday={goToday}
            onAdd={() => openEditorForNew(selectedDate)}
          />

          {pageError ? (
            <Panel accent="danger">
              <div className="calOpsBanner">
                <AlertTriangle size={16} />
                {pageError}
              </div>
            </Panel>
          ) : null}

          {status ? (
            <Panel accent="success">
              <div className="calOpsBanner">
                <StatusDot tone="green" size={9} />
                {status}
              </div>
            </Panel>
          ) : null}

          <section className="calOpsWorkspace">
            <NavigatorRail
              monthStart={monthStart}
              shiftMonth={shiftMonth}
              goToday={goToday}
              profileId={profileId}
              setProfileId={setProfileId}
              profiles={profiles}
              setDraftProfile={(id) => setDraft((prev) => ({ ...prev, profile_id: id }))}
              search={search}
              setSearch={setSearch}
              filter={filter}
              setFilter={setFilter}
              selectedDate={selectedDate}
              selectedDayIn={selectedDayIn}
              selectedDayOut={selectedDayOut}
              selectedDayPlanned={selectedDayPlanned}
              selectedDayEvents={selectedDayEvents}
              upcomingEvents={upcomingEvents}
              onOpenQueueEvent={openFromQueue}
            />

            {view === "agenda" ? (
              <AgendaBoard
                selectedDate={selectedDate}
                selectedDayEvents={selectedDayEvents}
                selectedDayIn={selectedDayIn}
                selectedDayOut={selectedDayOut}
                selectedDayPlanned={selectedDayPlanned}
                selectedDayManualCount={selectedDayManualCount}
                selectedDaySyncedCount={selectedDaySyncedCount}
                selectedDayTimedCount={selectedDayTimedCount}
                selectedDayAllDayCount={selectedDayAllDayCount}
                selectedFirstTimed={selectedFirstTimed}
                selectedLastTimed={selectedLastTimed}
                onAdd={openEditorForNew}
                onPayday={openEditorForPayday}
                onExpense={openEditorForExpense}
                onEdit={openEditorForEdit}
                onDelete={handleDeleteEvent}
                onDuplicate={openDuplicate}
              />
            ) : (
              <MonthBoard
                monthStart={monthStart}
                monthGridDays={monthGridDays}
                filteredEventsByDate={filteredEventsByDate}
                selectedDate={selectedDate}
                monthDaysActive={monthDaysActive}
                visibleMonthCount={visibleMonthCount}
                onOpenDay={openDay}
              />
            )}

            {view === "agenda" ? (
              <AgendaRightRail
                selectedDate={selectedDate}
                selectedDayEvents={selectedDayEvents}
                selectedDayIn={selectedDayIn}
                selectedDayOut={selectedDayOut}
                selectedDayPlanned={selectedDayPlanned}
                selectedDayManualCount={selectedDayManualCount}
                selectedDaySyncedCount={selectedDaySyncedCount}
                upcomingEvents={upcomingEvents}
                onAdd={openEditorForNew}
                onPayday={openEditorForPayday}
                onExpense={openEditorForExpense}
                onManage={() => setManageOpen(true)}
              />
            ) : (
              <MonthRightRail
                monthIncome={monthIncome}
                monthExpense={monthExpense}
                monthPlanned={monthPlanned}
                monthManualCount={monthManualCount}
                selectedDate={selectedDate}
                selectedDayEvents={selectedDayEvents}
                selectedDayManualCount={selectedDayManualCount}
                selectedDaySyncedCount={selectedDaySyncedCount}
                nextFocus={nextFocus}
                monthDaysActive={monthDaysActive}
                visibleMonthCount={visibleMonthCount}
                onOpenAgenda={openAgendaFromMonth}
              />
            )}
          </section>
        </div>
      </main>

      <ModalShell
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        title="Manage calendar profiles"
        width="min(920px, 100%)"
      >
        <div className="calOpsManageGrid">
          <div>
            <div style={{ ...eyebrowStyle(), marginBottom: 12 }}>Profiles</div>

            <div style={{ display: "grid", gap: 12 }}>
              {profiles.map((profile) => {
                const active = profile.id === profileId;
                return (
                  <div key={profile.id} className={cls("calOpsProfileCard", active && "active")}>
                    <div className="calOpsProfileCardTop">
                      <div style={{ minWidth: 0 }}>
                        <div className="calOpsProfileTitleRow">
                          <span
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: 999,
                              background: profile.color,
                              boxShadow: `0 0 14px ${profile.color}66`,
                              flexShrink: 0,
                            }}
                          />
                          <div className="calOpsProfileTitle">{profile.name}</div>
                          {profile.is_default ? <Tag tone="green">Default</Tag> : null}
                          {active ? <Tag tone="blue">Active</Tag> : null}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {!profile.is_default ? (
                          <SurfaceButton onClick={() => handleSetDefaultProfile(profile.id)}>
                            Make default
                          </SurfaceButton>
                        ) : null}
                        {!active ? (
                          <SurfaceButton
                            onClick={() => {
                              setProfileId(profile.id);
                              setDraft((prev) => ({ ...prev, profile_id: profile.id }));
                            }}
                          >
                            Use
                          </SurfaceButton>
                        ) : null}
                        {profiles.length > 1 ? (
                          <SurfaceButton onClick={() => handleDeleteProfile(profile.id)} tone="danger">
                            Delete
                          </SurfaceButton>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Panel>
            <div style={{ ...eyebrowStyle(), marginBottom: 12 }}>Create profile</div>

            <div className="calOpsCreateProfileStack">
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
                  style={{ padding: 6, minHeight: 52 }}
                />
              </div>

              <PrimaryButton onClick={handleCreateProfile} icon={<Plus size={15} />}>
                Add profile
              </PrimaryButton>

              <div style={mutedStyle()}>
                Profiles split calendars cleanly instead of dumping everything into one feed.
              </div>
            </div>
          </Panel>
        </div>
      </ModalShell>

      <ModalShell
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={draft.id ? "Edit event" : "Create event"}
        width="min(980px, 100%)"
      >
        <form onSubmit={handleSaveEvent}>
          {isSourceOwnedEvent(draft) ? (
            <Panel accent="warning" style={{ marginBottom: 16 }}>
              <div style={{ color: "#ffd089", fontWeight: 800 }}>
                This event came from a synced source. Saving here converts it into a manual calendar event.
              </div>
            </Panel>
          ) : null}

          <div className="calOpsEditorGrid">
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
                placeholder="$0.00"
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
                style={{ padding: 6, minHeight: 52 }}
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

          <div className="calOpsEditorFoot">
            <div style={mutedStyle()}>
              Manual saves write into <span style={{ color: "#fff" }}>calendar_events</span>.
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <SurfaceButton onClick={() => setEditorOpen(false)}>Cancel</SurfaceButton>
              <PrimaryButton type="submit" icon={<Plus size={15} />}>
                {draft.id ? "Save Changes" : "Create Event"}
              </PrimaryButton>
            </div>
          </div>
        </form>
      </ModalShell>

      <style jsx global>{globalStyles}</style>
    </>
  );
}

const globalStyles = `
  .calOpsRoot {
    width: 100%;
    padding: 0 0 24px;
    box-sizing: border-box;
    font-family: var(--lcc-font-sans, Inter, ui-sans-serif, system-ui, sans-serif);
  }

  .calOpsInner {
    width: 100%;
    max-width: none;
    margin: 0;
    display: grid;
    gap: 12px;
    box-sizing: border-box;
  }

  .calOpsPanel {
    position: relative;
    min-width: 0;
    border-radius: 22px;
    border: 1px solid rgba(214, 226, 255, 0.08);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.018), rgba(255,255,255,0)),
      rgba(8, 12, 20, 0.95);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.025),
      0 10px 26px rgba(0,0,0,0.16);
    padding: 16px;
  }

  .calOpsPanel.accent-danger {
    border-color: rgba(255,159,178,0.18);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.018), rgba(255,255,255,0)),
      rgba(22, 10, 14, 0.96);
  }

  .calOpsPanel.accent-success {
    border-color: rgba(142,244,187,0.18);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.018), rgba(255,255,255,0)),
      rgba(10, 18, 14, 0.96);
  }

  .calOpsPanel.accent-warning {
    border-color: rgba(255,208,137,0.18);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.018), rgba(255,255,255,0)),
      rgba(22, 16, 10, 0.96);
  }

  .calOpsHero {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 14px;
    align-items: center;
    min-height: 74px;
    padding: 14px 16px;
    border-radius: 22px;
    border: 1px solid rgba(214,226,255,0.08);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.018), rgba(255,255,255,0)),
      rgba(9, 13, 22, 0.95);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.025),
      0 10px 26px rgba(0,0,0,0.16);
  }

  .calOpsHeroMain {
    min-width: 0;
  }

  .calOpsHeroTitle {
    margin-top: 3px;
    font-size: clamp(22px, 2.2vw, 30px);
    line-height: 1;
    font-weight: 900;
    letter-spacing: -0.045em;
    color: #fff;
  }

  .calOpsHeroSub {
    margin-top: 7px;
    display: flex;
    align-items: center;
    gap: 9px;
    font-size: 12px;
    color: rgba(255,255,255,0.62);
    min-width: 0;
  }

  .calOpsHeroSub span {
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .calOpsHeroStats {
    display: flex;
    gap: 8px;
    align-items: stretch;
    flex-wrap: wrap;
  }

  .calOpsHeroStat {
    min-width: 106px;
    padding: 9px 11px;
    border-radius: 14px;
    border: 1px solid rgba(214,226,255,0.07);
    background: rgba(255,255,255,0.018);
  }

  .calOpsHeroStat span {
    display: block;
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: .12em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.42);
  }

  .calOpsHeroStat strong {
    display: block;
    margin-top: 6px;
    color: #fff;
    font-size: 15px;
    line-height: 1;
    font-weight: 900;
    letter-spacing: -0.03em;
  }

  .calOpsHeroActions {
    display: flex;
    align-items: center;
    gap: 8px;
    justify-content: flex-end;
    flex-wrap: wrap;
  }

  .calOpsRouteToggle {
    display: inline-flex;
    gap: 4px;
    padding: 4px;
    border-radius: 14px;
    border: 1px solid rgba(214,226,255,0.08);
    background: rgba(255,255,255,0.018);
  }

  .calOpsRouteBtn {
    min-height: 34px;
    padding: 0 13px;
    border-radius: 10px;
    border: 0;
    background: transparent;
    color: rgba(255,255,255,0.62);
    font-size: 12px;
    font-weight: 900;
    cursor: pointer;
  }

  .calOpsRouteBtn.active {
    background: rgba(255,255,255,0.06);
    color: #fff;
  }

  .calOpsBtn {
    min-height: 38px;
    padding: 9px 13px;
    border-radius: 13px;
    border: 1px solid rgba(214,226,255,0.07);
    background: rgba(255,255,255,0.018);
    color: #fff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 900;
    letter-spacing: -0.01em;
    cursor: pointer;
    transition: border-color 120ms ease, background 120ms ease;
  }

  .calOpsBtn:hover {
    border-color: rgba(214,226,255,0.14);
    background: rgba(255,255,255,0.03);
  }

  .calOpsBtn.active {
    border-color: rgba(214,226,255,0.16);
    background: rgba(255,255,255,0.045);
  }

  .calOpsBtn.tone-danger {
    color: #ff9fb2;
    border-color: rgba(255,159,178,0.14);
    background: rgba(255,159,178,0.05);
  }

  .calOpsBtn.tone-danger:hover {
    border-color: rgba(255,159,178,0.22);
  }

  .calOpsBtnPrimary {
    border-color: rgba(255,255,255,0.12);
    background: #f7fbff;
    color: #09111f;
  }

  .calOpsBtnPrimary:hover {
    background: #ffffff;
    border-color: rgba(255,255,255,0.16);
  }

  .calOpsField {
    width: 100%;
    min-height: 42px;
    border-radius: 13px;
    border: 1px solid rgba(214,226,255,0.07);
    background: rgba(255,255,255,0.016);
    color: #fff;
    padding: 0 14px;
    outline: none;
    box-sizing: border-box;
  }

  .calOpsField:focus {
    border-color: rgba(214,226,255,0.16);
  }

  .calOpsField::placeholder {
    color: rgba(255,255,255,0.34);
  }

  .calOpsTextarea {
    min-height: 120px;
    padding: 12px 14px;
    resize: vertical;
  }

  .calOpsSelect {
    appearance: none;
    padding-right: 40px;
  }

  .calOpsBanner {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #fff;
    font-weight: 900;
  }

  .calOpsWorkspace {
    display: grid;
    grid-template-columns: 286px minmax(0, 1fr) 286px;
    gap: 12px;
    align-items: start;
  }

  .calOpsLeftRail,
  .calOpsCenter,
  .calOpsRightRail {
    min-width: 0;
  }

  .calOpsLeftRail,
  .calOpsRightRail {
    display: grid;
    gap: 12px;
    align-content: start;
  }

  .calOpsPanelHead {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 14px;
  }

  .calOpsPanelHead.dense {
    margin-bottom: 10px;
  }

  .calOpsPanelTitle {
    font-size: 18px;
    line-height: 1;
    font-weight: 900;
    letter-spacing: -0.03em;
    color: #fff;
  }

  .calOpsRailMain {
    display: grid;
    gap: 14px;
  }

  .calOpsRailSection {
    display: grid;
    gap: 8px;
    padding-top: 2px;
  }

  .calOpsRailSection + .calOpsRailSection {
    border-top: 1px solid rgba(214,226,255,0.05);
    padding-top: 14px;
  }

  .calOpsMonthButtons {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .calOpsFilterWrap {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .calOpsFilterChip {
    min-height: 32px;
    padding: 7px 11px;
    border-radius: 12px;
    border: 1px solid rgba(214,226,255,0.07);
    background: rgba(255,255,255,0.016);
    color: rgba(255,255,255,0.66);
    font-weight: 800;
    font-size: 12px;
    cursor: pointer;
  }

  .calOpsFilterChip.active {
    border-color: rgba(214,226,255,0.14);
    background: rgba(255,255,255,0.042);
    color: #fff;
  }

  .calOpsFocusInline {
    gap: 0;
  }

  .calOpsFocusTitle {
    margin-top: 10px;
    font-size: 18px;
    line-height: 1.14;
    font-weight: 900;
    color: #fff;
    letter-spacing: -0.03em;
  }

  .calOpsFocusTags {
    margin-top: 12px;
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .calOpsQueuePanel {
    min-height: 0;
  }

  .calOpsQueueList {
    display: grid;
    gap: 10px;
  }

  .calOpsQueueRow {
    width: 100%;
    text-align: left;
    padding: 11px;
    border-radius: 14px;
    border: 1px solid rgba(214,226,255,0.06);
    background: rgba(255,255,255,0.018);
    color: #fff;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    gap: 10px;
    align-items: center;
  }

  .calOpsQueueRowLeft {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .calOpsQueueTitle {
    font-size: 13px;
    font-weight: 900;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .calOpsQueueMeta {
    margin-top: 4px;
    font-size: 11.5px;
    color: rgba(255,255,255,0.52);
  }

  .calAgendaShell,
  .calMonthShell {
    display: grid;
    gap: 14px;
  }

  .calAgendaTopBar,
  .calMonthTopBar {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 14px;
    flex-wrap: wrap;
  }

  .calAgendaDate,
  .calMonthTitle {
    margin-top: 6px;
    font-size: 28px;
    line-height: 1;
    font-weight: 950;
    color: #fff;
    letter-spacing: -0.05em;
  }

  .calAgendaActions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .calAgendaSummaryRow {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }

  .calOpsMetricBlock {
    border-radius: 16px;
    border: 1px solid rgba(214,226,255,0.07);
    background: rgba(255,255,255,0.016);
    padding: 13px;
  }

  .calAgendaBoard {
    border-radius: 18px;
    border: 1px solid rgba(214,226,255,0.07);
    background: rgba(255,255,255,0.012);
    padding: 14px;
  }

  .calAgendaBoardHead {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
    flex-wrap: wrap;
    margin-bottom: 14px;
  }

  .calAgendaBoardTitle {
    font-size: 18px;
    line-height: 1;
    font-weight: 900;
    letter-spacing: -0.03em;
    color: #fff;
  }

  .calAgendaBoardTags {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .calAgendaList {
    display: grid;
    gap: 12px;
    max-height: 940px;
    overflow-y: auto;
    padding-right: 4px;
  }

  .calAgendaItem {
    position: relative;
    display: grid;
    grid-template-columns: 112px minmax(0, 1fr);
    gap: 12px;
    align-items: stretch;
  }

  .calAgendaItemLine {
    position: absolute;
    left: 113px;
    top: 12px;
    width: 3px;
    height: calc(100% - 24px);
    border-radius: 999px;
    opacity: 0.9;
  }

  .calAgendaTimeCol {
    padding: 14px 12px;
    border-radius: 16px;
    border: 1px solid rgba(214,226,255,0.06);
    background: rgba(255,255,255,0.016);
  }

  .calAgendaTimeMain {
    font-size: 14px;
    line-height: 1;
    font-weight: 900;
    color: #fff;
  }

  .calAgendaTimeSub {
    margin-top: 8px;
    font-size: 11px;
    color: rgba(255,255,255,0.5);
    line-height: 1.4;
  }

  .calAgendaItemCard {
    position: relative;
    padding: 15px;
    border-radius: 18px;
    border: 1px solid rgba(214,226,255,0.07);
    background: rgba(255,255,255,0.018);
  }

  .calAgendaItemTop {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
  }

  .calAgendaItemTitleRow {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .calAgendaItemTitle {
    font-size: 17px;
    line-height: 1.05;
    font-weight: 900;
    letter-spacing: -0.03em;
    color: #fff;
    min-width: 0;
  }

  .calAgendaItemMetaRow {
    margin-top: 10px;
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .calAgendaItemNote {
    margin-top: 12px;
    font-size: 13px;
    line-height: 1.58;
    color: rgba(255,255,255,0.66);
  }

  .calAgendaEmptyTimeline {
    display: grid;
    gap: 12px;
    padding-top: 4px;
  }

  .calAgendaEmptyLane {
    display: grid;
    grid-template-columns: 76px minmax(0, 1fr);
    gap: 12px;
    align-items: center;
  }

  .calAgendaEmptyTime {
    font-size: 11px;
    font-weight: 900;
    letter-spacing: .14em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.36);
  }

  .calAgendaEmptyTrack {
    position: relative;
    min-height: 54px;
    display: flex;
    align-items: center;
  }

  .calAgendaEmptyTrackLine {
    position: absolute;
    left: 0;
    top: 50%;
    right: 0;
    height: 1px;
    background: rgba(214,226,255,0.06);
  }

  .calAgendaEmptyCard {
    position: relative;
    width: 100%;
    min-height: 54px;
    border-radius: 14px;
    border: 1px dashed rgba(214,226,255,0.08);
    background: rgba(255,255,255,0.014);
    display: flex;
    align-items: center;
    padding: 0 14px;
  }

  .calAgendaEmptyCardText {
    font-size: 12px;
    color: rgba(255,255,255,0.54);
    font-weight: 700;
  }

  .calMonthTopStats {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .calMonthTopStat {
    min-width: 110px;
    padding: 10px 12px;
    border-radius: 14px;
    border: 1px solid rgba(214,226,255,0.07);
    background: rgba(255,255,255,0.016);
  }

  .calMonthTopStat span {
    display: block;
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: .12em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.42);
  }

  .calMonthTopStat strong {
    display: block;
    margin-top: 6px;
    color: #fff;
    font-size: 17px;
    line-height: 1;
    font-weight: 900;
    letter-spacing: -0.03em;
  }

  .calMonthBoardFrame {
    border-radius: 18px;
    border: 1px solid rgba(214,226,255,0.06);
    background: rgba(255,255,255,0.01);
    padding: 12px;
  }

  .calMonthWeekdays {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 8px;
    margin-bottom: 8px;
  }

  .calMonthWeekday {
    padding: 0 4px;
    font-size: 10px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: .16em;
    color: rgba(255,255,255,0.34);
  }

  .calMonthGrid {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 8px;
  }

  .calMonthCell {
    min-height: 138px;
    padding: 10px;
    border-radius: 16px;
    text-align: left;
    border: 1px solid rgba(214,226,255,0.06);
    background: rgba(255,255,255,0.012);
    cursor: pointer;
    display: grid;
    align-content: space-between;
    gap: 10px;
    position: relative;
    transition: border-color 120ms ease, background 120ms ease;
  }

  .calMonthCell:hover {
    border-color: rgba(214,226,255,0.12);
    background: rgba(255,255,255,0.022);
  }

  .calMonthCell::before {
    content: "";
    position: absolute;
    left: 0;
    top: 10px;
    bottom: 10px;
    width: 3px;
    border-radius: 999px;
    background: transparent;
  }

  .calMonthCell.selected {
    border-color: rgba(214,226,255,0.14);
    background: rgba(255,255,255,0.028);
  }

  .calMonthCell.selected::before {
    background: rgba(247,251,255,0.82);
  }

  .calMonthCell.today {
    border-color: rgba(142,244,187,0.18);
  }

  .calMonthCell.today::before {
    background: rgba(142,244,187,0.9);
  }

  .calMonthCell.muted {
    opacity: 0.42;
  }

  .calMonthCellTop {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
  }

  .calMonthCellNumber {
    font-size: 28px;
    font-weight: 950;
    line-height: 1;
    color: #fff;
    letter-spacing: -0.04em;
  }

  .calMonthCellIso {
    margin-top: 4px;
    font-size: 10px;
    color: rgba(255,255,255,0.32);
  }

  .calMonthCellCount {
    min-width: 26px;
    height: 26px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    padding: 0 7px;
    border: 1px solid rgba(214,226,255,0.08);
    background: rgba(255,255,255,0.03);
    font-size: 10px;
    font-weight: 900;
    color: #fff;
  }

  .calMonthCellFoot {
    display: grid;
    gap: 8px;
    min-height: 0;
  }

  .calMonthDotStrip {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
    min-height: 10px;
  }

  .calMonthDot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    flex-shrink: 0;
  }

  .calMonthMiniList {
    display: grid;
    gap: 4px;
  }

  .calMonthMiniRow {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .calMonthMiniRowDot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    flex-shrink: 0;
  }

  .calMonthMiniRowText {
    font-size: 11px;
    font-weight: 700;
    color: rgba(255,255,255,0.64);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .calMonthPreviewMore {
    font-size: 10px;
    font-weight: 800;
    color: rgba(255,255,255,0.36);
  }

  .calMonthCellEmpty {
    font-size: 11px;
    font-weight: 700;
    color: rgba(255,255,255,0.26);
  }

  .calOpsActionStack {
    display: grid;
    gap: 10px;
  }

  .calOpsActionStack.compact {
    gap: 8px;
  }

  .calOpsSignalList {
    display: grid;
    gap: 9px;
  }

  .calOpsSignalRow {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    align-items: flex-start;
    padding-bottom: 9px;
    border-bottom: 1px solid rgba(214,226,255,0.06);
    font-size: 12px;
    color: rgba(255,255,255,0.68);
  }

  .calOpsSignalRow:last-child {
    border-bottom: 0;
    padding-bottom: 0;
  }

  .calOpsSignalRow strong {
    color: #fff;
    text-align: right;
    font-weight: 900;
    line-height: 1.4;
  }

  .calOpsMiniList {
    display: grid;
    gap: 10px;
  }

  .calOpsMiniRow {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    align-items: center;
    padding: 11px;
    border-radius: 14px;
    border: 1px solid rgba(214,226,255,0.06);
    background: rgba(255,255,255,0.016);
  }

  .calOpsMiniRowLeft {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .calOpsMiniRowTitle {
    font-size: 13px;
    font-weight: 900;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .calOpsMiniRowMeta {
    margin-top: 4px;
    font-size: 11px;
    color: rgba(255,255,255,0.5);
  }

  .calOpsFocusCard {
    border-radius: 16px;
    border: 1px solid rgba(214,226,255,0.06);
    background: rgba(255,255,255,0.016);
    padding: 13px;
  }

  .calOpsFocusCardTitle {
    font-size: 16px;
    font-weight: 900;
    color: #fff;
    letter-spacing: -0.03em;
  }

  .calOpsFocusCardTags {
    margin-top: 10px;
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .calOpsSubsectionTitle {
    font-size: 11px;
    font-weight: 900;
    letter-spacing: .16em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.4);
    margin-bottom: 10px;
  }

  .calOpsDivider {
    height: 1px;
    background: rgba(214,226,255,0.06);
    margin: 14px 0;
  }

  .calOpsIconBtn {
    width: 34px;
    height: 34px;
    border-radius: 11px;
    border: 1px solid rgba(214,226,255,0.08);
    background: rgba(255,255,255,0.03);
    color: rgba(255,255,255,0.84);
    display: grid;
    place-items: center;
    cursor: pointer;
  }

  .calOpsMenu {
    position: absolute;
    right: 0;
    top: 40px;
    z-index: 10;
    width: 228px;
    border-radius: 18px;
    border: 1px solid rgba(214,226,255,0.08);
    background: rgba(10,16,28,0.98);
    padding: 8px;
    box-shadow: 0 20px 50px rgba(0,0,0,0.45);
  }

  .calOpsMenuBtn {
    width: 100%;
    min-height: 38px;
    border-radius: 12px;
    border: none;
    background: transparent;
    color: rgba(255,255,255,0.88);
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 10px;
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
    text-align: left;
  }

  .calOpsMenuBtn.tone-danger {
    color: #ff9fb2;
  }

  .calOpsMenuBtn.tone-success {
    color: #8ef4bb;
  }

  .calOpsMenuHint {
    padding: 8px 10px;
    font-size: 11px;
    line-height: 1.5;
    color: rgba(255,255,255,0.45);
  }

  .calOpsModalBackdrop {
    position: fixed;
    inset: 0;
    z-index: 80;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,0.72);
    backdrop-filter: blur(8px);
    padding: 20px;
  }

  .calOpsModalWrap {
    max-height: 100%;
    overflow: auto;
  }

  .calOpsModalCard {
    border-radius: 24px;
    border: 1px solid rgba(214,226,255,0.08);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.018), rgba(255,255,255,0)),
      rgba(8, 12, 20, 0.98);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.03),
      0 20px 60px rgba(0,0,0,0.4);
    padding: 18px;
  }

  .calOpsModalHead {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 18px;
  }

  .calOpsModalTitle {
    font-size: 22px;
    font-weight: 950;
    color: #fff;
    letter-spacing: -0.03em;
  }

  .calOpsManageGrid {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(280px, 0.85fr);
    gap: 18px;
  }

  .calOpsProfileCard {
    padding: 15px;
    border-radius: 18px;
    border: 1px solid rgba(214,226,255,0.07);
    background: rgba(255,255,255,0.016);
  }

  .calOpsProfileCard.active {
    border-color: rgba(214,226,255,0.16);
  }

  .calOpsProfileCardTop {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
  }

  .calOpsProfileTitleRow {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .calOpsProfileTitle {
    font-size: 16px;
    font-weight: 900;
    color: #fff;
  }

  .calOpsCreateProfileStack {
    display: grid;
    gap: 14px;
  }

  .calOpsEditorGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  .calOpsEditorFoot {
    margin-top: 18px;
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: space-between;
  }

  @media (max-width: 1360px) {
    .calOpsWorkspace {
      grid-template-columns: 280px minmax(0, 1fr);
    }

    .calOpsRightRail {
      grid-column: 1 / -1;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .calAgendaSummaryRow {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 1080px) {
    .calOpsHero {
      grid-template-columns: 1fr;
      align-items: start;
    }

    .calOpsHeroActions {
      justify-content: flex-start;
    }

    .calOpsManageGrid,
    .calOpsEditorGrid,
    .calOpsWorkspace,
    .calOpsRightRail,
    .calAgendaSummaryRow {
      grid-template-columns: 1fr;
    }

    .calMonthGrid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 760px) {
    .calOpsRoot {
      padding: 0 0 18px;
    }

    .calAgendaItem {
      grid-template-columns: 1fr;
    }

    .calAgendaItemLine {
      display: none;
    }

    .calAgendaEmptyLane {
      grid-template-columns: 1fr;
      gap: 8px;
    }

    .calMonthGrid {
      grid-template-columns: 1fr;
    }

    .calMonthWeekdays {
      display: none;
    }

    .calMonthCell {
      min-height: 124px;
    }

    .calMonthCellNumber {
      font-size: 24px;
    }

    .calMonthCellIso {
      display: none;
    }

    .calOpsHeroStats,
    .calOpsHeroActions,
    .calAgendaActions {
      width: 100%;
    }
  }
`;
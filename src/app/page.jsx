"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import GlassPane from "./components/GlassPane";

export const dynamic = "force-dynamic";

function safeNum(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
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

function signedMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  const abs = Math.abs(num).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  if (num > 0) return `+${abs}`;
  if (num < 0) return `-${abs}`;
  return abs;
}

function isoDate(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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

function fmtShort(iso) {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function daysUntil(iso) {
  if (!iso) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const due = new Date(`${iso}T00:00:00`).getTime();
  if (!Number.isFinite(due)) return null;
  return Math.round((due - today) / 86400000);
}

function startOfMonthISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function endOfMonthISO(d = new Date()) {
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return isoDate(end);
}

function freqToMonthlyMult(freq) {
  switch (String(freq || "").toLowerCase()) {
    case "weekly":
      return 4.333;
    case "biweekly":
      return 2.167;
    case "quarterly":
      return 1 / 3;
    case "yearly":
      return 1 / 12;
    case "one_time":
      return 0;
    case "monthly":
    default:
      return 1;
  }
}

function mapAccountRowToClient(row) {
  return {
    id: row.id,
    name: row.name || "",
    type: row.account_type || "other",
    balance: safeNum(row.balance, 0),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
  };
}

function mapBillRowToClient(row) {
  return {
    id: row.id,
    name: row.name || "Bill",
    type: row.type === "controllable" ? "controllable" : "noncontrollable",
    frequency: row.frequency || "monthly",
    dueDate: row.due_date || "",
    amount: safeNum(row.amount, 0),
    active: row.active !== false,
    balance: safeNum(row.balance, 0),
    minPay: safeNum(row.min_pay, 0),
    extraPay: safeNum(row.extra_pay, 0),
    autopay: row.autopay === true,
    category: row.category || "",
    notes: row.notes || "",
  };
}

function mapSpendingTxRowToClient(row) {
  return {
    id: row.id,
    type: row.type || "expense",
    amount: safeNum(row.amount, 0),
    date: row.tx_date || "",
    merchant: row.merchant || "",
    note: row.note || "",
  };
}

function mapIncomeDepositRowToClient(row) {
  return {
    id: row.id,
    date: row.deposit_date || "",
    source: row.source || "",
    amount: safeNum(row.amount, 0),
    note: row.note || "",
  };
}

function samplePoints(points, maxPoints = 6) {
  if (points.length <= maxPoints) return points;
  if (maxPoints < 3) return [points[0], points[points.length - 1]];

  const sampled = [points[0]];
  const middleCount = maxPoints - 2;
  const step = (points.length - 2) / middleCount;

  for (let i = 1; i <= middleCount; i += 1) {
    const index = Math.min(points.length - 2, Math.max(1, Math.round(i * step)));
    sampled.push(points[index]);
  }

  sampled.push(points[points.length - 1]);

  const deduped = [];
  const seen = new Set();

  for (const point of sampled) {
    const key = `${point.iso}-${point.value}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(point);
    }
  }

  return deduped;
}

function buildCashMovementPoints(monthStart, today, spendingTx, incomeDeposits) {
  const daily = new Map();

  function addDelta(date, delta) {
    if (!date) return;
    const current = safeNum(daily.get(date), 0);
    daily.set(date, current + safeNum(delta, 0));
  }

  incomeDeposits.forEach((row) => {
    addDelta(row.date, row.amount);
  });

  spendingTx.forEach((row) => {
    const type = String(row.type || "").toLowerCase();
    if (type === "income") addDelta(row.date, row.amount);
    else addDelta(row.date, -safeNum(row.amount, 0));
  });

  const dates = [...daily.keys()].sort((a, b) => String(a).localeCompare(String(b)));

  let running = 0;
  const rawPoints = [{ iso: monthStart, label: "Start", value: 0 }];

  dates.forEach((date) => {
    running += safeNum(daily.get(date), 0);
    rawPoints.push({
      iso: date,
      label: fmtShort(date),
      value: running,
    });
  });

  const lastPoint = rawPoints[rawPoints.length - 1];

  if (!lastPoint || lastPoint.iso !== today) {
    rawPoints.push({
      iso: today,
      label: fmtShort(today),
      value: running,
    });
  }

  return samplePoints(rawPoints, 6);
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

  return {
    text: "#f7fbff",
    border: "rgba(214,226,255,0.14)",
    glow: "rgba(214,226,255,0.10)",
    dot: "#f7fbff",
    pillBg: "rgba(10,14,21,0.36)",
  };
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

function HeaderBar({ monthLabel, primaryName, focusTitle, focusTone }) {
  return (
    <GlassPane size="hero">
      <div
        style={{
          minHeight: 86,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          gap: 14,
          alignItems: "center",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={eyebrowStyle()}>Live finance board</div>

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
            Financial Command
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
          <MiniPill>{monthLabel}</MiniPill>
          <MiniPill>{primaryName || "Primary account"}</MiniPill>
        </div>
      </div>
    </GlassPane>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone = "neutral",
  badge = "",
  onClick,
}) {
  const meta = toneMeta(tone);
  const clickable = typeof onClick === "function";

  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onClick : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      style={{
        cursor: clickable ? "pointer" : "default",
        height: "100%",
      }}
    >
      <GlassPane tone={tone} size="card" style={{ height: "100%" }}>
        <div
          style={{
            minHeight: 132,
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
              alignItems: "center",
              gap: 10,
            }}
          >
            <div style={eyebrowStyle()}>{label}</div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {badge ? (
                <div
                  style={{
                    minHeight: 23,
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "0 8px",
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: ".12em",
                    textTransform: "uppercase",
                    border: `1px solid ${meta.border}`,
                    color: meta.text,
                    background: meta.pillBg,
                    whiteSpace: "nowrap",
                  }}
                >
                  {badge}
                </div>
              ) : null}

              <StatusDot tone={tone} size={9} />
            </div>
          </div>

          <div
            style={{
              fontSize: "clamp(30px, 4vw, 44px)",
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
              justifyContent: "space-between",
              gap: 10,
              fontSize: 12,
              lineHeight: 1.4,
              color: "rgba(255,255,255,0.62)",
            }}
          >
            <div>{detail}</div>

            {clickable ? (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  color: "rgba(255,255,255,0.88)",
                  fontWeight: 900,
                  whiteSpace: "nowrap",
                }}
              >
                View <ChevronRight size={14} />
              </div>
            ) : null}
          </div>
        </div>
      </GlassPane>
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

function RangeChip({ children, active = false }) {
  return (
    <button
      type="button"
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
        cursor: "default",
      }}
    >
      {children}
    </button>
  );
}

function SoftLink({ href, children, full = false }) {
  return (
    <Link
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        width: full ? "100%" : undefined,
        minHeight: 42,
        padding: "10px 14px",
        borderRadius: 15,
        border: "1px solid rgba(214,226,255,0.10)",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012))",
        color: "#f7fbff",
        textDecoration: "none",
        fontWeight: 900,
        fontSize: 13,
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.05), 0 12px 22px rgba(0,0,0,0.14)",
      }}
    >
      {children}
    </Link>
  );
}

function AlertSeverityBadge({ severity }) {
  const tone =
    severity === "critical"
      ? "red"
      : severity === "warning"
      ? "amber"
      : "green";

  const meta = toneMeta(tone);

  return (
    <div
      style={{
        minHeight: 24,
        display: "inline-flex",
        alignItems: "center",
        padding: "0 8px",
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 900,
        letterSpacing: ".12em",
        textTransform: "uppercase",
        border: `1px solid ${meta.border}`,
        color: meta.text,
        background: meta.pillBg,
        whiteSpace: "nowrap",
      }}
    >
      {severity}
    </div>
  );
}

function AlertRow({ item }) {
  const tone =
    item.severity === "critical"
      ? "red"
      : item.severity === "warning"
      ? "amber"
      : "green";

  return (
    <GlassPane tone={tone} size="compact">
      <div style={{ display: "grid", gap: 12 }}>
        <div
          style={{
            display: "flex",
            alignItems: "start",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "start", gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                display: "grid",
                placeItems: "center",
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
                color: "#fff",
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={18} />
            </div>

            <div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 900,
                  color: "#fff",
                }}
              >
                {item.title}
              </div>

              <div
                style={{
                  marginTop: 4,
                  fontSize: 12,
                  color: "rgba(255,255,255,0.62)",
                  lineHeight: 1.45,
                }}
              >
                {item.detail}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            {item.amount ? (
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 900,
                  color: "rgba(255,255,255,0.90)",
                }}
              >
                {item.amount}
              </div>
            ) : null}

            <AlertSeverityBadge severity={item.severity} />
          </div>
        </div>

        {item.href ? (
          <div>
            <SoftLink href={item.href}>
              {item.hrefLabel || "Open"} <ChevronRight size={14} />
            </SoftLink>
          </div>
        ) : null}
      </div>
    </GlassPane>
  );
}

function AlertPanel({
  open,
  onClose,
  statusLabel,
  statusTone,
  alertItems,
  cashPosition,
  cashMovement,
  dueSoonTotal,
}) {
  useEffect(() => {
    if (!open) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e) {
      if (e.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const summaryTone =
    statusTone === "red"
      ? "red"
      : statusTone === "amber"
      ? "amber"
      : "green";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 120,
        background: "rgba(0,0,0,0.70)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: 12,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(100%, 720px)",
          maxHeight: "88vh",
          overflowY: "auto",
          borderRadius: 30,
        }}
      >
        <GlassPane tone={summaryTone} size="hero">
          <div
            style={{
              display: "flex",
              alignItems: "start",
              justifyContent: "space-between",
              gap: 14,
            }}
          >
            <div>
              <div style={eyebrowStyle()}>Alert center</div>

              <div
                style={{
                  marginTop: 10,
                  fontSize: "clamp(24px, 5vw, 38px)",
                  lineHeight: 0.95,
                  fontWeight: 950,
                  letterSpacing: "-0.06em",
                  color: "#fff",
                }}
              >
                {statusLabel}
              </div>

              <div
                style={{
                  marginTop: 8,
                  fontSize: 13,
                  color: "rgba(255,255,255,0.66)",
                  lineHeight: 1.55,
                }}
              >
                Exact pressure points showing on the board right now.
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close alerts"
              style={{
                width: 42,
                height: 42,
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
                color: "#fff",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                cursor: "pointer",
              }}
            >
              <X size={18} />
            </button>
          </div>

          <div
            style={{
              marginTop: 16,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 10,
            }}
          >
            <GlassPane size="compact">
              <div style={eyebrowStyle()}>Account Balances</div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 22,
                  fontWeight: 950,
                  color: "#fff",
                }}
              >
                {money(cashPosition)}
              </div>
            </GlassPane>

            <GlassPane
              tone={cashMovement < 0 ? "red" : cashMovement > 0 ? "green" : "neutral"}
              size="compact"
            >
              <div style={eyebrowStyle()}>Cash Movement</div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 22,
                  fontWeight: 950,
                  color: "#fff",
                }}
              >
                {signedMoney(cashMovement)}
              </div>
            </GlassPane>

            <GlassPane tone={dueSoonTotal > 0 ? "amber" : "green"} size="compact">
              <div style={eyebrowStyle()}>Due Soon</div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 22,
                  fontWeight: 950,
                  color: "#fff",
                }}
              >
                {money(dueSoonTotal)}
              </div>
            </GlassPane>
          </div>

          <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
            {alertItems.length === 0 ? (
              <GlassPane tone="green" size="card">
                <div style={{ fontSize: 16, fontWeight: 900, color: "#fff" }}>
                  No active problems
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 13,
                    color: "rgba(255,255,255,0.66)",
                    lineHeight: 1.5,
                  }}
                >
                  Right now the dashboard does not see any critical or warning issues.
                </div>
              </GlassPane>
            ) : (
              alertItems.map((item) => <AlertRow key={item.id} item={item} />)
            )}
          </div>
        </GlassPane>
      </div>
    </div>
  );
}

function CashMovementChart({ points, chartValue, chartTone = "neutral", subcopy }) {
  const width = 980;
  const height = 330;
  const padLeft = 18;
  const padRight = 18;
  const padTop = 30;
  const padBottom = 42;

  const values = points.length ? points.map((p) => safeNum(p.value, 0)) : [0];
  const minVal = Math.min(0, ...values);
  const maxVal = Math.max(0, ...values);
  const range = Math.max(maxVal - minVal, 1);

  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;
  const step = points.length > 1 ? innerW / (points.length - 1) : innerW;

  const coords = points.map((point, index) => {
    const x = padLeft + index * step;
    const y =
      height - padBottom - ((safeNum(point.value, 0) - minVal) / range) * innerH;
    return { ...point, x, y };
  });

  const linePath = coords
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  const areaPath = [
    `M ${coords[0]?.x || padLeft} ${height - padBottom}`,
    ...coords.map((p) => `L ${p.x} ${p.y}`),
    `L ${coords[coords.length - 1]?.x || width - padRight} ${height - padBottom}`,
    "Z",
  ].join(" ");

  const lastPoint = coords[coords.length - 1];

  const bubbleTone =
    chartTone === "red"
      ? {
          border: "rgba(255,178,194,0.22)",
          text: "#ffb2c2",
          glow: "rgba(255,178,194,0.12)",
        }
      : chartTone === "green"
      ? {
          border: "rgba(158,240,192,0.22)",
          text: "#9ef0c0",
          glow: "rgba(158,240,192,0.12)",
        }
      : {
          border: "rgba(214,226,255,0.16)",
          text: "#ffffff",
          glow: "rgba(214,226,255,0.08)",
        };

  return (
    <GlassPane size="hero">
      <PaneHeader
        title="Cash Movement"
        subcopy={subcopy}
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <RangeChip>1W</RangeChip>
            <RangeChip active>1M</RangeChip>
            <RangeChip>YTD</RangeChip>
            <RangeChip>All</RangeChip>
          </div>
        }
      />

      <div
        style={{
          position: "relative",
          minHeight: "clamp(250px, 42vw, 370px)",
        }}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: "100%", display: "block" }}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="dashboard-chart-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.12)" />
              <stop offset="55%" stopColor="rgba(255,255,255,0.028)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>

            <linearGradient id="dashboard-chart-line" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="rgba(255,255,255,0.94)" />
              <stop offset="100%" stopColor="rgba(240,246,255,0.98)" />
            </linearGradient>

            <filter id="dashboard-chart-glow">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {[0.22, 0.5, 0.78].map((ratio) => {
            const y = padTop + innerH * ratio;
            return (
              <line
                key={ratio}
                x1={padLeft}
                x2={width - padRight}
                y1={y}
                y2={y}
                stroke="rgba(255,255,255,0.022)"
                strokeWidth="1"
                strokeDasharray="4 10"
              />
            );
          })}

          {coords.map((p) => (
            <line
              key={`${p.iso}-grid`}
              x1={p.x}
              x2={p.x}
              y1={padTop}
              y2={height - padBottom}
              stroke="rgba(255,255,255,0.012)"
              strokeWidth="1"
            />
          ))}

          <path d={areaPath} fill="url(#dashboard-chart-area)" />

          <path
            d={linePath}
            fill="none"
            stroke="url(#dashboard-chart-line)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#dashboard-chart-glow)"
          />

          {coords.map((p) => (
            <g key={`${p.iso}-dot`}>
              <circle
                cx={p.x}
                cy={p.y}
                r="6.7"
                fill="rgba(5,7,10,0.88)"
                stroke="rgba(255,255,255,0.92)"
                strokeWidth="2.4"
              />
              <circle cx={p.x} cy={p.y} r="2.2" fill="rgba(255,255,255,0.98)" />
            </g>
          ))}

          {coords.map((p) => (
            <text
              key={`${p.iso}-label`}
              x={p.x}
              y={height - 12}
              fill="rgba(255,255,255,0.42)"
              fontSize="11"
              fontWeight="700"
              textAnchor="middle"
            >
              {p.label}
            </text>
          ))}
        </svg>

        {lastPoint ? (
          <div
            style={{
              position: "absolute",
              top: Math.max(18, Math.min(220, ((lastPoint.y / height) * 100) - 3)) + "%",
              right: 20,
              transform: "translateY(-50%)",
              padding: "10px 16px",
              borderRadius: 18,
              border: `1px solid ${bubbleTone.border}`,
              background:
                "linear-gradient(180deg, rgba(10,14,22,0.82), rgba(10,14,22,0.74))",
              boxShadow: `
                inset 0 1px 0 rgba(255,255,255,0.05),
                0 12px 22px rgba(0,0,0,0.16),
                0 0 16px ${bubbleTone.glow}
              `,
              color: bubbleTone.text,
              fontSize: 18,
              fontWeight: 950,
              letterSpacing: "-0.03em",
            }}
          >
            {chartValue}
          </div>
        ) : null}
      </div>
    </GlassPane>
  );
}

function ListRow({ title, subtitle, value, tone = "neutral", initials }) {
  const meta = toneMeta(tone);

  return (
    <div
      style={{
        minHeight: 72,
        display: "grid",
        gridTemplateColumns: "50px minmax(0, 1fr) auto",
        gap: 12,
        alignItems: "center",
        padding: "12px 14px",
        borderRadius: 20,
        border: `1px solid ${meta.border}`,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.010))",
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04), 0 0 16px ${meta.glow}`,
      }}
    >
      <div
        style={{
          width: 50,
          height: 50,
          borderRadius: 16,
          display: "grid",
          placeItems: "center",
          border: `1px solid ${meta.border}`,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012))",
          color: tone === "neutral" ? "#fff" : meta.text,
          fontWeight: 900,
          flexShrink: 0,
        }}
      >
        {initials}
      </div>

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 900,
            color: "#fff",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </div>

        <div
          style={{
            marginTop: 4,
            fontSize: 12,
            color: "rgba(255,255,255,0.56)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {subtitle}
        </div>
      </div>

      <div
        style={{
          fontSize: 15,
          fontWeight: 950,
          color: tone === "neutral" ? "#fff" : meta.text,
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function EmptyState({ title, detail, tone = "amber" }) {
  return (
    <GlassPane tone={tone} size="card">
      <div style={{ fontWeight: 900, fontSize: 15, color: "#fff" }}>{title}</div>
      <div
        style={{
          marginTop: 6,
          fontSize: 13,
          color: "rgba(255,255,255,0.72)",
          lineHeight: 1.5,
        }}
      >
        {detail}
      </div>
    </GlassPane>
  );
}

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [alertsOpen, setAlertsOpen] = useState(false);

  const [accounts, setAccounts] = useState([]);
  const [primaryId, setPrimaryId] = useState("");
  const [bills, setBills] = useState([]);
  const [spendingTx, setSpendingTx] = useState([]);
  const [incomeDeposits, setIncomeDeposits] = useState([]);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        if (!supabase) {
          throw new Error("Supabase is not configured. Check your environment variables.");
        }

        const {
          data: { user: currentUser },
          error: userErr,
        } = await supabase.auth.getUser();

        if (userErr) throw userErr;
        if (!mounted) return;

        setUser(currentUser || null);

        if (!currentUser) {
          setLoading(false);
          return;
        }

        const now = new Date();
        const monthStart = startOfMonthISO(now);
        const monthEnd = endOfMonthISO(now);

        const [accRes, settingsRes, billsRes, spendingRes, incomeRes] =
          await Promise.all([
            supabase
              .from("accounts")
              .select("*")
              .eq("user_id", currentUser.id)
              .order("updated_at", { ascending: false }),

            supabase
              .from("account_settings")
              .select("*")
              .eq("user_id", currentUser.id)
              .maybeSingle(),

            supabase
              .from("bills")
              .select("*")
              .eq("user_id", currentUser.id)
              .eq("active", true)
              .order("due_date", { ascending: true }),

            supabase
              .from("spending_transactions")
              .select("*")
              .eq("user_id", currentUser.id)
              .gte("tx_date", monthStart)
              .lte("tx_date", monthEnd)
              .order("tx_date", { ascending: true }),

            supabase
              .from("income_deposits")
              .select("*")
              .eq("user_id", currentUser.id)
              .gte("deposit_date", monthStart)
              .lte("deposit_date", monthEnd)
              .order("deposit_date", { ascending: true }),
          ]);

        if (accRes.error) throw accRes.error;
        if (settingsRes.error) throw settingsRes.error;
        if (billsRes.error) throw billsRes.error;
        if (spendingRes.error) throw spendingRes.error;
        if (incomeRes.error) throw incomeRes.error;

        const loadedAccounts = (accRes.data || []).map(mapAccountRowToClient);
        const loadedBills = (billsRes.data || []).map(mapBillRowToClient);
        const loadedSpending = (spendingRes.data || []).map(mapSpendingTxRowToClient);
        const loadedIncome = (incomeRes.data || []).map(mapIncomeDepositRowToClient);

        const nextPrimary =
          settingsRes.data?.primary_account_id &&
          loadedAccounts.some((a) => a.id === settingsRes.data.primary_account_id)
            ? settingsRes.data.primary_account_id
            : loadedAccounts[0]?.id || "";

        if (!mounted) return;

        setAccounts(loadedAccounts);
        setPrimaryId(nextPrimary);
        setBills(loadedBills);
        setSpendingTx(loadedSpending);
        setIncomeDeposits(loadedIncome);
        setPageError("");
      } catch (err) {
        if (!mounted) return;
        setPageError(err?.message || "Failed to load dashboard.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  const computed = useMemo(() => {
    const today = isoDate();
    const thisMonth = monthKeyFromISO(today);
    const monthStart = startOfMonthISO();

    const primary = accounts.find((a) => a.id === primaryId) || accounts[0] || null;

    const liquidAccounts = accounts.filter((a) =>
      ["checking", "savings", "cash"].includes(String(a.type || "").toLowerCase())
    );

    const investmentAccounts = accounts.filter(
      (a) => String(a.type || "").toLowerCase() === "investment"
    );

    const creditAccounts = accounts.filter(
      (a) => String(a.type || "").toLowerCase() === "credit"
    );

    const visibleBalanceAccounts = accounts.filter((a) => {
      const type = String(a.type || "").toLowerCase();
      return type !== "investment" && type !== "credit";
    });

    const accountBalancesExInvestments = visibleBalanceAccounts.reduce(
      (s, a) => s + safeNum(a.balance, 0),
      0
    );

    const nonDebtAssets = accounts
      .filter((a) => String(a.type || "").toLowerCase() !== "credit")
      .reduce((s, a) => s + safeNum(a.balance, 0), 0);

    const debtTotal = creditAccounts.reduce((s, a) => s + safeNum(a.balance, 0), 0);
    const liquidTotal = liquidAccounts.reduce((s, a) => s + safeNum(a.balance, 0), 0);
    const netWorth = nonDebtAssets - debtTotal;

    const incomeDepositsTotal = incomeDeposits.reduce(
      (s, d) => s + safeNum(d.amount, 0),
      0
    );

    const spendingIncomeLogged = spendingTx
      .filter((t) => String(t.type || "").toLowerCase() === "income")
      .reduce((s, t) => s + safeNum(t.amount, 0), 0);

    const totalLoggedIncome = incomeDepositsTotal + spendingIncomeLogged;

    const spendingActual = spendingTx
      .filter((t) => String(t.type || "").toLowerCase() === "expense")
      .reduce((s, t) => s + safeNum(t.amount, 0), 0);

    const cashMovement = totalLoggedIncome - spendingActual;

    const activeBills = bills.filter((b) => b.active !== false);

    const dueSoon = activeBills
      .filter((b) => b.dueDate)
      .map((b) => ({
        ...b,
        dueIn: daysUntil(b.dueDate),
        displayAmount:
          b.type === "controllable"
            ? Math.max(
                0,
                safeNum(b.minPay, 0) + safeNum(b.extraPay, 0) || safeNum(b.amount, 0)
              )
            : safeNum(b.amount, 0),
      }))
      .sort((a, b) => {
        const ad = Number.isFinite(a.dueIn) ? a.dueIn : 999999;
        const bd = Number.isFinite(b.dueIn) ? b.dueIn : 999999;
        return ad - bd;
      });

    const lateBills = dueSoon.filter((b) => Number.isFinite(b.dueIn) && b.dueIn < 0);

    const dueNextFour = dueSoon
      .filter((b) => Number.isFinite(b.dueIn) && b.dueIn <= 14)
      .slice(0, 4);

    const dueThisWeek = dueSoon.filter(
      (b) => Number.isFinite(b.dueIn) && b.dueIn >= 0 && b.dueIn <= 7
    );

    const dueSoonTotal = dueNextFour.reduce(
      (s, b) => s + safeNum(b.displayAmount, 0),
      0
    );

    const alertItems = [];

    if (!accounts.length) {
      alertItems.push({
        id: "no-accounts",
        severity: "critical",
        title: "No accounts loaded",
        detail:
          "The dashboard cannot calculate a real position until accounts are added or synced.",
        amount: "",
        href: "/accounts",
        hrefLabel: "Open accounts",
      });
    }

    if (!primary) {
      alertItems.push({
        id: "no-primary",
        severity: "warning",
        title: "Primary account not selected",
        detail:
          "Pick a main account so the dashboard has a clear operating anchor.",
        amount: "",
        href: "/accounts",
        hrefLabel: "Set primary account",
      });
    }

    if (cashMovement < 0) {
      alertItems.push({
        id: "negative-cash-movement",
        severity: "critical",
        title: "Cash movement is negative",
        detail: "Logged spending is outrunning logged income this month.",
        amount: signedMoney(cashMovement),
        href: "/spending",
        hrefLabel: "Review spending",
      });
    }

    if (lateBills.length > 0) {
      const lateBillLead = lateBills[0];
      alertItems.push({
        id: "late-bills",
        severity: "critical",
        title: `${lateBillLead?.name || "A bill"} is late`,
        detail:
          lateBills.length > 1
            ? `${lateBills.length} late bills need attention right now.`
            : "This bill is already past due and needs attention now.",
        amount: money(
          lateBills.reduce((s, b) => s + safeNum(b.displayAmount, 0), 0)
        ),
        href: "/bills",
        hrefLabel: "Open bills",
      });
    }

    if (dueThisWeek.length > 0) {
      const leadDue = dueThisWeek[0];
      alertItems.push({
        id: "due-this-week",
        severity: "warning",
        title: `${leadDue?.name || "A bill"} is due soon`,
        detail:
          dueThisWeek.length > 1
            ? `${dueThisWeek.length} bills are due in the next 7 days.`
            : `Due ${fmtShort(leadDue?.dueDate)}.`,
        amount: money(
          dueThisWeek.reduce((s, b) => s + safeNum(b.displayAmount, 0), 0)
        ),
        href: "/bills",
        hrefLabel: "Check due dates",
      });
    }

    if (dueSoonTotal > accountBalancesExInvestments && dueSoonTotal > 0) {
      alertItems.push({
        id: "due-vs-balances",
        severity: "critical",
        title: "Upcoming bills exceed account balances",
        detail:
          "Your near-term due amount is larger than your non-investment balances.",
        amount: `${money(dueSoonTotal)} vs ${money(accountBalancesExInvestments)}`,
        href: "/accounts",
        hrefLabel: "Review balances",
      });
    }

    if (liquidTotal < 0) {
      alertItems.push({
        id: "negative-liquid",
        severity: "critical",
        title: "Liquid cash is below zero",
        detail:
          "Checking, savings, or cash balances are showing negative overall.",
        amount: money(liquidTotal),
        href: "/accounts",
        hrefLabel: "Inspect accounts",
      });
    }

    const topAccounts = [...accounts]
      .sort(
        (a, b) => safeNum(Math.abs(b.balance), 0) - safeNum(Math.abs(a.balance), 0)
      )
      .slice(0, 4);

    const recentActivity = [
      ...incomeDeposits.map((row) => ({
        id: `income-${row.id}`,
        date: row.date || today,
        title: row.source || "Income",
        detail: `Deposit • ${fmtShort(row.date)}`,
        amount: `+${money(row.amount)}`,
        tone: "green",
        initials: "IN",
      })),
      ...spendingTx.map((row) => {
        const type = String(row.type || "").toLowerCase();
        const isIncome = type === "income";
        return {
          id: `spend-${row.id}`,
          date: row.date || today,
          title: row.merchant || row.note || (isIncome ? "Income" : "Expense"),
          detail: `${isIncome ? "Income" : "Expense"} • ${fmtShort(row.date)}`,
          amount: `${isIncome ? "+" : "-"}${money(row.amount)}`,
          tone: isIncome ? "green" : "red",
          initials: isIncome ? "IN" : "TX",
        };
      }),
    ]
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 4);

    if (recentActivity.length < 4) {
      dueNextFour.slice(0, 4 - recentActivity.length).forEach((bill) => {
        recentActivity.push({
          id: `due-${bill.id}`,
          date: bill.dueDate || today,
          title: bill.name,
          detail:
            bill.dueIn < 0
              ? `${Math.abs(bill.dueIn)} day(s) late`
              : `Due ${fmtShort(bill.dueDate)}`,
          amount: money(bill.displayAmount),
          tone: bill.dueIn < 0 ? "red" : "amber",
          initials: "BL",
        });
      });
    }

    const chartPoints = buildCashMovementPoints(
      monthStart,
      today,
      spendingTx,
      incomeDeposits
    );

    const nonClearAlerts = alertItems.filter((a) => a.severity !== "clear");
    const hasCritical = nonClearAlerts.some((a) => a.severity === "critical");
    const hasWarning = nonClearAlerts.some((a) => a.severity === "warning");

    let alertTone = "green";
    let alertValue = "Clear";

    if (hasCritical) {
      alertTone = "red";
      alertValue = "Critical";
    } else if (hasWarning) {
      alertTone = "amber";
      alertValue = "Watch";
    }

    let focus = {
      tone: "green",
      title: "Board is clear. Keep feeding real data into the system.",
    };

    if (!accounts.length) {
      focus = {
        tone: "red",
        title: "Load accounts first so the dashboard has something real to read.",
      };
    } else if (lateBills.length > 0) {
      const lead = lateBills[0];
      focus = {
        tone: "red",
        title: `${lead.name} is late and needs attention now.`,
      };
    } else if (dueThisWeek.length > 0) {
      const lead = dueThisWeek[0];
      focus = {
        tone: "amber",
        title: `${lead.name} is due ${fmtShort(lead.dueDate)}.`,
      };
    } else if (cashMovement < 0) {
      focus = {
        tone: "red",
        title: "Spending is outrunning income this month.",
      };
    }

    return {
      monthLabel: fmtMonthLabel(thisMonth),
      primaryName: primary?.name || "",
      focus,
      netWorth,
      accountBalancesExInvestments,
      alertValue,
      alertTone,
      alertCount: nonClearAlerts.length,
      topAccounts,
      recentActivity,
      chartPoints,
      chartValue: signedMoney(cashMovement),
      chartTone: cashMovement < 0 ? "red" : cashMovement > 0 ? "green" : "neutral",
      dueSoonTotal,
      cashMovement,
      alertItems,
      investmentTotal: investmentAccounts.reduce(
        (s, a) => s + safeNum(a.balance, 0),
        0
      ),
    };
  }, [accounts, primaryId, bills, spendingTx, incomeDeposits]);

  if (loading) {
    return (
      <main className="container">
        <GlassPane size="card">
          <div style={{ fontWeight: 900, fontSize: 18, color: "#fff" }}>
            Loading dashboard...
          </div>
        </GlassPane>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="container">
        <GlassPane size="card">
          <div style={{ fontWeight: 900, fontSize: 18, color: "#fff" }}>
            Please log in
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: 14,
              color: "rgba(255,255,255,0.66)",
            }}
          >
            This dashboard needs an authenticated user.
          </div>
        </GlassPane>
      </main>
    );
  }

  return (
    <>
      <AlertPanel
        open={alertsOpen}
        onClose={() => setAlertsOpen(false)}
        statusLabel={computed.alertValue}
        statusTone={computed.alertTone}
        alertItems={computed.alertCount > 0 ? computed.alertItems : []}
        cashPosition={computed.accountBalancesExInvestments}
        cashMovement={computed.cashMovement}
        dueSoonTotal={computed.dueSoonTotal}
      />

      <main
        className="container"
        style={{
          position: "relative",
          isolation: "isolate",
        }}
      >
        <div
          style={{
            position: "relative",
            zIndex: 1,
            width: "min(100%, 1040px)",
            margin: "0 auto",
            display: "grid",
            gap: 16,
          }}
        >
          {pageError ? (
            <GlassPane tone="red" size="card">
              <div style={{ fontWeight: 900, fontSize: 16, color: "#fff" }}>
                Dashboard error
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

          <HeaderBar
            monthLabel={computed.monthLabel}
            primaryName={computed.primaryName}
            focusTitle={computed.focus.title}
            focusTone={computed.focus.tone}
          />

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 230px), 1fr))",
              gap: 14,
              alignItems: "stretch",
            }}
          >
            <MetricCard
              label="Net Worth"
              value={money(computed.netWorth)}
              detail="Assets minus credit debt"
              tone="neutral"
            />

            <MetricCard
              label="Account Balances"
              value={money(computed.accountBalancesExInvestments)}
              detail="Non-investment balances"
              tone="neutral"
              badge={computed.investmentTotal > 0 ? "investments excluded" : ""}
            />

            <MetricCard
              label="Alerts"
              value={computed.alertValue}
              detail={
                computed.alertCount > 0
                  ? `${computed.alertCount} active signal(s)`
                  : "No immediate alarms"
              }
              tone={computed.alertTone}
              badge={computed.alertCount > 0 ? `${computed.alertCount} active` : ""}
              onClick={() => setAlertsOpen(true)}
            />
          </section>

          <CashMovementChart
            points={computed.chartPoints}
            chartValue={computed.chartValue}
            chartTone={computed.chartTone}
            subcopy="Month-to-date movement from actual logged income and spending."
          />

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
              gap: 16,
              alignItems: "stretch",
            }}
          >
            <GlassPane size="hero" style={{ height: "100%" }}>
              <PaneHeader
                title="Top Accounts"
                subcopy="Largest balances sitting on the board right now."
              />

              <div style={{ display: "grid", gap: 10 }}>
                {computed.topAccounts.length === 0 ? (
                  <EmptyState
                    title="No accounts yet"
                    detail="Add accounts so this panel actually has something real to show."
                  />
                ) : (
                  computed.topAccounts.map((account) => (
                    <ListRow
                      key={account.id}
                      title={account.name}
                      subtitle={String(account.type || "other")}
                      value={money(account.balance)}
                      initials={String(account.name || "A").charAt(0).toUpperCase()}
                      tone={
                        String(account.type || "").toLowerCase() === "credit"
                          ? "red"
                          : String(account.type || "").toLowerCase() === "investment"
                          ? "green"
                          : "neutral"
                      }
                    />
                  ))
                )}
              </div>

              <div style={{ marginTop: 14 }}>
                <SoftLink href="/accounts" full>
                  Open accounts
                </SoftLink>
              </div>
            </GlassPane>

            <GlassPane size="hero" style={{ height: "100%" }}>
              <PaneHeader
                title="Recent Movement"
                subcopy="Latest activity across income, spending, and due items."
              />

              <div style={{ display: "grid", gap: 10 }}>
                {computed.recentActivity.length === 0 ? (
                  <EmptyState
                    title="No recent activity"
                    detail="Log income or spending and this panel will start to look alive."
                  />
                ) : (
                  computed.recentActivity.map((item) => (
                    <ListRow
                      key={item.id}
                      title={item.title}
                      subtitle={item.detail}
                      value={item.amount}
                      initials={item.initials}
                      tone={item.tone}
                    />
                  ))
                )}
              </div>

              <div
                style={{
                  marginTop: 14,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(132px, 1fr))",
                  gap: 10,
                }}
              >
                <SoftLink href="/bills">Bills</SoftLink>
                <SoftLink href="/income">Income</SoftLink>
                <SoftLink href="/spending">Spending</SoftLink>
                <SoftLink href="/investments">Investments</SoftLink>
              </div>
            </GlassPane>
          </section>
        </div>
      </main>
    </>
  );
}
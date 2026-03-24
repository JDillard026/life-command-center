"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

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
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
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

function toneConfig(tone = "ice") {
  if (tone === "green") {
    return {
      border: "rgba(110, 241, 171, 0.18)",
      text: "#8bf3c2",
      accent: "#6ef1ab",
      glow: "rgba(110, 241, 171, 0.10)",
      tint: "rgba(4, 12, 8, 0.10)",
      iconBack:
        "linear-gradient(180deg, rgba(8,14,10,0.46), rgba(4,8,6,0.22))",
      softBg: "rgba(110, 241, 171, 0.08)",
    };
  }

  if (tone === "amber") {
    return {
      border: "rgba(255, 197, 108, 0.18)",
      text: "#ffd79a",
      accent: "#ffc56c",
      glow: "rgba(255, 197, 108, 0.10)",
      tint: "rgba(14, 10, 4, 0.10)",
      iconBack:
        "linear-gradient(180deg, rgba(15,11,7,0.46), rgba(8,6,4,0.22))",
      softBg: "rgba(255, 197, 108, 0.08)",
    };
  }

  if (tone === "red") {
    return {
      border: "rgba(255, 127, 153, 0.18)",
      text: "#ffbfd0",
      accent: "#ff7f99",
      glow: "rgba(255, 127, 153, 0.10)",
      tint: "rgba(14, 4, 8, 0.11)",
      iconBack:
        "linear-gradient(180deg, rgba(14,8,10,0.46), rgba(8,4,6,0.22))",
      softBg: "rgba(255, 127, 153, 0.08)",
    };
  }

  return {
    border: "rgba(255, 255, 255, 0.12)",
    text: "#f7f9fc",
    accent: "#f7fbff",
    glow: "rgba(255, 255, 255, 0.08)",
    tint: "rgba(5, 8, 12, 0.10)",
    iconBack:
      "linear-gradient(180deg, rgba(10,12,16,0.42), rgba(5,7,10,0.18))",
    softBg: "rgba(255,255,255,0.05)",
  };
}

function glassStyle(tone = "ice", padding = 18, radius = 28) {
  const t = toneConfig(tone);

  return {
    position: "relative",
    overflow: "hidden",
    padding,
    borderRadius: radius,
    border: `1px solid ${t.border}`,
    background: `
      linear-gradient(
        180deg,
        rgba(255,255,255,0.065) 0%,
        rgba(255,255,255,0.022) 10%,
        rgba(255,255,255,0.008) 20%,
        rgba(255,255,255,0) 34%
      ),
      ${t.tint}
    `,
    backdropFilter: "blur(10px) saturate(110%)",
    WebkitBackdropFilter: "blur(10px) saturate(110%)",
    boxShadow: `
      inset 0 1px 0 rgba(255,255,255,0.12),
      inset 0 -1px 0 rgba(255,255,255,0.02),
      0 0 0 1px rgba(255,255,255,0.018),
      0 20px 46px rgba(0,0,0,0.18),
      0 0 18px ${t.glow}
    `,
  };
}

function Pane({
  children,
  tone = "ice",
  padding = 18,
  radius = 28,
  style = {},
  overlayOpacity = 1,
}) {
  const t = toneConfig(tone);

  return (
    <section style={{ ...glassStyle(tone, padding, radius), ...style }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: overlayOpacity,
          background: `
            linear-gradient(
              135deg,
              rgba(255,255,255,0.11) 0%,
              rgba(255,255,255,0.026) 12%,
              rgba(255,255,255,0.006) 21%,
              rgba(255,255,255,0) 34%
            ),
            radial-gradient(
              circle at 86% 12%,
              rgba(255,255,255,0.035),
              transparent 22%
            ),
            radial-gradient(
              circle at 100% 100%,
              ${t.glow},
              transparent 42%
            )
          `,
          mixBlendMode: "screen",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 1,
          borderRadius: Math.max(radius - 1, 0),
          pointerEvents: "none",
          boxShadow: `
            inset 0 1px 0 rgba(255,255,255,0.06),
            inset 1px 0 0 rgba(255,255,255,0.01),
            inset -1px 0 0 rgba(255,255,255,0.01)
          `,
        }}
      />
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </section>
  );
}

function HeaderPill({ children }) {
  return (
    <div
      style={{
        padding: "11px 15px",
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.08)",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.036), rgba(255,255,255,0.01))",
        color: "rgba(255,255,255,0.88)",
        fontSize: 12,
        fontWeight: 800,
        whiteSpace: "nowrap",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      {children}
    </div>
  );
}

function HeaderBar({ monthLabel, primaryName }) {
  return (
    <Pane
      padding={18}
      radius={28}
      overlayOpacity={0.72}
      style={{
        background: `
          linear-gradient(
            180deg,
            rgba(255,255,255,0.05) 0%,
            rgba(255,255,255,0.012) 10%,
            rgba(255,255,255,0) 24%
          ),
          rgba(5,8,12,0.08)
        `,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          gap: 14,
          alignItems: "center",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "clamp(28px, 3vw, 42px)",
              lineHeight: 0.95,
              fontWeight: 950,
              letterSpacing: "-0.05em",
              color: "#fff",
            }}
          >
            Financial Command
          </div>

          <div
            style={{
              marginTop: 8,
              fontSize: 12,
              color: "rgba(255,255,255,0.48)",
              letterSpacing: ".16em",
              textTransform: "uppercase",
              fontWeight: 800,
            }}
          >
            cash • pressure • movement
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
          <HeaderPill>{monthLabel}</HeaderPill>
          <HeaderPill>{primaryName || "Primary account"}</HeaderPill>
        </div>
      </div>
    </Pane>
  );
}

function StatCard({
  label,
  value,
  detail,
  tone = "ice",
  badge = "",
  onClick,
  footerText = "",
}) {
  const t = toneConfig(tone);
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
      <Pane
        tone={tone}
        padding={18}
        radius={24}
        overlayOpacity={0.64}
        style={{ height: "100%" }}
      >
        <div
          style={{
            minHeight: 154,
            height: "100%",
            display: "grid",
            gridTemplateRows: "auto auto 1fr auto",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              alignItems: "start",
            }}
          >
            <div
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: ".18em",
                fontWeight: 900,
                color: "rgba(255,255,255,0.40)",
              }}
            >
              {label}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {badge ? (
                <div
                  style={{
                    padding: "4px 8px",
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: ".12em",
                    textTransform: "uppercase",
                    color: t.text,
                    border: `1px solid ${t.border}`,
                    background: "rgba(255,255,255,0.03)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {badge}
                </div>
              ) : null}

              <div
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 999,
                  background: t.accent,
                  boxShadow: `0 0 14px ${t.accent}`,
                  flexShrink: 0,
                  marginTop: 2,
                }}
              />
            </div>
          </div>

          <div
            style={{
              marginTop: 16,
              fontSize: "clamp(24px, 3vw, 40px)",
              lineHeight: 0.96,
              fontWeight: 950,
              letterSpacing: "-0.05em",
              color: t.text,
            }}
          >
            {value}
          </div>

          <div
            style={{
              marginTop: 10,
              fontSize: 12,
              color: "rgba(255,255,255,0.64)",
              lineHeight: 1.45,
            }}
          >
            {detail}
          </div>

          <div
            style={{
              marginTop: 14,
              minHeight: 18,
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: footerText ? "rgba(255,255,255,0.82)" : "transparent",
              fontSize: 12,
              fontWeight: 900,
              letterSpacing: ".04em",
              textTransform: "uppercase",
            }}
          >
            {footerText ? (
              <>
                <span>{footerText}</span>
                {clickable ? <ChevronRight size={14} /> : null}
              </>
            ) : (
              <>
                <span>reserved</span>
                <ChevronRight size={14} />
              </>
            )}
          </div>
        </div>
      </Pane>
    </div>
  );
}

function SectionHeader({ title, subcopy, action }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        alignItems: "flex-end",
        flexWrap: "wrap",
        marginBottom: 14,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 18,
            lineHeight: 1.02,
            fontWeight: 900,
            letterSpacing: "-0.03em",
            color: "#fff",
          }}
        >
          {title}
        </div>

        {subcopy ? (
          <div
            style={{
              marginTop: 6,
              fontSize: 12,
              color: "rgba(255,255,255,0.54)",
              lineHeight: 1.45,
            }}
          >
            {subcopy}
          </div>
        ) : null}
      </div>

      {action || null}
    </div>
  );
}

function RangeChip({ children, active = false }) {
  return (
    <button
      type="button"
      style={{
        minHeight: 34,
        padding: "8px 12px",
        borderRadius: 14,
        border: active
          ? "1px solid rgba(255,255,255,0.14)"
          : "1px solid rgba(255,255,255,0.06)",
        background: active
          ? "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.012))"
          : "rgba(255,255,255,0.01)",
        color: active ? "#fff" : "rgba(255,255,255,0.66)",
        fontWeight: 800,
        fontSize: 12,
        boxShadow: active ? "inset 0 1px 0 rgba(255,255,255,0.04)" : "none",
        cursor: "default",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      {children}
    </button>
  );
}

function samplePoints(points, maxPoints = 6) {
  if (points.length <= maxPoints) return points;
  if (maxPoints < 3) return [points[0], points[points.length - 1]];

  const sampled = [points[0]];
  const middleCount = maxPoints - 2;
  const step = (points.length - 2) / middleCount;

  for (let i = 1; i <= middleCount; i += 1) {
    const index = Math.min(
      points.length - 2,
      Math.max(1, Math.round(i * step))
    );
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

function CashMovementChart({ points, chartValue, chartTone = "ice" }) {
  const width = 980;
  const height = 304;
  const padLeft = 22;
  const padRight = 70;
  const padTop = 18;
  const padBottom = 34;

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

  const zeroY = height - padBottom - ((0 - minVal) / range) * innerH;

  const tone =
    chartTone === "red"
      ? {
          bubbleBorder: "rgba(255,127,153,0.20)",
          bubbleText: "#ffb7c5",
          bubbleGlow: "rgba(255,127,153,0.10)",
        }
      : chartTone === "green"
      ? {
          bubbleBorder: "rgba(110,241,171,0.20)",
          bubbleText: "#83f0bc",
          bubbleGlow: "rgba(110,241,171,0.10)",
        }
      : {
          bubbleBorder: "rgba(255,255,255,0.12)",
          bubbleText: "#ffffff",
          bubbleGlow: "rgba(255,255,255,0.07)",
        };

  return (
    <Pane
      padding={18}
      radius={30}
      overlayOpacity={0.44}
      style={{
        background: `
          linear-gradient(
            180deg,
            rgba(255,255,255,0.035) 0%,
            rgba(255,255,255,0.010) 10%,
            rgba(255,255,255,0) 22%
          ),
          rgba(5,8,12,0.08)
        `,
      }}
    >
      <SectionHeader
        title="Cash Movement"
        subcopy="Month-to-date movement from actual logged income and spending."
        action={
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
          minHeight: "clamp(200px, 44vw, 280px)",
        }}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: "100%", display: "block" }}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="lccCashArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.09)" />
              <stop offset="55%" stopColor="rgba(255,255,255,0.02)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>

            <linearGradient id="lccCashLine" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="rgba(255,255,255,0.98)" />
              <stop offset="100%" stopColor="rgba(244,247,255,0.90)" />
            </linearGradient>
          </defs>

          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
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
                strokeDasharray="5 10"
              />
            );
          })}

          <line
            x1={padLeft}
            x2={width - padRight}
            y1={zeroY}
            y2={zeroY}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="1"
          />

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

          <path d={areaPath} fill="url(#lccCashArea)" />

          <path
            d={linePath}
            fill="none"
            stroke="url(#lccCashLine)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              filter: "drop-shadow(0 0 6px rgba(255,255,255,0.12))",
            }}
          />

          {coords.map((p) => (
            <g key={`${p.iso}-dot`}>
              <circle
                cx={p.x}
                cy={p.y}
                r="7"
                fill="rgba(5,7,10,0.84)"
                stroke="rgba(255,255,255,0.92)"
                strokeWidth="2.4"
              />
              <circle cx={p.x} cy={p.y} r="2.3" fill="rgba(255,255,255,0.98)" />
            </g>
          ))}

          {coords.map((p) => (
            <text
              key={`${p.iso}-label`}
              x={p.x}
              y={height - 10}
              fill="rgba(255,255,255,0.42)"
              fontSize="11"
              fontWeight="700"
              textAnchor="middle"
            >
              {p.label}
            </text>
          ))}
        </svg>

        <div
          style={{
            position: "absolute",
            top: 18,
            right: 20,
            padding: "10px 16px",
            borderRadius: 18,
            border: `1px solid ${tone.bubbleBorder}`,
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.010))",
            boxShadow: `
              inset 0 1px 0 rgba(255,255,255,0.05),
              0 12px 22px rgba(0,0,0,0.16),
              0 0 16px ${tone.bubbleGlow}
            `,
            color: tone.bubbleText,
            fontSize: 18,
            fontWeight: 950,
            letterSpacing: "-0.03em",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
          }}
        >
          {chartValue}
        </div>
      </div>
    </Pane>
  );
}

function AccountRow({ name, sub, balance, tone = "ice" }) {
  const t = toneConfig(tone);

  return (
    <div
      style={{
        ...glassStyle(tone, 14, 20),
        display: "grid",
        gridTemplateColumns: "54px minmax(0, 1fr) auto",
        gap: 12,
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: 54,
          height: 54,
          borderRadius: 16,
          display: "grid",
          placeItems: "center",
          background: t.iconBack,
          border: `1px solid ${t.border}`,
          boxShadow: `0 0 12px ${t.glow}, inset 0 1px 0 rgba(255,255,255,0.04)`,
          color: t.text,
          fontWeight: 900,
        }}
      >
        {String(name || "A").charAt(0).toUpperCase()}
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
          {name}
        </div>
        <div
          style={{
            marginTop: 4,
            fontSize: 12,
            color: "rgba(255,255,255,0.52)",
            textTransform: "capitalize",
          }}
        >
          {sub}
        </div>
      </div>

      <div
        style={{
          fontSize: 16,
          fontWeight: 950,
          color: t.text,
          paddingLeft: 8,
          whiteSpace: "nowrap",
        }}
      >
        {balance}
      </div>
    </div>
  );
}

function ActivityRow({ title, detail, amount, tone = "ice" }) {
  const t = toneConfig(tone);

  return (
    <div
      style={{
        ...glassStyle(tone, 14, 20),
        display: "grid",
        gridTemplateColumns: "50px minmax(0, 1fr) auto",
        gap: 12,
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: 50,
          height: 50,
          borderRadius: 16,
          display: "grid",
          placeItems: "center",
          background: t.iconBack,
          border: `1px solid ${t.border}`,
          boxShadow: `0 0 12px ${t.glow}, inset 0 1px 0 rgba(255,255,255,0.04)`,
        }}
      >
        <div
          style={{
            width: 9,
            height: 9,
            borderRadius: 999,
            background: t.accent,
            boxShadow: `0 0 12px ${t.accent}`,
          }}
        />
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
            marginTop: 5,
            fontSize: 12,
            color: "rgba(255,255,255,0.52)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {detail}
        </div>
      </div>

      <div
        style={{
          fontSize: 15,
          fontWeight: 950,
          color: t.text,
          paddingLeft: 8,
          whiteSpace: "nowrap",
        }}
      >
        {amount}
      </div>
    </div>
  );
}

function LinkButton({ href, children, full = false }) {
  return (
    <Link
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: full ? "100%" : undefined,
        minHeight: 42,
        padding: "10px 14px",
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.08)",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.008))",
        color: "#f7fbff",
        textDecoration: "none",
        fontWeight: 900,
        fontSize: 13,
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.04), 0 10px 20px rgba(0,0,0,0.14)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      {children}
    </Link>
  );
}

function ActionButton({ href, onClick, children }) {
  const commonStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 46,
    padding: "12px 16px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.012))",
    color: "#fff",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: 13,
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.05), 0 12px 22px rgba(0,0,0,0.18)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
  };

  if (href) {
    return <Link href={href} style={commonStyle}>{children}</Link>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      style={{ ...commonStyle, cursor: "pointer" }}
    >
      {children}
    </button>
  );
}

function AlertSeverityBadge({ severity }) {
  const style =
    severity === "critical"
      ? {
          border: "rgba(255,127,153,0.18)",
          text: "#ffb7c5",
          bg: "rgba(255,127,153,0.08)",
        }
      : severity === "warning"
      ? {
          border: "rgba(255,197,108,0.18)",
          text: "#ffd491",
          bg: "rgba(255,197,108,0.08)",
        }
      : {
          border: "rgba(110,241,171,0.18)",
          text: "#83f0bc",
          bg: "rgba(110,241,171,0.08)",
        };

  return (
    <div
      style={{
        padding: "4px 8px",
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 900,
        letterSpacing: ".12em",
        textTransform: "uppercase",
        border: `1px solid ${style.border}`,
        color: style.text,
        background: style.bg,
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
    <Pane tone={tone} padding={14} radius={20} overlayOpacity={0.5}>
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
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 14,
                display: "grid",
                placeItems: "center",
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
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
                  color: "rgba(255,255,255,0.6)",
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
                  color: "rgba(255,255,255,0.9)",
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
            <LinkButton href={item.href}>
              {item.hrefLabel || "Open"}{" "}
              <ChevronRight size={14} style={{ marginLeft: 6 }} />
            </LinkButton>
          </div>
        ) : null}
      </div>
    </Pane>
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
        background: "rgba(0,0,0,0.66)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
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
          width: "min(100%, 680px)",
          maxHeight: "88vh",
          overflowY: "auto",
          borderRadius: 28,
        }}
      >
        <Pane tone={summaryTone} padding={18} radius={28} overlayOpacity={0.58}>
          <div
            style={{
              display: "flex",
              alignItems: "start",
              justifyContent: "space-between",
              gap: 14,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 12,
                  textTransform: "uppercase",
                  letterSpacing: ".18em",
                  fontWeight: 900,
                  color: "rgba(255,255,255,0.42)",
                }}
              >
                Alert Center
              </div>

              <div
                style={{
                  marginTop: 10,
                  fontSize: "clamp(24px, 5vw, 34px)",
                  lineHeight: 0.98,
                  fontWeight: 950,
                  letterSpacing: "-0.05em",
                  color: "#fff",
                }}
              >
                {statusLabel}
              </div>

              <div
                style={{
                  marginTop: 8,
                  fontSize: 13,
                  color: "rgba(255,255,255,0.64)",
                  lineHeight: 1.5,
                }}
              >
                This is where the dashboard tells you exactly what needs attention.
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
            <Pane tone="ice" padding={12} radius={18} overlayOpacity={0.45}>
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: ".14em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.42)",
                  fontWeight: 900,
                }}
              >
                Account Balances
              </div>
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
            </Pane>

            <Pane
              tone={cashMovement < 0 ? "red" : cashMovement > 0 ? "green" : "ice"}
              padding={12}
              radius={18}
              overlayOpacity={0.45}
            >
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: ".14em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.42)",
                  fontWeight: 900,
                }}
              >
                Cash Movement
              </div>
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
            </Pane>

            <Pane
              tone={dueSoonTotal > 0 ? "amber" : "green"}
              padding={12}
              radius={18}
              overlayOpacity={0.45}
            >
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: ".14em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.42)",
                  fontWeight: 900,
                }}
              >
                Due Soon
              </div>
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
            </Pane>
          </div>

          <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
            {alertItems.length === 0 ? (
              <Pane tone="green" padding={16} radius={20} overlayOpacity={0.46}>
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
              </Pane>
            ) : (
              alertItems.map((item) => <AlertRow key={item.id} item={item} />)
            )}
          </div>
        </Pane>
      </div>
    </div>
  );
}

function ActionMiniStat({ label, value, tone = "ice" }) {
  const t = toneConfig(tone);

  return (
    <div
      style={{
        minWidth: 0,
        padding: "12px 14px",
        borderRadius: 18,
        border: `1px solid ${t.border}`,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.008))",
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04), 0 0 16px ${t.glow}`,
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: ".14em",
          textTransform: "uppercase",
          fontWeight: 900,
          color: "rgba(255,255,255,0.40)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 17,
          fontWeight: 950,
          color: t.text,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ActionStrip({
  action,
  cashPosition,
  cashMovement,
  dueSoonTotal,
  alertCount,
  onOpenAlerts,
}) {
  const tone = action?.tone || "ice";
  const t = toneConfig(tone);

  return (
    <Pane
      tone={tone}
      padding={18}
      radius={28}
      overlayOpacity={0.62}
      style={{
        background: `
          linear-gradient(
            180deg,
            rgba(255,255,255,0.05) 0%,
            rgba(255,255,255,0.014) 12%,
            rgba(255,255,255,0) 28%
          ),
          ${t.tint}
        `,
      }}
    >
      <div style={{ display: "grid", gap: 16 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) auto",
            gap: 14,
            alignItems: "center",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: ".18em",
                fontWeight: 900,
                color: "rgba(255,255,255,0.44)",
              }}
            >
              Next move
            </div>

            <div
              style={{
                marginTop: 10,
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              {action.badge ? (
                <div
                  style={{
                    padding: "5px 9px",
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: ".12em",
                    textTransform: "uppercase",
                    color: t.text,
                    border: `1px solid ${t.border}`,
                    background: "rgba(255,255,255,0.035)",
                  }}
                >
                  {action.badge}
                </div>
              ) : null}

              <div
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 999,
                  background: t.accent,
                  boxShadow: `0 0 14px ${t.accent}`,
                  flexShrink: 0,
                }}
              />
            </div>

            <div
              style={{
                marginTop: 12,
                fontSize: "clamp(22px, 4vw, 34px)",
                lineHeight: 1,
                fontWeight: 950,
                letterSpacing: "-0.05em",
                color: "#fff",
              }}
            >
              {action.title}
            </div>

            <div
              style={{
                marginTop: 10,
                maxWidth: 760,
                fontSize: 13,
                lineHeight: 1.55,
                color: "rgba(255,255,255,0.68)",
              }}
            >
              {action.detail}
            </div>
          </div>

          <div style={{ alignSelf: "start" }}>
            {action.actionType === "alerts" ? (
              <ActionButton onClick={onOpenAlerts}>
                {action.buttonLabel} <ArrowRight size={14} />
              </ActionButton>
            ) : (
              <ActionButton href={action.href}>
                {action.buttonLabel} <ArrowRight size={14} />
              </ActionButton>
            )}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 10,
          }}
        >
          <ActionMiniStat
            label="Cash Position"
            value={money(cashPosition)}
            tone="ice"
          />
          <ActionMiniStat
            label="Cash Movement"
            value={signedMoney(cashMovement)}
            tone={cashMovement < 0 ? "red" : cashMovement > 0 ? "green" : "ice"}
          />
          <ActionMiniStat
            label="Due Soon"
            value={money(dueSoonTotal)}
            tone={dueSoonTotal > 0 ? "amber" : "green"}
          />
          <ActionMiniStat
            label="Alert Load"
            value={alertCount > 0 ? `${alertCount} active` : "clear"}
            tone={alertCount > 0 ? tone : "green"}
          />
        </div>
      </div>
    </Pane>
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
          throw new Error(
            "Supabase is not configured. Check your environment variables."
          );
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

    const billsMonthlyPressure = activeBills.reduce((sum, b) => {
      if (b.type === "controllable") {
        return sum + safeNum(b.minPay, 0) + safeNum(b.extraPay, 0);
      }
      return sum + safeNum(b.amount, 0) * freqToMonthlyMult(b.frequency);
    }, 0);

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

    const lateBills = dueSoon.filter(
      (b) => Number.isFinite(b.dueIn) && b.dueIn < 0
    );

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

    const lateCount = lateBills.length;

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

    if (lateCount > 0) {
      const lateBillLead = lateBills[0];
      alertItems.push({
        id: "late-bills",
        severity: "critical",
        title: `${lateBillLead?.name || "A bill"} is late`,
        detail:
          lateCount > 1
            ? `${lateCount} late bills need attention right now.`
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

    if (!alertItems.length) {
      alertItems.push({
        id: "all-clear",
        severity: "clear",
        title: "No active pressure points",
        detail:
          "Nothing critical or warning-level is hitting the dashboard right now.",
        amount: "",
        href: "",
        hrefLabel: "",
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

    let nextAction = {
      tone: "green",
      badge: "stable",
      title: "You are clear right now",
      detail:
        "Nothing urgent is hitting the board. Keep feeding real data into the system and use the dashboard to stay ahead.",
      buttonLabel: "Open accounts",
      href: "/accounts",
      actionType: "link",
    };

    if (!accounts.length) {
      nextAction = {
        tone: "red",
        badge: "blocked",
        title: "Load accounts first",
        detail:
          "The dashboard cannot tell the truth until real account balances exist. Start there before trusting anything else on this page.",
        buttonLabel: "Open accounts",
        href: "/accounts",
        actionType: "link",
      };
    } else if (lateBills.length > 0) {
      const lead = lateBills[0];
      nextAction = {
        tone: "red",
        badge: "urgent",
        title: `${lead.name} is late`,
        detail: `${
          lead.dueIn ? Math.abs(lead.dueIn) : 0
        } day(s) past due • ${money(lead.displayAmount)}. Handle the overdue bill before doing anything cosmetic.`,
        buttonLabel: "View issues",
        actionType: "alerts",
      };
    } else if (dueThisWeek.length > 0) {
      const lead = dueThisWeek[0];
      nextAction = {
        tone: "amber",
        badge: "upcoming",
        title: `${lead.name} due ${fmtShort(lead.dueDate)}`,
        detail:
          dueThisWeek.length > 1
            ? `${dueThisWeek.length} bills are due in the next 7 days. Stay ahead before they hit your balances at once.`
            : `This is the next bill on deck. Knock it out before it turns into pressure.`,
        buttonLabel: "Open bills",
        href: "/bills",
        actionType: "link",
      };
    } else if (cashMovement < 0) {
      nextAction = {
        tone: "red",
        badge: "cash movement",
        title: "Spending is outrunning income",
        detail:
          "Your actual logged movement is negative this month. Tighten spending before that turns into a real balance problem.",
        buttonLabel: "Review spending",
        href: "/spending",
        actionType: "link",
      };
    } else if (incomeDeposits.length > 0) {
      const latestDeposit = [...incomeDeposits].sort((a, b) =>
        String(b.date).localeCompare(String(a.date))
      )[0];

      nextAction = {
        tone: "green",
        badge: "latest deposit",
        title: `${money(latestDeposit.amount)} landed`,
        detail: `${latestDeposit.source || "Deposit"} posted ${fmtShort(
          latestDeposit.date
        )}. Route it with intention before it gets absorbed by random spending.`,
        buttonLabel: "Open income",
        href: "/income",
        actionType: "link",
      };
    }

    return {
      monthLabel: fmtMonthLabel(thisMonth),
      primaryName: primary?.name || "",
      netWorth,
      accountBalancesExInvestments,
      alertValue,
      alertTone,
      alertCount: nonClearAlerts.length,
      topAccounts,
      recentActivity,
      chartPoints,
      chartValue: signedMoney(cashMovement),
      chartTone: cashMovement < 0 ? "red" : cashMovement > 0 ? "green" : "ice",
      totalLoggedIncome,
      spendingActual,
      billsMonthlyPressure,
      liquidTotal,
      dueSoonTotal,
      cashMovement,
      alertItems,
      investmentTotal: investmentAccounts.reduce(
        (s, a) => s + safeNum(a.balance, 0),
        0
      ),
      nextAction,
    };
  }, [accounts, primaryId, bills, spendingTx, incomeDeposits]);

  if (loading) {
    return (
      <main className="container">
        <Pane>
          <div style={{ fontWeight: 900, fontSize: 18, color: "#fff" }}>
            Loading dashboard...
          </div>
        </Pane>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="container">
        <Pane>
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
        </Pane>
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
        alertItems={computed.alertItems}
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
            width: "min(100%, 1180px)",
            margin: "0 auto",
            display: "grid",
            gap: 14,
          }}
        >
          {pageError ? (
            <Pane tone="red" padding={14} radius={22}>
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
            </Pane>
          ) : null}

          <HeaderBar
            monthLabel={computed.monthLabel}
            primaryName={computed.primaryName}
          />

          <section
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
              gap: 12,
              alignItems: "stretch",
            }}
          >
            <StatCard
              label="Net Worth"
              value={money(computed.netWorth)}
              detail="Assets minus credit debt"
              tone="ice"
            />

            <StatCard
              label="Account Balances"
              value={money(computed.accountBalancesExInvestments)}
              detail="Non-investment balances across your accounts"
              tone="ice"
              badge={computed.investmentTotal > 0 ? "investments excluded" : ""}
            />

            <StatCard
              label="Alerts"
              value={computed.alertValue}
              detail={
                computed.alertCount > 0
                  ? `${computed.alertCount} active signal(s)`
                  : "No immediate alarms"
              }
              badge={computed.alertCount > 0 ? `${computed.alertCount} active` : ""}
              tone={computed.alertTone}
              onClick={() => setAlertsOpen(true)}
              footerText="View issues"
            />
          </section>

          <ActionStrip
            action={computed.nextAction}
            cashPosition={computed.accountBalancesExInvestments}
            cashMovement={computed.cashMovement}
            dueSoonTotal={computed.dueSoonTotal}
            alertCount={computed.alertCount}
            onOpenAlerts={() => setAlertsOpen(true)}
          />

          <CashMovementChart
            points={computed.chartPoints}
            chartValue={computed.chartValue}
            chartTone={computed.chartTone}
          />

          <section
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
              gap: 14,
              alignItems: "start",
            }}
          >
            <Pane
              padding={18}
              radius={28}
              overlayOpacity={0.56}
              style={{
                background: `
                  linear-gradient(
                    180deg,
                    rgba(255,255,255,0.03) 0%,
                    rgba(255,255,255,0.008) 10%,
                    rgba(255,255,255,0) 22%
                  ),
                  rgba(5,8,12,0.08)
                `,
              }}
            >
              <SectionHeader
                title="Top Accounts"
                subcopy="Largest balances sitting on the board right now."
              />

              <div style={{ display: "grid", gap: 10 }}>
                {computed.topAccounts.length === 0 ? (
                  <Pane tone="amber" padding={14} radius={18}>
                    <div style={{ fontWeight: 900, fontSize: 15, color: "#fff" }}>
                      No accounts yet
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 13,
                        color: "rgba(255,255,255,0.72)",
                      }}
                    >
                      Add accounts so this panel actually has something real to show.
                    </div>
                  </Pane>
                ) : (
                  computed.topAccounts.map((account) => (
                    <AccountRow
                      key={account.id}
                      name={account.name}
                      sub={String(account.type || "other")}
                      balance={money(account.balance)}
                      tone={
                        String(account.type || "").toLowerCase() === "credit"
                          ? "red"
                          : String(account.type || "").toLowerCase() === "investment"
                          ? "green"
                          : "ice"
                      }
                    />
                  ))
                )}
              </div>

              <div style={{ marginTop: 14 }}>
                <LinkButton href="/accounts" full>
                  Open accounts
                </LinkButton>
              </div>
            </Pane>

            <Pane
              padding={18}
              radius={28}
              overlayOpacity={0.56}
              style={{
                background: `
                  linear-gradient(
                    180deg,
                    rgba(255,255,255,0.03) 0%,
                    rgba(255,255,255,0.008) 10%,
                    rgba(255,255,255,0) 22%
                  ),
                  rgba(5,8,12,0.08)
                `,
              }}
            >
              <SectionHeader
                title="Recent Transactions"
                subcopy="Latest movement across income, spending, and upcoming due items."
              />

              <div style={{ display: "grid", gap: 10 }}>
                {computed.recentActivity.length === 0 ? (
                  <Pane tone="amber" padding={14} radius={18}>
                    <div style={{ fontWeight: 900, fontSize: 15, color: "#fff" }}>
                      No recent activity
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 13,
                        color: "rgba(255,255,255,0.72)",
                      }}
                    >
                      Log income or spending and this panel will start to look alive.
                    </div>
                  </Pane>
                ) : (
                  computed.recentActivity.map((item) => (
                    <ActivityRow
                      key={item.id}
                      title={item.title}
                      detail={item.detail}
                      amount={item.amount}
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
                <LinkButton href="/bills">Bills</LinkButton>
                <LinkButton href="/income">Income</LinkButton>
                <LinkButton href="/spending">Spending</LinkButton>
                <LinkButton href="/investments">Investments</LinkButton>
              </div>
            </Pane>
          </section>
        </div>
      </main>
    </>
  );
}
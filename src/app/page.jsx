"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  Landmark,
  PiggyBank,
  Sparkles,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import GlassPane from "./components/GlassPane";

export const dynamic = "force-dynamic";

const DASH_FONT_STACK =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

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

function mapInvestmentAssetRow(row) {
  return {
    id: row.id,
    symbol: String(row.symbol || "").trim().toUpperCase(),
    name: row.name || row.symbol || "Asset",
    assetType: row.asset_type || "asset",
    account: row.account || "",
  };
}

function mapInvestmentTxnRow(row) {
  return {
    id: row.id,
    assetId: row.asset_id,
    type: String(row.txn_type || "").toUpperCase(),
    date: row.txn_date || "",
    qty: safeNum(row.qty, 0),
    price: safeNum(row.price, 0),
  };
}

function initialsFromLabel(label = "") {
  const clean = String(label).trim();
  if (!clean) return "—";
  const parts = clean.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]).join("").toUpperCase();
}

function severityRank(severity) {
  if (severity === "critical") return 0;
  if (severity === "warning") return 1;
  return 2;
}

function toneMeta(tone = "neutral") {
  if (tone === "green") {
    return {
      text: "#97efc7",
      border: "rgba(143, 240, 191, 0.16)",
      glow: "rgba(110, 229, 173, 0.10)",
      dot: "#8ef4bb",
      pillBg: "rgba(8,18,12,0.42)",
      iconBg: "rgba(12, 22, 17, 0.72)",
    };
  }

  if (tone === "amber") {
    return {
      text: "#f5cf88",
      border: "rgba(255, 204, 112, 0.16)",
      glow: "rgba(255, 194, 92, 0.10)",
      dot: "#ffd089",
      pillBg: "rgba(18,14,8,0.42)",
      iconBg: "rgba(24, 18, 11, 0.72)",
    };
  }

  if (tone === "red") {
    return {
      text: "#ffb4c5",
      border: "rgba(255, 132, 163, 0.16)",
      glow: "rgba(255, 108, 145, 0.10)",
      dot: "#ff96ae",
      pillBg: "rgba(18,8,11,0.42)",
      iconBg: "rgba(24, 11, 15, 0.72)",
    };
  }

  return {
    text: "#f7fbff",
    border: "rgba(214, 226, 255, 0.13)",
    glow: "rgba(140, 170, 255, 0.08)",
    dot: "#f7fbff",
    pillBg: "rgba(10,14,21,0.40)",
    iconBg: "rgba(12, 16, 24, 0.72)",
  };
}

function eyebrowStyle() {
  return {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: ".22em",
    fontWeight: 800,
    color: "rgba(255,255,255,0.42)",
  };
}

function mutedStyle() {
  return {
    fontSize: 13,
    color: "rgba(255,255,255,0.62)",
    lineHeight: 1.5,
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

async function fetchQuoteMap(symbols) {
  const unique = [...new Set(symbols.map((s) => String(s || "").trim().toUpperCase()).filter(Boolean))];
  if (unique.length === 0) return {};

  try {
    const res = await fetch(
      `/api/prices-batch?symbols=${encodeURIComponent(unique.join(","))}`,
      { cache: "no-store" }
    );

    if (!res.ok) return {};

    const json = await res.json();
    const out = {};

    function assign(symbol, value) {
      const sym = String(symbol || "").trim().toUpperCase();
      const price = Number(value);
      if (!sym || !Number.isFinite(price)) return;
      out[sym] = price;
    }

    if (Array.isArray(json)) {
      json.forEach((item) => {
        assign(
          item?.symbol ?? item?.ticker,
          item?.price ?? item?.currentPrice ?? item?.last ?? item?.close
        );
      });
    }

    if (Array.isArray(json?.quotes)) {
      json.quotes.forEach((item) => {
        assign(
          item?.symbol ?? item?.ticker,
          item?.price ?? item?.currentPrice ?? item?.last ?? item?.close
        );
      });
    }

    if (Array.isArray(json?.data)) {
      json.data.forEach((item) => {
        assign(
          item?.symbol ?? item?.ticker,
          item?.price ?? item?.currentPrice ?? item?.last ?? item?.close
        );
      });
    }

    if (json?.prices && typeof json.prices === "object") {
      Object.entries(json.prices).forEach(([symbol, value]) => {
        if (typeof value === "object" && value !== null) {
          assign(
            symbol,
            value.price ?? value.currentPrice ?? value.last ?? value.close
          );
        } else {
          assign(symbol, value);
        }
      });
    }

    if (json && typeof json === "object" && !Array.isArray(json)) {
      Object.entries(json).forEach(([symbol, value]) => {
        if (out[String(symbol).toUpperCase()]) return;

        if (typeof value === "number") {
          assign(symbol, value);
          return;
        }

        if (value && typeof value === "object") {
          assign(
            value.symbol ?? symbol,
            value.price ?? value.currentPrice ?? value.last ?? value.close
          );
        }
      });
    }

    return out;
  } catch {
    return {};
  }
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
        boxShadow: `0 0 10px ${meta.glow}`,
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
        minHeight: 32,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "0 11px",
        borderRadius: 999,
        border: `1px solid ${meta.border}`,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.035), 0 0 10px ${meta.glow}`,
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
        gap: 12,
        flexWrap: "wrap",
        marginBottom: 12,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 18,
            lineHeight: 1.1,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "#fff",
          }}
        >
          {title}
        </div>

        {subcopy ? <div style={{ ...mutedStyle(), marginTop: 4 }}>{subcopy}</div> : null}
      </div>

      {right || null}
    </div>
  );
}

function ActionLink({ href, children, full = false }) {
  return (
    <Link
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        width: full ? "100%" : undefined,
        minHeight: 40,
        padding: "10px 13px",
        borderRadius: 14,
        border: "1px solid rgba(214,226,255,0.10)",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012))",
        color: "#f7fbff",
        textDecoration: "none",
        fontWeight: 800,
        fontSize: 13,
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.04), 0 10px 18px rgba(0,0,0,0.12)",
      }}
    >
      {children}
    </Link>
  );
}

function ActionButton({ onClick, children, full = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        width: full ? "100%" : undefined,
        minHeight: 40,
        padding: "10px 13px",
        borderRadius: 14,
        border: "1px solid rgba(214,226,255,0.10)",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012))",
        color: "#f7fbff",
        fontWeight: 800,
        fontSize: 13,
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.04), 0 10px 18px rgba(0,0,0,0.12)",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  tone = "neutral",
  badge = "",
}) {
  const meta = toneMeta(tone);

  return (
    <GlassPane tone={tone} size="card" style={{ height: "100%" }}>
      <div
        style={{
          minHeight: 138,
          height: "100%",
          display: "grid",
          gridTemplateRows: "auto auto auto 1fr",
          gap: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 13,
              display: "grid",
              placeItems: "center",
              border: `1px solid ${meta.border}`,
              background: meta.iconBg,
              color: tone === "neutral" ? "#fff" : meta.text,
              boxShadow: `0 0 12px ${meta.glow}`,
              flexShrink: 0,
            }}
          >
            <Icon size={16} />
          </div>

          <StatusDot tone={tone} size={8} />
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={eyebrowStyle()}>{label}</div>

          {badge ? (
            <div style={{ marginTop: 7 }}>
              <div
                style={{
                  minHeight: 22,
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "0 8px",
                  borderRadius: 999,
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  border: `1px solid ${meta.border}`,
                  color: tone === "neutral" ? "rgba(255,255,255,0.82)" : meta.text,
                  background: meta.pillBg,
                  whiteSpace: "normal",
                  lineHeight: 1.2,
                }}
              >
                {badge}
              </div>
            </div>
          ) : null}
        </div>

        <div
          style={{
            fontSize: "clamp(22px, 2.9vw, 34px)",
            lineHeight: 1,
            fontWeight: 850,
            letterSpacing: "-0.05em",
            color: tone === "neutral" ? "#fff" : meta.text,
            overflowWrap: "anywhere",
          }}
        >
          {value}
        </div>

        <div
          style={{
            fontSize: 12,
            lineHeight: 1.45,
            color: "rgba(255,255,255,0.62)",
            overflowWrap: "anywhere",
          }}
        >
          {detail}
        </div>
      </div>
    </GlassPane>
  );
}

function HeaderBar({
  monthLabel,
  primaryName,
  focusTitle,
  focusTone,
  accountCount,
  onOpenAlerts,
}) {
  return (
    <GlassPane size="card">
      <div className="lccDashHeroGrid" style={{ alignItems: "center" }}>
        <div style={{ minWidth: 0 }}>
          <div style={eyebrowStyle()}>Life Command Center</div>

          <div
            style={{
              marginTop: 8,
              fontSize: "clamp(24px, 3.2vw, 34px)",
              lineHeight: 1.02,
              fontWeight: 850,
              letterSpacing: "-0.05em",
              color: "#fff",
            }}
          >
            Financial Overview
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
                whiteSpace: "normal",
                overflowWrap: "anywhere",
              }}
            >
              {focusTitle}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          <MiniPill>{monthLabel}</MiniPill>
          <MiniPill>{primaryName || "Primary account"}</MiniPill>
          <MiniPill>{accountCount} accounts</MiniPill>
          <button
            type="button"
            onClick={onOpenAlerts}
            style={{
              minHeight: 32,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "0 11px",
              borderRadius: 999,
              border: "1px solid rgba(214,226,255,0.14)",
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012))",
              color: "#fff",
              fontSize: 11,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Open alerts <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </GlassPane>
  );
}

function EmptyState({ title, detail, linkHref, linkLabel }) {
  return (
    <div
      style={{
        minHeight: 140,
        display: "grid",
        placeItems: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 340 }}>
        <div
          style={{
            fontSize: 17,
            fontWeight: 800,
            color: "#fff",
            textAlign: "center",
          }}
        >
          {title}
        </div>

        <div
          style={{
            marginTop: 8,
            fontSize: 13,
            lineHeight: 1.55,
            color: "rgba(255,255,255,0.64)",
            textAlign: "center",
          }}
        >
          {detail}
        </div>

        {linkHref && linkLabel ? (
          <div style={{ marginTop: 14, display: "flex", justifyContent: "center" }}>
            <ActionLink href={linkHref}>
              {linkLabel} <ArrowRight size={14} />
            </ActionLink>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ListRow({ title, subtitle, value, tone = "neutral", initials = "—" }) {
  const meta = toneMeta(tone);

  return (
    <div
      style={{
        minHeight: 70,
        display: "grid",
        gridTemplateColumns: "46px minmax(0, 1fr) auto",
        gap: 12,
        alignItems: "center",
        padding: "11px 13px",
        borderRadius: 18,
        border: `1px solid ${meta.border}`,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.035), 0 0 12px ${meta.glow}`,
      }}
    >
      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: 14,
          display: "grid",
          placeItems: "center",
          border: `1px solid ${meta.border}`,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.012))",
          color: tone === "neutral" ? "#fff" : meta.text,
          fontWeight: 800,
          fontSize: 13,
          letterSpacing: ".06em",
        }}
      >
        {initials}
      </div>

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: "#fff",
            lineHeight: 1.25,
            overflowWrap: "anywhere",
          }}
        >
          {title}
        </div>

        <div
          style={{
            marginTop: 3,
            fontSize: 12,
            color: "rgba(255,255,255,0.58)",
            lineHeight: 1.35,
            overflowWrap: "anywhere",
          }}
        >
          {subtitle}
        </div>
      </div>

      <div
        style={{
          fontSize: 14,
          fontWeight: 800,
          color: tone === "neutral" ? "rgba(255,255,255,0.92)" : meta.text,
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function RangeChip({ children, active = false }) {
  return (
    <button
      type="button"
      style={{
        minHeight: 32,
        padding: "6px 11px",
        borderRadius: 12,
        border: active
          ? "1px solid rgba(214,226,255,0.14)"
          : "1px solid rgba(255,255,255,0.06)",
        background: active
          ? "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.014))"
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

function ChartSummaryTile({ label, value, tone = "neutral" }) {
  const meta = toneMeta(tone);

  return (
    <div
      style={{
        minHeight: 78,
        borderRadius: 16,
        border: `1px solid ${meta.border}`,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.032), rgba(255,255,255,0.01))",
        padding: 13,
      }}
    >
      <div style={eyebrowStyle()}>{label}</div>
      <div
        style={{
          marginTop: 7,
          fontSize: 19,
          fontWeight: 850,
          letterSpacing: "-0.04em",
          color: tone === "neutral" ? "#fff" : meta.text,
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function CashMovementCard({
  points,
  chartValue,
  chartTone = "neutral",
  monthIncome,
  monthSpending,
  monthPressure,
}) {
  const chartId = useId().replace(/:/g, "");
  const safePoints =
    points.length > 1
      ? points
      : [
          { iso: "start", label: "Start", value: 0 },
          { iso: "now", label: "Now", value: 0 },
        ];

  const width = 980;
  const height = 286;
  const padLeft = 18;
  const padRight = 18;
  const padTop = 18;
  const padBottom = 38;

  const values = safePoints.map((p) => safeNum(p.value, 0));
  const minVal = Math.min(0, ...values);
  const maxVal = Math.max(0, ...values);
  const range = Math.max(maxVal - minVal, 1);

  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;
  const step = safePoints.length > 1 ? innerW / (safePoints.length - 1) : innerW;

  const coords = safePoints.map((point, index) => {
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
          border: "rgba(255,178,194,0.18)",
          text: "#ffb2c2",
          glow: "rgba(255,178,194,0.08)",
        }
      : chartTone === "green"
      ? {
          border: "rgba(158,240,192,0.18)",
          text: "#9ef0c0",
          glow: "rgba(158,240,192,0.08)",
        }
      : {
          border: "rgba(214,226,255,0.14)",
          text: "#ffffff",
          glow: "rgba(214,226,255,0.06)",
        };

  return (
    <GlassPane size="card">
      <PaneHeader
        title="Cash Movement"
        subcopy="Month-to-date cash movement from logged income and spending."
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <RangeChip>1W</RangeChip>
            <RangeChip active>1M</RangeChip>
            <RangeChip>YTD</RangeChip>
            <RangeChip>All</RangeChip>
          </div>
        }
      />

      <div className="lccDashChartSummaryGrid" style={{ marginBottom: 12 }}>
        <ChartSummaryTile label="Movement" value={chartValue} tone={chartTone} />
        <ChartSummaryTile label="Income" value={money(monthIncome)} tone="green" />
        <ChartSummaryTile label="Spending" value={money(monthSpending)} tone="neutral" />
        <ChartSummaryTile label="Bill Pressure" value={money(monthPressure)} tone="amber" />
      </div>

      <div
        style={{
          position: "relative",
          minHeight: "clamp(214px, 28vw, 286px)",
        }}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: "100%", display: "block" }}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={`lcc-chart-area-${chartId}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(136,170,255,0.10)" />
              <stop offset="55%" stopColor="rgba(117,122,255,0.03)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>

            <linearGradient
              id={`lcc-chart-line-${chartId}`}
              x1="0"
              x2="1"
              y1="0"
              y2="0"
            >
              <stop offset="0%" stopColor="rgba(196,220,255,0.9)" />
              <stop offset="60%" stopColor="rgba(181,198,255,0.92)" />
              <stop offset="100%" stopColor="rgba(196,177,255,0.92)" />
            </linearGradient>

            <filter id={`lcc-chart-glow-${chartId}`}>
              <feGaussianBlur stdDeviation="3.25" result="blur" />
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
              stroke="rgba(255,255,255,0.01)"
              strokeWidth="1"
            />
          ))}

          <path d={areaPath} fill={`url(#lcc-chart-area-${chartId})`} />

          <path
            d={linePath}
            fill="none"
            stroke={`url(#lcc-chart-line-${chartId})`}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#lcc-chart-glow-${chartId})`}
          />

          {coords.map((p) => (
            <g key={`${p.iso}-dot`}>
              <circle
                cx={p.x}
                cy={p.y}
                r="5.4"
                fill="rgba(8,10,14,0.9)"
                stroke="rgba(245,248,255,0.92)"
                strokeWidth="2"
              />
              <circle cx={p.x} cy={p.y} r="1.8" fill="rgba(255,255,255,0.98)" />
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

        {lastPoint ? (
          <div
            style={{
              position: "absolute",
              top:
                Math.max(16, Math.min(210, (lastPoint.y / height) * 100 - 2)) + "%",
              right: 14,
              transform: "translateY(-50%)",
              padding: "9px 14px",
              borderRadius: 16,
              border: `1px solid ${bubbleTone.border}`,
              background:
                "linear-gradient(180deg, rgba(10,14,22,0.86), rgba(10,14,22,0.74))",
              boxShadow: `
                inset 0 1px 0 rgba(255,255,255,0.04),
                0 10px 18px rgba(0,0,0,0.16),
                0 0 12px ${bubbleTone.glow}
              `,
              color: bubbleTone.text,
              fontSize: 16,
              fontWeight: 850,
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

function SignalBadge({ severity }) {
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
        minHeight: 22,
        display: "inline-flex",
        alignItems: "center",
        padding: "0 8px",
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: ".1em",
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

function SignalRow({ item }) {
  const tone =
    item.severity === "critical"
      ? "red"
      : item.severity === "warning"
      ? "amber"
      : "green";

  return (
    <GlassPane tone={tone} size="compact">
      <div style={{ display: "grid", gap: 10 }}>
        <div
          style={{
            display: "flex",
            alignItems: "start",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "start", gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                display: "grid",
                placeItems: "center",
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
                color: "#fff",
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={16} />
            </div>

            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: "#fff",
                  lineHeight: 1.25,
                  overflowWrap: "anywhere",
                }}
              >
                {item.title}
              </div>

              <div
                style={{
                  marginTop: 3,
                  fontSize: 12,
                  color: "rgba(255,255,255,0.62)",
                  lineHeight: 1.45,
                  overflowWrap: "anywhere",
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
                  fontSize: 13,
                  fontWeight: 800,
                  color: "rgba(255,255,255,0.92)",
                }}
              >
                {item.amount}
              </div>
            ) : null}

            <SignalBadge severity={item.severity} />
          </div>
        </div>

        {item.href ? (
          <div>
            <ActionLink href={item.href}>
              {item.hrefLabel || "Open"} <ChevronRight size={14} />
            </ActionLink>
          </div>
        ) : null}
      </div>
    </GlassPane>
  );
}

function SignalPreviewRow({ item }) {
  const tone =
    item.severity === "critical"
      ? "red"
      : item.severity === "warning"
      ? "amber"
      : "green";

  const meta = toneMeta(tone);

  return (
    <div
      style={{
        minHeight: 58,
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        gap: 10,
        alignItems: "center",
        padding: "10px 12px",
        borderRadius: 16,
        border: `1px solid ${meta.border}`,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: "#fff",
            lineHeight: 1.25,
            overflowWrap: "anywhere",
          }}
        >
          {item.title}
        </div>
        <div
          style={{
            marginTop: 3,
            fontSize: 12,
            color: "rgba(255,255,255,0.58)",
            lineHeight: 1.35,
            overflowWrap: "anywhere",
          }}
        >
          {item.detail}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
        {item.amount ? (
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: "rgba(255,255,255,0.86)",
              whiteSpace: "nowrap",
            }}
          >
            {item.amount}
          </div>
        ) : null}
        <SignalBadge severity={item.severity} />
      </div>
    </div>
  );
}

function SignalCenterModal({
  open,
  onClose,
  signalLabel,
  signalTone,
  signalItems,
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
    signalTone === "red"
      ? "red"
      : signalTone === "amber"
      ? "amber"
      : "green";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 120,
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: 12,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(100%, 760px)",
          maxHeight: "88vh",
          overflowY: "auto",
          borderRadius: 26,
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
              <div style={eyebrowStyle()}>Signal center</div>

              <div
                style={{
                  marginTop: 8,
                  fontSize: "clamp(22px, 5vw, 32px)",
                  lineHeight: 1,
                  fontWeight: 850,
                  letterSpacing: "-0.05em",
                  color: "#fff",
                }}
              >
                {signalLabel}
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
                width: 40,
                height: 40,
                borderRadius: 14,
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
              <div style={eyebrowStyle()}>Cash Position</div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 21,
                  fontWeight: 850,
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
                  fontSize: 21,
                  fontWeight: 850,
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
                  fontSize: 21,
                  fontWeight: 850,
                  color: "#fff",
                }}
              >
                {money(dueSoonTotal)}
              </div>
            </GlassPane>
          </div>

          <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
            {signalItems.length === 0 ? (
              <GlassPane tone="green" size="card">
                <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>
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
              signalItems.map((item) => <SignalRow key={item.id} item={item} />)
            )}
          </div>
        </GlassPane>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [user, setUser] = useState(null);

  const [accounts, setAccounts] = useState([]);
  const [primaryId, setPrimaryId] = useState("");
  const [bills, setBills] = useState([]);
  const [spendingTx, setSpendingTx] = useState([]);
  const [incomeDeposits, setIncomeDeposits] = useState([]);

  const [investmentAssets, setInvestmentAssets] = useState([]);
  const [investmentTxns, setInvestmentTxns] = useState([]);
  const [quoteMap, setQuoteMap] = useState({});

  const [signalsOpen, setSignalsOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        setLoading(true);

        const {
          data: { user: currentUser },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;
        if (!mounted) return;

        setUser(currentUser || null);

        if (!currentUser) {
          setAccounts([]);
          setBills([]);
          setSpendingTx([]);
          setIncomeDeposits([]);
          setInvestmentAssets([]);
          setInvestmentTxns([]);
          setQuoteMap({});
          setPrimaryId("");
          setPageError("");
          return;
        }

        const monthStart = startOfMonthISO();
        const monthEnd = endOfMonthISO();

        const [
          accRes,
          settingsRes,
          billsRes,
          spendingRes,
          incomeRes,
          assetRes,
          txnRes,
        ] = await Promise.all([
          supabase
            .from("accounts")
            .select("*")
            .eq("user_id", currentUser.id)
            .order("updated_at", { ascending: false }),

          supabase
            .from("account_settings")
            .select("primary_account_id")
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

          supabase
            .from("investment_assets")
            .select("*")
            .eq("user_id", currentUser.id)
            .order("symbol", { ascending: true }),

          supabase
            .from("investment_transactions")
            .select("*")
            .eq("user_id", currentUser.id)
            .order("txn_date", { ascending: true }),
        ]);

        if (accRes.error) throw accRes.error;
        if (settingsRes.error) throw settingsRes.error;
        if (billsRes.error) throw billsRes.error;
        if (spendingRes.error) throw spendingRes.error;
        if (incomeRes.error) throw incomeRes.error;
        if (assetRes.error) throw assetRes.error;
        if (txnRes.error) throw txnRes.error;

        const loadedAccounts = (accRes.data || []).map(mapAccountRowToClient);
        const loadedBills = (billsRes.data || []).map(mapBillRowToClient);
        const loadedSpending = (spendingRes.data || []).map(mapSpendingTxRowToClient);
        const loadedIncome = (incomeRes.data || []).map(mapIncomeDepositRowToClient);
        const loadedInvestmentAssets = (assetRes.data || []).map(mapInvestmentAssetRow);
        const loadedInvestmentTxns = (txnRes.data || []).map(mapInvestmentTxnRow);

        const nextPrimary =
          settingsRes.data?.primary_account_id &&
          loadedAccounts.some((a) => a.id === settingsRes.data.primary_account_id)
            ? settingsRes.data.primary_account_id
            : loadedAccounts[0]?.id || "";

        const symbols = loadedInvestmentAssets
          .map((a) => a.symbol)
          .filter(Boolean);

        const nextQuotes = await fetchQuoteMap(symbols);

        if (!mounted) return;

        setAccounts(loadedAccounts);
        setPrimaryId(nextPrimary);
        setBills(loadedBills);
        setSpendingTx(loadedSpending);
        setIncomeDeposits(loadedIncome);
        setInvestmentAssets(loadedInvestmentAssets);
        setInvestmentTxns(loadedInvestmentTxns);
        setQuoteMap(nextQuotes);
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

    const nonDebtAssets = accounts
      .filter((a) => String(a.type || "").toLowerCase() !== "credit")
      .reduce((sum, a) => sum + safeNum(a.balance, 0), 0);

    const creditDebt = creditAccounts.reduce(
      (sum, a) => sum + Math.max(0, safeNum(a.balance, 0)),
      0
    );

    const investmentTotal = investmentAccounts.reduce(
      (sum, a) => sum + safeNum(a.balance, 0),
      0
    );

    const accountBalancesExInvestments = visibleBalanceAccounts.reduce(
      (sum, a) => sum + safeNum(a.balance, 0),
      0
    );

    const netWorth = nonDebtAssets - creditDebt;

    const monthlyIncome =
      incomeDeposits.reduce((sum, row) => sum + safeNum(row.amount, 0), 0) +
      spendingTx.reduce((sum, row) => {
        return String(row.type || "").toLowerCase() === "income"
          ? sum + safeNum(row.amount, 0)
          : sum;
      }, 0);

    const monthlySpending = spendingTx.reduce((sum, row) => {
      const type = String(row.type || "").toLowerCase();
      if (type === "income") return sum;
      return sum + safeNum(row.amount, 0);
    }, 0);

    const monthlyBillPressure = bills.reduce((sum, row) => {
      return sum + safeNum(row.amount, 0) * freqToMonthlyMult(row.frequency);
    }, 0);

    const cashMovement = monthlyIncome - monthlySpending;
    const burnPct =
      monthlyIncome > 0
        ? ((monthlySpending + monthlyBillPressure) / monthlyIncome) * 100
        : 0;

    const dueSoonBills = bills
      .filter((bill) => bill.active && bill.dueDate)
      .map((bill) => ({
        ...bill,
        days: daysUntil(bill.dueDate),
      }))
      .filter((bill) => bill.days !== null && bill.days <= 7)
      .sort((a, b) => safeNum(a.days, 999) - safeNum(b.days, 999));

    const overdueBills = dueSoonBills.filter((bill) => safeNum(bill.days, 0) < 0);
    const nextThreeDayBills = dueSoonBills.filter((bill) => {
      const d = safeNum(bill.days, 999);
      return d >= 0 && d <= 3;
    });

    const dueSoonTotal = dueSoonBills.reduce(
      (sum, bill) => sum + safeNum(bill.amount, 0),
      0
    );

    const signalItems = [];

    if (accounts.length === 0) {
      signalItems.push({
        id: "no-accounts",
        severity: "warning",
        title: "No accounts connected yet",
        detail: "Add your accounts so the dashboard can calculate real balances.",
        href: "/accounts",
        hrefLabel: "Open Accounts",
      });
    }

    if (primary && safeNum(primary.balance, 0) < 0) {
      signalItems.push({
        id: "primary-negative",
        severity: "critical",
        title: `${primary.name || "Primary account"} is negative`,
        detail: "Your selected main cash account is below zero right now.",
        amount: money(primary.balance),
        href: "/accounts",
        hrefLabel: "Review accounts",
      });
    }

    if (overdueBills.length > 0) {
      signalItems.push({
        id: "overdue-bills",
        severity: "critical",
        title: `${overdueBills.length} overdue bill${overdueBills.length === 1 ? "" : "s"}`,
        detail: "You have bills that are already past due and need attention now.",
        amount: money(
          overdueBills.reduce((sum, bill) => sum + safeNum(bill.amount, 0), 0)
        ),
        href: "/bills",
        hrefLabel: "Open bills",
      });
    }

    if (nextThreeDayBills.length > 0) {
      signalItems.push({
        id: "due-soon-bills",
        severity:
          dueSoonTotal > accountBalancesExInvestments ? "critical" : "warning",
        title: `${nextThreeDayBills.length} bill${nextThreeDayBills.length === 1 ? "" : "s"} due within 3 days`,
        detail:
          dueSoonTotal > accountBalancesExInvestments
            ? "Bills due soon are larger than your visible cash position."
            : "Bills are stacking up fast over the next few days.",
        amount: money(
          nextThreeDayBills.reduce((sum, bill) => sum + safeNum(bill.amount, 0), 0)
        ),
        href: "/bills",
        hrefLabel: "Review due bills",
      });
    }

    if (cashMovement < 0) {
      signalItems.push({
        id: "negative-cash-movement",
        severity: "warning",
        title: "Month cash movement is negative",
        detail: "Logged spending is ahead of logged income this month.",
        amount: signedMoney(cashMovement),
        href: "/spending",
        hrefLabel: "Open spending",
      });
    }

    if (monthlyIncome > 0 && burnPct >= 95) {
      signalItems.push({
        id: "burn-rate",
        severity: burnPct >= 110 ? "critical" : "warning",
        title: "Monthly pressure is high",
        detail:
          "Spending plus monthly bill pressure is eating almost all of current monthly income.",
        amount: `${Math.round(burnPct)}%`,
        href: "/bills",
        hrefLabel: "Review pressure",
      });
    }

    signalItems.sort((a, b) => severityRank(a.severity) - severityRank(b.severity));

    const hasCritical = signalItems.some((item) => item.severity === "critical");
    const hasWarning = signalItems.some((item) => item.severity === "warning");

    const signalTone = hasCritical ? "red" : hasWarning ? "amber" : "green";
    const signalLabel = hasCritical
      ? "Critical"
      : hasWarning
      ? "Attention"
      : "Clear";
    const signalCount = signalItems.length;

    let focus = {
      title: "Board looks stable right now.",
      tone: "green",
    };

    if (accounts.length === 0) {
      focus = {
        title: "Add accounts to light up the board with real numbers.",
        tone: "amber",
      };
    } else if (hasCritical) {
      focus = {
        title: signalItems[0]?.title || "Critical issues need attention.",
        tone: "red",
      };
    } else if (hasWarning) {
      focus = {
        title: signalItems[0]?.title || "A few pressure points need cleanup.",
        tone: "amber",
      };
    } else if (cashMovement > 0) {
      focus = {
        title: `Cash movement is ${signedMoney(cashMovement)} this month.`,
        tone: "green",
      };
    }

    const chartPoints = buildCashMovementPoints(
      monthStart,
      today,
      spendingTx,
      incomeDeposits
    );

    const topAccounts = visibleBalanceAccounts
      .slice()
      .sort((a, b) => safeNum(b.balance, 0) - safeNum(a.balance, 0))
      .slice(0, 4)
      .map((account) => ({
        id: account.id,
        title: account.name || "Account",
        subtitle: String(account.type || "account").replace(/^\w/, (m) => m.toUpperCase()),
        value: money(account.balance),
        tone: safeNum(account.balance, 0) < 0 ? "red" : "neutral",
        initials: initialsFromLabel(account.name || "AC"),
      }));

    const recentActivity = [
      ...incomeDeposits.map((row) => ({
        id: `income-${row.id}`,
        iso: row.date || "",
        title: row.source || "Income deposit",
        subtitle: row.note || fmtShort(row.date),
        value: signedMoney(row.amount),
        tone: "green",
        initials: initialsFromLabel(row.source || "IN"),
      })),
      ...spendingTx.map((row) => {
        const type = String(row.type || "").toLowerCase();
        const isIncome = type === "income";
        const title = row.merchant || row.note || (isIncome ? "Income" : "Expense");
        return {
          id: `spend-${row.id}`,
          iso: row.date || "",
          title,
          subtitle: row.note || fmtShort(row.date),
          value: isIncome ? signedMoney(row.amount) : signedMoney(-row.amount),
          tone: isIncome ? "green" : "neutral",
          initials: initialsFromLabel(title),
        };
      }),
    ]
      .sort((a, b) => String(b.iso).localeCompare(String(a.iso)))
      .slice(0, 5);

    const upcomingBills = dueSoonBills.slice(0, 5).map((bill) => ({
      id: bill.id,
      title: bill.name || "Bill",
      subtitle:
        safeNum(bill.days, 999) < 0
          ? `${Math.abs(safeNum(bill.days, 0))} day(s) late`
          : safeNum(bill.days, 999) === 0
          ? "Due today"
          : `${safeNum(bill.days, 0)} day(s) left`,
      value: money(bill.amount),
      tone:
        safeNum(bill.days, 999) < 0
          ? "red"
          : safeNum(bill.days, 999) <= 3
          ? "amber"
          : "neutral",
      initials: initialsFromLabel(bill.name || "BL"),
    }));

    const assetsById = new Map(investmentAssets.map((asset) => [asset.id, asset]));
    const txnsByAsset = new Map();

    investmentTxns.forEach((txn) => {
      const existing = txnsByAsset.get(txn.assetId) || [];
      existing.push(txn);
      txnsByAsset.set(txn.assetId, existing);
    });

    let pricedHoldingCount = 0;
    let holdingCount = 0;
    let portfolioMarketValue = 0;
    let portfolioCostBasis = 0;

    investmentAssets.forEach((asset) => {
      const txns = (txnsByAsset.get(asset.id) || []).slice().sort((a, b) =>
        String(a.date).localeCompare(String(b.date))
      );

      let qty = 0;
      let remainingCost = 0;

      txns.forEach((txn) => {
        const t = String(txn.type || "").toUpperCase();
        const txnQty = safeNum(txn.qty, 0);
        const txnPrice = safeNum(txn.price, 0);

        if (t === "BUY") {
          qty += txnQty;
          remainingCost += txnQty * txnPrice;
          return;
        }

        if (t === "SELL" && txnQty > 0) {
          const avgCost = qty > 0 ? remainingCost / qty : 0;
          const qtySold = Math.min(qty, txnQty);
          qty -= qtySold;
          remainingCost -= avgCost * qtySold;
        }
      });

      if (qty <= 0) return;

      holdingCount += 1;

      const symbol = String(asset.symbol || "").toUpperCase();
      const livePrice = safeNum(quoteMap[symbol], NaN);

      if (Number.isFinite(livePrice) && livePrice > 0) {
        pricedHoldingCount += 1;
        portfolioMarketValue += qty * livePrice;
        portfolioCostBasis += remainingCost;
      }
    });

    const portfolioPnL =
      pricedHoldingCount > 0 ? portfolioMarketValue - portfolioCostBasis : null;

    const portfolioTone =
      portfolioPnL === null
        ? "neutral"
        : portfolioPnL > 0
        ? "green"
        : portfolioPnL < 0
        ? "red"
        : "neutral";

    const portfolioValueText =
      portfolioPnL === null ? "—" : signedMoney(portfolioPnL);

    const portfolioDetail =
      holdingCount === 0
        ? "Add investment holdings to show portfolio P/L."
        : pricedHoldingCount === 0
        ? "No live price coverage yet for tracked holdings."
        : `Unrealized across ${pricedHoldingCount}/${holdingCount} live-priced holding${
            holdingCount === 1 ? "" : "s"
          }.`;

    const portfolioBadge =
      holdingCount > 0 && pricedHoldingCount > 0
        ? `${pricedHoldingCount}/${holdingCount} live priced`
        : "";

    return {
      monthLabel: fmtMonthLabel(thisMonth),
      primaryName: primary?.name || "",
      accountCount: accounts.length,
      focus,
      netWorth,
      accountBalancesExInvestments,
      signalLabel,
      signalTone,
      signalCount,
      signalItems,
      topAccounts,
      recentActivity,
      upcomingBills,
      chartPoints,
      chartValue: signedMoney(cashMovement),
      chartTone: cashMovement < 0 ? "red" : cashMovement > 0 ? "green" : "neutral",
      dueSoonTotal,
      cashMovement,
      monthlyIncome,
      monthlySpending,
      monthlyBillPressure,
      investmentTotal,
      creditDebt,
      liquidTotal: liquidAccounts.reduce((sum, a) => sum + safeNum(a.balance, 0), 0),
      portfolioPnLText: portfolioValueText,
      portfolioTone,
      portfolioDetail,
      portfolioBadge,
      portfolioMarketValue,
      portfolioCostBasis,
    };
  }, [
    accounts,
    primaryId,
    bills,
    spendingTx,
    incomeDeposits,
    investmentAssets,
    investmentTxns,
    quoteMap,
  ]);

  if (loading) {
    return (
      <main style={{ padding: "18px 0 28px", fontFamily: DASH_FONT_STACK }}>
        <div style={{ width: "min(100%, 1280px)", margin: "0 auto" }}>
          <GlassPane size="card">
            <div style={{ fontWeight: 800, fontSize: 18, color: "#fff" }}>
              Loading dashboard.
            </div>
          </GlassPane>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main style={{ padding: "18px 0 28px", fontFamily: DASH_FONT_STACK }}>
        <div style={{ width: "min(100%, 1280px)", margin: "0 auto" }}>
          <GlassPane size="card">
            <div style={{ fontWeight: 800, fontSize: 18, color: "#fff" }}>
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
        </div>
      </main>
    );
  }

  return (
    <>
      <SignalCenterModal
        open={signalsOpen}
        onClose={() => setSignalsOpen(false)}
        signalLabel={computed.signalLabel}
        signalTone={computed.signalTone}
        signalItems={computed.signalItems}
        cashPosition={computed.accountBalancesExInvestments}
        cashMovement={computed.cashMovement}
        dueSoonTotal={computed.dueSoonTotal}
      />

      <main className="lccDashRoot">
        <div className="lccDashInner">
          {pageError ? (
            <GlassPane tone="red" size="card">
              <div style={{ fontWeight: 800, fontSize: 16, color: "#fff" }}>
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
            accountCount={computed.accountCount}
            onOpenAlerts={() => setSignalsOpen(true)}
          />

          <section className="lccDashMetrics">
            <StatCard
              icon={Landmark}
              label="Net Worth"
              value={money(computed.netWorth)}
              detail="Assets minus credit debt."
              tone="neutral"
            />

            <StatCard
              icon={Wallet}
              label="Cash Position"
              value={money(computed.accountBalancesExInvestments)}
              detail="Visible balances excluding investments."
              tone="neutral"
              badge={computed.investmentTotal > 0 ? "Investments excluded" : ""}
            />

            <StatCard
              icon={PiggyBank}
              label="Month Movement"
              value={signedMoney(computed.cashMovement)}
              detail="Logged income minus logged spending this month."
              tone={computed.chartTone}
            />

            <StatCard
              icon={TrendingUp}
              label="Portfolio P/L"
              value={computed.portfolioPnLText}
              detail={computed.portfolioDetail}
              tone={computed.portfolioTone}
              badge={computed.portfolioBadge}
            />
          </section>

          <section className="lccDashMain">
            <div className="lccDashLeftCol">
              <CashMovementCard
                points={computed.chartPoints}
                chartValue={computed.chartValue}
                chartTone={computed.chartTone}
                monthIncome={computed.monthlyIncome}
                monthSpending={computed.monthlySpending}
                monthPressure={computed.monthlyBillPressure}
              />
            </div>

            <div className="lccDashRightCol">
              <GlassPane tone={computed.signalTone} size="card" style={{ height: "100%" }}>
                <PaneHeader
                  title="Signal Center"
                  subcopy="What actually needs attention right now."
                  right={
                    <button
                      type="button"
                      onClick={() => setSignalsOpen(true)}
                      style={{
                        minHeight: 34,
                        padding: "0 11px",
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,0.08)",
                        background: "rgba(255,255,255,0.03)",
                        color: "#fff",
                        fontWeight: 800,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      Open
                    </button>
                  }
                />

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      borderRadius: 15,
                      border: "1px solid rgba(255,255,255,0.08)",
                      background:
                        "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
                      padding: 11,
                    }}
                  >
                    <div style={eyebrowStyle()}>Status</div>
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 16,
                        fontWeight: 800,
                        color: "#fff",
                      }}
                    >
                      {computed.signalLabel}
                    </div>
                  </div>

                  <div
                    style={{
                      borderRadius: 15,
                      border: "1px solid rgba(255,255,255,0.08)",
                      background:
                        "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
                      padding: 11,
                    }}
                  >
                    <div style={eyebrowStyle()}>Count</div>
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 16,
                        fontWeight: 800,
                        color: "#fff",
                      }}
                    >
                      {computed.signalCount}
                    </div>
                  </div>

                  <div
                    style={{
                      borderRadius: 15,
                      border: "1px solid rgba(255,255,255,0.08)",
                      background:
                        "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
                      padding: 11,
                    }}
                  >
                    <div style={eyebrowStyle()}>Due Soon</div>
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 16,
                        fontWeight: 800,
                        color: "#fff",
                      }}
                    >
                      {money(computed.dueSoonTotal)}
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  {computed.signalItems.length === 0 ? (
                    <GlassPane tone="green" size="compact">
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>
                        Everything looks clean
                      </div>
                      <div
                        style={{
                          marginTop: 5,
                          fontSize: 13,
                          lineHeight: 1.5,
                          color: "rgba(255,255,255,0.64)",
                        }}
                      >
                        No critical or warning issues are active right now.
                      </div>
                    </GlassPane>
                  ) : (
                    computed.signalItems
                      .slice(0, 3)
                      .map((item) => <SignalPreviewRow key={item.id} item={item} />)
                  )}
                </div>

                <div style={{ marginTop: 10 }}>
                  <ActionButton onClick={() => setSignalsOpen(true)} full>
                    Review signals <ArrowRight size={14} />
                  </ActionButton>
                </div>
              </GlassPane>

              <GlassPane size="card" style={{ height: "100%" }}>
                <PaneHeader
                  title="Recent Activity"
                  subcopy="Latest income and spending touching this month."
                  right={<MiniPill>{computed.recentActivity.length} items</MiniPill>}
                />

                <div style={{ display: "grid", gap: 8 }}>
                  {computed.recentActivity.length === 0 ? (
                    <EmptyState
                      title="No recent activity"
                      detail="Once income or spending is logged, this panel will fill in."
                      linkHref="/spending"
                      linkLabel="Open Spending"
                    />
                  ) : (
                    computed.recentActivity.map((item) => (
                      <ListRow
                        key={item.id}
                        title={item.title}
                        subtitle={item.subtitle}
                        value={item.value}
                        tone={item.tone}
                        initials={item.initials}
                      />
                    ))
                  )}
                </div>
              </GlassPane>
            </div>
          </section>

          <section className="lccDashLower">
            <GlassPane size="card" style={{ height: "100%" }}>
              <PaneHeader
                title="Top Accounts"
                subcopy="Largest visible balances on the board right now."
                right={<MiniPill>{computed.topAccounts.length} shown</MiniPill>}
              />

              <div style={{ display: "grid", gap: 8 }}>
                {computed.topAccounts.length === 0 ? (
                  <EmptyState
                    title="No accounts yet"
                    detail="Add your accounts so this panel starts showing real balance leaders."
                    linkHref="/accounts"
                    linkLabel="Add accounts"
                  />
                ) : (
                  computed.topAccounts.map((item) => (
                    <ListRow
                      key={item.id}
                      title={item.title}
                      subtitle={item.subtitle}
                      value={item.value}
                      tone={item.tone}
                      initials={item.initials}
                    />
                  ))
                )}
              </div>
            </GlassPane>

            <GlassPane size="card" style={{ height: "100%" }}>
              <PaneHeader
                title="Upcoming Bills"
                subcopy="What is due soon or already late."
                right={<MiniPill tone="amber">{money(computed.dueSoonTotal)}</MiniPill>}
              />

              <div style={{ display: "grid", gap: 8 }}>
                {computed.upcomingBills.length === 0 ? (
                  <EmptyState
                    title="No bills due soon"
                    detail="Nothing in the next 7 days is currently landing on this panel."
                    linkHref="/bills"
                    linkLabel="Open Bills"
                  />
                ) : (
                  computed.upcomingBills.map((item) => (
                    <ListRow
                      key={item.id}
                      title={item.title}
                      subtitle={item.subtitle}
                      value={item.value}
                      tone={item.tone}
                      initials={item.initials}
                    />
                  ))
                )}
              </div>
            </GlassPane>

            <GlassPane size="card" style={{ height: "100%" }}>
              <PaneHeader
                title="Quick Links"
                subcopy="Fast routes into the pages that move the numbers."
                right={
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Sparkles size={14} color="rgba(255,255,255,0.68)" />
                    <span style={{ ...eyebrowStyle(), color: "rgba(255,255,255,0.5)" }}>
                      Workflow
                    </span>
                  </div>
                }
              />

              <div
                style={{
                  display: "grid",
                  gap: 8,
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                }}
              >
                <ActionLink href="/accounts" full>
                  Accounts <ArrowRight size={14} />
                </ActionLink>
                <ActionLink href="/bills" full>
                  Bills <ArrowRight size={14} />
                </ActionLink>
                <ActionLink href="/income" full>
                  Income <ArrowRight size={14} />
                </ActionLink>
                <ActionLink href="/spending" full>
                  Spending <ArrowRight size={14} />
                </ActionLink>
                <ActionLink href="/investments" full>
                  Investments <ArrowRight size={14} />
                </ActionLink>
                <ActionLink href="/savings" full>
                  Savings <ArrowRight size={14} />
                </ActionLink>
              </div>

              <div
                style={{
                  marginTop: 12,
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 8,
                }}
              >
                <GlassPane size="compact">
                  <div style={eyebrowStyle()}>Liquid Cash</div>
                  <div
                    style={{
                      marginTop: 7,
                      fontSize: 20,
                      fontWeight: 850,
                      color: "#fff",
                    }}
                  >
                    {money(computed.liquidTotal)}
                  </div>
                </GlassPane>

                <GlassPane tone={computed.creditDebt > 0 ? "red" : "green"} size="compact">
                  <div style={eyebrowStyle()}>Credit Debt</div>
                  <div
                    style={{
                      marginTop: 7,
                      fontSize: 20,
                      fontWeight: 850,
                      color: "#fff",
                    }}
                  >
                    {money(computed.creditDebt)}
                  </div>
                </GlassPane>
              </div>
            </GlassPane>
          </section>
        </div>
      </main>

      <style jsx global>{`
        .lccDashRoot {
          position: relative;
          z-index: 1;
          padding: 18px 0 28px;
          font-family: ${DASH_FONT_STACK};
        }

        .lccDashInner {
          width: min(100%, 1320px);
          margin: 0 auto;
          display: grid;
          gap: 14px;
        }

        .lccDashHeroGrid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 14px;
        }

        .lccDashMetrics {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          align-items: stretch;
        }

        .lccDashMain {
          display: grid;
          grid-template-columns: minmax(0, 1.38fr) minmax(360px, 0.88fr);
          gap: 14px;
          align-items: stretch;
        }

        .lccDashLeftCol,
        .lccDashRightCol {
          display: grid;
          gap: 14px;
          min-width: 0;
        }

        .lccDashLower {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          align-items: stretch;
        }

        .lccDashChartSummaryGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }

        @media (max-width: 1260px) {
          .lccDashMetrics {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .lccDashMain {
            grid-template-columns: 1fr;
          }

          .lccDashLower {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 860px) {
          .lccDashRoot {
            padding: 10px 0 22px;
          }

          .lccDashInner {
            gap: 12px;
          }

          .lccDashHeroGrid {
            grid-template-columns: 1fr;
          }

          .lccDashMetrics {
            grid-template-columns: 1fr;
            gap: 10px;
          }

          .lccDashLower {
            grid-template-columns: 1fr;
          }

          .lccDashChartSummaryGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 560px) {
          .lccDashInner {
            gap: 10px;
          }

          .lccDashChartSummaryGrid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}
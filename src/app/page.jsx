"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronRight,
  CreditCard,
  Landmark,
  PiggyBank,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
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

function startOfMonthISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function endOfMonthISO(d = new Date()) {
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return isoDate(end);
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

function fmtDateTime(iso) {
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
      border: "rgba(143, 240, 191, 0.16)",
      glow: "rgba(110, 229, 173, 0.10)",
      dot: "#8ef4bb",
      iconBg: "rgba(12, 22, 17, 0.72)",
    };
  }

  if (tone === "amber") {
    return {
      text: "#f5cf88",
      border: "rgba(255, 204, 112, 0.16)",
      glow: "rgba(255, 194, 92, 0.10)",
      dot: "#ffd089",
      iconBg: "rgba(24, 18, 11, 0.72)",
    };
  }

  if (tone === "red") {
    return {
      text: "#ffb4c5",
      border: "rgba(255, 132, 163, 0.16)",
      glow: "rgba(255, 108, 145, 0.10)",
      dot: "#ff96ae",
      iconBg: "rgba(24, 11, 15, 0.72)",
    };
  }

  return {
    text: "#f7fbff",
    border: "rgba(214, 226, 255, 0.13)",
    glow: "rgba(140, 170, 255, 0.08)",
    dot: "#f7fbff",
    iconBg: "rgba(12, 16, 24, 0.72)",
  };
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
  return parts
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function severityRank(severity) {
  if (severity === "critical") return 0;
  if (severity === "warning") return 1;
  return 2;
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

  incomeDeposits.forEach((row) => addDelta(row.date, row.amount));

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

  const last = rawPoints[rawPoints.length - 1];
  if (!last || last.iso !== today) {
    rawPoints.push({
      iso: today,
      label: fmtShort(today),
      value: running,
    });
  }

  return samplePoints(rawPoints, 6);
}

function buildPositionMap(assets, txns, quoteMap) {
  const byAsset = new Map();

  assets.forEach((asset) => {
    byAsset.set(asset.id, {
      asset,
      shares: 0,
      basis: 0,
      currentValue: null,
      unrealizedPnl: null,
    });
  });

  const ordered = [...txns].sort((a, b) =>
    String(a.date).localeCompare(String(b.date))
  );

  ordered.forEach((tx) => {
    const entry = byAsset.get(tx.assetId);
    if (!entry) return;

    const qty = safeNum(tx.qty, 0);
    const price = safeNum(tx.price, 0);
    if (qty <= 0) return;

    if (tx.type === "BUY") {
      entry.shares += qty;
      entry.basis += qty * price;
      return;
    }

    if (tx.type === "SELL" && entry.shares > 0) {
      const sellQty = Math.min(qty, entry.shares);
      const avgCost = entry.shares > 0 ? entry.basis / entry.shares : 0;
      entry.shares -= sellQty;
      entry.basis -= avgCost * sellQty;

      if (entry.shares <= 0.000001) {
        entry.shares = 0;
        entry.basis = 0;
      }
    }
  });

  byAsset.forEach((entry) => {
    const symbol = String(entry.asset.symbol || "").toUpperCase();
    const live = safeNum(quoteMap[symbol], NaN);

    if (Number.isFinite(live) && entry.shares > 0) {
      entry.currentValue = entry.shares * live;
      entry.unrealizedPnl = entry.currentValue - entry.basis;
    }
  });

  return byAsset;
}

async function fetchQuoteMap(symbols) {
  const unique = [
    ...new Set(
      symbols
        .map((s) => String(s || "").trim().toUpperCase())
        .filter(Boolean)
    ),
  ];
  if (!unique.length) return {};

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
        minHeight: 30,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "0 10px",
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
          minHeight: 118,
          height: "100%",
          display: "grid",
          gridTemplateRows: "auto auto auto 1fr",
          gap: 7,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
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
              background: meta.iconBg,
              color: tone === "neutral" ? "#fff" : meta.text,
              boxShadow: `0 0 10px ${meta.glow}`,
              flexShrink: 0,
            }}
          >
            <Icon size={15} />
          </div>

          <StatusDot tone={tone} size={7} />
        </div>

        <div style={{ minWidth: 0 }}>
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
              <div
                style={{
                  minHeight: 20,
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "0 7px",
                  borderRadius: 999,
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                  border: `1px solid ${meta.border}`,
                  color: tone === "neutral" ? "rgba(255,255,255,0.82)" : meta.text,
                  background: "rgba(255,255,255,0.03)",
                  lineHeight: 1.15,
                }}
              >
                {badge}
              </div>
            </div>
          ) : null}
        </div>

        <div
          style={{
            fontSize: "clamp(18px, 2.3vw, 28px)",
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
            fontSize: 11.5,
            lineHeight: 1.4,
            color: "rgba(255,255,255,0.60)",
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
          <div
            style={{
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: ".22em",
              fontWeight: 800,
              color: "rgba(255,255,255,0.42)",
            }}
          >
            Life Command Center
          </div>

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
                fontSize: 13,
                lineHeight: 1.5,
                color: "rgba(255,255,255,0.62)",
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
              minHeight: 30,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "0 10px",
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
        minHeight: 130,
        display: "grid",
        placeItems: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 360 }}>
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
          <div
            style={{
              marginTop: 14,
              display: "flex",
              justifyContent: "center",
            }}
          >
            <ActionLink href={linkHref}>
              {linkLabel} <ArrowRight size={14} />
            </ActionLink>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ListRow({
  title,
  subtitle,
  value,
  tone = "neutral",
  initials = "—",
}) {
  const meta = toneMeta(tone);

  return (
    <div
      style={{
        minHeight: 60,
        display: "grid",
        gridTemplateColumns: "42px minmax(0, 1fr) auto",
        gap: 10,
        alignItems: "center",
        padding: "10px 12px",
        borderRadius: 16,
        border: `1px solid ${meta.border}`,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.028), rgba(255,255,255,0.01))",
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.03), 0 0 10px ${meta.glow}`,
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 13,
          display: "grid",
          placeItems: "center",
          border: `1px solid ${meta.border}`,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
          color: tone === "neutral" ? "#fff" : meta.text,
          fontWeight: 800,
          fontSize: 12,
          letterSpacing: ".05em",
        }}
      >
        {initials}
      </div>

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: "#fff",
            lineHeight: 1.2,
            overflowWrap: "anywhere",
          }}
        >
          {title}
        </div>

        <div
          style={{
            marginTop: 2,
            fontSize: 11.5,
            color: "rgba(255,255,255,0.56)",
            lineHeight: 1.3,
            overflowWrap: "anywhere",
          }}
        >
          {subtitle}
        </div>
      </div>

      <div
        style={{
          fontSize: 13,
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

function ChartSummaryTile({ label, value, tone = "neutral" }) {
  const meta = toneMeta(tone);

  return (
    <div
      style={{
        minHeight: 68,
        borderRadius: 15,
        border: `1px solid ${meta.border}`,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.028), rgba(255,255,255,0.01))",
        padding: 11,
      }}
    >
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
          marginTop: 6,
          fontSize: 16,
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
  const height = 236;
  const padLeft = 14;
  const padRight = 14;
  const padTop = 14;
  const padBottom = 32;

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
      height -
      padBottom -
      ((safeNum(point.value, 0) - minVal) / range) * innerH;
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
      />

      <div className="lccDashChartSummaryGrid" style={{ marginBottom: 10 }}>
        <ChartSummaryTile label="Movement" value={chartValue} tone={chartTone} />
        <ChartSummaryTile label="Income" value={money(monthIncome)} tone="green" />
        <ChartSummaryTile
          label="Spending"
          value={money(monthSpending)}
          tone="neutral"
        />
        <ChartSummaryTile
          label="Bill Pressure"
          value={money(monthPressure)}
          tone="amber"
        />
      </div>

      <div
        style={{
          position: "relative",
          minHeight: "clamp(180px, 22vw, 236px)",
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

            <linearGradient id={`lcc-chart-line-${chartId}`} x1="0" x2="1" y1="0" y2="0">
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
                stroke="rgba(255,255,255,0.02)"
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
              stroke="rgba(255,255,255,0.009)"
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
                r="5"
                fill="rgba(8,10,14,0.9)"
                stroke="rgba(245,248,255,0.92)"
                strokeWidth="2"
              />
              <circle cx={p.x} cy={p.y} r="1.7" fill="rgba(255,255,255,0.98)" />
            </g>
          ))}

          {coords.map((p) => (
            <text
              key={`${p.iso}-label`}
              x={p.x}
              y={height - 8}
              fill="rgba(255,255,255,0.40)"
              fontSize="10"
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
              right: 10,
              top: 12,
              minHeight: 30,
              padding: "7px 10px",
              borderRadius: 13,
              border: `1px solid ${bubbleTone.border}`,
              background: "rgba(6,10,16,0.76)",
              color: bubbleTone.text,
              fontSize: 11.5,
              fontWeight: 800,
              boxShadow: `0 0 16px ${bubbleTone.glow}`,
            }}
          >
            {signedMoney(lastPoint.value)}
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
  const label =
    severity === "critical"
      ? "Critical"
      : severity === "warning"
      ? "Watch"
      : "Stable";

  return <MiniPill tone={tone}>{label}</MiniPill>;
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
        minHeight: 56,
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
            fontSize: 11.5,
            color: "rgba(255,255,255,0.58)",
            lineHeight: 1.3,
            overflowWrap: "anywhere",
          }}
        >
          {item.detail}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          justifyContent: "flex-end",
        }}
      >
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
  if (!open) return null;

  return (
    <div className="lccSignalModalRoot">
      <div className="lccSignalBackdrop" onClick={onClose} />
      <div className="lccSignalModalCard">
        <GlassPane tone={signalTone} size="card">
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: ".22em",
                  fontWeight: 800,
                  color: "rgba(255,255,255,0.42)",
                }}
              >
                Signal Center
              </div>

              <div
                style={{
                  marginTop: 8,
                  fontSize: "clamp(24px, 3vw, 30px)",
                  lineHeight: 1.02,
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
                  lineHeight: 1.55,
                  color: "rgba(255,255,255,0.66)",
                  maxWidth: 720,
                }}
              >
                Quick read on what needs attention right now.
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close signal center"
              style={{
                width: 40,
                height: 40,
                borderRadius: 14,
                border: "1px solid rgba(214,226,255,0.10)",
                background: "rgba(255,255,255,0.03)",
                color: "#fff",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <X size={16} />
            </button>
          </div>

          <div className="lccSignalSummaryGrid" style={{ marginTop: 14 }}>
            <ChartSummaryTile
              label="Cash Position"
              value={money(cashPosition)}
              tone={cashPosition < 0 ? "red" : "neutral"}
            />
            <ChartSummaryTile
              label="Month Movement"
              value={signedMoney(cashMovement)}
              tone={toneByValue(cashMovement)}
            />
            <ChartSummaryTile
              label="Due Soon"
              value={money(dueSoonTotal)}
              tone={dueSoonTotal > 0 ? "amber" : "green"}
            />
          </div>
        </GlassPane>

        <div style={{ height: 14 }} />

        <GlassPane size="card">
          <PaneHeader
            title="Active signals"
            subcopy={`${signalItems.length} items on the board right now.`}
          />

          {signalItems.length ? (
            <div className="lccDashStack">
              {signalItems.map((item) => (
                <SignalPreviewRow key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No active signals"
              detail="Nothing is pressing right now. That is the goal."
            />
          )}
        </GlassPane>
      </div>
    </div>
  );
}

function recentActivityLabel(count) {
  if (!count) return "No movement";
  if (count === 1) return "1 item";
  return `${count} items`;
}

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

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
      setLoading(true);
      setPageError("");

      try {
        if (!supabase) {
          throw new Error("Missing Supabase environment variables.");
        }

        const {
          data: { user: currentUser },
          error: userErr,
        } = await supabase.auth.getUser();

        if (userErr) throw userErr;

        if (!currentUser) {
          if (!mounted) return;
          setUser(null);
          setLoading(false);
          return;
        }

        if (!mounted) return;
        setUser(currentUser);

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
            .order("due_date", { ascending: true }),

          supabase
            .from("spending_transactions")
            .select("*")
            .eq("user_id", currentUser.id)
            .gte("tx_date", monthStart)
            .lte("tx_date", monthEnd)
            .order("tx_date", { ascending: false }),

          supabase
            .from("income_deposits")
            .select("*")
            .eq("user_id", currentUser.id)
            .gte("deposit_date", monthStart)
            .lte("deposit_date", monthEnd)
            .order("deposit_date", { ascending: false }),

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
        const loadedAssets = (assetRes.data || []).map(mapInvestmentAssetRow);
        const loadedTxns = (txnRes.data || []).map(mapInvestmentTxnRow);

        const nextPrimary =
          settingsRes.data?.primary_account_id &&
          loadedAccounts.some((a) => a.id === settingsRes.data.primary_account_id)
            ? settingsRes.data.primary_account_id
            : loadedAccounts[0]?.id || "";

        const symbols = loadedAssets.map((a) => a.symbol).filter(Boolean);
        const nextQuotes = await fetchQuoteMap(symbols);

        if (!mounted) return;

        setAccounts(loadedAccounts);
        setPrimaryId(nextPrimary);
        setBills(loadedBills);
        setSpendingTx(loadedSpending);
        setIncomeDeposits(loadedIncome);
        setInvestmentAssets(loadedAssets);
        setInvestmentTxns(loadedTxns);
        setQuoteMap(nextQuotes);
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

    const cashPositionAccounts = accounts.filter((a) => {
      const type = String(a.type || "").toLowerCase();
      return type !== "credit" && type !== "investment";
    });

    const creditAccounts = accounts.filter(
      (a) => String(a.type || "").toLowerCase() === "credit"
    );

    const monthlyIncome =
      incomeDeposits.reduce((sum, row) => sum + safeNum(row.amount, 0), 0) +
      spendingTx
        .filter((row) => String(row.type || "").toLowerCase() === "income")
        .reduce((sum, row) => sum + safeNum(row.amount, 0), 0);

    const monthlySpending = spendingTx
      .filter((row) => String(row.type || "").toLowerCase() !== "income")
      .reduce((sum, row) => sum + safeNum(row.amount, 0), 0);

    const monthlyBillPressure = bills
      .filter((b) => b.active !== false)
      .reduce(
        (sum, b) => sum + safeNum(b.amount, 0) * freqToMonthlyMult(b.frequency),
        0
      );

    const accountBalancesExInvestments = cashPositionAccounts.reduce(
      (sum, a) => sum + safeNum(a.balance, 0),
      0
    );

    const creditDebt = creditAccounts.reduce(
      (sum, a) => sum + safeNum(a.balance, 0),
      0
    );

    const positionMap = buildPositionMap(
      investmentAssets,
      investmentTxns,
      quoteMap
    );

    const positions = [...positionMap.values()].filter((entry) => entry.shares > 0);
    const holdingCount = positions.length;
    const pricedHoldingCount = positions.filter(
      (entry) => entry.currentValue != null
    ).length;

    const portfolioMarketValue = positions.reduce(
      (sum, entry) => sum + safeNum(entry.currentValue, 0),
      0
    );

    const portfolioCostBasis = positions.reduce(
      (sum, entry) => sum + safeNum(entry.basis, 0),
      0
    );

    const portfolioPnL = positions.reduce(
      (sum, entry) => sum + safeNum(entry.unrealizedPnl, 0),
      0
    );

    const investmentTotal = pricedHoldingCount
      ? portfolioMarketValue
      : portfolioCostBasis;

    const netWorth = accountBalancesExInvestments + investmentTotal - creditDebt;

    const upcomingBills = bills
      .filter((b) => b.active !== false && b.dueDate)
      .map((bill) => {
        const days = daysUntil(bill.dueDate);
        return {
          ...bill,
          days,
        };
      })
      .filter((bill) => bill.days == null || bill.days <= 21)
      .sort((a, b) => {
        const ad = a.days == null ? 9999 : a.days;
        const bd = b.days == null ? 9999 : b.days;
        return ad - bd;
      })
      .slice(0, 4);

    const dueSoonTotal = upcomingBills
      .filter((bill) => bill.days != null && bill.days >= 0 && bill.days <= 14)
      .reduce((sum, bill) => sum + safeNum(bill.amount, 0), 0);

    const recentActivity = [
      ...incomeDeposits.map((row) => ({
        id: `income-${row.id}`,
        title: row.source || "Income",
        subtitle: `${fmtDateTime(row.date)} • deposit`,
        value: signedMoney(row.amount),
        tone: "green",
        initials: initialsFromLabel(row.source || "Income"),
        sortDate: row.date || "",
      })),
      ...spendingTx
        .filter((row) => String(row.type || "").toLowerCase() !== "income")
        .map((row) => ({
          id: `spending-${row.id}`,
          title: row.merchant || "Expense",
          subtitle: `${fmtDateTime(row.date)} • ${row.note || "spending"}`,
          value: signedMoney(-safeNum(row.amount, 0)),
          tone: "red",
          initials: initialsFromLabel(row.merchant || "Expense"),
          sortDate: row.date || "",
        })),
    ]
      .sort((a, b) => String(b.sortDate).localeCompare(String(a.sortDate)))
      .slice(0, 4);

    const topAccounts = [...cashPositionAccounts]
      .sort(
        (a, b) => Math.abs(safeNum(b.balance, 0)) - Math.abs(safeNum(a.balance, 0))
      )
      .slice(0, 4)
      .map((a) => ({
        id: a.id,
        title: a.name || "Account",
        subtitle: String(a.type || "other").replace(/_/g, " "),
        value: money(a.balance),
        tone: safeNum(a.balance, 0) < 0 ? "red" : "neutral",
        initials: initialsFromLabel(a.name || "A"),
      }));

    const cashMovement = monthlyIncome - monthlySpending;
    const chartPoints = buildCashMovementPoints(
      monthStart,
      today,
      spendingTx,
      incomeDeposits
    );

    const signalItems = [];

    if (!accounts.length) {
      signalItems.push({
        id: "no-accounts",
        severity: "critical",
        title: "No real accounts added",
        detail:
          "Add your actual money buckets first so the dashboard stops being fake.",
        amount: "",
      });
    }

    const overdueBills = upcomingBills.filter(
      (bill) => bill.days != null && bill.days < 0
    );
    const dueSoonBills = upcomingBills.filter(
      (bill) => bill.days != null && bill.days >= 0 && bill.days <= 7
    );

    overdueBills.forEach((bill) => {
      signalItems.push({
        id: `bill-overdue-${bill.id}`,
        severity: "critical",
        title: `${bill.name} is overdue`,
        detail: `${Math.abs(bill.days)} day${
          Math.abs(bill.days) === 1 ? "" : "s"
        } late.`,
        amount: money(bill.amount),
      });
    });

    dueSoonBills.slice(0, 3).forEach((bill) => {
      signalItems.push({
        id: `bill-due-${bill.id}`,
        severity: bill.days <= 2 ? "critical" : "warning",
        title: `${bill.name} due ${
          bill.days === 0 ? "today" : `in ${bill.days} day${bill.days === 1 ? "" : "s"}`
        }`,
        detail: "This one is close enough that it should already be on your radar.",
        amount: money(bill.amount),
      });
    });

    if (accountBalancesExInvestments < 0) {
      signalItems.push({
        id: "cash-negative",
        severity: "critical",
        title: "Cash position is negative",
        detail: "Your non-investment balances are underwater right now.",
        amount: money(accountBalancesExInvestments),
      });
    } else if (
      accountBalancesExInvestments > 0 &&
      accountBalancesExInvestments < 500
    ) {
      signalItems.push({
        id: "cash-low",
        severity: "warning",
        title: "Cash position is thin",
        detail: "You do not have much room if something hits this week.",
        amount: money(accountBalancesExInvestments),
      });
    }

    if (monthlyIncome > 0 && monthlySpending > monthlyIncome) {
      signalItems.push({
        id: "cash-burn",
        severity: "warning",
        title: "Spending is outrunning income",
        detail:
          "This month is currently burning more cash than it is bringing in.",
        amount: signedMoney(cashMovement),
      });
    }

    if (creditDebt > 0) {
      signalItems.push({
        id: "credit-debt",
        severity: creditDebt >= 3000 ? "critical" : "warning",
        title: "Credit debt is still sitting there",
        detail: "This is pressure, not background noise.",
        amount: money(creditDebt),
      });
    }

    if (holdingCount > 0 && pricedHoldingCount < holdingCount) {
      signalItems.push({
        id: "unpriced-holdings",
        severity: "warning",
        title: "Some holdings are not live priced",
        detail:
          "Part of the portfolio view is still relying on stored values instead of live quotes.",
        amount: `${pricedHoldingCount}/${holdingCount} live`,
      });
    }

    signalItems.sort(
      (a, b) => severityRank(a.severity) - severityRank(b.severity)
    );

    const signalCount = signalItems.length;
    const signalTone =
      signalItems[0]?.severity === "critical"
        ? "red"
        : signalItems[0]?.severity === "warning"
        ? "amber"
        : "green";

    const signalLabel =
      signalCount === 0
        ? "Stable"
        : signalItems[0]?.severity === "critical"
        ? "Critical"
        : "Watch";

    const focus =
      signalCount > 0
        ? signalItems[0].title
        : accountBalancesExInvestments > 0
        ? "Cash position is holding. Keep the board clean and stay ahead of due dates."
        : "Get the base accounts in so the dashboard can show real numbers.";

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
      chartTone:
        cashMovement < 0 ? "red" : cashMovement > 0 ? "green" : "neutral",
      dueSoonTotal,
      cashMovement,
      monthlyIncome,
      monthlySpending,
      monthlyBillPressure,
      investmentTotal,
      creditDebt,
      liquidTotal: liquidAccounts.reduce(
        (sum, a) => sum + safeNum(a.balance, 0),
        0
      ),
      portfolioPnLText: signedMoney(portfolioPnL),
      portfolioTone: toneByValue(portfolioPnL),
      portfolioDetail:
        holdingCount > 0
          ? `${pricedHoldingCount}/${holdingCount} live priced • basis ${money(
              portfolioCostBasis
            )}`
          : "No live positions yet.",
      portfolioBadge:
        holdingCount > 0
          ? `${holdingCount} holding${holdingCount === 1 ? "" : "s"}`
          : "",
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
      <main className="lccDashRoot">
        <div className="lccDashInner">
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
      <main className="lccDashRoot">
        <div className="lccDashInner">
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
            <div style={{ marginTop: 14 }}>
              <ActionLink href="/login">
                Go to login <ArrowRight size={14} />
              </ActionLink>
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
            focusTitle={computed.focus}
            focusTone={computed.signalTone}
            accountCount={computed.accountCount}
            onOpenAlerts={() => setSignalsOpen(true)}
          />

          <section className="lccDashMetricGrid">
            <StatCard
              icon={Landmark}
              label="Net Worth"
              value={money(computed.netWorth)}
              detail="Non-investment balances plus portfolio value minus credit debt."
              tone={toneByValue(computed.netWorth)}
            />
            <StatCard
              icon={Wallet}
              label="Cash Position"
              value={money(computed.accountBalancesExInvestments)}
              detail="Total account balances minus investments and credit debt buckets."
              tone={
                computed.accountBalancesExInvestments < 500 ? "amber" : "neutral"
              }
            />
            <StatCard
              icon={PiggyBank}
              label="Bill Pressure"
              value={money(computed.monthlyBillPressure)}
              detail="Estimated monthly weight from your active recurring bills."
              tone={computed.monthlyBillPressure > 0 ? "amber" : "green"}
              badge={
                computed.dueSoonTotal > 0
                  ? `${money(computed.dueSoonTotal)} due soon`
                  : ""
              }
            />
            <StatCard
              icon={CreditCard}
              label="Credit Debt"
              value={money(computed.creditDebt)}
              detail="Outstanding balance sitting in credit accounts."
              tone={computed.creditDebt > 0 ? "red" : "green"}
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

          <GlassPane size="card">
            <PaneHeader
              title="Action Strip"
              subcopy="Go straight to the pages that usually need the next move."
              right={
                <MiniPill tone={computed.signalTone}>
                  {computed.signalCount} signals
                </MiniPill>
              }
            />

            <div className="lccDashActionGrid">
              <ActionLink href="/accounts" full>
                Open Accounts <ArrowRight size={14} />
              </ActionLink>
              <ActionLink href="/bills" full>
                Review Bills <ArrowRight size={14} />
              </ActionLink>
              <ActionLink href="/spending" full>
                Check Spending <ArrowRight size={14} />
              </ActionLink>
              <ActionLink href="/calendar" full>
                Open Calendar <ArrowRight size={14} />
              </ActionLink>
            </div>
          </GlassPane>

          <section className="lccDashMainGrid">
            <div className="lccDashStack">
              <CashMovementCard
                points={computed.chartPoints}
                chartValue={computed.chartValue}
                chartTone={computed.chartTone}
                monthIncome={computed.monthlyIncome}
                monthSpending={computed.monthlySpending}
                monthPressure={computed.monthlyBillPressure}
              />

              <GlassPane size="card">
                <PaneHeader
                  title="Top Accounts"
                  subcopy="Highest-impact real-money buckets, not filler cards."
                  right={<MiniPill>{computed.topAccounts.length} shown</MiniPill>}
                />

                {computed.topAccounts.length ? (
                  <div className="lccDashStack">
                    {computed.topAccounts.map((item) => (
                      <ListRow
                        key={item.id}
                        title={item.title}
                        subtitle={item.subtitle}
                        value={item.value}
                        tone={item.tone}
                        initials={item.initials}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No accounts yet"
                    detail="Add your real checking, savings, cash, and debt buckets first."
                    linkHref="/accounts"
                    linkLabel="Add accounts"
                  />
                )}
              </GlassPane>
            </div>

            <div className="lccDashStack">
              <GlassPane tone={computed.signalTone} size="card">
                <PaneHeader
                  title="Signal Center"
                  subcopy="The pressure board for what needs attention first."
                  right={<MiniPill tone={computed.signalTone}>{computed.signalLabel}</MiniPill>}
                />

                <div className="lccDashStack">
                  {computed.signalItems.length ? (
                    computed.signalItems.slice(0, 4).map((item) => (
                      <SignalPreviewRow key={item.id} item={item} />
                    ))
                  ) : (
                    <EmptyState
                      title="Nothing urgent"
                      detail="This is exactly how the board should look when things are under control."
                    />
                  )}
                </div>

                <div style={{ height: 10 }} />

                <ActionButton onClick={() => setSignalsOpen(true)} full>
                  Open full signal center <ChevronRight size={14} />
                </ActionButton>
              </GlassPane>

              <GlassPane size="card">
                <PaneHeader
                  title="Upcoming Bills"
                  subcopy="Bills close enough to matter this month."
                  right={
                    <MiniPill tone={computed.dueSoonTotal > 0 ? "amber" : "green"}>
                      {money(computed.dueSoonTotal)} due soon
                    </MiniPill>
                  }
                />

                {computed.upcomingBills.length ? (
                  <div className="lccDashStack">
                    {computed.upcomingBills.map((bill) => (
                      <ListRow
                        key={bill.id}
                        title={bill.name}
                        subtitle={
                          bill.days == null
                            ? "No due date"
                            : bill.days < 0
                            ? `${Math.abs(bill.days)} day${
                                Math.abs(bill.days) === 1 ? "" : "s"
                              } overdue`
                            : bill.days === 0
                            ? "Due today"
                            : `Due in ${bill.days} day${bill.days === 1 ? "" : "s"}`
                        }
                        value={money(bill.amount)}
                        tone={
                          bill.days != null && bill.days < 0
                            ? "red"
                            : bill.days != null && bill.days <= 7
                            ? "amber"
                            : "neutral"
                        }
                        initials={initialsFromLabel(bill.name)}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No upcoming bills"
                    detail="Nothing in the next couple weeks is showing pressure right now."
                  />
                )}
              </GlassPane>
            </div>
          </section>

          <section className="lccDashBottomGrid">
            <GlassPane size="card">
              <PaneHeader
                title="Recent Activity"
                subcopy="Latest logged movement across income and spending."
                right={<MiniPill>{recentActivityLabel(computed.recentActivity.length)}</MiniPill>}
              />

              {computed.recentActivity.length ? (
                <div className="lccDashStack">
                  {computed.recentActivity.map((item) => (
                    <ListRow
                      key={item.id}
                      title={item.title}
                      subtitle={item.subtitle}
                      value={item.value}
                      tone={item.tone}
                      initials={item.initials}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No recent activity"
                  detail="Once you log income or spending this month, it will show up here."
                />
              )}
            </GlassPane>

            <GlassPane size="card">
              <PaneHeader
                title="Portfolio Snapshot"
                subcopy="What the investment side is doing without overpowering the dashboard."
                right={
                  <MiniPill tone={computed.portfolioTone}>
                    {computed.portfolioBadge || "No holdings"}
                  </MiniPill>
                }
              />

              <div className="lccDashChartSummaryGrid">
                <ChartSummaryTile
                  label="Market Value"
                  value={money(computed.portfolioMarketValue)}
                  tone="neutral"
                />
                <ChartSummaryTile
                  label="Cost Basis"
                  value={money(computed.portfolioCostBasis)}
                  tone="neutral"
                />
                <ChartSummaryTile
                  label="Unrealized P/L"
                  value={computed.portfolioPnLText}
                  tone={computed.portfolioTone}
                />
                <ChartSummaryTile
                  label="Liquid Cash"
                  value={money(computed.liquidTotal)}
                  tone="green"
                />
              </div>

              <div style={{ height: 10 }} />

              <div className="lccDashActionGrid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                <ActionLink href="/investments" full>
                  Open Investments <ArrowRight size={14} />
                </ActionLink>
                <ActionLink href="/market/SPY" full>
                  Open Market <ArrowRight size={14} />
                </ActionLink>
              </div>
            </GlassPane>
          </section>
        </div>
      </main>

      <style jsx global>{`
        .lccDashRoot {
          padding: 12px 0 20px;
          font-family: var(--lcc-font-sans);
        }

        .lccDashInner {
          width: min(100%, 1320px);
          margin: 0 auto;
          display: grid;
          gap: 12px;
        }

        .lccDashStack {
          display: grid;
          gap: 10px;
        }

        .lccDashHeroGrid {
          display: grid;
          grid-template-columns: minmax(0, 1.1fr) auto;
          gap: 12px;
        }

        .lccDashMetricGrid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 12px;
        }

        .lccDashActionGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }

        .lccDashMainGrid {
          display: grid;
          grid-template-columns: minmax(0, 1.24fr) minmax(300px, 0.8fr);
          gap: 12px;
          align-items: start;
        }

        .lccDashBottomGrid {
          display: grid;
          grid-template-columns: minmax(0, 1.08fr) minmax(320px, 0.92fr);
          gap: 12px;
          align-items: start;
        }

        .lccDashChartSummaryGrid,
        .lccSignalSummaryGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }

        .lccSignalModalRoot {
          position: fixed;
          inset: 0;
          z-index: 90;
          display: grid;
          place-items: center;
          padding: 18px;
        }

        .lccSignalBackdrop {
          position: absolute;
          inset: 0;
          background: rgba(2, 5, 10, 0.68);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }

        .lccSignalModalCard {
          position: relative;
          z-index: 1;
          width: min(100%, 980px);
          max-height: min(88vh, 920px);
          overflow: auto;
        }

        @media (max-width: 1260px) {
          .lccDashMetricGrid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .lccDashActionGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 1024px) {
          .lccDashHeroGrid,
          .lccDashMainGrid,
          .lccDashBottomGrid {
            grid-template-columns: 1fr;
          }

          .lccDashMetricGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .lccDashChartSummaryGrid,
          .lccSignalSummaryGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .lccDashRoot {
            padding: 8px 0 14px;
          }

          .lccDashMetricGrid,
          .lccDashActionGrid,
          .lccDashChartSummaryGrid,
          .lccSignalSummaryGrid {
            grid-template-columns: 1fr;
          }

          .lccSignalModalRoot {
            padding: 10px;
          }
        }
      `}</style>
    </>
  );
}
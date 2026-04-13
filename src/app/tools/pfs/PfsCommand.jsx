"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  FileLock2,
  FileText,
  Plus,
  Trash2,
} from "lucide-react";
import GlassPane from "@/app/components/GlassPane";
import {
  calculatePfsTotals,
  createLineItem,
  formatCurrency,
} from "@/lib/pfsMath";

function SectionEditor({ title, rows, onAdd, onChange, onRemove }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(255,255,255,0.018)",
        display: "grid",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em" }}>{title}</div>
        <button
          type="button"
          onClick={onAdd}
          style={{
            minHeight: 36,
            padding: "0 12px",
            borderRadius: 12,
            border: "1px solid rgba(122,166,247,0.22)",
            background: "rgba(122,166,247,0.12)",
            color: "rgba(240,245,255,0.96)",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          <Plus size={14} />
          Add row
        </button>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {rows.map((row, index) => (
          <div
            key={row.id}
            style={{
              display: "grid",
              gap: 8,
              gridTemplateColumns: "minmax(0, 1fr) minmax(120px, 180px) 40px",
            }}
          >
            <input
              value={row.label}
              onChange={(e) => onChange(row.id, "label", e.target.value)}
              placeholder={`${title} item ${index + 1}`}
              style={{
                minHeight: 42,
                borderRadius: 13,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
                color: "#fff",
                padding: "0 12px",
                outline: "none",
              }}
            />
            <input
              value={row.amount}
              onChange={(e) => onChange(row.id, "amount", e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
              style={{
                minHeight: 42,
                borderRadius: 13,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
                color: "#fff",
                padding: "0 12px",
                outline: "none",
              }}
            />
            <button
              type="button"
              onClick={() => onRemove(row.id)}
              aria-label={`Remove ${title} row ${index + 1}`}
              style={{
                minHeight: 42,
                borderRadius: 13,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
                color: "rgba(255,182,196,0.96)",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone = "rgba(245,248,252,0.98)", sub }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(255,255,255,0.018)",
        display: "grid",
        gap: 8,
      }}
    >
      <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.34)" }}>
        {label}
      </div>
      <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: "-0.04em", color: tone }}>{value}</div>
      <div style={{ color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>{sub}</div>
    </div>
  );
}

function StatementBlock({ title, items }) {
  const total = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  return (
    <div
      style={{
        padding: 14,
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(255,255,255,0.018)",
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 900, color: "#fff" }}>{title}</div>
        <div style={{ color: "rgba(255,255,255,0.72)", fontWeight: 800 }}>{formatCurrency(total)}</div>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {items.map((item) => (
          <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, color: "rgba(232,237,245,0.88)" }}>
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.label || "Unnamed item"}
            </span>
            <span style={{ flex: "0 0 auto", fontVariantNumeric: "tabular-nums" }}>{formatCurrency(item.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PfsCommand() {
  const [state, setState] = useState({
    assets: [createLineItem("Checking", "12500"), createLineItem("Vehicle", "22000")],
    liabilities: [createLineItem("Mortgage balance", "332000"), createLineItem("Credit card", "2400")],
    income: [createLineItem("Primary income", "6800")],
    expenses: [createLineItem("Mortgage payment", "2800"), createLineItem("Utilities + living", "1650")],
  });

  const totals = useMemo(() => calculatePfsTotals(state), [state]);

  function updateSection(section, nextRows) {
    setState((prev) => ({ ...prev, [section]: nextRows }));
  }

  function addRow(section) {
    updateSection(section, [...state[section], createLineItem()]);
  }

  function changeRow(section, id, field, value) {
    updateSection(
      section,
      state[section].map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  }

  function removeRow(section, id) {
    const nextRows = state[section].filter((row) => row.id !== id);
    updateSection(section, nextRows.length ? nextRows : [createLineItem()]);
  }

  const netWorthTone = totals.netWorth >= 0 ? "#84e1b0" : "#ff8c9f";
  const cashFlowTone = totals.monthlyCashFlow >= 0 ? "#84e1b0" : "#ff8c9f";

  return (
    <main style={{ minHeight: "100%", display: "grid", gap: 14, alignContent: "start" }}>
      <GlassPane size="hero">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ display: "grid", gap: 12, maxWidth: 840 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.42)" }}>
                Tools / PFS
              </span>
              <span
                style={{
                  minHeight: 22,
                  padding: "0 9px",
                  borderRadius: 999,
                  border: "1px solid rgba(122,166,247,0.18)",
                  background: "rgba(122,166,247,0.12)",
                  color: "rgba(232,240,255,0.92)",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.04em",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <FileText size={12} />
                Statement builder base
              </span>
            </div>

            <div>
              <div style={{ fontSize: 38, fontWeight: 950, letterSpacing: "-0.05em", color: "#fff", lineHeight: 1.02 }}>
                PFS Statement Builder
              </div>
              <div style={{ marginTop: 12, color: "rgba(255,255,255,0.58)", lineHeight: 1.7, maxWidth: 760 }}>
                This page is built to feel more formal than a calculator. Enter assets, liabilities, monthly income, and monthly expenses. The live statement preview updates as you build.
              </div>
            </div>
          </div>

          <div
            style={{
              minWidth: 260,
              maxWidth: 360,
              padding: 14,
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(255,255,255,0.018)",
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.34)" }}>
              Live read
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em" }}>
              {totals.netWorth >= 0 ? "Positive net worth" : "Negative net worth"}
            </div>
            <div style={{ color: "rgba(255,255,255,0.54)", lineHeight: 1.6 }}>
              This is already structured for lender-style output. PDF export, saved statements, and branded versions can plug in later without remaking the page.
            </div>
          </div>
        </div>
      </GlassPane>

      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <GlassPane size="card">
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <div style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.34)" }}>
                Inputs
              </div>
              <div style={{ marginTop: 8, fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em" }}>
                Build the statement
              </div>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <SectionEditor
                title="Assets"
                rows={state.assets}
                onAdd={() => addRow("assets")}
                onChange={(id, field, value) => changeRow("assets", id, field, value)}
                onRemove={(id) => removeRow("assets", id)}
              />

              <SectionEditor
                title="Liabilities"
                rows={state.liabilities}
                onAdd={() => addRow("liabilities")}
                onChange={(id, field, value) => changeRow("liabilities", id, field, value)}
                onRemove={(id) => removeRow("liabilities", id)}
              />

              <SectionEditor
                title="Monthly Income"
                rows={state.income}
                onAdd={() => addRow("income")}
                onChange={(id, field, value) => changeRow("income", id, field, value)}
                onRemove={(id) => removeRow("income", id)}
              />

              <SectionEditor
                title="Monthly Expenses"
                rows={state.expenses}
                onAdd={() => addRow("expenses")}
                onChange={(id, field, value) => changeRow("expenses", id, field, value)}
                onRemove={(id) => removeRow("expenses", id)}
              />
            </div>
          </div>
        </GlassPane>

        <GlassPane size="card">
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <div style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.34)" }}>
                Statement preview
              </div>
              <div style={{ marginTop: 8, fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em" }}>
                Personal Financial Statement
              </div>
            </div>

            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <SummaryCard label="Total assets" value={formatCurrency(totals.totalAssets)} sub="Everything owned or controlled." />
              <SummaryCard label="Total liabilities" value={formatCurrency(totals.totalLiabilities)} sub="Everything still owed." />
              <SummaryCard label="Net worth" value={formatCurrency(totals.netWorth)} tone={netWorthTone} sub="Assets minus liabilities." />
              <SummaryCard label="Monthly cash flow" value={formatCurrency(totals.monthlyCashFlow)} tone={cashFlowTone} sub="Income minus expenses." />
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <StatementBlock title="Assets" items={state.assets} />
              <StatementBlock title="Liabilities" items={state.liabilities} />
              <StatementBlock title="Monthly Income" items={state.income} />
              <StatementBlock title="Monthly Expenses" items={state.expenses} />
            </div>
          </div>
        </GlassPane>

        <GlassPane size="card">
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <div style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.34)" }}>
                Premium export block
              </div>
              <div style={{ marginTop: 8, fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em" }}>
                Formal output path is already there
              </div>
            </div>

            <div
              style={{
                padding: 16,
                borderRadius: 18,
                border: "1px solid rgba(255,255,255,0.06)",
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0)), rgba(255,255,255,0.018)",
                display: "grid",
                gap: 12,
              }}
            >
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "rgba(245,248,252,0.94)", fontWeight: 800 }}>
                <FileLock2 size={16} />
                Locked report later
              </div>
              <div style={{ color: "rgba(255,255,255,0.56)", lineHeight: 1.65 }}>
                The next layer is simple: export PDF, save named statements, offer a lender-style version, and charge for the finished report without changing the structure again.
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {[
                  "Modern clean PDF export",
                  "Lender-style printable version",
                  "Saved statement history",
                  "Public one-time paid use",
                ].map((item) => (
                  <div
                    key={item}
                    style={{
                      minHeight: 42,
                      borderRadius: 14,
                      padding: "0 12px",
                      border: "1px solid rgba(255,255,255,0.06)",
                      background: "rgba(255,255,255,0.018)",
                      display: "flex",
                      alignItems: "center",
                      color: "rgba(228,236,245,0.9)",
                    }}
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <Link
              href="/tools"
              style={{
                minHeight: 42,
                padding: "0 14px",
                borderRadius: 14,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
                color: "rgba(240,245,255,0.96)",
                fontWeight: 800,
              }}
            >
              <span>Back to tools</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </GlassPane>
      </div>
    </main>
  );
}

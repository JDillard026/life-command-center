"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  Landmark,
  Lock,
  TimerReset,
} from "lucide-react";
import GlassPane from "@/app/components/GlassPane";
import { calculateRefinanceAnalysis } from "@/lib/refinanceMath";

function money(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function signedMoney(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  const abs = Math.abs(num).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (num > 0) return `+${abs}`;
  if (num < 0) return `-${abs}`;
  return abs;
}

function tone(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num === 0) return "rgba(233,238,246,0.94)";
  return num > 0 ? "#84e1b0" : "#ff8c9f";
}

function InputField({ label, type = "number", value, onChange, step = "0.01", min = "0" }) {
  return (
    <label style={{ display: "grid", gap: 8 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(230,236,245,0.84)" }}>{label}</span>
      <input
        type={type}
        value={value}
        step={step}
        min={min}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          minHeight: 44,
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.03)",
          color: "#fff",
          padding: "0 14px",
          outline: "none",
        }}
      />
    </label>
  );
}

function MetricCard({ label, value, sub, valueTone = "rgba(245,248,252,0.98)" }) {
  return (
    <div
      style={{
        minHeight: 108,
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
      <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.04em", color: valueTone }}>{value}</div>
      <div style={{ color: "rgba(255,255,255,0.52)", lineHeight: 1.5 }}>{sub}</div>
    </div>
  );
}

export default function RefinanceCommand() {
  const [currentBalance, setCurrentBalance] = useState("332000");
  const [currentRate, setCurrentRate] = useState("6.5");
  const [currentPayment, setCurrentPayment] = useState("2800");
  const [loanStartDate, setLoanStartDate] = useState("2025-06-15");
  const [newRate, setNewRate] = useState("5.75");
  const [newTermYears, setNewTermYears] = useState("30");
  const [closingCosts, setClosingCosts] = useState("8500");
  const [yearsStaying, setYearsStaying] = useState("6");

  const analysis = useMemo(
    () =>
      calculateRefinanceAnalysis({
        currentBalance,
        currentRate,
        currentPayment,
        loanStartDate,
        newRate,
        newTermYears,
        closingCosts,
        yearsStaying,
      }),
    [currentBalance, currentRate, currentPayment, loanStartDate, newRate, newTermYears, closingCosts, yearsStaying]
  );

  return (
    <main style={{ minHeight: "100%", display: "grid", gap: 14, alignContent: "start" }}>
      <GlassPane size="hero">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ display: "grid", gap: 12, maxWidth: 840 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.42)" }}>
                Tools / Refinance
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
                <Landmark size={12} />
                Analyzer base
              </span>
            </div>

            <div>
              <div style={{ fontSize: 38, fontWeight: 950, letterSpacing: "-0.05em", color: "#fff", lineHeight: 1.02 }}>
                Refinance Analyzer
              </div>
              <div style={{ marginTop: 12, color: "rgba(255,255,255,0.58)", lineHeight: 1.7, maxWidth: 760 }}>
                This page is built to make a hard call fast. Lower payment is not enough. The real question is whether the savings beat the closing costs and the reset risk.
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
              Blunt read
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em" }}>{analysis.headline}</div>
            <div style={{ color: "rgba(255,255,255,0.54)", lineHeight: 1.6 }}>{analysis.reason}</div>
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
                Current loan vs new scenario
              </div>
            </div>

            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <InputField label="Current balance" value={currentBalance} onChange={setCurrentBalance} />
              <InputField label="Current rate (%)" value={currentRate} onChange={setCurrentRate} />
              <InputField label="Current payment" value={currentPayment} onChange={setCurrentPayment} />
              <InputField label="Loan start date" type="date" value={loanStartDate} onChange={setLoanStartDate} step={undefined} min={undefined} />
              <InputField label="New rate (%)" value={newRate} onChange={setNewRate} />
              <InputField label="New term (years)" value={newTermYears} onChange={setNewTermYears} step="1" />
              <InputField label="Closing costs" value={closingCosts} onChange={setClosingCosts} />
              <InputField label="Years staying" value={yearsStaying} onChange={setYearsStaying} step="0.5" />
            </div>
          </div>
        </GlassPane>

        <GlassPane size="card">
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <div style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.34)" }}>
                Main output
              </div>
              <div style={{ marginTop: 8, fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em" }}>
                What the numbers actually say
              </div>
            </div>

            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <MetricCard label="New payment" value={money(analysis.newPayment)} sub={`Reset on ${analysis.newTermYears}-year term`} />
              <MetricCard label="Monthly difference" value={signedMoney(analysis.monthlySavings)} sub="Current payment minus refi payment" valueTone={tone(analysis.monthlySavings)} />
              <MetricCard label="Break-even" value={analysis.breakEvenMonths ? `${analysis.breakEvenMonths} mo` : "No"} sub="Closing costs recovered from savings" valueTone={analysis.breakEvenMonths && analysis.breakEvenMonths <= analysis.stayMonths ? "#84e1b0" : "#ff8c9f"} />
              <MetricCard label="Stay-window delta" value={signedMoney(analysis.stayHorizonCashDelta)} sub={`Assuming you stay ${analysis.yearsStaying} years`} valueTone={tone(analysis.stayHorizonCashDelta)} />
            </div>

            <div
              style={{
                padding: 14,
                borderRadius: 18,
                border: "1px solid rgba(255,255,255,0.06)",
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0)), rgba(255,255,255,0.018)",
                display: "grid",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(245,248,252,0.94)", fontWeight: 800 }}>
                <BadgeDollarSign size={16} />
                Recommendation
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em" }}>{analysis.headline}</div>
              <div style={{ color: "rgba(255,255,255,0.56)", lineHeight: 1.65 }}>{analysis.reason}</div>
              <div style={{ display: "grid", gap: 8 }}>
                {analysis.bullets.map((item) => (
                  <div key={item} style={{ display: "flex", gap: 9, alignItems: "flex-start", color: "rgba(231,236,245,0.88)" }}>
                    <div style={{ width: 7, height: 7, borderRadius: 999, background: "rgba(140,188,255,0.92)", marginTop: 7 }} />
                    <span style={{ lineHeight: 1.5 }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </GlassPane>

        <GlassPane size="card">
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <div style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.34)" }}>
                Reset risk
              </div>
              <div style={{ marginTop: 8, fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em" }}>
                Do not ignore the debt clock
              </div>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <MetricCard label="Current payoff left" value={`${analysis.remainingMonths} mo`} sub="Estimated from current payment" />
              <MetricCard label="Added loan time" value={analysis.resetRiskYears > 0 ? `${analysis.resetRiskYears.toFixed(1)} yrs` : "Low"} sub="How much extra runway this reset adds" valueTone={analysis.resetRiskYears >= 7 ? "#ff8c9f" : analysis.resetRiskYears > 0 ? "#ffd36a" : "#84e1b0"} />
              <MetricCard label="Lifetime interest delta" value={signedMoney(analysis.lifetimeInterestDelta)} sub="Positive means the refi trims remaining interest" valueTone={tone(analysis.lifetimeInterestDelta)} />
            </div>

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
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "rgba(245,248,252,0.94)", fontWeight: 800 }}>
                <TimerReset size={16} />
                Stay-horizon snapshot
              </div>
              <div style={{ color: "rgba(255,255,255,0.56)", lineHeight: 1.6 }}>
                If you hold the current loan for {analysis.yearsStaying} years, the remaining balance is about {money(analysis.stayCurrentBalance)}. Refiing leaves about {money(analysis.stayNewBalance)} at that same point.
              </div>
            </div>

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
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "rgba(245,248,252,0.94)", fontWeight: 800 }}>
                <Lock size={16} />
                Premium report block later
              </div>
              <div style={{ color: "rgba(255,255,255,0.56)", lineHeight: 1.6 }}>
                This base already leaves room for saved scenarios, PDF report export, public access, and paywall unlocks without restructuring the page again.
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
          </div>
        </GlassPane>
      </div>

      <GlassPane size="card" tone="amber">
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 14,
              display: "grid",
              placeItems: "center",
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.03)",
              color: "rgba(255,230,170,0.96)",
              flex: "0 0 auto",
            }}
          >
            <AlertTriangle size={18} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#fff" }}>Base logic note</div>
            <div style={{ marginTop: 8, color: "rgba(255,255,255,0.58)", lineHeight: 1.65 }}>
              This base uses payment math, closing costs, remaining term inference, and stay-horizon comparisons. It is already useful. Later you can layer in taxes, PMI, cash-out, lender fees, and true amortization report exports.
            </div>
          </div>
        </div>
      </GlassPane>
    </main>
  );
}

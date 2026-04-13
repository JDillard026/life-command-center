"use client";

import Link from "next/link";
import {
  ChevronRight,
  FileText,
  Landmark,
  Lock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import GlassPane from "@/app/components/GlassPane";

const pageStyle = {
  minHeight: "100%",
  display: "grid",
  gap: 14,
  alignContent: "start",
};

const gridStyle = {
  display: "grid",
  gap: 14,
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
};

const muted = {
  color: "rgba(255,255,255,0.58)",
};

function ToolCard({
  href,
  eyebrow,
  title,
  body,
  bullets,
  metricLabel,
  metricValue,
  badge,
  icon: Icon,
}) {
  return (
    <GlassPane size="card" className="tool-card-shell">
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
          <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.42)",
                }}
              >
                {eyebrow}
              </span>
              {badge ? (
                <span
                  style={{
                    minHeight: 20,
                    padding: "0 8px",
                    borderRadius: 999,
                    border: "1px solid rgba(122,166,247,0.18)",
                    background: "rgba(122,166,247,0.12)",
                    color: "rgba(232,240,255,0.92)",
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.04em",
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  {badge}
                </span>
              ) : null}
            </div>

            <div>
              <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.03em", color: "#fff" }}>{title}</div>
              <div style={{ ...muted, marginTop: 8, lineHeight: 1.6, maxWidth: 540 }}>{body}</div>
            </div>
          </div>

          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0)), rgba(255,255,255,0.035)",
              display: "grid",
              placeItems: "center",
              color: "rgba(232,240,255,0.92)",
              flex: "0 0 auto",
            }}
          >
            <Icon size={22} strokeWidth={2} />
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "minmax(0, 1.1fr) minmax(220px, 0.9fr)",
          }}
        >
          <div
            style={{
              display: "grid",
              gap: 8,
              padding: 14,
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(255,255,255,0.018)",
            }}
          >
            {bullets.map((bullet) => (
              <div key={bullet} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                <div
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 999,
                    marginTop: 6,
                    background: "linear-gradient(180deg, rgba(140,188,255,0.96), rgba(84,135,245,0.72))",
                    boxShadow: "0 0 12px rgba(109,160,255,0.4)",
                    flex: "0 0 auto",
                  }}
                />
                <div style={{ color: "rgba(230,236,245,0.84)", lineHeight: 1.5 }}>{bullet}</div>
              </div>
            ))}
          </div>

          <div
            style={{
              display: "grid",
              gap: 8,
              alignContent: "space-between",
              padding: 14,
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,0.06)",
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0)), rgba(255,255,255,0.018)",
            }}
          >
            <div>
              <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.34)" }}>
                {metricLabel}
              </div>
              <div style={{ marginTop: 10, fontSize: 34, fontWeight: 900, color: "#fff", letterSpacing: "-0.04em" }}>
                {metricValue}
              </div>
              <div style={{ ...muted, marginTop: 8 }}>Numbers first. Cleaner than generic calculators. Built to convert.</div>
            </div>

            <Link
              href={href}
              style={{
                minHeight: 44,
                padding: "0 14px",
                borderRadius: 14,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                border: "1px solid rgba(122,166,247,0.22)",
                background: "linear-gradient(180deg, rgba(122,166,247,0.18), rgba(122,166,247,0.06))",
                color: "rgba(240,245,255,0.96)",
                fontWeight: 800,
              }}
            >
              <span>Open tool</span>
              <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </GlassPane>
  );
}

function MiniStep({ title, body, index }) {
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
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 999,
          display: "grid",
          placeItems: "center",
          fontSize: 12,
          fontWeight: 900,
          color: "rgba(245,248,252,0.96)",
          background: "linear-gradient(180deg, rgba(122,166,247,0.18), rgba(122,166,247,0.08))",
          border: "1px solid rgba(122,166,247,0.22)",
        }}
      >
        {index}
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>{title}</div>
      <div style={{ ...muted, lineHeight: 1.55 }}>{body}</div>
    </div>
  );
}

export default function ToolsCommand() {
  return (
    <main style={pageStyle}>
      <GlassPane size="hero">
        <div style={{ display: "grid", gap: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 12, maxWidth: 860 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.42)",
                  }}
                >
                  Tools
                </span>
                <span
                  style={{
                    minHeight: 22,
                    padding: "0 9px",
                    borderRadius: 999,
                    border: "1px solid rgba(126,216,170,0.14)",
                    background: "rgba(126,216,170,0.1)",
                    color: "rgba(214,247,226,0.92)",
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.05em",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Sparkles size={12} />
                  Live base
                </span>
              </div>

              <div>
                <div style={{ fontSize: 40, fontWeight: 950, letterSpacing: "-0.05em", color: "#fff", lineHeight: 1 }}>
                  Financial decisions made clear.
                </div>
                <div style={{ ...muted, marginTop: 14, maxWidth: 760, fontSize: 15, lineHeight: 1.7 }}>
                  This is the standalone utility layer for Life Command Center. Fast answers. Premium presentation. Clean enough for paid conversion.
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
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0)), rgba(255,255,255,0.018)",
                display: "grid",
                gap: 10,
              }}
            >
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "rgba(240,245,255,0.96)", fontWeight: 800 }}>
                <ShieldCheck size={16} />
                Base build locked
              </div>
              <div style={{ ...muted, lineHeight: 1.6 }}>
                Two tools only on purpose. No junk calculator graveyard. Just the highest-conversion tools first.
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {[
                  "Refinance Analyzer",
                  "PFS Statement Builder",
                  "Paywall, export, and public routes later",
                ].map((item) => (
                  <div key={item} style={{ display: "flex", gap: 9, alignItems: "center", color: "rgba(228,236,245,0.9)" }}>
                    <div style={{ width: 6, height: 6, borderRadius: 999, background: "rgba(140,188,255,0.9)" }} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </GlassPane>

      <div style={gridStyle}>
        <ToolCard
          href="/tools/refinance"
          eyebrow="Decision Tool"
          title="Refinance Analyzer"
          body="Tell people in plain English whether refinancing is smart, weak, or dumb based on rate improvement, closing costs, time in home, and reset risk."
          bullets={[
            "Monthly payment estimate and real break-even callout.",
            "Blunt recommendation box instead of watered-down calculator fluff.",
            "Built to become a paid one-time report later.",
          ]}
          metricLabel="Typical hook"
          metricValue="$19"
          badge="FIRST"
          icon={Landmark}
        />

        <ToolCard
          href="/tools/pfs"
          eyebrow="Document Tool"
          title="PFS Statement Builder"
          body="Collect assets, liabilities, income, and expenses into a clean lender-style personal financial statement with a live preview and premium export path later."
          bullets={[
            "Structured asset and liability entry that feels serious.",
            "Live net worth and cash flow summary while building.",
            "PDF export block already positioned for future monetization.",
          ]}
          metricLabel="Typical hook"
          metricValue="$29"
          badge="SECOND"
          icon={FileText}
        />
      </div>

      <div style={gridStyle}>
        <GlassPane size="card">
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <div style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.34)" }}>
                How it works
              </div>
              <div style={{ marginTop: 8, fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em" }}>
                Clear path. No wasted clicks.
              </div>
            </div>

            <div style={{ ...gridStyle, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <MiniStep index="1" title="Use the tool free" body="Let people enter data and see the core answer fast without forcing signup too early." />
              <MiniStep index="2" title="Show the sharp answer" body="Give them the recommendation, pressure points, and main numbers in a premium layout." />
              <MiniStep index="3" title="Lock deeper output later" body="Save scenarios, export polished PDFs, and unlock advanced breakdowns when the paywall lands." />
            </div>
          </div>
        </GlassPane>

        <GlassPane size="card">
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "rgba(255,255,255,0.9)", fontWeight: 800 }}>
              <Lock size={16} />
              Premium layer coming next
            </div>
            <div style={{ ...muted, lineHeight: 1.65 }}>
              This base already leaves clean space for public access, payment unlocks, saved scenarios, and branded PDF output without redoing the structure again.
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {[
                "Public tool access without full account creation",
                "Report unlock and export paywall",
                "Saved scenarios for side-by-side comparisons",
                "Tool bundle inclusion for future subscribers",
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
        </GlassPane>
      </div>
    </main>
  );
}

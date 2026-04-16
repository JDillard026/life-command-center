
"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import GlassPane from "../../components/GlassPane";
import shared from "../InvestmentsPage.module.css";
import styles from "./AutoInvestCommand.module.css";
import { ActionBtn, ActionLink, MiniPill } from "../investments.components";
import { money, moneyTight } from "../investments.helpers";

const STORAGE_KEY = "lcc-auto-invest-plan-v2";

const LANES = {
  investor: {
    key: "investor",
    title: "Long-Term Investor",
    tag: "core",
    sub: "Broad ETFs, quality names, slower compounding, less stress.",
    buckets: [
      { title: "Broad ETFs", value: "50%", text: "Core index base before anything flashy." },
      { title: "Quality leaders", value: "35%", text: "Large cap names with real cash flow." },
      { title: "Satellite ideas", value: "15%", text: "Smaller tactical slice kept controlled." },
    ],
  },
  growth: {
    key: "growth",
    title: "Growth Builder",
    tag: "growth",
    sub: "Stronger upside focus, more volatility, and trend-following names.",
    buckets: [
      { title: "Growth leaders", value: "40%", text: "High-conviction compounders." },
      { title: "Momentum sleeve", value: "35%", text: "Trend names with tighter guardrails." },
      { title: "ETF ballast", value: "25%", text: "Keeps the lane from turning stupid." },
    ],
  },
  trader: {
    key: "trader",
    title: "Day / Active Trader",
    tag: "paper only",
    sub: "Catalyst moves, tight risk control, shorter holding windows.",
    buckets: [
      { title: "Cash reserve", value: "40%", text: "No cash discipline means no business trading." },
      { title: "Tactical names", value: "40%", text: "Short-term opportunities with hard rules." },
      { title: "Index anchor", value: "20%", text: "Stops the lane becoming pure chaos." },
    ],
  },
  options: {
    key: "options",
    title: "Options",
    tag: "education",
    sub: "High risk. Education only for now. Not a live route.",
    buckets: [{ title: "Education", value: "100%", text: "Read first. Do not fake competence." }],
  },
};

const CADENCE_FACTORS = {
  Weekly: 4.33,
  Biweekly: 2.17,
  Monthly: 1,
  Quarterly: 0.33,
};

export default function AutoInvestCommand() {
  const [lane, setLane] = useState("investor");
  const [amount, setAmount] = useState("250");
  const [cadence, setCadence] = useState("Weekly");
  const [reserveFloor, setReserveFloor] = useState("500");
  const [maxSinglePositionPct, setMaxSinglePositionPct] = useState("10");
  const [riskLevel, setRiskLevel] = useState("Moderate");
  const [allowedSectors, setAllowedSectors] = useState("broad market, tech, financials");
  const [acceptedDisclosure, setAcceptedDisclosure] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setLane(parsed.lane || "investor");
      setAmount(String(parsed.amount ?? "250"));
      setCadence(parsed.cadence || "Weekly");
      setReserveFloor(String(parsed.reserveFloor ?? "500"));
      setMaxSinglePositionPct(String(parsed.maxSinglePositionPct ?? "10"));
      setRiskLevel(parsed.riskLevel || "Moderate");
      setAllowedSectors(parsed.allowedSectors || "broad market, tech, financials");
      setAcceptedDisclosure(Boolean(parsed.acceptedDisclosure));
      setStatus("Loaded your last paper plan from this browser.");
    } catch (error) {
      console.error(error);
    }
  }, []);

  const laneConfig = LANES[lane] || LANES.investor;
  const amountNum = Number(amount) || 0;
  const reserveNum = Number(reserveFloor) || 0;
  const maxPositionNum = Number(maxSinglePositionPct) || 0;
  const monthlyDeploy = amountNum * (CADENCE_FACTORS[cadence] || 1);
  const maxPositionSize = monthlyDeploy * (maxPositionNum / 100);

  const rules = useMemo(() => {
    return [
      {
        title: "Mode",
        text: lane === "trader" ? "Paper-only. No fake live automation." : "Rule-based recurring deployment.",
        value: lane === "trader" ? "Paper" : "Active",
      },
      {
        title: "Reserve floor",
        text: "New buys stop if cash falls under the reserve floor.",
        value: money(reserveNum),
      },
      {
        title: "Single-position cap",
        text: "Stops one name from eating the entire plan.",
        value: `${maxPositionNum.toFixed(0)}%`,
      },
      {
        title: "Risk profile",
        text: "Use this to decide how hard the plan leans into volatility.",
        value: riskLevel,
      },
    ];
  }, [lane, reserveNum, maxPositionNum, riskLevel]);

  function savePlan() {
    if (!acceptedDisclosure) {
      setStatus("Disclosure has to be accepted before saving.");
      return;
    }

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          lane,
          amount,
          cadence,
          reserveFloor,
          maxSinglePositionPct,
          riskLevel,
          allowedSectors,
          acceptedDisclosure,
          savedAt: new Date().toISOString(),
        })
      );
      setStatus("Paper plan saved locally. No live brokerage order was sent.");
    } catch (error) {
      console.error(error);
      setStatus("Could not save the paper plan locally.");
    }
  }

  return (
    <main className={styles.page}>
      {status ? (
        <GlassPane className={shared.statusStrip}>
          <div className={shared.statusTitle}>auto invest update</div>
          <div className={shared.statusText}>{status}</div>
        </GlassPane>
      ) : null}

      <GlassPane className={shared.topStrip}>
        <div className={shared.topMain}>
          <div>
            <div className={shared.pageMicro}>Invest / Auto Invest</div>
            <div className={shared.pageName}>Auto Invest</div>
            <div className={shared.pageSub}>
              Rule-based, paper-first, disclosure-heavy. No mystery AI stock picker nonsense.
            </div>
          </div>

          <div className={shared.pageActions}>
            <ActionLink href="/investments" variant="primary">
              Portfolio <ArrowRight size={14} />
            </ActionLink>
            <ActionLink href="/investments/discover">
              Discover <Sparkles size={14} />
            </ActionLink>
          </div>
        </div>

        <div className={shared.inlineMetricStrip}>
          <div className={shared.inlineMetricCell}>
            <div className={shared.inlineMetricLabel}>Mode</div>
            <div className={shared.inlineMetricValue}>Paper</div>
            <div className={shared.inlineMetricNote}>local plan only</div>
          </div>
          <div className={shared.inlineMetricCell}>
            <div className={shared.inlineMetricLabel}>Lane</div>
            <div className={shared.inlineMetricValue}>{laneConfig.title}</div>
            <div className={shared.inlineMetricNote}>{laneConfig.tag}</div>
          </div>
          <div className={shared.inlineMetricCell}>
            <div className={shared.inlineMetricLabel}>Monthly deploy</div>
            <div className={shared.inlineMetricValue}>{moneyTight(monthlyDeploy)}</div>
            <div className={shared.inlineMetricNote}>{cadence} cadence</div>
          </div>
          <div className={shared.inlineMetricCell}>
            <div className={shared.inlineMetricLabel}>Disclosure</div>
            <div className={shared.inlineMetricValue}>{acceptedDisclosure ? "Accepted" : "Required"}</div>
            <div className={shared.inlineMetricNote}>must be checked before save</div>
          </div>
        </div>
      </GlassPane>

      <div className={styles.grid}>
        <GlassPane className={shared.deskSurface}>
          <div className={shared.surfaceHeader}>
            <div>
              <div className={shared.surfaceTitle}>Choose your lane</div>
              <div className={shared.surfaceSub}>Long-term and active traders do not need the same setup.</div>
            </div>
            <MiniPill tone="amber">paper route</MiniPill>
          </div>

          <div className={styles.laneGrid}>
            {Object.values(LANES).map((entry) => (
              <button
                key={entry.key}
                type="button"
                className={entry.key === lane ? `${styles.laneCard} ${styles.laneCardActive}` : styles.laneCard}
                onClick={() => setLane(entry.key)}
              >
                <div className={styles.laneTop}>
                  <div className={styles.laneTitle}>{entry.title}</div>
                  <div className={styles.laneTag}>{entry.tag}</div>
                </div>
                <div className={styles.laneSub}>{entry.sub}</div>
              </button>
            ))}
          </div>

          <div className={shared.surfaceDivider} />

          <div className={shared.surfaceHeader}>
            <div>
              <div className={shared.surfaceTitle}>Recurring plan</div>
              <div className={shared.surfaceSub}>Cadence, cash floor, and concentration live here.</div>
            </div>
          </div>

          <div className={styles.formGrid}>
            <label className={styles.fieldWrap}>
              <span className={styles.fieldLabel}>Recurring amount</span>
              <input className={styles.field} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
            <label className={styles.fieldWrap}>
              <span className={styles.fieldLabel}>Cadence</span>
              <select className={styles.field} value={cadence} onChange={(e) => setCadence(e.target.value)}>
                {Object.keys(CADENCE_FACTORS).map((entry) => (
                  <option key={entry} value={entry}>{entry}</option>
                ))}
              </select>
            </label>
            <label className={styles.fieldWrap}>
              <span className={styles.fieldLabel}>Reserve floor</span>
              <input className={styles.field} value={reserveFloor} onChange={(e) => setReserveFloor(e.target.value)} />
            </label>
            <label className={styles.fieldWrap}>
              <span className={styles.fieldLabel}>Risk level</span>
              <select className={styles.field} value={riskLevel} onChange={(e) => setRiskLevel(e.target.value)}>
                {["Conservative", "Moderate", "Aggressive"].map((entry) => (
                  <option key={entry} value={entry}>{entry}</option>
                ))}
              </select>
            </label>
            <label className={styles.fieldWrap}>
              <span className={styles.fieldLabel}>Max single position %</span>
              <input className={styles.field} value={maxSinglePositionPct} onChange={(e) => setMaxSinglePositionPct(e.target.value)} />
            </label>
            <label className={styles.fieldWrap}>
              <span className={styles.fieldLabel}>Allowed sectors</span>
              <input className={styles.field} value={allowedSectors} onChange={(e) => setAllowedSectors(e.target.value)} />
            </label>
          </div>

          <div className={styles.planPreviewGrid} style={{ marginTop: 12 }}>
            <div className={styles.previewCard}>
              <div className={styles.previewLabel}>Monthly deployment</div>
              <div className={styles.previewValue}>{moneyTight(monthlyDeploy)}</div>
              <div className={styles.previewNote}>{cadence} contribution pace</div>
            </div>
            <div className={styles.previewCard}>
              <div className={styles.previewLabel}>Max position size</div>
              <div className={styles.previewValue}>{money(maxPositionSize)}</div>
              <div className={styles.previewNote}>{maxSinglePositionPct}% of monthly deployment</div>
            </div>
            <div className={styles.previewCard}>
              <div className={styles.previewLabel}>Cash floor</div>
              <div className={styles.previewValue}>{money(reserveNum)}</div>
              <div className={styles.previewNote}>new buys stop under this amount</div>
            </div>
          </div>

          <div className={shared.surfaceDivider} />

          <div className={shared.surfaceHeader}>
            <div>
              <div className={shared.surfaceTitle}>Buckets</div>
              <div className={shared.surfaceSub}>What this lane is actually trying to do.</div>
            </div>
          </div>

          <div className={styles.bucketList}>
            {laneConfig.buckets.map((bucket) => (
              <div key={bucket.title} className={styles.bucketRow}>
                <div>
                  <div className={styles.bucketTitle}>{bucket.title}</div>
                  <div className={styles.bucketText}>{bucket.text}</div>
                </div>
                <div className={styles.bucketValue}>{bucket.value}</div>
              </div>
            ))}
          </div>
        </GlassPane>

        <GlassPane className={shared.railSurface}>
          <div className={shared.surfaceHeader}>
            <div>
              <div className={shared.surfaceTitle}>Guardrails</div>
              <div className={shared.surfaceSub}>These keep the plan honest.</div>
            </div>
          </div>

          <div className={styles.ruleList}>
            {rules.map((rule) => (
              <div key={rule.title} className={styles.ruleRow}>
                <div>
                  <div className={styles.ruleTitle}>{rule.title}</div>
                  <div className={styles.ruleText}>{rule.text}</div>
                </div>
                <div className={styles.ruleValue}>{rule.value}</div>
              </div>
            ))}
          </div>

          <div className={shared.surfaceDivider} />

          <div className={shared.surfaceHeader}>
            <div>
              <div className={shared.surfaceTitle}>Disclosure</div>
              <div className={shared.surfaceSub}>This has to be explicit.</div>
            </div>
          </div>

          <label className={styles.checkRow}>
            <input type="checkbox" checked={acceptedDisclosure} onChange={(e) => setAcceptedDisclosure(e.target.checked)} />
            <span className={styles.checkText}>
              I understand market prices can change rapidly, losses are possible, and this route should never be treated like guaranteed income.
            </span>
          </label>

          <div className={shared.pageActions} style={{ marginTop: 12 }}>
            <ActionBtn variant="primary" onClick={savePlan}>
              <ShieldCheck size={14} /> Save Paper Plan
            </ActionBtn>
          </div>

          <div className={shared.surfaceDivider} />

          <div className={shared.infoCopy}>
            A good auto-invest route should feel disciplined, not magical. If it looks too smart, it is usually lying.
          </div>
        </GlassPane>
      </div>
    </main>
  );
}

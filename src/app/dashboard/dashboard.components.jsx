import Link from "next/link";
import {
  Bell,
  CalendarDays,
  CircleHelp,
  Crown,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import styles from "./DashboardPage.module.css";
import {
  buildSvgAreaPath,
  buildSvgLinePath,
  money,
  pct,
  sampleSeriesLabels,
  signedMoney,
  startCase,
  toneClass,
} from "./dashboard.helpers";

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function CardHeader({ title, right }) {
  return (
    <div className={styles.cardHead}>
      <div className={styles.cardTitle}>{title}</div>
      <div className={styles.cardHeadRight}>{right}</div>
    </div>
  );
}

function KpiCell({ label, value, sub, tone = "neutral", active = false }) {
  return (
    <div className={cx(styles.kpiCell, active ? styles.kpiCellActive : "")}>
      <div className={styles.kpiLabel}>{label}</div>
      <div className={cx(styles.kpiValue, styles[`tone_${tone}`])}>{value}</div>
      <div className={cx(styles.kpiSub, tone !== "neutral" ? styles[`tone_${tone}`] : "")}>{sub}</div>
    </div>
  );
}

function MetricCell({ label, value, sub, tone = "neutral" }) {
  return (
    <div className={styles.metricCell}>
      <div className={styles.metricLabel}>{label}</div>
      <div className={cx(styles.metricValue, styles[`tone_${tone}`])}>{value}</div>
      <div className={styles.metricSub}>{sub}</div>
    </div>
  );
}

function StatRow({ label, value, tone = "neutral" }) {
  return (
    <div className={styles.statRow}>
      <span className={styles.statRowLabel}>{label}</span>
      <span className={cx(styles.statRowValue, styles[`tone_${tone}`])}>{value}</span>
    </div>
  );
}

function LineChart({ series, compareSeries = [] }) {
  const linePath = buildSvgLinePath(series, 100, 36, 3.5);
  const areaPath = buildSvgAreaPath(series, 100, 36, 3.5);
  const comparePath = compareSeries.length
    ? buildSvgLinePath(compareSeries, 100, 36, 3.5)
    : "";
  const labels = sampleSeriesLabels(series, 6);

  return (
    <div className={styles.chartWrap}>
      <svg viewBox="0 0 100 36" className={styles.chartSvg} preserveAspectRatio="none">
        <defs>
          <linearGradient id="dashboardAreaFade" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(214, 227, 255, 0.34)" />
            <stop offset="72%" stopColor="rgba(214, 227, 255, 0.08)" />
            <stop offset="100%" stopColor="rgba(214, 227, 255, 0)" />
          </linearGradient>
        </defs>

        {comparePath ? (
          <path
            d={comparePath}
            fill="none"
            stroke="rgba(131, 148, 180, 0.34)"
            strokeWidth="0.62"
            strokeDasharray="1.6 1.8"
            strokeLinecap="round"
          />
        ) : null}

        {areaPath ? <path d={areaPath} fill="url(#dashboardAreaFade)" /> : null}

        {linePath ? (
          <path
            d={linePath}
            fill="none"
            stroke="rgba(242, 246, 252, 0.98)"
            strokeWidth="0.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
      </svg>

      {labels.length ? (
        <div className={styles.chartLabels}>
          {labels.map((item, idx) => (
            <span key={`${item.iso}-${idx}`}>{item.label}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TransactionTable({ items }) {
  if (!items.length) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyStateTitle}>No recent transactions</div>
        <div className={styles.emptyStateText}>Once money moves, it will show here.</div>
      </div>
    );
  }

  return (
    <div className={styles.tableWrap}>
      <div className={styles.tableHead}>
        <span>Merchant</span>
        <span>Category</span>
        <span>Amount</span>
        <span>Date</span>
      </div>

      {items.map((item) => (
        <div className={styles.tableRow} key={item.id}>
          <div className={styles.tableCellMain}>
            <div className={styles.tableName}>{item.title}</div>
            <div className={styles.tableMeta}>{item.accountName || "Recorded item"}</div>
          </div>
          <div className={styles.tableCell}>{startCase(item.category || "General")}</div>
          <div className={cx(styles.tableAmount, styles[`tone_${item.tone}`])}>{item.value}</div>
          <div className={styles.tableDate}>{item.dateLabel}</div>
        </div>
      ))}
    </div>
  );
}

function BillList({ items }) {
  if (!items.length) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyStateTitle}>No upcoming bills</div>
        <div className={styles.emptyStateText}>Nothing is close enough to matter right now.</div>
      </div>
    );
  }

  return (
    <div className={styles.billList}>
      {items.map((bill) => (
        <div className={styles.billRow} key={bill.id}>
          <div className={cx(styles.billIcon, styles[`toneBg_${bill.tone}`])}>$</div>
          <div className={styles.billCopy}>
            <div className={styles.billName}>{bill.name}</div>
            <div className={styles.billMeta}>{bill.meta}</div>
          </div>
          <div className={styles.billRight}>
            <div className={cx(styles.billAmount, styles[`tone_${bill.tone}`])}>{bill.amount}</div>
            <div className={cx(styles.billStatus, styles[`tone_${bill.tone}`])}>{bill.status}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SignalsCard({ items }) {
  if (!items.length) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyStateTitle}>No active signals</div>
        <div className={styles.emptyStateText}>The system is quiet right now.</div>
      </div>
    );
  }

  return (
    <div className={styles.signalList}>
      {items.map((item) => (
        <div className={styles.signalItem} key={item.id}>
          <div className={styles.signalItemTop}>
            <div className={styles.signalItemText}>
              <strong>{item.title}</strong> — {item.detail}
            </div>
            <span className={styles.signalItemValue}>{item.value}</span>
          </div>
          <div className={cx(styles.signalBar, styles[`toneBg_${item.tone}`])} />
        </div>
      ))}
    </div>
  );
}

function CategoryMix({ items, total }) {
  if (!items.length || total <= 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyStateTitle}>No spending mix yet</div>
        <div className={styles.emptyStateText}>Log expenses to unlock category concentration.</div>
      </div>
    );
  }

  return (
    <div className={styles.categoryList}>
      {items.map((item) => (
        <div className={styles.categoryRow} key={item.label}>
          <div className={styles.categoryLeft}>
            <div className={styles.categoryLabel}>{item.label}</div>
            <div className={styles.categoryTrack}>
              <div className={styles.categoryFill} style={{ width: `${Math.max(4, Math.min(100, item.pct))}%` }} />
            </div>
          </div>
          <div className={styles.categoryRight}>
            <div className={styles.categoryAmount}>{money(item.amount)}</div>
            <div className={styles.categoryPct}>{pct(item.pct, 0)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function UpgradePanel({ plan }) {
  return (
    <div className={styles.upgradePanel}>
      <div className={styles.upgradeHeader}>
        <div>
          <div className={styles.upgradeEyebrow}>Plan & Upgrade</div>
          <div className={styles.upgradeTitle}>{plan.title}</div>
        </div>
        <span className={cx(styles.chip, styles.chipGold)}>
          <Crown size={12} />
          {plan.badge}
        </span>
      </div>

      <div className={styles.upgradeBody}>{plan.body}</div>

      <div className={styles.upgradeFeatureList}>
        {plan.features.map((feature) => (
          <div key={feature} className={styles.upgradeFeature}>
            <ShieldCheck size={13} />
            <span>{feature}</span>
          </div>
        ))}
      </div>

      <div className={styles.upgradeFooter}>
        <div className={styles.upgradeTier}>
          <span>Current plan</span>
          <strong>{plan.tier}</strong>
        </div>

        <Link href={plan.ctaHref} className={styles.upgradeButton}>
          <Sparkles size={14} />
          <span>{plan.ctaLabel}</span>
        </Link>
      </div>
    </div>
  );
}

export function DashboardTopbar({ search, setSearch, computed }) {
  return (
    <div className={styles.topbar}>
      <div className={styles.topbarLeft}>
        <div className={styles.breadcrumb}>Dashboard <span>/ Mission Control</span></div>
        <div className={styles.statusPill}>
          <div className={styles.statusDot} />
          <span>Live</span>
        </div>
        <div className={styles.topbarDate}>{computed?.dateLabel || ""}</div>
      </div>

      <div className={styles.topbarRight}>
        <label className={styles.searchBar}>
          <Search size={14} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search transactions, bills, accounts..."
          />
          <span>⌘K</span>
        </label>

        <button type="button" className={styles.topButton} aria-label="Signals">
          <Bell size={14} />
        </button>

        <Link href="/calendar" className={styles.topButtonWide}>
          <CalendarDays size={14} />
          <span>Calendar</span>
        </Link>

        <Link href="/spending" className={cx(styles.topButton, styles.topButtonPrimary)}>
          <Plus size={14} />
          <span>Add</span>
        </Link>

        <Link href="/settings" className={styles.topButtonWide}>
          <Crown size={14} />
          <span>Upgrade</span>
        </Link>

        <Link href="/settings" className={styles.topButton} aria-label="Help">
          <CircleHelp size={14} />
        </Link>
      </div>
    </div>
  );
}

export function DashboardKpiStrip({ computed }) {
  return (
    <div className={styles.kpiStrip}>
      <KpiCell label="Net Worth" value={money(computed.netWorth)} sub={`${computed.accountsCount} accounts`} active />
      <KpiCell label="Cash Available" value={money(computed.cashTotal)} sub="live balance" />
      <KpiCell
        label="Month Flow"
        value={signedMoney(computed.monthMovement)}
        sub={computed.monthMovement < 0 ? "outflow > inflow" : "positive month flow"}
        tone={toneClass(computed.monthMovement)}
      />
      <KpiCell label="Income MTD" value={money(computed.monthlyIncome)} sub="recorded" tone="positive" />
      <KpiCell label="Spending MTD" value={money(computed.monthlySpending)} sub="true outflow" tone="negative" />
      <KpiCell
        label="Bill Load"
        value={money(computed.monthlyBillPressure)}
        sub={`${computed.overdueCount} overdue`}
        tone={computed.overdueCount ? "negative" : computed.dueSoonCount ? "warning" : "neutral"}
      />
    </div>
  );
}

function CashCard({ computed }) {
  return (
    <div className={cx(styles.card, styles.cardLarge)}>
      <CardHeader
        title="Cash Position"
        right={
          <div className={styles.cardHeadRight}>
            <span
              className={cx(
                styles.chip,
                computed.primaryHeadlineTone === "negative"
                  ? styles.chipNegative
                  : computed.primaryHeadlineTone === "warning"
                  ? styles.chipWarning
                  : styles.chipBlue
              )}
            >
              {computed.primaryHeadline}
            </span>
            <button type="button" className={styles.ghostBtn} aria-label="More options">
              <MoreHorizontal size={14} />
            </button>
          </div>
        }
      />
      <div className={styles.heroBlock}>
        <div className={styles.heroValue}>{money(computed.cashTotal)}</div>
        <div className={styles.heroSub}>
          Month movement{" "}
          <span className={styles[`tone_${toneClass(computed.monthMovement)}`]}>
            {signedMoney(computed.monthMovement)}
          </span>
        </div>
      </div>

      <LineChart series={computed.cashFlowSeries} compareSeries={computed.previousCashFlowSeries} />

      <div className={styles.metricRow}>
        <MetricCell label="Income" value={money(computed.monthlyIncome)} sub="This month" tone="positive" />
        <MetricCell label="Spending" value={money(computed.monthlySpending)} sub="This month" tone="negative" />
        <MetricCell label="Liquid" value={money(computed.cashTotal)} sub="Available now" />
        <MetricCell
          label="Capacity"
          value={signedMoney(computed.monthlyCapacity)}
          sub="After spending & bills"
          tone={toneClass(computed.monthlyCapacity)}
        />
      </div>
    </div>
  );
}

function RunwayCard({ computed }) {
  return (
    <div className={styles.card}>
      <CardHeader
        title="Month Runway"
        right={
          <button type="button" className={styles.ghostBtn} aria-label="More options">
            <MoreHorizontal size={14} />
          </button>
        }
      />

      <div className={styles.gaugeTop}>
        <div className={styles.gaugeLabel}>Income − Spending − Scheduled Debits</div>
        <div className={cx(styles.gaugeValue, styles[`tone_${toneClass(computed.monthlyCapacity)}`])}>
          {signedMoney(computed.monthlyCapacity)}
        </div>
      </div>

      <div className={styles.gaugeTrack}>
        <div
          className={styles.gaugeFill}
          style={{
            width: `${Math.max(
              8,
              Math.min(
                100,
                computed.monthlyIncome > 0
                  ? (Math.abs(computed.monthlyCapacity) / Math.max(computed.monthlyIncome, 1)) * 100
                  : 14
              )
            )}%`,
          }}
        />
      </div>

      <div className={styles.gaugeSub}>
        {computed.monthlyCapacity < 0
          ? "Current pressure is consuming the month."
          : "You still have room left to allocate."}
      </div>

      <div className={styles.statList}>
        <StatRow label="Income" value={money(computed.monthlyIncome)} tone="positive" />
        <StatRow label="Spending" value={signedMoney(-computed.monthlySpending)} tone="negative" />
        <StatRow label="Bill load" value={signedMoney(-computed.monthlyBillPressure)} tone="warning" />
        <StatRow label="Due soon" value={money(computed.dueSoonTotal)} tone={computed.dueSoonCount ? "warning" : "neutral"} />
      </div>
    </div>
  );
}

function ActivityCard({ computed }) {
  return (
    <div className={cx(styles.card, styles.cardLarge)}>
      <CardHeader
        title="Recent Activity"
        right={
          <div className={styles.cardHeadRight}>
            <span className={cx(styles.chip, styles.chipBlue)}>Latest</span>
            <Link href="/spending" className={styles.miniAction}>
              Open
            </Link>
          </div>
        }
      />
      <TransactionTable items={computed.filteredTransactions} />
    </div>
  );
}

function BillQueueCard({ computed }) {
  return (
    <div className={styles.card}>
      <CardHeader
        title="Bill Queue"
        right={
          <div className={styles.cardHeadRight}>
            <span className={cx(styles.chip, styles.chipWarning)}>{computed.overdueCount} overdue</span>
            <Link href="/bills" className={styles.miniAction}>
              Open
            </Link>
          </div>
        }
      />
      <BillList items={computed.billCards} />
    </div>
  );
}

function NetWorthCard({ computed }) {
  return (
    <div className={styles.card}>
      <CardHeader
        title="Net Worth"
        right={<span className={cx(styles.chip, styles.chipBlue)}>{computed.accountsCount} accounts</span>}
      />
      <div className={styles.wealthBlock}>
        <div className={styles.wealthValue}>{money(computed.netWorth)}</div>
        <div className={styles.wealthTrack}>
          <div
            className={styles.wealthFill}
            style={{
              width: `${Math.max(
                8,
                Math.min(
                  100,
                  computed.netWorth > 0 && computed.cashTotal > 0
                    ? (computed.netWorth / Math.max(computed.cashTotal + Math.max(computed.investmentTotal, 0), 1)) * 100
                    : 12
                )
              )}%`,
            }}
          />
        </div>
        <div className={styles.wealthSub}>
          {computed.investmentTotal > 0 ? `${money(computed.investmentTotal)} invested` : "No active investments yet"}
        </div>
      </div>

      <div className={styles.statList}>
        <StatRow label="Assets" value={money(computed.cashTotal + computed.investmentTotal)} tone="positive" />
        <StatRow label="Cash" value={money(computed.cashTotal)} />
        <StatRow label="Investments" value={money(computed.investmentTotal)} tone={computed.investmentTotal ? "positive" : "neutral"} />
        <StatRow label="Portfolio P/L" value={signedMoney(computed.portfolioPnL)} tone={toneClass(computed.portfolioPnL)} />
      </div>
    </div>
  );
}

function MixAndPlanCard({ computed }) {
  return (
    <div className={styles.card}>
      <CardHeader
        title="Spending Mix + Plan"
        right={
          computed.largestCategory ? (
            <span className={cx(styles.chip, styles.chipNeutral)}>{computed.largestCategory.label}</span>
          ) : (
            <span className={cx(styles.chip, styles.chipGold)}>
              <Crown size={12} />
              Upgrade
            </span>
          )
        }
      />

      <div className={styles.splitStack}>
        <div className={styles.splitStackTop}>
          <CategoryMix items={computed.spendingBuckets.items.slice(0, 4)} total={computed.spendingBuckets.total} />
        </div>
        <div className={styles.splitDivider} />
        <div className={styles.splitStackBottom}>
          <UpgradePanel plan={computed.plan} />
        </div>
      </div>
    </div>
  );
}

function SignalsBlock({ computed }) {
  return (
    <div className={styles.card}>
      <CardHeader
        title="System Signals"
        right={<span className={cx(styles.chip, styles.chipNegative)}>{computed.notificationCount} active</span>}
      />
      <SignalsCard items={computed.notifications.slice(0, 5)} />
    </div>
  );
}

export function DesktopDashboard({ computed }) {
  return (
    <div className={styles.content}>
      <div className={styles.gridMain}>
        <CashCard computed={computed} />
        <RunwayCard computed={computed} />
      </div>

      <div className={styles.gridMain}>
        <ActivityCard computed={computed} />
        <SignalsBlock computed={computed} />
      </div>

      <div className={styles.gridBottom}>
        <BillQueueCard computed={computed} />
        <NetWorthCard computed={computed} />
        <MixAndPlanCard computed={computed} />
      </div>
    </div>
  );
}

export function MobileDashboard({ computed, mobileZone, setMobileZone }) {
  return (
    <>
      <div className={styles.mobileStateBar}>
        <div className={styles.mobileStateTabs}>
          {[
            { key: "overview", label: "Overview" },
            { key: "activity", label: "Activity" },
            { key: "signals", label: "Signals" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={cx(styles.mobileStateTab, mobileZone === tab.key ? styles.mobileStateTabActive : "")}
              onClick={() => setMobileZone(tab.key)}
            >
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={cx(styles.content, styles.mobileContent)}>
        {mobileZone === "overview" ? (
          <div className={styles.mobileStack}>
            <CashCard computed={computed} />
            <RunwayCard computed={computed} />
            <NetWorthCard computed={computed} />
            <MixAndPlanCard computed={computed} />
          </div>
        ) : null}

        {mobileZone === "activity" ? (
          <div className={styles.mobileStack}>
            <ActivityCard computed={computed} />
            <BillQueueCard computed={computed} />
          </div>
        ) : null}

        {mobileZone === "signals" ? (
          <div className={styles.mobileStack}>
            <SignalsBlock computed={computed} />
          </div>
        ) : null}
      </div>
    </>
  );
}

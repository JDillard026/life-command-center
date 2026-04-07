"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CreditCard,
  Gem,
  LayoutDashboard,
  Menu,
  PiggyBank,
  Receipt,
  Shield,
  Target,
  TrendingUp,
  UserCircle2,
  Wallet,
  X,
} from "lucide-react";
import styles from "./SideNav.module.css";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard, section: "overview" },
  { label: "Calendar", href: "/calendar", icon: CalendarDays, section: "overview" },
  { label: "Accounts", href: "/accounts", icon: Wallet, section: "money" },
  { label: "Bills", href: "/bills", icon: Receipt, section: "money" },
  { label: "Debt", href: "/debt", icon: CreditCard, section: "money" },
  { label: "Income", href: "/income", icon: Gem, section: "money" },
  { label: "Spending", href: "/spending", icon: PiggyBank, section: "money" },
  { label: "Investments", href: "/investments", icon: TrendingUp, section: "money", badge: "LIVE" },
  { label: "Savings", href: "/savings", icon: Target, section: "money" },
  { label: "Admin", href: "/admin", icon: Shield, section: "system" },
  { label: "Settings", href: "/settings", icon: UserCircle2, section: "system" },
];

function cx(...names) {
  return names.filter(Boolean).join(" ");
}

function isActive(pathname, href) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavDetailItem({ item, active, onNavigate }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={() => onNavigate?.()}
      aria-current={active ? "page" : undefined}
      className={cx(styles.detailItem, active && styles.detailItemActive)}
    >
      <div className={styles.detailItemLeft}>
        <div className={styles.detailIcon}>
          <Icon size={15} strokeWidth={2} />
        </div>
        <span className={styles.detailLabel}>{item.label}</span>
      </div>

      {item.badge ? <span className={styles.detailBadge}>{item.badge}</span> : null}
    </Link>
  );
}

export default function SideNav({
  collapsed = false,
  mobile = false,
  onToggle,
  onCloseMobile,
}) {
  const pathname = usePathname() || "";
  const activeItem = NAV_ITEMS.find((item) => isActive(pathname, item.href)) || NAV_ITEMS[0];

  const overviewItems = NAV_ITEMS.filter((item) => item.section === "overview");
  const moneyItems = NAV_ITEMS.filter((item) => item.section === "money");
  const systemItems = NAV_ITEMS.filter((item) => item.section === "system");

  return (
    <div className={cx(styles.shell, collapsed && !mobile && styles.shellCollapsed, mobile && styles.shellMobile)}>
      <div className={styles.iconRail}>
        <button
          type="button"
          onClick={onToggle}
          className={styles.logoButton}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <div className={styles.logoWrap}>
            <Image
              src="/brand/lcc-logo.png"
              alt="Life Command Center logo"
              width={30}
              height={30}
              priority
              className={styles.logo}
            />
          </div>
        </button>

        <nav className={styles.iconRailList} aria-label="Primary">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => onCloseMobile?.()}
                className={cx(styles.iconButton, active && styles.iconButtonActive)}
                aria-current={active ? "page" : undefined}
                title={item.label}
              >
                <Icon size={18} strokeWidth={2} />
              </Link>
            );
          })}
        </nav>

        {mobile ? (
          <button
            type="button"
            onClick={onCloseMobile}
            className={styles.mobileClose}
            aria-label="Close navigation"
            title="Close navigation"
          >
            <X size={15} />
          </button>
        ) : null}
      </div>

      <div className={cx(styles.detailRail, collapsed && !mobile && styles.detailRailCollapsed)}>
        <div className={styles.detailHeader}>
          <div>
            <div className={styles.detailEyebrow}>Financial OS</div>
            <div className={styles.detailTitle}>Life Command Center</div>
          </div>

          {!mobile ? (
            <button
              type="button"
              onClick={onToggle}
              className={styles.collapseButton}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <Menu size={14} />
            </button>
          ) : null}
        </div>

        <div className={styles.activeSummary}>
          <div className={styles.activeSummaryLabel}>Current</div>
          <div className={styles.activeSummaryName}>{activeItem.label}</div>
        </div>

        <div className={styles.detailBody}>
          <div className={styles.detailSection}>
            <div className={styles.sectionLabel}>Overview</div>
            <div className={styles.detailList}>
              {overviewItems.map((item) => (
                <NavDetailItem
                  key={item.href}
                  item={item}
                  active={isActive(pathname, item.href)}
                  onNavigate={onCloseMobile}
                />
              ))}
            </div>
          </div>

          <div className={styles.detailSection}>
            <div className={styles.sectionLabel}>Money</div>
            <div className={styles.detailList}>
              {moneyItems.map((item) => (
                <NavDetailItem
                  key={item.href}
                  item={item}
                  active={isActive(pathname, item.href)}
                  onNavigate={onCloseMobile}
                />
              ))}
            </div>
          </div>

          <div className={styles.detailSection}>
            <div className={styles.sectionLabel}>System</div>
            <div className={styles.detailList}>
              {systemItems.map((item) => (
                <NavDetailItem
                  key={item.href}
                  item={item}
                  active={isActive(pathname, item.href)}
                  onNavigate={onCloseMobile}
                />
              ))}
            </div>
          </div>
        </div>

        <div className={styles.detailFooter}>
          <div className={styles.userRow}>
            <div className={styles.avatar}>J</div>
            <div className={styles.userCopy}>
              <div className={styles.userName}>Jacob</div>
              <div className={styles.userPlan}>Life Command Center</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
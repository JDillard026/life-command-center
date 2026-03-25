"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CreditCard,
  Gem,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
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
  {
    label: "Dashboard",
    href: "/",
    subtitle: "Today + next moves",
    icon: LayoutDashboard,
    accent: {
      icon: "#f5f8ff",
      ring: "rgba(255,255,255,0.16)",
      glow: "rgba(255,255,255,0.11)",
      border: "rgba(255,255,255,0.14)",
    },
  },
  {
    label: "Calendar",
    href: "/calendar",
    subtitle: "Timeline + recurring",
    icon: CalendarDays,
    accent: {
      icon: "#b6f4ff",
      ring: "rgba(182,244,255,0.16)",
      glow: "rgba(182,244,255,0.11)",
      border: "rgba(182,244,255,0.16)",
    },
  },
  {
    label: "Accounts",
    href: "/accounts",
    subtitle: "Balances + cash view",
    icon: Wallet,
    accent: {
      icon: "#edf3ff",
      ring: "rgba(237,243,255,0.14)",
      glow: "rgba(237,243,255,0.09)",
      border: "rgba(237,243,255,0.15)",
    },
  },
  {
    label: "Bills",
    href: "/bills",
    subtitle: "Due dates + payments",
    icon: Receipt,
    accent: {
      icon: "#ffd089",
      ring: "rgba(255,208,137,0.18)",
      glow: "rgba(255,208,137,0.10)",
      border: "rgba(255,208,137,0.16)",
    },
  },
  {
    label: "Debt",
    href: "/debt",
    subtitle: "Payoff + balances",
    icon: CreditCard,
    accent: {
      icon: "#ffb2c2",
      ring: "rgba(255,178,194,0.16)",
      glow: "rgba(255,178,194,0.10)",
      border: "rgba(255,178,194,0.16)",
    },
  },
  {
    label: "Income",
    href: "/income",
    subtitle: "Pay + goals",
    icon: Gem,
    accent: {
      icon: "#9ef0c0",
      ring: "rgba(158,240,192,0.16)",
      glow: "rgba(158,240,192,0.10)",
      border: "rgba(158,240,192,0.16)",
    },
  },
  {
    label: "Spending",
    href: "/spending",
    subtitle: "Daily control center",
    icon: PiggyBank,
    accent: {
      icon: "#9cf0ea",
      ring: "rgba(156,240,234,0.16)",
      glow: "rgba(156,240,234,0.10)",
      border: "rgba(156,240,234,0.16)",
    },
  },
  {
    label: "Investments",
    href: "/investments",
    subtitle: "Portfolio tracking",
    icon: TrendingUp,
    badge: "LIVE",
    accent: {
      icon: "#f6fbff",
      ring: "rgba(246,251,255,0.14)",
      glow: "rgba(246,251,255,0.09)",
      border: "rgba(246,251,255,0.15)",
    },
  },
  {
    label: "Savings",
    href: "/savings",
    subtitle: "Targets + progress",
    icon: Target,
    accent: {
      icon: "#a7ffc6",
      ring: "rgba(167,255,198,0.16)",
      glow: "rgba(167,255,198,0.10)",
      border: "rgba(167,255,198,0.16)",
    },
  },
  {
    label: "Admin",
    href: "/admin",
    subtitle: "Restricted controls",
    icon: Shield,
    accent: {
      icon: "#ffd898",
      ring: "rgba(255,216,152,0.16)",
      glow: "rgba(255,216,152,0.10)",
      border: "rgba(255,216,152,0.16)",
    },
  },
  {
    label: "Settings",
    href: "/settings",
    subtitle: "Profile + preferences",
    icon: UserCircle2,
    accent: {
      icon: "#eaf1ff",
      ring: "rgba(234,241,255,0.14)",
      glow: "rgba(234,241,255,0.09)",
      border: "rgba(234,241,255,0.15)",
    },
  },
];

function cx(...names) {
  return names.filter(Boolean).join(" ");
}

function isActive(pathname, href) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function itemAccentStyle(accent) {
  return {
    "--nav-icon": accent.icon,
    "--nav-ring": accent.ring,
    "--nav-glow": accent.glow,
    "--nav-border": accent.border,
  };
}

function NavItem({ item, active, collapsed, onNavigate }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cx(
        styles.navItem,
        active && styles.navItemActive,
        collapsed && styles.navItemCollapsed
      )}
      style={itemAccentStyle(item.accent)}
      title={collapsed ? item.label : undefined}
    >
      <div className={styles.navItemSheen} aria-hidden="true" />

      <div className={styles.navItemMain}>
        <div className={styles.navItemIconBox}>
          <Icon size={18} strokeWidth={2.1} />
        </div>

        <div className={styles.navItemCopy}>
          <div className={styles.navItemLabel}>{item.label}</div>
          <div className={styles.navItemSubtitle}>{item.subtitle}</div>
        </div>

        <div className={styles.navItemRight}>
          {item.badge ? (
            <div className={styles.navBadge}>{item.badge}</div>
          ) : null}
          <div className={styles.navIndicator} />
        </div>
      </div>
    </Link>
  );
}

export default function SideNav({
  collapsed = false,
  onToggle,
  onCloseMobile,
}) {
  const pathname = usePathname() || "";

  return (
    <div
      className={cx(styles.shell, collapsed && styles.shellCollapsed)}
    >
      <div className={styles.bgLayer} />
      <div className={styles.edgeGlow} />
      <div className={styles.sparkLayer} />

      <div className={styles.content}>
        <div className={styles.brandCard}>
          <div
            className={cx(
              styles.brandTop,
              collapsed && styles.brandTopCollapsed
            )}
          >
            <div className={styles.logoWrap}>
              <Image
                src="/brand/lcc-logo.png"
                alt="Life Command Center logo"
                width={54}
                height={54}
                priority
                className={styles.logo}
              />
            </div>

            <div className={styles.brandCopy}>
              <div className={styles.brandEyebrow}>Financial OS</div>
              <div className={styles.brandTitle}>
                Life Command
                <br />
                Center
              </div>
            </div>

            <div className={styles.brandActions}>
              <button
                type="button"
                onClick={onToggle}
                className={styles.desktopToggle}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {collapsed ? (
                  <PanelLeftOpen size={16} />
                ) : (
                  <PanelLeftClose size={16} />
                )}
              </button>

              <button
                type="button"
                onClick={onCloseMobile}
                className={styles.mobileClose}
                aria-label="Close navigation"
                title="Close navigation"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className={styles.sectionLabel}>Core</div>

        <nav className={styles.navList}>
          {NAV_ITEMS.map((item) => (
            <NavItem
              key={item.label}
              item={item}
              active={isActive(pathname, item.href)}
              collapsed={collapsed}
              onNavigate={onCloseMobile}
            />
          ))}
        </nav>
      </div>
    </div>
  );
}
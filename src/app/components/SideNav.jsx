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
  {
    label: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    accent: {
      icon: "#f3f6fb",
      border: "rgba(243,246,251,0.16)",
      glow: "rgba(243,246,251,0.10)",
    },
  },
  {
    label: "Calendar",
    href: "/calendar",
    icon: CalendarDays,
    accent: {
      icon: "#bde8ff",
      border: "rgba(189,232,255,0.18)",
      glow: "rgba(189,232,255,0.12)",
    },
  },
  {
    label: "Accounts",
    href: "/accounts",
    icon: Wallet,
    accent: {
      icon: "#eaf1ff",
      border: "rgba(234,241,255,0.16)",
      glow: "rgba(234,241,255,0.10)",
    },
  },
  {
    label: "Bills",
    href: "/bills",
    icon: Receipt,
    accent: {
      icon: "#ffd694",
      border: "rgba(255,214,148,0.20)",
      glow: "rgba(255,214,148,0.14)",
    },
  },
  {
    label: "Debt",
    href: "/debt",
    icon: CreditCard,
    accent: {
      icon: "#ffb8c9",
      border: "rgba(255,184,201,0.18)",
      glow: "rgba(255,184,201,0.12)",
    },
  },
  {
    label: "Income",
    href: "/income",
    icon: Gem,
    accent: {
      icon: "#a9f2c8",
      border: "rgba(169,242,200,0.18)",
      glow: "rgba(169,242,200,0.12)",
    },
  },
  {
    label: "Spending",
    href: "/spending",
    icon: PiggyBank,
    accent: {
      icon: "#9deee4",
      border: "rgba(157,238,228,0.18)",
      glow: "rgba(157,238,228,0.12)",
    },
  },
  {
    label: "Investments",
    href: "/investments",
    icon: TrendingUp,
    badge: "LIVE",
    accent: {
      icon: "#f4f7ff",
      border: "rgba(244,247,255,0.16)",
      glow: "rgba(244,247,255,0.10)",
    },
  },
  {
    label: "Savings",
    href: "/savings",
    icon: Target,
    accent: {
      icon: "#b5ffce",
      border: "rgba(181,255,206,0.18)",
      glow: "rgba(181,255,206,0.12)",
    },
  },
  {
    label: "Admin",
    href: "/admin",
    icon: Shield,
    accent: {
      icon: "#ffdba0",
      border: "rgba(255,219,160,0.18)",
      glow: "rgba(255,219,160,0.12)",
    },
  },
  {
    label: "Settings",
    href: "/settings",
    icon: UserCircle2,
    accent: {
      icon: "#eef3ff",
      border: "rgba(238,243,255,0.16)",
      glow: "rgba(238,243,255,0.10)",
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

function accentVars(accent) {
  return {
    "--nav-icon": accent.icon,
    "--nav-border": accent.border,
    "--nav-glow": accent.glow,
  };
}

function NavItem({ item, active, collapsed, onNavigate }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={() => onNavigate?.()}
      aria-current={active ? "page" : undefined}
      className={cx(
        styles.navItem,
        active && styles.navItemActive,
        collapsed && styles.navItemCollapsed
      )}
      style={accentVars(item.accent)}
      title={collapsed ? item.label : undefined}
    >
      <span className={styles.activeRail} />

      <div className={styles.iconBox}>
        <Icon size={18} strokeWidth={2.1} />
      </div>

      {!collapsed ? (
        <div className={styles.copy}>
          <div className={styles.label}>{item.label}</div>
        </div>
      ) : null}

      {!collapsed ? (
        <div className={styles.rightSlot}>
          {item.badge ? <span className={styles.badge}>{item.badge}</span> : null}
        </div>
      ) : null}
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

  return (
    <div
      className={cx(
        styles.shell,
        collapsed && !mobile && styles.shellCollapsed,
        mobile && styles.shellMobile
      )}
    >
      <div className={styles.shellGlow} />
      <div className={styles.shellEdge} />

      <div className={styles.inner}>
        <div className={cx(styles.brandRow, collapsed && !mobile && styles.brandRowCollapsed)}>
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
                width={44}
                height={44}
                priority
                className={styles.logo}
              />
            </div>
          </button>

          {!collapsed || mobile ? (
            <div className={styles.brandCopy}>
              <div className={styles.brandEyebrow}>Financial OS</div>
              <div className={styles.brandTitle}>Life Command Center</div>
            </div>
          ) : null}

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

        {mobile ? (
          <div className={styles.mobileSectionLabel}>
            <Menu size={13} />
            Workspace
          </div>
        ) : null}

        <nav className={styles.navList} aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => (
            <NavItem
              key={item.label}
              item={item}
              active={isActive(pathname, item.href)}
              collapsed={collapsed && !mobile}
              onNavigate={onCloseMobile}
            />
          ))}
        </nav>
      </div>
    </div>
  );
}
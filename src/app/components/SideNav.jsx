// src/app/components/SideNav.jsx
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
    icon: LayoutDashboard,
    accent: {
      icon: "#ffffff",
      border: "rgba(255,255,255,0.14)",
      glow: "rgba(255,255,255,0.10)",
    },
  },
  {
    label: "Calendar",
    href: "/calendar",
    icon: CalendarDays,
    accent: {
      icon: "#b9f2ff",
      border: "rgba(185,242,255,0.16)",
      glow: "rgba(185,242,255,0.10)",
    },
  },
  {
    label: "Accounts",
    href: "/accounts",
    icon: Wallet,
    accent: {
      icon: "#edf3ff",
      border: "rgba(237,243,255,0.15)",
      glow: "rgba(237,243,255,0.08)",
    },
  },
  {
    label: "Bills",
    href: "/bills",
    icon: Receipt,
    accent: {
      icon: "#ffd089",
      border: "rgba(255,208,137,0.16)",
      glow: "rgba(255,208,137,0.10)",
    },
  },
  {
    label: "Debt",
    href: "/debt",
    icon: CreditCard,
    accent: {
      icon: "#ffb3c7",
      border: "rgba(255,179,199,0.16)",
      glow: "rgba(255,179,199,0.10)",
    },
  },
  {
    label: "Income",
    href: "/income",
    icon: Gem,
    accent: {
      icon: "#9ef0c0",
      border: "rgba(158,240,192,0.16)",
      glow: "rgba(158,240,192,0.10)",
    },
  },
  {
    label: "Spending",
    href: "/spending",
    icon: PiggyBank,
    accent: {
      icon: "#9cf0ea",
      border: "rgba(156,240,234,0.16)",
      glow: "rgba(156,240,234,0.10)",
    },
  },
  {
    label: "Investments",
    href: "/investments",
    icon: TrendingUp,
    badge: "LIVE",
    accent: {
      icon: "#f6fbff",
      border: "rgba(246,251,255,0.15)",
      glow: "rgba(246,251,255,0.08)",
    },
  },
  {
    label: "Savings",
    href: "/savings",
    icon: Target,
    accent: {
      icon: "#a7ffc6",
      border: "rgba(167,255,198,0.16)",
      glow: "rgba(167,255,198,0.10)",
    },
  },
  {
    label: "Admin",
    href: "/admin",
    icon: Shield,
    accent: {
      icon: "#ffd898",
      border: "rgba(255,216,152,0.16)",
      glow: "rgba(255,216,152,0.10)",
    },
  },
  {
    label: "Settings",
    href: "/settings",
    icon: UserCircle2,
    accent: {
      icon: "#eaf1ff",
      border: "rgba(234,241,255,0.15)",
      glow: "rgba(234,241,255,0.08)",
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
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cx(
        styles.navItem,
        active && styles.navItemActive,
        collapsed && styles.navItemCollapsed
      )}
      style={accentVars(item.accent)}
      title={collapsed ? item.label : undefined}
    >
      <div className={styles.navItemMain}>
        <div className={styles.iconBox}>
          <Icon size={18} strokeWidth={2.15} />
        </div>

        {!collapsed ? (
          <div className={styles.labelWrap}>
            <div className={styles.label}>{item.label}</div>
          </div>
        ) : null}

        {!collapsed ? (
          <div className={styles.itemRight}>
            {item.badge ? <div className={styles.badge}>{item.badge}</div> : null}
            <div className={styles.dot} />
          </div>
        ) : null}
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
    <div className={cx(styles.shell, collapsed && styles.shellCollapsed)}>
      <div className={styles.shellGlow} />
      <div className={styles.shellEdge} />

      <div className={styles.inner}>
        <div className={cx(styles.brandRow, collapsed && styles.brandRowCollapsed)}>
          <div className={styles.logoWrap}>
            <Image
              src="/brand/lcc-logo.png"
              alt="Life Command Center logo"
              width={46}
              height={46}
              priority
              className={styles.logo}
            />
          </div>

          {!collapsed ? (
            <div className={styles.brandCopy}>
              <div className={styles.brandEyebrow}>Financial OS</div>
              <div className={styles.brandTitle}>Life Command Center</div>
            </div>
          ) : null}

          <div className={styles.brandActions}>
            <button
              type="button"
              onClick={onToggle}
              className={styles.desktopToggle}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
            </button>

            <button
              type="button"
              onClick={onCloseMobile}
              className={styles.mobileClose}
              aria-label="Close navigation"
              title="Close navigation"
            >
              <X size={15} />
            </button>
          </div>
        </div>

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
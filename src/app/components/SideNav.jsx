"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  CalendarDays,
  ChevronRight,
  CreditCard,
  FileText,
  Gem,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  PiggyBank,
  Receipt,
  Settings,
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
  { label: "Savings", href: "/savings", icon: Target, section: "money" },

  { label: "Portfolio", href: "/investments", icon: TrendingUp, section: "invest", badge: "LIVE" },
  { label: "Discover", href: "/investments/discover", icon: Activity, section: "invest" },
  { label: "Auto Invest", href: "/investments/auto", icon: Activity, section: "invest", badge: "NEW" },

  { label: "Refinance Analyzer", href: "/tools/refinance", icon: Landmark, section: "tools", badge: "NEW" },
  { label: "PFS Builder", href: "/tools/pfs", icon: FileText, section: "tools" },
];

const PROFILE_ITEMS = [
  {
    label: "Account center",
    note: "Profile, plan, billing, and workspace controls.",
    href: "/settings",
    icon: UserCircle2,
  },
  {
    label: "Settings",
    note: "Preferences and product behavior.",
    href: "/settings",
    icon: Settings,
  },
  {
    label: "Admin console",
    note: "Hidden system access for authorized users.",
    href: "/admin",
    icon: Shield,
  },
  {
    label: "Sign out",
    note: "Leave the command center cleanly.",
    href: "/logout",
    icon: LogOut,
  },
];

const SECTION_COPY = {
  overview: "Core system visibility and daily command pages.",
  money: "Cash flow, bills, debt, spending, savings, and account movement.",
  invest: "Portfolio desk, discover flow, market view, and auto-invest routes.",
  tools: "Standalone premium tools and future paid utility routes.",
};

function cx(...names) {
  return names.filter(Boolean).join(" ");
}

function isActive(pathname, href) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function resolveActiveItem(pathname) {
  if (pathname.startsWith("/market/")) {
    return NAV_ITEMS.find((item) => item.href === "/investments/discover");
  }
  return NAV_ITEMS.find((item) => isActive(pathname, item.href)) || NAV_ITEMS[0];
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

      <div className={styles.detailItemRight}>
        {item.badge ? <span className={styles.detailBadge}>{item.badge}</span> : null}
        <ChevronRight size={13} className={styles.detailArrow} />
      </div>
    </Link>
  );
}

function ProfileMenu({ open, compact = false, onNavigate }) {
  const pathname = usePathname() || "";

  if (!open) return null;

  return (
    <div className={cx(styles.profileMenu, compact ? styles.profileMenuCompact : styles.profileMenuExpanded)}>
      <div className={styles.profileMenuHead}>
        <div className={styles.profileAvatarLarge}>J</div>
        <div className={styles.profileMenuCopy}>
          <div className={styles.profileMenuName}>Jacob</div>
          <div className={styles.profileMenuPlan}>Life Command Center</div>
        </div>
      </div>

      <div className={styles.profileMetaCard}>
        <div className={styles.profileMetaLabel}>Workspace</div>
        <div className={styles.profileMetaValue}>Premium finance OS</div>
        <div className={styles.profileMetaSub}>
          Account and system controls live here so the main nav stays clean.
        </div>
      </div>

      <div className={styles.profileLinks}>
        {PROFILE_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);

          return (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href}
              className={cx(styles.profileLink, active && styles.profileLinkActive)}
              onClick={() => onNavigate?.()}
            >
              <div className={styles.profileLinkIcon}>
                <Icon size={15} strokeWidth={2} />
              </div>
              <div className={styles.profileLinkCopy}>
                <div className={styles.profileLinkTitle}>{item.label}</div>
                <div className={styles.profileLinkNote}>{item.note}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function ExpandedAccountButton({ open, onToggle }) {
  return (
    <button
      type="button"
      className={cx(styles.accountButton, open && styles.accountButtonOpen)}
      aria-expanded={open}
      aria-label="Open account menu"
      onClick={onToggle}
    >
      <div className={styles.accountAvatar}>J</div>
      <div className={styles.accountCopy}>
        <div className={styles.accountName}>Jacob</div>
        <div className={styles.accountPlan}>Account & settings</div>
      </div>
      <div className={styles.accountChevronWrap}>
        <ChevronRight size={14} className={cx(styles.accountChevron, open && styles.accountChevronOpen)} />
      </div>
    </button>
  );
}

function CompactAccountButton({ open, onToggle }) {
  return (
    <button
      type="button"
      className={cx(styles.compactAccountButton, open && styles.compactAccountButtonOpen)}
      aria-expanded={open}
      aria-label="Open account menu"
      title="Account"
      onClick={onToggle}
    >
      <div className={styles.profileAvatar}>J</div>
      <div className={styles.profileButtonGlow} />
    </button>
  );
}

export default function SideNav({
  collapsed = false,
  mobile = false,
  onToggle,
  onCloseMobile,
}) {
  const pathname = usePathname() || "";
  const [profileOpen, setProfileOpen] = useState(false);
  const compactProfileRef = useRef(null);
  const expandedProfileRef = useRef(null);

  const activeItem = resolveActiveItem(pathname);

  const overviewItems = useMemo(() => NAV_ITEMS.filter((item) => item.section === "overview"), []);
  const moneyItems = useMemo(() => NAV_ITEMS.filter((item) => item.section === "money"), []);
  const investItems = useMemo(() => NAV_ITEMS.filter((item) => item.section === "invest"), []);
  const toolItems = useMemo(() => NAV_ITEMS.filter((item) => item.section === "tools"), []);

  useEffect(() => {
    setProfileOpen(false);
  }, [pathname, collapsed, mobile]);

  useEffect(() => {
    function handlePointerDown(event) {
      const compactNode = compactProfileRef.current;
      const expandedNode = expandedProfileRef.current;
      const insideCompact = compactNode?.contains(event.target);
      const insideExpanded = expandedNode?.contains(event.target);

      if (!insideCompact && !insideExpanded) {
        setProfileOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setProfileOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  function handleNavigate() {
    setProfileOpen(false);
    onCloseMobile?.();
  }

  const showCompactAccount = collapsed || mobile;
  const activeSummaryCopy = SECTION_COPY[activeItem?.section] || SECTION_COPY.overview;

  return (
    <div
      className={cx(
        styles.shell,
        collapsed && styles.shellCollapsed,
        mobile && styles.shellMobile,
        mobile && collapsed && styles.shellMobileCollapsed
      )}
    >
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
                onClick={handleNavigate}
                className={cx(styles.iconButton, active && styles.iconButtonActive)}
                aria-current={active ? "page" : undefined}
                title={item.label}
              >
                <Icon size={18} strokeWidth={2} />
              </Link>
            );
          })}
        </nav>

        {showCompactAccount ? (
          <div className={styles.iconRailBottom} ref={compactProfileRef}>
            <CompactAccountButton open={profileOpen} onToggle={() => setProfileOpen((prev) => !prev)} />
            <ProfileMenu open={profileOpen} compact onNavigate={handleNavigate} />
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

      <div className={cx(styles.detailRail, collapsed && styles.detailRailCollapsed)}>
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
          <div className={styles.activeSummaryName}>{activeItem?.label || "Dashboard"}</div>
          <div className={styles.activeSummaryNote}>{activeSummaryCopy}</div>
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
                  onNavigate={handleNavigate}
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
                  onNavigate={handleNavigate}
                />
              ))}
            </div>
          </div>

          <div className={styles.detailSection}>
            <div className={styles.sectionLabel}>Invest</div>
            <div className={styles.detailList}>
              {investItems.map((item) => (
                <NavDetailItem
                  key={item.href}
                  item={item}
                  active={isActive(pathname, item.href)}
                  onNavigate={handleNavigate}
                />
              ))}
            </div>
          </div>

          <div className={styles.detailSection}>
            <div className={styles.sectionLabel}>Tools</div>
            <div className={styles.detailList}>
              {toolItems.map((item) => (
                <NavDetailItem
                  key={item.href}
                  item={item}
                  active={isActive(pathname, item.href)}
                  onNavigate={handleNavigate}
                />
              ))}
            </div>
          </div>
        </div>

        {!collapsed ? (
          <div className={styles.detailFooter} ref={expandedProfileRef}>
            <ExpandedAccountButton open={profileOpen} onToggle={() => setProfileOpen((prev) => !prev)} />
            <ProfileMenu open={profileOpen} onNavigate={handleNavigate} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

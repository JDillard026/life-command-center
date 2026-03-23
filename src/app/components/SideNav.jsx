"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Wallet,
  Receipt,
  CreditCard,
  Gem,
  PiggyBank,
  TrendingUp,
  Target,
  Shield,
  UserCircle2,
  X,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/", subtitle: "Today + next moves", icon: LayoutDashboard },
  { label: "Calendar", href: "/calendar", subtitle: "Timeline + recurring", icon: CalendarDays },
  { label: "Accounts", href: "/accounts", subtitle: "Balances + cash view", icon: Wallet },
  { label: "Bills", href: "/bills", subtitle: "Due dates + payments", icon: Receipt },
  { label: "Debt", href: "/debt", subtitle: "Payoff + balances", icon: CreditCard },
  { label: "Income", href: "/income", subtitle: "Pay + goals", icon: Gem },
  { label: "Spending", href: "/spending", subtitle: "Daily control center", icon: PiggyBank },
  { label: "Investments", href: "/investments", subtitle: "Portfolio tracking", icon: TrendingUp },
  { label: "Savings", href: "/savings", subtitle: "Targets + progress", icon: Target },
  { label: "Admin", href: "/admin", subtitle: "Restricted controls", icon: Shield },
  { label: "Settings", href: "/settings", subtitle: "Profile + app preferences", icon: UserCircle2 },
];

function isActive(pathname, href) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavItem({ item, active, collapsed, onNavigate }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={[
        "group relative block w-full rounded-[22px] border transition-all duration-200",
        "px-4 py-3",
        active
          ? "border-blue-400/30 bg-white/[0.06] shadow-[0_0_0_1px_rgba(96,165,250,0.08),0_0_24px_rgba(59,130,246,0.12)]"
          : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]",
        collapsed ? "lg:px-3" : "",
      ].join(" ")}
      title={item.label}
    >
      <div className={["flex items-center gap-3", collapsed ? "lg:justify-center" : ""].join(" ")}>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-white/10 bg-[#09111f]">
          <Icon className="h-5 w-5 text-white/85" />
        </div>

        <div className={["min-w-0 flex-1", collapsed ? "lg:hidden" : ""].join(" ")}>
          <div className="truncate text-[15px] font-extrabold text-white">{item.label}</div>
          <div className="mt-0.5 text-[12px] text-white/60">{item.subtitle}</div>
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
  const pathname = usePathname();

  function handleNavigate() {
    onCloseMobile?.();
  }

  return (
    <div className="side-nav-shell">
      <div className="side-nav-bg" />
      <div className="side-nav-grid" />
      <div className="side-nav-stars" />

      <div
        className={[
          "relative z-10 flex min-h-full flex-col px-4 pb-5 pt-4",
          collapsed ? "lg:px-3" : "",
        ].join(" ")}
      >
        <div
          className={[
            "mb-4 rounded-[24px] border border-white/10 p-4",
            "bg-[linear-gradient(180deg,rgba(7,14,28,0.92),rgba(3,8,18,0.96))]",
            collapsed ? "lg:px-2 lg:py-3" : "",
          ].join(" ")}
        >
          <div
            className={[
              "flex items-start gap-3.5",
              collapsed ? "lg:flex-col lg:items-center lg:justify-center lg:gap-3" : "",
            ].join(" ")}
          >
            <div className="flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-[20px] border border-white/14 bg-[#0a1426] text-[18px] font-black text-white">
              LCC
            </div>

            <div className={["min-w-0 flex-1", collapsed ? "lg:hidden" : ""].join(" ")}>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.26em] text-[#7fb2ff]">
                Financial OS
              </div>
              <div className="text-[16px] font-black leading-[0.96] tracking-[-0.03em] text-white">
                Life Command
                <br />
                Center
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onToggle}
                className="hidden h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/72 lg:flex"
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {collapsed ? "»" : "«"}
              </button>

              <button
                type="button"
                onClick={onCloseMobile}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/72 lg:hidden"
                aria-label="Close navigation"
                title="Close navigation"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className={["mb-3 px-1 text-[11px] font-bold uppercase tracking-[0.30em] text-white/42", collapsed ? "lg:hidden" : ""].join(" ")}>
          Core
        </div>

        <nav className="flex flex-col gap-2.5">
          {NAV_ITEMS.map((item) => (
            <NavItem
              key={item.href}
              item={item}
              active={isActive(pathname, item.href)}
              collapsed={collapsed}
              onNavigate={handleNavigate}
            />
          ))}
        </nav>
      </div>
    </div>
  );
}
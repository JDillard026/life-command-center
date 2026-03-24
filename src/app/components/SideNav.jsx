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
  TriangleAlert,
  UserCircle2,
  Wallet,
  X,
} from "lucide-react";

const NAV_ITEMS = [
  {
    label: "Dashboard",
    href: "/",
    subtitle: "Today + next moves",
    icon: LayoutDashboard,
    accent: {
      icon: "#f4f7ff",
      ring: "rgba(255,255,255,0.16)",
      glow: "rgba(255,255,255,0.10)",
      border: "rgba(255,255,255,0.16)",
    },
  },
  {
    label: "Calendar",
    href: "/calendar",
    subtitle: "Timeline + recurring",
    icon: CalendarDays,
    accent: {
      icon: "#83f3ff",
      ring: "rgba(131,243,255,0.16)",
      glow: "rgba(131,243,255,0.11)",
      border: "rgba(131,243,255,0.18)",
    },
  },
  {
    label: "Accounts",
    href: "/accounts",
    subtitle: "Balances + cash view",
    icon: Wallet,
    accent: {
      icon: "#eef2ff",
      ring: "rgba(238,242,255,0.14)",
      glow: "rgba(238,242,255,0.08)",
      border: "rgba(238,242,255,0.15)",
    },
  },
  {
    label: "Bills",
    href: "/bills",
    subtitle: "Due dates + payments",
    icon: Receipt,
    accent: {
      icon: "#ffc978",
      ring: "rgba(255,201,120,0.16)",
      glow: "rgba(255,201,120,0.10)",
      border: "rgba(255,201,120,0.18)",
    },
  },
  {
    label: "Debt",
    href: "/debt",
    subtitle: "Payoff + balances",
    icon: CreditCard,
    accent: {
      icon: "#ff9cb0",
      ring: "rgba(255,156,176,0.16)",
      glow: "rgba(255,156,176,0.10)",
      border: "rgba(255,156,176,0.18)",
    },
  },
  {
    label: "Income",
    href: "/income",
    subtitle: "Pay + goals",
    icon: Gem,
    accent: {
      icon: "#7cf0b0",
      ring: "rgba(124,240,176,0.16)",
      glow: "rgba(124,240,176,0.10)",
      border: "rgba(124,240,176,0.18)",
    },
  },
  {
    label: "Spending",
    href: "/spending",
    subtitle: "Daily control center",
    icon: PiggyBank,
    accent: {
      icon: "#7cf6ed",
      ring: "rgba(124,246,237,0.16)",
      glow: "rgba(124,246,237,0.10)",
      border: "rgba(124,246,237,0.18)",
    },
  },
  {
    label: "Investments",
    href: "/investments",
    subtitle: "Portfolio tracking",
    icon: TrendingUp,
    badge: "LIVE",
    accent: {
      icon: "#f5f8ff",
      ring: "rgba(245,248,255,0.14)",
      glow: "rgba(245,248,255,0.09)",
      border: "rgba(245,248,255,0.16)",
    },
  },
  {
    label: "Savings",
    href: "/savings",
    subtitle: "Targets + progress",
    icon: Target,
    accent: {
      icon: "#93ffbb",
      ring: "rgba(147,255,187,0.16)",
      glow: "rgba(147,255,187,0.10)",
      border: "rgba(147,255,187,0.18)",
    },
  },
  {
    label: "Admin",
    href: "/admin",
    subtitle: "Restricted controls",
    icon: Shield,
    accent: {
      icon: "#ffd17d",
      ring: "rgba(255,209,125,0.16)",
      glow: "rgba(255,209,125,0.10)",
      border: "rgba(255,209,125,0.18)",
    },
  },
  {
    label: "Settings",
    href: "/settings",
    subtitle: "Profile + app preferences",
    icon: UserCircle2,
    accent: {
      icon: "#e8edf8",
      ring: "rgba(232,237,248,0.14)",
      glow: "rgba(232,237,248,0.08)",
      border: "rgba(232,237,248,0.15)",
    },
  },
];

function isActive(pathname, href) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavIndicator({ item, active }) {
  const isAdmin = item.href === "/admin";

  if (isAdmin && active) {
    return (
      <div
        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border transition-all duration-300"
        style={{
          borderColor: "rgba(255,209,125,0.22)",
          background:
            "linear-gradient(180deg, rgba(23,18,10,0.96), rgba(12,9,5,0.98))",
          boxShadow:
            "0 0 18px rgba(255,209,125,0.10), inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        <TriangleAlert
          className="h-[14px] w-[14px]"
          strokeWidth={2.2}
          style={{
            color: "#ffd17d",
            filter: "drop-shadow(0 0 6px rgba(255,209,125,0.28))",
          }}
        />
      </div>
    );
  }

  return (
    <div
      className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border transition-all duration-300"
      style={{
        borderColor: active ? item.accent.border : "rgba(255,255,255,0.07)",
        background: active
          ? "linear-gradient(180deg, rgba(18,20,26,0.98), rgba(8,10,14,0.98))"
          : "linear-gradient(180deg, rgba(12,14,19,0.88), rgba(6,8,12,0.94))",
        boxShadow: active
          ? `0 0 18px ${item.accent.glow}, inset 0 1px 0 rgba(255,255,255,0.04)`
          : "inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
    >
      <span
        className="block rounded-full transition-all duration-300"
        style={{
          width: active ? 10 : 7,
          height: active ? 10 : 7,
          background: active ? item.accent.icon : "rgba(255,255,255,0.24)",
          boxShadow: active
            ? `0 0 0 6px ${item.accent.glow}, 0 0 14px ${item.accent.icon}`
            : "none",
        }}
      />
    </div>
  );
}

function NavCard({ item, active, collapsed = false, onNavigate }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      title={item.label}
      onClick={onNavigate}
      className={[
        "group relative block w-full overflow-hidden rounded-[26px] border transition-all duration-300",
        "px-4 py-3.5",
        collapsed ? "lg:px-3" : "",
      ].join(" ")}
      style={{
        background: active
          ? "linear-gradient(180deg, rgba(12,14,19,0.94), rgba(5,7,10,0.98))"
          : "linear-gradient(180deg, rgba(10,12,17,0.84), rgba(4,6,9,0.94))",
        borderColor: active ? item.accent.border : "rgba(255,255,255,0.06)",
        boxShadow: active
          ? `0 0 0 1px ${item.accent.border}, 0 18px 38px rgba(0,0,0,0.34), 0 0 26px ${item.accent.glow}, inset 0 1px 0 rgba(255,255,255,0.05)`
          : "0 14px 26px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-[26px]"
        style={{
          background: active
            ? `linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.01) 20%, transparent 44%), radial-gradient(circle at 84% 50%, ${item.accent.glow}, transparent 26%)`
            : "linear-gradient(135deg, rgba(255,255,255,0.035), rgba(255,255,255,0.008) 20%, transparent 44%)",
        }}
      />

      <div
        className={[
          "relative z-10 flex items-center gap-3",
          collapsed ? "lg:justify-center" : "",
        ].join(" ")}
      >
        <div
          className={[
            "flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[18px] border",
            collapsed ? "lg:h-[56px] lg:w-[56px]" : "",
          ].join(" ")}
          style={{
            borderColor: item.accent.ring,
            background:
              "linear-gradient(180deg, rgba(16,18,24,0.96), rgba(7,9,13,0.98))",
            boxShadow: `0 0 20px ${item.accent.glow}, inset 0 1px 0 rgba(255,255,255,0.04)`,
          }}
        >
          <Icon
            className="h-[19px] w-[19px]"
            strokeWidth={2.1}
            style={{ color: item.accent.icon }}
          />
        </div>

        <div className={["min-w-0 flex-1", collapsed ? "lg:hidden" : ""].join(" ")}>
          <div className="text-[15px] font-black leading-[1.02] tracking-[-0.025em] text-white">
            {item.label}
          </div>
          <div className="mt-0.5 text-[12px] font-medium leading-[1.15] text-white/56">
            {item.subtitle}
          </div>
        </div>

        <div
          className={[
            "flex shrink-0 items-center gap-2",
            collapsed ? "lg:hidden" : "",
          ].join(" ")}
        >
          {item.badge ? (
            <div
              className="rounded-full border px-2 py-0.5 text-[10px] font-black tracking-[0.13em] text-white"
              style={{
                borderColor: "rgba(124,240,176,0.18)",
                background:
                  "linear-gradient(180deg, rgba(11,18,14,0.92), rgba(7,10,8,0.98))",
                boxShadow: active
                  ? "0 0 12px rgba(124,240,176,0.08)"
                  : "none",
              }}
            >
              {item.badge}
            </div>
          ) : null}

          <NavIndicator item={item} active={active} />
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

      <div className="pointer-events-none absolute -left-16 top-6 h-48 w-48 rounded-full bg-white/[0.035] blur-3xl" />
      <div className="pointer-events-none absolute bottom-10 right-[-40px] h-56 w-56 rounded-full bg-emerald-300/[0.035] blur-3xl" />
      <div className="pointer-events-none absolute right-8 top-20 h-40 w-40 rounded-full bg-amber-200/[0.025] blur-3xl" />

      <div
        className={[
          "relative z-10 flex min-h-full flex-col px-4 pb-5 pt-4",
          collapsed ? "lg:px-3" : "",
        ].join(" ")}
      >
        <div
          className={[
            "mb-4 rounded-[28px] border border-white/10 p-4 transition-all duration-300",
            collapsed ? "lg:px-2.5 lg:py-3" : "",
          ].join(" ")}
          style={{
            background:
              "linear-gradient(180deg, rgba(10,12,17,0.88), rgba(5,6,9,0.96))",
            boxShadow:
              "0 18px 34px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.05)",
          }}
        >
          <div
            className={[
              "flex items-start gap-3.5",
              collapsed
                ? "lg:flex-col lg:items-center lg:justify-center lg:gap-3"
                : "",
            ].join(" ")}
          >
            <div
              className="relative flex h-[74px] w-[74px] shrink-0 items-center justify-center overflow-hidden rounded-[24px] border border-white/12"
              style={{
                background:
                  "linear-gradient(180deg, rgba(20,22,28,0.96), rgba(7,8,12,1))",
                boxShadow:
                  "0 0 0 1px rgba(255,255,255,0.03), 0 18px 28px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
            >
              <Image
                src="/brand/lcc-logo.png"
                alt="Life Command Center logo"
                fill
                sizes="74px"
                className="object-contain p-2.5"
                priority
              />
            </div>

            <div className={["min-w-0 flex-1", collapsed ? "lg:hidden" : ""].join(" ")}>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.26em] text-white/48">
                Financial OS
              </div>
              <div className="text-[16px] font-black leading-[0.98] tracking-[-0.03em] text-white">
                Life Command
                <br />
                Center
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={onToggle}
                className="hidden h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] text-white/72 transition hover:bg-white/[0.06] lg:flex"
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {collapsed ? (
                  <PanelLeftOpen className="h-4.5 w-4.5" />
                ) : (
                  <PanelLeftClose className="h-4.5 w-4.5" />
                )}
              </button>

              <button
                type="button"
                onClick={onCloseMobile}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] text-white/72 transition hover:bg-white/[0.06] lg:hidden"
                aria-label="Close navigation"
                title="Close navigation"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>
        </div>

        <div
          className={[
            "mb-3 px-1 text-[11px] font-bold uppercase tracking-[0.30em] text-white/34",
            collapsed ? "lg:hidden" : "",
          ].join(" ")}
        >
          Core
        </div>

        <nav className="flex flex-col gap-2.5 pb-4">
          {NAV_ITEMS.map((item) => (
            <NavCard
              key={item.label}
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
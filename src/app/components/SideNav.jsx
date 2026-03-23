"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CreditCard,
  Gem,
  LayoutDashboard,
  PiggyBank,
  Receipt,
  Shield,
  Target,
  TrendingUp,
  UserCircle2,
  Wallet,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";

const NAV_ITEMS = [
  {
    label: "Dashboard",
    href: "/",
    subtitle: "Today + next moves",
    icon: LayoutDashboard,
    accent: {
      icon: "#7ea7ff",
      ring: "rgba(82,122,255,0.18)",
      glow: "rgba(82,122,255,0.18)",
      border: "rgba(110,145,255,0.42)",
    },
  },
  {
    label: "Calendar",
    href: "/calendar",
    subtitle: "Timeline + recurring",
    icon: CalendarDays,
    accent: {
      icon: "#45e7df",
      ring: "rgba(31,211,201,0.18)",
      glow: "rgba(31,211,201,0.18)",
      border: "rgba(75,231,223,0.34)",
    },
  },
  {
    label: "Accounts",
    href: "/accounts",
    subtitle: "Balances + cash view",
    icon: Wallet,
    accent: {
      icon: "#e7edf8",
      ring: "rgba(205,217,234,0.14)",
      glow: "rgba(205,217,234,0.10)",
      border: "rgba(205,217,234,0.24)",
    },
  },
  {
    label: "Bills",
    href: "/bills",
    subtitle: "Due dates + payments",
    icon: Receipt,
    accent: {
      icon: "#ffc86b",
      ring: "rgba(255,193,92,0.16)",
      glow: "rgba(255,193,92,0.16)",
      border: "rgba(255,200,107,0.34)",
    },
  },
  {
    label: "Debt",
    href: "/debt",
    subtitle: "Payoff + balances",
    icon: CreditCard,
    accent: {
      icon: "#ffb4c0",
      ring: "rgba(255,127,149,0.16)",
      glow: "rgba(255,127,149,0.16)",
      border: "rgba(255,180,192,0.32)",
    },
  },
  {
    label: "Income",
    href: "/income",
    subtitle: "Pay + goals",
    icon: Gem,
    accent: {
      icon: "#7ff0b5",
      ring: "rgba(69,225,143,0.16)",
      glow: "rgba(69,225,143,0.16)",
      border: "rgba(127,240,181,0.32)",
    },
  },
  {
    label: "Spending",
    href: "/spending",
    subtitle: "Daily control center",
    icon: PiggyBank,
    accent: {
      icon: "#5ce9de",
      ring: "rgba(56,219,208,0.16)",
      glow: "rgba(56,219,208,0.16)",
      border: "rgba(92,233,222,0.32)",
    },
  },
  {
    label: "Investments",
    href: "/investments",
    subtitle: "Portfolio tracking",
    icon: TrendingUp,
    badge: "LIVE",
    accent: {
      icon: "#d7e4ff",
      ring: "rgba(103,137,255,0.22)",
      glow: "rgba(103,137,255,0.16)",
      border: "rgba(140,170,255,0.34)",
    },
  },
  {
    label: "Savings",
    href: "/savings",
    subtitle: "Targets + progress",
    icon: Target,
    accent: {
      icon: "#88f7b8",
      ring: "rgba(66,228,136,0.16)",
      glow: "rgba(66,228,136,0.16)",
      border: "rgba(136,247,184,0.30)",
    },
  },
  {
    label: "Admin",
    href: "/admin",
    subtitle: "Restricted controls",
    icon: Shield,
    accent: {
      icon: "#ffcf70",
      ring: "rgba(255,207,112,0.18)",
      glow: "rgba(255,207,112,0.16)",
      border: "rgba(255,207,112,0.32)",
    },
  },
  {
    label: "Settings",
    href: "/settings",
    subtitle: "Profile + app preferences",
    icon: UserCircle2,
    accent: {
      icon: "#dce6ff",
      ring: "rgba(181,203,255,0.16)",
      glow: "rgba(131,163,255,0.14)",
      border: "rgba(181,203,255,0.28)",
    },
  },
];

function isActive(pathname, href) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavCard({ item, active, collapsed = false, onNavigate }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      title={item.label}
      onClick={onNavigate}
      className={[
        "group relative block w-full overflow-hidden rounded-[24px] border transition-all duration-300",
        "px-4 py-3.5",
        collapsed ? "lg:px-3" : "",
      ].join(" ")}
      style={{
        background: active
          ? "linear-gradient(180deg, rgba(10,18,38,0.98), rgba(5,10,22,1))"
          : "linear-gradient(180deg, rgba(5,11,24,0.92), rgba(2,7,16,0.98))",
        borderColor: active ? item.accent.border : "rgba(255,255,255,0.07)",
        boxShadow: active
          ? `0 0 0 1px ${item.accent.border}, 0 0 28px ${item.accent.glow}, 0 0 56px rgba(22,30,60,0.34), inset 0 1px 0 rgba(255,255,255,0.05)`
          : "0 12px 24px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
    >
      {active && !collapsed && (
        <div
          className="pointer-events-none absolute inset-0 rounded-[24px]"
          style={{
            background: `radial-gradient(circle at 78% 50%, ${item.accent.glow}, transparent 30%), radial-gradient(circle at 20% 50%, rgba(255,255,255,0.03), transparent 42%)`,
          }}
        />
      )}

      <div
        className={[
          "relative z-10 flex items-center gap-3",
          collapsed ? "lg:justify-center" : "",
        ].join(" ")}
      >
        <div
          className={[
            "flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-[16px] border",
            collapsed ? "lg:h-[54px] lg:w-[54px]" : "",
          ].join(" ")}
          style={{
            borderColor: item.accent.ring,
            background:
              "linear-gradient(180deg, rgba(8,14,28,0.98), rgba(4,9,18,0.98))",
            boxShadow: `0 0 18px ${item.accent.glow}`,
          }}
        >
          <Icon
            className="h-[19px] w-[19px]"
            strokeWidth={2.15}
            style={{ color: item.accent.icon }}
          />
        </div>

        <div className={["min-w-0 flex-1", collapsed ? "lg:hidden" : ""].join(" ")}>
          <div className="text-[15px] font-black leading-[1.02] tracking-[-0.025em] text-white">
            {item.label}
          </div>
          <div className="mt-0.5 text-[12px] font-medium leading-[1.15] text-white/62">
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
                borderColor: active
                  ? "rgba(116,149,255,0.28)"
                  : "rgba(255,255,255,0.10)",
                background:
                  "linear-gradient(180deg, rgba(17,24,41,0.90), rgba(10,16,30,0.98))",
                boxShadow: active ? "0 0 10px rgba(70,108,255,0.12)" : "none",
              }}
            >
              {item.badge}
            </div>
          ) : null}

          <div
            className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full border transition-all duration-300"
            style={{
              borderColor: active
                ? item.accent.border
                : "rgba(255,255,255,0.08)",
              background: active
                ? "linear-gradient(180deg, rgba(18,28,48,0.96), rgba(10,16,30,0.98))"
                : "linear-gradient(180deg, rgba(15,22,38,0.74), rgba(10,16,28,0.92))",
              boxShadow: active
                ? `0 0 14px ${item.accent.glow}, inset 0 0 10px rgba(255,255,255,0.02)`
                : "none",
            }}
          >
            <span
              className="block rounded-full transition-all duration-300"
              style={{
                width: active ? "10px" : "7px",
                height: active ? "10px" : "7px",
                background: active ? item.accent.icon : "rgba(255,255,255,0.28)",
                boxShadow: active
                  ? `0 0 0 5px ${item.accent.glow}, 0 0 14px ${item.accent.icon}`
                  : "none",
              }}
            />
          </div>
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

      <div className="pointer-events-none absolute -left-24 top-0 h-56 w-56 rounded-full bg-blue-500/12 blur-3xl" />
      <div className="pointer-events-none absolute bottom-12 right-0 h-64 w-64 rounded-full bg-cyan-400/8 blur-3xl" />

      <div
        className={[
          "relative z-10 flex min-h-full flex-col px-4 pb-5 pt-4",
          collapsed ? "lg:px-3" : "",
        ].join(" ")}
      >
        <div
          className={[
            "mb-4 rounded-[26px] border border-white/10 p-4 transition-all duration-300",
            collapsed ? "lg:px-2.5 lg:py-3" : "",
          ].join(" ")}
          style={{
            background:
              "linear-gradient(180deg, rgba(7,14,28,0.92), rgba(3,8,18,0.96))",
            boxShadow:
              "0 12px 28px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.04)",
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
              className="relative flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-[22px] border border-white/14"
              style={{
                background:
                  "radial-gradient(circle at 50% 35%, rgba(86,140,255,0.20), transparent 58%), linear-gradient(180deg, rgba(16,26,46,0.98), rgba(6,11,20,1))",
                boxShadow:
                  "0 0 0 1px rgba(108,142,255,0.06), 0 0 18px rgba(73,110,220,0.11), inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
            >
              <Image
                src="/brand/lcc-logo.png"
                alt="Life Command Center logo"
                fill
                sizes="72px"
                className="object-contain p-2.5"
                priority
              />
            </div>

            <div className={["min-w-0 flex-1", collapsed ? "lg:hidden" : ""].join(" ")}>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.26em] text-[#7fb2ff]">
                Financial OS
              </div>
              <div className="text-[15px] font-black leading-[0.98] tracking-[-0.03em] text-white">
                Life Command
                <br />
                Center
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={onToggle}
                className="hidden h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/72 transition hover:bg-white/[0.07] lg:flex"
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
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/72 transition hover:bg-white/[0.07] lg:hidden"
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
            "mb-3 px-1 text-[11px] font-bold uppercase tracking-[0.30em] text-white/42",
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
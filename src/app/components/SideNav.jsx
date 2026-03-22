"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  CreditCard,
  Gem,
  LayoutDashboard,
  PiggyBank,
  Receipt,
  Settings,
  Shield,
  Target,
  TrendingUp,
  UserCircle2,
  Wallet,
} from "lucide-react";
import { getCurrentUserRole } from "@/lib/getCurrentUserRole";

const NAV_ITEMS = [
  {
    label: "Dashboard",
    href: "/",
    subtitle: "Today + next moves",
    icon: LayoutDashboard,
    accent: {
      icon: "#7ea7ff",
      ring: "rgba(82,122,255,0.16)",
      glow: "rgba(82,122,255,0.10)",
    },
  },
  {
    label: "Calendar",
    href: "/calendar",
    subtitle: "Timeline + recurring",
    icon: CalendarDays,
    accent: {
      icon: "#45e7df",
      ring: "rgba(31,211,201,0.16)",
      glow: "rgba(31,211,201,0.10)",
    },
  },
  {
    label: "Accounts",
    href: "/accounts",
    subtitle: "Balances + cash view",
    icon: Wallet,
    accent: {
      icon: "#e7edf8",
      ring: "rgba(205,217,234,0.12)",
      glow: "rgba(205,217,234,0.08)",
    },
  },
  {
    label: "Bills",
    href: "/bills",
    subtitle: "Due dates + payments",
    icon: Receipt,
    accent: {
      icon: "#ffc86b",
      ring: "rgba(255,193,92,0.14)",
      glow: "rgba(255,193,92,0.10)",
    },
  },
  {
    label: "Debt",
    href: "/debt",
    subtitle: "Payoff + balances",
    icon: CreditCard,
    accent: {
      icon: "#ffb4c0",
      ring: "rgba(255,127,149,0.14)",
      glow: "rgba(255,127,149,0.10)",
    },
  },
  {
    label: "Income",
    href: "/income",
    subtitle: "Pay + goals",
    icon: Gem,
    accent: {
      icon: "#7ff0b5",
      ring: "rgba(69,225,143,0.14)",
      glow: "rgba(69,225,143,0.10)",
    },
  },
  {
    label: "Spending",
    href: "/spending",
    subtitle: "Daily control center",
    icon: PiggyBank,
    accent: {
      icon: "#5ce9de",
      ring: "rgba(56,219,208,0.14)",
      glow: "rgba(56,219,208,0.10)",
    },
  },
  {
    label: "Investments",
    href: "/investments",
    subtitle: "Portfolio tracking",
    icon: TrendingUp,
    accent: {
      icon: "#d7e4ff",
      ring: "rgba(103,137,255,0.20)",
      glow: "rgba(103,137,255,0.12)",
    },
    badge: "LIVE",
  },
  {
    label: "Savings",
    href: "/savings",
    subtitle: "Targets + progress",
    icon: Target,
    accent: {
      icon: "#88f7b8",
      ring: "rgba(66,228,136,0.14)",
      glow: "rgba(66,228,136,0.10)",
    },
  },
];

const ADMIN_ITEM = {
  label: "Admin",
  href: "/admin",
  subtitle: "Restricted controls",
  icon: Shield,
  accent: {
    icon: "#ffcf70",
    ring: "rgba(255,207,112,0.18)",
    glow: "rgba(255,207,112,0.12)",
  },
};

function isActive(pathname, href) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavCard({ item, active }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className="group relative block overflow-hidden rounded-[22px] border px-3 py-2.5 transition-all duration-300"
      style={{
        background: active
          ? "linear-gradient(180deg, rgba(8,15,32,0.97), rgba(4,9,20,0.99))"
          : "linear-gradient(180deg, rgba(5,11,24,0.90), rgba(2,7,16,0.95))",
        borderColor: active
          ? "rgba(104,139,255,0.32)"
          : "rgba(255,255,255,0.06)",
        boxShadow: active
          ? "0 0 0 1px rgba(98,132,255,0.08), 0 0 20px rgba(72,108,255,0.12), inset 0 1px 0 rgba(255,255,255,0.04)"
          : "0 10px 20px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
    >
      {active && (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_left_center,_rgba(86,124,255,0.11),_transparent_44%)]" />
      )}

      <div className="relative z-10 flex items-center gap-3">
        <div
          className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[14px] border"
          style={{
            borderColor: item.accent.ring,
            background:
              "linear-gradient(180deg, rgba(8,14,28,0.98), rgba(4,9,18,0.98))",
            boxShadow: `0 0 14px ${item.accent.glow}`,
          }}
        >
          <Icon
            className="h-[18px] w-[18px]"
            strokeWidth={2.2}
            style={{ color: item.accent.icon }}
          />
        </div>

        <div className="min-w-0 flex-1 pr-1">
          <div className="truncate text-[13px] font-black leading-[1.02] tracking-[-0.02em] text-white">
            {item.label}
          </div>
          <div className="mt-0.5 text-[10px] font-medium leading-[1.12] text-white/60">
            {item.subtitle}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {item.badge ? (
            <div
              className="rounded-full border px-2 py-1 text-[9px] font-black tracking-[0.14em] text-white"
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
            className="flex h-[30px] w-[30px] items-center justify-center rounded-full border transition-all duration-300 group-hover:translate-x-0.5"
            style={{
              borderColor: active
                ? "rgba(110,145,255,0.18)"
                : "rgba(255,255,255,0.06)",
              background:
                "linear-gradient(180deg, rgba(15,22,38,0.72), rgba(10,16,28,0.90))",
            }}
          >
            <ArrowUpRight className="h-3.5 w-3.5 text-white/62" />
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function SideNav() {
  const pathname = usePathname();
  const settingsActive = isActive(pathname, "/settings");
  const [role, setRole] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function loadRole() {
      const { role } = await getCurrentUserRole();
      if (!mounted) return;
      setRole(role ?? "user");
    }

    loadRole();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <aside className="relative min-h-screen w-[280px] overflow-hidden border-r border-white/8 bg-[#040915] text-white">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#07122b_0%,#040915_45%,#07111d_100%)]" />

      <div
        className="absolute inset-0 opacity-[0.10]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(120,150,220,0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(120,150,220,0.08) 1px, transparent 1px)
          `,
          backgroundSize: "32px 32px",
        }}
      />

      <div
        className="absolute inset-0 opacity-[0.70]"
        style={{
          backgroundImage: `
            radial-gradient(1.2px 1.2px at 20px 22px, rgba(255,255,255,0.70), transparent 60%),
            radial-gradient(1px 1px at 92px 108px, rgba(124,170,255,0.58), transparent 60%),
            radial-gradient(1px 1px at 154px 58px, rgba(255,255,255,0.48), transparent 60%),
            radial-gradient(1px 1px at 52px 182px, rgba(89,228,226,0.24), transparent 60%),
            radial-gradient(1px 1px at 188px 146px, rgba(255,255,255,0.38), transparent 60%),
            radial-gradient(1px 1px at 118px 232px, rgba(124,170,255,0.34), transparent 60%)
          `,
          backgroundSize: "220px 220px",
        }}
      />

      <div className="pointer-events-none absolute -left-24 top-0 h-56 w-56 rounded-full bg-blue-500/12 blur-3xl" />
      <div className="pointer-events-none absolute bottom-12 right-0 h-64 w-64 rounded-full bg-cyan-400/8 blur-3xl" />

      <div className="relative z-10 flex min-h-screen flex-col px-3 pb-4 pt-4">
        <div
          className="mb-4 rounded-[24px] border border-white/10 p-3"
          style={{
            background:
              "linear-gradient(180deg, rgba(7,14,28,0.92), rgba(3,8,18,0.96))",
            boxShadow:
              "0 12px 28px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="relative h-[60px] w-[60px] shrink-0 overflow-hidden rounded-[18px] border border-white/14"
              style={{
                background:
                  "radial-gradient(circle at 50% 35%, rgba(86,140,255,0.20), transparent 58%), linear-gradient(180deg, rgba(16,26,46,0.98), rgba(6,11,20,1))",
                boxShadow:
                  "0 0 0 1px rgba(108,142,255,0.06), 0 0 16px rgba(73,110,220,0.10), inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
            >
              <Image
                src="/brand/lcc-logo.png"
                alt="Life Command Center logo"
                fill
                sizes="60px"
                className="object-contain p-2"
                priority
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-1 text-[9px] font-semibold uppercase tracking-[0.24em] text-[#7fb2ff]">
                Financial OS
              </div>
              <div className="text-[15px] font-black leading-[0.96] tracking-[-0.03em] text-white">
                Life Command
                <br />
                Center
              </div>

              {role === "admin" && (
                <div className="mt-2 inline-flex items-center rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-amber-300">
                  Admin Access
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mb-3 px-1 text-[11px] font-bold uppercase tracking-[0.30em] text-white/42">
          Core
        </div>

        <nav className="flex flex-col gap-3">
          {NAV_ITEMS.map((item) => (
            <NavCard
              key={item.label}
              item={item}
              active={isActive(pathname, item.href)}
            />
          ))}

          {role === "admin" && (
            <NavCard
              item={ADMIN_ITEM}
              active={isActive(pathname, ADMIN_ITEM.href)}
            />
          )}
        </nav>

        <div className="mt-4">
          <Link
            href="/settings"
            className="group relative block overflow-hidden rounded-[22px] border px-3 py-2.5 transition-all duration-300"
            style={{
              background: settingsActive
                ? "linear-gradient(180deg, rgba(8,15,32,0.97), rgba(4,9,20,0.99))"
                : "linear-gradient(180deg, rgba(5,11,24,0.90), rgba(2,7,16,0.95))",
              borderColor: settingsActive
                ? "rgba(104,139,255,0.32)"
                : "rgba(255,255,255,0.06)",
              boxShadow: settingsActive
                ? "0 0 0 1px rgba(98,132,255,0.08), 0 0 20px rgba(72,108,255,0.12), inset 0 1px 0 rgba(255,255,255,0.04)"
                : "0 10px 20px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.03)",
            }}
          >
            <div className="relative z-10 flex items-center gap-3">
              <div
                className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[14px] border"
                style={{
                  borderColor: "rgba(190,210,255,0.14)",
                  background:
                    "linear-gradient(180deg, rgba(8,14,28,0.98), rgba(4,9,18,0.98))",
                }}
              >
                <UserCircle2 className="h-[18px] w-[18px] text-white/82" />
              </div>

              <div className="min-w-0 flex-1 pr-1">
                <div className="truncate text-[13px] font-black leading-[1.02] tracking-[-0.02em] text-white">
                  Settings
                </div>
                <div className="mt-0.5 text-[10px] font-medium leading-[1.12] text-white/60">
                  Profile + app preferences
                </div>
              </div>

              <div
                className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border"
                style={{
                  borderColor: settingsActive
                    ? "rgba(110,145,255,0.18)"
                    : "rgba(255,255,255,0.06)",
                  background:
                    "linear-gradient(180deg, rgba(15,22,38,0.72), rgba(10,16,28,0.90))",
                }}
              >
                <Settings className="h-3.5 w-3.5 text-white/62" />
              </div>
            </div>
          </Link>
        </div>
      </div>
    </aside>
  );
}
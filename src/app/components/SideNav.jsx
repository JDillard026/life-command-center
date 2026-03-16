"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const MAIN_LINKS = [
  { href: "/", label: "Dashboard", meta: "Today + next moves", icon: "◈" },
  { href: "/calendar", label: "Calendar", meta: "Timeline + recurring", icon: "○" },
  { href: "/accounts", label: "Accounts", meta: "Balances + cash view", icon: "◍" },
  { href: "/bills", label: "Bills", meta: "Due dates + payments", icon: "◉" },
  { href: "/debt", label: "Debt", meta: "Payoff + balances", icon: "△" },
  { href: "/income", label: "Income", meta: "Pay + goals", icon: "▣" },
  { href: "/spending", label: "Spending", meta: "Daily control center", icon: "◐" },
  { href: "/investments", label: "Investments", meta: "Portfolio tracking", icon: "⬡" },
  { href: "/savings", label: "Savings", meta: "Targets + progress", icon: "◎" },
];

const SYSTEM_LINKS = [
  { href: "/settings", label: "Settings", meta: "Account + integrations", icon: "✦" },
];

function isActive(path, href) {
  if (href === "/") return path === "/";
  return path === href || path.startsWith(`${href}/`);
}

function NavItem({ href, label, meta, icon, active }) {
  return (
    <Link
      href={href}
      className="group relative block"
      style={{ textDecoration: "none" }}
    >
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 22,
          border: active
            ? "1px solid rgba(80,190,255,0.28)"
            : "1px solid rgba(255,255,255,0.07)",
          background: active
            ? "linear-gradient(180deg, rgba(19,55,87,0.88), rgba(8,24,42,0.92))"
            : "linear-gradient(180deg, rgba(8,12,24,0.86), rgba(6,10,20,0.94))",
          boxShadow: active
            ? "0 16px 34px rgba(24,119,242,0.16), inset 0 1px 0 rgba(255,255,255,0.04)"
            : "0 12px 28px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.02)",
          transition: "all .18s ease",
          transform: active ? "translateY(-1px)" : "translateY(0)",
        }}
      >
        {active ? (
          <>
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 14,
                bottom: 14,
                width: 3,
                borderRadius: "0 999px 999px 0",
                background: "linear-gradient(180deg, #7dd3fc, #38bdf8)",
                boxShadow: "0 0 18px rgba(56,189,248,0.7)",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "radial-gradient(circle at 0% 50%, rgba(56,189,248,0.12), transparent 32%)",
                pointerEvents: "none",
              }}
            />
          </>
        ) : null}

        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "flex-start",
            padding: "14px 14px 14px 16px",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 16,
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              fontSize: 13,
              fontWeight: 900,
              color: active ? "#d9f3ff" : "rgba(255,255,255,0.66)",
              border: active
                ? "1px solid rgba(125,211,252,0.18)"
                : "1px solid rgba(255,255,255,0.08)",
              background: active
                ? "linear-gradient(180deg, rgba(56,189,248,0.14), rgba(56,189,248,0.08))"
                : "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
              boxShadow: active
                ? "0 0 24px rgba(56,189,248,0.14)"
                : "none",
            }}
          >
            {icon}
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
                alignItems: "center",
              }}
            >
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 900,
                  color: active ? "rgba(255,255,255,0.98)" : "rgba(255,255,255,0.88)",
                  lineHeight: 1.1,
                }}
              >
                {label}
              </div>

              <div
                style={{
                  fontSize: 10,
                  fontWeight: 900,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  padding: "4px 8px",
                  borderRadius: 999,
                  color: active ? "#c7eeff" : "rgba(255,255,255,0.34)",
                  background: active
                    ? "rgba(56,189,248,0.12)"
                    : "rgba(255,255,255,0.04)",
                  border: active
                    ? "1px solid rgba(125,211,252,0.10)"
                    : "1px solid rgba(255,255,255,0.04)",
                }}
              >
                {active ? "Live" : "Go"}
              </div>
            </div>

            <div
              style={{
                marginTop: 5,
                fontSize: 12,
                lineHeight: 1.35,
                color: active ? "rgba(255,255,255,0.58)" : "rgba(255,255,255,0.42)",
              }}
            >
              {meta}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function SideNav() {
  const path = usePathname();

  return (
    <aside
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        gap: 14,
      }}
    >
      <div
        style={{
          borderRadius: 28,
          border: "1px solid rgba(255,255,255,0.08)",
          background:
            "radial-gradient(circle at 0% 0%, rgba(59,130,246,0.18), transparent 34%), linear-gradient(180deg, rgba(8,12,24,0.96), rgba(6,10,19,0.98))",
          boxShadow: "0 22px 44px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.03)",
          padding: 16,
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 18,
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              fontSize: 22,
              fontWeight: 950,
              color: "#d7f0ff",
              border: "1px solid rgba(125,211,252,0.16)",
              background:
                "linear-gradient(180deg, rgba(56,189,248,0.14), rgba(37,99,235,0.10))",
              boxShadow: "0 0 26px rgba(56,189,248,0.12)",
            }}
          >
            LC
          </div>

          <div>
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                color: "rgba(125,211,252,0.78)",
                fontWeight: 900,
              }}
            >
              Financial OS
            </div>

            <div
              style={{
                marginTop: 6,
                fontSize: 18,
                fontWeight: 950,
                lineHeight: 1.1,
                color: "rgba(255,255,255,0.98)",
              }}
            >
              Life Command Center
            </div>

            <div
              style={{
                marginTop: 8,
                fontSize: 13,
                lineHeight: 1.5,
                color: "rgba(255,255,255,0.54)",
              }}
            >
              Control your money, bills, debt, investing, and goals in one place.
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          borderRadius: 28,
          border: "1px solid rgba(255,255,255,0.08)",
          background:
            "radial-gradient(circle at 100% 0%, rgba(34,197,94,0.08), transparent 28%), linear-gradient(180deg, rgba(8,12,24,0.94), rgba(6,10,18,0.98))",
          boxShadow: "0 18px 38px rgba(0,0,0,0.18)",
          padding: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.42)",
                fontWeight: 900,
              }}
            >
              Command Panel
            </div>
            <div
              style={{
                marginTop: 6,
                fontSize: 15,
                fontWeight: 900,
                color: "rgba(255,255,255,0.96)",
              }}
            >
              Daily system status
            </div>
          </div>

          <div
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#9ef0c7",
              background: "rgba(34,197,94,0.10)",
              border: "1px solid rgba(34,197,94,0.14)",
            }}
          >
            Online
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: 10,
            marginTop: 14,
          }}
        >
          {[
            { top: "Focus", value: "Budget" },
            { top: "Mode", value: "Track" },
            { top: "Sync", value: "Live" },
          ].map((item) => (
            <div
              key={item.top}
              style={{
                borderRadius: 18,
                border: "1px solid rgba(255,255,255,0.06)",
                background: "rgba(255,255,255,0.03)",
                padding: "12px 10px",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.34)",
                  marginBottom: 5,
                }}
              >
                {item.top}
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 900,
                  color: "rgba(255,255,255,0.86)",
                }}
              >
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          fontSize: 11,
          letterSpacing: "0.26em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.40)",
          fontWeight: 900,
          padding: "2px 4px 0",
        }}
      >
        Core
      </div>

      <nav style={{ display: "grid", gap: 10 }}>
        {MAIN_LINKS.map((link) => (
          <NavItem
            key={link.href}
            {...link}
            active={isActive(path, link.href)}
          />
        ))}
      </nav>

      <div
        style={{
          height: 1,
          margin: "4px 0 0",
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent)",
        }}
      />

      <div
        style={{
          fontSize: 11,
          letterSpacing: "0.26em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.40)",
          fontWeight: 900,
          padding: "2px 4px 0",
        }}
      >
        System
      </div>

      <nav style={{ display: "grid", gap: 10 }}>
        {SYSTEM_LINKS.map((link) => (
          <NavItem
            key={link.href}
            {...link}
            active={isActive(path, link.href)}
          />
        ))}
      </nav>

      <div style={{ marginTop: "auto", paddingTop: 8 }}>
        <div
          style={{
            borderRadius: 20,
            border: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(255,255,255,0.03)",
            padding: "12px 14px",
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            alignItems: "center",
            fontSize: 12,
            color: "rgba(255,255,255,0.44)",
          }}
        >
          <span>Supabase • Auth Enabled</span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.56)",
              background: "rgba(255,255,255,0.05)",
              borderRadius: 999,
              padding: "4px 8px",
            }}
          >
            V1
          </span>
        </div>
      </div>
    </aside>
  );
}
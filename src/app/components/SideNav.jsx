"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Dashboard", meta: "Today + next moves" },
  { href: "/calendar", label: "Calendar", meta: "Timeline + recurring" },
  { href: "/accounts", label: "Accounts", meta: "Balances for forecast" },
  { href: "/bills", label: "Bills", meta: "Due dates + payments" },
  { href: "/debt", label: "Debt", meta: "Payoff + balances" },
  { href: "/income", label: "Income", meta: "Pay + goals" },
  { href: "/spending", label: "Daily Spending", meta: "Log purchases" },
  { href: "/investments", label: "Investments", meta: "Portfolio tracking" },
  { href: "/savings", label: "Savings Goals", meta: "Targets + progress" },
];

const SYSTEM_LINKS = [
  { href: "/settings", label: "Settings", meta: "Account + integrations" },
];

function isActive(path, href) {
  if (href === "/") return path === "/";
  return path === href || path.startsWith(href + "/") || path.startsWith(href);
}

export default function SideNav() {
  const path = usePathname();

  return (
    <aside className="sideNav">
      <div className="brand">
        <div className="brandTitle">Life Command Center</div>
        <div className="brandSub muted">Finance • Life • Tracking</div>
      </div>

      <div
        className="card"
        style={{
          padding: 12,
          marginTop: 12,
          marginBottom: 12,
        }}
      >
        <div style={{ fontWeight: 950, marginBottom: 4 }}>Command Panel</div>
        <div className="muted" style={{ fontSize: 12, lineHeight: 1.35 }}>
          Dashboard is your overview. Calendar runs the timeline. Accounts powers the forecast.
        </div>
      </div>

      <nav className="nav">
        {LINKS.map((l) => {
          const active = isActive(path, l.href);

          return (
            <Link
              key={l.href}
              href={l.href}
              className={`navLink ${active ? "active" : ""}`}
              style={{
                paddingTop: 10,
                paddingBottom: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontWeight: 900 }}>{l.label}</span>
                <span className="muted" style={{ fontSize: 11 }}>
                  {active ? "Open" : ""}
                </span>
              </div>

              <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                {l.meta}
              </div>
            </Link>
          );
        })}
      </nav>

      <div style={{ height: 16 }} />

      <div
        style={{
          height: 1,
          background: "rgba(255,255,255,0.08)",
          marginBottom: 12,
        }}
      />

      <nav className="nav">
        {SYSTEM_LINKS.map((l) => {
          const active = isActive(path, l.href);

          return (
            <Link
              key={l.href}
              href={l.href}
              className={`navLink ${active ? "active" : ""}`}
              style={{
                paddingTop: 10,
                paddingBottom: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontWeight: 900 }}>{l.label}</span>
                <span className="muted" style={{ fontSize: 11 }}>
                  {active ? "Open" : ""}
                </span>
              </div>

              <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                {l.meta}
              </div>
            </Link>
          );
        })}
      </nav>

      <div style={{ height: 12 }} />

      <div
        className="navFooter muted"
        style={{ display: "flex", justifyContent: "space-between", gap: 10 }}
      >
        <span>Supabase • Auth Enabled</span>
        <span style={{ fontSize: 11 }}>v1</span>
      </div>
    </aside>
  );
}
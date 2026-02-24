"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/bills", label: "Bills" },
  { href: "/income", label: "Income" },
  { href: "/spending", label: "Daily Spending" },
  { href: "/investments", label: "Investments" },
  { href: "/savings", label: "Savings Goals" },
  { href: "/calendar", label: "Calendar" },
];

export default function SideNav() {
  const path = usePathname();

  return (
    <aside className="sideNav">
      <div className="brand">
        <div className="brandTitle">Life Command Center</div>
        <div className="brandSub muted">Finance • Life • Tracking</div>
      </div>

      <nav className="nav">
        {LINKS.map((l) => {
          const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
          return (
            <Link key={l.href} href={l.href} className={`navLink ${active ? "active" : ""}`}>
              {l.label}
            </Link>
          );
        })}
      </nav>

      <div className="navFooter muted">Local • Preview</div>
    </aside>
  );
}
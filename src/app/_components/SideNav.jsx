"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/bills", label: "Bills" },
  { href: "/income", label: "Income" },
  { href: "/spending", label: "Daily Spending" },
  { href: "/investments", label: "Investments" },
  { href: "/savings", label: "Savings Goals" },
  { href: "/calendar", label: "Calendar" }, //
];


export default function SideNav() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brandDot" />
        <div>
          <div className="brandTitle">Life Command Center</div>
          <div className="brandSub">Finance • Life • Tracking</div>
        </div>
      </div>

      <nav className="nav">
        {NAV.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname?.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`navLink ${active ? "navLinkActive" : ""}`}
            >
              <span className="navBullet" />
              <span className="navLabel">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebarFooter">
        <div className="pill">
          Local mode <span className="spark" />
        </div>
      </div>
    </aside>
  );
}
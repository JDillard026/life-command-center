"use client";

import SideNav from "./SideNav";
import RippleProvider from "./RippleProvider";

export default function AppShell({ children }) {
  return (
    <RippleProvider>
      <div className="appLayout">
        <aside className="appSide">
          <SideNav />
        </aside>

        <main className="appMain">
          {children}
        </main>
      </div>
    </RippleProvider>
  );
}
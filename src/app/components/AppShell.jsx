"use client";

import SideNav from "./SideNav";
import RippleProvider from "./RippleProvider";
import AiHelpPanel from "./AiHelpPanel";

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

        <AiHelpPanel />
      </div>
    </RippleProvider>
  );
}
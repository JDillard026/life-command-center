import "./globals.css";
import SideNav from "./_components/SideNav";

export const metadata = { title: "Life Command Center" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="appShell">
          <SideNav />
          <div className="appMain">
            <div className="topbar">
              <div className="topbarTitle">Life Command Center</div>
              <div className="topbarRight muted">Local • Preview</div>
            </div>

            <div className="content">{children}</div>
          </div>
        </div>
      </body>
    </html>
  );
}
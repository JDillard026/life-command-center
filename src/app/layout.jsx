import "./globals.css";
import SideNav from "./components/SideNav";
import RippleProvider from "./components/RippleProvider";

export const metadata = { title: "Life Command Center" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <RippleProvider />
        <div className="appShell">
          <SideNav />
          <div className="appMain">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}

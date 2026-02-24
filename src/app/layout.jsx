import "./globals.css";
import SideNav from "./components/SideNav";

export const metadata = { title: "Life Command Center" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
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

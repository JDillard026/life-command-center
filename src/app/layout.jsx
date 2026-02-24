import "./globals.css";
import AppShell from "./components/AppShell";

export const metadata = {
  title: "Life Command Center",
  description: "Finance + Life tracking",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
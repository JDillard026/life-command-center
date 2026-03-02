import "./globals.css";
import AppShell from "./components/AppShell";
import AuthGate from "./components/AuthGate";

export const metadata = {
  title: "Life Command Center",
  description: "Finance + Life tracking",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthGate>
          <AppShell>{children}</AppShell>
        </AuthGate>
      </body>
    </html>
  );
}
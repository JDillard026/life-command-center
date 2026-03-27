import "./globals.css";
import ClientLayout from "./ClientLayout";
import AppAccessGate from "./components/AppAccessGate";

export const metadata = {
  title: "Life Command Center",
  description: "Premium finance dashboard for life, money, and momentum.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AppAccessGate>
          <ClientLayout>{children}</ClientLayout>
        </AppAccessGate>
      </body>
    </html>
  );
}
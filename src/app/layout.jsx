import "./globals.css";
import AuthGate from "./components/AuthGate";
import ClientLayout from "./ClientLayout";

export const metadata = {
  title: "Life Command Center",
  description: "Finance + Life tracking",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthGate>
          <ClientLayout>{children}</ClientLayout>
        </AuthGate>
      </body>
    </html>
  );
}
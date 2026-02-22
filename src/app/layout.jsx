export const metadata = { title: "Life Command Center" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "Arial", padding: 24 }}>
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cina 2026 — Alberto & Sofia",
  description: "Itinerario interattivo per organizzare tappe, trasporti, attività e budget del viaggio in Cina.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}

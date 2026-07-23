import type { Metadata } from "next";
import "./globals.css";

const title = "Cina 2026 — Alberto & Sofia";
const description = "Agenda pubblica giorno per giorno per organizzare orari, attività, trasporti, costi e budget del viaggio in Cina.";

export const metadata: Metadata = {
  metadataBase: new URL("https://cryptopannoz.github.io/china-2026-planner/"),
  title,
  description,
  icons: { icon: "favicon.svg" },
  robots: { index: true, follow: true },
  openGraph: { title, description, images: [{ url: "og.png", width: 1536, height: 1024, alt: title }] },
  twitter: { card: "summary_large_image", title, description, images: ["og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}

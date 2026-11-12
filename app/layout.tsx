import type { Metadata, Viewport } from "next";
import "./globals.css";

const title = "Cina 2026 — Alberto & Sofia";
const description = "Wallet e scheduler del viaggio in Cina: biglietti, hotel, orari e cose da fare, anche offline.";

export const metadata: Metadata = {
  metadataBase: new URL("https://cryptopannoz.github.io/china-2026-planner/"),
  title,
  description,
  manifest: "manifest.webmanifest",
  icons: { icon: "favicon.svg", apple: "apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Cina 2026", statusBarStyle: "black-translucent" },
  robots: { index: false, follow: false, noarchive: true },
  openGraph: { title, description, images: [{ url: "og.png", width: 1536, height: 1024, alt: title }] },
  twitter: { card: "summary_large_image", title, description, images: ["og.png"] },
};

export const viewport: Viewport = {
  themeColor: "#0b2119",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}

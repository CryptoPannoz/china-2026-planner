import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const imageUrl = `${protocol}://${host}/og.png`;
  const title = "Cina 2026 — Alberto & Sofia";
  const description = "Agenda operativa giorno per giorno per organizzare orari, attività, trasporti, prenotazioni e budget del viaggio in Cina.";

  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: imageUrl, width: 1536, height: 1024, alt: "Cina 2026 — Alberto & Sofia" }] },
    twitter: { card: "summary_large_image", title, description, images: [imageUrl] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import { Bodoni_Moda, Geist_Mono, Mulish, Tiro_Devanagari_Hindi } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// Umbra's faces: Bodoni Moda for display, Mulish for reading, Geist Mono for codes. Tiro Devanagari Hindi carries every
// Hindi line, so the Devanagari has the same high-contrast, editorial stroke as the Bodoni beside it. All self-hosted by next/font.
const bodoni = Bodoni_Moda({ variable: "--font-bodoni", subsets: ["latin"], weight: ["500", "600", "700"], style: ["normal", "italic"] });
const mulish = Mulish({ variable: "--font-mulish", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const tiro = Tiro_Devanagari_Hindi({ variable: "--font-tiro", subsets: ["devanagari"], weight: "400", style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: "Daak · every parcel handoff proven, every driver paid by the km",
  description: "Proof of handoff and fair pay for parcels relayed across buses and drivers in UP and Bihar. Built at ETHGlobal Mumbai 2026.",
  openGraph: { title: "Daak", description: "Every parcel handoff proven. Every driver paid by the kilometre.", type: "website" },
  twitter: { card: "summary", title: "Daak", description: "Every parcel handoff proven. Every driver paid by the kilometre." },
};

export const viewport = { themeColor: "#ece5d3" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bodoni.variable} ${mulish.variable} ${geistMono.variable} ${tiro.variable} h-full antialiased`}>
      <body className="paper-grain min-h-full font-sans text-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

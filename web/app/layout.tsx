import type { Metadata } from "next";
import { Baloo_2, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Display face: Baloo 2 by Ek Type, Latin and Devanagari in one family, with the feel of painted shop and bus signs.
const baloo = Baloo_2({ variable: "--font-baloo", subsets: ["latin", "devanagari"], weight: ["600", "700", "800"] });

export const metadata: Metadata = {
  title: "Daak · every parcel handoff proven, every driver paid by the km",
  description: "Proof of handoff and fair pay for parcels relayed across buses and drivers in UP and Bihar. Built at ETHGlobal Mumbai 2026.",
  openGraph: { title: "Daak", description: "Every parcel handoff proven. Every driver paid by the kilometre.", type: "website" },
  twitter: { card: "summary", title: "Daak", description: "Every parcel handoff proven. Every driver paid by the kilometre." },
};

export const viewport = { themeColor: "#f7f3ea" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${baloo.variable} h-full antialiased`}>
      <body className="min-h-full bg-paper font-sans text-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

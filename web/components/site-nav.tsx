"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** The operator's places: deliveries, drivers and the network map. The current one sits in, the other can be pressed. */
export function SiteNav({ className = "mb-8" }: { className?: string }) {
  const path = usePathname();
  const item = (href: string, label: string) => {
    const on = path.startsWith(href);
    return (
      <Link
        href={href}
        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-transform active:scale-[0.97] ${on ? "bg-rule/70 text-ink" : "bg-card-paper text-ink shadow-sm"}`}
      >
        {label}
      </Link>
    );
  };
  return (
    <nav className={`${className} flex items-center justify-between gap-3`}>
      <Link href="/" className="text-2xl font-semibold tracking-tight">Daak</Link>
      <div className="flex gap-2">{item("/network", "Network")}{item("/drivers", "Drivers")}{item("/ops", "Deliveries")}</div>
    </nav>
  );
}

/** A small key for opening a proof: named for what it does, never an underlined link. */
export function ProofButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer"
      className="inline-flex items-center rounded-md border border-rule bg-card-paper px-2.5 py-1 text-xs font-medium text-ink shadow-sm transition-transform active:scale-[0.97]">
      {children}
    </a>
  );
}

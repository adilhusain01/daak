"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DaakMark } from "@/components/daak-mark";

const LINKS = [["/live", "Live"], ["/network", "Network"], ["/drivers", "Drivers"], ["/ops", "Operator"]] as const;

/** Everywhere on the site: live deliveries, the network map, drivers, and the operator's desk. The current page sits in a tray. */
export function SiteNav({ className = "mb-10", dark = false }: { className?: string; dark?: boolean }) {
  const path = usePathname();
  return (
    <nav className={`${className} flex flex-wrap items-center justify-between gap-x-6 gap-y-3`}>
      <Link href="/" className="group flex items-center gap-2.5" aria-label="Daak, home">
        <DaakMark className={`size-9 rounded-[8px] transition-transform duration-200 ease-out group-active:scale-95 ${dark ? "ring-1 ring-paper/25" : ""}`} />
        <span className="flex flex-col leading-none">
          <span className="font-display text-2xl font-semibold tracking-tight">Daak</span>
          <span lang="hi" className={`mt-1 text-xs ${dark ? "text-paper/60" : "text-muted-ink"}`}>डाक</span>
        </span>
      </Link>
      <div className="flex flex-wrap gap-1">
        {LINKS.map(([href, label]) => {
          const on = path.startsWith(href);
          return (
            <Link key={href} href={href} aria-current={on ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-[color,background-color,transform] duration-150 active:scale-[0.97] ${dark
                ? on ? "bg-paper/15 text-paper" : "text-paper/70 hover:text-paper"
                : on ? "bg-tray text-ink shadow-[inset_0_0_0_1px_var(--color-rule)]" : "text-soft-ink hover:text-ink"}`}>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** A small key for opening a proof: named for what it does. It casts a shadow because it can be pressed. */
export function ProofButton({ href, children }: { href: string; children: React.ReactNode }) {
  const local = href.startsWith("/");
  return (
    <a href={href} target={local ? undefined : "_blank"} rel="noreferrer"
      className="inline-flex items-center gap-1.5 rounded-md bg-paper px-2.5 py-1 text-xs font-semibold text-ink shadow-[inset_0_0_0_1px_var(--color-rule),var(--shadow-key)] transition-transform active:scale-[0.97]">
      {children}
    </a>
  );
}

/** The page frame every screen shares: full width with the same side margins as the landing, so every left edge agrees. */
export function Page({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <main className={`w-full px-5 py-8 sm:px-8 lg:px-16 xl:px-20 ${className}`}>{children}</main>;
}

/** A page's title and one line under it. */
export function PageHead({ title, line, children }: { title: string; line?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <header className="flex max-w-2xl flex-col gap-2">
        <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">{title}</h1>
        {line && <p className="text-lg text-soft-ink">{line}</p>}
      </header>
      {children && <div className="flex flex-wrap gap-2 lg:justify-end">{children}</div>}
    </div>
  );
}

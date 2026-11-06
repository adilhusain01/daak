"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { when } from "@/lib/ui";

export type ParcelSummary = {
  code: string; label: string; createdAt: number; feeRupees: number; km: number; weight: string;
  stops: number; handed: number; status: { key: string; text: string }; needsYou?: boolean;
};
export type Chain = { topicId?: string; feeTokenId?: string; escrowId?: string };
type Page = { chain?: Chain; counts: Record<string, number>; total: number; page: number; pages: number; size: number; rows: ParcelSummary[] };

const tone: Record<string, string> = { refunded: "text-held", paid: "text-ok", releasing: "text-ok", held: "text-held", review: "text-wait", transit: "text-ink" };

/**
 * A list of parcels, paged on the server. The page, filter and search live in the URL,
 * so the back button from a parcel returns to the same page.
 */
export function ParcelList({ endpoint, hrefFor, tabs, queryKey, refetchMs, onChain }: {
  endpoint: string; hrefFor: (code: string) => string; tabs: { id: string; label: string }[]; queryKey: string; refetchMs?: number; onChain?: (c: Chain) => void;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const page = Number(params.get("page") ?? 1) || 1;
  const filter = params.get("filter") ?? "all";
  const q = params.get("q") ?? "";
  const [search, setSearch] = useState(q);

  const go = (next: Record<string, string | number | null>) => {
    const u = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) if (v === null || v === "" || (k === "page" && v === 1) || (k === "filter" && v === "all")) u.delete(k); else u.set(k, String(v));
    router.replace(`${path}${u.size ? `?${u}` : ""}`, { scroll: false });
  };

  // Search as you type, a beat after the last key.
  useEffect(() => {
    if (search === q) return;
    const t = setTimeout(() => go({ q: search.trim(), page: 1 }), 250);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isLoading, isFetching, isError } = useQuery<Page>({
    queryKey: [queryKey, page, filter, q],
    queryFn: async () => {
      const r = await fetch(`${endpoint}?${new URLSearchParams({ page: String(page), size: "20", filter, ...(q ? { q } : {}) })}`);
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    },
    placeholderData: keepPreviousData,
    refetchInterval: refetchMs,
  });

  const chainId = data?.chain?.topicId;
  useEffect(() => { if (data?.chain) onChain?.(data.chain); }, [chainId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => go({ filter: t.id, page: 1 })} aria-pressed={filter === t.id}
            className={`flex flex-col items-start rounded-[10px] px-4 py-3 text-left transition-transform active:scale-[0.97] sm:min-w-40 ${filter === t.id ? "bg-tray shadow-[inset_0_0_0_1px_var(--color-rule)]" : "bg-card-paper shadow-[inset_0_0_0_1px_var(--color-rule),var(--shadow-key)]"}`}>
            <span className="font-display text-3xl font-medium tabular-nums leading-none">{data?.counts[t.id] ?? "–"}</span>
            <span className="mt-1 text-sm text-soft-ink">{t.label}</span>
          </button>
        ))}
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search a code or shop" aria-label="Search parcels"
          className="col-span-2 rounded-[10px] bg-card-paper px-4 py-3 text-sm shadow-[inset_0_0_0_1.5px_var(--color-rule)] outline-none placeholder:text-muted-ink focus-visible:shadow-[inset_0_0_0_1.5px_var(--color-ink)] sm:ml-auto sm:w-72 sm:self-end" />
      </div>

      <div className="overflow-hidden border-y border-rule">
        <div className="hidden grid-cols-[8rem_minmax(0,1fr)_20rem_4rem_6rem_9rem] gap-4 border-b border-rule px-2 py-2 text-xs font-semibold text-muted-ink lg:grid">
          <span>Code</span><span>Parcel</span><span>Status</span><span className="text-right">Stops</span><span className="text-right">Fee</span><span className="text-right">Booked</span>
        </div>
        {isLoading && <p className="px-4 py-6 text-muted-ink">Reading Arkiv and the Hedera log...</p>}
        {isError && <p className="px-4 py-6 text-held">Could not load the parcels. Refresh to try again.</p>}
        {data && !data.rows.length && <p className="px-4 py-6 text-muted-ink">{q ? `Nothing matches "${q}".` : "No parcels here."}</p>}
        <ul className={`divide-y divide-rule transition-opacity ${isFetching && !isLoading ? "opacity-60" : ""}`}>
          {data?.rows.map((r) => (
            <li key={r.code}>
              <Link href={hrefFor(r.code)}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 px-2 py-4 transition-colors hover:bg-card-paper/70 active:bg-tray lg:grid-cols-[8rem_minmax(0,1fr)_20rem_4rem_6rem_9rem] lg:items-center">
                <span className="font-mono font-medium">{r.code}{r.needsYou && <span className="ml-2 rounded-md bg-held/10 px-1.5 py-0.5 text-xs font-medium text-held lg:hidden">Needs you</span>}</span>
                <span className="text-right text-sm tabular-nums lg:order-last">{when(r.createdAt)}</span>
                <span className="col-span-2 truncate text-sm text-muted-ink lg:col-span-1">{r.label.replace(/^Parcel from /, "")}</span>
                <span className={`text-sm font-medium ${tone[r.status.key] ?? "text-ink"}`}>
                  {r.status.text}
                  {r.needsYou && <span className="ml-2 hidden rounded-md bg-held/10 px-1.5 py-0.5 text-xs text-held lg:inline">Needs you</span>}
                </span>
                <span className="flex items-center justify-end gap-1" role="img" aria-label={`${r.handed} of ${r.stops} stops handed over`}>
                  {Array.from({ length: r.stops }, (_, i) => <span key={i} className={`size-2.5 rounded-[2px] ${i < r.handed ? (r.status.key === "held" ? "bg-held" : "bg-gold") : "bg-tray shadow-[inset_0_0_0_1px_var(--color-rule)]"}`} />)}
                </span>
                <span className="col-span-2 text-sm tabular-nums text-muted-ink lg:col-span-1 lg:text-right lg:text-ink">₹{r.feeRupees.toFixed(2)}<span className="lg:hidden"> · {r.km} km · {r.weight}</span></span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {data && data.pages > 1 && (
        <nav className="flex items-center justify-between gap-3 text-sm" aria-label="Pages">
          <span className="text-muted-ink tabular-nums">{(data.page - 1) * data.size + 1} to {Math.min(data.page * data.size, data.total)} of {data.total}</span>
          <span className="flex gap-2">
            <button disabled={data.page <= 1} onClick={() => go({ page: data.page - 1 })}
              className="rounded-lg bg-card-paper px-3 py-1.5 font-medium shadow-[var(--shadow-key)] transition-transform active:scale-[0.97] disabled:opacity-40 disabled:shadow-none">Previous</button>
            <span className="self-center tabular-nums text-muted-ink">Page {data.page} of {data.pages}</span>
            <button disabled={data.page >= data.pages} onClick={() => go({ page: data.page + 1 })}
              className="rounded-lg bg-card-paper px-3 py-1.5 font-medium shadow-[var(--shadow-key)] transition-transform active:scale-[0.97] disabled:opacity-40 disabled:shadow-none">Next</button>
          </span>
        </nav>
      )}
    </section>
  );
}

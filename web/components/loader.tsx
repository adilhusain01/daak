import { Gather } from "loading-dev";

/**
 * Waiting, shown as loading.dev's Gather (four blocks pulling together and apart) instead of words. Loader fills the
 * space the content will take and sits in its centre; the words stay for screen readers. Gather respects reduced motion.
 */
export function Loader({ label, className = "min-h-[55svh]" }: { label: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={`grid w-full place-items-center ${className}`}>
      <Gather size={40} className="text-gold" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

/** A key's label while it works: the spinner in its place, the label kept invisible so the key never changes width. */
export function Busy({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return (
    <span className="grid">
      <span className={`col-start-1 row-start-1 ${busy ? "invisible" : ""}`}>{children}</span>
      {busy && <span role="status" className="col-start-1 row-start-1 grid place-items-center"><Gather size={18} /><span className="sr-only">Working</span></span>}
    </span>
  );
}

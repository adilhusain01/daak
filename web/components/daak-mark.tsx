import { MARK_GLYPH } from "@/components/landing/mark-glyph";

/** Daak's mark: ड, the first letter of डाक, in paper on an ink square, over a gold rule for the proof. One source for the nav, the chat key and the favicon. */
export function DaakMark({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={`shrink-0 ${className}`}>
      <rect width="64" height="64" rx="12" className="fill-ink" />
      <rect x="8" y="49" width="48" height="3" className="fill-gold" />
      <path d={MARK_GLYPH.d} transform={MARK_GLYPH.transform} className="fill-paper" />
    </svg>
  );
}

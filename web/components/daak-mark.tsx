import { MARK_GLYPH } from "@/components/landing/mark-glyph";

/** Daak's mark: ड, the first letter of डाक, drawn from Baloo 2 in paper on an amber square. One source for the nav, the chat key and the favicon. */
export function DaakMark({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={`shrink-0 ${className}`}>
      <rect width="64" height="64" rx="14" className="fill-wait" />
      <path d={MARK_GLYPH.d} transform={MARK_GLYPH.transform} className="fill-paper" />
    </svg>
  );
}

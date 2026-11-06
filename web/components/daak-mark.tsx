/** Daak's mark: ड, the first letter of डाक, in amber on a square whose corners sit inside whatever holds it. */
export function DaakMark({ className = "size-9 text-xl" }: { className?: string }) {
  return (
    <span aria-hidden className={`inline-grid shrink-0 place-items-center rounded-lg bg-wait font-semibold leading-none text-paper ${className}`}
      style={{ fontFamily: '"Noto Sans Devanagari", "Kohinoor Devanagari", "Devanagari Sangam MN", sans-serif' }}>
      ड
    </span>
  );
}

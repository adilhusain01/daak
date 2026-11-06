import Image from "next/image";

/**
 * A real-looking Android phone around a real screenshot, shaped like the OnePlus the app runs on: a graphite metal
 * edge with a highlight, a thin black bezel, a centred punch-hole camera, the side keys, a faint glass sheen and a
 * soft contact shadow on the paper. Every size is in container units, so the phone scales as one object.
 * The screenshot is the phone's own 1264 by 2780 capture.
 */
export function PhoneFrame({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return (
    <figure className={`relative isolate mx-auto w-full max-w-[320px] [container-type:inline-size] ${className}`}>
      {/* Side keys: volume and power, on the right edge. */}
      <span aria-hidden className="absolute top-[30cqw] -right-[1.1cqw] h-[22cqw] w-[1.6cqw] rounded-r-[0.8cqw] bg-[linear-gradient(90deg,#2a2720,#4a463c)]" />
      <span aria-hidden className="absolute top-[58cqw] -right-[1.1cqw] h-[12cqw] w-[1.6cqw] rounded-r-[0.8cqw] bg-[linear-gradient(90deg,#2a2720,#4a463c)]" />
      {/* The metal edge. */}
      <div className="relative rounded-[14cqw] bg-[linear-gradient(145deg,#5b564a_0%,#24211b_28%,#1a1813_55%,#3d392f_80%,#141210_100%)] p-[1.4cqw] shadow-[0_1px_0_rgb(255_255_255/0.08)_inset,0_30px_60px_-30px_rgb(40_34_18/0.7),0_12px_24px_-16px_rgb(40_34_18/0.6)]">
        {/* The bezel. */}
        <div className="rounded-[12.6cqw] bg-black p-[2.4cqw]">
          {/* The glass. */}
          <div className="relative aspect-[1264/2780] overflow-hidden rounded-[10.4cqw] bg-paper">
            <Image src={src} alt={alt} fill sizes="(min-width: 640px) 320px, 80vw" quality={90} className="object-cover" />
            {/* The camera, where the phone's own sits. */}
            <span aria-hidden className="absolute left-1/2 top-[2.6%] size-[4.6cqw] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_35%_35%,#3a3a44_0%,#0b0b0d_55%,#000_100%)] shadow-[0_0_0_0.6cqw_rgb(0_0_0/0.9)]" />
            {/* A faint sheen across the glass. */}
            <span aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgb(255_255_255/0.10)_0%,rgb(255_255_255/0.03)_30%,transparent_45%)]" />
          </div>
        </div>
      </div>
      {/* Where it touches the paper. */}
      <span aria-hidden className="absolute -bottom-[5cqw] left-1/2 -z-10 h-[6cqw] w-[78%] -translate-x-1/2 rounded-[50%] bg-ink/25 blur-[4cqw]" />
    </figure>
  );
}

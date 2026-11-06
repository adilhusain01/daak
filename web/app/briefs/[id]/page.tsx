import { notFound } from "next/navigation";
import { BRIEFS, SETUP, type Ask } from "../content";
import { DaakMark } from "@/components/daak-mark";

/** One page a brief, laid out to print: the mentor reads it on paper, or on a phone at /briefs/<id>. */
export function generateStaticParams() {
  return [...BRIEFS.map((b) => ({ id: b.id })), { id: "setup" }];
}

const STATUS: Record<Ask["status"], { word: string; cls: string }> = {
  live: { word: "Live", cls: "bg-gold text-night" },
  partial: { word: "In progress", cls: "bg-tray text-ink shadow-[inset_0_0_0_1px_var(--color-gold)]" },
  gap: { word: "Not built", cls: "bg-tray text-muted-ink" },
};

function Head({ kicker, title, logo, logoText }: { kicker: string; title: string; logo?: string; logoText?: string }) {
  return (
    <header className="flex flex-col gap-4 border-b border-rule pb-6">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2"><DaakMark className="size-7 rounded-[6px]" /><span className="font-display text-xl font-semibold">Daak</span></span>
        {logo && <span className="flex items-center gap-1.5">{<img src={logo} alt={logoText ?? kicker} className="h-6 w-auto" />}{logoText && <span className="text-lg font-bold">{logoText}</span>}</span>}
      </div>
      <p className="text-sm text-gold-deep">{kicker}</p>
      <h1 className="font-display text-[1.9rem] font-semibold leading-[1.1] tracking-tight">{title}</h1>
    </header>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-7 mb-3 font-display text-xl font-semibold">{children}</h2>;
}

function Foot() {
  return (
    <footer className="mt-8 flex justify-between border-t border-rule pt-3 font-mono text-[10px] text-muted-ink">
      <span>daak-ethglobal.vercel.app · github.com/adilhusain01/daak · HCS topic 0.0.11327109</span>
      <span>ETHGlobal Mumbai 2026</span>
    </footer>
  );
}

function Setup() {
  return (
    <>
      <Head kicker="Run-sheet: one shop, two drivers, one receiver" title="From nothing to a delivered, paid parcel in about ten minutes" />
      <H2>The cast</H2>
      <table className="w-full text-sm">
        <tbody>{SETUP.cast.map(([role, name, where, does]) => (
          <tr key={role} className="border-b border-rule"><td className="py-1.5 pr-3 text-muted-ink">{role}</td><td className="py-1.5 pr-3 font-semibold">{name}</td><td className="py-1.5 pr-3">{where}</td><td className="py-1.5 text-soft-ink">{does}</td></tr>
        ))}</tbody>
      </table>
      <H2>Before anyone arrives</H2>
      <ul className="flex flex-col gap-1.5 text-sm">{SETUP.before.map((b) => <li key={b} className="flex gap-2"><span className="mt-1.5 size-2.5 shrink-0 rounded-[2px] shadow-[inset_0_0_0_1.5px_var(--color-ink)]" />{b}</li>)}</ul>
      <H2>Join the four (about two minutes each)</H2>
      <table className="w-full text-sm"><tbody>{SETUP.join.map(([who, what]) => (
        <tr key={who} className="border-b border-rule align-top"><td className="w-24 py-1.5 pr-3 font-semibold">{who}</td><td className="py-1.5">{what}</td></tr>
      ))}</tbody></table>
      <H2>The run</H2>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs text-muted-ink"><th className="w-6 pb-1">#</th><th className="w-20 pb-1">Step</th><th className="pb-1">Do</th><th className="w-[34%] pb-1">Show</th></tr></thead>
        <tbody>{SETUP.run.map(([step, d, show], i) => (
          <tr key={step} className="border-t border-rule align-top"><td className="py-1.5 font-mono text-gold-deep">{i + 1}</td><td className="py-1.5 pr-2 font-semibold">{step}</td><td className="py-1.5 pr-3">{d}</td><td className="py-1.5 text-soft-ink">{show}</td></tr>
        ))}</tbody>
      </table>
      <H2>Easy to miss</H2>
      <ul className="flex flex-col gap-1.5 text-sm">{SETUP.traps.map((t) => <li key={t} className="flex gap-2"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-held" />{t}</li>)}</ul>
      <Foot />
    </>
  );
}

export default async function BriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id === "setup") return <main className="brief mx-auto w-full max-w-[820px] bg-paper px-5 py-10 text-ink sm:px-10 [&_td]:[overflow-wrap:anywhere]"><Setup /><Print /></main>;
  const b = BRIEFS.find((x) => x.id === id);
  if (!b) notFound();
  return (
    <main className="brief mx-auto w-full max-w-[820px] bg-paper px-5 py-10 text-ink sm:px-10 [&_td]:[overflow-wrap:anywhere]">
      <Head kicker={`Daak and ${b.partner}: the tracks we enter, and what is built`} title={b.title} logo={b.logo} logoText={b.logoText} />

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-[1fr_15rem]">
        <section>
          <p className="mb-2 text-xs font-semibold text-muted-ink">In 60 seconds</p>
          <ol className="flex flex-col gap-2 text-[0.95rem] leading-snug">{b.talk.map((t, i) => <li key={i} className="flex gap-3"><span className="font-display text-lg leading-none text-gold">{i + 1}</span><span>{t}</span></li>)}</ol>
        </section>
        <aside className="rounded-[10px] bg-card-paper p-4 shadow-[inset_0_0_0_1px_var(--color-rule)]">
          <p className="text-xs font-semibold text-muted-ink">Tracks</p>
          <ul className="mt-2 flex flex-col gap-2">{b.tracks.map((t) => <li key={t.name}><p className="font-semibold leading-tight">{t.name}</p><p className="font-mono text-sm text-gold-deep">{t.prize}</p></li>)}</ul>
          <p className="mt-3 text-[11px] leading-snug text-muted-ink">Daak enters three partners, the event's limit: Hedera, 0G and Arkiv (with Swarm).</p>
        </aside>
      </div>

      <H2>What the track asks, and where Daak stands</H2>
      <table className="w-full text-sm">
        <tbody>{b.asks.map((a) => (
          <tr key={a.ask} className="border-t border-rule align-top">
            <td className="w-[38%] py-1.5 pr-3 font-semibold">{a.ask}</td>
            <td className="py-1.5 pr-3 text-soft-ink">{a.how}</td>
            <td className="w-24 py-1.5 text-right"><span className={`inline-block rounded-[4px] px-1.5 py-0.5 text-[10px] font-bold ${STATUS[a.status].cls}`}>{STATUS[a.status].word}</span></td>
          </tr>
        ))}</tbody>
      </table>

      <H2>Every piece, where it lives, and its proof</H2>
      <table className="w-full text-sm">
        <tbody>{b.uses.map((u) => (
          <tr key={u.what} className="border-t border-rule align-top">
            <td className="w-[22%] py-1.5 pr-3 font-semibold">{u.what}</td>
            <td className="py-1.5 pr-3">{u.how}{u.where && <span className="mt-0.5 block font-mono text-[10.5px] text-muted-ink">{u.where}</span>}</td>
            <td className="w-[26%] py-1.5 text-[12px]">{u.proof && (u.proof.href ? <a href={u.proof.href} className="text-gold-deep underline decoration-rule underline-offset-2">{u.proof.label}</a> : <span className="text-soft-ink">{u.proof.label}</span>)}</td>
          </tr>
        ))}</tbody>
      </table>

      <div className="mt-2 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <section>
          <H2>Honest limits</H2>
          <ul className="flex flex-col gap-1.5 text-sm">{b.limits.map((l) => <li key={l} className="flex gap-2"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-held" />{l}</li>)}</ul>
        </section>
        <section>
          <H2>To ask the mentor</H2>
          <ul className="flex flex-col gap-1.5 text-sm">{b.questions.map((q) => <li key={q} className="flex gap-2"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gold" />{q}</li>)}</ul>
        </section>
      </div>
      {b.files && <p className="mt-5 font-mono text-[11px] text-muted-ink">In the repo: {b.files.join(", ")}</p>}
      <Foot />
      <Print />
    </main>
  );
}

/** Printed: A4, the paper colour kept, no browser margins. */
function Print() {
  return <style>{`@page { size: A4; margin: 12mm 0; } @media print { html, body { background: var(--color-paper) !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .brief { max-width: none; padding-top: 0; padding-bottom: 0; } tr { break-inside: avoid; } h2 { break-after: avoid; } }`}</style>;
}

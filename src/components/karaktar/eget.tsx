import Link from "next/link";
import { ArrowUpRight, Clock, MapPin } from "@/components/icons";
import { formatTimeRange, parts, relativeDay } from "@/lib/dates";
import type { Genvag } from "@/lib/karaktar";
import type { EventItem } from "@/lib/types";

/**
 * Utskottets närmaste evenemang med utskottets egen rubrik över: Nästa avspark, Nästa pub. Kortet är mörkt i båda lägena, som
 * välkomstkortet i portalen, och skenet har utskottets färg.
 */
export function NastaKort({ event, rubrik }: { event: EventItem; rubrik: string }) {
  const p = parts(event.starts_at);
  return (
    <Link
      href={`/evenemang/${event.slug}`}
      className="noise tema-fast group relative flex flex-[2_1_24rem] items-center gap-5 overflow-hidden rounded-[1.5rem] bg-ink p-5 text-white ring-1 ring-white/10 md:p-6"
    >
      <span aria-hidden className="pointer-events-none absolute -right-16 -top-28 size-[18rem] rounded-full opacity-45 blur-3xl" style={{ background: "radial-gradient(closest-side, var(--egen-ljus), transparent)" }} />
      <time dateTime={event.starts_at.slice(0, 10)} className="relative flex w-14 shrink-0 flex-col items-center tabular">
        <span className="kicker text-[0.62rem] text-[var(--egen-ljus)]">{p.monthShort}</span>
        <span className="display-tight text-[2.6rem] leading-[0.95]">{p.day}</span>
        <span className="mt-1 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-white/50">{p.weekdayShort}</span>
      </time>
      <span className="relative min-w-0 flex-1 border-l border-white/15 pl-5">
        <span className="kicker block text-[var(--egen-ljus)]">
          {rubrik} <span className="text-white/50">· {relativeDay(event.starts_at, event.ends_at, event.all_day)}</span>
        </span>
        <span className="mt-1.5 block text-xl font-bold leading-snug tracking-tight hyphens-auto [font-stretch:105%] [overflow-wrap:anywhere] md:text-2xl">{event.title}</span>
        <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.82rem] text-white/60">
          <span className="inline-flex items-center gap-1.5">
            <Clock size={14} className="shrink-0" />
            {formatTimeRange(event.starts_at, event.ends_at, event.all_day)}
          </span>
          {event.location && (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <MapPin size={14} className="shrink-0" />
              <span className="truncate">{event.location}</span>
            </span>
          )}
        </span>
      </span>
      <ArrowUpRight size={20} className="relative shrink-0 self-start text-white/50 max-sm:hidden transition-[color,translate] duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white" />
    </Link>
  );
}

/** En genväg till det på sajten som hör till utskottet, som tentastatistiken för UBU och STAR för SASU. */
export function GenvagKort({ href, titel, text }: Genvag) {
  return (
    <Link href={href} className="group flex flex-[1_1_15rem] flex-col rounded-[1.5rem] border border-line bg-white p-5 transition-colors duration-300 hover:border-ink/25 md:p-6">
      <span className="flex items-center justify-between gap-3 text-lg font-bold tracking-tight">
        {titel}
        <ArrowUpRight size={18} className="shrink-0 text-stone-light transition-[color,translate] duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-red" />
      </span>
      <span className="mt-1.5 text-[0.92rem] leading-relaxed text-stone">{text}</span>
    </Link>
  );
}

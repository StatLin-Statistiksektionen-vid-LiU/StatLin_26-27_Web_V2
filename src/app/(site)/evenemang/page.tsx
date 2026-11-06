import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { EventCard, EventRow } from "@/components/content/event-card";
import { Calendar, ChevronLeft, ChevronRight, Rss } from "@/components/icons";
import { TextHero } from "@/components/ui/text-hero";
import { Reveal } from "@/components/ui/reveal";
import { PageSkeleton } from "@/components/ui/skeletons";
import { listCommittees } from "@/lib/data/content";
import { listEventsBetween, listPastEvents, listUpcomingEvents } from "@/lib/data/events";
import { calendarMonth, calendarMonthInRange, eventInMonth, eventLastDay, monthGrid, monthLabel, todayLocal } from "@/lib/dates";
import { SITE_ALTERNATES } from "@/lib/site-metadata";
import type { EventItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export async function generateMetadata({ searchParams }: PageProps<"/evenemang">): Promise<Metadata> {
  const { vy, manad, utskott } = await searchParams;
  return {
    title: "Evenemang",
    description: "Sittningar, pubar, idrott, föreläsningar och sektionsmöten. Allt som händer på StatLin.",
    alternates: { ...SITE_ALTERNATES, canonical: "/evenemang" },
    // Kalendervyn och filtren är samma innehåll under andra adresser.
    robots: vy !== undefined || manad !== undefined || utskott !== undefined ? { index: false } : undefined,
  };
}

export default function EventsPage(props: PageProps<"/evenemang">) {
  return (
    <>
      <TextHero group="evenemang">
        {(text) => (
          <div className="flex flex-wrap gap-3">
            <a href="/kalender.ics" className="btn btn-red">
              <Rss size={18} /> {text("text_evenemang_knapp")}
            </a>
          </div>
        )}
      </TextHero>
      <Suspense fallback={<PageSkeleton />}>
        <EventsContent searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function EventsContent({ searchParams }: { searchParams: PageProps<"/evenemang">["searchParams"] }) {
  const sp = await searchParams;
  await connection();
  const view = sp.vy === "kalender" ? "kalender" : "lista";
  const filter = typeof sp.utskott === "string" ? sp.utskott : undefined;
  const month = calendarMonth(sp.manad);

  const committees = (await listCommittees({ visibleOnly: true })).filter((c) => c.kind !== "ovrigt");
  const active = committees.find((c) => c.slug === filter);

  const href = (params: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const merged = { vy: view === "kalender" ? "kalender" : undefined, utskott: filter, manad: view === "kalender" ? month : undefined, ...params };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    const s = q.toString();
    return `/evenemang${s ? `?${s}` : ""}`;
  };

  return (
    <section className="container-site py-14 md:py-20">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Filtrera på utskott">
          <ul className="flex flex-wrap gap-1.5">
            <FilterChip href={href({ utskott: undefined })} active={!active}>
              Alla
            </FilterChip>
            {committees.map((c) => (
              <FilterChip key={c.id} href={href({ utskott: c.slug })} active={active?.id === c.id} color={c.accent}>
                {c.short_name}
              </FilterChip>
            ))}
          </ul>
        </nav>
        {/* Vanliga länkar: varje vy är en egen adress, så flikar med tablist och panel skulle lova ett beteende som inte finns. */}
        <nav aria-label="Vy" className="inline-flex shrink-0 self-start rounded-lg border border-line bg-white p-0.5 lg:self-auto">
          <Link
            href={href({ vy: undefined, manad: undefined })}
            scroll={false}
            aria-current={view === "lista" ? "page" : undefined}
            className={cn("inline-flex h-8 items-center rounded-md px-3.5 text-[0.84rem] font-medium transition-colors", view === "lista" ? "bg-ink text-paper" : "text-stone hover:text-ink")}
          >
            Lista
          </Link>
          <Link
            href={href({ vy: "kalender" })}
            scroll={false}
            aria-current={view === "kalender" ? "page" : undefined}
            className={cn("inline-flex h-8 items-center gap-2 rounded-md px-3.5 text-[0.84rem] font-medium transition-colors", view === "kalender" ? "bg-ink text-paper" : "text-stone hover:text-ink")}
          >
            <Calendar size={15} /> Kalender
          </Link>
        </nav>
      </div>

      {view === "kalender" ? (
        <MonthView month={month} committeeId={active?.id} href={href} />
      ) : (
        <ListView committeeId={active?.id} committeeName={active?.short_name} />
      )}
    </section>
  );
}

function FilterChip({ href, active, color, children }: { href: string; active: boolean; color?: string; children: React.ReactNode }) {
  return (
    <li>
      {/* Samma sida med ett annat urval, så sidan ska inte hoppa upp till toppen. */}
      <Link
        href={href}
        scroll={false}
        aria-current={active ? "true" : undefined}
        className={cn(
          "inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-[0.84rem] font-medium transition-colors pointer-coarse:h-10",
          active ? "border-ink bg-ink text-paper" : "border-line bg-white text-stone hover:border-ink/25 hover:text-ink",
        )}
      >
        {color && <span className="size-2 rounded-full" style={{ background: active ? "var(--color-paper)" : color }} aria-hidden />}
        {children}
      </Link>
    </li>
  );
}

async function ListView({ committeeId, committeeName }: { committeeId?: number; committeeName?: string }) {
  const [upcoming, past] = await Promise.all([listUpcomingEvents(60, committeeId), listPastEvents(18, committeeId)]);

  // Gruppera kommande per månad
  const groups = new Map<string, EventItem[]>();
  for (const e of upcoming) {
    const key = e.starts_at.slice(0, 7);
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }

  return (
    <>
      {upcoming.length === 0 ? (
        <div className="mt-12 rounded-xl border border-dashed border-line bg-white p-14 text-center">
          <p className="display-tight text-2xl">Tomt i kalendern</p>
          <p className="mt-2 text-stone">
            {committeeName ? `${committeeName} har inga kommande evenemang just nu.` : "Inga kommande evenemang just nu. Håll utkik!"}
          </p>
        </div>
      ) : (
        [...groups.entries()].map(([key, events]) => {
          const [y, m] = key.split("-").map(Number);
          return (
            <div key={key} className="mt-14">
              <div className="flex items-baseline gap-4 border-b border-line pb-4">
                <h2 className="display-tight text-[clamp(1.6rem,3vw,2.4rem)]">{monthLabel(y, m)}</h2>
                <span className="kicker text-stone">
                  {events.length} evenemang
                </span>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {events.map((e, i) => (
                  <Reveal key={e.id} delay={(i % 3) * 80}>
                    <EventCard event={e} className="h-full" />
                  </Reveal>
                ))}
              </div>
            </div>
          );
        })
      )}

      {past.length > 0 && (
        <div className="mt-24">
          <h2 className="kicker text-stone">Tidigare evenemang</h2>
          <div className="mt-4 border-t border-line">
            {past.map((e) => (
              <EventRow key={e.id} event={e} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/** Bläddringen i kalendern. En månad utanför gränsen skulle visa innevarande månad, så där går det inte att gå vidare. */
function MonthStep({ month, href, label, children }: { month: string; href: string; label: string; children: React.ReactNode }) {
  const className = "grid size-9 place-items-center rounded-lg border border-line bg-white text-stone";
  if (!calendarMonthInRange(month)) {
    return (
      <button type="button" disabled aria-label={label} className={cn(className, "opacity-40")}>
        {children}
      </button>
    );
  }
  return (
    <Link href={href} scroll={false} rel="nofollow" aria-label={label} className={cn(className, "hover:border-ink/25 hover:text-ink")}>
      {children}
    </Link>
  );
}

async function MonthView({
  month,
  committeeId,
  href,
}: {
  month: string;
  committeeId?: number;
  href: (p: Record<string, string | undefined>) => string;
}) {
  const [y, m] = month.split("-").map(Number);
  const days = monthGrid(y, m);
  const all = await listEventsBetween(`${days[0].date}T00:00`, `${days[days.length - 1].date}T23:59`);
  const events = committeeId ? all.filter((e) => e.committee_id === committeeId) : all;
  const today = todayLocal();
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  // Rutnätet och mobillistan går på samma regel: flerdagars evenemang syns på alla sina dagar, kvällar som slutar efter midnatt bara på startdagen.
  const byDay = (date: string) => events.filter((e) => e.starts_at.slice(0, 10) <= date && date <= eventLastDay(e.starts_at, e.ends_at, e.all_day));
  const monthEvents = events.filter((e) => eventInMonth(e.starts_at, e.ends_at, e.all_day, month));

  return (
    <div className="mt-12">
      <div className="flex items-center justify-between">
        <h2 className="display-tight text-[clamp(1.6rem,3vw,2.4rem)]">{monthLabel(y, m)}</h2>
        <div className="flex gap-2">
          <MonthStep month={prev} href={href({ manad: prev })} label="Föregående månad">
            <ChevronLeft size={18} />
          </MonthStep>
          <Link href={href({ manad: undefined })} scroll={false} className="hidden h-9 items-center rounded-lg border border-line bg-white px-3 text-[0.84rem] font-medium hover:border-ink/25 sm:inline-flex">
            I dag
          </Link>
          <MonthStep month={next} href={href({ manad: next })} label="Nästa månad">
            <ChevronRight size={18} />
          </MonthStep>
        </div>
      </div>

      {/* Desktop: rutnät */}
      <div className="mt-6 hidden overflow-hidden rounded-xl border border-line bg-white md:block">
        <div className="grid grid-cols-7 border-b border-line bg-paper-2/50">
          {["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"].map((d) => (
            <div key={d} className="kicker px-3 py-3 text-stone">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            const list = byDay(d.date);
            const isToday = d.date === today;
            return (
              <div
                key={d.date}
                className={cn(
                  "min-h-[8.5rem] border-line p-2",
                  i % 7 !== 6 && "border-r",
                  i < days.length - 7 && "border-b",
                  !d.inMonth && "bg-paper/60",
                )}
              >
                <span
                  className={cn(
                    "inline-grid size-7 place-items-center rounded-full font-mono text-xs tabular",
                    isToday ? "bg-red font-bold text-white" : d.inMonth ? "text-ink" : "text-stone-light",
                  )}
                >
                  {Number(d.date.slice(8))}
                </span>
                <ul className="mt-1 space-y-1">
                  {list.slice(0, 3).map((e) => (
                    <li key={e.id}>
                      <Link
                        href={`/evenemang/${e.slug}`}
                        className="group block truncate rounded-md border-l-2 bg-paper-2 px-2 py-1 text-[0.78rem] font-medium leading-tight text-ink transition-colors hover:bg-paper-3"
                        style={{ borderLeftColor: e.committee?.accent ?? "var(--color-ink)" }}
                        title={e.title}
                      >
                        <span className="font-mono font-normal text-stone">{e.all_day || e.starts_at.slice(0, 10) !== d.date ? "" : e.starts_at.slice(11, 16)} </span>
                        {e.title}
                      </Link>
                    </li>
                  ))}
                  {list.length > 3 && <li className="px-2 text-[0.72rem] text-stone">+{list.length - 3} till</li>}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobil: lista för månaden */}
      <div className="mt-6 border-t border-line md:hidden">
        {monthEvents.length === 0 ? (
          <p className="py-10 text-center text-stone">Inga evenemang den här månaden.</p>
        ) : (
          monthEvents.map((e) => <EventRow key={e.id} event={e} />)
        )}
      </div>
    </div>
  );
}

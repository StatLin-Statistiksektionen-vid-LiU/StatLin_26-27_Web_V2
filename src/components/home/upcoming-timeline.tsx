import Link from "next/link";
import type { CSSProperties } from "react";
import { TimelineTrack } from "@/components/home/timeline-track";
import { getSettings } from "@/lib/data/content";
import { getStarEvent, listUpcomingEvents } from "@/lib/data/events";
import { starIsLive } from "@/lib/naringsliv";
import { daysBetween, parts, relativeDay, todayLocal } from "@/lib/dates";
import type { EventItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const BASE_PX = 220;
const PX_PER_DAY = 8;
/** Längre uppehåll än så här gör inte avståndet större. */
const MAX_DAYS = 45;

/** Avståndet till nästa händelse på linjen växer med antalet dagar däremellan. */
function gap(days: number, base = BASE_PX): CSSProperties {
  return { "--bredd": `${base + PX_PER_DAY * Math.min(days, MAX_DAYS)}px` } as CSSProperties;
}

function Dot({ index, large }: { index: number; large?: boolean }) {
  return <span aria-hidden className={cn("tidsaxel-punkt", large && "tidsaxel-punkt-stor")} style={{ "--i": index } as CSSProperties} />;
}

function EventStop({ event, index, days, isStar, starLive }: { event: EventItem; index: number; days: number; isStar: boolean; starLive: boolean }) {
  const p = parts(event.starts_at);
  const first = index === 0;
  return (
    <li className={cn("tidsaxel-hallplats", first && "tidsaxel-forst")} style={gap(days)}>
      <Link href={isStar && starLive ? "/star" : `/evenemang/${event.slug}`} className={cn("group tidsaxel-lank", isStar && "tidsaxel-star")}>
        <span className={cn("tidsaxel-datum font-mono uppercase tracking-[0.1em]", first ? "text-[0.8125rem]" : "text-xs")}>
          <span>
            <time dateTime={event.starts_at.slice(0, 10)}>
              {p.day} {p.monthShort}
            </time>
            {first ? ` · ${relativeDay(event.starts_at, event.ends_at, event.all_day)}` : <span className="tidsaxel-om"> · {relativeDay(event.starts_at, event.ends_at, event.all_day)}</span>}
          </span>
        </span>
        <span className="tidsaxel-text">
          <span className={cn("tidsaxel-rubrik [overflow-wrap:anywhere] group-hover:underline", isStar ? "tidsaxel-star-titel" : "font-semibold tracking-tight [font-stretch:104%]", first ? "line-clamp-3 text-[1.08rem] leading-snug md:text-[1.2rem]" : "line-clamp-3 text-[0.95rem] leading-snug")}>
            {event.title}
          </span>
          <span className="kicker mt-2 block text-xs">{event.committee?.short_name ?? "StatLin"}</span>
        </span>
      </Link>
      <Dot index={index} large={first || isStar} />
    </li>
  );
}

/** Bandet under genvägarna: en tidslinje som visar hur långt det är kvar till det som händer härnäst. Färgerna väljs i inställningarna. */
export async function UpcomingTimeline() {
  const [events, settings] = await Promise.all([listUpcomingEvents(8), getSettings()]);
  const star = await getStarEvent(Number(settings.star_event_id) || null);
  const today = todayLocal();
  const t = parts(today);
  const untilFirst = events[0] ? Math.max(0, daysBetween(today, events[0].starts_at)) : 0;

  return (
    <section aria-label="Kommande evenemang" className="tidsaxel" data-farg={settings.band_color}>
      <TimelineTrack>
        <ol className="tidsaxel-spar">
          <li className="tidsaxel-hallplats tidsaxel-idag" style={gap(untilFirst, 72)}>
            <span className="tidsaxel-datum kicker text-xs font-bold">I dag</span>
            <span className="tidsaxel-text kicker block text-xs">
              {t.day} {t.monthShort}
            </span>
            <span aria-hidden className="tidsaxel-nu" />
          </li>
          {events.length === 0 && (
            <li className="tidsaxel-hallplats tidsaxel-tom">
              <span aria-hidden className="tidsaxel-datum" />
              <span className="tidsaxel-text display-tight block text-[1.1rem] leading-[1.15]">Håll utkik, nya evenemang kommer snart</span>
            </li>
          )}
          {events.map((event, i) => {
            const next = events[i + 1];
            return <EventStop key={event.id} event={event} index={i} days={next ? Math.max(0, daysBetween(event.starts_at, next.starts_at)) : 0} starLive={starIsLive(settings)} isStar={event.id === star?.id} />;
          })}
          <li className="tidsaxel-slut">
            <Link href="/evenemang" className="tidsaxel-kalender group">
              Hela kalendern <span aria-hidden className="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
            </Link>
          </li>
        </ol>
      </TimelineTrack>
    </section>
  );
}

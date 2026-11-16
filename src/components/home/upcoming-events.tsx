import Link from "next/link";
import { EventCard } from "@/components/content/event-card";
import { ArrowRight } from "@/components/icons";
import { getSettings } from "@/lib/data/content";
import { getStarEvent, listUpcomingEvents } from "@/lib/data/events";
import { parts, relativeDay } from "@/lib/dates";
import { starIsLive } from "@/lib/naringsliv";

/**
 * Det som händer härnäst som samma kort som på /evenemang, och de tre därefter som rader under det. Kortet ligger från 590 pixlar.
 * Smalare står det, och där är det ensamt i spalten, så bilden får ett lägre format än 16:10: annars blir blocket mycket högre än
 * nyheterna bredvid, och onödigt långt på telefon.
 */
export async function UpcomingEvents() {
  const [[next, ...rest], settings] = await Promise.all([listUpcomingEvents(4), getSettings()]);
  if (!next) return <p className="mt-6 text-stone">Håll utkik, nya evenemang kommer snart.</p>;
  // STAR har en egen sida när mässan är öppen, och då leder evenemanget dit.
  const star = starIsLive(settings) ? await getStarEvent(Number(settings.star_event_id) || null) : null;
  const href = (e: typeof next) => (e.id === star?.id ? "/star" : `/evenemang/${e.slug}`);

  return (
    <div className="@container mt-6 md:mt-7">
      <EventCard event={next} href={href(next)} className="[--omslag-form:5/2] @md:[--omslag-form:3/1]" />
      <ul className="mt-2 divide-y divide-line">
        {rest.map((e) => {
          const d = parts(e.starts_at);
          return (
            <li key={e.id}>
              <Link href={href(e)} className="group flex items-center gap-4 py-3">
                <time dateTime={e.starts_at.slice(0, 10)} className="w-11 shrink-0">
                  <span className="display-tight tabular block text-[1.6rem]">{d.day}</span>
                  <span className="kicker text-stone">{d.monthShort}</span>
                </time>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 font-semibold leading-snug tracking-tight group-hover:underline">{e.title}</span>
                  <span className="text-sm text-stone">
                    {relativeDay(e.starts_at, e.ends_at, e.all_day)} · {e.committee?.short_name ?? "StatLin"}
                  </span>
                </span>
                <ArrowRight size={16} className="shrink-0 text-stone-light transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-ink" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

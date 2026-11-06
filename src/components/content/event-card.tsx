import Link from "next/link";
import { CoverArt } from "./cover-art";
import { SmartImage } from "./smart-image";
import { ArrowUpRight, Clock, MapPin } from "@/components/icons";
import { type DateLocale, formatTimeRange, parts, relativeDay } from "@/lib/dates";
import type { EventItem } from "@/lib/types";
import { cn } from "@/lib/utils";

function DateBlock({ date, className, dark, locale }: { date: string; className?: string; dark?: boolean; locale?: DateLocale }) {
  const p = parts(date, locale);
  return (
    <div
      className={cn(
        "flex w-[4.25rem] shrink-0 flex-col items-center rounded-lg border py-2.5 tabular",
        dark ? "border-paper/15 bg-paper/[0.04] text-paper" : "border-line bg-white text-ink",
        className,
      )}
    >
      <span className={cn("kicker text-[0.62rem]", dark ? "text-red" : "text-red-deep")}>{p.monthShort}</span>
      <span className="display-tight text-[1.9rem] leading-none">{p.day}</span>
      <span className={cn("mt-0.5 font-mono text-[0.62rem] uppercase", dark ? "text-paper/45" : "text-stone")}>{p.weekdayShort}</span>
    </div>
  );
}

/**
 * Kortet är en container. Brett (en kolumn på surfplatta) ligger det med bilden till vänster, och smalt får datumet en egen rad
 * över rubriken. Bilden har inget ovanpå sig: dagen och hur långt det är kvar står i texten.
 */
export function EventCard({ event, priority, className }: { event: EventItem; priority?: boolean; className?: string }) {
  const p = parts(event.starts_at);
  const when = relativeDay(event.starts_at, event.ends_at, event.all_day);
  const soon = when === "Pågår" || when === "I dag" || when === "I morgon";
  return (
    <Link
      href={`/evenemang/${event.slug}`}
      className={cn(
        "group @container relative block rounded-2xl border border-line bg-white p-1.5 transition-[border-color,box-shadow] duration-300 ease-[var(--ease-out-expo)] hover:border-ink/20 hover:shadow-[0_22px_44px_-30px_rgb(0_0_0/0.5)]",
        className,
      )}
    >
      <div className="flex h-full flex-col @xl:flex-row">
        <div className="relative aspect-[16/10] shrink-0 overflow-hidden rounded-[0.7rem] bg-paper-2 @xl:aspect-auto @xl:min-h-52 @xl:w-[44%]">
          {event.cover ? (
            <SmartImage
              image={event.cover}
              priority={priority}
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="h-full w-full transition-transform duration-[1.2s] ease-[var(--ease-out-expo)] group-hover:scale-[1.03]"
              alt=""
            />
          ) : (
            <CoverArt
              seed={event.slug}
              accent={event.committee?.accent}
              logo={event.committee?.logo_url}
              className="h-full w-full transition-transform duration-[1.2s] ease-[var(--ease-out-expo)] group-hover:scale-[1.03]"
            />
          )}
        </div>
        <div className="flex flex-1 gap-4 px-3 pb-3.5 pt-4 @max-2xs:flex-col @max-2xs:gap-2.5 @xl:px-5 @xl:py-5">
          <time
            dateTime={event.starts_at.slice(0, 10)}
            className="flex w-11 shrink-0 flex-col items-center pt-0.5 tabular @max-2xs:w-auto @max-2xs:flex-row @max-2xs:items-baseline @max-2xs:gap-2 @max-2xs:pt-0"
          >
            <span className="kicker text-[0.6rem] text-red-deep">{p.monthShort}</span>
            <span className="display-tight text-[2.1rem] leading-[0.95] @max-2xs:order-first @max-2xs:text-[1.6rem]">{p.day}</span>
            <span className="mt-1 font-mono text-[0.6rem] uppercase tracking-[0.08em] text-stone @max-2xs:mt-0">{p.weekdayShort}</span>
          </time>
          <div className="flex min-w-0 flex-1 flex-col border-l border-line pl-4 @max-2xs:border-l-0 @max-2xs:pl-0">
            <p className="kicker flex min-w-0 items-center gap-2 text-stone">
              {event.committee && (
                <>
                  <span className="size-1.5 shrink-0 rounded-full" style={{ background: event.committee.accent }} aria-hidden />
                  <span className="truncate">{event.committee.short_name}</span>
                  <span aria-hidden className="text-stone-light">
                    ·
                  </span>
                </>
              )}
              <span className={cn("shrink-0", soon && "text-red-deep")}>{when}</span>
              <ArrowUpRight
                size={16}
                className="ml-auto shrink-0 text-stone-light transition-[color,translate] duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-red"
              />
            </p>
            <h3 className="mt-2 text-[1.12rem] font-bold leading-snug tracking-tight [font-stretch:105%] [overflow-wrap:anywhere]">{event.title}</h3>
            {event.summary && <p className="mt-1.5 line-clamp-2 text-[0.92rem] leading-relaxed text-stone">{event.summary}</p>}
            <p className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3.5 text-[0.8rem] text-stone">
              <span className="inline-flex items-center gap-1.5">
                <Clock size={14} className="shrink-0 text-stone-light" />
                {formatTimeRange(event.starts_at, event.ends_at, event.all_day)}
              </span>
              {event.location && (
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <MapPin size={14} className="shrink-0 text-stone-light" />
                  <span className="truncate">{event.location}</span>
                </span>
              )}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}

/** Kompakt rad för listor och kalendervyer. */
/** compact är för smala kolumner, där pilen tar plats från titeln. */
export function EventRow({ event, dark, locale, compact }: { event: EventItem; dark?: boolean; locale?: DateLocale; compact?: boolean }) {
  return (
    <Link
      href={`/evenemang/${event.slug}`}
      className={cn(
        "group flex items-center border-b py-5 transition-colors",
        compact ? "gap-3" : "gap-3 sm:gap-5",
        dark ? "border-paper/10 hover:bg-paper/[0.03]" : "border-line hover:bg-paper-2/60",
      )}
    >
      <DateBlock date={event.starts_at} dark={dark} locale={locale} />
      <div className="min-w-0 flex-1">
        <p className={cn("kicker", dark ? "text-paper/45" : "text-stone")}>
          {event.committee?.short_name ?? "StatLin"} · {formatTimeRange(event.starts_at, event.ends_at, event.all_day, locale)}
        </p>
        <p className={cn("mt-1 line-clamp-3 font-bold leading-snug tracking-tight hyphens-auto [overflow-wrap:anywhere]", compact ? "text-base" : "text-lg")}>{event.title}</p>
        {event.location && <p className={cn("mt-0.5 line-clamp-2 text-sm", dark ? "text-paper/55" : "text-stone")}>{event.location}</p>}
      </div>
      {!compact && <ArrowUpRight size={20} className="shrink-0 text-red opacity-40 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />}
    </Link>
  );
}

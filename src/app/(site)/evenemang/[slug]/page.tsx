import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CoverArt } from "@/components/content/cover-art";
import { EventRow } from "@/components/content/event-card";
import { Gallery } from "@/components/content/gallery";
import { Markdown } from "@/components/content/markdown";
import { SmartImage } from "@/components/content/smart-image";
import { ArrowLeft, ArrowRight, ArrowUpRight, Calendar, Clock, Image as ImageIcon, MapPin, Ticket } from "@/components/icons";
import { ScrollToAnchor } from "@/components/ui/scroll-to-anchor";
import { HeroSkeleton } from "@/components/ui/skeletons";
import { SITE_OG } from "@/lib/site-metadata";
import { getSettings } from "@/lib/data/content";
import { getEventBySlug, listEventImages, listUpcomingEvents } from "@/lib/data/events";
import { isLunchEvent, isStarSlug, starIsLive } from "@/lib/naringsliv";
import { eventEnd, eventSchemaDates, formatDateLong, formatTimeRange, nowLocal, relativeDay } from "@/lib/dates";
import { googleCalendarUrl } from "@/lib/ics";
import { committeeHref } from "@/lib/navigation";
import { siteUrl } from "@/lib/site-url";
import type { EventItem } from "@/lib/types";
import { cn, fitHeading, safeExternalUrl, stripMarkdown } from "@/lib/utils";
import { EditModeButton, Editable } from "@/components/edit-mode/editable";

export async function generateMetadata({ params }: PageProps<"/evenemang/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) return { title: "Evenemanget hittades inte" };
  return {
    title: event.title,
    description: event.summary || stripMarkdown(event.body_md),
    openGraph: event.cover ? { ...SITE_OG, images: [{ url: event.cover.src, width: event.cover.width, height: event.cover.height }] } : SITE_OG,
  };
}

export default function EventPage(props: PageProps<"/evenemang/[slug]">) {
  return (
    <Suspense fallback={<HeroSkeleton />}>
      <EventDetail params={props.params} />
    </Suspense>
  );
}

async function EventDetail({ params }: { params: PageProps<"/evenemang/[slug]">["params"] }) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const [images, more, base, settings] = await Promise.all([
    listEventImages(event.id),
    listUpcomingEvents(4, event.committee_id ?? undefined),
    siteUrl(),
    getSettings(),
  ]);
  const others = more.filter((e) => e.id !== event.id).slice(0, 3);
  const isPast = eventEnd(event.starts_at, event.ends_at, event.all_day) < nowLocal();
  const committeeLink = event.committee && committeeHref(event.committee);
  const signup = safeExternalUrl(event.signup_url);
  const mapUrl = safeExternalUrl(event.location_url) ?? (event.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location + ", Linköping")}` : null);

  const place = event.location || settings.address;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    ...eventSchemaDates(event.starts_at, event.ends_at, event.all_day),
    eventStatus: "https://schema.org/EventScheduled",
    location: place ? { "@type": "Place", name: place, address: place } : undefined,
    description: event.summary || stripMarkdown(event.body_md) || undefined,
    organizer: { "@type": "Organization", name: event.committee?.name ?? "StatLin", url: base },
    image: event.cover ? [`${base}${event.cover.src}`] : undefined,
  };

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Editable target={{ type: "event", id: event.id, committeeId: event.committee_id }} label="Redigera evenemanget" inset penClassName="top-[calc(var(--header-h)+1rem)] right-4">
      <header className="relative border-b border-line">
        <div className="container-site relative pb-10 pt-[calc(var(--header-h)+2.5rem)] md:pb-14 md:pt-[calc(var(--header-h)+3.5rem)]">
          <Link href="/evenemang" className="tryck kicker inline-flex items-center gap-2 text-stone transition-colors hover:text-ink">
            <ArrowLeft size={14} /> Alla evenemang
          </Link>
          <div className="mt-8 flex flex-wrap items-center gap-2 [animation:fade-up_0.8s_var(--ease-out-expo)_backwards]">
            <span className={`chip ${isPast ? "border border-line bg-paper-2 text-stone" : "bg-red text-white"}`}>{isPast ? "Har varit" : relativeDay(event.starts_at, event.ends_at, event.all_day)}</span>
            {event.committee &&
              (committeeLink ? (
                <Link href={committeeLink} className="chip border border-line bg-white text-ink transition-colors hover:border-ink/25">
                  {event.committee.short_name}
                </Link>
              ) : (
                <span className="chip border border-line bg-white text-ink">{event.committee.short_name}</span>
              ))}
          </div>
          <div className="@container mt-6 max-w-5xl [animation:fade-up_0.9s_0.06s_var(--ease-out-expo)_backwards]">
            <h1 className="display [overflow-wrap:break-word]" style={fitHeading(event.title, { maxRem: 4.6, maxVw: 6 })}>
              {event.title}
            </h1>
          </div>
          {event.summary && (
            <p className="mt-6 max-w-2xl text-[1.05rem] leading-relaxed text-stone [animation:fade-up_0.9s_0.12s_var(--ease-out-expo)_backwards] md:text-[1.15rem]">
              {event.summary}
            </p>
          )}
          {/* Omslaget, eller den genererade grafiken, som en inramad bild under rubriken. Grafiken har sin egen mörka yta. */}
          <div className="relative mt-10 aspect-video overflow-hidden rounded-2xl border border-line bg-paper-2 [animation:fade-up_1s_0.18s_var(--ease-out-expo)_backwards] md:aspect-[21/9]">
            {event.cover ? (
              <SmartImage image={event.cover} priority sizes="(min-width: 1280px) 1100px, 100vw" className="h-full w-full" alt="" />
            ) : (
              <CoverArt seed={event.slug} accent={event.committee?.accent} className="h-full w-full" />
            )}
          </div>
        </div>
        <EditModeButton target={{ type: "event-images", id: event.id, committeeId: event.committee_id }} className="absolute bottom-5 right-5 z-30">
          Byt bilder
        </EditModeButton>
      </header>
      </Editable>

      <div className="container-site grid grid-cols-1 gap-12 py-14 md:py-20 lg:grid-cols-12">
        <aside className="lg:sticky lg:top-[calc(var(--header-h)+1.5rem)] lg:col-span-4 lg:col-start-9 lg:row-start-1 lg:self-start">
          <div className="overflow-hidden rounded-2xl border border-line bg-white">
            <dl className="divide-y divide-line">
              <InfoRow icon={<Calendar size={18} />} label="Datum">
                {formatDateLong(event.starts_at)}
              </InfoRow>
              <InfoRow icon={<Clock size={18} />} label="Tid">
                {formatTimeRange(event.starts_at, event.ends_at, event.all_day)}
              </InfoRow>
              {event.location && (
                <InfoRow icon={<MapPin size={18} />} label="Plats">
                  {mapUrl ? (
                    <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="link-underline inline-flex items-center gap-1">
                      {event.location} <ArrowUpRight size={14} className="text-stone" />
                    </a>
                  ) : (
                    event.location
                  )}
                </InfoRow>
              )}
              {event.price && (
                <InfoRow icon={<Ticket size={18} />} label="Pris">
                  {event.price}
                </InfoRow>
              )}
            </dl>
            {/* Ett evenemang som har varit går inte att anmäla sig till eller lägga i kalendern, så där pekar rutan vidare i stället. */}
            <div className="space-y-2.5 border-t border-line bg-paper-2/50 p-4">
              {isPast ? (
                <Link href="/evenemang" className="btn btn-ghost btn-sm w-full">
                  Se vad som är på gång <ArrowRight size={15} />
                </Link>
              ) : (
                <>
                  {signup && (
                    <a href={signup} target="_blank" rel="noopener noreferrer" className="btn btn-red w-full">
                      Anmäl dig <ArrowUpRight size={18} />
                    </a>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <a href={`/evenemang/${event.slug}/kalender.ics`} className="btn btn-ghost btn-sm">
                      <Calendar size={15} /> iCal
                    </a>
                    <a href={googleCalendarUrl(event, base)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                      Google
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>
          {event.committee && <Organizer committee={event.committee} href={committeeLink} />}
        </aside>

        <div className="lg:col-span-7 lg:row-start-1">
          {event.body_md ? <Markdown source={event.body_md} /> : <p className="text-stone">Mer information kommer.</p>}

          {starIsLive(settings) && (isStarSlug(event.slug) || String(event.id) === settings.star_event_id) && (
            <Link href="/star" className="group mt-10 flex items-center justify-between gap-4 rounded-2xl bg-star-navy p-6 text-white">
              <span>
                <span className="kicker block text-white/70">STAR</span>
                <span className="mt-1 block text-lg font-semibold">Se vilka företag som kommer och vad de söker</span>
              </span>
              <ArrowUpRight size={20} className="shrink-0 transition-transform duration-500 group-hover:translate-x-1" />
            </Link>
          )}
          {isLunchEvent(event) && (
            <Link href="/lunchforelasningar" className="group mt-10 flex items-center justify-between gap-4 rounded-2xl border border-line bg-white p-6 transition-colors hover:border-ink/20">
              <span>
                <span className="kicker block text-stone">Lunchföreläsningar</span>
                <span className="mt-1 block text-lg font-semibold">Vad vill du höra nästa gång? Önska och ge stjärnor</span>
              </span>
              <ArrowUpRight size={20} className="shrink-0 text-red transition-transform duration-500 group-hover:translate-x-1" />
            </Link>
          )}

          {images.length > 0 && (
            <section id="galleri" className="mt-16 scroll-mt-28">
              {/* Galleriet länkar hit med #galleri. Delen strömmas in, så på en långsam server finns ankaret inte när Next letar efter det. */}
              <ScrollToAnchor id="galleri" />
              <div className="mb-6 flex items-baseline justify-between border-b border-line pb-4">
                <h2 className="display-tight flex items-center gap-3 text-2xl">
                  <ImageIcon size={22} className="text-red" /> Bilder
                </h2>
                <span className="kicker text-stone">{images.length} st</span>
              </div>
              <Gallery title={event.title} items={images.map((i) => ({ id: i.id, caption: i.caption, image: i.image }))} />
            </section>
          )}
        </div>
      </div>

      {others.length > 0 && (
        <section className="border-t border-line bg-paper-2/40 py-16">
          <div className="container-site">
            <h2 className="kicker text-stone">Fler evenemang {event.committee ? `med ${event.committee.short_name}` : ""}</h2>
            <div className="mt-4 border-t border-line">
              {others.map((e) => (
                <EventRow key={e.id} event={e} />
              ))}
            </div>
          </div>
        </section>
      )}
    </article>
  );
}

/** Arrangören i sidospalten. Ett dolt utskott har ingen sida att länka till, så då står bara namnet där. */
function Organizer({ committee, href }: { committee: NonNullable<EventItem["committee"]>; href: string | null }) {
  const box = "mt-3 flex items-center gap-4 rounded-2xl border border-line bg-white p-4";
  const content = (
    <>
      {committee.logo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={committee.logo_url} alt="" className="size-12 object-contain transition-transform duration-500 group-hover:rotate-[-8deg]" />
      )}
      <span className="min-w-0 flex-1">
        <span className="kicker block text-stone">Arrangör</span>
        <span className="mt-0.5 block font-semibold leading-snug">{committee.name}</span>
      </span>
      {href && <ArrowUpRight size={18} className="text-stone transition-colors group-hover:text-red" />}
    </>
  );
  return href ? (
    <Link href={href} className={cn("group transition-colors hover:border-ink/20", box)}>
      {content}
    </Link>
  ) : (
    <div className={box}>{content}</div>
  );
}

function InfoRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 px-5 py-4">
      <span className="mt-0.5 text-stone">{icon}</span>
      <div className="min-w-0">
        <dt className="kicker text-stone">{label}</dt>
        <dd className="mt-1 font-medium">{children}</dd>
      </div>
    </div>
  );
}

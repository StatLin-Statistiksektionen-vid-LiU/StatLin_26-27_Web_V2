import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BoardCard } from "@/components/content/board-card";
import { EventCard, EventRow } from "@/components/content/event-card";
import { Markdown } from "@/components/content/markdown";
import { NewsCard } from "@/components/content/news-card";
import { FixedBoxLink } from "@/components/fragelada/box-link";
import { ArrowLeft, Instagram, Mail, MessageCircle, Star } from "@/components/icons";
import { WishBox } from "@/components/onskelada/wish-box";
import { HeroSkeleton } from "@/components/ui/skeletons";
import { getCommitteeBySlug, listBoard } from "@/lib/data/content";
import { listPastEvents, listUpcomingEvents } from "@/lib/data/events";
import { listNewsForCommittee } from "@/lib/data/news";
import { safeExternalUrl } from "@/lib/utils";
import { EditModeLink, Editable } from "@/components/edit-mode/editable";

export async function generateMetadata({ params }: PageProps<"/utskott/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const c = await getCommitteeBySlug(slug);
  if (!c || !c.visible) return { title: "Utskottet hittades inte" };
  return { title: `${c.short_name}: ${c.name}`, description: c.tagline };
}

export default function CommitteePage(props: PageProps<"/utskott/[slug]">) {
  return (
    <Suspense fallback={<HeroSkeleton />}>
      <Committee params={props.params} />
    </Suspense>
  );
}

async function Committee({ params }: { params: PageProps<"/utskott/[slug]">["params"] }) {
  const { slug } = await params;
  const c = await getCommitteeBySlug(slug);
  if (!c || !c.visible) notFound();

  const [upcoming, past, news, board] = await Promise.all([
    listUpcomingEvents(6, c.id),
    listPastEvents(6, c.id),
    listNewsForCommittee(c.id, 3),
    listBoard(),
  ]);
  const members = board.filter((b) => b.committee_id === c.id);
  const instagram = safeExternalUrl(c.instagram);
  const wishes = c.wishes_open && c.kind !== "styrelse";

  return (
    <>
      <Editable target={{ type: "committee", id: c.id }} label="Redigera utskottet" inset penClassName="top-[calc(var(--header-h)+1rem)] right-4">
      <header className="relative overflow-hidden border-b border-line">
        <div className="grid-paper pointer-events-none absolute inset-0 text-ink [mask-image:radial-gradient(ellipse_at_70%_30%,black,transparent_70%)]" aria-hidden />
        <div className="container-site relative grid items-center gap-10 pb-12 pt-[calc(var(--header-h)+2.5rem)] md:grid-cols-12 md:pb-16 md:pt-[calc(var(--header-h)+4rem)]">
          <div className="md:col-span-7">
            <Link href="/utskott" className="tryck kicker inline-flex items-center gap-2 text-stone transition-colors hover:text-ink">
              <ArrowLeft size={14} /> Alla utskott
            </Link>
            <h1 className="display mt-8 text-[clamp(2.75rem,7.5vw,6rem)] normal-case [animation:fade-up_0.9s_var(--ease-out-expo)_backwards]">{c.short_name}</h1>
            <p className="mt-3 text-lg font-medium text-stone md:text-xl">{c.name}</p>
            <p className="mt-6 max-w-xl text-[1.05rem] leading-relaxed text-ink/80 md:text-lg">{c.tagline}</p>
            <div className="mt-8 flex flex-wrap gap-2.5">
              {c.email && (
                <a href={`mailto:${c.email}`} className="btn btn-ink">
                  <Mail size={18} /> {c.email}
                </a>
              )}
              {(c.slug === "ubu" || c.slug === "amo") && (
                <FixedBoxLink slug={c.slug} className="btn btn-ghost">
                  <MessageCircle size={18} /> Skriv anonymt
                </FixedBoxLink>
              )}
              {wishes && (
                <a href="#onskelada" className="btn btn-ghost">
                  <Star size={18} /> Önska något
                </a>
              )}
              {instagram && (
                <a href={instagram} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                  <Instagram size={18} /> Instagram
                </a>
              )}
            </div>
          </div>
          {c.logo_url && (
            <div className="flex justify-center md:col-span-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.logo_url} alt={`${c.short_name}-loggan`} fetchPriority="high" className="w-[min(70vw,24rem)] animate-float" />
            </div>
          )}
        </div>
      </header>
      </Editable>

      <section className="container-site grid gap-14 py-16 md:py-24 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <Markdown source={c.description_md} />
          {wishes && (
            <div className="mt-12">
              <WishBox slug={c.slug} name={c.short_name} />
            </div>
          )}
        </div>
        {members.length > 0 && (
          <aside className="lg:col-span-4 lg:col-start-9">
            <p className="kicker text-stone">Kontaktpersoner</p>
            <div className="mt-5 grid grid-cols-2 gap-5 lg:grid-cols-1">
              {members.map((m) => (
                <BoardCard key={m.id} member={m} />
              ))}
            </div>
          </aside>
        )}
      </section>

      <section className="border-t border-line bg-paper-2/40 py-16 md:py-24">
        <div className="container-site">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="display-tight text-[clamp(1.8rem,3.5vw,2.8rem)]">
              Kommande med <span className="mono-accent normal-case text-red-deep">{c.short_name}</span>
            </h2>
            <EditModeLink target={{ type: "committee", id: c.id }} href="/admin/evenemang/ny">
              Nytt evenemang
            </EditModeLink>
          </div>
          {upcoming.length > 0 ? (
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((e) => (
                <EventCard key={e.id} event={e} className="h-full" />
              ))}
            </div>
          ) : (
            <p className="mt-6 text-stone">Inga kommande evenemang just nu.</p>
          )}
          {past.length > 0 && (
            <div className="mt-16">
              <h3 className="kicker text-stone">Tidigare</h3>
              <div className="mt-3 border-t border-line">
                {past.map((e) => (
                  <EventRow key={e.id} event={e} />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {news.length > 0 && (
        <section className="py-16 md:py-24">
          <div className="container-site">
            <h2 className="display-tight text-[clamp(1.8rem,3.5vw,2.8rem)]">Nytt</h2>
            <div className="mt-10 grid gap-10 md:grid-cols-3">
              {news.map((n) => (
                <NewsCard key={n.id} item={n} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { BoardCard } from "@/components/content/board-card";
import { EventCard, EventRow } from "@/components/content/event-card";
import { Markdown } from "@/components/content/markdown";
import { NewsCard } from "@/components/content/news-card";
import { UbuKnappar } from "@/components/content/ubu-knappar";
import { FixedBoxLink } from "@/components/fragelada/box-link";
import { DiscordKnapp } from "@/components/estig/discord-knapp";
import { SpelKort } from "@/components/estig/spel-kort";
import { SpelOnskan } from "@/components/estig/spel-onskan";
import { ArrowLeft, Gamepad, Instagram, Mail, MessageCircle, Star } from "@/components/icons";
import { GenvagKort, NastaKort } from "@/components/karaktar/eget";
import { Emblem } from "@/components/karaktar/motiv";
import { Bildvagg, Delrubrik, Skiljare, Stassen } from "@/components/karaktar/sida";
import { SpelaIgen } from "@/components/karaktar/spela-igen";
import { WishBox } from "@/components/onskelada/wish-box";
import { HeroSkeleton } from "@/components/ui/skeletons";
import { getCommitteeBySlug, listBoard } from "@/lib/data/content";
import { listCommitteeImages, listPastEvents, listUpcomingEvents } from "@/lib/data/events";
import { listNewsForCommittee } from "@/lib/data/news";
import { getBlock } from "@/lib/innehall/server";
import { egenFarg, logglager, UTSKOTT } from "@/lib/karaktar";
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
  // Styrelsen är inget utskott. Den har sin egen sida under Sektionen.
  if (c.kind === "styrelse") permanentRedirect("/sektionen/styrelsen");

  // UBU har egna knappar bland de andra, som den till kursutvärderingarna. eSTIG har Discord, sitt spel och spelönskemål.
  const [upcoming, past, news, bilder, board, ubu, estig] = await Promise.all([
    listUpcomingEvents(6, c.id),
    listPastEvents(6, c.id),
    listNewsForCommittee(c.id, 3),
    listCommitteeImages(c.id, 6),
    listBoard(),
    c.slug === "ubu" ? getBlock("ubu") : null,
    c.slug === "estig" ? getBlock("estig") : null,
  ]);
  const members = board.filter((b) => b.committee_id === c.id);
  // En eller två kontaktpersoner står bredvid texten. Fler, som styrelsens, får en egen rad under den.
  const manga = members.length > 2;
  const instagram = safeExternalUrl(c.instagram);
  const wishes = c.wishes_open;
  // Det egna: motivet runt loggan, rubriken över nästa evenemang och genvägarna (src/lib/karaktar.ts). Styrelsen har inget motiv.
  const eget = UTSKOTT[c.slug];
  const motiv = eget?.motiv;
  const genvagar = eget?.genvagar ?? [];
  // Mästeristassen visas så länge utskottets egen text berättar om den.
  const stass = c.slug === "scb" && /mästeristass/i.test(c.description_md);

  return (
    // Sidans röda blir utskottets färg (.utskott-tema i globals.css).
    <div className="utskott-tema" style={egenFarg(c.accent)}>
      <Editable target={{ type: "committee", id: c.id }} label="Redigera utskottet" inset penClassName="top-[calc(var(--header-h)+1rem)] right-4">
        <header className="utskott-hero relative overflow-hidden">
          <div className="grid-millimeter pointer-events-none absolute inset-0 text-ink [mask-image:radial-gradient(ellipse_at_70%_30%,black,transparent_70%)]" aria-hidden />
          <div className="container-site relative grid items-center gap-10 pb-12 pt-[calc(var(--header-h)+2.5rem)] md:grid-cols-12 md:pb-16 md:pt-[calc(var(--header-h)+4rem)]">
            <div className="md:col-span-7">
              <Link href="/utskott" className="tryck kicker inline-flex items-center gap-2 text-stone transition-colors hover:text-ink">
                <ArrowLeft size={14} /> Alla utskott
              </Link>
              <h1 className="display mt-8 text-[clamp(2.75rem,7.5vw,6rem)] normal-case [animation:fade-up_0.9s_var(--ease-out-expo)_backwards]">{c.short_name}</h1>
              <p className="mt-3 text-lg font-medium text-stone [animation-delay:0.08s] md:text-xl [animation:fade-up_0.9s_var(--ease-out-expo)_backwards]">{c.name}</p>
              <p className="mt-6 max-w-xl text-[1.05rem] leading-relaxed text-ink/80 [animation-delay:0.16s] md:text-lg [animation:fade-up_0.9s_var(--ease-out-expo)_backwards]">{c.tagline}</p>
              <div className="mt-8 flex flex-wrap gap-2.5 [animation-delay:0.24s] [animation:fade-up_0.9s_var(--ease-out-expo)_backwards]">
                {c.email && (
                  <a href={`mailto:${c.email}`} className="btn btn-ink">
                    <Mail size={18} /> {c.email}
                  </a>
                )}
                {estig && <DiscordKnapp estig={estig} />}
                {(c.slug === "ubu" || c.slug === "amo") && (
                  <FixedBoxLink slug={c.slug} className="btn btn-ghost">
                    <MessageCircle size={18} /> Skriv anonymt
                  </FixedBoxLink>
                )}
                {ubu && <UbuKnappar ubu={ubu} />}
                {wishes && (
                  <a href="#onskelada" className="btn btn-ghost">
                    {estig ? (
                      <>
                        <Gamepad size={18} /> Önska ett spel
                      </>
                    ) : (
                      <>
                        <Star size={18} /> Önska något
                      </>
                    )}
                  </a>
                )}
                {instagram && (
                  <a href={instagram} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                    <Instagram size={18} /> Instagram
                  </a>
                )}
              </div>
            </div>
            {/* Loggan med utskottets motiv runt om, ritat på rutpappret. Ett tryck på den spelar entrén igen. */}
            <div className="flex justify-center md:col-span-5">
              <SpelaIgen className="relative block w-[min(82vw,27rem)] cursor-pointer rounded-full">
                <span className="utskott-sken" aria-hidden />
                <Emblem motiv={motiv} logo={c.logo_url} lager={logglager(c.slug, c.logo_url)} entre className="relative text-ink/50" />
              </SpelaIgen>
            </div>
          </div>
        </header>
      </Editable>

      <hr className="border-line" />

      {(upcoming.length > 0 || estig || genvagar.length > 0) && (
        <section className="container-site flex flex-wrap gap-4 pt-10 md:pt-14" aria-label={`Det här är ${c.short_name}`}>
          {upcoming[0] && <NastaKort event={upcoming[0]} rubrik={eget?.nasta ?? `Nästa med ${c.short_name}`} />}
          {estig && <SpelKort />}
          {genvagar.map((g) => (
            <GenvagKort key={g.href} {...g} />
          ))}
        </section>
      )}

      {/* En eller två kontaktpersoner står bredvid texten redan på surfplatta. Annars låg ett ensamt kort under texten med halva raden tom. */}
      <section className="container-site grid gap-14 py-16 md:grid-cols-12 md:py-24">
        <div className={manga ? "md:col-span-12 lg:col-span-8" : "md:col-span-8 lg:col-span-7"}>
          <Markdown source={c.description_md} />
          {wishes && <div className="mt-12">{estig ? <SpelOnskan slug={c.slug} name={c.short_name} estig={estig} /> : <WishBox slug={c.slug} name={c.short_name} />}</div>}
        </div>
        {members.length > 0 && (
          <aside className={manga ? "md:col-span-12" : "md:col-span-4 lg:col-start-9"}>
            <p className="kicker text-stone">Kontaktpersoner</p>
            <div className={manga ? "mt-5 grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-5" : "mt-5 grid grid-cols-2 gap-5 md:grid-cols-1"}>
              {members.map((m) => (
                <BoardCard key={m.id} member={m} />
              ))}
            </div>
          </aside>
        )}
      </section>

      {stass && <Stassen />}

      <Skiljare motiv={motiv} />
      <section className="bg-paper-2/40 py-16 md:py-24">
        <div className="container-site">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <Delrubrik etikett={`Kommande med ${c.short_name}`}>{eget?.kommande ?? "Kommande"}</Delrubrik>
            <EditModeLink target={{ type: "committee", id: c.id }} href="/admin/evenemang/ny">
              Nytt evenemang
            </EditModeLink>
          </div>
          {upcoming.length > 0 ? (
            <div className="mt-10 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {upcoming.map((e) => (
                <EventCard key={e.id} event={e} className="h-full" />
              ))}
            </div>
          ) : (
            <p className="mt-6 text-stone">Inga kommande evenemang just nu.</p>
          )}
          {past.length > 0 && (
            <div className="mt-16">
              <h3 className="kicker text-stone">{eget?.tidigare ?? "Tidigare"}</h3>
              <div className="mt-3 border-t border-line">
                {past.map((e) => (
                  <EventRow key={e.id} event={e} />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {bilder.length > 0 && (
        <>
          <Skiljare motiv={motiv} />
          <Bildvagg bilder={bilder} namn={c.short_name} />
        </>
      )}

      {news.length > 0 && (
        <section className={bilder.length > 0 ? "pb-16 md:pb-24" : "py-16 md:py-24"}>
          <div className="container-site">
            <Delrubrik etikett={`Senaste från ${c.short_name}`}>Nytt</Delrubrik>
            <div className="mt-10 grid gap-10 md:grid-cols-3">
              {news.map((n) => (
                <NewsCard key={n.id} item={n} />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

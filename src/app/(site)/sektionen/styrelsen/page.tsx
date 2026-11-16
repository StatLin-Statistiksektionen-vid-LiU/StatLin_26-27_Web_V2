import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BoardCard } from "@/components/content/board-card";
import { EventCard } from "@/components/content/event-card";
import { Markdown } from "@/components/content/markdown";
import { NewsCard } from "@/components/content/news-card";
import { EditModeLink, Editable } from "@/components/edit-mode/editable";
import { ArrowLeft, Instagram, Mail } from "@/components/icons";
import { Delrubrik } from "@/components/karaktar/sida";
import { Reveal } from "@/components/ui/reveal";
import { HeroSkeleton } from "@/components/ui/skeletons";
import { listBoard, listCommittees } from "@/lib/data/content";
import { listUpcomingEvents } from "@/lib/data/events";
import { listNewsForCommittee } from "@/lib/data/news";
import type { BoardMember } from "@/lib/types";
import { safeExternalUrl } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Styrelsen",
  description: "StatLins styrelse: poster, ansvarsområden och kontaktuppgifter.",
};

export default function BoardPage() {
  return (
    <Suspense fallback={<HeroSkeleton />}>
      <Board />
    </Suspense>
  );
}

/** Samma person på flera poster får ett kort, med posterna hopskrivna. Vakanta poster slås inte ihop. */
function sammanslagna(board: BoardMember[]): BoardMember[] {
  const ut: BoardMember[] = [];
  const plats = new Map<string, number>();
  for (const m of board) {
    const nyckel = m.name.trim().toLocaleLowerCase("sv");
    const i = nyckel ? plats.get(nyckel) : undefined;
    if (i === undefined) {
      if (nyckel) plats.set(nyckel, ut.length);
      ut.push(m);
      continue;
    }
    const f = ut[i];
    ut[i] = {
      ...f,
      post: `${f.post} och ${m.post.charAt(0).toLocaleLowerCase("sv")}${m.post.slice(1)}`,
      bio: [...new Set([f.bio, m.bio].filter(Boolean))].join(" "),
      email: f.email || m.email,
      photo: f.photo ?? m.photo,
      photo_media_id: f.photo_media_id ?? m.photo_media_id,
    };
  }
  return ut;
}

async function Board() {
  // Styrelsen ligger bland utskotten i databasen för att kunna ha egen text, adress och egna evenemang. Den är inget utskott och har ingen egen färg eller logga här.
  const [committees, board] = await Promise.all([listCommittees({ visibleOnly: true }), listBoard()]);
  const c = committees.find((k) => k.kind === "styrelse") ?? null;
  const [upcoming, news] = c ? await Promise.all([listUpcomingEvents(6, c.id), listNewsForCommittee(c.id, 3)]) : [[], []];
  const instagram = c ? safeExternalUrl(c.instagram) : null;
  const alla = sammanslagna(board);
  // Först de som sköter sektionens förvaltning, sedan de som leder ett utskott.
  const forvaltning = alla.filter((m) => !c || m.committee_id === c.id || m.committee_id === null);
  const ansvariga = alla.filter((m) => !forvaltning.includes(m));

  const huvud = (
    <header className="relative overflow-hidden">
      <div className="grid-millimeter pointer-events-none absolute inset-0 text-ink [mask-image:radial-gradient(ellipse_at_70%_30%,black,transparent_70%)]" aria-hidden />
      <div className="container-site relative pb-12 pt-[calc(var(--header-h)+2.5rem)] md:pb-16 md:pt-[calc(var(--header-h)+4rem)]">
        <Link href="/sektionen" className="tryck kicker inline-flex items-center gap-2 text-stone transition-colors hover:text-ink">
          <ArrowLeft size={14} /> Sektionen
        </Link>
        <h1 className="display mt-8 text-[clamp(2.75rem,7.5vw,6rem)] normal-case [animation:fade-up_0.9s_var(--ease-out-expo)_backwards]">
          {c?.short_name ?? "Styrelsen"}
          <span className="text-red">.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-[1.05rem] leading-relaxed text-ink/80 [animation-delay:0.08s] md:text-xl [animation:fade-up_0.9s_var(--ease-out-expo)_backwards]">
          {c?.tagline ?? "Leder sektionen och företräder statistikstudenterna i Linköping."}
        </p>
        {(c?.email || instagram) && (
          <div className="mt-8 flex flex-wrap gap-2.5 [animation-delay:0.16s] [animation:fade-up_0.9s_var(--ease-out-expo)_backwards]">
            {c?.email && (
              <a href={`mailto:${c.email}`} className="btn btn-ink">
                <Mail size={18} /> {c.email}
              </a>
            )}
            {instagram && (
              <a href={instagram} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                <Instagram size={18} /> Instagram
              </a>
            )}
          </div>
        )}
      </div>
    </header>
  );

  return (
    <>
      {c ? (
        <Editable target={{ type: "committee", id: c.id }} label="Redigera styrelsens sida" inset penClassName="top-[calc(var(--header-h)+1rem)] right-4">
          {huvud}
        </Editable>
      ) : (
        huvud
      )}

      <hr className="border-line" />

      <section className="container-site py-16 md:py-24">
        {c?.description_md && (
          <div className="mb-16 max-w-3xl md:mb-20">
            <Markdown source={c.description_md} />
          </div>
        )}
        {alla.length === 0 ? (
          <p className="text-stone">Styrelsen presenteras snart.</p>
        ) : (
          <>
            <Kort rubrik="Förvaltning" poster={forvaltning} />
            {ansvariga.length > 0 && <Kort rubrik="Ansvariga för utskotten" poster={ansvariga} className="mt-16 md:mt-20" />}
          </>
        )}
      </section>

      {c && (upcoming.length > 0 || news.length > 0) && (
        <>
          <hr className="border-line" />
          {upcoming.length > 0 && (
            <section className="bg-paper-2/40 py-16 md:py-24">
              <div className="container-site">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <Delrubrik etikett="Kommande med styrelsen">Kommande</Delrubrik>
                  <EditModeLink target={{ type: "committee", id: c.id }} href="/admin/evenemang/ny">
                    Nytt evenemang
                  </EditModeLink>
                </div>
                <div className="mt-10 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                  {upcoming.map((e) => (
                    <EventCard key={e.id} event={e} className="h-full" />
                  ))}
                </div>
              </div>
            </section>
          )}
          {news.length > 0 && (
            <section className="py-16 md:py-24">
              <div className="container-site">
                <Delrubrik etikett="Senaste från styrelsen">Nytt</Delrubrik>
                <div className="mt-10 grid gap-10 md:grid-cols-3">
                  {news.map((n) => (
                    <NewsCard key={n.id} item={n} />
                  ))}
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}

function Kort({ rubrik, poster, className }: { rubrik: string; poster: BoardMember[]; className?: string }) {
  if (poster.length === 0) return null;
  return (
    <div className={className}>
      <p className="kicker flex items-center gap-3 text-stone">
        <span className="h-px w-8 bg-red" aria-hidden />
        {rubrik}
      </p>
      <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-12 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {poster.map((m, i) => (
          <Reveal key={m.id} delay={(i % 5) * 70}>
            <BoardCard member={m} />
          </Reveal>
        ))}
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, MapPin, Star } from "@/components/icons";
import { EmptySky } from "@/components/star/star-map";
import "@/components/star/star.css";
import { listLunchEvents } from "@/lib/data/events";
import { listPublicWishes } from "@/lib/data/naringsliv";
import { formatDateLong, formatTimeRange, parts, relativeDay } from "@/lib/dates";
import { canVoteOnWish, wishErrorText, WISH_STATUS_LABELS, type LectureWish } from "@/lib/naringsliv";
import type { EventItem } from "@/lib/types";
import { cn, mulberry32 } from "@/lib/utils";
import { WishForm } from "./wish-form";
import { WishStar } from "./wish-star";

export const metadata: Metadata = {
  title: "Lunchföreläsningar",
  description: "Lunchföreläsningar på StatLin: se nästa föreläsning, önska vad du vill höra och ge stjärnor till det du vill att SASU bokar.",
};

const MONTHS = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

// Önskelistan ska gå att använda utan JavaScript, så sidan renderas hel vid varje anrop i stället för med ett skelett.
export const instant = false;

export default async function LunchPage({ searchParams }: PageProps<"/lunchforelasningar">) {
  const [events, wishes, sp] = await Promise.all([listLunchEvents(5), listPublicWishes(), searchParams]);
  const [next, ...others] = events;
  const open = wishes.filter((w) => w.status !== "genomford");
  const done = wishes.filter((w) => w.status === "genomford");
  const totalVotes = wishes.reduce((sum, w) => sum + w.votes, 0);
  const litByServer = Number(sp.stjarna) || null;
  const wishError = wishErrorText(sp.fel);

  return (
    <>
      {/* Rubriken skalar med sektionens bredd och inte fönstrets, så att FÖRELÄSNINGAR ryms även bredvid sajtens sidomeny. */}
      <section className="@container star-sky lunch-himmel relative isolate overflow-hidden pb-40 pt-[calc(var(--header-h)+3rem)] text-white md:pb-44 md:pt-[calc(var(--header-h)+5rem)]">
        <VoteSky votes={totalVotes} />
        <div className="container-site">
          <p className="kicker text-white/70">För studenter · SASU</p>
          <h1 className="display mt-5 text-[clamp(1.5rem,7.6cqi,6.5rem)]">
            Lunch&shy;föreläsningar
          </h1>
          <div className="mt-3 h-1 w-[min(100%,26rem)] bg-[#8f1d1d]" aria-hidden />
          <div className="mt-7 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <p className="max-w-xl text-lg leading-relaxed text-white/85">Mat, en bra föreläsning och en titt på vad du kan bli. Önska vad du vill höra och ge stjärnor, så vet SASU vem de ska ringa.</p>
            {totalVotes > 0 && (
              <p className="kicker shrink-0 text-white/75">
                <span className="mono-accent text-2xl font-semibold text-white">{totalVotes}</span> {totalVotes === 1 ? "stjärna" : "stjärnor"} på himlen, en per röst
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="relative z-10 bg-paper">
        <div className="container-site">
          <div className="-translate-y-28 md:-translate-y-32">{next ? <NextLecture event={next} others={others} /> : <NoLecture />}</div>
        </div>

        <div className="container-site -mt-14 grid gap-10 pb-20 md:-mt-16 md:pb-28 lg:grid-cols-12 lg:gap-14">
          <section id="onskelistan" className="lg:col-span-7">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="display-tight text-3xl md:text-4xl">Önskelistan</h2>
              <a href="#onska" className="btn btn-ghost btn-sm lg:hidden">
                Önska något
              </a>
            </div>
            {sp.sparrad && (
              <p role="status" className="mt-4 rounded-xl border border-red/30 bg-red/[0.06] px-4 py-3 text-sm font-semibold text-red-dark">
                Det gick lite för fort, så den här stjärnan räknades inte. Försök igen om en stund.
              </p>
            )}
            {open.length > 0 ? (
              <>
                <p className="mt-3 max-w-lg text-stone">Flest stjärnor överst. En stjärna per önskemål, och vi sparar inget om vem som gav den.</p>
                <ol className="mt-7 overflow-hidden rounded-[1.75rem] border border-ink/10 bg-white">
                  {open.map((w, i) =>
                    i === 0 && w.votes > 0 ? (
                      <WishLeader key={w.id} wish={w} litByServer={litByServer === w.id} />
                    ) : (
                      <WishRow key={w.id} wish={w} most={open[0].votes} litByServer={litByServer === w.id} />
                    ),
                  )}
                </ol>
              </>
            ) : (
              <div className="mt-7 rounded-[1.75rem] border border-dashed border-ink/25 p-10">
                <p className="display-tight text-2xl">Himlen är tom än så länge</p>
                <p className="mt-2 max-w-md text-stone">Ingen har önskat något ännu. Vad vill du höra om? Bli först, så tänder du den första stjärnan.</p>
              </div>
            )}

            {done.length > 0 && (
              <div className="mt-12">
                <h3 className="kicker text-stone">Det här har redan blivit av</h3>
                <ul className="mt-4 space-y-2">
                  {done.map((w) => (
                    <li key={w.id} className="flex flex-wrap items-baseline gap-x-3">
                      <Star size={14} className="translate-y-0.5 fill-ink/30 text-ink/30" />
                      {w.event_slug ? (
                        <Link href={`/evenemang/${w.event_slug}`} className="link-underline font-semibold">
                          {w.title}
                        </Link>
                      ) : (
                        <span className="font-semibold">{w.title}</span>
                      )}
                      <span className="mono-accent text-sm text-stone">{w.votes} ★</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <aside id="onska" className="lg:col-span-5">
            <div className="star-sky rounded-[1.75rem] p-7 text-white md:p-9 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)]">
              <h2 className="display-tight text-3xl">Önska</h2>
              {sp.tack ? (
                <div role="status" className="mt-5 rounded-xl bg-white px-4 py-3 font-semibold text-ink">
                  Tack! SASU läser ditt önskemål, och sedan hamnar det på listan.
                </div>
              ) : (
                <p className="mt-3 text-white/85">Ett ämne, ett företag eller en person. Du är anonym. SASU läser först, så önskemålet syns inte på listan direkt.</p>
              )}
              {wishError && (
                <p role="alert" className="mt-5 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-red-dark">
                  {wishError}
                </p>
              )}
              <WishForm />
            </div>
          </aside>
        </div>

        <CompanyPointer />
      </div>
    </>
  );
}

/** En extra stjärna för varje röst: himlen över sidan fylls av önskemålen. Tak på 400, så att sidan förblir lätt. */
function VoteSky({ votes }: { votes: number }) {
  const random = mulberry32(20261105);
  const count = Math.min(votes, 400);
  const dots = Array.from({ length: count }, () => `M${Math.round(random() * 1600)} ${Math.round(random() * 600)}h0`);
  // Var femte lyser lite starkare, som på en riktig himmel.
  const bright = dots.filter((_, i) => i % 5 === 0).join("");
  const faint = dots.filter((_, i) => i % 5 !== 0).join("");
  // Ett svagt djup bakom rösterna, så att himlen inte blir tom innan någon har röstat.
  const depth = Array.from({ length: 90 }, () => `M${Math.round(random() * 1600)} ${Math.round(random() * 600)}h0`).join("");
  return (
    <svg className="pointer-events-none absolute inset-0 -z-10 h-full w-full" viewBox="0 0 1600 600" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <path d={depth} stroke="#cddbff" strokeOpacity="0.22" strokeWidth="1.5" strokeLinecap="round" />
      {faint && <path d={faint} stroke="#fff" strokeOpacity="0.75" strokeWidth="1.8" strokeLinecap="round" />}
      {bright && <path d={bright} stroke="#fff" strokeWidth="3" strokeLinecap="round" />}
    </svg>
  );
}

function NextLecture({ event, others }: { event: EventItem; others: EventItem[] }) {
  const { day, month } = parts(event.starts_at);
  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <Link href={`/evenemang/${event.slug}`} className="group grid overflow-hidden rounded-[1.75rem] bg-white shadow-[0_30px_60px_-30px_rgba(11,21,48,0.5)] sm:grid-cols-[11rem_minmax(0,1fr)] lg:col-span-8">
        <div className="flex items-center gap-3 bg-red p-6 text-white sm:flex-col sm:items-start sm:justify-center sm:gap-0">
          <span className="display text-6xl sm:text-7xl">{day}</span>
          <span className="mono-accent text-xl font-semibold uppercase sm:mt-1">{MONTHS[month - 1]}</span>
        </div>
        <div className="flex flex-col p-6 md:p-8">
          <p className="kicker text-stone">
            Nästa föreläsning · <span className="first-letter:uppercase">{relativeDay(event.starts_at, event.ends_at, event.all_day)}</span>
          </p>
          <p className="display-tight mt-3 text-2xl md:text-3xl">{event.title.replace(/^Lunchföreläsning:\s*/i, "")}</p>
          {event.summary && <p className="mt-3 text-stone">{event.summary}</p>}
          <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold">
            <span>{formatTimeRange(event.starts_at, event.ends_at, event.all_day)}</span>
            {event.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={15} className="text-red" /> {event.location}
              </span>
            )}
            <span className="ml-auto inline-flex items-center gap-1.5 text-red-deep transition-transform duration-500 group-hover:translate-x-1">
              Läs mer <ArrowRight size={16} />
            </span>
          </p>
        </div>
      </Link>
      {others.length > 0 ? (
        <div className="rounded-[1.75rem] border border-ink/10 bg-white p-6 lg:col-span-4">
          <p className="kicker text-stone">Sedan</p>
          <ul className="mt-3 divide-y divide-ink/10">
            {others.map((e) => (
              <li key={e.id}>
                <Link href={`/evenemang/${e.slug}`} className="group flex items-baseline justify-between gap-3 py-3">
                  <span className="min-w-0 font-semibold">{e.title.replace(/^Lunchföreläsning:\s*/i, "")}</span>
                  <span className="mono-accent shrink-0 text-sm text-stone">{formatDateLong(e.starts_at).replace(/^\S+\s/, "")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <a href="#onska" className="star-sky group flex flex-col justify-between overflow-hidden rounded-[1.75rem] p-6 text-white lg:col-span-4">
          <div>
            <p className="kicker text-white/70">Sedan då?</p>
            <p className="display-tight mt-3 text-2xl">Det bestämmer du</p>
          </div>
          <div className="mt-4 transition-transform duration-500 group-hover:-translate-y-1">
            <EmptySky />
          </div>
          <span className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold">
            Önska nästa föreläsning <ArrowRight size={16} className="transition-transform duration-500 group-hover:translate-x-1" />
          </span>
        </a>
      )}
    </div>
  );
}

function NoLecture() {
  return (
    <div className="flex flex-col items-start justify-between gap-5 rounded-[1.75rem] bg-white p-7 shadow-[0_30px_60px_-30px_rgba(11,21,48,0.5)] md:flex-row md:items-center md:p-9">
      <div>
        <p className="kicker text-stone">Nästa föreläsning</p>
        <p className="display-tight mt-3 text-2xl md:text-3xl">Ingen är bokad just nu</p>
        <p className="mt-2 max-w-lg text-stone">Så det är fritt fram. Berätta vad du vill höra, så har SASU något att gå på.</p>
      </div>
      <a href="#onska" className="btn btn-red shrink-0">
        <Star size={18} /> Önska något
      </a>
    </div>
  );
}

const CHIP_CLASS: Record<string, string> = {
  onskad: "bg-paper-2 text-ink",
  pa_gang: "bg-star-navy text-white",
  bokad: "bg-red text-white",
};

/** Stjärnan och antalet. Bokade och påbörjade önskemål går inte att rösta på längre, men antalet står kvar. */
function WishVote({ wish, litByServer }: { wish: LectureWish; litByServer: boolean }) {
  if (canVoteOnWish(wish.status)) return <WishStar id={wish.id} title={wish.title} votes={wish.votes} litByServer={litByServer} />;
  return (
    <span className="flex flex-col items-center">
      <span className="relative grid size-14 place-items-center rounded-full border border-ink/10 bg-paper">
        <Star size={24} className="fill-red text-red" />
      </span>
      <span className="wish-count mono-accent mt-1.5 text-sm font-semibold tabular">
        {wish.votes}
        <span className="sr-only"> {wish.votes === 1 ? "stjärna" : "stjärnor"}</span>
      </span>
    </span>
  );
}

function WishMeta({ wish, onSky = false }: { wish: LectureWish; onSky?: boolean }) {
  return (
    <>
      <span className={cn("chip", CHIP_CLASS[wish.status])}>{WISH_STATUS_LABELS[wish.status]}</span>
      {wish.event_slug && (
        <Link href={`/evenemang/${wish.event_slug}`} className={cn("tryck inline-flex items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline", onSky ? "text-white" : "text-red-deep")}>
          Till föreläsningen <ArrowUpRight size={14} />
        </Link>
      )}
    </>
  );
}

/** Överst på listan: det mest önskade får en egen bit himmel, med en prick per stjärna. */
function WishLeader({ wish, litByServer }: { wish: LectureWish; litByServer: boolean }) {
  const random = mulberry32(wish.id);
  const dots = Array.from({ length: Math.min(wish.votes, 90) }, () => `M${Math.round(random() * 800)} ${Math.round(random() * 260)}h0`).join("");
  return (
    <li id={`onskemal-${wish.id}`} className="wish-leader star-sky relative isolate flex items-start gap-4 p-5 text-white md:gap-6 md:p-7">
      <svg className="pointer-events-none absolute inset-0 -z-10 h-full w-full" viewBox="0 0 800 260" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <path d={dots} stroke="#fff" strokeOpacity="0.6" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      <WishVote wish={wish} litByServer={litByServer} />
      <div className="min-w-0 flex-1">
        <p className="kicker text-white/70">Högst på himlen just nu</p>
        <p className="display-tight mt-2 text-xl [overflow-wrap:anywhere] sm:text-2xl md:text-3xl">{wish.title}</p>
        {wish.comment && <p className="mt-2 text-[0.95rem] text-white/85 [overflow-wrap:anywhere]">{wish.comment}</p>}
        <p className="mt-4 flex flex-wrap items-center gap-2">
          <WishMeta wish={wish} onSky />
        </p>
      </div>
    </li>
  );
}

/** En komet: ju fler stjärnor önskemålet har jämfört med det översta, desto längre svans. */
function WishComet({ wish, most }: { wish: LectureWish; most: number }) {
  if (wish.votes === 0 || most === 0) return null;
  const tail = Math.round(24 + 150 * (wish.votes / most));
  const y = 8;
  const x = tail + 8;
  return (
    <svg className="shrink-0" width={x + 8} height="16" viewBox={`0 0 ${x + 8} 16`} aria-hidden>
      <defs>
        <linearGradient id={`komet-${wish.id}`}>
          <stop offset="0" stopColor="var(--color-star-navy)" stopOpacity="0" />
          <stop offset="1" stopColor="var(--color-star-navy)" stopOpacity="0.6" />
        </linearGradient>
      </defs>
      <rect x="0" y={y - 0.75} width={tail} height="1.5" fill={`url(#komet-${wish.id})`} />
      <path className="fill-red" d={`M${x} ${y - 8}Q${x + 1} ${y - 1} ${x + 8} ${y}Q${x + 1} ${y + 1} ${x} ${y + 8}Q${x - 1} ${y + 1} ${x - 8} ${y}Q${x - 1} ${y - 1} ${x} ${y - 8}Z`} />
    </svg>
  );
}

function WishRow({ wish, most, litByServer }: { wish: LectureWish; most: number; litByServer: boolean }) {
  return (
    <li id={`onskemal-${wish.id}`} className="wish-row relative flex items-start gap-4 p-5 md:gap-6 md:p-6">
      <WishVote wish={wish} litByServer={litByServer} />
      <div className="min-w-0 flex-1 pt-1">
        <p className="text-lg font-semibold leading-snug [overflow-wrap:anywhere]">{wish.title}</p>
        {wish.comment && <p className="mt-1 text-[0.95rem] text-stone [overflow-wrap:anywhere]">{wish.comment}</p>}
        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <WishMeta wish={wish} />
          <WishComet wish={wish} most={most} />
        </p>
      </div>
    </li>
  );
}

/** Sidan är studenternas. Ett företag som hamnar här får en väg till företagssidan, där anmälan finns, i stället för önskeformuläret. */
function CompanyPointer() {
  return (
    <section className="border-t border-line">
      <div className="container-site flex flex-col items-start justify-between gap-4 py-10 md:flex-row md:items-center">
        <p className="max-w-2xl text-stone">
          <span className="font-semibold text-ink">Är du från ett företag?</span> Önskelistan är till för studenterna. Vill ni hålla en lunchföreläsning anmäler ni intresse på
          företagssidan.
        </p>
        <Link href="/foretag#lunchforelasning" className="btn btn-ghost shrink-0">
          Håll en lunchföreläsning <ArrowRight size={18} />
        </Link>
      </div>
    </section>
  );
}

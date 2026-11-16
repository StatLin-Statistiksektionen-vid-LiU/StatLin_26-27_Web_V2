import Link from "next/link";
import { Suspense, type ComponentType, type ReactNode } from "react";
import { NextMeetingNotice } from "@/components/admin/meeting-cards";
import { TodoNow } from "@/components/admin/todo-now";
import { WheelCards } from "@/components/admin/wheel-cards";
import { Card, Notice, StatusBadge } from "@/components/admin/ui";
import { ForHand } from "@/components/content/skrivning";
import { Emblem } from "@/components/karaktar/motiv";
import { ArrowUpRight, Edit, Image as ImageIcon, Plus } from "@/components/icons";
import { hasDesign } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { listAudit, yearInNumbers } from "@/lib/data/admin";
import { getCommitteeById } from "@/lib/data/content";
import { listEventsForAdmin } from "@/lib/data/events";
import { kontoKaraktar } from "@/lib/data/karaktar";
import { listNewsForAdmin } from "@/lib/data/news";
import { formatTimestamp, nowLocal, parts } from "@/lib/dates";
import { committeeHref } from "@/lib/navigation";
import { ROLE_LABELS, type EventItem, type SessionUser } from "@/lib/types";
import { cn, simplify } from "@/lib/utils";

const ENTITY_LABELS: Record<string, string> = {
  event: "evenemang",
  event_image: "bild",
  news: "nyhet",
  board: "styrelsepost",
  committee: "utskott",
  page: "sida",
  document: "dokument",
  resource: "hjälpmedel",
  link: "länk",
  innehall: "sajtens texter",
  partner: "partner",
  star_company: "STAR-företag",
  star_page: "STAR-sidan",
  lecture_wish: "lunchönskemål",
  star_intresse: "intresseanmälan",
  user: "konto",
  settings: "inställningar",
  task: "uppdraget",
  wheel_item: "årshjulet",
  project_plan: "projektplanen",
  media: "oanvända filer",
  question_box: "frågelådan",
  meeting: "styrelsemötet",
  meeting_item: "en punkt på dagordningen",
  chat_message: "ett meddelande i chatten",
};
const ACTION_LABELS: Record<string, string> = {
  create: "skapade",
  update: "uppdaterade",
  delete: "tog bort",
  upload: "laddade upp",
  check: "granskade",
  uncheck: "ångrade granskningen av",
  status: "ändrade status på",
  claim: "tog",
  release: "släppte",
  cover: "bytte omslag på",
  logo: "bytte logga på",
  prune: "rensade",
};

export default function Dashboard(props: PageProps<"/admin">) {
  return (
    <Suspense>
      <DashboardContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function DashboardContent({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  const user = await requireUser();
  const sp = await searchParams;
  return (
    <>
      {sp.nekad && <Notice tone="warning">Du har inte behörighet till den sidan.</Notice>}
      {sp.valkommen && <Notice>Lösenordet är bytt. Välkommen!</Notice>}
      {user.role === "committee" ? <CommitteeDashboard user={user} /> : <EditorDashboard user={user} />}
    </>
  );
}

/** Utskottens egen översikt: deras färg och logga, genvägar till det vanligaste och bara deras eget innehåll. */
async function CommitteeDashboard({ user }: { user: SessionUser }) {
  const committee = user.committee_id ? await getCommitteeById(user.committee_id) : null;
  // Grafiskt ansvarig sköter bilderna till alla utskott.
  const design = hasDesign(user);
  const now = nowLocal();
  const [upcoming, latestNews] = await Promise.all([committee ? listEventsForAdmin(committee.id, { since: now, limit: 5 }) : [], committee ? listNewsForAdmin(committee.id, { limit: 4 }) : []]);
  const nowIso = new Date().toISOString();

  // Styrelseposter utan eget utskott (kassör, grafiskt ansvarig …) har ingen egen sida att redigera.
  const board = committee?.kind === "styrelse";
  const actions = [
    ...(design ? [{ href: "/admin/bilder", label: "Bilder och omslag", Icon: ImageIcon }] : []),
    { href: "/admin/evenemang/ny", label: "Nytt evenemang", Icon: Plus },
    { href: "/admin/nyheter/ny", label: "Ny nyhet", Icon: Plus },
    board || !committee ? { href: "/admin/uppdrag/ny", label: "Nytt uppdrag", Icon: Plus } : { href: `/admin/utskott/${committee.id}`, label: "Redigera vår sida", Icon: Edit },
  ];

  return (
    <>
      {!committee && <Notice tone="warning">Ditt konto är inte kopplat till något utskott. Be en administratör koppla det under Konton.</Notice>}
      <Welcome user={user} committee={committee} actions={actions} publicHref={committee ? committeeHref(committee) : null} />


      <NextMeetingNotice />

      <TodoNow user={user} />

      <WheelCards user={user} />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="p-6 lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Våra kommande evenemang</h2>
            <Link href="/admin/evenemang" className="tryck text-sm font-semibold text-red-deep hover:underline">
              Alla
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="mt-6 text-sm text-stone">Inga kommande evenemang. Dags att planera något?</p>
          ) : (
            <EventList events={upcoming} />
          )}
        </Card>

        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Senaste nytt</h2>
            <Link href="/admin/nyheter" className="tryck text-sm font-semibold text-red-deep hover:underline">
              Alla
            </Link>
          </div>
          {latestNews.length === 0 ? (
            <p className="mt-6 text-sm text-stone">Inget nytt ännu.</p>
          ) : (
            <ul className="mt-4 divide-y divide-ink/10">
              {latestNews.map((n) => (
                <li key={n.id}>
                  <Link href={`/admin/nyheter/${n.id}`} className="flex items-center gap-3 py-3 hover:opacity-80">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{n.title}</span>
                      <span className="block text-xs text-stone">{formatTimestamp(n.published_at)}</span>
                    </span>
                    {!n.published ? <StatusBadge published={false} /> : n.published_at > nowIso && <StatusBadge published={false} label="Schemalagd" />}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

async function EditorDashboard({ user }: { user: SessionUser }) {
  const [upcoming, audit] = await Promise.all([listEventsForAdmin(null, { since: nowLocal(), limit: 5 }), listAudit(6)]);

  return (
    <>
      <Welcome
        user={user}
        actions={[
          { href: "/admin/evenemang/ny", label: "Nytt evenemang", Icon: Plus },
          { href: "/admin/nyheter/ny", label: "Ny nyhet", Icon: Plus },
          { href: "/admin/uppdrag/ny", label: "Nytt uppdrag", Icon: Plus },
        ]}
      />

      <NextMeetingNotice />

      <TodoNow user={user} />

      <WheelCards user={user} />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="p-6 lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Kommande evenemang</h2>
            <Link href="/admin/evenemang" className="tryck text-sm font-semibold text-red-deep hover:underline">
              Alla
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="mt-6 text-sm text-stone">Inga kommande evenemang. Dags att planera något?</p>
          ) : (
            <EventList events={upcoming} meta={(e) => e.committee?.short_name ?? "Styrelsen"} />
          )}
        </Card>

        <Card className="p-6 lg:col-span-2">
          <h2 className="font-bold">Senaste ändringar</h2>
          {audit.length === 0 ? (
            <p className="mt-6 text-sm text-stone">Inget har ändrats ännu.</p>
          ) : (
            <ol className="mt-4 space-y-3.5">
              {audit.map((a) => (
                <li key={a.id} className="flex gap-3 text-sm">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-red" aria-hidden />
                  <span className="min-w-0">
                    <span className="font-semibold">{a.user_name ?? "Någon"}</span> {ACTION_LABELS[a.action] ?? a.action} {ENTITY_LABELS[a.entity] ?? a.entity}
                    {a.summary && <span className="block truncate text-stone">{a.summary}</span>}
                    <span className="block font-mono text-[0.7rem] text-stone">{formatTimestamp(a.created_at)}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </>
  );
}

/** Hälsningen efter klockan i Stockholm. */
const greeting = (now: string) => {
  const hour = Number(now.slice(11, 13));
  return hour < 5 ? "Uppe sent" : hour < 10 ? "God morgon" : hour < 18 ? "Hej" : "God kväll";
};

/**
 * Överst på översikten: en hälsning med förnamnet skrivet för hand, posten, och vad sektionen har hunnit med under verksamhetsåret.
 * Kortet är ritat för vit text på utskottets färg (sektionens röda för konton utan utskott), så det behåller ljusa lägets färger
 * även i mörkt läge. Kanten skiljer det från den mörka sidan. Under kortet står det man oftast gör härnäst.
 */
async function Welcome({
  user,
  committee,
  actions,
  publicHref,
}: {
  user: SessionUser;
  committee?: Awaited<ReturnType<typeof getCommitteeById>>;
  actions: { href: string; label: string; Icon: ComponentType<{ size?: number }> }[];
  publicHref?: string | null;
}) {
  const [year, eget] = await Promise.all([yearInNumbers(), kontoKaraktar(user.post, user.committee_id)]);
  const group = committee?.short_name ?? ROLE_LABELS[user.role];
  const [first, ...rest] = user.name.trim().split(/\s+/);
  const numbers = [
    [year.events, "evenemang"],
    [year.news, year.news === 1 ? "nyhet" : "nyheter"],
    [year.tasks, "klara uppdrag"],
  ] as const;
  return (
    <>
      <header className="noise tema-fast relative overflow-hidden rounded-[1.5rem] bg-ink p-5 text-white ring-1 ring-white/10 md:px-7 md:py-8">
        <div
          aria-hidden
          // På telefon ligger skenet i nedre hörnet, så att det inte hamnar bakom namnet.
          className="pointer-events-none absolute -bottom-32 -right-20 size-[16rem] rounded-full opacity-55 blur-3xl md:-right-24 md:-top-40 md:bottom-auto md:size-[30rem]"
          style={{ background: "radial-gradient(closest-side, var(--egen-ljus), transparent)" }}
        />
        {/* Loggan med postens motiv runt om (src/lib/karaktar.ts). På telefon står den i övre hörnet, och kortet skär av den. */}
        <Emblem motiv={eget.motiv} logo={eget.logo} className="pointer-events-none absolute -right-6 -top-6 w-36 text-white/45 [--motiv:var(--egen-ljus)] md:-right-1 md:top-1/2 md:w-44 md:-translate-y-1/2" />
        <div className="relative flex flex-wrap items-end gap-x-10 gap-y-5 md:pr-44">
          <div className="min-w-0 pr-24 md:pr-0">
            <p className="kicker text-[0.62rem] text-white/55">{[user.post, simplify(user.post).includes(simplify(group)) ? null : group].filter(Boolean).join(" · ")}</p>
            <h1 className="display-tight text-[clamp(1.5rem,4vw,2.25rem)] normal-case">
              {greeting(nowLocal())},{" "}
              {eget.smeknamn ? (
                <>
                  {first} <ForHand text={eget.smeknamn} rod /> {rest.join(" ")}
                </>
              ) : (
                <ForHand text={first} rod />
              )}
            </h1>
          </div>
          {numbers.some(([n]) => n > 0) && (
            <div className="md:ml-auto">
              <p className="kicker text-[0.58rem] text-white/45">Sektionen {year.label}</p>
              <dl className="mt-2 flex gap-7">
                {numbers.map(([n, label]) => (
                  <div key={label} className="flex flex-col-reverse">
                    <dt className="mt-1 text-xs text-white/60">{label}</dt>
                    <dd className="text-2xl font-bold leading-none tabular">{n}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </header>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {actions.map(({ href, label, Icon }, i) => (
          <Link key={href} href={href} className={cn("btn btn-sm gap-1.5", i === 0 ? "btn-red" : "btn-ghost bg-white")}>
            <Icon size={15} /> {label}
          </Link>
        ))}
        {publicHref && (
          <Link href={publicHref} target="_blank" className="tryck ml-1 inline-flex items-center gap-1 py-1.5 text-sm font-semibold text-stone hover:text-ink pointer-coarse:py-3">
            Visa vår sida <ArrowUpRight size={14} />
          </Link>
        )}
      </div>
    </>
  );
}

/**
 * Kommande evenemang med datumbricka. meta hamnar på raden under titeln, så att översikten
 * för redaktörer kan visa utskottet. Utkast står utskrivet, det publicerade är det vanliga.
 */
function EventList({ events, meta }: { events: EventItem[]; meta?: (e: EventItem) => ReactNode }) {
  return (
    <ul className="mt-4 divide-y divide-ink/10">
      {events.map((e) => {
        const p = parts(e.starts_at);
        return (
          <li key={e.id}>
            <Link href={`/admin/evenemang/${e.id}`} className="flex items-center gap-4 py-3 hover:opacity-80">
              <span className="flex w-12 shrink-0 flex-col items-center rounded-xl bg-paper py-1.5 tabular">
                <span className="kicker text-[0.55rem] text-red-deep">{p.monthShort}</span>
                <span className="text-lg font-bold leading-none">{p.day}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{e.title}</span>
                <span className="block text-xs text-stone">
                  {meta && <>{meta(e)} · </>}
                  {e.starts_at.slice(11)} {!e.published && "· Utkast"}
                </span>
              </span>
              <ArrowUpRight size={16} className="shrink-0 text-stone" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}


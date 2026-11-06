import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { NextMeetingNotice } from "@/components/admin/meeting-cards";
import { TodoNow } from "@/components/admin/todo-now";
import { WheelCards } from "@/components/admin/wheel-cards";
import { AdminHeader, Card, Notice, StatusBadge } from "@/components/admin/ui";
import { ArrowUpRight, Edit, Image as ImageIcon, Plus } from "@/components/icons";
import { hasDesign } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { listAudit } from "@/lib/data/admin";
import { getCommitteeById } from "@/lib/data/content";
import { listEventsForAdmin } from "@/lib/data/events";
import { listNewsForAdmin } from "@/lib/data/news";
import { formatTimestamp, nowLocal, parts } from "@/lib/dates";
import { committeeHref } from "@/lib/navigation";
import { ROLE_LABELS, type EventItem, type SessionUser } from "@/lib/types";
import { cn, initials, simplify } from "@/lib/utils";

const ENTITY_LABELS: Record<string, string> = {
  event: "evenemang",
  event_image: "bild",
  news: "nyhet",
  board: "styrelsepost",
  committee: "utskott",
  page: "sida",
  document: "dokument",
  resource: "hjälpmedel",
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

  // Styrelseposter utan eget utskott (kassör, grafiskt ansvarig …) visas med sin post och har ingen egen sida.
  const board = committee?.kind === "styrelse";
  const title = board ? user.post || user.name : (committee?.short_name ?? user.name);
  const subtitle = !board && committee && simplify(committee.name) !== simplify(title) ? committee.name : null;
  const postIsName = [committee?.short_name, committee?.name].some((n) => n && simplify(n) === simplify(user.post));
  const kicker = board ? "Styrelsen" : user.post && !postIsName ? user.post : committee?.kind === "utskott" ? "Utskott" : "Post";
  const publicHref = committee ? committeeHref(committee) : null;
  const accent = committee?.accent ?? "#ff0707";

  const actions = [
    ...(design ? [{ href: "/admin/bilder", label: "Bilder och omslag", Icon: ImageIcon }] : []),
    { href: "/admin/evenemang/ny", label: "Nytt evenemang", Icon: Plus },
    { href: "/admin/nyheter/ny", label: "Ny nyhet", Icon: Plus },
    board || !committee ? { href: "/admin/uppdrag/ny", label: "Nytt uppdrag", Icon: Plus } : { href: `/admin/utskott/${committee.id}`, label: "Redigera vår sida", Icon: Edit },
  ];

  return (
    <>
      {!committee && <Notice tone="warning">Ditt konto är inte kopplat till något utskott. Be en administratör koppla det under Konton.</Notice>}
      {/* Kortet är ritat för vit text på utskottets färg, så det behåller ljusa lägets färger även i mörkt läge. Kanten skiljer det från den mörka sidan. */}
      <header className="noise tema-fast relative overflow-hidden rounded-[1.5rem] bg-ink p-4 text-white ring-1 ring-white/10 md:px-6 md:py-5">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-40 size-[30rem] rounded-full opacity-60 blur-3xl"
          style={{ background: `radial-gradient(closest-side, ${accent}, transparent)` }}
        />
        <div className="relative flex min-w-0 items-center gap-4">
            <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-white p-1.5 md:size-14">
              {committee?.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={committee.logo_url} alt="" className="size-full object-contain" />
              ) : (
                <span className="display-tight text-lg" style={{ color: accent }}>
                  {initials(title)}
                </span>
              )}
            </span>
            <div className="min-w-0">
              <p className="kicker text-[0.62rem] text-white/50">{kicker}</p>
              <h1 className="display-tight truncate text-[clamp(1.5rem,4vw,2.25rem)] normal-case">{title}</h1>
              {subtitle && <p className="truncate text-sm text-white/60">{subtitle}</p>}
            </div>
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
  const first = user.name.split(" ")[0];

  return (
    <>
      <AdminHeader
        kicker={ROLE_LABELS[user.role]}
        title={`Hej ${first}`}
        actions={
          <>
            <Link href="/admin/nyheter/ny" className="btn btn-ghost bg-white">
              <Plus size={18} /> Ny nyhet
            </Link>
            <Link href="/admin/evenemang/ny" className="btn btn-red">
              <Plus size={18} /> Nytt evenemang
            </Link>
          </>
        }
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


import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { setTaskStatus } from "@/app/admin/_actions/tasks";
import { TaskActionForm } from "@/components/admin/task-action-form";
import { DueLabel, PersonChip } from "@/components/admin/task-ui";
import { PendingButton } from "@/components/admin/wheel-buttons";
import { ArrowRight, Board, Calendar, Check, Eye, Handshake, Image as ImageIcon, Mail, MessageCircle, Newspaper } from "@/components/icons";
import { canReviewEvents, hasDesign } from "@/lib/auth/permissions";
import { listEventsForAdmin, listEventsToReview, listPastEventsWithoutImages } from "@/lib/data/events";
import { countUnseenQuestions } from "@/lib/data/fragelada";
import { countNewCommitteeWishes } from "@/lib/data/onskelada";
import { canManageNaringsliv, countNewInterest, countNewWishes } from "@/lib/data/naringsliv";
import { listNewsForAdmin } from "@/lib/data/news";
import { countUnclaimedTasks, listOpenTasksTo, listTasksAskingForHelp } from "@/lib/data/tasks";
import { addDaysLocal, formatDate, nowLocal, todayLocal } from "@/lib/dates";
import type { EventItem, SessionUser, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Det som väntar på den inloggade, i den ordning det är bråttom. rank styr ordningen: 0 försenat, 1 inom en vecka eller någon väntar
 * på hjälp, 2 någon har hört av sig eller ett evenemang är nära, 3 det egna som inte är färdigt, 4 och uppåt det som kan vänta.
 */
type Todo = {
  key: string;
  rank: number;
  Icon: ComponentType<{ size?: number; className?: string }>;
  title: string;
  detail?: ReactNode;
  href: string;
  late?: boolean;
  action?: ReactNode;
};

/** Så många av varje slag står som egna rader. Resten samlas på en rad, så att listan går att läsa på en telefon. */
const TASKS_SHOWN = 5;
const EVENTS_SHOWN = 3;
/** Bilder hinner komma in en tid efter ett evenemang. Sedan är det inget som väntar längre, och Bilder har alla. */
const IMAGES_WITHIN_DAYS = 60;

const day = (local: string) => local.slice(0, 10);
const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);

/** Namnen på de första, för en rad som samlar flera. */
function nameFew(titles: string[]) {
  const [first, second, ...rest] = titles;
  if (!second) return first ?? "";
  return rest.length === 0 ? `${first} och ${second}` : `${first}, ${second} och ${rest.length} till`;
}

function DoneButton({ task }: { task: Task }) {
  return (
    <TaskActionForm action={setTaskStatus} id={task.id}>
      <input type="hidden" name="status" value="klar" />
      <PendingButton className="btn btn-sm btn-ghost gap-1.5 bg-white">
        <Check size={15} />
        Klart
        <span className="sr-only">: {task.title}</span>
      </PendingButton>
    </TaskActionForm>
  );
}

function taskTodo(task: Task, today: string, soon: string, userId: number): Todo {
  const overdue = !!task.due_date && task.due_date < today;
  return {
    key: `uppdrag-${task.id}`,
    rank: overdue ? 0 : task.due_date && task.due_date <= soon ? 1 : 3,
    Icon: Board,
    title: task.title,
    late: overdue,
    href: `/admin/uppdrag/${task.id}`,
    action: <DoneButton task={task} />,
    detail: (
      <>
        {task.due_date && <DueLabel date={task.due_date} />}
        {task.status === "hjalp" && <span className="font-semibold text-red-deep">Du har bett om hjälp</span>}
        {task.from_user_id !== userId && (
          <span className="inline-flex min-w-0 items-center gap-1">
            från <PersonChip person={task.from} short className="font-medium text-ink" />
          </span>
        )}
      </>
    ),
  };
}

async function collectTodos(user: SessionUser): Promise<{ todos: Todo[]; moreTasks: number }> {
  const now = nowLocal();
  const today = todayLocal();
  const soon = day(addDaysLocal(today, 7));
  const near = day(addDaysLocal(today, 14));
  const imagesSince = day(addDaysLocal(today, -IMAGES_WITHIN_DAYS));

  // Styrelsens poster med redaktörsroll ansvarar för hela sajten, utskotten för sitt eget. Grafiskt ansvarig sköter bilderna till alla.
  const editor = user.role !== "committee";
  const design = hasDesign(user);
  const own = user.committee_id;
  const ownOrNothing = <T,>(load: (committeeId: number) => Promise<T[]>) => (own ? load(own) : Promise.resolve<T[]>([]));
  const forAll = editor || design;

  const [tasks, askingForHelp, unclaimed, questions, wishes, interest, toReview, events, news, withoutImages] = await Promise.all([
    listOpenTasksTo(user.id, 100),
    listTasksAskingForHelp(user.id, 3),
    countUnclaimedTasks(user),
    countUnseenQuestions(user.id),
    canManageNaringsliv(user) ? countNewWishes() : 0,
    canManageNaringsliv(user) ? countNewInterest() : 0,
    canReviewEvents(user) ? listEventsToReview() : [],
    forAll ? listEventsForAdmin(null, { since: now }) : ownOrNothing((id) => listEventsForAdmin(id, { since: now })),
    editor ? listNewsForAdmin(null, { limit: 200 }) : ownOrNothing((id) => listNewsForAdmin(id, { limit: 200 })),
    forAll ? listPastEventsWithoutImages(null, 50) : ownOrNothing((id) => listPastEventsWithoutImages(id, 50)),
  ]);

  const ownWishes = !editor && user.committee_kind !== "styrelse" ? await countNewCommitteeWishes(own) : 0;
  const todos: Todo[] = tasks.slice(0, TASKS_SHOWN).map((t) => taskTodo(t, today, soon, user.id));

  for (const t of askingForHelp) {
    // Det man själv har skickat är mest bråttom. Resten är en fråga till alla som kan hoppa in.
    const mine = t.from_user_id === user.id;
    todos.push({
      key: `hjalp-${t.id}`,
      rank: mine ? 1 : 2,
      Icon: MessageCircle,
      title: `Behöver hjälp: ${t.title}`,
      detail: t.to ? <PersonChip person={t.to} short className="font-medium text-ink" /> : undefined,
      href: `/admin/uppdrag/${t.id}`,
      late: mine,
    });
  }

  if (questions > 0) {
    todos.push({ key: "fragor", rank: 2, Icon: MessageCircle, title: questions === 1 ? "1 ny fråga i frågelådan" : `${questions} nya frågor i frågelådan`, href: "/admin/fragelada" });
  }
  if (ownWishes > 0) {
    todos.push({ key: "onskelada", rank: 2, Icon: MessageCircle, title: ownWishes === 1 ? "1 nytt önskemål i önskelådan" : `${ownWishes} nya önskemål i önskelådan`, detail: "Skickat anonymt via er sida.", href: `/admin/utskott/${own}` });
  }
  if (interest > 0) {
    todos.push({ key: "intresse", rank: 1, Icon: Handshake, title: interest === 1 ? "1 ny intresseanmälan till STAR" : `${interest} nya intresseanmälningar till STAR`, detail: interest === 1 ? "Ett företag väntar på svar." : "Företagen väntar på svar.", href: "/admin/intresseanmalningar" });
  }
  if (wishes > 0) {
    todos.push({ key: "onskemal", rank: 2, Icon: Mail, title: wishes === 1 ? "1 nytt lunchönskemål" : `${wishes} nya lunchönskemål`, detail: "Syns på sajten först efter godkännande.", href: "/admin/lunchonskemal" });
  }

  // Egna utkast. Utskottet ser hela utskottets, en redaktör bara det hen själv har börjat på: resten är någon annans arbete.
  const draftEvents = events.filter((e) => !e.published && (editor ? e.created_by === user.id : e.created_by === user.id || e.committee_id === own));
  for (const e of draftEvents.slice(0, EVENTS_SHOWN)) {
    todos.push({
      key: `utkast-${e.id}`,
      rank: day(e.starts_at) <= near ? 2 : 3,
      Icon: Calendar,
      title: `Utkast: ${e.title}`,
      detail: `${formatDate(e.starts_at)}. Syns inte på sajten än.`,
      href: `/admin/evenemang/${e.id}`,
    });
  }
  if (draftEvents.length > EVENTS_SHOWN) {
    const rest = draftEvents.length - EVENTS_SHOWN;
    todos.push({ key: "utkast-fler", rank: 3, Icon: Calendar, title: plural(rest, "evenemang till i utkast", "evenemang till i utkast"), href: "/admin/evenemang?visa=utkast" });
  }
  const draftNews = news.filter((n) => !n.published && (!editor || n.author_id === user.id));
  for (const n of draftNews.slice(0, EVENTS_SHOWN)) {
    todos.push({ key: `nyhet-${n.id}`, rank: 3, Icon: Newspaper, title: `Utkast: ${n.title}`, detail: "Nyhet. Syns inte på sajten än.", href: `/admin/nyheter/${n.id}` });
  }

  // Omslagen: grafiskt ansvarig har alla kommande. Ett utskott har sina egna publicerade, för ett utkast står redan på listan.
  const missingCover = events.filter((e) => !e.cover && (design || (!editor && e.committee_id === own && !!e.published)));
  const coverHref = (e: EventItem) => (design ? `/admin/bilder/evenemang/${e.id}` : `/admin/evenemang/${e.id}`);
  for (const e of missingCover.slice(0, EVENTS_SHOWN)) {
    todos.push({
      key: `omslag-${e.id}`,
      rank: day(e.starts_at) <= near ? 2 : 4,
      Icon: ImageIcon,
      title: `Omslag saknas: ${e.title}`,
      detail: `${formatDate(e.starts_at)} · ${e.committee?.short_name ?? "Hela sektionen"}${e.published ? "" : " · Utkast"}`,
      href: coverHref(e),
    });
  }
  if (missingCover.length > EVENTS_SHOWN) {
    const rest = missingCover.length - EVENTS_SHOWN;
    todos.push({ key: "omslag-fler", rank: 4, Icon: ImageIcon, title: plural(rest, "evenemang till saknar omslag", "evenemang till saknar omslag"), href: design ? "/admin/bilder" : "/admin/evenemang" });
  }

  if (toReview.length > 0) {
    todos.push({
      key: "granska",
      rank: 4,
      Icon: Eye,
      title: `${toReview.length} evenemang att granska`,
      detail: nameFew(toReview.map((e) => e.title)),
      href: "/admin/evenemang?visa=ogranskade",
    });
  }

  const recent = withoutImages.filter((e) => day(e.starts_at) >= imagesSince);
  if (recent.length > 0) {
    const [first] = recent;
    todos.push(
      recent.length === 1
        ? { key: "bilder", rank: 5, Icon: ImageIcon, title: `Bilder saknas: ${first.title}`, detail: `${formatDate(first.starts_at)}. Ladda upp så hamnar de i galleriet.`, href: design ? `/admin/bilder/evenemang/${first.id}` : `/admin/evenemang/${first.id}#galleri` }
        : { key: "bilder", rank: 5, Icon: ImageIcon, title: `${recent.length} evenemang saknar bilder`, detail: nameFew(recent.map((e) => e.title)), href: forAll ? "/admin/bilder" : `/admin/evenemang/${first.id}#galleri` },
    );
  }

  if (unclaimed > 0) {
    todos.push({ key: "oppna", rank: 6, Icon: Board, title: unclaimed === 1 ? "1 öppet uppdrag utan ansvarig" : `${unclaimed} öppna uppdrag utan ansvarig`, detail: unclaimed === 1 ? "Vem som helst kan ta det på tavlan." : "Vem som helst kan ta dem på tavlan.", href: "/admin/uppdrag" });
  }

  // sort är stabil, så att uppdragen med tidigast datum står först inom sin grupp.
  return { todos: todos.sort((a, b) => a.rank - b.rank), moreTasks: Math.max(0, tasks.length - TASKS_SHOWN) };
}

function TodoRow({ todo: { Icon, title, detail, href, late, action } }: { todo: Todo }) {
  return (
    <li className="relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-ink/[0.03] sm:px-5">
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", late ? "bg-red/10 text-red-deep" : "bg-paper text-ink/70")}>
        <Icon size={17} />
      </span>
      <div className="min-w-0 flex-1">
        {/* Länkens ::after täcker raden, så att hela raden går att klicka på. Knappen ligger ovanpå och hamnar aldrig inuti länken. */}
        <Link href={href} className="line-clamp-2 text-[0.92rem] font-semibold leading-snug [overflow-wrap:anywhere] after:absolute after:inset-0">
          {title}
        </Link>
        {detail && <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-stone">{detail}</div>}
      </div>
      {action ? <div className="relative shrink-0">{action}</div> : <ArrowRight size={16} className="shrink-0 text-stone" />}
    </li>
  );
}

/** Svaret på vad man ska göra nu, högst upp på översikten för alla roller. Varje rad leder direkt dit det går att göra något åt saken. */
export async function TodoNow({ user }: { user: SessionUser }) {
  const { todos, moreTasks } = await collectTodos(user);
  return (
    <section aria-labelledby="att-gora-nu" className="mt-6 overflow-hidden rounded-[1.5rem] border border-ink/10 bg-white">
      <div className="flex items-baseline justify-between gap-3 border-b border-ink/10 px-4 py-3 sm:px-5">
        <h2 id="att-gora-nu" className="font-bold">
          Att göra nu
        </h2>
        <Link href={moreTasks > 0 ? "/admin/uppdrag?visa=till" : "/admin/uppdrag"} className="tryck text-sm font-semibold text-red-deep hover:underline">
          {moreTasks > 0 ? `Alla ${moreTasks + TASKS_SHOWN} uppdrag till dig` : "Tavlan"}
        </Link>
      </div>
      {todos.length === 0 ? (
        <p className="flex items-center gap-3 px-4 py-5 text-sm text-stone sm:px-5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-600/10 text-emerald-700">
            <Check size={17} />
          </span>
          Inget väntar på dig just nu.
        </p>
      ) : (
        <ul className="divide-y divide-ink/10">
          {todos.map((todo) => (
            <TodoRow key={todo.key} todo={todo} />
          ))}
        </ul>
      )}
    </section>
  );
}

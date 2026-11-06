import Link from "next/link";
import type { ReactNode } from "react";
import { Calendar, Lock, MessageCircle } from "@/components/icons";
import { formatDate, formatDateShort, todayLocal } from "@/lib/dates";
import { TASK_STATUSES, type Task, type TaskPerson, type TaskStatus } from "@/lib/types";
import { cn, simplify } from "@/lib/utils";

/** Alla statusar, i den ordning de står i listor och menyer. */
export const STATUS_ORDER: TaskStatus[] = ["planerad", "pagar", "hjalp", "klar"];

/**
 * Tavlans tre steg. Behöver hjälp är inget eget steg: uppdraget pågår fortfarande, och kortet får en röd markering i Pågår
 * så att alla som ser tavlan kan hoppa in.
 */
export const BOARD_COLUMNS: TaskStatus[] = ["planerad", "pagar", "klar"];
export const columnOf = (status: TaskStatus): TaskStatus => (status === "hjalp" ? "pagar" : status);

/** Valen i statusmenyn. Hjälp står som en variant av Pågår, eftersom det är där kortet ligger. */
export const STATUS_CHOICES: Record<TaskStatus, string> = { ...TASK_STATUSES, hjalp: "Pågår, behöver hjälp" };

export const STATUS_STYLES: Record<TaskStatus, { dot: string; chip: string }> = {
  planerad: { dot: "bg-ink/40", chip: "bg-ink/[0.07] text-ink/70" },
  pagar: { dot: "bg-sky-600", chip: "bg-sky-600/10 text-sky-900" },
  hjalp: { dot: "bg-red", chip: "bg-red/10 text-red-deep" },
  klar: { dot: "bg-emerald-600", chip: "bg-emerald-600/10 text-emerald-800" },
};

export function TaskStatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  return (
    <span className={cn("chip", STATUS_STYLES[status].chip, className)}>
      <span className={cn("size-1.5 rounded-full", STATUS_STYLES[status].dot)} aria-hidden />
      {TASK_STATUSES[status]}
    </span>
  );
}

/**
 * Ett konto som posten det tillhör, med utskottets färg som prick. Den korta formen, utan utskottets namn, är till för trånga rader.
 * Med wrap bryts namnet i stället för att kortas av, för rader där hela namnet ska synas.
 */
export function PersonChip({
  person,
  fallback = "Borttaget konto",
  short = false,
  wrap = false,
  className,
}: {
  person: TaskPerson | null;
  fallback?: string;
  short?: boolean;
  wrap?: boolean;
  className?: string;
}) {
  const dot = { background: person?.accent ?? "#d4d4d4" };
  const committee = !short && person?.committee && simplify(person.committee) !== simplify(person.label) ? person.committee : null;
  if (wrap) {
    return (
      <span className={cn("break-words font-semibold", className)}>
        <span className="mr-1.5 inline-block size-2 rounded-full align-middle ring-1 ring-ink/10" style={dot} aria-hidden />
        {person ? person.label : fallback}
        {committee && <span className="font-normal text-stone"> · {committee}</span>}
      </span>
    );
  }
  return (
    <span className={cn("inline-flex min-w-0 max-w-full items-center gap-1.5 font-semibold", className)}>
      <span className="size-2 shrink-0 rounded-full ring-1 ring-ink/10" style={dot} aria-hidden />
      <span className="truncate">{person ? person.label : fallback}</span>
      {committee && <span className="shrink-0 font-normal text-stone">· {committee}</span>}
    </span>
  );
}

export function DueLabel({ date, done }: { date: string; done?: boolean }) {
  const today = todayLocal();
  const overdue = !done && date < today;
  return (
    <span className={cn("inline-flex items-center gap-1", overdue ? "font-semibold text-red-deep" : "text-stone")}>
      <Calendar size={13} />
      {overdue ? "Försenat · " : ""}
      {/* Årtalet bara när det är ett annat år, som en vårpunkt från årshjulet på hösten. */}
      {formatDate(date, date.slice(0, 4) !== today.slice(0, 4))}
    </span>
  );
}

/** Hela rubriken och vem uppdraget går mellan, när man håller pekaren över. Kortet visar bara mottagaren, och rubriken kan vara avkortad. */
function hoverText(task: Task) {
  const to = task.to_user_id === null ? "vem som helst" : (task.to?.label ?? "borttaget konto");
  return `${task.title}\nFrån ${task.from?.label ?? "borttaget konto"} till ${to}`;
}

function PrivateMark() {
  return (
    <span title="Privat: syns bara för avsändaren, mottagaren och ordf/vice/info" className="relative mt-0.5 shrink-0 text-stone">
      <Lock size={13} />
      <span className="sr-only">Privat</span>
    </span>
  );
}

/** Markeringen på ett kort där mottagaren har bett om hjälp. */
function HelpChip() {
  return <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-red px-2 text-[0.7rem] font-semibold text-white">Behöver hjälp</span>;
}

/** Mottagaren. Ett öppet uppdrag sticker ut, eftersom vem som helst kan ta det. Är det redan klart finns inget att ta. */
function TaskRecipient({ task }: { task: Task }) {
  if (task.to_user_id === null && task.status === "klar") return <span className="shrink-0 text-stone">Ingen mottagare</span>;
  if (task.to_user_id === null) return <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-red/10 px-2 font-semibold text-red-deep">Öppet</span>;
  return <PersonChip person={task.to} short className="max-w-full text-ink/80" />;
}

/** Datumet med månaden förkortad. Försenat syns som rött och läses upp, och listan skriver ut ordet när det finns plats. */
function TaskDue({ date, done, today, spellOut = false }: { date: string; done: boolean; today: string; spellOut?: boolean }) {
  const overdue = !done && date < today;
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 whitespace-nowrap", overdue ? "font-semibold text-red-deep" : "text-stone")}>
      <Calendar size={12} />
      {overdue && <span className={cn("sr-only", spellOut && "@3xl:not-sr-only")}>Försenat ·</span>}
      {formatDateShort(date).replace(/ \d{4}$/, "")}
    </span>
  );
}

function TaskComments({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      <MessageCircle size={13} /> {count}
      <span className="sr-only">{count === 1 ? "kommentar" : "kommentarer"}</span>
    </span>
  );
}

/** Evenemanget och planen uppdraget hör till, på en rad. Långa namn kortas av i stället för att göra raden högre. */
function TaskOrigin({ task, className }: { task: Task; className?: string }) {
  if (!task.event && !task.plan) return null;
  return (
    <span className={cn("min-w-0 gap-2.5 text-[0.72rem] text-stone", className)}>
      {task.event && (
        <span className="min-w-0 truncate">
          <span aria-hidden>↳ </span>
          {task.event.title}
        </span>
      )}
      {task.plan && (
        <span className="min-w-0 truncate">
          <span aria-hidden>▤ </span>
          {task.plan.title}
        </span>
      )}
    </span>
  );
}

/**
 * Rubriken är länken, och dess ::after täcker hela kortet eller raden, som alltså går att klicka var som helst på.
 * Kontrollerna är positionerade och ligger ovanpå, så att en lista eller en knapp aldrig hamnar inuti en länk.
 */
const STRETCHED_LINK = "line-clamp-2 min-w-0 font-semibold leading-snug [overflow-wrap:anywhere] after:absolute after:inset-0 after:rounded-[inherit]";

/**
 * Ett kort på tavlan: rubriken och det man behöver för att välja vad man öppnar. Resten står på uppdragets sida.
 * controls är det som går att göra direkt på kortet, och roomForMenu håller plats åt flyttmenyn i kortets nedre hörn.
 */
export function TaskCard({ task, today, controls, roomForMenu = false }: { task: Task; today: string; controls?: ReactNode; roomForMenu?: boolean }) {
  const done = task.status === "klar";
  return (
    <div className={cn("relative rounded-xl border bg-white px-3 py-2 shadow-[0_1px_0_rgb(0_0_0/0.03)] transition-colors", task.status === "hjalp" ? "border-red/45 hover:border-red" : "border-ink/10 hover:border-ink/30")}>
      {task.status === "hjalp" && (
        <div className="mb-1.5">
          <HelpChip />
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        {/* draggable={false}: det är kortet som dras, inte länkens adress. */}
        <Link href={`/admin/uppdrag/${task.id}`} title={hoverText(task)} draggable={false} className={cn(STRETCHED_LINK, "text-[0.9rem]", done && "text-ink/60")}>
          {task.title}
        </Link>
        {!task.shared && <PrivateMark />}
      </div>
      <div className={cn("mt-1 flex min-w-0 items-center gap-2 text-[0.75rem] text-stone", roomForMenu && "pr-6 pointer-coarse:pr-0")}>
        <TaskRecipient task={task} />
        {task.due_date && <TaskDue date={task.due_date} done={done} today={today} />}
        <TaskComments count={task.comment_count} />
      </div>
      <TaskOrigin task={task} className={cn("mt-0.5 flex", roomForMenu && "pr-6 pointer-coarse:pr-0")} />
      {controls}
    </div>
  );
}

/**
 * Ordningen i listan: det försenade först, sedan efter datum och det utan datum efter det. Det klara sist, det senast klara först.
 * Uppdrag utan datum behåller ordningen de kom i, med det nyaste först.
 */
export function sortTasksForList<T extends Task>(tasks: T[], today: string): T[] {
  const group = (t: Task) => (t.status === "klar" ? 3 : !t.due_date ? 2 : t.due_date < today ? 0 : 1);
  return [...tasks].sort((a, b) => {
    const groups = group(a) - group(b);
    if (groups !== 0) return groups;
    if (group(a) === 3) return (b.completed_at ?? "").localeCompare(a.completed_at ?? "");
    return (a.due_date ?? "").localeCompare(b.due_date ?? "");
  });
}

/* Samma kolumner på rubrikraden och raderna. Bredden avgörs av ytan listan har, så att den också passar bredvid sidomenyn. */
const LIST_COLUMNS = "@3xl:grid @3xl:grid-cols-[minmax(0,1fr)_9.5rem_minmax(0,10rem)_10rem] @3xl:items-center @3xl:justify-items-start @3xl:gap-3 @3xl:px-4";

/** En rad i listan. status och recipient är kontrollerna som går att använda direkt, annars visas bara värdet. */
export function TaskRow({ task, today, status, recipient }: { task: Task; today: string; status?: ReactNode; recipient?: ReactNode }) {
  const done = task.status === "klar";
  return (
    <div className={cn("relative px-3 py-2 transition-colors hover:bg-ink/[0.03]", LIST_COLUMNS)}>
      <div className="min-w-0">
        <div className="flex items-start gap-1.5">
          <Link href={`/admin/uppdrag/${task.id}`} title={hoverText(task)} className={cn(STRETCHED_LINK, "text-[0.92rem]", done && "text-ink/60")}>
            {task.title}
          </Link>
          {!task.shared && <PrivateMark />}
        </div>
        <TaskOrigin task={task} className="mt-0.5 hidden @3xl:flex" />
      </div>
      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.75rem] text-stone @3xl:contents">
        {status ?? <TaskStatusBadge status={task.status} className="h-6 px-2 text-[0.62rem]" />}
        {recipient ?? <TaskRecipient task={task} />}
        <span className="flex items-center gap-2.5">
          {task.due_date ? <TaskDue date={task.due_date} done={done} today={today} spellOut /> : <span className="hidden @3xl:inline">Inget datum</span>}
          <TaskComments count={task.comment_count} />
        </span>
      </div>
    </div>
  );
}

/** Tavlans andra vy: allt i en lista, så att det som är närmast i tiden står överst oavsett status. Raderna kommer från den som vet vad som går att göra med dem. */
export function TaskList({ rows }: { rows: { id: number; row: ReactNode }[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-ink/10 bg-white">
      <div aria-hidden className={cn("kicker hidden border-b border-ink/10 py-2 text-[0.62rem] text-stone @3xl:grid", LIST_COLUMNS)}>
        <span>Uppdrag</span>
        <span>Status</span>
        <span>Till</span>
        <span>Klart senast</span>
      </div>
      <ul className="divide-y divide-ink/10">
        {rows.map(({ id, row }) => (
          <li key={id}>{row}</li>
        ))}
      </ul>
    </div>
  );
}

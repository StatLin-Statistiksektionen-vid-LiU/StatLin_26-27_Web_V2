import Link from "next/link";
import { Suspense } from "react";
import { MarkTasksSeen } from "@/components/admin/mark-tasks-seen";
import { TaskBoardView } from "@/components/admin/task-board";
import { TaskQuickAdd } from "@/components/admin/task-quick-add";
import { AdminHeader, EmptyState, Notice } from "@/components/admin/ui";
import { canUpdateTask, seesAllTasks } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { countUnseenTasks, listTaskRecipients, listTasksFor, type TaskFilter } from "@/lib/data/tasks";
import { todayLocal } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const metadata = { title: "Uppdragstavla" };

export default function TaskBoardPage(props: PageProps<"/admin/uppdrag">) {
  return (
    <Suspense>
      <TaskBoard searchParams={props.searchParams} />
    </Suspense>
  );
}

type TaskView = "tavla" | "lista";

/** Filtret och vyn står i adressen, så att de följer med varandra och går att dela. Ingen kaka: den enda kakan på sajten är inloggningen. */
function boardHref(visa: TaskFilter, vy: TaskView) {
  const query = new URLSearchParams();
  if (visa !== "alla") query.set("visa", visa);
  if (vy === "lista") query.set("vy", "lista");
  const text = query.toString();
  return `/admin/uppdrag${text ? `?${text}` : ""}`;
}

function Segments({ label, items }: { label: string; items: { label: string; href: string; active: boolean }[] }) {
  return (
    <nav aria-label={label} className="inline-flex rounded-full border border-ink/15 bg-white p-1">
      {items.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          aria-current={item.active ? "true" : undefined}
          className={cn("whitespace-nowrap rounded-full px-3 py-2 text-[0.82rem] font-semibold transition-colors sm:px-4 sm:text-sm", item.active ? "bg-ink text-white" : "text-ink/60 hover:text-ink")}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

async function TaskBoard({ searchParams }: { searchParams: PageProps<"/admin/uppdrag">["searchParams"] }) {
  const user = await requireUser();
  const sp = await searchParams;
  const filter: TaskFilter = sp.visa === "till" || sp.visa === "fran" ? sp.visa : "alla";
  const view: TaskView = sp.vy === "lista" ? "lista" : "tavla";
  const [tasks, unseen, recipients] = await Promise.all([listTasksFor(user, filter), countUnseenTasks(user.id), listTaskRecipients()]);
  const tabs: { key: TaskFilter; label: string }[] = [
    { key: "alla", label: "Alla" },
    { key: "till", label: "Till dig" },
    { key: "fran", label: "Från dig" },
  ];

  return (
    <>
      {unseen > 0 && <MarkTasksSeen />}
      {sp.raderat && <Notice>Uppdraget är borttaget.</Notice>}
      <AdminHeader
        kicker="Sektionen"
        title="Uppdragstavla"
        description={
          seesAllTasks(user)
            ? "Uppdrag mellan sektionens poster. Du ser allt, även det som skickats privat."
            : "Uppdrag mellan sektionens poster. Du ser det som delats med alla och det som rör dig."
        }
      />
      <TaskQuickAdd recipients={recipients} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Segments label="Vilka uppdrag" items={tabs.map((t) => ({ label: t.label, href: boardHref(t.key, view), active: filter === t.key }))} />
        <Segments
          label="Visning"
          items={[
            { label: "Tavla", href: boardHref(filter, "tavla"), active: view === "tavla" },
            { label: "Lista", href: boardHref(filter, "lista"), active: view === "lista" },
          ]}
        />
      </div>

      {tasks.length === 0 ? (
        <EmptyState title={filter === "till" ? "Inga uppdrag till dig" : filter === "fran" ? "Du har inte skickat några uppdrag" : "Tavlan är tom"}>
          Behöver ni en affisch, ett inlägg på Instagram eller hjälp på ett evenemang? Skriv det i rutan ovanför och välj rätt post.
        </EmptyState>
      ) : (
        // Antalet kolumner följer ytan tavlan har, så att den också passar bredvid sidomenyn.
        <div className="@container">
          <TaskBoardView
            view={view}
            today={todayLocal()}
            me={recipients.find((r) => r.id === user.id) ?? null}
            tasks={tasks.map((t) => ({ ...t, can_move: canUpdateTask(user, t) }))}
          />
        </div>
      )}
      <p className="mt-4 text-xs text-stone">
        {view === "tavla" && <span className="pointer-coarse:hidden">Dra ett kort till en annan kolumn för att flytta det. </span>}
        Fastnar du kan du be om hjälp på uppdragets sida, så syns det för alla. Avklarade uppdrag försvinner från tavlan efter 30 dagar.
      </p>
    </>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { addTaskComment, claimTask, deleteTask, offerHelp, releaseTask, setTaskStatus } from "@/app/admin/_actions/tasks";
import { ActionForm } from "@/components/admin/action-form";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { Field, TextArea } from "@/components/admin/fields";
import { TaskActionForm } from "@/components/admin/task-action-form";
import { TaskForm } from "@/components/admin/task-form";
import { BOARD_COLUMNS, columnOf, DueLabel, PersonChip, STATUS_STYLES, TaskStatusBadge } from "@/components/admin/task-ui";
import { AdminHeader, Card, Notice } from "@/components/admin/ui";
import { Markdown } from "@/components/content/markdown";
import { ArrowUpRight, Check, Image as ImageIcon, Lock, MessageCircle, Trash, Users } from "@/components/icons";
import { canEditImages, canEditTask, canSeeTask, canUpdateTask } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { listEventsForAdmin } from "@/lib/data/events";
import { getTask, listTaskComments, listTaskRecipients } from "@/lib/data/tasks";
import { formatTimestamp, todayLocal } from "@/lib/dates";
import { TASK_STATUSES } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata = { title: "Uppdrag" };

export default function TaskPage(props: PageProps<"/admin/uppdrag/[id]">) {
  return (
    <Suspense>
      <TaskDetail params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function TaskDetail({
  params,
  searchParams,
}: {
  params: PageProps<"/admin/uppdrag/[id]">["params"];
  searchParams: PageProps<"/admin/uppdrag/[id]">["searchParams"];
}) {
  const user = await requireUser();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const task = /^\d+$/.test(id) ? await getTask(Number(id)) : null;
  if (!task) notFound();
  if (!canSeeTask(user, task)) redirect("/admin/uppdrag");
  const mayUpdate = canUpdateTask(user, task);
  const mayEdit = canEditTask(user, task);
  const [comments, recipients, events] = await Promise.all([
    listTaskComments(task.id),
    mayEdit ? listTaskRecipients() : Promise.resolve([]),
    mayEdit ? listEventsForAdmin(null) : Promise.resolve([]),
  ]);
  const today = todayLocal();

  return (
    <>
      {sp.skapat && <Notice>Uppdraget är skickat. Det syns nu på tavlan{task.to ? ` och hos ${task.to.label}` : ""}.</Notice>}
      <AdminHeader
        back={{ href: "/admin/uppdrag", label: "Uppdragstavla" }}
        kicker={TASK_STATUSES[task.status]}
        title={task.title}
        actions={
          mayEdit && (
            <ConfirmButton action={deleteTask} id={task.id} message={`Ta bort uppdraget "${task.title}"?`}>
              <Trash size={15} /> Ta bort
            </ConfirmButton>
          )
        }
      />

      {/* På en bred skärm står status och detaljer i en egen kolumn. Smalare än så kommer de direkt efter beskrivningen och kommentarerna sist. */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <div className="contents xl:col-span-2 xl:block xl:space-y-6">
          <Card className="p-6 md:col-span-2">
            <h2 className="kicker text-stone">Beskrivning</h2>
            <div className="mt-3">
              {task.description.trim() ? <Markdown source={task.description} /> : <p className="text-stone">Ingen beskrivning.</p>}
            </div>
          </Card>

          <Card className="order-1 p-6 md:col-span-2">
            <h2 className="font-bold">Kommentarer {comments.length > 0 && <span className="text-stone">({comments.length})</span>}</h2>
            {comments.length > 0 && (
              <ol className="mt-4 space-y-4">
                {comments.map((c) => (
                  <li key={c.id} className="rounded-2xl bg-paper/70 p-4">
                    <p className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <PersonChip person={c.author} />
                      <span className="font-mono text-[0.7rem] text-stone">{formatTimestamp(c.created_at)}</span>
                    </p>
                    <div className="mt-2 text-[0.95rem]">
                      <Markdown source={c.body} />
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <div className="mt-5">
              <ActionForm action={addTaskComment} submitLabel="Skicka" stickyFooter={false} resetOnSuccess>
                <input type="hidden" name="task_id" value={task.id} />
                <Field label="Skriv en kommentar" name="body">
                  <TextArea name="body" rows={3} maxLength={2000} placeholder="Utkastet finns här: https://… / Jag kan hjälpa till på lördag!" />
                </Field>
              </ActionForm>
            </div>
          </Card>
        </div>

        <div className="contents xl:block xl:space-y-6">
          <Card className="p-6">
            <h2 className="kicker text-stone">Status</h2>
            {mayUpdate ? (
              <TaskActionForm action={setTaskStatus} id={task.id} className="mt-3">
                {/* Tre steg. Steget uppdraget står i går inte att trycka på, så att Pågår inte tar bort en fråga om hjälp. */}
                {/* I den smala spalten på en dator får prickarna inte plats bredvid Att göra, så de syns bara när kortet är brett. */}
                <div className="@container grid grid-cols-3 gap-1.5">
                  {BOARD_COLUMNS.map((s) => {
                    const current = columnOf(task.status) === s;
                    return (
                      <button
                        key={s}
                        type={current ? "button" : "submit"}
                        name="status"
                        value={s}
                        aria-pressed={current}
                        className={cn(
                          "flex w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border px-1.5 py-2.5 text-sm font-semibold transition-colors",
                          current ? "cursor-default border-ink bg-ink text-white" : "border-ink/10 bg-white hover:border-ink/40",
                        )}
                      >
                        <span className={cn("hidden size-2 shrink-0 rounded-full @2xs:block", STATUS_STYLES[s].dot)} aria-hidden />
                        {TASK_STATUSES[s]}
                      </button>
                    );
                  })}
                </div>
                {task.status === "hjalp" ? (
                  <div className="mt-3 rounded-xl border border-red/30 bg-red/[0.06] p-3">
                    <p className="text-sm font-semibold text-red-deep">Behöver hjälp</p>
                    <p className="mt-1 text-xs text-stone">Alla som ser uppdraget ser att det behövs hjälp. Skriv i kommentarerna vad som behövs.</p>
                    <button type="submit" name="status" value="pagar" className="btn btn-ghost btn-sm mt-3 w-full bg-white">
                      <Check size={15} /> Hjälpen behövs inte längre
                    </button>
                  </div>
                ) : (
                  task.status !== "klar" && (
                    <div className="mt-3">
                      <button type="submit" name="status" value="hjalp" className="btn btn-ghost btn-sm w-full bg-white">
                        <MessageCircle size={15} /> Be om hjälp
                      </button>
                      <p className="mt-2 text-xs text-stone">Kortet får en röd markering på tavlan, så att andra kan hoppa in.</p>
                    </div>
                  )
                )}
              </TaskActionForm>
            ) : (
              <div className="mt-3">
                <TaskStatusBadge status={task.status} />
                <p className="mt-2 text-xs text-stone">Avsändaren och mottagaren ändrar status.</p>
              </div>
            )}
            {task.to_user_id === null && task.status !== "klar" && (
              <TaskActionForm action={claimTask} id={task.id} className="mt-4">
                <button type="submit" className="btn btn-red w-full">
                  <Users size={17} /> Jag tar den
                </button>
                <p className="mt-2 text-xs text-stone">Uppdraget är öppet. Den som tar det blir mottagare.</p>
              </TaskActionForm>
            )}
            {task.status === "hjalp" && task.to_user_id !== null && task.to_user_id !== user.id && (
              <TaskActionForm action={offerHelp} id={task.id} className="mt-4">
                <button type="submit" className="btn btn-red w-full">
                  <Users size={17} /> Jag kan hjälpa till
                </button>
                <p className="mt-2 text-xs text-stone">Det blir en kommentar på uppdraget, så att {task.to?.label ?? "mottagaren"} ser det.</p>
              </TaskActionForm>
            )}
            {task.to_user_id === user.id && task.status !== "klar" && (
              <TaskActionForm action={releaseTask} id={task.id} className="mt-4 border-t border-ink/10 pt-4">
                <button type="submit" className="btn btn-ghost btn-sm w-full bg-white">
                  Släpp uppdraget
                </button>
                <p className="mt-2 text-xs text-stone">{task.shared ? "Det blir öppet igen, så att någon annan kan ta det." : "Det blir öppet igen, och avsändaren kan ge det till någon annan."}</p>
              </TaskActionForm>
            )}
          </Card>

          <Card className="p-6">
            <dl className="space-y-3.5 text-sm">
              <Meta label="Från">
                <PersonChip person={task.from} wrap />
              </Meta>
              <Meta label="Till">
                {task.to_user_id !== null ? (
                  <PersonChip person={task.to} wrap />
                ) : task.status === "klar" ? (
                  <span className="text-stone">Ingen mottagare</span>
                ) : (
                  <span className="font-semibold text-red-deep">Öppet för alla</span>
                )}
              </Meta>
              {task.due_date && (
                <Meta label="Klart senast">
                  <DueLabel date={task.due_date} done={task.status === "klar"} />
                </Meta>
              )}
              {task.event && (
                <Meta label="Evenemang">
                  <Link href={`/evenemang/${task.event.slug}`} target="_blank" className="inline-flex items-center gap-1 font-semibold hover:underline">
                    {task.event.title} <ArrowUpRight size={13} className="text-red" />
                  </Link>
                </Meta>
              )}
              {task.plan && (
                <Meta label="Projektplan">
                  <Link href={`/admin/projektplaner/${task.plan.id}`} className="inline-flex items-center gap-1 font-semibold hover:underline">
                    {task.plan.title} <ArrowUpRight size={13} className="text-red" />
                  </Link>
                </Meta>
              )}
              <Meta label="Syns för">
                {task.shared ? (
                  "Alla poster"
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <Lock size={13} /> Avsändare, mottagare och ordf/vice/info
                  </span>
                )}
              </Meta>
              <Meta label="Skapat">{formatTimestamp(task.created_at)}</Meta>
              {task.completed_at && <Meta label="Klart">{formatTimestamp(task.completed_at)}</Meta>}
            </dl>
            {/* Affischer och omslag är vanliga uppdrag – den som får byta evenemangets bilder kommer dit direkt. */}
            {task.event && canEditImages(user, task.event) && (
              <Link href={`/admin/bilder/evenemang/${task.event.id}`} className="btn btn-ghost btn-sm mt-5 w-full bg-white">
                <ImageIcon size={15} /> Ladda upp omslag
              </Link>
            )}
          </Card>
        </div>
      </div>

      {mayEdit && (
        <details className="group mt-8 rounded-[1.5rem] border border-ink/10 bg-white/60 p-5 open:bg-transparent open:p-0 open:pt-2">
          <summary className="tryck cursor-pointer list-none font-bold group-open:mb-5">Redigera uppdraget</summary>
          <TaskForm
            task={task}
            recipients={recipients}
            events={events.filter((e) => e.starts_at.slice(0, 10) >= today || e.id === task.event_id).reverse()}
          />
        </details>
      )}
    </>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3">
      <dt className="text-stone">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

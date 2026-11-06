"use client";

import { unstable_rethrow } from "next/navigation";
import { startTransition, useCallback, useLayoutEffect, useOptimistic, useState, useSyncExternalStore, type DragEvent } from "react";
import { claimTask, setTaskStatus } from "@/app/admin/_actions/tasks";
import { BOARD_COLUMNS, columnOf, sortTasksForList, STATUS_CHOICES, STATUS_STYLES, TaskCard, TaskList, TaskRow } from "@/components/admin/task-ui";
import { Check, ChevronDown, Users } from "@/components/icons";
import type { FormState } from "@/lib/admin/form";
import { TASK_STATUSES, type Task, type TaskPerson, type TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/** can_move räknas ut på servern: avsändaren, mottagaren och redaktörerna får flytta ett uppdrag. Servern kontrollerar det igen. */
export type BoardTask = Task & { can_move: boolean };
type Change = { id: number; patch: Partial<Task> };

/** Nästa steg som vanligen följer, för en knapp med fingret. Med musen drar man kortet, och menyn har alla val. */
const NEXT_STEP: Partial<Record<TaskStatus, { to: TaskStatus; label: string }>> = {
  planerad: { to: "pagar", label: "Börja" },
  pagar: { to: "klar", label: "Klart" },
  hjalp: { to: "klar", label: "Klart" },
};

const DRAG_TYPE = "application/x-statlin-uppdrag";

/** Bara med en mus: på en pekskärm ska ett långt tryck på ett kort inte bli en dragning mitt i en scrollning. */
const FINE_POINTER = "(hover: hover) and (pointer: fine)";
function subscribeToPointer(notify: () => void) {
  const query = window.matchMedia(FINE_POINTER);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
}
const useFinePointer = () =>
  useSyncExternalStore(
    subscribeToPointer,
    () => window.matchMedia(FINE_POINTER).matches,
    () => false,
  );

export function TaskBoardView({ tasks, view, today, me }: { tasks: BoardTask[]; view: "tavla" | "lista"; today: string; me: TaskPerson | null }) {
  // Kortet flyttas direkt. Går det inte att spara faller det tillbaka av sig självt när åtgärden är klar, och beskedet står ovanför tavlan.
  const [shown, apply] = useOptimistic(tasks, (state: BoardTask[], change: Change) => state.map((t) => (t.id === change.id ? { ...t, ...change.patch } : t)));
  const [error, setError] = useState<string | null>(null);
  const [dragged, setDragged] = useState<number | null>(null);
  const [over, setOver] = useState<TaskStatus | null>(null);
  const draggable = useFinePointer() && view === "tavla";

  // Beskedet gäller det senaste försöket och ska inte stå kvar när man kommer tillbaka till en gömd sida (preserving-ui-state.md).
  useLayoutEffect(() => () => setError(null), []);

  const run = useCallback(
    (change: Change, action: (fd: FormData) => Promise<FormState>, fields: Record<string, string>) => {
      setError(null);
      startTransition(async () => {
        apply(change);
        const fd = new FormData();
        fd.set("id", String(change.id));
        for (const [key, value] of Object.entries(fields)) fd.set(key, value);
        try {
          const res = await action(fd);
          if (res.error) setError(res.error);
        } catch (err) {
          // Nexts egna fel (redirect till inloggningen) ska fram. Nätverksfel och fel i servern blir ett vanligt besked.
          unstable_rethrow(err);
          console.error(err);
          setError("Det gick inte att spara. Kortet står kvar där det stod, försök igen.");
        }
      });
    },
    [apply],
  );

  const move = useCallback(
    (task: Task, status: TaskStatus) => {
      if (task.status === status) return;
      run({ id: task.id, patch: { status, completed_at: status === "klar" ? new Date().toISOString() : null } }, setTaskStatus, { status });
    },
    [run],
  );

  const claim = useCallback(
    (task: Task) => {
      run({ id: task.id, patch: { to_user_id: me?.id ?? null, to: me, status: task.status === "planerad" ? "pagar" : task.status } }, claimTask, {});
    },
    [run, me],
  );

  const endDrag = () => {
    setDragged(null);
    setOver(null);
  };

  const dropProps = (status: TaskStatus) =>
    draggable
      ? {
          onDragOver: (e: DragEvent) => {
            // Bara våra kort. En fil eller en markerad text som dras över tavlan gör ingenting.
            if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            setOver(status);
          },
          onDragLeave: (e: DragEvent) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver((current) => (current === status ? null : current));
          },
          onDrop: (e: DragEvent) => {
            const id = Number(e.dataTransfer.getData(DRAG_TYPE));
            if (!id) return;
            e.preventDefault();
            const task = shown.find((t) => t.id === id);
            endDrag();
            // Ett kort som behöver hjälp ligger redan i Pågår. Att släppa det där ska inte ta bort frågan.
            if (task && columnOf(task.status) !== status) move(task, status);
          },
        }
      : {};

  const errorLine = error && (
    <p role="alert" className="mb-3 rounded-2xl border border-red/30 bg-red/[0.06] px-4 py-3 text-sm font-semibold text-red-dark">
      {error}
    </p>
  );

  if (view === "lista") {
    return (
      <>
        {errorLine}
        <TaskList
          rows={sortTasksForList(shown, today).map((t) => ({
            id: t.id,
            row: (
              <TaskRow
                task={t}
                today={today}
                status={t.can_move ? <StatusMenu task={t} onMove={move} className="relative" /> : undefined}
                recipient={claimable(t) ? <ClaimButton task={t} onClaim={claim} /> : undefined}
              />
            ),
          }))}
        />
      </>
    );
  }

  return (
    <>
      {errorLine}
      <div className="grid gap-3 @2xl:grid-cols-3">
        {BOARD_COLUMNS.map((status) => {
          // De som behöver hjälp står först i Pågår, så att de syns.
          const column = shown.filter((t) => columnOf(t.status) === status).sort((a, b) => Number(b.status === "hjalp") - Number(a.status === "hjalp"));
          return (
            <section
              key={status}
              aria-labelledby={`kolumn-${status}`}
              {...dropProps(status)}
              className={cn(
                "min-w-0 rounded-2xl bg-ink/[0.035] p-2 transition-colors",
                // Staplade kolumner utan innehåll är bara i vägen, utom när ett kort ska släppas i dem.
                column.length === 0 && dragged === null && "@max-2xl:hidden",
                over === status && "bg-red/[0.07] ring-2 ring-red/40",
              )}
            >
              <h2 id={`kolumn-${status}`} className="flex items-center justify-between px-1.5 pb-2 pt-1 text-sm font-bold">
                <span className="flex items-center gap-2">
                  <span className={cn("size-2 rounded-full", STATUS_STYLES[status].dot)} aria-hidden />
                  {TASK_STATUSES[status]}
                </span>
                <span className="tabular text-stone">{column.length}</span>
              </h2>
              {column.length === 0 ? (
                <p className="rounded-xl border border-dashed border-ink/15 px-3 py-4 text-center text-xs text-stone">{dragged !== null ? "Släpp här" : "Inget här"}</p>
              ) : (
                <ul className="space-y-2">
                  {column.map((t) => (
                    <li
                      key={t.id}
                      draggable={draggable && t.can_move}
                      onDragStart={(e) => {
                        // Bara själva kortet: en markerad text eller en länk ska inte starta en flytt.
                        e.dataTransfer.setData(DRAG_TYPE, String(t.id));
                        e.dataTransfer.effectAllowed = "move";
                        setDragged(t.id);
                      }}
                      onDragEnd={endDrag}
                      className={cn(draggable && t.can_move && "cursor-grab active:cursor-grabbing", dragged === t.id && "opacity-40")}
                    >
                      <TaskCard
                        task={t}
                        today={today}
                        roomForMenu={t.can_move}
                        controls={<CardControls task={t} onMove={move} onClaim={claim} />}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}

/** Det som går att göra direkt på kortet. Med musen är flyttmenyn en liten pil i hörnet, med fingret får allt egna knappar. */
function CardControls({ task, onMove, onClaim }: { task: BoardTask; onMove: (t: Task, s: TaskStatus) => void; onClaim: (t: Task) => void }) {
  const open = task.to_user_id === null;
  const next = NEXT_STEP[task.status];
  if (!task.can_move && !claimable(task)) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {claimable(task) && <ClaimButton task={task} onClaim={onClaim} className="mt-2" />}
      {task.can_move && !open && next && (
        <button type="button" onClick={() => onMove(task, next.to)} className="btn btn-sm btn-ghost relative mt-2 hidden gap-1.5 bg-white pointer-coarse:inline-flex">
          {next.to === "klar" && <Check size={15} />}
          {next.label}
        </button>
      )}
      {task.can_move && (
        <StatusMenu task={task} onMove={onMove} compact className="absolute bottom-1 right-1 pointer-coarse:relative pointer-coarse:bottom-auto pointer-coarse:right-auto pointer-coarse:mt-2" />
      )}
    </div>
  );
}

/** Ett öppet uppdrag går att ta så länge det inte är klart. Ett klart kort med Jag tar den säger emot sig självt. */
function claimable(task: Task) {
  return task.to_user_id === null && task.status !== "klar";
}

function ClaimButton({ task, onClaim, className }: { task: Task; onClaim: (t: Task) => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => onClaim(task)}
      className={cn(
        "relative inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-red/10 px-2.5 text-[0.75rem] font-semibold text-red-deep transition-colors hover:bg-red hover:text-white pointer-coarse:h-11 pointer-coarse:px-4 pointer-coarse:text-[0.85rem]",
        className,
      )}
    >
      <Users size={13} /> Jag tar den
    </button>
  );
}

/**
 * Status som en vanlig lista, så att den fungerar med tangentbord, skärmläsare och telefonens egen väljare. Listan är osynlig
 * och täcker det man ser. Kompakt på kortet, där kolumnen redan säger vilken status det är: med fingret står det Flytta, med
 * musen räcker en pil.
 */
function StatusMenu({ task, onMove, compact = false, className }: { task: BoardTask; onMove: (t: Task, s: TaskStatus) => void; compact?: boolean; className?: string }) {
  const styles = STATUS_STYLES[task.status];
  return (
    <span
      title={`Flytta. Nu: ${STATUS_CHOICES[task.status]}`}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full transition-colors focus-within:ring-2 focus-within:ring-ink/50",
        compact
          ? "size-6 justify-center text-stone hover:bg-ink/10 hover:text-ink pointer-coarse:h-11 pointer-coarse:w-auto pointer-coarse:border pointer-coarse:border-ink/20 pointer-coarse:px-4 pointer-coarse:text-[0.85rem] pointer-coarse:font-semibold pointer-coarse:text-ink"
          : cn("h-6 whitespace-nowrap px-2 font-mono text-[0.62rem] font-medium uppercase tracking-[0.08em] pointer-coarse:h-11 pointer-coarse:px-3.5 pointer-coarse:text-[0.68rem]", styles.chip),
        className,
      )}
    >
      {compact ? (
        <span className="hidden pointer-coarse:inline">Flytta</span>
      ) : (
        <>
          <span className={cn("size-1.5 rounded-full", styles.dot)} aria-hidden />
          {TASK_STATUSES[task.status]}
        </>
      )}
      <ChevronDown size={13} />
      <select
        aria-label={`Status för ${task.title}`}
        value={task.status}
        onChange={(e) => onMove(task, e.target.value as TaskStatus)}
        // 16 px: iOS zoomar annars in sidan när listan får fokus.
        className="absolute inset-0 size-full cursor-pointer appearance-none rounded-full text-[16px] opacity-0"
      >
        {/* Tre steg och hjälpen för sig, som på uppdragets sida. Hjälp lägger kortet i Pågår med en röd markering. */}
        <optgroup label="Steg">
          {BOARD_COLUMNS.map((s) => (
            <option key={s} value={s}>
              {s === "pagar" && task.status === "hjalp" ? "Pågår, hjälpen behövs inte längre" : TASK_STATUSES[s]}
            </option>
          ))}
        </optgroup>
        <optgroup label="Hjälp">
          <option value="hjalp">{task.status === "hjalp" ? "Behöver hjälp" : "Be om hjälp"}</option>
        </optgroup>
      </select>
    </span>
  );
}

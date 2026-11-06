import Link from "next/link";
import { addWheelItemToBoard, setWheelStatus } from "@/app/admin/_actions/arshjul";
import { TaskActionForm } from "@/components/admin/task-action-form";
import { PendingButton } from "@/components/admin/wheel-buttons";
import { ArrowUpRight, Board, Check, ClipboardList, Edit } from "@/components/icons";
import { placementLabel, TERM_LABELS, termOfMonth, type WheelItem, type WheelState, type WheelStatus } from "@/lib/arshjul";
import { TASK_STATUSES, type TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_CHIP: Partial<Record<WheelStatus, { label: string; className: string }>> = {
  planerad: { label: "Planerad", className: "bg-ink text-white" },
  klar: { label: "Klar i år", className: "bg-emerald-600/10 text-emerald-800" },
  hoppad: { label: "Hoppas över i år", className: "bg-ink/[0.07] text-ink/60" },
};

const smallBtn = "btn btn-sm btn-ghost bg-white !px-3";
const quietBtn = "rounded-full px-3 py-1.5 text-sm font-semibold text-stone hover:bg-ink/[0.05] hover:text-ink pointer-coarse:py-3";

/** Knapparna på en punkt. Lägga på tavlan och skapa en plan får alla poster, medan läget ändras av ägaren, ansvarig post och admin. */
function WheelActions({ item, year, when, state, status, canChange, compact }: { item: WheelItem; year: number; when: string; state: WheelState | undefined; status: WheelStatus; canChange: boolean; compact?: boolean }) {
  const statusForm = (value: string, label: string, className = quietBtn) => (
    <TaskActionForm action={setWheelStatus} id={item.id} className="contents">
      <input type="hidden" name="year" value={year} />
      <input type="hidden" name="status" value={value} />
      <PendingButton className={className}>{label}</PendingButton>
    </TaskActionForm>
  );
  const row = cn("flex flex-wrap items-center gap-1.5", compact ? "mt-2" : "mt-3");
  if (status === "klar" || status === "hoppad") return canChange ? <div className={row}>{statusForm("oppen", "Ångra")}</div> : null;
  // Uppdragets läge på tavlan, så att hjulet visar om någon har börjat eller behöver hjälp.
  const task = state?.task_status && Object.hasOwn(TASK_STATUSES, state.task_status) ? (state.task_status as TaskStatus) : null;
  return (
    <div className={row}>
      {state?.task_id ? (
        <Link href={`/admin/uppdrag/${state.task_id}`} className={smallBtn}>
          <Board size={15} /> På tavlan{" "}
          {task && <span className={cn("font-normal", task === "hjalp" ? "text-red-deep" : "text-stone")}>· {TASK_STATUSES[task]}</span>}
          <ArrowUpRight size={13} className="text-stone" />
        </Link>
      ) : state?.project_plan_id ? null : (
        <TaskActionForm action={addWheelItemToBoard} id={item.id} className="contents">
          <input type="hidden" name="year" value={year} />
          <PendingButton className={smallBtn}>
            <Board size={15} /> Lägg på tavlan
          </PendingButton>
        </TaskActionForm>
      )}
      {state?.project_plan_id ? (
        <Link href={`/admin/projektplaner/${state.project_plan_id}`} className={smallBtn}>
          <ClipboardList size={15} /> Till planen <ArrowUpRight size={13} className="text-stone" />
        </Link>
      ) : (
        <Link href={`/admin/projektplaner/ny?punkt=${item.id}&ar=${year}`} className={smallBtn}>
          <ClipboardList size={15} /> Projektplan
        </Link>
      )}
      {canChange && (
        <span className="flex flex-wrap items-center gap-0.5">
          {statusForm("klar", `Klar ${when}`)}
          {statusForm("hoppad", compact ? "Hoppa över" : `Hoppa över ${when}`)}
        </span>
      )}
    </div>
  );
}

export function WheelItemRow({
  item,
  year,
  state,
  status,
  canChange,
  late,
  showPlacement,
  compact,
  thisYear,
}: {
  item: WheelItem;
  year: number;
  /** Kalenderåret just nu. Gäller punkten ett annat år står året på knapparna i stället för "i år". */
  thisYear?: number;
  state: WheelState | undefined;
  status: WheelStatus;
  canChange: boolean;
  late?: boolean;
  showPlacement?: boolean;
  /** På översikten: bara det som behövs för att bestämma sig. Beskrivningen finns i hjulet. */
  compact?: boolean;
}) {
  const chip = STATUS_CHIP[status];
  const closed = status === "klar" || status === "hoppad";
  const when = thisYear === undefined || thisYear === year ? "i år" : String(year);
  return (
    <article className={cn("@container rounded-2xl border border-ink/10 bg-white", compact ? "p-3" : "p-4", closed && "bg-white/60")}>
      {/* Är kortet smalt får etiketten en egen rad, annars krockar den med rubriken. */}
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1.5">
        <h3 className={cn("min-w-0 flex-1 basis-[calc(100%-2.75rem)] font-semibold leading-snug [overflow-wrap:anywhere] @md:basis-0", closed && "text-ink/60")}>{item.title}</h3>
        {chip && (
          <span className={cn("chip order-last @md:order-none", chip.className)}>
            {status === "klar" && <Check size={12} strokeWidth={2.5} />}
            {status === "klar" ? `Klar ${when}` : status === "hoppad" ? `Hoppas över ${when}` : chip.label}
          </span>
        )}
        {canChange && (
          <Link href={`/admin/arshjul/${item.id}`} className="relative grid size-8 shrink-0 place-items-center rounded-full text-stone after:absolute after:-inset-1.5 hover:bg-ink/[0.05] hover:text-ink" aria-label={`Ändra ${item.title}`} title="Ändra">
            <Edit size={15} />
          </Link>
        )}
      </div>
      {item.description && !closed && !compact && <p className="mt-1 text-sm leading-relaxed text-stone">{item.description}</p>}
      <p className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.72rem] tracking-wide text-ink/70", compact ? "mt-1" : "mt-2")}>
        {showPlacement && (
          <span className="uppercase">
            {placementLabel(item)}
            {item.month !== null && ` · ${TERM_LABELS[termOfMonth(item.month)]}`}
          </span>
        )}
        {item.responsible && <span>{item.responsible}</span>}
        {item.depends_on && (
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rotate-45 bg-ink" aria-hidden />
            Beror på: {item.depends_on}
          </span>
        )}
        {late && <span className="font-semibold text-red-deep">Månaden har passerat</span>}
      </p>
      <WheelActions item={item} year={year} when={when} state={state} status={status} canChange={canChange} compact={compact} />
    </article>
  );
}

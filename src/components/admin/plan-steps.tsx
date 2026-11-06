"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deletePlanStep, savePlanStep, sendPlanSteps, setPlanStepDone } from "@/app/admin/_actions/projektplaner";
import { ActionForm } from "@/components/admin/action-form";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { Field, TextArea, TextInput } from "@/components/admin/fields";
import { STATUS_STYLES } from "@/components/admin/task-ui";
import { ArrowUpRight, Check, Trash } from "@/components/icons";
import type { FormState } from "@/lib/admin/form";
import type { PlanStep } from "@/lib/data/arshjul";
import { formatDate } from "@/lib/dates";
import { weeksBefore } from "@/lib/projektplan-mallar";
import { TASK_STATUSES, type TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export type PlanRecipient = { id: number; label: string; board: boolean };

const weekLabel = (weeks: number) => (weeks === 0 ? "Dagen" : weeks > 0 ? `−${weeks} v` : `+${-weeks} v`);

/** Ett steg som inte är skickat ändras här. Är det skickat är uppdraget på tavlan det som gäller. */
function StepEdit({ step, onDone }: { step: PlanStep; onDone: () => void }) {
  const field = (name: string) => `steg-${step.id}-${name}`;
  return (
    <div className="mt-3 rounded-xl bg-ink/[0.035] p-3 print:hidden">
      <ActionForm action={savePlanStep} stickyFooter={false} onSuccess={onDone} className="space-y-3">
        <input type="hidden" name="id" value={step.id} />
        <Field label="Rubrik" name="title" inputId={field("title")} required>
          <TextInput id={field("title")} name="title" defaultValue={step.title} maxLength={140} />
        </Field>
        <Field label="Klart senast" name="due_date" inputId={field("due_date")} required>
          <TextInput id={field("due_date")} type="date" name="due_date" defaultValue={step.due_date ?? ""} />
        </Field>
        <Field label="Beskrivning" name="description" inputId={field("description")}>
          <TextArea id={field("description")} name="description" defaultValue={step.description} maxLength={2000} />
        </Field>
      </ActionForm>
      <div className="mt-3 border-t border-ink/10 pt-3">
        <ConfirmButton action={deletePlanStep} id={step.id} message={`Ta bort steget "${step.title}" ur planen?`}>
          <Trash size={15} /> Ta bort steget
        </ConfirmButton>
      </div>
    </div>
  );
}

function StepRow({
  step,
  planDate,
  today,
  canChange,
  pending,
  onSend,
  onToggle,
}: {
  step: PlanStep;
  planDate: string;
  today: string;
  canChange: boolean;
  pending: boolean;
  onSend: () => void;
  onToggle: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const sent = step.task_id !== null;
  const editable = canChange && !sent;
  const late = !step.done && !!step.due_date && step.due_date < today;
  const box = cn("grid size-4 translate-y-0.5 place-items-center rounded-[3px] border [print-color-adjust:exact]", step.done ? "border-ink bg-ink text-white" : "border-ink/30");
  const titleStyle = cn("font-semibold leading-snug print:text-[0.82rem] print:font-medium print:no-underline", step.done && "text-ink/60");
  const weeks = step.due_date ? weekLabel(weeksBefore(planDate, step.due_date)) : "–";
  return (
    <li className="py-2.5 print:py-1">
      <div className="grid grid-cols-[1.25rem_minmax(0,1fr)] items-baseline gap-x-2 sm:grid-cols-[1.25rem_3.25rem_minmax(0,1fr)] print:grid-cols-[1.25rem_3.25rem_minmax(0,1fr)]">
        {editable ? (
          <button
            type="button"
            role="checkbox"
            aria-checked={step.done}
            aria-label={`${step.title} är klart`}
            disabled={pending}
            onClick={onToggle}
            className={cn(box, "relative transition-colors after:absolute after:-inset-3 hover:border-ink disabled:opacity-60")}
          >
            {step.done && <Check size={11} strokeWidth={3} />}
          </button>
        ) : (
          <span className={box}>
            {step.done && <Check size={11} strokeWidth={3} />}
            <span className="sr-only">{step.done ? "Klart" : "Inte klart"}</span>
          </span>
        )}
        <span className="hidden font-mono text-[0.72rem] text-stone tabular sm:inline print:inline">{weeks}</span>
        <div className="min-w-0">
          {sent ? (
            <Link href={`/admin/uppdrag/${step.task_id}`} className={cn(titleStyle, "tryck underline decoration-ink/25 underline-offset-2 hover:decoration-ink")}>
              {step.title}
            </Link>
          ) : (
            <span className={titleStyle}>{step.title}</span>
          )}
          <div className="mt-0.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 print:mt-0">
            <span className="flex min-w-0 flex-wrap items-center gap-x-3 font-mono text-[0.7rem] text-ink/60">
              {step.due_date && <span className={cn(late && "font-semibold text-red-deep")}>{formatDate(step.due_date)}</span>}
              <span className="sm:hidden print:hidden">{weeks}</span>
              {sent ? (
                <span className="inline-flex flex-wrap items-center gap-x-1.5">
                  {step.status && <span className={cn("size-1.5 rounded-full print:hidden", STATUS_STYLES[step.status as TaskStatus]?.dot)} aria-hidden />}
                  På tavlan{step.status ? ` · ${TASK_STATUSES[step.status as TaskStatus] ?? step.status}` : ""} · {step.open ? (step.status === "klar" ? "Ingen mottagare" : "Öppet") : (step.label ?? "Ingen")}
                </span>
              ) : (
                <span className={cn(!step.done && "max-sm:hidden")}>{step.done ? "Klart utan uppdrag" : "Inte på tavlan än"}</span>
              )}
            </span>
            {editable && (
              <span className="ml-auto flex shrink-0 items-center gap-0.5 print:hidden">
                {!step.done && (
                  <button type="button" disabled={pending} onClick={onSend} aria-label={`Skicka ${step.title} till tavlan`} className="btn btn-ghost btn-sm bg-white px-3.5 disabled:opacity-60">
                    Skicka
                  </button>
                )}
                <button type="button" aria-expanded={editing} aria-label={`Ändra ${step.title}`} onClick={() => setEditing(!editing)} className="btn btn-sm px-2.5 font-sans text-ink/60 underline-offset-2 hover:text-ink hover:underline">
                  Ändra
                </button>
              </span>
            )}
          </div>
        </div>
      </div>
      {editing && <StepEdit step={step} onDone={() => setEditing(false)} />}
    </li>
  );
}

/**
 * Planens steg. De ligger här tills någon skickar dem till uppdragstavlan, ett i taget eller alla på en gång. Ett skickat steg
 * följer sitt uppdrag: status, datum och mottagare kommer från tavlan, och tas uppdraget bort står steget här som oskickat igen.
 */
export function PlanSteps({
  planId,
  planDate,
  today,
  steps,
  hiddenCount,
  canChange,
  recipients,
  defaultTo,
}: {
  planId: number;
  planDate: string;
  today: string;
  steps: PlanStep[];
  hiddenCount: number;
  canChange: boolean;
  recipients: PlanRecipient[];
  defaultTo: number | null;
}) {
  const [to, setTo] = useState(defaultTo === null ? "" : String(defaultTo));
  const [pending, start] = useTransition();
  const [result, setResult] = useState<FormState>({});

  const run = (action: (fd: FormData) => Promise<FormState>, fill: (fd: FormData) => void) =>
    start(async () => {
      const fd = new FormData();
      fill(fd);
      try {
        setResult(await action(fd));
      } catch {
        setResult({ error: "Det gick inte. Ladda om sidan och försök igen." });
      }
    });
  const send = (ids: number[]) =>
    run(sendPlanSteps, (fd) => {
      fd.set("plan_id", String(planId));
      fd.set("to", to);
      for (const id of ids) fd.append("step_id", String(id));
    });
  const toggle = (step: PlanStep) =>
    run(setPlanStepDone, (fd) => {
      fd.set("id", String(step.id));
      fd.set("done", step.done ? "0" : "1");
    });

  const ready = steps.filter((s) => s.task_id === null && !s.done);
  const onBoard = steps.filter((s) => s.task_id !== null).length + hiddenCount;
  const board = recipients.filter((r) => r.board);
  const others = recipients.filter((r) => !r.board);

  return (
    <section aria-labelledby="planens-steg">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="planens-steg" className="kicker text-stone">
          Steg
        </h2>
        {onBoard > 0 && (
          <Link href="/admin/uppdrag" className="tryck inline-flex items-center gap-1 font-mono text-[0.7rem] text-ink/60 hover:text-ink print:hidden">
            {onBoard} av {steps.length + hiddenCount} på tavlan <ArrowUpRight size={12} />
          </Link>
        )}
      </div>

      {canChange && ready.length > 0 && (
        <div className="mt-2 flex flex-wrap items-end gap-2 rounded-xl bg-ink/[0.035] p-3 print:hidden">
          <label className="min-w-0 flex-1 basis-44">
            <span className="mb-1 block text-[0.78rem] font-semibold">Mottagare på tavlan</span>
            <select name="to" value={to} onChange={(e) => setTo(e.target.value)} className="h-[2.4rem] w-full rounded-lg pointer-coarse:h-11 border border-ink/15 bg-white px-2.5 text-sm">
              <option value="">Öppet, vem som helst kan ta det</option>
              {board.length > 0 && (
                <optgroup label="Styrelsen">
                  {board.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </optgroup>
              )}
              {others.length > 0 && (
                <optgroup label="Utskott och övriga">
                  {others.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
          {ready.length > 1 && (
            <button type="button" disabled={pending} onClick={() => send(ready.map((s) => s.id))} className="btn btn-ink btn-sm shrink-0 disabled:opacity-60 max-sm:w-full">
              Skicka alla {ready.length}
            </button>
          )}
        </div>
      )}

      <div aria-live="polite" className="print:hidden">
        {result.ok && result.message && <p className="mt-2 text-sm font-semibold text-emerald-800">{result.message}</p>}
        {result.error && <p className="mt-2 rounded-xl border border-red/30 bg-red/[0.06] px-3 py-2 text-sm font-semibold text-red-dark">{result.error}</p>}
      </div>

      {steps.length === 0 ? (
        <p className="mt-1.5 text-sm text-stone">{hiddenCount > 0 ? "Stegen är privata uppdrag." : "Planen har inga steg än."}</p>
      ) : (
        <ol className="mt-1 divide-y divide-ink/10">
          {steps.map((s) => (
            <StepRow key={s.id} step={s} planDate={planDate} today={today} canChange={canChange} pending={pending} onSend={() => send([s.id])} onToggle={() => toggle(s)} />
          ))}
        </ol>
      )}
      {hiddenCount > 0 && steps.length > 0 && <p className="mt-2 text-xs text-stone">{hiddenCount === 1 ? "1 steg är ett privat uppdrag och visas inte." : `${hiddenCount} steg är privata uppdrag och visas inte.`}</p>}
    </section>
  );
}

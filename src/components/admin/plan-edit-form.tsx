"use client";

import { useEffect } from "react";
import { addPlanStep, markPlanInviteSeen, savePlan, savePlanCollaborators } from "@/app/admin/_actions/projektplaner";
import { ActionForm } from "@/components/admin/action-form";
import { Field, TextArea, TextInput, Toggle } from "@/components/admin/fields";
import type { ProjectPlan } from "@/lib/data/arshjul";

export function PlanEditForm({ plan, responsibleOptions }: { plan: ProjectPlan; responsibleOptions: string[] }) {
  return (
    <ActionForm
      action={savePlan}
      version={plan.updated_at}
      stickyFooter={false}
    >
      <input type="hidden" name="id" value={plan.id} />
      <div className="grid gap-5 @lg:grid-cols-2">
        <Field label="Namn på planen" name="title" required>
          <TextInput name="title" defaultValue={plan.title} maxLength={140} />
        </Field>
        <Field label="Datum" name="plan_date" required hint="Stegen flyttas inte med datumet, eftersom någon redan kan ha bokat efter dem.">
          <TextInput type="date" name="plan_date" defaultValue={plan.plan_date} />
        </Field>
      </div>
      <Field label="Ansvarig" name="responsible">
        <TextInput name="responsible" defaultValue={plan.responsible} maxLength={80} list="plan-ansvariga" autoComplete="off" />
        <datalist id="plan-ansvariga">
          {responsibleOptions.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      </Field>
      <Field label="Mål" name="goal">
        <TextArea name="goal" defaultValue={plan.goal} maxLength={4000} />
      </Field>
      <Field label="Budget" name="budget" hint="Vad får det kosta, och vad kostade det till slut?">
        <TextArea name="budget" defaultValue={plan.budget} maxLength={4000} />
      </Field>
      <Field label="Lärdomar till nästa år" name="lessons" hint="Det här är det nästa års post får se när de gör om samma sak. Vad hade ni velat veta i förväg?">
        <TextArea name="lessons" defaultValue={plan.lessons} maxLength={8000} className="min-h-32" />
      </Field>
    </ActionForm>
  );
}

/**
 * Vilka som är med i planen. Hela StatLin är ett eget val: då behöver ingen kryssas i, och listan står kvar för den dag valet tas bort.
 * Kontot som la in planen står inte i listan, det är alltid med.
 */
export function PlanCollaboratorsForm({ planId, all, invited, accounts }: { planId: number; all: boolean; invited: number[]; accounts: { id: number; label: string; kind: string }[] }) {
  const group = (title: string, rows: typeof accounts) =>
    rows.length > 0 && (
      <fieldset>
        <legend className="kicker text-[0.62rem] text-stone">{title}</legend>
        <ul className="mt-2 grid gap-x-5 gap-y-1 @md:grid-cols-2 @2xl:grid-cols-3">
          {rows.map((a) => (
            <li key={a.id}>
              <label className="tryck flex min-h-9 cursor-pointer items-center gap-2.5 text-sm">
                <input type="checkbox" name="user_id" value={a.id} defaultChecked={invited.includes(a.id)} className="size-4 shrink-0 accent-[var(--color-red)]" />
                <span className="min-w-0 break-words">{a.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
    );
  return (
    <ActionForm action={savePlanCollaborators} submitLabel="Spara medarbetarna" stickyFooter={false}>
      <input type="hidden" name="plan_id" value={planId} />
      <Toggle name="collab_all" label="Hela StatLin" defaultChecked={all} hint="Alla konton i portalen är med och kan fråga och svara i planens tråd." />
      {group("Styrelsen", accounts.filter((a) => a.kind === "styrelse"))}
      {group("Utskotten", accounts.filter((a) => a.kind === "utskott"))}
      {group("Övriga konton", accounts.filter((a) => a.kind !== "styrelse" && a.kind !== "utskott"))}
    </ActionForm>
  );
}

/** Kontot har öppnat planen det bjöds in till: inbjudan räknas som sedd och aviseringen försvinner. */
export function PlanInviteSeen({ planId }: { planId: number }) {
  useEffect(() => {
    void markPlanInviteSeen(planId);
  }, [planId]);
  return null;
}

export function PlanStepForm({ planId, defaultDate }: { planId: number; defaultDate: string }) {
  return (
    <ActionForm action={addPlanStep} submitLabel="Lägg till steget" stickyFooter={false} resetOnSuccess>
      <input type="hidden" name="plan_id" value={planId} />
      <div className="grid gap-5 @lg:grid-cols-[minmax(0,1fr)_11rem]">
        <Field label="Nytt steg" name="title" required>
          <TextInput name="title" maxLength={140} />
        </Field>
        <Field label="Klart senast" name="due_date" required>
          <TextInput type="date" name="due_date" defaultValue={defaultDate} />
        </Field>
      </div>
      <Field label="Beskrivning" name="description" hint="Valfri. Följer med när steget skickas till tavlan.">
        <TextArea name="description" maxLength={2000} />
      </Field>
    </ActionForm>
  );
}

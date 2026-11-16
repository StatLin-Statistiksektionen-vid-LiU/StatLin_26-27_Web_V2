"use client";

import { useId, useRef, useState } from "react";
import { createPlan } from "@/app/admin/_actions/projektplaner";
import { ActionForm } from "@/components/admin/action-form";
import { Field, TextArea, TextInput } from "@/components/admin/fields";
import { Plus, Trash } from "@/components/icons";
import { isValidDate, PLAN_TEMPLATES, planTemplate, stepDate, weeksBefore } from "@/lib/projektplan-mallar";
import { cn } from "@/lib/utils";

type Step = { key: number; title: string; description: string; weeks: number; due: string | null };

const weekLabel = (weeks: number) => (weeks === 0 ? "Dagen" : weeks > 0 ? `−${weeks} v` : `+${-weeks} v`);

export function PlanNewForm({
  defaults,
  today,
  responsibleOptions,
}: {
  defaults: { title: string; template: string; date: string; responsible: string; goal: string; wheelItemId: number | null; year: number | null };
  today: string;
  responsibleOptions: string[];
}) {
  const nextKey = useRef(1000);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const groupId = useId();
  const fromTemplate = (key: string): Step[] => (planTemplate(key)?.steps ?? []).map((s, i) => ({ key: i, title: s.title, description: s.description, weeks: s.weeks, due: null }));
  const [templateKey, setTemplateKey] = useState(defaults.template);
  const [date, setDate] = useState(defaults.date);
  const [steps, setSteps] = useState<Step[]>(() => fromTemplate(defaults.template));

  const validDate = isValidDate(date);
  const dueOf = (s: Step) => s.due ?? (validDate ? stepDate(date, s.weeks) : "");
  const change = (key: number, patch: Partial<Step>) => setSteps((list) => list.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  const passed = validDate ? steps.filter((s) => dueOf(s) < today).length : 0;

  return (
    <ActionForm action={createPlan} submitLabel={`Skapa planen${steps.length ? ` med ${steps.length} steg` : ""}`}>
      {defaults.wheelItemId !== null && <input type="hidden" name="wheel_item_id" value={defaults.wheelItemId} />}
      {defaults.year !== null && <input type="hidden" name="year" value={defaults.year} />}

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">
          Mall <span className="text-red-deep">*</span>
        </legend>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {PLAN_TEMPLATES.map((t) => {
            const active = templateKey === t.key;
            return (
              <label
                key={t.key}
                className={cn(
                  "cursor-pointer rounded-2xl border p-4 transition-colors focus-within:ring-4 focus-within:ring-ink/15 motion-reduce:transition-none",
                  active ? "border-ink bg-ink text-white" : "border-ink/15 bg-white hover:border-ink/40",
                )}
              >
                <input
                  type="radio"
                  name="template"
                  value={t.key}
                  checked={active}
                  onChange={() => {
                    setTemplateKey(t.key);
                    setSteps(fromTemplate(t.key));
                  }}
                  className="sr-only"
                />
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-bold">{t.name}</span>
                  <span className={cn("font-mono text-[0.7rem]", active ? "text-white/60" : "text-stone")}>{t.steps.length} steg</span>
                </span>
                <span className={cn("mt-1 block text-sm", active ? "text-white/70" : "text-stone")}>{t.summary}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-5 @lg:grid-cols-2">
        <Field label="Namn på planen" name="title" required>
          <TextInput name="title" defaultValue={defaults.title} maxLength={140} placeholder="Till exempel Julsittning 2026" autoFocus />
        </Field>
        <Field label="Datum" name="plan_date" required hint="Dagen det händer. Stegen räknas ut bakåt härifrån.">
          <TextInput type="date" name="plan_date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      <Field label="Ansvarig" name="responsible" hint="En post eller ett utskott. Det kontot föreslås som mottagare när du skickar steg till tavlan.">
        <TextInput name="responsible" defaultValue={defaults.responsible} maxLength={80} list="plan-ansvariga" autoComplete="off" />
        <datalist id="plan-ansvariga">
          {responsibleOptions.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      </Field>
      <Field label="Mål" name="goal" hint="Vad ska vara sant när det här är över? Går att fylla i senare.">
        <TextArea name="goal" defaultValue={defaults.goal} maxLength={2000} className="min-h-16" />
      </Field>

      <section aria-labelledby={`${groupId}-steg`}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 id={`${groupId}-steg`} ref={headingRef} tabIndex={-1} className="font-bold outline-none">
            Så här blir stegen
          </h2>
          <span className="font-mono text-xs text-stone tabular" role="status">
            {steps.length} steg{passed > 0 ? ` · ${passed} passerade` : ""}
          </span>
        </div>
        {!templateKey ? (
          <p className="mt-3 rounded-2xl border border-dashed border-ink/20 px-4 py-6 text-sm text-stone">Välj en mall så visas stegen här.</p>
        ) : !validDate ? (
          <p className="mt-3 rounded-2xl border border-dashed border-ink/20 px-4 py-6 text-sm text-stone">Välj ett datum så räknas stegen ut.</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-stone">Ändra, ta bort och lägg till innan du skapar planen. Stegen stannar i planen tills du skickar dem till tavlan.</p>
            <ol className="mt-3 divide-y divide-ink/10 rounded-2xl border border-ink/10 bg-white">
              {steps.map((s) => {
                const due = dueOf(s);
                const isPast = due < today;
                return (
                  <li key={s.key} className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-start gap-x-2 p-3 sm:grid-cols-[3.25rem_minmax(0,1fr)_10.5rem_auto] sm:gap-x-3">
                    <span className="pt-2.5 font-mono text-[0.72rem] text-stone tabular" title={isValidDate(due) ? `${weeksBefore(date, due)} veckor före datumet` : undefined}>
                      {isValidDate(due) ? weekLabel(weeksBefore(date, due)) : "–"}
                    </span>
                    <div className="min-w-0">
                      {/* Ett textfält skulle kapa långa rubriker på telefonen. Radbrytning är den enda nya raden som kan finnas här. */}
                      <textarea
                        name="step_title"
                        value={s.title}
                        rows={1}
                        maxLength={140}
                        aria-label="Stegets rubrik"
                        onChange={(e) => change(s.key, { title: e.target.value.replace(/\s*\n\s*/g, " ") })}
                        onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                        className="block w-full resize-none rounded-lg [field-sizing:content] border border-transparent bg-transparent px-2 py-1.5 font-semibold outline-none hover:border-ink/15 focus:border-ink focus:ring-4 focus:ring-ink/[0.06]"
                      />
                      {s.description && <p className="px-2 text-[0.82rem] leading-snug text-stone">{s.description}</p>}
                      <input type="hidden" name="step_description" value={s.description} />
                    </div>
                    <div className="col-start-2 row-start-2 mt-1 min-w-0 px-2 sm:col-start-3 sm:row-start-1 sm:mt-0 sm:px-0">
                      <input
                        type="date"
                        name="step_due"
                        value={due}
                        aria-label={`Datum för ${s.title || "steget"}`}
                        onChange={(e) => change(s.key, { due: e.target.value })}
                        className={cn(
                          "w-full rounded-lg border bg-white px-2 py-1.5 font-mono text-[0.8rem] outline-none focus:ring-4 focus:ring-ink/[0.06]",
                          isPast ? "border-red/40 text-red-dark" : "border-ink/15 focus:border-ink",
                        )}
                      />
                      {isPast && <p className="mt-1 text-xs font-semibold text-red-deep">{isValidDate(due) ? "Har redan passerat" : "Datum saknas"}</p>}
                    </div>
                    <button
                      type="button"
                      aria-label={`Ta bort ${s.title || "steget"}`}
                      title="Ta bort steget"
                      onClick={() => {
                        setSteps((list) => list.filter((x) => x.key !== s.key));
                        // Knappen försvinner, så fokus flyttas till rubriken i stället för att tappas.
                        headingRef.current?.focus();
                      }}
                      className="col-start-3 row-start-1 grid size-9 place-items-center rounded-full text-stone hover:bg-red/5 hover:text-red-deep sm:col-start-4"
                    >
                      <Trash size={16} />
                    </button>
                  </li>
                );
              })}
              {steps.length === 0 && <li className="p-4 text-sm text-stone">Inga steg kvar. Lägg till minst ett.</li>}
            </ol>
            <button
              type="button"
              onClick={() => setSteps((list) => [...list, { key: nextKey.current++, title: "", description: "", weeks: 1, due: null }])}
              className="btn btn-ghost btn-sm mt-3 bg-white"
            >
              <Plus size={16} /> Lägg till ett steg
            </button>
          </>
        )}
      </section>
    </ActionForm>
  );
}

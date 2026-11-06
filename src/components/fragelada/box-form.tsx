"use client";

import { useState } from "react";
import { saveBox } from "@/app/admin/_actions/fragelada";
import { ActionForm } from "@/components/admin/action-form";
import { Field, TextArea, TextInput } from "@/components/admin/fields";
import { CODE_LENGTH, generateCode } from "@/lib/fragelada";

type Box = { id: number; slug: string | null; code: string | null; title: string; description: string; closes_on: string | null; updated_at: string };

/** Koden går att skriva själv eller slumpa. Fältet börjar med ett färdigt förslag, så den som inte bryr sig behöver inte göra något. */
function CodeField({ initial, changing }: { initial: string; changing: boolean }) {
  const [code, setCode] = useState(initial);
  return (
    <Field
      label="Kod"
      name="code"
      hint={
        changing
          ? "Byter du kod slutar den gamla koden och länkarna med den att fungera direkt, också i mejl du redan har skickat."
          : `Skriv en egen på ${CODE_LENGTH} tecken eller slumpa en. O, I, L, 0 och 1 går inte, eftersom de är lätta att blanda ihop.`
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <TextInput
          name="code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ""))}
          maxLength={CODE_LENGTH}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="!w-44 font-mono text-lg font-bold tracking-[0.18em]"
        />
        <button type="button" onClick={() => setCode(generateCode())} className="btn btn-ghost btn-sm font-sans">
          Slumpa ny
        </button>
      </div>
    </Field>
  );
}

/** Ny låda, och ändring av en befintlig. En fast låda är alltid öppen, har ingen kod och inget stängningsdatum. */
export function BoxForm({ box, suggestedCode }: { box?: Box; suggestedCode?: string }) {
  return (
    <ActionForm action={saveBox} version={box?.updated_at} submitLabel={box ? "Spara" : "Skapa låda"} stickyFooter={false} className="max-w-2xl space-y-5">
      {box && <input type="hidden" name="id" value={box.id} />}
      <Field label="Titel" name="title" required hint="Syns för den som skriver, till exempel kursens namn.">
        <TextInput name="title" maxLength={80} defaultValue={box?.title} required />
      </Field>
      <Field label="Beskrivning" name="description" hint="Valfri. Vad vill du ha frågor om?">
        <TextArea name="description" maxLength={300} defaultValue={box?.description} />
      </Field>
      {!box?.slug && <CodeField initial={box?.code ?? suggestedCode ?? ""} changing={!!box} />}
      {!box?.slug && (
        <Field label="Stängningsdatum" name="closes_on" hint="Valfritt. Sista dagen lådan tar emot frågor.">
          <TextInput type="date" name="closes_on" defaultValue={box?.closes_on ?? ""} />
        </Field>
      )}
    </ActionForm>
  );
}

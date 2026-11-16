"use client";

import { unstable_rethrow } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { moveMeetingItem, updateItem } from "@/app/admin/_actions/meetings";
import { ActionForm } from "@/components/admin/action-form";
import { Field, TextArea, TextInput } from "@/components/admin/fields";
import { ChevronDown, Edit } from "@/components/icons";
import type { MeetingItem } from "@/lib/data/meetings";
import { MEETING_ITEM_TITLE_MAX } from "@/lib/meeting-template";

/**
 * En punkt som går att rätta: ordföranden rättar alla, och den som föreslog en punkt rättar sin egen tills den är avgjord.
 * Ett klick på texten byter den mot fälten, och Spara eller Avbryt (Escape) byter tillbaka.
 * children är knapparna bredvid, som göms medan man skriver så att fälten får hela raden.
 */
export function EditableItem({ item, text, children }: { item: Pick<MeetingItem, "id" | "title" | "description">; text: ReactNode; children?: ReactNode }) {
  // back är läget när fälten just har stängts: då får knappen fokus igen, så att den som använder tangentbordet står kvar på raden.
  const [mode, setMode] = useState<"view" | "edit" | "back">("view");
  const close = () => setMode("back");
  if (mode !== "edit")
    return (
      <>
        <button type="button" autoFocus={mode === "back"} onClick={() => setMode("edit")} title="Ändra punkten" className="group flex min-w-0 flex-1 items-start gap-2 text-left">
          {text}
          <Edit size={14} className="mt-1 shrink-0 text-stone opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 pointer-coarse:opacity-100" />
        </button>
        {children}
      </>
    );
  return (
    <div className="min-w-0 flex-1" onKeyDown={(e) => e.key === "Escape" && close()}>
      <ActionForm
        action={updateItem}
        stickyFooter={false}
        onSuccess={close}
        className="space-y-4"
        footer={
          <button type="button" onClick={close} className="btn btn-ghost bg-white">
            Avbryt
          </button>
        }
      >
        <input type="hidden" name="id" value={item.id} />
        <Field label="Punkt" name="title" inputId={`title-${item.id}`} required>
          <TextInput id={`title-${item.id}`} name="title" defaultValue={item.title} maxLength={MEETING_ITEM_TITLE_MAX} required autoFocus />
        </Field>
        <Field label="Beskrivning" name="description" inputId={`description-${item.id}`}>
          <TextArea id={`description-${item.id}`} name="description" defaultValue={item.description} maxLength={1000} rows={3} />
        </Field>
      </ActionForm>
    </div>
  );
}

/** Ordförandens pilar på dagordningen. Punkten byter plats med grannen ovanför eller under. */
export function MeetingMoveButtons({ id, title, first, last }: { id: number; title: string; first: boolean; last: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const move = (direction: -1 | 1) =>
    start(async () => {
      setError(null);
      try {
        const res = await moveMeetingItem(id, direction);
        if (res?.error) setError(res.error);
      } catch (err) {
        unstable_rethrow(err);
        setError("Det gick inte att flytta punkten. Försök igen.");
      }
    });
  const button = "grid size-7 place-items-center rounded-full hover:bg-paper disabled:opacity-25 pointer-coarse:size-10";
  return (
    <span className="inline-flex shrink-0 items-center gap-2">
      {error && (
        <span role="alert" className="max-w-44 text-xs font-medium text-red-deep">
          {error}
        </span>
      )}
      {/* Bredvid varandra när det finns plats, så att raderna på dagordningen inte blir dubbelt så höga som texten. */}
      <span className="inline-flex flex-col sm:flex-row">
        <button type="button" disabled={first || pending} onClick={() => move(-1)} className={button} aria-label={`Flytta upp ${title}`}>
          <ChevronDown size={14} className="rotate-180" />
        </button>
        <button type="button" disabled={last || pending} onClick={() => move(1)} className={button} aria-label={`Flytta ned ${title}`}>
          <ChevronDown size={14} />
        </button>
      </span>
    </span>
  );
}

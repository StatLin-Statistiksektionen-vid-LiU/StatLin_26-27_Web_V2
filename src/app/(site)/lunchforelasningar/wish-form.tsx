"use client";

import { unstable_rethrow } from "next/navigation";
import { startTransition, useActionState, useRef } from "react";
import { Star } from "@/components/icons";
import type { FormState } from "@/lib/admin/form";
import { WISH_COMMENT_MAX, WISH_TITLE_MAX } from "@/lib/naringsliv";
import { submitWish } from "./actions";

const NO_STATE: FormState = {};
const inputClass =
  "w-full rounded-xl border border-white/25 bg-white/[0.07] px-4 py-3 text-white outline-none transition placeholder:text-white/55 focus:border-white focus:ring-4 focus:ring-white/15";

/**
 * Formuläret skickas också utan JavaScript: actionen ligger direkt på formuläret, och tacket eller felet kommer då tillbaka i adressen.
 * Med JavaScript skickas det via onSubmit, för annars tömmer React fälten också när servern svarar med ett fel, till exempel spärren.
 */
export function WishForm({ tack, serverError }: { tack: boolean; serverError: string | null }) {
  const [, serverAction] = useActionState(submitWish, NO_STATE);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(async (prev: FormState, data: FormData): Promise<FormState> => {
    try {
      const res = await submitWish(prev, data);
      if (res.ok) formRef.current?.reset();
      return res;
    } catch (err) {
      unstable_rethrow(err);
      return { error: "Det gick inte att nå servern. Det du har skrivit finns kvar, så försök igen om en stund." };
    }
  }, NO_STATE);
  // Utan JavaScript kommer svaret i adressen. Så fort formuläret har skickats med JavaScript gäller dess eget svar.
  const sent = state === NO_STATE ? tack : !!state.ok;
  const error = state === NO_STATE ? serverError : state.error;
  const titleError = state.fieldErrors?.title;
  const commentError = state.fieldErrors?.comment;
  return (
    <>
      {sent ? (
        <div role="status" className="mt-5 rounded-xl bg-white px-4 py-3 font-semibold text-ink">
          Tack! SASU läser ditt önskemål, och sedan hamnar det på listan.
        </div>
      ) : (
        <p className="mt-3 text-white/85">Ett ämne, ett företag eller en person. Du är anonym. SASU läser först, så önskemålet syns inte på listan direkt.</p>
      )}
      <form
        ref={formRef}
        action={serverAction}
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          startTransition(() => action(data));
        }}
        className="mt-6 space-y-4"
      >
        {error && (
          <p role="alert" className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-red-dark">
            {error}
          </p>
        )}
        <div>
          <label htmlFor="onskan-titel" className="mb-1.5 block text-sm font-semibold">
            Ämne, företag eller person
          </label>
          <input
            id="onskan-titel"
            name="title"
            required
            maxLength={WISH_TITLE_MAX}
            placeholder="Hur prissätter man risk?"
            aria-invalid={titleError ? true : undefined}
            aria-describedby={titleError ? "onskan-titel-fel" : undefined}
            className={inputClass}
          />
          {titleError && (
            <p id="onskan-titel-fel" className="mt-1.5 text-sm font-semibold">
              {titleError}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="onskan-kommentar" className="mb-1.5 block text-sm font-semibold">
            Kommentar <span className="font-normal text-white/70">(valfri)</span>
          </label>
          <textarea
            id="onskan-kommentar"
            name="comment"
            rows={3}
            maxLength={WISH_COMMENT_MAX}
            placeholder="Varför just det här?"
            aria-invalid={commentError ? true : undefined}
            aria-describedby={commentError ? "onskan-kommentar-fel" : undefined}
            className={`${inputClass} resize-y`}
          />
          {commentError && (
            <p id="onskan-kommentar-fel" className="mt-1.5 text-sm font-semibold">
              {commentError}
            </p>
          )}
        </div>
        {/* Honungsfälla: dold för människor och skärmläsare, men en bot fyller i den. */}
        <div className="absolute left-[-9999px] top-auto size-px overflow-hidden" aria-hidden>
          <label htmlFor="onskan-webbplats">Lämna tomt</label>
          <input id="onskan-webbplats" name="webbplats" tabIndex={-1} autoComplete="off" />
        </div>
        <button type="submit" disabled={pending} className="btn btn-light w-full disabled:opacity-60">
          <Star size={18} /> {pending ? "Skickar …" : "Skicka önskemålet"}
        </button>
      </form>
    </>
  );
}

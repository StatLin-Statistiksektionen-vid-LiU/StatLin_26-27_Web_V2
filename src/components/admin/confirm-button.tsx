"use client";

import { unstable_rethrow } from "next/navigation";
import { useActionState, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { FormState } from "@/lib/admin/form";
import { cn } from "@/lib/utils";

const NO_STATE: FormState = {};

/**
 * Knapp som kräver bekräftelse (t.ex. radering). Frågan ställs i en dialog på sidan och inte med confirm(): en webbläsare kan
 * stänga av confirm(), som då svarar nej utan att visa något (webbläsaren i Claude-appen gör det), och då hände ingenting när
 * man klickade.
 *
 * Actionen skickar vidare när det lyckas. Gör den inte det står dialogen kvar med ett besked: actionens eget fel, eller ett
 * allmänt om den inte svarar något.
 */
export function ConfirmButton({
  action,
  id,
  message,
  children,
  className,
  pendingLabel = "Tar bort…",
}: {
  action: (fd: FormData) => void | FormState | Promise<void | FormState>;
  id: number;
  message: string;
  children: ReactNode;
  className?: string;
  /** Texten medan actionen körs, för knappar som gör något annat än att ta bort. */
  pendingLabel?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const questionId = useId();
  // Som i ActionForm: ett nätverksfel blir ett besked i stället för en felgräns, och Nexts redirect() kastas vidare.
  const [state, formAction, pending] = useActionState(async (_prev: FormState, fd: FormData): Promise<FormState> => {
    try {
      return (await action(fd)) ?? { error: "Det gick inte att ta bort. Ladda om sidan och försök igen." };
    } catch (err) {
      unstable_rethrow(err);
      console.error(err);
      return { error: "Kunde inte ta bort. Försök igen." };
    }
  }, NO_STATE);
  // Beskedet gäller det senaste försöket. Öppnas dialogen igen börjar den utan det.
  const [dismissed, setDismissed] = useState(NO_STATE);
  const error = state === dismissed ? undefined : state.error;

  // Activity gömmer sidan utan att ta bort den. Stängdes inte dialogen stod frågan öppen igen när man kom tillbaka till sidan.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    return () => dialog?.close();
  }, []);

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => {
          setDismissed(state);
          dialogRef.current?.showModal();
        }}
        className={cn("btn btn-sm border border-red/25 bg-white text-red-deep hover:border-red hover:bg-red/5", className)}
      >
        {children}
      </button>
      <dialog
        ref={dialogRef}
        role="alertdialog"
        aria-labelledby={questionId}
        // Medan actionen körs går det inte att ångra: Escape hade stängt dialogen, sett ut som ett nej och dolt ett eventuellt fel.
        // preventDefault hindrar bara det första trycket i Chromium, och closedby finns inte i alla webbläsare.
        closedby={pending ? "none" : undefined}
        onCancel={(e) => {
          if (pending) e.preventDefault();
        }}
        className="m-auto w-[calc(100vw-2rem)] max-w-md rounded-2xl bg-white p-6 text-ink shadow-2xl backdrop:bg-ink/40 backdrop:backdrop-blur-[2px]"
      >
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="id" value={id} />
          <p id={questionId} className="font-bold break-words">
            {message}
          </p>
          {error && (
            <p role="alert" className="rounded-2xl border border-red/30 bg-red/[0.06] px-4 py-3 text-sm font-semibold text-red-dark">
              {error}
            </p>
          )}
          {/* Avbryt ligger först: dialogen ger det första fältet fokus, så Enter direkt efter klicket raderar inget. */}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" disabled={pending} onClick={() => dialogRef.current?.close()} className="btn btn-sm btn-ghost bg-white disabled:opacity-70">
              Avbryt
            </button>
            <button type="submit" disabled={pending} className="btn btn-sm btn-red fara disabled:opacity-70">
              {pending ? (
                <>
                  <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
                  {pendingLabel}
                </>
              ) : (
                children
              )}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

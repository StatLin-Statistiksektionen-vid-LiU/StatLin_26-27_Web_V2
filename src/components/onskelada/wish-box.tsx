"use client";

import { unstable_rethrow } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { sendWish } from "@/app/(site)/utskott/actions";
import { ArrowRight, Check } from "@/components/icons";
import { WISH_MAX, type WishState } from "@/lib/onskelada";
import { cn } from "@/lib/utils";

/** Utskottets önskelåda på dess sida. Ingen inloggning och inget namn: det som skrivs går bara till utskottet. */
export function WishBox({ slug, name }: { slug: string; name: string }) {
  // Styrd textruta: React tömmer inte texten när svaret är ett fel, och heller inte om servern inte går att nå.
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const [state, formAction, pending] = useActionState(async (prev: WishState, fd: FormData): Promise<WishState> => {
    try {
      const res = await sendWish(prev, fd);
      if (res.ok) {
        setText("");
        setSent(true);
      }
      return res;
    } catch (err) {
      unstable_rethrow(err);
      return { error: "Det gick inte att nå servern. Din text står kvar, försök igen." };
    }
  }, {});
  const thanksRef = useRef<HTMLParagraphElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (sent) thanksRef.current?.focus({ preventScroll: true });
  }, [sent]);

  return (
    <section
      id="onskelada"
      aria-labelledby="onskelada-rubrik"
      className="rounded-2xl border border-line bg-white p-5 shadow-[0_22px_44px_-38px_rgb(10_10_10/0.6)] sm:p-7"
    >
      <p className="kicker text-red-deep">Önskelådan</p>
      <h2 id="onskelada-rubrik" className="mt-2 break-words text-[clamp(1.45rem,3vw,1.9rem)] font-extrabold leading-tight tracking-tight [font-stretch:110%]">
        Önska något av {name}
      </h2>

      {sent ? (
        <div role="status" className="mt-4">
          <p ref={thanksRef} tabIndex={-1} className="flex items-start gap-2 text-lg font-bold outline-none">
            <Check size={20} className="mt-1 shrink-0 text-red" /> Tack! Önskemålet ligger hos {name}.
          </p>
          <p className="mt-1 text-stone">De ser inte vem som skrev, så du får inget svar här.</p>
          <button
            type="button"
            onClick={() => {
              setSent(false);
              requestAnimationFrame(() => areaRef.current?.focus());
            }}
            className="btn btn-ghost mt-5 w-full sm:w-auto"
          >
            Skriv ett till
          </button>
        </div>
      ) : (
        <>
          <p className="mt-2 max-w-prose text-stone">Ett evenemang du saknar, en idé eller något som kan bli bättre. Du skriver anonymt, och det går direkt till {name}.</p>
          <form action={formAction} className="mt-5">
            <input type="hidden" name="utskott" value={slug} />
            {/* Honungsfällan: ligger utanför skärmen, utom räckhåll för tangentbord och skärmläsare. */}
            <div className="absolute -left-[9999px] size-px overflow-hidden" aria-hidden>
              <label>
                Webbplats
                <input type="text" name="webbplats" tabIndex={-1} autoComplete="off" />
              </label>
            </div>
            <label htmlFor="onskemal" className="sr-only">
              Ditt önskemål till {name}
            </label>
            <textarea
              ref={areaRef}
              id="onskemal"
              name="body"
              rows={4}
              value={text}
              maxLength={WISH_MAX}
              onChange={(e) => setText(e.target.value)}
              aria-describedby="onskemal-antal"
              placeholder="Jag önskar att …"
              className="block w-full resize-y rounded-xl border border-ink/15 bg-paper px-4 py-3 text-base leading-relaxed text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink/40 focus:border-ink focus:ring-4 focus:ring-ink/[0.06]"
            />
            {state.error && (
              <p role="alert" className="mt-3 rounded-xl border border-line bg-paper px-4 py-3 text-[0.95rem] font-semibold">
                {state.error}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p id="onskemal-antal" className={cn("font-mono text-sm tabular text-stone", text.length >= WISH_MAX - 100 && "font-bold text-ink")}>
                {text.length} av {WISH_MAX} tecken
              </p>
              <button type="submit" disabled={pending} className="btn btn-ink w-full disabled:opacity-60 sm:w-auto">
                {pending ? "Skickar…" : "Skicka önskemålet"} <ArrowRight size={18} />
              </button>
            </div>
          </form>
        </>
      )}
    </section>
  );
}

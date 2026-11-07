"use client";

import { unstable_rethrow } from "next/navigation";
import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { sendWish } from "@/app/(site)/utskott/actions";
import { ArrowRight, Check } from "@/components/icons";
import { WISH_MAX, type WishState } from "@/lib/onskelada";
import { cn } from "@/lib/utils";

/** Spelets namn i spelönskemålen. Resten av önskemålet får plats under WISH_MAX tillsammans med det. */
const SPEL_MAX = 80;
const KOMMENTAR_MAX = WISH_MAX - 100;

/**
 * Spelönskemål, som på eSTIG:s sida: först vilket spel, sedan en frivillig rad om varför eller hur. Rubriken och texten kommer
 * från sidan, så att de går att ändra i redigeringsläget.
 */
type Spel = { rubrik: ReactNode; text: ReactNode };

/** Utskottets önskelåda på dess sida. Ingen inloggning och inget namn: det som skrivs går bara till utskottet. */
export function WishBox({ slug, name, spel }: { slug: string; name: string; spel?: Spel }) {
  // Styrda fält: React tömmer inte texten när svaret är ett fel, och heller inte om servern inte går att nå.
  const [text, setText] = useState("");
  const [spelet, setSpelet] = useState("");
  const [sent, setSent] = useState(false);
  const [state, formAction, pending] = useActionState(async (prev: WishState, fd: FormData): Promise<WishState> => {
    if (spel) {
      // Önskemålet sparas som en text, med spelet på första raden.
      const namn = String(fd.get("spel") ?? "").trim();
      if (!namn) return { error: "Skriv vilket spel du önskar först." };
      const kommentar = String(fd.get("body") ?? "").trim();
      fd.set("body", kommentar ? `Spel: ${namn}\n\n${kommentar}` : `Spel: ${namn}`);
    }
    try {
      const res = await sendWish(prev, fd);
      if (res.ok) {
        setText("");
        setSpelet("");
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
  const spelRef = useRef<HTMLInputElement>(null);
  const max = spel ? KOMMENTAR_MAX : WISH_MAX;

  useEffect(() => {
    if (sent) thanksRef.current?.focus({ preventScroll: true });
  }, [sent]);

  const textarea = (
    <textarea
      ref={areaRef}
      id="onskemal"
      name="body"
      rows={spel ? 3 : 4}
      value={text}
      maxLength={max}
      onChange={(e) => setText(e.target.value)}
      aria-describedby="onskemal-antal"
      placeholder={spel ? "En turnering, ett LAN eller en lugn kväll med …" : "Jag önskar att …"}
      className="block w-full resize-y rounded-xl border border-ink/15 bg-paper px-4 py-3 text-base leading-relaxed text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink/40 focus:border-ink focus:ring-4 focus:ring-ink/[0.06]"
    />
  );

  return (
    <section
      id="onskelada"
      aria-labelledby="onskelada-rubrik"
      className="rounded-2xl border border-line bg-white p-5 shadow-[0_22px_44px_-38px_rgb(10_10_10/0.6)] sm:p-7"
    >
      <p className="kicker text-red-deep">{spel ? "Spelönskemål" : "Önskelådan"}</p>
      <h2 id="onskelada-rubrik" className="mt-2 break-words text-[clamp(1.45rem,3vw,1.9rem)] font-extrabold leading-tight tracking-tight [font-stretch:110%]">
        {spel ? spel.rubrik : <>Önska något av {name}</>}
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
              requestAnimationFrame(() => (spel ? spelRef : areaRef).current?.focus());
            }}
            className="btn btn-ghost mt-5 w-full sm:w-auto"
          >
            Skriv ett till
          </button>
        </div>
      ) : (
        <>
          <p className="mt-2 max-w-prose text-stone">
            {spel ? spel.text : <>Ett evenemang du saknar, en idé eller något som kan bli bättre. Du skriver anonymt, och det går direkt till {name}.</>}
          </p>
          <form action={formAction} className="mt-5">
            <input type="hidden" name="utskott" value={slug} />
            {/* Honungsfällan: ligger utanför skärmen, utom räckhåll för tangentbord och skärmläsare. */}
            <div className="absolute -left-[9999px] size-px overflow-hidden" aria-hidden>
              <label>
                Webbplats
                <input type="text" name="webbplats" tabIndex={-1} autoComplete="off" />
              </label>
            </div>
            {spel ? (
              <div className="grid gap-4">
                <div>
                  <label htmlFor="onskemal-spel" className="text-sm font-semibold">
                    Vilket spel?
                  </label>
                  <input
                    ref={spelRef}
                    id="onskemal-spel"
                    name="spel"
                    type="text"
                    value={spelet}
                    maxLength={SPEL_MAX}
                    onChange={(e) => setSpelet(e.target.value)}
                    autoComplete="off"
                    className="mt-1.5 block w-full rounded-xl border border-ink/15 bg-paper px-4 py-3 text-base text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink/40 focus:border-ink focus:ring-4 focus:ring-ink/[0.06]"
                  />
                </div>
                <div>
                  <label htmlFor="onskemal" className="text-sm font-semibold">
                    Varför, eller hur vill ni köra det? <span className="font-normal text-stone">Frivilligt</span>
                  </label>
                  <div className="mt-1.5">{textarea}</div>
                </div>
              </div>
            ) : (
              <>
                <label htmlFor="onskemal" className="sr-only">
                  Ditt önskemål till {name}
                </label>
                {textarea}
              </>
            )}
            {state.error && (
              <p role="alert" className="mt-3 rounded-xl border border-line bg-paper px-4 py-3 text-[0.95rem] font-semibold">
                {state.error}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p id="onskemal-antal" className={cn("font-mono text-sm tabular text-stone", text.length >= max - 100 && "font-bold text-ink")}>
                {text.length} av {max} tecken
              </p>
              <button type="submit" disabled={pending} className="btn btn-ink w-full disabled:opacity-60 sm:w-auto">
                {pending ? "Skickar…" : spel ? "Skicka spelönskemålet" : "Skicka önskemålet"} <ArrowRight size={18} />
              </button>
            </div>
          </form>
        </>
      )}
    </section>
  );
}

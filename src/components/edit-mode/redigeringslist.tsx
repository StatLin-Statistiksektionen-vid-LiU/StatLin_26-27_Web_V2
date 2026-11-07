"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect, useLayoutEffect, useRef, useState } from "react";
import { sparaInnehall, type Andring, type SparaSvar } from "@/app/admin/_actions/innehall";
import { Check, ChevronDown, Eye, Undo } from "@/components/icons";
import { stabil } from "@/lib/innehall/poster";
import { postEtikett } from "@/lib/innehall/regler";
import { cn } from "@/lib/utils";
import { useEditState } from "./store";
import { useUtkastState, utkastStore } from "./utkast";

type Lage =
  | { typ: "sparar" }
  | { typ: "sparat"; text: string; angra?: Andring[] }
  // vid: utkasten när felet eller frågan kom. Ändras något gäller de inte längre.
  | { typ: "fel"; text: string; fel?: Record<string, string>; vid: unknown }
  | { typ: "kasta"; vid: unknown };

const NATFEL = "Kunde inte spara. Kontrollera anslutningen och försök igen.";

async function skicka(andringar: Andring[]): Promise<SparaSvar> {
  try {
    return await sparaInnehall(andringar);
  } catch {
    return { error: NATFEL };
  }
}

/**
 * Listen längst ner i redigeringsläget. Där samlas sidans ändringar: hur många de är och vilka, Ångra, Förhandsvisa,
 * Kasta och Spara. Den syns så länge redigeringsläget är på, och även efteråt om något är osparat.
 */
export function Redigeringslist() {
  const router = useRouter();
  const { user, editing } = useEditState();
  const { utkast, historik, forhandsvisa } = useUtkastState();
  const [lageNu, setLage] = useState<Lage | null>(null);
  const [lista, setLista] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const osparade = Object.entries(utkast).filter(([, u]) => !u.sparat);
  const antal = osparade.length;
  // Ändras något efter en sparning gäller meddelandet inte längre: då syns de nya ändringarna och Spara igen.
  const inaktuellt = ((lageNu?.typ === "fel" || lageNu?.typ === "kasta") && lageNu.vid !== utkast) || (lageNu?.typ === "sparat" && antal > 0);
  const lage = inaktuellt ? null : lageNu;
  const syns = !!user && (editing || antal > 0 || lage?.typ === "sparar" || lage?.typ === "sparat");
  const senast = useRef({ spara: () => {}, antal, editing });

  async function spara() {
    const poster = Object.entries(utkastStore.get().utkast).filter(([, u]) => !u.sparat);
    if (!poster.length || lage?.typ === "sparar") return;
    setLage({ typ: "sparar" });
    const andringar = poster.map(([id, u]) => ({ id, varde: u.varde, bas: u.bas }));
    const svar = await skicka(andringar);
    if (!svar.ok) {
      setLage({ typ: "fel", text: svar.error ?? NATFEL, fel: svar.fel, vid: utkastStore.get().utkast });
      if (svar.fel && Object.keys(svar.fel).length > 1) setLista(true);
      return;
    }
    const varden = svar.varden ?? Object.fromEntries(andringar.map((a) => [a.id, a.varde]));
    // Ångra sparningen: de gamla värdena tillbaka, med det som nu står i databasen som bas.
    const angra = andringar.map((a) => ({ id: a.id, varde: JSON.parse(a.bas) as unknown, bas: stabil(varden[a.id]) }));
    utkastStore.visaSparat(varden);
    setLista(false);
    setLage({ typ: "sparat", text: svar.message ?? "Sparat.", angra });
    startTransition(() => router.refresh());
  }

  async function angraSparning(andringar: Andring[]) {
    setLage({ typ: "sparar" });
    const svar = await skicka(andringar);
    if (!svar.ok) {
      setLage({ typ: "fel", text: svar.error ?? NATFEL, fel: svar.fel, vid: utkastStore.get().utkast });
      return;
    }
    utkastStore.visaSparat(svar.varden ?? Object.fromEntries(andringar.map((a) => [a.id, a.varde])));
    setLage({ typ: "sparat", text: "Ångrat. Det som stod förut syns igen." });
    startTransition(() => router.refresh());
  }
  useLayoutEffect(() => {
    senast.current = { spara: () => void spara(), antal, editing };
  });

  // Efter en sparning: meddelandet och Ångra sparningen står en stund. Utkasten släpps när sidan fått de nya värdena
  // (se useUtkast), och som sista utväg här.
  useEffect(() => {
    if (lageNu?.typ !== "sparat") return;
    const slapp = window.setTimeout(() => utkastStore.slappSparade(), 6000);
    const bort = window.setTimeout(() => setLage(null), 20000);
    return () => {
      window.clearTimeout(slapp);
      window.clearTimeout(bort);
    };
  }, [lageNu]);

  useEffect(() => {
    if (!editing) utkastStore.setForhandsvisa(false);
  }, [editing]);

  // Ctrl+S sparar, Ctrl+Z ångrar (utanför textfälten, där webbläsaren ångrar själv). Osparat frågar innan fliken stängs.
  useEffect(() => {
    function tangent(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "s" && senast.current.antal > 0) {
        e.preventDefault();
        senast.current.spara();
      } else if (k === "z" && !e.shiftKey && senast.current.editing) {
        const mal = e.target instanceof Element ? e.target : null;
        if (mal?.closest("input, textarea, select, [contenteditable]:not([contenteditable=false])")) return;
        e.preventDefault();
        utkastStore.angra();
      }
    }
    function lamna(e: BeforeUnloadEvent) {
      if (senast.current.antal === 0) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("keydown", tangent);
    window.addEventListener("beforeunload", lamna);
    return () => {
      window.removeEventListener("keydown", tangent);
      window.removeEventListener("beforeunload", lamna);
    };
  }, []);

  // Listens höjd, så att bubblan och sidans slut hamnar ovanför den.
  useLayoutEffect(() => {
    const el = ref.current;
    const rot = document.documentElement;
    if (!syns || !el) {
      rot.style.removeProperty("--redigeringslist");
      return;
    }
    const satt = () => rot.style.setProperty("--redigeringslist", `${Math.ceil(el.getBoundingClientRect().height) + 8}px`);
    satt();
    const ro = new ResizeObserver(satt);
    ro.observe(el);
    return () => {
      ro.disconnect();
      rot.style.removeProperty("--redigeringslist");
    };
  }, [syns]);

  if (!syns) return null;
  const sparar = lage?.typ === "sparar";
  const fel = lage?.typ === "fel" ? lage.fel : undefined;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[65] flex justify-center px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] print:hidden lg:pl-[calc(var(--sidebar-w)+0.5rem)]">
      <div ref={ref} role="region" aria-label="Ändringar på sidan" className="redigeringslist pointer-events-auto">
        {lista && antal > 0 && (
          <ul className="redigeringslist-poster" aria-label="Osparade ändringar">
            {osparade.map(([id]) => (
              <li key={id} className="redigeringslist-post">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{postEtikett(id)}</span>
                  {fel?.[id] && <span className="block text-[0.8rem] leading-snug text-red">{fel[id]}</span>}
                </span>
                <button type="button" onClick={() => utkastStore.angraPost(id)} className="redigeringslist-knapp shrink-0">
                  <Undo size={14} /> Ångra
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="redigeringslist-rad">
          {lage?.typ === "sparat" ? (
            <>
              <p role="status" className="flex min-w-0 items-center gap-2 px-2 text-sm font-semibold">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-emerald-700 text-white">
                  <Check size={13} />
                </span>
                <span className="truncate">{lage.text}</span>
              </p>
              {lage.angra && (
                <button type="button" onClick={() => void angraSparning(lage.angra!)} className="redigeringslist-knapp">
                  <Undo size={15} /> Ångra sparningen
                </button>
              )}
            </>
          ) : lage?.typ === "kasta" ? (
            <>
              <p className="px-2 text-sm font-semibold">{antal === 1 ? "Kasta ändringen?" : `Kasta alla ${antal} ändringar?`}</p>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setLage(null)} className="redigeringslist-knapp">
                  Nej
                </button>
                <button
                  type="button"
                  autoFocus
                  onClick={() => {
                    utkastStore.kasta();
                    setLage(null);
                    setLista(false);
                  }}
                  className="redigeringslist-knapp redigeringslist-fara"
                >
                  Ja, kasta
                </button>
              </div>
            </>
          ) : antal === 0 ? (
            <p className="px-2 text-sm text-white/75">
              {sparar ? "Sparar…" : <>Klicka på en text, knapp eller lista för att ändra den.<span className="max-md:hidden"> Inget syns för besökare förrän du sparar.</span></>}
            </p>
          ) : (
            <>
              <button type="button" aria-expanded={lista} onClick={() => setLista((l) => !l)} className="redigeringslist-knapp min-w-0">
                <span aria-hidden className="size-2 shrink-0 rounded-full bg-red" />
                <span className="truncate">{antal === 1 ? "1 osparad ändring" : `${antal} osparade ändringar`}</span>
                <ChevronDown size={14} className={cn("shrink-0 transition-transform", !lista && "rotate-180")} />
              </button>
              {lage?.typ === "fel" && (
                <p role="alert" className="min-w-0 basis-full px-2 text-[0.8rem] font-semibold leading-snug text-red sm:order-none sm:basis-auto sm:truncate">
                  {lage.text}
                </p>
              )}
              <div className="ml-auto flex items-center gap-1">
                <button type="button" onClick={() => utkastStore.angra()} disabled={historik.length === 0 || sparar} title="Ångra (Ctrl+Z)" aria-label="Ångra senaste ändringen" className="redigeringslist-knapp">
                  <Undo size={15} />
                  <span className="max-sm:hidden">Ångra</span>
                </button>
                {editing && (
                  <button
                    type="button"
                    aria-pressed={forhandsvisa}
                    onClick={() => utkastStore.setForhandsvisa(!forhandsvisa)}
                    title="Visa sidan som besökare ser den, med dina ändringar"
                    className={cn("redigeringslist-knapp", forhandsvisa && "redigeringslist-pa")}
                  >
                    <Eye size={15} />
                    <span className="max-sm:hidden">Förhandsvisa</span>
                  </button>
                )}
                <button type="button" onClick={() => setLage({ typ: "kasta", vid: utkast })} disabled={sparar} className="redigeringslist-knapp max-[380px]:hidden">
                  Kasta
                </button>
                <button type="button" onClick={() => void spara()} disabled={sparar} title="Spara (Ctrl+S)" className="redigeringslist-knapp redigeringslist-spara">
                  {sparar ? "Sparar…" : "Spara"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

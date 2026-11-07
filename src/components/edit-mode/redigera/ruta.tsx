"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Close, Trash } from "@/components/icons";
import { arGiltigLank, LANK_FEL } from "@/lib/innehall/lank";
import { stabil } from "@/lib/innehall/poster";
import { NAV } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import type { Falt } from "../redigerbar";

type Item = Record<string, unknown>;

const LAGEN = [
  { varde: "j", etikett: "Ingår", titel: "Ingår för alla" },
  { varde: "v", etikett: "Kursval", titel: "Beror på kursval och bakgrund" },
  { varde: "n", etikett: "Nej", titel: "Inte på den här nivån" },
] as const;

/** Förslag i länkfälten. Man kan också skriva en annan sida eller en hel adress. */
const SIDOR = [...new Set(["/", ...NAV.flatMap((g) => [g.href, ...(g.children ?? []).map((c) => c.href)]), "/star", "/studenter/ny-student", "/sektionen/styrelsen"])].filter(
  (h) => h.startsWith("/"),
);

/** Knappen som ska ha fokus i nästa ruta, när en flytt öppnar raden på sin nya plats. */
let nastaFokus: "upp" | "ner" | null = null;

/**
 * Rutan för en rad i en lista: fälten, ta bort, flytta och Klar. Ändringarna gäller först när man trycker Klar, Enter
 * eller klickar utanför rutan; Escape och Avbryt släpper dem. Rutan står under eller över raden, och på en telefon som ett
 * blad längst ner. Den ritas direkt i body, så att inget runt listan (en länk, en animation) påverkar den.
 */
export function RadRuta({
  ankare,
  rubrik,
  item,
  falt,
  kanTaBort,
  kanUpp,
  kanNer,
  onSpara,
  onTaBort,
  onFlytta,
  onStang,
  verktyg,
  forhandsvisning,
  ny = false,
}: {
  ankare: () => HTMLElement | null;
  rubrik: string;
  item: Item;
  falt: Falt<Item>[];
  kanTaBort: boolean;
  kanUpp: boolean;
  kanNer: boolean;
  onSpara: (nytt: Item) => void;
  onTaBort: () => void;
  /** Flyttar raden ett steg, med rutans ändringar. */
  onFlytta: (steg: -1 | 1, nytt: Item) => void;
  onStang: () => void;
  verktyg?: (stang: () => void) => ReactNode;
  /** Visas under fälten med det som står i dem just nu. */
  forhandsvisning?: (utkast: Item) => ReactNode;
  /** En ny rad som läggs till först när man trycker Klar, eller när något ändrats och man klickar utanför. */
  ny?: boolean;
}) {
  const [utkast, setUtkast] = useState<Item>(() => ({ ...item }));
  // Listfälten skrivs som text med komman. Texten står för sig, så att markören inte hoppar medan man skriver.
  const [listtext, setListtext] = useState<Record<string, string>>(() =>
    Object.fromEntries(falt.filter((f) => f.typ === "lista").map((f) => [f.nyckel, ((item[f.nyckel] as string[] | undefined) ?? []).join(", ")])),
  );
  const [fel, setFel] = useState<Record<string, string>>({});
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const senast = useRef({ tolka: () => ({ nytt: item, fel: {} as Record<string, string> }), item, onSpara, onStang });

  function tolka(): { nytt: Item; fel: Record<string, string> } {
    const nytt: Item = { ...utkast };
    const fel: Record<string, string> = {};
    for (const f of falt) {
      if (f.typ === "lista") {
        const delar = (listtext[f.nyckel] ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        nytt[f.nyckel] = delar.slice(0, f.antal ?? 30).map((s) => s.slice(0, f.max ?? 60));
        continue;
      }
      if (f.typ === "vaxel" || f.typ === "val" || f.typ === "lagen") continue;
      const text = String(nytt[f.nyckel] ?? "")
        .replace(/\r\n?/g, "\n")
        .trim();
      // Ett valfritt fält som aldrig fanns och fortfarande är tomt läggs inte till.
      if (text || Object.hasOwn(item, f.nyckel)) nytt[f.nyckel] = text;
      else delete nytt[f.nyckel];
      if (f.typ === "lank") {
        if (!text) fel[f.nyckel] = `${f.etikett} saknas.`;
        else if (!arGiltigLank(text)) fel[f.nyckel] = LANK_FEL;
      } else if (f.kravs && !text) fel[f.nyckel] = `${f.etikett} saknas.`;
    }
    for (const k of Object.keys(nytt)) if (nytt[k] === undefined) delete nytt[k];
    return { nytt, fel };
  }
  useLayoutEffect(() => {
    senast.current = { tolka, item, onSpara, onStang };
  });

  /** Lägger ändringarna i utkastet och stänger. Stämmer något inte står rutan kvar med felen. */
  function klar(): boolean {
    const r = tolka();
    if (Object.keys(r.fel).length) {
      setFel(r.fel);
      requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
      return false;
    }
    if (ny || stabil(r.nytt) !== stabil(item)) onSpara(r.nytt);
    onStang();
    return true;
  }

  function flytta(steg: -1 | 1) {
    const r = tolka();
    if (Object.keys(r.fel).length) {
      setFel(r.fel);
      return;
    }
    nastaFokus = steg === -1 ? "upp" : "ner";
    onFlytta(steg, r.nytt);
  }

  // Placeringen: under raden om den får plats, annars över. Räknas om vid varje rendering, scroll och storleksändring.
  const placera = () => {
    const box = ref.current;
    if (!box || window.innerWidth < 640) return;
    const a = ankare()?.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    // Listen med Spara längst ner ska synas medan rutan är öppen, så rutan slutar ovanför den.
    const vh = window.innerHeight - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--redigeringslist")) || 0);
    const m = 8;
    let top = (vh - b.height) / 2;
    let left = (vw - b.width) / 2;
    if (a) {
      const under = a.bottom + m + b.height <= vh - m || a.top - m - b.height < m;
      top = under ? a.bottom + m : a.top - m - b.height;
      left = a.left;
    }
    box.style.top = `${Math.round(Math.max(m, Math.min(top, vh - m - b.height)))}px`;
    box.style.left = `${Math.round(Math.max(m, Math.min(left, vw - m - b.width)))}px`;
  };
  useLayoutEffect(placera);

  useEffect(() => {
    let raf = 0;
    const igen = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(placera);
    };
    window.addEventListener("scroll", igen, { capture: true, passive: true });
    window.addEventListener("resize", igen);
    const ro = new ResizeObserver(igen);
    if (ref.current) ro.observe(ref.current);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", igen, { capture: true });
      window.removeEventListener("resize", igen);
      ro.disconnect();
    };
    // placera läser bara ref och ankare, som inte byts medan rutan är öppen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ett klick utanför rutan gör som Klar. Stämmer något inte stoppas klicket, så att inget annat händer och felen syns.
  useEffect(() => {
    let svalj: (() => void) | null = null;
    function nere(e: PointerEvent) {
      const box = ref.current;
      if (!box || !(e.target instanceof Node) || box.contains(e.target)) return;
      const { tolka: t, item: fore, onSpara: spara, onStang: stang } = senast.current;
      const r = t();
      const andrad = stabil(r.nytt) !== stabil(fore);
      // Utan ändringar stängs rutan även om något saknas, till exempel en ny rad som man ångrade.
      if (!andrad || Object.keys(r.fel).length === 0) {
        if (andrad) spara(r.nytt);
        stang();
        return;
      }
      setFel(r.fel);
      e.preventDefault();
      e.stopPropagation();
      const stopp = (ev: MouseEvent) => {
        ev.preventDefault();
        ev.stopPropagation();
        svalj?.();
      };
      document.addEventListener("click", stopp, true);
      const tid = window.setTimeout(() => svalj?.(), 800);
      svalj = () => {
        document.removeEventListener("click", stopp, true);
        window.clearTimeout(tid);
        svalj = null;
      };
    }
    document.addEventListener("pointerdown", nere, true);
    return () => {
      document.removeEventListener("pointerdown", nere, true);
      svalj?.();
    };
  }, []);

  // Fokus: första fältet (eller flyttknappen efter en flytt), och tillbaka dit man var när rutan stängs.
  useEffect(() => {
    const fore = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const box = ref.current;
    const grov = window.matchMedia("(pointer: coarse)").matches;
    const mal = nastaFokus
      ? box?.querySelector<HTMLElement>(`[data-fokus="${nastaFokus}"]:not(:disabled)`)
      : grov
        ? box
        : box?.querySelector<HTMLElement>("input, textarea, select, [role=radio]");
    nastaFokus = null;
    (mal ?? box)?.focus({ preventScroll: true });
    return () => {
      const nu = document.activeElement;
      if (fore?.isConnected && (!nu || nu === document.body || box?.contains(nu))) fore.focus({ preventScroll: true });
    };
  }, []);

  function tangent(e: KeyboardEvent<HTMLDivElement>) {
    e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      onStang();
      return;
    }
    if (e.key !== "Enter") return;
    const mal = e.target as HTMLElement;
    const textruta = mal.tagName === "TEXTAREA";
    if (mal.tagName === "BUTTON" || (textruta && !e.ctrlKey && !e.metaKey)) return;
    e.preventDefault();
    klar();
  }

  const satt = (nyckel: string, varde: unknown) => {
    setUtkast((u) => ({ ...u, [nyckel]: varde }));
    setFel((f) => {
      if (!f[nyckel]) return f;
      const kvar = { ...f };
      delete kvar[nyckel];
      return kvar;
    });
  };

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={rubrik}
      tabIndex={-1}
      className="redigerbar-ruta"
      onKeyDown={tangent}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      // Ett klick på en rubrik eller en tom yta ska inte ta fokus från fältet man skriver i (en rubrik flyttar fokus till sitt
      // fält ändå, när klicket är klart).
      onMouseDown={(e) => {
        if (!(e.target as HTMLElement).closest("input, textarea, select, button, a")) e.preventDefault();
      }}
    >
      <div className="redigerbar-ruta-topp">
        <p className="redigerbar-ruta-rubrik">{rubrik}</p>
        <button type="button" onClick={onStang} aria-label="Stäng utan att ändra" title="Stäng utan att ändra (Esc)" className="redigerbar-ikonknapp">
          <Close size={16} />
        </button>
      </div>

      {falt.length > 0 && (
        <div className="redigerbar-ruta-falt">
          {falt.map((f) => {
            const fid = `${id}-${f.nyckel}`;
            const felText = fel[f.nyckel];
            const beskriv = felText ? `${fid}-fel` : f.hjalp || f.typ === "lank" ? `${fid}-hjalp` : undefined;
            const varde = utkast[f.nyckel];
            const vanlig = {
              id: fid,
              "aria-invalid": felText ? true : undefined,
              "aria-describedby": beskriv,
              className: "redigerbar-inmatning",
            } as const;

            let falt: ReactNode;
            if (f.typ === "lagen") {
              const lagen = typeof varde === "string" && /^[jvn]{4}$/.test(varde) ? varde : "nnnn";
              return (
                <fieldset key={f.nyckel} className="redigerbar-falt">
                  <legend className="redigerbar-etikett">{f.etikett}</legend>
                  <div className="redigerbar-lagen">
                    {(f.alternativ ?? []).slice(0, 4).map((niva, i) => (
                      <div key={niva.varde} className="redigerbar-lagen-rad">
                        <span className="redigerbar-lagen-niva">{niva.etikett}</span>
                        <div role="radiogroup" aria-label={niva.etikett} className="redigerbar-segment">
                          {LAGEN.map((l) => (
                            <button
                              key={l.varde}
                              type="button"
                              role="radio"
                              aria-checked={lagen[i] === l.varde}
                              title={l.titel}
                              onClick={() => satt(f.nyckel, lagen.slice(0, i) + l.varde + lagen.slice(i + 1))}
                              className={cn("redigerbar-segment-val", lagen[i] === l.varde && `redigerbar-segment-${l.varde}`)}
                            >
                              {l.etikett}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {f.hjalp && <p className="redigerbar-hjalp">{f.hjalp}</p>}
                </fieldset>
              );
            }
            if (f.typ === "vaxel") {
              return (
                <label key={f.nyckel} className="redigerbar-vaxel">
                  <input type="checkbox" checked={varde === true} onChange={(e) => satt(f.nyckel, e.currentTarget.checked ? true : undefined)} />
                  <span>{f.etikett}</span>
                  {f.hjalp && <span className="redigerbar-hjalp">{f.hjalp}</span>}
                </label>
              );
            }
            if (f.typ === "lang") {
              falt = <textarea {...vanlig} rows={4} maxLength={f.max} value={String(varde ?? "")} onChange={(e) => satt(f.nyckel, e.currentTarget.value)} />;
            } else if (f.typ === "val") {
              falt = (
                <select {...vanlig} value={String(varde ?? "")} onChange={(e) => satt(f.nyckel, e.currentTarget.value)}>
                  {(f.alternativ ?? []).map((a) => (
                    <option key={a.varde} value={a.varde}>
                      {a.etikett}
                    </option>
                  ))}
                </select>
              );
            } else if (f.typ === "lista") {
              falt = (
                <input
                  {...vanlig}
                  type="text"
                  value={listtext[f.nyckel] ?? ""}
                  onChange={(e) => {
                    const v = e.currentTarget.value;
                    setListtext((l) => ({ ...l, [f.nyckel]: v }));
                  }}
                />
              );
            } else if (f.typ === "lank") {
              falt = (
                <>
                  <input
                    {...vanlig}
                    type="text"
                    inputMode="url"
                    autoComplete="off"
                    spellCheck={false}
                    list={`${id}-sidor`}
                    maxLength={400}
                    value={String(varde ?? "")}
                    onChange={(e) => satt(f.nyckel, e.currentTarget.value)}
                  />
                  <datalist id={`${id}-sidor`}>
                    {SIDOR.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </>
              );
            } else {
              falt = <input {...vanlig} type="text" maxLength={f.max} value={String(varde ?? "")} onChange={(e) => satt(f.nyckel, e.currentTarget.value)} />;
            }

            const langd = typeof varde === "string" ? varde.length : 0;
            return (
              <div key={f.nyckel} className="redigerbar-falt">
                <label htmlFor={fid} className="redigerbar-etikett">
                  <span>
                    {f.etikett}
                    {f.kravs || f.typ === "lank" || f.typ === "val" ? null : <span className="redigerbar-valfri"> (valfri)</span>}
                  </span>
                  {f.max && (f.typ === "text" || f.typ === "lang" || !f.typ) && langd > f.max * 0.8 && (
                    <span className={cn("redigerbar-raknare", langd >= f.max && "redigerbar-raknare-full")}>
                      {langd}/{f.max}
                    </span>
                  )}
                </label>
                {falt}
                {felText ? (
                  <p id={`${fid}-fel`} className="redigerbar-felrad">
                    {felText}
                  </p>
                ) : f.hjalp || f.typ === "lank" ? (
                  <p id={`${fid}-hjalp`} className="redigerbar-hjalp">
                    {f.hjalp ?? "En sida på sajten som /foretag, eller en hel adress."}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
      {forhandsvisning && <div className="redigerbar-forhand">{forhandsvisning(utkast)}</div>}

      <div className="redigerbar-ruta-fot">
        <div className="flex items-center gap-1">
          {kanTaBort && (
            <button type="button" onClick={onTaBort} className="redigerbar-knapp redigerbar-knapp-fara">
              <Trash size={15} /> Ta bort
            </button>
          )}
          {(kanUpp || kanNer) && (
            <>
              <button type="button" data-fokus="upp" disabled={!kanUpp} onClick={() => flytta(-1)} aria-label="Flytta upp" title="Flytta upp" className="redigerbar-ikonknapp">
                <ChevronDown size={16} className="rotate-180" />
              </button>
              <button type="button" data-fokus="ner" disabled={!kanNer} onClick={() => flytta(1)} aria-label="Flytta ner" title="Flytta ner" className="redigerbar-ikonknapp">
                <ChevronDown size={16} />
              </button>
            </>
          )}
          {verktyg?.(onStang)}
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={onStang} className="redigerbar-knapp">
            Avbryt
          </button>
          <button type="button" onClick={() => klar()} className="redigerbar-knapp redigerbar-knapp-pa">
            Klar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

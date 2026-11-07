"use client";

import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Close, Grip, Plus } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { ListaProps } from "../redigerbar";
import { RadRuta } from "./ruta";

/**
 * En lista i redigeringsläget. Varje rad får ett handtag att dra i (eller flytta med piltangenterna) och öppnar en liten
 * ruta med sina fält när man klickar på den. Medan man drar flyttas raderna på plats, men utkastet ändras först när man
 * släpper, så att varje flytt blir ett steg att ångra.
 */
export default function ListRedigerare({
  items,
  onChange,
  render,
  etikett,
  ett = false,
  as: As = "ul",
  className,
  itemAs: ItemAs = "li",
  itemClassName,
  itemProps,
  nyckel,
  falt,
  ny,
  max = 50,
  min = 0,
  efter,
  verktyg,
  forhandsvisning,
}: ListaProps<unknown>) {
  const [oppen, setOppen] = useState<number | null>(null);
  const [ordning, setOrdning] = useState<number[] | null>(null);
  const [meddelande, setMeddelande] = useState("");
  const [nyRad, setNyRad] = useState<{ varde: unknown } | null>(null);
  const rader = useRef<(HTMLElement | null)[]>([]);
  const nyKnapp = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ fran: number; plats: number; x: number; y: number; el: HTMLElement; fore: DOMRect } | null>(null);

  const visade = ordning ?? items.map((_, i) => i);
  const flyttad = ett ? "Flyttat" : "Flyttad";
  const tillagd = ett ? "tillagt" : "tillagd";
  // Ordningen medan man drar, för fönstrets lyssnare. Sätts i rör och nollas när man släpper.
  const ordningRef = useRef<number[] | null>(null);

  // Raden man drar ska stå kvar under pekaren när de andra byter plats: flytta startpunkten lika mycket som raden flyttades.
  useLayoutEffect(() => {
    const d = drag.current;
    if (!d) return;
    const transform = d.el.style.transform;
    d.el.style.transform = "";
    const naturlig = d.el.getBoundingClientRect();
    d.el.style.transform = transform;
    d.x += naturlig.left - d.fore.left;
    d.y += naturlig.top - d.fore.top;
    d.fore = naturlig;
  }, [ordning]);

  function flytta(fran: number, till: number) {
    if (till < 0 || till >= items.length || fran === till) return;
    const nya = [...items];
    const [rad] = nya.splice(fran, 1);
    nya.splice(till, 0, rad);
    onChange(nya);
    setMeddelande(`${flyttad} till plats ${till + 1} av ${items.length}.`);
  }

  /**
   * Dragningen lyssnar på fönstret och inte på handtaget: raderna byter plats i dokumentet medan man drar, och då kan
   * webbläsaren släppa en pekare som är fångad av ett element som flyttas.
   */
  function borjaDra(e: PointerEvent<HTMLButtonElement>, index: number) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const el = rader.current[index];
    if (!el) return;
    setOppen(null);
    ordningRef.current = null;
    drag.current = { fran: index, plats: index, x: e.clientX, y: e.clientY, el, fore: el.getBoundingClientRect() };
    el.dataset.drar = "";
    const rör = (ev: globalThis.PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      ev.preventDefault();
      d.el.style.transform = `translate(${ev.clientX - d.x}px, ${ev.clientY - d.y}px)`;
      // Raden under pekaren, bland de andra. Fungerar både för rader och för knappar bredvid varandra.
      let mal = -1;
      rader.current.forEach((annan, i) => {
        if (!annan || annan === d.el) return;
        const r = annan.getBoundingClientRect();
        if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) mal = i;
      });
      if (mal === -1) return;
      const lista = [...(ordningRef.current ?? items.map((_, i) => i))];
      const fran = lista.indexOf(d.fran);
      const till = lista.indexOf(mal);
      if (fran === -1 || till === -1 || fran === till) return;
      lista.splice(fran, 1);
      lista.splice(till, 0, d.fran);
      d.plats = till;
      ordningRef.current = lista;
      setOrdning(lista);
    };
    const slapp = (avbruten: boolean) => {
      window.removeEventListener("pointermove", rör);
      window.removeEventListener("pointerup", upp);
      window.removeEventListener("pointercancel", avbryt);
      const d = drag.current;
      drag.current = null;
      if (!d) return;
      d.el.style.transform = "";
      delete d.el.dataset.drar;
      const slut = ordningRef.current;
      ordningRef.current = null;
      setOrdning(null);
      if (avbruten || !slut || slut.indexOf(d.fran) === d.fran) return;
      onChange(slut.map((i) => items[i]));
      setMeddelande(`${flyttad} till plats ${slut.indexOf(d.fran) + 1} av ${items.length}.`);
    };
    const upp = () => slapp(false);
    const avbryt = () => slapp(true);
    window.addEventListener("pointermove", rör, { passive: false });
    window.addEventListener("pointerup", upp);
    window.addEventListener("pointercancel", avbryt);
  }

  const handtag = (index: number) => ({
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => borjaDra(e, index),
    onClick(e: React.MouseEvent) {
      e.preventDefault();
      e.stopPropagation();
    },
    onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
      const steg = e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : 0;
      if (!steg) return;
      e.preventDefault();
      e.stopPropagation();
      flytta(index, index + steg);
      // Fokus följer med raden till sin nya plats.
      requestAnimationFrame(() => rader.current[index + steg]?.querySelector<HTMLButtonElement>("[data-handtag]")?.focus());
    },
  });

  const laggTill = () => {
    if (!ny || items.length >= max) return;
    // Med fält öppnas en ruta först, och raden läggs till när man trycker Klar. Utan fält läggs den till direkt.
    if (falt?.length) {
      setOppen(null);
      setNyRad({ varde: ny() });
    } else {
      onChange([...items, ny()]);
      setMeddelande(`${stor(etikett)} ${tillagd}.`);
    }
  };

  const taBort = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
    setMeddelande(`${stor(etikett)} ${ett ? "borttaget" : "borttagen"}.`);
    setOppen(null);
  };

  return (
    <>
      <As className={cn(className, "redigerbar-lista")}>
        {visade.map((index) => {
          const item = items[index];
          if (item === undefined) return null;
          const klass = typeof itemClassName === "function" ? itemClassName(item, index) : itemClassName;
          return (
            <ItemAs
              key={nyckel ? nyckel(item, index) : index}
              {...itemProps?.(item, index)}
              ref={(el: HTMLElement | null) => {
                rader.current[index] = el;
              }}
              className={cn(klass, "redigerbar-rad", oppen === index && "redigerbar-rad-oppen")}
              // Länkar i raden ska inte leda vidare. Bara det som står i raden: en lista i raden har sin ruta i en portal,
              // och klick där passerar här i Reacts träd. Utan kollen gick rutans kryssrutor inte att kryssa i.
              onClickCapture={(e: React.MouseEvent) => {
                if (e.currentTarget.contains(e.target as Node)) e.preventDefault();
              }}
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                if (falt?.length) {
                  setNyRad(null);
                  setOppen(index);
                }
              }}
            >
              {render(item, index)}
              {items.length > 1 && (
                <button type="button" data-handtag aria-label={`Flytta ${etikett} ${index + 1} av ${items.length}. Dra, eller använd piltangenterna.`} title="Dra för att flytta" className="redigerbar-handtag" {...handtag(index)}>
                  <Grip size={14} />
                </button>
              )}
              {!falt?.length && items.length > min && (
                <button
                  type="button"
                  aria-label={`Ta bort ${etikett} ${index + 1}`}
                  title="Ta bort"
                  className="redigerbar-taBort"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    taBort(index);
                  }}
                >
                  <Close size={12} />
                </button>
              )}
            </ItemAs>
          );
        })}
        {ny && items.length < max && (
          <ItemAs className="redigerbar-ny-rad">
            <button
              ref={nyKnapp}
              type="button"
              onClickCapture={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                laggTill();
              }}
              className="redigerbar-ny"
            >
              <Plus size={14} /> Lägg till {etikett}
            </button>
          </ItemAs>
        )}
        {efter}
      </As>
      <span aria-live="polite" className="sr-only">
        {meddelande}
      </span>
      {oppen !== null && items[oppen] !== undefined && falt && (
        <RadRuta
          key={oppen}
          ankare={() => rader.current[oppen] ?? null}
          rubrik={`Ändra ${etikett}`}
          item={items[oppen] as Record<string, unknown>}
          falt={falt as never}
          kanTaBort={items.length > min}
          kanUpp={oppen > 0}
          kanNer={oppen < items.length - 1}
          onSpara={(nytt) => {
            const nya = [...items];
            nya[oppen] = nytt;
            onChange(nya);
          }}
          onTaBort={() => taBort(oppen)}
          onFlytta={(steg, nytt) => {
            const till = oppen + steg;
            if (till < 0 || till >= items.length) return;
            const nya = [...items];
            nya.splice(oppen, 1);
            nya.splice(till, 0, nytt);
            onChange(nya);
            setMeddelande(`${flyttad} till plats ${till + 1} av ${items.length}.`);
            setOppen(till);
          }}
          onStang={() => setOppen(null)}
          verktyg={verktyg ? (stang) => verktyg(items[oppen], oppen, stang) : undefined}
          forhandsvisning={forhandsvisning}
        />
      )}
      {nyRad && falt && (
        <RadRuta
          ny
          ankare={() => nyKnapp.current}
          rubrik={`${ett ? "Nytt" : "Ny"} ${etikett}`}
          item={nyRad.varde as Record<string, unknown>}
          falt={falt as never}
          kanTaBort={false}
          kanUpp={false}
          kanNer={false}
          onSpara={(nytt) => {
            onChange([...items, nytt]);
            setMeddelande(`${stor(etikett)} ${tillagd}.`);
          }}
          onTaBort={() => setNyRad(null)}
          onFlytta={() => undefined}
          onStang={() => setNyRad(null)}
          forhandsvisning={forhandsvisning}
        />
      )}
    </>
  );
}

const stor = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

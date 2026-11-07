"use client";

import { lazy, Suspense, type ComponentType, type ElementType, type ReactNode } from "react";
import { AccentText } from "@/components/ui/accent-text";
import { stabil } from "@/lib/innehall/poster";
import { useRedigera, useUtkast, utkastStore } from "./utkast";

/**
 * Det som går att ändra direkt på sidan. Besökare får bara texten och listorna: redigerarna hämtas först när någon med
 * behörighet slår på redigeringsläget (React.lazy, så att koden hamnar i en egen fil, se admin-bar-lazy.tsx).
 */
const TextRedigerare = lazy(() => import("./redigera/text"));
const ListRedigerare = lazy(() => import("./redigera/lista")) as unknown as ComponentType<ListaProps<unknown>>;

export type TextFormat = {
  /** Klassen på *ord*. Utan accent visas texten som den står. */
  accent?: string;
  /** Får texten ha radbrytningar? Annars blir de mellanslag. */
  rader?: boolean;
  /** Egen visning, t.ex. en rad per block. Får texten som den sparas. */
  visa?: (text: string) => ReactNode;
};

/** stilla: redigeringsläget är på, så det som står _för hand_ visas direkt i stället för att skrivas fram. */
export function TextVy({ text, accent, visa, stilla }: TextFormat & { text: string; stilla?: boolean }) {
  if (visa) return <>{visa(text)}</>;
  if (accent) return <AccentText text={text} accentClassName={accent} stilla={stilla} />;
  return <>{text}</>;
}

/** En inställning som går att ändra där den står, t.ex. en rubrik på startsidan. value är texten som sidan visar. */
export function RText({ id, value, className, ...format }: TextFormat & { id: `s:${string}`; value: string; className?: string }) {
  const text = useUtkast(id, value);
  const aktiv = useRedigera(id);
  const vy = <TextVy text={text} stilla={aktiv} {...format} />;
  if (!aktiv) return className ? <span className={className}>{vy}</span> : vy;
  return (
    <Suspense fallback={className ? <span className={className}>{vy}</span> : vy}>
      <TextRedigerare text={text} vy={vy} regel={id.slice(2)} rader={format.rader} className={className} onCommit={(t) => utkastStore.satt(id, t, stabil(value))} />
    </Suspense>
  );
}

/** En text i ett block. Blocket bestämmer om den går att ändra och vad som händer med den nya texten. */
export function RFalt({
  aktiv,
  varde,
  onCommit,
  etikett,
  max,
  kravs,
  className,
  ...format
}: TextFormat & { aktiv: boolean; varde: string; onCommit: (text: string) => void; etikett: string; max: number; kravs?: boolean; className?: string }) {
  const vy = <TextVy text={varde} stilla={aktiv} {...format} />;
  if (!aktiv) return className ? <span className={className}>{vy}</span> : vy;
  return (
    <Suspense fallback={className ? <span className={className}>{vy}</span> : vy}>
      <TextRedigerare text={varde} vy={vy} etikett={etikett} max={max} kravs={kravs} rader={format.rader} className={className} onCommit={onCommit} />
    </Suspense>
  );
}

/** Ett fält i rutan som öppnas när man klickar på något i en lista. */
export type Falt<T> = {
  nyckel: keyof T & string;
  etikett: string;
  typ?: "text" | "lang" | "lank" | "val" | "lagen" | "lista" | "vaxel";
  /** För val: alternativen. För lagen: stegens namn. */
  alternativ?: { varde: string; etikett: string }[];
  /** För text: högst så många tecken. För lista: högst så många tecken per sak. */
  max?: number;
  /** För lista: högst så många saker. */
  antal?: number;
  kravs?: boolean;
  hjalp?: string;
};

export type ListaProps<T> = {
  aktiv: boolean;
  items: T[];
  onChange: (items: T[]) => void;
  render: (item: T, index: number) => ReactNode;
  /** Vad en rad heter, i singular och med liten bokstav: "knapp", "färdighet". */
  etikett: string;
  /** Ett ett-ord, som program och kort: "Nytt program", "Program tillagt". */
  ett?: boolean;
  as?: ElementType;
  className?: string;
  itemAs?: ElementType;
  itemClassName?: string | ((item: T, index: number) => string | undefined);
  /** Annat på raden, som data-attribut och style. */
  itemProps?: (item: T, index: number) => Record<string, unknown>;
  nyckel?: (item: T, index: number) => string | number;
  falt?: Falt<T>[];
  /** En ny rad. Utan den går det inte att lägga till. */
  ny?: () => T;
  max?: number;
  min?: number;
  /** Står sist i listan, både för besökare och i redigeringsläget. */
  efter?: ReactNode;
  /** Extra knappar i rutan för en rad, t.ex. flytta till en annan grupp. */
  verktyg?: (item: T, index: number, stang: () => void) => ReactNode;
  /** Visas i rutan under fälten och följer det man skriver, som formeln i rutnätet. */
  forhandsvisning?: (utkast: T) => ReactNode;
};

export function ListaVy<T>({ items, render, as: As = "ul", className, itemAs: ItemAs = "li", itemClassName, itemProps, nyckel, efter }: ListaProps<T>) {
  return (
    <As className={className}>
      {items.map((item, i) => (
        <ItemAs key={nyckel ? nyckel(item, i) : i} {...itemProps?.(item, i)} className={typeof itemClassName === "function" ? itemClassName(item, i) : itemClassName}>
          {render(item, i)}
        </ItemAs>
      ))}
      {efter}
    </As>
  );
}

/** En lista som går att ändra på plats: lägga till, ta bort, dra för att byta ordning och klicka för att ändra en rad. */
export function RLista<T>(props: ListaProps<T>) {
  const vy = <ListaVy {...props} />;
  if (!props.aktiv) return vy;
  return (
    <Suspense fallback={vy}>
      <ListRedigerare {...(props as ListaProps<unknown>)} />
    </Suspense>
  );
}

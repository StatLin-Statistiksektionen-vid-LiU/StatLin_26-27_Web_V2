"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { RLista, type Falt } from "@/components/edit-mode/redigerbar";
import { useBlock } from "@/components/edit-mode/utkast";
import { ArrowRight } from "@/components/icons";
import { arIntern } from "@/lib/innehall/lank";
import type { Start } from "@/lib/innehall/typer";
import { cn } from "@/lib/utils";

type Knapp = Start["hero"][number];

const FALT: Falt<Knapp>[] = [
  { nyckel: "text", etikett: "Knappens text", max: 40, hjalp: "Utan text syns inte knappen för besökare." },
  { nyckel: "href", etikett: "Länk", typ: "lank" },
];

/** Länkar inom sajten går med Next:s Link, länkar till andra sajter öppnas i en ny flik. */
export function Lank({ href, className, children }: { href: string; className: string; children: ReactNode }) {
  if (arIntern(href)) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}

/** En knapp på startsidan. Den första i raden är svart med en pil, resten är ljusa. */
function KnappLank({ knapp, forsta, stor }: { knapp: Knapp; forsta: boolean; stor: boolean }) {
  return (
    <Lank href={knapp.href} className={cn("btn", forsta ? "btn-ink group" : "btn-ghost")}>
      {knapp.text}
      {forsta && <ArrowRight size={stor ? 18 : 16} className={cn("transition-transform group-hover:translate-x-0.5", stor ? "duration-500" : "duration-300")} />}
    </Lank>
  );
}

type KortLank = { href: string; live?: string };

const NY_FALT: Falt<KortLank>[] = [{ nyckel: "href", etikett: "Länken", typ: "lank", hjalp: "Dit kortet leder. Texterna ändrar du genom att klicka på dem." }];
const STAR_FALT: Falt<KortLank>[] = [
  { nyckel: "href", etikett: "Länken", typ: "lank", hjalp: "Dit kortet leder när STAR inte är live." },
  { nyckel: "live", etikett: "Länken när STAR är live", typ: "lank", hjalp: "Texterna ändrar du genom att klicka på dem." },
];

/**
 * Ett av de två korten längst ner på startsidan. Innehållet ritas på servern och texterna ändras där de står (RText). Länken
 * hör till startsidans block: i redigeringsläget öppnar ett klick på kortet en ruta för den. STAR-kortet har två länkar,
 * en för när STAR är live (live) och en för resten av året.
 */
export function StartKort({ start, vilket, live = false, className, children }: { start: Start; vilket: "ny" | "star"; live?: boolean; className: string; children: ReactNode }) {
  const { varde, aktiv, andra } = useBlock("b:start", start);
  const l = varde.lankar;
  const item: KortLank = vilket === "ny" ? { href: l.ny } : { href: l.star, live: l.starLive };
  return (
    <RLista
      aktiv={aktiv}
      items={[item]}
      onChange={([nytt]) =>
        andra((s) => {
          if (vilket === "ny") s.lankar.ny = nytt.href;
          else {
            s.lankar.star = nytt.href;
            s.lankar.starLive = nytt.live ?? s.lankar.starLive;
          }
        })
      }
      etikett="kort"
      ett
      as="div"
      className="h-full"
      itemAs="div"
      itemClassName="h-full rounded-2xl"
      falt={vilket === "ny" ? NY_FALT : STAR_FALT}
      min={1}
      max={1}
      render={(k) => (
        <Lank href={live && k.live ? k.live : k.href} className={className}>
          {children}
        </Lank>
      )}
    />
  );
}

/**
 * Knapparna i heron och under texten om sektionen. De hör till startsidans block (src/lib/innehall/block/start.ts) och går
 * att ändra, lägga till, ta bort och dra om i redigeringsläget. En knapp utan text syns bara där.
 */
export function StartKnappar({ start, vilka, className }: { start: Start; vilka: "hero" | "om"; className?: string }) {
  const { varde, aktiv, andra } = useBlock("b:start", start);
  const knappar = aktiv ? varde[vilka] : varde[vilka].filter((k) => k.text.trim());
  const stor = vilka === "om";
  return (
    <RLista
      aktiv={aktiv}
      items={knappar}
      onChange={(nya) =>
        andra((k) => {
          k[vilka] = nya;
        })
      }
      etikett="knapp"
      as="div"
      className={cn("flex flex-wrap items-center", stor ? "gap-3" : "gap-2.5", className)}
      itemAs="div"
      itemClassName="flex rounded-full"
      falt={FALT}
      ny={() => ({ text: "Ny knapp", href: "/" })}
      max={vilka === "hero" ? 4 : 3}
      render={(knapp, i) =>
        knapp.text.trim() ? (
          <KnappLank knapp={knapp} forsta={i === 0} stor={stor} />
        ) : (
          <span className="btn btn-ghost border-dashed opacity-60" title="Knappen har ingen text och syns inte för besökare.">
            Dold knapp
          </span>
        )
      }
    />
  );
}

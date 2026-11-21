import { Suspense } from "react";
import { FormulaRing } from "@/components/brand/formula-ring";
import { RText } from "@/components/edit-mode/redigerbar";
import { StartKnappar } from "@/components/home/start-knappar";
import { AccentText } from "@/components/ui/accent-text";
import { DEFAULT_SETTINGS, getSettings } from "@/lib/data/content";
import { START } from "@/lib/innehall/block/start";
import { getBlock, textVarde } from "@/lib/innehall/server";

/* Texterna, knapparna, formelringen och scrollmarkören som de två heroerna delar. */

async function Kicker() {
  const s = await getSettings();
  return <RText id="s:hero_kicker" value={textVarde(s, "hero_kicker")} accent="text-ink" />;
}

export function ProvKicker() {
  return (
    <Suspense fallback={<span className="invisible">{DEFAULT_SETTINGS.hero_kicker}</span>}>
      <Kicker />
    </Suspense>
  );
}

type TextKlasser = { rubrik: string; ingress: string };

async function Text({ rubrik, ingress }: TextKlasser) {
  const s = await getSettings();
  return (
    <>
      <h1 className={rubrik}>
        <RText id="s:hero_title" value={textVarde(s, "hero_title")} accent="text-red" rader />
      </h1>
      <p className={ingress}>
        <RText id="s:hero_text" value={textVarde(s, "hero_text")} accent="text-ink" rader />
      </p>
    </>
  );
}

/** Rubriken och ingressen. Tills inställningarna har kommit håller en osynlig kopia av standardtexten platsen. */
export function ProvText({ rubrik, ingress }: TextKlasser) {
  return (
    <Suspense
      fallback={
        <div className="invisible" aria-hidden>
          <p className={rubrik}>
            <AccentText text={DEFAULT_SETTINGS.hero_title} plats />
          </p>
          <p className={ingress}>
            <AccentText text={DEFAULT_SETTINGS.hero_text} plats />
          </p>
        </div>
      }
    >
      <Text rubrik={rubrik} ingress={ingress} />
    </Suspense>
  );
}

async function Knappar({ className }: { className?: string }) {
  return <StartKnappar start={await getBlock("start")} className={className} />;
}

export function ProvKnappar({ className }: { className?: string }) {
  return (
    <Suspense fallback={<StartKnappar start={START.standard()} className={className} />}>
      <Knappar className={className} />
    </Suspense>
  );
}

async function Formler() {
  const s = await getSettings();
  return s.hero_formulas === "av" ? null : <FormulaRing />;
}

export function ProvFormler() {
  return (
    <Suspense fallback={null}>
      <Formler />
    </Suspense>
  );
}

/** Scrollmarkören bredvid knapparna. Den leder till det som kommer efter heron, se startsida.tsx. */
export function ProvScroll() {
  return (
    <a href="#utforska" aria-label="Scrolla vidare" className="pr-scroll">
      <span className="pr-scroll-spar">
        <span className="pr-scroll-lopare" />
      </span>
    </a>
  );
}

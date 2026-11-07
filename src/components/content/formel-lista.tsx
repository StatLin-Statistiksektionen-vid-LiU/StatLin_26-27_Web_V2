"use client";

import { useEffect, useState } from "react";
import { RLista, type Falt } from "@/components/edit-mode/redigerbar";
import type { Handskrift } from "@/lib/innehall/typer";
import { laddaTypsnitt, ritaFormel } from "./formel";
import { FormelVy } from "./formel-vy";

type Formel = Handskrift["formler"][number];

const FALT: Falt<Formel>[] = [
  {
    nyckel: "tex",
    etikett: "Formeln i LaTeX",
    typ: "lang",
    max: 200,
    kravs: true,
    hjalp: String.raw`Som i LaTeX, utan dollartecken: x_i, x^2, \frac{a}{b}, \sqrt{x}, \sum_{i=1}^{n}, \bar{x}, \mu, \leq och \to.`,
  },
  { nyckel: "rod", etikett: "Rödpenna", typ: "vaxel" },
];

/** Formeln som den skrivs i rutnätet, färdigskriven. */
function Formeln({ formel, storlek }: { formel: Formel; storlek: string }) {
  const { ruta } = ritaFormel(formel.tex);
  return (
    <span data-skriv="klar" className={formel.rod ? "handskrift formel-rad text-red-deep" : "handskrift formel-rad"} style={{ fontSize: storlek }}>
      <FormelVy ruta={ruta} />
    </span>
  );
}

/** I rutan för en formel: formeln som den blir, och vad tolken inte kände igen. */
function Forhand({ formel }: { formel: Formel }) {
  if (!formel.tex?.trim()) return <p className="redigerbar-hjalp">Formeln syns här när du skriver.</p>;
  const { okanda, fel } = ritaFormel(formel.tex);
  return (
    <>
      <Formeln formel={formel} storlek="1.6rem" />
      {okanda.length > 0 && <p className="redigerbar-felrad">Känner inte igen {okanda.join(", ")}, så det skrivs som text.</p>}
      {fel.length > 0 && <p className="redigerbar-felrad">Något öppnas utan att stängas, eller tvärtom: {fel.join(", ")}.</p>}
    </>
  );
}

/**
 * Formlerna i rutnätet, i redigeringsläget i sidfoten under citaten (SidfotCitat). De läggs till, ändras, tas bort och byter
 * ordning här, och rutan visar formeln medan man skriver. Laddas bara i redigeringsläget, med tolken och Mynerve.
 */
export default function FormelLista({ formler, onChange }: { formler: Formel[]; onChange: (nya: Formel[]) => void }) {
  // Måtten tas om när typsnittet har laddats, annars blir bredderna reservtypsnittets.
  const [, setLaddat] = useState(0);
  useEffect(() => {
    laddaTypsnitt().then(
      () => setLaddat((n) => n + 1),
      () => {},
    );
  }, []);
  return (
    <section className="mt-10">
      <h3 className="font-sans text-[0.7rem] font-bold uppercase tracking-[0.08em] text-stone">Formlerna i rutnätet</h3>
      <p className="mt-1 max-w-sm font-sans text-[0.8rem] leading-snug text-stone">Skrivs för hand en i taget, i den här ordningen, där muspekaren lyser upp rutnätet och formeln får plats.</p>
      <RLista
        aktiv
        items={formler}
        onChange={onChange}
        etikett="formel"
        as="ol"
        className="mt-3 space-y-2"
        itemAs="li"
        falt={FALT}
        ny={(): Formel => ({ tex: String.raw`\bar{x} = \frac{1}{n}\sum x_i` })}
        max={30}
        render={(f) => <Formeln formel={f} storlek="1.35rem" />}
        forhandsvisning={(f) => <Forhand formel={f} />}
      />
    </section>
  );
}

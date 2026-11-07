"use client";

import { useState, type ComponentType } from "react";
import { RFalt } from "@/components/edit-mode/redigerbar";
import { useBlock } from "@/components/edit-mode/utkast";
import type { Estig } from "@/lib/innehall/typer";

export type SpeletProps = { onStang: () => void };

/** Histogrammet i sökarens hörn: en normalfördelning i pixlar, i eSTIG:s färger. */
const STAPLAR = [1, 2, 4, 5, 4, 2, 1];
const STAPELFARG = ["#2caadf", "#8457a6", "#f15a25", "#f7b042", "#f15a25", "#8457a6", "#2caadf"];

/**
 * Spelet ligger i en egen fil som hämtas först när någon för musen över loggan eller trycker på den, så att sidan inte bär på
 * koden. Går hämtningen fel blir nästa tryck ett nytt försök.
 */
let hamtning: Promise<ComponentType<SpeletProps>> | null = null;
function hamtaSpelet() {
  hamtning ??= import("./spelet").then(
    (m) => m.default,
    (err: unknown) => {
      hamtning = null;
      throw err;
    },
  );
  return hamtning;
}

/**
 * eSTIG:s logga i en kamerasökare. Loggan är en knapp som startar spelet Stapla normalen i en dialog. Raden under loggan ändras i
 * redigeringsläget (src/lib/innehall/block/estig.ts) och står utanför knappen, så att den går att klicka på där.
 */
export function SpelLogga({ src, alt, estig }: { src: string; alt: string; estig: Estig }) {
  const { varde, aktiv, andra } = useBlock("b:estig", estig);
  const [Spel, setSpel] = useState<ComponentType<SpeletProps> | null>(null);
  const [oppet, setOppet] = useState(false);
  const [lage, setLage] = useState<"vilar" | "hamtar" | "fel">("vilar");

  const starta = () => {
    if (Spel) {
      setOppet(true);
      return;
    }
    setLage("hamtar");
    hamtaSpelet().then(
      (K) => {
        setSpel(() => K);
        setOppet(true);
        setLage("vilar");
      },
      () => setLage("fel"),
    );
  };

  const tips = varde.spela.trim();
  return (
    <div className="flex flex-col items-center">
      <div className="spel-ram">
        <button
          type="button"
          className="spel-logga"
          onClick={starta}
          onPointerEnter={() => void hamtaSpelet().catch(() => {})}
          aria-haspopup="dialog"
          aria-label={`${alt}: starta spelet Stapla normalen`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" fetchPriority="high" className="w-[min(70vw,24rem)] animate-float" />
        </button>
        <span className="spel-horn" data-horn="tv" aria-hidden />
        <span className="spel-horn" data-horn="th" aria-hidden />
        <span className="spel-horn" data-horn="bv" aria-hidden />
        <span className="spel-horn" data-horn="bh" aria-hidden />
        <span className="spel-etikett" data-plats="vanster" aria-hidden>
          <span className="spel-rec" /> Rec
        </span>
        <span className="spel-etikett" data-plats="hoger" aria-hidden>
          4K · 60 fps
        </span>
        <svg className="spel-histogram" viewBox="0 0 7 5" shapeRendering="crispEdges" aria-hidden>
          {STAPLAR.flatMap((h, x) =>
            Array.from({ length: h }, (_, y) => <rect key={`${x}-${y}`} x={x + 0.12} y={4 - y + 0.12} width={0.76} height={0.76} fill={STAPELFARG[x]} />),
          )}
        </svg>
      </div>
      {(tips || aktiv) && (
        <p className="spel-tips">
          <span aria-hidden className="spel-play text-red-deep">
            ▶
          </span>
          <RFalt
            aktiv={aktiv}
            varde={varde.spela}
            onCommit={(t) =>
              andra((e) => {
                e.spela = t;
              })
            }
            etikett="Raden under loggan"
            max={40}
          />
        </p>
      )}
      <p role="status" className="spel-status">
        {lage === "hamtar" ? "Laddar spelet…" : lage === "fel" ? "Spelet gick inte att ladda. Tryck på loggan igen." : ""}
      </p>
      {Spel && oppet && <Spel onStang={() => setOppet(false)} />}
    </div>
  );
}

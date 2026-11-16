"use client";

import { useState, type ComponentType } from "react";
import { Gamepad } from "@/components/icons";

export type SpeletProps = { onStang: () => void };

/**
 * Spelet ligger i en egen fil som hämtas först när någon för musen över knappen eller trycker på den, så att sidan inte bär på
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

/** Kortet på eSTIG:s sida som startar spelet Stapla normalen i en dialog. */
export function SpelKort() {
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

  return (
    <div className="flex flex-[1_1_15rem] flex-col rounded-[1.5rem] border border-line bg-white p-5 md:p-6">
      <p className="kicker text-red-deep">eSTIG:s eget spel</p>
      <p className="mt-1.5 text-lg font-bold tracking-tight">Stapla normalen</p>
      <p className="mt-1 text-[0.92rem] leading-relaxed text-stone">Stapla blocken så att staplarna följer normalfördelningens kurva.</p>
      <button type="button" className="btn btn-ink mt-4 self-start" onClick={starta} onPointerEnter={() => void hamtaSpelet().catch(() => {})} aria-haspopup="dialog">
        <Gamepad size={18} /> {lage === "hamtar" ? "Laddar…" : "Spela"}
      </button>
      <p role="status" className="mt-2 text-sm text-stone empty:hidden">
        {lage === "fel" ? "Spelet gick inte att ladda. Försök igen." : ""}
      </p>
      {Spel && oppet && <Spel onStang={() => setOppet(false)} />}
    </div>
  );
}

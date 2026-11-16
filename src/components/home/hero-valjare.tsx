"use client";

import { useState } from "react";
import { valjHero } from "@/app/admin/_actions/content";
import { useEditState } from "@/components/edit-mode/store";
import { canManageSettings } from "@/lib/auth/permissions";
import { HERO_NAMN, HERO_VAL, type HeroVal } from "@/lib/hero-val";

const NATFEL = "Kunde inte spara. Kontrollera anslutningen och försök igen.";

/**
 * Väljaren för startsidans hero. Den syns bara i redigeringsläget, för den som får ändra inställningarna. Valet sparas direkt och
 * gäller alla besökare. Sedan laddas startsidan om, så att den valda heron visas med sitt eget förrenderade skal (se
 * src/lib/hero-val.ts).
 */
export function HeroValjare({ nu }: { nu: HeroVal }) {
  const { user, editing } = useEditState();
  const [sparar, setSparar] = useState<HeroVal | null>(null);
  const [fel, setFel] = useState<string | null>(null);

  if (!editing || !user || !canManageSettings(user)) return null;

  async function valj(val: HeroVal) {
    if (sparar || val === nu) return;
    setSparar(val);
    setFel(null);
    let svar;
    try {
      svar = await valjHero(val);
    } catch {
      svar = { error: NATFEL };
    }
    if (svar.ok) {
      // Hela sidan laddas om: den valda heron är en annan förrenderad sida bakom samma adress, och routern har den gamla kvar.
      // Knapparna står kvar som upptagna tills den nya sidan har kommit.
      if (window.location.pathname === "/") window.location.reload();
      else window.location.replace("/");
      return;
    }
    setFel(svar.error ?? NATFEL);
    setSparar(null);
  }

  return (
    <div className="hero-valjare" role="group" aria-label="Välj startsidans hero">
      <span className="hero-valjare-namn" aria-hidden>
        Hero
      </span>
      {HERO_VAL.map((val) => (
        <button key={val} type="button" aria-pressed={val === (sparar ?? nu)} disabled={sparar !== null} onClick={() => void valj(val)}>
          {HERO_NAMN[val]}
        </button>
      ))}
      {fel && (
        <p role="alert" className="hero-valjare-fel">
          {fel}
        </p>
      )}
    </div>
  );
}

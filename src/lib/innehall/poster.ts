/**
 * Det som går att ändra direkt på sajten i redigeringsläget. En post är antingen en inställning, `s:nyckel`, som är en text,
 * eller ett block, `b:nyckel`, med innehåll som har struktur (listor, kort, menyn). Standardvärdena står i koden och databasen
 * har bara det som ändrats. Behörigheten här styr bara vad redigeringsläget visar: servern kontrollerar alltid igen när
 * något sparas (src/app/admin/_actions/innehall.ts).
 *
 * Filen hamnar i varje besökares JavaScript, så den ska vara liten. Etiketter och teckengränser står i regler.ts.
 */

export type Behorighet = "installningar" | "naringsliv" | "ubu" | "estig";

export const BLOCK = {
  kompetens: { etikett: "Vad studenterna kan", behorighet: "naringsliv" },
  branscher: { etikett: "Branscherna", behorighet: "naringsliv" },
  meny: { etikett: "Menyn", behorighet: "installningar" },
  start: { etikett: "Startsidans knappar och kort", behorighet: "installningar" },
  ubu: { etikett: "UBU:s knappar", behorighet: "ubu" },
  handskrift: { etikett: "Handskriften", behorighet: "installningar" },
  estig: { etikett: "eSTIG:s sida", behorighet: "estig" },
  anteckningar: { etikett: "Anteckningarna", behorighet: "installningar" },
} as const satisfies Record<string, { etikett: string; behorighet: Behorighet }>;

export type BlockNyckel = keyof typeof BLOCK;

export const isBlockNyckel = (nyckel: string): nyckel is BlockNyckel => Object.hasOwn(BLOCK, nyckel);

/** Behörigheten för en post, eller null om id:t inte är en post. Texterna sköts som inställningarna. */
export function postBehorighet(id: string): Behorighet | null {
  if (id.startsWith("s:")) return "installningar";
  if (id.startsWith("b:")) {
    const nyckel = id.slice(2);
    return isBlockNyckel(nyckel) ? BLOCK[nyckel].behorighet : null;
  }
  return null;
}

/**
 * JSON med nycklarna i bokstavsordning, så att samma innehåll alltid ger samma text. Används för att se om något har
 * ändrats och om någon annan hunnit spara sedan sidan laddades.
 */
export function stabil(varde: unknown): string {
  return JSON.stringify(varde, (_nyckel, x: unknown) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(
          Object.keys(x)
            .sort()
            .map((k) => [k, (x as Record<string, unknown>)[k]]),
        )
      : x,
  );
}

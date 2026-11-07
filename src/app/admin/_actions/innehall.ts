"use server";

import { audit, revalidateSite } from "@/lib/admin/helpers";
import { canManageSettings } from "@/lib/auth/permissions";
import { actionUser } from "@/lib/auth/session";
import { DEFAULT_SETTINGS, getSettings } from "@/lib/data/content";
import { canManageNaringsliv } from "@/lib/data/naringsliv";
import { canManageEstig, canManageUbu } from "@/lib/data/utskott-behorighet";
import { getDb } from "@/lib/db";
import { BLOCK_DEF, BLOCK_PREFIX, lasBlock, textVarde } from "@/lib/innehall/server";
import { isBlockNyckel, postBehorighet, stabil, type Behorighet, type BlockNyckel } from "@/lib/innehall/poster";
import { postEtikett, textRegel } from "@/lib/innehall/regler";

/**
 * Sparar ändringarna från redigeringsläget, alla eller ingen. Varje post kontrolleras för sig: att kontot får ändra den,
 * att värdet håller, och att det som står i databasen fortfarande är det som sidan visade när ändringen började (`bas`).
 * Ett värde som är detsamma som standardvärdet tas bort ur databasen, så att standardvärdet i koden gäller igen.
 */
export type Andring = { id: string; varde: unknown; bas: string };
/** varden: det som sparades, som sidan kommer att visa det. Klienten behöver det för att kunna ångra sparningen. */
export type SparaSvar = { ok?: boolean; message?: string; error?: string; fel?: Record<string, string>; varden?: Record<string, unknown> };

type Konto = Parameters<typeof canManageSettings>[0] & Parameters<typeof canManageNaringsliv>[0];

/** Samma regler som redigeringsläget visar (kanAndraPost i utkast.ts), men räknat här på servern. */
function far(user: Konto, behorighet: Behorighet): boolean {
  if (behorighet === "naringsliv") return canManageNaringsliv(user);
  if (behorighet === "ubu") return canManageUbu(user);
  if (behorighet === "estig") return canManageEstig(user);
  return canManageSettings(user);
}

const SKRIV = "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value";
const ANDRAD = "Någon annan har sparat en ändring här sedan du började. Ladda om sidan och gör om din ändring.";

export async function sparaInnehall(andringar: Andring[]): Promise<SparaSvar> {
  const user = await actionUser();
  if ("error" in user) return { error: user.error };
  if (!Array.isArray(andringar) || andringar.length === 0) return { error: "Det finns inget att spara." };
  if (andringar.length > 80) return { error: "För många ändringar på en gång. Spara lite i taget." };

  const db = getDb();
  const settings = await getSettings();
  const fel: Record<string, string> = {};
  const skrivningar: { key: string; value: string | null }[] = [];
  const varden: Record<string, unknown> = {};

  for (const andring of andringar) {
    const id = typeof andring?.id === "string" ? andring.id : "";
    const behorighet = postBehorighet(id);
    if (!behorighet || (id.startsWith("s:") && !textRegel(id.slice(2)))) {
      fel[id || "?"] = "Den här delen går inte att ändra här.";
      continue;
    }
    if (!far(user, behorighet)) {
      fel[id] = "Ditt konto får inte ändra den här delen.";
      continue;
    }
    const nyckel = id.slice(2);

    if (id.startsWith("s:")) {
      const regel = textRegel(nyckel)!;
      if (typeof andring.varde !== "string") {
        fel[id] = "Texten gick inte att läsa.";
        continue;
      }
      const text = andring.varde.replace(/\r\n?/g, "\n").trim();
      if (text.length > regel.max) fel[id] = `${regel.etikett} får vara högst ${regel.max} tecken.`;
      else if (regel.kravs && !text) fel[id] = `${regel.etikett} saknas.`;
      else if (stabil(textVarde(settings, nyckel)) !== andring.bas) fel[id] = ANDRAD;
      if (fel[id]) continue;
      // Samma som standardtexten: raden tas bort. En sajttext som töms får också standardtexten tillbaka.
      const standard = String((DEFAULT_SETTINGS as unknown as Record<string, string>)[nyckel] ?? "").trim();
      skrivningar.push({ key: nyckel, value: text === standard ? null : text });
      // Det sidan visar efter sparningen, räknat som sidan räknar (en tömd sajttext visar standardtexten).
      varden[id] = textVarde({ ...settings, [nyckel]: text } as typeof settings, nyckel);
      continue;
    }

    if (!isBlockNyckel(nyckel)) continue;
    const def = BLOCK_DEF[nyckel as BlockNyckel];
    const tolkat = def.schema.safeParse(andring.varde);
    if (!tolkat.success) {
      fel[id] = tolkat.error.issues[0]?.message ?? "Något i innehållet stämmer inte.";
      continue;
    }
    if (stabil(lasBlock(db, nyckel)) !== andring.bas) {
      fel[id] = ANDRAD;
      continue;
    }
    skrivningar.push({ key: BLOCK_PREFIX + nyckel, value: stabil(tolkat.data) === stabil(def.standard()) ? null : JSON.stringify(tolkat.data) });
    varden[id] = tolkat.data;
  }

  if (Object.keys(fel).length > 0) {
    const forsta = Object.entries(fel)[0];
    return { error: Object.keys(fel).length === 1 ? `${postEtikett(forsta[0])}: ${forsta[1]}` : "Några ändringar gick inte att spara. Inget har sparats.", fel };
  }

  const skriv = db.prepare(SKRIV);
  const tabort = db.prepare("DELETE FROM settings WHERE key = ?");
  db.transaction(() => {
    for (const s of skrivningar) {
      if (s.value === null) tabort.run(s.key);
      else skriv.run(s.key, s.value);
    }
  })();
  audit(user.id, "update", "innehall", null, [...new Set(andringar.map((a) => postEtikett(a.id)))].join(", ").slice(0, 300));
  revalidateSite();
  return {
    ok: true,
    message: andringar.length === 1 ? "Sparat. Ändringen syns nu för alla." : `Sparat. ${andringar.length} ändringar syns nu för alla.`,
    varden,
  };
}

/** Standardvärdet för ett block, för Återställ i redigeringsläget. Det sparas inte förrän användaren trycker Spara. */
export async function standardInnehall(id: string): Promise<{ varde?: unknown; error?: string }> {
  const user = await actionUser();
  if ("error" in user) return { error: user.error };
  const nyckel = typeof id === "string" ? id.slice(2) : "";
  if (!id.startsWith("b:") || !isBlockNyckel(nyckel)) return { error: "Det finns inget standardinnehåll för den här delen." };
  const behorighet = postBehorighet(id);
  if (!behorighet || !far(user, behorighet)) return { error: "Ditt konto får inte ändra den här delen." };
  return { varde: BLOCK_DEF[nyckel].standard() };
}

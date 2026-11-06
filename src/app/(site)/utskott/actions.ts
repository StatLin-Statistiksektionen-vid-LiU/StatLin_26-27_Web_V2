"use server";

import crypto from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { clientIp, hashedIp, rateLimitHit } from "@/lib/auth/rate-limit";
import { todayLocal } from "@/lib/dates";
import { getDb } from "@/lib/db";
import { WISH_MAX, type WishState } from "@/lib/onskelada";

/*
 * Besökarens önskemål till ett utskott. Som frågelådan: ingen session, ingen audit() och ingen loggning av innehållet. IP-adressen blir
 * bara en HMAC i minnet för spärren (rate-limit.ts) och försvinner när processen startar om.
 */

/** Inskick per utskott och IP på en kvart. */
const SENDS = 30;
/** Tak per utskott, så att spam inte kan fylla disken. */
const CAP = 1000;

const wishSchema = z.object({
  // En textruta skickar radbrytningar som två tecken men räknar dem som ett. Räknaren på sidan ska stämma med gränsen här.
  body: z
    .string()
    .transform((v) => v.replace(/\r\n?/g, "\n").trim())
    .pipe(z.string().min(1, "Skriv ditt önskemål först.").max(WISH_MAX, `Önskemålet får vara högst ${WISH_MAX} tecken.`)),
});

export async function sendWish(_prev: WishState, fd: FormData): Promise<WishState> {
  // Honungsfällan: ett fält som människor aldrig ser. Roboten får ett vanligt svar och inget sparas.
  if (String(fd.get("webbplats") ?? "")) return { ok: true };

  const parsed = wishSchema.safeParse({ body: String(fd.get("body") ?? "") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Skriv ditt önskemål först." };

  const db = getDb();
  const committee = db
    .prepare("SELECT id FROM committees WHERE slug = ? AND visible = 1 AND wishes_open = 1 AND kind != 'styrelse'")
    .get(String(fd.get("utskott") ?? "")) as { id: number } | undefined;
  if (!committee) return { error: "Önskelådan är stängd just nu." };
  const ip = hashedIp(clientIp(await headers()));
  if (rateLimitHit(`onskelada:${committee.id}:${ip}`, SENDS)) return { error: "Du har skickat många önskemål på kort tid. Vänta en kvart och försök igen." };

  try {
    const { n } = db.prepare("SELECT COUNT(*) AS n FROM committee_wishes WHERE committee_id = ?").get(committee.id) as { n: number };
    if (n >= CAP) return { error: "Önskelådan är full just nu. Din text står kvar, försök igen senare." };
    // Id:t slumpas, så att ordningen mellan önskemålen inte går att läsa ur databasen.
    db.prepare("INSERT INTO committee_wishes (id, committee_id, body, month) VALUES (?, ?, ?, ?)").run(
      crypto.randomInt(1, 2 ** 47),
      committee.id,
      parsed.data.body,
      todayLocal().slice(0, 7),
    );
  } catch {
    // Felet skrivs inte ut: det kan bära innehåll, och lådan lovar att inte spara något om den som skrev.
    return { error: "Det gick inte att skicka just nu. Din text står kvar, försök igen om en stund." };
  }
  return { ok: true };
}

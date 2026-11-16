"use server";

import { z } from "zod";
import { zRequired } from "@/lib/admin/form";
import { audit, nowIso } from "@/lib/admin/helpers";
import { isAdmin } from "@/lib/auth/permissions";
import { rateLimitHit } from "@/lib/auth/rate-limit";
import { actionUser } from "@/lib/auth/session";
import { CHAT_BODY_MAX, type ChatMessage } from "@/lib/chatt";
import { chatAuthor, findChannel } from "@/lib/data/chatt";
import { getDb } from "@/lib/db";

/** Så många meddelanden får ett konto skicka på en kvart (fönstret i rateLimitHit). Ett samtal når aldrig dit, ett skript gör det. */
const SENDS_PER_QUARTER = 120;

const NO_ACCESS = { error: "Du är inte med i den tråden." };
const GONE = { error: "Meddelandet finns inte längre." };

const sendSchema = z.object({ channel: z.string(), body: zRequired(CHAT_BODY_MAX, "Meddelandet") });

/**
 * Skickar ett meddelande och svarar med det som det sparades, så att avsändaren ser det direkt. Övriga får det när deras sida
 * frågar efter nytt (GET /api/admin/chatt). Ingen sida renderas om: actionen rör varken cachen eller, annat än när sessionen
 * förlängs, någon kaka.
 */
export async function sendChatMessage(channel: string, body: string): Promise<{ sent: ChatMessage } | { error: string }> {
  const user = await actionUser();
  if ("error" in user) return user;
  const parsed = sendSchema.safeParse({ channel, body });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!(await findChannel(user, parsed.data.channel))) return NO_ACCESS;
  if (rateLimitHit(`chatt:${user.id}`, SENDS_PER_QUARTER)) return { error: "Du har skickat väldigt många meddelanden. Vänta en kvart och försök igen." };
  const created_at = nowIso();
  const res = getDb().prepare("INSERT INTO chat_messages (channel, user_id, body, created_at) VALUES (?, ?, ?, ?)").run(parsed.data.channel, user.id, parsed.data.body, created_at);
  return { sent: { id: Number(res.lastInsertRowid), body: parsed.data.body, created_at, deleted: false, author: await chatAuthor(user) } };
}

/**
 * Tar bort ett meddelande: det egna, eller vilket som helst för en administratör. Texten töms och raden står kvar, så att alla som
 * har kanalen öppen ser att något togs bort. När en administratör tar bort någon annans meddelande står det i revisionsloggen,
 * utan texten.
 */
export async function deleteChatMessage(id: number): Promise<{ ok: true } | { error: string }> {
  const user = await actionUser();
  if ("error" in user) return user;
  if (!Number.isSafeInteger(id)) return GONE;
  const db = getDb();
  const row = db
    .prepare(
      `SELECT m.channel, m.user_id, m.deleted_at, COALESCE(NULLIF(u.post, ''), u.name) AS author
       FROM chat_messages m LEFT JOIN users u ON u.id = m.user_id WHERE m.id = ?`,
    )
    .get(id) as { channel: string; user_id: number | null; deleted_at: string | null; author: string | null } | undefined;
  // Ett meddelande i en kanal som kontot inte läser ska inte gå att skilja från ett som inte finns.
  const channel = row ? await findChannel(user, row.channel) : null;
  if (!row || !channel) return GONE;
  const own = row.user_id === user.id;
  if (!own && !isAdmin(user)) return { error: "Du kan bara ta bort dina egna meddelanden." };
  // Redan borttaget, från en annan flik eller av en administratör: då är det som användaren ville redan gjort.
  if (row.deleted_at === null) {
    db.prepare("UPDATE chat_messages SET body = '', deleted_at = ? WHERE id = ?").run(nowIso(), id);
    if (!own) audit(user.id, "delete", "chat_message", id, `${channel.name}, skrivet av ${row.author ?? "ett borttaget konto"}`);
  }
  return { ok: true };
}

/**
 * Flyttar kontots läsmärke i kanalen fram till ett meddelande. Märket går aldrig bakåt och aldrig förbi det senaste meddelandet.
 * Anropas av sidan själv när ett meddelande visas, så det räknas inte som aktivitet som förlänger sessionen.
 */
export async function markChatRead(channel: string, lastId: number) {
  const user = await actionUser({ renew: false });
  if ("error" in user || typeof channel !== "string" || !Number.isSafeInteger(lastId) || lastId < 1) return;
  if (!(await findChannel(user, channel))) return;
  const db = getDb();
  const newest = (db.prepare("SELECT MAX(id) AS id FROM chat_messages WHERE channel = ?").get(channel) as { id: number | null }).id;
  if (newest === null) return;
  db.prepare(
    `INSERT INTO chat_reads (user_id, channel, last_read_id) VALUES (?, ?, ?)
     ON CONFLICT(user_id, channel) DO UPDATE SET last_read_id = MAX(last_read_id, excluded.last_read_id)`,
  ).run(user.id, channel, Math.min(lastId, newest));
}

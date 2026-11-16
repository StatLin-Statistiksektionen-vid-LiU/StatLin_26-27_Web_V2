import { nowIso } from "@/lib/admin/helpers";
import { json } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";
import type { ChatPage, ChatPoll } from "@/lib/chatt";
import { findChannel, listChannelSummaries, listDeletedSince, listMessages, listMessagesAfter } from "@/lib/data/chatt";

const ID = /^\d{1,15}$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const invalid = () => json({ error: "Frågan gick inte att tolka." }, 400);

/**
 * Det chatten hämtar medan den är öppen. Utan kanal: listan med kontots trådar och antalet olästa, som sidomenyn frågar efter. Med
 * kanal och efter och sedan: det som skrivits efter ett meddelande och det som tagits bort sedan förra frågan. Med fore: en sida
 * äldre meddelanden. Kontot får trådarna i planerna det är med i (listChannelSummaries), och en annan tråd nekas.
 *
 * Sessionen förlängs inte här, till skillnad från redigeringspanelens rutt: frågan ställs av sidan själv var fjärde sekund, och en
 * flik som står öppen ska inte hålla en inloggning vid liv. Att skicka ett meddelande räknas som aktivitet (sendChatMessage).
 */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return json({ error: "Du är inte inloggad." }, 401);
  if (user.must_change_password) return json({ error: "Byt ditt tillfälliga lösenord i adminpanelen först." }, 403);

  // Tiden läses före meddelandena: det som tas bort medan svaret byggs kommer då med i nästa fråga i stället för att falla mellan två.
  const now = nowIso();
  const channels = await listChannelSummaries(user);
  const params = new URL(request.url).searchParams;
  const key = params.get("kanal");
  if (key === null) return json({ channels });
  // En administratör får öppna en tråd utan att vara med i planen. Den står då inte i listan och prövas för sig (findChannel).
  if (!channels.some((c) => c.key === key) && !(await findChannel(user, key))) return json({ error: "Du är inte med i den tråden." }, 403);

  const before = params.get("fore");
  if (before !== null) {
    if (!ID.test(before)) return invalid();
    return json((await listMessages(key, Number(before))) satisfies ChatPage);
  }

  const after = params.get("efter") ?? "";
  const since = params.get("sedan") ?? "";
  if (!ID.test(after) || !TIMESTAMP.test(since)) return invalid();
  const [messages, deleted] = await Promise.all([listMessagesAfter(key, Number(after)), listDeletedSince(key, since)]);
  return json({ channels, messages, deleted, now } satisfies ChatPoll);
}

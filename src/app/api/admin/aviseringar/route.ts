import { json } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";
import { listAviseringar } from "@/lib/data/aviseringar";

/**
 * Kontots aviseringar, för klockan i portalens meny. Menyn ligger i skalet, som inte renderas om när man byter sida, så klockan frågar
 * själv: när den öppnas, när man byter sida och när antalet olästa i chatten ändras. Sessionen förlängs inte här, som i chattens rutt.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return json({ error: "Du är inte inloggad." }, 401);
  if (user.must_change_password) return json({ error: "Byt ditt tillfälliga lösenord i adminpanelen först." }, 403);
  return json({ aviseringar: await listAviseringar(user) });
}

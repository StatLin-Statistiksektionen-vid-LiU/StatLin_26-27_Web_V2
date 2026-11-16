import { revalidatePath } from "next/cache";
import { audit } from "@/lib/admin/helpers";
import { isSameOriginRequest } from "@/lib/allowed-origins";
import { json } from "@/lib/api";
import { canEditImages } from "@/lib/auth/permissions";
import { getSessionUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { MediaError, isImageUpload, storeImage } from "@/lib/media-store";
import { toImageRef } from "@/lib/media-url";

/**
 * Uppladdning av bilder från adminpanelen. Dokument och hjälpmedel skickas med sina formulär och sparas av actionen.
 * purpose = "image"   → fristående bild (omslag, porträtt, logga); kopplas när formuläret sparas
 *         = "gallery" → bild som läggs direkt i ett evenemangs galleri (kräver eventId; eget utskott eller grafiskt ansvar)
 */
export async function POST(request: Request) {
  // CSRF-skydd utöver SameSite-cookien: kräv samma ursprung – också när Origin saknas.
  if (!isSameOriginRequest(request.headers)) return json({ error: "Otillåtet ursprung." }, 403);

  const user = await getSessionUser();
  if (!user) return json({ error: "Du är inte inloggad." }, 401);
  if (user.must_change_password) return json({ error: "Byt ditt tillfälliga lösenord innan du laddar upp filer." }, 403);

  let fd: FormData;
  try {
    fd = await request.formData();
  } catch {
    return json({ error: "Ogiltig uppladdning." }, 400);
  }
  const file = fd.get("file");
  const purpose = String(fd.get("purpose") ?? "image");
  if (!(file instanceof File) || file.size === 0) return json({ error: "Ingen fil skickades." }, 400);

  try {
    if (!isImageUpload(file)) return json({ error: "Filen måste vara en bild (JPG, PNG, WebP, GIF eller AVIF)." }, 415);

    if (purpose === "gallery") {
      const eventId = Number(fd.get("eventId"));
      const db = getDb();
      const event = db.prepare("SELECT id, committee_id, title FROM events WHERE id = ?").get(eventId) as
        | { id: number; committee_id: number | null; title: string }
        | undefined;
      if (!event) return json({ error: "Evenemanget finns inte." }, 404);
      if (!canEditImages(user, event)) return json({ error: "Du får inte ladda upp bilder till det här evenemanget." }, 403);

      const media = await storeImage(file, user.id);
      const next = (db.prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM event_images WHERE event_id = ?").get(eventId) as { n: number }).n;
      const res = db
        .prepare("INSERT INTO event_images (event_id, media_id, caption, sort_order, uploaded_by) VALUES (?, ?, '', ?, ?)")
        .run(eventId, media.id, next, user.id);
      audit(user.id, "upload", "event_image", Number(res.lastInsertRowid), event.title);
      revalidatePath("/", "layout");
      return json({ id: Number(res.lastInsertRowid), caption: "", image: toImageRef(media) });
    }

    const media = await storeImage(file, user.id, String(fd.get("alt") ?? ""));
    return json({ id: media.id, image: toImageRef(media) });
  } catch (err) {
    if (err instanceof MediaError) return json({ error: err.message }, 400);
    console.error("Uppladdning misslyckades", err);
    return json({ error: "Uppladdningen misslyckades. Försök igen." }, 500);
  }
}

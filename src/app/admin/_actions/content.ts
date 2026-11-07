"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  FILE_AND_REMOVE,
  type FormState,
  formObject,
  formVersion,
  invalid,
  STALE,
  zCheckbox,
  zOptionalEmail,
  zOptionalId,
  zOrder,
  zRequired,
  zText,
  zUrl,
} from "@/lib/admin/form";
import { audit, canUseImage, forbidden, nowIso, revalidateSite } from "@/lib/admin/helpers";
import { TEXT_LIMITS } from "@/lib/admin/limits";
import { canEditCommittee, canEditImages, canManageDocument, canManageDocuments, canManageSettings, isEditor } from "@/lib/auth/permissions";
import { canManageNaringsliv } from "@/lib/data/naringsliv";
import { actionUser, renewSessionIfDue } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { markSeeded } from "@/lib/db/bootstrap";
import { DEFAULT_SETTINGS } from "@/lib/data/content";
import { SITE_TEXT_KEYS, textDef, type SiteTextKey } from "@/lib/site-texts";
import { deleteMediaIfUnused, isSameUpload, MediaError, replaceFile, storeFile } from "@/lib/media-store";
import { renderMarkdown } from "@/lib/markdown";
import { toImageRef } from "@/lib/media-url";
import { DOCUMENT_CATEGORY_VALUES, type DocumentCategory, type Media } from "@/lib/types";


/* ---------- Markdown-förhandsvisning ---------- */

export async function previewMarkdown(md: string): Promise<string> {
  const user = await actionUser({ renew: false });
  if ("error" in user) return `<p>${user.error}</p>`;
  return renderMarkdown(md.slice(0, TEXT_LIMITS.page));
}

/* ---------- Styrelsen ---------- */

const boardSchema = z.object({
  post: zRequired(80, "Posten"),
  name: zText(120, "Namnet"),
  email: zOptionalEmail,
  bio: zText(400, "Beskrivningen"),
  photo_media_id: zOptionalId,
  committee_id: zOptionalId,
  sort_order: zOrder,
});

export async function saveBoardMember(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await actionUser();
  if ("error" in user) return user;
  if (!isEditor(user)) return forbidden();
  const id = Number(fd.get("id")) || null;
  const parsed = boardSchema.safeParse(formObject(fd));
  if (!parsed.success) return invalid(parsed.error);
  const db = getDb();
  if (id) {
    const old = db.prepare("SELECT photo_media_id, sort_order FROM board_members WHERE id = ?").get(id) as { photo_media_id: number | null; sort_order: number } | undefined;
    if (!old) return { error: "Posten finns inte längre." };
    db.prepare(
      `UPDATE board_members SET post=@post, name=@name, email=@email, bio=@bio, photo_media_id=@photo_media_id,
        committee_id=@committee_id, sort_order=@sort_order WHERE id=@id`,
    ).run({ ...parsed.data, sort_order: parsed.data.sort_order ?? old.sort_order, id });
    if (old.photo_media_id !== parsed.data.photo_media_id) await deleteMediaIfUnused(old.photo_media_id);
    audit(user.id, "update", "board", id, parsed.data.post);
    revalidateSite();
    return { ok: true, message: "Posten är sparad." };
  }
  const res = db
    .prepare(
      `INSERT INTO board_members (post, name, email, bio, photo_media_id, committee_id, sort_order)
       VALUES (@post, @name, @email, @bio, @photo_media_id, @committee_id, @sort_order)`,
    )
    .run({ ...parsed.data, sort_order: parsed.data.sort_order ?? 0 });
  audit(user.id, "create", "board", Number(res.lastInsertRowid), parsed.data.post);
  revalidateSite();
  redirect("/admin/styrelsen?sparad=1");
}

export async function deleteBoardMember(fd: FormData): Promise<FormState> {
  // Felsvaren visas i bekräftelsen, så sessionen förlängs först när raderingen gått igenom (se deleteTask).
  const user = await actionUser({ renew: false });
  if ("error" in user) return user;
  if (!isEditor(user)) return forbidden();
  const id = Number(fd.get("id"));
  const db = getDb();
  const row = db.prepare("SELECT post, photo_media_id FROM board_members WHERE id = ?").get(id) as { post: string; photo_media_id: number | null } | undefined;
  if (row) {
    db.prepare("DELETE FROM board_members WHERE id = ?").run(id);
    // En styrelse som tömts inför ett nytt verksamhetsår ska inte få grundposterna tillbaka vid nästa start (SD-17).
    markSeeded(db, "board_members");
    await deleteMediaIfUnused(row.photo_media_id);
    audit(user.id, "delete", "board", id, row.post);
    await renewSessionIfDue();
    revalidateSite();
  }
  redirect("/admin/styrelsen?raderad=1");
}

export async function moveBoardMember(id: number, direction: -1 | 1) {
  const user = await actionUser();
  if ("error" in user) return user;
  if (!isEditor(user)) throw new Error("Saknar behörighet.");
  const db = getDb();
  const rows = db.prepare("SELECT id FROM board_members ORDER BY sort_order, id").all() as { id: number }[];
  const idx = rows.findIndex((r) => r.id === id);
  const swap = idx + direction;
  if (idx < 0 || swap < 0 || swap >= rows.length) return;
  [rows[idx], rows[swap]] = [rows[swap], rows[idx]];
  const stmt = db.prepare("UPDATE board_members SET sort_order = ? WHERE id = ?");
  db.transaction(() => rows.forEach((r, i) => stmt.run(i * 10, r.id)))();
  revalidateSite();
}

/* ---------- Utskott ---------- */

/** Sajtens egna loggor (public/brand/…), som utskotten har från början. Inga "..": adressen ska stanna under /brand/. */
const BRAND_LOGO = /^\/brand\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.(?:svg|png|webp)$/;

/** Mediaraden som en logga pekar på. Loggan sparas som adress (ST-01), så raden hittas baklänges ur /media/-adressen. */
function logoMediaId(url: string | null): number | undefined {
  if (!url?.startsWith("/media/")) return undefined;
  return (getDb().prepare("SELECT id FROM media WHERE ? LIKE '/media/' || path_base || '-%'").get(url) as { id: number } | undefined)?.id;
}

const committeeSchema = z.object({
  name: zRequired(120, "Namnet"),
  short_name: zRequired(30, "Förkortningen"),
  tagline: zText(200, "Slogan"),
  description_md: zText(TEXT_LIMITS.committee, "Beskrivningen"),
  logo_media_id: zOptionalId,
  // Finns inte i formuläret (SD-10). Skickas den ändå godtas bara en av sajtens egna loggor, eller adressen som redan står.
  logo_url: zText(300),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Ange en färg som #RRGGBB.").default("#ff0707"),
  email: zOptionalEmail,
  instagram: zUrl,
  visible: zCheckbox,
  sort_order: zOrder,
});

export async function saveCommittee(_prev: FormState, fd: FormData): Promise<FormState> {
  // Sessionen förlängs först när sparningen gått igenom (renewSessionIfDue nedan): kakan renderar om sidan.
  const user = await actionUser({ renew: false });
  if ("error" in user) return user;
  const id = Number(fd.get("id"));
  if (!id || !canEditCommittee(user, id)) return forbidden();
  const parsed = committeeSchema.safeParse(formObject(fd));
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  const db = getDb();
  const current = db.prepare("SELECT logo_url, visible, sort_order FROM committees WHERE id = ?").get(id) as
    | { logo_url: string | null; visible: number; sort_order: number }
    | undefined;
  if (!current) return { error: "Utskottet finns inte längre." };
  // Loggan (SD-10) sätts bara på servern: ur en uppladdad bild som kontot får använda (canUseImage – för ett utskottskonto
  // bara egna uppladdningar), eller till en av sajtens loggor under /brand/. En extern adress eller någon annans
  // /media/-bild nekas – annars blev den utskottets logga, och raderades när loggan byttes nästa gång.
  if (d.logo_url && d.logo_url !== current.logo_url && !BRAND_LOGO.test(d.logo_url)) {
    return { error: "Loggan kan bara bytas genom att ladda upp en bild." };
  }
  let logoUrl = d.logo_url || current.logo_url;
  if (d.logo_media_id) {
    const m = canUseImage(user, d.logo_media_id) ? (db.prepare("SELECT * FROM media WHERE id = ?").get(d.logo_media_id) as Media | undefined) : undefined;
    const src = toImageRef(m)?.src;
    if (!src) return { error: "Du kan bara använda en bild som du själv har laddat upp som logga." };
    logoUrl = src;
  }
  // Utskottskonton får inte dölja sitt utskott eller ändra sorteringen.
  const extra = isEditor(user) ? { visible: d.visible, sort_order: d.sort_order ?? current.sort_order } : { visible: current.visible, sort_order: current.sort_order };
  // Bara om utskottet inte sparats sedan formuläret laddades – annars skrev en gammal flik över en nyare version.
  const updatedAt = nowIso();
  const res = db.prepare(
    `UPDATE committees SET name=@name, short_name=@short_name, tagline=@tagline, description_md=@description_md, logo_url=@logo_url,
      accent=@accent, email=@email, instagram=@instagram, visible=@visible, sort_order=@sort_order, updated_at=@updated_at
     WHERE id=@id AND updated_at=@version`,
  ).run({ ...d, ...extra, logo_url: logoUrl, updated_at: updatedAt, id, version: formVersion(fd) });
  if (res.changes === 0) return STALE;
  // Den tidigare loggan raderas bara om inget annat använder den (deleteMediaIfUnused).
  if (logoUrl !== current.logo_url) await deleteMediaIfUnused(logoMediaId(current.logo_url));
  audit(user.id, "update", "committee", id, d.short_name);
  await renewSessionIfDue();
  revalidateSite();
  return { ok: true, message: "Utskottet är sparat.", data: { updated_at: updatedAt } };
}

/** Bara loggan, från sidan Bilder – även för grafiskt ansvarig, på alla utskott. */
export async function setCommitteeLogo(committeeId: number, mediaId: number | null) {
  const user = await actionUser();
  // Felet går tillbaka till loggans fält, som annars visade "Sparat" fast inget sparats.
  if ("error" in user) return user;
  const db = getDb();
  const committee = db.prepare("SELECT id, short_name, logo_url FROM committees WHERE id = ?").get(committeeId) as
    | { id: number; short_name: string; logo_url: string | null }
    | undefined;
  if (!committee || !canEditImages(user, { committee_id: committee.id }) || !canUseImage(user, mediaId)) throw new Error("Saknar behörighet.");
  const media = mediaId ? (db.prepare("SELECT * FROM media WHERE id = ?").get(mediaId) as Media | undefined) : undefined;
  const logoUrl = toImageRef(media)?.src ?? null;
  if (logoUrl === committee.logo_url) return;
  // Loggan sparas som adress. En uppladdad logga som ersätts tas bort om inget annat använder den.
  const old = logoMediaId(committee.logo_url);
  db.prepare("UPDATE committees SET logo_url = ?, updated_at = ? WHERE id = ?").run(logoUrl, nowIso(), committeeId);
  await deleteMediaIfUnused(old);
  audit(user.id, "logo", "committee", committeeId, committee.short_name);
  revalidateSite();
}

/* ---------- Sidor ---------- */

export async function savePage(_prev: FormState, fd: FormData): Promise<FormState> {
  // Sessionen förlängs först när sparningen gått igenom (renewSessionIfDue nedan): kakan renderar om sidan.
  const user = await actionUser({ renew: false });
  if ("error" in user) return user;
  if (!isEditor(user)) return forbidden();
  const parsed = z
    .object({ slug: z.string(), title: zRequired(120, "Titeln"), lead: zText(500, "Ingressen"), body_md: zText(TEXT_LIMITS.page, "Texten") })
    .safeParse(formObject(fd));
  if (!parsed.success) return invalid(parsed.error);
  // Bara om sidan inte sparats sedan formuläret laddades – annars skrev en gammal flik över en nyare version.
  const updatedAt = nowIso();
  const res = getDb()
    .prepare("UPDATE pages SET title=@title, lead=@lead, body_md=@body_md, updated_at=@updated_at, updated_by=@updated_by WHERE slug=@slug AND updated_at=@version")
    .run({ ...parsed.data, updated_at: updatedAt, updated_by: user.id, version: formVersion(fd) });
  if (res.changes === 0) return getDb().prepare("SELECT 1 FROM pages WHERE slug = ?").get(parsed.data.slug) ? STALE : { error: "Sidan finns inte." };
  audit(user.id, "update", "page", parsed.data.slug, parsed.data.title);
  await renewSessionIfDue();
  revalidateSite();
  return { ok: true, message: "Sidan är sparad och publicerad.", data: { updated_at: updatedAt } };
}

/* ---------- Dokument ---------- */

const docSchema = z.object({
  title: zRequired(160, "Titeln"),
  category: z.enum(DOCUMENT_CATEGORY_VALUES),
  description: zText(300, "Beskrivningen"),
  url: zUrl,
  doc_date: z
    .string()
    .optional()
    .transform((v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)),
  published: zCheckbox,
});

export async function saveDocument(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await actionUser();
  if ("error" in user) return user;
  if (!canManageDocuments(user)) return forbidden();
  const id = Number(fd.get("id")) || null;
  const parsed = docSchema.safeParse(formObject(fd));
  if (!parsed.success) return invalid(parsed.error);
  // Grafiskt ansvarig lägger bara upp grafiskt material, vad formuläret än skickar.
  const d = isEditor(user) ? parsed.data : { ...parsed.data, category: "grafiskt" as const };
  const db = getDb();
  const old = id
    ? (db.prepare("SELECT media_id, category FROM documents WHERE id = ?").get(id) as { media_id: number | null; category: DocumentCategory } | undefined)
    : undefined;
  if (id && !old) return { error: "Dokumentet finns inte längre." };
  if (old && !canManageDocument(user, old.category)) return forbidden();

  let mediaId: number | null = null;
  const file = fd.get("file");
  const remove = fd.get("remove_file") === "on";
  const current = old?.media_id ? (db.prepare("SELECT * FROM media WHERE id = ?").get(old.media_id) as Media | undefined) : undefined;
  // Samma fil som redan finns laddas inte upp igen (SD-35) – den kan stå kvar i fältet om något ändrades under förra
  // sparningen. Med "Ta bort filen" betyder den då "ta bort"; bara en ny fil och rutan säger emot varandra.
  const upload = file instanceof File && file.size > 0 && !(current && isSameUpload(current, file)) ? file : null;
  if (upload && remove) return FILE_AND_REMOVE;
  const kept = old && !remove ? old.media_id : null;
  // Varje rad på sidan ska leda någonstans, även efter en ändring.
  if (!upload && !kept && !d.url) return { error: "Ladda upp en fil eller ange en länk.", fieldErrors: { file: "Välj en fil eller ange en länk." } };
  if (upload) {
    try {
      // En ny version med samma filändelse behåller adressen (SD-35).
      mediaId = (current ? await replaceFile(current, upload, user.id) : await storeFile(upload, user.id)).id;
    } catch (err) {
      return { error: err instanceof MediaError ? err.message : "Filen kunde inte sparas.", fieldErrors: { file: "Kontrollera filen." } };
    }
  }

  if (id && old) {
    const nextMedia = mediaId ?? kept;
    db.prepare(
      "UPDATE documents SET title=@title, category=@category, description=@description, url=@url, doc_date=@doc_date, published=@published, media_id=@media_id WHERE id=@id",
    ).run({ ...d, media_id: nextMedia, id });
    if (old.media_id !== nextMedia) await deleteMediaIfUnused(old.media_id);
    audit(user.id, "update", "document", id, d.title);
    revalidateSite();
    return { ok: true, message: "Dokumentet är sparat." };
  }

  db.prepare(
    "INSERT INTO documents (title, category, description, url, doc_date, published, media_id) VALUES (@title, @category, @description, @url, @doc_date, @published, @media_id)",
  ).run({ ...d, media_id: mediaId });
  audit(user.id, "create", "document", null, d.title);
  revalidateSite();
  redirect("/admin/dokument?sparad=1");
}

export async function deleteDocument(fd: FormData): Promise<FormState> {
  const user = await actionUser({ renew: false });
  if ("error" in user) return user;
  if (!canManageDocuments(user)) return forbidden();
  const id = Number(fd.get("id"));
  const db = getDb();
  const row = db.prepare("SELECT title, media_id, category FROM documents WHERE id = ?").get(id) as
    | { title: string; media_id: number | null; category: DocumentCategory }
    | undefined;
  if (row && !canManageDocument(user, row.category)) return forbidden();
  if (row) {
    db.prepare("DELETE FROM documents WHERE id = ?").run(id);
    markSeeded(db, "documents"); // SD-17: tömda dokument fylls inte på igen vid nästa start
    await deleteMediaIfUnused(row.media_id);
    audit(user.id, "delete", "document", id, row.title);
    await renewSessionIfDue();
    revalidateSite();
  }
  redirect("/admin/dokument?raderad=1");
}

/* ---------- Partners ---------- */

const partnerSchema = z.object({
  name: zRequired(120, "Namnet"),
  url: zUrl,
  description: zText(300),
  logo_media_id: zOptionalId,
  tier: z.enum(["huvudpartner", "partner"]).default("partner"),
  sort_order: zOrder,
  active: zCheckbox,
});

/** Sponsorerna sköts av admin, redaktörerna och SASU, som har kontakten med företagen. */
export async function savePartner(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await actionUser();
  if ("error" in user) return user;
  if (!canManageNaringsliv(user)) return forbidden();
  const id = Number(fd.get("id")) || null;
  const parsed = partnerSchema.safeParse(formObject(fd));
  if (!parsed.success) return invalid(parsed.error);
  const db = getDb();
  if (id) {
    const old = db.prepare("SELECT logo_media_id, sort_order FROM partners WHERE id = ?").get(id) as { logo_media_id: number | null; sort_order: number } | undefined;
    if (!old) return { error: "Sponsorn finns inte längre." };
    db.prepare(
      "UPDATE partners SET name=@name, url=@url, description=@description, logo_media_id=@logo_media_id, tier=@tier, sort_order=@sort_order, active=@active WHERE id=@id",
    ).run({ ...parsed.data, sort_order: parsed.data.sort_order ?? old.sort_order, id });
    if (old.logo_media_id !== parsed.data.logo_media_id) await deleteMediaIfUnused(old.logo_media_id);
    audit(user.id, "update", "partner", id, parsed.data.name);
    revalidateSite();
    return { ok: true, message: "Sponsorn är sparad." };
  }
  db.prepare(
    "INSERT INTO partners (name, url, description, logo_media_id, tier, sort_order, active) VALUES (@name, @url, @description, @logo_media_id, @tier, @sort_order, @active)",
  ).run({ ...parsed.data, sort_order: parsed.data.sort_order ?? 0 });
  audit(user.id, "create", "partner", null, parsed.data.name);
  revalidateSite();
  redirect("/admin/partners?sparad=1");
}

export async function deletePartner(fd: FormData): Promise<FormState> {
  const user = await actionUser({ renew: false });
  if ("error" in user) return user;
  if (!canManageNaringsliv(user)) return forbidden();
  const id = Number(fd.get("id"));
  const db = getDb();
  const row = db.prepare("SELECT name, logo_media_id FROM partners WHERE id = ?").get(id) as { name: string; logo_media_id: number | null } | undefined;
  if (row) {
    db.prepare("DELETE FROM partners WHERE id = ?").run(id);
    await deleteMediaIfUnused(row.logo_media_id);
    audit(user.id, "delete", "partner", id, row.name);
    await renewSessionIfDue();
    revalidateSite();
  }
  redirect("/admin/partners?raderad=1");
}

/**
 * Pilarna under Sponsorer: sponsorn byter plats med grannen på samma ställe på sajten, vid sidan eller i sidfoten.
 * Hela gruppen numreras om, så att lika tal i Plats i listan inte står i vägen.
 */
export async function movePartner(id: number, direction: -1 | 1): Promise<{ error: string } | undefined> {
  const user = await actionUser();
  if ("error" in user) return user;
  if (!canManageNaringsliv(user)) return { error: "Du har inte behörighet att ändra sponsorerna." };
  const db = getDb();
  const row = db.prepare("SELECT tier FROM partners WHERE id = ?").get(id) as { tier: string } | undefined;
  if (!row) return { error: "Sponsorn finns inte längre. Ladda om sidan." };
  const rows = db.prepare("SELECT id FROM partners WHERE tier = ? ORDER BY sort_order, name").all(row.tier) as { id: number }[];
  const idx = rows.findIndex((r) => r.id === id);
  const swap = idx + direction;
  if (idx < 0 || swap < 0 || swap >= rows.length) return;
  [rows[idx], rows[swap]] = [rows[swap], rows[idx]];
  const stmt = db.prepare("UPDATE partners SET sort_order = ? WHERE id = ?");
  db.transaction(() => rows.forEach((r, i) => stmt.run((i + 1) * 10, r.id)))();
  revalidateSite();
}

/* ---------- Inställningar ---------- */

/** Sajtens fasta texter, se site-texts.ts. Ett tomt fält ger standardtexten på sajten. */
const siteTextSchema = Object.fromEntries(SITE_TEXT_KEYS.map((k) => [k, zText(textDef(k).max, textDef(k).label)])) as Record<SiteTextKey, ReturnType<typeof zText>>;

const settingsSchema = z.object({
  contact_email: z.string().trim().toLowerCase().email("Ange en giltig e-postadress."),
  instagram: zUrl,
  facebook: zUrl,
  linkedin: zUrl,
  address: zText(200),
  sektionsrum: zText(200),
  org_number: zText(40),
  tagline: zText(200),
  footer_slogan: zText(120, "Sloganen"),
  hero_kicker: zText(80, "Kickern"),
  hero_title: zRequired(140, "Rubriken"),
  hero_text: zText(300, "Underrubriken"),
  hero_ring_color: z.enum(["red", "white"], "Välj röd eller vit."),
  hero_formulas: z.enum(["pa", "av"], "Välj på eller av."),
  band_color: z.enum(["vit", "rod", "natt"], "Välj en av färgerna."),
  tema_dator: z.enum(["mork", "ljust"], "Välj mörkt eller ljust."),
  tema_telefon: z.enum(["mork", "ljust"], "Välj mörkt eller ljust."),
  home_intro: zRequired(400, "Texten"),
  announcement: zText(200),
  announcement_url: zUrl,
  education_committee_id: z.string().regex(/^\d*$/, "Välj ett utskott i listan."),
  ...siteTextSchema,
});

/** Sparar bara fälten som finns i formuläret, så att delformulär (t.ex. bara startsidan) inte tömmer resten. */
export async function saveSettings(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await actionUser();
  if ("error" in user) return user;
  if (!canManageSettings(user)) return forbidden();
  const raw = formObject(fd);
  type Key = keyof typeof settingsSchema.shape;
  const present = Object.keys(settingsSchema.shape).filter((k) => k in raw) as Key[];
  if (present.length === 0) return { error: "Inget att spara." };
  const mask = Object.fromEntries(present.map((k) => [k, true])) as { [K in Key]?: true };
  const parsed = settingsSchema.pick(mask).safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const db = getDb();
  const stmt = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
  db.transaction(() => {
    for (const [k, v] of Object.entries(parsed.data)) if (k in DEFAULT_SETTINGS) stmt.run(k, v);
  })();
  audit(user.id, "update", "settings", null, present.some((k) => k.startsWith("hero_") || k === "home_intro") ? "Startsidan" : present.some((k) => k.startsWith("text_")) ? "Texter på sajten" : "Webbplatsinställningar");
  revalidateSite();
  return { ok: true, message: "Inställningarna är sparade." };
}

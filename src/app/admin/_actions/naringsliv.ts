"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type FormState, formObject, invalid, zCheckbox, zOptionalId, zRequired, zText, zUrl } from "@/lib/admin/form";
import { audit, canUseImage, forbidden, revalidateSite } from "@/lib/admin/helpers";
import { actionUser } from "@/lib/auth/session";
import { getCommitteeBySlug, getSettings } from "@/lib/data/content";
import { canManageNaringsliv } from "@/lib/data/naringsliv";
import { getDb } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { deleteMediaIfUnused } from "@/lib/media-store";
import { siteUrl } from "@/lib/site-url";
import { intresseMejl, type StarIntresse } from "@/lib/star-intresse";
import { COMPANY_ROLES, SEEK_KINDS, WISH_COMMENT_MAX, WISH_STATUSES, WISH_STATUS_LABELS, WISH_TITLE_MAX, type WishStatus } from "@/lib/naringsliv";

/* ---------- STAR-företagen ---------- */

const companySchema = z.object({
  name: zRequired(120, "Namnet"),
  url: zUrl,
  description: zText(300, "Texten"),
  logo_media_id: zOptionalId,
  role: z.enum(COMPANY_ROLES).default("utstallare"),
  sort_order: z.coerce.number().int().min(0).max(9999).default(0),
  active: zCheckbox,
});

export async function saveStarCompany(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await actionUser();
  if ("error" in user) return user;
  if (!canManageNaringsliv(user)) return forbidden();
  const id = Number(fd.get("id")) || null;
  const parsed = companySchema.safeParse(formObject(fd));
  if (!parsed.success) return invalid(parsed.error);
  // Flera kryssrutor med samma namn: formObject behåller bara den sista.
  const chosen = new Set(fd.getAll("seeks"));
  const values = { ...parsed.data, seeks: SEEK_KINDS.filter((k) => chosen.has(k)).join(" ") };
  const db = getDb();
  if (id) {
    const old = db.prepare("SELECT logo_media_id FROM star_companies WHERE id = ?").get(id) as { logo_media_id: number | null } | undefined;
    if (!old) return { error: "Företaget finns inte längre." };
    if (old.logo_media_id !== values.logo_media_id && !canUseImage(user, values.logo_media_id)) return forbidden();
    db.prepare(
      "UPDATE star_companies SET name=@name, url=@url, description=@description, logo_media_id=@logo_media_id, seeks=@seeks, role=@role, sort_order=@sort_order, active=@active WHERE id=@id",
    ).run({ ...values, id });
    if (old.logo_media_id !== values.logo_media_id) await deleteMediaIfUnused(old.logo_media_id);
    audit(user.id, "update", "star_company", id, values.name);
    revalidateSite();
    return { ok: true, message: "Företaget är sparat." };
  }
  if (!canUseImage(user, values.logo_media_id)) return forbidden();
  const res = db
    .prepare("INSERT INTO star_companies (name, url, description, logo_media_id, seeks, role, sort_order, active) VALUES (@name, @url, @description, @logo_media_id, @seeks, @role, @sort_order, @active)")
    .run(values);
  audit(user.id, "create", "star_company", Number(res.lastInsertRowid), values.name);
  revalidateSite();
  redirect("/admin/star?sparad=1");
}

export async function deleteStarCompany(fd: FormData): Promise<FormState | void> {
  const user = await actionUser();
  if ("error" in user) return user;
  if (!canManageNaringsliv(user)) return forbidden();
  const id = Number(fd.get("id"));
  const db = getDb();
  const row = db.prepare("SELECT name, logo_media_id FROM star_companies WHERE id = ?").get(id) as { name: string; logo_media_id: number | null } | undefined;
  if (row) {
    db.prepare("DELETE FROM star_companies WHERE id = ?").run(id);
    await deleteMediaIfUnused(row.logo_media_id);
    audit(user.id, "delete", "star_company", id, row.name);
    revalidateSite();
  }
  redirect("/admin/star?raderad=1");
}

/* ---------- STAR-sidan ---------- */

const SAVE_SETTING = "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value";

const starPageSchema = z.object({
  star_event_id: z.string().regex(/^\d*$/, "Välj ett evenemang i listan."),
  star_subtitle: zText(120, "Underrubriken"),
  star_intro: zText(600, "Introduktionen"),
  star_companies_intro: zText(400, "Texten över företagen"),
  star_sponsors_intro: zText(300, "Texten över sponsorerna"),
  star_tips: zText(1500, "Tipsen"),
  star_faq: zText(4000, "Frågorna"),
  star_student_title: zText(120, "Rubriken"),
  star_student_text: zText(500, "Texten"),
  star_company_title: zText(120, "Rubriken"),
  star_company_text: zText(500, "Texten"),
  star_teaser: zText(500, "Texten"),
});

/** Bara de här nycklarna: resten av inställningarna kräver fortfarande en administratör, se saveSettings. */
export async function saveStarPage(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await actionUser();
  if ("error" in user) return user;
  if (!canManageNaringsliv(user)) return forbidden();
  const parsed = starPageSchema.safeParse(formObject(fd));
  if (!parsed.success) return invalid(parsed.error);
  const db = getDb();
  const save = db.prepare(SAVE_SETTING);
  db.transaction(() => {
    for (const [key, value] of Object.entries(parsed.data)) save.run(key, value);
  })();
  audit(user.id, "update", "star_page", null, "STAR-sidans texter");
  revalidateSite();
  return { ok: true, message: "Texterna är sparade." };
}

/** Knappen som gör sidan live eller döljer den. Den fungerar utan JavaScript och visas bara för dem som får trycka, så ett nekat anrop får inget besked. */
export async function setStarLive(fd: FormData): Promise<void> {
  const user = await actionUser();
  if ("error" in user || !canManageNaringsliv(user)) return;
  const live = fd.get("live") === "1";
  getDb().prepare(SAVE_SETTING).run("star_live", live ? "1" : "");
  audit(user.id, "update", "star_page", null, live ? "STAR-sidan är live" : "STAR-sidan är dold");
  revalidateSite();
}

/* ---------- Lunchönskemålen ---------- */

const wishSchema = z.object({
  title: zRequired(WISH_TITLE_MAX, "Önskemålet"),
  comment: zText(WISH_COMMENT_MAX, "Kommentaren"),
  status: z.enum(WISH_STATUSES),
  event_id: zOptionalId,
});

export async function saveWish(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await actionUser();
  if ("error" in user) return user;
  if (!canManageNaringsliv(user)) return forbidden();
  const id = Number(fd.get("id"));
  const parsed = wishSchema.safeParse(formObject(fd));
  if (!parsed.success) return invalid(parsed.error);
  const db = getDb();
  if (parsed.data.event_id !== null && !db.prepare("SELECT 1 FROM events WHERE id = ?").get(parsed.data.event_id)) {
    return { error: "Evenemanget finns inte längre." };
  }
  const res = db.prepare("UPDATE lecture_wishes SET title=@title, comment=@comment, status=@status, event_id=@event_id WHERE id=@id").run({ ...parsed.data, id });
  if (res.changes === 0) return { error: "Önskemålet finns inte längre." };
  audit(user.id, "update", "lecture_wish", id, parsed.data.title);
  revalidateSite();
  return { ok: true, message: "Önskemålet är sparat." };
}

const INTEREST_PAGE = "/admin/intresseanmalningar";
/** Siffran för nya anmälningar står i sidomenyn, som en omdirigering annars inte renderar om. */
const revalidateInterest = () => revalidatePath("/admin", "layout");

/** Intresseanmälan till STAR: markera som hanterad eller flytta tillbaka, och samma flik öppnas igen. */
export async function setInterestStatus(fd: FormData): Promise<void> {
  const user = await actionUser();
  if ("error" in user) redirect(`/logga-in?next=${INTEREST_PAGE}`);
  if (!canManageNaringsliv(user)) redirect("/admin?nekad=1");
  const id = Number(fd.get("id"));
  const status = String(fd.get("status")) === "hanterad" ? "hanterad" : "ny";
  const row = getDb().prepare("UPDATE star_intresse SET status = ? WHERE id = ? RETURNING foretag").get(status, id) as { foretag: string } | undefined;
  if (row) {
    audit(user.id, "status", "star_intresse", id, `${row.foretag}: ${status}`);
    revalidateInterest();
  }
  // Knappen stod under den andra fliken: Markera som hanterad under Nya, Flytta till nya under Hanterade.
  redirect(`${INTEREST_PAGE}?flik=${status === "hanterad" ? "nya" : "hanterade"}&klar=${status}`);
}

export async function deleteInterest(fd: FormData): Promise<FormState | void> {
  const user = await actionUser();
  if ("error" in user) return user;
  if (!canManageNaringsliv(user)) return forbidden();
  const id = Number(fd.get("id"));
  const row = getDb().prepare("DELETE FROM star_intresse WHERE id = ? RETURNING foretag, status").get(id) as { foretag: string; status: string } | undefined;
  if (row) {
    audit(user.id, "delete", "star_intresse", id, row.foretag);
    revalidateInterest();
  }
  // Tillbaka till fliken som anmälan låg under.
  redirect(`${INTEREST_PAGE}?${row ? `flik=${row.status === "hanterad" ? "hanterade" : "nya"}&` : ""}raderad=1`);
}

/** För en anmälan som kom in innan mejlet var inställt eller när det inte gick att skicka. */
export async function resendInterestMail(fd: FormData): Promise<void> {
  const user = await actionUser();
  if ("error" in user) redirect(`/logga-in?next=${INTEREST_PAGE}`);
  if (!canManageNaringsliv(user)) redirect("/admin?nekad=1");
  const id = Number(fd.get("id"));
  const db = getDb();
  const row = db.prepare("SELECT * FROM star_intresse WHERE id = ?").get(id) as (Omit<StarIntresse, "vill_boka_mote"> & { vill_boka_mote: number }) | undefined;
  if (!row) redirect(INTEREST_PAGE);
  const [sasu, settings, base] = await Promise.all([getCommitteeBySlug("sasu"), getSettings(), siteUrl()]);
  const mail = intresseMejl({ ...row, vill_boka_mote: row.vill_boka_mote === 1 }, `${base}${INTEREST_PAGE}`);
  const result = await sendMail({ to: sasu?.email || settings.contact_email, replyTo: row.epost, ...mail });
  db.prepare("UPDATE star_intresse SET mejl_status = ? WHERE id = ?").run(result, id);
  redirect(`${INTEREST_PAGE}?mejl=${result}`);
}

/** Byter koden i inbjudningslänken. Den gamla länken slutar fungera direkt. */
export async function renewStarInvite(): Promise<FormState | void> {
  const user = await actionUser();
  if ("error" in user) return user;
  if (!canManageNaringsliv(user)) return forbidden();
  getDb().prepare(SAVE_SETTING).run("star_inbjudan_kod", crypto.randomBytes(12).toString("hex"));
  audit(user.id, "update", "star_page", null, "Bytte inbjudningslänken");
  redirect("/admin/star?nylank=1#inbjudan");
}

/** Godkänn och dölj med en knapp. Formuläret skickar med vilken flik man stod på, så att man kommer tillbaka dit. */
export async function setWishStatus(fd: FormData): Promise<void> {
  const user = await actionUser();
  if ("error" in user) redirect("/logga-in?next=/admin/lunchonskemal");
  if (!canManageNaringsliv(user)) redirect("/admin?nekad=1");
  const id = Number(fd.get("id"));
  const status = String(fd.get("status")) as WishStatus;
  const tab = String(fd.get("flik") ?? "");
  if (!WISH_STATUSES.includes(status)) redirect("/admin/lunchonskemal");
  const db = getDb();
  const row = db.prepare("UPDATE lecture_wishes SET status = ? WHERE id = ? RETURNING title").get(status, id) as { title: string } | undefined;
  if (row) {
    audit(user.id, "status", "lecture_wish", id, `${row.title}: ${WISH_STATUS_LABELS[status]}`);
    revalidateSite();
  }
  redirect(`/admin/lunchonskemal?flik=${encodeURIComponent(["nya", "listan", "dolda"].includes(tab) ? tab : "nya")}&klar=${status}`);
}

export async function deleteWish(fd: FormData): Promise<FormState | void> {
  const user = await actionUser();
  if ("error" in user) return user;
  if (!canManageNaringsliv(user)) return forbidden();
  const id = Number(fd.get("id"));
  const db = getDb();
  const row = db.prepare("DELETE FROM lecture_wishes WHERE id = ? RETURNING title, status").get(id) as { title: string; status: WishStatus } | undefined;
  if (row) {
    audit(user.id, "delete", "lecture_wish", id, row.title);
    revalidateSite();
  }
  // Tillbaka till fliken som önskemålet låg under, som efter Godkänn och Dölj. Annars hamnade man bland de nya efter att ha rensat bland de dolda.
  const tab = row ? `flik=${row.status === "ny" ? "nya" : row.status === "dold" ? "dolda" : "listan"}&` : "";
  redirect(`/admin/lunchonskemal?${tab}raderad=1`);
}

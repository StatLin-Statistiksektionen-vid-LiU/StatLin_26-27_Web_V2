"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type FormState, formObject, invalid, zLocalDateTime, zRequired, zText } from "@/lib/admin/form";
import { audit, forbidden } from "@/lib/admin/helpers";
import { canManageMeetings } from "@/lib/auth/permissions";
import { actionUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { formatDate, todayLocal } from "@/lib/dates";
import { DEFAULT_MEETING_TEMPLATE, MEETING_ITEM_TITLE_MAX, parseMeetingTemplate } from "@/lib/meeting-template";

/*
 * Styrelsemötena och dagordningen. Ordföranden (och administratörerna) lägger in mötena, sköter mallen och bestämmer vad som
 * kommer med. Alla konton i portalen kan föreslå punkter till ett möte som inte har varit. Regeln står i canManageMeetings.
 */

/** Översikten, sidomenyn och mötessidorna ligger alla under /admin. */
const revalidateMeetings = () => revalidatePath("/admin", "layout");

/** Så många punkter får ett möte ha, förslag och avslag medräknade. Räcker gott, och hindrar att någon fyller tabellen. */
const MAX_ITEMS = 120;

const meetingSchema = z.object({
  starts_at: zLocalDateTime("Tiden"),
  place: zText(200, "Platsen"),
  note: zText(2000, "Meddelandet"),
});

const itemSchema = z.object({
  meeting_id: z.coerce.number().int().positive(),
  title: zRequired(MEETING_ITEM_TITLE_MAX, "Punkten"),
  description: zText(1000, "Beskrivningen"),
});

const idOf = (value: unknown) => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

type MeetingRow = { id: number; starts_at: string };
type ItemRow = { id: number; meeting_id: number; title: string; status: string; proposed_by: number | null };

const meetingRow = (id: number) => getDb().prepare("SELECT id, starts_at FROM meetings WHERE id = ?").get(id) as MeetingRow | undefined;
const itemRow = (id: number) => getDb().prepare("SELECT id, meeting_id, title, status, proposed_by FROM meeting_items WHERE id = ?").get(id) as ItemRow | undefined;
const label = (m: Pick<MeetingRow, "starts_at">) => `Styrelsemöte ${formatDate(m.starts_at, true)}`;

function template(): string[] {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = 'meeting_template'").get() as { value: string } | undefined;
  return parseMeetingTemplate(row?.value ?? DEFAULT_MEETING_TEMPLATE);
}

/**
 * Ställer punkten på dagordningen. Nya punkter hamnar före Övriga frågor, där sådant brukar tas upp, och sist om mallen saknar
 * den punkten. Ordföranden flyttar dem sedan med pilarna.
 */
function placeOnAgenda(meetingId: number, itemId: number) {
  const db = getDb();
  const rows = db
    .prepare("SELECT id, title FROM meeting_items WHERE meeting_id = ? AND status = 'agenda' AND id != ? ORDER BY sort_order, id")
    .all(meetingId, itemId) as { id: number; title: string }[];
  const other = rows.findIndex((r) => /^övriga frågor/i.test(r.title.trim()));
  const at = other >= 0 ? other : rows.length;
  const order = [...rows.slice(0, at).map((r) => r.id), itemId, ...rows.slice(at).map((r) => r.id)];
  const sort = db.prepare("UPDATE meeting_items SET sort_order = ? WHERE id = ?");
  db.transaction(() => {
    db.prepare("UPDATE meeting_items SET status = 'agenda' WHERE id = ?").run(itemId);
    order.forEach((id, i) => sort.run((i + 1) * 10, id));
  })();
}

/* ---------- Mötena ---------- */

export async function createMeeting(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await actionUser();
  if ("error" in user) return user;
  if (!canManageMeetings(user)) return forbidden("Bara ordföranden kan lägga in möten.");
  const parsed = meetingSchema.safeParse(formObject(fd));
  if (!parsed.success) return invalid(parsed.error);
  const { starts_at, place, note } = parsed.data;
  if (starts_at.slice(0, 10) < todayLocal()) return { error: "Mötet ligger bakåt i tiden.", fieldErrors: { starts_at: "Välj en tid som inte har varit." } };
  const db = getDb();
  const points = template();
  const id = db.transaction(() => {
    const meetingId = Number(db.prepare("INSERT INTO meetings (starts_at, place, note, created_by) VALUES (?, ?, ?, ?)").run(starts_at, place, note, user.id).lastInsertRowid);
    const add = db.prepare("INSERT INTO meeting_items (meeting_id, title, status, sort_order) VALUES (?, ?, 'agenda', ?)");
    points.forEach((title, i) => add.run(meetingId, title, (i + 1) * 10));
    return meetingId;
  })();
  audit(user.id, "create", "meeting", id, label({ starts_at }));
  revalidateMeetings();
  redirect(`/admin/moten/${id}?ny=1`);
}

export async function updateMeeting(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await actionUser();
  if ("error" in user) return user;
  if (!canManageMeetings(user)) return forbidden("Bara ordföranden kan ändra mötet.");
  const id = idOf(fd.get("id"));
  const current = id ? meetingRow(id) : undefined;
  if (!id || !current) return { error: "Mötet finns inte längre. Ladda om sidan." };
  const parsed = meetingSchema.safeParse(formObject(fd));
  if (!parsed.success) return invalid(parsed.error);
  const { starts_at, place, note } = parsed.data;
  getDb().prepare("UPDATE meetings SET starts_at = ?, place = ?, note = ? WHERE id = ?").run(starts_at, place, note, id);
  audit(user.id, "update", "meeting", id, label({ starts_at }));
  revalidateMeetings();
  return { ok: true, message: "Mötet är sparat." };
}

export async function deleteMeeting(fd: FormData): Promise<FormState> {
  const user = await actionUser();
  if ("error" in user) return user;
  if (!canManageMeetings(user)) return forbidden("Bara ordföranden kan ta bort mötet.");
  const id = idOf(fd.get("id"));
  const current = id ? meetingRow(id) : undefined;
  if (!id || !current) return { error: "Mötet finns inte längre. Ladda om sidan." };
  // Punkterna går med mötet (ON DELETE CASCADE).
  getDb().prepare("DELETE FROM meetings WHERE id = ?").run(id);
  audit(user.id, "delete", "meeting", id, label(current));
  revalidateMeetings();
  redirect("/admin/moten?raderat=1");
}

/* ---------- Punkterna ---------- */

/** Ordförandens punkter går direkt upp på dagordningen. Alla andras väntar på ordförandens beslut. */
export async function proposeItem(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await actionUser();
  if ("error" in user) return user;
  const parsed = itemSchema.safeParse(formObject(fd));
  if (!parsed.success) return invalid(parsed.error);
  const { meeting_id, title, description } = parsed.data;
  const meeting = meetingRow(meeting_id);
  if (!meeting) return { error: "Mötet finns inte längre. Ladda om sidan." };
  const chair = canManageMeetings(user);
  if (!chair && meeting.starts_at.slice(0, 10) < todayLocal()) return { error: "Mötet har redan varit, så det går inte att föreslå fler punkter." };
  const db = getDb();
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM meeting_items WHERE meeting_id = ?").get(meeting_id) as { n: number };
  if (n >= MAX_ITEMS) return { error: "Dagordningen är full. Prata med ordföranden." };
  const id = Number(
    db
      .prepare("INSERT INTO meeting_items (meeting_id, title, description, proposed_by, status, sort_order) VALUES (?, ?, ?, ?, 'proposed', ?)")
      .run(meeting_id, title, description, chair ? null : user.id, (n + 1) * 10).lastInsertRowid,
  );
  if (chair) placeOnAgenda(meeting_id, id);
  audit(user.id, "create", "meeting_item", id, `${title} (${label(meeting)})`);
  revalidateMeetings();
  return { ok: true, message: chair ? "Punkten står nu på dagordningen." : "Tack! Förslaget väntar på ordförandens beslut." };
}

/** Ordförandens knappar: ta med (agenda), avslå eller stryk (declined). En struken punkt kan läggas tillbaka. */
export async function decideItem(fd: FormData): Promise<FormState> {
  const user = await actionUser();
  if ("error" in user) return user;
  if (!canManageMeetings(user)) return forbidden("Bara ordföranden bestämmer över dagordningen.");
  const id = idOf(fd.get("id"));
  const item = id ? itemRow(id) : undefined;
  if (!id || !item) return { error: "Punkten finns inte längre. Ladda om sidan." };
  const decision = fd.get("decision");
  if (decision === "agenda") {
    if (item.status !== "agenda") placeOnAgenda(item.meeting_id, id);
  } else if (decision === "declined") {
    getDb().prepare("UPDATE meeting_items SET status = 'declined' WHERE id = ?").run(id);
  } else {
    return { error: "Okänt val. Ladda om sidan." };
  }
  audit(user.id, "status", "meeting_item", id, `${item.title}: ${decision === "agenda" ? "på dagordningen" : "avslagen"}`);
  revalidateMeetings();
  return { ok: true };
}

/** Den som föreslog en punkt kan dra tillbaka den så länge ordföranden inte har bestämt något. */
export async function withdrawItem(fd: FormData): Promise<FormState> {
  const user = await actionUser();
  if ("error" in user) return user;
  const id = idOf(fd.get("id"));
  const item = id ? itemRow(id) : undefined;
  if (!id || !item) return { error: "Punkten finns inte längre. Ladda om sidan." };
  if (item.proposed_by !== user.id || item.status !== "proposed") return { error: "Förslaget går inte att dra tillbaka längre." };
  getDb().prepare("DELETE FROM meeting_items WHERE id = ? AND proposed_by = ? AND status = 'proposed'").run(id, user.id);
  audit(user.id, "delete", "meeting_item", id, item.title);
  revalidateMeetings();
  return { ok: true };
}

/** Pilarna på dagordningen. Punkten byter plats med grannen bland dem som står på dagordningen. */
export async function moveMeetingItem(id: number, direction: -1 | 1): Promise<FormState | void> {
  const user = await actionUser();
  if ("error" in user) return user;
  if (!canManageMeetings(user)) return forbidden("Bara ordföranden kan ändra ordningen.");
  const item = Number.isSafeInteger(id) ? itemRow(id) : undefined;
  if (!item || item.status !== "agenda" || (direction !== -1 && direction !== 1)) return { error: "Punkten finns inte längre på dagordningen. Ladda om sidan." };
  const db = getDb();
  const rows = db.prepare("SELECT id FROM meeting_items WHERE meeting_id = ? AND status = 'agenda' ORDER BY sort_order, id").all(item.meeting_id) as { id: number }[];
  const idx = rows.findIndex((r) => r.id === id);
  const swap = idx + direction;
  if (idx < 0 || swap < 0 || swap >= rows.length) return;
  [rows[idx], rows[swap]] = [rows[swap], rows[idx]];
  const stmt = db.prepare("UPDATE meeting_items SET sort_order = ? WHERE id = ?");
  db.transaction(() => rows.forEach((r, i) => stmt.run((i + 1) * 10, r.id)))();
  revalidateMeetings();
}

/* ---------- Mallen ---------- */

const templateSchema = z.object({
  meeting_template: zText(6000, "Mallen").refine((v) => parseMeetingTemplate(v).length > 0, "Skriv minst en punkt, en per rad."),
});

/** Mallen gäller möten som läggs in efter att den sparats. Möten som redan finns behåller sin dagordning. */
export async function saveMeetingTemplate(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await actionUser();
  if ("error" in user) return user;
  if (!canManageMeetings(user)) return forbidden("Bara ordföranden kan ändra mallen.");
  const parsed = templateSchema.safeParse(formObject(fd));
  if (!parsed.success) return invalid(parsed.error);
  const value = parseMeetingTemplate(parsed.data.meeting_template).join("\n");
  getDb().prepare("INSERT INTO settings (key, value) VALUES ('meeting_template', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(value);
  audit(user.id, "update", "settings", null, "Dagordningsmallen");
  revalidateMeetings();
  return { ok: true, message: "Mallen är sparad. Den gäller möten som läggs in från och med nu." };
}

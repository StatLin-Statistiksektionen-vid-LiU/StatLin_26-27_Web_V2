"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type FormState, formObject, formVersion, invalid, STALE, zCheckbox, zOptionalId, zRequired, zText } from "@/lib/admin/form";
import { audit, forbidden, nowIso, revalidateSite } from "@/lib/admin/helpers";
import { canDeleteBox, canManageFragelada, ownsBox } from "@/lib/auth/permissions";
import { actionUser, renewSessionIfDue, requireUser } from "@/lib/auth/session";
import { FRAGELADA_SETTING } from "@/lib/data/fragelada";
import { todayLocal } from "@/lib/dates";
import { getDb } from "@/lib/db";
import { cleanOwnCode, generateCode, ownCodeProblem } from "@/lib/fragelada";
import { isValidDate } from "@/lib/projektplan-mallar";

/*
 * Posternas actions. Bara ägaren kommer åt frågorna, och varje action kontrollerar det själv. Audit-loggen får bara sådant som rör
 * lådorna (skapad, stängd, öppnad, borttagen, tömd, ny ägare, på och av), aldrig något om enskilda frågor.
 */

const BOARD = "/admin";

type BoxRow = { id: number; slug: string | null; code: string | null; title: string; owner_id: number | null; closes_on: string | null; updated_at: string };

function loadBox(id: number): BoxRow | undefined {
  return getDb().prepare("SELECT id, slug, code, title, owner_id, closes_on, updated_at FROM question_boxes WHERE id = ?").get(id) as BoxRow | undefined;
}

const idFrom = (fd: FormData) => {
  const id = Number(fd.get("id"));
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

/** Knapparna utan formulärtext har inget fält att visa ett fel i och inget som kan gå förlorat, så en utgången session går till inloggningen och tillbaka. */
async function buttonUser() {
  const user = await requireUser();
  await renewSessionIfDue();
  return user;
}

/** Sidan, sidomenyns siffra och översikten ligger alla under /admin. */
const revalidateInbox = () => revalidatePath(BOARD, "layout");

/** Raderade frågor ska inte ligga kvar som lästa rester i databasfilen. */
const eraseOnDelete = () => getDb().pragma("secure_delete = ON");

/** Felet att visa för en egen kod: fel format, eller att en annan låda redan har den. */
function ownCodeError(code: string, boxId: number | null): FormState | null {
  const taken = getDb().prepare("SELECT 1 FROM question_boxes WHERE code = ? AND id IS NOT ?").get(code, boxId);
  const problem = ownCodeProblem(code) ?? (taken ? "En annan låda har redan den koden. Skriv en annan eller slumpa en ny." : null);
  return problem ? { error: "Kontrollera fälten som är markerade.", fieldErrors: { code: problem } } : null;
}

const boxSchema = z.object({
  id: zOptionalId,
  title: zRequired(80, "Titeln"),
  description: zText(300, "Beskrivningen"),
  code: z.string().optional(),
  closes_on: z
    .string()
    .optional()
    .refine((v) => !v || isValidDate(v), "Datumet är inte giltigt.")
    .transform((v) => v || null),
});

export async function saveBox(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await actionUser({ renew: false });
  if ("error" in user) return user;
  const parsed = boxSchema.safeParse(formObject(fd));
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  const past: FormState | null =
    d.closes_on && d.closes_on < todayLocal() ? { error: "Kontrollera fälten som är markerade.", fieldErrors: { closes_on: "Datumet har redan varit." } } : null;
  const db = getDb();

  if (d.id) {
    const box = loadBox(d.id);
    if (!box || !ownsBox(user, box)) return forbidden();
    // Ett datum som redan stod på lådan får stå kvar. Annars gick det inte att rätta titeln på en låda som har stängt av sig själv.
    if (past && d.closes_on !== box.closes_on) return past;
    // En fast låda har ingen kod. Ett tomt fält betyder att koden får vara kvar.
    const code = box.slug === null ? cleanOwnCode(d.code) || box.code : null;
    const newCode = code !== box.code;
    if (newCode && code) {
      const problem = ownCodeError(code, box.id);
      if (problem) return problem;
    }
    const now = nowIso();
    const res = db
      .prepare("UPDATE question_boxes SET title = ?, description = ?, closes_on = ?, code = ?, updated_at = ? WHERE id = ? AND updated_at = ?")
      .run(d.title, d.description, box.slug === null ? d.closes_on : null, code, now, d.id, formVersion(fd));
    if (res.changes === 0) return STALE;
    if (newCode) audit(user.id, "update", "question_box", box.id, `Bytte kod på lådan ${d.title}`);
    await renewSessionIfDue();
    revalidateInbox();
    return { ok: true, message: "Sparat.", data: { updated_at: now } };
  }

  if (past) return past;
  const own = cleanOwnCode(d.code);
  if (own) {
    const problem = ownCodeError(own, null);
    if (problem) return problem;
  }
  let id = 0;
  for (let attempt = 0; attempt < 8 && !id; attempt++) {
    const taken = db.prepare("SELECT 1 FROM question_boxes WHERE code = ?");
    const code = own || generateCode();
    if (taken.get(code)) continue;
    id = Number(
      db.prepare("INSERT INTO question_boxes (code, title, description, owner_id, closes_on) VALUES (?, ?, ?, ?, ?)").run(code, d.title, d.description, user.id, d.closes_on)
        .lastInsertRowid,
    );
  }
  if (!id) return { error: "Det gick inte att skapa en kod. Försök igen." };
  audit(user.id, "create", "question_box", id, d.title);
  await renewSessionIfDue();
  revalidateInbox();
  redirect(`/admin/fragelada/${id}?skapad=1`);
}

/** Stäng eller öppna en låda med kod. Fasta lådor är alltid öppna när funktionen är på. */
export async function setBoxClosed(fd: FormData): Promise<void> {
  const user = await buttonUser();
  const id = idFrom(fd);
  const box = id ? loadBox(id) : undefined;
  if (!box || !ownsBox(user, box) || box.slug !== null) return;
  const closed = fd.get("closed") === "1";
  getDb().prepare("UPDATE question_boxes SET closed = ?, updated_at = ? WHERE id = ?").run(closed ? 1 : 0, nowIso(), box.id);
  audit(user.id, "update", "question_box", box.id, `${closed ? "Stängde" : "Öppnade"} lådan ${box.title}`);
  revalidateInbox();
}

export async function setQuestionHandled(fd: FormData): Promise<void> {
  const user = await buttonUser();
  const id = idFrom(fd);
  if (!id) return;
  getDb()
    .prepare("UPDATE box_questions SET handled = ? WHERE id = ? AND box_id IN (SELECT id FROM question_boxes WHERE owner_id = ?)")
    .run(fd.get("handled") === "1" ? 1 : 0, id, user.id);
  revalidateInbox();
}

export async function deleteQuestion(fd: FormData): Promise<FormState> {
  const user = await actionUser();
  if ("error" in user) return user;
  const id = idFrom(fd);
  const db = getDb();
  const row = id
    ? (db.prepare("SELECT q.box_id FROM box_questions q JOIN question_boxes b ON b.id = q.box_id WHERE q.id = ? AND b.owner_id = ?").get(id, user.id) as { box_id: number } | undefined)
    : undefined;
  if (!row) return forbidden();
  eraseOnDelete();
  db.prepare("DELETE FROM box_questions WHERE id = ?").run(id);
  revalidateInbox();
  redirect(`/admin/fragelada/${row.box_id}?borttagen=1`);
}

export async function emptyBox(fd: FormData): Promise<FormState> {
  const user = await actionUser();
  if ("error" in user) return user;
  const id = idFrom(fd);
  const box = id ? loadBox(id) : undefined;
  if (!box || !ownsBox(user, box)) return forbidden();
  eraseOnDelete();
  const { changes } = getDb().prepare("DELETE FROM box_questions WHERE box_id = ?").run(box.id);
  audit(user.id, "delete", "question_box", box.id, `Tömde lådan ${box.title} (${changes} frågor)`);
  revalidateInbox();
  redirect(`/admin/fragelada/${box.id}?tomd=1`);
}

/** Ägaren eller en administratör. Frågorna raderas med lådan. */
export async function deleteBox(fd: FormData): Promise<FormState> {
  const user = await actionUser();
  if ("error" in user) return user;
  const id = idFrom(fd);
  const box = id ? loadBox(id) : undefined;
  if (!box) return { error: "Lådan finns inte längre." };
  if (!canDeleteBox(user, box)) return forbidden();
  eraseOnDelete();
  getDb().prepare("DELETE FROM question_boxes WHERE id = ?").run(box.id);
  audit(user.id, "delete", "question_box", box.id, box.title);
  revalidateInbox();
  redirect("/admin/fragelada?raderad=1");
}

/**
 * De fasta lådorna följer posternas konton när det går. Saknas kontot står lådan utan ägare tills en administratör väljer en.
 * En ägarlös låda med frågor kvar byter inte ägare här: det får bara ske i setBoxOwner, som raderar frågorna i samma sats.
 */
function adoptFixedOwners() {
  getDb()
    .prepare(
      `UPDATE question_boxes SET owner_id = (SELECT id FROM users WHERE email = question_boxes.slug || '@statlin.se' AND active = 1)
       WHERE slug IS NOT NULL AND owner_id IS NULL
         AND NOT EXISTS (SELECT 1 FROM box_questions q WHERE q.box_id = question_boxes.id)`,
    )
    .run();
}

export async function setFrageladaOpen(fd: FormData): Promise<void> {
  const user = await buttonUser();
  if (!canManageFragelada(user)) return;
  const open = fd.get("open") === "1";
  const db = getDb();
  if (open) adoptFixedOwners();
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(FRAGELADA_SETTING, open ? "1" : "0");
  audit(user.id, "update", "question_box", null, open ? "Slog på frågelådan" : "Stängde av frågelådan");
  revalidateSite();
}

const ownerSchema = z.object({ id: zOptionalId, owner_id: zOptionalId, empty_ok: zCheckbox });

/**
 * Administratören väljer ägare till en fast låda. Har lådan frågor raderas de i samma sats, och det måste kryssas i: annars kunde en
 * administratör ge sig själv lådan och läsa det som skrivits till någon annan.
 */
export async function setBoxOwner(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await actionUser();
  if ("error" in user) return user;
  if (!canManageFragelada(user)) return forbidden();
  const parsed = ownerSchema.safeParse(formObject(fd));
  if (!parsed.success) return invalid(parsed.error);
  const { id, owner_id, empty_ok } = parsed.data;
  const box = id ? loadBox(id) : undefined;
  if (!box || box.slug === null) return forbidden();
  if (box.owner_id === owner_id) return { ok: true, message: "Ingen ändring." };
  const db = getDb();
  if (owner_id !== null && !db.prepare("SELECT 1 FROM users WHERE id = ? AND active = 1").get(owner_id)) {
    return { error: "Kontot finns inte längre.", fieldErrors: { owner_id: "Välj ett konto i listan." } };
  }
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM box_questions WHERE box_id = ?").get(box.id) as { n: number };
  if (n > 0 && !empty_ok) {
    return { error: `Lådan har ${n} ${n === 1 ? "fråga" : "frågor"}. Kryssa i att de raderas, så att ingen ny ägare kan läsa dem.`, fieldErrors: { empty_ok: "Kryssa i för att byta ägare." } };
  }
  eraseOnDelete();
  db.transaction(() => {
    db.prepare("DELETE FROM box_questions WHERE box_id = ?").run(box.id);
    db.prepare("UPDATE question_boxes SET owner_id = ?, updated_at = ? WHERE id = ?").run(owner_id, nowIso(), box.id);
  })();
  audit(user.id, "update", "question_box", box.id, `Ny ägare till ${box.title}${n ? ` (${n} frågor raderade)` : ""}`);
  revalidateSite();
  return { ok: true, message: "Ägaren är bytt." };
}

/** Nollställer siffran i sidomenyn när ägaren har öppnat lådan. Körs av sig själv när sidan visas, så en utgången session ska inte kasta ut någon härifrån. */
export async function markBoxSeen(boxId: number): Promise<void> {
  const user = await actionUser({ renew: false });
  if ("error" in user) return;
  if (!Number.isSafeInteger(boxId)) return;
  getDb().prepare("UPDATE box_questions SET seen = 1 WHERE seen = 0 AND box_id = ? AND box_id IN (SELECT id FROM question_boxes WHERE owner_id = ?)").run(boxId, user.id);
  revalidateInbox();
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type FormState, formObject, formVersion, invalid, STALE, zRequired, zText } from "@/lib/admin/form";
import { audit, forbidden, nowIso } from "@/lib/admin/helpers";
import { itemTerm, suggestedDueDate, termOfMonth, yearInRange, type WheelItem, type WheelStatus } from "@/lib/arshjul";
import { WHEEL_SUGGESTIONS } from "@/lib/arshjul-forslag";
import { canChangeWheelItem } from "@/lib/auth/permissions";
import { actionUser, renewSessionIfDue } from "@/lib/auth/session";
import { todayLocal } from "@/lib/dates";
import { getDb } from "@/lib/db";
import { planTemplate } from "@/lib/projektplan-mallar";
import { findResponsibleAccount } from "./projektplaner-hjalp";

/** Hjulet, översiktens kort och tavlan ligger alla under /admin. */
const revalidateAdmin = () => revalidatePath("/admin", "layout");

const loadItem = (id: number) => getDb().prepare("SELECT * FROM wheel_items WHERE id = ?").get(id) as WheelItem | undefined;

const itemSchema = z
  .object({
    id: z
      .string()
      .optional()
      .transform((v) => (v && /^\d+$/.test(v) ? Number(v) : null)),
    title: zRequired(140, "Rubriken"),
    description: zText(2000, "Beskrivningen"),
    responsible: zText(80, "Ansvarig"),
    // Ett enda val: en månad, eller bara en termin när månaden inte är bestämd.
    month: z
      .string()
      .optional()
      .transform((v) => (v === "vt" || v === "ht" ? v : v && /^([1-9]|1[0-2])$/.test(v) ? Number(v) : null)),
    depends_on: zText(200, "Fältet"),
    template: z
      .string()
      .optional()
      .transform((v) => (v && planTemplate(v) ? v : "")),
  })
  .superRefine((d, ctx) => {
    if (d.month === null) ctx.addIssue({ code: "custom", path: ["month"], message: "Välj när på året det händer." });
  });

export async function saveWheelItem(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await actionUser({ renew: false });
  if ("error" in user) return user;
  const parsed = itemSchema.safeParse(formObject(fd));
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  const db = getDb();
  // Månaden bestämmer terminen, så det finns bara ett svar i databasen.
  const month = typeof d.month === "number" ? d.month : null;
  const term = month !== null ? termOfMonth(month) : d.month;

  if (d.id) {
    const existing = loadItem(d.id);
    if (!existing) return { error: "Punkten finns inte längre." };
    if (!canChangeWheelItem(user, existing)) return forbidden();
    const updatedAt = nowIso();
    const res = db
      .prepare("UPDATE wheel_items SET title = ?, description = ?, responsible = ?, month = ?, term = ?, depends_on = ?, template = ?, updated_at = ? WHERE id = ? AND updated_at = ?")
      .run(d.title, d.description, d.responsible, month, term, d.depends_on, d.template, updatedAt, d.id, formVersion(fd));
    if (res.changes === 0) return STALE;
    audit(user.id, "update", "wheel_item", d.id, d.title);
    await renewSessionIfDue();
    revalidateAdmin();
    return { ok: true, message: "Punkten är sparad.", data: { updated_at: updatedAt } };
  }

  const res = db
    .prepare("INSERT INTO wheel_items (title, description, responsible, month, term, depends_on, template, owner_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(d.title, d.description, d.responsible, month, term, d.depends_on, d.template, user.id);
  audit(user.id, "create", "wheel_item", Number(res.lastInsertRowid), d.title);
  await renewSessionIfDue();
  revalidateAdmin();
  // Tillbaka till samma vy: månaden punkten hamnade i, och bara de egna punkterna om filtret var på.
  redirect(`/admin/arshjul?sparad=1${month ? `&manad=${month}` : ""}${fd.get("vara") === "1" ? "&vara=1" : ""}`);
}

export async function deleteWheelItem(fd: FormData): Promise<FormState> {
  const user = await actionUser({ renew: false });
  if ("error" in user) return user;
  const id = Number(fd.get("id"));
  const existing = loadItem(id);
  if (!existing) return { error: "Punkten finns inte längre." };
  if (!canChangeWheelItem(user, existing)) return forbidden();
  // Uppdrag och planer som skapats från punkten står kvar: de är redan arbete som någon gör.
  getDb().prepare("DELETE FROM wheel_items WHERE id = ?").run(id);
  audit(user.id, "delete", "wheel_item", id, existing.title);
  await renewSessionIfDue();
  revalidateAdmin();
  redirect("/admin/arshjul?raderad=1");
}

/** Lägger in förslagen som saknas. Nyckeln är unik, så en andra körning gör ingenting och redigerade punkter står kvar orörda. */
export async function fillWheelSuggestions(): Promise<FormState> {
  const user = await actionUser();
  if ("error" in user) return user;
  const db = getDb();
  const insert = db.prepare(
    "INSERT OR IGNORE INTO wheel_items (title, description, responsible, month, term, depends_on, template, seed_key) VALUES (@title, @description, @responsible, @month, @term, @depends_on, @template, @seed_key)",
  );
  const added = db.transaction(() =>
    WHEEL_SUGGESTIONS.reduce((n, s) => n + insert.run({ ...s, term: s.month !== null ? termOfMonth(s.month) : s.term }).changes, 0),
  )();
  // Fanns allt redan ritas sidan inte om, annars försvinner knappen med sitt besked.
  if (added === 0) return { ok: true, message: "Alla förslag finns redan i hjulet." };
  audit(user.id, "create", "wheel_item", null, `Fyllde hjulet med ${added} förslag`);
  revalidateAdmin();
  // Knappen försvinner när hjulet har fyllts, så beskedet visas på hjulet, där det som lades in syns.
  redirect(`/admin/arshjul?fylld=${added}`);
}

const yearOf = (fd: FormData) => {
  const year = Number(fd.get("year"));
  return Number.isInteger(year) && yearInRange(year, todayLocal()) ? year : null;
};

const setState = (itemId: number, year: number, status: WheelStatus) =>
  getDb()
    .prepare(
      `INSERT INTO wheel_item_state (item_id, year, status, updated_at) VALUES (@itemId, @year, @status, @now)
       ON CONFLICT(item_id, year) DO UPDATE SET status = @status, updated_at = @now`,
    )
    .run({ itemId, year, status, now: nowIso() });

/** "Klar i år", "Hoppa över i år" och ångra. Bara ägaren, den ansvariga posten och admin: det tar bort punkten från allas kort. */
export async function setWheelStatus(fd: FormData): Promise<FormState> {
  const user = await actionUser();
  if ("error" in user) return user;
  const item = loadItem(Number(fd.get("id")));
  const year = yearOf(fd);
  if (!item || year === null) return { error: "Punkten finns inte längre. Ladda om sidan." };
  if (!canChangeWheelItem(user, item)) return forbidden();
  const action = String(fd.get("status"));
  if (action !== "klar" && action !== "hoppad" && action !== "oppen") return { error: "Okänt val." };
  // Ångra återställer till planerad om uppdraget eller planen finns kvar. effectiveStatus räknar ut det, så här räcker "planerad".
  setState(item.id, year, action === "oppen" ? "planerad" : action);
  // Ett uppdrag som redan är klart skulle annars direkt göra punkten klar igen, så ångra släpper kopplingen till det.
  if (action === "oppen") {
    getDb()
      .prepare("UPDATE wheel_item_state SET task_id = NULL WHERE item_id = ? AND year = ? AND task_id IN (SELECT id FROM tasks WHERE status = 'klar')")
      .run(item.id, year);
  }
  audit(user.id, "status", "wheel_item", item.id, `${item.title} ${year}: ${action === "klar" ? "klar" : action === "hoppad" ? "hoppas över" : "ångrad"}`);
  revalidateAdmin();
  return {};
}

/** "Lägg på tavlan": ett öppet uppdrag eller ett till den ansvariga posten, med ett rimligt datum. Alla poster får göra det. */
export async function addWheelItemToBoard(fd: FormData): Promise<FormState> {
  const user = await actionUser();
  if ("error" in user) return user;
  const item = loadItem(Number(fd.get("id")));
  const year = yearOf(fd);
  if (!item || year === null) return { error: "Punkten finns inte längre. Ladda om sidan." };
  const db = getDb();
  const to = findResponsibleAccount(item.responsible);
  const due = suggestedDueDate(item, year, todayLocal());
  const description = [item.description, item.depends_on && `Beror på: ${item.depends_on}`, `Från årshjulet, ${item.month ? "" : `${itemTerm(item).toUpperCase()} `}${year}.`].filter(Boolean).join("\n\n");
  // I en transaktion, så att ett dubbelklick inte ger två uppdrag.
  const created = db.transaction(() => {
    const state = db.prepare("SELECT task_id FROM wheel_item_state WHERE item_id = ? AND year = ?").get(item.id, year) as { task_id: number | null } | undefined;
    if (state?.task_id) return null;
    const res = db
      .prepare("INSERT INTO tasks (title, description, from_user_id, to_user_id, shared, due_date, assigned_at) VALUES (?, ?, ?, ?, 1, ?, ?)")
      .run(item.title, description, user.id, to, due, to !== null && to !== user.id ? nowIso() : null);
    const taskId = Number(res.lastInsertRowid);
    db.prepare(
      `INSERT INTO wheel_item_state (item_id, year, status, task_id, updated_at) VALUES (@itemId, @year, 'planerad', @taskId, @now)
       ON CONFLICT(item_id, year) DO UPDATE SET status = 'planerad', task_id = @taskId, updated_at = @now`,
    ).run({ itemId: item.id, year, taskId, now: nowIso() });
    return taskId;
  })();
  if (created !== null) audit(user.id, "create", "task", created, `${item.title} (från årshjulet)`);
  revalidateAdmin();
  return {};
}

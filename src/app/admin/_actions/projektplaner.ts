"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type FormState, formObject, formVersion, invalid, STALE, zRequired, zText } from "@/lib/admin/form";
import { audit, forbidden, nowIso } from "@/lib/admin/helpers";
import { yearInRange } from "@/lib/arshjul";
import { canChangePlan } from "@/lib/auth/permissions";
import { actionUser, renewSessionIfDue } from "@/lib/auth/session";
import { planChannelKey } from "@/lib/chatt";
import { todayLocal } from "@/lib/dates";
import { getDb } from "@/lib/db";
import { isValidDate, planTemplate } from "@/lib/projektplan-mallar";

const revalidateAdmin = () => revalidatePath("/admin", "layout");

type PlanRow = { id: number; title: string; owner_user_id: number | null; responsible: string; template: string; updated_at: string };
const loadPlan = (id: number) => getDb().prepare("SELECT id, title, owner_user_id, responsible, template, updated_at FROM project_plans WHERE id = ?").get(id) as PlanRow | undefined;

const zDate = (label: string) => z.string().refine(isValidDate, `${label} måste vara ett giltigt datum.`);

const MAX_STEPS = 40;

const createSchema = z.object({
  title: zRequired(140, "Namnet"),
  template: z.string().refine((v) => !!planTemplate(v), "Välj en mall."),
  plan_date: zDate("Datumet"),
  responsible: zText(80, "Ansvarig"),
  goal: zText(2000, "Målet"),
  wheel_item_id: z
    .string()
    .optional()
    .transform((v) => (v && /^\d+$/.test(v) ? Number(v) : null)),
  year: z
    .string()
    .optional()
    .transform((v) => (v && /^\d{4}$/.test(v) ? Number(v) : null)),
});

export async function createPlan(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await actionUser({ renew: false });
  if ("error" in user) return user;
  const parsed = createSchema.safeParse(formObject(fd));
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;

  // Stegen kommer i ordning från förhandsvisningen, ett titelfält, ett datumfält och en beskrivning per steg.
  const titles = fd.getAll("step_title").map((v) => String(v).trim());
  const dues = fd.getAll("step_due").map(String);
  const descriptions = fd.getAll("step_description").map((v) => String(v).trim().slice(0, 2000));
  if (titles.length !== dues.length || titles.length !== descriptions.length) return { error: "Stegen kom inte fram rätt. Ladda om sidan och försök igen." };
  if (titles.length === 0) return { error: "Behåll minst ett steg, annars blir planen tom." };
  if (titles.length > MAX_STEPS) return { error: `En plan får ha högst ${MAX_STEPS} steg.` };
  if (titles.some((t) => !t || t.length > 140)) return { error: "Varje steg behöver en rubrik på högst 140 tecken." };
  if (dues.some((v) => !isValidDate(v))) return { error: "Varje steg behöver ett giltigt datum." };

  const db = getDb();
  const today = todayLocal();
  const year = d.year !== null && yearInRange(d.year, today) ? d.year : Number(d.plan_date.slice(0, 4));
  if (d.wheel_item_id !== null && !db.prepare("SELECT 1 FROM wheel_items WHERE id = ?").get(d.wheel_item_id)) {
    return { error: "Årshjulspunkten finns inte längre. Skapa planen från början i stället." };
  }

  const planId = db.transaction(() => {
    if (d.wheel_item_id !== null) {
      const state = db.prepare("SELECT project_plan_id FROM wheel_item_state WHERE item_id = ? AND year = ?").get(d.wheel_item_id, year) as { project_plan_id: number | null } | undefined;
      if (state?.project_plan_id) return { existing: state.project_plan_id };
    }
    const res = db
      .prepare("INSERT INTO project_plans (title, template, plan_date, responsible, goal, owner_user_id, wheel_item_id) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(d.title, d.template, d.plan_date, d.responsible, d.goal, user.id, d.wheel_item_id);
    const id = Number(res.lastInsertRowid);
    // Stegen stannar i planen tills någon skickar dem till tavlan (sendPlanSteps).
    const insertStep = db.prepare("INSERT INTO plan_steps (plan_id, title, description, due_date) VALUES (?, ?, ?, ?)");
    titles.forEach((title, i) => insertStep.run(id, title, descriptions[i], dues[i]));
    if (d.wheel_item_id !== null) {
      db.prepare(
        `INSERT INTO wheel_item_state (item_id, year, status, project_plan_id, updated_at) VALUES (@itemId, @year, 'planerad', @id, @now)
         ON CONFLICT(item_id, year) DO UPDATE SET status = 'planerad', project_plan_id = @id, updated_at = @now`,
      ).run({ itemId: d.wheel_item_id, year, id, now: nowIso() });
    }
    return { created: id };
  })();
  if ("existing" in planId) redirect(`/admin/projektplaner/${planId.existing}`);
  audit(user.id, "create", "project_plan", planId.created, d.title);
  await renewSessionIfDue();
  revalidateAdmin();
  redirect(`/admin/projektplaner/${planId.created}?skapad=1`);
}

const planSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
  title: zRequired(140, "Namnet"),
  plan_date: zDate("Datumet"),
  responsible: zText(80, "Ansvarig"),
  goal: zText(4000, "Målet"),
  budget: zText(4000, "Budgeten"),
  lessons: zText(8000, "Lärdomarna"),
});

export async function savePlan(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await actionUser({ renew: false });
  if ("error" in user) return user;
  const parsed = planSchema.safeParse(formObject(fd));
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  const existing = loadPlan(d.id);
  if (!existing) return { error: "Planen finns inte längre." };
  if (!canChangePlan(user, existing)) return forbidden();
  const updatedAt = nowIso();
  // Stegen flyttas inte med datumet: någon kan redan ha bokat efter dem. Det står vid fältet.
  const res = getDb()
    .prepare("UPDATE project_plans SET title = ?, plan_date = ?, responsible = ?, goal = ?, budget = ?, lessons = ?, updated_at = ? WHERE id = ? AND updated_at = ?")
    .run(d.title, d.plan_date, d.responsible, d.goal, d.budget, d.lessons, updatedAt, d.id, formVersion(fd));
  if (res.changes === 0) return STALE;
  audit(user.id, "update", "project_plan", d.id, d.title);
  await renewSessionIfDue();
  revalidateAdmin();
  return { ok: true, message: "Planen är sparad.", data: { updated_at: updatedAt } };
}

const stepSchema = z.object({
  plan_id: z.string().regex(/^\d+$/).transform(Number),
  title: zRequired(140, "Rubriken"),
  due_date: zDate("Datumet"),
  description: zText(2000, "Beskrivningen"),
});

export async function addPlanStep(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await actionUser({ renew: false });
  if ("error" in user) return user;
  const parsed = stepSchema.safeParse(formObject(fd));
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  const plan = loadPlan(d.plan_id);
  if (!plan) return { error: "Planen finns inte längre." };
  if (!canChangePlan(user, plan)) return forbidden();
  // Samma tak som när planen skapas, annars gick det att lägga till steg ett i taget förbi det.
  const { n } = getDb().prepare("SELECT COUNT(*) AS n FROM plan_steps WHERE plan_id = ?").get(plan.id) as { n: number };
  if (n >= MAX_STEPS) return { error: `En plan får ha högst ${MAX_STEPS} steg.` };
  getDb().prepare("INSERT INTO plan_steps (plan_id, title, description, due_date) VALUES (?, ?, ?, ?)").run(plan.id, d.title, d.description, d.due_date);
  audit(user.id, "update", "project_plan", plan.id, `Nytt steg: ${d.title}`);
  await renewSessionIfDue();
  revalidateAdmin();
  return { ok: true, message: "Steget ligger i planen. Skicka det till tavlan när det är redo." };
}

type StepRow = { id: number; plan_id: number; title: string; task_id: number | null };

/** Ett steg som användaren får ändra. Ett skickat steg ändras inte här: då är det uppdraget på tavlan som gäller. */
function changeableStep(user: Parameters<typeof canChangePlan>[0], rawId: unknown): { step: StepRow; plan: PlanRow } | { problem: FormState } {
  const id = Number(rawId);
  const step = Number.isSafeInteger(id) && id > 0 ? (getDb().prepare("SELECT id, plan_id, title, task_id FROM plan_steps WHERE id = ?").get(id) as StepRow | undefined) : undefined;
  if (!step) return { problem: { error: "Steget finns inte längre." } };
  const plan = loadPlan(step.plan_id);
  if (!plan || !canChangePlan(user, plan)) return { problem: forbidden() };
  if (step.task_id !== null) return { problem: { error: "Steget ligger redan på tavlan, så du ändrar det där." } };
  return { step, plan };
}

const stepEditSchema = stepSchema.omit({ plan_id: true }).extend({ id: z.string().regex(/^\d+$/).transform(Number) });

export async function savePlanStep(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await actionUser({ renew: false });
  if ("error" in user) return user;
  const parsed = stepEditSchema.safeParse(formObject(fd));
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  const found = changeableStep(user, d.id);
  if ("problem" in found) return found.problem;
  getDb().prepare("UPDATE plan_steps SET title = ?, description = ?, due_date = ? WHERE id = ?").run(d.title, d.description, d.due_date, d.id);
  await renewSessionIfDue();
  revalidateAdmin();
  return { ok: true, message: "Steget är sparat." };
}

/** Bocka av ett steg som inte behöver något uppdrag. Ett skickat steg är klart när uppdraget är det. */
export async function setPlanStepDone(fd: FormData): Promise<FormState> {
  const user = await actionUser({ renew: false });
  if ("error" in user) return user;
  const found = changeableStep(user, fd.get("id"));
  if ("problem" in found) return found.problem;
  getDb().prepare("UPDATE plan_steps SET done = ? WHERE id = ?").run(fd.get("done") === "1" ? 1 : 0, found.step.id);
  await renewSessionIfDue();
  revalidateAdmin();
  return {};
}

export async function deletePlanStep(fd: FormData): Promise<FormState> {
  const user = await actionUser({ renew: false });
  if ("error" in user) return user;
  const found = changeableStep(user, fd.get("id"));
  if ("problem" in found) return found.problem;
  getDb().prepare("DELETE FROM plan_steps WHERE id = ?").run(found.step.id);
  audit(user.id, "update", "project_plan", found.plan.id, `Tog bort steget ${found.step.title}`);
  await renewSessionIfDue();
  revalidateAdmin();
  redirect(`/admin/projektplaner/${found.plan.id}?borttaget=1`);
}

/**
 * Skickar steg till uppdragstavlan, ett eller flera på en gång. Steg som redan är skickade hoppas över, så två som trycker samtidigt
 * ger inte dubbla uppdrag. Ett tomt val av mottagare ger ett öppet uppdrag, precis som på tavlan.
 */
export async function sendPlanSteps(fd: FormData): Promise<FormState> {
  const user = await actionUser({ renew: false });
  if ("error" in user) return user;
  const planId = Number(fd.get("plan_id"));
  const plan = Number.isSafeInteger(planId) ? loadPlan(planId) : undefined;
  if (!plan) return { error: "Planen finns inte längre." };
  if (!canChangePlan(user, plan)) return forbidden();
  const rawTo = String(fd.get("to") ?? "");
  const to = /^\d+$/.test(rawTo) ? Number(rawTo) : null;
  const db = getDb();
  if (to !== null && !db.prepare("SELECT 1 FROM users WHERE id = ? AND active = 1").get(to)) return { error: "Mottagaren finns inte längre. Välj en annan i listan." };
  const assigned = to !== null && to !== user.id ? nowIso() : null;
  const ids = fd.getAll("step_id").map(Number).filter(Number.isSafeInteger);

  const sent = db.transaction(() => {
    const findStep = db.prepare("SELECT id, title, description, due_date FROM plan_steps WHERE id = ? AND plan_id = ? AND task_id IS NULL AND done = 0");
    const insertTask = db.prepare("INSERT INTO tasks (title, description, from_user_id, to_user_id, shared, due_date, assigned_at, project_plan_id) VALUES (?, ?, ?, ?, 1, ?, ?, ?)");
    const linkStep = db.prepare("UPDATE plan_steps SET task_id = ? WHERE id = ?");
    const tasks: { id: number; title: string }[] = [];
    for (const stepId of ids) {
      const step = findStep.get(stepId, plan.id) as { id: number; title: string; description: string; due_date: string | null } | undefined;
      if (!step) continue;
      const taskId = Number(insertTask.run(step.title, step.description, user.id, to, step.due_date, assigned, plan.id).lastInsertRowid);
      linkStep.run(taskId, step.id);
      tasks.push({ id: taskId, title: step.title });
    }
    return tasks;
  })();
  for (const task of sent) audit(user.id, "create", "task", task.id, `${task.title} (${plan.title})`);
  await renewSessionIfDue();
  revalidateAdmin();
  if (sent.length === 0) return { error: "Stegen är redan skickade. Ladda om sidan." };
  return { ok: true, message: sent.length === 1 ? `"${sent[0].title}" ligger nu på tavlan.` : `${sent.length} steg ligger nu på tavlan.` };
}

/**
 * Vilka som är med i planen utöver den som la in den och den ansvariga posten: hela StatLin, eller de konton som kryssas i. De som är
 * med får fråga och svara i planens tråd. En ny inbjudan står som avisering hos kontot tills det öppnar planen.
 */
export async function savePlanCollaborators(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await actionUser({ renew: false });
  if ("error" in user) return user;
  const planId = Number(fd.get("plan_id"));
  const plan = Number.isSafeInteger(planId) ? loadPlan(planId) : undefined;
  if (!plan) return { error: "Planen finns inte längre." };
  if (!canChangePlan(user, plan)) return forbidden();
  const db = getDb();
  const all = fd.get("collab_all") === "on" ? 1 : 0;
  const active = new Set((db.prepare("SELECT id FROM users WHERE active = 1").all() as { id: number }[]).map((r) => r.id));
  // Den som la in planen är redan med.
  const wanted = new Set(fd.getAll("user_id").map(Number).filter((id) => active.has(id) && id !== plan.owner_user_id));
  const now = nowIso();

  const added = db.transaction(() => {
    db.prepare("UPDATE project_plans SET collab_all = ? WHERE id = ?").run(all, plan.id);
    const current = new Set((db.prepare("SELECT user_id FROM plan_collaborators WHERE plan_id = ?").all(plan.id) as { user_id: number }[]).map((r) => r.user_id));
    const remove = db.prepare("DELETE FROM plan_collaborators WHERE plan_id = ? AND user_id = ?");
    for (const id of current) if (!wanted.has(id)) remove.run(plan.id, id);
    // Den som bjuder in sig själv behöver ingen avisering om det.
    const insert = db.prepare("INSERT INTO plan_collaborators (plan_id, user_id, added_at, seen_at) VALUES (?, ?, ?, ?)");
    let n = 0;
    for (const id of wanted) {
      if (current.has(id)) continue;
      insert.run(plan.id, id, now, id === user.id ? now : null);
      n++;
    }
    return n;
  })();
  audit(user.id, "update", "project_plan", plan.id, all ? `Medarbetare: hela StatLin (${plan.title})` : `Medarbetare: ${wanted.size} inbjudna (${plan.title})`);
  await renewSessionIfDue();
  revalidateAdmin();
  if (all) return { ok: true, message: "Hela StatLin är med i planen och kan fråga och svara i tråden." };
  if (wanted.size === 0) return { ok: true, message: "Ingen är inbjuden. Tråden är för dig och den ansvariga posten." };
  return { ok: true, message: added > 0 ? `Sparat. ${added === 1 ? "Den nya medarbetaren får" : "De nya medarbetarna får"} en avisering.` : "Medarbetarna är sparade." };
}

/** Inbjudan räknas som sedd när kontot öppnar planen. Anropas av sidan själv, så det förlänger inte sessionen. */
export async function markPlanInviteSeen(planId: number) {
  const user = await actionUser({ renew: false });
  if ("error" in user || !Number.isSafeInteger(planId)) return;
  const res = getDb().prepare("UPDATE plan_collaborators SET seen_at = ? WHERE plan_id = ? AND user_id = ? AND seen_at IS NULL").run(nowIso(), planId, user.id);
  if (res.changes > 0) revalidateAdmin();
}

export async function deletePlan(fd: FormData): Promise<FormState> {
  const user = await actionUser({ renew: false });
  if ("error" in user) return user;
  const id = Number(fd.get("id"));
  const existing = loadPlan(id);
  if (!existing) return { error: "Planen finns inte längre." };
  if (!canChangePlan(user, existing)) return forbidden();
  // Stegen och medarbetarna försvinner med planen. Skickade uppdrag står kvar på tavlan utan plan (ON DELETE SET NULL), och årshjulspunkten
  // blir öppen igen om inget annat är planerat. Trådens meddelanden tas bort här: de hänger på nyckeln plan:<id>, och ett id kan återanvändas.
  const db = getDb();
  db.transaction(() => {
    db.prepare("DELETE FROM chat_reads WHERE channel = ?").run(planChannelKey(id));
    db.prepare("DELETE FROM chat_messages WHERE channel = ?").run(planChannelKey(id));
    db.prepare("DELETE FROM project_plans WHERE id = ?").run(id);
  })();
  audit(user.id, "delete", "project_plan", id, existing.title);
  await renewSessionIfDue();
  revalidateAdmin();
  redirect("/admin/projektplaner?raderad=1");
}

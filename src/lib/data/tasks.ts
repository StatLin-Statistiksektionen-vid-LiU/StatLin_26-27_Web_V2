import "server-only";
import { readDb } from "./db";
import { seesAllTasks } from "@/lib/auth/permissions";
import type { SessionUser, Task, TaskComment, TaskPerson } from "@/lib/types";

/** Avklarade uppdrag ligger kvar på tavlan så här länge. */
const DONE_VISIBLE_DAYS = 30;

const person = (prefix: "f" | "t" | "a") => `
  ${prefix}u.id AS ${prefix}_id, COALESCE(NULLIF(${prefix}u.post, ''), ${prefix}u.name) AS ${prefix}_label,
  CASE WHEN ${prefix}c.kind = 'styrelse' THEN NULL ELSE ${prefix}c.short_name END AS ${prefix}_committee, ${prefix}c.accent AS ${prefix}_accent`;

const TASK_SELECT = `
  SELECT t.*, ${person("f")}, ${person("t")},
    e.title AS event_title, e.slug AS event_slug, e.committee_id AS event_committee_id, pp.title AS plan_title,
    (SELECT COUNT(*) FROM task_comments c WHERE c.task_id = t.id) AS comment_count
  FROM tasks t
  LEFT JOIN users fu ON fu.id = t.from_user_id LEFT JOIN committees fc ON fc.id = fu.committee_id
  LEFT JOIN users tu ON tu.id = t.to_user_id LEFT JOIN committees tc ON tc.id = tu.committee_id
  LEFT JOIN events e ON e.id = t.event_id
  LEFT JOIN project_plans pp ON pp.id = t.project_plan_id`;

type Row = Record<string, unknown>;

function toPerson(r: Row, prefix: "f" | "t" | "a"): TaskPerson | null {
  if (r[`${prefix}_id`] == null) return null;
  return {
    id: r[`${prefix}_id`] as number,
    label: r[`${prefix}_label`] as string,
    committee: (r[`${prefix}_committee`] as string | null) ?? null,
    accent: (r[`${prefix}_accent`] as string | null) ?? null,
  };
}

function toTask(r: Row): Task {
  return {
    id: r.id as number,
    title: r.title as string,
    description: r.description as string,
    from_user_id: r.from_user_id as number | null,
    to_user_id: r.to_user_id as number | null,
    status: r.status as Task["status"],
    shared: r.shared as number,
    due_date: r.due_date as string | null,
    event_id: r.event_id as number | null,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
    completed_at: r.completed_at as string | null,
    from: toPerson(r, "f"),
    to: toPerson(r, "t"),
    event:
      r.event_id != null && r.event_title != null
        ? { id: r.event_id as number, title: r.event_title as string, slug: r.event_slug as string, committee_id: r.event_committee_id as number | null }
        : null,
    comment_count: r.comment_count as number,
    plan: r.project_plan_id != null && r.plan_title != null ? { id: r.project_plan_id as number, title: r.plan_title as string } : null,
  };
}

export type TaskFilter = "alla" | "till" | "fran";

/** Uppdragen användaren får se. Ordförande, vice och info ser allt; övriga det som är delat eller rör dem. */
export async function listTasksFor(user: SessionUser, filter: TaskFilter = "alla"): Promise<Task[]> {
  const db = await readDb();
  const where: string[] = [`(t.status != 'klar' OR t.completed_at > strftime('%Y-%m-%dT%H:%M:%fZ','now','-${DONE_VISIBLE_DAYS} days'))`];
  const params: number[] = [];
  if (!seesAllTasks(user)) {
    where.push("(t.shared = 1 OR t.from_user_id = ? OR t.to_user_id = ?)");
    params.push(user.id, user.id);
  }
  if (filter === "till") {
    where.push("t.to_user_id = ?");
    params.push(user.id);
  } else if (filter === "fran") {
    where.push("t.from_user_id = ?");
    params.push(user.id);
  }
  const rows = db
    .prepare(`${TASK_SELECT} WHERE ${where.join(" AND ")} ORDER BY t.due_date IS NULL, t.due_date, t.created_at DESC`)
    .all(...params) as Row[];
  return rows.map(toTask);
}

/** Öppna uppdrag till användaren, för översikten. */
export async function listOpenTasksTo(userId: number, limit = 5): Promise<Task[]> {
  const db = await readDb();
  const rows = db
    .prepare(`${TASK_SELECT} WHERE t.to_user_id = ? AND t.status != 'klar' ORDER BY t.due_date IS NULL, t.due_date, t.created_at DESC LIMIT ?`)
    .all(userId, limit) as Row[];
  return rows.map(toTask);
}

/** Öppna uppdrag utan mottagare som användaren ser på tavlan, och alltså kan ta. */
export async function countUnclaimedTasks(user: SessionUser): Promise<number> {
  const db = await readDb();
  const visible = seesAllTasks(user) ? "" : "AND (shared = 1 OR from_user_id = @id)";
  return (db.prepare(`SELECT COUNT(*) AS n FROM tasks WHERE to_user_id IS NULL AND status != 'klar' ${visible}`).get({ id: user.id }) as { n: number }).n;
}

/**
 * Uppdrag där mottagaren har bett om hjälp: det användaren själv har skickat först, sedan det som delats med alla poster.
 * Den som bett om hjälp ser uppdraget bland sina egna i stället.
 */
export async function listTasksAskingForHelp(userId: number, limit = 3): Promise<Task[]> {
  const db = await readDb();
  const rows = db
    .prepare(
      `${TASK_SELECT} WHERE t.status = 'hjalp' AND t.to_user_id IS NOT NULL AND t.to_user_id != @id AND (t.from_user_id = @id OR t.shared = 1)
       ORDER BY (t.from_user_id = @id) DESC, t.updated_at DESC LIMIT @limit`,
    )
    .all({ id: userId, limit }) as Row[];
  return rows.map(toTask);
}

export async function getTask(id: number): Promise<Task | null> {
  const db = await readDb();
  const row = db.prepare(`${TASK_SELECT} WHERE t.id = ?`).get(id) as Row | undefined;
  return row ? toTask(row) : null;
}

export async function listTaskComments(taskId: number): Promise<TaskComment[]> {
  const db = await readDb();
  const rows = db
    .prepare(
      `SELECT k.id, k.task_id, k.body, k.created_at, ${person("a")}
       FROM task_comments k
       LEFT JOIN users au ON au.id = k.user_id LEFT JOIN committees ac ON ac.id = au.committee_id
       WHERE k.task_id = ? ORDER BY k.created_at, k.id`,
    )
    .all(taskId) as Row[];
  return rows.map((r) => ({ id: r.id as number, task_id: r.task_id as number, body: r.body as string, created_at: r.created_at as string, author: toPerson(r, "a") }));
}

/**
 * Nya, ej avklarade uppdrag som någon annan gett användaren sedan senaste besöket på tavlan – siffran i
 * sidomenyn. Uppdrag man själv tagit räknas inte (assigned_at är då tomt).
 */
export async function countUnseenTasks(userId: number): Promise<number> {
  const db = await readDb();
  return (
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM tasks
         WHERE to_user_id = ? AND status != 'klar' AND assigned_at IS NOT NULL
           AND assigned_at > COALESCE((SELECT tasks_seen_at FROM users WHERE id = ?), '')`,
      )
      .get(userId, userId) as { n: number }
  ).n;
}

/** Alla aktiva konton som mottagare, styrelsens poster först och sedan utskotten. */
/** Vem en beställning av en affisch ska gå till: den grafiskt ansvariga, om det bara finns en. Annars väljer beställaren själv. */
export async function findDesignRecipient(): Promise<number | null> {
  const db = await readDb();
  const rows = db.prepare("SELECT id FROM users WHERE active = 1 AND design = 1 LIMIT 2").all() as { id: number }[];
  return rows.length === 1 ? rows[0].id : null;
}

export async function listTaskRecipients(): Promise<(TaskPerson & { kind: string })[]> {
  const db = await readDb();
  const rows = db
    .prepare(
      `SELECT u.id AS t_id, COALESCE(NULLIF(u.post, ''), u.name) AS t_label,
         CASE WHEN c.kind = 'styrelse' THEN NULL ELSE c.short_name END AS t_committee, c.accent AS t_accent,
         COALESCE(c.kind, 'ovrigt') AS kind
       FROM users u LEFT JOIN committees c ON c.id = u.committee_id
       WHERE u.active = 1
       ORDER BY CASE c.kind WHEN 'styrelse' THEN 0 WHEN 'utskott' THEN 1 ELSE 2 END, COALESCE(c.sort_order, 999), t_label`,
    )
    .all() as Row[];
  return rows.map((r) => ({ ...(toPerson(r, "t") as TaskPerson), kind: r.kind as string }));
}

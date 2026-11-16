import "server-only";
import { readDb } from "./db";
import { todayLocal } from "@/lib/dates";
import type { Role } from "@/lib/types";

export interface UserListItem {
  id: number;
  email: string;
  name: string;
  post: string;
  role: Role;
  committee_id: number | null;
  committee_name: string | null;
  active: boolean;
  must_change_password: boolean;
  design: boolean;
  last_login_at: string | null;
  created_at: string;
}

type UserListRow = Omit<UserListItem, "active" | "must_change_password" | "design"> & { active: number; must_change_password: number; design: number };
const mapUser = (r: UserListRow): UserListItem => ({
  ...r,
  active: Boolean(r.active),
  must_change_password: Boolean(r.must_change_password),
  design: Boolean(r.design),
});

export async function listUsers(): Promise<UserListItem[]> {
  const db = await readDb();
  const rows = db
    .prepare(
      `SELECT u.id, u.email, u.name, u.post, u.role, u.committee_id, c.short_name AS committee_name, u.active,
        u.must_change_password, u.design, u.last_login_at, u.created_at
       FROM users u LEFT JOIN committees c ON c.id = u.committee_id
       ORDER BY CASE u.role WHEN 'admin' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END, u.name`,
    )
    .all() as UserListRow[];
  return rows.map(mapUser);
}

export async function getUser(id: number): Promise<UserListItem | null> {
  const db = await readDb();
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.name, u.post, u.role, u.committee_id, c.short_name AS committee_name, u.active,
          u.must_change_password, u.design, u.last_login_at, u.created_at
         FROM users u LEFT JOIN committees c ON c.id = u.committee_id WHERE u.id = ?`,
    )
    .get(id) as UserListRow | undefined;
  return row ? mapUser(row) : null;
}

export interface AuditItem {
  id: number;
  action: string;
  entity: string;
  entity_id: string | null;
  summary: string;
  created_at: string;
  user_name: string | null;
  user_post: string | null;
}

/**
 * Senaste ändringarna. Inloggningar är inga ändringar och tas inte med – utom på kontosidan (userId), som också
 * visar misslyckade inloggningar mot kontot: login_failed har kontot som entity_id och ingen användare.
 */
export async function listAudit(limit = 12, userId?: number): Promise<AuditItem[]> {
  const db = await readDb();
  const where = userId
    ? "(a.user_id = @userId AND a.action NOT IN ('login', 'login_failed')) OR (a.action = 'login_failed' AND a.entity = 'user' AND a.entity_id = @entityId)"
    : "a.action NOT IN ('login', 'login_failed')";
  return db
    .prepare(
      `SELECT a.id, a.action, a.entity, a.entity_id, a.summary, a.created_at, u.name AS user_name, u.post AS user_post
       FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
       WHERE ${where}
       ORDER BY a.id DESC LIMIT @limit`,
    )
    .all({ limit, userId: userId ?? null, entityId: userId ? String(userId) : null }) as AuditItem[];
}

export async function sessionCount(userId: number): Promise<number> {
  const db = await readDb();
  return (db.prepare("SELECT COUNT(*) AS n FROM sessions WHERE user_id = ? AND expires_at > ?").get(userId, new Date().toISOString()) as { n: number }).n;
}

/** Vad sektionen har hunnit med under verksamhetsåret, 1 juli till 30 juni: evenemang som har varit, nyheter och klara uppdrag. Står i hälsningen på översikten. */
export async function yearInNumbers() {
  const today = todayLocal();
  const year = Number(today.slice(0, 4)) - (today.slice(5, 7) < "07" ? 1 : 0);
  const db = await readDb();
  const counts = db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM events WHERE published = 1 AND starts_at >= @start AND starts_at < @today) AS events,
              (SELECT COUNT(*) FROM news WHERE published = 1 AND published_at >= @start AND published_at <= @now) AS news,
              (SELECT COUNT(*) FROM tasks WHERE status = 'klar' AND completed_at >= @start) AS tasks`,
    )
    .get({ start: `${year}-07-01`, today, now: new Date().toISOString() }) as { events: number; news: number; tasks: number };
  return { label: `${year}/${String(year + 1).slice(2)}`, ...counts };
}

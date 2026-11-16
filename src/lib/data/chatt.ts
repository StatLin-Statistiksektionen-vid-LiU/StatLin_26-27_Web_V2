import "server-only";
import type Database from "better-sqlite3";
import { readDb } from "./db";
import { kontoKaraktar } from "./karaktar";
import { canUsePlanThread, isPlanParticipant } from "@/lib/auth/permissions";
import { CHAT_PAGE_SIZE, planChannelKey, planIdOf, type ChatAuthor, type ChatChannel, type ChatChannelSummary, type ChatMessage } from "@/lib/chatt";
import { karaktarFor } from "@/lib/karaktar";
import type { SessionUser } from "@/lib/types";

/** Så många nya meddelanden lämnar en hämtning som mest. Resten kommer med nästa, som börjar där den här slutade. */
const POLL_LIMIT = 200;
/** Början av det senaste meddelandet räcker till raden i kanallistan. */
const PREVIEW_LENGTH = 120;

const MESSAGE_SELECT = `
  SELECT m.id, m.body, m.created_at, m.deleted_at, u.id AS author_id, u.name AS author_name, u.post AS author_post,
    c.slug AS committee_slug, c.accent AS committee_accent, c.kind AS committee_kind
  FROM chat_messages m
  LEFT JOIN users u ON u.id = m.user_id
  LEFT JOIN committees c ON c.id = u.committee_id`;

type MessageRow = {
  id: number;
  body: string;
  created_at: string;
  deleted_at: string | null;
  author_id: number | null;
  author_name: string | null;
  author_post: string | null;
  committee_slug: string | null;
  committee_accent: string | null;
  committee_kind: string | null;
};

/** Avsändaren får samma färg som kontot har i portalen (karaktarFor): utskottets, eller postens för styrelsen. */
function toMessage(r: MessageRow): ChatMessage {
  const committee = r.committee_slug && r.committee_accent && r.committee_kind ? { slug: r.committee_slug, accent: r.committee_accent, kind: r.committee_kind } : null;
  return {
    id: r.id,
    body: r.body,
    created_at: r.created_at,
    deleted: r.deleted_at !== null,
    author: r.author_id === null ? null : { id: r.author_id, name: r.author_name ?? "", post: r.author_post ?? "", color: karaktarFor(r.author_post ?? "", committee).farg },
  };
}

/** Kontot som avsändare, för meddelandet det just skickade och för det som väntar på att skickas. Samma färg som i toMessage. */
export async function chatAuthor(user: SessionUser): Promise<ChatAuthor> {
  return { id: user.id, name: user.name, post: user.post, color: (await kontoKaraktar(user.post, user.committee_id)).farg };
}

/** Planen som tråd: vem som äger den och om kontot är inbjudet. */
type PlanRow = { id: number; title: string; owner_user_id: number | null; responsible: string; collab_all: number; invited: number };
const PLAN_ROWS = `
  SELECT p.id, p.title, p.owner_user_id, p.responsible, p.collab_all,
    EXISTS(SELECT 1 FROM plan_collaborators k WHERE k.plan_id = p.id AND k.user_id = ?) AS invited
  FROM project_plans p`;
const toChannel = (p: PlanRow): ChatChannel => ({ key: planChannelKey(p.id), name: p.title, audience: p.collab_all ? "Hela StatLin är med" : "Planens medarbetare" });

/** Kontots trådar: planerna det är med i (isPlanParticipant). Det är de som räknas som olästa och ger aviseringar. */
export async function listChannels(user: SessionUser): Promise<ChatChannel[]> {
  const rows = (await readDb()).prepare(`${PLAN_ROWS} ORDER BY p.plan_date DESC, p.id DESC`).all(user.id) as PlanRow[];
  return rows.filter((p) => isPlanParticipant(user, p, p.invited === 1)).map(toChannel);
}

/** Tråden, om kontot får läsa och skriva i den. Varje läsning och skrivning går genom den här. */
export async function findChannel(user: SessionUser, key: string): Promise<ChatChannel | null> {
  const id = planIdOf(key);
  if (id === null) return null;
  const plan = (await readDb()).prepare(`${PLAN_ROWS} WHERE p.id = ?`).get(user.id, id) as PlanRow | undefined;
  return plan && canUsePlanThread(user, plan, plan.invited === 1) ? toChannel(plan) : null;
}

/**
 * Olästa per kanal: det andra har skrivit efter kontots läsmärke och som inte är borttaget. Räknas kanal för kanal, så att indexet
 * på (channel, id) börjar vid läsmärket i stället för att gå igenom hela kanalen.
 */
function unreadCounts(db: Database.Database, userId: number, keys: string[]): Map<string, number> {
  const reads = new Map((db.prepare("SELECT channel, last_read_id FROM chat_reads WHERE user_id = ?").all(userId) as { channel: string; last_read_id: number }[]).map((r) => [r.channel, r.last_read_id]));
  const count = db.prepare("SELECT COUNT(*) AS n FROM chat_messages WHERE channel = ? AND id > ? AND deleted_at IS NULL AND user_id IS NOT ?");
  return new Map(keys.map((key) => [key, (count.get(key, reads.get(key) ?? 0, userId) as { n: number }).n]));
}

/** Siffran vid Chatt i sidomenyn: olästa meddelanden i alla kontots kanaler. */
export async function countUnreadChat(user: SessionUser): Promise<number> {
  const channels = await listChannels(user);
  const db = await readDb();
  let total = 0;
  for (const n of unreadCounts(db, user.id, channels.map((c) => c.key)).values()) total += n;
  return total;
}

/** Kanallistan: varje kanal med antalet olästa och början av det senaste meddelandet. */
export async function listChannelSummaries(user: SessionUser): Promise<ChatChannelSummary[]> {
  const channels = await listChannels(user);
  const db = await readDb();
  const unread = unreadCounts(db, user.id, channels.map((c) => c.key));
  const last = db.prepare(
    `SELECT m.id, substr(m.body, 1, ${PREVIEW_LENGTH}) AS body, m.created_at, m.deleted_at IS NOT NULL AS deleted, u.id AS author_id, u.name AS author_name
     FROM chat_messages m LEFT JOIN users u ON u.id = m.user_id
     WHERE m.channel = ? ORDER BY m.id DESC LIMIT 1`,
  );
  const summaries = channels.map((channel) => {
    const row = last.get(channel.key) as (Omit<NonNullable<ChatChannelSummary["last"]>, "deleted"> & { deleted: number }) | undefined;
    return { ...channel, unread: unread.get(channel.key) ?? 0, last: row ? { ...row, deleted: row.deleted === 1 } : null };
  });
  // Den där det senast skrevs står först. Trådar utan meddelanden behåller planernas ordning, senaste datumet först.
  return summaries.sort((a, b) => (b.last?.id ?? 0) - (a.last?.id ?? 0));
}

/** Hur långt kontot har läst i kanalen. 0 när kanalen aldrig har öppnats. */
export async function getLastReadId(userId: number, channel: string): Promise<number> {
  const db = await readDb();
  const row = db.prepare("SELECT last_read_id FROM chat_reads WHERE user_id = ? AND channel = ?").get(userId, channel) as { last_read_id: number } | undefined;
  return row?.last_read_id ?? 0;
}

/**
 * En sida med meddelanden, äldst först: de senaste i kanalen, eller de närmast före ett visst meddelande (before). hasOlder säger om
 * det finns fler längre bak.
 */
export async function listMessages(channel: string, before?: number): Promise<{ messages: ChatMessage[]; hasOlder: boolean }> {
  const db = await readDb();
  const rows = db
    .prepare(`${MESSAGE_SELECT} WHERE m.channel = ? AND m.id < ? ORDER BY m.id DESC LIMIT ?`)
    .all(channel, before ?? Number.MAX_SAFE_INTEGER, CHAT_PAGE_SIZE + 1) as MessageRow[];
  return { messages: rows.slice(0, CHAT_PAGE_SIZE).reverse().map(toMessage), hasOlder: rows.length > CHAT_PAGE_SIZE };
}

/** Det som skrivits i kanalen efter ett visst meddelande, äldst först. */
export async function listMessagesAfter(channel: string, after: number): Promise<ChatMessage[]> {
  const db = await readDb();
  const rows = db.prepare(`${MESSAGE_SELECT} WHERE m.channel = ? AND m.id > ? ORDER BY m.id LIMIT ?`).all(channel, after, POLL_LIMIT) as MessageRow[];
  return rows.map(toMessage);
}

/** Meddelanden i kanalen som tagits bort sedan en tidpunkt, så att de som har kanalen öppen ser det utan att ladda om. */
export async function listDeletedSince(channel: string, since: string): Promise<number[]> {
  const db = await readDb();
  return (db.prepare("SELECT id FROM chat_messages WHERE channel = ? AND deleted_at >= ?").all(channel, since) as { id: number }[]).map((r) => r.id);
}

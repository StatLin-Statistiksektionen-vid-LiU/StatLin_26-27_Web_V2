import "server-only";
import { todayLocal } from "@/lib/dates";
import { readDb } from "./db";

/** proposed: väntar på ordförandens beslut. agenda: står på dagordningen. declined: avslagen eller struken. */
export type MeetingItemStatus = "proposed" | "agenda" | "declined";

export type Meeting = {
  id: number;
  /** Lokal tid i Stockholm, "YYYY-MM-DDTHH:mm", som evenemangen. */
  starts_at: string;
  place: string;
  note: string;
  /** Förslag som väntar på beslut. */
  waiting: number;
};

export type MeetingItem = {
  id: number;
  title: string;
  description: string;
  status: MeetingItemStatus;
  sort_order: number;
  proposed_by: number | null;
  /** Namnet på den som föreslog punkten. Null för mallens och ordförandens egna punkter, och om kontot är borttaget. */
  proposer: string | null;
  created_at: string;
};

const MEETING_COLUMNS = `m.id, m.starts_at, m.place, m.note,
  (SELECT COUNT(*) FROM meeting_items i WHERE i.meeting_id = m.id AND i.status = 'proposed') AS waiting`;

/** Ett möte räknas som kommande hela dagen det hålls, så att det står kvar som nästa möte medan det pågår. */
export async function listMeetings(): Promise<{ upcoming: Meeting[]; past: Meeting[] }> {
  const db = await readDb();
  const rows = db.prepare(`SELECT ${MEETING_COLUMNS} FROM meetings m ORDER BY m.starts_at, m.id`).all() as Meeting[];
  const today = todayLocal();
  return {
    upcoming: rows.filter((m) => m.starts_at.slice(0, 10) >= today),
    past: rows.filter((m) => m.starts_at.slice(0, 10) < today).reverse(),
  };
}

export async function getNextMeeting(): Promise<Meeting | null> {
  const db = await readDb();
  const row = db.prepare(`SELECT ${MEETING_COLUMNS} FROM meetings m WHERE substr(m.starts_at, 1, 10) >= ? ORDER BY m.starts_at, m.id LIMIT 1`).get(todayLocal());
  return (row as Meeting | undefined) ?? null;
}

export async function getMeeting(id: number): Promise<{ meeting: Meeting; items: MeetingItem[] } | null> {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const db = await readDb();
  const meeting = db.prepare(`SELECT ${MEETING_COLUMNS} FROM meetings m WHERE m.id = ?`).get(id) as Meeting | undefined;
  if (!meeting) return null;
  const items = db
    .prepare(
      `SELECT i.id, i.title, i.description, i.status, i.sort_order, i.proposed_by, u.name AS proposer, i.created_at
       FROM meeting_items i LEFT JOIN users u ON u.id = i.proposed_by
       WHERE i.meeting_id = ? ORDER BY i.sort_order, i.id`,
    )
    .all(id) as MeetingItem[];
  return { meeting, items };
}

/** Mötet har varit när dagen är slut. Då går det inte längre att föreslå punkter. */
export const isPastMeeting = (m: Pick<Meeting, "starts_at">) => m.starts_at.slice(0, 10) < todayLocal();

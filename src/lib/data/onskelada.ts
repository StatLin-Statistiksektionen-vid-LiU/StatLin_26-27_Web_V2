import "server-only";
import { readDb } from "./db";

export type CommitteeWish = { id: number; body: string; month: string; handled: boolean };

/** Det som väntar först. Inom en månad är ordningen slumpad, eftersom id:t slumpas när önskemålet sparas. */
export async function listCommitteeWishes(committeeId: number): Promise<CommitteeWish[]> {
  const db = await readDb();
  const rows = db
    .prepare("SELECT id, body, month, handled FROM committee_wishes WHERE committee_id = ? ORDER BY handled, month DESC, id")
    .all(committeeId) as { id: number; body: string; month: string; handled: number }[];
  return rows.map((r) => ({ ...r, handled: r.handled === 1 }));
}

/** Siffran i sidomenyn: önskemål som utskottets konto inte har sett än. */
export async function countNewCommitteeWishes(committeeId: number | null): Promise<number> {
  if (!committeeId) return 0;
  const db = await readDb();
  return (db.prepare("SELECT COUNT(*) AS n FROM committee_wishes WHERE committee_id = ? AND seen = 0").get(committeeId) as { n: number }).n;
}

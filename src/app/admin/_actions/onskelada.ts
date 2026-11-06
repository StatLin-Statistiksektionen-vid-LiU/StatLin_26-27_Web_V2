"use server";

import { revalidatePath } from "next/cache";
import { audit, revalidateSite } from "@/lib/admin/helpers";
import { canEditCommittee } from "@/lib/auth/permissions";
import { actionUser, renewSessionIfDue, requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";

/*
 * Utskottets önskelåda. Samma regel som för att redigera utskottets sida: utskottets eget konto och redaktörerna slår på och av den och
 * läser det som kommer in. Audit-loggen får bara av och på, aldrig något om enskilda önskemål.
 */

type CommitteeRef = { id: number; short_name: string; kind: string };

const idFrom = (fd: FormData) => {
  const id = Number(fd.get("id"));
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

/** Knapparna har ingen text som kan gå förlorad, så en utgången session går till inloggningen och tillbaka. */
async function buttonUser() {
  const user = await requireUser();
  await renewSessionIfDue();
  return user;
}

/** Sidan och sidomenyns siffra ligger båda under /admin. */
const revalidateInbox = () => revalidatePath("/admin", "layout");

function wishCommittee(wishId: number) {
  return getDb().prepare("SELECT committee_id FROM committee_wishes WHERE id = ?").get(wishId) as { committee_id: number } | undefined;
}

export async function setWishesOpen(fd: FormData): Promise<void> {
  const user = await buttonUser();
  const id = idFrom(fd);
  const db = getDb();
  const c = id ? (db.prepare("SELECT id, short_name, kind FROM committees WHERE id = ?").get(id) as CommitteeRef | undefined) : undefined;
  if (!c || c.kind === "styrelse" || !canEditCommittee(user, c.id)) return;
  const open = fd.get("open") === "1";
  db.prepare("UPDATE committees SET wishes_open = ? WHERE id = ?").run(open ? 1 : 0, c.id);
  audit(user.id, "update", "committee", c.id, `${open ? "Öppnade" : "Stängde"} önskelådan för ${c.short_name}`);
  // Formuläret på utskottets sida kommer och går med lådan.
  revalidateSite();
}

export async function setWishHandled(fd: FormData): Promise<void> {
  const user = await buttonUser();
  const id = idFrom(fd);
  const row = id ? wishCommittee(id) : undefined;
  if (!row || !canEditCommittee(user, row.committee_id)) return;
  getDb().prepare("UPDATE committee_wishes SET handled = ?, seen = 1 WHERE id = ?").run(fd.get("handled") === "1" ? 1 : 0, id);
  revalidateInbox();
}

/** Bara det som är klart går att ta bort, så att ett felklick aldrig raderar något som ingen har läst. */
export async function deleteWish(fd: FormData): Promise<void> {
  const user = await buttonUser();
  const id = idFrom(fd);
  const row = id ? wishCommittee(id) : undefined;
  if (!row || !canEditCommittee(user, row.committee_id)) return;
  const db = getDb();
  // Raderade önskemål ska inte ligga kvar som lästa rester i databasfilen.
  db.pragma("secure_delete = ON");
  db.prepare("DELETE FROM committee_wishes WHERE id = ? AND handled = 1").run(id);
  revalidateInbox();
}

/** Nollställer siffran i sidomenyn när utskottets eget konto har sett lådan. En redaktör som tittar in tar inte bort den. */
export async function markWishesSeen(committeeId: number): Promise<void> {
  const user = await actionUser({ renew: false });
  if ("error" in user) return;
  if (!Number.isSafeInteger(committeeId) || user.role !== "committee" || user.committee_id !== committeeId) return;
  const { changes } = getDb().prepare("UPDATE committee_wishes SET seen = 1 WHERE seen = 0 AND committee_id = ?").run(committeeId);
  if (changes) revalidateInbox();
}

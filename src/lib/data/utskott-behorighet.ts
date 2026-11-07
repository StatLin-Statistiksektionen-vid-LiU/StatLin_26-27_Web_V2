import "server-only";
import { isEditor } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db";
import type { SessionUser } from "@/lib/types";

/** Redaktörerna, och kontot som hör till utskottet med den här sluggen. */
export function canManageCommitteeSlug(user: Pick<SessionUser, "role" | "committee_id">, slug: string): boolean {
  if (isEditor(user)) return true;
  if (user.role !== "committee" || user.committee_id === null) return false;
  const c = getDb().prepare("SELECT id FROM committees WHERE slug = ?").get(slug) as { id: number } | undefined;
  return c?.id === user.committee_id;
}

/** UBU:s knappar, som den till kursutvärderingarna: redaktörerna och UBU:s konto. */
export const canManageUbu = (user: Pick<SessionUser, "role" | "committee_id">) => canManageCommitteeSlug(user, "ubu");

/** eSTIG:s sida, som Discordknappen och spelönskemålen: redaktörerna och eSTIG:s konto. */
export const canManageEstig = (user: Pick<SessionUser, "role" | "committee_id">) => canManageCommitteeSlug(user, "estig");

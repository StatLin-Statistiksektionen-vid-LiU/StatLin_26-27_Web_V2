import { matchesResponsible } from "@/lib/arshjul";
import type { DocumentCategory, SessionUser } from "@/lib/types";

type Owned = { committee_id: number | null };
/** Det behörigheterna bygger på. Räcker även i webbläsaren, där redigeringsläget visar pennor efter samma regler. */
type Who = Pick<SessionUser, "role" | "committee_id">;
type Designer = Who & Pick<SessionUser, "design">;

export const isAdmin = (u: Who) => u.role === "admin";
export const isEditor = (u: Who) => u.role === "admin" || u.role === "editor";

/** Evenemang och nyheter: redaktörer allt, utskott sitt eget. */
export function canEditOwned(u: Who, item: Owned): boolean {
  if (isEditor(u)) return true;
  return u.role === "committee" && u.committee_id !== null && item.committee_id === u.committee_id;
}

export function canEditCommittee(u: Who, committeeId: number): boolean {
  if (isEditor(u)) return true;
  return u.role === "committee" && u.committee_id === committeeId;
}

/* Uppdragstavlan: ordförande, vice och info (administratörer och redaktörer) ser och får ändra allt. */
type TaskRef = { from_user_id: number | null; to_user_id: number | null; shared: number };

export const seesAllTasks = isEditor;

/** Övriga ser det som delats med hela styrelsen och det de själva skickat eller fått. */
export function canSeeTask(u: SessionUser, t: TaskRef): boolean {
  return seesAllTasks(u) || t.shared === 1 || t.from_user_id === u.id || t.to_user_id === u.id;
}

/** Status: avsändaren och mottagaren. */
export function canUpdateTask(u: SessionUser, t: TaskRef): boolean {
  return seesAllTasks(u) || t.from_user_id === u.id || t.to_user_id === u.id;
}

/** Titel, beskrivning, mottagare och borttagning: bara avsändaren. */
export function canEditTask(u: SessionUser, t: TaskRef): boolean {
  return seesAllTasks(u) || t.from_user_id === u.id;
}

/* Årshjulet och projektplanerna: alla poster läser och lägger till. Ändra får admin, den som la in det och den ansvariga posten. */
type Stewarded = { owner_user_id: number | null; responsible: string };
type Steward = Pick<SessionUser, "id" | "role" | "committee_id" | "post" | "committee_name">;

export const canChangeWheelItem = (u: Steward, item: Stewarded) => isAdmin(u) || item.owner_user_id === u.id || matchesResponsible(u, item.responsible);
export const canChangePlan = canChangeWheelItem;

/* Grafiskt ansvar (flaggan under Konton): bilderna på hela sajten. Texterna följer fortfarande rollen. */
export const hasDesign = (u: Pick<SessionUser, "design">) => !!u.design;

/** Omslag och galleri på evenemang, omslag på nyheter och utskottens loggor. */
export const canEditImages = (u: Designer, item: Owned) => canEditOwned(u, item) || hasDesign(u);

/** Adminsidan Bilder, med alla omslag och loggor på ett ställe. */
export const canManageImages = (u: Designer) => isEditor(u) || hasDesign(u);

/** Dokument: redaktörer alla kategorier, grafiskt ansvarig bara det grafiska materialet. */
export const canManageDocuments = (u: Designer) => isEditor(u) || hasDesign(u);
export const canManageDocument = (u: Designer, category: DocumentCategory) => isEditor(u) || (hasDesign(u) && category === "grafiskt");

/* Frågelådan: bara kontot som äger lådan läser frågorna. Administratörer ser titlar och antal och kan ta bort lådor med kod. */
type BoxRef = { owner_id: number | null; slug: string | null };
export const ownsBox = (u: Pick<SessionUser, "id">, box: BoxRef) => box.owner_id === u.id;
export const canDeleteBox = (u: Pick<SessionUser, "id" | "role" | "committee_id">, box: BoxRef) => box.slug === null && (ownsBox(u, box) || isAdmin(u));
export const canManageFragelada = isAdmin;
export const canReviewEvents = isAdmin;
export const canManageSettings = isEditor;

/*
 * Styrelsemötena: ordföranden lägger in mötena, sköter mallen och bestämmer vad som kommer med på dagordningen. Ordföranden känns
 * igen på posten Ordförande (inte Ordförande SCB och liknande), och administratörerna kan alltid. Alla konton i portalen ser
 * mötena och kan föreslå punkter.
 */
export const canManageMeetings = (u: Pick<SessionUser, "role" | "post">) => u.role === "admin" || /^ordförande$/i.test(u.post.trim());

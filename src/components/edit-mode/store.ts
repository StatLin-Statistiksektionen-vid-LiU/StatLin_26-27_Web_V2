import { useSyncExternalStore } from "react";
import { canEditCommittee, canEditImages, canEditOwned, canManageSettings, isEditor } from "@/lib/auth/permissions";
import type { SiteTextGroup } from "@/lib/site-texts";
import type { SessionUser } from "@/lib/types";

/**
 * Redigeringsläget på sajten. Sidorna läser aldrig sessionen själva, så de kan fortsätta vara statiska.
 * I stället lägger adminlisten in den inloggade användaren här, och pennorna prenumererar på det.
 * Behörigheten speglar permissions.ts; servern kontrollerar alltid igen när något hämtas eller sparas.
 */

/**
 * naringsliv: kontot får ändra det som hör till näringslivet, som Vad studenterna kan. ubu: kontot får ändra UBU:s knappar.
 * estig: kontot får ändra det som är eget för eSTIG:s sida. Servern räknar ut alla tre, se admin-bar-loader.tsx.
 */
export type EditUser = Pick<SessionUser, "id" | "name" | "post" | "role" | "committee_id" | "committee_name" | "design"> & { naringsliv?: boolean; ubu?: boolean; estig?: boolean };

export type EditTarget =
  | { type: "page"; slug: string }
  | { type: "home" }
  | { type: "footer" }
  /** Kontaktuppgifterna och sociala medier, t.ex. på kontaktsidan. De sparas under Inställningar. */
  | { type: "contact" }
  /** En grupp av sajtens fasta texter, se site-texts.ts: rubrikerna på startsidan och huvudena på listsidorna. */
  | { type: "texts"; group: SiteTextGroup }
  | { type: "committee"; id: number }
  | { type: "event"; id: number; committeeId: number | null }
  | { type: "news"; id: number; committeeId: number | null }
  | { type: "board"; id: number }
  /** Bara bilderna – även för grafiskt ansvarig, som inte får ändra texten. */
  | { type: "event-images"; id: number; committeeId: number | null }
  | { type: "news-cover"; id: number; committeeId: number | null }
  /** Hjälpmedlen sköts i adminpanelen. Målet styr bara vem som ser länken dit. */
  | { type: "resources" }
  /** STAR-sidans texter. Sidan ritar pennan bara för dem som får ändra den, och servern kontrollerar igen. */
  | { type: "star" };

/**
 * dirty: formuläret i panelen har osparade ändringar – panelen frågar innan den stängs.
 * uploading: ett formulär i panelen laddar upp en bild – panelen stängs inte då.
 * asking: panelen väntar på svar om de osparade ändringarna, i en dialog på sidan (se ConfirmDialog).
 */
type State = {
  user: EditUser | null;
  editing: boolean;
  open: EditTarget | null;
  flash: string | null;
  dirty: boolean;
  uploading: boolean;
  asking: { after?: () => void } | null;
};

const KEY = "statlin-redigeringslage";
const SERVER: State = { user: null, editing: false, open: null, flash: null, dirty: false, uploading: false, asking: null };
const UPLOADING = "En bild laddas fortfarande upp. Vänta tills den är klar innan du stänger panelen.";
export const UNSAVED = "Du har osparade ändringar. Stäng ändå?";
let state: State = SERVER;
const listeners = new Set<() => void>();
let flashTimer: ReturnType<typeof setTimeout> | undefined;

function set(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function readPreference(): boolean {
  try {
    return localStorage.getItem(KEY) !== "av";
  } catch {
    return true;
  }
}

export const editStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get: () => state,
  setUser(user: EditUser | null) {
    set({ user, editing: user ? readPreference() : false, open: null, dirty: false, uploading: false, asking: null });
  },
  setEditing(editing: boolean) {
    try {
      localStorage.setItem(KEY, editing ? "pa" : "av");
    } catch {
      /* privat läge – valet gäller bara den här sidvisningen */
    }
    set(editing ? { editing } : { editing, open: null, dirty: false, uploading: false, asking: null });
  },
  open(target: EditTarget) {
    set({ open: target, dirty: false, uploading: false, asking: null });
  },
  close(flash?: string) {
    clearTimeout(flashTimer);
    set({ open: null, flash: flash ?? null, dirty: false, uploading: false, asking: null });
    if (flash) flashTimer = setTimeout(() => set({ flash: null }), 3500);
  },
  /**
   * Stängning som användaren bett om – Escape, klick utanför, stängknappen, länken till adminpanelen eller ett
   * adressbyte. Under en uppladdning står panelen kvar, och med osparade ändringar frågar den först.
   * Returnerar false om panelen inte stängdes just nu. Blir svaret ja på frågan körs `after`.
   */
  requestClose(after?: () => void): boolean {
    if (!state.open) return true;
    if (state.uploading) {
      window.alert(UPLOADING);
      return false;
    }
    if (state.dirty) {
      set({ asking: { after } });
      return false;
    }
    editStore.close();
    return true;
  },
  /** Svaret på frågan om osparade ändringar. `after` är det som skulle ha hänt om panelen fått stängas direkt. */
  answerClose(yes: boolean) {
    const after = state.asking?.after;
    set({ asking: null });
    if (!yes) return;
    editStore.close();
    after?.();
  },
  setDirty(dirty: boolean) {
    if (state.dirty !== dirty) set({ dirty });
  },
  setUploading(uploading: boolean) {
    if (state.uploading !== uploading) set({ uploading });
  },
};

export function useEditState(): State {
  return useSyncExternalStore(editStore.subscribe, editStore.get, () => SERVER);
}

export function canEditTarget(user: EditUser, target: EditTarget): boolean {
  switch (target.type) {
    case "page":
    case "board":
      return isEditor(user);
    case "home":
    case "footer":
    case "contact":
    case "texts":
      return canManageSettings(user);
    case "committee":
      return canEditCommittee(user, target.id);
    case "event":
    case "news":
      return canEditOwned(user, { committee_id: target.committeeId });
    case "event-images":
    case "news-cover":
      return canEditImages(user, { committee_id: target.committeeId });
    case "resources":
    case "star":
      return true;
  }
}

/** Frågesträngen till /api/admin/redigera. */
export function targetQuery(target: EditTarget): string {
  const p = new URLSearchParams({ typ: target.type });
  if ("id" in target) p.set("id", String(target.id));
  if ("slug" in target) p.set("slug", target.slug);
  if ("group" in target) p.set("grupp", target.group);
  return p.toString();
}

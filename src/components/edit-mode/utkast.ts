import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { canManageSettings } from "@/lib/auth/permissions";
import { postBehorighet, stabil } from "@/lib/innehall/poster";
import { editStore, useEditState, type EditUser } from "./store";

/**
 * Ändringarna i redigeringsläget innan de sparas. Varje post (se src/lib/innehall/poster.ts) har ett utkast med det nya
 * värdet och `bas`, värdet som sidan visade när ändringen började. Servern jämför bas med det som står i databasen, så att
 * ingen skriver över någon annans sparning utan att veta om det.
 *
 * Utkasten visas bara för den inloggade som gjort dem, och de ligger kvar i fliken (sessionStorage) om sidan laddas om.
 * Efter en sparning står utkastet kvar tills sidan har fått det nya värdet från servern, så att den gamla texten inte
 * blinkar fram emellan.
 */

export type Utkast = { varde: unknown; bas: string; sparat?: boolean };
type State = {
  utkast: Record<string, Utkast>;
  /** Ångra tar ett steg tillbaka i den här listan: posten och dess utkast före ändringen. */
  historik: { id: string; fore?: Utkast }[];
  /** Förhandsvisa: utkasten syns men inte ramarna och knapparna. */
  forhandsvisa: boolean;
};

const KEY = "statlin-utkast";
const SERVER: State = { utkast: {}, historik: [], forhandsvisa: false };
let state: State = SERVER;
let inlast = false;
const listeners = new Set<() => void>();

function lasIn() {
  if (inlast || typeof window === "undefined") return;
  inlast = true;
  try {
    const sparat: unknown = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
    if (sparat && typeof sparat === "object") state = { ...state, utkast: sparat as Record<string, Utkast> };
  } catch {
    /* trasigt eller privat läge: börja om */
  }
}

function skrivUt() {
  try {
    const osparade = Object.entries(state.utkast).filter(([, u]) => !u.sparat);
    if (osparade.length) sessionStorage.setItem(KEY, JSON.stringify(Object.fromEntries(osparade)));
    else sessionStorage.removeItem(KEY);
  } catch {
    /* fullt eller privat läge: utkasten gäller bara den här sidvisningen */
  }
}

function set(next: Partial<State>) {
  state = { ...state, ...next };
  skrivUt();
  listeners.forEach((l) => l());
}

export const utkastStore = {
  subscribe(listener: () => void) {
    lasIn();
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get: () => state,
  /** Ett nytt värde för posten. Är det samma som sidan visade försvinner utkastet. */
  satt(id: string, varde: unknown, bas: string) {
    const utkast = { ...state.utkast };
    const fore = utkast[id];
    // Nyss sparat men sidan har inte fått det nya värdet än: det sparade är det som står i databasen nu.
    if (fore?.sparat) {
      if (stabil(varde) === stabil(fore.varde)) return;
      bas = stabil(fore.varde);
    }
    if (stabil(varde) === bas) delete utkast[id];
    else utkast[id] = { varde, bas };
    set({ utkast, historik: [...state.historik, { id, fore }].slice(-200) });
  },
  angra() {
    const sista = state.historik.at(-1);
    if (!sista) return;
    const utkast = { ...state.utkast };
    if (sista.fore && !sista.fore.sparat) utkast[sista.id] = sista.fore;
    else delete utkast[sista.id];
    set({ utkast, historik: state.historik.slice(0, -1) });
  },
  /** Tar bort alla ändringar av en post. */
  angraPost(id: string) {
    const utkast = { ...state.utkast };
    delete utkast[id];
    set({ utkast, historik: state.historik.filter((h) => h.id !== id) });
  },
  kasta() {
    set({ utkast: Object.fromEntries(Object.entries(state.utkast).filter(([, u]) => u.sparat)), historik: [] });
  },
  /**
   * Efter en sparning: utkasten står kvar med värdena som servern sparade, tills sidan har fått dem. Samma sak när en
   * sparning ångras, då med de gamla värdena.
   */
  visaSparat(varden: Record<string, unknown>) {
    const utkast = { ...state.utkast };
    for (const [id, varde] of Object.entries(varden)) utkast[id] = { varde, bas: stabil(varde), sparat: true };
    set({ utkast, historik: state.historik.filter((h) => !Object.hasOwn(varden, h.id)) });
  },
  /** Släpper sparade utkast, när sidan har fått värdet från servern eller som sista utväg efter en stund. */
  slappSparade(id?: string) {
    const kvar = Object.entries(state.utkast).filter(([key, u]) => !u.sparat || (id !== undefined && key !== id));
    if (kvar.length !== Object.keys(state.utkast).length) set({ utkast: Object.fromEntries(kvar) });
  },
  setForhandsvisa(forhandsvisa: boolean) {
    if (state.forhandsvisa !== forhandsvisa) set({ forhandsvisa });
  },
};

export function useUtkastState(): State {
  return useSyncExternalStore(utkastStore.subscribe, utkastStore.get, () => SERVER);
}

export function kanAndraPost(user: EditUser, id: string): boolean {
  const behorighet = postBehorighet(id);
  if (behorighet === "installningar") return canManageSettings(user);
  if (behorighet === "naringsliv") return !!user.naringsliv;
  if (behorighet === "ubu") return !!user.ubu;
  if (behorighet === "estig") return !!user.estig;
  return false;
}

/** Värdet att visa: utkastet för den som är inloggad, annars det sidan fick från servern. */
export function useUtkast<T>(id: string, server: T): T {
  const utkast = useSyncExternalStore(
    utkastStore.subscribe,
    () => utkastStore.get().utkast[id],
    () => undefined,
  );
  const inloggad = useSyncExternalStore(
    editStore.subscribe,
    () => editStore.get().user !== null,
    () => false,
  );
  useEffect(() => {
    if (utkast?.sparat && stabil(server) === stabil(utkast.varde)) utkastStore.slappSparade(id);
  }, [utkast, server, id]);
  return utkast && inloggad ? (utkast.varde as T) : server;
}

/** Om ramarna och knapparna för posten ska synas: redigeringsläget är på, ingen förhandsvisning och kontot får ändra den. */
export function useRedigera(id: string): boolean {
  const { user, editing } = useEditState();
  const forhandsvisa = useSyncExternalStore(
    utkastStore.subscribe,
    () => utkastStore.get().forhandsvisa,
    () => false,
  );
  return !!user && editing && !forhandsvisa && kanAndraPost(user, id);
}

/**
 * Ett block med struktur: värdet att visa, om det går att ändra, och `andra` som tar en funktion som ändrar en kopia.
 * Varje anrop blir ett steg att ångra.
 */
export function useBlock<T>(id: `b:${string}`, server: T) {
  const varde = useUtkast(id, server);
  const aktiv = useRedigera(id);
  const bas = useMemo(() => stabil(server), [server]);
  const andra = useCallback(
    (fn: (kopia: T) => void) => {
      const nu = (utkastStore.get().utkast[id]?.varde as T | undefined) ?? server;
      const kopia = structuredClone(nu);
      fn(kopia);
      utkastStore.satt(id, kopia, bas);
    },
    [id, server, bas],
  );
  return { varde, aktiv, andra };
}

import { useEffect, useSyncExternalStore } from "react";
import type { ChatChannelSummary } from "@/lib/chatt";

/**
 * Siffran vid Chatt i sidomenyn. Menyn ligger i portalens skal, som inte renderas om när man byter sida, så siffran hålls aktuell
 * i webbläsaren: menyn frågar servern en gång i halvminuten, och när chattsidan är öppen rapporterar den i stället det den själv
 * hämtar var fjärde sekund. Null tills något har hämtats: då gäller siffran skalet renderades med.
 */
let unread: number | null = null;
/** Chattsidor som visas just nu och rapporterar själva. */
let reporters = 0;
const listeners = new Set<() => void>();

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

function report(total: number) {
  if (total === unread) return;
  unread = total;
  for (const notify of listeners) notify();
}

export const totalUnread = (channels: ChatChannelSummary[]) => channels.reduce((sum, c) => sum + c.unread, 0);

const MENU_POLL_MS = 30_000;

/** Antalet olästa för sidomenyn. rendered är siffran från servern, som gäller tills webbläsaren vet något nyare. */
export function useChatUnread(rendered: number): number {
  const live = useSyncExternalStore(subscribe, () => unread, () => null);
  useEffect(() => {
    const controller = new AbortController();
    const refresh = async () => {
      if (reporters > 0 || document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/admin/chatt", { signal: controller.signal });
        if (res.ok) report(totalUnread(((await res.json()) as { channels: ChatChannelSummary[] }).channels));
      } catch {
        // Utan nät eller mitt i ett sidbyte: siffran står kvar och nästa försök kommer om en halv minut.
      }
    };
    const timer = window.setInterval(refresh, MENU_POLL_MS);
    // En flik som har legat i bakgrunden frågar direkt när den visas igen.
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return live ?? rendered;
}

/** Chattsidan rapporterar summan den visar, och menyn slutar fråga själv så länge sidan syns. */
export function useReportUnread(total: number) {
  useEffect(() => {
    reporters++;
    return () => {
      reporters--;
    };
  }, []);
  useEffect(() => report(total), [total]);
}

"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { FOCUS_SEARCH_EVENT } from "@/lib/search-prefetch";
import { OPEN_SEARCH_EVENT } from "./open-search";

/**
 * Dialogen hämtas först när någon öppnar den (eller pekar på en sökknapp, se preloadSearch), så att dess kod och sökmotorn inte
 * följer med varje sida. Next delar bara upp klientkomponenter som en klientkomponent hämtar med next/dynamic
 * (node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md).
 */
const SearchDialog = dynamic(() => import("./search-dialog").then((m) => m.SearchDialog), { ssr: false });

type Session = { query: string; opener: HTMLElement | null };

/**
 * Lyssnar efter openSearch() och snabbtangenterna: / när man inte skriver någonstans, och Ctrl eller Cmd + K, som också stänger.
 * På söksidan finns redan en ruta, så där lägger tangenterna bara markören i den.
 */
export function SearchDialogHost() {
  const [session, setSession] = useState<Session | null>(null);
  const close = useCallback(() => setSession(null), []);

  useEffect(() => {
    const opener = () => (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const onOpen = (e: Event) => {
      const query = (e as CustomEvent<string | undefined>).detail ?? "";
      const from = opener();
      setSession((s) => s ?? { query, opener: from });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const typing = (e.target as HTMLElement | null)?.closest?.("input, textarea, select, [contenteditable]");
      const combo = e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey;
      const slash = e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !typing;
      if (!combo && !slash) return;
      if (window.location.pathname === "/sok") {
        // Söksidans ruta sköter snedstrecket själv.
        if (combo) {
          e.preventDefault();
          window.dispatchEvent(new Event(FOCUS_SEARCH_EVENT));
        }
        return;
      }
      // En annan dialog är öppen (bildvisaren, redigeringslådan) och ligger lika högt eller högre, så rutan skulle hamna bakom den.
      if (document.querySelector('[aria-modal="true"]:not([data-sokruta])')) return;
      e.preventDefault();
      const from = opener();
      setSession((s) => (s && combo ? null : (s ?? { query: "", opener: from })));
    };
    window.addEventListener(OPEN_SEARCH_EVENT, onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(OPEN_SEARCH_EVENT, onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!session) return null;
  return <SearchDialog initialQuery={session.query} returnTo={session.opener} onClose={close} />;
}

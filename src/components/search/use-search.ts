"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { MAX_HITS, queryTerms, search, type PreparedIndex, type SearchResult } from "@/lib/search";
import { loadCourseCodes, loadSearchIndex } from "@/lib/search-client";

const NO_RESULT: SearchResult = { hits: [], terms: [], corrected: [] };

/**
 * Sökningen som söksidan och sökrutan delar. Indexet hämtas en gång per besök och söks i webbläsaren (src/lib/search.ts), så varje
 * tangenttryck svarar direkt även på en långsam telefon. Kurskoderna hämtas först när frågan innehåller en siffra.
 */
export function useSearch(query: string) {
  const [index, setIndex] = useState<PreparedIndex | null>(null);
  const [failed, setFailed] = useState(false);
  const [codes, setCodes] = useState<string[]>([]);

  useEffect(() => {
    loadSearchIndex().then((loaded) => (loaded ? setIndex(loaded) : setFailed(true)));
  }, []);

  const wantsCodes = /\d/.test(query);
  useEffect(() => {
    if (wantsCodes && codes.length === 0) loadCourseCodes().then(setCodes);
  }, [wantsCodes, codes.length]);

  const deferred = useDeferredValue(query);
  const result = useMemo(() => (index ? search(index, deferred, codes) : NO_RESULT), [index, deferred, codes]);
  const searching = queryTerms(query).length > 0;
  const loading = searching && !index && !failed;
  return { ...result, failed, searching, loading };
}

/** Raden som läses upp och står över eller under träffarna. Tom innan man har skrivit något. */
export function searchStatus({ searching, loading, failed, count }: { searching: boolean; loading: boolean; failed: boolean; count: number }) {
  if (!searching) return "";
  if (loading) return "Söker…";
  if (failed) return "Sökningen svarar inte just nu.";
  if (count === 0) return "Inga träffar";
  if (count === 1) return "1 träff";
  return `${count >= MAX_HITS ? `Minst ${MAX_HITS}` : count} träffar`;
}

"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowRight, ArrowUpRight, Close, Search } from "@/components/icons";
import { KIND_LABELS, makeSnippet, MAX_QUERY_LENGTH, type SearchHit } from "@/lib/search";
import { FOCUS_SEARCH_EVENT } from "@/lib/search-prefetch";
import { cn } from "@/lib/utils";
import { courseCodeOf, isPageHref, Marked, SUGGESTIONS } from "./search-parts";
import { searchStatus, useSearch } from "./use-search";

const FIRST_PAGE = 20;

const subscribeNothing = () => () => {};
const readUrlQuery = () => (new URLSearchParams(window.location.search).get("q") ?? "").slice(0, MAX_QUERY_LENGTH);

/**
 * Söksidan: träffar medan man skriver, i hela sajten, med rättning av stavfel. Sökrutan ovanpå sidan (search-dialog.tsx) gör samma
 * sökning; den här sidan är reserven utan JavaScript och platsen för alla träffar med utdrag. Frågan står i adressen (?q=), så en
 * sökning går att dela och ladda om.
 */
export function SiteSearch() {
  // Frågan i adressen tills man skriver själv. Servern känner inte till den, så sidan kan vara statisk och rutan byts aldrig ut.
  const urlQuery = useSyncExternalStore(subscribeNothing, readUrlQuery, () => "");
  const [typed, setTyped] = useState<string | null>(null);
  const query = typed ?? urlQuery;
  const [showAll, setShowAll] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const statusId = useId();

  const setQuery = (value: string) => {
    setTyped(value.slice(0, MAX_QUERY_LENGTH));
    setShowAll(false);
  };

  // Sökknappen i menyn, snabbtangenten / och Ctrl eller Cmd + K lägger markören i rutan.
  useEffect(() => {
    const focus = () => {
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !target.closest("input, textarea, select, [contenteditable]")) {
        e.preventDefault();
        focus();
      }
    };
    window.addEventListener(FOCUS_SEARCH_EVENT, focus);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(FOCUS_SEARCH_EVENT, focus);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // Adressen följer frågan, utan att lägga till steg i historiken.
  useEffect(() => {
    const t = setTimeout(() => {
      const url = query.trim() ? `/sok?q=${encodeURIComponent(query.trim())}` : "/sok";
      if (window.location.pathname === "/sok" && window.location.pathname + window.location.search !== url) window.history.replaceState(null, "", url);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const { hits, terms, corrected, suggestion, failed, searching, loading } = useSearch(query);
  const shown = showAll ? hits : hits.slice(0, FIRST_PAGE);
  const status = searchStatus({ searching, loading, failed, count: hits.length });

  const focusResult = (i: number) => {
    const links = listRef.current?.querySelectorAll<HTMLAnchorElement>("a[data-traff]");
    if (!links?.length) return;
    links[Math.max(0, Math.min(i, links.length - 1))].focus();
  };

  return (
    <>
      <section className="border-b border-line pb-6 pt-[calc(var(--header-h)+2rem)] md:pb-8 md:pt-[calc(var(--header-h)+3.5rem)]">
        <div className="container-site">
          <form
            action="/sok"
            method="get"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              // Enter går till träffarna: på telefonen fälls tangentbordet ner, och nästa Enter öppnar den första.
              if (hits.length) focusResult(0);
              else inputRef.current?.blur();
            }}
            className="mx-auto max-w-2xl"
          >
            <p className="kicker flex items-center gap-2.5 text-stone">
              <span className="size-1.5 rounded-full bg-red" aria-hidden />
              Sök
            </p>
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-line bg-white px-4 transition-colors focus-within:border-ink/30">
              <Search size={20} className="shrink-0 text-stone" />
              <input
                ref={inputRef}
                name="q"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown" && hits.length) {
                    e.preventDefault();
                    focusResult(0);
                  } else if (e.key === "Escape" && query) {
                    e.preventDefault();
                    setQuery("");
                  }
                }}
                aria-label="Sök på StatLin"
                aria-describedby={statusId}
                placeholder="Sök på StatLin"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="search"
                maxLength={MAX_QUERY_LENGTH}
                autoFocus
                className="h-14 min-w-0 flex-1 bg-transparent text-[1.15rem] text-ink outline-none placeholder:text-stone focus-visible:outline-none md:h-16 md:text-[1.3rem] [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                  className="grid size-9 shrink-0 place-items-center rounded-lg text-stone transition-colors hover:bg-ink/[0.05] hover:text-ink"
                  aria-label="Töm sökrutan"
                >
                  <Close size={18} />
                </button>
              )}
            </div>
          </form>
        </div>
      </section>

      <div className="container-site pb-24 pt-6 md:pb-32 md:pt-8">
        <div className="mx-auto max-w-2xl">
          <p id={statusId} aria-live="polite" className={cn("text-sm text-stone", !status && "sr-only")}>
            {status}
            {suggestion && hits.length > 0 && (
              <>
                {" · "}Visar träffar för{" "}
                <button
                  type="button"
                  onClick={() => {
                    setQuery(suggestion);
                    inputRef.current?.focus();
                  }}
                  className="font-semibold text-ink underline decoration-ink/25 underline-offset-4 transition-colors hover:decoration-red"
                >
                  {suggestion}
                </button>
              </>
            )}
          </p>

          {!searching ? (
            <Suggestions onPick={(q) => setQuery(q)} />
          ) : loading ? (
            <ul aria-hidden className="mt-4 space-y-6">
              {[0, 1, 2].map((i) => (
                <li key={i} className="space-y-2">
                  <div className="h-3 w-24 animate-pulse rounded bg-ink/[0.06]" />
                  <div className="h-5 w-3/4 animate-pulse rounded bg-ink/[0.08]" />
                </li>
              ))}
            </ul>
          ) : hits.length === 0 ? (
            <NoHits query={query} failed={failed} />
          ) : (
            <>
              <ol
                ref={listRef}
                className="mt-2 divide-y divide-line"
                onKeyDown={(e) => {
                  const links = [...(listRef.current?.querySelectorAll<HTMLAnchorElement>("a[data-traff]") ?? [])];
                  const at = links.indexOf(document.activeElement as HTMLAnchorElement);
                  if (at === -1) return;
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    focusResult(at + 1);
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    if (at === 0) inputRef.current?.focus();
                    else focusResult(at - 1);
                  } else if (e.key === "Escape") {
                    inputRef.current?.focus();
                  }
                }}
              >
                {shown.map((hit, i) => (
                  <HitRow key={`${i}:${hit.entry.kind}:${hit.entry.href}`} hit={hit} terms={terms} corrected={corrected} />
                ))}
              </ol>
              {hits.length > shown.length && (
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="mt-4 h-11 text-[0.95rem] font-semibold text-ink underline decoration-ink/25 underline-offset-4 transition-colors hover:decoration-red"
                >
                  Visa alla {hits.length} träffar
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function HitRow({ hit, terms, corrected }: { hit: SearchHit; terms: string[]; corrected: string[] }) {
  const { entry } = hit;
  // Utdraget räknas bara för raderna som visas, inte för alla träffar.
  const snippet = useMemo(
    () => (hit.inText && entry.text ? makeSnippet(entry.text, [...terms, ...corrected]) : undefined),
    [hit.inText, entry.text, terms, corrected],
  );
  const body = (
    <>
      <span className="block text-[0.8rem] text-stone">
        <span className="kicker text-[0.66rem]">{KIND_LABELS[entry.kind]}</span>
        {entry.meta && (
          <>
            <span aria-hidden> · </span>
            <Marked text={entry.meta} terms={terms} corrected={corrected} />
          </>
        )}
      </span>
      <span
        className={cn(
          "mt-1 flex items-start gap-2 text-[1.05rem] font-semibold leading-snug text-ink transition-colors group-hover:text-red",
          entry.kind === "kurs" && "font-mono",
        )}
      >
        <span className="min-w-0">
          <Marked text={entry.title} terms={terms} corrected={corrected} />
        </span>
        {entry.external && <ArrowUpRight size={15} className="mt-1 shrink-0 text-stone" />}
      </span>
      {snippet && (
        <span className="mt-1.5 line-clamp-2 block text-[0.92rem] leading-relaxed text-stone">
          <Marked text={snippet} terms={terms} corrected={corrected} />
        </span>
      )}
    </>
  );
  const className = "group -mx-3 block rounded-lg px-3 py-4 outline-none transition-colors hover:bg-ink/[0.03] focus-visible:bg-ink/[0.05] focus-visible:ring-2 focus-visible:ring-red/40";
  return (
    <li>
      {isPageHref(entry.href) ? (
        <Link href={entry.href} data-traff className={className}>
          {body}
        </Link>
      ) : (
        <a href={entry.href} data-traff className={className} {...(entry.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
          {body}
          {entry.external && <span className="sr-only"> (öppnas i en ny flik)</span>}
        </a>
      )}
    </li>
  );
}

function Suggestions({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="mt-2">
      <p className="kicker text-stone">Förslag</p>
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((q) => (
          <li key={q}>
            <button
              type="button"
              onClick={() => onPick(q)}
              className="inline-flex h-9 items-center rounded-lg border border-line bg-white px-3 text-[0.9rem] text-ink transition-colors hover:border-ink/25"
            >
              {q}
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-10 hidden text-sm text-stone md:block">
        Tryck <kbd className="kbd">/</kbd> eller <kbd className="kbd">Ctrl K</kbd> var som helst på sajten för att söka.
      </p>
    </div>
  );
}

function NoHits({ query, failed }: { query: string; failed: boolean }) {
  const code = courseCodeOf(query);
  return (
    <div className="mt-4">
      <p className="text-lg font-semibold">{failed ? "Sökningen svarar inte just nu." : <>Inga träffar på ”{query.trim()}”</>}</p>
      <p className="mt-1 text-stone">
        {failed ? "Ladda om sidan och försök igen, eller gå direkt till en sida i menyn." : "Prova ett annat ord, färre ord eller början av ett ord."}
      </p>
      {code && (
        <Link href={`/tentastatistik/${code}`} className="btn btn-ghost mt-4">
          Tentastatistik för {code} <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}

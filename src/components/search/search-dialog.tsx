"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ComponentType, type KeyboardEvent, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart,
  BookOpen,
  Calendar,
  Chain,
  Close,
  FileText,
  Handshake,
  Layers,
  Newspaper,
  Search,
  Users,
} from "@/components/icons";
import { KIND_LABELS, makeSnippet, MAX_QUERY_LENGTH, type SearchHit, type SearchKind } from "@/lib/search";
import { useFocusLayer } from "@/lib/use-focus-layer";
import { cn } from "@/lib/utils";
import { courseCodeOf, isPageHref, Marked, SUGGESTIONS } from "./search-parts";
import { searchStatus, useSearch } from "./use-search";

type IconType = ComponentType<{ size?: number; className?: string }>;

const KIND_ICONS: Record<SearchKind, IconType> = {
  sida: Layers,
  evenemang: Calendar,
  nytt: Newspaper,
  utskott: Users,
  styrelse: Users,
  dokument: FileText,
  lank: Chain,
  hjalpmedel: BookOpen,
  foretag: Handshake,
  kurs: BarChart,
};

/** Så många träffar står i rutan. Alla finns på söksidan, som sista raden leder till. */
const SHOWN = 12;

type Option = { type: "hit"; hit: SearchHit } | { type: "suggestion"; query: string } | { type: "link"; href: string; label: string };
type Group = { label: string; options: Option[] };

/**
 * Sökrutan ovanpå sidan. Samma sökning som söksidan (useSearch), men träffarna grupperas efter slag och väljs med piltangenterna
 * medan markören står kvar i fältet. Fältet är en combobox och träffarna en listbox, så att skärmläsare får höra vilken rad som är vald.
 */
export function SearchDialog({ initialQuery = "", returnTo, onClose }: { initialQuery?: string; returnTo: HTMLElement | null; onClose: () => void }) {
  const [query, setQueryState] = useState(initialQuery.slice(0, MAX_QUERY_LENGTH));
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Efter ett val byts sidan, och då ska fokus inte tillbaka till sökknappen.
  const navigating = useRef(false);
  const baseId = useId();
  const listId = `${baseId}-lista`;
  const statusId = `${baseId}-status`;
  const optionId = (i: number) => `${baseId}-rad-${i}`;
  const { hits, terms, corrected, suggestion, failed, searching, loading } = useSearch(query);

  const setQuery = (value: string) => {
    setQueryState(value.slice(0, MAX_QUERY_LENGTH));
    setActive(0);
  };
  const pick = (value: string) => {
    setQuery(value);
    inputRef.current?.focus();
  };
  const leave = () => {
    navigating.current = true;
    onClose();
  };

  // Resten av sidan blir inert, Tab stannar i rutan och fokus går tillbaka till det som öppnade den.
  useFocusLayer({
    active: true,
    layers: () => [rootRef.current],
    initial: () => inputRef.current,
    returnTo: () => (navigating.current ? document.body : returnTo),
  });

  // Sidan bakom står still. Rännan för rullningslisten ligger kvar, så att sidan inte hoppar i sidled på datorn.
  useEffect(() => {
    const html = document.documentElement;
    const before = { overflow: html.style.overflow, gutter: html.style.scrollbarGutter };
    html.style.scrollbarGutter = "stable";
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = before.overflow;
      html.style.scrollbarGutter = before.gutter;
    };
  }, []);

  // Stäng när sidan byts, även med bakåtknappen.
  const pathname = usePathname();
  const [startPath] = useState(pathname);
  useEffect(() => {
    if (pathname !== startPath) onClose();
  }, [pathname, startPath, onClose]);

  const shown = hits.slice(0, SHOWN);
  const noHits = searching && !loading && hits.length === 0;
  const code = noHits ? courseCodeOf(query) : null;
  const groups: Group[] = [];
  if (!searching) {
    groups.push({ label: "Förslag", options: SUGGESTIONS.map((q) => ({ type: "suggestion", query: q })) });
  } else {
    for (const hit of shown) {
      const label = KIND_LABELS[hit.entry.kind];
      const group = groups.find((g) => g.label === label);
      if (group) group.options.push({ type: "hit", hit });
      else groups.push({ label, options: [{ type: "hit", hit }] });
    }
    if (hits.length > 0) {
      const more = hits.length > shown.length ? `Visa alla ${hits.length} träffar på söksidan` : "Visa träffarna på söksidan";
      groups.push({ label: "", options: [{ type: "link", href: `/sok?q=${encodeURIComponent(query.trim())}`, label: more }] });
    }
    if (code) groups.push({ label: "Tentastatistik", options: [{ type: "link", href: `/tentastatistik/${code}`, label: `Tentastatistik för ${code}` }] });
  }
  const options = groups.flatMap((g) => g.options);
  const current = options.length ? Math.min(active, options.length - 1) : -1;

  // Den valda raden hålls synlig när man bläddrar med piltangenterna.
  useEffect(() => {
    if (current >= 0) document.getElementById(optionId(current))?.scrollIntoView({ block: "nearest" });
    // optionId bygger bara på baseId, som inte ändras.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const onInputKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "ArrowDown" || e.key === "ArrowUp") && options.length) {
      e.preventDefault();
      setActive((current + (e.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
    } else if (e.key === "Home" && options.length && !query) {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End" && options.length && !query) {
      e.preventDefault();
      setActive(options.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const option = options[current];
      if (!option) return;
      if (option.type === "suggestion") pick(option.query);
      // Raden är en länk, så Enter gör samma sak som ett klick: sidbyte i appen, eller en ny flik för andra webbplatser.
      else document.getElementById(optionId(current))?.click();
    }
  };

  const status = searchStatus({ searching, loading, failed, count: hits.length });
  let index = 0;

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[90] flex items-start justify-center px-3 pb-3 pt-3 sm:px-4 sm:pb-6 sm:pt-[12vh] print:hidden"
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
    >
      {/* Bakgrunden är sidans egen färg, halvgenomskinlig, så att den fungerar likadant i ljust och mörkt läge. */}
      <div aria-hidden className="absolute inset-0 bg-paper/70 backdrop-blur-sm pointer-coarse:backdrop-filter-none opak:bg-paper/90" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sök"
        data-sokruta
        className="relative flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-line bg-white text-ink shadow-xl [animation:fade-up_0.3s_var(--ease-out-expo)_backwards] sm:max-h-[min(36rem,100%)]"
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-line pl-4 pr-2.5">
          <Search size={18} className="shrink-0 text-stone" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={options.length > 0}
            aria-controls={listId}
            aria-activedescendant={current >= 0 ? optionId(current) : undefined}
            aria-autocomplete="list"
            aria-describedby={statusId}
            aria-label="Sök på StatLin"
            placeholder="Sök evenemang, sidor, utskott, kurser …"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="go"
            maxLength={MAX_QUERY_LENGTH}
            className="h-14 min-w-0 flex-1 bg-transparent text-[1.02rem] text-ink outline-none placeholder:text-stone focus-visible:outline-none"
          />
          <button type="button" onClick={onClose} className="kbd hidden cursor-pointer transition-colors hover:text-ink sm:inline-grid" aria-label="Stäng sökrutan">
            Esc
          </button>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 shrink-0 place-items-center rounded-lg text-stone transition-colors hover:bg-ink/[0.05] hover:text-ink sm:hidden"
            aria-label="Stäng sökrutan"
          >
            <Close size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
          {suggestion && hits.length > 0 && (
            <p className="px-3 pb-1 pt-1.5 text-[0.8rem] text-stone">
              Visar träffar för{" "}
              <button
                type="button"
                onClick={() => pick(suggestion)}
                className="font-medium text-ink underline decoration-ink/25 underline-offset-4 transition-colors hover:decoration-red"
              >
                {suggestion}
              </button>
            </p>
          )}

          {loading && (
            <ul aria-hidden className="space-y-1 p-1">
              {[0, 1, 2].map((i) => (
                <li key={i} className="flex items-center gap-3 rounded-lg px-2 py-2.5">
                  <div className="size-4 animate-pulse rounded bg-ink/[0.08]" />
                  <div className="h-3.5 w-2/3 animate-pulse rounded bg-ink/[0.08]" />
                </li>
              ))}
            </ul>
          )}

          {noHits && (
            <div className="px-3 pb-2 pt-3">
              <p className="font-medium text-ink">{failed ? "Sökningen svarar inte just nu." : <>Inga träffar på ”{query.trim()}”</>}</p>
              <p className="mt-1 text-[0.88rem] text-stone">
                {failed ? "Försök igen om en stund, eller gå direkt till en sida i menyn." : "Prova ett annat ord, färre ord eller början av ett ord."}
              </p>
            </div>
          )}

          {options.length > 0 && (
            <div role="listbox" id={listId} aria-label={searching ? "Sökträffar" : "Förslag"}>
              {groups.map((group, gi) => {
                const labelId = `${baseId}-grupp-${gi}`;
                return (
                  <div
                    key={`${gi}:${group.label}`}
                    role="group"
                    aria-labelledby={group.label ? labelId : undefined}
                    aria-label={group.label ? undefined : "Fler träffar"}
                    className={cn(gi > 0 && "mt-1 border-t border-line pt-1")}
                  >
                    {group.label && (
                      <div id={labelId} role="presentation" className="kicker px-3 pb-1 pt-2.5 text-stone">
                        {group.label}
                      </div>
                    )}
                    {group.options.map((option) => {
                      const i = index++;
                      return (
                        <OptionRow
                          key={i}
                          id={optionId(i)}
                          option={option}
                          selected={i === current}
                          terms={terms}
                          corrected={corrected}
                          onHover={() => setActive(i)}
                          onPick={pick}
                          onLeave={leave}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-4 border-t border-line px-4 py-2 text-[0.75rem] text-stone">
          <p id={statusId} aria-live="polite" className="min-w-0 flex-1 truncate">
            {status || "Sök i hela sajten"}
          </p>
          <span aria-hidden className="hidden items-center gap-1.5 sm:flex">
            <span className="kbd">↑</span>
            <span className="kbd">↓</span>
            välj
          </span>
          <span aria-hidden className="hidden items-center gap-1.5 sm:flex">
            <span className="kbd">Enter</span>
            öppna
          </span>
        </div>
      </div>
    </div>
  );
}

function OptionRow({
  id,
  option,
  selected,
  terms,
  corrected,
  onHover,
  onPick,
  onLeave,
}: {
  id: string;
  option: Option;
  selected: boolean;
  terms: string[];
  corrected: string[];
  onHover: () => void;
  onPick: (query: string) => void;
  onLeave: () => void;
}) {
  // Markeringen byts direkt, utan övergång, så att den hänger med när man håller ner en piltangent.
  const className = cn(
    "flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left outline-none",
    selected ? "bg-ink/[0.06]" : "hover:bg-ink/[0.03]",
  );
  const shared = { id, role: "option" as const, "aria-selected": selected, tabIndex: -1, onPointerMove: onHover, className };

  if (option.type === "suggestion") {
    return (
      <div {...shared} onClick={() => onPick(option.query)}>
        <Search size={15} className={cn("shrink-0", selected ? "text-red" : "text-stone")} />
        <span className="flex-1 text-[0.92rem] text-ink">{option.query}</span>
      </div>
    );
  }

  if (option.type === "link") {
    return (
      <Link {...shared} href={option.href} onClick={onLeave}>
        <ArrowRight size={15} className={cn("shrink-0", selected ? "text-red" : "text-stone")} />
        <span className="flex-1 text-[0.92rem] font-medium text-ink">{option.label}</span>
      </Link>
    );
  }

  const { entry } = option.hit;
  const Icon = KIND_ICONS[entry.kind];
  const snippet = option.hit.inText && entry.text ? makeSnippet(entry.text, [...terms, ...corrected]) : undefined;
  const second = snippet ?? entry.meta;
  const body: ReactNode = (
    <>
      <Icon size={16} className={cn("shrink-0", selected ? "text-red" : "text-stone")} />
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-[0.92rem] font-medium text-ink", entry.kind === "kurs" && "font-mono")}>
          <Marked text={entry.title} terms={terms} corrected={corrected} />
        </span>
        {second && (
          <span className="mt-0.5 block truncate text-[0.8rem] text-stone">
            <Marked text={second} terms={terms} corrected={corrected} />
          </span>
        )}
      </span>
      {entry.external ? (
        <ArrowUpRight size={15} className="shrink-0 text-stone" />
      ) : (
        <ArrowRight size={15} className={cn("shrink-0 text-stone", selected ? "opacity-100" : "opacity-0")} />
      )}
    </>
  );

  if (isPageHref(entry.href)) {
    return (
      <Link {...shared} href={entry.href} onClick={onLeave}>
        {body}
      </Link>
    );
  }
  return (
    <a {...shared} href={entry.href} onClick={onLeave} {...(entry.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {body}
      {entry.external && <span className="sr-only"> (öppnas i en ny flik)</span>}
    </a>
  );
}

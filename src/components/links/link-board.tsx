"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, BarChart, Close, Search, Star } from "@/components/icons";
import { looksLikeCourseCode } from "@/lib/exam-stats";
import { LINK_CATEGORIES, categoryLabel, isExternalUrl, normalizeSearch } from "@/lib/links";
import type { LinkItem } from "@/lib/types";
import { cn, safeExternalUrl } from "@/lib/utils";
import { EditModeLink } from "@/components/edit-mode/editable";
import { CourseSearch } from "@/components/exam/course-search";
import { LinkIcon } from "./link-icon";
import { pinStore, usePins } from "./pins";
import { SiteLink } from "./site-link";

/**
 * Länksidan: sök, fästa favoriter, genvägar, sökning i tentastatistiken och alla länkar per grupp.
 * Allt filtreras i webbläsaren – listan är liten, och sökningen ska kännas omedelbar.
 */
export function LinkBoard({ links }: { links: LinkItem[] }) {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const inputRef = useRef<HTMLInputElement>(null);
  const pins = usePins();

  // "/" hoppar till sökrutan, som på många sajter man söker mycket på.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const index = useMemo(
    () => links.map((l) => ({ item: l, hay: normalizeSearch(`${l.label} ${l.description} ${l.keywords} ${categoryLabel(l.category)}`) })),
    [links],
  );

  const tokens = normalizeSearch(deferred.trim()).split(/\s+/).filter(Boolean);
  const searching = tokens.length > 0;
  const hit = (hay: string) => tokens.every((t) => hay.includes(t));
  const shownLinks = searching ? index.filter((x) => hit(x.hay)).map((x) => x.item) : links;
  const code = looksLikeCourseCode(deferred);

  const featured = shownLinks.filter((l) => l.featured);
  const groups = LINK_CATEGORIES.map((c) => ({ ...c, links: shownLinks.filter((l) => l.category === c.value) })).filter((g) => g.links.length > 0);
  const pinned = pins.flatMap((id) => shownLinks.filter((l) => `l${l.id}` === id));
  const nothing = searching && shownLinks.length === 0;

  return (
    <div className="container-site pb-24 md:pb-32">
      {/* Sök – fastnar under sidhuvudet, så att man kan söka igen var man än är på sidan. */}
      <div className="sticky top-[calc(var(--header-h)+0.75rem)] z-20 -mt-8">
        <label className="flex h-14 items-center gap-3 rounded-xl border border-line bg-white pl-5 pr-3 shadow-sm transition-[border-color,box-shadow] focus-within:border-ink/40 focus-within:shadow-[0_0_0_4px_rgb(255_7_7/0.12)]">
          <Search size={20} className="shrink-0 text-stone" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setQuery("");
            }}
            aria-label="Sök bland länkarna"
            placeholder="Sök, t.ex. schema eller 732G33"
            autoComplete="off"
            enterKeyHint="search"
            className="h-full min-w-0 flex-1 bg-transparent text-[1.05rem] outline-none placeholder:text-stone focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="grid size-10 shrink-0 place-items-center rounded-full text-stone hover:bg-paper hover:text-ink"
            >
              <Close size={18} />
              <span className="sr-only">Töm sökrutan</span>
            </button>
          ) : (
            <kbd className="mr-2 hidden rounded-md border border-ink/15 px-2 py-0.5 font-mono text-xs text-stone sm:block" title="Tryck / för att söka">
              /
            </kbd>
          )}
        </label>
      </div>
      <p aria-live="polite" className="sr-only">
        {searching ? `${shownLinks.length} träffar` : ""}
      </p>

      {code && (
        <Link
          href={`/tentastatistik/${code}`}
          className="group mt-6 flex items-center justify-between gap-4 rounded-xl border border-line bg-white px-5 py-4 transition-colors hover:border-ink/20 md:px-6"
        >
          <span className="flex min-w-0 items-center gap-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-red text-white">
              <BarChart size={20} />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold">
                Visa tentastatistik för <span className="font-mono">{code}</span>
              </span>
              <span className="block text-sm text-stone">Betyg per tentatillfälle, för vilken LiU-kurs som helst</span>
            </span>
          </span>
          <ArrowRight size={20} className="shrink-0 transition-transform duration-500 group-hover:translate-x-1" />
        </Link>
      )}

      {nothing && !code && (
        <div className="mt-6 rounded-xl border border-dashed border-line bg-white p-8 text-center md:p-12">
          <p className="font-semibold">Inga träffar på ”{deferred.trim()}”</p>
          <p className="mx-auto mt-2 max-w-md text-stone">
            Söker du en kurs? Skriv kurskoden, till exempel 732G33. Och hittar du inte länken här finns ännu fler hos{" "}
            <a href="https://tenuil.com/" target="_blank" rel="noopener noreferrer" className="font-semibold text-red-deep underline underline-offset-2">
              Tenuil
            </a>
            .
          </p>
        </div>
      )}

      {/* Fästa */}
      {pinned.length > 0 && (
        <section aria-labelledby="fasta" className="mt-10">
          <h2 id="fasta" className="kicker flex items-center gap-2 text-stone">
            <Star size={14} fill="currentColor" className="text-red" /> Fästa
          </h2>
          {/* -mb-px gömmer sista radens linje under kortets kant. */}
          <div className="mt-4 overflow-hidden rounded-xl border border-line bg-white">
            <ul className="-mb-px grid md:grid-cols-2 [&>li]:border-b [&>li]:border-ink/[0.07] md:[&>li:nth-child(odd)]:border-r">
              {pinned.map((l) => (
                <LinkRow key={l.id} link={l} pinned />
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Genvägar */}
      {featured.length > 0 && (
        <section aria-labelledby="genvagar" className="mt-10">
          <div className="flex min-h-9 flex-wrap items-center justify-between gap-3">
            <h2 id="genvagar" className="kicker text-stone">
              Genvägar
            </h2>
            <EditModeLink target={{ type: "page", slug: "lankar" }} href="/admin/lankar" icon="edit">
              Hantera länkar
            </EditModeLink>
          </div>
          <ul className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-3">
            {featured.map((l) => (
              <li key={l.id}>
                <LinkTile link={l} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Tentastatistik. Under en sökning tar raden "Visa tentastatistik för …" över, så att sidan inte hoppar. */}
      {!searching && (
        <section aria-labelledby="tentastatistik" className="mt-10 grid grid-cols-1 items-center gap-6 rounded-xl border border-line bg-white p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:p-7">
          <div>
            <h2 id="tentastatistik" className="display-tight text-2xl">
              Tenta<span className="text-red-deep">statistik</span>
            </h2>
            <p className="mt-2 max-w-md leading-relaxed text-stone">Hur brukar tentan gå? Sök på kurskoden och se betygen på varje tillfälle, för vilken LiU-kurs som helst.</p>
          </div>
          <div className="md:justify-self-end md:w-full md:max-w-xl">
            <CourseSearch />
          </div>
        </section>
      )}

      {/* Alla länkar per grupp. Spalterna balanseras av webbläsaren, så korten blir olika långa utan glapp. */}
      {groups.length > 0 && (
        <div className="mt-12 gap-6 md:columns-2 xl:columns-3">
          {groups.map((g) => (
            <section key={g.value} aria-labelledby={`grupp-${g.value}`} className="mb-6 break-inside-avoid overflow-hidden rounded-xl border border-line bg-white">
              <h2 id={`grupp-${g.value}`} className="flex items-baseline justify-between gap-4 px-5 pb-2 pt-5">
                <span className="display-tight text-lg">{g.label}</span>
                <span className="kicker text-stone">{g.links.length}</span>
              </h2>
              <ul className="divide-y divide-ink/[0.07]">
                {g.links.map((l) => (
                  <LinkRow key={l.id} link={l} pinned={pins.includes(`l${l.id}`)} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function LinkTile({ link }: { link: LinkItem }) {
  const href = safeExternalUrl(link.url);
  if (!href) return null;
  const external = isExternalUrl(href);
  const Arrow = external ? ArrowUpRight : ArrowRight;
  const body = (
    <>
      <span className="flex items-start justify-between gap-3">
        <span className="grid size-10 place-items-center rounded-lg border border-line bg-paper-2/60 text-ink transition-colors duration-300 group-hover:border-red/40 group-hover:text-red">
          <LinkIcon name={link.icon} size={20} />
        </span>
        <Arrow size={16} className="text-stone-light transition-[color,transform] duration-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-red" />
      </span>
      <span className="mt-5 block font-semibold leading-tight">{link.label}</span>
      {link.description && <span className="mt-1 line-clamp-2 block text-sm leading-snug text-stone">{link.description}</span>}
      {external && <span className="sr-only"> (öppnas i en ny flik)</span>}
    </>
  );
  const className = "group flex h-full flex-col rounded-xl border border-line bg-white p-4 transition-colors duration-300 hover:border-ink/20";
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {body}
    </a>
  ) : (
    <SiteLink href={href} className={className}>
      {body}
    </SiteLink>
  );
}

function LinkRow({ link, pinned }: { link: LinkItem; pinned: boolean }) {
  const href = safeExternalUrl(link.url);
  if (!href) return null;
  const external = isExternalUrl(href);
  const Arrow = external ? ArrowUpRight : ArrowRight;
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold leading-snug">{link.label}</span>
        {link.description && <span className="mt-0.5 block text-sm leading-snug text-stone">{link.description}</span>}
      </span>
      <Arrow size={15} className="mt-1 shrink-0 text-stone-light transition-colors group-hover:text-red" />
      {external && <span className="sr-only"> (öppnas i en ny flik)</span>}
    </>
  );
  const linkClass = "group flex min-w-0 flex-1 items-start gap-3 py-3 pl-5";
  return (
    <li className="flex items-stretch transition-colors hover:bg-paper/60">
      {external ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
          {body}
        </a>
      ) : (
        <SiteLink href={href} className={linkClass}>
          {body}
        </SiteLink>
      )}
      <PinButton id={`l${link.id}`} label={link.label} pinned={pinned} />
    </li>
  );
}

function PinButton({ id, label, pinned }: { id: string; label: string; pinned: boolean }) {
  return (
    <button
      type="button"
      onClick={() => pinStore.toggle(id)}
      aria-pressed={pinned}
      title={pinned ? "Ta bort från Fästa" : "Fäst överst på sidan"}
      className={cn("grid w-12 shrink-0 place-items-center transition-colors", pinned ? "text-red" : "text-stone hover:text-ink")}
    >
      <Star size={18} fill={pinned ? "currentColor" : "none"} />
      <span className="sr-only">Fäst {label}</span>
    </button>
  );
}

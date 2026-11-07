"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore, type MouseEvent, type ReactNode } from "react";
import { isPlainClick, openSearch, preloadSearch } from "@/components/search/open-search";
import { languageSwitch } from "@/lib/navigation";
import { FOCUS_SEARCH_EVENT } from "@/lib/search-prefetch";
import { closeWhenWider, useFocusLayer } from "@/lib/use-focus-layer";
import { Close, Globe, Key, Menu, Search } from "@/components/icons";
import { MenyKontext } from "@/components/layout/meny-trad";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { cn } from "@/lib/utils";

/**
 * Sidomenyn på datorn och listen överst på telefonen. Namnet är kvar från tiden då menyn låg i ett sidhuvud.
 * Grupperna är details, så att de går att fälla ut även utan JavaScript; den grupp man står i är utfälld.
 */
/**
 * Sponsorerna och menyn hämtas på servern och skickas hit färdiga, en gång för sidomenyn och en gång för telefonens meny.
 * Menyn står med standardmenyn i skalet och byts mot den sparade när den kommer (se (site)/layout.tsx).
 */
type Delar = { sidebar: ReactNode; menu: ReactNode };

const noSubscription = () => () => {};

/**
 * Sidhuvudet ritas i sidans statiska skal utan sökväg, alltså utan markerad sida, precis som utan JavaScript.
 * usePathname() är URL-data och skulle göra hela sidhuvudet till en strömmad del på varje sida. Den delen visades då
 * först, och React väntar minst 300 ms mellan två visningar, så sidans eget innehåll kom 300 ms senare än det behövde.
 * Sökvägen läses därför först efter hydreringen, av PathWatcher, som också säger till vid varje sidbyte.
 */
export function SiteHeader({ sponsors, meny }: { sponsors?: Delar; meny?: Delar }) {
  const [pathname, setPathname] = useState<string | null>(null);
  const hydrated = useSyncExternalStore(noSubscription, () => true, () => false);
  return (
    <>
      {hydrated && (
        <Suspense fallback={null}>
          <PathWatcher onChange={setPathname} />
        </Suspense>
      )}
      <HeaderView pathname={pathname} sponsors={sponsors} meny={meny} />
    </>
  );
}

function PathWatcher({ onChange }: { onChange: (pathname: string) => void }) {
  const pathname = usePathname();
  useEffect(() => onChange(pathname), [pathname, onChange]);
  return null;
}

function HeaderView({ pathname, sponsors, meny }: { pathname: string | null; sponsors?: Delar; meny?: Delar }) {
  const [open, setOpen] = useState(false);
  const sidomeny = useMemo(() => ({ pathname }), [pathname]);
  const mobilmeny = useMemo(() => ({ pathname, onNavigate: () => setOpen(false) }), [pathname]);
  const barRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const onSearch = pathname === "/sok";
  const language = languageSwitch(pathname);
  const languages = pathname === null ? [language, languageSwitch("/en")] : [language];
  // Snabbtangenterna / och Ctrl eller Cmd + K sköts av sökrutans värd (search-dialog-host.tsx), som finns på alla sidor.

  // Stäng menyn vid navigering. Första sökvägen efter hydreringen är inget sidbyte: en meny som öppnats då får vara kvar.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    if (lastPath !== null) setOpen(false);
  }

  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Listen ligger ovanpå menyn och har stängknappen, så den hör till lagret. Resten av sidan blir inert, utom
  // redigeringslägets list och ruta: menyn går att ändra i, och då ska Spara och rutans fält fungera.
  useFocusLayer({
    active: open,
    layers: () => [barRef.current, menuRef.current, ...document.querySelectorAll<HTMLElement>(".redigeringslist, .redigerbar-ruta")],
    initial: () => toggleRef.current,
    returnTo: () => toggleRef.current,
  });
  useEffect(() => {
    if (open) return closeWhenWider("(min-width: 1024px)", () => setOpen(false));
  }, [open]);

  // Knapparna är länkar till söksidan, som fungerar utan JavaScript och i en ny flik. Ett vanligt klick öppnar sökrutan i stället.
  const searchProps = {
    href: "/sok",
    "aria-label": "Sök",
    "aria-haspopup": onSearch ? undefined : ("dialog" as const),
    title: "Sök (snabbtangent /)",
    "aria-current": onSearch ? ("page" as const) : undefined,
    // Rutans kod och indexet börjar hämtas redan när man pekar eller trycker, så att träffarna finns när rutan öppnas.
    onPointerEnter: preloadSearch,
    onPointerDown: preloadSearch,
    onFocus: preloadSearch,
    onClick: (e: MouseEvent) => {
      if (!isPlainClick(e)) return;
      e.preventDefault();
      setOpen(false);
      // På söksidan finns redan en ruta: markören går dit.
      if (onSearch) window.dispatchEvent(new Event(FOCUS_SEARCH_EVENT));
      else openSearch();
    },
  };

  const languageLinks = (className: string) =>
    languages.map((l) => (
      <Link
        key={l.lang}
        href={l.href}
        hrefLang={l.lang}
        lang={l.lang}
        aria-label={`${l.short}, ${l.label}`}
        title={l.label}
        className={cn(pathname === null && `sprak-${l.lang}`, className)}
      >
        <Globe size={15} />
        {l.short}
      </Link>
    ));

  return (
    <>
      <a
        href="#innehall"
        className="sr-only z-[60] rounded-lg bg-ink px-4 py-2 text-paper focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Hoppa till innehållet
      </a>

      {/* Datorn: sidomenyn */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[var(--sidebar-w)] flex-col border-r border-line bg-paper lg:flex print:hidden">
        <div className="px-4 pb-3 pt-5">
          <Brand subtitle />
        </div>
        <div className="px-3">
          <Link
            {...searchProps}
            className={cn(
              "flex h-9 w-full items-center gap-2 rounded-lg border bg-white px-2.5 text-[0.84rem] text-stone transition-colors hover:border-ink/25 hover:text-ink",
              onSearch ? "border-ink/25 text-ink" : "border-line",
            )}
          >
            <Search size={15} />
            <span>Sök på sajten</span>
            <span className="kbd ml-auto" aria-hidden>
              /
            </span>
          </Link>
        </div>
        <nav aria-label="Huvudmeny" className="mt-3 flex-1 overflow-y-auto overscroll-contain px-3 pb-6">
          <MenyKontext.Provider value={sidomeny}>{meny?.sidebar}</MenyKontext.Provider>
        </nav>
        {sponsors?.sidebar}
        <div className="flex items-center gap-1 border-t border-line px-3 py-2.5 text-[0.8rem] text-stone">
          {languageLinks("inline-flex h-8 items-center gap-1.5 rounded-md px-2 font-medium transition-colors hover:bg-ink/[0.05] hover:text-ink")}
          <ThemeToggle className="h-8 w-8 rounded-md transition-colors hover:bg-ink/[0.05] hover:text-ink" />
          <Link
            href="/admin"
            title="Logga in som post"
            className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md px-2 font-medium transition-colors hover:bg-ink/[0.05] hover:text-ink"
          >
            <Key size={15} />
            Poster
          </Link>
        </div>
      </aside>

      {/* Telefonen: listen överst */}
      <header
        ref={barRef}
        className="fixed inset-x-0 top-0 z-50 flex h-[var(--header-h)] items-center justify-between gap-3 border-b border-line bg-paper/92 px-4 backdrop-blur-xl pointer-coarse:bg-paper pointer-coarse:backdrop-filter-none opak:bg-paper lg:hidden print:hidden"
      >
        <Brand />
        <div className="flex items-center gap-1.5">
          <Link
            {...searchProps}
            className={cn(
              "grid size-10 place-items-center rounded-lg border text-stone transition-colors hover:text-ink",
              onSearch ? "border-ink/25 text-ink" : "border-line",
            )}
          >
            <Search size={18} />
          </Link>
          {/* Utan JavaScript går menyn inte att öppna. Sidfoten har samma länkar. */}
          <a href="#sidfot" aria-label="Alla sidor, i sidfoten" className="meny-utan-js size-10 place-items-center rounded-lg border border-line">
            <Menu size={18} />
          </a>
          <button
            ref={toggleRef}
            type="button"
            className="meny-knapp grid size-10 place-items-center rounded-lg border border-line"
            aria-label={open ? "Stäng meny" : "Öppna meny"}
            aria-expanded={open}
            aria-controls="mobilmeny"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <Close size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      {/* Telefonens meny */}
      <div
        ref={menuRef}
        id="mobilmeny"
        className={cn(
          "fixed inset-x-0 bottom-0 top-[var(--header-h)] z-40 overflow-y-auto overscroll-contain bg-paper transition-[opacity,visibility] duration-300 lg:hidden",
          open ? "visible opacity-100" : "invisible opacity-0",
        )}
      >
        <nav aria-label="Mobilmeny" className="px-3 pb-12 pt-3">
          <MenyKontext.Provider value={mobilmeny}>{meny?.menu}</MenyKontext.Provider>
          <div className="mt-6 grid grid-cols-2 gap-2 border-t border-line px-1 pt-6 text-[0.9rem]">
            {languageLinks("btn btn-ghost")}
            <ThemeToggle withLabel className="btn btn-ghost" />
            <Link href="/admin" className="btn btn-ghost col-span-2">
              <Key size={16} /> Logga in som post
            </Link>
          </div>
          {sponsors?.menu}
        </nav>
      </div>
    </>
  );
}

function Brand({ subtitle }: { subtitle?: boolean }) {
  return (
    <Link href="/" className="group flex items-center gap-2.5" aria-label="StatLin, startsida">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/statlin.svg"
        alt=""
        width={32}
        height={32}
        className="size-8 transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:rotate-[-12deg]"
      />
      <span className="leading-tight">
        <span className="block text-[0.98rem] font-semibold tracking-[-0.01em]" translate="no">
          StatLin
        </span>
        {subtitle && <span className="block text-[0.72rem] text-stone">Statistiksektionen i Linköping</span>}
      </span>
    </Link>
  );
}

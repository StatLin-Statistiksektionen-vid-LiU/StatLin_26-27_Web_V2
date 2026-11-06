"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useRef, useState, useSyncExternalStore, type ComponentType, type MouseEvent, type ReactNode } from "react";
import { isPlainClick, openSearch, preloadSearch } from "@/components/search/open-search";
import { languageSwitch, NAV, type NavGroup } from "@/lib/navigation";
import { FOCUS_SEARCH_EVENT } from "@/lib/search-prefetch";
import { closeWhenWider, useFocusLayer } from "@/lib/use-focus-layer";
import {
  BookOpen,
  Calendar,
  ChevronDown,
  Close,
  Globe,
  Handshake,
  Home,
  Key,
  Mail,
  Menu,
  Newspaper,
  Search,
  Users,
} from "@/components/icons";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { cn } from "@/lib/utils";

type IconType = ComponentType<{ size?: number; className?: string }>;

/** Ikonen framför varje rad i menyn. */
const ICONS: Record<string, IconType> = {
  Evenemang: Calendar,
  Nytt: Newspaper,
  Sektionen: Users,
  Studenter: BookOpen,
  Företag: Handshake,
  Kontakt: Mail,
};

/**
 * Sidomenyn på datorn och listen överst på telefonen. Namnet är kvar från tiden då menyn låg i ett sidhuvud.
 * Grupperna är details, så att de går att fälla ut även utan JavaScript; den grupp man står i är utfälld.
 */
/** Sponsorerna hämtas på servern (MenuSponsors) och skickas hit färdiga, en gång för sidomenyn och en gång för telefonens meny. */
type Sponsors = { sidebar: ReactNode; menu: ReactNode };

const noSubscription = () => () => {};

/**
 * Sidhuvudet ritas i sidans statiska skal utan sökväg, alltså utan markerad sida, precis som utan JavaScript.
 * usePathname() är URL-data och skulle göra hela sidhuvudet till en strömmad del på varje sida. Den delen visades då
 * först, och React väntar minst 300 ms mellan två visningar, så sidans eget innehåll kom 300 ms senare än det behövde.
 * Sökvägen läses därför först efter hydreringen, av PathWatcher, som också säger till vid varje sidbyte.
 */
export function SiteHeader({ sponsors }: { sponsors?: Sponsors }) {
  const [pathname, setPathname] = useState<string | null>(null);
  const hydrated = useSyncExternalStore(noSubscription, () => true, () => false);
  return (
    <>
      {hydrated && (
        <Suspense fallback={null}>
          <PathWatcher onChange={setPathname} />
        </Suspense>
      )}
      <HeaderView pathname={pathname} sponsors={sponsors} />
    </>
  );
}

function PathWatcher({ onChange }: { onChange: (pathname: string) => void }) {
  const pathname = usePathname();
  useEffect(() => onChange(pathname), [pathname, onChange]);
  return null;
}

function HeaderView({ pathname, sponsors }: { pathname: string | null; sponsors?: Sponsors }) {
  const [open, setOpen] = useState(false);
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

  // Listen ligger ovanpå menyn och har stängknappen, så den hör till lagret. Resten av sidan blir inert.
  useFocusLayer({
    active: open,
    layers: () => [barRef.current, menuRef.current],
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
          <NavTree pathname={pathname} size="sm" />
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
          <NavTree pathname={pathname} size="lg" onNavigate={() => setOpen(false)} />
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

/** Menyns träd. sm är datorns sidomeny, lg telefonens meny med större rader för fingret. */
function NavTree({ pathname, size, onNavigate }: { pathname: string | null; size: "sm" | "lg"; onNavigate?: () => void }) {
  const active = (href: string) =>
    pathname !== null && (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));
  // Undersidor med ankare (/foretag#kompetens) ska inte markeras som sidan själv.
  const exact = (href: string) => !href.includes("#") && active(href);
  const groupActive = (g: NavGroup) => active(g.href) || !!g.children?.some((c) => exact(c.href));

  const row = cn(
    "flex w-full items-center gap-2.5 rounded-md px-2.5 transition-colors",
    size === "sm" ? "h-8 text-[0.875rem] pointer-coarse:h-10" : "h-11 text-[1rem]",
  );
  const rowState = (on: boolean) => (on ? "bg-ink/[0.06] font-medium text-ink" : "text-stone hover:bg-ink/[0.04] hover:text-ink");
  const iconSize = size === "sm" ? 16 : 18;

  const linkRow = (href: string, label: string, Icon: IconType) => {
    const on = active(href);
    return (
      <Link href={href} aria-current={pathname === href ? "page" : undefined} onClick={onNavigate} className={cn(row, rowState(on))}>
        <Icon size={iconSize} className={on ? "text-red" : undefined} />
        {label}
      </Link>
    );
  };

  return (
    <ul className="space-y-0.5">
      <li>{linkRow("/", "Start", Home)}</li>
      {NAV.map((item) => {
        const Icon = ICONS[item.label] ?? Users;
        if (!item.children) return <li key={item.href}>{linkRow(item.href, item.label, Icon)}</li>;
        const on = groupActive(item);
        return (
          <li key={item.href}>
            <details className="meny-grupp" open={on || undefined}>
              <summary className={cn(row, "cursor-pointer select-none", on ? "font-medium text-ink" : "text-stone hover:bg-ink/[0.04] hover:text-ink")}>
                <Icon size={iconSize} className={on ? "text-red" : undefined} />
                {item.label}
                <ChevronDown size={14} className="meny-pil ml-auto opacity-60 transition-transform duration-200" />
              </summary>
              <ul className={cn("mb-1.5 mt-0.5 space-y-0.5 border-l border-line", size === "sm" ? "ml-[1.15rem] pl-2" : "ml-[1.35rem] pl-2.5")}>
                {item.children.map((c) => {
                  const here = exact(c.href);
                  return (
                    <li key={c.href + c.label}>
                      <Link
                        href={c.href}
                        aria-current={pathname === c.href ? "page" : undefined}
                        onClick={onNavigate}
                        className={cn(
                          "relative flex items-center rounded-md px-2.5 transition-colors",
                          size === "sm" ? "h-7 text-[0.84rem] pointer-coarse:h-10" : "h-10 text-[0.95rem]",
                          here ? "bg-ink/[0.06] font-medium text-ink" : "text-stone hover:bg-ink/[0.04] hover:text-ink",
                        )}
                      >
                        {here && <span aria-hidden className={cn("absolute top-1/2 h-4 w-px -translate-y-1/2 bg-red", size === "sm" ? "-left-[0.55rem]" : "-left-[0.7rem]")} />}
                        {c.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </details>
          </li>
        );
      })}
    </ul>
  );
}

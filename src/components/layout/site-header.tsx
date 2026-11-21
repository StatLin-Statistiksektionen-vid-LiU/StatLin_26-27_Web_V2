"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore, type MouseEvent, type ReactNode, type RefObject } from "react";
import { useRedigera } from "@/components/edit-mode/utkast";
import { isPlainClick, openSearch, preloadSearch } from "@/components/search/open-search";
import { languageSwitch } from "@/lib/navigation";
import { FOCUS_SEARCH_EVENT } from "@/lib/search-prefetch";
import { useFocusLayer } from "@/lib/use-focus-layer";
import { Close, Edit, Globe, Key, Menu, Search } from "@/components/icons";
import { HERO_ANDRAD } from "@/components/layout/hero-topp";
import { MenyKontext } from "@/components/layout/meny-trad";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { cn } from "@/lib/utils";

/**
 * Listen överst på alla sidor. På datorn står menyn i den som en rad med utfällbara grupper (meny-rad.tsx), och under lg
 * öppnar menyknappen en panel med menyn som ett träd (meny-trad.tsx). Samma panel öppnas på datorn i redigeringsläget, där
 * menyn ändras, och när raden inte ryms i listen.
 *
 * Menyn hämtas på servern och skickas hit färdig, en gång som rad och en gång som träd. Den står med standardmenyn i skalet
 * och byts mot den sparade när den kommer (se (site)/layout.tsx). Sponsorerna står sist i panelen.
 */
type Meny = { rad: ReactNode; trad: ReactNode };

const noSubscription = () => () => {};

/**
 * Sidhuvudet ritas i sidans statiska skal utan sökväg, alltså utan markerad sida, precis som utan JavaScript.
 * usePathname() är URL-data och skulle göra hela sidhuvudet till en strömmad del på varje sida. Den delen visades då
 * först, och React väntar minst 300 ms mellan två visningar, så sidans eget innehåll kom 300 ms senare än det behövde.
 * Sökvägen läses därför först efter hydreringen, av PathWatcher, som också säger till vid varje sidbyte.
 */
export function SiteHeader({ meny, sponsors }: { meny?: Meny; sponsors?: ReactNode }) {
  const [pathname, setPathname] = useState<string | null>(null);
  const hydrated = useSyncExternalStore(noSubscription, () => true, () => false);
  return (
    <>
      {hydrated && (
        <Suspense fallback={null}>
          <PathWatcher onChange={setPathname} />
        </Suspense>
      )}
      <HeaderView pathname={pathname} meny={meny} sponsors={sponsors} />
    </>
  );
}

function PathWatcher({ onChange }: { onChange: (pathname: string) => void }) {
  const pathname = usePathname();
  useEffect(() => onChange(pathname), [pathname, onChange]);
  return null;
}

/** Så stor del av heron ska vara förbi innan listen får sin bakgrund. Listen står då över herons sista femtedel. */
const HERO_FORBI = 0.82;

/**
 * Om listen ska ha sin bakgrund. På en vanlig sida kommer den så fort man har börjat scrolla. Över startsidans hero är listen
 * genomskinlig nästan hela vägen, som på förra sajten, och loggan framför namnet kommer samtidigt som bakgrunden. På
 * STAR-sidorna kommer bakgrunden när herons egen logga når listen, och då byts också loggan i listen mot den.
 *
 * Gränsen mäts när sidan byts och när heron ändrar storlek, inte vid varje scrollning. Next har kvar förra sidan dold i
 * dokumentet, och en dold hero har ingen höjd, så bara den synliga räknas. En hero på en strömmad sida kan komma efter
 * sidbytet, och säger då till själv (hero-topp.tsx).
 */
function useScrollad(pathname: string | null) {
  const [scrollad, setScrollad] = useState(false);
  useEffect(() => {
    let grans = 8;
    let hero: HTMLElement | undefined;
    const las = () => setScrollad(window.scrollY > grans);
    const mat = () => {
      const synlig = [...document.querySelectorAll<HTMLElement>("[data-hero-yta]")].find((h) => h.offsetHeight > 0);
      if (synlig !== hero) {
        if (hero) storlek.unobserve(hero);
        hero = synlig;
        if (hero) storlek.observe(hero);
      }
      // En hero kan ha ett eget märke för gränsen (data-hero-grans). Listen får då sin bakgrund när märket når det som ligger
      // fast överst, vars höjd står i märkets scroll-margin-top (globals.css). Annars gäller andelen av heron.
      const marke = hero?.querySelector<HTMLElement>("[data-hero-grans]");
      if (!hero) grans = 8;
      else if (marke) grans = marke.getBoundingClientRect().top + window.scrollY - (parseFloat(getComputedStyle(marke).scrollMarginTop) || 0);
      else grans = hero.getBoundingClientRect().top + window.scrollY + hero.offsetHeight * HERO_FORBI;
      las();
    };
    const storlek = new ResizeObserver(mat);
    mat();
    window.addEventListener("scroll", las, { passive: true });
    window.addEventListener("resize", mat);
    window.addEventListener(HERO_ANDRAD, mat);
    return () => {
      storlek.disconnect();
      window.removeEventListener("scroll", las);
      window.removeEventListener("resize", mat);
      window.removeEventListener(HERO_ANDRAD, mat);
    };
  }, [pathname]);
  return scrollad;
}

/** Om menyraden är bredare än sin plats i listen. Raden mäts också när den är dold, så att den kommer tillbaka när den ryms. */
function useTrang(plats: RefObject<HTMLElement | null>, rad: RefObject<HTMLElement | null>) {
  const [trang, setTrang] = useState(false);
  useEffect(() => {
    const p = plats.current;
    const r = rad.current;
    if (!p || !r) return;
    const mat = new ResizeObserver(() => setTrang(r.offsetWidth > p.clientWidth));
    mat.observe(p);
    mat.observe(r);
    return () => mat.disconnect();
  }, [plats, rad]);
  return trang;
}

/** Startsidan, och sidorna som visar den med var sin hero (src/lib/hero-val.ts). */
const STARTSIDA = /^\/(hero\/[12])?$/;

const RAM = "rounded-lg border border-line text-stone transition-colors hover:border-ink/25 hover:text-ink";
const KNAPP = `grid size-10 place-items-center ${RAM} pointer-coarse:size-11 lg:pointer-fine:size-9`;
/** Menyknappen i redigeringsläget: samma ruta som annars under lg, och på datorn en knapp med text som säger vad den är till för. */
const ANDRA_MENYN = `flex items-center justify-center gap-2 ${RAM} max-lg:size-10 max-lg:pointer-coarse:size-11 lg:px-3 lg:text-[0.84rem] lg:font-medium lg:pointer-fine:h-9 lg:pointer-coarse:h-11`;
const TEXTKNAPP = "inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[0.84rem] font-medium text-stone transition-colors hover:bg-ink/[0.05] hover:text-ink pointer-coarse:h-11";

function HeaderView({ pathname, meny, sponsors }: { pathname: string | null; meny?: Meny; sponsors?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const scrollad = useScrollad(pathname);
  const redigerar = useRedigera("b:meny");
  const iRaden = useMemo(() => ({ pathname }), [pathname]);
  const iPanelen = useMemo(() => ({ pathname, onNavigate: () => setOpen(false) }), [pathname]);
  const barRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const platsRef = useRef<HTMLElement>(null);
  const radRef = useRef<HTMLDivElement>(null);
  const trang = useTrang(platsRef, radRef);
  // På datorn syns menyknappen bara när panelen behövs där.
  const knappPaDatorn = redigerar || trang || open;
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

  // Listen ligger ovanpå panelen och har stängknappen, så den hör till lagret. Resten av sidan blir inert, utom
  // redigeringslägets list och ruta: menyn går att ändra i, och då ska Spara och rutans fält fungera.
  useFocusLayer({
    active: open,
    layers: () => [barRef.current, menuRef.current, ...document.querySelectorAll<HTMLElement>(".redigeringslist, .redigerbar-ruta")],
    initial: () => toggleRef.current,
    returnTo: () => toggleRef.current,
  });

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

      {/* Högst upp på sidan är listen genomskinlig. Bakgrunden kommer när man scrollar eller öppnar panelen (.sidhuvud i globals.css). */}
      <header
        ref={barRef}
        data-sida={pathname === null ? undefined : STARTSIDA.test(pathname) ? "hem" : "annan"}
        data-scrollad={scrollad || open || undefined}
        className="sidhuvud fixed inset-x-0 top-0 z-50 h-[var(--header-h)] print:hidden"
      >
        <div className="container-site flex h-full items-center gap-4">
          <Brand />

          {/* Raden står kvar i layouten när den inte ryms, osynlig, så att den går att mäta. */}
          <nav ref={platsRef} aria-label="Huvudmeny" className={cn("hidden min-w-0 flex-1 lg:block", trang && "invisible")}>
            <div ref={radRef} className="mx-auto w-max">
              <MenyKontext.Provider value={iRaden}>{meny?.rad}</MenyKontext.Provider>
            </div>
          </nav>

          <div className="ml-auto flex items-center gap-1.5 lg:ml-0">
            <Link {...searchProps} className={cn(KNAPP, onSearch && "border-ink/25 text-ink")}>
              <Search size={17} />
            </Link>
            {/* Under lg står språket, läget och inloggningen i panelen. Raden döljs som helhet, eftersom språklänkarna har egna regler för när de syns. */}
            <div className="hidden items-center gap-0.5 lg:flex">
              {languageLinks(TEXTKNAPP)}
              <ThemeToggle className="size-9 rounded-lg text-stone transition-colors hover:bg-ink/[0.05] hover:text-ink pointer-coarse:size-11" />
              <Link href="/admin" title="Logga in som post" className={TEXTKNAPP}>
                <Key size={15} />
                Poster
              </Link>
            </div>
            {/* Utan JavaScript går panelen inte att öppna. Sidfoten har samma länkar. */}
            <a href="#sidfot" aria-label="Alla sidor, i sidfoten" className={cn("meny-utan-js", KNAPP)}>
              <Menu size={18} />
            </a>
            <button
              ref={toggleRef}
              type="button"
              className={cn("meny-knapp", redigerar && !open ? ANDRA_MENYN : KNAPP, !knappPaDatorn && "lg:hidden")}
              // I redigeringsläget är knappens namn texten som syns: Ändra menyn på datorn, annars Öppna meny.
              aria-label={open ? "Stäng meny" : redigerar ? undefined : "Öppna meny"}
              aria-expanded={open}
              aria-controls="mobilmeny"
              onClick={() => setOpen((o) => !o)}
            >
              {open ? (
                <Close size={18} />
              ) : redigerar ? (
                <>
                  <Menu size={18} className="lg:hidden" />
                  <span className="sr-only lg:hidden">Öppna meny</span>
                  <Edit size={15} className="max-lg:hidden" />
                  <span className="max-lg:hidden">Ändra menyn</span>
                </>
              ) : (
                <Menu size={18} />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Panelen med menyn som träd: hela skärmen under listen på telefonen, en spalt till höger på datorn. */}
      <div
        ref={menuRef}
        id="mobilmeny"
        data-oppen={open || undefined}
        className={cn(
          "fixed inset-x-0 bottom-0 top-[var(--header-h)] z-40 overflow-y-auto overscroll-contain bg-paper transition-[opacity,visibility] duration-300 lg:left-auto lg:w-[24rem] lg:border-l lg:border-line",
          open ? "visible opacity-100" : "invisible opacity-0",
        )}
      >
        <nav aria-label="Mobilmeny" className="px-3 pb-12 pt-3">
          <MenyKontext.Provider value={iPanelen}>{meny?.trad}</MenyKontext.Provider>
          <div className="mt-6 grid grid-cols-2 gap-2 border-t border-line px-1 pt-6 text-[0.9rem] lg:hidden">
            {languageLinks("btn btn-ghost")}
            <ThemeToggle withLabel className="btn btn-ghost" />
            <Link href="/admin" className="btn btn-ghost col-span-2">
              <Key size={16} /> Logga in som post
            </Link>
          </div>
          {sponsors}
        </nav>
      </div>
    </>
  );
}

/**
 * Sektionens namn i versaler med LIN i rött, och loggan framför. På startsidan står den stora loggan i heron, så där kommer
 * den lilla först när listen har fått sin bakgrund (.sidhuvud-logga i globals.css).
 */
function Brand() {
  return (
    <Link href="/" className="group flex shrink-0 items-center pointer-coarse:min-h-11" aria-label="StatLin, startsida">
      <span className="sidhuvud-logga">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/statlin.svg"
          alt=""
          width={32}
          height={32}
          className="size-8 max-w-none transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:rotate-[-12deg]"
        />
        {/* STAR-dagens logga. På STAR-sidorna tar den över när listen har fått sin bakgrund (.sidhuvud-logga-star i globals.css). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/utskott/star.webp" alt="" width={32} height={32} loading="lazy" className="sidhuvud-logga-star" />
      </span>
      {/* Versalerna kommer från typsnittsklassen, så att namnet står som StatLin för den som kopierar eller lyssnar. */}
      <span className="display-tight text-[1.05rem]" translate="no">
        Stat<span className="text-red">Lin</span>
      </span>
    </Link>
  );
}

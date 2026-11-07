import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { FloatingLogo } from "@/components/brand/floating-logo";
import { FormulaRing } from "@/components/brand/formula-ring";
import { HeroAnteckning } from "@/components/content/handskrift";
import { EditModeButton } from "@/components/edit-mode/editable";
import { RText } from "@/components/edit-mode/redigerbar";
import { ArrowUpRight } from "@/components/icons";
import { AccentText } from "@/components/ui/accent-text";
import { CountUp } from "@/components/ui/count-up";
import { IntroOnce } from "@/components/ui/intro-once";
import { DEFAULT_SETTINGS, getSettings, listBoard, listCommittees } from "@/lib/data/content";
import { countUpcomingEvents } from "@/lib/data/events";
import { START } from "@/lib/innehall/block/start";
import { getBlock, textVarde } from "@/lib/innehall/server";
import type { Start } from "@/lib/innehall/typer";
import { PROGRAMS } from "@/lib/links";
import { siteText, type SiteTextKey } from "@/lib/site-texts";
import type { SiteSettings } from "@/lib/types";
import { HeroGrid } from "./hero-grid";
import { StartKnappar } from "./start-knappar";

/*
 * Startsidans huvud i två rader. Överst rubriken och knapparna till vänster och loggan till höger. Under en hårlinje
 * texten om sektionen och siffrorna som en lista. Alla texter ändras där de står i redigeringsläget; formelringen och
 * tidslinjens färger har en egen knapp vid loggan.
 */

/** På en smal telefon krymper rubriken med fönstret, så att maskininlärning ryms på en rad även vid 320 pixlar eller 400 procents zoom. */
const RUBRIK = "display-tight break-words text-[length:max(min(7vw,1.9rem),min(3.3vw,2.9rem))] leading-[1.02] [text-wrap:balance]";
const INGRESS = "mt-5 max-w-xl text-[1.02rem] leading-relaxed text-stone empty:hidden md:text-[1.1rem]";

/** Knapparna i heron. De går att ändra i redigeringsläget; tills de har kommit visas standardknapparna. */
async function HeroKnappar() {
  return <StartKnappar start={await getBlock("start")} vilka="hero" />;
}

async function HeroKicker() {
  const s = await getSettings();
  return <RText id="s:hero_kicker" value={textVarde(s, "hero_kicker")} accent="text-ink" />;
}

async function HeroText() {
  const s = await getSettings();
  return (
    <>
      <h1 className={RUBRIK}>
        <RText id="s:hero_title" value={textVarde(s, "hero_title")} accent="mono-accent text-red" rader />
      </h1>
      <p className={INGRESS}>
        <RText id="s:hero_text" value={textVarde(s, "hero_text")} accent="text-ink" rader />
      </p>
    </>
  );
}

/** Tills inställningarna har kommit håller en osynlig kopia av standardtexten platsen. */
function HeroTextPlats() {
  return (
    <div className="invisible" aria-hidden>
      <p className={RUBRIK}>
        <AccentText text={DEFAULT_SETTINGS.hero_title} plats />
      </p>
      <p className={INGRESS}>
        <AccentText text={DEFAULT_SETTINGS.hero_text} plats />
      </p>
    </div>
  );
}

/** Formelringen kan stängas av med knappen vid loggan. Den kommer efter skalet, så loggan syns direkt i båda fallen. */
async function HeroRing() {
  const s = await getSettings();
  return s.hero_formulas === "av" ? null : <FormulaRing />;
}

/** Anteckningen för hand bredvid loggan. Den är dold tills den skrivs, så den behöver ingen platshållare. */
async function HeroAnteckningLaddad() {
  return <HeroAnteckning handskrift={await getBlock("handskrift")} />;
}

type Siffra = { value: number; label: SiteTextKey; href: string } & ({ not: string } | { notText: SiteTextKey });

async function HeroOm() {
  const [s, start, committees, board, upcoming] = await Promise.all([getSettings(), getBlock("start"), listCommittees({ visibleOnly: true }), listBoard(), countUpcomingEvents()]);
  const utskott = committees.filter((c) => c.kind !== "styrelse");
  const siffror: Siffra[] = [
    { value: utskott.length, label: "text_start_siffra_utskott", not: utskott.length > 1 ? `från ${utskott[0].short_name} till ${utskott[utskott.length - 1].short_name}` : "på sektionen", href: "/utskott" },
    { value: board.length, label: "text_start_siffra_styrelsen", notText: "text_start_siffra_styrelsen_not", href: "/sektionen/styrelsen" },
    { value: upcoming, label: "text_start_siffra_evenemang", notText: "text_start_siffra_evenemang_not", href: "/evenemang" },
    { value: PROGRAMS.length, label: "text_start_siffra_program", not: PROGRAMS.map((p) => p.label.toLowerCase()).join(" och "), href: `/studenter/${PROGRAMS[0].value}` },
  ];
  return <HeroOmVy s={s} start={start} siffror={siffror} />;
}

/** Samma del med standardtexterna, osynlig, så att sidan inte hoppar när den riktiga kommer. */
function HeroOmPlats() {
  const siffror: Siffra[] = [
    { value: 0, label: "text_start_siffra_utskott", not: "på sektionen", href: "#utskott" },
    { value: 0, label: "text_start_siffra_styrelsen", notText: "text_start_siffra_styrelsen_not", href: "#styrelsen" },
    { value: 0, label: "text_start_siffra_evenemang", notText: "text_start_siffra_evenemang_not", href: "#evenemang" },
    { value: 0, label: "text_start_siffra_program", not: PROGRAMS.map((p) => p.label.toLowerCase()).join(" och "), href: "#program" },
  ];
  return <HeroOmVy s={DEFAULT_SETTINGS} start={START.standard()} siffror={siffror} plats />;
}

function HeroOmVy({ s, start, siffror, plats }: { s: SiteSettings; start: Start; siffror: Siffra[]; plats?: boolean }) {
  // Platshållaren har inga redigerare: den syns inte och byts ut så fort det riktiga innehållet har kommit.
  const text = (key: SiteTextKey, accent = "contents"): ReactNode =>
    plats ? <AccentText text={siteText(s, key)} accentClassName={accent} plats /> : <RText id={`s:${key}`} value={siteText(s, key)} accent={accent} />;
  const intro = textVarde(s, "home_intro");
  return (
    <div
      className={plats ? "invisible" : "[animation:fade-up_0.9s_0.24s_var(--ease-out-expo)_backwards]"}
      aria-hidden={plats || undefined}
    >
      <div className="grid gap-8 border-t border-line pb-9 pt-7 md:pb-11 md:pt-9 lg:grid-cols-12 lg:gap-12">
        <div className="min-w-0 lg:col-span-7">
          <p className="kicker text-stone">{text("text_start_om_kicker")}</p>
          <p className="mt-4 max-w-2xl text-[clamp(1.25rem,2vw,1.65rem)] font-semibold leading-[1.22] tracking-tight [font-stretch:104%]">
            {plats ? <AccentText text={intro} accentClassName="mono-accent text-red-deep" plats /> : <RText id="s:home_intro" value={intro} accent="mono-accent text-red-deep" rader />}
          </p>
          <StartKnappar start={start} vilka="om" className="mt-7" />
        </div>
        {/* Siffrorna som en lista: talet, vad det räknar och en rad om det. Hela raden är en länk dit. Linjer bara mellan raderna, eftersom delen redan har en hårlinje överst. */}
        <ul className="min-w-0 divide-y divide-line lg:col-span-5">
          {siffror.map((f) => (
            <li key={f.label}>
              <Link
                href={f.href}
                tabIndex={plats ? -1 : undefined}
                className="group/siffra grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-x-4 py-3 pr-1 transition-colors hover:bg-paper-2/60 sm:grid-cols-[4rem_minmax(0,1fr)_auto]"
              >
                <span className="display tabular text-right text-[clamp(1.7rem,2.4vw,2.15rem)] leading-none text-ink">{plats ? f.value : <CountUp value={f.value} />}</span>
                <span className="min-w-0">
                  <span className="block font-semibold leading-snug">{text(f.label)}</span>
                  <span className="block text-[0.84rem] leading-snug text-stone">{"not" in f ? f.not : text(f.notText)}</span>
                </span>
                <ArrowUpRight
                  size={16}
                  className="text-stone-light transition-[color,translate] duration-300 group-hover/siffra:-translate-y-0.5 group-hover/siffra:translate-x-0.5 group-hover/siffra:text-red"
                />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    // data-hero-yta: meddelandet från Inställningar väntar tills heron inte längre når ner i skärmens nedre del, se AnnouncementPill.
    <section data-startsida data-hero-yta data-ljus className="hero relative isolate border-b border-line">
      <IntroOnce />
      {/* Ljuset kring pekaren kommer från RutnatLjus i layouten, som lyser här och i sidhuvudena (data-ljus) och ligger i linje med det här rutnätet. */}
      <HeroGrid ljus={false} />
      <div className="container-site relative grid items-center gap-7 pb-8 pt-[calc(var(--header-h)+1.75rem)] md:pb-10 md:pt-[calc(var(--header-h)+2.75rem)] lg:grid-cols-12 lg:gap-10">
        <div className="min-w-0 lg:col-span-7">
          <p className="kicker flex items-center gap-2.5 text-stone [animation:fade-up_0.8s_var(--ease-out-expo)_backwards]">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-red" />
            </span>
            <Suspense fallback={<span className="invisible">{DEFAULT_SETTINGS.hero_kicker}</span>}>
              <HeroKicker />
            </Suspense>
          </p>
          <div className="mt-5 [animation:fade-up_0.9s_0.08s_var(--ease-out-expo)_backwards]">
            <Suspense fallback={<HeroTextPlats />}>
              <HeroText />
            </Suspense>
          </div>
          {/* Knapparna leder de tre som oftast kommer hit vidare: den som vill engagera sig, den som är ny och företagen. */}
          {/* Animationen står utanför hålet, så att den inte börjar om när knapparna kommer från databasen. */}
          <div className="mt-8 [animation:fade-up_0.9s_0.16s_var(--ease-out-expo)_backwards]">
            <Suspense fallback={<StartKnappar start={START.standard()} vilka="hero" />}>
              <HeroKnappar />
            </Suspense>
          </div>
        </div>

        {/* Loggan står direkt på sidan, på heroens millimeterpapper (HeroGrid). På telefon och surfplatta står den överst (hero-figur i globals.css). */}
        <figure className="hero-figur relative mx-auto aspect-square w-full max-w-[15rem] sm:max-w-[20rem] lg:col-span-5 lg:max-w-[25rem]">
          <div aria-hidden className="kicker absolute left-0 top-0 text-stone-light">
            Fig. 1
          </div>
          <div aria-hidden className="kicker absolute right-0 top-0 text-right text-stone-light">
            58.3978° N
            <br />
            15.5760° E
          </div>
          <div className="absolute inset-0 grid place-items-center p-[9%]">
            <FloatingLogo
              className="w-full"
              ring={
                <Suspense fallback={null}>
                  <HeroRing />
                </Suspense>
              }
            />
          </div>
          {/* Står till vänster om figuren, där det finns plats från 1280 pixlar. */}
          <Suspense fallback={null}>
            <HeroAnteckningLaddad />
          </Suspense>
          <figcaption className="kicker absolute inset-x-0 bottom-0 flex justify-between text-stone-light">
            <span translate="no">StatLin</span>
            <span>n = alla</span>
          </figcaption>
          <EditModeButton target={{ type: "home" }} icon="installningar" className="absolute bottom-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap">
            Loggan och tidslinjen
          </EditModeButton>
        </figure>
      </div>
      <div className="container-site">
        <Suspense fallback={<HeroOmPlats />}>
          <HeroOm />
        </Suspense>
      </div>
    </section>
  );
}

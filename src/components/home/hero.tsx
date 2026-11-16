import { Suspense } from "react";
import { FloatingLogo } from "@/components/brand/floating-logo";
import { FormulaRing } from "@/components/brand/formula-ring";
import { EditModeButton } from "@/components/edit-mode/editable";
import { RText } from "@/components/edit-mode/redigerbar";
import { AccentText } from "@/components/ui/accent-text";
import { IntroOnce } from "@/components/ui/intro-once";
import { DEFAULT_SETTINGS, getSettings } from "@/lib/data/content";
import { START } from "@/lib/innehall/block/start";
import { getBlock, textVarde } from "@/lib/innehall/server";
import { HeroFit } from "./hero-fit";
import { HeroGrid } from "./hero-grid";
import { StartKnappar } from "./start-knappar";

/*
 * Startsidans huvud, i en spalt: sektionens namn uppe i hörnet, loggan i mitten och under den rubriken och knapparna. Loggan står
 * stilla, inskriven i millimeterpapperets grova rutor. Bakom den anpassas en röd kurva till en svärm av punkter (HeroFit), papperet
 * lyser längs kurvan och felet står i det andra hörnet. Musen är en punkt till i stickprovet. Alla texter ändras där de står i
 * redigeringsläget; formelringen har en egen knapp vid loggan.
 */

/** På en smal telefon krymper rubriken med fönstret, så att maskininlärning ryms på en rad även vid 320 pixlar eller 400 procents zoom. */
const RUBRIK = "display-tight mx-auto max-w-3xl break-words text-[length:max(min(6.2vw,1.6rem),min(2.6vw,2.25rem))] leading-[1.04] [text-wrap:balance]";
const INGRESS = "mx-auto mt-5 max-w-xl text-[1.02rem] leading-relaxed text-stone empty:hidden md:text-[1.1rem]";
/** På telefon står den första knappen ensam på sin rad, och de andra under den. */
const KNAPPAR = "justify-center max-sm:[&>*:first-child]:basis-full max-sm:[&>*:first-child]:justify-center";

/** Knapparna i heron. De går att ändra i redigeringsläget; tills de har kommit visas standardknapparna. */
async function HeroKnappar() {
  return <StartKnappar start={await getBlock("start")} className={KNAPPAR} />;
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
        <RText id="s:hero_title" value={textVarde(s, "hero_title")} accent="text-red" rader />
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

export function Hero() {
  return (
    // data-hero-yta: meddelandet från Inställningar väntar tills heron inte längre når ner i skärmens nedre del, se AnnouncementPill.
    <section data-startsida data-hero-yta className="hero relative isolate border-b border-line">
      <IntroOnce />
      {/* Papperet lyser längs den röda kurvan, och HeroFit lägger det efter loggan. */}
      <HeroGrid />
      <HeroFit />
      <div className="container-site relative flex flex-col items-center pb-8 pt-[calc(var(--header-h)+1.75rem)] text-center md:pb-10 md:pt-[calc(var(--header-h)+2.75rem)]">
        <div className="kicker flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-1.5 text-stone [animation:fade-up_0.8s_var(--ease-out-expo)_backwards]">
          <p className="flex items-center gap-2.5">
            <span className="size-2 shrink-0 rounded-full bg-red" aria-hidden />
            <Suspense fallback={<span className="invisible">{DEFAULT_SETTINGS.hero_kicker}</span>}>
              <HeroKicker />
            </Suspense>
          </p>
          {/* Den röda kurvans medelkvadratfel. HeroFit skriver det och tänder det när kurvan har vuxit ut. På en smal telefon ryms det inte bredvid namnet. */}
          <span data-mse aria-hidden className="tabular ml-auto text-stone-light opacity-0 max-[26rem]:hidden transition-opacity duration-1000 data-[pa]:opacity-100" />
        </div>

        {/* Loggan står direkt på heroens millimeterpapper. Bredden är i pixlar, som papperets rutor: den svarta ringen är då två grova */}
        {/* rutor bred på telefon och tre från surfplatta, och HeroFit lägger papperet så att ringen står inskriven i dem. */}
        <figure className="relative mt-6 aspect-square w-[181px] md:w-[272px] lg:mt-9">
          <FloatingLogo
            className="w-full"
            svavar={false}
            ring={
              <Suspense fallback={null}>
                <HeroRing />
              </Suspense>
            }
          />
          <EditModeButton target={{ type: "home" }} icon="installningar" className="absolute bottom-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap">
            Formelringen
          </EditModeButton>
        </figure>

        <div className="mt-8 w-full [animation:fade-up_0.9s_0.08s_var(--ease-out-expo)_backwards]">
          <Suspense fallback={<HeroTextPlats />}>
            <HeroText />
          </Suspense>
        </div>
        {/* Knapparna leder de tre som oftast kommer hit vidare: den som vill engagera sig, den som är ny och företagen. */}
        {/* Animationen står utanför hålet, så att den inte börjar om när knapparna kommer från databasen. */}
        <div className="mt-7 [animation:fade-up_0.9s_0.16s_var(--ease-out-expo)_backwards]">
          <Suspense fallback={<StartKnappar start={START.standard()} className={KNAPPAR} />}>
            <HeroKnappar />
          </Suspense>
        </div>
      </div>
    </section>
  );
}

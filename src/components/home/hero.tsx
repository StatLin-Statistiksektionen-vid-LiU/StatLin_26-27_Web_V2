import Link from "next/link";
import { Suspense } from "react";
import { FloatingLogo } from "@/components/brand/floating-logo";
import { FormulaRing } from "@/components/brand/formula-ring";
import { ArrowRight } from "@/components/icons";
import { AccentText } from "@/components/ui/accent-text";
import { IntroOnce } from "@/components/ui/intro-once";
import { DEFAULT_SETTINGS, getSettings } from "@/lib/data/content";
import { cn } from "@/lib/utils";
import { Editable } from "@/components/edit-mode/editable";
import { HeroGrid } from "./hero-grid";

/** Texterna kommer från Inställningar → Startsidan. Loggan, formelringen och knapparna hör till det statiska skalet. */
async function HeroKicker() {
  const s = await getSettings();
  return <AccentText text={s.hero_kicker} accentClassName="text-ink" />;
}

/** Rubriken och meningen. Utan text håller en osynlig kopia av standardtexten platsen tills inställningarna har kommit.
 *  På en smal telefon krymper rubriken med fönstret, så att maskininlärning ryms på en rad även vid 320 pixlar eller 400 procents zoom. */
function HeroText({ title, text, placeholder }: { title: string; text: string; placeholder?: boolean }) {
  return (
    <div className={cn(placeholder && "invisible")} aria-hidden={placeholder || undefined}>
      {placeholder ? (
        <p className="display-tight break-words text-[length:max(min(7vw,1.9rem),min(3.3vw,2.9rem))] leading-[1.02] [text-wrap:balance]">
          <AccentText text={title} />
        </p>
      ) : (
        <h1 className="display-tight break-words text-[length:max(min(7vw,1.9rem),min(3.3vw,2.9rem))] leading-[1.02] [text-wrap:balance]">
          <AccentText text={title} accentClassName="mono-accent text-red" />
        </h1>
      )}
      {text && (
        <p className="mt-6 max-w-xl text-[1.05rem] leading-relaxed text-stone md:text-[1.15rem]">
          <AccentText text={text} accentClassName="text-ink" />
        </p>
      )}
    </div>
  );
}

/** Formelringen kan stängas av under Inställningar, Startsidan. Den kommer efter skalet, så loggan syns direkt i båda fallen. */
async function HeroRing() {
  const s = await getSettings();
  return s.hero_formulas === "av" ? null : <FormulaRing />;
}

async function HeroTextLoaded() {
  const s = await getSettings();
  return <HeroText title={s.hero_title.trim() || DEFAULT_SETTINGS.hero_title} text={s.hero_text.trim()} />;
}

/** Startsidans huvud: text till vänster, loggan med formelringen på ett rutnät till höger. */
export function Hero() {
  return (
    <section data-startsida className="hero relative isolate border-b border-line">
      <IntroOnce />
      <HeroGrid />
      <div className="container-site grid items-center gap-12 pb-14 pt-[calc(var(--header-h)+2.5rem)] md:pt-[calc(var(--header-h)+4rem)] lg:grid-cols-12 lg:pb-16">
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
          <Editable target={{ type: "home" }} label="Redigera texten" className="mt-6 [animation:fade-up_0.9s_0.08s_var(--ease-out-expo)_backwards]">
            <Suspense fallback={<HeroText title={DEFAULT_SETTINGS.hero_title} text={DEFAULT_SETTINGS.hero_text} placeholder />}>
              <HeroTextLoaded />
            </Suspense>
          </Editable>
          {/* Knapparna leder de tre som oftast kommer hit vidare: den som vill engagera sig, den som är ny och företagen. Evenemangen har en egen del längre ner. */}
          <div className="mt-9 flex flex-wrap items-center gap-2.5 [animation:fade-up_0.9s_0.16s_var(--ease-out-expo)_backwards]">
            <Link href="/utskott" className="btn btn-ink group">
              Engagera dig
              <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-0.5" />
            </Link>
            <Link href="/studenter/ny-student" className="btn btn-ghost">
              Ny student?
            </Link>
            <Link href="/foretag" className="btn btn-ghost">
              För företag
            </Link>
          </div>
        </div>

        {/* Loggan står direkt på sidan, på heroens millimeterpapper (HeroGrid). */}
        <figure className="relative mx-auto aspect-square w-full max-w-[22rem] sm:max-w-[26rem] lg:col-span-5 lg:max-w-[30rem]">
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
          <figcaption className="kicker absolute inset-x-0 bottom-0 flex justify-between text-stone-light">
            <span translate="no">StatLin</span>
            <span>n = alla</span>
          </figcaption>
        </figure>
      </div>
      {/* data-hero-botten: meddelandet från Inställningar väntar tills heron har lämnat skärmens nederkant, se AnnouncementPill. */}
      <div aria-hidden data-hero-botten className="pointer-events-none absolute inset-x-0 bottom-0 h-px" />
    </section>
  );
}

import Link from "next/link";
import { Suspense } from "react";
import { DEFAULT_SETTINGS, getSettings } from "@/lib/data/content";
import { getBlock } from "@/lib/innehall/server";
import { NAV, synligMeny, type NavGroup } from "@/lib/navigation";
import type { SiteSettings } from "@/lib/types";
import { ArrowUpRight, Facebook, Instagram, Linkedin, Mail, Rss } from "@/components/icons";
import { Editable } from "@/components/edit-mode/editable";
import { AccentText } from "@/components/ui/accent-text";
import { FooterSponsors } from "@/components/layout/sponsors";

/*
 * Sidfoten ställs upp efter sin egen bredd och inte efter fönstrets (@container): sidomenyn tar plats från lg, så sidfoten är
 * smalare vid 1024 px än vid 1000. Där allt ryms på en rad (från 63rem) står märket och kontakten till vänster och länkarna till
 * höger om en hårlinje. Smalare står märket och kontakten över länkarna: sloganen och kontakten bredvid varandra från @xl, i linje
 * med länkarnas spalter, som är fyra från @2xl och annars två. På telefon står allt under vartannat.
 */

/** Sloganen under loggan. *ord* blir röda, och utan text blir det ingen rad. */
function FooterSlogan({ text }: { text: string }) {
  if (!text.trim()) return null;
  return (
    <p className="display-tight max-w-sm text-[1.5rem] leading-[1.04]">
      <AccentText text={text} accentClassName="text-red" />
    </p>
  );
}

async function FooterSloganLoaded() {
  return <FooterSlogan text={(await getSettings()).footer_slogan} />;
}

async function FooterContact() {
  return <FooterContactView s={await getSettings()} />;
}

/** Sektionens konton, till höger i märkets rad som knapparna i telefonens sidhuvud. Utan konton blir det ingenting. */
async function FooterSocials() {
  const s = await getSettings();
  const socials = [
    { href: s.instagram, label: "Instagram", Icon: Instagram },
    { href: s.facebook, label: "Facebook", Icon: Facebook },
    { href: s.linkedin, label: "LinkedIn", Icon: Linkedin },
  ].filter((x) => x.href);
  if (socials.length === 0) return null;
  return (
    <ul className="ml-auto flex gap-1.5">
      {socials.map(({ href, label, Icon }) => (
        <li key={label}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            className="grid size-9 place-items-center rounded-lg border border-line bg-white text-stone transition-colors hover:border-ink/25 hover:text-ink pointer-coarse:size-11"
          >
            <Icon size={16} />
          </a>
        </li>
      ))}
    </ul>
  );
}

function FooterContactView({ s }: { s: SiteSettings }) {
  return (
    <div className="space-y-4 text-[0.86rem] leading-relaxed text-stone">
      {s.tagline && (
        <p className="max-w-sm">
          <AccentText text={s.tagline} accentClassName="text-ink" />
        </p>
      )}
      <div>
        {/* Stycket tar radavståndet, så att länkens större tryckyta (tryck) inte flyttar raderna runt om. */}
        <p>
          <a href={`mailto:${s.contact_email}`} className="tryck group inline-flex items-center gap-2.5 text-[0.95rem] font-medium text-ink">
            <Mail size={16} className="text-red" />
            <span className="link-underline">{s.contact_email}</span>
          </a>
        </p>
        {/* Postnumret ska inte delas mellan två rader. */}
        {s.address && <p className="mt-1.5">{s.address.replace(/(\d{3}) (\d{2})/, "$1 $2")}</p>}
        {s.org_number && <p className="font-mono text-[0.72rem]">Org.nr {s.org_number}</p>}
      </div>
    </div>
  );
}

/** Med fingret är varje länk 44 px hög och minst 44 px bred: utfyllnaden i sidled tas tillbaka av marginalen, så texten står kvar. */
const linkBas = "text-[0.88rem] text-stone transition-colors [overflow-wrap:anywhere] hover:text-ink pointer-coarse:-mx-2.5 pointer-coarse:px-2.5 pointer-coarse:py-3";
const linkClass = `${linkBas} pointer-coarse:inline-block`;
/** En länk med ikon efter texten. Den är en egen rad (inline-flex) även med fingret, annars hamnar ikonen under texten. */
const iconLink = `inline-flex items-center gap-1.5 ${linkBas}`;
/** Med fingret ger länkarnas egen höjd radavståndet. */
const listClass = "mt-3 pointer-fine:space-y-2 pointer-coarse:mt-1";
/** En grupp delas inte mellan två spalter. Luften under den är avståndet till nästa grupp i samma spalt, och sist i spalten räknas den in i navets luft nedtill. */
const groupClass = "break-inside-avoid pb-8 pointer-coarse:pb-5";

/**
 * Länkarna står i samma grupper som i menyn, så att allt finns på samma ställe överallt. Det som inte har en egen grupp står under Genvägar.
 * Grupperna fyller spalter (columns) som webbläsaren gör lika höga: två på telefon, där korta grupper hamnar under varandra, annars fyra.
 */
function FooterLinks({ meny }: { meny: NavGroup[] }) {
  const groups = meny.filter((g) => g.children?.length);
  const loose = meny.filter((g) => !g.children?.length);
  return (
    // Bredvid märket börjar länkarna en bit längre ner, så att gruppernas namn står mitt för märkets rad.
    <nav
      aria-label="Sidfot"
      className="columns-2 gap-x-6 border-t border-line pb-1 pt-9 @2xl:columns-4 @min-[63rem]:border-l @min-[63rem]:border-t-0 @min-[63rem]:pb-4 @min-[63rem]:pl-10 @min-[63rem]:pt-14.5"
    >
      <div className={groupClass}>
        <p className="kicker text-stone">Genvägar</p>
        <ul className={listClass}>
          {loose.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className={linkClass}>
                {l.label}
              </Link>
            </li>
          ))}
          <li>
            <a href="/kalender.ics" className={iconLink}>
              Kalenderflöde <Rss size={13} className="text-red" />
            </a>
          </li>
          <li>
            <Link href="/en" hrefLang="en" lang="en" className={iconLink}>
              In English <ArrowUpRight size={13} className="text-red" />
            </Link>
          </li>
        </ul>
      </div>
      {groups.map((g) => (
        <div key={g.label} className={groupClass}>
          <p className="kicker text-stone">{g.label}</p>
          <ul className={listClass}>
            {g.children?.map((l) => (
              <li key={l.href + l.label}>
                <Link href={l.href} className={linkClass}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Samma meny som i sidhuvudet, så som den är sparad. */
async function SavedFooterLinks() {
  return <FooterLinks meny={synligMeny(await getBlock("meny"))} />;
}

export function SiteFooter() {
  return (
    <footer id="sidfot" className="relative border-t border-line">
      {/* Sponsorerna först i sidfoten, så att de syns på varje sida. */}
      <Suspense fallback={null}>
        <FooterSponsors />
      </Suspense>
      <div className="container-site @container">
        <div className="grid @min-[63rem]:grid-cols-[minmax(0,5fr)_minmax(0,12fr)]">
          <div className="py-9 @min-[63rem]:py-12 @min-[63rem]:pr-10">
            {/* Pennan gäller sloganen och kontaktuppgifterna. Båda finns också under Inställningar i Admin. */}
            <Editable target={{ type: "footer" }} label="Redigera sidfoten">
              <div className="grid gap-x-6 gap-y-5 @xl:grid-cols-2 @min-[63rem]:grid-cols-1">
                {/* Märket med kontona går över hela bredden. Raden är lika hög med och utan dem, så att inget flyttar sig när de kommer. */}
                <div className="flex min-h-9 items-center gap-2.5 pointer-coarse:min-h-11 @xl:col-span-2 @min-[63rem]:col-span-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/brand/statlin.svg" alt="" width={32} height={32} loading="lazy" className="size-8" />
                  <span className="font-semibold tracking-[-0.01em]" translate="no">
                    StatLin
                  </span>
                  <Suspense fallback={null}>
                    <FooterSocials />
                  </Suspense>
                </div>
                {/* Sloganen står med standardtexten direkt i skalet och byts om den har ändrats. Utan JavaScript står standardtexten kvar. */}
                <Suspense fallback={<FooterSlogan text={DEFAULT_SETTINGS.footer_slogan} />}>
                  <FooterSloganLoaded />
                </Suspense>
                {/* Utan JavaScript ersätts fallbacken aldrig, så där står standardvärdena. De kan skilja sig från det som är sparat i Admin (SB-27). */}
                <Suspense
                  fallback={
                    <div className="min-h-24">
                      <noscript>
                        <FooterContactView s={DEFAULT_SETTINGS} />
                      </noscript>
                    </div>
                  }
                >
                  <FooterContact />
                </Suspense>
              </div>
            </Editable>
          </div>
          {/* Standardmenyn står i skalet och byts mot den sparade, som i sidhuvudet. */}
          <Suspense fallback={<FooterLinks meny={NAV} />}>
            <SavedFooterLinks />
          </Suspense>
        </div>

        <div className="flex flex-col gap-3 border-t border-line py-5 text-[0.8rem] text-stone @2xl:flex-row @2xl:items-center @2xl:justify-between">
          <p>
            © StatLin, Statistiksektionen i Linköping ·{" "}
            <Link href="/integritet" className="tryck link-underline inline-block text-ink">
              Integritet
            </Link>
          </p>
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <Link href="/admin" className="tryck group inline-flex items-center gap-1.5 text-ink">
              <span>
                <span className="text-stone">För poster:</span> <span className="link-underline">Logga in</span>
              </span>
              <ArrowUpRight size={13} className="text-red" />
            </Link>
            <p className="font-mono text-[0.72rem]">p &lt; 0,05 sedan länge</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

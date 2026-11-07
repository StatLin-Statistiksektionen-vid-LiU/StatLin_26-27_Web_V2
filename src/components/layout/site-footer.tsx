import Link from "next/link";
import { Suspense } from "react";
import { DEFAULT_SETTINGS, getSettings } from "@/lib/data/content";
import { getBlock } from "@/lib/innehall/server";
import { NAV, synligMeny, type NavGroup } from "@/lib/navigation";
import type { SiteSettings } from "@/lib/types";
import { ArrowUpRight, Facebook, Instagram, Linkedin, Mail, Rss } from "@/components/icons";
import { SidfotCitat } from "@/components/content/handskrift";
import { Editable } from "@/components/edit-mode/editable";
import { AccentText } from "@/components/ui/accent-text";
import { FooterSponsors } from "@/components/layout/sponsors";

/** Sloganen under loggan. *ord* blir röda, och utan text blir det ingen rad. */
function FooterSlogan({ text }: { text: string }) {
  if (!text.trim()) return null;
  return (
    <p className="display-tight max-w-sm text-[clamp(1.45rem,2.1vw,1.85rem)] leading-[1.04]">
      <AccentText text={text} accentClassName="mono-accent text-red" />
    </p>
  );
}

async function FooterSloganLoaded() {
  return <FooterSlogan text={(await getSettings()).footer_slogan} />;
}

async function FooterCitat() {
  return <SidfotCitat handskrift={await getBlock("handskrift")} />;
}

async function FooterContact() {
  return <FooterContactView s={await getSettings()} />;
}

function FooterContactView({ s }: { s: SiteSettings }) {
  const socials = [
    { href: s.instagram, label: "Instagram", Icon: Instagram },
    { href: s.facebook, label: "Facebook", Icon: Facebook },
    { href: s.linkedin, label: "LinkedIn", Icon: Linkedin },
  ].filter((x) => x.href);
  return (
    <div className="space-y-4">
      {s.tagline && (
        <p className="max-w-sm text-[0.92rem] leading-relaxed text-stone">
          <AccentText text={s.tagline} accentClassName="text-ink" />
        </p>
      )}
      <a href={`mailto:${s.contact_email}`} className="group inline-flex items-center gap-2.5 font-medium text-ink">
        <Mail size={16} className="text-red" />
        <span className="link-underline">{s.contact_email}</span>
      </a>
      {/* Postnumret ska inte delas mellan två rader. */}
      {s.address && <p className="max-w-xs text-[0.84rem] leading-relaxed text-stone">{s.address.replace(/(\d{3}) (\d{2})/, "$1 $2")}</p>}
      {s.org_number && <p className="font-mono text-[0.72rem] text-stone">Org.nr {s.org_number}</p>}
      {socials.length > 0 && (
        <ul className="flex gap-1.5">
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
      )}
    </div>
  );
}

const linkClass = "text-[0.88rem] text-stone transition-colors hover:text-ink pointer-coarse:inline-block pointer-coarse:py-1.5";
/** På telefon står gruppens länkar efter varandra och bryts vid kanten, i stället för en lång lista per grupp. Från sm en lista per kolumn. */
const listClass = "mt-2 flex flex-wrap gap-x-5 sm:mt-4 sm:block sm:space-y-2.5";

/** Länkarna står i samma grupper som i menyn, så att allt finns på samma ställe överallt. Det som inte har en egen grupp står under Genvägar. */
function FooterLinks({ meny }: { meny: NavGroup[] }) {
  const groups = meny.filter((g) => g.children?.length);
  const loose = meny.filter((g) => !g.children?.length);
  const iconLink = `inline-flex items-center gap-1.5 ${linkClass}`;
  return (
    <nav aria-label="Sidfot" className="grid gap-y-6 sm:grid-cols-4 sm:gap-x-6 sm:gap-y-10">
      <div>
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
        <div key={g.label}>
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
      <div className="container-site pt-10 md:pt-16">
        {/* Standardmenyn står i skalet och byts mot den sparade, som i sidhuvudet. */}
        <Suspense fallback={<FooterLinks meny={NAV} />}>
          <SavedFooterLinks />
        </Suspense>

        <div className="mt-10 md:mt-14">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/statlin.svg" alt="" width={32} height={32} loading="lazy" className="size-8" />
            <span className="font-semibold tracking-[-0.01em]" translate="no">
              StatLin
            </span>
          </div>
          {/* Pennan gäller sloganen och kontaktuppgifterna. Båda finns också under Inställningar i Admin. På datorn står de bredvid varandra. */}
          <Editable target={{ type: "footer" }} label="Redigera sidfoten" className="mt-6">
            <div className="grid gap-7 lg:grid-cols-2 lg:items-start lg:gap-12">
              <div>
                {/* Sloganen står med standardtexten direkt i skalet och byts om den har ändrats. Utan JavaScript står standardtexten kvar. */}
                <Suspense fallback={<FooterSlogan text={DEFAULT_SETTINGS.footer_slogan} />}>
                  <FooterSloganLoaded />
                </Suspense>
                {/* Ett citat skrivet för hand under sloganen. Det är dolt tills det skrivs, så det behöver ingen platshållare. */}
                <Suspense fallback={null}>
                  <FooterCitat />
                </Suspense>
              </div>
              <div>
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
            </div>
          </Editable>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-line py-6 text-[0.8rem] text-stone md:flex-row md:items-center md:justify-between">
          <p>
            © StatLin, Statistiksektionen i Linköping ·{" "}
            <Link href="/integritet" className="tryck link-underline text-ink">
              Integritet
            </Link>
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
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

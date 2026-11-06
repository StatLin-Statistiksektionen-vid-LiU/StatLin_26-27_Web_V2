import Link from "next/link";
import { Suspense } from "react";
import { DEFAULT_SETTINGS, getSettings } from "@/lib/data/content";
import { NAV } from "@/lib/navigation";
import type { SiteSettings } from "@/lib/types";
import { ArrowUpRight, Facebook, Instagram, Linkedin, Mail, Rss } from "@/components/icons";
import { Editable } from "@/components/edit-mode/editable";
import { AccentText } from "@/components/ui/accent-text";
import { FooterSponsors } from "@/components/layout/sponsors";

/** Normalfördelningens täthetsfunktion som dekor, med medelvärdet markerat. Tunna linjer i sidans egen färg. */
function BellCurve() {
  const pts: string[] = [];
  for (let i = 0; i <= 120; i++) {
    const x = (i / 120) * 8 - 4;
    const y = Math.exp(-(x * x) / 2);
    // En decimal även på x: kurvan står två gånger i varje sidas HTML och två gånger i dess RSC-data.
    pts.push(`${((i / 120) * 1000).toFixed(1)},${(220 - y * 200).toFixed(1)}`);
  }
  return (
    <svg viewBox="0 0 1000 230" className="h-20 w-full text-ink md:h-28" aria-hidden preserveAspectRatio="none">
      <defs>
        <linearGradient id="bell-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff0707" stopOpacity="0.1" />
          <stop offset="1" stopColor="#ff0707" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,220 ${pts.join(" ")} 1000,220`} fill="url(#bell-fill)" />
      <polyline points={pts.join(" ")} fill="none" stroke="#ff0707" strokeWidth="1.25" vectorEffect="non-scaling-stroke" />
      {[-3, -2, -1, 0, 1, 2, 3].map((s) => (
        <line
          key={s}
          x1={500 + s * 125}
          x2={500 + s * 125}
          y1={s === 0 ? 20 : 214}
          y2="226"
          stroke="currentColor"
          strokeOpacity={s === 0 ? 0.35 : 0.2}
          strokeDasharray={s === 0 ? "3 5" : undefined}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <line x1="0" x2="1000" y1="220" y2="220" stroke="currentColor" strokeOpacity="0.16" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

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

/** Länkarna står i samma grupper som i menyn, så att allt finns på samma ställe överallt. Det som inte har en egen grupp står under Genvägar. */
function FooterLinks() {
  const groups = NAV.filter((g) => g.children?.length);
  const loose = NAV.filter((g) => !g.children?.length);
  const iconLink = `inline-flex items-center gap-1.5 ${linkClass}`;
  return (
    <nav aria-label="Sidfot" className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4 lg:col-span-8">
      <div>
        <p className="kicker text-stone">Genvägar</p>
        <ul className="mt-4 space-y-2.5">
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
          <ul className="mt-4 space-y-2.5">
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

export function SiteFooter() {
  return (
    <footer id="sidfot" className="relative border-t border-line">
      {/* Sponsorerna först i sidfoten, så att de syns på varje sida. */}
      <Suspense fallback={null}>
        <FooterSponsors />
      </Suspense>
      <div className="container-site pt-16 md:pt-20">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/statlin.svg" alt="" width={32} height={32} loading="lazy" className="size-8" />
              <span className="font-semibold tracking-[-0.01em]" translate="no">
                StatLin
              </span>
            </div>
            {/* Pennan gäller sloganen och kontaktuppgifterna. Båda finns också under Inställningar i Admin. */}
            <Editable target={{ type: "footer" }} label="Redigera sidfoten" className="mt-6">
              {/* Sloganen står med standardtexten direkt i skalet och byts om den har ändrats. Utan JavaScript står standardtexten kvar. */}
              <Suspense fallback={<FooterSlogan text={DEFAULT_SETTINGS.footer_slogan} />}>
                <FooterSloganLoaded />
              </Suspense>
              <div className="mt-7">
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
          <FooterLinks />
        </div>

        <div className="mt-16">
          <BellCurve />
          <div className="mt-2 flex justify-between font-mono text-[0.65rem] text-stone-light">
            <span>−3σ</span>
            <span>−2σ</span>
            <span>−σ</span>
            <span className="text-red-deep">μ</span>
            <span>σ</span>
            <span>2σ</span>
            <span>3σ</span>
          </div>
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

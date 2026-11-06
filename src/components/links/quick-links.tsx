import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, ArrowUpRight, Mail } from "@/components/icons";
import { isExternalUrl } from "@/lib/links";
import type { LinkItem } from "@/lib/types";
import { safeExternalUrl } from "@/lib/utils";
import { FadeInOnce } from "@/components/ui/fade-in-once";
import { LinkIcon } from "./link-icon";
import { SiteLink } from "./site-link";

/** Genvägarna är länkarna som är markerade som genväg under Admin → Länkar – samma som överst på länksidan. */

function AnyLink({ href, className, children }: { href: string; className: string; children: ReactNode }) {
  return isExternalUrl(href) ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  ) : (
    <SiteLink href={href} className={className}>
      {children}
    </SiteLink>
  );
}

const shortcuts = (links: LinkItem[]) =>
  links.flatMap((l) => {
    const href = safeExternalUrl(l.url);
    return href ? [{ ...l, href }] : [];
  });

const chipClass = "group inline-flex h-8 items-center gap-2 rounded-lg border border-line bg-white px-2.5 text-[0.84rem] font-medium text-ink transition-colors hover:border-ink/25 hover:bg-paper-2/60 pointer-coarse:h-10";
const chipIconClass = "text-stone transition-colors group-hover:text-red";

/** Raden direkt under heron, ovanför tidslinjen: genvägarna som små knappar på en rad. */
export function QuickLinksRow({ links, fragelada = false }: { links: LinkItem[]; fragelada?: boolean }) {
  if (links.length === 0 && !fragelada) return null;
  return (
    <section aria-labelledby="genvagar-start" className="border-b border-line">
      <div className="container-site py-5">
        <div className="flex items-center justify-between gap-4">
          <h2 id="genvagar-start" className="kicker text-stone">
            Genvägar för studenter
          </h2>
          <Link href="/studenter/lankar" className="tryck group inline-flex shrink-0 items-center gap-1.5 text-[0.84rem] font-medium text-stone transition-colors hover:text-ink">
            Alla länkar
            <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>
        </div>
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {shortcuts(links).map((l, i) => (
            <FadeInOnce key={l.id} group="genvagar" delay={0.2 + i * 0.04}>
              <AnyLink href={l.href} className={chipClass}>
                <span className={chipIconClass}>
                  <LinkIcon name={l.icon} size={14} />
                </span>
                {l.label}
              </AnyLink>
            </FadeInOnce>
          ))}
          {fragelada && (
            <li>
              <Link href="/fragelada" className={chipClass}>
                <span className={chipIconClass}>
                  <Mail size={14} />
                </span>
                Frågelådan: har du en kod?
              </Link>
            </li>
          )}
        </ul>
      </div>
    </section>
  );
}

/** Ett kort i sidokolumnen på Kandidat, Master och Nya studenter. extra = sidans egna länkar under genvägarna. */
export function QuickLinksCard({ links, extra = [] }: { links: LinkItem[]; extra?: { href: string; label: string }[] }) {
  const rowClass = "group flex items-center gap-3 px-5 py-3 text-[0.94rem] font-medium transition-colors hover:bg-paper-2/60";
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white">
      {links.length > 0 && (
        <>
          <p className="kicker px-5 pb-1 pt-5 text-stone">Genvägar</p>
          <ul className="divide-y divide-line">
            {shortcuts(links).map((l) => (
              <li key={l.id}>
                <AnyLink href={l.href} className={rowClass}>
                  <LinkIcon name={l.icon} size={18} className="shrink-0 text-stone transition-colors group-hover:text-red" />
                  <span className="flex-1">{l.label}</span>
                  {isExternalUrl(l.href) ? (
                    <ArrowUpRight size={15} className="text-stone-light transition-colors group-hover:text-red" />
                  ) : (
                    <ArrowRight size={15} className="text-stone-light transition-colors group-hover:text-red" />
                  )}
                </AnyLink>
              </li>
            ))}
          </ul>
        </>
      )}
      <ul className={links.length > 0 ? "divide-y divide-line border-t border-line" : "divide-y divide-line"}>
        {/* En länk som redan är genväg ska inte stå två gånger i samma kort. */}
        {[...extra.filter((e) => !links.some((l) => l.url === e.href)), { href: "/studenter/lankar", label: "Alla länkar" }].map((l) => (
          <li key={l.href}>
            <AnyLink href={l.href} className="group flex items-center justify-between px-5 py-3.5 text-[0.94rem] font-medium transition-colors hover:bg-paper-2/60">
              {l.label}
              {isExternalUrl(l.href) ? (
                <ArrowUpRight size={16} className="text-red transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              ) : (
                <ArrowRight size={16} className="text-red transition-transform group-hover:translate-x-0.5" />
              )}
            </AnyLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

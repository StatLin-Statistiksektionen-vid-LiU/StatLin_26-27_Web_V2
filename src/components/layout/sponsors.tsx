import { cache } from "react";
import { SmartImage } from "@/components/content/smart-image";
import { listPartners } from "@/lib/data/content";
import type { Partner } from "@/lib/types";
import { cn } from "@/lib/utils";

/*
 * Sektionens sponsorer syns på varje sida, i raden överst i sidfoten, i den ordning som valts under Sponsorer i portalen.
 * Huvudsponsorerna står först där, och dessutom sist i menypanelen. Utan aktiva sponsorer visas ingenting.
 */

/** Så många huvudsponsorer får plats i menypanelen. Fler står bara i sidfoten, efter de fyra första. */
export const SIDE_MAX = 4;

/** Sponsorerna står på två ställen på varje sida, men läses bara en gång per sidvisning. */
const placedSponsors = cache(async () => {
  // listPartners ger huvudsponsorerna först, var grupp i den ordning som valts.
  const all = await listPartners({ activeOnly: true });
  const side = all.filter((p) => p.tier === "huvudpartner").slice(0, SIDE_MAX);
  return { side, rest: all.filter((p) => !side.includes(p)) };
});

/** Loggan på en vit platta i menyn, så att den syns lika bra i ljust och mörkt läge. Utan logga står namnet där. */
function SponsorTile({ partner }: { partner: Partner }) {
  const tile = cn(
    "flex h-12 w-full items-center justify-center rounded-lg bg-[#fff] px-3 text-[#141413] ring-1 ring-line transition-[box-shadow,transform] duration-300",
    partner.url && "hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-12px_rgba(20,20,19,0.35)]",
  );
  const content = partner.logo ? (
    <SmartImage image={partner.logo} contain sizes="120px" alt={partner.name} className="max-h-7 w-auto max-w-full" />
  ) : (
    <span className="min-w-0 max-w-full text-center text-[0.8rem] font-semibold leading-tight [overflow-wrap:anywhere]">{partner.name}</span>
  );
  if (!partner.url) return <span className={tile}>{content}</span>;
  return (
    <a href={partner.url} target="_blank" rel="noopener noreferrer" className={tile} title={partner.name}>
      {content}
    </a>
  );
}

/** Menypanelen: huvudsponsorerna, högst fyra. Ett udda antal får den sista över hela bredden. */
export async function MenuSponsors({ className }: { className?: string }) {
  const { side } = await placedSponsors();
  if (side.length === 0) return null;
  return (
    <div className={className}>
      <p className="kicker text-[0.6rem] text-stone">{side.length > 1 ? "Huvudsponsorer" : "Huvudsponsor"}</p>
      <ul className={cn("mt-2 grid gap-2", side.length > 1 && "grid-cols-2 [&>:last-child:nth-child(odd)]:col-span-2")}>
        {side.map((p) => (
          <li key={p.id} className="flex">
            <SponsorTile partner={p} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * En logga i sidfotens rad, på en liten vit platta som i menyn, så att den syns lika bra i ljust och mörkt läge. Ingen
 * platshållarfärg bakom, eftersom loggor ofta är genomskinliga. Utan logga står namnet där.
 */
function SponsorLogo({ partner }: { partner: Partner }) {
  const content = partner.logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={partner.logo.src}
      srcSet={partner.logo.srcSet}
      sizes="150px"
      width={partner.logo.width}
      height={partner.logo.height}
      alt={partner.name}
      loading="lazy"
      decoding="async"
      className="h-5 w-auto max-w-[7rem] object-contain sm:h-6 sm:max-w-[8.5rem]"
    />
  ) : (
    <span className="text-[0.82rem] font-semibold leading-tight">{partner.name}</span>
  );
  const klass = "flex h-11 items-center rounded-lg bg-[#fff] px-3.5 text-[#141413] ring-1 ring-line transition-[box-shadow,transform] duration-300";
  if (!partner.url) return <span className={klass}>{content}</span>;
  return (
    <a
      href={partner.url}
      target="_blank"
      rel="noopener noreferrer"
      title={partner.name}
      className={cn(klass, "hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-12px_rgba(20,20,19,0.35)]")}
    >
      {content}
    </a>
  );
}

/** Sidfoten på alla sidor: en rad med loggorna på sidans egen yta, var och en på en vit platta, huvudsponsorerna först. */
export async function FooterSponsors() {
  const { side, rest } = await placedSponsors();
  if (side.length + rest.length === 0) return null;
  return (
    <section aria-labelledby="sponsorer-sidfot" className="border-b border-line">
      <div className="container-site flex flex-wrap items-center gap-x-6 gap-y-2.5 py-4">
        <h2 id="sponsorer-sidfot" className="kicker w-full shrink-0 text-stone sm:w-auto">
          Sponsorer
        </h2>
        <ul className="flex flex-1 flex-wrap items-center gap-2">
          {[...side, ...rest].map((p) => (
            <li key={p.id}>
              <SponsorLogo partner={p} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

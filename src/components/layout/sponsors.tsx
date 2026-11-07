import { cache } from "react";
import { SmartImage } from "@/components/content/smart-image";
import { listPartners } from "@/lib/data/content";
import type { Partner } from "@/lib/types";
import { cn } from "@/lib/utils";

/*
 * Sektionens sponsorer syns på varje sida, på det ställe som admin eller SASU har valt under Sponsorer i portalen.
 * Huvudsponsorerna står vid sidan av skärmen: i sidomenyn på datorn, och i menyn och sidfoten på telefonen, där det
 * inte finns någon sidomeny. De andra står i sidfoten. Varje sponsor syns alltså på ett ställe per skärm, i den
 * ordning som valts. Utan aktiva sponsorer visas ingenting.
 */

/** Så många får plats vid sidan utan att menyn trängs undan. Fler huvudsponsorer hamnar i sidfoten tills någon flyttas. */
export const SIDE_MAX = 4;

/** Sponsorerna står på tre ställen på varje sida, men läses bara en gång per sidvisning. */
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
    <SmartImage image={partner.logo} sizes="120px" alt={partner.name} className="max-h-7 w-auto max-w-full object-contain" />
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

/** Sidomenyn på datorn och menyn på telefonen: huvudsponsorerna, högst fyra. Ett udda antal får den sista över hela bredden. */
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
 * En logga i sidfotens list, utan egen platta: listen är vit. Ingen platshållarfärg bakom, eftersom loggor ofta är
 * genomskinliga. Utan logga står namnet där.
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
      className="h-6 w-auto max-w-[7.5rem] object-contain sm:h-7 sm:max-w-[9rem]"
    />
  ) : (
    <span className="text-[0.85rem] font-semibold leading-tight">{partner.name}</span>
  );
  const klass = "flex h-11 items-center rounded-md px-1 transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#141413]";
  if (!partner.url) return <span className={klass}>{content}</span>;
  return (
    <a href={partner.url} target="_blank" rel="noopener noreferrer" title={partner.name} className={cn(klass, "hover:opacity-70")}>
      {content}
    </a>
  );
}

/**
 * Sidfoten på alla sidor: en smal vit list med loggorna, lika i ljust och mörkt läge. Under lg finns ingen sidomeny,
 * så där står huvudsponsorerna först i listen. Står alla vid sidan blir listen bara kvar på telefonen och plattan.
 */
export async function FooterSponsors() {
  const { side, rest } = await placedSponsors();
  if (side.length + rest.length === 0) return null;
  return (
    <section aria-labelledby="sponsorer-sidfot" className={cn("border-b border-line bg-[#fff] text-[#141413]", rest.length === 0 && "lg:hidden")}>
      <div className="container-site flex flex-wrap items-center gap-x-8 gap-y-1 py-2.5">
        <h2 id="sponsorer-sidfot" className="kicker w-full shrink-0 pt-1.5 text-[0.62rem] text-[#141413]/55 sm:w-auto sm:pt-0">
          Sponsorer
        </h2>
        <ul className="flex flex-1 flex-wrap items-center gap-x-8 gap-y-1">
          {side.map((p) => (
            <li key={p.id} className="lg:hidden">
              <SponsorLogo partner={p} />
            </li>
          ))}
          {rest.map((p) => (
            <li key={p.id}>
              <SponsorLogo partner={p} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

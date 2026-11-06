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

/** Loggan på en vit platta, så att den syns lika bra i ljust och mörkt läge. Utan logga står namnet där. */
function SponsorTile({ partner, small }: { partner: Partner; small?: boolean }) {
  const tile = cn(
    "flex w-full items-center justify-center rounded-lg bg-[#fff] text-[#141413] ring-1 ring-line transition-[box-shadow,transform] duration-300",
    small ? "h-12 px-3" : "h-16 px-4 sm:h-[4.5rem]",
    partner.url && "hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-12px_rgba(20,20,19,0.35)]",
  );
  const content = partner.logo ? (
    <SmartImage image={partner.logo} sizes={small ? "120px" : "180px"} alt={partner.name} className={cn("w-auto max-w-full object-contain", small ? "max-h-7" : "max-h-9 sm:max-h-10")} />
  ) : (
    <span className={cn("min-w-0 max-w-full text-center font-semibold leading-tight [overflow-wrap:anywhere]", small ? "text-[0.8rem]" : "text-sm")}>{partner.name}</span>
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
            <SponsorTile partner={p} small />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Sidfoten på alla sidor: sponsorerna som står i sidfoten. Under lg finns ingen sidomeny, så där står huvudsponsorerna
 * först i samma rutnät. Står alla vid sidan blir sidfotens del bara kvar på telefonen och plattan.
 */
export async function FooterSponsors() {
  const { side, rest } = await placedSponsors();
  if (side.length + rest.length === 0) return null;
  return (
    <section aria-labelledby="sponsorer-sidfot" className={cn("border-b border-line", rest.length === 0 && "lg:hidden")}>
      <div className="container-site flex flex-col gap-5 py-9 md:flex-row md:items-center md:gap-10">
        <h2 id="sponsorer-sidfot" className="kicker shrink-0 text-stone md:w-36">
          Sektionens sponsorer
        </h2>
        <ul className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]">
          {side.map((p) => (
            <li key={p.id} className="flex lg:hidden">
              <SponsorTile partner={p} />
            </li>
          ))}
          {rest.map((p) => (
            <li key={p.id} className="flex">
              <SponsorTile partner={p} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

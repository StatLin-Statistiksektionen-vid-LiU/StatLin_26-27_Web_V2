import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PartnerForm } from "@/components/admin/partner-form";
import { PartnerMoveButtons } from "@/components/admin/partner-order";
import { AdminHeader, EmptyState, JumpToForm, Notice, StatusBadge } from "@/components/admin/ui";
import { Edit } from "@/components/icons";
import { SIDE_MAX } from "@/components/layout/sponsors";
import { requireUser } from "@/lib/auth/session";
import { listPartners } from "@/lib/data/content";
import { canManageNaringsliv } from "@/lib/data/naringsliv";
import type { Partner } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata = { title: "Sponsorer" };

/** De två ställena på sajten, i samma ordning som listPartners ger sponsorerna. */
const GROUPS: { tier: Partner["tier"]; title: string; hint: string }[] = [
  { tier: "huvudpartner", title: "Vid sidan av skärmen", hint: "Huvudsponsorerna. På datorn i sidomenyn, på telefonen i menyn och i sidfoten. Fyra får plats." },
  { tier: "partner", title: "I sidfoten", hint: "Längst ner på varje sida, i den här ordningen." },
];

export default function AdminPartners(props: PageProps<"/admin/partners">) {
  return (
    <Suspense>
      <Partners searchParams={props.searchParams} />
    </Suspense>
  );
}

function host(url: string) {
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}

async function Partners({ searchParams }: { searchParams: PageProps<"/admin/partners">["searchParams"] }) {
  const user = await requireUser();
  if (!canManageNaringsliv(user)) redirect("/admin?nekad=1");
  const [partners, sp] = await Promise.all([listPartners(), searchParams]);
  return (
    <>
      {sp.sparad && <Notice>Sponsorn är tillagd.</Notice>}
      {sp.raderad && <Notice>Sponsorn är borttagen.</Notice>}
      <AdminHeader
        title="Sponsorer"
        description="Företagen som sponsrar sektionen. Välj om varje sponsor står vid sidan av skärmen eller i sidfoten, och ordna dem med pilarna. Alla syns också under För företag."
        actions={partners.length > 0 && <JumpToForm href="#ny-partner">Ny sponsor</JumpToForm>}
      />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        <div className="space-y-8 lg:col-span-3">
          {partners.length === 0 ? (
            <EmptyState title="Inga sponsorer ännu">Lägg till den första med formuläret.</EmptyState>
          ) : (
            GROUPS.map((g) => {
              const items = partners.filter((p) => p.tier === g.tier);
              let shown = 0;
              return (
                <section key={g.tier} aria-labelledby={`sponsorer-${g.tier}`}>
                  <h2 id={`sponsorer-${g.tier}`} className="font-bold">
                    {g.title}
                  </h2>
                  <p className="mt-0.5 text-sm text-stone">{g.hint}</p>
                  {items.length === 0 ? (
                    <p className="mt-3 rounded-2xl border border-dashed border-ink/15 px-5 py-4 text-sm text-stone">Ingen här ännu. Platsen väljs när du lägger till eller redigerar en sponsor.</p>
                  ) : (
                    <ul className="mt-3 divide-y divide-ink/10 overflow-hidden rounded-[1.5rem] border border-ink/10 bg-white">
                      {items.map((p, i) => {
                        // Bara de första aktiva får plats vid sidan. Resten syns i sidfoten, och det ska stå här.
                        const overflow = g.tier === "huvudpartner" && p.active && ++shown > SIDE_MAX;
                        return (
                          <li key={p.id} className="flex items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-5">
                            {/* Loggan på en vit platta, som på sajten, så att mörk text i loggan syns även i mörkt läge. */}
                            <span className={cn("grid h-10 w-14 shrink-0 place-items-center rounded-lg sm:w-20", p.logo && "bg-[#fff] px-1.5 ring-1 ring-line")}>
                              {p.logo ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={p.logo.thumb} alt="" className="max-h-10 max-w-full object-contain" />
                              ) : (
                                <span className="text-center text-xs text-stone">Ingen logga</span>
                              )}
                            </span>
                            <Link href={`/admin/partners/${p.id}`} className="min-w-0 flex-1">
                              <span className="block truncate font-semibold">{p.name}</span>
                              <span className="block truncate text-xs text-stone">{overflow ? "Får inte plats vid sidan, syns i sidfoten" : p.url ? host(p.url) : "Ingen webbplats"}</span>
                            </Link>
                            {!p.active && <StatusBadge published={false} label="Dold" />}
                            <PartnerMoveButtons id={p.id} name={p.name} first={i === 0} last={i === items.length - 1} />
                            <Link href={`/admin/partners/${p.id}`} className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-paper" aria-label={`Redigera ${p.name}`}>
                              <Edit size={16} />
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              );
            })
          )}
        </div>
        <div id="ny-partner" className="scroll-mt-24 lg:col-span-2">
          <PartnerForm nextOrder={(partners.length + 1) * 10} />
        </div>
      </div>
    </>
  );
}

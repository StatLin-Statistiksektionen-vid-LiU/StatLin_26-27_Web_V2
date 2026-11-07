import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { FixedBoxLink } from "@/components/fragelada/box-link";
import { Mail, MessageCircle } from "@/components/icons";
import { readDb } from "@/lib/data/db";
import { findOpenBox } from "@/lib/data/fragelada";
import { UBU } from "@/lib/innehall/block/ubu";
import { getBlock } from "@/lib/innehall/server";
import type { Committee } from "@/lib/types";
import { UbuKnappar } from "./ubu-knappar";

async function UbuBoxOpen({ children, otherwise }: { children: ReactNode; otherwise: ReactNode }) {
  return findOpenBox(await readDb(), { slug: "ubu" }) ? children : otherwise;
}

/** Anonymt går det bara att skriva när UBU:s frågelåda tar emot frågor, så texten lovar det bara då, precis som knappen Skriv anonymt. */
export function IfUbuBoxOpen({ children, otherwise }: { children: ReactNode; otherwise: ReactNode }) {
  return (
    <Suspense fallback={otherwise}>
      <UbuBoxOpen otherwise={otherwise}>{children}</UbuBoxOpen>
    </Suspense>
  );
}

/** UBU:s egna knappar läses ur databasen. Tills de har kommit står standardknapparna där. */
async function UbuKortKnappar() {
  return <UbuKnappar ubu={await getBlock("ubu")} liten />;
}

/** Utbildningsutskottets kontaktkort i sidokolumnen på Kandidat och Master. */
export function UbuCard({ ubu }: { ubu: Committee }) {
  return (
    <div className="@container overflow-hidden rounded-xl border border-line bg-white p-6">
      {/* I en smal sidokolumn hamnar namnet under loggan i stället för att tryckas ut ur kortet. */}
      <div className="flex flex-col items-start gap-3 @[16rem]:flex-row @[16rem]:items-center @[16rem]:gap-4">
        {ubu.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ubu.logo_url} alt="" className="size-16 shrink-0 rounded-xl object-contain p-1 [[data-tema=mork]_&]:bg-ink" />
        )}
        <div className="min-w-0 break-words">
          <p className="kicker text-stone">Studiebevakning</p>
          <p className="display-tight mt-1 text-2xl normal-case">{ubu.short_name}</p>
        </div>
      </div>
      <p className="mt-5 text-[0.95rem] leading-relaxed text-stone">
        {ubu.tagline} Hör av dig om kurser, examination eller studiemiljö<IfUbuBoxOpen otherwise=".">, anonymt om du vill.</IfUbuBoxOpen>
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        {ubu.email && (
          <a href={`mailto:${ubu.email}`} className="btn btn-red btn-sm">
            <Mail size={15} /> Mejla {ubu.short_name}
          </a>
        )}
        <FixedBoxLink slug="ubu" className="btn btn-light btn-sm">
          <MessageCircle size={15} /> Skriv anonymt
        </FixedBoxLink>
        <Suspense fallback={<UbuKnappar ubu={UBU.standard()} liten />}>
          <UbuKortKnappar />
        </Suspense>
        <Link href={`/utskott/${ubu.slug}`} className="btn btn-ghost-dark btn-sm">
          Om {ubu.short_name}
        </Link>
      </div>
    </div>
  );
}

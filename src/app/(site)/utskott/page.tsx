import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowUpRight } from "@/components/icons";
import { TextHero } from "@/components/ui/text-hero";
import { Reveal } from "@/components/ui/reveal";
import { PageSkeleton } from "@/components/ui/skeletons";
import { listCommittees } from "@/lib/data/content";

export const metadata: Metadata = {
  title: "Utskott",
  description: "Utskotten och grupperna på StatLin. Hitta ditt sammanhang, från studiebevakning till pub och idrott.",
};

export default function CommitteesPage() {
  return (
    <>
      <TextHero group="utskott" />
      <Suspense fallback={<PageSkeleton />}>
        <Committees />
      </Suspense>
    </>
  );
}

async function Committees() {
  const committees = (await listCommittees({ visibleOnly: true })).filter((c) => c.kind !== "styrelse");
  return (
    <section className="container-site py-16 md:py-24">
      <div className="grid gap-5 md:grid-cols-2">
        {committees.map((c, i) => (
          <Reveal key={c.id} delay={(i % 2) * 90}>
            <Link
              href={`/utskott/${c.slug}`}
              className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white p-7 transition-colors duration-300 hover:border-ink/20 sm:flex-row sm:items-center sm:gap-8 md:flex-col md:items-start md:gap-0 md:p-8 lg:flex-row lg:items-center lg:gap-8"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute -left-20 -top-20 size-80 rounded-full bg-[var(--glod)] opacity-15 blur-3xl transition-opacity duration-700 group-hover:opacity-30 pointer-coarse:-left-32 pointer-coarse:-top-32 pointer-coarse:size-[28rem] pointer-coarse:bg-transparent pointer-coarse:bg-[radial-gradient(closest-side,var(--glod),transparent)] pointer-coarse:filter-none"
                style={{ "--glod": c.accent } as React.CSSProperties}
              />
              <div className="grid-paper pointer-events-none absolute inset-0 text-ink opacity-50" aria-hidden />
              {c.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.logo_url}
                  alt={`${c.short_name}-loggan`}
                  className="relative size-28 shrink-0 rounded-2xl object-contain p-2 [[data-tema=mork]_&]:bg-ink transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:-translate-y-1 group-hover:rotate-[-8deg] group-hover:scale-110 md:size-40"
                  loading={i < 2 ? "eager" : "lazy"}
                  fetchPriority={i === 0 ? "high" : undefined}
                />
              )}
              <div className="relative mt-6 min-w-0 sm:mt-0 md:mt-6 lg:mt-0">
                <p className="kicker text-stone">{c.kind === "ovrigt" ? "Förtroendepost" : "Utskott"}</p>
                <h2 className="display-tight mt-2 text-3xl normal-case">{c.short_name}</h2>
                <p className="mt-1 text-sm text-stone">{c.name}</p>
                <p className="mt-4 text-[0.95rem] leading-relaxed text-stone">{c.tagline}</p>
              </div>
              <span className="absolute right-5 top-5 grid size-9 place-items-center rounded-lg border border-line text-stone transition-colors duration-300 group-hover:border-ink group-hover:bg-ink group-hover:text-paper">
                <ArrowUpRight size={18} />
              </span>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

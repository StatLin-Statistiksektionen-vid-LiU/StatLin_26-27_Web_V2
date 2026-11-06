import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NewsCard } from "@/components/content/news-card";
import { TextHero } from "@/components/ui/text-hero";
import { Reveal } from "@/components/ui/reveal";
import { PageSkeleton } from "@/components/ui/skeletons";
import { countNews, listNews } from "@/lib/data/news";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Nytt",
  description: "Nytt från styrelsen och utskotten på StatLin.",
};

const PER_PAGE = 9;

export default function NewsPage(props: PageProps<"/nyheter">) {
  return (
    <>
      <TextHero group="nyheter" accentClassName="mono-accent text-red max-md:block" />
      <Suspense fallback={<PageSkeleton />}>
        <NewsList searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function NewsList({ searchParams }: { searchParams: PageProps<"/nyheter">["searchParams"] }) {
  const sp = await searchParams;
  // Bara heltal: SQLite vägrar OFFSET med decimaler (t.ex. ?sida=1.5 eller ?sida=Infinity).
  const requested = Number(sp.sida);
  const page = Number.isSafeInteger(requested) && requested > 1 ? requested : 1;
  const [items, total] = await Promise.all([listNews(PER_PAGE, (page - 1) * PER_PAGE), countNews()]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  if (items.length === 0) {
    // En sida bortom den sista, till exempel en gammal länk från när det fanns fler inlägg, ska inte påstå att det inte finns något nytt.
    return total > 0 ? (
      <p className="container-site py-24 text-center text-stone">
        Den sidan finns inte, nyheterna ryms på {pages === 1 ? "en sida" : `${pages} sidor`}.{" "}
        <Link href="/nyheter" className="link-underline font-medium text-ink">
          Till senaste nytt
        </Link>
      </p>
    ) : (
      <p className="container-site py-24 text-center text-stone">Inget nytt ännu.</p>
    );
  }
  const [first, ...rest] = items;
  return (
    <section className="container-site py-14 md:py-20">
      <h2 className="sr-only">Alla inlägg</h2>
      {page === 1 ? (
        <Reveal>
          <NewsCard item={first} featured />
        </Reveal>
      ) : null}
      <div className={cn("grid gap-x-6 gap-y-12 md:grid-cols-2 lg:grid-cols-3", page === 1 && "mt-14 border-t border-line pt-12")}>
        {(page === 1 ? rest : items).map((n, i) => (
          <Reveal key={n.id} delay={(i % 3) * 80}>
            <NewsCard item={n} />
          </Reveal>
        ))}
      </div>
      {pages > 1 && (
        <nav aria-label="Sidor" className="mt-16 flex justify-center gap-2">
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={p === 1 ? "/nyheter" : `/nyheter?sida=${p}`}
              aria-current={p === page ? "page" : undefined}
              className={cn("grid size-9 place-items-center rounded-lg border font-mono text-[0.82rem] tabular", p === page ? "border-ink bg-ink text-paper" : "border-line bg-white text-stone hover:border-ink/25 hover:text-ink")}
            >
              {p}
            </Link>
          ))}
        </nav>
      )}
    </section>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Markdown } from "@/components/content/markdown";
import { NewsCard, newsDate } from "@/components/content/news-card";
import { SmartImage } from "@/components/content/smart-image";
import { ArrowLeft } from "@/components/icons";
import { HeroSkeleton } from "@/components/ui/skeletons";
import { getNewsBySlug, listNews } from "@/lib/data/news";
import { committeeHref } from "@/lib/navigation";
import { SITE_OG } from "@/lib/site-metadata";
import { fitHeading, stripMarkdown } from "@/lib/utils";
import { EditModeButton, Editable } from "@/components/edit-mode/editable";

export async function generateMetadata({ params }: PageProps<"/nyheter/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const item = await getNewsBySlug(slug);
  if (!item) return { title: "Nyheten hittades inte" };
  return {
    title: item.title,
    description: item.excerpt || stripMarkdown(item.body_md),
    openGraph: { ...SITE_OG, type: "article", publishedTime: item.published_at, images: item.cover ? [{ url: item.cover.src }] : SITE_OG.images },
  };
}

export default function NewsArticlePage(props: PageProps<"/nyheter/[slug]">) {
  return (
    <Suspense fallback={<HeroSkeleton />}>
      <Article params={props.params} />
    </Suspense>
  );
}

async function Article({ params }: { params: PageProps<"/nyheter/[slug]">["params"] }) {
  const { slug } = await params;
  const item = await getNewsBySlug(slug);
  if (!item) notFound();
  const more = (await listNews(4)).filter((n) => n.id !== item.id).slice(0, 3);
  const committeeLink = item.committee && committeeHref(item.committee);

  return (
    <article>
      <Editable target={{ type: "news", id: item.id, committeeId: item.committee_id }} label="Redigera nyheten" inset penClassName="top-[calc(var(--header-h)+1rem)] right-4">
      <header className="relative overflow-hidden border-b border-line">
        <div className="grid-paper pointer-events-none absolute inset-0 text-ink [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" aria-hidden />
        <div className="container-prose relative pb-12 pt-[calc(var(--header-h)+2.5rem)] md:pb-14 md:pt-[calc(var(--header-h)+4rem)]">
          <Link href="/nyheter" className="tryck kicker inline-flex items-center gap-2 text-stone transition-colors hover:text-ink">
            <ArrowLeft size={14} /> Allt nytt
          </Link>
          <p className="kicker mt-8 flex flex-wrap items-center gap-3 text-stone [animation:fade-up_0.8s_var(--ease-out-expo)_backwards]">
            <span className="size-1.5 rounded-full bg-red" aria-hidden />
            <time dateTime={item.published_at}>{newsDate(item)}</time>
            {item.committee && (
              <>
                <span className="h-px w-5 bg-ink/20" aria-hidden />
                {committeeLink ? (
                  <Link href={committeeLink} className="transition-colors hover:text-ink">
                    {item.committee.short_name}
                  </Link>
                ) : (
                  <span>{item.committee.short_name}</span>
                )}
              </>
            )}
          </p>
          <div className="@container mt-5 [animation:fade-up_0.9s_0.06s_var(--ease-out-expo)_backwards]">
            <h1 className="font-extrabold leading-[1.02] tracking-tight [font-stretch:112%] [overflow-wrap:break-word]" style={fitHeading(item.title, { maxRem: 4, maxVw: 5.2, charWidth: 0.68 })}>
              {item.title}
            </h1>
          </div>
          {item.excerpt && (
            <p className="mt-6 text-[1.1rem] leading-relaxed text-stone [animation:fade-up_0.9s_0.12s_var(--ease-out-expo)_backwards] md:text-xl">{item.excerpt}</p>
          )}
          {item.author_name && (
            <p className="mt-8 text-sm text-stone">
              Av <span className="font-medium text-ink">{item.author_name}</span>
              {item.author_post && <>, {item.author_post}</>}
            </p>
          )}
        </div>
        <EditModeButton target={{ type: "news-cover", id: item.id, committeeId: item.committee_id }} className="absolute bottom-5 right-5 z-30">
          Byt omslag
        </EditModeButton>
      </header>
      </Editable>
      {item.cover && (
        <div className="container-site pt-10 [animation:fade-up_1s_0.18s_var(--ease-out-expo)_backwards]">
          <SmartImage image={item.cover} priority sizes="(min-width: 1280px) 1100px, 100vw" className="aspect-[21/9] w-full rounded-2xl border border-line" alt="" />
        </div>
      )}
      <div className="container-prose py-14 md:py-20">
        <Markdown source={item.body_md} />
      </div>
      {more.length > 0 && (
        <section className="border-t border-line bg-paper-2/40 py-16 md:py-20">
          <div className="container-site">
            <h2 className="kicker text-stone">Mer nytt</h2>
            <div className="mt-8 grid gap-10 md:grid-cols-3">
              {more.map((n) => (
                <NewsCard key={n.id} item={n} />
              ))}
            </div>
          </div>
        </section>
      )}
    </article>
  );
}

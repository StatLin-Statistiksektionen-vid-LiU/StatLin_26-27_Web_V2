import Link from "next/link";
import { CoverArt } from "./cover-art";
import { SmartImage } from "./smart-image";
import { formatDate, isoToLocal } from "@/lib/dates";
import type { NewsItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export function newsDate(n: Pick<NewsItem, "published_at">) {
  return formatDate(isoToLocal(n.published_at), true);
}

export function NewsCard({ item, featured, className }: { item: NewsItem; featured?: boolean; className?: string }) {
  return (
    <Link
      href={`/nyheter/${item.slug}`}
      className={cn("group flex flex-col", featured && "md:flex-row md:items-stretch md:gap-10", className)}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border border-line",
          featured ? "aspect-[16/10] md:aspect-auto md:w-[58%]" : "aspect-[16/10]",
        )}
      >
        {item.cover ? (
          <SmartImage
            image={item.cover}
            sizes={featured ? "(min-width: 768px) 58vw, 100vw" : "(min-width: 768px) 33vw, 100vw"}
            className="h-full w-full transition-transform duration-[1.2s] ease-[var(--ease-out-expo)] group-hover:scale-[1.04]"
            alt=""
          />
        ) : (
          <CoverArt
            seed={item.slug}
            accent={item.committee?.accent}
            logo={item.committee?.logo_url}
            className="h-full w-full transition-transform duration-[1.2s] ease-[var(--ease-out-expo)] group-hover:scale-[1.04]"
          />
        )}
        {item.pinned && <span className="chip absolute left-3 top-3 bg-red text-white">Fäst</span>}
      </div>
      <div className={cn("flex flex-col pt-5", featured && "md:flex-1 md:justify-center md:pt-0")}>
        <p className="kicker flex flex-wrap items-center gap-x-3 gap-y-1 text-stone">
          <time dateTime={item.published_at}>{newsDate(item)}</time>
          {item.committee && (
            <>
              <span className="h-px w-4 bg-ink/25" aria-hidden />
              <span>{item.committee.short_name}</span>
            </>
          )}
        </p>
        <h3
          className={cn(
            "mt-3 font-bold leading-[1.15] tracking-tight transition-colors group-hover:text-red-deep [font-stretch:108%]",
            featured ? "text-[clamp(1.6rem,2.8vw,2.4rem)]" : "text-[1.25rem]",
          )}
        >
          {item.title}
        </h3>
        {item.excerpt && (
          <p className={cn("mt-3 leading-relaxed text-stone", featured ? "text-lg" : "line-clamp-3 text-[0.97rem]")}>{item.excerpt}</p>
        )}
        <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold">
          <span className="link-underline">Läs mer</span>
          <span className="text-red transition-transform duration-500 group-hover:translate-x-1">→</span>
        </span>
      </div>
    </Link>
  );
}

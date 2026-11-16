import Link from "next/link";
import { CoverArt } from "./cover-art";
import { SmartImage } from "./smart-image";
import { formatDate, isoToLocal } from "@/lib/dates";
import type { NewsItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export function newsDate(n: Pick<NewsItem, "published_at">) {
  return formatDate(isoToLocal(n.published_at), true);
}

/** Datumet och utskottet på en rad, över rubriken. */
function Meta({ item }: { item: NewsItem }) {
  return (
    <p className="kicker flex flex-wrap items-center gap-x-3 gap-y-1 text-stone">
      <time dateTime={item.published_at}>{newsDate(item)}</time>
      {item.committee && (
        <>
          <span className="h-px w-4 bg-ink/25" aria-hidden />
          <span>{item.committee.short_name}</span>
        </>
      )}
    </p>
  );
}

/**
 * featured är den breda varianten överst på /nyheter, med bilden bredvid texten. stor är startsidans senaste nyhet: bilden överst
 * som i ett vanligt kort, men med större rubrik.
 */
export function NewsCard({ item, featured, stor, className }: { item: NewsItem; featured?: boolean; stor?: boolean; className?: string }) {
  return (
    <Link
      href={`/nyheter/${item.slug}`}
      className={cn("group flex flex-col", featured && "md:flex-row md:items-stretch md:gap-10", className)}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border border-line",
          // Ett foto fyller kortets höjd bredvid texten. Plattan utan bild behåller en lägre form, även på startsidan.
          featured ? cn("aspect-[16/10] md:w-[58%]", item.cover ? "md:aspect-auto" : "md:aspect-[2/1]") : stor ? (item.cover ? "aspect-[16/9]" : "aspect-[5/2]") : "aspect-[16/10]",
        )}
      >
        {item.cover ? (
          <SmartImage
            image={item.cover}
            sizes={featured || stor ? "(min-width: 1024px) 58vw, 100vw" : "(min-width: 768px) 33vw, 100vw"}
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
        <Meta item={item} />
        <h3
          className={cn(
            "mt-3 font-bold leading-[1.15] tracking-tight transition-colors group-hover:text-red-deep [font-stretch:108%]",
            featured ? "text-[clamp(1.6rem,2.8vw,2.4rem)]" : stor ? "text-[clamp(1.4rem,2.2vw,1.85rem)]" : "text-[1.25rem]",
          )}
        >
          {item.title}
        </h3>
        {item.excerpt && (
          <p className={cn("mt-3 leading-relaxed text-stone", featured ? "text-lg" : stor ? "line-clamp-3 text-[1.02rem]" : "line-clamp-3 text-[0.97rem]")}>{item.excerpt}</p>
        )}
        <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold">
          <span className="link-underline">Läs mer</span>
          <span className="text-red transition-transform duration-500 group-hover:translate-x-1">→</span>
        </span>
      </div>
    </Link>
  );
}

/** En nyhet som en rad utan bild: datum, rubrik och ingress. Står bredvid den senaste nyheten på startsidan. */
export function NewsRow({ item }: { item: NewsItem }) {
  return (
    <Link href={`/nyheter/${item.slug}`} className="group block">
      <Meta item={item} />
      <h3 className="mt-2 text-[1.12rem] font-bold leading-snug tracking-tight transition-colors group-hover:text-red-deep [font-stretch:105%] [overflow-wrap:anywhere]">{item.title}</h3>
      {item.excerpt && <p className="mt-1.5 line-clamp-2 text-[0.92rem] leading-relaxed text-stone">{item.excerpt}</p>}
    </Link>
  );
}

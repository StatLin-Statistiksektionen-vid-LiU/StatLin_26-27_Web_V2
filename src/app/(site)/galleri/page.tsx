import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SmartImage } from "@/components/content/smart-image";
import { TextHero } from "@/components/ui/text-hero";
import { Reveal } from "@/components/ui/reveal";
import { PageSkeleton } from "@/components/ui/skeletons";
import { listGalleryAlbums } from "@/lib/data/events";
import { formatDate } from "@/lib/dates";

export const metadata: Metadata = {
  title: "Galleri",
  description: "Bilder från StatLins sittningar, pubar, idrott och andra evenemang.",
};

export default function GalleryPage() {
  return (
    <>
      <TextHero group="galleri" />
      <Suspense fallback={<PageSkeleton />}>
        <Albums />
      </Suspense>
    </>
  );
}

async function Albums() {
  const albums = await listGalleryAlbums();
  if (albums.length === 0) {
    return (
      <section className="container-site py-24 text-center">
        <p className="display-tight text-2xl">Inga album ännu</p>
        <p className="mt-2 text-stone">När posterna laddar upp bilder från evenemang dyker de upp här.</p>
      </section>
    );
  }
  return (
    <section className="container-site py-16 md:py-24">
      <div className="grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
        {albums.map(({ event, preview }, i) => (
          <Reveal key={event.id} delay={(i % 3) * 80}>
            <Link href={`/evenemang/${event.slug}#galleri`} className="group block">
              <div className="relative aspect-[4/3]">
                {/* Staplade foton som fläktas ut vid hover */}
                {preview
                  .slice(0, 3)
                  .reverse()
                  .map((img, j, arr) => {
                    const depth = arr.length - 1 - j;
                    return (
                      <div
                        key={img.id}
                        className="absolute inset-0 overflow-hidden rounded-xl ring-1 ring-line transition-transform duration-700 ease-[var(--ease-out-expo)]"
                        style={{ transform: `rotate(${depth * (depth % 2 ? -3 : 3)}deg) translateY(${depth * -6}px)` }}
                      >
                        <SmartImage image={img} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="h-full w-full transition-transform duration-700 group-hover:scale-105" alt="" />
                      </div>
                    );
                  })}
                <span className="chip absolute bottom-4 left-4 z-10 bg-white/95 text-ink opak:bg-white">{event.image_count} {event.image_count === 1 ? "bild" : "bilder"}</span>
              </div>
              <p className="kicker mt-6 text-stone">
                {formatDate(event.starts_at, true)} · {event.committee?.short_name ?? "StatLin"}
              </p>
              <h2 className="mt-2 text-xl font-bold tracking-tight transition-colors group-hover:text-red-deep">{event.title}</h2>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

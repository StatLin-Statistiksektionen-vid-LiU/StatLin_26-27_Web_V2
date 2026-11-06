"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Close, Download } from "@/components/icons";
import type { ImageRef } from "@/lib/types";
import { useFocusLayer } from "@/lib/use-focus-layer";
import { cn } from "@/lib/utils";

export type GalleryItem = { id: number; caption: string; image: ImageRef };

/** Masonry-galleri med helskärmsvisning (tangentbord, svep, förinläsning av grannbilder). */
export function Gallery({ items, title }: { items: GalleryItem[]; title: string }) {
  const [index, setIndex] = useState<number | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setIndex(null), []);
  const step = useCallback(
    (d: number) => setIndex((i) => (i === null ? i : (i + d + items.length) % items.length)),
    [items.length],
  );

  useFocusLayer({ active: index !== null, layers: () => [dialogRef.current], initial: () => closeRef.current });

  // På telefonen är Tillbaka det naturliga sättet att lämna en bild i helskärm. Visaren får en egen historiepost, som tas bort igen när den stängs på annat sätt.
  const open = index !== null;
  useEffect(() => {
    if (!open) return;
    window.history.pushState(null, "");
    let closedByBack = false;
    const onBack = () => {
      closedByBack = true;
      setIndex(null);
    };
    window.addEventListener("popstate", onBack);
    return () => {
      window.removeEventListener("popstate", onBack);
      if (!closedByBack) window.history.back();
    };
  }, [open]);

  useEffect(() => {
    if (index === null) return;
    document.documentElement.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [index, close, step]);

  // Förinläs grannbilder för snabb bläddring, med samma srcset och sizes som visaren så att webbläsaren väljer samma storlek.
  useEffect(() => {
    if (index === null) return;
    for (const d of [1, -1]) {
      const it = items[(index + d + items.length) % items.length];
      const img = new window.Image();
      img.sizes = "100vw";
      img.srcset = it.image.srcSet;
      img.src = it.image.src;
    }
  }, [index, items]);

  const current = index !== null ? items[index] : null;

  return (
    <>
      <ul className="columns-2 gap-3 md:columns-3 md:gap-4 [&>li]:mb-3 md:[&>li]:mb-4">
        {items.map((it, i) => (
          <li key={it.id} className="break-inside-avoid">
            <button
              type="button"
              onClick={() => setIndex(i)}
              className="group relative block w-full overflow-hidden rounded-2xl"
              aria-label={`Visa bild ${i + 1} av ${items.length}${it.caption ? `: ${it.caption}` : ""}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={it.image.thumb}
                srcSet={it.image.srcSet}
                sizes="(min-width: 768px) 33vw, 50vw"
                width={it.image.width}
                height={it.image.height}
                alt={it.caption || it.image.alt || ""}
                loading="lazy"
                decoding="async"
                className="h-auto w-full transition-transform duration-[1.2s] ease-[var(--ease-out-expo)] group-hover:scale-[1.04]"
                style={{ backgroundColor: it.image.color }}
              />
              <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            </button>
          </li>
        ))}
      </ul>

      {current && index !== null && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={`${title}, bild ${index + 1} av ${items.length}`}
          className="fixed inset-0 z-[100] flex flex-col bg-paper text-ink [animation:logo-fade_0.25s_ease-out]"
          onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
          onTouchEnd={(e) => {
            if (!touch.current) return;
            const dx = e.changedTouches[0].clientX - touch.current.x;
            const dy = e.changedTouches[0].clientY - touch.current.y;
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
            else if (dy > 90) close();
            touch.current = null;
          }}
        >
          <div className="flex items-center justify-between px-4 py-3 md:px-6">
            <span className="kicker text-stone tabular">
              {String(index + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}
            </span>
            <div className="flex items-center gap-2">
              <a
                href={current.image.srcSet.split(", ").pop()?.split(" ")[0] ?? current.image.src}
                download
                className="grid size-10 place-items-center rounded-lg border border-line bg-white hover:border-ink/25"
                aria-label="Ladda ner bild"
              >
                <Download size={18} />
              </a>
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                className="grid size-10 place-items-center rounded-lg border border-line bg-white hover:border-ink/25"
                aria-label="Stäng"
              >
                <Close size={20} />
              </button>
            </div>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 md:px-20" onClick={(e) => e.target === e.currentTarget && close()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={current.id}
              src={current.image.src}
              srcSet={current.image.srcSet}
              sizes="100vw"
              alt={current.caption || current.image.alt || ""}
              className="max-h-full max-w-full rounded-lg object-contain [animation:fade-up_0.5s_var(--ease-out-expo)]"
            />
            {items.length > 1 && (
              <>
                <NavButton side="left" onClick={() => step(-1)} />
                <NavButton side="right" onClick={() => step(1)} />
              </>
            )}
          </div>
          <p className={cn("min-h-14 px-6 py-4 text-center text-sm text-stone", !current.caption && "opacity-0")}>
            {current.caption}
          </p>
        </div>
      )}
    </>
  );
}

function NavButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Föregående bild" : "Nästa bild"}
      className={cn(
        "absolute top-1/2 hidden size-11 -translate-y-1/2 place-items-center rounded-lg border border-line bg-white transition-colors hover:border-ink/25 md:grid",
        side === "left" ? "left-4" : "right-4",
      )}
    >
      {side === "left" ? <ChevronLeft /> : <ChevronRight />}
    </button>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Close } from "@/components/icons";
import { hashString } from "@/lib/utils";

export function AnnouncementPill({ text, href }: { text: string; href: string | null }) {
  const key = `statlin-announcement-${hashString(text)}`;
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [overHeron, setOverHeron] = useState(true);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(key) === "1";
    } catch {
      /* lagring blockerad */
    }
    const t = setTimeout(() => setVisible(!dismissed), 1200);
    return () => clearTimeout(t);
  }, [key]);

  // På startsidan fyller heron, med texten om sektionen och siffrorna, första skärmen och mer på telefon. Meddelandet väntar därför tills
  // heron inte längre når ner i skärmens nedersta del, där meddelandet ligger. Hela heron bevakas, inte en linje i den, så att också
  // ett hopp förbi den på en gång räknas: den går då från att nå ner dit till att inte göra det.
  useEffect(() => {
    if (pathname !== "/") return;
    const hero = document.querySelector("[data-hero-yta]");
    if (!hero) return;
    const io = new IntersectionObserver(([entry]) => setOverHeron(entry.isIntersecting), { rootMargin: "-88% 0px 0px 0px" });
    io.observe(hero);
    return () => {
      io.disconnect();
      setOverHeron(true);
    };
  }, [pathname]);

  // Inbjudan går till företag utanför sektionen, och meddelandena är till medlemmarna.
  if (!visible || (pathname === "/" && overHeron) || pathname.startsWith("/star/inbjudan")) return null;
  const close = () => {
    setVisible(false);
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* lagring blockerad */
    }
  };
  const body = (
    <>
      <span className="relative flex size-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red opacity-70" />
        <span className="relative inline-flex size-2 rounded-full bg-red" />
      </span>
      <span className="text-sm font-semibold">{text}</span>
      {href && <ArrowRight size={16} className="shrink-0 text-red" />}
    </>
  );
  return (
    <div role="status" className="fixed inset-x-4 bottom-4 z-40 flex justify-center [animation:fade-up_0.7s_var(--ease-out-expo)_both] max-sm:[body:has(#admin-bar)_&]:bottom-20 sm:inset-x-auto sm:left-6 lg:left-[calc(var(--sidebar-w)+1.5rem)]">
      <div className="flex max-w-xl items-center gap-2 rounded-full border border-white/10 bg-ink/95 py-2 pl-5 pr-2 text-white shadow-2xl shadow-black/30 backdrop-blur pointer-coarse:backdrop-filter-none opak:bg-ink">
        {href ? (
          <Link href={href} className="flex items-center gap-3 hover:underline" onClick={close}>
            {body}
          </Link>
        ) : (
          <span className="flex items-center gap-3">{body}</span>
        )}
        <button type="button" onClick={close} className="ml-1 grid size-8 shrink-0 place-items-center rounded-full hover:bg-white/10" aria-label="Stäng meddelandet">
          <Close size={16} />
        </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect } from "react";

/**
 * Rörelsen på STAR-sidan, utan att något hänger på den. Sidan är hel utan JavaScript: det här lägger bara till, och döljer aldrig något
 * som redan syns. Det som ligger utanför bilden när sidan öppnas tonas in när det kommer fram, en gång. Raden med genvägar visar var på
 * sidan man är.
 */
export function StarRorelse() {
  useEffect(() => {
    const rot = document.querySelector<HTMLElement>("[data-star-rot]");
    if (!rot) return;
    const stada: (() => void)[] = [];

    const lugn = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Går också för den som har valt bort rörelse i sin enhet: kartan och den röda linjen ska komma fram för alla. Texten står då still,
    // det sköter star.css.
    {
      // Allt som tonas in kostar målning mitt i scrollningen. Telefonen får bara rubrikerna, kartan och linjen, de stora skärmarna även listorna.
      const urval = window.matchMedia("(min-width: 48rem)").matches ? "[data-star-in]" : "[data-star-in]:not([data-star-in='stor'])";
      const delar = [...rot.querySelectorAll<HTMLElement>(urval)];
      const sedda = new WeakSet<Element>();
      const ut = new IntersectionObserver(
        (poster) => {
          for (const post of poster) {
            const el = post.target as HTMLElement;
            const forsta = !sedda.has(el);
            sedda.add(el);
            const rect = post.boundingClientRect;
            // Det som redan syns när sidan öppnas står kvar som det är. Bara det som ligger utanför bilden får vänta.
            if (forsta && (post.isIntersecting || (rect.height > 0 && rect.top < window.innerHeight && rect.bottom > 0))) {
              ut.unobserve(el);
            } else if (post.isIntersecting) {
              ut.unobserve(el);
              delete el.dataset.starVantar;
              el.dataset.starTand = "";
            } else if (forsta) {
              el.dataset.starVantar = "";
            }
          }
        },
        { rootMargin: "0px 0px -8% 0px" },
      );
      for (const el of delar) ut.observe(el);
      stada.push(() => {
        ut.disconnect();
        // Inget får stå dolt om sidan lämnas mitt i: Next kan behålla den dold och visa den igen.
        for (const el of delar) delete el.dataset.starVantar;
      });
    }

    const rad = rot.querySelector<HTMLElement>(".star-nav ul");
    if (rad) {
      const lankar = [...rad.querySelectorAll<HTMLAnchorElement>("a[href^='#']")];
      const avsnitt = lankar.map((a) => document.getElementById(a.hash.slice(1))).filter((s): s is HTMLElement => !!s);
      let aktiv: HTMLAnchorElement | undefined;
      const markera = (a: HTMLAnchorElement | undefined) => {
        if (a === aktiv) return;
        aktiv?.removeAttribute("aria-current");
        aktiv = a;
        if (!a) return;
        a.setAttribute("aria-current", "true");
        // Raden scrollar i sidled på telefon. Bara raden: scrollIntoView skulle kunna flytta hela sidan.
        const vanster = a.getBoundingClientRect().left - rad.getBoundingClientRect().left + rad.scrollLeft;
        rad.scrollTo({ left: vanster - (rad.clientWidth - a.offsetWidth) / 2, behavior: lugn ? "auto" : "smooth" });
      };
      const synliga = new Set<Element>();
      const las = new IntersectionObserver(
        (poster) => {
          for (const post of poster) {
            if (post.isIntersecting) synliga.add(post.target);
            else synliga.delete(post.target);
          }
          const sist = avsnitt.filter((s) => synliga.has(s)).at(-1);
          markera(sist ? lankar.find((a) => a.hash === `#${sist.id}`) : undefined);
        },
        // Avsnittet som passerar en smal remsa en bit ner på skärmen är det man läser.
        { rootMargin: "-30% 0px -65% 0px" },
      );
      for (const s of avsnitt) las.observe(s);
      stada.push(() => {
        las.disconnect();
        aktiv?.removeAttribute("aria-current");
      });
    }

    return () => {
      for (const f of stada) f();
    };
  }, []);

  return null;
}

"use client";

import { useEffect } from "react";

/**
 * När hela sidan strömmas in letar webbläsaren och Next efter #ankaret innan det finns, och Next 16 scrollar då inte alls. Den här ligger
 * i samma del av sidan som ankaret och scrollar dit när delen är på plats.
 *
 * Kom besökaren hit med ett klick på en länk med ankaret (scroll-restore.ts sparar det i window.__statlinAnkare), scrollar den dit var
 * sidan än står: efter ett klick från en nedskrollad sida stod sidan kvar på förra sidans höjd, och menylänken Vad studenterna kan
 * gjorde ingenting. Utan ett sådant klick (adressfältet, en länk utifrån) scrollar den bara om sidan står högst upp, så att den som har
 * gått bakåt eller laddat om blir kvar där den var. Medan scroll-restore.ts lägger tillbaka platsen säger det till med window.__statlinPlats.
 * history.scrollRestoration går inte att använda till det, eftersom nya poster i historiken ärver "manual": då gjorde länken ingenting.
 *
 * Effekten körs också när Next visar en sida som legat dold sedan förra besöket. Då kan Nexts egen scroll till ankaret ha skett medan sidan
 * fortfarande var dold, och besökaren blev kvar högst upp: menylänken Vad studenterna kan på telefonen, andra gången på /foretag.
 */
type Ankare = { id: string; path: string; at: number } | null;
type Win = Window & { __statlinPlats?: boolean; __statlinAnkare?: Ankare };

const restoring = () => (window as Win).__statlinPlats === true;

/** Besökaren klickade nyss på en länk hit med just det här ankaret. */
const asked = (id: string) => {
  const a = (window as Win).__statlinAnkare;
  return !!a && a.id === id && a.path === window.location.pathname + window.location.search && Date.now() - a.at < 15_000;
};

/** Ankaret som syns. Next behåller tidigare sidor dolda i dokumentet, och där kan samma id finnas en gång till. */
const visible = (id: string) => [...document.querySelectorAll(`[id="${CSS.escape(id)}"]`)].find((el) => el.getClientRects().length > 0);

export function ScrollToAnchor({ id }: { id: string }) {
  useEffect(() => {
    const wanted = () => window.location.hash === `#${id}` && !restoring() && (asked(id) || window.scrollY < 40);
    if (!wanted()) return;
    // En bildruta senare, så att Next och menyn har gjort sitt, eller efter en kort stund om webbläsaren inte ritar några bildrutor just då
    // (appens egen webbläsare när panelen är dold). Står sidan redan rätt eller har platsen lagts tillbaka, händer ingenting.
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      if (!wanted()) return;
      (window as Win).__statlinAnkare = null;
      visible(id)?.scrollIntoView();
    };
    const frame = requestAnimationFrame(go);
    const timer = window.setTimeout(go, 150);
    return () => {
      done = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [id]);

  return null;
}

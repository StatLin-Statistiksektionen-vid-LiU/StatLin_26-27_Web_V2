"use client";

import { useEffect } from "react";

/**
 * När hela sidan strömmas in letar webbläsaren och Next efter #ankaret innan det finns, och besökaren blir kvar högst upp. Den här ligger
 * i samma del av sidan som ankaret och scrollar dit när delen är på plats. Står sidan redan någon annanstans, efter bakåt eller en
 * omladdning, ska besökaren vara kvar där. Medan scroll-restore.ts lägger tillbaka platsen säger det till med window.__statlinPlats.
 * history.scrollRestoration går inte att använda till det, eftersom nya poster i historiken ärver "manual": då gjorde länken ingenting.
 *
 * Effekten körs också när Next visar en sida som legat dold sedan förra besöket. Då kan Nexts egen scroll till ankaret ha skett medan sidan
 * fortfarande var dold, och besökaren blev kvar högst upp: menylänken Vad studenterna kan på telefonen, andra gången på /foretag.
 */
const restoring = () => (window as Window & { __statlinPlats?: boolean }).__statlinPlats === true;

export function ScrollToAnchor({ id }: { id: string }) {
  useEffect(() => {
    const wanted = () => window.location.hash === `#${id}` && window.scrollY < 40 && !restoring();
    if (!wanted()) return;
    // En bildruta senare, så att Next och menyn har gjort sitt, eller efter en kort stund om webbläsaren inte ritar några bildrutor just då
    // (appens egen webbläsare när panelen är dold). Står sidan redan rätt eller har platsen lagts tillbaka, händer ingenting.
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      if (wanted()) document.getElementById(id)?.scrollIntoView();
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

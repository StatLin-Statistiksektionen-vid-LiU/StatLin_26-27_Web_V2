import type { ReactNode } from "react";
import Link from "next/link";

/** Sidhuvudet är lågt och avslutas med en tunn linje, så att koden syns utan att man scrollar på telefonen. */
export function FrageladaHeader() {
  return (
    <header data-ljus className="relative overflow-hidden border-b border-line">
      <div className="grid-millimeter pointer-events-none absolute inset-0 text-ink [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" aria-hidden />
      <div className="container-site relative pb-7 pt-[calc(var(--header-h)+1.5rem)] md:pb-10 md:pt-[calc(var(--header-h)+3rem)]">
        <p className="kicker flex items-center gap-2.5 text-stone">
          <span className="size-1.5 rounded-full bg-red" aria-hidden />
          Anonym
        </p>
        <h1 className="display-tight mt-2 text-[min(11vw,clamp(2.4rem,7vw,4.5rem))]">Frågelådan</h1>
      </div>
    </header>
  );
}

/** Pappersytan under sidhuvudet. Frågan till vänster och det man behöver veta till höger, på telefonen under varandra. */
export function FrageladaLayout({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="bg-paper">
      <div className="container-site grid gap-12 py-10 md:py-16 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-20">
        <div className="min-w-0 max-w-2xl">{children}</div>
        {aside}
      </div>
    </section>
  );
}

/** Det som går att lita på. Texten lovar bara det som stämmer i koden: se rapporten och /integritet. */
export function TrustNotes() {
  return (
    <aside className="lg:border-l lg:border-line lg:pl-10">
      <h2 className="kicker text-stone">Så fungerar lådan</h2>
      <ul className="mt-4 space-y-1 text-[1.2rem] font-bold leading-snug">
        <li>Vi sparar inget namn.</li>
        <li>Vi sparar ingen IP-adress.</li>
        <li>Vi sparar inget klockslag.</li>
      </ul>
      <p className="mt-4 text-[0.95rem] text-stone">
        Frågan sparas med bara månaden, och raderas efter ungefär ett år. Bara den som har lådan kan läsa den.{" "}
        <Link href="/integritet" className="underline underline-offset-2 hover:text-ink">
          Mer om vad som sparas
        </Link>
      </p>
      <p className="mt-6 border-t border-line pt-5 font-semibold">Skriv inget som avslöjar dig själv.</p>
      <p className="mt-2 text-[0.95rem] text-stone">Namn, klass eller en händelse som bara du var med om kan räcka för att någon ska förstå vem du är.</p>
      <p className="mt-6 border-t border-line pt-5 text-[0.95rem] text-stone">
        Lådan bevakas inte dygnet runt. Är det akut, ring{" "}
        <a href="tel:112" className="font-bold text-ink underline underline-offset-2">
          112
        </a>
        . Sjukvårdsrådgivning får du på{" "}
        <a href="tel:1177" className="font-bold text-ink underline underline-offset-2">
          1177
        </a>
        .
      </p>
    </aside>
  );
}

export function NotOpenYet({ title = "Frågelådan öppnar snart", children }: { title?: string; children?: ReactNode }) {
  return (
    <div className="max-w-xl">
      <h2 className="text-[clamp(1.5rem,4vw,2.1rem)] font-extrabold leading-tight tracking-tight [font-stretch:110%]">{title}</h2>
      <p className="mt-3 text-stone">
        {children ?? (
          <>
            Vi håller på att göra klart den. Vill du nå oss nu hittar du alla adresser under{" "}
            <Link href="/kontakt" className="font-semibold text-ink underline underline-offset-2">
              Kontakt
            </Link>
            .
          </>
        )}
      </p>
    </div>
  );
}

/** Syns innan innehållet har strömmat fram, och är det enda som syns utan JavaScript (SB-27). */
export function FrageladaWaiting() {
  return (
    <section className="bg-paper">
      <div className="container-site min-h-[24rem] py-10 md:py-16">
        <noscript>
          <p className="max-w-xl font-semibold">Frågelådan behöver JavaScript för att fungera. Slå på det i webbläsaren och ladda om sidan.</p>
        </noscript>
      </div>
    </section>
  );
}

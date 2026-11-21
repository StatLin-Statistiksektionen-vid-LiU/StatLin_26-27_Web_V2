"use client";

import Link from "next/link";
import { useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useUtkast } from "@/components/edit-mode/utkast";
import { ChevronDown } from "@/components/icons";
import { MenyKontext } from "@/components/layout/meny-trad";
import { menyMarkering, synligMeny, type NavGroup } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const ingenPrenumeration = () => () => {};

const PUNKT = "relative inline-flex h-9 items-center gap-1 whitespace-nowrap rounded-md px-3 text-[0.9rem] font-medium transition-colors";
const farg = (on: boolean) => (on ? "text-ink" : "text-stone hover:text-ink");

/** Det röda strecket under den punkt man står i. */
function Streck() {
  return <span aria-hidden className="absolute inset-x-3 bottom-0.5 h-0.5 rounded-full bg-red" />;
}

/**
 * Menyn i listen överst på datorn: grupperna på en rad, och de som har egna länkar fäller ut en ruta under sig. Rutan öppnas
 * när man pekar på gruppen, klickar på den eller går dit med tangentbordet. Den stängs med Escape, när man lämnar den, klickar
 * utanför eller väljer en länk. Utan JavaScript öppnar CSS rutorna (.meny-ruta i globals.css).
 *
 * Raden visar menyn som besökare ser den, också i redigeringsläget, där utkastet syns direkt. Ändringarna görs i trädet
 * (meny-trad.tsx), som öppnas med knappen i listen.
 */
export function MenyRad({ meny }: { meny: NavGroup[] }) {
  const kontext = useContext(MenyKontext);
  // Servern ritar menyn utan sökväg, så första ritningen i webbläsaren gör likadant (se MenyTrad).
  const hydrerad = useSyncExternalStore(ingenPrenumeration, () => true, () => false);
  const pathname = hydrerad ? kontext.pathname : null;
  const grupper = synligMeny(useUtkast("b:meny", meny));
  const markering = menyMarkering(pathname, grupper);
  const [oppen, setOppen] = useState<number | null>(null);
  const lista = useRef<HTMLUListElement>(null);
  // Med musen öppnar pekandet rutan, och då ska ett klick på gruppen inte stänga den igen.
  const pekar = useRef(false);
  const stangSnart = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Ett sidbyte stänger rutan.
  const [sist, setSist] = useState(pathname);
  if (sist !== pathname) {
    setSist(pathname);
    setOppen(null);
  }

  useEffect(() => {
    if (oppen === null) return;
    const utanfor = (e: PointerEvent) => {
      if (!lista.current?.contains(e.target as Node)) setOppen(null);
    };
    const tangent = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Stod fokus i rutan går det tillbaka till gruppens knapp, så att det inte hamnar på en dold länk.
      if (lista.current?.contains(document.activeElement)) lista.current.querySelector<HTMLElement>('[aria-expanded="true"]')?.focus();
      setOppen(null);
    };
    document.addEventListener("pointerdown", utanfor);
    document.addEventListener("keydown", tangent);
    return () => {
      document.removeEventListener("pointerdown", utanfor);
      document.removeEventListener("keydown", tangent);
    };
  }, [oppen]);

  const stang = (i: number) => setOppen((o) => (o === i ? null : o));

  return (
    <ul ref={lista} className="meny-rad flex items-center gap-0.5">
      {grupper.map((g, i) => {
        const lankar = g.children ?? [];
        const on = markering.grupp(g);
        if (!lankar.length) {
          return (
            <li key={g.href + g.label}>
              <Link href={g.href} aria-current={pathname === g.href ? "page" : on ? "true" : undefined} className={cn(PUNKT, farg(on))}>
                {g.label}
                {on && <Streck />}
              </Link>
            </li>
          );
        }
        const ute = oppen === i;
        const bred = lankar.length > 3;
        return (
          <li
            key={g.href + g.label}
            className="relative"
            data-oppen={ute || undefined}
            onPointerEnter={(e) => {
              if (e.pointerType !== "mouse") return;
              pekar.current = true;
              clearTimeout(stangSnart.current);
              setOppen(i);
            }}
            onPointerLeave={(e) => {
              if (e.pointerType !== "mouse") return;
              pekar.current = false;
              stangSnart.current = setTimeout(() => stang(i), 140);
            }}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) stang(i);
            }}
          >
            <button
              type="button"
              aria-expanded={ute}
              aria-controls={`meny-ruta-${i}`}
              onClick={() => setOppen((o) => (o === i && !pekar.current ? null : i))}
              className={cn(PUNKT, "cursor-pointer", farg(on || ute))}
            >
              {g.label}
              <ChevronDown size={13} className="meny-pil opacity-60 transition-transform duration-200" />
              {on && <Streck />}
            </button>
            <div id={`meny-ruta-${i}`} className={cn("meny-ruta", bred ? "w-[33rem]" : "w-[18rem]")}>
              <ul className={cn("grid gap-0.5 rounded-xl border border-line bg-white p-1.5 shadow-[0_20px_44px_-20px_rgb(0_0_0/0.5)]", bred && "grid-cols-2")}>
                {lankar.map((c) => {
                  const here = c.href === markering.basta;
                  return (
                    <li key={c.href + c.label}>
                      <Link
                        href={c.href}
                        aria-current={pathname === c.href ? "page" : here ? "true" : undefined}
                        onClick={() => setOppen(null)}
                        className={cn("block rounded-lg px-3 py-2 transition-colors hover:bg-ink/[0.05]", here && "bg-ink/[0.06]")}
                      >
                        <span className="block text-[0.9rem] font-medium text-ink">{c.label}</span>
                        {c.description && <span className="mt-0.5 block text-[0.78rem] leading-snug text-stone">{c.description}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

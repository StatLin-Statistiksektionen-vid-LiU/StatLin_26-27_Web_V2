"use client";

import Link from "next/link";
import { createContext, useContext, useSyncExternalStore, type ComponentType, type MouseEvent } from "react";
import { RLista, type Falt } from "@/components/edit-mode/redigerbar";
import { useBlock } from "@/components/edit-mode/utkast";
import { BookOpen, Calendar, Chain, ChevronDown, Handshake, Home, Mail, Newspaper, Users } from "@/components/icons";
import { synligMeny, type NavGroup, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

type IconType = ComponentType<{ size?: number; className?: string }>;

/** Sidhuvudet ger menyn sökvägen, och telefonens meny även vad som händer när man väljer en länk (menyn stängs). */
export const MenyKontext = createContext<{ pathname: string | null; onNavigate?: () => void }>({ pathname: null });

/** Ikonen framför varje grupp. Efter länken, så att den står kvar när gruppen byter namn. Nya grupper får en länkikon. */
const IKONER: Record<string, IconType> = {
  "/evenemang": Calendar,
  "/nyheter": Newspaper,
  "/sektionen": Users,
  "/studenter": BookOpen,
  "/foretag": Handshake,
  "/kontakt": Mail,
};

const ingenPrenumeration = () => () => {};

const DOLJ_HJALP ="Den står kvar här i redigeringsläget och går att visa igen.";

const GRUPP_FALT: Falt<NavGroup>[] = [
  { nyckel: "label", etikett: "Namnet i menyn", kravs: true, max: 40 },
  { nyckel: "href", etikett: "Länken", typ: "lank", hjalp: "Dit menypunkten leder när den inte har några egna länkar." },
  { nyckel: "hidden", etikett: "Dölj i menyn", typ: "vaxel", hjalp: DOLJ_HJALP },
];

const LANK_FALT: Falt<NavItem>[] = [
  { nyckel: "label", etikett: "Länktexten", kravs: true, max: 60 },
  { nyckel: "href", etikett: "Länken", typ: "lank" },
  { nyckel: "description", etikett: "Beskrivningen", max: 140, hjalp: "Syns i sökningen." },
  { nyckel: "hidden", etikett: "Dölj länken", typ: "vaxel", hjalp: DOLJ_HJALP },
];

function Dold() {
  return <span className="ml-1 shrink-0 rounded bg-ink/[0.07] px-1.5 py-px text-[0.68rem] font-medium uppercase tracking-wide text-stone">dold</span>;
}

/**
 * Menyns träd: sm är datorns sidomeny, lg telefonens meny med större rader för fingret. Menyn kommer från blocket meny
 * (standard är NAV i navigation.ts). I redigeringsläget syns även dolda grupper och länkar, alla grupper är utfällda
 * och varje grupp kan få egna länkar.
 */
export function MenyTrad({ meny, storlek }: { meny: NavGroup[]; storlek: "sm" | "lg" }) {
  const kontext = useContext(MenyKontext);
  // Servern ritar menyn utan sökväg. Den sparade menyn hydreras först när den kommit, och då vet sidhuvudet redan
  // sökvägen: utan sökväg under hydreringen blir det samma HTML, och den markerade sidan kommer direkt efteråt.
  const hydrerad = useSyncExternalStore(ingenPrenumeration, () => true, () => false);
  const pathname = hydrerad ? kontext.pathname : null;
  // I redigeringsläget hindrar listan länken (preventDefault), och då ska telefonens meny inte heller stängas.
  const valj = (e: MouseEvent) => {
    if (!e.defaultPrevented) kontext.onNavigate?.();
  };
  const { varde, aktiv, andra } = useBlock("b:meny", meny);
  const grupper = aktiv ? varde : synligMeny(varde);

  const active = (href: string) =>
    pathname !== null && (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));
  // Undersidor med ankare (/foretag#kompetens) ska inte markeras som sidan själv.
  const exact = (href: string) => !href.includes("#") && active(href);
  const groupActive = (g: NavGroup) => active(g.href) || !!g.children?.some((c) => exact(c.href));

  const row = cn(
    "flex w-full items-center gap-2.5 rounded-md px-2.5 transition-colors",
    storlek === "sm" ? "h-8 text-[0.875rem] pointer-coarse:h-10" : "h-11 text-[1rem]",
  );
  const rowState = (on: boolean) => (on ? "bg-ink/[0.06] font-medium text-ink" : "text-stone hover:bg-ink/[0.04] hover:text-ink");
  const iconSize = storlek === "sm" ? 16 : 18;

  const linkRow = (href: string, label: string, Icon: IconType) => {
    const on = active(href);
    return (
      <Link href={href} aria-current={pathname === href ? "page" : undefined} onClick={valj} className={cn(row, rowState(on))}>
        <Icon size={iconSize} className={on ? "text-red" : undefined} />
        {label}
      </Link>
    );
  };

  const barn = (c: NavItem) => {
    const here = exact(c.href);
    return (
      <Link
        href={c.href}
        aria-current={pathname === c.href ? "page" : undefined}
        onClick={valj}
        className={cn(
          "relative flex items-center rounded-md px-2.5 transition-colors",
          storlek === "sm" ? "h-7 text-[0.84rem] pointer-coarse:h-10" : "h-10 text-[0.95rem]",
          here ? "bg-ink/[0.06] font-medium text-ink" : "text-stone hover:bg-ink/[0.04] hover:text-ink",
        )}
      >
        {here && <span aria-hidden className={cn("absolute top-1/2 h-4 w-px -translate-y-1/2 bg-red", storlek === "sm" ? "-left-[0.55rem]" : "-left-[0.7rem]")} />}
        <span className={cn("truncate", c.hidden && "opacity-50")}>{c.label}</span>
        {c.hidden && <Dold />}
      </Link>
    );
  };

  const grupp = (g: NavGroup, gi: number) => {
    const Icon = IKONER[g.href] ?? Chain;
    const lankar = g.children ?? [];
    if (!aktiv && !lankar.length) return linkRow(g.href, g.label, Icon);
    const on = groupActive(g);
    return (
      <details className="meny-grupp" open={aktiv || on || undefined}>
        <summary className={cn(row, "cursor-pointer select-none", on ? "font-medium text-ink" : "text-stone hover:bg-ink/[0.04] hover:text-ink")}>
          <Icon size={iconSize} className={cn(on && "text-red", g.hidden && "opacity-50")} />
          <span className={cn("truncate", g.hidden && "opacity-50")}>{g.label}</span>
          {g.hidden && <Dold />}
          <ChevronDown size={14} className="meny-pil ml-auto shrink-0 opacity-60 transition-transform duration-200" />
        </summary>
        <RLista
          aktiv={aktiv}
          items={aktiv ? lankar : lankar.filter((c) => !c.hidden)}
          onChange={(nya) =>
            andra((m) => {
              m[gi].children = nya;
            })
          }
          render={barn}
          etikett="länk"
          falt={LANK_FALT}
          ny={(): NavItem => ({ label: "", href: "" })}
          max={24}
          className={cn("mb-1.5 mt-0.5 space-y-0.5 border-l border-line", storlek === "sm" ? "ml-[1.15rem] pl-2" : "ml-[1.35rem] pl-2.5")}
        />
      </details>
    );
  };

  return (
    <div className={cn("space-y-0.5", aktiv && "meny-redigeras")}>
      <ul>
        <li>{linkRow("/", "Start", Home)}</li>
      </ul>
      <RLista
        aktiv={aktiv}
        items={grupper}
        onChange={(nya) => andra((m) => void m.splice(0, m.length, ...nya))}
        render={grupp}
        etikett="menypunkt"
        falt={GRUPP_FALT}
        ny={(): NavGroup => ({ label: "", href: "", children: [] })}
        min={1}
        max={12}
        className="space-y-0.5"
      />
    </div>
  );
}

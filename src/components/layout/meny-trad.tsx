"use client";

import Link from "next/link";
import { createContext, useContext, useSyncExternalStore, type ComponentType, type MouseEvent } from "react";
import { RLista, type Falt } from "@/components/edit-mode/redigerbar";
import { useBlock } from "@/components/edit-mode/utkast";
import { BookOpen, Calendar, Chain, ChevronDown, Handshake, Home, Mail, Newspaper, Users } from "@/components/icons";
import { menyMarkering, synligMeny, type NavGroup, type NavItem } from "@/lib/navigation";
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
 * Menyns träd, i panelen som öppnas med menyknappen: telefonens meny, och på datorn stället där menyn ändras. Menyn kommer
 * från blocket meny (standard är NAV i navigation.ts). I redigeringsläget syns även dolda grupper och länkar, alla grupper
 * är utfällda och varje grupp kan få egna länkar. Grupperna är details, så att de går att fälla ut även utan JavaScript.
 */
export function MenyTrad({ meny }: { meny: NavGroup[] }) {
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

  const { aktiv: active, grupp: groupActive, basta } = menyMarkering(pathname, grupper);

  const row = "flex h-11 w-full items-center gap-2.5 rounded-md px-2.5 text-[1rem] transition-colors";
  const rowState = (on: boolean) => (on ? "bg-ink/[0.06] font-medium text-ink" : "text-stone hover:bg-ink/[0.04] hover:text-ink");
  const iconSize = 18;

  const linkRow = (href: string, label: string, Icon: IconType) => {
    const on = active(href);
    return (
      <Link href={href} aria-current={pathname === href ? "page" : on ? "true" : undefined} onClick={valj} className={cn(row, rowState(on))}>
        <Icon size={iconSize} className={on ? "text-red" : undefined} />
        {label}
      </Link>
    );
  };

  const barn = (c: NavItem) => {
    const here = c.href === basta;
    return (
      <Link
        href={c.href}
        // På en undersida (ett evenemang, ett utskott) är raden inte sidan själv, men den är var man är. Det sägs då också till skärmläsare.
        aria-current={pathname === c.href ? "page" : here ? "true" : undefined}
        onClick={valj}
        className={cn("relative flex h-11 items-center rounded-md px-2.5 text-[0.95rem] transition-colors", rowState(here))}
      >
        {here && <span aria-hidden className="absolute -left-[0.7rem] top-1/2 h-4 w-px -translate-y-1/2 bg-red" />}
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
          className="mb-1.5 ml-[1.35rem] mt-0.5 space-y-0.5 border-l border-line pl-2.5"
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

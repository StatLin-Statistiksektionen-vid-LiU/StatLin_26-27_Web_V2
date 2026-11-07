import { Children, isValidElement, type CSSProperties, type ReactNode } from "react";
import { cn, fitHeading } from "@/lib/utils";

/** Undersidornas huvud: brödsmula, rubrik i versaler och ingress, avslutat med en tunn linje. */
export function PageHero({
  kicker,
  title,
  accent,
  lead,
  children,
  aside,
  className,
  fitTitle,
  note,
}: {
  /** En anteckning för hand som pekar på rubriken (Anteckning), lagd över hela huvudet. */
  note?: ReactNode;
  kicker: string;
  title: ReactNode;
  /**
   * Titeln som ren text, när den inte går att läsa ut ur title. Storleken räknas ut efter längsta ordet så att
   * långa sammansättningar krymper i stället för att brytas mitt i ordet. Mobil och desktop var för sig.
   */
  fitTitle?: string;
  /** Färgen på punkten framför brödsmulan, t.ex. ett utskotts färg. */
  accent?: string;
  lead?: ReactNode;
  children?: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    // data-ljus: rutnätet lyser kring pekaren här, se RutnatLjus.
    <section data-ljus className={cn("relative isolate border-b border-line", className)}>
      {/* Millimeterpapperet, som kring loggan på startsidan. Bakom innehållet, men framför ljuset kring pekaren. */}
      <div aria-hidden className="sidhuvud-rutnat grid-millimeter pointer-events-none absolute inset-0 -z-10 text-ink" />
      {note}
      <div className="container-site relative grid items-end gap-10 pb-12 pt-[calc(var(--header-h)+3rem)] md:grid-cols-12 md:pb-14 md:pt-[calc(var(--header-h)+4.5rem)]">
        <div className={cn(aside ? "md:col-span-8" : "md:col-span-10")}>
          <p className="kicker flex items-center gap-2.5 text-stone">
            <span className="size-1.5 rounded-full" style={{ background: accent ?? "var(--color-red)" }} aria-hidden />
            {kicker}
          </p>
          <div className="@container mt-5">
            <h1
              className="display text-[length:var(--title-sm)] [overflow-wrap:anywhere] md:text-[length:var(--title-md)]"
              style={titleSizes(fitTitle ?? textOf(title))}
            >
              {title}
            </h1>
          </div>
          {lead && <div className="mt-5 max-w-2xl text-[1.05rem] leading-relaxed text-stone md:text-[1.15rem]">{lead}</div>}
          {children && <div className="mt-8">{children}</div>}
        </div>
        {aside && <div className="md:col-span-4">{aside}</div>}
      </div>
    </section>
  );
}

function titleSizes(text: string): CSSProperties {
  return {
    // Versalerna mäts med tabellen i fitHeading. Största storleken är lugnare än i förra versionen, eftersom sidomenyn tar plats.
    // En kort rubrik som nästan ryms på en rad står på en rad, så att den inte bryts olika med reservfonten och Archivo.
    "--title-sm": fitHeading(text, { maxRem: 3.6, maxVw: 11, enRad: true }).fontSize,
    "--title-md": fitHeading(text, { maxRem: 4.8, maxVw: 6.2, enRad: true }).fontSize,
  } as CSSProperties;
}

/** Titelns text, även när en del av den ligger i en färgad span. En radbrytning skiljer två ord åt. */
function textOf(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") return String(child);
      if (!isValidElement(child)) return "";
      return child.type === "br" ? " " : textOf((child.props as { children?: ReactNode }).children);
    })
    .join("");
}

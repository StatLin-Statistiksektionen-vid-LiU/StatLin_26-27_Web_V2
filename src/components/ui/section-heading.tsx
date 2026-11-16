import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * Rubrik för en sektion: liten etikett, rubrik i versaler och en länk till hela listan. På telefon står länken på etikettens
 * rad, så att den inte hänger ensam under rubriken. Från surfplatta står den till höger om rubriken. Rubriken är mindre än
 * sidans huvudrubrik, så att det bara finns en som är störst. stack behåller telefonens uppställning i alla bredder och ger
 * en mindre rubrik, för en rubrik som står i en smal spalt.
 */
export function SectionHeading({
  id,
  index,
  kicker,
  title,
  href,
  linkLabel,
  dark,
  stack,
  className,
  linkClassName,
}: {
  id?: string;
  index?: string;
  kicker: ReactNode;
  title: ReactNode;
  href?: string;
  linkLabel?: ReactNode;
  dark?: boolean;
  stack?: boolean;
  className?: string;
  linkClassName?: string;
}) {
  return (
    <div className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6", className)}>
      <p className={cn("kicker col-start-1 row-start-1 flex min-w-0 items-center gap-2.5", dark ? "text-white/55" : "text-stone")}>
        {index && <span className={cn("tabular", dark ? "text-red" : "text-red-deep")}>{index}</span>}
        {index && <span className={cn("h-px w-5", dark ? "bg-white/25" : "bg-ink/20")} aria-hidden />}
        {kicker}
      </p>
      <h2 id={id} className={cn("display col-span-2 row-start-2 mt-3", stack ? "text-[clamp(1.375rem,0.85rem_+_1vw,1.875rem)]" : "text-[clamp(1.375rem,1rem_+_1.4vw,2.25rem)] md:col-span-1")}>
        {title}
      </h2>
      {href && (
        <Link
          href={href}
          className={cn(
            "tryck group col-start-2 row-start-1 inline-flex shrink-0 items-center gap-1.5 text-[0.88rem] font-medium transition-colors",
            !stack && "md:row-start-2 md:self-end",
            dark ? "text-white/80 hover:text-white" : "text-stone hover:text-ink",
            linkClassName,
          )}
        >
          {linkLabel ?? "Visa alla"}
          <ArrowRight size={15} className="transition-transform duration-300 group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

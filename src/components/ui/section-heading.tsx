import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "@/components/icons";
import { cn } from "@/lib/utils";

/** Rubrik för en sektion: liten etikett med nummer, rubrik i versaler och en länk till hela listan. */
export function SectionHeading({
  index,
  kicker,
  title,
  href,
  linkLabel,
  dark,
  className,
}: {
  index?: string;
  kicker: string;
  title: ReactNode;
  href?: string;
  linkLabel?: string;
  dark?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 md:flex-row md:items-end md:justify-between", className)}>
      <div>
        <p className={cn("kicker flex items-center gap-2.5", dark ? "text-white/55" : "text-stone")}>
          {index && <span className={cn("tabular", dark ? "text-red" : "text-red-deep")}>{index}</span>}
          {index && <span className={cn("h-px w-5", dark ? "bg-white/25" : "bg-ink/20")} aria-hidden />}
          {kicker}
        </p>
        <h2 className="display mt-3 text-[clamp(1.8rem,3.6vw,3rem)]">{title}</h2>
      </div>
      {href && (
        <Link
          href={href}
          className={cn(
            "group inline-flex shrink-0 items-center gap-1.5 text-[0.88rem] font-medium transition-colors",
            dark ? "text-white/80 hover:text-white" : "text-stone hover:text-ink",
          )}
        >
          {linkLabel ?? "Visa alla"}
          <ArrowRight size={15} className="transition-transform duration-300 group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

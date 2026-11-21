import { cn } from "@/lib/utils";

/** Millimeterpapper bakom inloggningens panel, tonat mot kanterna. */
export function HeroGrid({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("hero-rutnat pointer-events-none absolute inset-0 -z-10 overflow-hidden text-ink", className)}>
      <div className="hero-rutnat-bas grid-millimeter absolute inset-0" />
    </div>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, Check, Plus } from "@/components/icons";
import { cn } from "@/lib/utils";

/** På telefon ligger formuläret för något nytt under hela listan. Knappen går dit, och behövs inte när de står bredvid varandra. */
export function JumpToForm({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="btn btn-ghost btn-sm bg-white lg:hidden">
      <Plus size={15} /> {children}
    </a>
  );
}

export function AdminHeader({
  title,
  description,
  actions,
  back,
  kicker,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
  kicker?: string;
}) {
  return (
    <header className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="tryck kicker mb-4 inline-flex items-center gap-2 text-stone hover:text-ink">
            <ArrowLeft size={14} /> {back.label}
          </Link>
        )}
        {kicker && <p className="kicker text-red-deep">{kicker}</p>}
        {/* Långa ord som Intresseanmälningar ryms inte på en rad vid 320 pixlar: de avstavas, och annars bryts de, i stället för att sidan kan dras i sidled. */}
        <h1 className="mt-1 break-words text-[clamp(1.8rem,3.5vw,2.5rem)] font-extrabold leading-tight tracking-tight hyphens-auto [font-stretch:110%]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-stone">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

/** Ett besked överst på sidan. `actions` är det man brukar vilja göra härnäst: en till tre små knappar. */
export function Notice({ children, tone = "success", actions }: { children: ReactNode; tone?: "success" | "info" | "warning"; actions?: ReactNode }) {
  return (
    <div
      role="status"
      className={cn(
        "mb-6 flex flex-col gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold sm:flex-row sm:items-center",
        tone === "success" && "border-emerald-600/25 bg-emerald-600/[0.07] text-emerald-900",
        tone === "info" && "border-ink/10 bg-white text-ink",
        tone === "warning" && "border-red/30 bg-red/[0.06] text-red-dark",
      )}
    >
      <span className="flex min-w-0 items-center gap-3 sm:flex-1">
        {tone === "success" && <Check size={18} className="shrink-0" />}
        {children}
      </span>
      {actions && <span className="flex shrink-0 flex-wrap gap-2 text-ink">{actions}</span>}
    </div>
  );
}

export function StatusBadge({ published, label }: { published: boolean; label?: string }) {
  return (
    <span className={cn("chip", published ? "bg-emerald-600/10 text-emerald-800" : "bg-ink/[0.07] text-ink/60")}>
      <span className={cn("size-1.5 rounded-full", published ? "bg-emerald-600" : "bg-ink/40")} aria-hidden />
      {label ?? (published ? "Publicerad" : "Utkast")}
    </span>
  );
}

/** Administratörernas granskning. Står bredvid publiceringsstatusen men påverkar den aldrig. */
export function ReviewBadge({ checked }: { checked: boolean }) {
  return (
    <span className={cn("chip", checked ? "bg-ink text-white" : "text-ink/65 ring-1 ring-inset ring-ink/20")}>
      {checked ? <Check size={12} strokeWidth={2.5} /> : <span className="size-1.5 rounded-full border border-ink/40" aria-hidden />}
      {checked ? "Granskad" : "Ej granskad"}
    </span>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-ink/20 bg-white/50 px-6 py-14 text-center">
      <p className="text-lg font-bold">{title}</p>
      {children && <p className="mx-auto mt-1.5 max-w-md text-sm text-stone">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-[1.5rem] border border-ink/10 bg-white", className)}>{children}</div>;
}

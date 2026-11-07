"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Edit, Image as ImageIcon, Plus, Settings } from "@/components/icons";
import { cn } from "@/lib/utils";
import { canEditTarget, editStore, useEditState, type EditTarget } from "./store";

/**
 * Ett område som går att redigera direkt på sajten. Med redigeringsläget på får det en streckad ram
 * och en penna som öppnar sidopanelen – men bara för konton som får ändra just det här.
 * För besökare är det en vanlig div.
 */
export function Editable({
  target,
  label = "Redigera",
  className,
  inset,
  penClassName,
  children,
}: {
  target: EditTarget;
  label?: string;
  className?: string;
  /** Ramen innanför kanten, för ytor som går kant i kant. */
  inset?: boolean;
  /** Pennans placering, t.ex. under det fasta sidhuvudet. */
  penClassName?: string;
  children: ReactNode;
}) {
  const { user, editing } = useEditState();
  const allowed = editing && !!user && canEditTarget(user, target);
  return (
    <div
      className={cn(
        "relative",
        allowed && !inset && "rounded-[1rem] outline-2 outline-offset-4 outline-dashed outline-red/70",
        // Kant i kant-ytor har egen bakgrund som skulle måla över en outline – ramen läggs ovanpå i stället.
        allowed && inset && "after:pointer-events-none after:absolute after:inset-2 after:z-20 after:rounded-[1.25rem] after:border-2 after:border-dashed after:border-red/70",
        className,
      )}
    >
      {children}
      {allowed && (
        <button
          type="button"
          data-edit-pen
          onClick={() => editStore.open(target)}
          className={cn(
            // Bara en rund penna på ramens hörn, så att den inte täcker texten. Texten fälls ut åt vänster vid hover och fokus.
            inset ? "right-2 top-2" : "-right-3 -top-4",
            "group/pen absolute z-30 inline-flex h-9 min-w-9 items-center justify-center rounded-full bg-red-deep px-2.5 text-xs font-bold text-white shadow-[0_10px_30px_-10px_rgb(255_7_7/0.8)] transition-colors hover:bg-red-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
            penClassName,
          )}
        >
          <span className="max-w-0 overflow-hidden whitespace-nowrap transition-[max-width,margin] duration-300 group-hover/pen:mr-1.5 group-hover/pen:max-w-48 group-focus-visible/pen:mr-1.5 group-focus-visible/pen:max-w-48">{label}</span>
          <Edit size={15} className="shrink-0" />
        </button>
      )}
    </div>
  );
}

/** En länk som bara visas i redigeringsläget, för den som får ändra target – t.ex. "Nytt evenemang" på utskottssidan. */
export function EditModeLink({
  target,
  href,
  icon = "plus",
  children,
  className,
}: {
  target: EditTarget;
  href: string;
  icon?: "plus" | "edit";
  children: ReactNode;
  className?: string;
}) {
  const { user, editing } = useEditState();
  if (!editing || !user || !canEditTarget(user, target)) return null;
  const Icon = icon === "plus" ? Plus : Edit;
  return (
    <Link href={href} className={cn("btn btn-red btn-sm", className)}>
      <Icon size={16} /> {children}
    </Link>
  );
}

/** En knapp som bara visas i redigeringsläget och öppnar sidopanelen, utan ram runt något, t.ex. "Byt bilder". */
export function EditModeButton({
  target,
  children,
  className,
  icon = "bild",
}: {
  target: EditTarget;
  children: ReactNode;
  className?: string;
  icon?: "bild" | "installningar";
}) {
  const { user, editing } = useEditState();
  if (!editing || !user || !canEditTarget(user, target)) return null;
  const Icon = icon === "bild" ? ImageIcon : Settings;
  return (
    <button
      type="button"
      onClick={() => editStore.open(target)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-red px-3.5 py-2 text-xs font-bold text-white shadow-[0_10px_30px_-10px_rgb(255_7_7/0.8)] transition-colors hover:bg-red-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
        className,
      )}
    >
      <Icon size={14} /> {children}
    </button>
  );
}

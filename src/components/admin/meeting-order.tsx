"use client";

import { unstable_rethrow } from "next/navigation";
import { useState, useTransition } from "react";
import { moveMeetingItem } from "@/app/admin/_actions/meetings";
import { ChevronDown } from "@/components/icons";

/** Ordförandens pilar på dagordningen. Punkten byter plats med grannen ovanför eller under. */
export function MeetingMoveButtons({ id, title, first, last }: { id: number; title: string; first: boolean; last: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const move = (direction: -1 | 1) =>
    start(async () => {
      setError(null);
      try {
        const res = await moveMeetingItem(id, direction);
        if (res?.error) setError(res.error);
      } catch (err) {
        unstable_rethrow(err);
        setError("Det gick inte att flytta punkten. Försök igen.");
      }
    });
  const button = "grid size-7 place-items-center rounded-full hover:bg-paper disabled:opacity-25 pointer-coarse:size-10";
  return (
    <span className="inline-flex shrink-0 items-center gap-2">
      {error && (
        <span role="alert" className="max-w-44 text-xs font-medium text-red-deep">
          {error}
        </span>
      )}
      {/* Bredvid varandra när det finns plats, så att raderna på dagordningen inte blir dubbelt så höga som texten. */}
      <span className="inline-flex flex-col sm:flex-row">
        <button type="button" disabled={first || pending} onClick={() => move(-1)} className={button} aria-label={`Flytta upp ${title}`}>
          <ChevronDown size={14} className="rotate-180" />
        </button>
        <button type="button" disabled={last || pending} onClick={() => move(1)} className={button} aria-label={`Flytta ned ${title}`}>
          <ChevronDown size={14} />
        </button>
      </span>
    </span>
  );
}

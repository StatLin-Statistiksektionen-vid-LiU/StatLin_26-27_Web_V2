"use client";

import { unstable_rethrow } from "next/navigation";
import { useState, useTransition } from "react";
import { movePartner } from "@/app/admin/_actions/content";
import { ChevronDown } from "@/components/icons";

/** Pilarna i listan under Sponsorer. Sponsorn flyttas ett steg bland dem som står på samma ställe på sajten. */
export function PartnerMoveButtons({ id, name, first, last }: { id: number; name: string; first: boolean; last: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const move = (direction: -1 | 1) =>
    start(async () => {
      setError(null);
      try {
        const res = await movePartner(id, direction);
        if (res) setError(res.error);
      } catch (err) {
        unstable_rethrow(err);
        setError("Det gick inte att flytta sponsorn. Försök igen.");
      }
    });
  const button = "grid size-7 place-items-center rounded-full hover:bg-paper disabled:opacity-25 pointer-coarse:size-10";
  return (
    <span className="inline-flex items-center gap-2">
      {error && (
        <span role="alert" className="max-w-44 text-xs font-medium text-red-deep">
          {error}
        </span>
      )}
      <span className="inline-flex flex-col">
        <button type="button" disabled={first || pending} onClick={() => move(-1)} className={button} aria-label={`Flytta upp ${name}`}>
          <ChevronDown size={14} className="rotate-180" />
        </button>
        <button type="button" disabled={last || pending} onClick={() => move(1)} className={button} aria-label={`Flytta ned ${name}`}>
          <ChevronDown size={14} />
        </button>
      </span>
    </span>
  );
}

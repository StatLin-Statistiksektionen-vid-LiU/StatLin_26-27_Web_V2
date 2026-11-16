"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Bell, Board, Chat, ClipboardList, MessageCircle } from "@/components/icons";
import { previewTime } from "@/lib/chatt";
import type { Avisering } from "@/lib/data/aviseringar";
import { todayLocal } from "@/lib/dates";
import { cn } from "@/lib/utils";

const ICONS = { trad: Chat, inbjudan: ClipboardList, uppdrag: Board, forfragan: MessageCircle };

/**
 * Klockan i portalens meny: det som har hänt sedan sist, som en lista där varje rad leder dit det gäller. rendered är listan från
 * servern när skalet renderades. Webbläsaren hämtar en ny när klockan öppnas, när man byter sida och när antalet olästa i chatten
 * ändras (chatUnread, som menyn redan frågar efter en gång i halvminuten), så att inget eget frågande behövs.
 */
export function Aviseringar({ rendered, chatUnread, className }: { rendered: Avisering[]; chatUnread: number; className?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Det hämtade gäller tills servern skickar en ny lista med skalet: då är den nyare.
  const [live, setLive] = useState<{ from: Avisering[]; items: Avisering[] } | null>(null);
  const items = live && live.from === rendered ? live.items : rendered;
  const root = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/aviseringar");
      if (res.ok) setLive({ from: rendered, items: ((await res.json()) as { aviseringar: Avisering[] }).aviseringar });
    } catch {
      // Utan nät står listan kvar som den var.
    }
  }, [rendered]);

  const started = useRef(false);
  useEffect(() => {
    // Första gången gäller listan från servern.
    if (started.current) void refresh();
    started.current = true;
  }, [chatUnread, pathname, refresh]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onPointer = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const today = todayLocal();
  const count = items.length;

  return (
    <div ref={root} className={className}>
      <button
        type="button"
        onClick={() => {
          if (!open) void refresh();
          setOpen(!open);
        }}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={count > 0 ? `Aviseringar, ${count} nya` : "Aviseringar"}
        className={cn("relative grid size-10 place-items-center rounded-lg text-stone transition-colors hover:bg-ink/[0.05] hover:text-ink", open && "bg-ink/[0.06] text-ink")}
      >
        <Bell size={18} />
        {count > 0 && (
          <span aria-hidden className="tabular absolute right-0.5 top-0.5 grid min-w-[1.1rem] place-items-center rounded-full bg-red px-1 text-[0.62rem] font-bold leading-[1.1rem] text-white">
            {count}
          </span>
        )}
      </button>
      {/* På telefonen under portalens list, i full bredd. På en dator intill menyn. Raderna finns bara i sidan medan klockan är öppen. */}
      <section
        id={panelId}
        aria-label="Aviseringar"
        hidden={!open}
        className="fixed inset-x-3 top-[4.5rem] z-50 overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-xl lg:inset-x-auto lg:left-[17.5rem] lg:top-3 lg:ml-2 lg:w-[23rem]"
      >
        <h2 className="border-b border-ink/10 px-4 py-3 font-bold">Aviseringar</h2>
        {!open ? null : count === 0 ? (
          <p className="px-4 py-6 text-sm text-stone">Inget nytt. Här står nya meddelanden i planernas trådar, inbjudningar, nya uppdrag och det som kommit in från sajten.</p>
        ) : (
          <ul className="max-h-[min(28rem,65dvh)] divide-y divide-ink/10 overflow-y-auto overscroll-contain">
            {items.map((a) => {
              const Icon = ICONS[a.slag];
              return (
                <li key={a.key}>
                  <Link href={a.href} onClick={() => setOpen(false)} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-ink/[0.04]">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-paper text-ink/70">
                      <Icon size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="line-clamp-2 text-[0.92rem] font-bold leading-snug [overflow-wrap:anywhere]">{a.title}</span>
                        {a.at && <span className="shrink-0 font-mono text-[0.68rem] text-stone">{previewTime(a.at, today)}</span>}
                      </span>
                      <span className="mt-0.5 flex items-center gap-2">
                        <span className="line-clamp-2 min-w-0 flex-1 text-[0.82rem] text-stone [overflow-wrap:anywhere]">{a.text}</span>
                        {a.slag === "trad" && (
                          <span className="tabular grid min-w-5 shrink-0 place-items-center rounded-full bg-red px-1.5 text-[0.7rem] font-bold leading-5 text-white">
                            {a.count}
                            <span className="sr-only"> olästa</span>
                          </span>
                        )}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

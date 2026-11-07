"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, type PointerEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { LogoutForm } from "@/components/admin/logout-form";
import { Check, ChevronDown, Edit, Grip, Logout, Settings } from "@/components/icons";
import { cn } from "@/lib/utils";
import { bubbleStore, cornerAfterKey, CORNERS, useBubble, type Corner } from "./bubble-store";
import { EditDrawer } from "./edit-drawer";
import { EditGuide } from "./edit-guide";
import { Redigeringslist } from "./redigeringslist";
import { editStore, useEditState, type EditUser } from "./store";

/**
 * Bubblan för inloggade: slå på redigeringsläget, öppna guiden, gå till adminpanelen eller logga ut. Den går att dra till
 * vilket hörn som helst och fälla ihop. Eftersom den sitter fast i ett hörn med CSS kan den inte hamna utanför skärmen.
 */
export function AdminBar({ user }: { user: EditUser }) {
  const { editing, flash } = useEditState();
  const pathname = usePathname();

  // Objektet är nytt varje gång servern renderar om sidan (en sparning, en förnyad kaka). Effekten nollar panelen, så den ska
  // bara köras när uppgifterna faktiskt ändrats: annars stängdes panelen mitt i arbetet (SB-30).
  const { id, name, post, role, committee_id: committeeId, committee_name: committeeName, design, naringsliv, ubu, estig } = user;
  const stable = useMemo(
    () => ({ id, name, post, role, committee_id: committeeId, committee_name: committeeName, design, naringsliv, ubu, estig }),
    [id, name, post, role, committeeId, committeeName, design, naringsliv, ubu, estig],
  );
  useEffect(() => {
    editStore.setUser(stable);
    return () => editStore.setUser(null);
  }, [stable]);

  // Panelen hör till sidan den öppnades på – men den stängs inte mitt i en uppladdning, och frågar om osparade ändringar.
  useEffect(() => {
    editStore.requestClose();
  }, [pathname]);

  const { corner, collapsed, guide } = useBubble();
  const barRef = useRef<HTMLDivElement>(null);
  const roundRef = useRef<HTMLButtonElement>(null);
  const foldRef = useRef<HTMLButtonElement>(null);
  const helpRef = useRef<HTMLButtonElement>(null);
  const dragged = useRef(false);
  const dragStart = useRef<{ x: number; y: number; moving: boolean } | null>(null);
  const top = corner.startsWith("top");
  const left = corner.endsWith("left");
  // Under guiden är bubblan alltid utfälld, annars finns inget reglage att peka på.
  const mode = guide !== null ? false : collapsed;

  useEffect(() => {
    bubbleStore.openGuideFirstTime();
  }, []);

  /** Flyttar till ett hörn och låter bubblan glida dit från där den var. */
  function settle(next: Corner, from: DOMRect) {
    const bar = barRef.current;
    if (!bar) return;
    flushSync(() => bubbleStore.moveTo(next));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const to = bar.getBoundingClientRect();
    bar.animate([{ transform: `translate(${from.left - to.left}px, ${from.top - to.top}px)` }, { transform: "none" }], { duration: 320, easing: "cubic-bezier(0.16, 1, 0.3, 1)" });
  }

  const drag = {
    onPointerDown(e: PointerEvent<HTMLElement>) {
      if (e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      dragStart.current = { x: e.clientX, y: e.clientY, moving: false };
    },
    onPointerMove(e: PointerEvent<HTMLElement>) {
      const start = dragStart.current;
      const bar = barRef.current;
      if (!start || !bar) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!start.moving && Math.hypot(dx, dy) < 6) return;
      start.moving = true;
      bar.style.transform = `translate(${dx}px, ${dy}px)`;
    },
    onPointerUp() {
      const start = dragStart.current;
      const bar = barRef.current;
      dragStart.current = null;
      if (!start?.moving || !bar) return;
      dragged.current = true;
      const from = bar.getBoundingClientRect();
      bar.style.transform = "";
      const vertical = from.top + from.height / 2 < window.innerHeight / 2 ? "top" : "bottom";
      const horizontal = from.left + from.width / 2 < window.innerWidth / 2 ? "left" : "right";
      settle(`${vertical}-${horizontal}`, from);
    },
    onPointerCancel() {
      dragStart.current = null;
      if (barRef.current) barRef.current.style.transform = "";
    },
  };

  return (
    <>
      <div
        ref={barRef}
        id="admin-bar"
        data-corner={corner}
        className={cn(
          "fixed z-[70] flex max-w-[calc(100vw-2rem)] gap-2 print:hidden",
          // --redigeringslist är listens höjd längst ner när den syns, så att bubblan står ovanför den.
          top ? "top-[calc(var(--header-h)+0.75rem)] flex-col-reverse" : "bottom-[calc(max(1rem,env(safe-area-inset-bottom))+var(--redigeringslist,0px))] flex-col",
          // --sidebar-w är sidomenyns bredd på datorn och 0 annars, så att bubblan inte lägger sig över menyn.
          left ? "left-[calc(var(--sidebar-w)+1rem)] items-start" : "right-4 items-end",
        )}
      >
        {flash && (
          <p role="status" className="flex items-center gap-2 rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-lg [animation:fade-up_.4s_var(--ease-out-expo)_both]">
            <Check size={16} /> {flash}
          </p>
        )}
        <button
          ref={roundRef}
          type="button"
          aria-label="Öppna redigeringsbubblan"
          title="Öppna redigeringsbubblan. Dra för att flytta."
          aria-expanded={false}
          {...drag}
          onClick={() => {
            if (dragged.current) {
              dragged.current = false;
              return;
            }
            flushSync(() => bubbleStore.setCollapsed(false));
            foldRef.current?.focus();
          }}
          className={cn(
            "relative size-11 touch-none place-items-center rounded-full bg-ink text-white shadow-[0_20px_50px_-15px_rgb(0_0_0/0.6)] ring-1 ring-white/20",
            mode === true ? "grid" : mode === null ? "grid md:hidden" : "hidden",
          )}
        >
          <Edit size={17} />
          {editing && <span aria-hidden className="absolute right-0.5 top-0.5 size-2.5 rounded-full bg-red ring-2 ring-ink" />}
        </button>
        <div
          title={`Inloggad som ${user.post || user.name}`}
          className={cn(
            "items-center gap-0.5 rounded-full bg-ink p-1 text-white shadow-[0_20px_50px_-15px_rgb(0_0_0/0.6)] ring-1 ring-white/20",
            mode === false ? "flex" : mode === null ? "hidden md:flex" : "hidden",
          )}
        >
          <Tip label="Dra för att flytta" below={top} left={left}>
            <button
              type="button"
              aria-label={`Flytta bubblan. Den ligger ${CORNERS[corner]}. Använd piltangenterna.`}
              {...drag}
              onKeyDown={(e) => {
                const next = cornerAfterKey(corner, e.key);
                if (e.key.startsWith("Arrow")) e.preventDefault();
                if (next && barRef.current) settle(next, barRef.current.getBoundingClientRect());
              }}
              className="grid h-9 w-7 cursor-grab touch-none place-items-center rounded-full text-white/70 hover:text-white active:cursor-grabbing"
            >
              <Grip size={16} />
            </button>
          </Tip>
          <span className="kicker flex w-[6.4rem] items-center gap-2 pl-1 text-xs max-[22.5rem]:hidden" aria-hidden>
            <span className={cn("size-2 shrink-0 rounded-full", editing ? "bg-red" : "bg-white/30")} />
            {editing ? "Redigerar" : "Redigera"}
          </span>
          <button type="button" role="switch" aria-checked={editing} aria-label="Redigeringsläge" onClick={() => editStore.setEditing(!editing)} className="relative grid h-9 w-11 place-items-center rounded-full after:absolute after:-inset-y-1 after:inset-x-0">
            <span className={cn("relative block h-5 w-9 rounded-full ring-1 transition-colors", editing ? "bg-red ring-red" : "bg-white/15 ring-white/30")} aria-hidden>
              <span className={cn("absolute top-0.5 size-4 rounded-full bg-white transition-[left]", editing ? "left-[1.125rem]" : "left-0.5")} />
            </span>
          </button>
          <span aria-hidden className="mx-1 h-5 w-px bg-white/20" />
          <Tip label="Hjälp" below={top} left={left}>
            <button ref={helpRef} type="button" aria-label="Hjälp: visa guiden" onClick={() => bubbleStore.openGuide()} className={ICON_BUTTON}>
              <span aria-hidden className="font-mono text-[0.95rem] font-semibold">
                ?
              </span>
            </button>
          </Tip>
          <Tip label="Adminpanelen" below={top} left={left}>
            <Link href="/admin" aria-label="Adminpanel" className={ICON_BUTTON}>
              <Settings size={17} />
            </Link>
          </Tip>
          <Tip label="Logga ut" below={top} left={left}>
            <LogoutForm>
              <button type="submit" aria-label="Logga ut" className={ICON_BUTTON}>
                <Logout size={17} />
              </button>
            </LogoutForm>
          </Tip>
          <Tip label="Fäll ihop" below={top} left={left}>
            <button
              ref={foldRef}
              type="button"
              aria-label="Fäll ihop bubblan"
              aria-expanded
              onClick={() => {
                flushSync(() => bubbleStore.setCollapsed(true));
                roundRef.current?.focus();
              }}
              className={ICON_BUTTON}
            >
              <ChevronDown size={17} className={top ? "rotate-180" : undefined} />
            </button>
          </Tip>
        </div>
      </div>
      <Redigeringslist />
      <EditDrawer />
      <EditGuide user={user} helpRef={helpRef} />
    </>
  );
}

const ICON_BUTTON = "relative grid size-9 place-items-center rounded-full text-white/80 transition-colors after:absolute after:-inset-y-1 after:inset-x-0 hover:bg-white/10 hover:text-white";

/** Verktygstipset syns vid hover och tangentbordsfokus. Knapparna har sina namn själva, så skärmläsaren får inte höra det två gånger. */
function Tip({ label, below, left, children }: { label: string; below: boolean; left: boolean; children: ReactNode }) {
  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute whitespace-nowrap rounded-md bg-ink px-2 py-1 font-mono text-xs text-white opacity-0 ring-1 ring-white/20 transition-opacity group-hover/tip:opacity-100 group-has-[:focus-visible]/tip:opacity-100",
          below ? "top-full mt-2" : "bottom-full mb-2",
          left ? "left-0" : "right-0",
        )}
      >
        {label}
      </span>
    </span>
  );
}

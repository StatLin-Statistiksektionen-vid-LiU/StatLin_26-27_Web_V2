"use client";

import { useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { textRegel } from "@/lib/innehall/regler";
import { cn } from "@/lib/utils";

/**
 * En text som ändras där den står. I redigeringsläget har den en streckad ram; ett klick gör den skrivbar med
 * markören där man klickade. Rubriker visar *ord* med stjärnor medan man skriver. Enter (eller Ctrl+Enter i texter med
 * flera rader) och ett klick utanför lägger ändringen i utkastet, Escape ångrar. Inget sparas förrän man trycker Spara.
 */
export default function TextRedigerare({
  text,
  vy,
  onCommit,
  regel,
  etikett,
  max,
  kravs,
  rader,
  className,
}: {
  text: string;
  vy: ReactNode;
  onCommit: (text: string) => void;
  /** Inställningens nyckel: gränsen och namnet hämtas därifrån. */
  regel?: string;
  etikett?: string;
  max?: number;
  kravs?: boolean;
  rader?: boolean;
  className?: string;
}) {
  const r = regel ? textRegel(regel) : null;
  const grans = max ?? r?.max ?? 500;
  const namn = etikett ?? r?.etikett ?? "Texten";
  const maste = kravs ?? r?.kravs ?? false;
  const [skriver, setSkriver] = useState(false);
  const [langd, setLangd] = useState(text.length);
  const [fel, setFel] = useState<string | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const klick = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!skriver || !el) return;
    el.textContent = text;
    setLangd(text.length);
    el.focus();
    placeraMarkor(el, text, klick.current);
    // Bara när skrivandet börjar: texten får inte bytas ut under fingrarna.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skriver]);

  function borja(e: MouseEvent<HTMLElement>) {
    // Texten kan stå i en länk eller en knapp. Klicket ska bara börja skrivandet.
    e.preventDefault();
    e.stopPropagation();
    klick.current = synligPosition(e.currentTarget, e.clientX, e.clientY);
    setFel(null);
    setSkriver(true);
  }

  function klar(behall: boolean) {
    const el = ref.current;
    if (!el || !skriver) return;
    if (behall) {
      let ny = (el.innerText ?? el.textContent ?? "").replace(/\r\n?/g, "\n").replace(/ /g, " ");
      ny = rader ? ny.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n") : ny.replace(/\s*\n\s*/g, " ");
      ny = ny.trim().slice(0, grans);
      if (maste && !ny) {
        setFel("En tom text går inte att spara. Den förra står kvar.");
      } else if (ny !== text) {
        onCommit(ny);
      }
    }
    setSkriver(false);
  }

  function tangent(e: KeyboardEvent<HTMLSpanElement>) {
    e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      klar(false);
    } else if (e.key === "Enter" && (!rader || e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      klar(true);
    }
  }

  if (!skriver) {
    return (
      <span
        role="button"
        tabIndex={0}
        title={`${namn}: klicka för att ändra`}
        aria-label={`Ändra ${namn.charAt(0).toLowerCase()}${namn.slice(1)}`}
        onClickCapture={(e) => e.preventDefault()}
        onClick={borja}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          e.stopPropagation();
          klick.current = null;
          setSkriver(true);
        }}
        className={cn("redigerbar", className)}
      >
        {text ? vy : <span className="redigerbar-tom">{namn}</span>}
        {fel && (
          <span role="alert" className="redigerbar-tips redigerbar-tips-fel">
            {fel}
          </span>
        )}
      </span>
    );
  }

  return (
    <span className="relative">
      <span
        ref={ref}
        contentEditable="plaintext-only"
        suppressContentEditableWarning
        role="textbox"
        aria-multiline={rader || undefined}
        aria-label={namn}
        spellCheck
        onClickCapture={(e) => e.preventDefault()}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={tangent}
        onBlur={() => klar(true)}
        onInput={(e) => setLangd((e.currentTarget.innerText ?? "").replace(/\n$/, "").length)}
        onBeforeInput={(e) => {
          const el = e.currentTarget;
          const valt = window.getSelection()?.toString().length ?? 0;
          const data = (e as unknown as InputEvent).data ?? "";
          if (data && (el.innerText ?? "").replace(/\n$/, "").length - valt + data.length > grans) e.preventDefault();
        }}
        onPaste={(e) => {
          e.preventDefault();
          const el = e.currentTarget;
          const valt = window.getSelection()?.toString().length ?? 0;
          const plats = grans - ((el.innerText ?? "").replace(/\n$/, "").length - valt);
          let inklistrat = e.clipboardData.getData("text/plain").replace(/\r\n?/g, "\n");
          if (!rader) inklistrat = inklistrat.replace(/\s*\n\s*/g, " ");
          if (plats > 0) document.execCommand("insertText", false, inklistrat.slice(0, plats));
        }}
        className={cn("redigerbar redigerbar-pa whitespace-pre-wrap", className)}
      />
      <span aria-hidden className={cn("redigerbar-tips", langd >= grans && "redigerbar-tips-fel")}>
        {rader ? "Ctrl+Enter klar" : "Enter klar"} · Esc ångrar{regel || rader ? " · *ord* blir röda · _ord_ för hand, _*ord*_ i rött" : ""} · {langd}/{grans}
      </span>
    </span>
  );
}

/** Hur många synliga tecken som står före punkten man klickade på. Radbrytningar räknas inte. */
function synligPosition(el: HTMLElement, x: number, y: number): number | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  let nod: Node | null = null;
  let offset = 0;
  const pos = doc.caretPositionFromPoint?.(x, y);
  if (pos) {
    nod = pos.offsetNode;
    offset = pos.offset;
  } else {
    const range = doc.caretRangeFromPoint?.(x, y);
    if (range) {
      nod = range.startContainer;
      offset = range.startOffset;
    }
  }
  if (!nod || !el.contains(nod)) return null;
  const fore = document.createRange();
  fore.selectNodeContents(el);
  fore.setEnd(nod, offset);
  return fore.toString().length;
}

/** Sätter markören på samma synliga tecken i råtexten, där *stjärnorna*, _understrecken_ och radbrytningarna syns. Utan klickpunkt: sist. */
function placeraMarkor(el: HTMLElement, text: string, synlig: number | null) {
  const nod = el.firstChild;
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  if (!nod || synlig === null) {
    range.selectNodeContents(el);
    range.collapse(false);
  } else {
    let raknat = 0;
    let i = 0;
    for (; i < text.length && raknat < synlig; i++) if (text[i] !== "*" && text[i] !== "_" && text[i] !== "\n") raknat++;
    range.setStart(nod, Math.min(i, nod.textContent?.length ?? 0));
    range.collapse(true);
  }
  sel.removeAllRanges();
  sel.addRange(range);
}

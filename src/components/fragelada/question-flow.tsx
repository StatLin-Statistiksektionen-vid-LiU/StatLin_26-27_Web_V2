"use client";

import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { openBoxByCode, sendQuestion } from "@/app/(site)/fragelada/actions";
import { ArrowRight } from "@/components/icons";
import { CODE_LENGTH, normalizeCode, QUESTION_MAX, type OpenBoxState, type PublicBox, type SendState } from "@/lib/fragelada";
import { cn } from "@/lib/utils";
import "./fragelada.css";

/** Hela besökarens väg: koden, lappen och kvittot, en sak i taget. */
export function QuestionFlow({
  initialBox,
  initialCode = "",
  initialError,
  fixedBoxes = [],
}: {
  initialBox?: PublicBox | null;
  initialCode?: string;
  initialError?: string;
  fixedBoxes?: PublicBox[];
}) {
  const [box, setBox] = useState<PublicBox | null>(initialBox ?? null);
  const [sent, setSent] = useState(false);
  // Kom man hit med en färdig låda (länk eller fast låda) ska tangentbordet inte fällas upp av sig självt.
  const [focusNote, setFocusNote] = useState(false);
  const fixed = !!box?.slug;

  if (!box) {
    return (
      <CodeLock
        initialCode={initialCode}
        initialError={initialError}
        fixedBoxes={fixedBoxes}
        onOpened={(b) => {
          setFocusNote(true);
          setBox(b);
        }}
      />
    );
  }
  if (sent) {
    return (
      <Receipt
        onAnother={() => {
          setFocusNote(true);
          setSent(false);
        }}
      />
    );
  }
  return (
    <Note
      box={box}
      autoFocus={focusNote}
      onSent={() => setSent(true)}
      onChangeCode={
        fixed
          ? undefined
          : () => {
              setBox(null);
              setFocusNote(false);
            }
      }
    />
  );
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function CodeLock({
  initialCode,
  initialError,
  fixedBoxes,
  onOpened,
}: {
  initialCode: string;
  initialError?: string;
  fixedBoxes: PublicBox[];
  onOpened: (box: PublicBox) => void;
}) {
  const [code, setCode] = useState(initialCode);
  const [dismissed, setDismissed] = useState<OpenBoxState | null>(null);
  const [state, formAction, pending] = useActionState(async (prev: OpenBoxState, fd: FormData): Promise<OpenBoxState> => {
    try {
      return await openBoxByCode(prev, fd);
    } catch (err) {
      unstable_rethrow(err);
      return { error: "Det gick inte att nå servern. Försök igen." };
    }
  }, initialError ? { error: initialError } : {});
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const error = state !== dismissed ? state.error : undefined;
  const opened = !!state.box;

  // Bygeln lyfter och rutorna tänds innan lappen tar över.
  useEffect(() => {
    if (!state.box) return;
    const box = state.box;
    const timer = setTimeout(() => onOpened(box), reducedMotion() ? 0 : 620);
    return () => clearTimeout(timer);
    // onOpened byts vid varje rendering av föräldern, svaret är det som styr.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.box]);

  // Fel kod: låset rycker till, och nästa tecken börjar om från början. Fältet behåller fokus.
  useEffect(() => {
    if (!state.error) return;
    if (document.activeElement === inputRef.current) inputRef.current?.select();
    if (reducedMotion()) return;
    bodyRef.current?.animate([{ transform: "none" }, { transform: "translateX(-5px)", offset: 0.25 }, { transform: "translateX(4px)", offset: 0.6 }, { transform: "none" }], { duration: 320, easing: "ease-out" });
  }, [state]);

  const change = (raw: string) => {
    const next = normalizeCode(raw);
    if (next !== code) setDismissed(state);
    setCode(next);
    // Sista tecknet öppnar direkt, knappen finns för den som vill ändra sig och för skärmläsare.
    if (next.length === CODE_LENGTH && next !== code && !pending) {
      setTimeout(() => formRef.current?.requestSubmit(), 0);
    }
  };

  return (
    <div>
      <h2 className="text-[clamp(1.5rem,4vw,2.1rem)] font-extrabold leading-tight tracking-tight [font-stretch:110%]">Skriv koden du har fått</h2>
      <p className="mt-2 text-stone">Du får koden i ett mejl från oss eller av din lärare. Den har sex tecken och innehåller aldrig O, 0, I, L eller 1.</p>

      <form ref={formRef} action={formAction} noValidate>
        <div className={cn("fl-lock", opened && "fl-opened")}>
          <div className="fl-shackle" aria-hidden />
          <div ref={bodyRef} className="fl-lock-body">
          <div className="fl-cells-wrap" onClick={() => inputRef.current?.focus()}>
            <div className="fl-cells" aria-hidden>
              {Array.from({ length: CODE_LENGTH }, (_, i) => (
                <div key={i} className={cn("fl-cell", i === code.length && "fl-current")} style={{ "--i": i } as React.CSSProperties}>
                  {code[i] && (
                    <span key={code[i]} className="fl-char">
                      {code[i]}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <input
              ref={inputRef}
              name="kod"
              value={code}
              onChange={(e) => change(e.target.value)}
              aria-label="Kod, sex tecken"
              aria-describedby={error ? "kod-fel" : undefined}
              aria-invalid={error ? true : undefined}
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              className="fl-input"
              disabled={opened}
            />
          </div>
          </div>
        </div>

        <div aria-live="polite" className="min-h-6">
          {error && (
            <p id="kod-fel" role="alert" className="mt-4 max-w-[27rem] rounded-xl border border-line bg-white px-4 py-3 text-[0.95rem] font-semibold">
              {error}
            </p>
          )}
          {opened && <p className="sr-only">Koden stämmer.</p>}
        </div>

        <button type="submit" disabled={pending || opened} className="btn btn-ink mt-3 w-full max-w-[27rem] disabled:opacity-60 sm:w-auto">
          {pending ? "Öppnar…" : "Öppna lådan"} <ArrowRight size={18} />
        </button>
      </form>

      <div className="mt-10 max-w-[27rem] border-t border-line pt-6">
        <p className="font-bold">Ingen kod?</p>
        <p className="mt-1 text-[0.95rem] text-stone">
          Titta i mejlet från den som ordnar, eller fråga din lärare.{fixedBoxes.length > 0 ? " De här lådorna är alltid öppna och behöver ingen kod." : ""}
        </p>
        {fixedBoxes.length > 0 && (
          <ul className="mt-3 space-y-2">
            {fixedBoxes.map((b) => (
              <li key={b.slug}>
                <Link href={`/fragelada/${b.slug}`} className="group flex items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3 font-semibold transition-colors hover:border-ink/25">
                  {b.title}
                  <ArrowRight size={16} className="shrink-0 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Note({ box, autoFocus, onSent, onChangeCode }: { box: PublicBox; autoFocus: boolean; onSent: () => void; onChangeCode?: () => void }) {
  // Styrd textruta: React tömmer inte texten när svaret är ett fel, och heller inte om servern inte går att nå.
  const [text, setText] = useState("");
  const [state, formAction, pending] = useActionState(async (prev: SendState, fd: FormData): Promise<SendState> => {
    try {
      return await sendQuestion(prev, fd);
    } catch (err) {
      unstable_rethrow(err);
      return { error: "Det gick inte att nå servern. Din text står kvar, försök igen." };
    }
  }, {});
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus) areaRef.current?.focus();
    // Bara när lappen kommer fram.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state.ok) onSent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <div className="fl-rise">
      <p className="kicker text-stone">Du skriver till</p>
      <h2 className="mt-2 text-[clamp(1.5rem,4vw,2.1rem)] font-extrabold leading-tight tracking-tight [font-stretch:110%] break-words">{box.title}</h2>
      {box.description && <p className="mt-2 max-w-prose text-stone break-words">{box.description}</p>}

      <form action={formAction} className="mt-6">
        {box.slug ? <input type="hidden" name="slug" value={box.slug} /> : <input type="hidden" name="kod" value={box.code ?? ""} />}
        {/* Honungsfällan: ligger utanför skärmen, utom räckhåll för tangentbord och skärmläsare. */}
        <div className="absolute -left-[9999px] size-px overflow-hidden" aria-hidden>
          <label>
            Webbplats
            <input type="text" name="webbplats" tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        <div className="fl-sheet-wrap">
          <div className="fl-sheet">
            <label htmlFor="fraga" className="sr-only">
              Din fråga
            </label>
            <textarea
              ref={areaRef}
              id="fraga"
              name="body"
              value={text}
              maxLength={QUESTION_MAX}
              onChange={(e) => setText(e.target.value)}
              aria-describedby="fraga-antal"
              placeholder="Skriv din fråga här."
              className="fl-writing"
            />
          </div>
          <div className="fl-corner" aria-hidden />
        </div>

        {state.error && (
          <p role="alert" className="mt-4 rounded-xl border border-line bg-white px-4 py-3 text-[0.95rem] font-semibold">
            {state.error}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p id="fraga-antal" className={cn("font-mono text-sm tabular text-stone", text.length >= QUESTION_MAX - 100 && "font-bold text-ink")}>
            {text.length} av {QUESTION_MAX} tecken
          </p>
          <button type="submit" disabled={pending} className="btn btn-ink w-full disabled:opacity-60 sm:w-auto">
            {pending ? "Skickar…" : "Skicka frågan"} <ArrowRight size={18} />
          </button>
        </div>
        <p className="mt-4 text-center text-[0.9rem] text-stone">Du får inget svar här, eftersom ingen vet vem du är.</p>
      </form>

      {onChangeCode && (
        <button type="button" onClick={onChangeCode} className="tryck link-underline mt-5 text-sm font-semibold text-stone hover:text-ink">
          Fel låda? Skriv en annan kod
        </button>
      )}
    </div>
  );
}

function Receipt({ onAnother }: { onAnother: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div>
      <div className="fl-scene" aria-hidden>
        <div className="fl-clip">
          <div className="fl-paper">
            <div className="fl-flap" />
          </div>
        </div>
        <div className="fl-slot-front" />
      </div>
      <div className="fl-receipt mt-6 max-w-[27rem]">
        <h2 ref={headingRef} tabIndex={-1} className="text-[clamp(1.5rem,4vw,2.1rem)] font-extrabold leading-tight tracking-tight outline-none [font-stretch:110%]">
          Frågan ligger i lådan.
        </h2>
        <p className="mt-2 text-stone">Den som har lådan kan läsa den, men inte se vem som skrev. Du får inget svar här.</p>
        <button type="button" onClick={onAnother} className="btn btn-ink mt-6 w-full sm:w-auto">
          Skicka en till
        </button>
      </div>
    </div>
  );
}

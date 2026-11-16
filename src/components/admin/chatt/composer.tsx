import { useId, useRef, useState } from "react";
import { CHAT_BODY_MAX, type ChatChannel } from "@/lib/chatt";

/** Med mus och tangentbord skickar Enter. På en pekskärm gör Enter en ny rad, som i telefonens egna appar, och knappen skickar. */
const KEYBOARD = "(hover: hover) and (pointer: fine)";
/** Räknaren visas först när det börjar bli ont om plats. */
const COUNTER_FROM = CHAT_BODY_MAX - 200;

/** Rutan man skriver i. Den växer med texten upp till några rader, och utkastet står kvar när man byter sida och kommer tillbaka. */
export function Composer({ channel, onSend }: { channel: ChatChannel; onSend: (body: string) => void }) {
  const [text, setText] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);
  // Next behåller sidor man nyss lämnat, gömda i dokumentet. Ett fast id kunde då stå två gånger, en gång per kanal.
  const fieldId = useId();
  const body = text.trim();

  /** Höjden följer innehållet. Kanten räknas inte in i scrollHeight, så den läggs till. */
  const fit = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
  };

  const submit = () => {
    if (!body) return;
    onSend(body);
    setText("");
    if (field.current) field.current.style.height = "";
  };

  return (
    <form
      className="border-t border-ink/10 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
        field.current?.focus();
      }}
    >
      <div className="flex items-end gap-2">
        <label htmlFor={fieldId} className="sr-only">
          Meddelande till {channel.name}
        </label>
        <textarea
          ref={field}
          id={fieldId}
          rows={1}
          value={text}
          maxLength={CHAT_BODY_MAX}
          placeholder={`Skriv till ${channel.name}`}
          onChange={(e) => {
            setText(e.target.value);
            fit(e.target);
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing || !window.matchMedia(KEYBOARD).matches) return;
            e.preventDefault();
            submit();
          }}
          className="block max-h-40 min-h-11 min-w-0 flex-1 resize-none rounded-xl border border-ink/15 bg-white px-3.5 py-2.5 text-[0.95rem] leading-snug text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink/35 focus:border-ink focus:ring-4 focus:ring-ink/[0.06] pointer-coarse:text-[16px]"
        />
        <button type="submit" disabled={!body} className="btn btn-red h-11 disabled:opacity-50">
          Skicka
        </button>
      </div>
      {text.length >= COUNTER_FROM && (
        <p className="tabular mt-1.5 font-mono text-[0.7rem] text-stone">
          {text.length} av {CHAT_BODY_MAX} tecken
        </p>
      )}
    </form>
  );
}

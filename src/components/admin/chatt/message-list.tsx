import { Fragment } from "react";
import { Trash } from "@/components/icons";
import { dayLabel, splitLinks, type ChatMessage, type MessageDay, type MessageGroup } from "@/lib/chatt";
import { formatTimestamp, isoToLocal } from "@/lib/dates";
import { egenFarg } from "@/lib/karaktar";
import { cn, initials } from "@/lib/utils";

/** Ett meddelande som är på väg till servern. Det visas direkt, med ett negativt id tills det har sparats. */
export type Outgoing = { key: number; body: string; created_at: string; error?: string };

export const outgoingId = (item: Outgoing) => -item.key;

type RowActions = {
  /** Meddelanden som går att ta bort: de egna, eller alla för en administratör. */
  canDelete: (message: ChatMessage) => boolean;
  onDelete: (message: ChatMessage) => void;
  outgoing: Map<number, Outgoing>;
  onRetry: (item: Outgoing) => void;
  onDiscard: (item: Outgoing) => void;
};

/** Meddelandena dag för dag. Strecket Nya meddelanden står före gruppen som börjar med det första olästa. */
export function MessageList({ days, today, ...actions }: { days: MessageDay[]; today: string } & RowActions) {
  return days.map((day) => (
    <section key={day.day}>
      <div className="flex items-center gap-3 px-4 pb-2 pt-4">
        <span className="h-px flex-1 bg-ink/10" aria-hidden />
        <h3 className="kicker text-[0.62rem] text-stone">
          {dayLabel(day.day, today)}
        </h3>
        <span className="h-px flex-1 bg-ink/10" aria-hidden />
      </div>
      {day.groups.map((group) => (
        <Fragment key={group.messages[0].id}>
          {group.startsUnread && (
            <p data-unread className="flex items-center gap-3 px-4 py-1.5 font-mono text-[0.62rem] font-medium uppercase tracking-[0.14em] text-red-deep">
              <span className="h-px flex-1 bg-red/40" aria-hidden />
              Nya meddelanden
              <span className="h-px flex-1 bg-red/40" aria-hidden />
            </p>
          )}
          <Group group={group} {...actions} />
        </Fragment>
      ))}
    </section>
  ));
}

/**
 * Det ett konto skrivit i följd, under ett namn. Klassen egen-farg med avsändarens färg i --egen gör att egen-yta och egen-text
 * här inne får avsändarens färg i stället för den inloggades, med samma blandning mot bläcket som i resten av portalen.
 */
function Group({ group, ...actions }: { group: MessageGroup } & RowActions) {
  const { author } = group;
  const first = group.messages[0];
  return (
    <article className="egen-farg flex gap-3 px-4 py-1.5" style={author ? egenFarg(author.color) : undefined}>
      {author ? (
        <span className="egen-yta mt-0.5 grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold" aria-hidden>
          {initials(author.name)}
        </span>
      ) : (
        <span className="mt-0.5 size-8 shrink-0 rounded-full bg-ink/10" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          {author ? <span className="font-semibold">{author.name}</span> : <span className="font-semibold text-stone">Borttaget konto</span>}
          {author?.post && <span className="egen-text text-[0.8rem] font-medium">{author.post}</span>}
          <time dateTime={first.created_at} title={formatTimestamp(first.created_at)} className="font-mono text-[0.7rem] text-stone">
            {isoToLocal(first.created_at).slice(11, 16)}
          </time>
        </p>
        {group.messages.map((message) => (
          <Row key={message.id} message={message} {...actions} />
        ))}
      </div>
    </article>
  );
}

function Row({ message, canDelete, onDelete, outgoing, onRetry, onDiscard }: { message: ChatMessage } & RowActions) {
  const sending = outgoing.get(message.id);
  if (message.deleted) return <p className="py-0.5 text-sm italic text-stone">Meddelandet togs bort</p>;
  return (
    <div className="group relative -mx-2 flex items-start gap-1 rounded-md px-2 py-0.5 hover:bg-ink/[0.035]">
      <div className="min-w-0 flex-1">
        {/* Texten visas som text, med radbrytningarna kvar. Bara webbadresser blir länkar. */}
        <p className={cn("whitespace-pre-wrap text-[0.95rem] leading-relaxed [overflow-wrap:anywhere]", sending && !sending.error && "text-ink/55")}>
          {splitLinks(message.body).map((part, i) =>
            part.href ? (
              <a key={i} href={part.href} target="_blank" rel="noopener noreferrer" className="underline decoration-ink/35 underline-offset-[3px] hover:decoration-ink">
                {part.text}
              </a>
            ) : (
              <Fragment key={i}>{part.text}</Fragment>
            ),
          )}
        </p>
        {sending?.error && (
          <p role="alert" className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm font-medium text-red-deep">
            <span>Inte skickat. {sending.error}</span>
            <button type="button" onClick={() => onRetry(sending)} className="tryck font-semibold text-ink underline underline-offset-[3px]">
              Försök igen
            </button>
            <button type="button" onClick={() => onDiscard(sending)} className="tryck text-stone underline underline-offset-[3px] hover:text-ink">
              Ta bort
            </button>
          </p>
        )}
      </div>
      {canDelete(message) && (
        <button
          type="button"
          onClick={() => onDelete(message)}
          aria-label="Ta bort meddelandet"
          title="Ta bort"
          className="grid size-7 shrink-0 place-items-center rounded-md text-stone opacity-0 transition-opacity hover:bg-ink/[0.07] hover:text-red-deep focus-visible:opacity-100 group-hover:opacity-100 pointer-coarse:size-9 pointer-coarse:opacity-70"
        >
          <Trash size={14} />
        </button>
      )}
    </div>
  );
}

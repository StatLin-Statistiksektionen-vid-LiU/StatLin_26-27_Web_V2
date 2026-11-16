"use client";

import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { deleteChatMessage, markChatRead, sendChatMessage } from "@/app/admin/_actions/chatt";
import { useConfirm } from "@/components/admin/confirm-dialog";
import { ArrowLeft, ChevronDown } from "@/components/icons";
import {
  firstUnreadId,
  groupMessages,
  markDeleted,
  mergeMessages,
  previewTime,
  type ChatAuthor,
  type ChatChannel,
  type ChatChannelSummary,
  type ChatMessage,
  type ChatPage,
  type ChatPoll,
  planIdOf,
} from "@/lib/chatt";
import { todayLocal } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Composer } from "./composer";
import { MessageList, outgoingId, type Outgoing } from "./message-list";
import { totalUnread, useReportUnread } from "./unread";

/** Så ofta en öppen chatt frågar efter nytt. Går frågan inte fram dubblas väntan för varje försök, upp till en minut. */
const POLL_MS = 4000;
const MAX_POLL_MS = 60_000;
/** Så nära botten räknas som att man läser det senaste. */
const BOTTOM_SLACK = 48;

/** Samma märke som siffrorna i sidomenyn. */
const UNREAD_PILL = "tabular grid min-w-5 shrink-0 place-items-center rounded-full bg-red px-1.5 text-[0.7rem] font-bold leading-5 text-white";

/** Det som står över rutan när sidan inte får några svar. */
const CONNECTION_TEXT = {
  lost: "Ingen kontakt med servern just nu. Nya meddelanden visas när anslutningen är tillbaka.",
  loggedOut: "Du har loggats ut. Ladda om sidan och logga in igen.",
  noAccess: "Du är inte längre med i den här tråden. Ladda om sidan.",
};

const sameChannels = (a: ChatChannelSummary[], b: ChatChannelSummary[]) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Listan är vänd (flex-col-reverse), så att den börjar längst ner och står kvar där när något läggs till: scrollTop är 0 längst ner
 * och negativ uppåt. En gömd lista har ingen höjd och läses inte av någon.
 */
const isAtBottom = (el: HTMLElement | null) => !!el && el.clientHeight > 0 && Math.abs(el.scrollTop) < BOTTOM_SLACK;

/**
 * Chatten: listan med planernas trådar och den öppna tråden (i koden heter en tråd kanal). På en dator står de bredvid varandra. På
 * en telefon visas listan först, och tråden är en egen vy när den står i adressen (chosen). Utan vald tråd ligger den förvalda bakom
 * listan på telefonen.
 *
 * Sidan renderas med de senaste meddelandena och frågar sedan servern efter nytt så länge fliken syns. Komponenten har kanalen som
 * nyckel, så allt tillstånd här hör till en kanal.
 */
export function ChatView({
  me,
  admin,
  channels: renderedChannels,
  open,
  chosen,
  embedded = false,
  messages: renderedMessages,
  hasOlder: renderedHasOlder,
  lastReadId,
  loadedAt,
}: {
  me: ChatAuthor;
  admin: boolean;
  channels: ChatChannelSummary[];
  open: ChatChannel;
  chosen: boolean;
  /** Tråden står inne på en annan sida, som en projektplan: ingen kanallista, och en fast höjd i stället för hela fönstret. */
  embedded?: boolean;
  messages: ChatMessage[];
  hasOlder: boolean;
  /** Hur långt kontot hade läst när sidan renderades. Det som kommit efter det är nytt. */
  lastReadId: number;
  /** Serverns klocka när meddelandena lästes: därifrån räknas vad som tagits bort sedan dess. */
  loadedAt: string;
}) {
  const [channels, setChannels] = useState(renderedChannels);
  const [messages, setMessages] = useState(renderedMessages);
  const [hasOlder, setHasOlder] = useState(renderedHasOlder);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [outbox, setOutbox] = useState<Outgoing[]>([]);
  const [unreadFrom, setUnreadFrom] = useState(() => firstUnreadId(renderedMessages, lastReadId, me.id));
  /** Kanalen syns och står längst ner: då är det som kommer in läst. */
  const [reading, setReading] = useState(false);
  const [newBelow, setNewBelow] = useState(false);
  const [connection, setConnection] = useState<keyof typeof CONNECTION_TEXT | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [confirm, confirmDialog] = useConfirm();

  const scroller = useRef<HTMLDivElement>(null);
  const cursor = useRef({ after: renderedMessages.at(-1)?.id ?? 0, since: loadedAt });
  const marked = useRef(lastReadId);
  const nextKey = useRef(1);

  // Next behåller sidor man nyss lämnat, gömda i dokumentet. Ett fast id kunde då stå två gånger, en gång per kanal.
  const headingId = useId();

  // Inne på en annan sida kan tråden stå utanför fönstret, längre ner på planen. Då läser ingen den, och det som kommer in ska
  // vara oläst (och stå i klockan) tills man har scrollat ner till den. I chatten fyller tråden fönstret och syns alltid.
  const bottomEdge = useRef<HTMLDivElement>(null);
  const inView = useRef(!embedded);

  const sync = useCallback(() => {
    const atBottom = isAtBottom(scroller.current) && inView.current;
    setReading(atBottom);
    if (atBottom) setNewBelow(false);
  }, []);

  useEffect(() => {
    const edge = bottomEdge.current;
    if (!edge) return;
    const observer = new IntersectionObserver(([entry]) => {
      inView.current = entry.isIntersecting;
      sync();
    });
    observer.observe(edge);
    return () => observer.disconnect();
  }, [sync]);

  // Första gången kanalen syns börjar man vid strecket Nya meddelanden, om det olästa inte ryms på skärmen. Oftast är det när
  // sidan visas, men på telefonen ligger den förvalda kanalen gömd bakom listan och har då ingen höjd att mäta.
  const placed = useRef(false);
  const place = useCallback(() => {
    const el = scroller.current;
    if (placed.current || !el || el.clientHeight === 0) return;
    placed.current = true;
    const mark = el.querySelector("[data-unread]");
    const above = mark ? mark.getBoundingClientRect().top - el.getBoundingClientRect().top - 12 : 0;
    if (above < 0) el.scrollTop += above;
  }, []);
  useLayoutEffect(place, [place]);

  // Storleken ändras när fönstret gör det och när vyn visas eller göms (telefonens lista, en sida som Next har gömt).
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      place();
      sync();
    });
    if (scroller.current) observer.observe(scroller.current);
    return () => observer.disconnect();
  }, [place, sync]);

  const pending: ChatMessage[] = outbox.map((item) => ({ id: outgoingId(item), body: item.body, created_at: item.created_at, deleted: false, author: me }));
  const shown = [...messages, ...pending];
  const tailId = shown.at(-1)?.id ?? 0;

  // Den som läser längre upp ska stå kvar där när något kommer in längst ner. Webbläsare utan egen förankring (Safari) flyttar
  // annars texten, och med overflow-anchor avstängt gör alla likadant: höjden som kom till läggs på avståndet till botten.
  const tail = useRef({ id: tailId, height: 0 });
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const grew = el.scrollHeight - tail.current.height;
    if (tail.current.height > 0 && grew > 0 && tailId !== tail.current.id && !isAtBottom(el)) el.scrollTop -= grew;
    tail.current = { id: tailId, height: el.scrollHeight };
  }, [messages, outbox, tailId]);

  // Läsmärket flyttas när det senaste meddelandet syns. Det egna räknas också, så att märket aldrig står före det man själv skrev.
  const newestId = messages.at(-1)?.id ?? 0;
  useEffect(() => {
    if (!reading || newestId <= marked.current) return;
    const previous = marked.current;
    marked.current = newestId;
    markChatRead(open.key, newestId).catch(() => {
      marked.current = previous;
    });
  }, [reading, newestId, open.key]);

  useEffect(() => {
    const controller = new AbortController();
    let timer: number | undefined;
    let busy = false;
    let failures = 0;
    // Det första svaret efter att fliken legat i bakgrunden, eller sidan varit gömd, kan bära flera meddelanden på en gång.
    let away = true;

    const apply = (data: ChatPoll) => {
      const atBottom = isAtBottom(scroller.current) && inView.current;
      const fromOthers = data.messages.filter((m) => m.author?.id !== me.id && !m.deleted);
      if (data.messages.length > 0) {
        cursor.current.after = data.messages[data.messages.length - 1].id;
        setMessages((shown) => mergeMessages(shown, data.messages));
      }
      if (fromOthers.length > 0) {
        const [first] = fromOthers;
        // Strecket står kvar så länge det som följer efter det är oläst. Annars flyttas det till det första nya, om man inte
        // satt och läste när det kom.
        const readTo = marked.current;
        if (!atBottom || away) setUnreadFrom((from) => (from !== null && from > readTo ? from : first.id));
        if (!atBottom) setNewBelow(true);
        setAnnouncement(fromOthers.length === 1 ? `${first.author?.name ?? "Borttaget konto"}: ${first.body}` : `${fromOthers.length} nya meddelanden`);
      }
      if (data.deleted.length > 0) setMessages((shown) => markDeleted(shown, data.deleted));
      cursor.current.since = data.now;
      setChannels((shown) => (sameChannels(shown, data.channels) ? shown : data.channels));
    };

    const run = async () => {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      window.clearTimeout(timer);
      try {
        const { after, since } = cursor.current;
        const res = await fetch(`/api/admin/chatt?kanal=${encodeURIComponent(open.key)}&efter=${after}&sedan=${encodeURIComponent(since)}`, { signal: controller.signal });
        // Utloggad, eller kontot har inte kanalen längre: då finns inget mer att hämta.
        if (res.status === 401) return setConnection("loggedOut");
        if (res.status === 403) return setConnection("noAccess");
        if (!res.ok) throw new Error(`Chatten svarade ${res.status}`);
        const data = (await res.json()) as ChatPoll;
        if (controller.signal.aborted) return;
        apply(data);
        away = false;
        failures = 0;
        setConnection(null);
      } catch {
        if (controller.signal.aborted) return;
        failures++;
        // Ett enstaka tappat svar märks inte. Från det andra i rad står det i sidan.
        if (failures > 1) setConnection("lost");
      } finally {
        busy = false;
      }
      timer = window.setTimeout(run, Math.min(POLL_MS * 2 ** failures, MAX_POLL_MS));
    };

    // En flik som visas igen, eller en telefon som fått tillbaka nätet, frågar direkt i stället för att vänta ut tiden.
    const wake = () => {
      if (document.visibilityState === "visible") void run();
      else away = true;
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    void run();
    return () => {
      controller.abort();
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
    };
  }, [open.key, me.id]);

  // Ett besked om något som inte gick gäller det senaste försöket och ska inte stå kvar på en gömd sida (preserving-ui-state.md).
  useLayoutEffect(() => () => setProblem(null), []);

  // Den öppna kanalen räknas som läst medan man läser den, utan att vänta på att servern har fått läsmärket.
  const listed = reading ? channels.map((c) => (c.key === open.key ? { ...c, unread: 0 } : c)) : channels;
  useReportUnread(totalUnread(listed));

  const toBottom = (smooth: boolean) =>
    scroller.current?.scrollTo({ top: 0, behavior: smooth && !window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "auto" });

  const deliver = async (item: Outgoing) => {
    // Utan nät, eller när servern inte svarar, står det vid meddelandet, som går att skicka igen. Nexts egna fel (en
    // omdirigering) ska fram.
    const result = await sendChatMessage(open.key, item.body).catch((err: unknown) => {
      unstable_rethrow(err);
      return { error: "Det gick inte att nå servern." };
    });
    if ("error" in result) {
      const { error } = result;
      setOutbox((items) => items.map((i) => (i.key === item.key ? { ...i, error } : i)));
    } else {
      const { sent } = result;
      setOutbox((items) => items.filter((i) => i.key !== item.key));
      setMessages((shown) => mergeMessages(shown, [sent]));
    }
  };

  const send = (body: string) => {
    const item: Outgoing = { key: nextKey.current++, body, created_at: new Date().toISOString() };
    setOutbox((items) => [...items, item]);
    // Den som svarar har läst: strecket behövs inte längre.
    setUnreadFrom(null);
    toBottom(false);
    void deliver(item);
  };

  const retry = (item: Outgoing) => {
    const again: Outgoing = { key: item.key, body: item.body, created_at: item.created_at };
    setOutbox((items) => items.map((i) => (i.key === item.key ? again : i)));
    void deliver(again);
  };

  const remove = async (message: ChatMessage) => {
    const excerpt = message.body.length > 80 ? `${message.body.slice(0, 80)}…` : message.body;
    if (!(await confirm(`Ta bort meddelandet "${excerpt}"? Det går inte att ångra.`))) return;
    setProblem(null);
    const result = await deleteChatMessage(message.id).catch((err: unknown) => {
      unstable_rethrow(err);
      return { error: "Det gick inte att nå servern. Meddelandet står kvar, försök igen." };
    });
    if ("error" in result) setProblem(result.error);
    else setMessages((shown) => markDeleted(shown, [message.id]));
  };

  const loadOlder = async () => {
    setLoadingOlder(true);
    setProblem(null);
    try {
      const res = await fetch(`/api/admin/chatt?kanal=${encodeURIComponent(open.key)}&fore=${messages[0].id}`);
      if (!res.ok) throw new Error(`Chatten svarade ${res.status}`);
      const page = (await res.json()) as ChatPage;
      setMessages((shown) => mergeMessages(shown, page.messages));
      setHasOlder(page.hasOlder);
    } catch {
      setProblem("De äldre meddelandena gick inte att hämta. Försök igen.");
    }
    setLoadingOlder(false);
  };

  const today = todayLocal();
  const planId = planIdOf(open.key);
  const unreadElsewhere = totalUnread(listed.filter((c) => c.key !== open.key));

  return (
    <div className={embedded ? "overflow-hidden rounded-[1.5rem] border border-ink/10 bg-white" : "lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:overflow-hidden lg:rounded-[1.5rem] lg:border lg:border-ink/10 lg:bg-white"}>
      <nav aria-label="Trådar" className={embedded ? "hidden" : cn("overflow-hidden rounded-[1.5rem] border border-ink/10 bg-white lg:overflow-y-auto lg:rounded-none lg:border-0 lg:border-r", chosen && "hidden lg:block")}>
        <ul className="divide-y divide-ink/10 lg:space-y-0.5 lg:divide-y-0 lg:p-2">
          {listed.map((c) => {
            const current = c.key === open.key;
            return (
              <li key={c.key}>
                <Link
                  href={`/admin/chatt?kanal=${encodeURIComponent(c.key)}`}
                  aria-current={current && chosen ? "page" : undefined}
                  className={cn("block px-4 py-3 transition-colors lg:rounded-xl lg:px-3 lg:py-2.5", current ? (chosen ? "bg-ink/[0.06]" : "lg:bg-ink/[0.06]") : "hover:bg-ink/[0.04]")}
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className={cn("truncate text-[0.95rem]", c.unread > 0 ? "font-bold" : "font-semibold")}>{c.name}</span>
                    {c.last && <span className="shrink-0 font-mono text-[0.68rem] text-stone">{previewTime(c.last.created_at, today)}</span>}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <span className={cn("min-w-0 flex-1 truncate text-[0.82rem]", c.unread > 0 ? "text-ink" : "text-stone")}>{preview(c, me.id)}</span>
                    {c.unread > 0 && (
                      <span className={UNREAD_PILL}>
                        {c.unread}
                        <span className="sr-only"> olästa</span>
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* På telefonen fyller kanalen skärmen under portalens list (top-16), och ligger under den utfällda menyn (z-30). */}
      <section
        aria-labelledby={headingId}
        className={
          embedded
            ? "flex h-[26rem] min-h-0 flex-col bg-white"
            : cn("min-h-0 flex-col bg-white lg:static lg:z-auto lg:flex lg:pb-0", chosen ? "fixed inset-x-0 bottom-0 top-16 z-20 flex pb-[env(safe-area-inset-bottom)]" : "hidden")
        }
      >
        <header className="flex items-center gap-3 border-b border-ink/10 px-4 py-3">
          <Link href="/admin/chatt" className={embedded ? "hidden" : "-ml-1.5 flex h-11 shrink-0 items-center gap-1.5 rounded-lg px-1.5 text-sm font-semibold text-stone hover:text-ink lg:hidden"}>
            <ArrowLeft size={16} /> Trådar
            {unreadElsewhere > 0 && (
              <span className={UNREAD_PILL}>
                {unreadElsewhere}
                <span className="sr-only"> olästa i andra trådar</span>
              </span>
            )}
          </Link>
          <div className="min-w-0">
            <h2 id={headingId} className="truncate font-bold leading-tight">
              {open.name}
            </h2>
            <p className="truncate text-xs text-stone">{open.audience}</p>
          </div>
          {!embedded && planId !== null && (
            <Link href={`/admin/projektplaner/${planId}`} className="btn btn-ghost btn-sm ml-auto shrink-0">
              Öppna planen
            </Link>
          )}
        </header>

        <div className="relative min-h-0 flex-1">
          <div
            ref={scroller}
            onScroll={sync}
            tabIndex={0}
            role="group"
            aria-label={`Meddelanden i ${open.name}`}
            className="flex h-full flex-col-reverse overflow-y-auto overscroll-contain [overflow-anchor:none]"
          >
            {shown.length === 0 ? (
              <div className="grid min-h-full place-items-center px-6 py-10 text-center">
                <div>
                  <p className="text-lg font-bold">Inga meddelanden än</p>
                  <p className="mx-auto mt-1.5 max-w-xs text-sm text-stone">Skriv det första, så ser alla i tråden det.</p>
                </div>
              </div>
            ) : (
              <div className="pb-3">
                {hasOlder && (
                  <p className="px-4 pt-4 text-center">
                    <button type="button" onClick={loadOlder} disabled={loadingOlder} className="btn btn-ghost btn-sm disabled:opacity-70">
                      {loadingOlder ? "Hämtar…" : "Visa äldre meddelanden"}
                    </button>
                  </p>
                )}
                <MessageList
                  days={groupMessages(shown, unreadFrom)}
                  today={today}
                  canDelete={(m) => m.id > 0 && (admin || m.author?.id === me.id)}
                  onDelete={remove}
                  outgoing={new Map(outbox.map((item) => [outgoingId(item), item]))}
                  onRetry={retry}
                  onDiscard={(item) => setOutbox((items) => items.filter((i) => i.key !== item.key))}
                />
              </div>
            )}
          </div>
          {newBelow && !reading && (
            <button type="button" onClick={() => toBottom(true)} className="btn btn-ink btn-sm absolute bottom-3 left-1/2 -translate-x-1/2 shadow-lg">
              Nya meddelanden <ChevronDown size={15} />
            </button>
          )}
        </div>
        {/* Nedre kanten av meddelandena: syns den i fönstret läser man det senaste. */}
        {embedded && <div ref={bottomEdge} aria-hidden className="h-px shrink-0" />}

        <p className="sr-only" aria-live="polite">
          {announcement}
        </p>
        {(problem || connection) && (
          <p role={problem ? "alert" : "status"} className={cn("border-t border-ink/10 px-4 py-2 text-sm", problem ? "font-medium text-red-deep" : "text-stone")}>
            {problem ?? (connection && CONNECTION_TEXT[connection])}
          </p>
        )}
        <Composer channel={open} onSend={send} />
      </section>
      {confirmDialog}
    </div>
  );
}

/** Raden under kanalens namn i listan: vem som skrev sist och början av texten. */
function preview(channel: ChatChannelSummary, me: number): string {
  const { last } = channel;
  if (!last) return "Inga meddelanden än";
  if (last.deleted) return "Meddelandet togs bort";
  const who = last.author_id === me ? "Du" : (last.author_name?.split(" ")[0] ?? "Borttaget konto");
  return `${who}: ${last.body}`;
}

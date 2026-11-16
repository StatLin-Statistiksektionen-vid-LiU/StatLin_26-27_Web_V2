/**
 * Chattens regler: trådarnas nycklar, hur meddelandena delas upp i dagar och grupper och vad i texten som är en länk. Chatten hör
 * till planeringen: varje projektplan har en tråd, och vilka som är med i den står i src/lib/auth/permissions.ts (isPlanParticipant).
 * Rena funktioner utan databas, så att de går att testa (tests/chatt.test.mjs) och använda både på servern och i webbläsaren.
 */
import { daysBetween, formatDateLong, formatDayMonthShort, isoToLocal } from "@/lib/dates";
import { safeExternalUrl } from "@/lib/utils";

/** Längsta meddelandet. Både rutan och servern läser den. */
export const CHAT_BODY_MAX = 2000;

/** Så många meddelanden hämtas åt gången: när kanalen öppnas och för varje tryck på Visa äldre. */
export const CHAT_PAGE_SIZE = 50;

export type ChatChannel = {
  /** plan:<id>. Står i adressen och i chat_messages.channel. */
  key: string;
  /** Planens namn. */
  name: string;
  /** Vilka som är med i tråden, i klartext. */
  audience: string;
};

export type ChatAuthor = { id: number; name: string; post: string; color: string };

export type ChatMessage = {
  id: number;
  /** Tom när meddelandet är borttaget. */
  body: string;
  created_at: string;
  deleted: boolean;
  /** Null när kontot är borttaget. */
  author: ChatAuthor | null;
};

/** En kanal i listan: hur många olästa kontot har och början av det senaste meddelandet. */
export type ChatChannelSummary = ChatChannel & {
  unread: number;
  last: { id: number; body: string; created_at: string; deleted: boolean; author_id: number | null; author_name: string | null } | null;
};

/** Svaret när en öppen kanal frågar efter nytt (GET /api/admin/chatt?kanal=…&efter=…&sedan=…). now är nästa frågas sedan. */
export type ChatPoll = { channels: ChatChannelSummary[]; messages: ChatMessage[]; deleted: number[]; now: string };

/** En sida äldre meddelanden (…&fore=…). */
export type ChatPage = { messages: ChatMessage[]; hasOlder: boolean };

/** En projektplans tråd har nyckeln plan:<id>. */
const PLAN_KEY = /^plan:([0-9]{1,15})$/;
export const planChannelKey = (planId: number) => `plan:${planId}`;
export function planIdOf(key: string): number | null {
  const match = PLAN_KEY.exec(key);
  return match ? Number(match[1]) : null;
}

/** Tråden som öppnas när ingen är vald: den första med något oläst, annars den där det senast skrevs. Ingen när kontot saknar trådar. */
export function defaultChannel<T extends ChatChannelSummary>(channels: T[]): T | undefined {
  const unread = channels.find((c) => c.unread > 0);
  if (unread) return unread;
  return channels.reduce<T | undefined>((newest, c) => (!newest || (c.last?.id ?? 0) > (newest.last?.id ?? 0) ? c : newest), undefined);
}

/** Det första meddelandet kontot inte har läst och inte har skrivit självt. Strecket Nya meddelanden står före det. */
export function firstUnreadId(messages: ChatMessage[], lastReadId: number, me: number): number | null {
  return messages.find((m) => m.id > lastReadId && m.author?.id !== me && !m.deleted)?.id ?? null;
}

/**
 * Lägger nya eller äldre meddelanden till dem som redan visas, i id-ordning. Samma meddelande kan komma två vägar, som svaret på
 * det man själv skickade och sedan i nästa hämtning, och ska då stå en gång. Utan något nytt lämnas listan orörd.
 */
export function mergeMessages(shown: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const known = new Set(shown.map((m) => m.id));
  const added = incoming.filter((m) => !known.has(m.id));
  if (added.length === 0) return shown;
  return [...shown, ...added].sort((a, b) => a.id - b.id);
}

/** Meddelanden som tagits bort tappar sin text. Utan någon ändring lämnas listan orörd. */
export function markDeleted(shown: ChatMessage[], ids: number[]): ChatMessage[] {
  if (!shown.some((m) => !m.deleted && ids.includes(m.id))) return shown;
  return shown.map((m) => (ids.includes(m.id) ? { ...m, body: "", deleted: true } : m));
}

/** Det någon skriver i följd står under ett namn, så länge det inte går längre än så här mellan två meddelanden. */
const GROUP_GAP_MS = 5 * 60_000;

export type MessageGroup = {
  author: ChatAuthor | null;
  messages: ChatMessage[];
  /** Gruppen börjar med det första olästa meddelandet. */
  startsUnread: boolean;
};
export type MessageDay = { day: string; groups: MessageGroup[] };

/**
 * Meddelandena dag för dag i svensk tid, och inom dagen i grupper per avsändare. En ny grupp börjar när någon annan skriver, när
 * det har gått mer än fem minuter och vid det första olästa meddelandet (unreadFrom), så att strecket kan stå mellan två grupper.
 */
export function groupMessages(messages: ChatMessage[], unreadFrom: number | null = null): MessageDay[] {
  const days: MessageDay[] = [];
  let group: MessageGroup | null = null;
  for (const message of messages) {
    const day = isoToLocal(message.created_at).slice(0, 10);
    let current = days.at(-1);
    if (current?.day !== day) {
      current = { day, groups: [] };
      days.push(current);
      group = null;
    }
    const startsUnread = message.id === unreadFrom;
    const previous = group?.messages.at(-1);
    if (group && previous && !startsUnread && group.author?.id === message.author?.id && Date.parse(message.created_at) - Date.parse(previous.created_at) <= GROUP_GAP_MS) {
      group.messages.push(message);
    } else {
      group = { author: message.author, messages: [message], startsUnread };
      current.groups.push(group);
    }
  }
  return days;
}

/** Rubriken över en dag: I dag, I går och annars veckodagen och datumet. Båda är "YYYY-MM-DD" i svensk tid. */
export function dayLabel(day: string, today: string): string {
  const ago = daysBetween(day, today);
  if (ago === 0) return "I dag";
  if (ago === 1) return "I går";
  return formatDateLong(day);
}

/** När det senast skrevs i en kanal, för listan: klockslaget i dag, annars i går eller datumet. */
export function previewTime(iso: string, today: string): string {
  const local = isoToLocal(iso);
  const ago = daysBetween(local, today);
  if (ago === 0) return local.slice(11, 16);
  if (ago === 1) return "i går";
  return formatDayMonthShort(local);
}

export type TextPart = { text: string; href?: string };

const URL_PATTERN = /https?:\/\/[^\s<>"]+/gi;

/** Skiljetecken sist i adressen hör till meningen runt om. En slutparentes hör bara till adressen om den har en startparentes. */
function trimUrl(url: string): string {
  let end = url.length;
  while (end > 0) {
    const last = url[end - 1];
    const kept = url.slice(0, end);
    const unbalanced = last === ")" && kept.split(")").length > kept.split("(").length;
    if (!/[.,;:!?'’”]/.test(last) && !unbalanced) break;
    end--;
  }
  return url.slice(0, end);
}

/**
 * Meddelandets text i bitar, där webbadresser har en href. Allt annat är text och visas som text: chatten tolkar varken HTML
 * eller Markdown.
 */
export function splitLinks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let at = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const url = trimUrl(match[0]);
    const href = safeExternalUrl(url);
    if (!href) continue;
    if (match.index > at) parts.push({ text: text.slice(at, match.index) });
    parts.push({ text: url, href });
    at = match.index + url.length;
  }
  if (at < text.length) parts.push({ text: text.slice(at) });
  return parts;
}

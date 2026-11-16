import type { EventItem } from "./types";

/**
 * iCalendar (RFC 5545). Tider lagras i svensk lokaltid och skrivs ut med
 * TZID=Europe/Stockholm plus en VTIMEZONE-definition, så att kalenderappar
 * hanterar sommar-/vintertid korrekt.
 */
const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Stockholm",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

// Formulär skickar radbrytningar som CRLF – ett ensamt CR mitt i en rad bryter filen i vissa kalenderappar.
const escape = (s: string) =>
  s.replace(/\r\n?/g, "\n").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (m) => `\\${m}`);

/** Radbryt vid 75 oktetter enligt RFC 5545. */
function fold(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let start = 0;
  while (start < bytes.length) {
    let end = Math.min(start + (start === 0 ? 75 : 74), bytes.length);
    // Klipp inte mitt i ett UTF-8-tecken.
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    parts.push(bytes.subarray(start, end).toString("utf8"));
    start = end;
  }
  return parts.join("\r\n ");
}

const local = (s: string) => s.replace(/[-:]/g, "").slice(0, 13) + "00";
const dateOnly = (s: string) => s.slice(0, 10).replace(/-/g, "");

function nextDay(date: string): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function stamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function buildCalendar(events: EventItem[], siteUrl: string, name = "StatLins evenemang"): string {
  const host = new URL(siteUrl).host;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//StatLin//Statistiksektionen i Linkoping//SV",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escape(name)}`,
    "X-WR-TIMEZONE:Europe/Stockholm",
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
    ...VTIMEZONE,
  ];
  for (const e of events) {
    const url = `${siteUrl.replace(/\/$/, "")}/evenemang/${e.slug}`;
    lines.push("BEGIN:VEVENT", `UID:event-${e.id}@${host}`, `DTSTAMP:${stamp(e.updated_at)}`, `LAST-MODIFIED:${stamp(e.updated_at)}`);
    if (e.all_day) {
      lines.push(`DTSTART;VALUE=DATE:${dateOnly(e.starts_at)}`, `DTEND;VALUE=DATE:${nextDay(e.ends_at ?? e.starts_at)}`);
    } else {
      lines.push(`DTSTART;TZID=Europe/Stockholm:${local(e.starts_at)}`);
      const end = e.ends_at ?? addHours(e.starts_at, 2);
      lines.push(`DTEND;TZID=Europe/Stockholm:${local(end)}`);
    }
    lines.push(`SUMMARY:${escape(e.title)}`);
    const desc = [e.summary, e.price && `Pris: ${e.price}`, e.signup_url && `Anmälan: ${e.signup_url}`, url].filter(Boolean).join("\n\n");
    lines.push(`DESCRIPTION:${escape(desc)}`);
    if (e.location) lines.push(`LOCATION:${escape(e.location)}`);
    if (e.committee) lines.push(`CATEGORIES:${escape(e.committee.short_name)}`);
    lines.push(`URL:${url}`, "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

function addHours(localStr: string, h: number): string {
  const d = new Date(`${localStr}:00Z`);
  d.setUTCHours(d.getUTCHours() + h);
  return d.toISOString().slice(0, 16);
}

export function googleCalendarUrl(e: EventItem, siteUrl: string): string {
  const dates = e.all_day
    ? `${dateOnly(e.starts_at)}/${nextDay(e.ends_at ?? e.starts_at)}`
    : `${local(e.starts_at)}/${local(e.ends_at ?? addHours(e.starts_at, 2))}`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates,
    ctz: "Europe/Stockholm",
    // Utan sammanfattning börjar beskrivningen med länken, inte med två tomma rader.
    details: [e.summary, `${siteUrl.replace(/\/$/, "")}/evenemang/${e.slug}`].filter(Boolean).join("\n\n"),
    location: e.location,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

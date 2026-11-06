/**
 * Tider lagras som "naiv" lokal tid i Stockholm: "YYYY-MM-DDTHH:mm".
 * Vid formatering tolkas strängen som UTC och formateras med timeZone UTC,
 * så att visningen aldrig förskjuts av serverns tidszon.
 */
const TZ = "Europe/Stockholm";

const pad = (n: number) => String(n).padStart(2, "0");

/** Ett Intl-objekt är dyrt att skapa, så det görs en gång, när det först behövs, och återanvänds sedan. */
let localFormat: Intl.DateTimeFormat | undefined;

function toLocal(date: Date): string {
  localFormat ??= new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = localFormat.formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function nowLocal(): string {
  return toLocal(new Date());
}

const OFFSETS = ["+01:00", "+02:00"] as const;

/**
 * UTC-förskjutningen i Stockholm för en lokal tid. En tid som inte finns (klockan hoppar från 02:00 till 03:00 sista söndagen i mars)
 * eller som finns två gånger (sista söndagen i oktober) blir vintertid.
 */
export function stockholmOffset(local: string): (typeof OFFSETS)[number] {
  for (const offset of OFFSETS) {
    const d = new Date(`${local}:00${offset}`);
    if (Number.isFinite(d.getTime()) && toLocal(d) === local) return offset;
  }
  return OFFSETS[0];
}

export function todayLocal(): string {
  return nowLocal().slice(0, 10);
}

function asUtc(local: string): Date {
  const [d, t = "00:00"] = local.split("T");
  return new Date(`${d}T${t.slice(0, 5)}:00Z`);
}

/**
 * Finns tiden i kalendern? V8 rullar 02-30 och T24:00 till en annan dag utan fel, så tiden måste formateras tillbaka till
 * samma sträng. 13-01 och 12:60 blir Invalid Date, och då kastar formateringen – vakten står därför före den.
 */
export function isValidLocalDateTime(local: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return false;
  const d = asUtc(local);
  if (!Number.isFinite(d.getTime())) return false;
  return d.toISOString().slice(0, 16) === local;
}

/** Går tiden att visa som ett datum? Bara datumet går bra, till skillnad från isValidLocalDateTime. */
export function canFormatLocal(local: string): boolean {
  return Number.isFinite(asUtc(local).getTime());
}

/**
 * Intl kastar för Invalid Date, och en enda gammal rad skulle då ta ner hela sidan, även adminlistan där raden ska rättas.
 * Det som inte går att formatera visas som det står.
 */
function show(format: Intl.DateTimeFormat, d: Date, fallback: string): string {
  return Number.isFinite(d.getTime()) ? format.format(d) : fallback;
}

/** ISO-tidsstämpel (UTC, från databasen) → lokal tid i Stockholm, "YYYY-MM-DDTHH:mm". */
export function isoToLocal(iso: string): string {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? toLocal(d) : iso;
}

/** Värdet till ett datetime-local-fält, som har samma format som den lokala tiden. */
export const isoToLocalInput = isoToLocal;

/** Lokal tid i Stockholm → ISO (UTC), med förskjutningen från stockholmOffset. En tid som inte finns i kalendern är ett programfel: den ska ha stoppats i formuläret. */
export function localToIso(local: string): string {
  if (!isValidLocalDateTime(local)) throw new RangeError(`Tiden finns inte: ${local}`);
  return new Date(`${local}:00${stockholmOffset(local)}`).toISOString();
}

/** Språket på veckodagar, månader och tider. De engelska sidorna under /en använder en-GB, allt annat svenska. */
export type DateLocale = "sv-SE" | "en-GB";

function formatters(locale: DateLocale) {
  const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { timeZone: "UTC", ...opts });
  return {
    weekdayLong: fmt({ weekday: "long" }),
    weekdayShort: fmt({ weekday: "short" }),
    monthShort: fmt({ month: "short" }),
    monthLong: fmt({ month: "long" }),
    dayMonth: fmt({ day: "numeric", month: "long" }),
    dayMonthYear: fmt({ day: "numeric", month: "long", year: "numeric" }),
  };
}

/**
 * Formaterarna skapas först när ett datum ska visas och återanvänds sedan. Modulen följer med i sajtens gemensamma
 * klientkod, och tolv Intl-objekt direkt vid start tog ungefär 80 ms på en strypt telefon vid varje sidladdning.
 */
const FORMATS: Partial<Record<DateLocale, ReturnType<typeof formatters>>> = {};
const formatsFor = (locale: DateLocale) => (FORMATS[locale] ??= formatters(locale));

export function parts(local: string, locale: DateLocale = "sv-SE") {
  const d = asUtc(local);
  const { weekdayLong, weekdayShort, monthShort, monthLong } = formatsFor(locale);
  return {
    day: d.getUTCDate(),
    month: d.getUTCMonth() + 1,
    year: d.getUTCFullYear(),
    weekday: show(weekdayLong, d, ""),
    weekdayShort: show(weekdayShort, d, "").replace(".", ""),
    monthShort: show(monthShort, d, "").replace(".", ""),
    monthLong: show(monthLong, d, ""),
    time: local.length > 10 ? local.slice(11, 16) : "",
  };
}

/** "12 jan 2024" – för diagram och tabeller, där det är trångt. */
export function formatDateShort(local: string): string {
  if (!canFormatLocal(local)) return local;
  const p = parts(local);
  return `${p.day} ${p.monthShort} ${p.year}`;
}

/** "12 jan", för listor som redan är samlade per år. */
export function formatDayMonthShort(local: string): string {
  if (!canFormatLocal(local)) return local;
  const p = parts(local);
  return `${p.day} ${p.monthShort}`;
}

export function formatDate(local: string, withYear = false, locale: DateLocale = "sv-SE"): string {
  const formats = formatsFor(locale);
  return show(withYear ? formats.dayMonthYear : formats.dayMonth, asUtc(local), local);
}

export function formatDateLong(local: string): string {
  if (!canFormatLocal(local)) return local;
  const p = parts(local);
  const thisYear = Number(todayLocal().slice(0, 4));
  const base = `${capitalize(p.weekday)} ${p.day} ${p.monthLong}`;
  return p.year === thisYear ? base : `${base} ${p.year}`;
}

/**
 * Sista minuten ett evenemang pågår. Heldag räknas t.o.m. slutdagens sista minut, oavsett klockslaget i slutfältet (datumfältet
 * ger ofta 00:00). Utan sluttid gäller startdagens sista minut. Samma regel står i SQL i src/lib/data/events.ts.
 */
export function eventEnd(start: string, end: string | null, allDay: boolean): string {
  if (allDay) return `${(end ?? start).slice(0, 10)}T23:59`;
  return end ?? `${start.slice(0, 10)}T23:59`;
}

/**
 * Sista dagen ett evenemang syns i kalendern. En kväll som slutar natten efter, före kl. 06, hör till startdagen: annars skulle en pub
 * natten mot den 1:a också stå under nästa månad. Heldag räknas t.o.m. slutdagen. En sluttid före starten räknas inte.
 */
export function eventLastDay(start: string, end: string | null, allDay: boolean): string {
  const first = start.slice(0, 10);
  if (!end) return first;
  const last = end.slice(0, 10);
  if (last <= first) return first;
  if (allDay) return last;
  return last === addDaysLocal(first, 1).slice(0, 10) && end.slice(11, 16) < "06:00" ? first : last;
}

/** Syns evenemanget i månaden, "YYYY-MM"? Ett evenemang över en månadsgräns hör till båda månaderna. */
export function eventInMonth(start: string, end: string | null, allDay: boolean, month: string): boolean {
  return start.slice(0, 7) <= month && month <= eventLastDay(start, end, allDay).slice(0, 7);
}

/** startDate och endDate för schema.org: bara datum vid heldag, annars klockslag med tidszon. */
export function eventSchemaDates(start: string, end: string | null, allDay: boolean) {
  const format = (local: string) => (allDay ? local.slice(0, 10) : `${local}:00${stockholmOffset(local)}`);
  return { startDate: format(start), endDate: end ? format(end) : undefined };
}

export function formatTimeRange(start: string, end: string | null, allDay: boolean, locale: DateLocale = "sv-SE"): string {
  if (allDay) {
    const allDayText = locale === "en-GB" ? "All day" : "Heldag";
    if (!end || end.slice(0, 10) === start.slice(0, 10)) return allDayText;
    return `${allDayText} ${locale === "en-GB" ? "until" : "t.o.m."} ${formatDate(end, end.slice(0, 4) !== start.slice(0, 4), locale)}`;
  }
  const s = start.slice(11, 16);
  if (!end) return s;
  // En sittning till 01:00 hör till kvällen den började, så den behöver inget datum. Se eventLastDay.
  if (eventLastDay(start, end, false) === start.slice(0, 10)) return `${s}–${end.slice(11, 16)}`;
  return `${s} ${locale === "en-GB" ? "until" : "till"} ${formatDate(end, false, locale)} ${end.slice(11, 16)}`;
}

export function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * "Pågår", "om 3 dagar", "i morgon", "i dag" – relativt klockan i Stockholm. Pågår gäller bara när slutet är känt: en heldag, eller
 * ett klockslag med sluttid. Utan sluttid går det inte att veta när evenemanget är slut, så det förblir "I dag".
 */
export function relativeDay(start: string, end: string | null = null, allDay = false): string {
  if (allDay || end) {
    const now = nowLocal();
    const from = allDay ? `${start.slice(0, 10)}T00:00` : start;
    if (from <= now && now <= eventEnd(start, end, allDay)) return "Pågår";
  }
  const today = asUtc(todayLocal());
  const target = asUtc(start.slice(0, 10));
  const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return "I dag";
  if (diff === 1) return "I morgon";
  if (diff === -1) return "I går";
  if (diff > 1 && diff < 7) return `Om ${diff} dagar`;
  // Nästa vecka är kalenderveckan efter den här, måndag till söndag. En onsdag tolv dagar bort från en fredag ligger veckan efter.
  const weekday = today.getUTCDay() || 7;
  if (diff >= 7 && diff <= 14 - weekday) return "Nästa vecka";
  if (diff >= 7 && diff < 14) return `Om ${diff} dagar`;
  if (diff >= 14 && diff < 60) return `Om ${Math.round(diff / 7)} veckor`;
  if (diff < 0) return "Har varit";
  return `Om ${Math.round(diff / 30)} mån`;
}

/** ISO-veckonumret för ett datum, "YYYY-MM-DD". Vecka 1 är veckan med årets första torsdag. */
export function isoWeek(local: string): number {
  const d = asUtc(local.slice(0, 10));
  const weekday = d.getUTCDay() || 7;
  // Torsdagen i samma vecka avgör vilket år veckan hör till.
  d.setUTCDate(d.getUTCDate() + 4 - weekday);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
}

/** Hela dagar från `from` till `to` räknat i kalendern, så att 23.00 och 01.00 dagen efter blir en dag. */
export function daysBetween(from: string, to: string): number {
  return Math.round((asUtc(to.slice(0, 10)).getTime() - asUtc(from.slice(0, 10)).getTime()) / 86_400_000);
}

export function addDaysLocal(local: string, days: number): string {
  const d = asUtc(local);
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** Månadsrutnät (måndag först) för kalendervyn. */
export function monthGrid(year: number, month: number) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const start = new Date(first);
  start.setUTCDate(1 - offset);
  const days: { date: string; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    days.push({
      date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
      inMonth: d.getUTCMonth() === month - 1,
    });
  }
  // Ta bort helt tomma veckor på slutet. En februari som börjar på en måndag har två sådana.
  while (days.length > 28 && !days.slice(-7).some((d) => d.inMonth)) days.splice(-7);
  return days;
}

/** Så många månader från i dag går kalendern att visa. Utan gräns blir varje månad i all framtid en egen adress att indexera. */
const CALENDAR_RANGE = 24;
const monthNumber = (month: string) => Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7));

export function calendarMonthInRange(month: string): boolean {
  return Math.abs(monthNumber(month) - monthNumber(todayLocal())) <= CALENDAR_RANGE;
}

/** Månaden kalendern visar, "YYYY-MM": värdet ur adressen om det är en månad inom gränsen, annars innevarande månad. */
export function calendarMonth(value: unknown): string {
  if (typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && calendarMonthInRange(value)) return value;
  return todayLocal().slice(0, 7);
}

export function monthLabel(year: number, month: number) {
  return capitalize(formatsFor("sv-SE").monthLong.format(new Date(Date.UTC(year, month - 1, 1)))) + " " + year;
}

export function isoUtc(): string {
  return new Date().toISOString();
}

/** Formaterar ISO-tidsstämplar (UTC, från databasen) i svensk tid. */
let timestampFormat: Intl.DateTimeFormat | undefined;

export function formatTimestamp(iso: string): string {
  timestampFormat ??= new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return show(timestampFormat, new Date(iso), iso);
}

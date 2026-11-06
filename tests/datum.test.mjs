// Datumhanteringen i src/lib/dates.ts, formulärdelarna i src/lib/admin/form.ts och länkhjälparen i src/lib/links.ts. Kräver ingen server eller databas.
//   npx tsx --test tests/datum.test.mjs
import assert from "node:assert";
import { mock, test } from "node:test";
import { calendarMonth, calendarMonthInRange, eventEnd, eventInMonth, eventLastDay, eventSchemaDates, formatDate, formatTimeRange, isoToLocal, parts, isoToLocalInput, isValidLocalDateTime, localToIso, monthGrid, relativeDay, stockholmOffset } from "../src/lib/dates.ts";
import { canFormatLocal, formatDateLong, formatDateShort, formatTimestamp } from "../src/lib/dates.ts";
import { zLocalDateTime, zOptionalLocalDateTime } from "../src/lib/admin/form.ts";
import { isFileUrl } from "../src/lib/links.ts";

// V8 rullar de två första utan fel (2 mars, 1 mars). De två sista ger Invalid Date, och då kastar en rundtur utan vakt (R-21).
const FINNS_INTE = ["2025-02-30T12:00", "2025-02-28T24:00", "2025-13-01T12:00", "2025-02-28T12:60"];

/** Kör fn när klockan i Stockholm är `local`. Datumen i testerna ligger på vintertid (UTC+1). */
const at = (local, fn) => {
  mock.timers.enable({ apis: ["Date"], now: new Date(`${local}:00+01:00`) });
  try {
    return fn();
  } finally {
    mock.timers.reset();
  }
};

test("SB-32: datum som inte finns i kalendern nekas, utan att vakten själv kastar", () => {
  for (const d of FINNS_INTE) assert.equal(isValidLocalDateTime(d), false, d);
});

test("SB-32: datum som finns godtas, också skottdagen och dygnets sista minut", () => {
  for (const d of ["2025-02-28T12:00", "2024-02-29T00:00", "2025-12-31T23:59"]) assert.equal(isValidLocalDateTime(d), true, d);
  assert.equal(isValidLocalDateTime("2025-02-29T12:00"), false, "2025 är inget skottår");
});

test("SB-32: bara formatet YYYY-MM-DDTHH:mm godtas", () => {
  for (const d of ["", "2025-02-28", "2025-02-28T12:00:00", "2025-02-28 12:00", "28/2 2025"]) assert.equal(isValidLocalDateTime(d), false, d);
});

test("SB-32: starttiden ger fältfel med fältets namn", () => {
  const schema = zLocalDateTime("Starttid");
  for (const d of FINNS_INTE) {
    const r = schema.safeParse(d);
    assert.equal(r.success, false, d);
    assert.match(r.error.issues[0].message, /^Starttid /);
  }
  assert.equal(schema.parse("2025-02-28T12:00"), "2025-02-28T12:00");
});

test("SB-32: ett valfritt fält ger fältfel i stället för att tyst bli tomt", () => {
  const schema = zOptionalLocalDateTime("Sluttid");
  for (const d of [...FINNS_INTE, "2025-02-28"]) {
    const r = schema.safeParse(d);
    assert.equal(r.success, false, d);
    assert.match(r.error.issues[0].message, /^Sluttid /);
  }
  assert.equal(schema.parse("2025-02-28T12:00"), "2025-02-28T12:00");
  assert.equal(schema.parse(""), null, "tomt fält betyder ingen tid");
  assert.equal(schema.parse(undefined), null, "fält som saknas betyder ingen tid");
});

test("SB-01: heldag räknas till slutdagens sista minut, oavsett klockslaget i slutfältet", () => {
  assert.equal(eventEnd("2026-08-17T00:00", "2026-08-21T00:00", true), "2026-08-21T23:59");
  assert.equal(eventEnd("2026-08-17T10:00", "2026-08-21T16:00", true), "2026-08-21T23:59");
  assert.equal(eventEnd("2026-08-17T00:00", null, true), "2026-08-17T23:59");
});

test("SB-01: ett evenemang med klockslag slutar på sluttiden, och utan sluttid vid dygnets slut", () => {
  assert.equal(eventEnd("2026-08-17T18:00", "2026-08-18T01:00", false), "2026-08-18T01:00");
  assert.equal(eventEnd("2026-08-17T18:00", null, false), "2026-08-17T23:59");
});

test("SB-01: tidsraden visar heldagens slutdatum, men bara när det är en annan dag", () => {
  assert.equal(formatTimeRange("2026-08-17T00:00", "2026-08-21T00:00", true), "Heldag t.o.m. 21 augusti");
  assert.equal(formatTimeRange("2026-12-30T00:00", "2027-01-02T00:00", true), "Heldag t.o.m. 2 januari 2027");
  assert.equal(formatTimeRange("2026-08-17T00:00", "2026-08-17T00:00", true), "Heldag");
  assert.equal(formatTimeRange("2026-08-17T00:00", null, true), "Heldag");
  assert.equal(formatTimeRange("2026-08-17T18:00", "2026-08-17T21:00", false), "18:00–21:00");
});

test("Tidsraden: en kväll som går över midnatt är en kväll, och först längre evenemang får ett slutdatum", () => {
  assert.equal(formatTimeRange("2026-11-05T18:00", "2026-11-06T01:00", false), "18:00–01:00");
  assert.equal(formatTimeRange("2026-11-30T18:00", "2026-12-01T02:00", false), "18:00–02:00");
  assert.equal(formatTimeRange("2026-11-05T18:00", "2026-11-06T09:00", false), "18:00 till 6 november 09:00");
  assert.equal(formatTimeRange("2026-11-05T10:00", "2026-11-07T16:00", false), "10:00 till 7 november 16:00");
});

test("SB-07: ett evenemang som startade i går och slutar i morgon pågår", () => {
  assert.equal(at("2026-11-04T12:00", () => relativeDay("2026-11-03T18:00", "2026-11-05T15:00", false)), "Pågår");
});

test("SB-07: pågår gäller från starten till slutet, inte före och inte efter", () => {
  const today = (now) => at(now, () => relativeDay("2026-11-04T18:00", "2026-11-04T21:00", false));
  assert.equal(today("2026-11-04T17:59"), "I dag");
  assert.equal(today("2026-11-04T18:00"), "Pågår");
  assert.equal(today("2026-11-04T21:00"), "Pågår");
  assert.equal(today("2026-11-04T21:01"), "I dag");
});

test("SB-07: heldag pågår hela sista dagen, också när start och slut har klockslag", () => {
  const heldag = (now) => at(now, () => relativeDay("2026-11-02T18:00", "2026-11-04T00:00", true));
  assert.equal(heldag("2026-11-02T01:00"), "Pågår");
  assert.equal(heldag("2026-11-04T23:59"), "Pågår");
  assert.equal(heldag("2026-11-05T00:00"), "Har varit");
  assert.equal(at("2026-11-04T12:00", () => relativeDay("2026-11-04T00:00", null, true)), "Pågår");
  assert.equal(at("2026-11-04T12:00", () => relativeDay("2026-11-05T00:00", "2026-11-07T00:00", true)), "I morgon");
});

test("SB-07: utan sluttid går det inte att veta att något pågår, så det förblir I dag", () => {
  assert.equal(at("2026-11-04T23:00", () => relativeDay("2026-11-04T18:00", null, false)), "I dag");
});

test("SB-07: etiketterna utan pågående evenemang är oförändrade", () => {
  const from = (start, end = null) => at("2026-11-04T12:00", () => relativeDay(start, end, false));
  assert.equal(from("2026-11-05T10:00"), "I morgon");
  assert.equal(from("2026-11-07T10:00"), "Om 3 dagar");
  assert.equal(from("2026-11-12T10:00"), "Nästa vecka");
  assert.equal(from("2026-11-03T10:00", "2026-11-03T12:00"), "I går");
  assert.equal(from("2026-10-01T10:00", "2026-10-01T12:00"), "Har varit");
});

test("Nästa vecka är kalenderveckan efter den här, inte bara 7 till 13 dagar bort", () => {
  // Fredag 6 november: nästa vecka är 9 till 15 november.
  const from = (start) => at("2026-11-06T12:00", () => relativeDay(start, null, false));
  assert.equal(from("2026-11-13T18:00"), "Nästa vecka");
  assert.equal(from("2026-11-15T18:00"), "Nästa vecka");
  assert.equal(from("2026-11-16T18:00"), "Om 10 dagar");
  assert.equal(from("2026-11-18T18:00"), "Om 12 dagar");
  assert.equal(from("2026-11-20T18:00"), "Om 2 veckor");
  // En måndag är alla sju dagarna 7 till 13 bort nästa vecka.
  assert.equal(at("2026-11-09T12:00", () => relativeDay("2026-11-22T18:00", null, false)), "Nästa vecka");
});

test("SB-10: en februari som börjar på en måndag får fyra rader, utan tomma veckor", () => {
  const days = monthGrid(2027, 2);
  assert.equal(days.length, 28);
  assert.equal(days[0].date, "2027-02-01");
  assert.equal(days.at(-1).date, "2027-02-28");
  assert.ok(days.every((d) => d.inMonth));
});

test("SB-10: en vecka med någon dag i månaden behålls", () => {
  // 1 feb 2026 är en söndag: sex dagar av januari först, ingen dag av mars behövs på en sjätte rad.
  assert.equal(monthGrid(2026, 2).length, 35);
  // 1 nov 2026 är en söndag: sex dagar av oktober och 30 dagar räcker in på en sjätte rad.
  const november = monthGrid(2026, 11);
  assert.equal(november.length, 42);
  assert.equal(november[0].date, "2026-10-26");
  assert.equal(november.at(-1).date, "2026-12-06");
});

test("SB-22: förskjutningen följer svensk sommartid, också runt omställningarna", () => {
  assert.equal(stockholmOffset("2026-01-15T12:00"), "+01:00");
  assert.equal(stockholmOffset("2026-07-15T12:00"), "+02:00");
  // Den 28 mars 2027 går klockan från 02:00 till 03:00.
  assert.equal(stockholmOffset("2027-03-28T01:59"), "+01:00");
  assert.equal(stockholmOffset("2027-03-28T03:00"), "+02:00");
  // Den 25 oktober 2026 går klockan från 03:00 till 02:00.
  assert.equal(stockholmOffset("2026-10-25T01:59"), "+02:00");
  assert.equal(stockholmOffset("2026-10-25T03:00"), "+01:00");
});

test("SB-22: en tid som inte finns eller som finns två gånger får vintertid", () => {
  assert.equal(stockholmOffset("2027-03-28T02:30"), "+01:00", "02:30 hoppas över den 28 mars");
  assert.equal(stockholmOffset("2026-10-25T02:30"), "+01:00", "02:30 kommer två gånger den 25 oktober, den senare är vintertid");
});

test("SB-22: tider i strukturerad data har tidszon", () => {
  assert.deepEqual(eventSchemaDates("2026-07-15T18:00", "2026-07-15T21:00", false), { startDate: "2026-07-15T18:00:00+02:00", endDate: "2026-07-15T21:00:00+02:00" });
  assert.deepEqual(eventSchemaDates("2026-12-15T18:00", null, false), { startDate: "2026-12-15T18:00:00+01:00", endDate: undefined });
  // Natten då klockan ställs om: starten är sommartid och slutet vintertid.
  assert.deepEqual(eventSchemaDates("2026-10-24T22:00", "2026-10-25T04:00", false), { startDate: "2026-10-24T22:00:00+02:00", endDate: "2026-10-25T04:00:00+01:00" });
});

test("SB-22: heldag har bara datum, eftersom klockslaget inte säger något om en heldag", () => {
  assert.deepEqual(eventSchemaDates("2026-08-17T00:00", "2026-08-21T00:00", true), { startDate: "2026-08-17", endDate: "2026-08-21" });
  assert.deepEqual(eventSchemaDates("2026-08-17T18:00", null, true), { startDate: "2026-08-17", endDate: undefined });
});

test("SB-23: kalendern visar månader inom två år från i dag, också exakt två år bort", () => {
  at("2026-11-04T12:00", () => {
    assert.equal(calendarMonth("2027-02"), "2027-02");
    assert.equal(calendarMonth("2028-11"), "2028-11");
    assert.equal(calendarMonth("2024-11"), "2024-11");
  });
});

test("SB-23: en månad utanför gränsen eller ett trasigt värde ger innevarande månad", () => {
  at("2026-11-04T12:00", () => {
    for (const bad of ["2028-12", "2024-10", "1999-01", "2026-13", "2026-00", "2026-1", "x", "", undefined, ["2027-01", "2027-02"]]) {
      assert.equal(calendarMonth(bad), "2026-11", String(bad));
    }
  });
});

test("SB-23: bläddringen stannar vid gränsen", () => {
  at("2026-11-04T12:00", () => {
    assert.equal(calendarMonthInRange("2028-11"), true);
    assert.equal(calendarMonthInRange("2028-12"), false);
    assert.equal(calendarMonthInRange("2024-11"), true);
    assert.equal(calendarMonthInRange("2024-10"), false);
  });
});

test("SB-25: ett evenemang över flera dagar syns till och med sista dagen, med eller utan klockslag", () => {
  assert.equal(eventLastDay("2026-08-28T00:00", "2026-09-03T00:00", true), "2026-09-03");
  assert.equal(eventLastDay("2026-08-28T10:00", "2026-09-03T16:00", false), "2026-09-03");
  assert.equal(eventLastDay("2026-08-28T18:00", "2026-08-29T07:00", false), "2026-08-29", "slutar på morgonen dagen efter");
});

test("SB-25: en kväll som slutar efter midnatt hör till startdagen", () => {
  assert.equal(eventLastDay("2026-10-31T20:00", "2026-11-01T01:00", false), "2026-10-31");
  assert.equal(eventLastDay("2026-12-31T20:00", "2027-01-01T02:00", false), "2026-12-31", "över ett årsskifte");
  assert.equal(eventLastDay("2026-08-28T00:00", "2026-08-29T00:00", true), "2026-08-29", "en heldag räknas hela slutdagen");
});

test("SB-25: utan sluttid är startdagen den sista", () => {
  assert.equal(eventLastDay("2026-08-28T18:00", null, false), "2026-08-28");
  assert.equal(eventLastDay("2026-08-28T00:00", null, true), "2026-08-28");
  assert.equal(eventLastDay("2026-08-28T18:00", "2026-08-27T21:00", false), "2026-08-28", "en gammal rad med sluttiden före starten");
});

test("SB-25: nollningen 28 aug–3 sep listas under båda månaderna, men inte under månaderna runt om", () => {
  const nollning = (month) => eventInMonth("2026-08-28T10:00", "2026-09-03T16:00", false, month);
  assert.equal(nollning("2026-07"), false);
  assert.equal(nollning("2026-08"), true);
  assert.equal(nollning("2026-09"), true);
  assert.equal(nollning("2026-10"), false);
});

test("SB-25: en pub natten mot den 1:a listas bara under månaden den börjar i", () => {
  const pub = (month) => eventInMonth("2026-10-31T20:00", "2026-11-01T01:00", false, month);
  assert.equal(pub("2026-10"), true);
  assert.equal(pub("2026-11"), false);
});

test("SB-25: adresser på sajten som slutar på en filändelse är filer", () => {
  for (const url of ["/kalender.ics", "/evenemang/star/kalender.ics", "/media/stadgar.pdf", "/kalender.ics?a=1", "/kalender.ics#x"]) assert.equal(isFileUrl(url), true, url);
});

test("SB-25: sidor och externa adresser är inte filer", () => {
  for (const url of ["/", "/evenemang", "/studenter/lankar", "/tentastatistik/732G33", "/v1.2/om", "/lankar?fil=a.pdf", "https://liu.se/a.pdf", "mailto:info@statlin.se"]) {
    assert.equal(isFileUrl(url), false, url);
  }
});

test("ST-02: lokal tid blir UTC med en timme på vintern och två på sommaren", () => {
  assert.equal(localToIso("2026-01-15T12:00"), "2026-01-15T11:00:00.000Z");
  assert.equal(localToIso("2026-07-15T12:00"), "2026-07-15T10:00:00.000Z");
});

test("ST-02: 02:30 sista söndagen i mars finns inte, och blir samma ögonblick som 03:30", () => {
  assert.equal(localToIso("2026-03-29T02:30"), "2026-03-29T01:30:00.000Z");
  assert.equal(localToIso("2026-03-29T03:30"), "2026-03-29T01:30:00.000Z");
  assert.equal(isoToLocal("2026-03-29T01:30:00.000Z"), "2026-03-29T03:30");
});

test("ST-02: 02:30 sista söndagen i oktober finns två gånger, och blir den på vintertid", () => {
  assert.equal(localToIso("2026-10-25T02:30"), "2026-10-25T01:30:00.000Z");
  assert.equal(isoToLocal("2026-10-25T01:30:00.000Z"), "2026-10-25T02:30");
  assert.equal(isoToLocal("2026-10-25T00:30:00.000Z"), "2026-10-25T02:30", "samma klockslag en timme tidigare, på sommartid");
});

test("ST-02: datumet följer klockan i Stockholm, också när UTC fortfarande är kvar på föregående år", () => {
  assert.equal(isoToLocal("2026-12-31T23:30:00.000Z"), "2027-01-01T00:30");
});

test("ST-02: tider som finns kommer tillbaka oförändrade", () => {
  for (const local of ["2026-01-15T00:00", "2026-03-29T01:59", "2026-03-29T03:00", "2026-07-15T23:59", "2026-10-25T03:00", "2028-02-29T12:00"]) {
    assert.equal(isoToLocal(localToIso(local)), local);
  }
});

test("ST-02: ett datetime-local-fält får tiden i Stockholm", () => {
  assert.equal(isoToLocalInput("2026-07-15T10:00:00.000Z"), "2026-07-15T12:00");
});

test("ST-02: en tid som inte finns i kalendern går inte att räkna om", () => {
  for (const d of FINNS_INTE) assert.throws(() => localToIso(d), RangeError, d);
});

test("SB-29: tiden på engelska", () => {
  assert.equal(formatTimeRange("2026-08-19T00:00", null, true, "en-GB"), "All day");
  assert.equal(formatTimeRange("2026-08-19T00:00", "2026-08-19T00:00", true, "en-GB"), "All day");
  assert.equal(formatTimeRange("2026-08-19T00:00", "2026-08-21T00:00", true, "en-GB"), "All day until 21 August");
  assert.equal(formatTimeRange("2026-12-30T00:00", "2027-01-02T00:00", true, "en-GB"), "All day until 2 January 2027");
  assert.equal(formatTimeRange("2026-08-19T18:00", "2026-08-19T21:00", false, "en-GB"), "18:00–21:00");
  assert.equal(formatTimeRange("2026-08-19T18:00", "2026-08-20T01:00", false, "en-GB"), "18:00–01:00");
  assert.equal(formatTimeRange("2026-08-19T18:00", "2026-08-21T02:00", false, "en-GB"), "18:00 until 21 August 02:00");
});

test("SB-29: veckodag och månad på engelska", () => {
  const p = parts("2026-11-07T18:00", "en-GB");
  assert.deepEqual([p.day, p.month, p.year, p.weekday, p.weekdayShort, p.monthShort, p.monthLong, p.time], [7, 11, 2026, "Saturday", "Sat", "Nov", "November", "18:00"]);
  assert.equal(formatDate("2027-01-02T00:00", true, "en-GB"), "2 January 2027");
});

test("SB-29: svenska är fortfarande standard", () => {
  const p = parts("2026-11-07T18:00");
  assert.deepEqual([p.weekday, p.weekdayShort, p.monthShort, p.monthLong], ["lördag", "lör", "nov", "november"]);
  assert.equal(formatDate("2027-01-02T00:00", true), "2 januari 2027");
  assert.equal(formatTimeRange("2026-08-19T00:00", "2026-08-21T00:00", true), "Heldag t.o.m. 21 augusti");
});

test("en tid som inte går att visa blir strängen som den står, inte ett fel som tar ner sidan", () => {
  for (const ok of ["2026-11-07T18:00", "2026-11-07", "2025-02-30T12:00"]) assert.equal(canFormatLocal(ok), true, ok);
  for (const bad of ["", "nästa vecka", "2025-13-01T12:00", "2025-02-28T12:60", "okänt"]) {
    assert.equal(canFormatLocal(bad), false, bad);
    assert.equal(formatDate(bad), bad);
    assert.equal(formatDate(bad, true), bad);
    assert.equal(formatDateShort(bad), bad);
    assert.equal(formatDateLong(bad), bad);
    assert.equal(formatTimestamp(bad), bad);
    assert.equal(isoToLocal(bad), bad);
    assert.equal(parts(bad).monthLong, "");
  }
});

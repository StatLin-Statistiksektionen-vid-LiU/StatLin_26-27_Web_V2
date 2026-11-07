// Evenemang, kalendern och datumen, så som en redaktör och en besökare möter dem.
import assert from "node:assert";
import sharp from "sharp";
import { newVisitor, uniqueId, waitForHydration } from "../e2e-hjalp.mjs";

const ADMIN = "admin@statlin.se";
// V8 rullar de två första till en annan dag utan fel, och de två sista ger Invalid Date (SB-32).
const FINNS_INTE = ["2025-02-30T12:00", "2025-02-28T24:00", "2025-13-01T12:00", "2025-02-28T12:60"];

/** Dagens datum i Stockholm, "YYYY-MM-DD", plus eller minus några dagar. */
const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const dayOffset = (days) => new Date(Date.parse(`${today}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
/** "21 augusti", så som datumet står på sajten. */
const slugOf = (title) => title.toLowerCase().replaceAll("ä", "a").replace(/[^a-z0-9]+/g, "-");
const longDate = (date, withYear = false) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "UTC", day: "numeric", month: "long", ...(withYear ? { year: "numeric" } : {}) }).format(new Date(`${date}T00:00:00Z`));

export default async function evenemangSteg({ BASE, browser, page, step, switchAccount }) {
  // Sajten läses av en besökare som inte är inloggad.
  const visitor = await newVisitor(browser);
  const site = visitor.page;

  const openForm = async (url) => {
    await page.goto(url);
    await waitForHydration(page, page.locator('input[name="title"]'));
  };
  const openDetails = () => page.locator("summary:visible", { hasText: "Fler detaljer" }).click();
  /**
   * Skickar en tid som inte finns. Chromiums datumfält släpper inte igenom den, men det gör andra webbläsare och handskrivna anrop.
   * Värdet ligger i ett eget fält sist i formuläret, där det vinner över det synliga (formObject). Ett datumfält som görs om till
   * textfält går inte att använda: React sätter tillbaka typen vid nästa rendering, och då töms fältet.
   */
  const sendValue = (name, value) =>
    page.locator('form:has(input[name="title"]):visible').evaluate(
      (form, [fieldName, fieldValue]) => {
        form.querySelector(`input[data-e2e="${fieldName}"]`)?.remove();
        const input = Object.assign(document.createElement("input"), { type: "hidden", name: fieldName, value: fieldValue });
        input.dataset.e2e = fieldName;
        form.append(input);
      },
      [name, value],
    );
  const submitAndWaitForError = async (button, message) => {
    const answered = page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === new URL(page.url()).pathname);
    await button.click();
    await answered;
    await page.locator(`[id$="-error"]:visible`, { hasText: message }).waitFor();
  };
  /** Publicerar ett evenemang genom formuläret. Svarar med adressen i admin och sluggen. */
  const createEvent = async ({ title, startsAt, endsAt, allDay, location, body, summary = "Skapat av det automatiska testet." }) => {
    await openForm(`${BASE}/admin/evenemang/ny`);
    await page.fill('input[name="title"]', title);
    await page.fill('textarea[name="summary"]', summary);
    if (location) await page.fill('input[name="location"]', location);
    if (body) await page.fill('textarea[name="body_md"]', body);
    await page.fill('input[name="starts_at"]', startsAt);
    await openDetails();
    if (endsAt) await page.fill('input[name="ends_at"]', endsAt);
    if (allDay) await page.locator('label:has(input[name="all_day"])').click();
    await Promise.all([page.waitForURL(/\/admin\/evenemang\/\d+\?skapad=1/), page.getByRole("button", { name: "Publicera", exact: true }).click()]);
    return { url: page.url().split("?")[0], slug: await page.inputValue('input[name="slug"]') };
  };
  const removeItem = async (url) => {
    await openForm(url);
    // Knapparna i galleriet heter också Ta bort, men genom sin title. Evenemangets egen knapp har namnet som text.
    const button = page.getByRole("button", { name: "Ta bort" }).and(page.locator("button:not([title])"));
    await waitForHydration(page, button);
    await button.click();
    const dialog = page.getByRole("alertdialog");
    await dialog.waitFor();
    await Promise.all([page.waitForURL(/\/admin\/(evenemang|nyheter)\?/), dialog.getByRole("button", { name: "Ta bort" }).click()]);
  };

  const assertOngoing = async (slug) => {
    await site.goto(`${BASE}/evenemang`);
    const card = site.locator(`main a[href="/evenemang/${slug}"]:has(h3)`);
    await card.getByText("Pågår", { exact: true }).waitFor();
    await site.goto(`${BASE}/evenemang/${slug}`);
    await site.locator("main .chip", { hasText: "Pågår" }).waitFor();
    for (const wrong of ["I går", "Har varit"]) assert.equal(await site.locator("main .chip", { hasText: wrong }).count(), 0, `sidan ska inte säga "${wrong}"`);
  };

  await step("SB-32: en tid som inte finns ger fältfel på start och slut och sparas inte, och en giltig tid sparas", async () => {
    await switchAccount(page, ADMIN);
    const title = `E2E-datum ${uniqueId()}`;
    await openForm(`${BASE}/admin/evenemang/ny`);
    await page.fill('input[name="title"]', title);
    await openDetails();
    const draft = page.getByRole("button", { name: "Spara som utkast", exact: true });

    for (const bad of FINNS_INTE) {
      await sendValue("starts_at", bad);
      await submitAndWaitForError(draft, "Starttiden måste vara ett giltigt datum och klockslag.");
    }
    await sendValue("starts_at", "2025-02-28T12:00");
    // Ett valfritt fält med ogiltigt innehåll blev förut tyst tomt. Ett datum utan klockslag är samma sak.
    for (const bad of [...FINNS_INTE, "2025-03-01"]) {
      await sendValue("ends_at", bad);
      await submitAndWaitForError(draft, "Sluttiden måste vara ett giltigt datum och klockslag.");
    }
    assert.equal(new URL(page.url()).pathname, "/admin/evenemang/ny", "inget ska ha sparats");
    assert.equal(await page.inputValue('input[name="title"]'), title, "fälten ska behållas");

    await sendValue("ends_at", "");
    await Promise.all([page.waitForURL(/\/admin\/evenemang\/\d+\?skapad=1/), draft.click()]);
    const url = page.url().split("?")[0];
    await openForm(url);
    assert.equal(await page.inputValue('input[name="starts_at"]'), "2025-02-28T12:00");

    const feed = await site.request.get(`${BASE}/kalender.ics`);
    assert.equal(feed.status(), 200, "kalenderflödet ska svara");
    await removeItem(url);
  });

  await step("SB-32: en nyhets publiceringsdatum som inte finns ger fältfel och sparas inte", async () => {
    await openForm(`${BASE}/admin/nyheter/ny`);
    await page.fill('input[name="title"]', `E2E-datum ${uniqueId()}`);
    await openDetails();
    await sendValue("published_at", "2025-02-30T12:00");
    await submitAndWaitForError(page.getByRole("button", { name: "Spara som utkast", exact: true }), "Publiceringsdatumet måste vara ett giltigt datum och klockslag.");
    assert.equal(new URL(page.url()).pathname, "/admin/nyheter/ny", "inget ska ha sparats");
  });

  await step("SB-01: heldag visas under Kommande hela sista dagen, med slutdatumet, och kalenderfilen är oförändrad", async () => {
    await switchAccount(page, ADMIN);
    const title = `E2E-heldag ${uniqueId()}`;
    const [first, last] = [dayOffset(-4), dayOffset(0)];
    // Datumfältet ger slutdagen klockslaget 00:00. Klockan har alltså passerat det hela den sista dagen.
    const { url, slug } = await createEvent({ title, startsAt: `${first}T00:00`, endsAt: `${last}T00:00`, allDay: true });
    const label = `Heldag t.o.m. ${longDate(last, first.slice(0, 4) !== last.slice(0, 4))}`;

    await site.goto(`${BASE}/evenemang`);
    // Kommande är kort med en h3. Under Tidigare evenemang står samma länk som en rad utan.
    const card = site.locator(`main a[href="/evenemang/${slug}"]:has(h3)`);
    await card.waitFor();
    assert.ok((await card.innerText()).includes(label), `kortet ska visa "${label}"`);

    await site.goto(`${BASE}/evenemang/${slug}`);
    await site.getByText(label).first().waitFor();

    await page.goto(`${BASE}/admin/evenemang`);
    await page.getByText(title).first().waitFor();

    const feed = await (await site.request.get(`${BASE}/kalender.ics`)).text();
    const event = feed.split("BEGIN:VEVENT").find((v) => v.includes(`/evenemang/${slug}`));
    assert.ok(event, "evenemanget ska finnas i kalenderfilen");
    assert.ok(event.includes(`DTSTART;VALUE=DATE:${first.replaceAll("-", "")}`), "DTSTART ska vara första dagen");
    assert.ok(event.includes(`DTEND;VALUE=DATE:${dayOffset(1).replaceAll("-", "")}`), "DTEND ska vara dagen efter sista dagen");
    await removeItem(url);
  });

  await step("SB-01: en heldag jämför bara datumen, så slut 00:00 samma dag går att spara och visas som Heldag", async () => {
    const day = dayOffset(1);
    const { url, slug } = await createEvent({ title: `E2E-heldag ${uniqueId()}`, startsAt: `${day}T18:00`, endsAt: `${day}T00:00`, allDay: true });
    await site.goto(`${BASE}/evenemang/${slug}`);
    await site.getByText("Heldag", { exact: true }).first().waitFor();
    await removeItem(url);
  });

  await step("SB-06: starta-terminen räknas inte som STAR, och mässan som valts under STAR visas på företagssidan", async () => {
    await switchAccount(page, ADMIN);
    const starLinks = () => site.locator('main a[href^="/evenemang/"]');

    // Evenemanget ligger före den seedade mässan och har "star" i adressen.
    const starta = await createEvent({ title: `Starta terminen ${uniqueId()}`, startsAt: `${dayOffset(1)}T18:00` });
    await site.goto(`${BASE}/foretag`);
    await starLinks().first().waitFor();
    assert.deepEqual(await starLinks().evaluateAll((els) => els.map((a) => a.getAttribute("href"))), ["/evenemang/star"]);

    // Långt bort och utan "star" i adressen: bara valet under STAR kan peka ut det.
    const massan = await createEvent({ title: `E2E-mässan ${uniqueId()}`, startsAt: `${dayOffset(400)}T10:00` });
    const save = async (value) => {
      await page.goto(`${BASE}/admin/star`);
      const texts = page.locator("summary", { hasText: "Evenemang och texter på sidan" });
      await waitForHydration(page, texts);
      await texts.click();
      await page.selectOption('select[name="star_event_id"]', value);
      await page.getByRole("button", { name: "Spara texterna" }).click();
      await page.getByText("Texterna är sparade.").waitFor();
    };
    await save(massan.url.split("/").pop());
    await site.goto(`${BASE}/foretag`);
    await site.locator(`main a[href="/evenemang/${massan.slug}"]`).waitFor();

    await save("");
    await removeItem(massan.url);
    await removeItem(starta.url);
  });

  await step("SB-07: ett evenemang som startade i går och slutar i morgon visar Pågår på kortet och sidan", async () => {
    await switchAccount(page, ADMIN);
    const { url, slug } = await createEvent({ title: `E2E-pågår ${uniqueId()}`, startsAt: `${dayOffset(-1)}T18:00`, endsAt: `${dayOffset(1)}T15:00` });
    await assertOngoing(slug);
    await removeItem(url);
  });

  await step("SB-07: en heldag visar Pågår hela sista dagen, inte Har varit", async () => {
    const { url, slug } = await createEvent({ title: `E2E-pågår ${uniqueId()}`, startsAt: `${dayOffset(-4)}T00:00`, endsAt: `${dayOffset(0)}T00:00`, allDay: true });
    await assertOngoing(slug);
    await removeItem(url);
  });

  await step("SB-08: rutan Kommande evenemang räknar alla kommande, inte bara de sex som visas på startsidan", async () => {
    await site.goto(`${BASE}/evenemang`);
    const cards = site.locator('main a[href^="/evenemang/"]:has(h3)');
    await cards.first().waitFor();
    const upcoming = await cards.count();
    assert.ok(upcoming > 6, `seeden ska ha fler än sex kommande för att testet ska säga något, är ${upcoming}`);
    await site.goto(BASE);
    // Siffrorna i heron är en lista med talet först på varje rad. Talet räknas upp, så raden väntas in tills det har stannat på rätt värde.
    await site.locator("section[data-startsida] li", { hasText: "Kommande evenemang" }).locator("span.display").filter({ hasText: new RegExp(`^${upcoming}$`) }).waitFor();
  });

  await step("SB-22: strukturerad data har tidszon, bara datum vid heldag, och sektionens adress och beskrivningen som reserv", async () => {
    const schemaEvent = async (slug) => {
      await site.goto(`${BASE}/evenemang/${slug}`);
      const blocks = await site.locator('script[type="application/ld+json"]').evaluateAll((els) => els.map((s) => JSON.parse(s.textContent)));
      return blocks.find((b) => b["@type"] === "Event");
    };
    await switchAccount(page, ADMIN);
    await page.goto(`${BASE}/admin/installningar`);
    const address = await page.inputValue('input[name="address"]');
    assert.ok(address, "sektionen ska ha en adress");

    // Fasta datum långt fram, så att tidszonen inte beror på när testet körs.
    const kvall = await createEvent({ title: `E2E-data ${uniqueId()}`, startsAt: "2031-07-10T18:00", endsAt: "2031-07-10T21:00", summary: "", body: "Hela **texten** om kvällen." });
    const sommar = await schemaEvent(kvall.slug);
    assert.equal(sommar.startDate, "2031-07-10T18:00:00+02:00");
    assert.equal(sommar.endDate, "2031-07-10T21:00:00+02:00");
    assert.equal(sommar.location.address, address, "utan plats ska sektionens adress användas");
    assert.equal(sommar.description, "Hela texten om kvällen.", "utan sammanfattning ska beskrivningen användas");
    await removeItem(kvall.url);

    const heldag = await createEvent({ title: `E2E-data ${uniqueId()}`, startsAt: "2031-12-10T00:00", endsAt: "2031-12-12T00:00", allDay: true, location: "Kårallen" });
    const vinter = await schemaEvent(heldag.slug);
    assert.equal(vinter.startDate, "2031-12-10");
    assert.equal(vinter.endDate, "2031-12-12");
    assert.equal(vinter.location.address, "Kårallen");
    assert.equal(vinter.description, "Skapat av det automatiska testet.");
    await removeItem(heldag.url);
  });

  await step("SB-23: kalendern visar bara månader inom två år, och bläddringen stannar vid gränsen", async () => {
    const [year, month] = today.split("-").map(Number);
    const manad = `${String(month).padStart(2, "0")}`;
    const heading = (y) => {
      const name = new Intl.DateTimeFormat("sv-SE", { timeZone: "UTC", month: "long" }).format(new Date(Date.UTC(y, month - 1, 1)));
      return site.getByRole("heading", { level: 2, name: `${name[0].toUpperCase()}${name.slice(1)} ${y}`, exact: true });
    };
    const next = site.getByRole("link", { name: "Nästa månad" });
    const previous = site.getByRole("link", { name: "Föregående månad" });

    await site.goto(`${BASE}/evenemang?vy=kalender&manad=1999-01`);
    await heading(year).waitFor();
    assert.equal(await next.getAttribute("rel"), "nofollow");
    assert.equal(await previous.getAttribute("rel"), "nofollow");

    await site.goto(`${BASE}/evenemang?vy=kalender&manad=${year + 2}-${manad}`);
    await heading(year + 2).waitFor();
    assert.equal(await next.count(), 0, "nästa månad ligger utanför gränsen");
    await site.getByRole("button", { name: "Nästa månad", disabled: true }).waitFor();
    await previous.waitFor();

    await site.goto(`${BASE}/evenemang?vy=kalender&manad=${year - 2}-${manad}`);
    await heading(year - 2).waitFor();
    assert.equal(await previous.count(), 0, "förra månaden ligger utanför gränsen");
    await next.waitFor();
  });

  await step("SB-25: ett evenemang över en månadsgräns syns i båda månaderna, men en kväll som slutar efter midnatt bara i den första", async () => {
    await switchAccount(page, ADMIN);
    const [year, month] = today.split("-").map(Number);
    // Första dagen i månaden efter nästa: båda månaderna ligger framåt och inom kalenderns gräns.
    const first = new Date(Date.UTC(year, month + 1, 1));
    const day = (offset) => new Date(first.getTime() + offset * 86_400_000).toISOString().slice(0, 10);
    const [before, after] = [day(-1).slice(0, 7), day(0).slice(0, 7)];
    const trip = await createEvent({ title: `E2E-resa ${uniqueId()}`, startsAt: `${day(-3)}T10:00`, endsAt: `${day(2)}T16:00` });
    const pub = await createEvent({ title: `E2E-pub ${uniqueId()}`, startsAt: `${day(-1)}T20:00`, endsAt: `${day(0)}T01:00` });

    // Under md visas månaden som en lista i stället för ett rutnät.
    const phone = await newVisitor(browser);
    await phone.page.setViewportSize({ width: 390, height: 844 });
    const listed = async (manad, { slug }) => {
      await phone.page.goto(`${BASE}/evenemang?vy=kalender&manad=${manad}`);
      // Innehållet strömmas och visas strax efter load, så vänta på det innan något räknas.
      await phone.page.getByRole("navigation", { name: "Vy" }).waitFor();
      return phone.page.locator(`main a[href="/evenemang/${slug}"]:visible`).count();
    };
    assert.equal(await listed(before, trip), 1, "resan ska listas under månaden den börjar i");
    assert.equal(await listed(after, trip), 1, "resan ska listas under månaden den slutar i");
    assert.equal(await listed(before, pub), 1, "puben ska listas under månaden den börjar i");
    assert.equal(await listed(after, pub), 0, "puben ska inte listas under månaden efter");
    await phone.context.close();

    // Rutnätet ska säga samma sak: resan ligger på månadens tre första dagar.
    await site.goto(`${BASE}/evenemang?vy=kalender&manad=${after}`);
    await site.getByRole("navigation", { name: "Vy" }).waitFor();
    const cells = await site.locator(`main .grid-cols-7 a[href="/evenemang/${trip.slug}"]`).count();
    assert.ok(cells >= 3, `resan ska synas på sina dagar i rutnätet, syns på ${cells}`);

    // Klockslaget hör till startdagen. De andra dagarna pågår resan redan.
    await site.goto(`${BASE}/evenemang?vy=kalender&manad=${before}`);
    await site.getByRole("navigation", { name: "Vy" }).waitFor();
    const times = await site.locator(`main .grid-cols-7 a[href="/evenemang/${trip.slug}"]`).evaluateAll((links) => links.flatMap((a) => a.textContent.match(/\d\d:\d\d/) ?? []));
    assert.deepEqual(times, ["10:00"], `klockslaget ska bara stå på startdagen, i rutnätet står: ${times}`);

    await removeItem(pub.url);
    await removeItem(trip.url);
  });

  await step("SB-25: ett album med en bild visar 1 bild, och bildvisaren förinläser samma bild som den sedan visar", async () => {
    const image = (background) => sharp({ create: { width: 2400, height: 1600, channels: 3, background } }).jpeg({ quality: 80 }).toBuffer();
    const upload = async (buffers, total) => {
      await page.locator('input[aria-label="Välj bilder till galleriet"]').setInputFiles(buffers.map((buffer, i) => ({ name: `e2e-${total}-${i}.jpg`, mimeType: "image/jpeg", buffer })));
      await page.waitForFunction((n) => document.querySelectorAll('input[aria-label="Bildtext"]').length === n, total, { timeout: 30000 });
    };
    const album = await createEvent({ title: `E2E-album ${uniqueId()}`, startsAt: `${dayOffset(-30)}T18:00` });
    await upload([await image("#2e3192")], 1);

    await site.goto(`${BASE}/galleri`);
    await site.locator(`main a[href^="/evenemang/${album.slug}"]`).getByText("1 bild", { exact: true }).waitFor();

    await upload([await image("#fbb03b"), await image("#ff0707")], 3);
    await site.goto(`${BASE}/galleri`);
    await site.locator(`main a[href^="/evenemang/${album.slug}"]`).getByText("3 bilder", { exact: true }).waitFor();

    await site.goto(`${BASE}/evenemang/${album.slug}`);
    const thumbnail = site.locator('#galleri button[aria-label^="Visa bild 1"]');
    await waitForHydration(site, thumbnail);
    await thumbnail.click();
    const dialog = site.getByRole("dialog");
    await dialog.waitFor();
    await site.waitForLoadState("networkidle");
    const fetched = await site.evaluate(() => performance.getEntriesByType("resource").map((r) => new URL(r.name).pathname));
    const shownBefore = await dialog.locator("img").evaluate((img) => img.currentSrc);
    await site.keyboard.press("ArrowRight");
    await site.waitForFunction((before) => {
      const img = document.querySelector('[role="dialog"] img');
      return img && img.complete && img.currentSrc && img.currentSrc !== before;
    }, shownBefore);
    const shown = new URL(await dialog.locator("img").evaluate((img) => img.currentSrc)).pathname;
    assert.ok(fetched.includes(shown), `bilden som visas, ${shown}, ska redan vara hämtad`);
    await site.keyboard.press("Escape");

    await removeItem(album.url);
  });

  await step("SB-25: Kalenderflöde i länklistan laddas direkt, utan att Next först försöker hämta filen som en sida", async () => {
    const pageRequests = [];
    const onRequest = (request) => {
      if (request.url().includes("/kalender.ics") && request.url().includes("_rsc=")) pageRequests.push(request.url());
    };
    site.on("request", onRequest);
    await site.goto(`${BASE}/studenter/lankar`);
    const link = site.locator('main a[href="/kalender.ics"]').first();
    await waitForHydration(site, link);
    assert.equal(await link.getAttribute("target"), null, "filen är inte en extern sida och ska inte öppnas i en ny flik");
    const fetched = site.waitForRequest((request) => new URL(request.url()).pathname === "/kalender.ics" && !request.url().includes("_rsc="));
    await link.click();
    await fetched;
    site.off("request", onRequest);
    assert.equal(pageRequests.length, 0, `Next hämtade filen som en sida: ${pageRequests[0]}`);
  });

  await step("ST-02: en nyhets publiceringstid visas lika i admin och på sajten, runt sommartidens hopp och midnatt", async () => {
    await switchAccount(page, ADMIN);
    const cases = [
      // Klockan hoppar från 02:00 till 03:00 den här natten, så 02:30 finns inte och är samma ögonblick som 03:30.
      { typed: "2026-03-29T02:30", shown: "2026-03-29T03:30", iso: "2026-03-29T01:30:00.000Z" },
      // I UTC är det fortfarande dagen innan, men på sajten ska datumet vara det som står i Sverige.
      { typed: "2026-03-29T00:30", shown: "2026-03-29T00:30", iso: "2026-03-28T23:30:00.000Z" },
    ];
    for (const { typed, shown, iso } of cases) {
      await openForm(`${BASE}/admin/nyheter/ny`);
      await page.fill('input[name="title"]', `E2E-nyhet ${uniqueId()}`);
      await page.fill('textarea[name="excerpt"]', "Skapad av det automatiska testet.");
      await openDetails();
      await page.fill('input[name="published_at"]', typed);
      await Promise.all([page.waitForURL(/\/admin\/nyheter\/\d+\?skapad=1/), page.getByRole("button", { name: "Publicera", exact: true }).click()]);
      const url = page.url().split("?")[0];
      // Efter omdirigeringen ligger det gamla formuläret kvar dolt en stund, med det som skrevs. Ladda om för att läsa det som sparades.
      await page.reload();
      const slug = await page.inputValue('input[name="slug"]');
      assert.equal(await page.inputValue('input[name="published_at"]'), shown, "tiden i formuläret");

      await site.goto(`${BASE}/nyheter/${slug}`);
      await site.locator(`main time[datetime="${iso}"]`, { hasText: "29 mars 2026" }).first().waitFor();

      await removeItem(url);
    }
  });

  await step("Ett nytt evenemang erbjuder nästa steg tills det sparas igen, och ett utkast har en egen flik men ingen sida att visa", async () => {
    await switchAccount(page, ADMIN);
    const title = `E2E-nästa ${uniqueId()}`;
    const { url } = await createEvent({ title, startsAt: `${dayOffset(20)}T18:00` });
    const created = page.getByRole("status").filter({ hasText: "Evenemanget är publicerat!" });
    await created.waitFor();
    await created.getByRole("link", { name: "Ladda upp bilder" }).waitFor();
    await created.getByRole("link", { name: "Visa på sajten" }).waitFor();

    // Affischen beställs med evenemanget redan ifyllt.
    await Promise.all([page.waitForURL(/\/admin\/uppdrag\/ny/), created.getByRole("link", { name: "Be om affisch" }).click()]);
    const taskTitle = page.locator('main input[name="title"]:visible');
    await taskTitle.waitFor();
    assert.equal(await taskTitle.inputValue(), `Affisch: ${title}`);
    assert.equal(await page.locator('select[name="event_id"]:visible').inputValue(), url.split("/").pop());
    assert.equal(await page.locator('input[name="due_date"]:visible').inputValue(), dayOffset(13), "en vecka före evenemanget");

    await openForm(`${url}?skapad=1`);
    await created.waitFor();
    await page.getByRole("button", { name: "Spara ändringar" }).click();
    await page.getByText("Sparat och publicerat.").waitFor();
    await created.waitFor({ state: "detached" });

    await page.getByRole("button", { name: "Gör till utkast" }).click();
    await page.getByText("Sparat som utkast.").waitFor();
    await page.getByRole("link", { name: "Visa sidan" }).waitFor({ state: "hidden" });
    await page.goto(`${BASE}/admin/evenemang?visa=utkast`);
    await page.locator("tbody tr", { hasText: title }).waitFor();
    await removeItem(url);
  });

  await step("Ett ogranskat evenemang går att granska direkt i listan, och raden försvinner", async () => {
    await switchAccount(page, "scb@statlin.se");
    const title = `E2E-granska ${uniqueId()}`;
    const { url } = await createEvent({ title, startsAt: `${dayOffset(20)}T18:00` });
    await switchAccount(page, ADMIN);
    await page.goto(`${BASE}/admin/evenemang?visa=ogranskade`);
    const row = page.locator("tbody tr:visible", { hasText: title });
    const button = row.getByRole("button", { name: "Granskad" });
    await waitForHydration(page, button);
    await button.click();
    await row.waitFor({ state: "detached" });
    await removeItem(url);
  });

  await step("Ett evenemang går att kopiera: texterna följer med men inte omslag och anmälan, och sluttiden följer starten", async () => {
    await switchAccount(page, ADMIN);
    const title = `E2E-kopia ${uniqueId()}`;
    const { url } = await createEvent({ title, startsAt: `${dayOffset(-30)}T17:30`, endsAt: `${dayOffset(-30)}T23:00`, location: "Kårallen" });
    await page.fill('input[name="signup_url"]', "https://example.com/anmalan");
    await page.getByRole("button", { name: "Spara ändringar" }).click();
    await page.getByText("Sparat och publicerat.").waitFor();

    await page.goto(`${BASE}/admin/evenemang?visa=tidigare`);
    await Promise.all([page.waitForURL(/\/admin\/evenemang\/ny\?fran=\d+/), page.locator("tbody tr:visible", { hasText: title }).getByRole("link", { name: /^Kopiera/ }).click()]);
    await page.getByText(`Kopia av ${title}`).waitFor();
    await waitForHydration(page, page.locator('input[name="title"]:visible'));
    assert.equal(await page.inputValue('input[name="title"]:visible'), title);
    assert.equal(await page.inputValue('input[name="location"]:visible'), "Kårallen");
    assert.equal(await page.inputValue('input[name="starts_at"]:visible'), `${dayOffset(7)}T17:30`, "starten ska flyttas fram men behålla klockslaget");
    await page.locator("summary:visible", { hasText: "Fler detaljer" }).waitFor();
    const main = page.locator("main#innehall");
    assert.equal(await main.locator('input[name="ends_at"]').inputValue(), `${dayOffset(7)}T23:00`, "sluttiden ska flyttas lika långt");
    assert.equal(await main.locator('input[name="signup_url"]').inputValue(), "", "anmälningslänken gällde det gamla evenemanget");

    await page.fill('input[name="starts_at"]:visible', `${dayOffset(30)}T17:30`);
    assert.equal(await main.locator('input[name="ends_at"]').inputValue(), `${dayOffset(30)}T23:00`, "sluttiden ska följa med när datumet ändras");

    await page.fill('input[name="title"]:visible', `${title} igen`);
    await Promise.all([page.waitForURL(/\/admin\/evenemang\/\d+\?skapad=1/), page.getByRole("button", { name: "Publicera", exact: true }).click()]);
    await page.getByText("Evenemanget är publicerat!").waitFor();
    assert.equal(await page.inputValue('input[name="slug"]:visible'), slugOf(`${title} igen`), "kopian ska få en egen adress");
    await removeItem(page.url().split("?")[0]);
    await removeItem(url);
  });

  await visitor.context.close();
}

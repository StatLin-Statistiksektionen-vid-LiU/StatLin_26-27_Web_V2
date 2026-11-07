// Metadata, språk och JavaScript på de publika sidorna: det som ska fungera också utan JavaScript, innan det har laddats och på de engelska sidorna.
import assert from "node:assert";
import { createEditor, newVisitor, waitForHydration } from "../e2e-hjalp.mjs";

const ADMIN = "admin@statlin.se";

export default async function metadataSteg({ BASE, browser, page, step, switchAccount }) {
  await step("Fel lösenord utan JavaScript visar inloggningssidan med felmeddelandet (SB-27)", async () => {
    const { context, page: visitor } = await newVisitor(browser, { javaScriptEnabled: false });
    await visitor.goto(`${BASE}/logga-in?next=/admin/evenemang`);
    await visitor.fill("#email", "finns-inte@statlin.se");
    await visitor.fill("#password", "ett-felaktigt-losenord");
    await visitor.click('button[type="submit"]');
    await visitor.getByText("Fel e-postadress eller lösenord.").waitFor({ timeout: 15_000 });
    await visitor.locator("#email").waitFor();
    assert.equal(await visitor.locator('input[name="next"]').getAttribute("value"), "/admin/evenemang", "Sidan man kom från ska följa med");
    assert.ok(!visitor.url().includes("finns-inte"), `E-postadressen ska inte stå i adressen: ${visitor.url()}`);
    await context.close();
  });

  await step("Rätt lösenord utan JavaScript loggar in", async () => {
    await switchAccount(page, ADMIN);
    const { email, password } = await createEditor(page, BASE);
    const { context, page: visitor } = await newVisitor(browser, { javaScriptEnabled: false });
    await visitor.goto(`${BASE}/logga-in`);
    await visitor.fill("#email", email);
    await visitor.fill("#password", password);
    await visitor.click('button[type="submit"]');
    await visitor.waitForURL(/\/admin\/konto\?byt=1/, { timeout: 15_000 });

    // Redan inloggad på inloggningssidan: utan JavaScript får sidan inte bli tom, och med JavaScript går besökaren vidare.
    const session = await context.cookies();
    await visitor.goto(`${BASE}/logga-in`);
    assert.notEqual((await visitor.locator("body").innerText()).trim(), "", "Inloggad utan JavaScript gav en tom sida");
    const withScript = await newVisitor(browser);
    await withScript.context.addCookies(session);
    await withScript.page.goto(`${BASE}/logga-in`);
    await withScript.page.waitForURL(/\/admin/, { timeout: 15_000 });
    await withScript.context.close();
    await context.close();
  });

  await step("Bara kända felkoder i adressen ger en text på inloggningssidan", async () => {
    const { context, page: visitor } = await newVisitor(browser, { javaScriptEnabled: false });
    const alertText = async (query) => {
      await visitor.goto(`${BASE}/logga-in?${query}`);
      return visitor.locator('form [role="alert"]').allTextContents();
    };
    assert.deepEqual(await alertText("fel=forsok"), ["För många inloggningsförsök. Vänta en stund och försök igen."]);
    assert.deepEqual(await alertText("fel=avstangt"), ["Kontot är avstängt. Kontakta en administratör."]);
    for (const query of ["fel=constructor", "fel=__proto__", "fel=Ring+oss+p%C3%A5+070", "fel=a&fel=b"]) {
      const res = await visitor.goto(`${BASE}/logga-in?${query}`);
      assert.equal(res.status(), 200, `${query} gav status ${res.status()}`);
      assert.equal(await visitor.locator('form [role="alert"]').count(), 0, `${query} ska inte visa någon text`);
    }
    await context.close();
  });

  await step("Utan JavaScript visar /dokument sina dokument och sidfoten kontaktuppgifterna (SB-27)", async () => {
    const { context, page: visitor } = await newVisitor(browser, { javaScriptEnabled: false });
    for (const path of ["/", "/dokument", "/kontakt"]) {
      await visitor.goto(`${BASE}${path}`);
      const mail = visitor.locator('footer a[href^="mailto:"]').first();
      assert.ok(await mail.isVisible(), `${path}: sidfoten saknar e-postadressen`);
    }
    await visitor.goto(`${BASE}/dokument`);
    assert.equal(await visitor.locator("main h1").count(), 1, "/dokument saknar rubrik");
    assert.ok((await visitor.locator('main li a[target="_blank"]').count()) > 0, "/dokument visar inga dokument");
    assert.equal(await visitor.locator("main .animate-pulse").count(), 0, "/dokument visar ett skelett");
    await context.close();
  });

  await step("Utan JavaScript säger en sida med skelett varför innehållet saknas (SB-27)", async () => {
    const { context, page: visitor } = await newVisitor(browser, { javaScriptEnabled: false });
    await visitor.goto(`${BASE}/sektionen`);
    // getByText letar inte i noscript, och innerText ger bara det som syns.
    const notes = (await visitor.locator("main").innerText()).match(/behöver JavaScript/g) ?? [];
    assert.equal(notes.length, 1, `Beskedet står ${notes.length} gånger`);
    const shown = await visitor.locator(".animate-pulse:visible").count();
    assert.equal(shown, 0, `${shown} skelettblock pulserar för evigt`);
    await visitor.goto(`${BASE}/en/masters`);
    assert.match(await visitor.locator("main").innerText(), /needs JavaScript/, "De engelska sidorna ska säga det på engelska");

    // Den mörka toppen ligger i det som saknas, så sidhuvudets vita text behöver en egen bakgrund för att synas.
    await visitor.goto(`${BASE}/kontakt`);
    const headerBackground = await visitor.locator("header").first().evaluate((el) => getComputedStyle(el).backgroundColor);
    assert.notEqual(headerBackground, "rgba(0, 0, 0, 0)", "Sidhuvudet är genomskinligt, och menyn syns inte mot den ljusa sidan");
    await context.close();
  });

  await step("Med JavaScript syns varken beskedet eller standardvärdena, och /dokument går att nå inom sajten", async () => {
    const { context, page: visitor } = await newVisitor(browser);
    await visitor.goto(`${BASE}/sektionen`);
    await visitor.locator("main h1").waitFor();
    assert.ok(!(await visitor.locator("body").innerText()).includes("behöver JavaScript"), "Beskedet till besökare utan JavaScript syns");
    await waitForHydration(visitor, visitor.locator('footer a[href="/dokument"]'));
    await visitor.locator('footer a[href="/dokument"]').click();
    await visitor.waitForURL(/\/dokument$/);
    await visitor.locator('main li a[target="_blank"]:visible').first().waitFor();
    await context.close();
  });

  await step("Språkväxlaren leder till motsvarande sida på det andra språket (SB-21)", async () => {
    const { context, page: visitor } = await newVisitor(browser);
    const pairs = [
      ["/", "/en"],
      ["/en", "/"],
      ["/studenter/master", "/en/masters"],
      ["/en/masters", "/studenter/master"],
      ["/evenemang", "/en"],
    ];
    for (const [from, to] of pairs) {
      await visitor.goto(`${BASE}${from}`);
      // Rubriken är ett av hålen i skalet, så när den syns har menyn också fått adressen. På datorn sitter språklänken i sidomenyn.
      await visitor.locator("main h1").first().waitFor();
      const link = visitor.locator("aside a[hreflang]").first();
      await waitForHydration(visitor, link);
      assert.equal(await link.getAttribute("href"), to, `Från ${from}`);
    }
    await context.close();
  });

  await step("Datumen på /en/masters är på engelska och på /studenter/master på svenska (SB-29)", async () => {
    const { context, page: visitor } = await newVisitor(browser);
    await visitor.goto(`${BASE}/en/masters`);
    const rows = visitor.locator('main a[href^="/evenemang/"]:not([href$=".ics"])');
    await rows.first().waitFor();
    const english = (await rows.allInnerTexts()).join(" ");
    assert.match(english, /\b(mon|tue|wed|thu|fri|sat|sun)\b/i, `Ingen engelsk veckodag i: ${english}`);
    assert.doesNotMatch(english, /\b(mån|tis|ons|tors|fre|lör|sön|heldag)\b/i, `Svenska i: ${english}`);
    await visitor.goto(`${BASE}/studenter/master`);
    await rows.first().waitFor();
    const swedish = (await rows.allInnerTexts()).join(" ");
    assert.match(swedish, /(mån|tis|ons|tors|fre|lör|sön)/i, `Ingen svensk veckodag i: ${swedish}`);
    await context.close();
  });

  await step("Innehållet syns också när sidans JavaScript inte laddas (SB-03)", async () => {
    const { context, page: visitor } = await newVisitor(browser);
    await visitor.route("**/_next/static/**/*.js", (route) => route.abort());
    for (const path of ["/", "/evenemang"]) {
      await visitor.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
      await visitor.locator(".reveal").first().waitFor({ state: "attached" });
      // Hålen i skalet byts in av Reacts inline-skript, som körs också utan sidans egna filer.
      await visitor.waitForTimeout(1000);
      const hidden = await visitor.locator(".reveal").evaluateAll((els) => els.filter((el) => getComputedStyle(el).opacity !== "1").length);
      assert.equal(hidden, 0, `${path}: ${hidden} block är dolda`);
    }
    await context.close();
  });

  await step("Det besökaren redan ser försvinner inte när långsamt JavaScript tar över (SB-03)", async () => {
    const { context, page: visitor } = await newVisitor(browser);
    // Räknar varje bildruta där ett block i bild som redan har synts inte längre syns helt.
    await context.addInitScript(() => {
      window.__dips = [];
      const seen = new WeakSet();
      const tick = () => {
        for (const el of document.querySelectorAll(".reveal")) {
          const box = el.getBoundingClientRect();
          if (box.height === 0 || box.top >= innerHeight) continue;
          const opacity = Number(getComputedStyle(el).opacity);
          if (opacity === 1) seen.add(el);
          else if (seen.has(el)) window.__dips.push(opacity);
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await visitor.route("**/_next/static/**/*.js", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      await route.continue();
    });
    await visitor.goto(`${BASE}/evenemang`, { waitUntil: "domcontentloaded" });
    const first = visitor.locator(".reveal").first();
    await first.waitFor();
    assert.equal(await first.evaluate((el) => Object.keys(el).some((k) => k.startsWith("__react"))), false, "Sidan hann hydreras: fördröjningen prövar inget");
    assert.equal(await first.evaluate((el) => getComputedStyle(el).opacity), "1", "Innehållet är dolt innan JavaScript har laddats");
    await waitForHydration(visitor, first);
    await visitor.waitForTimeout(500);
    const dips = await visitor.evaluate(() => window.__dips.length);
    assert.equal(dips, 0, `Innehåll i bild blinkade till i ${dips} bildrutor`);
    await context.close();
  });

  await step("Längre ner på sidan tonar innehållet in när man scrollar dit (SB-03)", async () => {
    const { context, page: visitor } = await newVisitor(browser);
    await visitor.goto(`${BASE}/`);
    const last = visitor.locator(".reveal").last();
    await last.waitFor({ state: "attached" });
    await waitForHydration(visitor, last);
    await visitor.waitForFunction((el) => el.dataset.hydrated !== undefined, await last.elementHandle());
    assert.equal(await last.evaluate((el) => getComputedStyle(el).opacity), "0", "Blocket under sidans slut ska vara dolt");
    await last.scrollIntoViewIfNeeded();
    await visitor.waitForFunction((el) => el.dataset.shown === "true", await last.elementHandle());
    await visitor.waitForFunction((el) => getComputedStyle(el).opacity === "1", await last.elementHandle());
    await context.close();
  });

  await step("Vid sidbyte inom sajten tonar också det som syns direkt in (SB-03)", async () => {
    const { context, page: visitor } = await newVisitor(browser);
    await visitor.goto(`${BASE}/dokument`);
    const link = visitor.locator('footer a[href="/nyheter"]');
    await waitForHydration(visitor, link);
    await link.click();
    await visitor.waitForURL(/\/nyheter$/);
    const inView = visitor.locator('main:has(a[href^="/nyheter/"]) .reveal:visible').first();
    await inView.waitFor();
    await visitor.waitForFunction((el) => el.dataset.hydrated !== undefined, await inView.elementHandle());
    await context.close();
  });

  await step("Rubriker på nivå fem och sex blir h4 i förhandsgranskningen (SB-17)", async () => {
    await switchAccount(page, ADMIN);
    const { context, page: tab } = await newVisitor(browser);
    await context.addCookies(await page.context().cookies());
    await tab.goto(`${BASE}/admin/nyheter/ny`);
    await waitForHydration(tab, tab.locator('input[name="title"]'));
    await tab.fill('textarea[name="body_md"]', "##### Femma\n\n###### Sexa\n\nBrödtext");
    await tab.getByRole("button", { name: "Förhandsgranska" }).click();
    const preview = tab.locator("form .prose-statlin");
    await preview.getByText("Brödtext").waitFor();
    assert.deepEqual(await preview.locator("h4").allTextContents(), ["Femma", "Sexa"]);
    const weight = (locator) => locator.evaluate((el) => Number(getComputedStyle(el).fontWeight));
    const [heading, text] = [await weight(preview.locator("h4").first()), await weight(preview.getByText("Brödtext"))];
    assert.ok(heading > text, `Rubriken ser ut som vanlig text: vikt ${heading} mot ${text}`);
    await context.close();
  });

  await step("Sökrutan hämtar kurskoderna igen efter ett tomt svar eller ett fel, utan omladdning (SB-18)", async () => {
    const { context, page: visitor } = await newVisitor(browser);
    let answer;
    let requests = 0;
    await visitor.route("**/api/tentastatistik/koder", (route) => {
      requests++;
      return route.fulfill(answer);
    });
    const codes = { json: ["732G33", "732G34", "TATA24"] };
    // Sidan behöver ett ögonblick för att läsa ett svar. Så länge hör tecken och fokus till hämtningen som pågår, och ingen ny går i väg.
    const pageHasRead = () => visitor.waitForTimeout(200);
    const open = async (first) => {
      answer = first;
      requests = 0;
      await visitor.goto(`${BASE}/tentastatistik`);
      const input = visitor.getByRole("combobox", { name: "Kurskod" });
      // Skalet har en egen ruta som byts ut när resten av sidan kommer, så elementet slås upp på nytt tills rutan som gäller är hydrerad.
      await visitor.waitForFunction(() => {
        const el = document.querySelector('input[name="kod"]');
        return el && Object.keys(el).some((k) => k.startsWith("__react"));
      });
      const answered = visitor.waitForResponse("**/api/tentastatistik/koder");
      await input.focus();
      await answered;
      await pageHasRead();
      return input;
    };
    const option = visitor.getByRole("option", { name: "732G33" });

    // Det tomma svaret: rutan har fortfarande fokus när källan är tillbaka, så nästa tecken ska försöka igen.
    let input = await open({ json: [] });
    answer = codes;
    await input.pressSequentially("73");
    await option.waitFor({ timeout: 5000 });
    assert.equal(requests, 2, "Ett fungerande svar ska inte hämtas igen");
    await input.pressSequentially("2G");
    await option.waitFor();
    assert.equal(requests, 2, "Listan ska hämtas en gång per sidvisning när den väl har kommit");

    // Felsvaret: besökaren lämnar rutan och kommer tillbaka.
    input = await open({ status: 500, body: "" });
    await input.pressSequentially("73");
    await pageHasRead();
    assert.equal(await option.count(), 0, "Inga förslag när hämtningen misslyckades");
    await input.blur();
    answer = codes;
    await input.focus();
    await option.waitFor({ timeout: 5000 });
    await context.close();
  });

  await step("Evenemang och nyheter länkar inte till ett dolt utskott, och dess sida röjer inte namnet (SB-20)", async () => {
    await switchAccount(page, ADMIN);
    const admin = await newVisitor(browser);
    await admin.context.addCookies(await page.context().cookies());
    const setVisible = async (visible) => {
      await admin.page.goto(`${BASE}/admin/utskott`);
      await admin.page.locator('a[href^="/admin/utskott/"]', { hasText: "SASU" }).click();
      const toggle = admin.page.locator('input[name="visible"]');
      await waitForHydration(admin.page, toggle);
      if ((await toggle.isChecked()) !== visible) await admin.page.locator('label:has(input[name="visible"])').click();
      await admin.page.getByRole("button", { name: "Spara", exact: true }).click();
      await admin.page.getByText("Utskottet är sparat.").waitFor();
    };

    const site = await newVisitor(browser);
    const links = async (path, href) => {
      await site.page.goto(`${BASE}${path}`);
      await site.page.locator("article h1").waitFor();
      return site.page.locator(`article a[href="${href}"]`).count();
    };
    const titleOf = async (path) => (await (await fetch(`${BASE}${path}`)).text()).match(/<title>([^<]*)/)?.[1] ?? "";

    assert.match(await titleOf("/utskott/sasu"), /SASU/);
    assert.equal(await links("/evenemang/star", "/utskott/sasu"), 2, "Evenemanget ska länka till ett synligt utskott");
    assert.equal(await links("/nyheter/star-anmalan-foretag", "/utskott/sasu"), 1, "Nyheten ska länka till ett synligt utskott");

    await setVisible(false);
    try {
      assert.equal(await links("/evenemang/star", "/utskott/sasu"), 0, "Evenemanget länkar till det dolda utskottet");
      assert.match(await site.page.locator("article header").innerText(), /SASU/, "Evenemanget ska visa arrangören");
      assert.equal(await site.page.locator("aside").getByText("Arrangör").count(), 1, "Evenemanget ska visa arrangören");
      assert.equal(await links("/nyheter/star-anmalan-foretag", "/utskott/sasu"), 0, "Nyheten länkar till det dolda utskottet");
      assert.match(await site.page.locator("article header").innerText(), /SASU/, "Nyheten ska visa arrangören");
      const title = await titleOf("/utskott/sasu");
      assert.equal(title, await titleOf("/utskott/finns-inte"), "Ett dolt utskott ska svara som ett som inte finns");
      assert.doesNotMatch(title, /SASU/);
    } finally {
      await setVisible(true);
    }
    assert.equal(await links("/evenemang/star", "/utskott/sasu"), 2, "Länkarna ska komma tillbaka");

    for (const path of ["/evenemang/hostmote", "/nyheter/valkommen-till-nya-statlin-se"]) {
      assert.ok((await links(path, "/sektionen/styrelsen")) > 0, `${path} ska länka till styrelsens sida`);
      assert.equal(await site.page.locator('article a[href="/utskott/styrelsen"]').count(), 0, `${path} länkar till /utskott/styrelsen`);
    }
    await site.context.close();
    await admin.context.close();
  });

  await step("Sloganen i sidfoten visar *ord* i rött och utan stjärnor (SB-28)", async () => {
    await switchAccount(page, ADMIN);
    const admin = await newVisitor(browser);
    await admin.context.addCookies(await page.context().cookies());
    const setTagline = async (text) => {
      await admin.page.goto(`${BASE}/admin/installningar`);
      const field = admin.page.locator('input[name="tagline"]');
      await waitForHydration(admin.page, field);
      const before = await field.inputValue();
      await field.fill(text);
      await admin.page.locator('form:has(input[name="tagline"]) button[type="submit"]').click();
      await admin.page.getByText("Inställningarna är sparade.").waitFor();
      return before;
    };
    const original = await setTagline("Sektionen för dig som läser *Statistics* vid LiU.");
    try {
      assert.equal(await admin.page.getByText(/Visas i sidfoten.*stjärnor/).count(), 1, "Fältet ska berätta om stjärnorna");
      const site = await newVisitor(browser);
      await site.page.goto(`${BASE}/`);
      const tagline = site.page.locator("footer p", { hasText: "Sektionen för dig" });
      await tagline.waitFor();
      assert.equal(await tagline.innerText(), "Sektionen för dig som läser Statistics vid LiU.");
      // I den nya sidfoten är ordet framhävt i bläckets färg mot den grå texten, inte längre i rött. Mörkt läge är standard, så bläcket är ljust.
      const red = tagline.getByText("Statistics", { exact: true });
      assert.equal(await red.evaluate((el) => getComputedStyle(el).color), "rgb(236, 235, 230)");
      assert.notEqual(await tagline.evaluate((el) => getComputedStyle(el).color), "rgb(236, 235, 230)", "ordet ska synas mot texten runt det");
      await site.context.close();
    } finally {
      await setTagline(original);
    }
    await admin.context.close();
  });
}

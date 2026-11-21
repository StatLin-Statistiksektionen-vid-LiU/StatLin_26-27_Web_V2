// Tangentbord, fokus, kalendern på startsidan och redigeringsbubblan, så som någon utan mus eller på telefon möter dem.
import assert from "node:assert";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { newVisitor, uniqueId, waitForHydration } from "../e2e-hjalp.mjs";

const ADMIN = "admin@statlin.se";
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

const focusedLabel = (page) => page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.textContent?.trim() ?? "");

export default async function tillganglighetSteg({ BASE, browser, page, step, switchAccount }) {
  await switchAccount(page, ADMIN);

  /** Kontext med samma inloggning som `page`, där guiden i bubblan inte har setts och inget hörn är sparat. */
  const freshBubble = async (options) => {
    const { cookies } = await page.context().storageState();
    const context = await browser.newContextWithGuide({ storageState: { cookies, origins: [] }, ...options });
    return { context, page: await context.newPage() };
  };

  await step("Mobilmenyn går att använda med tangentbordet: fokus stannar i menyn och kommer tillbaka", async () => {
    const { context, page: phone } = await newVisitor(browser, PHONE);
    await phone.goto(`${BASE}/`);
    const toggle = phone.getByRole("button", { name: "Öppna meny" });
    await waitForHydration(phone, toggle);
    await toggle.focus();
    await phone.keyboard.press("Enter");
    const menu = phone.getByRole("navigation", { name: "Mobilmeny" });
    await menu.waitFor();
    assert.equal(await phone.locator("main").first().evaluate((el) => !!el.closest("[inert]")), true, "sidan bakom menyn ska vara inert");
    for (let i = 0; i < 25; i++) {
      await phone.keyboard.press("Tab");
      const outside = await phone.evaluate(() => !!document.activeElement?.closest("main, footer"));
      assert.equal(outside, false, `fokus lämnade menyn efter ${i + 1} tabbar`);
    }
    await phone.keyboard.press("Escape");
    await menu.waitFor({ state: "hidden" });
    assert.equal(await focusedLabel(phone), "Öppna meny", "fokus ska komma tillbaka till knappen");
    assert.equal(await phone.locator("main").first().evaluate((el) => !!el.closest("[inert]")), false, "sidan ska släppas när menyn stängs");
    await context.close();
  });

  await step("Mobilmenyn släpper sidan när länken till inloggningen leder ut ur sajten", async () => {
    const { context, page: phone } = await newVisitor(browser, PHONE);
    // Länken går till /admin, som skickar den som inte är inloggad vidare till inloggningen. Sajten ber webbläsaren hämta allt över
    // https (upgrade-insecure-requests), och det gäller också det hoppet. Provservern har ingen https, så hoppet misslyckas där och
    // Next laddar då om hela sidan, vilket döljer felet som steget letar efter. Utan den raden går sidbytet som på den riktiga sajten.
    await context.route("**/*", async (route) => {
      if (route.request().resourceType() !== "document") return route.fallback();
      const response = await route.fetch({ maxRedirects: 0 });
      const headers = { ...response.headers() };
      if (headers["content-security-policy"]) headers["content-security-policy"] = headers["content-security-policy"].replace(/upgrade-insecure-requests;?/g, "");
      await route.fulfill({ response, headers });
    });
    const until = (fn, message) => phone.waitForFunction(fn, null, { timeout: 5000 }).catch(() => assert.fail(message));
    await phone.goto(`${BASE}/`);
    const toggle = phone.getByRole("button", { name: "Öppna meny" });
    await waitForHydration(phone, toggle);
    await toggle.tap();
    const menu = phone.getByRole("navigation", { name: "Mobilmeny" });
    await menu.waitFor();
    assert.equal(await phone.evaluate(() => document.documentElement.style.overflow), "hidden", "sidan bakom den öppna menyn ska inte gå att scrolla");
    // Märket försvinner om webbläsaren laddar om sidan. Då har steget inte provat sidbytet som det är till för.
    await phone.evaluate(() => (window.sammaDokument = true));
    await Promise.all([phone.waitForURL(/\/logga-in/), menu.getByRole("link", { name: "Logga in som post" }).tap()]);
    await phone.getByRole("heading", { name: "Logga in" }).waitFor();
    assert.equal(await phone.evaluate(() => window.sammaDokument === true), true, "sidbytet ska ske utan omladdning");
    // Låset satt förut kvar. Inloggningssidan och adminpanelen efter den gick då inte att scrolla på telefon förrän sidan laddades om.
    await until(() => document.documentElement.style.overflow === "", "låset på sidans scroll ska släppas när menyn lämnar skärmen");
    // Tillbaka på startsidan är menyn stängd, som efter menyns andra länkar.
    await Promise.all([phone.waitForURL((url) => url.pathname === "/"), phone.getByRole("link", { name: "Till startsidan" }).tap()]);
    await phone.locator("header.sidhuvud").waitFor();
    await until(() => document.querySelector("header.sidhuvud button.meny-knapp")?.getAttribute("aria-expanded") === "false", "menyn ska vara stängd när man kommer tillbaka");
    await until(() => document.documentElement.style.overflow === "" && !document.querySelector("main#innehall")?.closest("[inert]"), "startsidan ska gå att scrolla och trycka på");
    await context.close();
  });

  await step("Galleriet: bilder går att flytta med tangentbordet, och fokus och ordningen består", async () => {
    await page.goto(`${BASE}/admin/evenemang/ny`);
    await waitForHydration(page, page.locator('input[name="title"]'));
    await page.fill('input[name="title"]', `E2E-tangentbord ${uniqueId()}`);
    await page.fill('input[name="starts_at"]', "2031-04-10T18:00");
    await page.fill('textarea[name="summary"]', "Skapat av det automatiska testet.");
    await Promise.all([page.waitForURL(/\/admin\/evenemang\/\d+\?skapad=1/), page.getByRole("button", { name: "Publicera", exact: true }).click()]);
    const eventId = page.url().split("?")[0].split("/").pop();

    const dir = await mkdtemp(path.join(tmpdir(), "statlin-tillganglighet-"));
    const files = [];
    for (const [i, background] of ["#ff0707", "#2e3192"].entries()) {
      const file = path.join(dir, `bild-${i + 1}.jpg`);
      await sharp({ create: { width: 800, height: 600, channels: 3, background } }).jpeg().toFile(file);
      files.push(file);
    }
    const url = `${BASE}/admin/bilder/evenemang/${eventId}`;
    await page.goto(url);
    await waitForHydration(page, page.getByRole("button", { name: "Välj bilder" }));
    await page.locator('input[type="file"][multiple]').setInputFiles(files);
    const captions = page.getByLabel("Bildtext");
    await page.waitForFunction(() => document.querySelectorAll('input[aria-label="Bildtext"]').length === 2);
    await captions.nth(0).fill("Röd");
    await captions.nth(0).press("Enter");
    await page.locator(".text-emerald-600").first().waitFor();

    const right = page.getByRole("button", { name: /^Flytta bild 1, Röd ett steg åt höger$/ });
    await right.focus();
    const saved = page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/admin/bilder"));
    await page.keyboard.press("Enter");
    await page.getByText("Bilden flyttades till plats 2 av 2.").waitFor();
    await saved;
    assert.match(await focusedLabel(page), /Röd ett steg åt vänster$/, "fokus ska hamna på knappen som går att trycka på");

    await page.goto(url);
    await waitForHydration(page, page.getByRole("button", { name: "Välj bilder" }));
    await page.waitForFunction(() => document.querySelectorAll('input[aria-label="Bildtext"]').length === 2);
    assert.equal(await captions.nth(1).inputValue(), "Röd", "ordningen ska vara sparad");
  });

  await step("Kalendern på startsidan står still, har en uppsättning länkar och går att ta sig igenom med tangentbordet", async () => {
    const { context, page: visitor } = await newVisitor(browser, { reducedMotion: "reduce", viewport: { width: 1280, height: 800 } });
    await visitor.goto(`${BASE}/`);
    const kalender = visitor.locator("section", { has: visitor.getByRole("heading", { name: "Kommande evenemang" }) });
    await kalender.waitFor();
    const links = kalender.getByRole("link");
    const hrefs = await links.evaluateAll((all) => all.map((a) => a.getAttribute("href")));
    assert.ok(hrefs.length >= 2, `minst ett evenemang och kalendern, fick ${hrefs.length}`);
    assert.equal(new Set(hrefs).size, hrefs.length, `länkarna ska finnas en gång var: ${hrefs.join(", ")}`);
    const moving = await kalender.evaluate((el) => [el, ...el.querySelectorAll("*")].filter((x) => getComputedStyle(x).animationName !== "none").length);
    assert.equal(moving, 0, "inget får röra sig med prefers-reduced-motion");

    // Tabbordningen följer sidan, och varje länk står helt inne i bilden när den får fokus.
    await links.first().focus();
    for (let i = 0; i < hrefs.length; i++) {
      const at = await visitor.evaluate(() => {
        const r = document.activeElement.getBoundingClientRect();
        return { href: document.activeElement.getAttribute("href"), inne: r.left >= 0 && r.right <= innerWidth };
      });
      assert.deepEqual(at, { href: hrefs[i], inne: true }, `plats ${i + 1} i tabbordningen`);
      await visitor.keyboard.press("Tab");
    }

    await visitor.setViewportSize({ width: 390, height: 844 });
    await visitor.reload();
    await kalender.waitFor();
    const wider = await visitor.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert.ok(wider <= 0, `sidan ska inte bli bredare än telefonen, ${wider} px`);
    await context.close();
  });

  await step("Guiden i bubblan öppnas första gången, leder från reglaget till pennan och kommer inte tillbaka", async () => {
    const { context, page: admin } = await freshBubble({ viewport: { width: 1280, height: 800 } });
    await admin.goto(`${BASE}/`);
    const guide = admin.getByRole("dialog", { name: /^Steg/ });
    await guide.getByText("Slå på reglaget").waitFor();
    assert.equal(await focusedLabel(admin), "Nästa", "fokus ska börja i guiden");

    const toggle = admin.locator('#admin-bar [role="switch"]');
    // Reglaget är målet för steget, så det går att klicka på. Nästa slår på det om man inte har gjort det själv.
    await toggle.click();
    assert.equal(await toggle.getAttribute("aria-checked"), "false");
    await guide.getByText("Reglaget är av nu.").waitFor();
    await guide.getByRole("button", { name: "Nästa" }).click();
    await guide.getByText("Klicka på den röda pennan").waitFor();
    assert.equal(await toggle.getAttribute("aria-checked"), "true", "Nästa ska slå på redigeringsläget");

    // Pennan går att klicka på trots att resten av sidan står stilla.
    await admin.locator("[data-edit-pen]:visible").first().click();
    const panel = admin.locator("#redigera-rubrik");
    await panel.waitFor();
    assert.equal(await guide.count(), 0, "guiden ska vänta medan panelen är öppen");
    await admin.keyboard.press("Escape");
    await panel.waitFor({ state: "hidden" });
    await guide.getByText("Ändra och tryck Spara").waitFor();

    await guide.getByRole("button", { name: "Klar" }).click();
    await guide.waitFor({ state: "hidden" });
    assert.equal(await focusedLabel(admin), "Hjälp: visa guiden", "fokus ska hamna på knappen som öppnar guiden igen");

    await admin.reload();
    await waitForHydration(admin, admin.getByRole("button", { name: "Hjälp: visa guiden" }));
    assert.equal(await guide.count(), 0, "guiden ska bara öppnas av sig själv en gång");

    await admin.getByRole("button", { name: "Hjälp: visa guiden" }).click();
    await guide.getByText("Slå på reglaget").waitFor();
    await admin.keyboard.press("Escape");
    await guide.waitFor({ state: "hidden" });
    assert.equal(await focusedLabel(admin), "Hjälp: visa guiden", "Escape ska lämna fokus på knappen");
    await context.close();
  });

  await step("Bubblan flyttas med piltangenter och med musen, stannar i bild och kommer ihåg sitt läge", async () => {
    const { context, page: admin } = await freshBubble({ viewport: { width: 1280, height: 800 } });
    await admin.addInitScript(() => localStorage.setItem("statlin-redigeringsguide", "sedd"));
    await admin.goto(`${BASE}/`);
    const grip = admin.getByRole("button", { name: /^Flytta bubblan/ });
    await waitForHydration(admin, grip);
    const bar = admin.locator("#admin-bar");
    assert.equal(await bar.getAttribute("data-corner"), "bottom-right");

    await grip.focus();
    await admin.keyboard.press("ArrowUp");
    await admin.keyboard.press("ArrowLeft");
    assert.equal(await bar.getAttribute("data-corner"), "top-left");
    assert.match(await grip.getAttribute("aria-label"), /uppe till vänster/, "skärmläsaren ska få veta var den hamnade");
    assert.equal(await focusedLabel(admin).then((l) => l.startsWith("Flytta bubblan")), true, "fokus ska stanna på greppet");
    // Bubblan får inte ligga över menyn, som står i listen överst på alla skärmar.
    const header = await admin.locator("header").first().boundingBox();
    await admin.waitForTimeout(400);
    const box = await bar.boundingBox();
    assert.ok(box.y >= header.y + header.height - 1, `övre hörnen ligger under sidhuvudet, ${box.y}`);

    await admin.reload();
    await waitForHydration(admin, grip);
    assert.equal(await bar.getAttribute("data-corner"), "top-left", "hörnet ska vara sparat");

    const from = await grip.boundingBox();
    await admin.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await admin.mouse.down();
    await admin.mouse.move(1000, 700, { steps: 6 });
    await admin.mouse.up();
    assert.equal(await bar.getAttribute("data-corner"), "bottom-right", "släppt nere till höger ska den hamna där");

    await admin.setViewportSize({ width: 480, height: 400 });
    await admin.waitForTimeout(400);
    const small = await bar.boundingBox();
    assert.ok(small.x >= 0 && small.x + small.width <= 480 && small.y >= 0 && small.y + small.height <= 400, `bubblan ska stanna i bild: ${JSON.stringify(small)}`);
    await context.close();
  });

  await step("Bubblan fälls ihop till en rund knapp med fokus kvar, och börjar så på telefon", async () => {
    const desk = await freshBubble({ viewport: { width: 1280, height: 800 } });
    await desk.page.addInitScript(() => localStorage.setItem("statlin-redigeringsguide", "sedd"));
    await desk.page.goto(`${BASE}/`);
    const fold = desk.page.getByRole("button", { name: "Fäll ihop bubblan" });
    await waitForHydration(desk.page, fold);
    await fold.focus();
    await desk.page.keyboard.press("Enter");
    const round = desk.page.getByRole("button", { name: "Öppna redigeringsbubblan" });
    await round.waitFor();
    assert.equal(await focusedLabel(desk.page), "Öppna redigeringsbubblan", "fokus ska följa med");
    const size = await round.boundingBox();
    assert.ok(size.width >= 44 && size.height >= 44, `minst 44 px, var ${size.width}×${size.height}`);
    assert.equal(await desk.page.locator('#admin-bar [role="switch"]').isVisible(), false);

    await desk.page.reload();
    await waitForHydration(desk.page, round);
    await round.focus();
    await desk.page.keyboard.press("Enter");
    await fold.waitFor();
    assert.equal(await focusedLabel(desk.page), "Fäll ihop bubblan", "fokus ska följa med tillbaka");
    await desk.context.close();

    const phone = await freshBubble(PHONE);
    await phone.page.addInitScript(() => localStorage.setItem("statlin-redigeringsguide", "sedd"));
    await phone.page.goto(`${BASE}/`);
    const start = phone.page.getByRole("button", { name: "Öppna redigeringsbubblan" });
    await waitForHydration(phone.page, start);
    assert.equal(await phone.page.locator('#admin-bar [role="switch"]').isVisible(), false, "på telefon börjar den hopfälld");
    await start.tap();
    await phone.page.locator('#admin-bar [role="switch"]').waitFor();
    const open = await phone.page.locator("#admin-bar").boundingBox();
    assert.ok(open.x >= 0 && open.x + open.width <= 390, `utfälld ska den rymmas: ${JSON.stringify(open)}`);
    await phone.page.getByRole("button", { name: "Öppna meny" }).tap();
    await phone.page.getByRole("navigation", { name: "Mobilmeny" }).waitFor();
    assert.equal(await phone.page.locator("#admin-bar").isVisible(), false, "bubblan ska inte ligga ovanpå menyn");
    await phone.context.close();
  });

  await step("Utan JavaScript leder språklänken rätt, och menyerna går att nå", async () => {
    const { context, page: plain } = await newVisitor(browser, { javaScriptEnabled: false, viewport: { width: 1280, height: 800 } });
    // På datorn ligger språklänken i listen överst. På smala skärmar sitter språket i menypanelen.
    const language = () => plain.locator("header a[hreflang]").evaluateAll((all) => all.filter((a) => a.getClientRects().length).map((a) => a.getAttribute("href")));
    await plain.goto(`${BASE}/`);
    assert.equal((await language()).join(), "/en", "från en svensk sida till engelska");
    await plain.goto(`${BASE}/en`);
    assert.equal((await language()).join(), "/", "från en engelsk sida tillbaka");

    await plain.goto(`${BASE}/`);
    // Utan JavaScript öppnar CSS gruppens ruta när knappen får fokus, så att Tab når länkarna.
    const group = plain.locator(".meny-rad > li", { hasText: "Studenter" }).first();
    const list = group.locator("ul");
    assert.equal(await list.isVisible(), false);
    await group.locator("button").focus();
    await list.waitFor();
    await plain.keyboard.press("Tab");
    assert.ok(await plain.evaluate(() => document.activeElement?.getAttribute("href")?.startsWith("/studenter/")), "Tab ska gå in i gruppen");
    await context.close();

    const { context: phoneContext, page: phone } = await newVisitor(browser, { javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    await phone.goto(`${BASE}/`);
    assert.equal(await phone.locator("button.meny-knapp").first().isVisible(), false, "en knapp som inte gör något ska inte synas");
    assert.equal(await phone.locator("a.meny-utan-js").first().getAttribute("href"), "#sidfot");
    assert.ok((await phone.locator("#sidfot a").count()) >= 10, "sidfoten ska ha länkarna");
    await phoneContext.close();
  });

  await step("En SVG går att ladda upp som dokument, men öppnas aldrig i webbläsaren (ST-24)", async () => {
    const title = `E2E-vektor ${uniqueId()}`;
    await page.goto(`${BASE}/admin/dokument`);
    await waitForHydration(page, page.locator('input[name="title"]'));
    await page.fill('input[name="title"]', title);
    await page.locator('input[name="file"]').setInputFiles({
      name: "vektor.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>document.title="KORD"</script></svg>'),
    });
    await page.locator('form:has(input[name="file"]) button[type="submit"]').first().click();
    await page.getByText(title).first().waitFor();

    const { context, page: visitor } = await newVisitor(browser);
    await visitor.goto(`${BASE}/dokument`);
    const href = await visitor.locator('a[href$=".svg"]').first().getAttribute("href");
    const res = await context.request.get(BASE + href);
    assert.equal(res.status(), 200);
    assert.match(res.headers()["content-disposition"] ?? "", /^attachment/, "SVG ska alltid laddas ner");
    assert.match(res.headers()["content-security-policy"] ?? "", /sandbox/, "och ligga i en sandlåda");
    await context.close();
  });
}

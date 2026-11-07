// End-to-end-test av loggan, inloggning, behörigheter, evenemang, bildgalleri, länksidan, tentastatistiken, hjälpmedlen, grafiskt ansvar,
// och i tests/e2e-steg/ nyheter och kontoskydden, mot en körande server som seedats med demodata och kända lösenord:
//
//   ADMIN_PASSWORD=lokal-admin-2026 DEMO_PASSWORD=lokal-demo-2026 npm run seed -- --demo
//   EXAM_STATS_URL=http://127.0.0.1:9 npm run dev
//
// Konton som seeden skapar måste byta lösenord vid första inloggningen. login() nedan byter då en gång
// per konto, som en ny post gör, och loggar sedan in med det nya lösenordet.
//
// EXAM_STATS_URL pekar tentastatistiken på en adress som inte svarar, så att testet bara använder
// demostatistiken i databasen och aldrig frågar den riktiga källan.
// Mot `npm start` krävs också CLIENT_IP_HEADER=x-forwarded-for, eftersom stegen i tests/e2e-steg/ loggar in från egna IP-adresser.
// Playwright är en devDependency. Chromium laddas ner en gång per dator: npx playwright install chromium
//
//   npm run test:e2e   (eller node tests/e2e.mjs http://localhost:3000)
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";
import { skipEditGuide, waitForHydration } from "./e2e-hjalp.mjs";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = fs.mkdtempSync(path.join(os.tmpdir(), "statlin-e2e-shots-"));
const IMG = fs.mkdtempSync(path.join(os.tmpdir(), "statlin-e2e-img-"));

/** Testbilder; den första har EXIF-orientering 6 för att verifiera autorotering. */
async function makeTestImages() {
  const colors = [["#ff0707", "#0a0a0a"], ["#2e3192", "#fbb03b"], ["#0a0a0a", "#f4f2ee"]];
  for (let i = 0; i < 3; i++) {
    const [a, b] = colors[i];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="3000" height="2000"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`;
    let img = sharp(Buffer.from(svg)).jpeg({ quality: 85 });
    if (i === 0) img = img.withMetadata({ orientation: 6 });
    await img.toFile(path.join(IMG, `test-${i + 1}.jpg`));
  }
}
const results = [];
const step = async (name, fn) => {
  try {
    await fn();
    results.push(`✓ ${name}`);
  } catch (e) {
    results.push(`✗ ${name}: ${String(e?.message ?? e).split("\n")[0]}`);
    throw e;
  }
};

/** Lösenorden som login() har bytt till, per e-postadress. */
const changedPasswords = new Map();

/** Kakorna från varje kontos senaste inloggning. */
const sessions = new Map();

async function login(page, email, password) {
  const current = changedPasswords.get(email) ?? password;
  await page.goto(`${BASE}/logga-in`);
  await page.fill("#email", email);
  await page.fill("#password", current);
  await Promise.all([page.waitForURL(/\/admin/), page.click('button[type="submit"]')]);
  if (!/\/admin\/konto\?byt=1/.test(page.url())) {
    sessions.set(email, await page.context().cookies());
    return;
  }
  assert.ok(!changedPasswords.has(email), `${email} tvingades byta lösenord en gång till`);
  // Första inloggningen: välj ett eget lösenord. Formuläret skickas via React, så vänta tills fälten är hydrerade.
  const next = `${current}-bytt`;
  await page.getByText("Välj ett eget lösenord").waitFor();
  await page.waitForFunction(() => Object.keys(document.querySelector('input[name="current"]') ?? {}).some((k) => k.startsWith("__react")));
  await page.fill('input[name="current"]', current);
  await page.fill('input[name="password"]', next);
  await page.fill('input[name="confirm"]', next);
  await page.getByRole("button", { name: "Byt lösenord" }).click();
  await page.getByText("Lösenordet är bytt.").waitFor();
  changedPasswords.set(email, next);
  await page.goto(`${BASE}/admin`);
  sessions.set(email, await page.context().cookies());
}

/**
 * Byter till ett konto som redan loggat in, utan ett nytt inloggningsförsök. Spärren i rate-limit.ts släpper 20 försök per IP och
 * kvart, och sviten ligger nära den gränsen. Försök 21 nekas, och det syns här som att waitForURL i login() går ut på tid.
 */
async function switchAccount(page, email) {
  await page.context().clearCookies();
  await page.context().addCookies(sessions.get(email));
}

/** Klickar Ta bort på en sida i adminpanelen och väntar in bekräftelsen. Knappen gör inget förrän den hydrerats. */
async function openDeleteConfirm(page) {
  const button = page.getByRole("button", { name: "Ta bort" });
  await waitForHydration(page, button);
  await button.click();
  const dialog = page.getByRole("alertdialog");
  await dialog.waitFor();
  return dialog;
}

(async () => {
  await makeTestImages();
  const browser = await chromium.launch();
  skipEditGuide(browser);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  let eventSlug;
  let resourceFile;

  // Formelringens gradient: radie 0 betyder att formlerna är helt dolda.
  const ringRadius = (p) => p.locator(".logo-formler radialGradient").getAttribute("r");
  const ringIsHidden = () => document.querySelector(".logo-formler radialGradient").getAttribute("r") === "0";
  const ringIsVisible = () => Number(document.querySelector(".logo-formler radialGradient").getAttribute("r")) > 100;
  const moveOverLogo = async (p) => {
    const box = await p.locator(".floating-logo").boundingBox();
    await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await p.mouse.move(box.x + box.width / 2 + 5, box.y + box.height / 2 + 5);
  };

  // Läser av loggan på overallens rygg längs en radie, utifrån och in: mörkt tyg, en ljus kant och sedan loggans svarta ring.
  const assertLogoEdge = async (back) => {
    const { data, info } = await sharp(await back.screenshot()).greyscale().raw().toBuffer({ resolveWithObject: true });
    const scale = info.width / 400;
    const row = Math.round(185 * scale) * info.width * info.channels;
    const outer = 57.5 * scale;
    const levels = [];
    for (let r = Math.round(outer * 1.2); r >= Math.round(outer * 0.86); r--) levels.push(data[row + (Math.round(200 * scale) + r) * info.channels]);
    const edge = levels.indexOf(Math.max(...levels));
    assert.ok(levels[0] < 60, `tyget utanför kanten ska vara mörkt: ${levels}`);
    assert.ok(levels[edge] > 130, `kanten ska vara ljus: ${levels}`);
    assert.ok(Math.min(...levels.slice(edge + 1)) < 60, `ringen innanför kanten ska vara svart: ${levels}`);
  };

  // Allt som når det yttre catch räknas som fel, också det som kastas utanför stegen och därför saknar ✗-rad.
  // process.exit nedan skriver över process.exitCode, så felet vägs in i avslutningskoden där.
  let aborted = false;
  let abortReason = "";
  try {
    await step("Sajten visar den officiella loggan, också på overallen", async () => {
      await page.goto(`${BASE}/`);
      await page.locator('header img[src="/brand/statlin.svg"]').first().waitFor({ state: "attached" });
      await page.locator('footer img[src="/brand/statlin.svg"]').first().waitFor({ state: "attached" });
      const hero = page.locator('.floating-logo svg[role="img"]');
      assert.equal(await hero.locator(".logo-text").getAttribute("fill"), "#fff", "texten i herologgan ska vara vit");
      assert.equal(await page.locator('img[src="/brand/statlin-inverterad.svg"]').count(), 0, "startsidan ska inte visa den inverterade");
      const back = 'svg[aria-label="Overallen bakifrån med sektionsloggan"]';
      const logoOnEdge = `${back} circle[stroke="#fff"] + image[href="/brand/statlin.svg"]`;
      await page.goto(`${BASE}/studenter/ny-student`);
      await page.locator(logoOnEdge).first().waitFor({ state: "attached" });
      assert.equal(await page.locator('svg image[href="/brand/statlin-inverterad.svg"]').count(), 0, "overallen ska inte ha den inverterade");
      // Den inverterade finns kvar som nedladdning under Grafisk profil, men inte på overallen eller i texten om den.
      await page.goto(`${BASE}/grafisk-profil`);
      await page.locator(logoOnEdge).waitFor({ state: "attached" });
      await page.locator('img[src="/brand/statlin-inverterad.svg"]').first().waitFor({ state: "attached" });
      assert.equal(await page.getByText("sitter i sin inverterade form").count(), 0);
      await assertLogoEdge(page.locator(back));
      // Den minsta overallen: den vita kanten ska synas även när loggan är drygt 45 px bred.
      const phoneCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      const phone = await phoneCtx.newPage();
      await phone.goto(`${BASE}/studenter/ny-student`);
      await assertLogoEdge(phone.locator(`${back}:visible`));
      await phoneCtx.close();
    });

    await step("Formelringen visas vid musen och försvinner när musen står stilla", async () => {
      await page.goto(`${BASE}/logga-in`);
      await page.locator(".floating-logo").first().waitFor({ state: "attached" });
      assert.equal(await page.locator(".logo-formler").count(), 0, "inloggningen ska inte ha formler");
      await page.goto(`${BASE}/`);
      await page.locator(".logo-formler").waitFor({ state: "attached" });
      assert.equal(await page.locator(".logo-formler").count(), 1);
      assert.equal(await ringRadius(page), "0", "formlerna ska vara dolda när sidan laddats");
      // Ringen strömmas in efter skalet (den kan stängas av under Inställningar) och lyssnar på musen först när den har hydrerats.
      await waitForHydration(page, page.locator(".logo-formler"));
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await moveOverLogo(page);
      await page.waitForFunction(ringIsVisible, null, { timeout: 5000 });
      await page.waitForFunction(ringIsHidden, null, { timeout: 10000 });
      await moveOverLogo(page);
      await page.waitForFunction(ringIsVisible, null, { timeout: 5000 });
      await page.waitForFunction(ringIsHidden, null, { timeout: 10000 });
    });

    await step("Formelringen rör sig inte av sig själv, inte heller efter introt eller efter fyra minuter", async () => {
      // Helt fejkad tid: klockan står still och flyttas bara av testet, så en upptagen dator ändrar inte resultatet (ST-25).
      const clockCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const clocked = await clockCtx.newPage();
      // Ringen är igång när den börjar bevaka loggan. Då sparas tiden.
      await clocked.addInitScript(() => {
        const observe = IntersectionObserver.prototype.observe;
        IntersectionObserver.prototype.observe = function (target) {
          observe.call(this, target);
          if (target.matches(".floating-logo") && window.ringMountedAt === undefined) window.ringMountedAt = performance.now();
        };
      });
      await clocked.clock.install();
      await clocked.clock.pauseAt(Date.now() + 60_000);
      await clocked.goto(`${BASE}/`);
      // Sidan behöver sina egna timers för att komma på plats, så klockan stegas fram tills ringen har startat.
      const deadline = Date.now() + 60_000;
      while ((await clocked.evaluate(() => window.ringMountedAt)) === undefined) {
        assert.ok(Date.now() < deadline, "ringen startade inte");
        await clocked.clock.runFor(20);
      }
      await clocked.clock.runFor(10_000);
      assert.equal(await ringRadius(clocked), "0", "inget svep efter introt");
      await clocked.clock.fastForward(240_000);
      await clocked.clock.runFor(400);
      assert.equal(await ringRadius(clocked), "0", "inget svep efter fyra minuter heller");
      await clockCtx.close();
    });

    await step("Formelringen är stilla med minskad rörelse", async () => {
      const stillCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
      const still = await stillCtx.newPage();
      await still.goto(`${BASE}/`);
      await moveOverLogo(still);
      await still.waitForTimeout(3500);
      assert.equal(await ringRadius(still), "0", "gradienten ska inte animeras");
      const fill = await still.locator(".logo-formler text").evaluate((el) => getComputedStyle(el).fill);
      assert.match(fill, /0\.7\)$/, "musen över loggan ska visa hela ringen");
      await stillCtx.close();
    });

    await step("Telefonen får de enklare effekterna och datorn behåller sina", async () => {
      // Heron har inte längre någon ritad bakgrundsgraf (DataField, en canvas) och inget korn. Bakom loggan ligger ett rutnät i ren CSS (HeroGrid),
      // så kontrollerna av ritytan är borttagna. I stället kollas att rutnätets ljus bara följer en mus och att telefonen inte skriver något i det.
      // Kornet finns kvar på det röda kortet längre ner på startsidan, och där kollas det i stället.
      const open = async (options) => {
        const context = await browser.newContext({ deviceScaleFactor: 3, ...options });
        const p = await context.newPage();
        await p.goto(`${BASE}/`);
        await p.locator(".logo-formler").waitFor({ state: "attached" });
        await p.locator("h1").waitFor();
        await p.waitForFunction(() => Object.keys(document.querySelector(".floating-logo")).some((k) => k.startsWith("__react")));
        // Kortet med kornet strömmas in efter heron.
        await p.locator("main a.noise").first().waitFor({ state: "attached" });
        return p;
      };
      const effects = (p) =>
        p.evaluate(() => {
          const css = (selector, pseudo) => getComputedStyle(document.querySelector(selector), pseudo);
          const grain = css("main a.noise", "::after");
          const title = getComputedStyle(document.querySelector("h1").closest('[class*="fade-up"]'));
          const buttons = getComputedStyle(document.querySelector("section[data-startsida] a.btn-ink").closest('[class*="fade-up"]'));
          return {
            sway: css(".logo-tilt").animationName,
            intro: css('.floating-logo svg[role="img"]').animationName,
            signature: css(".logo-signature").animationName,
            mask: css(".floating-logo svg g[mask]").maskImage === "none" ? "none" : "url",
            reflex: css(".floating-logo .animate-float-shadow").filter,
            grain: grain.content === "none" ? "none" : grain.mixBlendMode,
            title: `${title.animationDelay} ${title.animationDuration}`,
            buttons: `${buttons.animationName} ${buttons.animationDelay}`,
            sections: css(".below-fold").contentVisibility,
            titleFont: css("h1").fontFamily.includes("Archivo Reserv"),
          };
        });
      const inlineTilt = (p) => p.locator(".logo-tilt").evaluate((el) => el.style.transform);
      const ringFilter = (p) => p.locator(".logo-formler").evaluate((el) => getComputedStyle(el).filter);
      // Rutnätets ljus över hela sidan: data-aktiv på ramen och pekarens läge som två CSS-variabler på ljuset i den, satta av RutnatLjus.
      const gridLight = (p) => p.locator(".rutnat-ram").evaluate((el) => ({ active: el.hasAttribute("data-aktiv"), style: el.querySelector(".rutnat-ljus").style.cssText }));
      // Introt får inte hålla kvar sina lager på telefonen när det är slut. Slutbilden är densamma utan dem.
      const introIsOver = () => !document.getAnimations().some((a) => ["logo-ring-in", "grid-wipe", "logo-fade", "logo-glow-in", "sig-wipe", "sig-glow"].includes(a.animationName));
      const header = (p) =>
        p.locator("header").first().evaluate((el) => {
          const style = getComputedStyle(el);
          return { display: style.display, backdrop: style.backdropFilter, background: style.backgroundColor };
        });

      const mobile = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
      const phone = await open(mobile);
      assert.deepEqual(await effects(phone), {
        sway: "logo-sway-y, logo-sway-x",
        intro: "logo-ring-in",
        signature: "none",
        mask: "none",
        reflex: "none",
        grain: "none",
        title: "0.08s 0.9s",
        buttons: "fade-up 0.16s",
        sections: "auto",
        titleFont: true,
      });
      assert.equal(await inlineTilt(phone), "", "ingen loop i JS ska vrida loggan på telefon");
      await phone.waitForFunction(introIsOver, null, { timeout: 15000 });
      // Ringen kommer fram som helhet först när man trycker på loggan. Den ritas aldrig om och har ingen glöd.
      const ringShown = () => document.querySelector(".logo-formler").hasAttribute("data-shown");
      await phone.waitForFunction(() => !document.querySelector(".logo-formler").hasAttribute("data-shown"), null, { timeout: 10000 });
      const logo = await phone.locator(".floating-logo").boundingBox();
      await phone.touchscreen.tap(logo.x + logo.width / 2, logo.y + logo.height / 2);
      await phone.waitForFunction(ringShown, null, { timeout: 5000 });
      await phone.waitForFunction(() => getComputedStyle(document.querySelector(".logo-formler")).opacity === "1", null, { timeout: 5000 });
      assert.equal(await ringFilter(phone), "none", "formlerna ska inte ha någon glöd");
      assert.equal(await phone.locator(".logo-formler radialGradient").getAttribute("r"), "0", "gradienten ska inte animeras på telefon");
      // Telefonen lyssnar inte på pekaren i heron, så trycket lämnade inget ljus och inga variabler efter sig i rutnätet.
      assert.deepEqual(await gridLight(phone), { active: false, style: "" }, "rutnätet ska inte lysa upp på telefon");
      // Listen överst är hel på telefonen, utan oskärpa bakom sig, också när sidan är scrollad. Den har pappersfärgen i mörkt läge, som är standard.
      await phone.evaluate(() => window.scrollTo({ top: 1000, behavior: "instant" }));
      await phone.waitForTimeout(300);
      assert.deepEqual(await header(phone), { display: "flex", backdrop: "none", background: "rgb(18, 18, 17)" });
      await phone.context().close();

      // Heron hoppar inte under laddningen. Loggan ska stå på samma höjd i skalet (utan JS) som med rubriken på plats, både före och efter Archivo.
      // Reservfonten är Arial eller Roboto, så maskinen som kör testet behöver ett av dem.
      const logoTop = async (width, javaScriptEnabled, fonts) => {
        const context = await browser.newContext({ ...mobile, viewport: { width, height: 900 }, javaScriptEnabled });
        const p = await context.newPage();
        if (!fonts) await p.route("**/*.woff2", (route) => route.abort());
        await p.goto(`${BASE}/`);
        if (javaScriptEnabled) await p.locator("h1").waitFor();
        await p.evaluate(() => document.fonts.ready);
        const { y } = await p.locator(".floating-logo").boundingBox();
        await context.close();
        return y;
      };
      for (const width of [360, 390, 430]) {
        const tops = [await logoTop(width, false, false), await logoTop(width, true, false), await logoTop(width, false, true), await logoTop(width, true, true)];
        assert.ok(Math.max(...tops) - Math.min(...tops) <= 1, `loggan hoppar vid ${width} px: ${tops.join(", ")}`);
      }

      // Telefon med minskad rörelse: ingen gungning, ingen loop och ingenting i loggan som rör sig.
      const stillPhone = await open({ ...mobile, reducedMotion: "reduce" });
      const stillEffects = await effects(stillPhone);
      assert.equal(stillEffects.sway, "none");
      assert.equal(await inlineTilt(stillPhone), "");
      await stillPhone.waitForTimeout(1000);
      assert.equal(await inlineTilt(stillPhone), "");
      const moving = await stillPhone.evaluate(() =>
        document
          .getAnimations()
          .filter((a) => a.playState === "running" && a.effect?.target?.closest?.(".floating-logo"))
          .map((a) => a.animationName || a.transitionProperty),
      );
      assert.deepEqual(moving, [], "loggan ska stå still");
      assert.deepEqual(await gridLight(stillPhone), { active: false, style: "" });
      await stillPhone.context().close();

      // Sektionernas gissade höjder gäller en smal skärm. En surfplatta lägger ut allt direkt.
      const tablet = await open({ ...mobile, viewport: { width: 768, height: 1024 } });
      assert.equal((await effects(tablet)).sections, "visible");
      await tablet.context().close();

      const desktop = await open({ viewport: { width: 1440, height: 900 } });
      assert.deepEqual(await effects(desktop), {
        sway: "none",
        intro: "none",
        signature: "sig-glow",
        mask: "url",
        reflex: "blur(14px)",
        grain: "overlay",
        title: "0.08s 0.9s",
        buttons: "fade-up 0.16s",
        sections: "visible",
        titleFont: false,
      });
      const tiltBefore = await inlineTilt(desktop);
      await desktop.mouse.move(100, 100);
      await desktop.waitForTimeout(500);
      assert.notEqual(await inlineTilt(desktop), tiltBefore, "loggan ska följa musen");
      // Rutnätet lyser upp kring musen på hela sidan, också över sidomenyn, och släcks när musen lämnar fönstret.
      const hero = await desktop.locator("section[data-startsida]").boundingBox();
      await desktop.mouse.move(hero.x + 200, hero.y + 200, { steps: 4 });
      await desktop.waitForFunction(() => document.querySelector(".rutnat-ram").hasAttribute("data-aktiv"), null, { timeout: 5000 });
      assert.match((await gridLight(desktop)).style, /--x: -?\d+px; --y: -?\d+px;/);
      await desktop.mouse.move(100, 300, { steps: 4 });
      await desktop.waitForTimeout(100);
      assert.equal((await gridLight(desktop)).active, true, "ljuset ska följa med över sidomenyn");
      // Playwright kan inte flytta musen ut ur fönstret, så händelsen som webbläsaren skickar då skickas här direkt.
      await desktop.evaluate(() => document.documentElement.dispatchEvent(new PointerEvent("pointerout", { bubbles: true, pointerType: "mouse", relatedTarget: null })));
      await desktop.waitForFunction(() => !document.querySelector(".rutnat-ram").hasAttribute("data-aktiv"), null, { timeout: 5000 });
      // Formlerna har ingen glöd, så ringen har inget filter när den syns.
      await moveOverLogo(desktop);
      await desktop.waitForFunction(ringIsVisible, null, { timeout: 5000 });
      assert.equal(await ringFilter(desktop), "none", "formlerna ska inte ha någon glöd");
      // Datorn har sidomenyn i stället för listen överst. I ett smalare fönster kommer listen tillbaka, och med mus har den kvar sin oskärpa.
      assert.equal((await header(desktop)).display, "none");
      assert.equal(await desktop.locator("aside").first().evaluate((el) => getComputedStyle(el).display), "flex");
      // Oskärpan finns bara när genomskinlighetseffekterna är på i systemet. Windows kan ha dem avstängda, så provet ställer in båda lägena själv.
      const cdp = await desktop.context().newCDPSession(desktop);
      const transparency = (value) => cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-transparency", value }] });
      await transparency("no-preference");
      await desktop.setViewportSize({ width: 900, height: 800 });
      await desktop.evaluate(() => window.scrollTo({ top: 1000, behavior: "instant" }));
      await desktop.waitForFunction(() => getComputedStyle(document.querySelector("header")).backdropFilter.includes("blur(24px)"), null, { timeout: 5000 });
      // Utan genomskinlighet är listen hel och har ingen oskärpa.
      await transparency("reduce");
      assert.deepEqual(await header(desktop), { display: "flex", backdrop: "none", background: "rgb(18, 18, 17)" });
      await desktop.context().close();

      // Minskad rörelse på dator: musen över loggan visar hela ringen, utan loop och utan glöd.
      const stillDesktop = await open({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
      await moveOverLogo(stillDesktop);
      await stillDesktop.waitForTimeout(300);
      assert.equal(await ringFilter(stillDesktop), "none");
      assert.match(await stillDesktop.locator(".logo-formler text").evaluate((el) => getComputedStyle(el).fill), /0\.7\)$/);
      await stillDesktop.context().close();
    });

    await step("Genvägsraden på startsidan visar genvägarna", async () => {
      await page.goto(`${BASE}/`);
      const row = page.locator('section[aria-labelledby="genvagar-start"]');
      for (const label of ["Schema", "Boka rum", "Karta", "Skriva ut", "Tentamensanmälan", "E-post", "Tentastatistik"]) {
        await row.getByRole("link", { name: label, exact: true }).waitFor();
      }
    });

    await step("Startsidan går inte att scrolla åt sidan vid 320 px, och menyknappen syns helt", async () => {
      // Mobilemulering: på en telefon följer sidhuvudet sidans bredd, så en för bred sida skjuter ut menyknappen.
      const phoneCtx = await browser.newContext({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true });
      const phone = await phoneCtx.newPage();
      await phone.goto(`${BASE}/`);
      await phone.waitForLoadState("networkidle");
      await phone.evaluate(() => document.fonts.ready);
      assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth), 320, "sidan ska vara lika bred som skärmen");
      const menu = await phone.getByRole("button", { name: "Öppna meny" }).boundingBox();
      assert.ok(menu.x >= 0 && menu.x + menu.width <= 320, `menyknappen ligger på ${menu.x}–${menu.x + menu.width} px`);
      // Korten klipper det som sticker ut, så sidans bredd säger inget om att rubrikerna får plats.
      for (const title of [phone.getByRole("heading", { name: "Ny student?" }), phone.locator("main a").filter({ hasText: "Arbetsmarknadsdagen" }).getByText("STAR", { exact: true })]) {
        const spare = await title.evaluate((el) => {
          const text = document.createRange();
          text.selectNodeContents(el);
          const card = el.closest("a");
          return card.getBoundingClientRect().right - parseFloat(getComputedStyle(card).paddingRight) - text.getBoundingClientRect().right;
        });
        assert.ok(spare >= 0, `rubriken går ${-spare} px in i kortets marginal`);
      }
      await phoneCtx.close();
    });

    await step("Länksidan: sökning, kurskod och fästa länkar", async () => {
      await page.goto(`${BASE}/studenter/lankar`);
      assert.equal(await page.getByRole("heading", { name: /Kurser och/ }).count(), 0, "kurslistan ska vara borta");
      const search = page.getByRole("searchbox", { name: "Sök bland länkarna" });
      await search.fill("tenta");
      await page.locator("#grupp-tentor").waitFor();
      await search.fill("732G33");
      await page.getByRole("link", { name: /Visa tentastatistik för 732G33/ }).waitFor();
      await search.fill("tata24");
      await page.getByRole("link", { name: /Visa tentastatistik för TATA24/ }).waitFor();
      await search.fill("");
      await page.getByRole("button", { name: "Fäst Kursrum (Lisam)" }).click();
      await page.reload();
      await page.locator('section[aria-labelledby="fasta"]').getByText("Kursrum (Lisam)", { exact: true }).waitFor();
      await page.screenshot({ path: `${SHOTS}/links.png` });
    });

    await step("Länksidan: kurskodsfältet föreslår koder och leder till kursen", async () => {
      await page.goto(`${BASE}/studenter/lankar`);
      await page.waitForLoadState("networkidle");
      const box = page.locator('section[aria-labelledby="tentastatistik"]').getByRole("combobox", { name: "Kurskod" });
      await box.click();
      await box.pressSequentially("732g3");
      const suggestion = page.getByRole("option", { name: "732G33" });
      await suggestion.waitFor();
      await Promise.all([page.waitForURL(/\/tentastatistik\/732G33$/), suggestion.click()]);
    });

    await step("Kurssidan visar graferna, tabellerna och länkarna", async () => {
      await page.goto(`${BASE}/tentastatistik/732g33`);
      await page.waitForURL(/\/tentastatistik\/732G33$/);
      await page.waitForLoadState("networkidle");
      await page.getByRole("heading", { level: 1, name: "732G33" }).waitFor();
      await page.getByText("Programmering i R").first().waitFor();
      assert.ok((await page.locator('ol > li[tabindex="0"]').count()) > 0, "diagrammet saknar tentatillfällen");
      const trend = page.getByRole("img", { name: /Godkända över tid/ });
      await trend.waitFor();
      await page.getByRole("heading", { name: "Betyg de senaste tre åren" }).waitFor();
      await trend.hover();
      await page.getByText(/^hela \d{4}$/).waitFor();
      await page.screenshot({ path: `${SHOTS}/exam-stats-graphs.png` });
      assert.equal(await page.locator('a[href*="ysektionen.se"]').count(), 0, "Y-sektionen ska inte länkas");
      await page.getByRole("link", { name: /liustats/ }).first().waitFor();
      await page.getByRole("button", { name: "Tabell" }).click();
      await page.getByRole("table", { name: /Betyg per tentatillfälle/ }).waitFor();
      await page.getByRole("heading", { name: "Per år" }).waitFor();
      await page.getByRole("table", { name: /Andel godkända per år/ }).waitFor();
      await page.screenshot({ path: `${SHOTS}/exam-stats.png`, fullPage: true });
    });

    await step("Tentastatistik för vilken kurs som helst via kurskoden", async () => {
      await page.goto(`${BASE}/tentastatistik`);
      assert.equal(await page.getByRole("heading", { name: /Våra/ }).count(), 0, "programmens kurser ska vara borta");
      const box = page.getByRole("combobox", { name: "Kurskod" });
      await box.fill("tata24");
      await box.press("Enter");
      await page.waitForURL(/\/tentastatistik\/TATA24$/);
      await page.getByText("Linjär algebra").first().waitFor();
      await page.getByText("Betyg per tillfälle").waitFor();
      await page.goto(`${BASE}/tentastatistik/XYZ999`);
      await page.getByText("Hittade ingen tentastatistik för XYZ999").waitFor();
    });

    await step("Kurskod som hann skrivas innan sidan hydrerats går också att söka på", async () => {
      const scripts = /_next\/static\/.*\.js/;
      const slowly = async (route) => {
        await new Promise((r) => setTimeout(r, 2000));
        await route.continue();
      };
      await page.route(scripts, slowly);
      await page.goto(`${BASE}/tentastatistik`, { waitUntil: "commit" });
      const box = page.getByRole("combobox", { name: "Kurskod" });
      await box.fill("tata24");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1000);
      await page.unroute(scripts, slowly);
      await box.press("Enter");
      await page.waitForURL(/\/tentastatistik\/TATA24$/);
    });

    await step("Hjälpmedelssidan är öppen och nås från programmen, men adminsidan kräver inloggning", async () => {
      await page.goto(`${BASE}/studenter/hjalpmedel`);
      await page.getByRole("heading", { name: "Hjälpmedel", level: 1 }).waitFor();
      assert.equal(await page.getByRole("tab", { name: "Kandidat" }).getAttribute("aria-selected"), "true");
      await page.getByText("Det finns inga hjälpmedel här ännu.").waitFor();
      await page.goto(`${BASE}/studenter/lankar`);
      await page.locator('main a[href="/studenter/hjalpmedel"]').first().waitFor();
      assert.equal(await page.locator('main a[href="/studenter/hjalpmedel"]').count(), 1, "länken ska finnas en gång på länksidan");
      await page.goto(`${BASE}/studenter/kandidat`);
      await page.locator('main a[href="/studenter/hjalpmedel"]').waitFor();
      for (const address of ["/studenter/master", "/en/masters"]) {
        await page.goto(`${BASE}${address}`);
        await page.locator('main a[href="/studenter/hjalpmedel?program=master"]').waitFor();
      }
      await page.goto(`${BASE}/admin/hjalpmedel`);
      await page.waitForURL(/logga-in/);
    });

    await step("Fyra sidor går inte att scrolla åt sidan vid 320 px, och texten ryms", async () => {
      const phoneCtx = await browser.newContext({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true });
      const phone = await phoneCtx.newPage();
      const problems = [];
      for (const [address, texts] of [
        ["/sektionen", 'main a[href^="mailto:"]'],
        ["/sektionen/styrelsen", 'main a[href^="mailto:"]'],
        ["/foretag", "main p.display-tight"],
        ["/grafisk-profil", "main h2"],
      ]) {
        await phone.goto(`${BASE}${address}`);
        await phone.locator(texts).first().waitFor();
        await phone.waitForLoadState("networkidle");
        await phone.evaluate(() => document.fonts.ready);
        const width = await phone.evaluate(() => document.documentElement.scrollWidth);
        if (width !== 320) problems.push(`${address} är ${width} px bred`);
        const menu = await phone.getByRole("button", { name: "Öppna meny" }).boundingBox();
        if (menu.x < 0 || menu.x + menu.width > 320) problems.push(`${address}: menyknappen ligger på ${menu.x}–${menu.x + menu.width} px`);
        // Text kan rinna ur sin ruta utan att rutan växer, så mät själva texten.
        const outside = await phone.locator(texts).evaluateAll((elements) =>
          elements
            .filter((element) => {
              const range = document.createRange();
              range.selectNodeContents(element);
              return range.getBoundingClientRect().right > element.getBoundingClientRect().right + 0.5;
            })
            .map((element) => element.innerText),
        );
        if (outside.length) problems.push(`${address}: ${outside.join(", ")} rinner ur sin ruta`);
      }
      await phoneCtx.close();
      assert.equal(problems.length, 0, problems.join("; "));
    });

    await step("Styrelsekorten: chippen går att läsa i sin helhet vid 320 px och ikonen behåller sin storlek", async () => {
      const phoneCtx = await browser.newContext({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true });
      const phone = await phoneCtx.newPage();
      const problems = [];
      for (const address of ["/sektionen", "/sektionen/styrelsen", "/utskott/ubu", "/utskott/sasu", "/utskott/scb"]) {
        await phone.goto(`${BASE}${address}`);
        const chips = phone.locator("main .chip.left-3");
        await chips.first().waitFor();
        await phone.evaluate(() => document.fonts.ready);
        // Kortet klipper chippet utan att något växer, så jämför texten med chippet och chippet med kortet.
        const clipped = await chips.evaluateAll((elements) =>
          elements
            .filter((chip) => {
              const range = document.createRange();
              range.selectNodeContents(chip);
              const text = range.getBoundingClientRect();
              const box = chip.getBoundingClientRect();
              const card = chip.parentElement.getBoundingClientRect();
              return text.right > box.right + 0.5 || text.bottom > box.bottom + 0.5 || box.right > card.right + 0.5;
            })
            .map((chip) => chip.textContent),
        );
        if (clipped.length) problems.push(`${address}: ${clipped.join(", ")} klipps`);
      }
      // Vid 768 px är korten på /sektionen som smalast i förhållande till adresserna.
      await phone.setViewportSize({ width: 768, height: 1024 });
      await phone.goto(`${BASE}/sektionen`);
      const icons = phone.locator('main a[href^="mailto:"] svg');
      await icons.first().waitFor();
      await phone.evaluate(() => document.fonts.ready);
      const iconWidths = await icons.evaluateAll((elements) => elements.map((icon) => icon.getBoundingClientRect().width));
      if (iconWidths.some((width) => width !== 15)) problems.push(`/sektionen vid 768 px: ikonerna är ${iconWidths.join(", ")} px breda`);
      await phoneCtx.close();
      assert.equal(problems.length, 0, problems.join("; "));
    });

    await step("/sektionen går inte att scrolla åt sidan vid 280 px", async () => {
      const phoneCtx = await browser.newContext({ viewport: { width: 280, height: 568 }, isMobile: true, hasTouch: true });
      const phone = await phoneCtx.newPage();
      await phone.goto(`${BASE}/sektionen`);
      await phone.locator("main dl").waitFor();
      await phone.waitForLoadState("networkidle");
      await phone.evaluate(() => document.fonts.ready);
      assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth), 280);
      await phoneCtx.close();
    });

    await step("Fel lösenord visar fel och behåller e-post", async () => {
      await page.goto(`${BASE}/logga-in`);
      await page.fill("#email", "info@statlin.se");
      await page.fill("#password", "fel-losenord");
      await page.click('button[type="submit"]');
      await page.getByText("Fel e-postadress eller lösenord.").waitFor();
      assert.equal(await page.inputValue("#email"), "info@statlin.se");
      await page.screenshot({ path: `${SHOTS}/login.png` });
    });

    await step("Inloggning som redaktör (info)", async () => {
      await login(page, "info@statlin.se", "lokal-demo-2026");
      await page.getByText("Hej Namn").waitFor();
      await page.screenshot({ path: `${SHOTS}/admin-dashboard.png` });
    });

    await step("Redaktör lägger till en genväg som syns på startsidan", async () => {
      await page.goto(`${BASE}/admin/lankar`);
      await page.fill('input[name="label"]', "Testgenväg");
      await page.fill('input[name="url"]', "https://example.com/testgenvag");
      await page.locator('label:has(input[name="featured"])').click();
      await Promise.all([page.waitForURL(/\/admin\/lankar\?sparad=1/), page.getByRole("button", { name: "Lägg till länk" }).click()]);
      await page.goto(`${BASE}/`);
      await page.locator('section[aria-labelledby="genvagar-start"]').getByRole("link", { name: "Testgenväg" }).waitFor();
    });

    await step("Skapa evenemang", async () => {
      await page.goto(`${BASE}/admin/evenemang/ny`);
      await page.fill('input[name="title"]', "Testsittning med galleri");
      assert.equal(await page.inputValue('input[name="slug"]'), "testsittning-med-galleri");
      await page.fill('textarea[name="summary"]', "Ett evenemang skapat av det automatiska testet.");
      await page.fill('textarea[name="body_md"]', "## Program\n- Mingel\n- **Middag**\n\nVälkomna!");
      await page.fill('input[name="location"]', "Kårallen");
      await page.selectOption('select[name="committee_id"]', { label: "SCB: StatLins Centrala Bärseri" });
      await Promise.all([page.waitForURL(/\/admin\/evenemang\/\d+\?skapad=1/), page.getByRole("button", { name: "Publicera", exact: true }).click()]);
      await page.getByText("Evenemanget är publicerat!").waitFor();
    });

    await step("Validering: sluttid före starttid ger fältfel och öppnar Fler detaljer", async () => {
      // Förra sidan ligger kvar dold i DOM:en (Next behåller den), så bara synliga element räknas.
      const more = page.locator("summary:visible", { hasText: "Fler detaljer" });
      const endsAt = page.locator('input[name="ends_at"]:visible');
      await more.click();
      await endsAt.fill("2000-01-01T10:00");
      await more.click();
      await page.getByRole("button", { name: "Spara ändringar" }).click();
      await page.getByText("Sluttiden måste vara efter starttiden.").first().waitFor();
      await endsAt.waitFor({ timeout: 3000 });
      assert.equal(await page.inputValue('input[name="title"]'), "Testsittning med galleri", "fälten ska behållas");
      await endsAt.fill("");
    });

    await step("Ladda upp tre bilder till galleriet", async () => {
      const input = page.locator('input[aria-label="Välj bilder till galleriet"]');
      await input.setInputFiles([`${IMG}/test-1.jpg`, `${IMG}/test-2.jpg`, `${IMG}/test-3.jpg`]);
      await page.waitForFunction(() => document.querySelectorAll('input[aria-label="Bildtext"]').length === 3, null, { timeout: 30000 });
      const caption = page.locator('input[aria-label="Bildtext"]').first();
      await caption.fill("Skålen för sektionen!");
      await caption.press("Enter");
      await page.waitForTimeout(800);
      await page.locator('#galleri').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SHOTS}/admin-gallery.png`, fullPage: false });
    });

    await step("Sätt omslag via stjärnan och spara formuläret utan att skriva över det", async () => {
      // Vänta tills stjärnans action svarat (omslaget är sparat) i stället för en fast tid, och spara sedan formuläret.
      const starSaved = (r) => r.request().method() === "POST" && !!r.request().headers()["next-action"] && r.url().includes("/admin/evenemang/");
      await Promise.all([page.waitForResponse(starSaved), page.locator('button[title="Använd som omslagsbild"]').nth(1).click()]);
      await page.getByRole("button", { name: "Spara ändringar" }).click();
      await page.getByText("Sparat och publicerat.").waitFor();
    });

    await step("Bilderna syns på den publika evenemangssidan", async () => {
      eventSlug = "testsittning-med-galleri";
      await page.goto(`${BASE}/evenemang/${eventSlug}`);
      await page.locator("#galleri").scrollIntoViewIfNeeded();
      const count = await page.locator('#galleri button[aria-label^="Visa bild"]').count();
      assert.equal(count, 3);
      // Omslaget ska vara den andra bilden (vald via stjärnan).
      const coverSrc = await page.locator("article header img").first().getAttribute("src");
      assert.ok(coverSrc && coverSrc.startsWith("/media/"), "omslag saknas");
      await page.locator('#galleri button[aria-label^="Visa bild 1"]').click();
      await page.getByRole("dialog").waitFor();
      await page.getByText("Skålen för sektionen!").waitFor();
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${SHOTS}/lightbox.png` });
      await page.keyboard.press("Escape");
    });

    await step("Första bilden autoroterades enligt EXIF (stående)", async () => {
      const dims = await page.evaluate(async () => {
        const img = document.querySelector('#galleri img');
        return { w: Number(img.getAttribute("width")), h: Number(img.getAttribute("height")) };
      });
      assert.ok(dims.h > dims.w, `förväntade stående bild, fick ${dims.w}x${dims.h}`);
    });

    await step("Galleri-sidan visar albumet", async () => {
      await page.goto(`${BASE}/galleri`);
      await page.getByRole("heading", { name: "Testsittning med galleri" }).waitFor();
    });

    await step("Utloggning", async () => {
      await page.goto(`${BASE}/admin`);
      // Utloggningen byter sida två gånger: Nexts omdirigering och sedan en hel omladdning. Nästa goto får inte krocka med den andra.
      await page.evaluate(() => {
        window.foreUtloggningen = true;
      });
      await page.getByRole("button", { name: "Logga ut" }).last().click();
      await page.waitForFunction(() => !window.foreUtloggningen && location.search.includes("utloggad=1"));
      await page.getByText("Du är utloggad.").waitFor();
    });

    await step("Utskottskonto (SCB) ser bara sitt utskott", async () => {
      await login(page, "scb@statlin.se", "lokal-demo-2026");
      await page.goto(`${BASE}/admin/evenemang`);
      const titles = await page.locator("tbody tr td:first-child a span.block.font-semibold").allTextContents();
      assert.ok(titles.includes("Testsittning med galleri"), "SCB ska se SCB-evenemanget");
      assert.ok(!titles.some((t) => t.includes("LAN")), "SCB ska inte se eSTIG:s evenemang");
      await page.goto(`${BASE}/admin/evenemang/ny`);
      assert.equal(await page.locator('select[name="committee_id"]').count(), 0, "utskottet ska inte gå att välja");
      await page.getByText("SCB: StatLins Centrala Bärseri").waitFor();
      await page.screenshot({ path: `${SHOTS}/admin-committee-new.png` });
    });

    await step("Utskottets översikt har genvägar och sparar utkast", async () => {
      await page.goto(`${BASE}/admin`);
      await page.getByRole("heading", { name: "SCB", exact: true }).waitFor();
      await page.screenshot({ path: `${SHOTS}/admin-committee-dashboard.png`, fullPage: true });
      await Promise.all([page.waitForURL(/\/admin\/evenemang\/ny/), page.getByRole("link", { name: /Nytt evenemang/ }).click()]);
      await page.fill('input[name="title"]', "Utkast från utskottet");
      await Promise.all([page.waitForURL(/\/admin\/evenemang\/\d+\?skapad=1/), page.getByRole("button", { name: "Spara som utkast" }).click()]);
      await page.getByText("Evenemanget är sparat som utkast").waitFor();
      await page.getByRole("button", { name: "Publicera", exact: true }).waitFor();
    });

    await step("Utskottskonto nekas andra utskotts evenemang och uppladdning", async () => {
      const res = await page.evaluate(async () => {
        const html = await (await fetch("/admin/evenemang")).text();
        return html.length;
      });
      assert.ok(res > 0);
      // Hitta ett eSTIG-evenemang via den publika sidan och försök ladda upp till det.
      const other = await page.evaluate(async () => {
        const fd = new FormData();
        const blob = await (await fetch("/brand/utskott/stig.webp")).blob();
        fd.append("file", new File([blob], "x.webp", { type: "image/webp" }));
        fd.append("purpose", "gallery");
        fd.append("eventId", "4");
        const r = await fetch("/api/admin/upload", { method: "POST", body: fd });
        return r.status;
      });
      assert.equal(other, 403);
      await page.goto(`${BASE}/admin/evenemang/4`);
      await page.waitForURL(/nekad=1/);
      await page.goto(`${BASE}/admin/konton`);
      await page.waitForURL(/\/admin\?nekad=1/);
    });

    await step("Utskottskonto nekas länkarna och bildsidan", async () => {
      await page.goto(`${BASE}/admin/bilder`);
      await page.waitForURL(/\/admin\?nekad=1/);
      await page.goto(`${BASE}/admin/lankar`);
      await page.waitForURL(/\/admin\?nekad=1/);
    });

    await step("Kurslistan är borta ur adminpanelen", async () => {
      assert.equal(await page.locator('nav[aria-label="Adminmeny"] a[href="/admin/kurser"]').count(), 0, "menyn ska inte länka till Kurser");
      assert.equal((await page.goto(`${BASE}/admin/kurser`)).status(), 404);
    });

    await step("Utskottskonto lägger upp en fusklapp som PDF, och den syns under rätt termin", async () => {
      await page.goto(`${BASE}/admin/hjalpmedel`);
      await page.waitForLoadState("networkidle");
      assert.ok((await page.locator('nav[aria-label="Adminmeny"] a[href="/admin/hjalpmedel"]').count()) > 0, "menyn ska länka till Hjälpmedel");
      await page.fill('input[name="title"]', "Formelblad inferens");
      await page.selectOption('select[name="category"]', "fusklapp");
      await page.selectOption('select[name="program"]', "kandidat");
      await page.selectOption('select[name="term"]', "3");
      const pdf = path.join(IMG, "formelblad.pdf");
      fs.writeFileSync(pdf, "%PDF-1.4\n% testfil\n");
      await page.setInputFiles('input[name="file"]', pdf);
      await Promise.all([page.waitForURL(/\/admin\/hjalpmedel\?sparad=1/), page.getByRole("button", { name: "Lägg till hjälpmedel" }).click()]);
      await page.getByText("Hjälpmedlet är tillagt.").waitFor();

      await page.goto(`${BASE}/studenter/hjalpmedel`);
      const list = page.getByRole("tabpanel");
      await list.getByRole("heading", { name: "År 2" }).waitFor();
      await list.getByRole("heading", { name: /Termin 3/ }).waitFor();
      const row = list.getByRole("link", { name: /Formelblad inferens/ });
      await row.getByText("Fusklapp", { exact: true }).waitFor();
      await row.getByText(/PDF · \d+ B/).waitFor();
      resourceFile = await row.getAttribute("href");
      assert.equal((await fetch(`${BASE}${resourceFile}`)).status, 200, "filen ska gå att öppna utan inloggning");
      await page.getByRole("link", { name: "Hantera hjälpmedel" }).waitFor();

      await page.getByRole("tab", { name: "Master" }).click();
      await page.getByText("Det finns inga hjälpmedel här ännu.").waitFor();
      assert.ok(page.url().endsWith("?program=master"), "fliken ska hamna i adressen");
    });

    await step("Ett foto går också bra som hjälpmedel", async () => {
      await page.goto(`${BASE}/admin/hjalpmedel`);
      await page.waitForLoadState("networkidle");
      await page.fill('input[name="title"]', "Foto av anteckningar");
      await page.selectOption('select[name="category"]', "guide");
      await page.selectOption('select[name="program"]', "master");
      await page.selectOption('select[name="term"]', "1");
      await page.setInputFiles('input[name="file"]', path.join(IMG, "test-2.jpg"));
      await Promise.all([page.waitForURL(/\/admin\/hjalpmedel\?sparad=1/), page.getByRole("button", { name: "Lägg till hjälpmedel" }).click()]);
      await page.goto(`${BASE}/studenter/hjalpmedel?program=master`);
      const row = page.getByRole("tabpanel").getByRole("link", { name: /Foto av anteckningar/ });
      await row.getByText("Bild", { exact: true }).waitFor();
      const href = await row.getAttribute("href");
      assert.match(href, /-2000\.webp$/, "länken ska gå till den största bilden");
      assert.equal((await fetch(`${BASE}${href}`)).status, 200);
    });

    await step("Hjälpmedel kräver en fil eller länk, och Master har bara fyra terminer", async () => {
      await page.goto(`${BASE}/admin/hjalpmedel`);
      await page.waitForLoadState("networkidle");
      const submit = page.getByRole("button", { name: "Lägg till hjälpmedel" });
      await page.fill('input[name="title"]', "Utan innehåll");
      await submit.click();
      await page.getByText("Ladda upp en fil eller ange en länk.").waitFor();
      await page.fill('input[name="url"]', "https://github.com/statlin/tentor");
      await page.selectOption('select[name="program"]', "master");
      await page.selectOption('select[name="term"]', "5");
      await submit.click();
      await page.getByText("Mastern har bara fyra terminer.").waitFor();
      assert.equal(await page.getByRole("link", { name: /Utan innehåll/ }).count(), 0);
    });

    await step("Admin skapar konto och får engångslösenord", async () => {
      await page.context().clearCookies();
      await login(page, "admin@statlin.se", "lokal-admin-2026");
      await page.goto(`${BASE}/admin/konton`);
      await page.fill('input[name="name"]', "Test Testsson");
      await page.fill('input[name="email"]', "stig@statlin.se");
      await page.fill('input[name="post"]', "Idrottsansvarig");
      await page.selectOption('select[name="committee_id"]', { label: "STIG: StatLins Idrottsgrupp" });
      await page.getByRole("button", { name: "Skapa konto" }).click();
      await page.getByText("Kontot för stig@statlin.se är skapat").waitFor();
      const pw = await page.locator("code").first().textContent();
      assert.ok(/^[a-z]+(-[a-z]+){3}-\d{4}$/.test(pw), `oväntat lösenordsformat: ${pw}`);
      await page.screenshot({ path: `${SHOTS}/admin-users.png` });
      // Det nya kontot måste byta lösenord vid första inloggningen.
      await page.context().clearCookies();
      await page.goto(`${BASE}/logga-in`);
      await page.fill("#email", "stig@statlin.se");
      await page.fill("#password", pw);
      await Promise.all([page.waitForURL(/\/admin\/konto\?byt=1/), page.click('button[type="submit"]')]);
      await page.getByText("Välj ett eget lösenord").waitFor();
    });

    await step("Admin redigerar en sida och ändringen syns publikt", async () => {
      await page.context().clearCookies();
      await login(page, "admin@statlin.se", "lokal-admin-2026");
      await page.goto(`${BASE}/admin/sidor/ny-student`);
      await page.fill('textarea[name="lead"]', "Välkommen till StatLin – testad ingress!");
      await page.getByRole("button", { name: "Spara och publicera" }).click();
      await page.getByText("Sidan är sparad och publicerad.").waitFor();
      await page.goto(`${BASE}/studenter/ny-student`);
      await page.getByText("Välkommen till StatLin – testad ingress!").waitFor();
    });

    await step("Redigeringsläget: admin ändrar en sidtext direkt på sajten", async () => {
      await page.goto(`${BASE}/studenter/kandidat`);
      await page.locator('#admin-bar [role="switch"][aria-checked="true"]').waitFor();
      await page.locator("button:visible", { hasText: "Redigera texten" }).click();
      const panel = page.getByRole("dialog");
      await panel.locator('textarea[name="lead"]').fill("Ingress ändrad direkt på sajten.");
      await panel.getByRole("button", { name: "Spara och publicera" }).click();
      await panel.waitFor({ state: "detached" });
      await page.getByText("Ingress ändrad direkt på sajten.").waitFor();
      await page.screenshot({ path: `${SHOTS}/edit-mode.png` });
    });

    await step("Redaktör (info) kan ändra inställningarna", async () => {
      await page.context().clearCookies();
      await login(page, "info@statlin.se", "lokal-demo-2026");
      await page.goto(`${BASE}/admin/installningar`);
      // Nekas man skickas man vidare först efter att sidan laddats, så vänta på själva formuläret.
      await page.getByRole("heading", { name: "Inställningar", exact: true }).waitFor({ timeout: 15000 });
      await page.fill('input[name="address"]', "Testgatan 1, 583 30 Linköping");
      await page.getByRole("button", { name: "Spara", exact: true }).click();
      await page.getByText("Inställningarna är sparade.").waitFor();
      await page.goto(BASE);
      await page.locator("footer").getByText("Testgatan 1, 583 30 Linköping").waitFor();
    });

    await step("Redaktör lägger till en GitHub-länk för båda programmen", async () => {
      await page.goto(`${BASE}/admin/hjalpmedel`);
      await page.waitForLoadState("networkidle");
      await page.fill('input[name="title"]', "R-kod från labbarna");
      await page.selectOption('select[name="category"]', "kod");
      await page.selectOption('select[name="program"]', "bada");
      await page.fill('input[name="url"]', "https://github.com/statlin/r-kod");
      await Promise.all([page.waitForURL(/\/admin\/hjalpmedel\?sparad=1/), page.getByRole("button", { name: "Lägg till hjälpmedel" }).click()]);
      for (const address of ["/studenter/hjalpmedel", "/studenter/hjalpmedel?program=master"]) {
        await page.goto(`${BASE}${address}`);
        const list = page.getByRole("tabpanel");
        await list.getByRole("heading", { name: "Hela programmet" }).waitFor();
        const row = list.getByRole("link", { name: /R-kod från labbarna/ });
        await row.getByText("Kod", { exact: true }).waitFor();
        await row.getByText("github.com").waitFor();
        assert.equal(await row.getAttribute("href"), "https://github.com/statlin/r-kod");
      }
      assert.equal(await page.getByRole("tab", { name: "Master" }).getAttribute("aria-selected"), "true", "?program=master ska öppna fliken Master");
      assert.equal(await page.getByRole("tabpanel").getByRole("link", { name: /Formelblad inferens/ }).count(), 0, "fusklappen är bara för Kandidat");
      await page.screenshot({ path: `${SHOTS}/hjalpmedel-master.png`, fullPage: true });
    });

    await step("Hjälpmedel som ändras och tas bort försvinner från sidan, och filen med", async () => {
      // Listan sköts gemensamt: info ändrar fusklappen som SCB lade upp.
      await page.goto(`${BASE}/admin/hjalpmedel`);
      await Promise.all([page.waitForURL(/\/admin\/hjalpmedel\/\d+$/), page.getByRole("link", { name: /Formelblad inferens/ }).click()]);
      const editUrl = page.url();
      await page.waitForLoadState("networkidle");
      await page.check('input[name="remove_file"]');
      await page.getByRole("button", { name: "Spara", exact: true }).click();
      await page.getByText("Ladda upp en fil eller ange en länk.").waitFor();
      await page.uncheck('input[name="remove_file"]');
      await page.selectOption('select[name="term"]', "4");
      await page.getByRole("button", { name: "Spara", exact: true }).click();
      await page.getByText("Hjälpmedlet är sparat.").waitFor();
      await page.goto(`${BASE}/studenter/hjalpmedel`);
      const list = page.getByRole("tabpanel");
      await list.getByRole("heading", { name: /Termin 4/ }).waitFor();
      assert.equal(await list.getByRole("heading", { name: /Termin 3/ }).count(), 0);

      await page.goto(editUrl);
      // Utloggad svarar actionen ingenting och skickar ingen vidare. Den som klickade ska ändå få ett besked, och inget raderas.
      const signedOut = await openDeleteConfirm(page);
      await page.context().clearCookies();
      await signedOut.getByRole("button", { name: "Ta bort" }).click();
      await signedOut.getByRole("alert").waitFor();
      await switchAccount(page, "info@statlin.se");
      await page.goto(editUrl);
      const dialog = await openDeleteConfirm(page);
      await Promise.all([page.waitForURL(/\/admin\/hjalpmedel\?raderad=1/), dialog.getByRole("button", { name: "Ta bort" }).click()]);
      await page.goto(`${BASE}/admin`);
      await page.getByText(/tog bort hjälpmedel/).waitFor();
      await page.goto(`${BASE}/studenter/hjalpmedel`);
      await page.getByRole("tabpanel").getByRole("heading", { name: "Hela programmet" }).waitFor();
      assert.equal(await page.getByRole("tabpanel").getByRole("link", { name: /Formelblad inferens/ }).count(), 0);
      assert.equal((await fetch(`${BASE}${resourceFile}`)).status, 404, "filen ska vara borttagen");
    });

    await step("Utskottskonto nekas inställningarna", async () => {
      await page.context().clearCookies();
      await login(page, "scb@statlin.se", "lokal-demo-2026");
      await page.goto(`${BASE}/admin/installningar`);
      await page.waitForURL(/\/admin\?nekad=1/);
    });

    await step("Redigeringsläget: utskottet får pennor bara på sitt eget", async () => {
      await page.goto(`${BASE}/utskott/scb`);
      await page.locator("button:visible", { hasText: "Redigera utskottet" }).waitFor();
      await page.goto(`${BASE}/utskott/estig`);
      await page.locator('#admin-bar [role="switch"][aria-checked="true"]').waitFor();
      await page.waitForTimeout(800);
      assert.equal(await page.locator("button:visible", { hasText: "Redigera" }).count(), 0, "inga pennor på andra utskotts sidor");
      const status = await page.evaluate(async () => (await fetch("/api/admin/redigera?typ=home")).status);
      assert.equal(status, 403, "API:t ska neka startsidans texter");
    });

    // Granskning: styrelsens bock påverkar aldrig om evenemanget är publicerat.
    let reviewId;
    const reviewRow = (title) => page.locator("tbody tr", { hasText: title });
    const toReview = () => page.getByRole("region", { name: "Att göra nu" });

    await step("Utskottets nya evenemang är ogranskat", async () => {
      await page.goto(`${BASE}/admin/evenemang/ny`);
      await page.fill('input[name="title"]', "Pubkväll att granska");
      await page.fill('textarea[name="summary"]', "Pubkväll som administratören granskar i testet.");
      await page.fill('input[name="location"]', "Kårallen");
      await Promise.all([page.waitForURL(/\/admin\/evenemang\/\d+\?skapad=1/), page.getByRole("button", { name: "Publicera", exact: true }).click()]);
      reviewId = page.url().match(/evenemang\/(\d+)/)[1];
      await page.getByText("Evenemanget är publicerat!").waitFor();
      // Granskningen är styrelsens egen anteckning: utskottet varken ser den eller kan göra något åt den.
      assert.equal(await page.getByText("Ej granskad", { exact: true }).filter({ visible: true }).count(), 0, "utskottet ska inte se granskningen");
      assert.equal(await page.getByRole("button", { name: "Markera som granskad" }).count(), 0, "utskottet ska inte kunna granska");
    });

    await step("Admin ser ogranskade evenemang i översikten och listan", async () => {
      await page.context().clearCookies();
      await login(page, "admin@statlin.se", "lokal-admin-2026");
      await toReview().getByText("Pubkväll att granska").waitFor();
      await page.goto(`${BASE}/admin/evenemang?visa=ogranskade`);
      await reviewRow("Pubkväll att granska").getByText("Ej granskad", { exact: true }).waitFor();
    });

    await step("Admin markerar evenemanget som granskat", async () => {
      await page.goto(`${BASE}/admin/evenemang/${reviewId}`);
      await page.getByRole("button", { name: "Markera som granskad" }).click();
      await page.getByText("Granskad", { exact: true }).first().waitFor();
      await page.goto(`${BASE}/admin/evenemang?visa=ogranskade`);
      await page.getByRole("heading", { name: "Evenemang", exact: true }).waitFor();
      assert.equal(await reviewRow("Pubkväll att granska").count(), 0, "granskat evenemang ska inte listas som ogranskat");
      await page.goto(`${BASE}/admin`);
      await page.getByRole("heading", { name: "Kommande evenemang" }).waitFor();
      assert.equal(await toReview().getByText("Pubkväll att granska").count(), 0, "granskat evenemang ska lämna Att granska");
    });

    await step("Admin kan ångra en granskning", async () => {
      await page.goto(`${BASE}/admin/evenemang/${reviewId}`);
      await page.getByRole("button", { name: "Ångra granskning" }).click();
      await page.getByText("Ej granskad", { exact: true }).first().waitFor();
      await page.getByRole("button", { name: "Markera som granskad" }).click();
      await page.getByText("Granskad", { exact: true }).first().waitFor();
    });

    await step("Utskottets ändring tar bort granskningen", async () => {
      await page.context().clearCookies();
      await login(page, "scb@statlin.se", "lokal-demo-2026");
      await page.goto(`${BASE}/admin/evenemang/${reviewId}`);
      await page.fill('textarea[name="summary"]', "Ändrad efter granskningen.");
      await page.getByRole("button", { name: "Spara ändringar" }).click();
      await page.getByText("Sparat och publicerat.").waitFor();
    });

    await step("Admin-skapat evenemang är granskat direkt", async () => {
      await page.context().clearCookies();
      await login(page, "admin@statlin.se", "lokal-admin-2026");
      // Utskottets ändring i förra steget tog bort granskningen.
      await page.goto(`${BASE}/admin/evenemang/${reviewId}`);
      await page.getByText("Ej granskad", { exact: true }).first().waitFor();
      await page.goto(`${BASE}/admin/evenemang/ny`);
      await page.fill('input[name="title"]', "Styrelsemöte i testet");
      await page.fill('textarea[name="summary"]', "Styrelsemöte som administratören lägger upp i testet.");
      await Promise.all([page.waitForURL(/\/admin\/evenemang\/\d+\?skapad=1/), page.getByRole("button", { name: "Publicera", exact: true }).click()]);
      await page.getByText("Granskad", { exact: true }).first().waitFor();
    });

    let taskUrl;
    const tasksLink = () => page.locator('nav[aria-label="Adminmeny"] a[href="/admin/uppdrag"]').first();
    const newTask = async (title, recipient) => {
      await page.goto(`${BASE}/admin/uppdrag/ny`);
      await page.fill('input[name="title"]', title);
      const to = await page.locator('select[name="to_user_id"] option', { hasText: recipient }).first().getAttribute("value");
      await page.selectOption('select[name="to_user_id"]', to);
      await page.check('input[name="visibility"][value="privat"]');
      await Promise.all([page.waitForURL(/\/admin\/uppdrag\/\d+\?skapat=1/), page.getByRole("button", { name: "Skicka uppdraget" }).click()]);
      return page.url().split("?")[0];
    };

    await step("Utskottskonto skickar ett privat uppdrag till info", async () => {
      await page.context().clearCookies();
      await login(page, "scb@statlin.se", "lokal-demo-2026");
      taskUrl = await newTask("Affisch till testsittningen", "Informationsansvarig");
      await page.goto(`${BASE}/admin/uppdrag?visa=fran`);
      await page.getByText("Affisch till testsittningen").waitFor();
    });

    await step("Mottagaren får en siffra i menyn som nollställs på tavlan", async () => {
      await page.context().clearCookies();
      await login(page, "info@statlin.se", "lokal-demo-2026");
      assert.match(await tasksLink().innerText(), /1/, "siffran ska synas i menyn");
      await page.goto(`${BASE}/admin/uppdrag?visa=till`);
      await page.getByText("Affisch till testsittningen").waitFor();
      await page.waitForTimeout(1500);
      await page.reload();
      assert.doesNotMatch(await tasksLink().innerText(), /\d/, "siffran ska försvinna efter besöket");
    });

    await step("Mottagaren ändrar status och kommenterar", async () => {
      await page.goto(taskUrl);
      // Hjälp är inget eget steg: uppdraget pågår, och knappen ger det en markering som alla ser.
      await page.getByRole("button", { name: "Be om hjälp" }).click();
      await page.getByRole("button", { name: "Hjälpen behövs inte längre" }).waitFor();
      await page.fill('textarea[name="body"]', "Vilket format vill ni ha?");
      await page.getByRole("button", { name: "Skicka", exact: true }).click();
      await page.getByText("Kommentaren är skickad.").waitFor();
    });

    await step("Utskottskonto ser inte andras privata uppdrag", async () => {
      const secret = await newTask("Hemlig planering i testet", "Webbansvarig");
      await page.context().clearCookies();
      await login(page, "scb@statlin.se", "lokal-demo-2026");
      await page.goto(`${BASE}/admin/uppdrag`);
      await page.getByText("Affisch till testsittningen").waitFor();
      assert.equal(await page.getByText("Hemlig planering i testet").count(), 0, "privat uppdrag ska inte synas på tavlan");
      // Sidan skickar vidare i webbläsaren, så svaret på själva sidbytet kan vara borta när det läses. Därför ett eget anrop med samma inloggning.
      const html = await (await page.request.get(secret)).text();
      assert.ok(!html.includes("Hemlig planering i testet"), "privat uppdrag ska inte finnas i HTML:en");
      await page.goto(secret);
      await page.waitForURL(/\/admin\/uppdrag$/);
    });

    await step("Admin ser alla uppdrag", async () => {
      await page.context().clearCookies();
      await login(page, "admin@statlin.se", "lokal-admin-2026");
      await page.goto(`${BASE}/admin/uppdrag`);
      await page.getByText("Affisch till testsittningen").waitFor();
      await page.getByText("Hemlig planering i testet").waitFor();
    });

    // Radering: avsändaren, redaktörerna och administratörerna får ta bort ett uppdrag. Den som klickar ser alltid vad som hände.
    const heading = (title) => page.getByRole("heading", { name: title });
    const confirmDelete = async (dialog) => {
      await Promise.all([page.waitForURL(/\/admin\/uppdrag\?raderat=1$/), dialog.getByRole("button", { name: "Ta bort" }).click()]);
      await page.getByText("Uppdraget är borttaget.").waitFor();
    };
    let assignedUrl;

    await step("Mottagaren får ingen knapp för att ta bort uppdraget", async () => {
      assignedUrl = await newTask("Uppdrag till SCB i testet", "Ordförande SCB");
      await switchAccount(page, "scb@statlin.se");
      await page.goto(assignedUrl);
      await heading("Uppdrag till SCB i testet").waitFor();
      assert.equal(await page.getByRole("button", { name: "Ta bort" }).count(), 0, "mottagaren ska inte kunna ta bort uppdraget");
    });

    await step("Avbryt och Escape i bekräftelsen låter uppdraget stå kvar", async () => {
      await page.goto(taskUrl);
      const dialog = await openDeleteConfirm(page);
      await dialog.getByRole("button", { name: "Avbryt" }).click();
      await dialog.waitFor({ state: "hidden" });
      await openDeleteConfirm(page);
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden" });
      await page.reload();
      await heading("Affisch till testsittningen").waitFor();
    });

    await step("Bekräftelsen stängs när man går tillbaka i webbläsaren", async () => {
      // Sidan göms bara (Activity). Stängdes inte dialogen stod frågan öppen igen när man kom tillbaka till sidan.
      await page.goto(`${BASE}/admin/uppdrag`);
      await page.getByRole("link", { name: /Affisch till testsittningen/ }).click();
      await heading("Affisch till testsittningen").waitFor();
      await openDeleteConfirm(page);
      await page.goBack();
      await page.getByRole("link", { name: "Från dig" }).waitFor();
      await page.goForward();
      await heading("Affisch till testsittningen").waitFor();
      assert.equal(await page.getByRole("alertdialog").count(), 0, "frågan ska inte stå öppen när man kommer tillbaka");
    });

    await step("Servern nekar den som inte får ta bort, och beskedet syns", async () => {
      // Egen sida men ett annat uppdrags id i formuläret: det är så ett förfalskat anrop ser ut för servern.
      await page.goto(taskUrl);
      const dialog = await openDeleteConfirm(page);
      await dialog.locator('input[name="id"]').evaluate((input, id) => (input.value = id), assignedUrl.split("/").pop());
      await dialog.getByRole("button", { name: "Ta bort" }).click();
      await dialog.getByRole("alert").getByText("Du har inte behörighet att göra det här.").waitFor();
      assert.equal(page.url().split("?")[0], taskUrl, "den som nekas ska stå kvar på sidan");
      // Beskedet gäller det försöket. Öppnas bekräftelsen igen börjar den utan det.
      await dialog.getByRole("button", { name: "Avbryt" }).click();
      await dialog.waitFor({ state: "hidden" });
      await openDeleteConfirm(page);
      assert.equal(await dialog.getByRole("alert").count(), 0, "det gamla beskedet ska vara borta");
      await page.goto(assignedUrl);
      await heading("Uppdrag till SCB i testet").waitFor();
    });

    await step("Avsändaren tar bort sitt uppdrag och ser beskedet", async () => {
      await page.goto(taskUrl);
      await confirmDelete(await openDeleteConfirm(page));
      assert.equal(await page.getByRole("link", { name: /Affisch till testsittningen/ }).count(), 0, "uppdraget ska vara borta från tavlan");
      assert.equal(await page.locator("dialog[open]").count(), 0, "bekräftelsen ska vara stängd efter raderingen");
      await page.goto(taskUrl);
      await page.getByText("Sidan du letar efter finns inte").waitFor();
    });

    await step("Redaktören tar bort ett uppdrag som någon annan skickat", async () => {
      await switchAccount(page, "info@statlin.se");
      await page.goto(assignedUrl);
      await confirmDelete(await openDeleteConfirm(page));
    });

    await step("Administratören tar bort en annans privata uppdrag, och rubriken står kvar i loggen", async () => {
      await switchAccount(page, "admin@statlin.se");
      await page.goto(`${BASE}/admin/uppdrag`);
      await page.getByRole("link", { name: /Hemlig planering i testet/ }).click();
      await heading("Hemlig planering i testet").waitFor();
      await confirmDelete(await openDeleteConfirm(page));
      assert.equal(await page.getByRole("link", { name: /Hemlig planering i testet/ }).count(), 0, "uppdraget ska vara borta från tavlan");
      await page.goto(`${BASE}/admin`);
      await page.locator("li", { hasText: "tog bort uppdraget" }).getByText("Hemlig planering i testet").waitFor();
    });

    await step("Ett uppdrag som redan är borttaget ger ett besked", async () => {
      const url = await newTask("Flikprov i testet", "Ordförande SCB");
      const tab = await page.context().newPage();
      await tab.goto(url);
      const stale = await openDeleteConfirm(tab);
      await confirmDelete(await openDeleteConfirm(page));
      await stale.getByRole("button", { name: "Ta bort" }).click();
      await stale.getByRole("alert").getByText("Uppdraget finns inte längre.").waitFor();
      await tab.close();
    });

    await step("Escape stänger inte bekräftelsen medan raderingen körs, så beskedet syns ändå", async () => {
      const url = await newTask("Escapeprov i testet", "Ordförande SCB");
      await page.goto(url);
      // Svaret dröjer tills Escape hunnit tryckas. Två tryck: preventDefault hindrar bara det första i Chromium.
      const slowly = async (route) => {
        if (route.request().method() === "POST") await new Promise((resolve) => setTimeout(resolve, 1500));
        await route.continue();
      };
      await page.route(url, slowly);
      const dialog = await openDeleteConfirm(page);
      await dialog.locator('input[name="id"]').evaluate((input) => (input.value = "0"));
      await dialog.getByRole("button", { name: "Ta bort" }).click();
      await dialog.getByText("Tar bort…").waitFor();
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");
      await dialog.getByRole("alert").getByText("Uppdraget finns inte längre.").waitFor();
      await page.unroute(url, slowly);
      // När svaret kommit går det att stänga igen.
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden" });
    });

    await step("Den som loggats ut ser ett besked, och uppdraget står kvar", async () => {
      const url = await newTask("Utloggningsprov i testet", "Ordförande SCB");
      const dialog = await openDeleteConfirm(page);
      await page.context().clearCookies();
      await dialog.getByRole("button", { name: "Ta bort" }).click();
      await dialog.getByRole("alert").getByText("Du har loggats ut").waitFor();
      await switchAccount(page, "admin@statlin.se");
      await page.goto(url);
      await heading("Utloggningsprov i testet").waitFor();
    });

    // Status och övertagande: klicket gör sitt direkt, och den som loggats ut ser ett besked i stället för att ingenting händer.
    const statusButton = (pressed, label) => page.locator(`button[aria-pressed="${pressed}"]`, { hasText: label });
    const claimButton = page.getByRole("button", { name: "Jag tar den" });
    const signedOutNotice = page.getByRole("alert").getByText("Du har loggats ut");

    await step("Den som loggats ut och ändrar status ser ett besked, och statusen står kvar", async () => {
      const url = await newTask("Statusprov i testet", "Ordförande SCB");
      await page.context().clearCookies();
      await statusButton(false, "Pågår").click();
      await signedOutNotice.waitFor();
      await switchAccount(page, "admin@statlin.se");
      await page.goto(url);
      await statusButton(true, "Att göra").waitFor();
    });

    await step("Beskedet står inte kvar när man kommer tillbaka till sidan", async () => {
      await page.context().clearCookies();
      await statusButton(false, "Pågår").click();
      await signedOutNotice.waitFor();
      await switchAccount(page, "admin@statlin.se");
      // Sidan ligger gömd medan tavlan visas, så beskedet finns kvar om inget tar bort det.
      await page.locator("header").getByRole("link", { name: "Uppdragstavla" }).click();
      await page.waitForURL(/\/admin\/uppdrag$/);
      await page.goBack();
      await statusButton(false, "Pågår").waitFor();
      assert.equal(await signedOutNotice.count(), 0, "beskedet ska inte stå kvar");
    });

    await step("Efter ny inloggning går samma knapp igenom, och beskedet försvinner", async () => {
      await page.context().clearCookies();
      await statusButton(false, "Pågår").click();
      await signedOutNotice.waitFor();
      await switchAccount(page, "admin@statlin.se");
      await statusButton(false, "Pågår").click();
      await statusButton(true, "Pågår").waitFor();
      await signedOutNotice.waitFor({ state: "detached" });
    });

    await step("Den som loggats ut och tar ett öppet uppdrag ser ett besked, och uppdraget står öppet", async () => {
      const url = await newTask("Övertagandeprov i testet", "Öppet");
      await page.context().clearCookies();
      await claimButton.click();
      await signedOutNotice.waitFor();
      await switchAccount(page, "admin@statlin.se");
      await page.goto(url);
      await claimButton.waitFor();
    });

    await step("Den som är inloggad tar det öppna uppdraget och blir mottagare", async () => {
      await claimButton.click();
      await claimButton.waitFor({ state: "detached" });
      await statusButton(true, "Pågår").waitFor();
    });

    // Grafiskt ansvar: bilderna på alla evenemang och nyheter, men inte texterna.
    let scbEventId;
    let coverBefore;
    await step("Admin granskar SCB:s evenemang innan grafiskt ansvarig byter omslag", async () => {
      await page.goto(`${BASE}/admin/evenemang`);
      const href = await reviewRow("Testsittning med galleri").locator('a[href^="/admin/evenemang/"]').first().getAttribute("href");
      scbEventId = href.match(/evenemang\/(\d+)/)[1];
      await page.goto(`${BASE}/admin/evenemang/${scbEventId}`);
      await page.getByRole("button", { name: "Markera som granskad" }).click();
      await page.getByText("Granskad", { exact: true }).first().waitFor();
      await page.goto(`${BASE}/evenemang/${eventSlug}`);
      coverBefore = await page.locator("article header img").first().getAttribute("src");
    });

    await step("Grafiskt ansvarig byter omslag och laddar upp en galleribild på SCB:s evenemang", async () => {
      await page.context().clearCookies();
      await login(page, "grafiskt@statlin.se", "lokal-demo-2026");
      await Promise.all([page.waitForURL(/\/admin\/bilder$/), page.getByRole("link", { name: /Bilder och omslag/ }).click()]);
      const gallery = page.getByRole("group", { name: "Testsittning med galleri" }).getByRole("link", { name: /Galleri/ });
      assert.equal(await gallery.getAttribute("href"), `/admin/bilder/evenemang/${scbEventId}`);
      // En ny sidladdning, så att bildsidans omslagsfält inte ligger kvar dolda i DOM:en. Filen väljs först när
      // sidan hydrerats – annars hinner fältet inte lyssna på den.
      await page.goto(`${BASE}/admin/bilder/evenemang/${scbEventId}`);
      await page.waitForLoadState("networkidle");
      await page.locator('input[type="file"]:not([multiple])').setInputFiles(`${IMG}/test-3.jpg`);
      await page.getByText("Sparat", { exact: true }).waitFor({ timeout: 30000 });
      await page.locator('input[type="file"][multiple]').setInputFiles(`${IMG}/test-2.jpg`);
      await page.waitForFunction(() => document.querySelectorAll('input[aria-label="Bildtext"]').length === 4, null, { timeout: 30000 });
      await page.screenshot({ path: `${SHOTS}/design-event-images.png`, fullPage: true });
      await page.goto(`${BASE}/evenemang/${eventSlug}`);
      const coverAfter = await page.locator("article header img").first().getAttribute("src");
      assert.ok(coverAfter && coverAfter !== coverBefore, "omslaget ska ha bytts");
      assert.equal(await page.locator('#galleri button[aria-label^="Visa bild"]').count(), 4);
    });

    await step("Grafiskt ansvarig nekas evenemangets text men får Byt bilder i redigeringsläget", async () => {
      await page.locator('#admin-bar [role="switch"][aria-checked="true"]').waitFor();
      await page.locator("button:visible", { hasText: "Byt bilder" }).click();
      const panel = page.getByRole("dialog");
      await panel.getByText("Omslagsbild", { exact: true }).waitFor();
      assert.equal(await page.locator("button:visible", { hasText: "Redigera evenemanget" }).count(), 0, "texten ska inte gå att redigera");
      await page.keyboard.press("Escape");
      await panel.waitFor({ state: "detached" });
      await page.goto(`${BASE}/admin/evenemang/${scbEventId}`);
      await page.waitForURL(/nekad=1/);
    });

    await step("Grafiskt ansvarig lägger upp en mall som visas under Grafisk profil", async () => {
      await page.goto(`${BASE}/admin/dokument`);
      assert.equal(await page.locator('select[name="category"]').count(), 0, "kategorin ska vara låst");
      await page.fill('input[name="title"]', "Affischmall A3");
      await page.locator('input[name="file"]').setInputFiles({ name: "affischmall.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%statlin-test\n") });
      // Servern bestämmer kategorin, även om formuläret skickar ett protokoll.
      await page.evaluate(() => (document.querySelector('input[name="category"]').value = "protokoll"));
      await Promise.all([page.waitForURL(/\/admin\/dokument\?sparad=1/), page.getByRole("button", { name: "Lägg till dokument" }).click()]);
      await page.goto(`${BASE}/grafisk-profil`);
      await page.locator("#material").getByText("Affischmall A3").waitFor();
      await page.goto(`${BASE}/dokument`);
      const group = page.getByRole("heading", { name: "Grafisk profil", exact: true }).locator("xpath=following-sibling::ul[1]");
      await group.getByText("Affischmall A3").waitFor();
    });

    await step("Omslagsbytet tar bort granskningen och syns i loggen", async () => {
      await page.context().clearCookies();
      await login(page, "admin@statlin.se", "lokal-admin-2026");
      await page.getByText("bytte omslag på").first().waitFor();
      await page.goto(`${BASE}/admin/evenemang/${scbEventId}`);
      await page.getByText("Ej granskad", { exact: true }).first().waitFor();
    });

    // Nya steg läggs i en egen fil i tests/e2e-steg/, en fil per område, så att två områden inte skriver på samma rader.
    // Filerna körs i bokstavsordning. Varje fil exporterar en funktion som får samma verktyg som stegen här.
    const stepDir = new URL("./e2e-steg/", import.meta.url);
    for (const file of fs.readdirSync(stepDir).filter((f) => f.endsWith(".mjs")).sort()) {
      const { default: addSteps } = await import(new URL(file, stepDir));
      await addSteps({ BASE, browser, page, step, switchAccount, openDeleteConfirm });
    }
  } catch (e) {
    aborted = true;
    abortReason = String(e?.message ?? e).split("\n")[0];
  } finally {
    console.log(results.join("\n"));
    if (aborted) console.log(`\nKörningen avbröts: ${abortReason}`);
    console.log(`\nSkärmdumpar: ${SHOTS}`);
    const relevant = errors.filter((e) => !/Failed to load resource.*(403|401)/.test(e));
    if (relevant.length) console.log("\nKonsolfel:\n" + [...new Set(relevant)].slice(0, 10).join("\n"));
    await browser.close();
    process.exit(aborted || results.some((r) => r.startsWith("✗")) ? 1 : 0);
  }
})();

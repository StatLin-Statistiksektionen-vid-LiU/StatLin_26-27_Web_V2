// Det besökare möter på telefon och surfplatta: sidbyten fram och tillbaka, menyer, filter, bildvisaren och tryckytor.
import assert from "node:assert";
import { newVisitor, uniqueId, waitForHydration } from "../e2e-hjalp.mjs";

const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const TABLET = { viewport: { width: 1024, height: 768 }, isMobile: true, hasTouch: true };

/**
 * Animationer som tar slut och som kör just nu. Pulsen och gungningen är oändliga och får fortsätta. Nexts egna verktyg ligger i en shadow root.
 * Listens bakgrund följer scrollen i stället för klockan, och står som "running" så länge sidan inte har scrollat förbi dess sträcka.
 * Den spelar alltså ingenting, så bara animationer på dokumentets egen tidslinje räknas.
 */
const runningOnce = () =>
  document
    .getAnimations()
    .filter((a) => a.animationName && a.playState === "running" && a.timeline === document.timeline && a.effect?.getComputedTiming().iterations !== Infinity && a.effect?.target?.getRootNode() === document)
    .map((a) => a.animationName);

/** Väntar tills sidan har slutat scrolla och svarar med var den står. */
const scrollSettled = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve) => {
        let last = window.scrollY;
        let still = 0;
        const check = () => {
          still = window.scrollY === last ? still + 1 : 0;
          last = window.scrollY;
          if (still >= 20) resolve(last);
          else requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
      }),
  );

export default async function publiktSteg({ BASE, browser, step }) {
  const visit = async (options, url) => {
    const visitor = await newVisitor(browser, options);
    await visitor.page.goto(`${BASE}${url}`);
    return visitor;
  };

  await step("Startsidan spelar inte om introt när man går tillbaka till den", async () => {
    const { context, page } = await visit(PHONE, "/");
    // Heron länkar inte längre till evenemangen (de har en egen del längre ner), så steget går via Engagera dig.
    const toEvents = page.locator('[data-startsida] a[href="/utskott"]').first();
    await waitForHydration(page, toEvents);
    await page.waitForFunction(() => {
      // Bara det som går efter klockan: listens bakgrund följer scrollen och blir aldrig klar (se runningOnce).
      const finite = document.getAnimations().filter((a) => a.animationName && a.playState === "running" && a.timeline === document.timeline && a.effect?.getComputedTiming().iterations !== Infinity);
      return finite.length === 0;
    }, null, { timeout: 15_000 });
    await toEvents.click();
    await page.waitForURL(`${BASE}/utskott`);
    await page.locator("[data-startsida]").waitFor({ state: "hidden" });
    await page.goBack();
    await page.waitForURL(`${BASE}/`);
    await page.locator("[data-startsida]").waitFor();
    assert.deepEqual(await page.evaluate(runningOnce), [], "heron ska stå still när den visas igen");
    await context.close();
  });

  await step("Ett tryck öppnar menygruppen på surfplatta, och nästa tryck eller ett tryck utanför stänger den", async () => {
    // Surfplattan på 1024 px får datorns list med menyn på en rad. Gruppernas rutor öppnas med ett tryck, eftersom det inte finns någon pekare att hålla över dem.
    const { context, page } = await visit(TABLET, "/kontakt");
    const group = page.locator(".meny-rad > li", { has: page.locator("button") }).first();
    const button = group.locator("button");
    const link = group.locator("a").first();
    await waitForHydration(page, button);
    await button.tap();
    await link.waitFor();
    assert.equal(await button.getAttribute("aria-expanded"), "true");
    await button.tap();
    await link.waitFor({ state: "hidden" });
    assert.equal(await button.getAttribute("aria-expanded"), "false");
    await button.tap();
    await link.waitFor();
    // Utanför rutan, i sidans vänstra marginal där inget annat tar emot trycket.
    await page.touchscreen.tap(8, 600);
    await link.waitFor({ state: "hidden" });
    await context.close();
  });

  await step("Listen har ljus text över en topp som alltid är mörk, också i ljust läge", async () => {
    // Förslagen på hero är mörka i båda lägena. Listen är genomskinlig högst upp på sidan, så där lånar den mörka lägets färger
    // (mork-topp.tsx). I ljust läge stod annars mörk text mot det mörka, och med musen över en länk försvann den helt.
    const LIGHT = "rgb(236, 235, 230)";
    const DARK = "rgb(20, 20, 19)";
    const { context, page } = await newVisitor(browser, { viewport: { width: 1280, height: 800 } });
    await context.addInitScript(() => localStorage.setItem("statlin-tema", "ljust"));
    await page.goto(`${BASE}/hero/1`);
    const name = page.locator('header a[aria-label="StatLin, startsida"] span[translate]');
    const events = page.locator(".meny-rad > li > a", { hasText: "Evenemang" });
    const colorIs = async (locator, color) =>
      page.waitForFunction(([element, wanted]) => getComputedStyle(element).color === wanted, [await locator.elementHandle(), color], { timeout: 5000 });
    await waitForHydration(page, events);
    await colorIs(name, LIGHT);
    await events.hover();
    await colorIs(events, LIGHT);
    // Mitt i heron är listen fortfarande genomskinlig, och texten ljus.
    const height = await page.locator("[data-hero-yta]").evaluate((el) => el.offsetHeight);
    await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), height * 0.6);
    await page.waitForTimeout(400);
    await colorIs(name, LIGHT);
    // Förbi heron har listen sin bakgrund i lägets färg, och då gäller lägets mörka text.
    await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), height + 100);
    await colorIs(name, DARK);
    await colorIs(events, DARK);
    // Efter ett sidbyte ligger heron kvar dold i dokumentet. Märket är borta, så listen följer läget på nästa sida.
    await events.click();
    await page.waitForURL(`${BASE}/evenemang`);
    assert.equal(await page.locator(".pr-hero").count(), 1, "heron ska ligga kvar dold, annars provar steget ingenting");
    assert.equal(await page.locator("[data-mork-topp]").count(), 0);
    await colorIs(name, DARK);
    await context.close();
  });

  await step("Listen är genomskinlig över startsidans hero tills den står över herons sista femtedel", async () => {
    // Som på förra sajten: bakgrunden och loggan framför namnet kommer först när heron nästan är förbi (HERO_FORBI i site-header.tsx).
    const { context, page } = await newVisitor(browser, { viewport: { width: 1280, height: 800 } });
    await page.goto(`${BASE}/hero/1`);
    const header = page.locator("header.sidhuvud");
    const name = header.locator('a[aria-label="StatLin, startsida"] span[translate]');
    await waitForHydration(page, header.locator(".meny-rad > li > a").first());
    // Namnet står i versaler med LIN i rött. I koden står StatLin, så att det kopieras och läses upp så.
    assert.equal(await name.textContent(), "StatLin");
    assert.equal(await name.evaluate((el) => getComputedStyle(el).textTransform), "uppercase");
    assert.equal(await name.locator("span").evaluate((el) => getComputedStyle(el).color), "rgb(255, 7, 7)");
    const height = await page.locator("[data-hero-yta]").evaluate((el) => el.offsetHeight);
    const scrollTo = (top) => page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), top);
    const state = () =>
      header.evaluate((el) => ({
        scrolled: el.hasAttribute("data-scrollad"),
        background: getComputedStyle(el).backgroundColor,
        logo: Math.round(el.querySelector(".sidhuvud-logga").getBoundingClientRect().width),
      }));
    const logoIs = (width) =>
      page.waitForFunction((wanted) => Math.round(document.querySelector("header .sidhuvud-logga").getBoundingClientRect().width) === wanted, width, { timeout: 5000 });
    assert.deepEqual(await state(), { scrolled: false, background: "rgba(0, 0, 0, 0)", logo: 0 }, "högst upp");
    await scrollTo(height * 0.7);
    await page.waitForTimeout(400);
    assert.deepEqual(await state(), { scrolled: false, background: "rgba(0, 0, 0, 0)", logo: 0 }, "sju tiondelar ner i heron");
    await scrollTo(height * 0.9);
    await logoIs(32);
    assert.equal((await state()).scrolled, true, "över herons sista del");
    // Tillbaka upp i heron släpper listen bakgrunden och loggan igen.
    await scrollTo(height * 0.5);
    await logoIs(0);
    assert.equal((await state()).scrolled, false, "tillbaka i heron");
    // En vanlig sida har loggan hela tiden, och bakgrunden kommer så fort man har börjat scrolla.
    await page.goto(`${BASE}/kontakt`);
    await waitForHydration(page, header.locator(".meny-rad > li > a").first());
    assert.equal((await state()).logo, 32);
    await scrollTo(40);
    await page.waitForFunction(() => document.querySelector("header.sidhuvud").hasAttribute("data-scrollad"), null, { timeout: 5000 });
    await context.close();
  });

  await step("Filtren på evenemangssidan behåller platsen på sidan", async () => {
    const { context, page } = await visit(PHONE, "/evenemang");
    const chip = page.getByRole("navigation", { name: "Filtrera på utskott" }).locator('a[href*="utskott="]').first();
    await waitForHydration(page, chip);
    await page.evaluate(() => window.scrollTo({ top: 300, behavior: "instant" }));
    const before = await scrollSettled(page);
    const target = await chip.getAttribute("href");
    await chip.tap();
    await page.waitForURL((url) => `${url.pathname}${url.search}` === target);
    await page.locator(`main a[href="${target}"][aria-current="true"]`).waitFor();
    assert.equal(await scrollSettled(page), before, "sidan ska inte hoppa när ett filter väljs");
    await context.close();
  });

  await step("Tillbaka stänger bilden i helskärm och stannar på sidan", async () => {
    const { context, page } = await visit(PHONE, "/galleri");
    const album = await page.locator('main a[href*="#galleri"]').first().getAttribute("href");
    await page.goto(`${BASE}${album.split("#")[0]}`);
    const thumbnail = page.locator('#galleri button[aria-label^="Visa bild 1"]');
    await waitForHydration(page, thumbnail);
    const url = page.url();
    const dialog = page.getByRole("dialog");
    await thumbnail.tap();
    await dialog.waitFor();
    await page.goBack();
    await dialog.waitFor({ state: "hidden" });
    assert.equal(page.url(), url, "Tillbaka ska bara stänga bilden");
    await thumbnail.tap();
    await dialog.waitFor();
    await dialog.getByRole("button", { name: "Stäng" }).tap();
    await dialog.waitFor({ state: "hidden" });
    await page.waitForTimeout(300);
    assert.equal(page.url(), url, "Stängknappen ska stanna på sidan");
    await context.close();
  });

  await step("Overallens revärer klipps på telefon, trots att sidan har två kopior av den", async () => {
    const { context, page } = await visit(PHONE, "/studenter/ny-student");
    const clips = await page.locator('svg[aria-label^="Overallen"]').evaluateAll((svgs) =>
      svgs.map((svg) => ({
        own: svg.querySelector("clipPath").id,
        used: svg.querySelector("g[clip-path]").getAttribute("clip-path"),
      })),
    );
    assert.equal(clips.length, 4);
    assert.equal(new Set(clips.map((c) => c.own)).size, 4, "varje kopia ska ha ett eget id");
    for (const clip of clips) assert.equal(clip.used, `url(#${clip.own})`);
    await context.close();
  });

  await step("Ankarlänkarna i grafiska profilen landar vid rubriken", async () => {
    const { context, page } = await visit(PHONE, "/grafisk-profil");
    await page.locator('nav[aria-label="Innehåll"] a[href="#farger"]').tap();
    await page.waitForFunction(() => location.hash === "#farger");
    await scrollSettled(page);
    const { heading, bar } = await page.evaluate(() => ({
      heading: document.querySelector("#farger h2").getBoundingClientRect().top,
      bar: document.querySelector('nav[aria-label="Innehåll"]').getBoundingClientRect().bottom,
    }));
    assert.ok(heading >= bar, `rubriken ligger bakom raden med länkar: ${heading} < ${bar}`);
    assert.ok(heading - bar < 120, `rubriken ligger långt under raden med länkar: ${heading - bar} px`);
    await context.close();
  });

  await step("Rubrikerna på undersidorna har en reservfont lika bred som Archivo på telefon", async () => {
    const { context, page } = await visit(PHONE, "/grafisk-profil");
    const font = await page.locator("h1").first().evaluate((el) => getComputedStyle(el).fontFamily);
    assert.ok(font.includes("Archivo Bred Reserv"), `fick ${font}`);
    await context.close();
  });

  await step("Inget flyttar sig när typsnittet kommer", async () => {
    for (const [options, urls] of [
      [PHONE, ["/evenemang", "/studenter/ny-student", "/studenter/lankar"]],
      [{}, ["/grafisk-profil"]],
    ]) {
      const { context, page } = await newVisitor(browser, options);
      await page.route(/\.woff2(\?.*)?$/, async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 900));
        await route.continue();
      });
      await page.addInitScript(() => {
        window.__shift = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) window.__shift += entry.value;
        }).observe({ type: "layout-shift", buffered: true });
      });
      for (const url of urls) {
        await page.goto(`${BASE}${url}`);
        await page.waitForTimeout(2000);
        const shift = await page.evaluate(() => window.__shift);
        assert.ok(shift < 0.02, `${url} flyttade sig ${shift.toFixed(3)}`);
      }
      await context.close();
    }
  });

  await step("Små länkar går att träffa med fingret", async () => {
    const { context, page } = await visit(PHONE, "/kontakt");
    const missed = await page.locator("footer nav a[href]").evaluateAll((links) =>
      links.flatMap((link) => {
        link.scrollIntoView({ block: "center", behavior: "instant" });
        const box = link.getBoundingClientRect();
        const hit = document.elementFromPoint(box.left + 4, box.top + 2);
        return box.height >= 24 && link.contains(hit) ? [] : [`${link.textContent.trim()}: ${Math.round(box.height)} px`];
      }),
    );
    assert.deepEqual(missed, []);
    await context.close();

    // Startsidan har ingen Scrolla vidare-länk längre. Datorns minsta mål är nu listens: menyraden med undersidorna, sökningen, språket, temaknappen och Poster.
    // Gruppernas rutor visas, så att undersidorna också mäts. Alla ska vara minst 24 px åt båda hållen.
    const { context: desktop, page: wide } = await visit({}, "/");
    await wide.locator("header .meny-ruta").evaluateAll((panels) => panels.forEach((panel) => (panel.style.visibility = "visible")));
    const { measured, small } = await wide.locator("header").locator("a[href], button").evaluateAll((targets) => {
      const shown = targets.filter((target) => target.getClientRects().length);
      const small = shown.flatMap((target) => {
        const box = target.getBoundingClientRect();
        return box.width >= 24 && box.height >= 24 ? [] : [`${target.textContent.trim() || target.getAttribute("aria-label")}: ${Math.round(box.width)} x ${Math.round(box.height)} px`];
      });
      return { measured: shown.length, small };
    });
    assert.ok(measured >= 20, `bara ${measured} mål i listen`);
    assert.deepEqual(small, []);
    await desktop.close();
  });

  await step("Omladdning och bakåt från en annan webbplats lämnar besökaren där den var, fast sidan strömmas in", async () => {
    for (const options of [{}, PHONE]) {
      for (const path of ["/foretag", "/evenemang"]) {
        const { page: p, context } = await newVisitor(browser, options);
        await p.goto(`${BASE}${path}`);
        await waitForHydration(p, p.locator("footer a").first());
        const y = await p.evaluate(() => {
          const target = Math.round((document.documentElement.scrollHeight - window.innerHeight) * 0.6);
          window.scrollTo(0, target);
          return target;
        });
        const stillThere = async (what) => {
          await p.waitForFunction((target) => Math.abs(window.scrollY - target) < 150, y);
          // Den ska stå kvar också när resten av sidan har kommit.
          await p.waitForTimeout(1200);
          const now = await p.evaluate(() => window.scrollY);
          assert.ok(Math.abs(now - y) < 150, `${path}, ${what}: stod på ${now}, skulle stå på ${y}`);
        };
        await p.waitForTimeout(400);
        await p.reload();
        await stillThere("omladdning");
        await p.goto(`${BASE}/integritet`);
        await p.goBack();
        await stillThere("bakåt");
        // Bakåt inom sajten ska webbläsaren få sköta själv igen när platsen väl är tillbaka.
        await p.waitForFunction(() => history.scrollRestoration === "auto", null, { timeout: 10000 });

        // Den som öppnar sidan på nytt ska börja högst upp.
        await p.goto(`${BASE}${path}`);
        await p.waitForTimeout(800);
        assert.equal(await p.evaluate(() => window.scrollY), 0, `${path} ska börja högst upp när den öppnas på nytt`);
        await context.close();
      }
    }
  });

  await step("Adresserna man gissar leder rätt: /nytt och /kalender", async () => {
    const { context, page } = await newVisitor(browser);
    await page.goto(`${BASE}/nytt`);
    assert.equal(new URL(page.url()).pathname, "/nyheter");
    await page.goto(`${BASE}/kalender`);
    const { pathname, search } = new URL(page.url());
    assert.equal(pathname + search, "/evenemang?vy=kalender");
    await context.close();
  });

  await step("Sidan som inte finns svarar 404 och har en egen titel", async () => {
    const { context, page } = await newVisitor(browser);
    const response = await page.goto(`${BASE}/finns-inte-${uniqueId()}`);
    assert.equal(response.status(), 404);
    assert.equal(await page.title(), "Sidan finns inte · StatLin");
    await context.close();
  });
}

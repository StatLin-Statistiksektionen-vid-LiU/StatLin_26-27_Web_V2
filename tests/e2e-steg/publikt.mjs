// Det besökare möter på telefon och surfplatta: sidbyten fram och tillbaka, menyer, filter, bildvisaren och tryckytor.
import assert from "node:assert";
import { newVisitor, uniqueId, waitForHydration } from "../e2e-hjalp.mjs";

const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const TABLET = { viewport: { width: 1024, height: 768 }, isMobile: true, hasTouch: true };

/** Animationer som tar slut och som kör just nu. Pulsen och gungningen är oändliga och får fortsätta. Nexts egna verktyg ligger i en shadow root. */
const runningOnce = () =>
  document
    .getAnimations()
    .filter((a) => a.animationName && a.playState === "running" && a.effect?.getComputedTiming().iterations !== Infinity && a.effect?.target?.getRootNode() === document)
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
      const finite = document.getAnimations().filter((a) => a.animationName && a.playState === "running" && a.effect?.getComputedTiming().iterations !== Infinity);
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

  await step("Ett tryck öppnar menygruppen på surfplatta, och nästa tryck stänger den", async () => {
    // Surfplattan på 1024 px får datorns sidomeny. Grupperna där är details som står kvar öppna, inte rullgardiner,
    // så ett tryck utanför ska inte längre stänga dem. Den delen av steget är borttagen.
    const { context, page } = await visit(TABLET, "/kontakt");
    const group = page.locator("aside .meny-grupp").first();
    const summary = group.locator("summary");
    const link = group.locator("a").first();
    await waitForHydration(page, summary);
    await summary.tap();
    await link.waitFor();
    assert.equal(await group.evaluate((details) => details.open), true);
    await summary.tap();
    await link.waitFor({ state: "hidden" });
    await summary.tap();
    await link.waitFor();
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

    // Startsidan har ingen Scrolla vidare-länk längre. Datorns minsta mål är nu sidomenyns rader: undersidorna, språket, temaknappen och Poster.
    // Grupperna fälls ut, så att undersidorna också mäts. Alla ska vara minst 24 px åt båda hållen.
    const { context: desktop, page: wide } = await visit({}, "/");
    await wide.locator("aside details").evaluateAll((groups) => groups.forEach((group) => (group.open = true)));
    const { measured, small } = await wide.locator("aside").locator("a[href], button, summary").evaluateAll((targets) => {
      const shown = targets.filter((target) => target.getClientRects().length);
      const small = shown.flatMap((target) => {
        const box = target.getBoundingClientRect();
        return box.width >= 24 && box.height >= 24 ? [] : [`${target.textContent.trim() || target.getAttribute("aria-label")}: ${Math.round(box.width)} x ${Math.round(box.height)} px`];
      });
      return { measured: shown.length, small };
    });
    assert.ok(measured >= 20, `bara ${measured} mål i sidomenyn`);
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

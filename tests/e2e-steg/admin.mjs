// Adminpanelens formulär, redigeringspanelen, galleriet och vägen tillbaka efter inloggningen.
import assert from "node:assert";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { changeTemporaryPassword, createEditor, newVisitor, openLogin, tryLogin, uniqueId, gotoEditing, waitForHydration } from "../e2e-hjalp.mjs";

const ADMIN = "admin@statlin.se";

let images;
/** Bilder till uppladdningarna, med olika färg så att de går isär. Skapas första gången de behövs. */
async function testImages(count) {
  if (!images) {
    const dir = await mkdtemp(path.join(tmpdir(), "statlin-admin-"));
    images = [];
    for (const [i, color] of ["#ff0707", "#2e3192", "#fbb03b", "#0a0a0a"].entries()) {
      const file = path.join(dir, `bild-${i + 1}.jpg`);
      await sharp({ create: { width: 800, height: 600, channels: 3, background: color } }).jpeg().toFile(file);
      images.push(file);
    }
  }
  return images.slice(0, count);
}

/** Skapar ett publicerat evenemang långt fram. Svarar med adressen till formuläret och sluggen. */
async function createEvent(page, BASE, title) {
  await page.goto(`${BASE}/admin/evenemang/ny`);
  await waitForHydration(page, page.locator('input[name="title"]'));
  await page.fill('input[name="title"]', title);
  await page.fill('input[name="starts_at"]', "2031-03-10T18:00");
  await page.fill('textarea[name="summary"]', "Skapat av det automatiska testet.");
  await Promise.all([page.waitForURL(/\/admin\/evenemang\/\d+\?skapad=1/), page.getByRole("button", { name: "Publicera", exact: true }).click()]);
  return { url: page.url().split("?")[0], slug: await page.inputValue('input[name="slug"]') };
}

/** Fyller i kontoformuläret för ett nytt konto. Svarar med adressen. */
async function submitNewUser(page, name) {
  const email = `e2e-${uniqueId()}@statlin.se`;
  await page.fill('input[name="name"]', name);
  await page.fill('input[name="email"]', email);
  return email;
}

export default async function adminSteg({ BASE, browser, page, step, switchAccount }) {
  await step("Nästa konto får rollen som visas efter att ett konto skapats (SB-31)", async () => {
    await switchAccount(page, ADMIN);
    await page.goto(`${BASE}/admin/konton`);
    await waitForHydration(page, page.getByRole("button", { name: "Skapa konto" }));
    const first = await submitNewUser(page, "Roll Första");
    await page.locator('label:has(input[name="role"][value="editor"])').click();
    await page.getByRole("button", { name: "Skapa konto" }).click();
    await page.getByText(`Kontot för ${first} är skapat`).waitFor();

    // Efter sparningen visas grundvalet, och det är också det som är ikryssat.
    const checked = page.locator('input[name="role"]:checked');
    await page.waitForFunction(() => document.querySelector('input[name="role"]:checked')?.closest("label").className.includes("bg-ink"));
    assert.equal(await checked.getAttribute("value"), "committee", "Formuläret ska ha gått tillbaka till grundvalet");
    assert.equal(await page.locator('label:has(input[name="role"]):has-text("Redaktör")').evaluate((el) => el.className.includes("bg-ink")), false, "Redaktör ska inte se vald ut");

    // Nästa konto, med rollen orörd: det som visas är det som sparas.
    const second = await submitNewUser(page, "Roll Andra");
    await page.getByRole("button", { name: "Skapa konto" }).click();
    await page.getByText("Ett utskottskonto måste kopplas till ett utskott.").waitFor();
    // Inte administratör: kontostegen förutsätter att det bara finns en.
    await page.locator('label:has(input[name="role"][value="editor"])').click();
    await page.getByRole("button", { name: "Skapa konto" }).click();
    await page.getByText(`Kontot för ${second} är skapat`).waitFor();
    await page.reload();
    await page.getByText(second).first().waitFor();
    const row = page.locator("tr, li", { hasText: second }).first();
    await row.getByText("Redaktör").first().waitFor();
    await page.locator("tr, li", { hasText: first }).first().getByText("Redaktör").waitFor();
  });

  await step("Redigeringspanelen ligger kvar när en sparning ritar om sidan (SB-30)", async () => {
    const { slug } = await createEvent(page, BASE, `E2E-panel ${uniqueId()}`);
    await gotoEditing(page, `${BASE}/evenemang/${slug}`);
    await page.locator("button:visible", { hasText: "Byt bilder" }).click();
    const panel = page.getByRole("dialog");
    await panel.locator('input[type="file"][multiple]').setInputFiles(await testImages(1));
    const caption = panel.getByLabel("Bildtext");
    await caption.waitFor();
    await caption.fill("Bildtext från panelen");
    await caption.press("Enter");
    await panel.locator(".text-emerald-600").waitFor();
    // Sparningen ritar om sidan i bakgrunden. Ge omritningen tid: panelen ska stå kvar efteråt.
    await page.waitForTimeout(1500);
    assert.equal(await panel.isVisible(), true, "Panelen ska ligga kvar");
    await page.keyboard.press("Escape");
    await panel.waitFor({ state: "detached" });
  });

  await step("Ett utkast som publiceras får dagens datum, och en sparning ändrar det inte (SB-33)", async () => {
    const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm" }).format(new Date());
    const open = async (url) => {
      await page.goto(url);
      await waitForHydration(page, page.locator('input[name="title"]'));
      const details = page.locator('details:has(input[name="published_at"])');
      if (!(await details.evaluate((d) => d.open))) await details.locator("summary").click();
    };
    const field = page.locator('input[name="published_at"]');
    const save = async (label) => {
      const saved = page.waitForResponse((r) => r.request().method() === "POST");
      await page.getByRole("button", { name: label, exact: true }).click();
      await saved;
      await page.getByText(/Sparat/).first().waitFor();
    };
    await open(`${BASE}/admin/nyheter/ny`);
    await page.fill('input[name="title"]', `E2E-datum ${uniqueId()}`);
    await page.fill('textarea[name="excerpt"]', "Skapad av det automatiska testet.");
    await field.fill("2020-01-01T12:00");
    await Promise.all([page.waitForURL((u) => u.search === "?skapad=1"), page.getByRole("button", { name: "Spara som utkast", exact: true }).click()]);
    const url = page.url().split("?")[0];

    await open(url);
    assert.equal(await field.inputValue(), "", "Ett utkast visar inget gammalt datum");
    await save("Publicera");
    await open(url);
    const published = await field.inputValue();
    assert.ok(published.startsWith(today), `Publiceringen ska ge dagens datum: ${published}`);

    // Att spara igen ändrar inget, inte ens utan omladdning.
    await page.fill('textarea[name="excerpt"]', "Ändrad ingress.");
    await save("Spara ändringar");
    await open(url);
    assert.equal(await field.inputValue(), published);

    // Ett valt datum gäller, och ett framtida ligger kvar när utkastet publiceras.
    await field.fill("2021-05-05T10:00");
    await save("Spara ändringar");
    await open(url);
    assert.equal(await field.inputValue(), "2021-05-05T10:00");
    await field.fill("2031-05-05T10:00");
    await save("Gör till utkast");
    await open(url);
    assert.equal(await field.inputValue(), "2031-05-05T10:00");
    await save("Publicera");
    await open(url);
    assert.equal(await field.inputValue(), "2031-05-05T10:00", "Schemaläggningen ska ligga kvar");

    // Tömt fält tar bort schemaläggningen.
    await field.fill("");
    await save("Spara ändringar");
    await open(url);
    assert.ok((await field.inputValue()).startsWith(today), "Tömt schema ska ge dagens datum");
  });

  await step("Textfältet visar taket, markeras när det är fullt och säger till när en text klipps (SB-35)", async () => {
    await page.goto(`${BASE}/admin/nyheter/ny`);
    const body = page.locator('textarea[name="body_md"]');
    await waitForHydration(page, body);
    const counter = page.getByText(/^0 \/ 40\s000$/);
    await counter.waitFor();

    // Klistrar in på riktigt: webbläsaren klipper vid maxLength, och det är det beskedet ska berätta.
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {});
    await body.focus();
    await page.evaluate(() => {
      const data = new DataTransfer();
      data.setData("text", "x".repeat(41000));
      const ta = document.querySelector('textarea[name="body_md"]');
      if (ta.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }))) document.execCommand("insertText", false, "x".repeat(41000));
    });
    await page.getByText(/^40\s000 \/ 40\s000$/).waitFor();
    assert.equal(await body.inputValue().then((v) => v.length), 40000);
    assert.equal(await body.getAttribute("aria-invalid"), "true");
    await page.getByText("De sista 1 000 tecknen klistrades inte in.", { exact: false }).waitFor();
  });

  await step("Textfältets serverfel står vid fältet (SB-35)", async () => {
    await page.goto(`${BASE}/admin/nyheter/ny`);
    const body = page.locator('textarea[name="body_md"]');
    await waitForHydration(page, body);
    await page.fill('input[name="title"]', `E2E-tak ${uniqueId()}`);
    // En handskriven begäran bryr sig inte om maxLength, så värdet skickas i ett eget fält sist i formuläret (formObject).
    await page.locator('form:has(textarea[name="body_md"])').first().evaluate((form) => {
      const input = Object.assign(document.createElement("input"), { type: "hidden", name: "body_md", value: "y".repeat(40001) });
      form.append(input);
    });
    await page.getByRole("button", { name: "Spara som utkast", exact: true }).click();
    await page.locator("#body_md-error", { hasText: "högst 40000 tecken" }).waitFor();
  });

  await step("Radbrytningar räknas lika i webbläsaren och på servern (SB-35)", async () => {
    await page.goto(`${BASE}/admin/nyheter/ny`);
    const body = page.locator('textarea[name="body_md"]');
    await waitForHydration(page, body);
    await page.fill('input[name="title"]', `E2E-rader ${uniqueId()}`);
    // 36 000 tecken med räknarens mått. Skickas radbrytningarna som CRLF är de 45 000 på servern.
    await body.evaluate((ta) => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(ta, "rad\n".repeat(9000));
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await Promise.all([page.waitForURL((u) => u.search === "?skapad=1"), page.getByRole("button", { name: "Spara som utkast", exact: true }).click()]);
    await page.getByText(/^35\s999 \/ 40\s000$/).waitFor();
    await page.getByRole("button", { name: "Ta bort" }).click();
    await Promise.all([page.waitForURL((u) => u.pathname === "/admin/nyheter"), page.getByRole("alertdialog").getByRole("button", { name: "Ta bort" }).click()]);
  });

  await step("Galleriet: kö, borttagning under uppladdning, släpp på en bild och felrutor (SB-36)", async () => {
    const { url } = await createEvent(page, BASE, `E2E-galleri ${uniqueId()}`);
    const eventId = url.split("/").pop();
    const galleryUrl = `${BASE}/admin/bilder/evenemang/${eventId}`;
    await page.goto(galleryUrl);
    const input = page.locator('input[type="file"][multiple]');
    await waitForHydration(page, page.getByRole("button", { name: "Välj bilder" }));

    // Första batchen, utan fördröjning: två bilder.
    const files = await testImages(4);
    await input.setInputFiles(files.slice(0, 2));
    const captions = page.getByLabel("Bildtext");
    await page.waitForFunction(() => document.querySelectorAll('input[aria-label="Bildtext"]').length === 2);
    await captions.nth(0).fill("Första");
    await captions.nth(0).press("Enter");
    await page.locator(".text-emerald-600").first().waitFor();
    await captions.nth(1).fill("Andra");
    await captions.nth(1).press("Enter");
    await page.waitForFunction(() => document.querySelectorAll(".text-emerald-600").length >= 1);

    // Högst två samtidigt, och en bild kan tas bort medan andra laddas upp.
    let running = 0;
    let most = 0;
    await page.route("**/api/admin/upload", async (route) => {
      most = Math.max(most, ++running);
      await new Promise((resolve) => setTimeout(resolve, 700));
      running--;
      await route.continue();
    });
    await input.setInputFiles(files.slice(0, 4));
    await page.getByText(/Laddar upp bild-4|Optimerar/).first().waitFor();
    await page.getByRole("button", { name: "Ta bort" }).and(page.locator('[title="Ta bort"]')).first().click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Ta bort" }).click();
    await page.waitForFunction(() => document.querySelectorAll('input[aria-label="Bildtext"]').length === 5);
    await page.unroute("**/api/admin/upload");
    assert.ok(most <= 2, `Högst två uppladdningar samtidigt, var ${most}`);

    // Listan och det som sparats ska vara samma, med Andra först och den borttagna borta.
    await page.waitForTimeout(800);
    const order = () => page.locator('input[aria-label="Bildtext"]').evaluateAll((list) => list.map((x) => x.defaultValue));
    const shown = await order();
    assert.equal(shown[0], "Andra", `Andra ska ligga först: ${shown}`);
    assert.ok(!shown.includes("Första"), "Den borttagna bilden ska vara borta");
    const srcs = () => page.locator('li[draggable="true"] img').evaluateAll((list) => list.map((x) => x.getAttribute("src")));
    const before = await srcs();
    await page.reload();
    await waitForHydration(page, page.getByRole("button", { name: "Välj bilder" }));
    await page.waitForFunction(() => document.querySelectorAll('input[aria-label="Bildtext"]').length === 5);
    assert.deepEqual(await srcs(), before, "Ordningen ska ligga kvar efter omladdning");

    // En fil som släpps på en befintlig bild lämnar inte sidan.
    const prevented = await page.locator('li[draggable="true"]').first().evaluate((li) => {
      const data = new DataTransfer();
      data.items.add(new File(["hej"], "fel.txt", { type: "text/plain" }));
      const send = (type) => !li.dispatchEvent(new DragEvent(type, { dataTransfer: data, bubbles: true, cancelable: true }));
      return [send("dragover"), send("drop")];
    });
    assert.deepEqual(prevented, [true, true], "Webbläsaren ska inte få öppna filen");
    await page.getByText("Bara bilder kan läggas i galleriet").waitFor();

    // En misslyckad uppladdning går att försöka igen eller ta bort.
    await page.route("**/api/admin/upload", (route) => route.abort());
    await input.setInputFiles(files.slice(0, 2));
    await page.getByRole("button", { name: "Försök igen" }).nth(1).waitFor();
    await page.unroute("**/api/admin/upload");
    await page.getByRole("button", { name: "Försök igen" }).first().click();
    await page.waitForFunction(() => document.querySelectorAll('input[aria-label="Bildtext"]').length === 6);
    await page.locator("ul li", { hasText: "bild-2" }).getByRole("button", { name: "Ta bort" }).click();
    await page.locator("ul li", { hasText: "bild-2" }).waitFor({ state: "detached" });
    assert.equal(await page.getByRole("button", { name: "Försök igen" }).count(), 0);
  });

  await step("Redigeraren tar flera bilder i en följd, och bildfältet säger till om de andra (SB-36)", async () => {
    await page.goto(`${BASE}/admin/nyheter/ny`);
    const body = page.locator('textarea[name="body_md"]');
    await waitForHydration(page, body);
    await page.locator('input[type="file"][multiple]').setInputFiles(await testImages(2));
    await page.waitForFunction(() => (document.querySelector('textarea[name="body_md"]').value.match(/!\[/g) ?? []).length === 2);
    const text = await body.inputValue();
    assert.ok(text.indexOf("![bild-1]") < text.indexOf("![bild-2]"), "Bilderna ska stå i ordning");

    const paths = await testImages(2);
    const dropped = await page.evaluateHandle(() => new DataTransfer());
    for (const [i] of paths.entries()) {
      await page.evaluate(([data, n]) => data.items.add(new File(["x"], `${n}.jpg`, { type: "image/jpeg" })), [dropped, i]);
    }
    const zone = page.locator('input[name="cover_media_id"]').locator("xpath=following-sibling::div[1]");
    await zone.dispatchEvent("drop", { dataTransfer: dropped });
    await page.getByText("Här används bara en bild: 0.jpg").waitFor();
  });

  await step("Frågorna som var confirm() ställs i en dialog på sidan och går att svara på", async () => {
    const { slug, url } = await createEvent(page, BASE, `E2E-frågor ${uniqueId()}`);
    const dialog = page.getByRole("alertdialog");

    // Osparade ändringar i redigeringspanelen.
    await gotoEditing(page, `${BASE}/evenemang/${slug}`);
    await page.locator("button:visible", { hasText: "Redigera evenemanget" }).click();
    const panel = page.getByRole("dialog");
    const summary = panel.locator('textarea[name="summary"]');
    await waitForHydration(page, summary);
    await summary.fill("Ändrad men inte sparad.");
    await page.keyboard.press("Escape");
    await dialog.getByRole("button", { name: "Avbryt" }).click();
    await dialog.waitFor({ state: "detached" });
    assert.equal(await summary.inputValue(), "Ändrad men inte sparad.", "Avbryt ska lämna panelen orörd");
    await panel.getByRole("button", { name: "Stäng" }).click();
    await dialog.getByRole("button", { name: "Stäng utan att spara" }).click();
    await panel.waitFor({ state: "detached" });

    // Omslaget.
    await page.goto(`${BASE}/admin/bilder/evenemang/${url.split("/").pop()}`);
    await waitForHydration(page, page.getByRole("button", { name: "Välj bilder" }));
    await page.locator('input[type="file"]:not([multiple])').first().setInputFiles((await testImages(1))[0]);
    const removeCover = page.getByRole("button", { name: "Ta bort bild" });
    await page.getByText("Sparat", { exact: true }).waitFor();
    await removeCover.click();
    await dialog.getByRole("button", { name: "Avbryt" }).click();
    await removeCover.waitFor();
    await removeCover.click();
    await dialog.getByRole("button", { name: "Ta bort" }).click();
    await page.getByText("Välj bild eller dra hit").waitFor();

    // Gallringen.
    await page.goto(`${BASE}/admin/bilder`);
    const prune = page.getByRole("button", { name: "Rensa oanvända filer" });
    await waitForHydration(page, prune);
    await prune.click();
    await dialog.getByRole("button", { name: "Rensa" }).click();
    await prune.locator("xpath=following-sibling::p").waitFor();
  });

  await step("Platsen i listan består när fältet saknas eller är tomt (SB-37)", async () => {
    const name = `E2E-partner ${uniqueId()}`;
    await page.goto(`${BASE}/admin/partners`);
    await waitForHydration(page, page.locator('input[name="name"]'));
    await page.fill('input[name="name"]', name);
    await page.getByRole("button", { name: /Lägg till/ }).click();
    await page.waitForURL((u) => u.search.includes("sparad=1"));
    await page.reload();
    await page.getByRole("link", { name }).first().click();
    await page.waitForURL((u) => /\/admin\/partners\/\d+/.test(u.pathname));
    const url = page.url();
    await page.goto(url);
    const order = page.locator('input[name="sort_order"]');
    await waitForHydration(page, order);
    // Platsen väljs när partnern finns: en ny hamnar sist.
    await order.fill("7");
    await page.getByRole("button", { name: /Spara/ }).click();
    await page.getByText("Sponsorn är sparad.").waitFor();
    await page.goto(url);
    await waitForHydration(page, order);
    assert.equal(await order.inputValue(), "7");
    const saveWith = async (change) => {
      await page.goto(url);
      await waitForHydration(page, order);
      await page.fill('textarea[name="description"], input[name="description"]', `Ändrad ${uniqueId()}`);
      await change();
      await page.getByRole("button", { name: /Spara/ }).click();
      await page.getByText("Sponsorn är sparad.").waitFor();
      await page.goto(url);
      await waitForHydration(page, order);
      assert.equal(await order.inputValue(), "7", "Platsen ska bestå");
    };
    await saveWith(() => order.fill(""));
    await saveWith(() => order.evaluate((el) => el.remove()));

    // Fel tal ger fel vid fältet.
    await page.goto(url);
    await waitForHydration(page, order);
    await order.evaluate((el) => {
      el.type = "text";
      el.removeAttribute("max");
      el.value = "10000";
    });
    await page.getByRole("button", { name: /Spara/ }).click();
    await page.getByText("Ordningen får vara högst 9999.").first().waitFor();

    await page.goto(url);
    const remove = page.getByRole("button", { name: "Ta bort" });
    await waitForHydration(page, remove);
    await remove.click();
    await Promise.all([page.waitForURL((u) => u.search.includes("raderad=1")), page.getByRole("alertdialog").getByRole("button", { name: "Ta bort" }).click()]);
  });

  await step("Ett dokument kan inte bli utan både fil och länk, och formuläret töms efter en sparning (SB-37)", async () => {
    const title = `E2E-dokument ${uniqueId()}`;
    await page.goto(`${BASE}/admin/dokument`);
    await waitForHydration(page, page.locator('input[name="title"]'));
    await page.fill('input[name="title"]', title);
    await page.fill('input[name="url"]', "https://example.com/e2e.pdf");
    await page.getByRole("button", { name: "Lägg till dokument" }).click();
    await page.waitForURL((u) => u.search.includes("sparad=1"));
    await page.getByRole("link", { name: title }).first().waitFor();
    assert.equal(await page.locator('input[name="title"]:visible').inputValue(), "", "Formuläret ska vara tomt för nästa dokument");
    await page.getByRole("link", { name: title }).first().click();
    await page.waitForURL((u) => /\/admin\/dokument\/\d+/.test(u.pathname));
    const url = page.url();
    await waitForHydration(page, page.getByRole("button", { name: "Spara", exact: true }));
    await page.fill('input[name="url"]', "");
    await page.getByRole("button", { name: "Spara", exact: true }).click();
    await page.locator("#file-error", { hasText: "Välj en fil eller ange en länk." }).waitFor();
    await page.goto(url);
    assert.equal(await page.inputValue('input[name="url"]'), "https://example.com/e2e.pdf", "Inget ska ha sparats");
    const remove = page.getByRole("button", { name: "Ta bort" });
    await waitForHydration(page, remove);
    await remove.click();
    await Promise.all([page.waitForURL((u) => u.search.includes("raderad=1")), page.getByRole("alertdialog").getByRole("button", { name: "Ta bort" }).click()]);
  });

  await step("Förhandsgranskningen visar hela texten som får sparas (SB-37)", async () => {
    await page.goto(`${BASE}/admin/sidor`);
    await page.locator('a[href^="/admin/sidor/"]').first().click();
    await page.waitForURL((u) => /\/admin\/sidor\/.+/.test(u.pathname));
    const body = page.locator('textarea[name="body_md"]');
    await waitForHydration(page, body);
    await body.evaluate((ta) => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(ta, "x".repeat(55000) + " SLUTET");
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.getByRole("button", { name: "Förhandsgranska" }).click();
    await page.locator(".prose-statlin", { hasText: "SLUTET" }).waitFor();
    await page.reload();
  });

  await step("Inloggningen leder tillbaka till sidan som efterfrågades, med frågesträngen (SB-38)", async () => {
    await switchAccount(page, ADMIN);
    const editor = await createEditor(page, BASE);
    const person = await newVisitor(browser);
    try {
      await openLogin(person.page, BASE);
      assert.equal(await tryLogin(person.page, editor.email, editor.password), null);
      const password = await changeTemporaryPassword(person.page, editor.password);
      await person.context.clearCookies();

      // Utan kaka: proxyn.
      await person.page.goto(`${BASE}/admin/evenemang?sparad=1`);
      const next = new URL(person.page.url());
      assert.equal(next.pathname, "/logga-in");
      assert.equal(next.searchParams.get("next"), "/admin/evenemang?sparad=1");
      await waitForHydration(person.page, person.page.locator("#email"));
      assert.equal(await tryLogin(person.page, editor.email, password), null);
      await person.page.waitForURL((u) => u.pathname === "/admin/evenemang");
      assert.equal(new URL(person.page.url()).search, "?sparad=1", "Frågesträngen ska finnas kvar");

      // Kakan finns men sessionen har gått ut: layouten och requireUser.
      await person.context.clearCookies();
      await person.context.addCookies([{ name: "statlin_session", value: "utgangen", url: BASE }]);
      await person.page.goto(`${BASE}/admin/nyheter`);
      await person.page.waitForURL((u) => u.pathname === "/logga-in");
      assert.equal(new URL(person.page.url()).searchParams.get("next"), "/admin/nyheter");
      await waitForHydration(person.page, person.page.locator("#email"));
      assert.equal(await tryLogin(person.page, editor.email, password), null);
      await person.page.waitForURL((u) => u.pathname === "/admin/nyheter");

      // En adress utanför adminpanelen går inte att skicka in.
      await person.context.clearCookies();
      await person.page.goto(`${BASE}/logga-in?next=${encodeURIComponent("//example.com/admin")}`);
      await waitForHydration(person.page, person.page.locator("#email"));
      assert.equal(await tryLogin(person.page, editor.email, password), null);
      await person.page.waitForURL((u) => u.pathname.startsWith("/admin"));
      assert.equal(new URL(person.page.url()).host, new URL(BASE).host);
    } finally {
      await person.context.close();
    }
  });

  await step("Knappar med utgången session säger till i stället för att inget händer", async () => {
    await switchAccount(page, ADMIN);
    const signedOut = "Du har loggats ut";
    const expire = async () => {
      const cookies = await page.context().cookies();
      await page.context().clearCookies({ name: "statlin_session" });
      return () => page.context().addCookies(cookies.filter((c) => c.name === "statlin_session"));
    };

    // Granskningen.
    const { url, slug } = await createEvent(page, BASE, `E2E-tyst ${uniqueId()}`);
    await page.goto(url);
    const review = page.getByRole("button", { name: /Markera som granskad|Ångra granskning/ });
    await waitForHydration(page, review);
    let restore = await expire();
    await review.click();
    await page.getByText(signedOut).first().waitFor();
    await restore();

    // Flyttknapparna.
    await page.goto(`${BASE}/admin/styrelsen`);
    const down = page.locator("span.inline-flex.flex-col button:not([disabled])").first();
    await waitForHydration(page, down);
    restore = await expire();
    await down.click();
    await page.getByText(signedOut).first().waitFor();
    await restore();

    // Raderingen: felet står i bekräftelsen, och evenemanget finns kvar.
    await page.goto(url);
    const remove = page.getByRole("button", { name: "Ta bort" });
    await waitForHydration(page, remove);
    restore = await expire();
    await remove.click();
    const dialog = page.getByRole("alertdialog");
    await dialog.getByRole("button", { name: "Ta bort" }).click();
    await dialog.getByText(signedOut).waitFor();
    await restore();
    const visitor = await newVisitor(browser);
    const response = await visitor.page.goto(`${BASE}/evenemang/${slug}`);
    assert.equal(response.status(), 200, "Evenemanget ska finnas kvar");
    await visitor.context.close();
    await page.goto(url);
    await waitForHydration(page, remove);
    await remove.click();
    await Promise.all([page.waitForURL((u) => u.search.includes("raderad=1")), dialog.getByRole("button", { name: "Ta bort" }).click()]);
  });

  await step("Ett dolt UBU syns inte på studiesidorna och länkas inte", async () => {
    await switchAccount(page, ADMIN);
    const setVisible = async (visible) => {
      await page.goto(`${BASE}/admin/utskott`);
      await page.locator('a[href^="/admin/utskott/"]', { hasText: "UBU" }).first().click();
      await page.waitForURL((u) => /\/admin\/utskott\/\d+/.test(u.pathname));
      const toggle = page.locator('input[name="visible"]');
      await waitForHydration(page, toggle);
      if ((await toggle.isChecked()) !== visible) await page.locator('label:has(input[name="visible"])').click();
      await page.getByRole("button", { name: "Spara", exact: true }).click();
      await page.getByText(/sparad|sparat/i).first().waitFor();
    };
    const pages = [`${BASE}/studenter/kandidat`, `${BASE}/studenter/master`, `${BASE}/en/masters`];
    const count = async (visitor, url) => {
      await visitor.page.goto(url);
      return visitor.page.locator('a[href="/utskott/ubu"]').count();
    };
    const visitor = await newVisitor(browser);
    try {
      for (const url of pages) assert.ok((await count(visitor, url)) > 0, `${url} ska länka till UBU`);
      await setVisible(false);
      for (const url of pages) assert.equal(await count(visitor, url), 0, `${url} ska inte länka till ett dolt UBU`);
    } finally {
      await setVisible(true);
      await visitor.context.close();
    }
  });

  await step("Översikten räknar ett pågående evenemang som kommande", async () => {
    await switchAccount(page, ADMIN);
    const dateOf = (days) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
    const title = `E2E-pågår ${uniqueId()}`;
    const { url } = await createEvent(page, BASE, title);
    await page.goto(url);
    await waitForHydration(page, page.locator('input[name="starts_at"]'));
    await page.fill('input[name="starts_at"]', `${dateOf(-2)}T18:00`);
    const more = page.locator("details", { has: page.locator('input[name="ends_at"]') });
    if ((await more.getAttribute("open")) === null) await more.locator("summary").click();
    await page.fill('input[name="ends_at"]', `${dateOf(2)}T18:00`);
    await page.locator('button[data-submit="primary"]').click();
    await page.getByText("Sparat och publicerat.").first().waitFor();
    await page.goto(`${BASE}/admin`);
    await page.getByRole("link", { name: new RegExp(title) }).first().waitFor();
    await page.goto(url);
    const remove = page.getByRole("button", { name: "Ta bort" });
    await waitForHydration(page, remove);
    await remove.click();
    await Promise.all([page.waitForURL((u) => u.search.includes("raderad=1")), page.getByRole("alertdialog").getByRole("button", { name: "Ta bort" }).click()]);
  });

  await step("En ersatt fil behåller adressen och ger det nya innehållet (SD-35)", async () => {
    await switchAccount(page, ADMIN);
    const title = `E2E-fil ${uniqueId()}`;
    const pdf = (text) => ({ name: "protokoll.pdf", mimeType: "application/pdf", buffer: Buffer.from(`%PDF-1.4\n%${text}\n`) });
    await page.goto(`${BASE}/admin/dokument`);
    await waitForHydration(page, page.locator('input[name="title"]'));
    await page.fill('input[name="title"]', title);
    await page.locator('input[name="file"]').setInputFiles(pdf("forsta"));
    await Promise.all([page.waitForURL((u) => u.search.includes("sparad=1")), page.getByRole("button", { name: "Lägg till dokument" }).click()]);

    const visitor = await newVisitor(browser);
    try {
      const fileHref = async () => {
        await visitor.page.goto(`${BASE}/dokument`);
        const row = visitor.page.locator("li", { hasText: title });
        return new URL(await row.locator('a[href^="/media/"]').first().getAttribute("href"), BASE).href;
      };
      const before = await fileHref();
      assert.match(await (await visitor.context.request.get(before)).text(), /forsta/);

      await page.reload();
      await page.getByRole("link", { name: title }).first().click();
      await page.waitForURL((u) => /\/admin\/dokument\/\d+/.test(u.pathname));
      const url = page.url();
      await page.goto(url);
      await waitForHydration(page, page.getByRole("button", { name: "Spara", exact: true }));
      await page.locator('input[name="file"]').setInputFiles(pdf("andra"));
      await page.getByRole("button", { name: "Spara", exact: true }).click();
      await page.getByText(/sparat/i).first().waitFor();

      assert.equal(await fileHref(), before, "Adressen ska bestå");
      assert.match(await (await visitor.context.request.get(before)).text(), /andra/);

      await page.goto(url);
      const remove = page.getByRole("button", { name: "Ta bort" });
      await waitForHydration(page, remove);
      await remove.click();
      await Promise.all([page.waitForURL((u) => u.search.includes("raderad=1")), page.getByRole("alertdialog").getByRole("button", { name: "Ta bort" }).click()]);
    } finally {
      await visitor.context.close();
    }
  });

  await step("Länkar och hjälpmedel går att lägga till, ändra och ta bort, och ändringen består (ST-07)", async () => {
    await switchAccount(page, ADMIN);
    const forms = [
      { list: "/admin/lankar", field: "label", add: "Lägg till länk", saved: "Länken är sparad.", fill: { url: "https://example.com/e2e" } },
      { list: "/admin/hjalpmedel", field: "title", add: "Lägg till hjälpmedel", saved: "Hjälpmedlet är sparat.", fill: { url: "https://example.com/e2e" } },
    ];
    for (const form of forms) {
      const name = `E2E-rad ${uniqueId()}`;
      await page.goto(`${BASE}${form.list}`);
      await waitForHydration(page, page.locator(`input[name="${form.field}"]`));
      await page.fill(`input[name="${form.field}"]`, name);
      for (const [key, value] of Object.entries(form.fill)) await page.fill(`input[name="${key}"]`, value);
      await Promise.all([page.waitForURL((u) => u.search.includes("sparad=1")), page.getByRole("button", { name: form.add }).click()]);
      await page.getByRole("link", { name }).first().click();
      await page.waitForURL((u) => new RegExp(`${form.list}/\\d+$`).test(u.pathname));
      const url = page.url();
      await page.goto(url);
      const save = page.getByRole("button", { name: "Spara", exact: true });
      await waitForHydration(page, save);
      await page.fill('input[name="description"]', "Ändrad av testet");
      await save.click();
      await page.getByText(form.saved).first().waitFor();
      await page.goto(url);
      assert.equal(await page.inputValue('input[name="description"]'), "Ändrad av testet", `${form.list} ska ha sparat ändringen`);
      const remove = page.getByRole("button", { name: "Ta bort" });
      await waitForHydration(page, remove);
      await remove.click();
      await Promise.all([page.waitForURL((u) => u.search.includes("raderad=1")), page.getByRole("alertdialog").getByRole("button", { name: "Ta bort" }).click()]);
      assert.equal(await page.getByRole("link", { name }).count(), 0, "Raden ska vara borta");
    }
  });

  await step("Rollfältet visar sitt eget fel (SB-35)", async () => {
    await page.goto(`${BASE}/admin/konton`);
    await waitForHydration(page, page.getByRole("button", { name: "Skapa konto" }));
    await submitNewUser(page, "Utan Roll");
    await page.evaluate(() => document.querySelectorAll('input[name="role"]').forEach((r) => { r.checked = false; }));
    await page.getByRole("button", { name: "Skapa konto" }).click();
    await page.locator("fieldset").getByText("Välj en roll.").waitFor();
  });
}

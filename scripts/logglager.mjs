#!/usr/bin/env node
/**
 * Delar utskottens loggor i två lager för entrén på utskottens sidor (src/components/karaktar/motiv.tsx): bilden utan den
 * röda signaturen (<namn>-bild.webp) och signaturen för sig (<namn>-skrift.webp). Lagren ovanpå varandra är loggan som den var.
 *
 *   node scripts/logglager.mjs        kör om en logga i public/brand/utskott byts
 *
 * Signaturen står på samma plats i alla loggor som bygger på mallen (statlin-bas.webp), så mallens röda visar var den finns.
 * Det skiljer den från annat rött, som eSTIG:s röda block. Under signaturen får varje pixel den färg som väger tyngst bland
 * pixlarna runt om (närmare väger mer), så att ytorna möts i jämna kanter, och den svarta ringen dras hel där signaturen korsar den.
 * Det som inte går att gissa så, som bollens mittfält, ritas in efter mått (LAGNING). Byts en logga ska dess lagning göras om
 * eller tas bort.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import sharp from "sharp";

const MAPP = "public/brand/utskott";
const LOGGOR = ["ubu", "sasu", "statpub", "stig", "estig", "amo"];
/*
 * Loggor där signaturen skrivs före bilden (UBU, se .entre[data-motiv="trad"] i globals.css). Signaturens lager får då bara ha
 * signaturens eget, det röda och dess vita kant. Det mörka intill, trädets kvistar och ringens kant, stannar i bilden, så att inget
 * av det syns runt signaturen innan trädet och ringen har kommit.
 */
const SNAV = new Set(["ubu"]);

/*
 * Lagningar: det som stod under signaturen och inte går att gissa ur pixlarna runt om, ritat efter det som syns bredvid
 * (bollens mittfält, skivans hål, urtavlans streck). Måtten är loggans egna, 0–1000. Formerna läggs bara där signaturen
 * stod, och där en lagning är tom gäller rösterna.
 */
const VITT = `<rect width="1000" height="1000" fill="#fff"/>`;
const linje = (d, bredd) => `<path d="${d}" stroke-width="${bredd}"/>`;
const ruta = (x, y, farg) => `<rect x="${x}" y="${y}" width="68" height="68" fill="${farg}" stroke="#1a1a1a" stroke-width="4"/>`;
/** Streck på en urtavla: från radien r0 till r1 vid varje vinkel, medurs från tolv. */
const streck = ([x, y], vinklar, r0, r1, bredd) => vinklar.map((v) => `<path d="M${x} ${y - r1}V${y - r0}" stroke-width="${bredd}" transform="rotate(${v} ${x} ${y})"/>`).join("");
const hal = (punkter, r) => punkter.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#000" stroke="none"/>`).join("");

const SASU_HAL = [[416.1, 240.7], [773.6, 488.5], [682.8, 707.1], [455.9, 774.4], [259.9, 638.9], [242.1, 401.9], [651.2, 270.1], [499.6, 504.3]];
const URMITT = [498.7, 501.7];
const LAGNING = {
  // Bollen: det vita, mittfältet, vänstra fältet och sömmarna mellan dem.
  stig:
    `<path d="M95 300L300 240L790 215V330L760 600L520 668H320L200 650L130 600L95 560Z" fill="#fff" stroke="none"/>` +
    `<path d="M512.5 265L633 329L644 462L631.6 469.2L548.8 519.6L516 537L484 519L420 481L391 461L400 322.5ZM150 298L193.6 266L218 322L127 536L95 474V335Z" fill="#000" stroke="none"/>` +
    linje("M633 329L700 259.6L802 323M391 461L282 534L287.5 600L300 676M282 534L216 487L193 464L168 440M516 537L512.5 676M644 462L746 536", 3),
  // Skivan: hålen är cirklar, och ekrarna är streckade från mitten.
  sasu: VITT + hal(SASU_HAL, 71.8) + `<path d="M428.1 475.8L308.9 428.4M543 437.2L612.1 330.4" stroke-width="4" stroke-dasharray="24 23"/>` + linje("M633.8 496.6L656.3 495.3", 4),
  // Urtavlan: tolv streck, de fyra väderstrecken grövre, och de två visarna genom mitten.
  amo: VITT + streck(URMITT, [0, 90, 180, 270], 228, 368, 18) + streck(URMITT, [30, 60, 120, 150, 210, 240, 300, 330], 277, 369, 9.5) + linje("M380 703L522 452", 10) + linje("M468 482L650 600", 12),
  // Tappen: pelaren ner i ölet och den högra kranen, spegelvänd mot den vänstra.
  statpub:
    `<path d="M100 180H900V480L800 505L650 535L545 570L350 590L250 615L160 640H100Z" fill="#fff" stroke="none"/>` +
    `<path d="M450 270H535.3V610H450ZM546 250H614V270H546ZM612.1 193H655.4V290H612.1ZM645.4 290H622.1L627.4 324.7H640.1Z" fill="#000" stroke="none"/>` +
    `<rect x="606" y="193" width="109" height="20" rx="10" fill="#000" stroke="none"/>` +
    `<path d="M440 606L450 603L535 587L560 584V640H440Z" fill="#eaa43f" stroke="none"/>`,
  // Trädet: stammen upp genom kronan och de två grova grenarna. Kvistarna under signaturen får vara borta.
  ubu:
    VITT +
    `<path d="M444 260L450 300L456 360L463 408L464 488L470 640H516V608L498 560L502 536L516 516L550 488L570 464L630 436L688 406V392L630 400L594 422L550 440L514 462L490 480L484 408L476 360L466 300L458 260Z" fill="#000" stroke="none"/>` +
    `<g stroke-linejoin="round" stroke-linecap="round">${linje("M470 552L422 520L374 458", 20)}${linje("M374 458L342 450L318 452L288 436L270 408L255 378", 15)}${linje("M566 491L534 502", 5)}</g>`,
  // Blocken: rutorna längst ner till vänster och hörnet av den lila.
  estig:
    `<path d="M0 0H1000V565H498V700H298V633H0Z" fill="#fff" stroke="none"/>` +
    ruta(92, 634.7, "#2f3192") + ruta(160, 634.7, "#f9af3b") + ruta(228, 634.7, "#f9af3b") + ruta(160, 702.7, "#f6b23e") + ruta(228, 702.7, "#f15a24") + ruta(500, 566.7, "#8558a9"),
};

const pixlar = (fil, b, h) => sharp(fil).resize(b, h, { fit: "fill" }).ensureAlpha().raw().toBuffer();
const ar_rod = (d, i) => d[i * 4 + 3] > 40 && d[i * 4] > 150 && d[i * 4 + 1] < 110 && d[i * 4 + 2] < 110;

/** Vidgar masken ett antal pixlar åt alla håll. */
function vidga(mask, b, h, steg) {
  let nu = mask;
  for (let s = 0; s < steg; s++) {
    const ny = Uint8Array.from(nu);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < b; x++) {
        const i = y * b + x;
        if (!nu[i] && ((x > 0 && nu[i - 1]) || (x < b - 1 && nu[i + 1]) || (y > 0 && nu[i - b]) || (y < h - 1 && nu[i + b]))) ny[i] = 1;
      }
    nu = ny;
  }
  return nu;
}

fs.mkdirSync(`${MAPP}/lager`, { recursive: true });
for (const namn of LOGGOR) {
  const { width: b, height: h } = await sharp(`${MAPP}/${namn}.webp`).metadata();
  const n = b * h;
  const [bild, mall] = await Promise.all([pixlar(`${MAPP}/${namn}.webp`, b, h), pixlar(`${MAPP}/statlin-bas.webp`, b, h)]);
  const kant = Math.max(2, Math.round(b * 0.012));
  // Där mallen har sin signatur, med lite marginal eftersom loggorna är skurna någon pixel olika.
  const plats = vidga(Uint8Array.from({ length: n }, (_, i) => (ar_rod(mall, i) ? 1 : 0)), b, h, kant);
  // Signaturen är loggans eget röda på den platsen, och ett par pixlar till för dess vita kant. Utanför ringen finns bara
  // signaturens spetsar, så där hör allt som syns till den.
  const [mx, my] = [(b - 1) / 2, (h - 1) / 2];
  const radie = (i) => Math.hypot((i % b) - mx, Math.floor(i / b) - my);
  const skrift = vidga(Uint8Array.from({ length: n }, (_, i) => ((plats[i] && ar_rod(bild, i)) || (radie(i) > b * 0.503 && bild[i * 4 + 3] > 0) ? 1 : 0)), b, h, kant);
  // Ringens mått läses i mallen, rakt österut från mitten där den är tom: vitt, svart och sedan ingenting.
  const rad = Math.round(my) * b;
  let inre = Math.round(mx);
  while (mall[(rad + inre) * 4] > 128) inre++;
  let yttre = inre;
  while (yttre < b && mall[(rad + yttre) * 4 + 3] > 128) yttre++;
  const [ri, ry] = [inre - mx, yttre - mx];
  // Utanför ringen hör allt till signaturen, också dess mörka kant.
  if (SNAV.has(namn)) for (let i = 0; i < n; i++) if (skrift[i] && radie(i) <= ry + 0.5 && Math.max(bild[i * 4], bild[i * 4 + 1], bild[i * 4 + 2]) < 110) skrift[i] = 0;

  const utan = Buffer.from(bild);
  const ko = [];
  const kalla = new Int32Array(n).fill(-1);
  for (let i = 0; i < n; i++) if (!skrift[i]) kalla[i] = i;
  for (let i = 0; i < n; i++) {
    if (skrift[i]) continue;
    const x = i % b;
    if ((x > 0 && skrift[i - 1]) || (x < b - 1 && skrift[i + 1]) || (i >= b && skrift[i - b]) || (i < n - b && skrift[i + b])) ko.push(i);
  }
  for (let k = 0; k < ko.length; k++) {
    const i = ko[k];
    const x = i % b;
    for (const j of [x > 0 ? i - 1 : -1, x < b - 1 ? i + 1 : -1, i - b, i + b]) {
      if (j < 0 || j >= n || kalla[j] >= 0) continue;
      kalla[j] = kalla[i];
      utan.copy(utan, j * 4, kalla[i] * 4, kalla[i] * 4 + 4);
      ko.push(j);
    }
  }
  // Inne i ringen röstar pixlarna runt om: den färg som har störst sammanlagd vikt (ett genom avståndet i kvadrat) vinner.
  // Färgerna räknas i grova fack, så att kantpixlarnas mellantoner inte får en egen röst som räknas. Ringen själv röstar inte,
  // annars äter dess svarta sig in i bilden.
  const runt = Math.round(b * 0.05);
  for (let i = 0; i < n; i++) {
    if (!skrift[i] || radie(i) > ri + 1) continue;
    const [x, y] = [i % b, Math.floor(i / b)];
    const roster = new Map();
    for (let dy = -runt; dy <= runt; dy++) {
      for (let dx = -runt; dx <= runt; dx++) {
        const [px, py] = [x + dx, y + dy];
        if (px < 0 || px >= b || py < 0 || py >= h || skrift[py * b + px] || radie(py * b + px) > ri - 1) continue;
        const j = (py * b + px) * 4;
        const fack = bild[j + 3] < 128 ? -1 : ((bild[j] >> 6) << 4) | ((bild[j + 1] >> 6) << 2) | (bild[j + 2] >> 6);
        const rost = roster.get(fack) ?? [0, 0, 0, 0, 0];
        const vikt = 1 / (dx * dx + dy * dy);
        rost[0] += vikt;
        for (let k = 0; k < 4; k++) rost[k + 1] += bild[j + k] * vikt;
        roster.set(fack, rost);
      }
    }
    let basta;
    for (const rost of roster.values()) if (!basta || rost[0] > basta[0]) basta = rost;
    if (basta) utan.set(basta.slice(1).map((v) => Math.round(v / basta[0])), i * 4);
  }
  // Lagningen ritas i loggans storlek och läggs över rösterna där signaturen stod.
  if (LAGNING[namn]) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="${b}" height="${h}" preserveAspectRatio="none" fill="none" stroke="#000">${LAGNING[namn]}</svg>`;
    const lagad = await sharp(Buffer.from(svg)).resize(b, h, { fit: "fill" }).ensureAlpha().raw().toBuffer();
    for (let i = 0; i < n; i++) {
      if (!skrift[i] || radie(i) > ri + 1) continue;
      const a = lagad[i * 4 + 3] / 255;
      for (let k = 0; k < 3; k++) utan[i * 4 + k] = Math.round(utan[i * 4 + k] * (1 - a) + lagad[i * 4 + k] * a);
      utan[i * 4 + 3] = Math.max(utan[i * 4 + 3], lagad[i * 4 + 3]);
    }
  }
  // Ringen är svart där signaturen korsar den, med mjuk kant inåt mot bilden och utåt mot ingenting.
  for (let i = 0; i < n; i++) {
    const r = radie(i);
    if (!skrift[i] || r < ri - 0.5) continue;
    // Utanför ringen finns bara signaturens spetsar, så där är bilden tom.
    if (r > ry + 0.5) {
      utan[i * 4 + 3] = 0;
      continue;
    }
    const ljus = 1 - Math.min(1, r - ri + 0.5);
    utan.set([utan[i * 4] * ljus, utan[i * 4 + 1] * ljus, utan[i * 4 + 2] * ljus, r < ri + 1 ? 255 : Math.round(255 * Math.min(1, ry + 0.5 - r))], i * 4);
  }
  const bara = Buffer.from(bild);
  for (let i = 0; i < n; i++) if (!skrift[i]) bara[i * 4 + 3] = 0;

  const spara = (data, fil) => sharp(data, { raw: { width: b, height: h, channels: 4 } }).webp({ lossless: true }).toFile(`${MAPP}/lager/${fil}`);
  await Promise.all([spara(utan, `${namn}-bild.webp`), spara(bara, `${namn}-skrift.webp`)]);
  console.log(`${namn}: ${b} × ${h}, signaturen ${skrift.reduce((s, v) => s + v, 0)} pixlar, ringen ${(ri / mx).toFixed(3)} till ${(ry / mx).toFixed(3)}`);
}

// Lagrens adresser får en ny version (LAGER_V i src/lib/karaktar.ts). Filerna i /brand ligger ett dygn i webbläsarens cache, och utan
// en ny adress visar en webbläsare som redan har de gamla lagren dem under den nya entrén.
const summa = crypto.createHash("sha1");
for (const fil of fs.readdirSync(`${MAPP}/lager`).sort()) summa.update(fs.readFileSync(`${MAPP}/lager/${fil}`));
const version = summa.digest("hex").slice(0, 8);
const KALLA = "src/lib/karaktar.ts";
const kalla = fs.readFileSync(KALLA, "utf8");
if (!/const LAGER_V = "[^"]*";/.test(kalla)) throw new Error(`hittar inte LAGER_V i ${KALLA}`);
fs.writeFileSync(KALLA, kalla.replace(/const LAGER_V = "[^"]*";/, `const LAGER_V = "${version}";`));
console.log(`lagrens version: ${version}`);

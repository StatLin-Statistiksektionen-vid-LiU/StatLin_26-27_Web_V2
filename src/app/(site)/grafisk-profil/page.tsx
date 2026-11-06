import type { Metadata } from "next";
import { Suspense, cache } from "react";
import { Overall } from "@/components/content/overall";
import { ArrowUpRight, Download, FileText } from "@/components/icons";
import { CopyButton } from "@/components/ui/copy-button";
import { PageHero } from "@/components/ui/page-hero";
import { Reveal } from "@/components/ui/reveal";
import { listDocuments } from "@/lib/data/content";
import { cn, formatBytes, safeExternalUrl } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Grafisk profil",
  description: "StatLins grafiska profil: sektionsloggan, utskottsloggor, färgkoder, typsnitt och kläder.",
};

const LOGO_VARIANTS = [
  { file: "statlin", name: "Sektionsloggan", note: "Standard", bg: "bg-white [[data-tema=mork]_&]:bg-ink" },
  { file: "statlin-inverterad", name: "StatLin Inverterad", note: "På svart bakgrund", bg: "bg-ink [[data-tema=mork]_&]:bg-paper" },
  { file: "statlin-svart", name: "StatLin Svart", note: "Enfärg, gråskala", bg: "bg-white [[data-tema=mork]_&]:bg-ink" },
  { file: "statlin-vit", name: "StatLin Vit", note: "Enfärg på mörkt", bg: "bg-ink [[data-tema=mork]_&]:bg-paper" },
  { file: "statlin-rod", name: "StatLin Röd", note: "Enfärg", bg: "bg-white [[data-tema=mork]_&]:bg-ink" },
];

const COMMITTEE_LOGOS = [
  { file: "ubu", name: "UBU", note: "Utbildningsutskottet" },
  { file: "sasu", name: "SASU", note: "Arbetssociala utskottet" },
  { file: "scb", name: "SCB", note: "StatLins Centrala Bärseri" },
  { file: "scb-rund", name: "SCB", note: "Alternativ, rund form" },
  { file: "statpub", name: "StatPub", note: "Pubutskottet" },
  { file: "stig", name: "STIG", note: "Idrottsgruppen" },
  { file: "estig", name: "eSTIG", note: "e-Idrottsgruppen" },
  { file: "amo", name: "AMO", note: "Arbetsmiljöombud" },
  { file: "star", name: "STAR", note: "Arbetsmarknadsdagen" },
  { file: "xcb", name: "XCB", note: "Före detta mästeri" },
  { file: "statlin-bas", name: "Baslogotyp", note: "Mall för utskottsloggor" },
];

type Swatch = { name: string; hex: string; rgb: string; cmyk: string; pantone: string };

const PALETTES: { title: string; note: string; colors: Swatch[] }[] = [
  {
    title: "Basfärger",
    note: "Sektionens färger: röd, svart och vit.",
    colors: [
      { name: "Röd", hex: "#FF0707", rgb: "255 7 7", cmyk: "0 88 99 0", pantone: "2347 CP" },
      { name: "Svart", hex: "#000000", rgb: "0 0 0", cmyk: "63 52 31 100", pantone: "Black 3 CP" },
      { name: "Vit", hex: "#FFFFFF", rgb: "255 255 255", cmyk: "0 0 0 0", pantone: "656 CP" },
    ],
  },
  {
    title: "eSTIG",
    note: "Tilläggsfärger i eSTIG-loggans bakgrundsgrafik.",
    colors: [
      { name: "Mörkblå", hex: "#2E3192", rgb: "46 49 146", cmyk: "99 83 1 0", pantone: "2370 CP" },
      { name: "Gul", hex: "#FBB03B", rgb: "251 176 59", cmyk: "0 39 83 0", pantone: "7409 CP" },
      { name: "Orange", hex: "#F15A24", rgb: "241 90 36", cmyk: "0 76 93 0", pantone: "1655 CP" },
      { name: "Lila", hex: "#8557A7", rgb: "133 87 167", cmyk: "61 70 0 0", pantone: "2076 CP" },
      { name: "Ljusblå", hex: "#29ABE2", rgb: "41 171 226", cmyk: "78 9 2 1", pantone: "299 CP" },
    ],
  },
  {
    title: "SCB & XCB",
    note: "Mästeriets färgschema skiljer sig från baslogotypen.",
    colors: [
      { name: "Rött", hex: "#D5252B", rgb: "213 37 43", cmyk: "7 94 92 1", pantone: "1795 CP" },
      { name: "Svart", hex: "#000000", rgb: "0 0 0", cmyk: "63 52 31 100", pantone: "Black 3 CP" },
      { name: "Gul", hex: "#EEE242", rgb: "238 226 66", cmyk: "5 0 88 0", pantone: "604 CP" },
    ],
  },
];

const FONTS = [
  { name: "Arial", use: "Rubriker och titlar, versaler och fet stil", style: { fontFamily: "Arial, Helvetica, sans-serif", fontWeight: 700, textTransform: "uppercase" as const } },
  { name: "Arial Black", use: "Alternativ till Arial", style: { fontFamily: '"Arial Black", Arial, sans-serif', fontWeight: 900, textTransform: "uppercase" as const } },
  { name: "Georgia", use: "Brödtext i dokument och protokoll", style: { fontFamily: "Georgia, serif" } },
  { name: "Chaparall Pro", use: "Fritext på profilkläder, fet", style: { fontFamily: '"Chaparral Pro", "Chaparall Pro", Georgia, serif', fontWeight: 700 } },
  { name: "Bahnschrift", use: "Allt som rör STAR", style: { fontFamily: "Bahnschrift, 'DIN Alternate', 'Archivo Variable', sans-serif", fontStretch: "88%" } },
];

/** Hela styrdokumentet länkas redan överst, så det står inte med bland mallarna. */
const GUIDE_PDF = "/brand/download/grafiskt-styrdokument.pdf";

/** Det grafiskt ansvarig lagt upp under Dokument (kategorin Grafisk profil). */
const listMaterial = cache(async () => (await listDocuments({ publishedOnly: true })).filter((d) => d.category === "grafiskt" && d.url !== GUIDE_PDF));

const NAMES = [
  ["StatLin", "Förkortning"],
  ["StLn", "4 tecken"],
  ["StL", "3 tecken"],
  ["SL", "2 tecken"],
  ["S", "1 tecken"],
  ["STATLIN", "Endast versaler"],
];

export default function BrandPage() {
  return (
    <>
      <PageHero
        kicker="Sektionen / Grafisk profil"
        title={
          <>
            Grafisk <span className="text-red">profil</span>
          </>
        }
        lead="Gemensamma symboler för gamla och nya medlemmar. En interaktiv sammanfattning av StatLins grafiska styrdokument, med loggor, färgkoder och typsnitt att ladda ner."
        aside={
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/brand/statlin.svg" alt="" className="logo-kant mx-auto hidden w-60 animate-float md:block" />
        }
      >
        <a href={GUIDE_PDF} className="btn btn-red" target="_blank" rel="noopener noreferrer">
          <FileText size={18} /> Hela styrdokumentet (PDF)
        </a>
      </PageHero>

      <nav aria-label="Innehåll" className="sticky top-[var(--header-h)] z-30 border-b border-ink/10 bg-paper/90 backdrop-blur-lg pointer-coarse:bg-paper pointer-coarse:backdrop-filter-none opak:bg-paper">
        <ul className="container-site flex gap-1 overflow-x-auto py-3 text-sm font-semibold">
          {[
            ["#logotyp", "Logotyp"],
            ["#utskott", "Utskottsloggor"],
            ["#farger", "Färger"],
            ["#typsnitt", "Typsnitt"],
            ["#namn", "Namn"],
            ["#klader", "Kläder"],
          ].map(([href, label]) => (
            <li key={href}>
              <NavLink href={href}>{label}</NavLink>
            </li>
          ))}
          <Suspense fallback={null}>
            <MaterialNavItem />
          </Suspense>
        </ul>
      </nav>

      {/* Logotyp */}
      <section id="logotyp" className="container-site py-20 md:py-28">
        <BrandHeading index="3" title="Logotyp" />
        <div className="mt-10 grid gap-10 lg:grid-cols-12">
          <Reveal className="lg:col-span-5">
            <div className="grid-paper-fine flex aspect-square items-center justify-center rounded-2xl border border-line bg-white p-10 text-ink">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/statlin.svg" alt="StatLins sektionslogga" className="w-full" />
            </div>
          </Reveal>
          <Reveal delay={120} className="space-y-5 text-[1.05rem] leading-relaxed text-ink/80 lg:col-span-6 lg:col-start-7">
            <p>
              Grunden för en StatLin-logga är ett <strong>cirkulärt svart band</strong> med &quot;LINKÖPINGS UNIVERSITET&quot; i vit Arial
              nedtill. Cirkeln korsas på snedden av en <strong>röd skrivstilstext, &quot;Statlin&quot;</strong>, inspirerad av en stigande graf
              i upp-höger-riktning.
            </p>
            <p>
              Sektionsloggan har texten <strong>&quot;STATISTIKSEKTIONEN&quot;</strong> överst. Bakgrunden är ett rutnät av tunna svarta linjer
              ovanför StatLin-grafiken, och bara vertikala linjer under den.
            </p>
            <p className="rounded-2xl border-l-4 border-red bg-white p-5 text-[0.95rem]">
              Sektionsloggans utseende skyddas av styrdokumentet och kan endast ändras genom beslut på årsmötet. Använd alltid originalfilerna
              nedan. Rita aldrig om loggan.
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid grid-cols-2 gap-4 md:grid-cols-5">
          {LOGO_VARIANTS.map((v, i) => (
            <Reveal key={v.file} delay={i * 60}>
              <figure className="group">
                <div className={cn("flex aspect-square items-center justify-center rounded-xl border border-line p-6", v.bg)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/brand/${v.file}.svg`} alt={v.name} className="w-full transition-transform duration-700 group-hover:scale-105" loading="lazy" />
                </div>
                <figcaption className="mt-3">
                  <span className="block text-sm font-bold">{v.name}</span>
                  <span className="block text-xs text-stone">{v.note}</span>
                  <a href={`/brand/${v.file}.svg`} download className="tryck mt-2 inline-flex pointer-coarse:-mt-1 items-center gap-1.5 font-mono text-xs text-red-deep hover:underline">
                    <Download size={13} /> SVG
                  </a>
                  {v.file === "statlin" && (
                    <a href="/brand/download/statlin.png" download className="tryck ml-3 inline-flex items-center gap-1.5 font-mono text-xs text-red-deep hover:underline">
                      <Download size={13} /> PNG
                    </a>
                  )}
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Utskottsloggor */}
      <section id="utskott" className="relative border-y border-line py-20 md:py-28">
        <div className="container-site relative">
          <BrandHeading index="3.2–3.4" title="Utskottsloggor" />
          <p className="mt-5 max-w-2xl text-stone">
            Utskottsloggorna bygger på baslogotypen: förkortningen i vit Arial i bandets övre halva och en egen bakgrundsgrafik. SCB och XCB följer
            en egen standard, och STAR har sitt eget varumärke.
          </p>
          <ul className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3 lg:grid-cols-4">
            {COMMITTEE_LOGOS.map((l) => (
              <li key={l.file} className="group bg-white p-6 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/brand/utskott/${l.file}.webp`} alt={`${l.name}-loggan`} className="mx-auto h-28 w-auto rounded-xl object-contain p-1.5 [[data-tema=mork]_&]:bg-ink transition-transform duration-700 group-hover:-translate-y-1 group-hover:rotate-[-6deg] md:h-32" loading="lazy" />
                <p className="mt-5 font-bold">{l.name}</p>
                <p className="text-xs text-stone">{l.note}</p>
                <a href={`/brand/download/${l.file}.png`} download className="tryck mt-3 inline-flex pointer-coarse:mt-0 items-center gap-1.5 font-mono text-xs text-red hover:underline">
                  <Download size={13} /> PNG
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Färger */}
      <section id="farger" className="container-site py-20 md:py-28">
        <BrandHeading index="4" title="Färgkoder" />
        <p className="mt-5 max-w-2xl text-ink/70">Klicka på ett värde för att kopiera det.</p>
        <div className="mt-12 space-y-14">
          {PALETTES.map((p) => (
            <div key={p.title}>
              <div className="flex items-baseline justify-between border-b border-line pb-3">
                <h3 className="display-tight text-xl">{p.title}</h3>
                <p className="hidden text-sm text-stone sm:block">{p.note}</p>
              </div>
              <ul className={cn("mt-6 grid gap-4", p.colors.length > 3 ? "grid-cols-2 md:grid-cols-5" : "grid-cols-1 sm:grid-cols-3")}>
                {p.colors.map((c) => (
                  <li key={c.name + c.hex} className="overflow-hidden rounded-xl border border-line bg-white">
                    <div className={cn("relative", p.colors.length > 3 ? "h-28" : "h-40")} style={{ background: c.hex }}>
                      <span className="absolute left-4 top-4 text-sm font-bold" style={{ color: ["#FFFFFF", "#EEE242", "#FBB03B", "#F15A24", "#29ABE2"].includes(c.hex) ? "#141413" : "#ffffff" }}>{c.name}</span>
                    </div>
                    <dl className="grid gap-1.5 p-4 text-xs">
                      <ColorRow label="HEX" value={c.hex} />
                      <ColorRow label="RGB" value={c.rgb} />
                      <ColorRow label="CMYK" value={c.cmyk} />
                      <ColorRow label="Pantone" value={c.pantone} />
                    </dl>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Typsnitt */}
      <section id="typsnitt" className="border-y border-line bg-paper-2/50 py-20 md:py-28">
        <div className="container-site">
          <BrandHeading index="5" title="Typsnitt" />
          <p className="mt-5 max-w-2xl text-ink/70">
            Typsnitten gäller dokument, protokoll och tryck. Text på sektionshemsidan är undantagen: webben använder Archivo och JetBrains Mono,
            och Georgia för citat.
          </p>
          <ul className="mt-12 divide-y divide-ink/10 border-y border-ink/10">
            {FONTS.map((f) => (
              <li key={f.name} className="grid grid-cols-1 gap-3 py-7 md:grid-cols-12 md:items-center">
                <div className="md:col-span-3">
                  <p className="font-bold">{f.name}</p>
                  <p className="text-sm text-stone">{f.use}</p>
                </div>
                <p className="text-[clamp(1.6rem,3.6vw,2.8rem)] leading-tight [overflow-wrap:anywhere] md:col-span-9" style={f.style}>
                  Statistiksektionen i Linköping
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Namn */}
      <section id="namn" className="container-site py-20 md:py-28">
        <BrandHeading index="2" title="Namn & förkortningar" />
        <div className="mt-10 grid gap-10 lg:grid-cols-12">
          <p className="text-[1.05rem] leading-relaxed text-ink/80 lg:col-span-5">
            StatLin står för <em>Statistiksektionen i Linköping</em> och skrivs med versalt S och versalt L. Där versaler och gemener inte kan blandas
            skrivs STATLIN. Studiesociala utskottet heter StatLins Centrala Bärseri och förkortas alltid <strong>SCB</strong>, utan punkter.
          </p>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:col-span-6 lg:col-start-7">
            {NAMES.map(([n, note]) => (
              <li key={n} className="rounded-2xl border border-ink/10 bg-white p-5">
                <p className="display-tight text-2xl normal-case">{n}</p>
                <p className="kicker mt-2 text-stone">{note}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Kläder */}
      <section id="klader" className="relative overflow-hidden border-y border-line py-20 md:py-28">
        <div className="container-site relative grid items-center gap-14 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <BrandHeading index="6" title="Overallen" />
            <p className="mt-6 text-lg leading-relaxed text-stone">
              Svart overall med röda revärer från halsen längs ärmarna till ärmuppslaget, och från armhålan ned längs benens utsida. Namnet eller
              smeknamnet sys på med utklippta bokstäver i rött teddytyg, och sektionsloggan sitter på ryggen.
            </p>
            <ul className="mt-8 grid gap-3 text-[0.95rem] text-stone sm:grid-cols-2">
              <li className="rounded-xl border border-line bg-white p-4">
                <span className="block font-semibold text-ink">Styrelsehoodie</span>Vit ziphood, sektionsloggan på ryggen.
              </li>
              <li className="rounded-xl border border-line bg-white p-4">
                <span className="block font-semibold text-ink">SCB-hoodie</span>Svart ziphood, SCB-loggan på ryggen.
              </li>
              <li className="rounded-xl border border-line bg-white p-4">
                <span className="block font-semibold text-ink">StatLin-t-shirt</span>Helsvart, inverterad logga på vänster bröst.
              </li>
              <li className="rounded-xl border border-line bg-white p-4">
                <span className="block font-semibold text-ink">Mästeristass</span>Hängselbyxor, röd fluga och randiga strumpor.
              </li>
            </ul>
          </div>
          <div className={cn("grid grid-cols-2 gap-6 rounded-2xl p-4 lg:col-span-5 lg:col-start-8", "[[data-tema=mork]_&]:bg-ink")}>
            <Overall side="fram" />
            <Overall side="bak" />
          </div>
        </div>
      </section>

      <Suspense fallback={null}>
        <Material />
      </Suspense>
    </>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="block whitespace-nowrap rounded-full px-4 py-2 text-ink/70 transition-colors hover:bg-white hover:text-ink">
      {children}
    </a>
  );
}

async function MaterialNavItem() {
  if ((await listMaterial()).length === 0) return null;
  return (
    <li>
      <NavLink href="#material">Mallar</NavLink>
    </li>
  );
}

/** Mallar för affischer, presentationer och inlägg. Visas bara när det finns något uppladdat. */
async function Material() {
  const docs = (await listMaterial()).flatMap((d) => {
    const href = d.file?.href ?? safeExternalUrl(d.url);
    return href ? [{ ...d, href }] : [];
  });
  if (docs.length === 0) return null;
  return (
    <section id="material" aria-labelledby="material-rubrik" className="container-site py-20 md:py-28">
      <p className="kicker text-stone">
        <span className="text-red-deep">Ladda ner</span> · Från grafiskt ansvarig
      </p>
      <h2 id="material-rubrik" className="display mt-4 text-[clamp(2rem,4.6vw,3.8rem)]">
        Mallar och material
      </h2>
      <p className="mt-5 max-w-2xl text-ink/70">Med rätt loggor, färger och typsnitt från början, för affischer, presentationer och inlägg.</p>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {docs.map((d) => (
          <li key={d.id}>
            <a
              href={d.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex h-full items-start gap-4 rounded-xl border border-line bg-white p-5 transition-colors duration-300 hover:border-ink/20"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-paper-2/60 text-ink transition-colors group-hover:border-red/40 group-hover:text-red">
                <FileText size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold tracking-tight">{d.title}</span>
                {d.description && <span className="mt-0.5 block text-sm leading-snug text-stone">{d.description}</span>}
                <span className="kicker mt-2 block text-stone">{d.file ? `${d.file.ext.toUpperCase()} · ${formatBytes(d.file.size)}` : "Länk"}</span>
              </span>
              {d.file ? (
                <Download size={18} className="mt-1 shrink-0 text-red opacity-60 transition-opacity group-hover:opacity-100" />
              ) : (
                <ArrowUpRight size={18} className="mt-1 shrink-0 text-red opacity-60 transition-opacity group-hover:opacity-100" />
              )}
              <span className="sr-only"> (öppnas i en ny flik)</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Under 435 px ryms inte de längsta rubrikerna i 2rem, så där följer storleken skärmbredden. */
function BrandHeading({ index, title }: { index: string; title: string }) {
  return (
    <div>
      <p className="kicker text-stone">
        <span className="text-red-deep">§ {index}</span> · Grafiskt styrdokument
      </p>
      <h2 className="display mt-4 text-[clamp(2rem,4.6vw,3.8rem)] max-[27.1875rem]:text-[7vw]">{title}</h2>
    </div>
  );
}

function ColorRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-stone">{label}</dt>
      <dd>
        <CopyButton value={value} className="text-ink hover:text-red-deep pointer-coarse:py-1" />
      </dd>
    </div>
  );
}

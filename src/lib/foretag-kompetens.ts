/**
 * Vad studenterna kan, för företagssidan. Uttryckt som färdigheter och inte som kurser, eftersom kurserna byts ut över åren.
 * Underlag: kursplanerna för kandidatprogrammet (F7KSA) och masterprogrammet (F7MML) vid LiU, lästa 2026-10-16, och utbildningsplanerna, lästa 2026-11-05.
 */

export type KompetensNiva = {
  id: string;
  etikett: string;
  undertitel: string;
  rubrik: string;
  text: string;
  /** Ett konkret exempel på vad en student på nivån kan ta sig an. */
  uppdrag: string;
  passar: string;
};

/** j = ingår för alla, v = beror på valda kurser, n = inte på den nivån. */
export type KompetensLage = "j" | "v" | "n";

export type Fardighet = {
  namn: string;
  /** Ett tecken per nivå, i samma ordning som NIVAER. */
  lagen: `${KompetensLage}${KompetensLage}${KompetensLage}${KompetensLage}`;
};

/** Stegen har fasta id:n i den här ordningen. Programmen pekar ut sitt steg med id:t. */
export const NIVA_ID = ["ar1", "ar2", "kandidat", "master"] as const;
export type NivaId = (typeof NIVA_ID)[number];

/** Standardinnehållet. Det som ändras i redigeringsläget sparas som blocket kompetens (src/lib/innehall/block/kompetens.ts). */
export const NIVAER: KompetensNiva[] = [
  {
    id: "ar1",
    etikett: "År 1",
    undertitel: "Grunden",
    rubrik: "Efter första året",
    text: "Har grunden i kvantitativ analys: tar ett rått dataset, beskriver och visualiserar det och testar en enkel hypotes med rätt metod. Kan göra en egen enkätundersökning, skriva ihop resultatet och presentera det. Kodar grundläggande R.",
    uppdrag: "Sammanställa en kundenkät och visa vad den faktiskt säger.",
    passar: "Sommarjobb och extrajobb",
  },
  {
    id: "ar2",
    etikett: "År 2",
    undertitel: "Modellerna",
    rubrik: "Efter andra året",
    text: "Väljer, bygger och granskar regressions- och ANOVA-modeller, gör tidsserieanalys och prognoser med angiven osäkerhet, bygger index och planerar urvalsundersökningar. Har SAS och SQL utöver R och har drivit ett helt statistiskt projekt, från fråga till presentation.",
    uppdrag: "Bygga prognosen för nästa kvartal och ange hur osäker den är.",
    passar: "Sommarjobb och praktik",
  },
  {
    id: "kandidat",
    etikett: "Kandidat",
    undertitel: "Hela vägen",
    rubrik: "Med kandidatexamen",
    text: "Har tagit ett verkligt statistiskt problem hela vägen: formulera frågan, läsa in sig, välja metod, analysera, skriva och försvara. De flesta har dessutom två till fyra fördjupningar, till exempel maskininlärning, bayesiansk statistik, multivariata metoder eller Python.",
    uppdrag: "Ta en affärsfråga från rådata till en rekommendation som håller för granskning.",
    passar: "Kandidatuppsats, som ofta görs åt en extern uppdragsgivare, och första jobbet",
  },
  {
    id: "master",
    etikett: "Master",
    undertitel: "På djupet",
    rubrik: "Med masterexamen",
    text: "Implementerar maskininlärning, djupinlärning och bayesianska modeller från grunden i R och Python, avgör vilken modell som passar och anger hur säkra förutsägelserna är. Kör stora datamängder på distribuerade system och har skrivit en självständig uppsats på 30 hp.",
    uppdrag: "Bygga och utvärdera en prediktionsmodell och kunna förklara när den inte går att lita på.",
    passar: "Examensarbete från januari till juni och första jobbet",
  },
];

/** Nivån som visas innan väljaren har gått igenom stegen, och för den som har stängt av rörelser: den där studenterna kan mest. */
export const FORSTA_NIVA = 3;

/** De två programmen, som företagen möter dem. niva pekar på steget i NIVAER som visar vad programmets studenter kan. */
export const PROGRAM: { niva: NivaId; typ: string; namn: string; roll: string; text: string; nyckelord: string[] }[] = [
  {
    niva: "kandidat",
    typ: "Kandidatprogram, 3 år",
    namn: "Statistik och dataanalys",
    roll: "Analytikern som tar frågan hela vägen",
    text: "Från rådata till ett resultat som håller för granskning. Kvantitativ analys, regression, tidsserieanalys och prognoser ingår för alla, R, SAS och SQL sitter från andra året, och kandidatuppsatsen skrivs ofta med en uppdragsgivare från näringslivet. Det kan vara ni.",
    nyckelord: ["Kvantitativ analys", "Tidsserieanalys", "Regression", "Prognoser", "Enkäter", "R", "SAS", "SQL"],
  },
  {
    niva: "master",
    typ: "Masterprogram, 2 år, på engelska",
    namn: "Statistics and Machine Learning",
    roll: "Specialisten som bygger modellen från grunden",
    text: "Maskininlärning, djupinlärning och bayesianska modeller, implementerade från grunden i R och Python. Fördjupningarna går från tidsserier och Kalmanfilter till textanalys och bioinformatik. Studenterna kommer från statistik, matematik, datavetenskap eller teknik, och examensarbetet på 30 hp skrivs från januari till juni.",
    nyckelord: ["Maskininlärning", "Djupinlärning", "Bayesianska modeller", "Data mining", "Big data", "Tidsserier", "Python", "R"],
  },
];

export const FARDIGHETER: { grupp: string; rader: Fardighet[] }[] = [
  {
    grupp: "Analys",
    rader: [
      { namn: "Kvantitativ analys", lagen: "jjjj" },
      { namn: "Beskriva och visualisera data", lagen: "jjjj" },
      { namn: "Hypotesprövning och inferens", lagen: "jjjj" },
      { namn: "Urval och enkäter", lagen: "jjjv" },
      { namn: "Regressionsanalys", lagen: "njjj" },
      { namn: "ANOVA och experiment", lagen: "njjv" },
      { namn: "Tidsserieanalys", lagen: "njjv" },
      { namn: "Prognoser med angiven osäkerhet", lagen: "njjj" },
      { namn: "Bygga och använda index", lagen: "njjv" },
      { namn: "Statistisk teori", lagen: "njjj" },
      { namn: "Multivariat analys", lagen: "nnvv" },
      { namn: "Longitudinella data och överlevnadsanalys", lagen: "nnvv" },
    ],
  },
  {
    grupp: "Maskininlärning",
    rader: [
      { namn: "Maskininlärning", lagen: "nnvj" },
      { namn: "Bayesianska metoder", lagen: "nnvj" },
      { namn: "Djupinlärning och neurala nätverk", lagen: "nnnj" },
      { namn: "Data mining, klustring och avvikelser", lagen: "nnnj" },
      { namn: "Simulering och optimering", lagen: "nnnj" },
      { namn: "Sekvensmodeller och Kalmanfilter", lagen: "nnnv" },
      { namn: "Textanalys", lagen: "nnnv" },
      { namn: "Bioinformatik", lagen: "nnnv" },
    ],
  },
  {
    grupp: "Verktyg",
    rader: [
      { namn: "R", lagen: "jjjj" },
      { namn: "SQL och databasdesign", lagen: "njjv" },
      { namn: "SAS", lagen: "njjv" },
      { namn: "Python", lagen: "nnvj" },
      { namn: "Big data och distribuerade system", lagen: "nnnj" },
    ],
  },
  {
    grupp: "Arbetssätt",
    rader: [
      { namn: "Rapporter och presentationer", lagen: "jjjj" },
      { namn: "Granska data och slutsatser", lagen: "jjjj" },
      { namn: "Etik och ansvarsfull dataanvändning", lagen: "jjjj" },
      { namn: "Leverera i tid", lagen: "jjjj" },
      { namn: "Projekt från fråga till resultat", lagen: "njjj" },
      { namn: "Bedöma hur långt resultaten räcker", lagen: "njjj" },
      { namn: "Arbeta på engelska", lagen: "nnnj" },
    ],
  },
];

export const LAGE_TEXT: Record<KompetensLage, string> = {
  j: "Ingår för alla",
  v: "Beror på kursval och bakgrund",
  n: "Inte på den här nivån",
};

/** Saker ur utbildningsplanerna och kursplanerna som ett företag sällan får veta, men gärna vill. */
export const GULDKORN: { kalla: string; rubrik: string; text: string }[] = [
  {
    kalla: "Båda programmen",
    rubrik: "Uppsatsen kan lösa ert problem",
    text: "Kandidatuppsatsen skrivs ofta i nära samarbete med en uppdragsgivare från näringslivet. Masteruppsatsen är 30 hp och kan ta sig an ett aktuellt, praktiskt dataproblem, från januari till juni.",
  },
  {
    kalla: "Kandidat",
    rubrik: "Verkliga problem, inte skolexempel",
    text: "Många kurser byggs upp kring verklighetsanknutna projekt, och under andra året driver studenterna ett helt statistiskt projekt, från problemet till presentationen.",
  },
  {
    kalla: "Båda programmen",
    rubrik: "Att leverera i tid är ett kursmål",
    text: "Deadlines står som lärandemål i kursplanerna redan första året och hela vägen fram till uppsatsen. Det är inget ni behöver lära ut.",
  },
  {
    kalla: "Kandidat",
    rubrik: "De bygger index, inte bara läser dem",
    text: "Tidsserieanalys är obligatorisk och går från modell och prognos med angiven osäkerhet till att bygga och använda olika typer av index.",
  },
  {
    kalla: "Kandidat",
    rubrik: "Databasen klarar de också",
    text: "De ritar datamodellen, normaliserar, skriver SQL och kopplar databasen till ett program de bygger själva. Analysen behöver inte börja med en färdig fil.",
  },
  {
    kalla: "Master",
    rubrik: "Det ni redan vet blir en del av modellen",
    text: "Ett av masterns egna mål är att väga ihop data med annan förkunskap för bättre prognoser och beslut. Er erfarenhet räknas alltså också.",
  },
];

/** Där färdigheterna gör nytta direkt. Beskriver vad studenterna tar med sig, inte statistik över var de har hamnat. */
export const BRANSCHER: { namn: string; text: string; figur: "prognos" | "urval" | "overlevnad" | "regression" | "natverk" | "kluster" }[] = [
  {
    namn: "Bank och försäkring",
    text: "Prognoser, riskmodeller och prissättning. Regression och tidsserier sitter från andra året, liksom vanan att alltid ange hur osäkert ett resultat är.",
    figur: "prognos",
  },
  {
    namn: "Myndigheter och offentlig sektor",
    text: "Urval, bortfall och enkäter ingår tidigt i utbildningen, och studenterna vet hur officiell statistik tas fram och vad den används till.",
    figur: "urval",
  },
  {
    namn: "Läkemedel och hälsa",
    text: "Att utvärdera effekten av läkemedel är ett av yrkena utbildningsplanen själv nämner. Analys av experiment ingår för alla, och data över tid, överlevnadsdata och bioinformatik finns som fördjupningar.",
    figur: "overlevnad",
  },
  {
    namn: "Konsult och IT",
    text: "R, Python och SQL, och vanan att sätta sig in i en ny fråga och välja metod efter problemet, inte tvärtom.",
    figur: "regression",
  },
  {
    namn: "Industri och teknik",
    text: "Neurala nätverk för signaler och bilder, tidsseriemodeller för mätdata och stora datamängder på distribuerade system.",
    figur: "natverk",
  },
  {
    namn: "Handel, media och opinion",
    text: "Opinions-, marknads- och kundundersökningar, mönster i köp- och säljdata, textanalys och grafer som går att visa för den som ska fatta beslutet.",
    figur: "kluster",
  },
];

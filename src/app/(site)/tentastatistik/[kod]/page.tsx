import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CourseSearch } from "@/components/exam/course-search";
import { ExamChart } from "@/components/exam/exam-chart";
import { ArrowLeft, ArrowUpRight } from "@/components/icons";
import { PageHero } from "@/components/ui/page-hero";
import { HeroSkeleton } from "@/components/ui/skeletons";
import { getExamStats } from "@/lib/data/exam-stats";
import { formatTimestamp, todayLocal } from "@/lib/dates";
import { normalizeCourseCode, visibleOccasions } from "@/lib/exam-stats";
import { SITE_ALTERNATES } from "@/lib/site-metadata";

type Params = PageProps<"/tentastatistik/[kod]">["params"];

/** Gemener och mellanslag rättas redan i src/proxy.ts, så hit kommer koden med versaler – eller något som inte är en kurskod. */
async function load(params: Params) {
  const { kod } = await params;
  const code = normalizeCourseCode(kod);
  if (!code) return null;
  return { code, ...(await getExamStats(code)) };
}

export async function generateMetadata({ params }: PageProps<"/tentastatistik/[kod]">): Promise<Metadata> {
  const data = await load(params);
  // Att källan inte svarar säger inget om kursen, så sidan ska inte försvinna ur sökmotorerna för det.
  if (data?.unavailable) return { title: `Tentastatistik ${data.code}`, alternates: { ...SITE_ALTERNATES, canonical: `/tentastatistik/${data.code}` } };
  if (!data?.stats) return { title: "Hittade ingen tentastatistik", robots: { index: false } };
  const name = data.stats.title.sv || data.stats.title.en;
  const course = `${data.code}${name ? ` ${name}` : ""}`;
  return {
    title: `Tentastatistik ${course}`,
    description: `Betyg och andel godkända på varje tentatillfälle i ${course} vid Linköpings universitet.`,
    alternates: { ...SITE_ALTERNATES, canonical: `/tentastatistik/${data.code}` },
  };
}

export default function CourseStatsPage(props: PageProps<"/tentastatistik/[kod]">) {
  return (
    <Suspense fallback={<HeroSkeleton />}>
      <CourseStats params={props.params} />
    </Suspense>
  );
}

async function CourseStats({ params }: { params: Params }) {
  const data = await load(params);
  if (!data?.stats) return <Missing code={data?.code ?? null} unavailable={data?.unavailable ?? false} />;
  const { code, stats, fetchedAt } = data;
  const name = stats.title.sv || stats.title.en;
  const hasResults = stats.modules.some((m) => visibleOccasions(m).length > 0);

  return (
    <>
      <PageHero
        kicker="Studenter / Tentastatistik"
        title={code}
        lead={
          name && (
            <>
              <span className="block font-medium text-ink">{name}</span>
              {stats.title.en && stats.title.en !== name && (
                <span lang="en" className="mt-1 block text-base text-stone">
                  {stats.title.en}
                </span>
              )}
            </>
          )
        }
      >
        <CourseLinks code={code} />
      </PageHero>

      <section className="container-site py-12 md:py-16">
        {hasResults ? (
          <ExamChart stats={stats} today={todayLocal()} />
        ) : (
          <p className="max-w-2xl text-lg text-stone">
            Det finns statistik för kursen, men inget tentatillfälle har minst fem resultat. Så små grupper visar vi inte. Titta hos liustats om du
            vill se mer.
          </p>
        )}
        <p className="mt-12 max-w-3xl border-t border-line pt-6 text-sm leading-relaxed text-stone">
          Statistiken kommer från LiU via det öppna API som{" "}
          <a href="https://liustats.se/" target="_blank" rel="noopener noreferrer" className="link-underline text-ink">
            liustats.se
          </a>{" "}
          använder, och hämtas om en gång per dygn{fetchedAt ? `, senast ${formatTimestamp(fetchedAt)}` : ""}. Den räknar skrivningar, inte
          studenter: den som skriver om tentan räknas på varje tillfälle.
        </p>
      </section>

      <section aria-labelledby="sok-igen" className="border-t border-line bg-paper-2/40 py-14 md:py-20">
        <div className="container-site">
          <h2 id="sok-igen" className="display-tight text-[clamp(1.6rem,3vw,2.4rem)]">
            Sök en annan kurs
          </h2>
          <div className="mt-6">
            <CourseSearch />
          </div>
        </div>
      </section>
    </>
  );
}

/** Ingen statistik: okänd kod, en kod som inte ser ut som en kurskod, eller en källa som inte svarar. */
function Missing({ code, unavailable }: { code: string | null; unavailable: boolean }) {
  const lead = unavailable
    ? "Källan för tentastatistiken svarar inte just nu. Försök igen om en stund."
    : code
      ? `Hittade ingen tentastatistik för ${code}. Kontrollera kurskoden, eller sök på en annan kurs.`
      : "Det där ser inte ut som en kurskod. LiU:s kurskoder har sex tecken, till exempel 732G33 eller TATA24.";
  return (
    <>
      <PageHero kicker="Studenter / Tentastatistik" title={code ?? "Tentastatistik"} fitTitle={code ? undefined : "Tentastatistik"} lead={lead} />
      <div className="container-site relative z-20 pb-20 pt-8 md:pt-10">
        <CourseSearch />
        {code && (
          <div className="mt-10">
            <p className="kicker text-stone">Leta vidare</p>
            <CourseLinks code={code} />
          </div>
        )}
        <Link href="/tentastatistik" className="mt-10 inline-flex items-center gap-2 font-semibold">
          <ArrowLeft size={16} />
          <span className="link-underline">Till tentastatistiken</span>
        </Link>
      </div>
    </>
  );
}

/** Kursen hos LiU och hos andra som samlar tentor och statistik. */
function CourseLinks({ code }: { code: string }) {
  const links = [
    { href: `https://studieinfo.liu.se/kurs/${code}`, label: "Kursplan" },
    { href: `https://liutentor.se/search/${code}`, label: "Gamla tentor" },
    { href: `https://liustats.se/${code}`, label: "liustats" },
  ];
  return (
    <ul className="mt-4 flex flex-wrap gap-2">
      {links.map((l) => (
        <li key={l.label}>
          <a href={l.href} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
            {l.label}
            <ArrowUpRight size={14} />
            <span className="sr-only"> (öppnas i en ny flik)</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

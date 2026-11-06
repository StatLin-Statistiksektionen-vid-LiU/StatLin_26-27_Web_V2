import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHero } from "@/components/ui/page-hero";
import { readDb } from "@/lib/data/db";
import { frageladaIsOpen } from "@/lib/data/fragelada";

export const metadata: Metadata = {
  title: "Integritet",
  description: "Vad sajten sparar om besökare och om sektionens poster, och hur länge.",
};

/**
 * Vad sajten faktiskt sparar i dag (SD-31). Tiderna för revisionsloggen kommer från src/lib/db/prune-audit-log.ts och sessionernas
 * från src/lib/auth/session.ts – ändras de där ska sidan ändras med.
 */
/** Syns när frågelådan är på. Texten ska stämma med src/app/(site)/fragelada/actions.ts och migreringssteg 11. */
async function QuestionBoxPrivacy() {
  const db = await readDb();
  if (!frageladaIsOpen(db)) return null;
  return (
    <>
      <h2>Frågelådan</h2>
      <p>
        En fråga sparas med texten, vilken låda den gäller och månaden, och med inget annat. Sajten sparar inget namn, ingen IP-adress, ingen
        webbläsaruppgift och inget klockslag för en fråga, och den sätter ingen kaka. Bara kontot som äger lådan kan läsa frågorna i sajten;
        administratörer ser titlar och antal. Frågor raderas automatiskt när deras månad är mer än tolv månader gammal, eller tidigare av ägaren.
      </p>
      <p>
        IP-adressen används i serverns minne, omgjord till en nyckel som inte går att läsa baklänges, för spärren mot gissade koder och spam. Den
        försvinner senast när servern startar om. Vår leverantör Fly.io ser trafiken på nätnivå, som alla leverantörer gör, och det vi kan lova är
        vad vi sparar. Tänk på att texten i sig kan avslöja vem du är.
      </p>
      <p>En raderad fråga finns kvar i ögonblicksbilderna av databasen i upp till fem dagar, se nedan.</p>
    </>
  );
}

/** Syns när något utskott har önskelådan på. Texten ska stämma med src/app/(site)/utskott/actions.ts och migreringssteg 17. */
async function WishBoxPrivacy() {
  const db = await readDb();
  if (!db.prepare("SELECT 1 FROM committees WHERE wishes_open = 1 AND visible = 1 AND kind != 'styrelse'").get()) return null;
  return (
    <>
      <h2>Utskottens önskelådor</h2>
      <p>
        Ett önskemål sparas med texten, vilket utskott det gäller och månaden, och med inget annat. Sajten sparar inget namn, ingen IP-adress och
        inget klockslag, och den sätter ingen kaka. Utskottets konto och styrelsens redaktörer kan läsa önskemålen. De raderas automatiskt när
        deras månad är mer än tolv månader gammal, eller tidigare av utskottet. IP-adressen används bara i serverns minne, omgjord till en
        nyckel som inte går att läsa baklänges, för spärren mot spam. Den försvinner senast när servern startar om.
      </p>
    </>
  );
}

export default function PrivacyPage() {
  return (
    <>
      <PageHero
        kicker="Om sajten"
        title="Integritet"
        lead="Vad sajten sparar om dig som besöker den och om sektionens poster, och hur länge."
      />
      <section className="container-prose py-16 md:py-24">
        <div className="prose-statlin">
          <h2>Besökare</h2>
          <p>
            Allt på sajten går att läsa utan att logga in. Sajten använder inga analysverktyg och laddar ingenting från andra
            webbplatser, och den sätter inga kakor på besökare. Den enda kakan är inloggningskakan för sektionens poster.
          </p>
          <p>
            Några val sparas bara i din webbläsare och skickas aldrig till servern: om du har valt mörkt läge, vilka länkar du har fäst på länksidan, att du
            har stängt meddelandet högst upp på sidan, vilka lunchönskemål du har gett en stjärna och, för inloggade poster, om redigeringsläget är på.
          </p>
          <p>
            Tentastatistiken hämtar servern själv från en öppen källa (liutentor.lukasabbe.com, samma som liustats.se) med
            kurskoden. Din webbläsare kontaktar inte källan, och inga uppgifter om dig skickas dit.
          </p>

          {/* Texten ska stämma med src/app/(site)/lunchforelasningar/actions.ts och src/lib/wish-limits.ts. */}
          <h2>Önskelistan för lunch&shy;föreläsningar</h2>
          <p>
            Ett önskemål sparas med ämnet, kommentaren om du skriver en och dagen, och med inget annat. Sajten sparar inget namn och ingen
            IP-adress, och den sätter ingen kaka. SASU och styrelsens redaktörer läser önskemålen först och väljer vilka som visas på listan,
            och de finns kvar tills SASU tar bort dem. En stjärna räknar bara upp antalet stjärnor på önskemålet, och vem som gav den sparas inte.
          </p>
          <p>
            IP-adressen används bara i serverns minne, omgjord till en nyckel som inte går att läsa baklänges, för spärren mot spam. Den
            försvinner senast när servern startar om.
          </p>
          <h2>Företag som anmäler intresse</h2>
          <p>
            Företag som vi bjuder in till STAR kan anmäla intresse via en privat länk. Då sparas företagets namn, kontaktpersonens
            namn och e-postadress och det ni själva skriver, till exempel telefonnummer och önskemål om möte. Anmälan mejlas till
            SASU och finns i sektionens admin, så att vi kan svara. SASU tar bort den när den inte behövs längre.
          </p>

          <h2>Sektionens poster</h2>
          <p>
            Varje post i styrelsen och utskotten har ett konto med e-postadress, namn, post och roll. Lösenordet sparas bara som
            en hash. Kontot sparar också när du senast loggade in och hur många felaktiga lösenord som skrivits sedan dess.
          </p>
          <p>
            När du loggar in sparas en session med webbläsarens användaragent (vilken webbläsare och vilket operativsystem).
            Inloggningskakan kan inte läsas av skript på sidan. Sessionen gäller i 30 dagar och förlängs när du arbetar i adminpanelen; den raderas när du loggar ut, och en
            session som gått ut raderas vid nästa inloggning.
          </p>
          <p>
            IP-adressen används bara i serverns minne, för spärren mot upprepade inloggningsförsök. Den sparas aldrig i
            databasen, och minnet töms när servern startar om.
          </p>
          <p>
            Uppdragstavlan sparar uppdrag och kommentarer med vem som skrivit dem, vem uppdraget gäller och när. De syns bara för
            inloggade poster (ett privat uppdrag bara för avsändaren, mottagaren, administratörerna och redaktörerna) och finns
            kvar tills uppdraget raderas (rubriken står kvar i revisionsloggen); då raderas kommentarerna med det. Raderas ett konto
            står texten kvar, utan namn.
          </p>

          <Suspense fallback={null}>
            <QuestionBoxPrivacy />
          </Suspense>
          <Suspense fallback={null}>
            <WishBoxPrivacy />
          </Suspense>

          <h2>Revisionsloggen</h2>
          <p>
            Sajten loggar vem som skapat, ändrat eller tagit bort något i adminpanelen och när (med rubriken eller namnet på det
            som ändrades, för konton e-postadressen), varje inloggning och varje misslyckat inloggningsförsök (med den
            e-postadress som skrevs in, men utan IP-adress). Inloggningar och misslyckade försök raderas efter 90 dagar, allt annat
            i loggen efter 24 månader.
          </p>

          <h2>Innehåll och bilder</h2>
          <p>
            Det som posterna lägger upp (evenemang, nytt, styrelsens namn och e-postadresser, bilder och dokument) är
            publikt tills det tas bort i adminpanelen. Bilder publiceras som omkodade kopior utan inbäddade uppgifter som
            kamerans GPS-position. Originalet sparas internt med sina uppgifter, går inte att nå från webben och raderas med
            bilden. Dokument publiceras som de laddas upp.
          </p>

          <h2>Var uppgifterna finns</h2>
          <p>
            Databasen och de uppladdade filerna ligger hos Fly.io i Stockholm. Fly tar en ögonblicksbild av dem varje dag och
            sparar den i fem dagar, så det som raderas på sajten finns kvar i ögonblicksbilderna i upp till fem dagar.
          </p>

          <h2>Frågor</h2>
          <p>
            Har du frågor om vad som sparas om dig, eller vill du att något tas bort? Hör av dig till styrelsen via{" "}
            <Link href="/kontakt">Kontakt</Link>.
          </p>
        </div>
      </section>
    </>
  );
}

import { FloatingLogo } from "@/components/brand/floating-logo";
import { IntroOnce } from "@/components/ui/intro-once";
import { ProvFormler, ProvKicker, ProvKnappar, ProvText } from "./delar";
import { StromFalt } from "./strom-falt";
import "./prov-hero.css";
import "./prov-strom.css";

/*
 * Hero 2 av tre förslag (src/lib/hero-val.ts). Sektionens namn uppe i hörnet, loggan stilla i mitten och rubriken och knapparna
 * under den. Heron är alltid mörk, i sajtens mörka färger. Bakom står rutnätet, StatLin i jätteformat och prickarna, och genom
 * dem rullar seriens linje. Ordets bokstäver fylls med rött upp till linjen, och linjens band tänder rutnätet i rött (StromFalt).
 */
export function HeroStrom() {
  return (
    <section data-startsida data-hero-yta className="pr-hero pst-hero">
      <IntroOnce />
      <StromFalt />
      <div className="container-site pst-inre">
        <div data-pst-rad className="kicker pst-rad">
          <p className="pst-kicker">
            <span className="pst-prick" aria-hidden />
            <ProvKicker />
          </p>
          {/* StromFalt skriver bandets standardavvikelse här och tänder den när linjen är framritad. */}
          <span data-pst-matt aria-hidden className="tabular pst-matt" />
        </div>

        <figure className="pst-logga">
          <FloatingLogo className="w-full" svavar={false} ring={<ProvFormler />} />
        </figure>

        <div data-pst-text className="pst-text">
          <ProvText rubrik="display-tight pst-rubrik" ingress="pst-ingress" />
        </div>
        <div className="pst-knapprad">
          <ProvKnappar className="pst-knappar" />
        </div>
      </div>
    </section>
  );
}

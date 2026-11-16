import { FloatingLogo } from "@/components/brand/floating-logo";
import { IntroOnce } from "@/components/ui/intro-once";
import { ProvFormler, ProvKicker, ProvKnappar, ProvText } from "./delar";
import { StromFaltV1 } from "./strom-v1-falt";
import "./prov-hero.css";
import "./prov-strom-v1.css";

/*
 * Hero 1 av tre förslag (src/lib/hero-val.ts). Sektionens namn uppe i hörnet, loggan stilla i mitten och rubriken och knapparna
 * under den. Bakom står bakgrunden från heron före omgörningen, alltid mörk, med rutnätet, StatLin i jätteformat och prickarna,
 * och genom den rullar seriens linje. Linjens band är ljuset som tänder allt det går över i rött (StromFaltV1).
 */
export function HeroStromV1() {
  return (
    <section data-startsida data-hero-yta className="pr-hero pst1-hero">
      <IntroOnce />
      <StromFaltV1 />
      <div className="container-site pst1-inre">
        <div data-pst1-rad className="kicker pst1-rad">
          <p className="pst1-kicker">
            <span className="pst1-prick" aria-hidden />
            <ProvKicker />
          </p>
          {/* StromFaltV1 skriver bandets standardavvikelse här och tänder den när linjen är framritad. */}
          <span data-pst1-matt aria-hidden className="tabular pst1-matt" />
        </div>

        <figure className="pst1-logga">
          <FloatingLogo className="w-full" svavar={false} ring={<ProvFormler />} />
        </figure>

        <div data-pst1-text className="pst1-text">
          <ProvText rubrik="display-tight pst1-rubrik" ingress="pst1-ingress" />
        </div>
        <div className="pst1-knapprad">
          <ProvKnappar className="pst1-knappar" />
        </div>
      </div>
    </section>
  );
}

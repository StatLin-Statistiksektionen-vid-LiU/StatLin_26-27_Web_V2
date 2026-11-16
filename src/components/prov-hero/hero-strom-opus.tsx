import { FloatingLogo } from "@/components/brand/floating-logo";
import { IntroOnce } from "@/components/ui/intro-once";
import { ProvFormler, ProvKicker, ProvKnappar, ProvText } from "./delar";
import { StromOpusFalt } from "./strom-opus-falt";
import "./prov-hero.css";
import "./prov-strom-opus.css";

/*
 * Hero 3 av tre förslag (src/lib/hero-val.ts). Sektionens namn uppe i hörnet, loggan stilla i mitten och rubriken och knapparna
 * under den. Heron är alltid mörk, i sajtens mörka färger. Bakom loggan glider pappret med rutnätet, prickarna och seriens
 * linje åt vänster, och genom strömmen står StatLin i jätteformat som bokstäver av glas som förstorar det som passerar bakom dem
 * (StromOpusFalt).
 */
export function HeroStromOpus() {
  return (
    <section data-startsida data-hero-yta className="pr-hero pso-hero">
      <IntroOnce />
      <StromOpusFalt />
      <div className="container-site pso-inre">
        <div data-pso-rad className="kicker pso-rad">
          <p className="pso-kicker">
            <span className="pso-prick" aria-hidden />
            <ProvKicker />
          </p>
          {/* StromOpusFalt skriver dagens datum här när linjen är framritad. */}
          <span data-pso-dag aria-hidden className="pso-dag" />
        </div>

        <figure className="pso-logga">
          <FloatingLogo className="w-full" svavar={false} ring={<ProvFormler />} />
        </figure>

        <div data-pso-text className="pso-text">
          <ProvText rubrik="display-tight pso-rubrik" ingress="pso-ingress" />
        </div>
        <div className="pso-knapprad">
          <ProvKnappar className="pso-knappar" />
        </div>
      </div>
    </section>
  );
}

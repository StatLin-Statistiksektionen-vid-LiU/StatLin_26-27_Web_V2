import { FloatingLogo } from "@/components/brand/floating-logo";
import { MorkTopp } from "@/components/layout/mork-topp";
import { IntroOnce } from "@/components/ui/intro-once";
import { ProvFormler, ProvKicker, ProvKnappar, ProvScroll, ProvText } from "./delar";
import { StromFaltV1 } from "./strom-v1-falt";
import "./prov-hero.css";
import "./prov-strom-v1.css";

/*
 * Hero 1 av två (src/lib/hero-val.ts). Upplägget är det från heron före omgörningen: sektionens namn uppe i hörnet,
 * loggan stilla i mitten, och nederst rubriken med ingressen till vänster och knapparna med scrollmarkören till höger.
 * Bakom står bakgrunden därifrån, alltid mörk, med rutnätet, StatLin i jätteformat och prickarna, och genom den rullar
 * seriens linje med sitt konfidensband (StromFaltV1).
 */
export function HeroStromV1() {
  return (
    <section data-startsida data-hero-yta className="pr-hero pst1-hero">
      <MorkTopp />
      <IntroOnce />
      <StromFaltV1 />
      <div className="container-site pr-inre pst1-inre">
        <div data-pst1-rad className="kicker pr-rad pst1-rad">
          <p className="pst1-kicker">
            <span className="pst1-prick" aria-hidden />
            <ProvKicker />
          </p>
          {/* StromFaltV1 skriver bandets standardavvikelse här och tänder den när linjen är framritad. */}
          <span data-pst1-matt aria-hidden className="tabular pst1-matt" />
        </div>

        <figure className="pr-logga pst1-logga">
          <FloatingLogo className="w-full" svavar={false} ring={<ProvFormler />} />
        </figure>

        {/* StromFaltV1 mäter var det här blocket börjar: ovanför det är bakgrunden som starkast. */}
        <div data-pst1-botten className="pst1-botten">
          <div className="pst1-text">
            <ProvText rubrik="display-tight pst1-rubrik" ingress="pst1-ingress" />
          </div>
          <div className="pst1-knapprad">
            <ProvKnappar className="pst1-knappar" />
            {/* Scrollmarkören leder till det som står under heron (startsida.tsx). */}
            <ProvScroll />
          </div>
        </div>
      </div>
    </section>
  );
}

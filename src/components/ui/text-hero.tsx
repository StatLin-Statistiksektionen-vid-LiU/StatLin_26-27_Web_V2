import { Suspense, type ReactNode } from "react";
import { Editable } from "@/components/edit-mode/editable";
import { AccentText, stripAccent } from "@/components/ui/accent-text";
import { PageHero } from "@/components/ui/page-hero";
import { getSettings } from "@/lib/data/content";
import { SITE_TEXT_DEFAULTS, siteText, type HeroGroup, type SiteTextKey } from "@/lib/site-texts";

type Props = {
  group: HeroGroup;
  /** Klassen på *ord* i rubriken. */
  accentClassName?: string;
  /** Det som står under ingressen, t.ex. en knapp. Får en funktion som ger texterna utan stjärnor, så att även den kan ändras. */
  children?: (text: (key: SiteTextKey) => string) => ReactNode;
};

/**
 * Huvudet på en listsida som inte har en egen sida i Admin. Texterna ändras med pennan i redigeringsläget och sparas
 * som inställningar, se site-texts.ts. Skalet visar standardtexterna direkt, så att sidan är lika snabb som förut,
 * och de byts mot de sparade när de har kommit. Utan JavaScript står standardtexterna kvar.
 */
export function TextHero(props: Props) {
  return (
    <Editable target={{ type: "texts", group: props.group }} label="Redigera huvudet" inset penClassName="top-[calc(var(--header-h)+1rem)] right-4">
      <Suspense fallback={<HeroView {...props} texts={SITE_TEXT_DEFAULTS} />}>
        <HeroLoaded {...props} />
      </Suspense>
    </Editable>
  );
}

async function HeroLoaded(props: Props) {
  return <HeroView {...props} texts={await getSettings()} />;
}

function HeroView({ group, accentClassName = "text-red", children, texts }: Props & { texts: Record<SiteTextKey, string> }) {
  const text = (key: SiteTextKey) => siteText(texts, key);
  const title = text(`text_${group}_rubrik`);
  return (
    <PageHero
      kicker={stripAccent(text(`text_${group}_kicker`))}
      title={<AccentText text={title} accentClassName={accentClassName} />}
      fitTitle={stripAccent(title)}
      lead={<AccentText text={text(`text_${group}_ingress`)} accentClassName="text-red-deep" />}
    >
      {children?.((key) => stripAccent(text(key)))}
    </PageHero>
  );
}

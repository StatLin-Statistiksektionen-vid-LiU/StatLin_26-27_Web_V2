"use client";

import { RFalt } from "@/components/edit-mode/redigerbar";
import { useBlock } from "@/components/edit-mode/utkast";
import { WishBox } from "@/components/onskelada/wish-box";
import type { Estig } from "@/lib/innehall/typer";

/** Önskelådan på eSTIG:s sida, för spelönskemål. Rubriken och texten ändras i redigeringsläget (src/lib/innehall/block/estig.ts). */
export function SpelOnskan({ slug, name, estig }: { slug: string; name: string; estig: Estig }) {
  const { varde, aktiv, andra } = useBlock("b:estig", estig);
  return (
    <WishBox
      slug={slug}
      name={name}
      spel={{
        rubrik: (
          <RFalt
            aktiv={aktiv}
            varde={varde.onskan.rubrik}
            onCommit={(t) =>
              andra((e) => {
                e.onskan.rubrik = t;
              })
            }
            etikett="Spelönskemålens rubrik"
            max={60}
            kravs
          />
        ),
        text: (
          <RFalt
            aktiv={aktiv}
            varde={varde.onskan.text}
            onCommit={(t) =>
              andra((e) => {
                e.onskan.text = t;
              })
            }
            etikett="Spelönskemålens text"
            max={240}
          />
        ),
      }}
    />
  );
}

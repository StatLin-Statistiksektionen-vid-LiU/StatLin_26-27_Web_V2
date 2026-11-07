"use client";

import { RLista, type Falt } from "@/components/edit-mode/redigerbar";
import { useBlock } from "@/components/edit-mode/utkast";
import { Lank } from "@/components/home/start-knappar";
import { Headset } from "@/components/icons";
import type { Estig } from "@/lib/innehall/typer";

type Discord = Estig["discord"];

const FALT: Falt<Discord>[] = [
  { nyckel: "text", etikett: "Knappens text", max: 30, hjalp: "Utan text syns inte knappen för besökare." },
  { nyckel: "href", etikett: "Länk", typ: "lank", hjalp: "Inbjudan till er Discordserver, till exempel https://discord.gg/…" },
];

/**
 * eSTIG:s Discordknapp bland knapparna på eSTIG:s sida (src/lib/innehall/block/estig.ts). Besökare ser den först när den har både
 * text och länk. I redigeringsläget står den streckad tills länken finns, och eSTIG:s konto lägger in den där.
 */
export function DiscordKnapp({ estig }: { estig: Estig }) {
  const { varde, aktiv, andra } = useBlock("b:estig", estig);
  const d = varde.discord;
  const klar = Boolean(d.text.trim() && d.href.trim());
  if (!aktiv && !klar) return null;
  return (
    <RLista
      aktiv={aktiv}
      items={[d]}
      onChange={(nya) =>
        andra((e) => {
          if (nya[0]) e.discord = nya[0];
        })
      }
      etikett="Discordknappen"
      as="div"
      className="contents"
      itemAs="div"
      itemClassName="flex rounded-full"
      falt={FALT}
      min={1}
      max={1}
      render={(k) =>
        k.text.trim() && k.href.trim() ? (
          <Lank href={k.href} className="btn btn-ghost">
            <Headset size={18} /> {k.text}
          </Lank>
        ) : (
          <span className="btn btn-ghost border-dashed opacity-70" title="Knappen syns för besökare när den har både text och länk.">
            <Headset size={18} /> {k.text.trim() || "Dold knapp"}
            <span className="font-mono text-[0.7rem] font-normal text-stone">{k.href.trim() ? "ingen text" : "länk saknas"}</span>
          </span>
        )
      }
    />
  );
}

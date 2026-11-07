"use client";

import { RLista, type Falt } from "@/components/edit-mode/redigerbar";
import { useBlock } from "@/components/edit-mode/utkast";
import { Lank } from "@/components/home/start-knappar";
import { ClipboardList } from "@/components/icons";
import type { Ubu } from "@/lib/innehall/typer";
import { cn } from "@/lib/utils";

type Knapp = Ubu["knappar"][number];

const FALT: Falt<Knapp>[] = [
  { nyckel: "text", etikett: "Knappens text", max: 40, hjalp: "Utan text syns inte knappen för besökare." },
  { nyckel: "href", etikett: "Länk", typ: "lank", hjalp: "Till exempel kursutvärderingarna i Evaliuate." },
];

/**
 * UBU:s egna knappar, från början den till kursutvärderingarna. De står bland de andra knapparna på UBU:s sida och i
 * UBU-kortet på Kandidat och Master. UBU:s konto och redaktörerna ändrar dem där de står (src/lib/innehall/block/ubu.ts).
 * Listan har display: contents, så att knapparna står i samma rad som de andra.
 */
export function UbuKnappar({ ubu, liten = false }: { ubu: Ubu; liten?: boolean }) {
  const { varde, aktiv, andra } = useBlock("b:ubu", ubu);
  const knappar = aktiv ? varde.knappar : varde.knappar.filter((k) => k.text.trim());
  const klass = cn("btn", liten ? "btn-light btn-sm" : "btn-ghost");
  return (
    <RLista
      aktiv={aktiv}
      items={knappar}
      onChange={(nya) =>
        andra((u) => {
          u.knappar = nya;
        })
      }
      etikett="knapp"
      as="div"
      className="contents"
      itemAs="div"
      itemClassName="flex rounded-full"
      falt={FALT}
      ny={() => ({ text: "Ny knapp", href: "/" })}
      max={3}
      render={(k) =>
        k.text.trim() ? (
          <Lank href={k.href} className={klass}>
            <ClipboardList size={liten ? 15 : 18} /> {k.text}
          </Lank>
        ) : (
          <span className={cn(klass, "border-dashed opacity-60")} title="Knappen har ingen text och syns inte för besökare.">
            Dold knapp
          </span>
        )
      }
    />
  );
}

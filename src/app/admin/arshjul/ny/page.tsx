import { Suspense } from "react";
import { AdminHeader } from "@/components/admin/ui";
import { WheelItemForm } from "@/components/admin/wheel-item-form";
import { monthParam } from "@/lib/arshjul";
import { requireUser } from "@/lib/auth/session";
import { listResponsibleOptions } from "@/lib/data/arshjul";

export const metadata = { title: "Ny punkt i årshjulet" };

export default function NewWheelItemPage(props: PageProps<"/admin/arshjul/ny">) {
  return (
    <Suspense>
      <NewWheelItem searchParams={props.searchParams} />
    </Suspense>
  );
}

async function NewWheelItem({ searchParams }: { searchParams: PageProps<"/admin/arshjul/ny">["searchParams"] }) {
  const user = await requireUser();
  const sp = await searchParams;
  const options = await listResponsibleOptions();
  const onlyOurs = sp.vara === "1";
  return (
    <>
      <AdminHeader back={{ href: onlyOurs ? "/admin/arshjul?vara=1" : "/admin/arshjul", label: "Årshjul" }} title="Ny punkt" description="Något som kommer tillbaka varje år. Du behöver bara skriva in det en gång: hjulet börjar om av sig självt." />
      <WheelItemForm responsibleOptions={options} defaultMonth={monthParam(sp.manad)} defaultResponsible={user.role === "committee" ? user.post : undefined} onlyOurs={onlyOurs} />
    </>
  );
}

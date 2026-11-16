import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { EventImagesEditor } from "@/components/admin/event-images-editor";
import { AdminHeader, Card, StatusBadge } from "@/components/admin/ui";
import { ArrowUpRight, Edit } from "@/components/icons";
import { canEditImages, canEditOwned, canManageImages } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { getEventById, listEventImages } from "@/lib/data/events";
import { formatDate } from "@/lib/dates";

export const metadata = { title: "Bilder till evenemanget" };

export default function EventImagesPage(props: PageProps<"/admin/bilder/evenemang/[id]">) {
  return (
    <Suspense>
      <EventImages params={props.params} />
    </Suspense>
  );
}

/** Omslag och galleri – för utskottet som äger evenemanget, redaktörerna och grafiskt ansvarig. Texten ändras på evenemangets egen sida. */
async function EventImages({ params }: { params: PageProps<"/admin/bilder/evenemang/[id]">["params"] }) {
  const user = await requireUser();
  const { id } = await params;
  const event = /^\d+$/.test(id) ? await getEventById(Number(id)) : null;
  if (!event) notFound();
  if (!canEditImages(user, event)) redirect("/admin?nekad=1");
  const images = await listEventImages(event.id);

  return (
    <>
      <AdminHeader
        back={canManageImages(user) ? { href: "/admin/bilder", label: "Bilder" } : { href: "/admin/evenemang", label: "Evenemang" }}
        kicker={event.committee?.short_name ?? "Hela sektionen"}
        title={event.title}
        description={
          <span className="inline-flex flex-wrap items-center gap-3">
            <StatusBadge published={!!event.published} />
            <span>{formatDate(event.starts_at, true)}</span>
          </span>
        }
        actions={
          <>
            {canEditOwned(user, event) && (
              <Link href={`/admin/evenemang/${event.id}`} className="btn btn-ghost btn-sm bg-white">
                <Edit size={15} /> Redigera evenemanget
              </Link>
            )}
            {/* Ett utkast har ingen sida att visa. */}
            {!!event.published && (
              <Link href={`/evenemang/${event.slug}`} target="_blank" className="btn btn-ghost btn-sm bg-white">
                Visa sidan <ArrowUpRight size={15} />
              </Link>
            )}
          </>
        }
      />
      <Card className="p-5 md:p-7">
        <EventImagesEditor eventId={event.id} cover={event.cover} images={images.map((i) => ({ id: i.id, caption: i.caption, image: i.image }))} />
      </Card>
    </>
  );
}

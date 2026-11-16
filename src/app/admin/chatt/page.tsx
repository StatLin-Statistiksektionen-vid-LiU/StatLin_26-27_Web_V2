import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ChatView } from "@/components/admin/chatt/chat-view";
import { AdminHeader, EmptyState } from "@/components/admin/ui";
import { nowIso } from "@/lib/admin/helpers";
import { isAdmin } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { defaultChannel } from "@/lib/chatt";
import { chatAuthor, findChannel, getLastReadId, listChannelSummaries, listMessages } from "@/lib/data/chatt";
import { cn } from "@/lib/utils";

export const metadata = { title: "Chatt" };

export default function ChatPage(props: PageProps<"/admin/chatt">) {
  return (
    <Suspense>
      <Chat searchParams={props.searchParams} />
    </Suspense>
  );
}

const HEADER = <AdminHeader kicker="Planering" title="Chatt" description="Varje projektplan har en tråd där de som är med i planen frågar och svarar. Här står trådarna du är med i." />;

async function Chat({ searchParams }: { searchParams: PageProps<"/admin/chatt">["searchParams"] }) {
  const user = await requireUser();
  const sp = await searchParams;
  const channels = await listChannelSummaries(user);
  // Tråden står i adressen när den är vald. En administratör kan öppna en tråd utan att vara med i planen, och den står då inte i
  // listan. En tråd som kontot inte får läsa, eller som inte finns, leder tillbaka till listan.
  const key = typeof sp.kanal === "string" ? sp.kanal : undefined;
  const chosen = key === undefined ? null : (channels.find((c) => c.key === key) ?? (await findChannel(user, key)));
  if (sp.kanal !== undefined && !chosen) redirect("/admin/chatt");
  const open = chosen ?? defaultChannel(channels);
  if (!open) {
    return (
      <>
        {HEADER}
        <EmptyState
          title="Inga trådar än"
          action={
            <Link href="/admin/projektplaner" className="btn btn-ink">
              Till projektplanerna
            </Link>
          }
        >
          Trådarna hör till projektplanerna. När du lägger in en plan, är ansvarig för en eller blir inbjuden som medarbetare står dess tråd här.
        </EmptyState>
      </>
    );
  }
  // Klockan läses före meddelandena, så att det som tas bort medan sidan renderas kommer med i den första hämtningen efteråt.
  const loadedAt = nowIso();
  const [page, lastReadId, me] = await Promise.all([listMessages(open.key), getLastReadId(user.id, open.key), chatAuthor(user)]);

  return (
    // På en dator fyller chatten fönstret och scrollar inuti. Höjden är fönstrets minus luften main har över och under sidan.
    <div className="lg:-mb-16 lg:flex lg:h-[calc(100dvh-5rem)] lg:min-h-[34rem] lg:flex-col">
      {/* På telefonen tar en öppen tråd hela skärmen, och planens namn står i dess eget huvud. */}
      <div className={cn(chosen && "hidden lg:block")}>{HEADER}</div>
      <ChatView
        key={open.key}
        me={me}
        admin={isAdmin(user)}
        channels={channels}
        open={{ key: open.key, name: open.name, audience: open.audience }}
        chosen={!!chosen}
        messages={page.messages}
        hasOlder={page.hasOlder}
        lastReadId={lastReadId}
        loadedAt={loadedAt}
      />
    </div>
  );
}

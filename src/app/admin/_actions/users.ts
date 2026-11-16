"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type FormState, formObject, invalid, zCheckbox, zEmail, zOptionalId, zRequired, zText } from "@/lib/admin/form";
import { audit, forbidden } from "@/lib/admin/helpers";
import { generatePassword, hashPassword } from "@/lib/auth/password";
import { isAdmin } from "@/lib/auth/permissions";
import { actionUser, destroyAllSessionsForUser, renewSessionIfDue } from "@/lib/auth/session";
import { ROLE_VALUES } from "@/lib/types";
import { getDb } from "@/lib/db";

const NOT_ADMIN = "Endast administratörer kan hantera konton.";

const schema = z.object({
  email: zEmail,
  name: zRequired(120, "Namnet"),
  post: zText(120),
  role: z.enum(ROLE_VALUES, { message: "Välj en roll." }),
  committee_id: zOptionalId,
  active: zCheckbox,
  design: zCheckbox,
});

function adminCount(excludeId?: number) {
  return (
    getDb()
      .prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1 AND id != ?")
      .get(excludeId ?? -1) as { n: number }
  ).n;
}

export async function saveUser(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await actionUser();
  if ("error" in me) return me;
  if (!isAdmin(me)) return forbidden(NOT_ADMIN);
  const id = Number(fd.get("id")) || null;
  const parsed = schema.safeParse({ ...formObject(fd), active: id ? fd.get("active") ?? undefined : "on" });
  if (!parsed.success) return invalid(parsed.error);
  // Grafiskt ansvar gäller bara utskottsroller – redaktörer och administratörer får redan ändra alla bilder.
  const d = { ...parsed.data, design: parsed.data.role === "committee" ? parsed.data.design : 0 };
  if (d.role === "committee" && !d.committee_id) {
    return { error: "Ett utskottskonto måste kopplas till ett utskott.", fieldErrors: { committee_id: "Välj utskott." } };
  }
  const db = getDb();
  const clash = db.prepare("SELECT id FROM users WHERE email = ? AND id != ?").get(d.email, id ?? -1);
  if (clash) return { error: "Det finns redan ett konto med den e-postadressen.", fieldErrors: { email: "Upptagen." } };

  if (id) {
    // Lås inte ute sista administratören.
    if ((d.role !== "admin" || !d.active) && adminCount(id) === 0) {
      return { error: "Det måste finnas minst en aktiv administratör." };
    }
    db.prepare(
      "UPDATE users SET email=@email, name=@name, post=@post, role=@role, committee_id=@committee_id, active=@active, design=@design WHERE id=@id",
    ).run({ ...d, id });
    if (!d.active) destroyAllSessionsForUser(id);
    audit(me.id, "update", "user", id, d.email);
    // Namnet står i sidans rubrik och i listan, och ens eget konto i sidomenyn. Utan omritning visade de det gamla.
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Kontot är sparat." };
  }

  const password = generatePassword();
  const res = db
    .prepare(
      "INSERT INTO users (email, name, post, role, committee_id, design, password_hash, must_change_password) VALUES (@email, @name, @post, @role, @committee_id, @design, @hash, 1)",
    )
    .run({ ...d, hash: await hashPassword(password) });
  audit(me.id, "create", "user", Number(res.lastInsertRowid), d.email);
  // Det nya kontot ska synas i listan bredvid formuläret direkt.
  revalidatePath("/admin", "layout");
  return {
    ok: true,
    message: `Kontot för ${d.email} är skapat. Ge personen lösenordet nedan. Det visas bara en gång och måste bytas vid första inloggningen.`,
    data: { password, email: d.email },
  };
}

export async function resetUserPassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await actionUser();
  if ("error" in me) return me;
  if (!isAdmin(me)) return forbidden(NOT_ADMIN);
  const id = Number(fd.get("id"));
  const db = getDb();
  const user = db.prepare("SELECT email FROM users WHERE id = ?").get(id) as { email: string } | undefined;
  if (!user) return { error: "Kontot finns inte." };
  const password = generatePassword();
  db.prepare("UPDATE users SET password_hash = ?, must_change_password = 1, failed_logins = 0, locked_until = NULL WHERE id = ?").run(
    await hashPassword(password),
    id,
  );
  destroyAllSessionsForUser(id);
  audit(me.id, "update", "user", id, `Återställde lösenord för ${user.email}`);
  return { ok: true, message: "Nytt tillfälligt lösenord (visas bara nu):", data: { password, email: user.email } };
}

export async function deleteUser(fd: FormData): Promise<FormState> {
  // Felsvaren visas i bekräftelsen, så sessionen förlängs först när raderingen gått igenom (se deleteTask).
  const me = await actionUser({ renew: false });
  if ("error" in me) return me;
  if (!isAdmin(me)) return forbidden(NOT_ADMIN);
  const id = Number(fd.get("id"));
  // Administratören som frågar är själv kvar, så det finns alltid minst en kvar efter raderingen.
  if (id === me.id) return { error: "Du kan inte ta bort ditt eget konto." };
  const db = getDb();
  const user = db.prepare("SELECT email, role FROM users WHERE id = ?").get(id) as { email: string; role: string } | undefined;
  if (user) {
    db.prepare("DELETE FROM users WHERE id = ?").run(id);
    audit(me.id, "delete", "user", id, user.email);
    await renewSessionIfDue();
  }
  redirect("/admin/konton?raderad=1");
}

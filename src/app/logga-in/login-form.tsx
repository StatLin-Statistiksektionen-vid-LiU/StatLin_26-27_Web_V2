"use client";

import { useActionState, useState, type ReactNode } from "react";
import { login } from "@/app/admin/_actions/auth";
import { Eye } from "@/components/icons";

/**
 * Använder en riktig server action som form-action: formuläret fungerar då även innan
 * sidans JavaScript laddats (eller helt utan), och lösenordet skickas alltid som POST.
 * Med JavaScript kommer felet i state, och e-postadressen står kvar efter återställningen.
 * Utan JavaScript leder actionen tillbaka hit och felet kommer som `error` från adressen.
 * E-postadressen ska inte stå i en adress, så den får man då skriva igen.
 */
export function LoginForm({ children, error }: { children?: ReactNode; error?: string }) {
  const [state, action, pending] = useActionState(login, {});
  const [show, setShow] = useState(false);
  const message = state.error ?? error;
  return (
    <form action={action} className="mt-7 space-y-4">
      {children}
      {message && (
        <p role="alert" className="rounded-lg border border-red/30 bg-red/[0.06] px-4 py-3 text-sm font-semibold text-red-dark">
          {message}
        </p>
      )}
      <div>
        <label htmlFor="email" className="mb-1.5 block text-[0.84rem] font-semibold">
          E-post
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          defaultValue={state.data?.email ?? ""}
          placeholder="info@statlin.se"
          className="w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 outline-none transition placeholder:text-stone-light hover:border-ink/25 focus:border-ink/50 focus:bg-white focus:ring-4 focus:ring-ink/[0.06]"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-[0.84rem] font-semibold">
          Lösenord
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            required
            className="w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 pr-12 outline-none transition hover:border-ink/25 focus:border-ink/50 focus:bg-white focus:ring-4 focus:ring-ink/[0.06]"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-stone transition-colors hover:bg-paper-2 hover:text-ink"
            aria-label={show ? "Dölj lösenord" : "Visa lösenord"}
          >
            <Eye size={18} />
          </button>
        </div>
      </div>
      <button type="submit" disabled={pending} className="btn btn-red !mt-6 w-full disabled:opacity-70">
        {pending ? "Loggar in…" : "Logga in"}
      </button>
    </form>
  );
}

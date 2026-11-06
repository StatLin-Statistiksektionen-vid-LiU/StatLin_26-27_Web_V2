"use client";

import { unstable_rethrow } from "next/navigation";
import {
  createContext,
  Fragment,
  startTransition,
  useActionState,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check } from "@/components/icons";
import type { FormState } from "@/lib/admin/form";
import { cn } from "@/lib/utils";

type SubmitKind = "primary" | "secondary";
type FormCtxValue = {
  state: FormState;
  pending: boolean;
  submitter: SubmitKind;
  /** En bild laddas upp i något av fälten – formuläret kan inte skickas under tiden. */
  uploading: boolean;
  /** Anropas när en uppladdning börjar; funktionen som returneras anropas när den är klar. */
  beginUpload: () => () => void;
  /** För ändringar som inte ger någon input-händelse: verktygsknappar, infogade och uppladdade bilder. */
  markDirty: () => void;
};
const FormCtx = createContext<FormCtxValue>({
  state: {},
  pending: false,
  submitter: "primary",
  uploading: false,
  beginUpload: () => () => {},
  markDirty: () => {},
});
export const useFormCtx = () => useContext(FormCtx);

/**
 * Redigeringspanelen på sajten följer formulärets osparade ändringar och uppladdningar, så att den frågar innan den
 * stängs och inte stängs mitt i en uppladdning.
 */
export const FormWatchCtx = createContext<{ dirty: (dirty: boolean) => void; uploading: (uploading: boolean) => void } | null>(null);

const NO_STATE: FormState = {};

/** En knapp som skickar formuläret med ett eget värde, t.ex. published=0 för "Spara som utkast". */
type SubmitOption = { label: string; name?: string; value?: string };

/**
 * Formulär för server actions med felhantering och sparstatus.
 * Skickas via startTransition i stället för form-action, så att React inte
 * nollställer fälten när valideringen misslyckas.
 */
export function ActionForm({
  action,
  children,
  className,
  submitLabel = "Spara",
  submitValue,
  secondary,
  secondaryFirst,
  footer,
  stickyFooter = true,
  resetOnSuccess,
  onSuccess,
  version,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  children: ReactNode;
  className?: string;
  submitLabel?: string;
  /** Skickas med från huvudknappen. */
  submitValue?: { name: string; value: string };
  /** En andra, mindre framträdande knapp till vänster om huvudknappen. */
  secondary?: SubmitOption;
  /** Den andra knappen ligger först i koden, så att Enter i ett fält väljer den (nya inlägg sparas då som utkast). */
  secondaryFirst?: boolean;
  footer?: ReactNode;
  stickyFooter?: boolean;
  resetOnSuccess?: boolean;
  /** Körs efter en lyckad sparning, t.ex. för att stänga redigeringspanelen. */
  onSuccess?: (state: FormState) => void;
  /**
   * Radens updated_at. Skickas i ett dolt fält så att servern kan neka en sparning ovanpå en nyare version, och är nyckel
   * för fälten: Activity behåller annars de gamla värdena på en dold sida, så när raden ändrats av någon annan (en annan
   * flik, en annan person) laddas fälten om från den nya versionen. Actionen svarar med sin nya version i data.updated_at.
   */
  version?: string;
}) {
  // En action som kastar (nätverksfel, en action som inte finns efter en deploy, ett fel i servern) avvisar löftet, och
  // useActionState skickar då felet till närmaste felgräns, som byter ut hela sidan. Felet fångas därför runt själva
  // anropet och visas som ett vanligt fel, och fälten står kvar. Nexts egna fel (redirect(), notFound()) kastas vidare.
  const run = useCallback(
    async (prev: FormState, fd: FormData): Promise<FormState> => {
      try {
        return await action(prev, fd);
      } catch (err) {
        unstable_rethrow(err);
        console.error(err);
        return { error: "Kunde inte spara. Försök igen." };
      }
    },
    [action],
  );
  const [state, formAction, pending] = useActionState(run, {});
  const [submitter, setSubmitter] = useState<SubmitKind>("primary");
  const formRef = useRef<HTMLFormElement>(null);
  const watch = useContext(FormWatchCtx);

  // Osparade ändringar skyddar mot att lämna sidan och mot att redigeringspanelen stängs. De nollas först när en
  // sparning lyckats – misslyckas den står både fälten och skyddet kvar.
  const dirty = useRef(false);
  const setDirty = useCallback(
    (next: boolean) => {
      if (dirty.current === next) return;
      dirty.current = next;
      watch?.dirty(next);
    },
    [watch],
  );
  // Det som skrivs medan en sparning pågår fanns inte i den sparade FormData, och skyddas därför också efter "Sparat".
  const editedSinceSubmit = useRef(false);
  const markDirty = useCallback(() => {
    editedSinceSubmit.current = true;
    setDirty(true);
  }, [setDirty]);

  // Bilder som laddas upp i fälten. Skickades formuläret under tiden följde det gamla id:t med, och den nya bilden
  // blev föräldralös – därför väntar knapparna (och Enter) tills uppladdningarna är klara.
  const [uploads, setUploads] = useState(0);
  const uploading = uploads > 0;
  const beginUpload = useCallback(() => {
    setUploads((n) => n + 1);
    let open = true;
    return () => {
      if (!open) return;
      open = false;
      setUploads((n) => n - 1);
    };
  }, []);
  useEffect(() => {
    watch?.uploading(uploading);
  }, [watch, uploading]);

  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  });
  // Effekter körs om varje gång Activity visar en dold sida igen. En lyckad sparning hanteras därför bara en gång –
  // annars körde samma svar onSuccess igen (panelens router.refresh(), kommentarsfältets reset() av ett nytt utkast).
  const handled = useRef<FormState | null>(null);
  const shouldReset = useRef(false);
  useEffect(() => {
    if (!state.ok || handled.current === state) return;
    handled.current = state;
    shouldReset.current = true;
    // Skyddet står kvar om något skrevs under sparningen (fälten laddas inte om efter en egen sparning).
    setDirty(!resetOnSuccess && editedSinceSubmit.current);
    if (resetOnSuccess) formRef.current?.reset();
    // Ändrades något under sparningen (t.ex. en ny fil) står fälten kvar – isSameUpload hindrar att en sparad fil laddas upp
    // igen.
    else if (!editedSinceSubmit.current) {
      // En fil som redan sparats skickas inte med igen nästa gång formuläret sparas (SD-35). reset() tömmer den också.
      for (const input of formRef.current?.querySelectorAll<HTMLInputElement>('input[type="file"]') ?? []) input.value = "";
      // "Ta bort filen" är verkställd eller överkörd i och med den lyckade sparningen – ikryssad kvar hade nästa sparning
      // (t.ex. en rättad titel) tagit bort filen.
      for (const box of formRef.current?.querySelectorAll<HTMLInputElement>('input[type="checkbox"][name="remove_file"]') ?? []) box.checked = false;
    }
    onSuccessRef.current?.(state);
  }, [state, resetOnSuccess, setDirty]);
  // När formuläret göms efter en lyckad sparning (sidan lämnas, Activity) tas statusraden bort – med ett
  // engångslösenord, som annars låg kvar på skärmen när man kom tillbaka (preserving-ui-state.md).
  const [cleared, setCleared] = useState<FormState | null>(null);
  useLayoutEffect(() => {
    return () => {
      if (!shouldReset.current) return;
      shouldReset.current = false;
      setCleared(handled.current);
    };
  }, []);
  const shown = state === cleared ? NO_STATE : state;

  // Nyckeln för fälten (fieldsVersion) och värdet i det dolda fältet (submitVersion) är tillstånd och inte propen. När
  // serverns version ändras efter formulärets egen lyckade sparning är fälten redan det som sparades: då följer bara det
  // dolda fältet med, och fokus, utfällda detaljer, förhandsgranskningen och det man hann skriva under sparningen står
  // kvar. Den egna sparningen passerade vakten, så ingen annans ändring ligger emellan. Ändras versionen av något annat
  // skäl laddas fälten om. Svaret och den nya versionen kan komma i samma rendering eller i valfri ordning: medan
  // sparningen pågår väntar beslutet på svaret.
  const [fieldsVersion, setFieldsVersion] = useState(version);
  const [submitVersion, setSubmitVersion] = useState(version);
  const [seenVersion, setSeenVersion] = useState(version);
  if (version !== seenVersion) {
    if (version !== undefined && state.ok && state.data?.updated_at === version) {
      setSeenVersion(version);
      setSubmitVersion(version);
    } else if (!pending) {
      setSeenVersion(version);
      setSubmitVersion(version);
      setFieldsVersion(version);
    }
  }

  // Fälten laddades om från en annan version – då finns inget osparat kvar.
  const loadedVersion = useRef(fieldsVersion);
  useEffect(() => {
    if (loadedVersion.current === fieldsVersion) return;
    loadedVersion.current = fieldsVersion;
    setDirty(false);
  }, [fieldsVersion, setDirty]);

  // Varna innan man lämnar sidan med osparade ändringar.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const secondaryButton = secondary && <SubmitButton kind="secondary" label={secondary.label} name={secondary.name} value={secondary.value} />;
  return (
    <FormCtx value={{ state: shown, pending, submitter, uploading, beginUpload, markDirty }}>
      <form
        ref={formRef}
        // Skyddsnät: skickas formuläret innan sidan hydrerats hamnar fälten i en POST-kropp, aldrig i adressen.
        method="post"
        // @container: fälten radas om efter formulärets bredd, så samma formulär fungerar i redigeringspanelen.
        className={cn("@container space-y-6", className)}
        onChange={markDirty}
        onSubmit={(e) => {
          e.preventDefault();
          // Enter i ett fält medan en bild laddas upp: inget skickas förrän den är klar.
          if (uploading) return;
          // Knappen som skickade formuläret följer med, så att den kan bära ett eget värde.
          const button = (e.nativeEvent as SubmitEvent).submitter;
          setSubmitter(button?.dataset.submit === "secondary" ? "secondary" : "primary");
          editedSinceSubmit.current = false;
          const fd = new FormData(e.currentTarget, button);
          startTransition(() => formAction(fd));
        }}
        noValidate
      >
        <FormStatus />
        {submitVersion !== undefined && <input type="hidden" name="updated_at" value={submitVersion} />}
        {/* Nyckeln sitter på fälten och inte på formuläret, så att statusraden står kvar när fälten laddas om. */}
        <Fragment key={fieldsVersion}>{children}</Fragment>
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 pt-5",
            stickyFooter && "sticky bottom-0 z-10 -mx-1 bg-paper/90 px-1 pb-4 backdrop-blur opak:bg-paper",
          )}
        >
          <div className="flex flex-wrap items-center gap-2">{footer}</div>
          {/* Knappen som ligger först i koden är den som Enter i ett fält väljer: huvudknappen, eller den andra knappen med
              secondaryFirst. På skärmen står huvudknappen alltid till höger. */}
          <div className={cn("flex flex-wrap items-center gap-2", !secondaryFirst && "flex-row-reverse")}>
            {secondaryFirst && secondaryButton}
            <SubmitButton label={submitLabel} name={submitValue?.name} value={submitValue?.value} />
            {!secondaryFirst && secondaryButton}
          </div>
        </div>
      </form>
    </FormCtx>
  );
}

function FormStatus() {
  const { state } = useFormCtx();
  const ref = useRef<HTMLDivElement>(null);
  // En gång per svar – inte igen varje gång Activity visar sidan.
  const scrolled = useRef<FormState | null>(null);
  useEffect(() => {
    if ((!state.error && !state.ok) || scrolled.current === state) return;
    scrolled.current = state;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "nearest" });
  }, [state]);
  if (!state.error && !state.ok) return null;
  return (
    <div
      ref={ref}
      role={state.error ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm",
        state.error ? "border-red/30 bg-red/[0.06] text-red-dark" : "border-emerald-600/25 bg-emerald-600/[0.07] text-emerald-900",
      )}
    >
      {state.ok && <Check size={18} className="mt-0.5 shrink-0" />}
      <div className="min-w-0">
        <p className="font-semibold">{state.error ?? state.message}</p>
        {state.data?.password && (
          <p className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-ink/70">{state.data.email}</span>
            <code className="select-all rounded-lg bg-white px-2.5 py-1 font-mono text-base text-ink ring-1 ring-ink/10">{state.data.password}</code>
          </p>
        )}
      </div>
    </div>
  );
}

function SubmitButton({
  label = "Spara",
  className,
  kind = "primary",
  name,
  value,
}: {
  label?: string;
  className?: string;
  kind?: SubmitKind;
  name?: string;
  value?: string;
}) {
  const { pending, submitter, uploading } = useFormCtx();
  const primary = kind === "primary";
  return (
    <button
      type="submit"
      name={name}
      value={value}
      data-submit={kind}
      disabled={pending || uploading}
      className={cn(primary ? "btn btn-red min-w-36" : "btn btn-ghost bg-white", "disabled:opacity-70", className)}
    >
      {pending && submitter === kind ? (
        <>
          <span className={cn("size-4 animate-spin rounded-full border-2", primary ? "border-white/40 border-t-white" : "border-ink/20 border-t-ink")} aria-hidden />
          Sparar…
        </>
      ) : (
        label
      )}
    </button>
  );
}

export function FieldError({ name }: { name: string }) {
  const { state } = useFormCtx();
  const msg = state.fieldErrors?.[name];
  if (!msg) return null;
  return (
    <p className="mt-1.5 text-sm font-medium text-red-deep" id={`${name}-error`}>
      {msg}
    </p>
  );
}

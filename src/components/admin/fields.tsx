"use client";

import { createContext, useContext, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { ChevronDown } from "@/components/icons";
import { FieldError, useFormCtx } from "./action-form";
import { cn, slugify, slugifyWhileTyping } from "@/lib/utils";

const inputBase =
  "w-full rounded-xl border border-ink/15 bg-white px-3.5 py-2.5 text-[0.95rem] text-ink shadow-[0_1px_0_rgba(0,0,0,0.02)] outline-none transition-[border-color,box-shadow] placeholder:text-ink/35 focus:border-ink focus:ring-4 focus:ring-ink/[0.06] disabled:bg-paper-2 disabled:text-ink/50";

/** Namnet på fältet vars Field har ett tips, så att kontrollen inuti kan peka på det. */
const HintCtx = createContext<string | null>(null);

/** aria-describedby och aria-invalid för en kontroll, med bara de id:n som faktiskt finns i dokumentet. */
function useDescription(name: string) {
  const { state } = useFormCtx();
  const hinted = useContext(HintCtx) === name;
  const invalid = !!state.fieldErrors?.[name];
  const ids = [hinted && `${name}-hint`, invalid && `${name}-error`].filter(Boolean).join(" ");
  return { "aria-describedby": ids || undefined, "aria-invalid": invalid || undefined };
}

export function Field({
  label,
  name,
  hint,
  children,
  className,
  required,
  inputId,
}: {
  label: string;
  name: string;
  /** Fältets id när det inte är samma som namnet, som när samma formulär står flera gånger på en sida. */
  inputId?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
  required?: boolean;
}) {
  const { state } = useFormCtx();
  const hasError = !!state.fieldErrors?.[name];
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={inputId ?? name} className="mb-1.5 flex items-baseline justify-between gap-3 text-sm font-semibold text-ink">
        <span>
          {label}
          {required && <span className="text-red-deep"> *</span>}
        </span>
      </label>
      <div className={cn(hasError && "field-invalid")}>
        <HintCtx value={hint ? name : null}>{children}</HintCtx>
      </div>
      {hint && (
        <p id={`${name}-hint`} className="mt-1.5 text-[0.82rem] leading-snug text-stone">
          {hint}
        </p>
      )}
      <FieldError name={name} />
    </div>
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement> & { name: string }) {
  const description = useDescription(props.name);
  return <input id={props.name} {...description} className={cn(inputBase, className)} {...props} />;
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { name: string }) {
  const description = useDescription(props.name);
  return <textarea id={props.name} {...description} className={cn(inputBase, "min-h-24 resize-y leading-relaxed", className)} {...props} />;
}

export function ColorInput({ name, defaultValue }: { name: string; defaultValue: string }) {
  const description = useDescription(name);
  return <input type="color" id={name} name={name} defaultValue={defaultValue} {...description} className="h-11 w-16 cursor-pointer rounded-xl border border-ink/15 bg-white p-1" />;
}

/**
 * Med trackChanges skickar listan `<namn>__changed` med värdet den laddades med när någon ändrat valet. Servern
 * rör då bara fältet om det ändrats (changedId) – ett val som inte rörts skriver aldrig över något.
 */
export function Select({
  className,
  children,
  trackChanges,
  onChange,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { name: string; trackChanges?: boolean }) {
  const [changed, setChanged] = useState(false);
  const [loaded] = useState(() => String(props.defaultValue ?? ""));
  const description = useDescription(props.name);
  return (
    <>
      <select
        id={props.name}
        {...description}
        className={cn(
          inputBase,
          "appearance-none bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2216%22%20height=%2216%22%20fill=%22none%22%20stroke=%22%230a0a0a%22%20stroke-width=%222%22%3E%3Cpath%20d=%22m4%206%204%204%204-4%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_0.9rem_center] bg-no-repeat pr-10",
          className,
        )}
        onChange={(e) => {
          if (trackChanges) setChanged(true);
          onChange?.(e);
        }}
        {...props}
      >
        {children}
      </select>
      {trackChanges && changed && <input type="hidden" name={`${props.name}__changed`} value={loaded} />}
    </>
  );
}

export function Toggle({ name, label, defaultChecked, hint, disabled }: { name: string; label: string; defaultChecked?: boolean; hint?: string; disabled?: boolean }) {
  return (
    <label className={cn("tryck flex cursor-pointer items-start gap-3", disabled && "cursor-not-allowed opacity-60")}>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" name={name} defaultChecked={defaultChecked} disabled={disabled} className="peer sr-only" />
        <span className="h-6 w-11 rounded-full bg-ink/15 transition-colors peer-checked:bg-red peer-focus-visible:ring-4 peer-focus-visible:ring-red/20" />
        <span className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="block text-[0.82rem] text-stone">{hint}</span>}
      </span>
    </label>
  );
}

/** Titel + slug där slug fylls i automatiskt tills man ändrar den själv. */
export function TitleSlugFields({
  defaultTitle = "",
  defaultSlug = "",
  basePath,
  titleLabel = "Titel",
  titleMaxLength = 160,
}: {
  defaultTitle?: string;
  defaultSlug?: string;
  basePath: string;
  titleLabel?: string;
  titleMaxLength?: number;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const [slug, setSlug] = useState(defaultSlug);
  const [touched, setTouched] = useState(!!defaultSlug);
  const shown = touched ? slug : slugify(title);
  return (
    <div className="space-y-2">
      <Field label={titleLabel} name="title" required>
        <TextInput
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="py-3 text-lg font-semibold"
          maxLength={titleMaxLength}
          autoComplete="off"
          // Något nytt har ingen adress än: då står markören i titeln när sidan öppnas.
          autoFocus={!defaultSlug}
          required
        />
      </Field>
      <div className="flex items-center gap-1 overflow-hidden text-[0.82rem] text-stone">
        <span className="shrink-0 font-mono">{basePath}/</span>
        <input
          name="slug"
          value={shown}
          onChange={(e) => {
            setTouched(true);
            setSlug(slugifyWhileTyping(e.target.value));
          }}
          onBlur={() => setSlug((s) => slugify(s))}
          aria-label="Adress (slug)"
          className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-0.5 font-mono text-ink outline-none hover:bg-white focus:bg-white focus:ring-2 focus:ring-ink/10"
        />
      </div>
    </div>
  );
}

export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("form-sektion rounded-[1.5rem] border border-ink/10 bg-white p-5 md:p-7", className)}>
      <div className="mb-5">
        <h2 className="text-base font-bold">{title}</h2>
        {description && <p className="mt-1 text-sm text-stone">{description}</p>}
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

/**
 * Hopfällbar ruta för fält som sällan behövs. Öppen från början om något av fälten har ett värde,
 * och öppnar sig själv om något av dem får ett valideringsfel.
 */
export function MoreDetails({
  title = "Fler detaljer",
  summary,
  fields,
  defaultOpen,
  children,
}: {
  title?: string;
  summary?: string;
  fields: string[];
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const { state } = useFormCtx();
  const hasError = fields.some((f) => state.fieldErrors?.[f]);
  const [open, setOpen] = useState(!!defaultOpen);
  const [hadError, setHadError] = useState(hasError);
  if (hasError !== hadError) {
    setHadError(hasError);
    if (hasError) setOpen(true);
  }
  return (
    <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)} className="group rounded-[1.5rem] border border-ink/10 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-[1.5rem] p-5 outline-none focus-visible:ring-4 focus-visible:ring-ink/10 md:px-7 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-base font-bold">{title}</span>
          {summary && <span className="mt-1 block text-sm text-stone">{summary}</span>}
        </span>
        <ChevronDown size={18} className="shrink-0 text-stone transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-5 border-t border-ink/10 p-5 md:p-7">{children}</div>
    </details>
  );
}

/** Arrangör eller avsändare som utskottskonton inte kan ändra – visas som text i stället för en låst lista. */
export function FixedCommittee({ label, name, hint }: { label: string; name: string; hint: string }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold text-ink">{label}</p>
      <p className="rounded-xl bg-paper px-3.5 py-2.5 font-semibold">{name}</p>
      <p className="mt-1.5 text-[0.82rem] leading-snug text-stone">{hint}</p>
    </div>
  );
}

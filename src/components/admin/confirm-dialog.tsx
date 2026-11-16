"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";

/**
 * Frågan inför något som inte går att ångra, i en dialog på sidan och inte med confirm(): en webbläsare kan stänga av confirm(),
 * som då svarar nej utan att visa något. Till radering med en action finns ConfirmButton.
 */
export function ConfirmDialog({
  message,
  confirmLabel = "Ta bort",
  onAnswer,
}: {
  message: string;
  confirmLabel?: string;
  onAnswer: (yes: boolean) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const questionId = useId();
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-labelledby={questionId}
      onCancel={(e) => {
        e.preventDefault();
        onAnswer(false);
      }}
      className="m-auto w-[calc(100vw-2rem)] max-w-md rounded-2xl bg-white p-6 text-ink shadow-2xl backdrop:bg-ink/40 backdrop:backdrop-blur-[2px]"
    >
      <p id={questionId} className="font-bold break-words">
        {message}
      </p>
      {/* Avbryt ligger först: dialogen ger det första fältet fokus, så Enter direkt efter klicket raderar inget. */}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={() => onAnswer(false)} className="btn btn-sm btn-ghost bg-white">
          Avbryt
        </button>
        <button type="button" onClick={() => onAnswer(true)} className="btn btn-sm btn-red fara">
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}

/** Som confirm(), men med ConfirmDialog och ett svar att vänta in. Dialogen läggs ut av komponenten som frågar. */
export function useConfirm() {
  const [question, setQuestion] = useState<{ message: string; confirmLabel?: string; answer: (yes: boolean) => void } | null>(null);
  const confirm = (message: string, confirmLabel?: string) =>
    new Promise<boolean>((resolve) => {
      setQuestion({
        message,
        confirmLabel,
        answer: (yes) => {
          setQuestion(null);
          resolve(yes);
        },
      });
    });
  const dialog = question && <ConfirmDialog message={question.message} confirmLabel={question.confirmLabel} onAnswer={question.answer} />;
  return [confirm, dialog] as const;
}

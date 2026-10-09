"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { saveSiteCheckCopy } from "./actions";

export function EditableCopyField({
  fieldPath,
  label,
  value,
  multiline = false,
  numeric = false,
  tokens,
  compact = false,
}: {
  fieldPath: string;
  label: string;
  value: string | number;
  multiline?: boolean;
  numeric?: boolean;
  tokens?: readonly string[];
  compact?: boolean;
}) {
  const id = useId();
  const editButton = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (editing) input.current?.focus();
  }, [editing]);

  const begin = () => {
    setDraft(String(value));
    setError(null);
    setSaved(false);
    setEditing(true);
  };

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const result = await saveSiteCheckCopy(fieldPath, draft);
        if (!result.ok) return setError(result.error);
        setEditing(false);
        setSaved(true);
        router.refresh();
        requestAnimationFrame(() => editButton.current?.focus());
      } catch {
        setError("That didn’t save. Try again.");
      }
    });
  };

  return (
    <div className={cn(!compact && "rounded-md border border-rule bg-paper-light/40 px-fl-16 py-fl-16")}>
      <div className="flex items-start justify-between gap-fl-12">
        <label htmlFor={editing ? id : undefined} className="mono-label text-muted">
          {label}
        </label>
        {!editing && (
          <button
            ref={editButton}
            type="button"
            onClick={begin}
            aria-label={`Edit ${label}`}
            className="grid size-8 shrink-0 place-items-center rounded-full border border-rule text-ink hover:border-ink"
          >
            <Pencil />
          </button>
        )}
      </div>

      {editing ? (
        <form onSubmit={save} className="mt-fl-8">
          {multiline ? (
            <textarea
              ref={input as React.RefObject<HTMLTextAreaElement>}
              id={id}
              required
              rows={4}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="min-h-28 w-full resize-y rounded-xs border border-rule bg-paper-light px-fl-12 py-fl-8 font-sans text-fl-16 leading-copy"
            />
          ) : (
            <input
              ref={input as React.RefObject<HTMLInputElement>}
              id={id}
              required
              type={numeric ? "number" : "text"}
              min={numeric ? 0 : undefined}
              max={numeric ? 100 : undefined}
              step={numeric ? 1 : undefined}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="h-11 w-full rounded-xs border border-rule bg-paper-light px-fl-12 font-sans text-fl-16"
            />
          )}
          {tokens?.length ? (
            <p className="mt-fl-8 text-fl-12 leading-copy text-muted">
              Keep: {tokens.map((token) => `{{${token}}}`).join(" · ")}
            </p>
          ) : null}
          {error && (
            <p role="alert" className="mt-fl-8 text-fl-14 leading-copy text-pink-ink">
              {error}
            </p>
          )}
          <div className="mt-fl-12 flex gap-fl-8">
            <button
              type="submit"
              disabled={pending}
              aria-label={`Save ${label}`}
              className="mono-label min-h-10 rounded-xs bg-ink px-fl-16 text-paper disabled:opacity-60"
            >
              {pending ? "Saving" : "Save"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setEditing(false);
                requestAnimationFrame(() => editButton.current?.focus());
              }}
              aria-label={`Cancel editing ${label}`}
              className="mono-label min-h-10 rounded-xs border border-rule px-fl-16 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-fl-8 whitespace-pre-wrap font-sans text-fl-18 leading-copy">{value}</p>
      )}
      <p aria-live="polite" className="sr-only">
        {saved ? `${label} saved.` : ""}
      </p>
    </div>
  );
}

function Pencil() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4">
      <path
        fill="currentColor"
        d="M4 21q-.425 0-.712-.288T3 20v-2.425q0-.4.15-.763t.425-.637L16.2 3.575q.3-.275.663-.425t.762-.15.775.15.65.45L20.425 5q.3.275.437.65T21 6.4q0 .4-.138.763t-.437.662l-12.6 12.6q-.275.275-.637.425t-.763.15zM17.6 7.8 19 6.4 17.6 5l-1.4 1.4z"
      />
    </svg>
  );
}

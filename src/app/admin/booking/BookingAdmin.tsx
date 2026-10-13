"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState, useTransition } from "react";
import type { CalendarListItem } from "@/lib/booking/google";
import {
  type Blackout,
  type BookingSettings,
  DAY_NAMES,
  DAYS,
  type Day,
  type Question,
  validateBookingSettings,
} from "@/lib/booking/settings";
import { cn } from "@/lib/cn";
import { previewSlots, saveBookingSettings } from "./actions";

const surface = "rounded-lg border border-rule bg-paper-light/60 px-fl-24 py-fl-24";
const smallLabel = "mono-label text-muted";
const input =
  "h-9 rounded-xs border border-rule bg-paper-light px-2 text-fl-14 text-ink focus:border-ink focus:outline-none";
const textButton = "cursor-pointer border-b border-pink text-fl-14 disabled:cursor-default disabled:opacity-50";

const RULES: { key: keyof BookingSettings; label: string; unit: string }[] = [
  { key: "durationMinutes", label: "Call length", unit: "minutes" },
  { key: "stepMinutes", label: "Start times every", unit: "minutes" },
  { key: "bufferMinutes", label: "Buffer before and after", unit: "minutes" },
  { key: "minNoticeHours", label: "Minimum notice", unit: "hours" },
  { key: "windowDays", label: "Booking window", unit: "days" },
  { key: "maxPerDay", label: "Most calls a day", unit: "calls" },
];

type Upcoming = { id: string; start: string; name: string; email: string; meetLink: string | null };

/** Every booking setting, edited as one draft, previewed against the calendars and saved together. */
export function BookingAdmin({
  initial,
  calendars,
  calendarError,
  googleReady,
  upcoming,
}: {
  initial: BookingSettings;
  calendars: CalendarListItem[] | null;
  calendarError: string | null;
  googleReady: boolean;
  upcoming: Upcoming[];
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, startSaving] = useTransition();
  const [preview, setPreview] = useState<{ slots?: string[]; error?: string; loading: boolean }>({ loading: true });

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  let problem: string | null = null;
  try {
    validateBookingSettings(draft);
  } catch (error) {
    problem = error instanceof Error ? error.message : "The settings aren’t valid.";
  }

  // The preview follows the draft, a moment after the last change.
  useEffect(() => {
    if (problem) return;
    let live = true;
    const timer = setTimeout(async () => {
      setPreview((p) => ({ ...p, loading: true }));
      const result = await previewSlots(draft);
      if (!live) return;
      setPreview(result.ok ? { slots: result.slots, loading: false } : { error: result.error, loading: false });
    }, 500);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [draft, problem]);

  const update = (patch: Partial<BookingSettings>) => {
    setDraft({ ...draft, ...patch });
    setMessage(null);
  };

  const save = () =>
    startSaving(async () => {
      const result = await saveBookingSettings(draft);
      if (!result.ok) return setMessage({ ok: false, text: result.error });
      setSaved(result.settings);
      setDraft(result.settings);
      setMessage({ ok: true, text: "Saved to src/data/booking.json. Commit it to ship the change." });
      router.refresh();
    });

  return (
    <div className="pt-fl-56 pb-fl-96 font-mono text-[12px]">
      <header className="mb-fl-32 flex flex-col gap-fl-8 border-b border-rule pb-fl-24">
        <span className={smallLabel}>/ Admin · dev only</span>
        <h1 className="display text-fl-48 leading-heading-48 tracking-display-48">Booking</h1>
        <p className="max-w-3xl font-mono text-fl-14 leading-copy text-muted">
          Which calendars the booking page reads and writes, when calls can start, and what it asks. Saving writes
          src/data/booking.json; the live site changes once that’s committed and deployed. To block out a one-off
          stretch, add an event to one of the busy calendars instead.
        </p>
      </header>

      <nav aria-label="Booking sections" className="mb-fl-48 flex flex-wrap gap-x-fl-24 gap-y-fl-8">
        {[
          ["Calendars", "calendars"],
          ["Hours", "hours"],
          ["Rules", "rules"],
          ["Blackouts", "blackouts"],
          ["Questions", "questions"],
          ["Preview", "preview"],
          ["Upcoming", "upcoming"],
        ].map(([label, id]) => (
          <a key={id} href={`#${id}`} className="border-b border-pink text-fl-14">
            {label}
          </a>
        ))}
      </nav>

      <div className="flex flex-col gap-fl-64">
        <Section id="calendars" number="01" title="Calendars">
          <Calendars
            draft={draft}
            calendars={calendars}
            calendarError={calendarError}
            googleReady={googleReady}
            update={update}
          />
        </Section>

        <Section id="hours" number="02" title="Hours">
          <Hours draft={draft} update={update} />
        </Section>

        <Section id="rules" number="03" title="Rules">
          <div className={cn(surface, "grid gap-fl-16 sm:grid-cols-2 xl:grid-cols-3")}>
            <label className="flex flex-col gap-1.5">
              <span className={smallLabel}>Title</span>
              <input value={draft.title} onChange={(e) => update({ title: e.target.value })} className={input} />
            </label>
            {RULES.map((r) => (
              <label key={r.key} className="flex flex-col gap-1.5">
                <span className={smallLabel}>{r.label}</span>
                <span className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={draft[r.key] as number}
                    onChange={(e) => update({ [r.key]: e.target.valueAsNumber })}
                    className={cn(input, "w-24")}
                  />
                  <span className="text-fl-14 text-muted">{r.unit}</span>
                </span>
              </label>
            ))}
          </div>
        </Section>

        <Section id="blackouts" number="04" title="Blackouts">
          <Blackouts blackouts={draft.blackouts} onChange={(blackouts) => update({ blackouts })} />
        </Section>

        <Section id="questions" number="05" title="Questions">
          <Questions questions={draft.questions} onChange={(questions) => update({ questions })} />
        </Section>

        <Section id="preview" number="06" title="Preview">
          <Preview
            slots={preview.slots}
            error={problem ?? preview.error}
            loading={!problem && preview.loading}
            zone={draft.timezone}
            googleReady={googleReady}
          />
        </Section>

        <Section id="upcoming" number="07" title="Upcoming">
          {upcoming.length === 0 ? (
            <p className="text-fl-14 text-muted">No calls booked in the next 90 days.</p>
          ) : (
            <ul className={cn(surface, "flex flex-col gap-fl-12 text-fl-14")}>
              {upcoming.map((b) => (
                <li key={b.id} className="flex flex-wrap gap-x-fl-24">
                  <span className="w-64">{formatSlot(b.start, draft.timezone)}</span>
                  <span className="text-ink">{b.name}</span>
                  <a href={`mailto:${b.email}`} className="border-b border-pink">
                    {b.email}
                  </a>
                  {b.meetLink && (
                    <a href={b.meetLink} className="border-b border-pink">
                      Meet
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <div className="sticky bottom-4 z-10 mt-fl-48 flex flex-wrap items-center gap-fl-16 rounded-lg border border-rule bg-paper px-fl-24 py-fl-16 shadow-md">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving || Boolean(problem)}
          className="mono-label min-h-11 cursor-pointer rounded-xs bg-pink px-fl-20 text-ink disabled:cursor-default disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setDraft(saved);
            setMessage(null);
          }}
          disabled={!dirty || saving}
          className={textButton}
        >
          Discard changes
        </button>
        <p
          className={cn("text-fl-14", problem || message?.ok === false ? "text-pink-ink" : "text-muted")}
          role="status"
        >
          {problem ?? message?.text ?? (dirty ? "Unsaved changes." : "Everything’s saved.")}
        </p>
      </div>
    </div>
  );
}

function Section({ id, number, title, children }: { id: string; number: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-[calc(var(--nav-h)+1rem)]">
      <h2 className="mb-fl-20 flex items-baseline gap-fl-12">
        <span className={smallLabel}>{number}</span>
        <span className="display text-fl-30 leading-heading-30 tracking-display-30">{title}</span>
      </h2>
      {children}
    </section>
  );
}

function Calendars({
  draft,
  calendars,
  calendarError,
  googleReady,
  update,
}: {
  draft: BookingSettings;
  calendars: CalendarListItem[] | null;
  calendarError: string | null;
  googleReady: boolean;
  update: (patch: Partial<BookingSettings>) => void;
}) {
  if (!calendars) {
    return (
      <div className={cn(surface, "flex flex-col gap-fl-16")}>
        <p className="max-w-3xl text-fl-14 leading-copy text-muted">
          {googleReady
            ? `Google didn’t list the calendars: ${calendarError}`
            : "Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REFRESH_TOKEN in .env.local (see scripts/google-auth.mjs) to pick from your calendars. Until then, enter their ids."}
        </p>
        <label className="flex flex-col gap-1.5">
          <span className={smallLabel}>Booking calendar</span>
          <input
            value={draft.calendarId}
            onChange={(e) => update({ calendarId: e.target.value })}
            className={cn(input, "max-w-md")}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={smallLabel}>Busy calendars, one per line</span>
          <textarea
            rows={3}
            value={draft.busyCalendarIds.join("\n")}
            onChange={(e) => update({ busyCalendarIds: e.target.value.split("\n").map((l) => l.trim()) })}
            className={cn(input, "h-auto max-w-md py-1.5")}
          />
        </label>
      </div>
    );
  }

  const known = new Set(calendars.map((c) => c.id));
  // "primary" in the settings is the account's own calendar.
  const isBooking = (c: CalendarListItem) => draft.calendarId === c.id || (draft.calendarId === "primary" && c.primary);
  const isBusy = (c: CalendarListItem) =>
    draft.busyCalendarIds.includes(c.id) || (c.primary && draft.busyCalendarIds.includes("primary")) || isBooking(c);
  const missing = [draft.calendarId, ...draft.busyCalendarIds].filter((id) => id !== "primary" && !known.has(id));

  return (
    <div className="overflow-hidden rounded-lg border border-rule">
      <table className="w-full border-collapse text-left text-fl-14 leading-copy">
        <thead className="bg-sand/60">
          <tr>
            <th scope="col" className="px-fl-20 py-fl-12 font-normal text-muted">
              Calendar
            </th>
            <th scope="col" className="px-fl-20 py-fl-12 font-normal text-muted">
              Bookings go here
            </th>
            <th scope="col" className="px-fl-20 py-fl-12 font-normal text-muted">
              Counts as busy
            </th>
          </tr>
        </thead>
        <tbody>
          {calendars.map((c) => {
            const writable = c.accessRole === "owner" || c.accessRole === "writer";
            return (
              <tr key={c.id} className="border-t border-rule bg-paper-light/40">
                <th scope="row" className="px-fl-20 py-fl-12 font-normal">
                  <span className="flex items-center gap-2">
                    <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: c.color || undefined }} />
                    <span className="text-ink">{c.summary}</span>
                    {c.primary && <span className="text-muted">(primary)</span>}
                  </span>
                  <span className="block text-muted">{c.id}</span>
                </th>
                <td className="px-fl-20 py-fl-12">
                  <input
                    type="radio"
                    name="booking-calendar"
                    aria-label={`Create bookings on ${c.summary}`}
                    disabled={!writable}
                    checked={isBooking(c)}
                    onChange={() => update({ calendarId: c.primary ? "primary" : c.id })}
                    className="size-4 accent-pink"
                  />
                </td>
                <td className="px-fl-20 py-fl-12">
                  <input
                    type="checkbox"
                    aria-label={`Count ${c.summary} as busy`}
                    disabled={isBooking(c)}
                    checked={isBusy(c)}
                    onChange={(e) => {
                      const id = c.primary ? "primary" : c.id;
                      const rest = draft.busyCalendarIds.filter((b) => b !== id && b !== c.id);
                      update({ busyCalendarIds: e.target.checked ? [...rest, id] : rest });
                    }}
                    className="size-4 accent-pink"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {missing.length > 0 && (
        <p className="border-t border-rule px-fl-20 py-fl-12 text-fl-14 text-pink-ink">
          Not in this account’s calendar list: {missing.join(", ")}
        </p>
      )}
    </div>
  );
}

function Hours({ draft, update }: { draft: BookingSettings; update: (patch: Partial<BookingSettings>) => void }) {
  const setDay = (day: Day, windows: BookingSettings["weeklyHours"][Day]) =>
    update({ weeklyHours: { ...draft.weeklyHours, [day]: windows } });
  const zones = Intl.supportedValuesOf("timeZone");

  return (
    <div className={cn(surface, "flex flex-col gap-fl-16")}>
      <label className="flex flex-wrap items-center gap-fl-12">
        <span className={smallLabel}>Timezone</span>
        <select value={draft.timezone} onChange={(e) => update({ timezone: e.target.value })} className={input}>
          {(zones.includes(draft.timezone) ? zones : [draft.timezone, ...zones]).map((z) => (
            <option key={z}>{z}</option>
          ))}
        </select>
      </label>
      <ul className="flex flex-col divide-y divide-rule">
        {DAYS.map((day) => {
          const windows = draft.weeklyHours[day];
          return (
            <li key={day} className="flex flex-wrap items-center gap-x-fl-24 gap-y-2 py-fl-12">
              <span className="w-28 text-fl-14 text-ink">{DAY_NAMES[day]}</span>
              {windows.length === 0 && <span className="text-fl-14 text-muted">Unavailable</span>}
              {windows.map((w, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  <input
                    type="time"
                    step={300}
                    aria-label={`${DAY_NAMES[day]} window ${i + 1} start`}
                    value={w.start}
                    onChange={(e) =>
                      setDay(
                        day,
                        windows.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)),
                      )
                    }
                    className={input}
                  />
                  <span className="text-muted">–</span>
                  <input
                    type="time"
                    step={300}
                    aria-label={`${DAY_NAMES[day]} window ${i + 1} end`}
                    value={w.end}
                    onChange={(e) =>
                      setDay(
                        day,
                        windows.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)),
                      )
                    }
                    className={input}
                  />
                  <button
                    type="button"
                    aria-label={`Remove ${DAY_NAMES[day]} window ${i + 1}`}
                    onClick={() =>
                      setDay(
                        day,
                        windows.filter((_, j) => j !== i),
                      )
                    }
                    className="cursor-pointer px-1 text-muted hover:text-ink"
                  >
                    ✕
                  </button>
                </span>
              ))}
              <button
                type="button"
                className={textButton}
                onClick={() => {
                  const last = windows.at(-1);
                  const start = last ? last.end : "10:00";
                  const hour = Math.min(Number(start.slice(0, 2)) + 2, 23);
                  setDay(day, [...windows, { start, end: `${String(hour).padStart(2, "0")}:${start.slice(3)}` }]);
                }}
              >
                + Add window
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Blackouts({ blackouts, onChange }: { blackouts: Blackout[]; onChange: (b: Blackout[]) => void }) {
  const set = (i: number, patch: Partial<Blackout>) =>
    onChange(blackouts.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className={cn(surface, "flex flex-col gap-fl-12")}>
      {blackouts.length === 0 && <p className="text-fl-14 text-muted">No blackout dates.</p>}
      {blackouts.map((b, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            aria-label="From"
            value={b.start}
            onChange={(e) => set(i, { start: e.target.value })}
            className={input}
          />
          <span className="text-muted">to</span>
          <input
            type="date"
            aria-label="To"
            value={b.end}
            onChange={(e) => set(i, { end: e.target.value })}
            className={input}
          />
          <input
            aria-label="Label"
            placeholder="Label (optional)"
            value={b.label ?? ""}
            onChange={(e) => set(i, { label: e.target.value })}
            className={cn(input, "w-56")}
          />
          <button
            type="button"
            aria-label="Remove blackout"
            onClick={() => onChange(blackouts.filter((_, j) => j !== i))}
            className="cursor-pointer px-1 text-muted hover:text-ink"
          >
            ✕
          </button>
          {b.end < today && <span className="text-fl-14 text-muted">Past; safe to remove.</span>}
        </div>
      ))}
      <button
        type="button"
        className={cn(textButton, "self-start")}
        onClick={() => onChange([...blackouts, { start: today, end: today }])}
      >
        + Add blackout
      </button>
    </div>
  );
}

function Questions({ questions, onChange }: { questions: Question[]; onChange: (q: Question[]) => void }) {
  const set = (i: number, patch: Partial<Question>) =>
    onChange(questions.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const move = (i: number, by: number) => {
    const next = [...questions];
    const [q] = next.splice(i, 1);
    next.splice(i + by, 0, q);
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-fl-16">
      <p className="max-w-3xl text-fl-14 leading-copy text-muted">
        Name and email are always asked. Answers are stored by id, so change an id only before anyone has answered it.
      </p>
      {questions.map((q, i) => (
        <div key={i} className={cn(surface, "grid gap-fl-12 lg:grid-cols-[10rem_minmax(0,1fr)_9rem_auto]")}>
          <label className="flex flex-col gap-1.5">
            <span className={smallLabel}>Id</span>
            <input value={q.id} onChange={(e) => set(i, { id: e.target.value })} className={input} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={smallLabel}>Label</span>
            <input value={q.label} onChange={(e) => set(i, { label: e.target.value })} className={input} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={smallLabel}>Type</span>
            <select
              value={q.type}
              onChange={(e) => {
                const type = e.target.value as Question["type"];
                set(i, type === "select" ? { type, options: q.options ?? ["", ""] } : { type, options: undefined });
              }}
              className={input}
            >
              <option value="text">Short text</option>
              <option value="textarea">Long text</option>
              <option value="select">Choice</option>
            </select>
          </label>
          <div className="flex items-end gap-fl-12 pb-2">
            <label className="flex items-center gap-1.5 text-fl-14">
              <input
                type="checkbox"
                checked={q.required}
                onChange={(e) => set(i, { required: e.target.checked })}
                className="size-4 accent-pink"
              />
              Required
            </label>
            <button
              type="button"
              disabled={i === 0}
              onClick={() => move(i, -1)}
              className={textButton}
              aria-label="Move up"
            >
              ↑
            </button>
            <button
              type="button"
              disabled={i === questions.length - 1}
              onClick={() => move(i, 1)}
              className={textButton}
              aria-label="Move down"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => onChange(questions.filter((_, j) => j !== i))}
              className={textButton}
              aria-label={`Remove ${q.label || q.id}`}
            >
              Remove
            </button>
          </div>
          {q.type === "select" && (
            <label className="flex flex-col gap-1.5 lg:col-span-4">
              <span className={smallLabel}>Choices, one per line</span>
              <textarea
                rows={Math.max(3, (q.options?.length ?? 0) + 1)}
                value={(q.options ?? []).join("\n")}
                onChange={(e) => set(i, { options: e.target.value.split("\n") })}
                className={cn(input, "h-auto py-1.5")}
              />
            </label>
          )}
        </div>
      ))}
      <button
        type="button"
        className={cn(textButton, "self-start")}
        onClick={() =>
          onChange([...questions, { id: `question-${questions.length + 1}`, label: "", type: "text", required: false }])
        }
      >
        + Add question
      </button>
    </div>
  );
}

const formatSlot = (iso: string, zone: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));

function Preview({
  slots,
  error,
  loading,
  zone,
  googleReady,
}: {
  slots?: string[];
  error?: string | null;
  loading: boolean;
  zone: string;
  googleReady: boolean;
}) {
  const dayOf = (iso: string) =>
    new Intl.DateTimeFormat("en-US", { timeZone: zone, weekday: "short", month: "short", day: "numeric" }).format(
      new Date(iso),
    );
  const timeOf = (iso: string) =>
    new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
  const days = new Map<string, string[]>();
  for (const s of slots ?? []) days.set(dayOf(s), [...(days.get(dayOf(s)) ?? []), s]);
  const shown = [...days.entries()].slice(0, 14);

  return (
    <div className={cn(surface, "flex flex-col gap-fl-12", loading && "opacity-60")}>
      <p className="text-fl-14 leading-copy text-muted">
        The next 14 open days from the unsaved draft, in {zone},{" "}
        {googleReady ? "against your busy calendars right now." : "without busy times (Google isn’t set up)."}
      </p>
      {error ? (
        <p className="text-fl-14 text-pink-ink">{error}</p>
      ) : shown.length === 0 && !loading ? (
        <p className="text-fl-14 text-ink">No open times.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map(([day, times]) => (
            <li key={day} className="flex flex-wrap items-baseline gap-x-fl-16 gap-y-1">
              <span className="w-28 text-fl-14 text-ink">{day}</span>
              {times.map((t) => (
                <span key={t} className="rounded-xs bg-paper px-1.5 py-0.5 text-fl-14">
                  {timeOf(t)}
                </span>
              ))}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

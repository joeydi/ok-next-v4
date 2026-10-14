"use client";

import {
  type ComponentProps,
  type FormEvent,
  Fragment,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { flushSync } from "react-dom";
import { MediaImage } from "@/components/MediaImage";
import { useBotCheck } from "@/components/site-check/BotCheck";
import { SITE } from "@/data/site";
import { trackBooking } from "@/lib/booking/analytics";
import type { PublicSettings } from "@/lib/booking/settings";
import { cn } from "@/lib/cn";

// The booking flow, in the BookingLink dialog and on /book: pick a day and a
// time (shown in the visitor's timezone, which they can change), answer a few
// questions, and get the call's details and a calendar file. With `reschedule`
// (a manage link's token) it moves that booking instead and asks nothing.

type Slots = {
  settings: PublicSettings;
  slots: string[];
  booking?: { start: string; end: string; name: string };
};

type Booked = {
  booking: { start: string; end: string; meetLink: string | null; email: string };
  ics: string;
  links: { manage: string; reschedule: string };
};

type Step = "pick" | "details" | "done";

const ERRORS: Record<string, string> = {
  "slot-taken": "Someone just took that time. Pick another one.",
  "email-limit": "That address already has calls coming up. Write to me if you need another.",
  "bad-email": "That email address doesn’t look right.",
  "bad-website": "That website address doesn’t look right.",
  "disposable-email": "Please use an address you’ll keep.",
  "no-mail-server": "That address can’t receive email. Is it spelled right?",
  "missing-answer": "Please answer the questions marked as required.",
  "rate-limited": "That’s a lot of tries. Give it a few minutes.",
  "bot-check": "The bot check didn’t pass. Please try again.",
  "not-found": "That booking link doesn’t work any more. It may already be cancelled.",
  cancelled: "That call has been cancelled. You can book a new one.",
  past: "That call has already happened.",
};

const noop = () => () => {};

/** The free slots, or the error code the route answered with. */
async function fetchSlots(reschedule: string | null | undefined, signal?: AbortSignal): Promise<Slots> {
  const query = reschedule ? `?reschedule=${encodeURIComponent(reschedule)}` : "";
  const res = await fetch(`/api/booking/slots${query}`, { signal, cache: "no-store" });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? "unavailable");
  return json as Slots;
}
const detectZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** "YYYY-MM-DD" in `zone`. */
const dateIn = (iso: string, zone: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(iso),
  );

/** "10:30am" in `zone`. */
const timeIn = (iso: string, zone: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit" })
    .format(new Date(iso))
    .replace(/\s?([AP]M)$/, (_, m: string) => m.toLowerCase());

/** "Tuesday, October 20" for a "YYYY-MM-DD". */
const longDate = (date: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" }).format(
    new Date(`${date}T12:00:00Z`),
  );

const zoneName = (zone: string, at: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "short" })
    .formatToParts(new Date(at))
    .find((p) => p.type === "timeZoneName")?.value ?? zone;

const addDays = (date: string, days: number) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

/** Sunday is 0. */
const weekdayOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const zoneLabel = (zone: string) => zone.replaceAll("_", " ").replace("/", " / ");

const field =
  "w-full rounded-xs border border-rule/70 bg-paper-light px-fl-16 text-fl-18 text-ink placeholder:text-muted focus:border-ink focus:outline-none";
const primary =
  "mono-label inline-flex min-h-13 cursor-pointer items-center gap-2 rounded-xs bg-pink px-fl-20 text-ink disabled:cursor-default disabled:opacity-70";

export function BookingPicker({ reschedule, className }: { reschedule?: string | null; className?: string }) {
  const [data, setData] = useState<Slots | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const detected = useSyncExternalStore(noop, detectZone, () => null);
  const [zoneChoice, setZoneChoice] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("pick");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<Booked | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const id = useId();
  const bot = useBotCheck();
  const [height, setHeight] = useState<number>();
  /** Tracks the content's height; the first measure sets it without a transition (auto to a number doesn't animate). */
  const measure = (el: HTMLDivElement | null) => {
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setHeight(entry.borderBoxSize[0].blockSize));
    observer.observe(el);
    return () => observer.disconnect();
  };
  /** The card around a state (loading, error or a step). Its height follows the content so it eases between them. */
  const shell = (content: ReactNode, innerClassName: string) => (
    <div
      style={height ? { height } : undefined}
      className={cn(
        "overflow-hidden transition-[height] duration-500 ease-out-expo motion-reduce:transition-none",
        className,
      )}
    >
      <div ref={measure} className={cn("max-h-[inherit]", innerClassName)}>
        {content}
      </div>
    </div>
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchSlots(reschedule, controller.signal).then(setData, (e: Error) => {
      if (!controller.signal.aborted) setLoadError(e.message);
    });
    return () => controller.abort();
  }, [reschedule]);

  const reload = () =>
    fetchSlots(reschedule).then(
      (slots) => {
        setData(slots);
        setLoadError(null);
      },
      (e: Error) => setLoadError(e.message),
    );

  const zone = zoneChoice ?? detected ?? data?.settings.timezone ?? "UTC";
  /** Moves to a step, and its heading takes focus so a screen reader follows along. */
  const go = (next: Step) => {
    flushSync(() => setStep(next));
    heading.current?.focus();
  };

  if (loadError) {
    return shell(
      <div className="max-w-sm">
        <p className="text-fl-18 leading-copy text-body" role="alert">
          {ERRORS[loadError] ?? "The calendar couldn’t load just now."}{" "}
          {loadError !== "not-found" && (
            <>
              Try again, or write to <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.
            </>
          )}
        </p>
        {loadError !== "not-found" && (
          <button type="button" className={cn(primary, "mt-fl-20")} onClick={reload}>
            Try again
          </button>
        )}
      </div>,
      "grid min-h-80 place-items-center p-fl-32 text-center",
    );
  }

  if (!data) {
    return shell(
      <span aria-live="polite">Checking my calendar…</span>,
      "mono-label grid min-h-80 place-items-center text-muted",
    );
  }

  const { settings } = data;
  // The website field follows the notes (the last long-answer question), or ends the form without one.
  const notesId = settings.questions.findLast((q) => q.type === "textarea")?.id;
  const websiteField = (
    <Field id={`${id}-website`} label="Your website">
      <input
        id={`${id}-website`}
        inputMode="url"
        autoComplete="url"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={200}
        placeholder="example.com"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className={cn(field, "h-12")}
      />
    </Field>
  );
  const byDay = new Map<string, string[]>();
  for (const s of data.slots) {
    const d = dateIn(s, zone);
    byDay.set(d, [...(byDay.get(d) ?? []), s]);
  }
  const days = [...byDay.keys()];
  const activeDay = day && byDay.has(day) ? day : (days[0] ?? null);

  const pickSlot = (s: string) => {
    setSlot(s);
    setError(null);
    trackBooking("Booking time picked", { reschedule: Boolean(reschedule) });
    go("details");
  };

  const fail = (code: string) => {
    trackBooking("Booking failed", { error: code });
    setError(code);
    setSending(false);
    if (code === "slot-taken") {
      setSlot(null);
      go("pick");
      reload();
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!slot) return;
    setSending(true);
    setError(null);
    try {
      const res = reschedule
        ? await fetch("/api/booking/reschedule", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ manage: reschedule, start: slot }),
          })
        : await fetch("/api/booking", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              start: slot,
              name,
              email,
              site: website,
              timezone: zone,
              answers,
              ...(await bot.check()),
            }),
          });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) return fail(json?.error ?? "failed");
      trackBooking(reschedule ? "Booking rescheduled" : "Booking booked");
      setBooked(json as Booked);
      setSending(false);
      go("done");
    } catch {
      fail("failed");
    }
  };

  const errorMessage = error && (
    <p role="alert" className="mt-fl-16 text-fl-18 leading-copy text-pink-ink">
      {ERRORS[error] ?? (
        <>
          That didn’t work. Try again, or write to <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.
        </>
      )}
    </p>
  );

  return shell(
    <>
      <aside className="flex flex-col gap-fl-20 border-rule/60 border-b p-fl-32 md:border-r md:border-b-0">
        <div>
          <div className="mono-label text-muted">/ {reschedule ? "Move your call" : "Book a call"}</div>
          <div className="mt-fl-20 flex items-center gap-fl-16">
            <MediaImage
              src="home/headshot.jpg"
              alt=""
              width={64}
              height={64}
              className="frame size-16 shrink-0 rounded-full object-cover"
            />
            <div>
              <h2 className="display text-fl-30 leading-heading-30 tracking-display-30 text-ink">{SITE.author}</h2>
              <div className="mono-text mt-1 leading-body text-muted">
                {settings.durationMinutes} minutes • Google Meet
              </div>
            </div>
          </div>
        </div>
        {data.booking && (
          <p className="text-fl-18 leading-copy text-body">
            Now:{" "}
            <span className="text-ink">
              {longDate(dateIn(data.booking.start, zone))}, {timeIn(data.booking.start, zone)}
            </span>
          </p>
        )}
        {slot && step !== "pick" && (
          <p className="text-fl-18 leading-copy text-ink">
            {longDate(dateIn(slot, zone))}
            <br />
            {timeIn(slot, zone)} –{" "}
            {timeIn(new Date(Date.parse(slot) + settings.durationMinutes * 60_000).toISOString(), zone)}{" "}
            {zoneName(zone, slot)}
          </p>
        )}
        {step !== "done" && (
          <div className="mt-auto">
            <label htmlFor={`${id}-zone`} className="mono-label block text-muted">
              Times shown in
            </label>
            <ZoneSelect id={`${id}-zone`} value={zone} onChange={setZoneChoice} />
          </div>
        )}
      </aside>

      <section className="p-fl-32 md:overflow-y-auto" aria-live="polite">
        {step === "pick" && (
          <>
            <h3
              ref={heading}
              tabIndex={-1}
              className="text-fl-20 leading-body font-semibold text-ink focus:outline-none"
            >
              Pick a day and time
            </h3>
            {errorMessage}
            {days.length === 0 ? (
              <p className="mt-fl-16 text-fl-18 leading-copy text-body">
                There are no open times in the next few weeks. Write to{" "}
                <a href={`mailto:${SITE.email}`}>{SITE.email}</a> and we’ll find one.
              </p>
            ) : (
              <div className="mt-fl-20 grid gap-fl-24 lg:grid-cols-[minmax(0,1fr)_auto]">
                <Calendar days={byDay} active={activeDay} zone={zone} onPick={setDay} />
                {activeDay && (
                  <div>
                    {/* Holds the column at the width of the longest date, so it doesn't shift from day to day. */}
                    <div aria-hidden className="mono-label invisible hidden h-0 whitespace-nowrap lg:block">
                      Wednesday, September 30
                    </div>
                    <div className="mono-label text-muted lg:whitespace-nowrap">{longDate(activeDay)}</div>
                    {/* An unseen list as long as the busiest day's sits under this one, so the card keeps its height from day to day. */}
                    <div className="mt-fl-12 grid *:col-start-1 *:row-start-1">
                      <ul aria-hidden className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1 invisible">
                        {Array.from({ length: Math.max(...[...byDay.values()].map((d) => d.length)) }, (_, i) => (
                          <li key={i} className="mono-text border px-3 py-2.5">
                            &nbsp;
                          </li>
                        ))}
                      </ul>
                      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1 content-start">
                        {byDay.get(activeDay)!.map((s) => (
                          <li key={s}>
                            <button
                              type="button"
                              onClick={() => pickSlot(s)}
                              className="mono-text w-full cursor-pointer rounded-xs border border-rule/70 bg-paper-light px-3 py-2.5 text-ink transition-colors duration-200 hover:border-ink hover:bg-paper focus-visible:border-ink"
                            >
                              {timeIn(s, zone)}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {step === "details" && slot && (
          <form onSubmit={submit} className="relative max-w-xl">
            <button
              type="button"
              onClick={() => go("pick")}
              className="mono-label cursor-pointer text-muted hover:text-ink"
            >
              ← Change time
            </button>
            <h3
              ref={heading}
              tabIndex={-1}
              className="mt-fl-16 text-fl-20 leading-body font-semibold text-ink focus:outline-none"
            >
              {reschedule ? "Move your call to this time?" : "A few details"}
            </h3>
            {!reschedule && (
              <div className="mt-fl-20 space-y-fl-16">
                <div className="grid gap-fl-16 sm:grid-cols-2">
                  <Field id={`${id}-name`} label="Your name" required>
                    <input
                      id={`${id}-name`}
                      required
                      autoComplete="name"
                      maxLength={120}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={cn(field, "h-12")}
                    />
                  </Field>
                  <Field id={`${id}-email`} label="Email" required>
                    <input
                      id={`${id}-email`}
                      required
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={cn(field, "h-12")}
                    />
                  </Field>
                </div>
                {settings.questions.map((q) => (
                  <Fragment key={q.id}>
                    <Field id={`${id}-${q.id}`} label={q.label} required={q.required}>
                      {q.type === "textarea" ? (
                        <textarea
                          id={`${id}-${q.id}`}
                          required={q.required}
                          rows={4}
                          maxLength={2000}
                          value={answers[q.id] ?? ""}
                          onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                          className={cn(field, "block py-3 leading-copy")}
                        />
                      ) : q.type === "select" ? (
                        <Select
                          id={`${id}-${q.id}`}
                          required={q.required}
                          value={answers[q.id] ?? ""}
                          onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                          className="h-12"
                        >
                          <option value="">Choose one</option>
                          {q.options?.map((o) => (
                            <option key={o}>{o}</option>
                          ))}
                        </Select>
                      ) : (
                        <input
                          id={`${id}-${q.id}`}
                          required={q.required}
                          maxLength={2000}
                          value={answers[q.id] ?? ""}
                          onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                          className={cn(field, "h-12")}
                        />
                      )}
                    </Field>
                    {q.id === notesId && websiteField}
                  </Fragment>
                ))}
                {!notesId && websiteField}
                {bot.fields}
              </div>
            )}
            {errorMessage}
            <button type="submit" disabled={sending} className={cn(primary, "mt-fl-24")}>
              {sending ? "One moment…" : reschedule ? "Move my call" : "Book the call"} <span className="nudge">→</span>
            </button>
          </form>
        )}

        {step === "done" && booked && (
          <div className="max-w-xl">
            <div className="mono-label text-muted">/ {reschedule ? "Moved" : "Booked"}</div>
            <h3
              ref={heading}
              tabIndex={-1}
              className="display mt-fl-16 text-fl-36 leading-heading-36 tracking-display-36 text-ink focus:outline-none"
            >
              {reschedule ? "Your call has moved." : "You’re booked in."}
            </h3>
            <p className="mt-fl-16 text-fl-18 leading-copy text-body">
              {longDate(dateIn(booked.booking.start, zone))}, {timeIn(booked.booking.start, zone)} –{" "}
              {timeIn(booked.booking.end, zone)} {zoneName(zone, booked.booking.start)}.
            </p>
            <p className="mt-fl-12 text-fl-18 leading-copy text-body">
              An email with the details is on its way to <span className="text-ink">{booked.booking.email}</span>, with
              links to move or cancel the call.
            </p>
            <div className="mt-fl-24 flex flex-wrap gap-3">
              <a
                href={`data:text/calendar;charset=utf-8,${encodeURIComponent(booked.ics)}`}
                download="okayplus-call.ics"
                className={primary}
              >
                Add to calendar <span className="nudge">→</span>
              </a>
              {booked.booking.meetLink && (
                <a
                  href={booked.booking.meetLink}
                  target="_blank"
                  rel="noopener"
                  className="mono-label inline-flex min-h-13 items-center rounded-xs border border-ink px-fl-20 text-ink"
                >
                  Meet link
                </a>
              )}
            </div>
          </div>
        )}
      </section>
    </>,
    "grid overflow-y-auto md:grid-cols-[minmax(0,5fr)_minmax(0,8fr)] md:grid-rows-[minmax(0,1fr)] md:overflow-hidden",
  );
}

function Field({
  id,
  label,
  required,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mono-label mb-1.5 block text-muted">
        {label}
        {required && (
          <span aria-hidden className="text-pink-ink">
            {" "}
            *
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

function ZoneSelect({ id, value, onChange }: { id: string; value: string; onChange: (zone: string) => void }) {
  const zones = Intl.supportedValuesOf("timeZone");
  const options = zones.includes(value) ? zones : [value, ...zones];
  return (
    <Select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 text-fl-14"
      wrapperClassName="mt-1.5"
    >
      {options.map((z) => (
        <option key={z} value={z}>
          {zoneLabel(z)}
        </option>
      ))}
    </Select>
  );
}

/** A field-styled select with the site's mono arrow in place of the browser's caret. */
function Select({ className, wrapperClassName, ...props }: ComponentProps<"select"> & { wrapperClassName?: string }) {
  return (
    <div className={cn("group relative", wrapperClassName)}>
      <select
        {...props}
        className={cn(field, "cursor-pointer appearance-none truncate pr-fl-40 hover:border-ink", className)}
      />
      <span
        aria-hidden
        className="mono-text pointer-events-none absolute inset-y-0 right-fl-16 flex items-center text-muted transition-colors duration-200 group-hover:text-ink group-focus-within:text-ink"
      >
        ↓
      </span>
    </div>
  );
}

/** The weeks from today to the last open day, Sunday first; days with open times are buttons. */
function Calendar({
  days,
  active,
  zone,
  onPick,
}: {
  days: Map<string, string[]>;
  active: string | null;
  zone: string;
  onPick: (day: string) => void;
}) {
  const today = dateIn(new Date().toISOString(), zone);
  const last = [...days.keys()].at(-1) ?? today;
  const first = addDays(today, -weekdayOf(today));
  const cells: string[] = [];
  for (let d = first; d <= last || weekdayOf(d) !== 0; d = addDays(d, 1)) cells.push(d);
  const months = [...new Set(cells.filter((d) => d >= today && d <= last).map((d) => d.slice(0, 7)))].map((m) =>
    new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", year: "numeric" }).format(
      new Date(`${m}-15T12:00:00Z`),
    ),
  );

  return (
    <div>
      <div className="mono-label text-muted">{months.join(" – ")}</div>
      <fieldset className="mt-fl-12 grid min-w-0 grid-cols-7 gap-1.5">
        <legend className="sr-only">Days</legend>
        {WEEKDAYS.map((w) => (
          <div key={w} className="mono-label pb-1 text-center text-muted-light" aria-hidden="true">
            {w.slice(0, 1)}
          </div>
        ))}
        {cells.map((d) => {
          const open = days.has(d);
          const selected = d === active;
          const label = new Intl.DateTimeFormat("en-US", {
            timeZone: "UTC",
            weekday: "long",
            month: "long",
            day: "numeric",
          }).format(new Date(`${d}T12:00:00Z`));
          return open ? (
            <button
              key={d}
              type="button"
              aria-pressed={selected}
              aria-label={`${label}, ${days.get(d)!.length} times`}
              onClick={() => onPick(d)}
              className={cn(
                "mono-text aspect-square cursor-pointer rounded-xs transition-colors duration-200",
                selected ? "bg-ink text-paper" : "bg-paper text-ink hover:bg-sand",
              )}
            >
              {Number(d.slice(8))}
            </button>
          ) : (
            <div
              key={d}
              aria-hidden="true"
              className={cn(
                "mono-text grid aspect-square place-items-center",
                d < today ? "text-transparent" : "text-muted-light/80",
              )}
            >
              {Number(d.slice(8))}
            </div>
          );
        })}
      </fieldset>
    </div>
  );
}

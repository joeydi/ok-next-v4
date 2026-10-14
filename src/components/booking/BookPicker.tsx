"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { BookingPicker } from "./BookingPicker";

/** The picker on /book, reading a reschedule link's token from the address in the browser. */
export function BookPicker() {
  return (
    <Suspense fallback={<p className="mono-label grid min-h-80 place-items-center text-muted">Loading…</p>}>
      <WithToken />
    </Suspense>
  );
}

function WithToken() {
  const reschedule = useSearchParams().get("reschedule");
  return <BookingPicker key={reschedule ?? "new"} reschedule={reschedule} className="max-h-[min(800px,100dvh-4rem)]" />;
}

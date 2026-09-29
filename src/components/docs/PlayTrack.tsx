"use client";

import { useEffect, useState } from "react";
import { DocButton } from "./DocButton";

// A track where a pink dot runs with an easing token and a grey one runs linearly,
// using the real `var(--ease-*)` as a CSS transition. The dots rest at the end;
// clicking the track, or <PlayAll>, runs them from the start.

const PLAY = "docs:play";

export function PlayTrack({ ease, duration, label }: { ease: string; duration: number; label: string }) {
  const [atEnd, setAtEnd] = useState(true);

  const play = () => {
    setAtEnd(false);
    // Two frames, so the dots are drawn at the start before the transition runs.
    requestAnimationFrame(() => requestAnimationFrame(() => setAtEnd(true)));
  };

  useEffect(() => {
    window.addEventListener(PLAY, play);
    return () => window.removeEventListener(PLAY, play);
  });

  const dot = (timing: string) => ({
    translate: atEnd ? "calc(100cqw - 100%) 0" : "0 0",
    transition: atEnd ? `translate ${duration}ms ${timing}` : "none",
  });

  return (
    <button
      type="button"
      onClick={play}
      aria-label={`Play ${label}`}
      className="@container relative block h-9 w-full rounded-full bg-sand px-2 hover:bg-rule/60"
    >
      <span className="absolute inset-x-2 top-2 block">
        <span
          className="block size-2.5 rounded-full bg-pink motion-reduce:transition-none!"
          style={dot(`var(--ease-${ease})`)}
        />
      </span>
      <span className="absolute inset-x-2 bottom-2 block">
        <span
          className="block size-2.5 rounded-full bg-muted-light motion-reduce:transition-none!"
          style={dot("linear")}
        />
      </span>
    </button>
  );
}

/** Runs every <PlayTrack> on the page, with a legend for the two dots. */
export function PlayAll() {
  return (
    <div className="doc-wide flex flex-wrap items-center gap-x-fl-24 gap-y-3">
      <DocButton on onClick={() => window.dispatchEvent(new Event(PLAY))}>
        Play all
      </DocButton>
      <span className="mono-label flex items-center gap-2 text-muted">
        <span className="size-2.5 rounded-full bg-pink" /> Curve
      </span>
      <span className="mono-label flex items-center gap-2 text-muted">
        <span className="size-2.5 rounded-full bg-muted-light" /> Linear
      </span>
    </div>
  );
}

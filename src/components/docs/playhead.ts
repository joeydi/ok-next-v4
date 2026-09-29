"use client";

import { useSyncExternalStore } from "react";

// The View transitions doc's shared clock, in ms from the start of a transition:
// <RevealPlayer> moves it, and the live <Timeline> and curve dots follow it. A store
// rather than context, so the blocks can sit apart in the MDX between prose.

/** Where the playhead rests before anything plays: partway, so the stills show a transition. */
export const INITIAL_MS = 240;

let ms = INITIAL_MS;
const listeners = new Set<() => void>();

export const playhead = {
  get: () => ms,
  set(next: number) {
    ms = next;
    for (const l of listeners) l();
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function usePlayhead() {
  return useSyncExternalStore(playhead.subscribe, playhead.get, () => INITIAL_MS);
}

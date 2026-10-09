import { track } from "@vercel/analytics";
import type { FailReason } from "./schema";

// The site check's custom events for Vercel Web Analytics. Properties are strings,
// numbers or booleans only; the visitor's email never goes in, and the site they
// checked goes in as its host.

type Events = {
  "Site check started": { host: string };
  "Site check invalid URL": Record<string, never>;
  "Site check completed": { host: string; score: number; seconds: number };
  "Site check failed": { host: string; reason: FailReason };
  "Site check review requested": { host: string; score: number | null };
  "Site check review failed": { host: string };
  "Site check booking opened": Record<string, never>;
};

export function trackSiteCheck<E extends keyof Events>(
  event: E,
  ...data: Events[E] extends Record<string, never> ? [] : [Events[E]]
) {
  track(event, data[0]);
}

"use client";

import { useEffect, useRef } from "react";
import type { BotCheck } from "@/lib/site-check/client";

// The page's side of the bot check: a Cloudflare Turnstile widget that only shows
// itself if Cloudflare wants a challenge solved, and a field only a bot fills in.
// Without NEXT_PUBLIC_TURNSTILE_SITE_KEY (local development) there's no widget and
// the token is null.

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
/** Longest to wait for a token, which a visible challenge can make slow. */
const WAIT_MS = 60_000;

type Turnstile = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  execute: (id: string) => void;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

let script: Promise<Turnstile> | undefined;

function load() {
  script ??= new Promise<Turnstile>((resolve, reject) => {
    const tag = document.createElement("script");
    tag.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    tag.async = true;
    tag.onload = () => resolve((window as unknown as { turnstile: Turnstile }).turnstile);
    tag.onerror = () => {
      script = undefined;
      reject(new Error("Turnstile didn’t load"));
    };
    document.head.append(tag);
  });
  return script;
}

/** `fields` goes inside the form; `check()` gives the fields to post with it. Tokens are single use, so call it once per request. */
export function useBotCheck() {
  const container = useRef<HTMLDivElement>(null);
  const trap = useRef<HTMLInputElement>(null);
  const widget = useRef<string>(undefined);
  const settle = useRef<(token: string | null) => void>(undefined);

  useEffect(
    () => () => {
      const id = widget.current;
      widget.current = undefined;
      if (id) load().then((api) => api.remove(id));
    },
    [],
  );

  const check = async (): Promise<BotCheck> => {
    const website = trap.current?.value ?? "";
    const el = container.current;
    if (!SITE_KEY || !el) return { token: null, website };
    let api: Turnstile;
    try {
      api = await load();
    } catch {
      return { token: null, website };
    }
    const token = await new Promise<string | null>((resolve) => {
      const timer = setTimeout(() => settle.current?.(null), WAIT_MS);
      settle.current = (value) => {
        clearTimeout(timer);
        settle.current = undefined;
        resolve(value);
      };
      if (widget.current === undefined) {
        widget.current = api.render(el, {
          sitekey: SITE_KEY,
          execution: "execute",
          appearance: "interaction-only",
          callback: (value: string) => settle.current?.(value),
          "error-callback": () => settle.current?.(null),
          "expired-callback": () => settle.current?.(null),
          "timeout-callback": () => settle.current?.(null),
        });
      } else {
        api.reset(widget.current);
      }
      api.execute(widget.current);
    });
    return { token, website };
  };

  const fields = (
    <>
      <input
        ref={trap}
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] size-px opacity-0"
      />
      <div ref={container} />
    </>
  );

  return { fields, check };
}

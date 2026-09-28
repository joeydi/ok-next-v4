"use client";

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { SITE } from "@/data/site";
import { cn } from "@/lib/cn";

/**
 * Link to the Calendly booking page that opens it in a modal instead. The page
 * is framed directly (no Calendly widget script); the iframe mounts on first
 * hover or focus so it's usually loaded by the click, then stays mounted so
 * reopening is instant. Modified clicks and no-JS still follow the link.
 */
export function BookingLink({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [src, setSrc] = useState<string>();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const warm = () => {
    if (src) return;
    const url = new URL(SITE.bookingUrl);
    url.searchParams.set("embed_domain", location.host);
    url.searchParams.set("embed_type", "PopupText");
    url.searchParams.set("hide_gdpr_banner", "1");
    // Colours only apply on paid Calendly plans; ignored otherwise.
    url.searchParams.set("background_color", "fbf9f6");
    url.searchParams.set("text_color", "1c1a17");
    url.searchParams.set("primary_color", "d4203f");
    setSrc(url.href);
  };

  const onClick = (e: MouseEvent) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    warm();
    setOpen(true);
  };

  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    dialog.showModal();
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = overflow;
      if (dialog.open) dialog.close();
    };
  }, [open]);

  return (
    <>
      <a
        href={SITE.bookingUrl}
        target="_blank"
        rel="noopener"
        onClick={onClick}
        onPointerEnter={warm}
        onFocus={warm}
        className={className}
      >
        {children}
      </a>
      {src && (
        <dialog
          ref={ref}
          aria-label="Book a 20-min call"
          onClose={() => setOpen(false)}
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
          className="m-auto h-[min(760px,100dvh-2rem)] max-h-none w-[min(1040px,100vw-2rem)] max-w-none overflow-visible border-0 bg-transparent p-0 opacity-0 transition-[opacity,translate,display,overlay] transition-discrete duration-300 ease-out backdrop:bg-ink/60 backdrop:opacity-0 backdrop:backdrop-blur-sm backdrop:transition-[opacity,display,overlay] backdrop:transition-discrete backdrop:duration-300 open:opacity-100 open:backdrop:opacity-100 translate-y-4 open:translate-y-0 starting:open:translate-y-4 starting:open:opacity-0 starting:open:backdrop:opacity-0 motion-reduce:transition-none motion-reduce:backdrop:transition-none"
        >
          {/* First in the dialog so showModal() focuses it, not the iframe — Esc only reaches the dialog from outside the frame. */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="absolute z-10 top-2 right-2 sm:-top-3 sm:-right-3 grid size-10 place-items-center rounded-full bg-ink text-paper shadow-md transition-colors hover:bg-ink-3"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
          <div className="frame relative size-full overflow-hidden bg-paper-light pb-9">
            {!loaded && (
              <p className="mono-label absolute inset-0 grid place-items-center text-muted" aria-live="polite">
                Loading…
              </p>
            )}
            <iframe
              src={src}
              title="Book a 20-min call"
              allow="payment"
              onLoad={() => setLoaded(true)}
              className={cn("relative size-full transition-opacity duration-300", !loaded && "opacity-0")}
            />
          </div>
        </dialog>
      )}
    </>
  );
}

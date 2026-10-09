"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const FALLBACK_HEIGHT = 480;

export function EmailHtmlPreview({ title, html }: { title: string; html: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const cleanup = useRef<(() => void) | null>(null);
  const [height, setHeight] = useState(FALLBACK_HEIGHT);

  const measure = useCallback(() => {
    const document = frame.current?.contentDocument;
    if (!document?.body) return;
    setHeight(Math.ceil(Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)));
  }, []);

  const watch = useCallback(() => {
    cleanup.current?.();
    measure();

    const document = frame.current?.contentDocument;
    if (!document?.body) return;

    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    observer.observe(document.documentElement);

    const images = [...document.images];
    for (const image of images) image.addEventListener("load", measure);
    cleanup.current = () => {
      observer.disconnect();
      for (const image of images) image.removeEventListener("load", measure);
    };
  }, [measure]);

  useEffect(() => () => cleanup.current?.(), []);

  return (
    <iframe
      ref={frame}
      title={title}
      srcDoc={html}
      sandbox="allow-same-origin"
      scrolling="no"
      onLoad={watch}
      style={{ height }}
      className="mt-fl-8 w-full rounded-md border border-rule bg-paper-light shadow-sm"
    />
  );
}

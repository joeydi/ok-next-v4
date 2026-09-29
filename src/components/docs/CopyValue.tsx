"use client";

import { type CSSProperties, type ReactNode, useState } from "react";
import { cn } from "@/lib/cn";

/** A button that copies `value` and says so for a moment. */
export function CopyValue({
  value,
  className,
  style,
  children,
}: {
  value: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={`Copy ${value}`}
      onClick={() =>
        navigator.clipboard.writeText(value).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          },
          () => {},
        )
      }
      className={cn("cursor-copy", className)}
      style={style}
    >
      {copied ? "Copied" : children}
    </button>
  );
}

/** Pink initials disc used for testimonials until real reviewer photos exist. */
export function Avatar({ initials }: { initials: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-12 shrink-0 items-center justify-center rounded-full bg-pink font-mono text-fl-14 tracking-label text-ink"
    >
      {initials}
    </span>
  );
}

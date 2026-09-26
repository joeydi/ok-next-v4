/* eslint-disable @next/next/no-img-element -- tiny SVG, no optimization needed */
export function Logo({ className = "" }: { className?: string }) {
  return <img src="/assets/okayplus.svg" alt="okayplus" width={120} height={28} className={`h-6 w-auto lg:h-7 brightness-0 ${className}`} />;
}

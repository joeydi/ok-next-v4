import type { Metadata } from "next";
import { AdminShell } from "../AdminShell";
import { LogoLab } from "./LogoLab";

// Dev-only (see pageExtensions in next.config.ts): the nav logo's dock swell
// at a few sizes, with its spring and falloff controls.

export const metadata: Metadata = { title: "Logo lab", robots: { index: false, follow: false } };

export default function LogoLabPage() {
  return (
    <AdminShell>
      <LogoLab />
    </AdminShell>
  );
}

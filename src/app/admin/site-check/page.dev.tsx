import type { Metadata } from "next";
import { AdminShell } from "../AdminShell";
import { SiteCheckAdmin } from "./SiteCheckAdmin";

// Dev-only (see pageExtensions in next.config.ts): review and edit every score
// and review-email message used by the Site Check flow.

export const metadata: Metadata = { title: "Site Check", robots: { index: false, follow: false } };

export default function SiteCheckAdminPage() {
  return (
    <AdminShell>
      <SiteCheckAdmin />
    </AdminShell>
  );
}

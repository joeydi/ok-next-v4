import type { Metadata } from "next";
import { ServicePage } from "@/components/ServicePage";
import { servicePages } from "@/data/services";
import { OPEN_GRAPH } from "@/lib/metadata";

const service = servicePages["design-development"];

export const metadata: Metadata = {
  title: service.metaTitle ?? service.title,
  description: service.metaDescription,
  alternates: { canonical: "/design-development" },
  openGraph: { ...OPEN_GRAPH, url: "/design-development" },
};

export default function Page() {
  return <ServicePage service={service} />;
}

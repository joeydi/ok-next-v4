import type { Metadata } from "next";
import { ServicePage } from "@/components/ServicePage";
import { servicePages } from "@/data/services";
import { OPEN_GRAPH } from "@/lib/metadata";

const service = servicePages["cms-integrations"];

export const metadata: Metadata = {
  title: service.metaTitle ?? service.title,
  description: service.metaDescription,
  alternates: { canonical: "/cms-integrations" },
  openGraph: { ...OPEN_GRAPH, url: "/cms-integrations" },
};

export default function Page() {
  return <ServicePage service={service} />;
}

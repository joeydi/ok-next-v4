import type { Metadata } from "next";
import { ServicePage } from "@/components/ServicePage";
import { servicePages } from "@/data/services";
import { OPEN_GRAPH } from "@/lib/metadata";

const service = servicePages["business-tools"];

export const metadata: Metadata = {
  title: service.metaTitle ?? service.title,
  description: service.metaDescription,
  alternates: { canonical: "/business-tools" },
  openGraph: { ...OPEN_GRAPH, url: "/business-tools" },
};

export default function Page() {
  return <ServicePage service={service} />;
}

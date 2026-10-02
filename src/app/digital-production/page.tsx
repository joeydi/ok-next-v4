import type { Metadata } from "next";
import { ServicePage } from "@/components/ServicePage";
import { services } from "@/data/services";
import { OPEN_GRAPH } from "@/lib/metadata";

const service = services["digital-production"];

export const metadata: Metadata = {
  title: service.title,
  description: service.metaDescription,
  alternates: { canonical: "/digital-production" },
  openGraph: { ...OPEN_GRAPH, url: "/digital-production" },
};

export default function Page() {
  return <ServicePage service={service} />;
}

import type { Metadata } from "next";
import { ServicePage } from "@/components/ServicePage";
import { services } from "@/data/services";
import { OPEN_GRAPH } from "@/lib/metadata";

const service = services["cms-integrations"];

export const metadata: Metadata = {
  title: service.title,
  description: service.metaDescription,
  alternates: { canonical: "/cms-integrations" },
  openGraph: { ...OPEN_GRAPH, url: "/cms-integrations" },
};

export default function Page() {
  return <ServicePage service={service} />;
}

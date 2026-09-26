import type { Metadata } from "next";
import { ServicePage } from "@/components/ServicePage";
import { services } from "@/data/services";

const service = services["creative-production"];

export const metadata: Metadata = {
  title: service.title,
  description: service.metaDescription,
  alternates: { canonical: "/creative-production" },
};

export default function Page() {
  return <ServicePage service={service} />;
}

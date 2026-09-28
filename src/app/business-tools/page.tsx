import type { Metadata } from "next";
import { ServicePage } from "@/components/ServicePage";
import { services } from "@/data/services";

const service = services["business-tools"];

export const metadata: Metadata = {
  title: service.title,
  description: service.metaDescription,
  alternates: { canonical: "/business-tools" },
};

export default function Page() {
  return <ServicePage service={service} />;
}

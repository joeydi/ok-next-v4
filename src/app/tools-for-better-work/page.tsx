import type { Metadata } from "next";
import { ServicePage } from "@/components/ServicePage";
import { services } from "@/data/services";

const service = services["tools-for-better-work"];

export const metadata: Metadata = {
  title: service.title,
  description: service.metaDescription,
  alternates: { canonical: "/tools-for-better-work" },
};

export default function Page() {
  return <ServicePage service={service} />;
}

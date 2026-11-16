import type { Metadata } from "next";
import { NotFoundView } from "@/components/layout/not-found-view";

export const metadata: Metadata = { title: "Sidan finns inte" };

export default function NotFound() {
  return <NotFoundView as="div" />;
}

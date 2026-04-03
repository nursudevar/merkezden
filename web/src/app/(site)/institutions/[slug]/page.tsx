import type { Metadata } from "next";
import DbInstitutionDetailClient from "./DbInstitutionDetailClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const trimmed = (slug ?? "").trim();
  if (!trimmed) {
    return { title: "Kurum Bulunamadı | Merkezden" };
  }
  return {
    title: "Kurum Detayı | Merkezden",
    description: "Kurum bilgileri ve iletişim.",
  };
}

export default async function InstitutionDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <DbInstitutionDetailClient slug={slug} />;
}

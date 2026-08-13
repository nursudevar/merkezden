import type { Metadata } from "next";
import {
  buildInstitutionMetaDescription,
  fetchApprovedInstitutionForMetadataServer,
} from "@/lib/seo/metadataServer";
import DbInstitutionDetailClient from "./DbInstitutionDetailClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const trimmed = (slug ?? "").trim();
  if (!trimmed) {
    return {
      title: "Kurum Bulunamadı | Merkezden",
      description: "Aradığınız kurum profili bulunamadı.",
    };
  }

  const row = await fetchApprovedInstitutionForMetadataServer(trimmed);
  if (!row) {
    return {
      title: "Kurum Bulunamadı | Merkezden",
      description: "Aradığınız kurum profili bulunamadı veya henüz yayında değil.",
    };
  }

  const name = String(row.institution_name ?? "").trim() || "Kurum";
  return {
    title: `${name} | Merkezden`,
    description: buildInstitutionMetaDescription(row),
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

import type { Metadata } from "next";
import {
  buildInstructorMetaDescription,
  fetchPublicInstructorForMetadataServer,
  publicInstructorDisplayName,
} from "@/lib/seo/metadataServer";
import DbInstructorDetailClient from "./DbInstructorDetailClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const trimmed = (slug ?? "").trim();
  if (!trimmed) {
    return {
      title: "Eğitmen Bulunamadı | Merkezden",
      description: "Aradığınız eğitmen profili bulunamadı.",
    };
  }

  const row = await fetchPublicInstructorForMetadataServer(trimmed);
  if (!row) {
    return {
      title: "Eğitmen Bulunamadı | Merkezden",
      description: "Aradığınız eğitmen profili bulunamadı veya henüz yayında değil.",
    };
  }

  const name = publicInstructorDisplayName(row);
  return {
    title: `${name} | Özel Ders ve Eğitim | Merkezden`,
    description: buildInstructorMetaDescription(row),
  };
}

export default async function InstructorDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <DbInstructorDetailClient slugOrId={slug} />;
}

import type { Metadata } from "next";
import DbInstructorDetailClient from "./DbInstructorDetailClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const trimmed = (slug ?? "").trim();
  if (!trimmed) {
    return { title: "Eğitmen Bulunamadı | Merkezden" };
  }
  return {
    title: "Eğitmen Profili | Merkezden",
    description: "Eğitmen bilgileri, özellikleri ve iletişim.",
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

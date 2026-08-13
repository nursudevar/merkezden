"use client";
import React from "react";
import Link from "next/link";
import Image from "next/image";
import "@/styles/pages/home.scss";

type BlogCardProps = {
  title: string;
  excerpt: string;
  imageUrl: string;
  slug: string;
  compact?: boolean;
};

export default function BlogCard({ title, excerpt, imageUrl, slug, compact = false }: BlogCardProps) {
  return (
    <Link href={`/blog-yazilari/${slug}`} className="blog-card-link">
      <article className={`blog-card-new${compact ? " blog-card-new--compact" : ""}`}>
        <div className="blog-card-image-wrapper">
          <Image
            src={imageUrl}
            alt={title}
            fill
            className="blog-card-image"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            unoptimized
          />
        </div>
        <div className="blog-card-content-new">
          <h3 className="blog-card-title-new">{title}</h3>
          <p className="blog-card-excerpt">{excerpt}</p>
        </div>
      </article>
    </Link>
  );
}


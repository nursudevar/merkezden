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
};

export default function BlogCard({ title, excerpt, imageUrl, slug }: BlogCardProps) {
  return (
    <Link href={`/blog/${slug}`} className="blog-card-link">
      <article className="blog-card-new">
        <div className="blog-card-image-wrapper">
          <Image
            src={imageUrl}
            alt={title}
            fill
            className="blog-card-image"
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
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


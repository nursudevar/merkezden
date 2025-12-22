"use client";
import React from "react";
import Link from "next/link";
import Image from "next/image";
import "@/styles/pages/blog.scss";

type FeaturedPostProps = {
  title: string;
  excerpt: string;
  imageUrl: string;
  slug: string;
  category?: string;
  author?: string;
  date?: string;
};

export default function FeaturedPost({
  title,
  excerpt,
  imageUrl,
  slug,
  category,
  author,
  date,
}: FeaturedPostProps) {
  return (
    <Link href={`/blog/${slug}`} className="featured-post-link">
      <article className="featured-post">
        <div className="featured-post-image-wrapper">
          <Image
            src={imageUrl}
            alt={title}
            fill
            className="featured-post-image"
            sizes="(max-width: 768px) 100vw, 50vw"
            priority
          />
          <div className="featured-post-badge">Öne Çıkan</div>
        </div>
        <div className="featured-post-content">
          {category && (
            <div className="featured-post-category">
              <span className="featured-post-category-dot" />
              <span>{category}</span>
            </div>
          )}
          <h2 className="featured-post-title">{title}</h2>
          <p className="featured-post-excerpt">{excerpt}</p>
          <div className="featured-post-meta">
            {author && (
              <div className="featured-post-author">
                <div className="featured-post-author-avatar" />
                <div>
                  <div className="featured-post-author-name">{author}</div>
                  {date && <div className="featured-post-date">{date}</div>}
                </div>
              </div>
            )}
            <Link href={`/blog/${slug}`} className="featured-post-read-more">
              Devamını Oku →
            </Link>
          </div>
        </div>
      </article>
    </Link>
  );
}


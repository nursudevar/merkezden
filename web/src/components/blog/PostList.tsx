"use client";
import React from "react";
import Link from "next/link";
import Image from "next/image";
import "@/styles/pages/blog.scss";

type Post = {
  title: string;
  excerpt: string;
  imageUrl: string;
  slug: string;
  category?: string;
  author?: string;
  date?: string;
};

type PostListProps = {
  posts: Post[];
};

export default function PostList({ posts }: PostListProps) {
  if (posts.length === 0) {
    return (
      <div className="blog-empty-state">
        <p>Bu kategoride henüz yazı bulunmamaktadır.</p>
      </div>
    );
  }

  return (
    <div className="blog-posts-list">
      {posts.map((post, index) => (
        <Link key={post.slug || index} href={`/blog/${post.slug}`} className="blog-list-item-link">
          <article className="blog-list-item">
            <div className="blog-list-item-image-wrapper">
              <Image
                src={post.imageUrl}
                alt={post.title}
                fill
                className="blog-list-item-image"
                sizes="(max-width: 768px) 100vw, 300px"
              />
            </div>
            <div className="blog-list-item-content">
              {post.category && (
                <div className="blog-list-item-category">{post.category}</div>
              )}
              <h3 className="blog-list-item-title">{post.title}</h3>
              <p className="blog-list-item-excerpt">{post.excerpt}</p>
              {(post.author || post.date) && (
                <div className="blog-list-item-meta">
                  {post.author && <span className="blog-list-item-author">{post.author}</span>}
                  {post.date && <span className="blog-list-item-date">{post.date}</span>}
                </div>
              )}
            </div>
          </article>
        </Link>
      ))}
    </div>
  );
}


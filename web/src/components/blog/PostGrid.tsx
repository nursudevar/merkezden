"use client";
import React from "react";
import BlogCard from "@/components/BlogCard";
import "@/styles/pages/blog.scss";

type Post = {
  title: string;
  excerpt: string;
  imageUrl: string;
  slug: string;
  category?: string;
};

type PostGridProps = {
  posts: Post[];
};

export default function PostGrid({ posts }: PostGridProps) {
  if (posts.length === 0) {
    return (
      <div className="blog-empty-state">
        <p>Bu kategoride henüz yazı bulunmamaktadır.</p>
      </div>
    );
  }

  return (
    <div className="blog-posts-grid">
      {posts.map((post, index) => (
        <BlogCard
          key={post.slug || index}
          title={post.title}
          excerpt={post.excerpt}
          imageUrl={post.imageUrl}
          slug={post.slug}
        />
      ))}
    </div>
  );
}


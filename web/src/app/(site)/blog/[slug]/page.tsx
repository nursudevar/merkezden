import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { getBlogPostBySlug } from "@/lib/data/blog";
import "@/styles/pages/blog.scss";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    return {
      title: "Yazı Bulunamadı | MERKEZDEN.COM",
    };
  }

  return {
    title: `${post.title} | MERKEZDEN.COM`,
    description: post.excerpt,
  };
}

function renderContentBlock(block: any, index: number) {
  switch (block.type) {
    case "paragraph":
      return (
        <p key={index} className="blog-post-paragraph">
          {block.text}
        </p>
      );
    case "h2":
      return (
        <h2 key={index} className="blog-post-heading-2">
          {block.text}
        </h2>
      );
    case "h3":
      return (
        <h3 key={index} className="blog-post-heading-3">
          {block.text}
        </h3>
      );
    case "list":
      return (
        <ul key={index} className="blog-post-list">
          {block.items.map((item: string, itemIndex: number) => (
            <li key={itemIndex} className="blog-post-list-item">
              {item}
            </li>
          ))}
        </ul>
      );
    case "quote":
      return (
        <blockquote key={index} className="blog-post-quote">
          <p className="blog-post-quote-text">"{block.text}"</p>
          {block.author && (
            <footer className="blog-post-quote-author">— {block.author}</footer>
          )}
        </blockquote>
      );
    default:
      return null;
  }
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    notFound();
  }

  return (
    <div className="blog-post-page">
      <div className="blog-post-container">
        <Link href="/blog" className="blog-post-back-link">
          <ArrowLeft size={20} />
          <span>Blog Yazılarına Dön</span>
        </Link>

        <div className="blog-post-category-wrapper">
          <div className="blog-post-category">
            <span className="blog-post-category-dot" />
            <span>{post.category}</span>
          </div>
        </div>

        <h1 className="blog-post-title">{post.title}</h1>

        <div className="blog-post-meta">
          <div className="blog-post-author">
            <div className="blog-post-author-avatar" />
            <div>
              <div className="blog-post-author-name">{post.authorName}</div>
              <div className="blog-post-date">{post.date}</div>
            </div>
          </div>
        </div>

        <div className="blog-post-cover-wrapper">
          <Image
            src={post.coverImage}
            alt={post.title}
            fill
            className="blog-post-cover-image"
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 90vw, 800px"
            priority
            unoptimized
          />
        </div>

        <article className="blog-post-content">
          {post.content.map((block, index) => renderContentBlock(block, index))}
        </article>
      </div>
    </div>
  );
}

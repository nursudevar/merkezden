import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { getBlogPostBySlug, type ContentBlock } from "@/lib/data/blog";
import { fetchPublishedBlogPostBySlugServer } from "@/lib/blog/blogServer";
import { mapPublishedPostToDisplay } from "@/lib/blog/blogDisplay";
import "@/styles/pages/blog.scss";

function renderContentBlock(block: ContentBlock, index: number) {
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
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex} className="blog-post-list-item">
              {item}
            </li>
          ))}
        </ul>
      );
    case "quote":
      return (
        <blockquote key={index} className="blog-post-quote">
          <p className="blog-post-quote-text">&quot;{block.text}&quot;</p>
          {block.author ? (
            <footer className="blog-post-quote-author">— {block.author}</footer>
          ) : null}
        </blockquote>
      );
    default:
      return null;
  }
}

function renderPlainTextContent(content: string) {
  const paragraphs = content
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (paragraphs.length === 0 && content.trim()) {
    return [
      <p key="single" className="blog-post-paragraph">
        {content.trim()}
      </p>,
    ];
  }

  return paragraphs.map((text, index) => (
    <p key={index} className="blog-post-paragraph">
      {text}
    </p>
  ));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const realPost = await fetchPublishedBlogPostBySlugServer(slug);
  if (realPost) {
    const displayPost = mapPublishedPostToDisplay(realPost);
    return {
      title: `${displayPost.title} | MERKEZDEN.COM`,
      description: displayPost.excerpt,
    };
  }

  const mockPost = getBlogPostBySlug(slug);
  if (!mockPost) {
    return {
      title: "Yazı Bulunamadı | MERKEZDEN.COM",
    };
  }

  return {
    title: `${mockPost.title} | MERKEZDEN.COM`,
    description: mockPost.excerpt,
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const realPost = await fetchPublishedBlogPostBySlugServer(slug);

  if (realPost) {
    const post = mapPublishedPostToDisplay(realPost);

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
              <span>{post.categoryName}</span>
            </div>
          </div>

          <h1 className="blog-post-title">{post.title}</h1>

          <div className="blog-post-meta">
            <div className="blog-post-author">
              <div className="blog-post-author-avatar" />
              <div>
                <div className="blog-post-author-name">{post.authorName}</div>
                <div className="blog-post-date">{post.publishedDate}</div>
              </div>
            </div>
          </div>

          {post.imageUrl ? (
            <div className="blog-post-cover-wrapper">
              <Image
                src={post.imageUrl}
                alt={post.title}
                fill
                className="blog-post-cover-image"
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 90vw, 800px"
                priority
                unoptimized
              />
            </div>
          ) : null}

          <article className="blog-post-content">{renderPlainTextContent(post.content)}</article>
        </div>
      </div>
    );
  }

  const mockPost = getBlogPostBySlug(slug);
  if (!mockPost) {
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
            <span>{mockPost.category}</span>
          </div>
        </div>

        <h1 className="blog-post-title">{mockPost.title}</h1>

        <div className="blog-post-meta">
          <div className="blog-post-author">
            <div className="blog-post-author-avatar" />
            <div>
              <div className="blog-post-author-name">{mockPost.authorName}</div>
              <div className="blog-post-date">{mockPost.date}</div>
            </div>
          </div>
        </div>

        <div className="blog-post-cover-wrapper">
          <Image
            src={mockPost.coverImage}
            alt={mockPost.title}
            fill
            className="blog-post-cover-image"
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 90vw, 800px"
            priority
            unoptimized
          />
        </div>

        <article className="blog-post-content">
          {mockPost.content.map((block, index) => renderContentBlock(block, index))}
        </article>
      </div>
    </div>
  );
}

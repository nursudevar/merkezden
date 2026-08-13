"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import BlogCard from "@/components/BlogCard";
import {
  fetchPublishedBlogPosts,
  mapMockPostToDisplay,
  mapPublishedPostToDisplay,
  mergeDisplayBlogPosts,
  type DisplayBlogPost,
} from "@/lib/blog/blogClient";
import { allBlogPosts } from "@/lib/data/blog";

const HOMEPAGE_BLOG_LIMIT = 6;

const mockDisplayPosts = allBlogPosts.map(mapMockPostToDisplay);

export function HomeBlogSection() {
  const [posts, setPosts] = useState<DisplayBlogPost[]>(() =>
    mergeDisplayBlogPosts([], mockDisplayPosts, HOMEPAGE_BLOG_LIMIT)
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const realRows = await fetchPublishedBlogPosts(HOMEPAGE_BLOG_LIMIT + 10);
        if (cancelled) return;
        const realPosts = realRows.map(mapPublishedPostToDisplay);
        setPosts(mergeDisplayBlogPosts(realPosts, mockDisplayPosts, HOMEPAGE_BLOG_LIMIT));
        setLoadError(false);
      } catch {
        if (!cancelled) {
          setPosts(mergeDisplayBlogPosts([], mockDisplayPosts, HOMEPAGE_BLOG_LIMIT));
          setLoadError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const cards = useMemo(
    () =>
      posts.map((post) => ({
        key: post.id,
        title: post.title,
        excerpt: post.excerpt,
        imageUrl: post.imageUrl,
        slug: post.slug,
      })),
    [posts]
  );

  return (
    <section className="blog-section">
      <div className="blog-section-header">
        <h2 className="blog-section-title">Blog Yazıları</h2>
        <p className="blog-section-subtitle">Uzmanlardan öneriler ve faydalı bilgiler</p>
      </div>

      {loading ? (
        <p className="blog-section-loading">Blog yazıları yükleniyor…</p>
      ) : null}
      {loadError ? (
        <p className="blog-section-loading">Güncel yazılar yüklenemedi. Örnek içerikler gösteriliyor.</p>
      ) : null}

      <div className="blog-section-grid">
        {cards.map((post) => (
          <BlogCard
            key={post.key}
            title={post.title}
            excerpt={post.excerpt}
            imageUrl={post.imageUrl}
            slug={post.slug}
            compact
          />
        ))}
      </div>

      <div className="blog-section-button-wrapper">
        <Link href="/blog-yazilari">
          <button type="button" className="blog-section-button">
            Daha fazlasını gör
          </button>
        </Link>
      </div>
    </section>
  );
}

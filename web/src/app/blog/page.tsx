"use client";
import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import Image from "next/image";
import { Grid3x3, List } from "lucide-react";
import BlogCard from "@/components/BlogCard";
import { allBlogPosts } from "@/lib/data/blog";
import "@/styles/main.scss";
import "@/styles/pages/home.scss";
import "@/styles/pages/blog.scss";

const allCategories = ["Hepsi", ...Array.from(new Set(allBlogPosts.map((post) => post.category)))];

function BlogPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedCategory, setSelectedCategory] = useState<string>("Hepsi");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Initialize from URL params
  useEffect(() => {
    const categoryParam = searchParams.get("category");
    const viewParam = searchParams.get("view");

    if (categoryParam && allCategories.includes(categoryParam)) {
      setSelectedCategory(categoryParam);
    }

    if (viewParam === "list" || viewParam === "grid") {
      setViewMode(viewParam);
    } else {
      // Try to get from localStorage
      const savedView = localStorage.getItem("blogViewMode");
      if (savedView === "list" || savedView === "grid") {
        setViewMode(savedView);
      }
    }
  }, [searchParams]);

  // Update URL when category or view changes
  const updateURL = (category: string, view: "grid" | "list") => {
    const params = new URLSearchParams();
    if (category !== "Hepsi") {
      params.set("category", category);
    }
    if (view !== "grid") {
      params.set("view", view);
    }
    const queryString = params.toString();
    router.push(queryString ? `/blog?${queryString}` : "/blog", { scroll: false });
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    updateURL(category, viewMode);
  };

  const handleViewChange = (view: "grid" | "list") => {
    setViewMode(view);
    localStorage.setItem("blogViewMode", view);
    updateURL(selectedCategory, view);
  };

  // Filter posts based on selected category
  const filteredPosts = useMemo(() => {
    if (selectedCategory === "Hepsi") {
      return allBlogPosts;
    }
    return allBlogPosts.filter((post) => post.category === selectedCategory);
  }, [selectedCategory]);

  // Get featured post (first featured post in filtered results, or first post if none featured)
  const featuredPost = useMemo(() => {
    const featured = filteredPosts.find((post) => post.featured);
    return featured || filteredPosts[0];
  }, [filteredPosts]);

  // Get remaining posts (excluding featured)
  const remainingPosts = useMemo(() => {
    if (!featuredPost) return filteredPosts;
    return filteredPosts.filter((post) => post.slug !== featuredPost.slug);
  }, [filteredPosts, featuredPost]);

  return (
    <div className="page-container">
      <div className="top-bar" />
      <header className="header">
        <div className="header-container">
          <div className="header-brand">
            <Link href="/" className="header-title-link">
              <span className="header-title">MERKEZDEN.COM</span>
            </Link>
            <span className="header-subtitle">HAYATIN MERKEZİ</span>
          </div>
          <div className="header-actions">
            <Link href="/login">
              <Button className="button-primary btn-gradient-primary" variant="default">
                GİRİŞ YAP
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="main-content">
        <div className="blog-listing-page">
          <div className="blog-listing-header">
            <h1 className="blog-listing-title">Blog Yazıları</h1>
            <p className="blog-listing-subtitle">
              Öğretmenler, öğrenciler ve eğitimciler için en güncel trendler, pedagojik ipuçları ve detaylı analizler.
            </p>
          </div>

          <CategoryTabs
            categories={allCategories}
            selectedCategory={selectedCategory}
            onCategoryChange={handleCategoryChange}
          />

          {featuredPost && (
            <div className="blog-featured-section">
              <FeaturedPost
                title={featuredPost.title}
                excerpt={featuredPost.excerpt}
                imageUrl={featuredPost.coverImage}
                slug={featuredPost.slug}
                category={featuredPost.category}
                author={featuredPost.authorName}
                date={featuredPost.date}
              />
            </div>
          )}

          <div className="blog-posts-section">
            <div className="blog-posts-section-header">
              <h2 className="blog-posts-section-title">Son Yazılar</h2>
              <ViewToggle view={viewMode} onViewChange={handleViewChange} />
            </div>

            {viewMode === "grid" ? (
              <PostGrid posts={remainingPosts} />
            ) : (
              <PostList posts={remainingPosts} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function BlogPage() {
  return (
    <Suspense fallback={
      <div className="page-container">
        <div className="top-bar" />
        <header className="header">
          <div className="header-container">
            <div className="header-brand">
              <Link href="/" className="header-title-link">
                <span className="header-title">MERKEZDEN.COM</span>
              </Link>
              <span className="header-subtitle">HAYATIN MERKEZİ</span>
            </div>
          </div>
        </header>
        <main className="main-content">
          <div className="blog-listing-page">
            <div className="blog-listing-header">
              <h1 className="blog-listing-title">Blog Yazıları</h1>
              <p className="blog-listing-subtitle">Yükleniyor...</p>
            </div>
          </div>
        </main>
      </div>
    }>
      <BlogPageContent />
    </Suspense>
  );
}

// Blog Components (inline for blog page only)
type FeaturedPostProps = {
  title: string;
  excerpt: string;
  imageUrl: string;
  slug: string;
  category?: string;
  author?: string;
  date?: string;
};

function FeaturedPost({
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
            unoptimized
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
            <span className="featured-post-read-more">
              Devamını Oku →
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}

type CategoryTabsProps = {
  categories: string[];
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
};

function CategoryTabs({
  categories,
  selectedCategory,
  onCategoryChange,
}: CategoryTabsProps) {
  return (
    <div className="blog-category-tabs">
      {categories.map((category) => (
        <button
          key={category}
          type="button"
          className={`blog-category-tab ${selectedCategory === category ? "blog-category-tab--active" : ""}`}
          onClick={() => onCategoryChange(category)}
          aria-pressed={selectedCategory === category}
        >
          {category}
        </button>
      ))}
    </div>
  );
}

type ViewToggleProps = {
  view: "grid" | "list";
  onViewChange: (view: "grid" | "list") => void;
};

function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  return (
    <div className="blog-view-toggle">
      <button
        type="button"
        className={`blog-view-toggle-btn ${view === "grid" ? "blog-view-toggle-btn--active" : ""}`}
        onClick={() => onViewChange("grid")}
        aria-label="Grid görünümü"
        aria-pressed={view === "grid"}
      >
        <Grid3x3 size={20} />
      </button>
      <button
        type="button"
        className={`blog-view-toggle-btn ${view === "list" ? "blog-view-toggle-btn--active" : ""}`}
        onClick={() => onViewChange("list")}
        aria-label="Liste görünümü"
        aria-pressed={view === "list"}
      >
        <List size={20} />
      </button>
    </div>
  );
}

type Post = {
  title: string;
  excerpt: string;
  coverImage: string;
  slug: string;
  category?: string;
};

type PostGridProps = {
  posts: Post[];
};

function PostGrid({ posts }: PostGridProps) {
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
          imageUrl={post.coverImage}
          slug={post.slug}
        />
      ))}
    </div>
  );
}

type PostListProps = {
  posts: Post[];
};

function PostList({ posts }: PostListProps) {
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
                src={post.coverImage}
                alt={post.title}
                fill
                className="blog-list-item-image"
                sizes="(max-width: 768px) 100vw, 300px"
                unoptimized
              />
            </div>
            <div className="blog-list-item-content">
              {post.category && (
                <div className="blog-list-item-category">{post.category}</div>
              )}
              <h3 className="blog-list-item-title">{post.title}</h3>
              <p className="blog-list-item-excerpt">{post.excerpt}</p>
              {(post as any).author || (post as any).date ? (
                <div className="blog-list-item-meta">
                  {(post as any).author && <span className="blog-list-item-author">{(post as any).author}</span>}
                  {(post as any).date && <span className="blog-list-item-date">{(post as any).date}</span>}
                </div>
              ) : null}
            </div>
          </article>
        </Link>
      ))}
    </div>
  );
}

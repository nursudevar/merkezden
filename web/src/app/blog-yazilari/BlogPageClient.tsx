"use client";
import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Grid3x3, List } from "lucide-react";
import BlogCard from "@/components/BlogCard";
import { HeaderClientWrapper } from "@/components/layout/header.client";
import {
  fetchPublishedBlogPosts,
  mapMockPostToDisplay,
  mapPublishedPostToDisplay,
  mergeDisplayBlogPosts,
  type DisplayBlogPost,
} from "@/lib/blog/blogClient";
import { allBlogPosts } from "@/lib/data/blog";
import {
  buildCategoryTabNames,
  fetchActiveInstitutionCategories,
} from "@/lib/categoryHelpers";
import "@/styles/main.scss";
import "@/styles/pages/home.scss";
import "@/styles/pages/blog.scss";

const mockDisplayPosts = allBlogPosts.map(mapMockPostToDisplay);
const BLOG_CATEGORY_TABS_FALLBACK = [
  "Hepsi",
  "Okul",
  "Kurs & Sınava Hazırlık",
  "Spor",
  "Sanat",
  "Yabancı Dil",
  "Kişisel Gelişim",
  "Mesleki Eğitim",
  "Özel Eğitim",
  "Sürücü Kursu",
  "Patili Dostlar",
] as const;
const CATEGORY_TAB_FIRST_ROW_COUNT = 7;

function normalizeCategoryName(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/&/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function categoryMatches(postCategory: string, selectedCategory: string): boolean {
  const postKey = normalizeCategoryName(postCategory);
  const selectedKey = normalizeCategoryName(selectedCategory);
  if (postKey === selectedKey) return true;
  if (selectedKey === "kurs sinava hazirlik") {
    return postKey === "kurs sinav" || postKey === "kurs ve sinav" || postKey === "sinava hazirlik";
  }
  return false;
}

function toListingPost(post: DisplayBlogPost): ListingPost {
  return {
    title: post.title,
    excerpt: post.excerpt,
    coverImage: post.imageUrl,
    slug: post.slug,
    category: post.categoryName,
    author: post.authorName,
    date: post.publishedDate,
  };
}

function BlogPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [displayPosts, setDisplayPosts] = useState<DisplayBlogPost[]>(() =>
    mergeDisplayBlogPosts([], mockDisplayPosts)
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("Hepsi");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [allCategories, setAllCategories] = useState<string[]>([...BLOG_CATEGORY_TABS_FALLBACK]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const categories = await fetchActiveInstitutionCategories();
      if (cancelled) return;
      setAllCategories(buildCategoryTabNames(categories, BLOG_CATEGORY_TABS_FALLBACK));
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const realRows = await fetchPublishedBlogPosts();
        if (cancelled) return;
        const realPosts = realRows.map(mapPublishedPostToDisplay);
        setDisplayPosts(mergeDisplayBlogPosts(realPosts, mockDisplayPosts));
        setLoadError(false);
      } catch {
        if (!cancelled) {
          setDisplayPosts(mergeDisplayBlogPosts([], mockDisplayPosts));
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

  useEffect(() => {
    const categoryParam = searchParams.get("category");
    const viewParam = searchParams.get("view");

    if (categoryParam && allCategories.includes(categoryParam)) {
      setSelectedCategory(categoryParam);
    }

    if (viewParam === "list" || viewParam === "grid") {
      setViewMode(viewParam);
    } else {
      const savedView = localStorage.getItem("blogViewMode");
      if (savedView === "list" || savedView === "grid") {
        setViewMode(savedView);
      }
    }
  }, [searchParams, allCategories]);

  const updateURL = (category: string, view: "grid" | "list") => {
    const params = new URLSearchParams();
    if (category !== "Hepsi") {
      params.set("category", category);
    }
    if (view !== "grid") {
      params.set("view", view);
    }
    const queryString = params.toString();
    router.push(queryString ? `/blog-yazilari?${queryString}` : "/blog-yazilari", { scroll: false });
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

  const filteredPosts = useMemo(() => {
    if (selectedCategory === "Hepsi") {
      return displayPosts;
    }
    return displayPosts.filter((post) => categoryMatches(post.categoryName, selectedCategory));
  }, [displayPosts, selectedCategory]);

  const listingPosts = useMemo(
    () => filteredPosts.map(toListingPost),
    [filteredPosts],
  );

  return (
    <div className="page-container">
      <HeaderClientWrapper />

      <main className="main-content">
        <div className="blog-listing-page">
          <CategoryTabs
            categories={allCategories}
            selectedCategory={selectedCategory}
            onCategoryChange={handleCategoryChange}
          />

          {loading ? (
            <p className="blog-listing-loading">Blog yazıları yükleniyor…</p>
          ) : null}
          {loadError ? (
            <p className="blog-listing-loading">Güncel yazılar yüklenemedi. Örnek içerikler gösteriliyor.</p>
          ) : null}

          <div className="blog-featured-section">
            <BlogSubmitCtaBanner />
          </div>

          <div className="blog-posts-section">
            <div className="blog-posts-section-toolbar">
              <ViewToggle view={viewMode} onViewChange={handleViewChange} />
            </div>

            {viewMode === "grid" ? (
              <PostGrid posts={listingPosts} />
            ) : (
              <PostList posts={listingPosts} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function BlogPageClient() {
  return (
    <Suspense fallback={
      <div className="page-container">
        <HeaderClientWrapper />
        <main className="main-content">
          <div className="blog-listing-page">
            <p className="blog-listing-loading">Blog yazıları yükleniyor…</p>
          </div>
        </main>
      </div>
    }>
      <BlogPageContent />
    </Suspense>
  );
}

function BlogSubmitCtaBanner() {
  return (
    <section className="blog-submit-cta" aria-labelledby="blog-submit-cta-title">
      <span className="blog-submit-cta-glow" aria-hidden="true" />
      <span className="blog-submit-cta-orb blog-submit-cta-orb--one" aria-hidden="true" />
      <span className="blog-submit-cta-orb blog-submit-cta-orb--two" aria-hidden="true" />
      <div className="blog-submit-cta-content">
        <h2 id="blog-submit-cta-title" className="blog-submit-cta-title">
          Siz de bize blog yazıp gönderebilirsiniz!
        </h2>
        <p className="blog-submit-cta-subtitle">
          Bilginizi ve deneyiminizi Merkezden topluluğuyla paylaşın.
        </p>
        <Link href="/profil#my-blogs" className="blog-submit-cta-button">
          Blog Yazısı Gönder
        </Link>
      </div>
    </section>
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
  const categoryRows = [
    categories.slice(0, CATEGORY_TAB_FIRST_ROW_COUNT),
    categories.slice(CATEGORY_TAB_FIRST_ROW_COUNT),
  ];

  return (
    <div className="blog-category-tabs">
      {categoryRows.map((row, rowIndex) => (
        <div key={`blog-category-row-${rowIndex}`} className="blog-category-tab-row">
          {row.map((category) => (
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

type ListingPost = {
  title: string;
  excerpt: string;
  coverImage: string;
  slug: string;
  category?: string;
  author?: string;
  date?: string;
};

type PostGridProps = {
  posts: ListingPost[];
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
  posts: ListingPost[];
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
        <Link key={post.slug || index} href={`/blog-yazilari/${post.slug}`} className="blog-list-item-link">
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
              {post.author || post.date ? (
                <div className="blog-list-item-meta">
                  {post.author ? <span className="blog-list-item-author">{post.author}</span> : null}
                  {post.date ? <span className="blog-list-item-date">{post.date}</span> : null}
                </div>
              ) : null}
            </div>
          </article>
        </Link>
      ))}
    </div>
  );
}

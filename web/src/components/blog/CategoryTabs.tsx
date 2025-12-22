"use client";
import React from "react";
import "@/styles/pages/blog.scss";

type CategoryTabsProps = {
  categories: string[];
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
};

export default function CategoryTabs({
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


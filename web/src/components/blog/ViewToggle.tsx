"use client";
import React from "react";
import { Grid3x3, List } from "lucide-react";
import "@/styles/pages/blog.scss";

type ViewToggleProps = {
  view: "grid" | "list";
  onViewChange: (view: "grid" | "list") => void;
};

export default function ViewToggle({ view, onViewChange }: ViewToggleProps) {
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


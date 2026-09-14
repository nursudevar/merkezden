"use client";

type BlogSearchProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export default function BlogSearch({
  value,
  onChange,
  placeholder = "Blog yazılarında ara...",
  className = "",
}: BlogSearchProps) {
  return (
    <div className={["blog-search", className].filter(Boolean).join(" ")}>
      <div className="blog-search-shell">
        {/* eslint-disable-next-line @next/next/no-img-element -- static search icon asset */}
        <img
          src="/images/search-icon.png"
          alt=""
          aria-hidden
          className="blog-search-icon"
        />
        <input
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="blog-search-input"
          aria-label="Blog yazılarında ara"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
    </div>
  );
}

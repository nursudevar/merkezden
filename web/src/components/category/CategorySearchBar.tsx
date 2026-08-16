"use client";

import { useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import { Input } from "@/components/ui";

interface CategorySearchBarProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
}

export default function CategorySearchBar({
  searchValue,
  onSearchChange,
}: CategorySearchBarProps) {
  const isControlledSearch = typeof onSearchChange === "function";
  const [internalSearch, setInternalSearch] = useState("");
  const search = isControlledSearch ? (searchValue ?? "") : internalSearch;

  const handleSearchChange = (value: string) => {
    if (isControlledSearch) onSearchChange?.(value);
    else setInternalSearch(value);
  };

  return (
    <div className="category-search-bar">
      <div className="category-search-bar-container">
        <div className="category-search-bar-content">
          <div className="category-search-input-wrapper">
            <SearchIcon className="category-search-icon" size={20} />
            <Input
              type="text"
              placeholder="Kurum adı veya bölge ara..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="category-search-input"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

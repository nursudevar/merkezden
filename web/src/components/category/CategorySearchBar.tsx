"use client";

import { useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";

interface CategorySearchBarProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  selectedDistrict?: string;
  onDistrictChange?: (value: string) => void;
  districts?: string[];
}

const ALL_DISTRICTS_VALUE = "__all__";

export default function CategorySearchBar({
  searchValue,
  onSearchChange,
  selectedDistrict,
  onDistrictChange,
  districts = [],
}: CategorySearchBarProps) {
  const isControlledSearch = typeof onSearchChange === "function";
  const isControlledDistrict = typeof onDistrictChange === "function";

  const [internalSearch, setInternalSearch] = useState("");
  const [internalDistrict, setInternalDistrict] = useState<string>("");

  const search = isControlledSearch ? (searchValue ?? "") : internalSearch;
  const district = isControlledDistrict ? (selectedDistrict ?? "") : internalDistrict;

  const handleSearchChange = (value: string) => {
    if (isControlledSearch) onSearchChange?.(value);
    else setInternalSearch(value);
  };

  const handleDistrictChange = (value: string) => {
    const next = value === ALL_DISTRICTS_VALUE ? "" : value;
    if (isControlledDistrict) onDistrictChange?.(next);
    else setInternalDistrict(next);
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

          <Select value="ankara" disabled>
            <SelectTrigger className="category-search-select" aria-label="İl: Ankara">
              <SelectValue placeholder="Ankara" />
            </SelectTrigger>
            <SelectContent className="select-content category-search-select-popper">
              <SelectItem value="ankara" className="select-item">
                Ankara
              </SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={district ? district : ALL_DISTRICTS_VALUE}
            onValueChange={handleDistrictChange}
          >
            <SelectTrigger className="category-search-select" aria-label="İlçe">
              <SelectValue placeholder="Tüm İlçeler" />
            </SelectTrigger>
            <SelectContent className="select-content category-search-select-popper">
              <SelectItem value={ALL_DISTRICTS_VALUE} className="select-item">
                Tüm İlçeler
              </SelectItem>
              {districts.map((d) => (
                <SelectItem key={d} value={d} className="select-item">
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

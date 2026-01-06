"use client";

import { useState } from "react";
import { Search as SearchIcon, SlidersHorizontal } from "lucide-react";
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Button } from "@/components/ui";

export default function CategorySearchBar() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState<string | undefined>(undefined);
  const [selectedEducationType, setSelectedEducationType] = useState<string | undefined>(undefined);

  const cities = [
    "Tüm İller",
    "Ankara",
    "İstanbul",
    "İzmir",
    "Bursa",
    "Antalya",
  ];

  const educationTypes = [
    "Eğitim Türü",
    "Online",
    "Yüz Yüze",
  ];

  return (
    <div className="category-search-bar">
      <div className="category-search-bar-container">
        <div className="category-search-bar-content">
          <div className="category-search-input-wrapper">
            <SearchIcon className="category-search-icon" size={20} />
            <Input
              type="text"
              placeholder="Kurum adı veya bölge ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="category-search-input"
            />
          </div>
          
          <Select value={selectedCity} onValueChange={setSelectedCity}>
            <SelectTrigger className="category-search-select">
              <SelectValue placeholder="Tüm İller" />
            </SelectTrigger>
            <SelectContent className="select-content">
              {cities.map((city) => (
                <SelectItem key={city} value={city === "Tüm İller" ? "all" : city.toLowerCase()} className="select-item">
                  {city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedEducationType} onValueChange={setSelectedEducationType}>
            <SelectTrigger className="category-search-select">
              <SelectValue placeholder="Eğitim Türü" />
            </SelectTrigger>
            <SelectContent className="select-content">
              {educationTypes.map((type) => (
                <SelectItem key={type} value={type === "Eğitim Türü" ? "all" : type.toLowerCase()} className="select-item">
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" className="category-search-filters-btn">
            <SlidersHorizontal size={18} />
            <span>Filtreler</span>
          </Button>

          <Button className="category-search-submit-btn">
            Ara
          </Button>
        </div>
      </div>
    </div>
  );
}


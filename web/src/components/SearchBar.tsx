"use client";

import { Input } from "@/components/ui";
import { Button } from "@/components/ui";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  buttonText?: string;
  className?: string;
  inputClassName?: string;
  buttonClassName?: string;
}

export default function SearchBar({
  value,
  onChange,
  placeholder = "Örnek: Kadıköy'de çocuğum için yüzme kursu arıyorum",
  buttonText = "🔍 ARA",
  className = "",
  inputClassName = "",
  buttonClassName = "",
}: SearchBarProps) {
  return (
    <div className={`search-bar-wrapper ${className}`}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`search-bar-input ${inputClassName}`}
      />
      <Button className={`search-bar-button ${buttonClassName}`}>
        {buttonText}
      </Button>
    </div>
  );
}


"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SignupCategorySelectOption = {
  id: number;
  name: string;
};

type SignupCategorySelectProps = {
  id: string;
  value: string;
  onChange: (categoryId: string) => void;
  options: SignupCategorySelectOption[];
  placeholder?: string;
  disabled?: boolean;
  hasError?: boolean;
};

export function SignupCategorySelect({
  id,
  value,
  onChange,
  options,
  placeholder = "Kategori seçin",
  disabled = false,
  hasError = false,
}: SignupCategorySelectProps) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        id={id}
        className={`signup-category-select-trigger${hasError ? " signup-category-select-trigger--error" : ""}`}
        aria-label="Kategori seçin"
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent
        className="signup-category-select-content"
        position="popper"
        side="bottom"
        sideOffset={6}
        align="start"
      >
        {options.map((category) => (
          <SelectItem
            key={category.id}
            value={String(category.id)}
            className="signup-category-select-item"
          >
            {category.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

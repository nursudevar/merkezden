"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import '@/styles/pages/category.scss';

const categoryRoutes: Record<string, string> = {
  "Okul": "/school",
  "Kurs & Sınava Hazırlık": "/courses-exams",
  "Spor": "/sports",
  "Sanat": "/arts",
  "Yabancı Dil": "/languages",
  "Kişisel Gelişim": "/personal-development",
  "Mesleki Eğitim": "/vocational-training",
  "Özel Eğitim": "/special-education",
};

const categories = [
  "Okul",
  "Kurs & Sınava Hazırlık",
  "Spor",
  "Sanat",
  "Yabancı Dil",
  "Kişisel Gelişim",
  "Mesleki Eğitim",
  "Özel Eğitim",
];

function CategoryPills() {
  const pathname = usePathname();

  return (
    <div className="main-categories-pills">
      {categories.map((category) => {
        const route = categoryRoutes[category];
        const isActive = pathname === route;

        return (
          <Link
            key={category}
            href={route}
            className={`main-category-pill ${isActive ? "main-category-pill--active" : ""}`}
          >
            {category}
          </Link>
        );
      })}
    </div>
  );
}

export default function CoursesExamsPage() {
  return (
    <div className="category-page-container">
      <div className="category-page-content">
        <h1 className="category-page-title">Kurs & Sınava Hazırlık</h1>
        <CategoryPills />
        <div className="category-page-filters">
          <p>Filtreler buraya gelecek</p>
        </div>
        <div className="category-page-results">
          <p>Sonuçlar buraya gelecek</p>
        </div>
      </div>
    </div>
  );
}


"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

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

export default function CategoryPills() {
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


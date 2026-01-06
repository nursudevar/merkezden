import '@/styles/pages/category.scss';
import CategoryPills from '@/components/CategoryPills';

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


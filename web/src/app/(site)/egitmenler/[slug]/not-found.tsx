import Link from "next/link";

export default function InstructorDetailNotFound() {
  return (
    <div className="instructor-detail-page">
      <div className="instructor-detail-container">
        <h1 className="instructor-name">Eğitmen Bulunamadı</h1>
        <p>Aradığınız eğitmen profili bulunamadı veya yayında değil.</p>
        <p>
          <Link href="/">Ana sayfaya dön</Link>
        </p>
      </div>
    </div>
  );
}

import Link from "next/link";
import MekoChromaVideo from "@/components/MekoChromaVideo";

const DRIVING_SCHOOLS_HREF = "/surucu-kursu";

export function HomeDrivingSchoolsSection() {
  return (
    <section className="home-driving-schools-section" aria-labelledby="home-driving-schools-title">
      <div className="home-driving-schools-header driver-courses-content">
        <div className="home-driving-schools-header-main">
          <div className="home-driving-schools-header-text">
            <h2
              className="home-driving-schools-title driver-courses-title"
              id="home-driving-schools-title"
            >
              Sürücü Kursları
            </h2>
            <p className="driver-courses-subtitle">
              Sana en uygun sürücü kursunu keşfet, eğitim seçeneklerini karşılaştır ve yola güvenle
              başla.
            </p>
            <Link href={DRIVING_SCHOOLS_HREF} className="driver-courses-link">
              Sürücü Kurslarını Keşfet
            </Link>
          </div>
        </div>
      </div>

      <div className="home-driving-schools-media" aria-hidden="true">
        <div className="home-driving-schools-meko-track">
          <MekoChromaVideo
            src="/gifs/surucu_meko.mp4"
            className="home-driving-schools-meko-video"
            ariaLabel="Sürücü kursları Meko animasyonu"
            threshold={18}
          />
        </div>
      </div>
    </section>
  );
}

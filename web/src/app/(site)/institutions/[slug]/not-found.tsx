import Link from "next/link";
import { Button } from "@/components/ui";

export default function InstitutionNotFound() {
  return (
    <div className="institution-not-found">
      <div className="institution-not-found-container">
        <h1 className="institution-not-found-title">Kurum Bulunamadı</h1>
        <p className="institution-not-found-description">
          Aradığınız kurum bulunamadı veya kaldırılmış olabilir.
        </p>
        <Link href="/">
          <Button variant="default">Ana Sayfaya Dön</Button>
        </Link>
      </div>
    </div>
  );
}

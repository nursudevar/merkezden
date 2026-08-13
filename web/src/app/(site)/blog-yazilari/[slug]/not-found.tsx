import Link from "next/link";
import { Button } from "@/components/ui";
import "@/styles/pages/blog.scss";

export default function BlogPostNotFound() {
  return (
    <div className="blog-post-not-found">
      <div className="blog-post-not-found-container">
        <h1 className="blog-post-not-found-title">Yazı Bulunamadı</h1>
        <p className="blog-post-not-found-message">
          Aradığınız blog yazısı bulunamadı. Yazı silinmiş veya taşınmış olabilir.
        </p>
        <Link href="/blog-yazilari">
          <Button className="button-primary btn-gradient-primary" variant="default">
            Blog Yazılarına Dön
          </Button>
        </Link>
      </div>
    </div>
  );
}

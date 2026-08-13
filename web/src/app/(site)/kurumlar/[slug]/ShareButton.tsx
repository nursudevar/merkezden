"use client";

import { Button } from "@/components/ui";
import { Share2 } from "lucide-react";
import { useState } from "react";

export default function ShareButton({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    try {
      const url = `${window.location.origin}/kurumlar/${slug}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Link kopyalanamadı:", err);
    }
  };

  return (
    <Button
      variant="outline"
      size="icon"
      className={`institution-share-button ${copied ? "institution-share-copied" : ""}`}
      onClick={handleShare}
      aria-label={copied ? "Link kopyalandı" : "Sayfayı paylaş"}
    >
      <Share2 size={18} />
      {copied && <span className="institution-share-tooltip">Kopyalandı!</span>}
    </Button>
  );
}

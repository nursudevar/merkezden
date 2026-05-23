"use client";

import { Button } from "@/components/ui";
import { Share2 } from "lucide-react";
import { useState } from "react";

export default function InstructorShareButton({ slugOrId }: { slugOrId: string }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    try {
      const url = `${window.location.origin}/egitmenler/${encodeURIComponent(slugOrId)}`;
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
      className={`instructor-share-button ${copied ? "instructor-share-copied" : ""}`}
      onClick={() => void handleShare()}
      aria-label={copied ? "Link kopyalandı" : "Sayfayı paylaş"}
    >
      <Share2 size={18} />
      {copied ? <span className="instructor-share-tooltip">Kopyalandı!</span> : null}
    </Button>
  );
}

import type { PublicHighlightDisplayItem } from "@/lib/featureHighlightsPublic";

export function FeatureHighlightsPublicSection({
  items,
}: {
  items: PublicHighlightDisplayItem[];
}) {
  if (items.length === 0) return null;

  return (
    <section className="feature-highlights-public" aria-label="Öne Çıkan Özellikler">
      <h2 className="feature-highlights-public-title">Öne Çıkan Özellikler</h2>
      <ul className="feature-highlights-public-list">
        {items.map((item) => {
          const fullText = item.value ? `${item.label}: ${item.value}` : item.label;
          return (
            <li key={item.identity} className="feature-highlights-public-item">
              <img
                src="/images/highlights.png"
                alt=""
                className="feature-highlights-public-icon"
              />
              <p className="feature-highlights-public-text" data-tooltip-text={fullText}>
                <span className="feature-highlights-public-label">
                  {item.value ? `${item.label}:` : item.label}
                </span>
                {item.value ? (
                  <span className="feature-highlights-public-value"> {item.value}</span>
                ) : null}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

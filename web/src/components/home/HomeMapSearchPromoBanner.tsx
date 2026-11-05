import Link from "next/link";

const MAP_SEARCH_HREF = "/haritada-ara";

export function HomeMapSearchPromoBanner() {
  return (
    <section className="home-map-search-promo" aria-labelledby="home-map-search-promo-title">
      {/* eslint-disable-next-line @next/next/no-img-element -- local static promo icon */}
      <img
        src="/images/map-icon.png"
        alt=""
        aria-hidden
        className="home-map-search-promo-icon"
      />
      <div className="home-map-search-promo-copy">
        <h2 className="home-map-search-promo-title" id="home-map-search-promo-title">
          Haritada Ara
        </h2>
        <p className="home-map-search-promo-desc">
          Yakınındaki kurumları ve eğitmenleri harita üzerinde keşfet, konumuna uygun seçenekleri
          hemen gör.
        </p>
      </div>
      <Link
        href={MAP_SEARCH_HREF}
        target="_blank"
        rel="noopener noreferrer"
        className="home-map-search-promo-cta"
      >
        Haritada Ara
      </Link>
    </section>
  );
}

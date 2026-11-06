import {
  fetchPublicPlacementKey,
  fetchPublishedAds,
  getAdvertisementMediaPublicUrl,
  type AdvertisementButton,
  type PlacementTarget,
  type PublishedAdvertisement,
} from "@/lib/advertisementsClient";

export const HOMEPAGE_AD_PLACEMENT = { placementType: "home" } as const satisfies PlacementTarget;
export const INSTRUCTOR_GENERAL_AD_PLACEMENT = {
  placementType: "instructor_general",
} as const satisfies PlacementTarget;

export type PublishedHeroSlide = {
  id: string;
  imageUrl: string;
  title: string;
  description: string;
  mediaType: "image" | "video";
  videoUrl: string | null;
  buttons: AdvertisementButton[];
};

function mapPublishedAdvertisement(ad: PublishedAdvertisement): PublishedHeroSlide | null {
  const mediaUrl = getAdvertisementMediaPublicUrl(ad.mediaPath);
  if (!mediaUrl) return null;
  return {
    id: ad.id,
    title: ad.title,
    description: ad.description,
    mediaType: ad.mediaType,
    imageUrl: ad.mediaType === "image" ? mediaUrl : "",
    videoUrl: ad.mediaType === "video" ? mediaUrl : null,
    buttons: ad.buttons.slice(0, 2),
  };
}

export async function fetchPublishedHeroSlides(
  target: PlacementTarget,
): Promise<{ slides: PublishedHeroSlide[]; placementKey: string | null; error: string | null }> {
  const placement = await fetchPublicPlacementKey(target);
  if (placement.error || !placement.data) {
    return { slides: [], placementKey: null, error: placement.error ?? "Yayın alanı bulunamadı." };
  }

  const published = await fetchPublishedAds(placement.data.placementKey);
  if (published.error || !published.data) {
    return {
      slides: [],
      placementKey: placement.data.placementKey,
      error: published.error ?? "Yayındaki reklamlar alınamadı.",
    };
  }

  return {
    slides: published.data.flatMap((ad) => {
      const slide = mapPublishedAdvertisement(ad);
      return slide ? [slide] : [];
    }),
    placementKey: placement.data.placementKey,
    error: null,
  };
}

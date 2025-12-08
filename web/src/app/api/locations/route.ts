import { NextResponse } from "next/server";

// Minimal Ankara dataset: extend as needed.
const ANKARA = {
  city: "Ankara",
  districts: [
    { name: "Çankaya", neighborhoods: ["Ayrancı", "Bahçelievler", "Kızılay", "Oran", "Yıldız"] },
    { name: "Keçiören", neighborhoods: ["Etlik", "Aktepe", "Şehitkubilay", "Osmangazi"] },
    { name: "Yenimahalle", neighborhoods: ["Batıkent", "Demetevler", "Ostim", "Şentepe"] },
    { name: "Mamak", neighborhoods: ["Ege", "Akdere", "Boğaziçi", "Kutlu"] },
    { name: "Sincan", neighborhoods: ["Fatih", "Yenikent", "Osmanlı", "Temelli"] },
    { name: "Etimesgut", neighborhoods: ["Elvankent", "Eryaman", "Bağlıca", "Ahi Mesut"] },
    { name: "Pursaklar", neighborhoods: ["Altınova", "Merkez", "Sirkeli"] },
    { name: "Gölbaşı", neighborhoods: ["Bahçelievler", "Karşıyaka", "İncek", "Hacılar"] },
    { name: "Polatlı", neighborhoods: ["Cumhuriyet", "Şentepe", "Temelli", "Fatih"] },
    { name: "Beypazarı", neighborhoods: ["Başağaç", "Rüstempaşa", "Aşağı Çarşı"] },
  ],
};

export async function GET() {
  return NextResponse.json(ANKARA);
}



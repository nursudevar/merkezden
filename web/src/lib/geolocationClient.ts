export type GeolocationPreflightResult =
  | { ok: true }
  | { ok: false; message: string };

export type GeolocationRequestOutcome =
  | { ok: true; lat: number; lng: number }
  | { ok: false; message: string };

/** Mobil tarayıcılarda daha güvenilir varsayılanlar (iOS/Safari). */
const DEFAULT_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 20000,
  maximumAge: 60000,
};

const LOCATION_UNAVAILABLE_MESSAGE =
  "Konum bilgisi alınamadı. Cihazınızın konum servisinin açık olduğundan emin olun.";

const PERMISSION_BLOCKED_MESSAGE =
  "Konum erişimi engellendi. Tarayıcı veya cihaz ayarlarında konum servisinin açık olduğundan emin olun.";

function isLocalDevelopmentHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

function isGeolocationAllowedByDocumentPolicy(): boolean {
  try {
    const policy = (
      document as Document & {
        permissionsPolicy?: { allowsFeature: (feature: string) => boolean };
        featurePolicy?: { allowsFeature: (feature: string) => boolean };
      }
    ).permissionsPolicy;

    if (policy && typeof policy.allowsFeature === "function") {
      return policy.allowsFeature("geolocation");
    }

    const legacyPolicy = (
      document as Document & {
        featurePolicy?: { allowsFeature: (feature: string) => boolean };
      }
    ).featurePolicy;

    if (legacyPolicy && typeof legacyPolicy.allowsFeature === "function") {
      return legacyPolicy.allowsFeature("geolocation");
    }
  } catch {
    /* ignore */
  }
  return true;
}

function isEmbeddedFrame(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/** Senkron ön kontroller — getCurrentPosition öncesi çağrılır. */
export function diagnoseGeolocationPreflight(): GeolocationPreflightResult {
  if (typeof window === "undefined") {
    return { ok: false, message: "Konum özelliği yalnızca tarayıcıda kullanılabilir." };
  }

  if (!navigator.geolocation) {
    return { ok: false, message: "Tarayıcınız konum özelliğini desteklemiyor." };
  }

  const { protocol, hostname } = window.location;
  const secure = window.isSecureContext === true;

  if (!secure && protocol === "http:" && !isLocalDevelopmentHost(hostname)) {
    return {
      ok: false,
      message:
        "Konum özelliğini kullanabilmek için sayfanın güvenli HTTPS bağlantısı üzerinden açılması gerekir.",
    };
  }

  if (!isGeolocationAllowedByDocumentPolicy()) {
    return {
      ok: false,
      message: "Bu sayfada konum erişimi tarayıcı güvenlik politikası tarafından engelleniyor.",
    };
  }

  return { ok: true };
}

async function readGeolocationPermissionState(): Promise<PermissionState | null> {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) {
    return null;
  }

  try {
    const status = await navigator.permissions.query({
      name: "geolocation" as PermissionName,
    });
    return status.state;
  } catch {
    return null;
  }
}

/** Tarayıcının döndürdüğü error.code korunur; yalnızca kullanıcı mesajı türetilir. */
export async function resolveGeolocationErrorMessage(
  error: GeolocationPositionError,
): Promise<string> {
  if (error.code === error.TIMEOUT) {
    return "Konum bilgisi zamanında alınamadı. Lütfen tekrar deneyin.";
  }

  if (error.code === error.POSITION_UNAVAILABLE) {
    return LOCATION_UNAVAILABLE_MESSAGE;
  }

  if (error.code !== error.PERMISSION_DENIED) {
    return "Konum alınırken beklenmeyen bir hata oluştu.";
  }

  const preflight = diagnoseGeolocationPreflight();
  if (!preflight.ok) {
    return preflight.message;
  }

  if (isEmbeddedFrame()) {
    return "Bu sayfada konum erişimi tarayıcı güvenlik politikası tarafından engelleniyor.";
  }

  const permissionState = await readGeolocationPermissionState();
  if (permissionState === "denied") {
    return "Bu site için konum izni kapalı. Tarayıcıdaki site ayarlarından konum erişimine izin verin.";
  }

  if (permissionState === "prompt") {
    return "Konum izni henüz verilmedi. Lütfen tarayıcının gösterdiği izin penceresinde konuma izin verin.";
  }

  if (!window.isSecureContext) {
    return "Konum özelliğini kullanabilmek için sayfanın güvenli HTTPS bağlantısı üzerinden açılması gerekir.";
  }

  if (!isGeolocationAllowedByDocumentPolicy()) {
    return "Bu sayfada konum erişimi tarayıcı güvenlik politikası tarafından engelleniyor.";
  }

  return PERMISSION_BLOCKED_MESSAGE;
}

/** Kullanıcı tıklaması içinde senkron başlatılmalıdır. */
export function beginUserGeolocationRequest(
  options: PositionOptions = DEFAULT_OPTIONS,
): {
  cancel: () => void;
  promise: Promise<GeolocationRequestOutcome>;
} {
  let settled = false;

  const promise = new Promise<GeolocationRequestOutcome>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (settled) return;
        settled = true;
        resolve({
          ok: true,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        if (settled) return;
        settled = true;
        void (async () => {
          const message = await resolveGeolocationErrorMessage(error);
          resolve({ ok: false, message });
        })();
      },
      options,
    );
  });

  return {
    cancel: () => {
      settled = true;
    },
    promise,
  };
}

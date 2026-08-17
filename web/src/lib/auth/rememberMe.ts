/**
 * "Beni Hatırla" tercihleri.
 * Auth access/refresh token kopyalanmaz; şifre saklanmaz.
 * Oturum kapsamı yalnızca Supabase auth cookie'lerinin maxAge'si ile ayrılır.
 */

export const AUTH_PERSIST_COOKIE_NAME = "merkezden-auth-persist";
const REMEMBER_ME_PREF_KEY = "merkezden.rememberMe";
const REMEMBERED_EMAIL_KEY = "merkezden.rememberedEmail";
const PERSISTENT_COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

let pendingRememberMe: boolean | null = null;

type AuthCookieWriteOptions = {
  path?: string;
  domain?: string;
  maxAge?: number;
  expires?: Date;
  sameSite?: "lax" | "strict" | "none" | boolean;
  secure?: boolean;
  httpOnly?: boolean;
  [key: string]: unknown;
};

export function setPendingRememberMe(enabled: boolean | null) {
  pendingRememberMe = enabled;
}

export function shouldPersistAuthSession(persistFlag?: string | null): boolean {
  if (pendingRememberMe === true) return true;
  if (pendingRememberMe === false) return false;

  const flag =
    persistFlag !== undefined
      ? persistFlag
      : typeof document !== "undefined"
        ? readNamedCookie(document.cookie, AUTH_PERSIST_COOKIE_NAME)
        : null;

  if (flag === "1") return true;
  if (flag === "0") return false;
  return true;
}

export function applyAuthCookiePersistence<T extends AuthCookieWriteOptions>(
  options: T,
  persistFlag?: string | null,
): T {
  if (options.maxAge === 0) return options;
  if (shouldPersistAuthSession(persistFlag)) return options;

  const next = { ...options };
  delete next.maxAge;
  delete next.expires;
  return next;
}

export function persistRememberMePreference(enabled: boolean, email: string) {
  if (typeof window === "undefined") return;

  pendingRememberMe = enabled;

  if (enabled) {
    window.localStorage.setItem(REMEMBER_ME_PREF_KEY, "true");
    window.localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim());
    writeBrowserCookie(AUTH_PERSIST_COOKIE_NAME, "1", {
      path: "/",
      sameSite: "lax",
      maxAge: PERSISTENT_COOKIE_MAX_AGE_SECONDS,
      secure: isSecureContext(),
    });
    return;
  }

  window.localStorage.removeItem(REMEMBER_ME_PREF_KEY);
  window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
  writeBrowserCookie(AUTH_PERSIST_COOKIE_NAME, "0", {
    path: "/",
    sameSite: "lax",
    secure: isSecureContext(),
  });
}

export function getRememberMePrefill(): { rememberMe: boolean; email: string } {
  if (typeof window === "undefined") {
    return { rememberMe: false, email: "" };
  }

  const rememberMe = window.localStorage.getItem(REMEMBER_ME_PREF_KEY) === "true";
  const email = rememberMe ? (window.localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? "").trim() : "";
  return { rememberMe, email };
}

export function getAllBrowserCookies(): { name: string; value: string }[] {
  if (typeof document === "undefined" || !document.cookie) return [];

  return document.cookie.split(";").flatMap((part) => {
    const trimmed = part.trim();
    if (!trimmed) return [];
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 0) {
      return [{ name: safeDecode(trimmed), value: "" }];
    }
    return [
      {
        name: safeDecode(trimmed.slice(0, separatorIndex)),
        value: safeDecode(trimmed.slice(separatorIndex + 1)),
      },
    ];
  });
}

export function serializeBrowserCookie(
  name: string,
  value: string,
  options: AuthCookieWriteOptions = {},
): string {
  let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
  cookie += `; Path=${options.path || "/"}`;

  if (options.domain) cookie += `; Domain=${options.domain}`;
  if (typeof options.maxAge === "number") cookie += `; Max-Age=${Math.floor(options.maxAge)}`;
  if (options.expires instanceof Date) cookie += `; Expires=${options.expires.toUTCString()}`;

  const sameSite = options.sameSite;
  if (sameSite === true || sameSite === "strict") cookie += "; SameSite=Strict";
  else if (sameSite === "none") cookie += "; SameSite=None";
  else cookie += "; SameSite=Lax";

  if (options.secure) cookie += "; Secure";
  return cookie;
}

function writeBrowserCookie(name: string, value: string, options: AuthCookieWriteOptions) {
  if (typeof document === "undefined") return;
  document.cookie = serializeBrowserCookie(name, value, options);
}

function readNamedCookie(cookieHeader: string, name: string): string | null {
  if (!cookieHeader) return null;
  const prefix = `${name}=`;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(prefix) && safeDecode(trimmed.split("=")[0] ?? "") !== name) {
      continue;
    }
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 0) continue;
    const cookieName = safeDecode(trimmed.slice(0, separatorIndex));
    if (cookieName !== name) continue;
    return safeDecode(trimmed.slice(separatorIndex + 1));
  }
  return null;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isSecureContext(): boolean {
  return typeof window !== "undefined" && window.location.protocol === "https:";
}

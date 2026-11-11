export const BACKOFFICE_HOME = "/backoffice";
export const BACKOFFICE_LOGIN = "/backoffice/login";

// Only same-origin back-office paths are allowed as a post-login target, so `?next=`
// can't be abused as an open redirect (e.g. `//evil.com` or `https://evil.com`).
export function safeRedirect(next: unknown, fallback: string = BACKOFFICE_HOME): string {
  if (typeof next !== "string" || next.length === 0) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;

  let url: URL;
  try {
    url = new URL(next, "http://localhost");
  } catch {
    return fallback;
  }
  if (url.origin !== "http://localhost") return fallback;

  const path = url.pathname;
  const isBackoffice = path === BACKOFFICE_HOME || path.startsWith(`${BACKOFFICE_HOME}/`);
  if (!isBackoffice || path === BACKOFFICE_LOGIN) return fallback;

  return `${path}${url.search}`;
}

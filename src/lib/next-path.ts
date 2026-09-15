/**
 * Where to continue after the login wall.
 *
 * Since 2026-09-15 finding sitters needs an account, so the landing page's links all land on
 * /login first; ?next= carries the page the visitor was heading for through login, sign-up
 * and profile completion.
 *
 * ?next= is attacker-controlled — anyone can send a link to petbnb.lt/login?next=… — so only
 * a path on this site is ever followed. Anything a browser could resolve to another origin
 * ("//evil.example", "/\evil.example", a tab smuggled between the slashes) is refused, and so
 * are the wall's own pages, which would loop.
 */

const PROBE_ORIGIN = "https://petbnb.invalid";
const WALL_PAGES = ["/login", "/signup"];

/** Tabs, newlines and other C0 controls, plus DEL: URL parsing silently strips some of them. */
function hasControlCharacter(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

export function safeNextPath(raw: string | null | undefined): string | null {
  if (typeof raw !== "string" || !raw.startsWith("/")) return null;
  if (hasControlCharacter(raw)) return null;

  let url: URL;
  try {
    url = new URL(raw, PROBE_ORIGIN);
  } catch {
    return null;
  }
  if (url.origin !== PROBE_ORIGIN) return null;
  if (WALL_PAGES.some((page) => url.pathname === page || url.pathname.startsWith(`${page}/`))) return null;

  return raw;
}

/** The safe ?next= of a `location.search` string, or null. */
export function nextFromSearch(search: string): string | null {
  return safeNextPath(new URLSearchParams(search).get("next"));
}

/** `path` with `next` attached as ?next= when it is safe to continue to; `path` alone otherwise. */
export function withNext(path: string, next: string | null): string {
  const safe = safeNextPath(next);
  return safe ? `${path}?next=${encodeURIComponent(safe)}` : path;
}

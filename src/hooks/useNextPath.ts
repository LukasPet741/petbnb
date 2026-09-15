import { useEffect, useState } from "react";
import { nextFromSearch } from "@/lib/next-path";

/**
 * The page's safe ?next=, for links that must carry it on (/login ↔ /signup).
 *
 * Read after mount from window.location rather than useSearchParams, which would force a
 * Suspense boundary onto these statically rendered pages; the first render has none, the same
 * as the server's.
 */
export function useNextPath(): string | null {
  const [next, setNext] = useState<string | null>(null);

  useEffect(() => {
    setNext(nextFromSearch(window.location.search));
  }, []);

  return next;
}

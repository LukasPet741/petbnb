"use client";
import { useEffect } from "react";

/**
 * Sets the browser tab title from a client page, framed like the root layout's "%s · PetBnB"
 * template. The (app) pages are client components, so they cannot export `metadata`, and static
 * metadata could not follow the language switch anyway.
 *
 * On unmount the previous title comes back, so a client-side move to a page without a title of
 * its own (the landing page) shows the default again. It is restored only while the tab still
 * shows ours: if the next route's metadata already replaced it (/login), that title stays.
 * A falsy title (data still loading) leaves the tab as it is.
 */
export function usePageTitle(title: string | null | undefined) {
  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    const ours = `${title} · PetBnB`;
    document.title = ours;
    return () => {
      if (document.title === ours) document.title = previous;
    };
  }, [title]);
}

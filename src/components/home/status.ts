/** The landing page runs ONE profiles query and shares its outcome with every
 *  section, so they all speak the same three-state language. */
export type HomeStatus = "loading" | "error" | "ready";

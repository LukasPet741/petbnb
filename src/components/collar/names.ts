import type { CollarDevice } from "@/lib/collar/types";

type T = (key: string, vars?: Record<string, string | number>) => string;

/** A demo collar is always "Recorded walk" in the page's language; a real one is its label. */
export function collarName(device: CollarDevice, t: T): string {
  if (device.is_demo) return t("appPages.collar.demoName");
  return device.label || t("appPages.collar.unnamed");
}

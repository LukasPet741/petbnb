import en from "./en";
import lt from "./lt";

export type Locale = "en" | "lt";

export const dictionaries: Record<Locale, Record<string, unknown>> = { en, lt };

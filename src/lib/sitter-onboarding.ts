import { askingPrice, type SitterPrices } from "@/lib/pricing";
import { SERVICE_LABELS, type ServiceType } from "@/lib/types";

/**
 * What a sitter still has to do before owners can book them, for the dashboard's progress ring.
 *
 * "prices" follows the rule /bookings/new uses: a service is priced when askingPrice answers for
 * one day, so a malformed row counts as unpriced, exactly as the database treats it.
 * "verified" follows sitterBlocker: anything but 'none' is bookable (enforce_sitter_verified).
 */
export type OnboardingKey = "photo" | "bio" | "services" | "prices" | "verified";

export interface OnboardingStep {
  key: OnboardingKey;
  done: boolean;
  href: string;
}

/** The my_profile columns this reads. services and prices are jsonb, so they arrive untyped. */
export interface OnboardingInput {
  avatar_url: string | null;
  about_me: string | null;
  services: unknown;
  prices?: unknown;
  verification_method?: string | null;
}

export function onboardingSteps(p: OnboardingInput): OnboardingStep[] {
  const services = (p.services ?? {}) as Partial<Record<ServiceType, boolean>>;
  const offered = (Object.keys(SERVICE_LABELS) as ServiceType[]).filter((k) => services[k] === true);
  const prices = (p.prices ?? null) as SitterPrices | null;

  return [
    { key: "photo", done: Boolean(p.avatar_url), href: "/profile" },
    { key: "bio", done: Boolean(p.about_me?.trim()), href: "/profile" },
    { key: "services", done: offered.length > 0, href: "/profile" },
    {
      key: "prices",
      done: offered.length > 0 && offered.every((s) => askingPrice(prices, s, 1) !== null),
      href: "/profile",
    },
    {
      key: "verified",
      done: Boolean(p.verification_method) && p.verification_method !== "none",
      href: "/smart-id-demo",
    },
  ];
}

/** Share of steps done, as a whole percentage. */
export function onboardingPercent(steps: OnboardingStep[]): number {
  if (steps.length === 0) return 0;
  return Math.round((steps.filter((s) => s.done).length / steps.length) * 100);
}

import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import ServiceCards from "@/components/home/ServiceCards";
import Honest from "@/components/home/Honest";
import { dictionaries } from "@/lib/i18n";

/**
 * Landing variant B (2026-09-15): each service is a photo tile showing a name and one
 * line, with its details sliding up on hover; the "what we do and don't" cards became an
 * accordion. Chosen by Lukas from four mocked directions because the old cards carried
 * ~25 words each.
 *
 * Rendered without a LanguageProvider, so `t` is the identity function and each label is
 * the translation key it asked for.
 */

const SERVICES = ["walking", "boarding", "daycare", "grooming"] as const;

describe("ServiceCards", () => {
  it("gives every tile one call to action, into the directory filtered to its service", () => {
    render(<ServiceCards />);

    const links = screen.getAllByRole("link").map((a) => [a.textContent?.trim(), a.getAttribute("href")]);

    expect(links).toEqual([
      ["home.services.items.walking.cta", "/browse?service=walking"],
      ["home.services.items.boarding.cta", "/browse?service=boarding"],
      ["home.services.items.daycare.cta", "/browse?service=daycare"],
      ["home.services.items.grooming.cta", "/browse?service=grooming"],
    ]);
  });

  it("renders every tile's details in the page rather than only on hover, so touch and screen readers get them", () => {
    render(<ServiceCards />);

    const headings = screen.getAllByRole("heading", { level: 3 });
    expect(headings.map((h) => h.textContent)).toEqual(SERVICES.map((key) => `common.services.${key}`));

    headings.forEach((heading, i) => {
      const key = SERVICES[i];
      const tile = heading.closest("li") as HTMLElement;
      for (const part of ["line", "point1", "point2", "point3"]) {
        expect(within(tile).getByText(`home.services.items.${key}.${part}`)).toBeInTheDocument();
      }
    });
  });
});

describe("Honest", () => {
  it("lists the four facts as disclosure items with only the first one open", () => {
    const { container } = render(<Honest />);

    const items = [...container.querySelectorAll("details")];

    expect(items.map((d) => d.querySelector("summary")?.textContent?.trim())).toEqual([
      "home.honest.points.fees.title",
      "home.honest.points.vetting.title",
      "home.honest.points.insurance.title",
      "home.honest.points.data.title",
    ]);
    expect(items.map((d) => d.open)).toEqual([true, false, false, false]);
  });

  it("keeps the links to the full terms and the privacy policy", () => {
    render(<Honest />);

    expect(screen.getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual([
      "/legal/terms",
      "/legal/privacy",
    ]);
  });
});

describe("landing service copy", () => {
  // Found 2026-09-15: the section read "Four things a sitter can do" over a grooming tile
  // whose button said "Find a sitter". A groomer is not a sitter.
  type Services = { title: string; items: Record<string, Record<string, string>> };
  const services = (locale: "en" | "lt") =>
    (dictionaries[locale] as { home: { services: Services } }).home.services;

  it.each([
    ["en", /sitter/i],
    ["lt", /globėj/i],
  ] as const)("never calls a groomer a sitter (%s)", (locale, sitterWord) => {
    const { title, items } = services(locale);

    expect(title).not.toMatch(sitterWord);
    expect(Object.values(items.grooming).filter((s) => sitterWord.test(s))).toEqual([]);
  });
});

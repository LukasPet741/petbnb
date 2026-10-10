import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import Logo, { LogoMark } from "@/components/Logo";

// The mark exists twice: src/app/icon.svg (the favicon, the Apple icon and the share
// card are made from it, with literal colours) and LogoMark (CSS variables, so the app
// can recolour it). These tests keep the two drawings the same and the markup sound.

const ICON = fs.readFileSync(path.join(process.cwd(), "src/app/icon.svg"), "utf8");

/** Every circle and ellipse as "tag cx cy r rx ry": the geometry both must share. */
function shapes(svg: string): string[] {
  return [...svg.matchAll(/<(circle|ellipse)\b([^>]*)>/g)].map(([, tag, attrs]) => {
    const get = (name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(attrs)?.[1] ?? "-";
    return [tag, get("cx"), get("cy"), get("r"), get("rx"), get("ry")].join(" ");
  });
}

describe("LogoMark", () => {
  it("draws the same mark as the icon file the favicon is made from", () => {
    const { container } = render(<LogoMark />);
    expect(shapes(container.innerHTML)).toEqual(shapes(ICON));
    expect(shapes(ICON).length).toBeGreaterThanOrEqual(7);
  });

  it("gives every mark its own cut-out, so two logos on a page never share one", () => {
    const { container } = render(
      <>
        <LogoMark />
        <LogoMark />
      </>,
    );
    const ids = [...container.querySelectorAll("mask")].map((m) => m.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) {
      expect(container.querySelector(`[mask="url(#${id})"]`)).not.toBeNull();
    }
  });
});

describe("Logo", () => {
  it("lets a screen reader hear the name once: the mark goes quiet beside the wordmark", () => {
    render(<Logo showWordmark />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("petbnb")).toBeInTheDocument();
  });
});

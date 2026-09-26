import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import MiniMap from "@/components/collar/MiniMap";

describe("MiniMap", () => {
  it("draws OpenStreetMap tiles around the collar with the dot in the middle", () => {
    const { container } = render(<MiniMap lat={54.683} lng={25.233} height={56} />);
    const images = container.querySelectorAll("img");
    expect(images.length).toBeGreaterThan(0);
    for (const img of images) expect(img.getAttribute("src")).toMatch(/tile\.openstreetmap\.org/);
    expect(container.querySelector("[data-dot]")).not.toBeNull();
  });

  it("greys the map and stops the pulse for a stale position", () => {
    const { container } = render(<MiniMap lat={54.683} lng={25.233} height={56} muted />);
    expect(container.querySelector(".animate-ping")).toBeNull();
    expect((container.querySelector("img") as HTMLImageElement).style.filter).toContain("grayscale");
  });
});

import { describe, expect, it } from "vitest";
import {
  buildPublicRankingPreviewPath,
  buildPublicRankingUrl,
} from "./public-url";

describe("buildPublicRankingUrl", () => {
  it("includes box slug and category", () => {
    expect(
      buildPublicRankingUrl({
        locale: "es",
        boxSlug: "iron-district-box",
        category: "intermediate",
        host: "app.athron.mx",
        proto: "https",
      })
    ).toBe(
      "https://app.athron.mx/es/ranking?box=iron-district-box&category=intermediate"
    );
  });

  it("builds relative preview path with box", () => {
    expect(
      buildPublicRankingPreviewPath({
        boxSlug: "parabellum-cross",
        category: "beginner",
      })
    ).toBe("/ranking?box=parabellum-cross&category=beginner");
  });
});

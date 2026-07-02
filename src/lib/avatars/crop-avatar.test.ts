import { describe, expect, it } from "vitest";
import {
  centerSquareCropRect,
  computeProfilePhotoDimensions,
} from "./crop-avatar";

describe("centerSquareCropRect", () => {
  it("centers a portrait photo horizontally", () => {
    expect(centerSquareCropRect(900, 1600)).toEqual({
      sx: 0,
      sy: 350,
      size: 900,
    });
  });

  it("centers a landscape photo vertically", () => {
    expect(centerSquareCropRect(1600, 900)).toEqual({
      sx: 350,
      sy: 0,
      size: 900,
    });
  });

  it("keeps square images unchanged", () => {
    expect(centerSquareCropRect(800, 800)).toEqual({
      sx: 0,
      sy: 0,
      size: 800,
    });
  });
});

describe("computeProfilePhotoDimensions", () => {
  it("preserves portrait aspect ratio under max px", () => {
    expect(computeProfilePhotoDimensions(900, 1600, 1080)).toEqual({
      width: 608,
      height: 1080,
      scale: 0.675,
    });
  });

  it("preserves landscape aspect ratio under max px", () => {
    expect(computeProfilePhotoDimensions(1600, 900, 1080)).toEqual({
      width: 1080,
      height: 608,
      scale: 0.675,
    });
  });

  it("does not upscale small images", () => {
    expect(computeProfilePhotoDimensions(400, 600, 1080)).toEqual({
      width: 400,
      height: 600,
      scale: 1,
    });
  });
});

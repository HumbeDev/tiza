import { describe, expect, it } from "vitest";
import { embedSrc, parseEmbedUrl } from "./parse";

describe("parseEmbedUrl", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ", undefined],
    ["youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s", "dQw4w9WgXcQ", 90],
    ["https://youtu.be/dQw4w9WgXcQ?t=42", "dQw4w9WgXcQ", 42],
    ["https://m.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ", undefined],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ?start=10", "dQw4w9WgXcQ", 10],
    ["https://www.youtube.com/live/dQw4w9WgXcQ", "dQw4w9WgXcQ", undefined],
  ])("YouTube %s", (url, media, start) => {
    expect(parseEmbedUrl(url)).toEqual({ provider: "youtube", media, ...(start ? { start } : {}) });
  });

  it.each([
    "https://x.com/NASA/status/1800000000000000000",
    "https://twitter.com/NASA/status/1800000000000000000?s=20",
    "mobile.twitter.com/NASA/status/1800000000000000000/photo/1",
  ])("X %s", (url) => {
    expect(parseEmbedUrl(url)).toEqual({ provider: "x", media: "1800000000000000000" });
  });

  it.each([
    "https://example.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=short",
    "https://www.youtube.com/@channel",
    "https://x.com/NASA",
    "javascript:alert(1)",
    "not a url",
  ])("rejects %s", (url) => {
    expect(parseEmbedUrl(url)).toBeNull();
  });
});

describe("embedSrc", () => {
  it("uses the privacy-enhanced YouTube player", () => {
    expect(embedSrc({ provider: "youtube", media: "dQw4w9WgXcQ", start: 90 })).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&playsinline=1&start=90",
    );
  });

  it("uses X's embed page", () => {
    expect(embedSrc({ provider: "x", media: "123" }, "es")).toBe(
      "https://platform.twitter.com/embed/Tweet.html?id=123&dnt=true&lang=es",
    );
  });
});

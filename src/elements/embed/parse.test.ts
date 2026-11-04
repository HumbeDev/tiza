import { describe, expect, it } from "vitest";
import { embedSrc, parseEmbed } from "./parse";

describe("parseEmbed", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", undefined],
    ["youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s", 90],
    ["https://youtu.be/dQw4w9WgXcQ?t=42", 42],
    ["https://m.youtube.com/shorts/dQw4w9WgXcQ", undefined],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ?start=10", 10],
    ["https://www.youtube.com/live/dQw4w9WgXcQ", undefined],
  ])("YouTube %s", (url, start) => {
    expect(parseEmbed(url)).toEqual({
      provider: "youtube",
      media: "dQw4w9WgXcQ",
      ...(start ? { start } : {}),
      link: `https://www.youtube.com/watch?v=dQw4w9WgXcQ${start ? `&t=${start}` : ""}`,
    });
  });

  it.each([
    ["https://x.com/NASA/status/1800000000000000000", "NASA"],
    ["https://twitter.com/NASA/status/1800000000000000000?s=20", "NASA"],
    ["mobile.twitter.com/NASA/status/1800000000000000000/photo/1", "NASA"],
    ["https://x.com/i/web/status/1800000000000000000", "i"],
  ])("X %s", (url, user) => {
    expect(parseEmbed(url)).toEqual({
      provider: "x",
      media: "1800000000000000000",
      link: `https://x.com/${user}/status/1800000000000000000`,
    });
  });

  it("reads X's embed code, using the post's own link", () => {
    const code = `<blockquote class="twitter-tweet"><p lang="es" dir="ltr">Mira esto
https://t.co/abc <a href="https://twitter.com/hashtag/Ciencia?src=hash&amp;ref_src=twsrc%5Etfw">#Ciencia</a>
cita <a href="https://twitter.com/other/status/111">otro</a></p>&mdash; NASA (@NASA)
<a href="https://twitter.com/NASA/status/1800000000000000000?ref_src=twsrc%5Etfw">October 1, 2026</a></blockquote>
<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>`;
    expect(parseEmbed(code)).toMatchObject({ provider: "x", media: "1800000000000000000" });
  });

  it("reads YouTube's embed code", () => {
    const code = `<iframe width="560" height="315" src="https://www.youtube.com/embed/dQw4w9WgXcQ?si=Ab12&amp;start=5" title="YouTube video player" frameborder="0" allowfullscreen></iframe>`;
    expect(parseEmbed(code)).toMatchObject({ provider: "youtube", media: "dQw4w9WgXcQ", start: 5 });
  });

  it.each([
    "https://example.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=short",
    "https://www.youtube.com/@channel",
    "https://x.com/NASA",
    "javascript:alert(1)",
    "not a url",
    "<p>no links here</p>",
  ])("rejects %s", (url) => {
    expect(parseEmbed(url)).toBeNull();
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

import type { EmbedElement, EmbedProvider } from "../../document";

export interface ParsedEmbed {
  provider: EmbedProvider;
  media: string;
  start?: number;
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const TWEET_ID = /^\d{1,20}$/;

/** `90`, `90s`, `1m30s`, `1h2m3s` → seconds. */
function parseTime(value: string | null): number | undefined {
  if (!value) return undefined;
  if (/^\d+s?$/.test(value)) return parseInt(value, 10) || undefined;
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value);
  if (!m) return undefined;
  const s = (+(m[1] ?? 0) * 60 + +(m[2] ?? 0)) * 60 + +(m[3] ?? 0);
  return s || undefined;
}

/** Recognizes YouTube video links and X/Twitter post links; null for anything else. */
export function parseEmbedUrl(input: string): ParsedEmbed | null {
  let url: URL;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^(www\.|m\.|mobile\.)/, "");
  const parts = url.pathname.split("/").filter(Boolean);

  if (host === "youtu.be" || host === "youtube.com" || host === "youtube-nocookie.com") {
    const id =
      host === "youtu.be"
        ? parts[0]
        : parts[0] === "watch"
          ? url.searchParams.get("v")
          : ["embed", "shorts", "live", "v"].includes(parts[0] ?? "")
            ? parts[1]
            : null;
    if (!id || !YOUTUBE_ID.test(id)) return null;
    const start = parseTime(url.searchParams.get("t") ?? url.searchParams.get("start"));
    return { provider: "youtube", media: id, ...(start ? { start } : {}) };
  }

  if (host === "x.com" || host === "twitter.com") {
    const i = parts.indexOf("status");
    const id = i >= 0 ? parts[i + 1] : undefined;
    if (!id || !TWEET_ID.test(id)) return null;
    return { provider: "x", media: id };
  }
  return null;
}

/** URL of the service's own player for this element. */
export function embedSrc(
  el: Pick<EmbedElement, "provider" | "media" | "start">,
  lang = "en",
): string {
  const id = encodeURIComponent(el.media);
  if (el.provider === "youtube") {
    const start = el.start ? `&start=${Math.floor(el.start)}` : "";
    return `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1${start}`;
  }
  return `https://platform.twitter.com/embed/Tweet.html?id=${id}&dnt=true&lang=${encodeURIComponent(lang)}`;
}

/** Preview picture (YouTube only). */
export function embedThumbnail(el: Pick<EmbedElement, "provider" | "media">): string | null {
  return el.provider === "youtube"
    ? `https://i.ytimg.com/vi/${encodeURIComponent(el.media)}/hqdefault.jpg`
    : null;
}

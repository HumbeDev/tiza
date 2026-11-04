import type { EmbedElement, EmbedProvider } from "../../document";

export interface ParsedEmbed {
  provider: EmbedProvider;
  media: string;
  start?: number;
  /** Clean link to the video or post, to store and show. */
  link: string;
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

/**
 * Recognizes a YouTube video or X/Twitter post from its link or from the embed code the
 * site gives ("Embed post" on X, "Share → Embed" on YouTube). Any other http(s) link (or
 * an `<iframe src>`) is a web page. Null when there is no usable link.
 */
export function parseEmbed(input: string): ParsedEmbed | null {
  const text = input.trim();
  const found = text.match(/https?:\/\/[^\s"'<>]+/g);
  if (!found) return parseUrl(text) ?? webPage(text);
  const urls = found.map((u) => u.replaceAll("&amp;", "&"));
  // In X's embed code the post's own link comes last, after any links in its text.
  for (const url of [...urls].reverse()) {
    const parsed = parseUrl(url);
    if (parsed) return parsed;
  }
  const iframe = /<iframe[^>]*\ssrc=["']([^"']+)["']/i.exec(text)?.[1]?.replaceAll("&amp;", "&");
  return webPage(iframe ?? (urls.length === 1 && urls[0] === text ? text : (urls[0] ?? "")));
}

/** Any http(s) page with a real host name. */
function webPage(input: string): ParsedEmbed | null {
  if (!input || /\s/.test(input)) return null;
  let url: URL;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(url.protocol) || !/\.[a-z]{2,}$/i.test(url.hostname))
    return null;
  // YouTube and X pages other than a video or post can't be framed: not a "web page".
  if (/(^|\.)(youtube\.com|youtu\.be|x\.com|twitter\.com)$/i.test(url.hostname)) return null;
  return { provider: "web", media: url.href, link: url.href };
}

function parseUrl(input: string): ParsedEmbed | null {
  if (/\s/.test(input)) return null;
  let url: URL;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(input) ? input : `https://${input}`);
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
    const link = `https://www.youtube.com/watch?v=${id}${start ? `&t=${start}` : ""}`;
    return { provider: "youtube", media: id, ...(start ? { start } : {}), link };
  }

  if (host === "x.com" || host === "twitter.com") {
    const i = parts.indexOf("status");
    const id = i >= 0 ? parts[i + 1] : undefined;
    if (!id || !TWEET_ID.test(id)) return null;
    const user = i === 1 && /^\w{1,15}$/.test(parts[0]) ? parts[0] : "i";
    return { provider: "x", media: id, link: `https://x.com/${user}/status/${id}` };
  }
  return null;
}

/** The element fields for a parsed embed (clears `start` when the new one has none). */
export function embedFields(
  p: ParsedEmbed,
): Pick<EmbedElement, "provider" | "media" | "url" | "start"> {
  return { provider: p.provider, media: p.media, url: p.link, start: p.start };
}

/** URL of the service's own player for this element (or the page itself). */
export function embedSrc(
  el: Pick<EmbedElement, "provider" | "media" | "start">,
  lang = "en",
): string {
  if (el.provider === "web") return /^https?:\/\//i.test(el.media) ? el.media : "about:blank";
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

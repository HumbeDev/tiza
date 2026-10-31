// Content Security Policy for embedded HTML simulations. Keep in sync with
// `sim_csp` in src-tauri/src/sim.rs (the desktop app sends it as an HTTP header).

const OFFLINE =
  "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob: data:; " +
  "style-src 'unsafe-inline' blob: data:; img-src blob: data:; font-src blob: data:; " +
  "media-src blob: data:; worker-src blob:; connect-src blob: data:";

const NETWORK =
  "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' https: blob: data:; " +
  "style-src 'unsafe-inline' https: blob: data:; img-src https: blob: data:; " +
  "font-src https: blob: data:; media-src https: blob: data:; worker-src blob: https:; " +
  "connect-src https: wss: blob: data:";

export const simCsp = (allowNetwork: boolean): string => (allowNetwork ? NETWORK : OFFLINE);

/** Adds the CSP as a `<meta>` tag at the start of `<head>` (web version, srcdoc iframes). */
export function injectCsp(html: string, allowNetwork: boolean): string {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${simCsp(allowNetwork)}">`;
  const head = /<head(\s[^>]*)?>/i.exec(html);
  if (head)
    return (
      html.slice(0, head.index + head[0].length) + meta + html.slice(head.index + head[0].length)
    );
  const htmlTag = /<html(\s[^>]*)?>/i.exec(html);
  if (htmlTag) {
    const at = htmlTag.index + htmlTag[0].length;
    return `${html.slice(0, at)}<head>${meta}</head>${html.slice(at)}`;
  }
  const doctype = /^\s*<!doctype[^>]*>/i.exec(html);
  if (doctype) return `${doctype[0]}<head>${meta}</head>${html.slice(doctype[0].length)}`;
  return `<!doctype html><head>${meta}</head>${html}`;
}

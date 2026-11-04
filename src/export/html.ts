// Self-contained HTML presentation: one file with the slides, pictures, videos and HTML
// pages inlined, plus a tiny player (keyboard/click navigation, build steps,
// transitions). It opens in any browser without Tiza.
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { assetDataUrl } from "../assets/store";
import type { Element, Presentation, Slide } from "../document";
import { embedSrc, embedThumbnail } from "../elements/embed/parse";
import { injectCsp } from "../elements/sim/csp";
import i18n from "../i18n";
import { buildSteps, visibleSlides } from "../present/client";
import SlideRenderer from "../render/SlideRenderer";
import { type ExportResult, withProgress } from "./progress";

const escapeAttr = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** The app's CSS (renderer, effects, transitions). */
function appCss(): string {
  let css = "";
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) css += `${rule.cssText}\n`;
    } catch {
      // Cross-origin sheet: not needed by slides.
    }
  }
  return css;
}

/** Live content that the export renderer draws as placeholders. */
async function liveHtml(el: Element): Promise<string | null> {
  switch (el.kind) {
    case "video": {
      const attrs = [
        "controls",
        "playsinline",
        'preload="metadata"',
        el.loop ? "loop" : "",
        el.muted ? "muted" : "",
        el.autoplay ? "data-autoplay" : "",
      ].join(" ");
      const range = el.start || el.end ? `#t=${el.start ?? 0}${el.end ? `,${el.end}` : ""}` : "";
      return `<video class="export-video" ${attrs} src="${await assetDataUrl(el.asset)}${range}"></video>`;
    }
    case "sim": {
      const sx = el.w / el.viewWidth;
      const sy = el.h / el.viewHeight;
      const s = Math.min(sx, sy);
      const [scaleX, scaleY] = el.fit === "fill" ? [sx, sy] : [s, s];
      const dx = (el.w - el.viewWidth * scaleX) / 2;
      const dy = (el.h - el.viewHeight * scaleY) / 2;
      return (
        `<div class="sim-view" data-interactive><iframe title="${escapeAttr(el.title)}" sandbox="allow-scripts" ` +
        `referrerpolicy="no-referrer" srcdoc="${escapeAttr(injectCsp(el.html, el.allowNetwork))}" ` +
        `style="width:${el.viewWidth}px;height:${el.viewHeight}px;transform:translate(${dx}px,${dy}px) scale(${scaleX},${scaleY})"></iframe></div>`
      );
    }
    case "embed": {
      const zoom = el.provider === "x" ? 2 : 1;
      // Opened as a local file, YouTube refuses to play (no referrer: "Error 153"); the
      // player then shows the thumbnail linking to the video instead (see PLAYER_JS).
      const fallback =
        el.provider === "youtube"
          ? ` data-file-fallback="${escapeAttr(el.url)}" data-thumb="${escapeAttr(embedThumbnail(el) ?? "")}"`
          : "";
      return (
        `<div class="sim-view embed-view embed-${el.provider}" data-interactive${fallback}><iframe title="${escapeAttr(el.url)}" ` +
        `src="${escapeAttr(embedSrc(el, i18n.language.slice(0, 2)))}" allowfullscreen ` +
        `allow="autoplay; encrypted-media; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin" ` +
        `style="width:${el.w / zoom}px;height:${el.h / zoom}px;${zoom > 1 ? `transform:scale(${zoom})` : ""}"></iframe></div>`
      );
    }
    default:
      return null;
  }
}

/** Renders one slide off screen and returns its HTML with everything inlined. */
async function slideHtml(doc: Presentation, slide: Slide): Promise<string> {
  const host = document.createElement("div");
  host.style.cssText = `position:fixed;left:-${doc.page.width * 2}px;top:0;pointer-events:none;`;
  document.body.append(host);
  const root = createRoot(host);
  try {
    root.render(
      createElement(SlideRenderer, { slide, page: doc.page, mode: "export", master: doc.master }),
    );
    await new Promise((r) => setTimeout(r, 300));
    const node = host.firstElementChild!.cloneNode(true) as HTMLElement;
    const wrappers = Array.from(node.children) as HTMLElement[];
    // Same order as the renderer: the master's elements first (no build steps).
    const master = doc.master && !slide.hideMaster ? doc.master.elements : [];
    const drawn = [
      ...master.map((el) => ({ el, own: false })),
      ...slide.elements.map((el) => ({ el, own: true })),
    ];
    for (const [i, { el, own }] of drawn.entries()) {
      const wrapper = wrappers[i];
      if (!wrapper) continue;
      if (own && el.build) wrapper.classList.add(`in-${el.build.effect}`);
      if (own && el.exit) wrapper.classList.add(`out-${el.exit.effect}`);
      if (el.kind === "image") {
        const img = wrapper.querySelector("img");
        if (img) img.src = await assetDataUrl(el.asset);
      }
      const live = await liveHtml(el);
      if (live !== null) wrapper.innerHTML = live;
    }
    return node.outerHTML;
  } finally {
    root.unmount();
    host.remove();
  }
}

const PLAYER_CSS = `
html,body{margin:0;height:100%;background:#000;overflow:hidden;font-family:system-ui,sans-serif}
#stage{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) scale(var(--s,1))}
.file-fallback{position:absolute;inset:0;display:grid;place-items:center;background:#111 center/cover no-repeat;text-decoration:none}
.file-fallback span{padding:.4em .8em;border-radius:.4em;background:#e00;color:#fff;font-size:42px;text-decoration:none}
#stage>.stage-slide{position:absolute;inset:0}
.export-video{width:100%;height:100%;background:#000}
#hint{position:fixed;bottom:16px;left:50%;translate:-50% 0;padding:8px 14px;border-radius:8px;
  background:#000a;color:#fff;font-size:14px;transition:opacity .6s;pointer-events:none}
#count{position:fixed;right:12px;bottom:10px;color:#fff8;font-size:12px;pointer-events:none}
`;

// Plain ES5-ish script: runs in any browser, no build step.
const PLAYER_JS = `(function(){
var M=JSON.parse(document.getElementById("meta").textContent);
var stage=document.getElementById("stage"),count=document.getElementById("count");
var i=0,step=0,last=M.steps.length-1;
stage.style.width=M.w+"px";stage.style.height=M.h+"px";
function fit(){stage.style.setProperty("--s",Math.min(innerWidth/M.w,innerHeight/M.h))}
function apply(){
  stage.querySelectorAll("[data-in]").forEach(function(e){e.classList.toggle("in-pending",+e.dataset.in>step)});
  stage.querySelectorAll("[data-out]").forEach(function(e){e.classList.toggle("out-done",+e.dataset.out<=step)});
}
function show(n,s,animate){
  i=n;step=s;
  var wrap=document.createElement("div");wrap.className="stage-slide";
  var t=M.transitions[n];
  if(animate&&t&&t.kind!=="none"){wrap.classList.add("transition-"+t.kind);wrap.style.animationDuration=t.durationMs+"ms"}
  wrap.appendChild(document.getElementById("s"+n).content.cloneNode(true));
  if(location.protocol==="file:")wrap.querySelectorAll("[data-file-fallback]").forEach(function(e){
    var a=document.createElement("a");a.className="file-fallback";a.href=e.dataset.fileFallback;a.target="_blank";a.rel="noopener";
    a.style.backgroundImage="url("+e.dataset.thumb+")";a.innerHTML="<span>\u25B6 YouTube</span>";e.replaceChildren(a);
  });
  stage.replaceChildren(wrap);apply();
  wrap.querySelectorAll("video[data-autoplay]").forEach(function(v){v.play().catch(function(){})});
  count.textContent=(n+1)+" / "+(last+1);
  history.replaceState(null,"","#"+(n+1));
}
function next(){if(step<M.steps[i]){step++;apply()}else if(i<last)show(i+1,0,true)}
function prev(){if(step>0){step--;apply()}else if(i>0)show(i-1,M.steps[i-1],false)}
addEventListener("keydown",function(e){
  var k=e.key;
  if(["ArrowRight","ArrowDown"," ","PageDown","Enter"].indexOf(k)>=0)next();
  else if(["ArrowLeft","ArrowUp","PageUp","Backspace"].indexOf(k)>=0)prev();
  else if(k==="Home")show(0,0,false);
  else if(k==="End")show(last,M.steps[last],false);
  else if(k==="f"||k==="F")(document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen()).catch(function(){});
  else return;
  e.preventDefault();
});
addEventListener("click",function(e){if(!e.target.closest("[data-interactive],video,a,iframe"))next()});
addEventListener("contextmenu",function(e){e.preventDefault();prev()});
addEventListener("resize",fit);fit();
var start=Math.min(Math.max((parseInt(location.hash.slice(1),10)||1)-1,0),last);
show(start,0,false);
setTimeout(function(){document.getElementById("hint").style.opacity=0},3500);
})();`;

export async function exportHtml(doc: Presentation): Promise<ExportResult> {
  const slides = visibleSlides(doc);
  const templates: string[] = [];
  await withProgress(slides.length, async (tick) => {
    for (const [n, slide] of slides.entries()) {
      templates.push(`<template id="s${n}">${await slideHtml(doc, slide)}</template>`);
      tick();
    }
  });
  const meta = JSON.stringify({
    w: doc.page.width,
    h: doc.page.height,
    steps: buildSteps(doc),
    transitions: slides.map((s) => s.transition ?? doc.transition ?? null),
  }).replace(/</g, "\\u003c");
  const title = doc.meta.title.trim() || "Tiza";
  const html = `<!doctype html>
<html lang="${escapeAttr(doc.meta.lang ?? "en")}" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Tiza">
<title>${escapeAttr(title)}</title>
<style>${appCss().replace(/<\/style/gi, "<\\/style")}</style>
<style>${PLAYER_CSS}</style>
</head>
<body>
<div id="stage"></div>
<div id="count"></div>
<div id="hint">${escapeAttr(i18n.t("export.htmlHint"))}</div>
${templates.join("\n")}
<script type="application/json" id="meta">${meta}</script>
<script>${PLAYER_JS}</script>
</body>
</html>
`;
  return { bytes: new TextEncoder().encode(html), format: "html" };
}

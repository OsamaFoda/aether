// Sidebar panels in Aether's look. The panel is a card of glass beside the sidebar, lined up with
// it and the page (styles/aether.css, #sidebar-box). Firefox's own pages inside it (bookmarks,
// history, passwords, the customize page) get transparent backgrounds and the theme's colours
// (styles/sidebar-pages.css); web pages in it, like an add-on's or a chatbot's, keep their own.
//
// Opening a panel grows it out from the sidebar like a drawer, the page making room as it does;
// closing one makes the page glide back over its place instead of jumping. In compact mode,
// closing one sends the sidebar off at once, on the same curve, so the two move together.

import { follow } from "./palette.mjs";

const GLIDE = "cubic-bezier(0.22, 1, 0.36, 1)"; // styles/aether.css, --aether-glide
const SHEETS = ["chrome://aether/content/styles/palettes.css", "chrome://aether/content/styles/sidebar-pages.css"];

export function init(win) {
  // The tools at the bottom of the sidebar show in full (styles/sidebar-tools.css).
  const main = win.document.querySelector("sidebar-main");
  main?.updateComplete.then(() => main.shadowRoot.append(Object.assign(
    win.document.createElementNS("http://www.w3.org/1999/xhtml", "link"),
    { rel: "stylesheet", href: "chrome://aether/content/styles/sidebar-tools.css" })));

  const doc = win.document;
  const box = doc.getElementById("sidebar-box");
  const page = doc.getElementById("tabbrowser-tabbox");
  const reducedMotion = win.matchMedia("(prefers-reduced-motion: reduce)");
  let closing = 0;
  // Where the page was when a panel started opening or closing: where it glides from. (Firefox
  // lays the window out again on the way, so by the time the panel shows or hides it's moved.)
  let from = null;
  for (const name of ["show", "hide", "toggle"]) {
    const firefox = win.SidebarController[name];
    win.SidebarController[name] = function (...args) {
      from = page.getBoundingClientRect().left;
      return firefox.apply(this, args);
    };
  }
  // Runs after the panel shows or hides but before the window is drawn.
  new win.MutationObserver(() => {
    if (box.hidden && doc.documentElement.hasAttribute("aether-compact")) {
      doc.documentElement.setAttribute("aether-panel-closed", "");
      win.clearTimeout(closing);
      closing = win.setTimeout(() => doc.documentElement.removeAttribute("aether-panel-closed"), 700);
    }
    const start = from ?? win.windowUtils.getBoundsWithoutFlushing(page).left;
    from = null;
    if (reducedMotion.matches) return;
    if (!box.hidden) {
      const width = `${box.getBoundingClientRect().width}px`;
      box.animate({ minWidth: ["0px", width], maxWidth: ["0px", width] }, { duration: 360, easing: GLIDE });
      return;
    }
    const dx = start - page.getBoundingClientRect().left;
    if (Math.abs(dx) >= 1) page.animate([{ translate: `${dx}px 0`, offset: 0 }], { duration: 360, easing: GLIDE });
  }).observe(box, { attributes: true, attributeFilter: ["hidden"] });

  // The sidebar's pages load in this process, so their events reach the window.
  win.addEventListener("DOMContentLoaded", event => {
    const page = event.target;
    const view = page.defaultView;
    if (!page.documentURI?.startsWith("chrome://") || view?.browsingContext?.embedderElement?.id !== "sidebar") return;
    for (const sheet of SHEETS) view.windowUtils.loadSheetUsingURIString(sheet, view.windowUtils.AUTHOR_SHEET);
    follow(page, view);
  }, true);
}

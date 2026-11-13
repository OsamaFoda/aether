// Sidebar panels in Aether's look. The panel is a card of glass beside the sidebar, lined up with
// it and the page (styles/aether.css, #sidebar-box). Firefox's own pages inside it (bookmarks,
// history, passwords, the customize page) get transparent backgrounds and the theme's colours
// (styles/sidebar-pages.css); web pages in it, like an add-on's or a chatbot's, keep their own.

import { follow } from "./palette.mjs";

const SHEETS = ["chrome://aether/content/styles/palettes.css", "chrome://aether/content/styles/sidebar-pages.css"];

export function init(win) {
  // The tools at the bottom of the sidebar show in full (styles/sidebar-tools.css).
  const main = win.document.querySelector("sidebar-main");
  main?.updateComplete.then(() => main.shadowRoot.append(Object.assign(
    win.document.createElementNS("http://www.w3.org/1999/xhtml", "link"),
    { rel: "stylesheet", href: "chrome://aether/content/styles/sidebar-tools.css" })));

  // The sidebar's pages load in this process, so their events reach the window.
  win.addEventListener("DOMContentLoaded", event => {
    const page = event.target;
    const view = page.defaultView;
    if (!page.documentURI?.startsWith("chrome://") || view?.browsingContext?.embedderElement?.id !== "sidebar") return;
    for (const sheet of SHEETS) view.windowUtils.loadSheetUsingURIString(sheet, view.windowUtils.AUTHOR_SHEET);
    follow(page, view);
  }, true);
}

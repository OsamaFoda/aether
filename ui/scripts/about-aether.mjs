// Aether Settings (settings/, every Aether setting on one page) at about:aether, and the ways to
// it: "Aether Settings" in the ≡ menu, "Aether" at the top of Firefox's own Settings, and
// "Aether Settings…" in the sidebar and toolbar right-click menus.

import { iconURL } from "./app-icon.mjs";

const PAGE = "chrome://aether/content/settings/settings.html";
const ABOUT = "about:aether";
const MENUS = ["toolbar-context-menu", "sidebar-context-menu"];

// about:aether serves the page itself, so it keeps the page's privileges and loads in this
// (the main) process, like about:preferences.
const aboutAether = {
  QueryInterface: ChromeUtils.generateQI(["nsIAboutModule"]),
  newChannel(uri, loadInfo) {
    const channel = Services.io.newChannelFromURIWithLoadInfo(Services.io.newURI(PAGE), loadInfo);
    channel.originalURI = uri;
    return channel;
  },
  getURIFlags: () => Ci.nsIAboutModule.ALLOW_SCRIPT | Ci.nsIAboutModule.IS_SECURE_CHROME_UI,
  getChromeURI: () => Services.io.newURI(PAGE),
};

try {
  Components.manager.QueryInterface(Ci.nsIComponentRegistrar).registerFactory(
    Components.ID("{6f1c7a52-3b0e-4f0a-9d5e-ae7e1e5c2a11}"),
    "about:aether",
    "@mozilla.org/network/protocol/about;1?what=aether",
    { createInstance: iid => aboutAether.QueryInterface(iid) },
  );
} catch {
  // Already registered this run.
}

export function init(win) {
  const doc = win.document;
  const open = () => win.switchToTabHavingURI(ABOUT, true);

  for (const id of MENUS) {
    const menu = doc.getElementById(id);
    if (!menu) continue;
    const item = doc.createXULElement("menuitem");
    item.setAttribute("label", "Aether Settings…");
    item.addEventListener("command", open);
    menu.prepend(item);
  }

  // The ≡ menu is built the first time it opens.
  win.addEventListener("ViewShowing", event => {
    if (event.target.id !== "appMenu-mainView" || doc.getElementById("appMenu-aether-settings")) return;
    const item = doc.createXULElement("toolbarbutton");
    item.id = "appMenu-aether-settings";
    item.className = "subviewbutton";
    item.setAttribute("label", "Aether Settings");
    item.addEventListener("command", () => {
      win.PanelUI.hide();
      open();
    });
    doc.getElementById("appMenu-settings-button")?.before(item);
  }, true);

  // Firefox's Settings page loads in this process, so its events reach the window.
  win.addEventListener("DOMContentLoaded", event => {
    const page = event.target;
    if (!/^about:(preferences|settings)/.test(page.documentURI ?? "")) return;
    const nav = page.getElementById("categories");
    if (!nav || page.getElementById("category-aether")) return;
    const button = page.createElement("moz-page-nav-button");
    button.id = "category-aether";
    button.setAttribute("iconsrc", iconURL());
    button.textContent = "Aether";
    button.addEventListener("click", clicked => {
      clicked.stopImmediatePropagation();
      page.location.href = ABOUT;
    }, true);
    nav.prepend(button);
  }, true);
}

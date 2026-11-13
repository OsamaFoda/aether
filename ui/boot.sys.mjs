// Applies Aether's interface to every browser window: stylesheets as soon as a window's
// document exists (so there's no flash of plain Firefox), scripts once the window is ready.

const BASE = "chrome://aether/content/";
const BROWSER_WINDOW = "chrome://browser/content/browser.xhtml";

const STYLES = ["styles/aether.css"];
const SCRIPTS = ["scripts/sidebar-urlbar.mjs", "scripts/tab-close.mjs", "scripts/new-tab-position.mjs", "scripts/compact-mode.mjs", "scripts/newtab.mjs", "scripts/peek.mjs", "scripts/workspaces.mjs", "scripts/split-view.mjs", "scripts/liquid-glass.mjs", "scripts/welcome.mjs"];

function addStyles(win) {
  for (const sheet of STYLES) {
    win.windowUtils.loadSheetUsingURIString(BASE + sheet, win.windowUtils.AUTHOR_SHEET);
  }
}

async function runScripts(win) {
  for (const script of SCRIPTS) {
    try {
      const module = ChromeUtils.importESModule(BASE + script);
      await module.init(win);
    } catch (e) {
      console.error(`Aether: ${script} failed`, e);
    }
  }
}

Services.obs.addObserver(subject => {
  subject.addEventListener("DOMContentLoaded", () => {
    if (subject.location.href === BROWSER_WINDOW) addStyles(subject);
  }, { once: true });
}, "domwindowopened");

Services.obs.addObserver(win => runScripts(win), "browser-delayed-startup-finished");

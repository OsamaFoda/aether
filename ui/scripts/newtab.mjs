// Makes ui/newtab/newtab.html the page for new tabs and new windows, and tells each window it's
// a starting page, so the address bar stays empty and ready to type in.

const NEW_TAB = "chrome://aether/content/newtab/newtab.html";

export function init(win) {
  const { AboutNewTab } = ChromeUtils.importESModule("resource:///modules/AboutNewTab.sys.mjs");
  if (AboutNewTab.newTabURL !== NEW_TAB) AboutNewTab.newTabURL = NEW_TAB;
  if (!win.gInitialPages.includes(NEW_TAB)) win.gInitialPages.push(NEW_TAB);
}

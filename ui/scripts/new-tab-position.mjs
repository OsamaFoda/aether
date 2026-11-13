// With vertical tabs, where a new tab (Ctrl+T, the + button) goes: to the top of the list, just
// below pinned tabs, like Zen, or to the end. The aether.newTabsAt pref ("top" or "bottom", in
// Aether Settings) decides, and the "+ New Tab" button moves to the same end (styles/aether.css,
// :root[aether-newtabs-top]). With top tabs new tabs always go at the end
// (browser.tabs.insertAfterCurrent is off in aether.cfg). Tabs opened from links are left where
// Firefox puts them.

const PREF = "aether.newTabsAt";
const VERTICAL_TABS = "sidebar.verticalTabs";

export function init(win) {
  const { gBrowser, BrowserCommands } = win;
  const atTop = () => Services.prefs.getBoolPref(VERTICAL_TABS, false) && Services.prefs.getStringPref(PREF, "top") === "top";

  const update = () => win.document.documentElement.toggleAttribute("aether-newtabs-top", atTop());
  Services.prefs.addObserver(PREF, update);
  Services.prefs.addObserver(VERTICAL_TABS, update);
  win.addEventListener("unload", () => {
    Services.prefs.removeObserver(PREF, update);
    Services.prefs.removeObserver(VERTICAL_TABS, update);
  }, { once: true });
  update();

  const firefoxOpenTab = BrowserCommands.openTab;
  BrowserCommands.openTab = function (options) {
    let opened = null;
    const onOpen = event => { opened ??= event.target; };
    gBrowser.tabContainer.addEventListener("TabOpen", onOpen);
    try {
      return firefoxOpenTab.call(this, options);
    } finally {
      gBrowser.tabContainer.removeEventListener("TabOpen", onOpen);
      if (opened && !opened.pinned && atTop()) {
        gBrowser.moveTabTo(opened, { tabIndex: gBrowser.pinnedTabCount, forceUngrouped: true });
      }
    }
  };
}

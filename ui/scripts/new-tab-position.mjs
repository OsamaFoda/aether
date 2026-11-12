// With vertical tabs, a new tab (Ctrl+T, the + button) goes to the top of the list, just below
// pinned tabs, like Zen. With top tabs it stays at the end (browser.tabs.insertAfterCurrent is
// off in aether.cfg). Tabs opened from links are left where Firefox puts them.

export function init(win) {
  const { gBrowser, BrowserCommands } = win;
  const firefoxOpenTab = BrowserCommands.openTab;

  BrowserCommands.openTab = function (options) {
    let opened = null;
    const onOpen = event => { opened ??= event.target; };
    gBrowser.tabContainer.addEventListener("TabOpen", onOpen);
    try {
      return firefoxOpenTab.call(this, options);
    } finally {
      gBrowser.tabContainer.removeEventListener("TabOpen", onOpen);
      if (opened && !opened.pinned && Services.prefs.getBoolPref("sidebar.verticalTabs", false)) {
        gBrowser.moveTabTo(opened, { tabIndex: gBrowser.pinnedTabCount, forceUngrouped: true });
      }
    }
  };
}

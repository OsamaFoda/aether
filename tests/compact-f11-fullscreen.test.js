// timeout: 45
// Full screen (F11) in compact mode, tabs down the side: the sidebar stays hidden, as in the
// window, and the left edge brings it out, sliding the page aside. A menu opened from the toolbar
// along the top leaves it hidden (that toolbar isn't on the sidebar there); a tab's menu holds it
// out. With compact mode off it's there as usual.
const wait = ms => new Promise(r => setTimeout(r, ms));
const root = document.documentElement;
const edge = document.getElementById("aether-edge");
const sidebar = document.getElementById("sidebar-container");
const page = document.getElementById("tabbrowser-tabbox");
Services.prefs.setBoolPref("sidebar.verticalTabs", true);
const result = {};
for (const compact of [true, false]) {
  Services.prefs.setBoolPref("aether.compactMode", compact);
  await wait(1200);
  window.fullScreen = true;
  await wait(2000);
  const r = { fullscreen: root.hasAttribute("inFullscreen"), sidebarRight: Math.round(sidebar.getBoundingClientRect().right),
    pageLeft: Math.round(page.getBoundingClientRect().left) };
  if (compact) {
    InspectorUtils.addPseudoClassLock(edge, ":hover");
    await wait(1000);
    r.outRight = Math.round(sidebar.getBoundingClientRect().right);
    r.outPageLeft = Math.round(page.getBoundingClientRect().left);
    InspectorUtils.removePseudoClassLock(edge, ":hover");
    await wait(1200);
    PanelUI.show();
    await wait(1000);
    r.appMenuRight = Math.round(sidebar.getBoundingClientRect().right);
    PanelUI.hide();
    await wait(1200);
    const tabMenu = document.getElementById("tabContextMenu");
    tabMenu.openPopup(gBrowser.selectedTab, { isContextMenu: true });
    await wait(1000);
    r.tabMenuRight = Math.round(sidebar.getBoundingClientRect().right);
    tabMenu.hidePopup();
    await wait(500);
  }
  window.fullScreen = false;
  await wait(1500);
  result[compact ? "compact" : "off"] = r;
}
const { compact: c, off: o } = result;
result.ok = c.fullscreen && c.sidebarRight <= 0 && c.pageLeft < 10 && c.outRight > 100 && c.outPageLeft >= c.outRight &&
  c.appMenuRight <= 0 && c.tabMenuRight > 100 &&
  o.sidebarRight > 100 && o.pageLeft >= o.sidebarRight;
return result;

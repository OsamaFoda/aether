// Menus and panels are tinted in the theme's colours in Standard too, and in Frosted Glass over the
// desktop (no wallpaper of Astrelle's own); they kept Firefox's plain white or grey.
const wait = ms => new Promise(r => setTimeout(r, ms));
const opened = (popup, open) => new Promise(r => {
  popup.addEventListener("popupshown", r, { once: true });
  open();
  setTimeout(r, 2000);
});
const closed = (popup, close) => new Promise(r => {
  popup.addEventListener("popuphidden", r, { once: true });
  close();
  setTimeout(r, 1000);
});
const probe = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
document.documentElement.append(probe);
const look = popup => {
  probe.style.backgroundColor = getComputedStyle(popup).getPropertyValue("--aether-menu");
  const content = getComputedStyle(popup.shadowRoot.querySelector("[part~='content']"));
  return { painted: content.backgroundColor, theme: getComputedStyle(probe).backgroundColor };
};
Services.prefs.setBoolPref("sidebar.verticalTabs", true);
const seen = {};
for (const [name, liquid, background] of [["standard", false, "wallpaper"], ["frostedOverDesktop", true, "desktop"]]) {
  Services.prefs.setBoolPref("aether.liquidGlass", liquid);
  Services.prefs.setStringPref("aether.background", background);
  await wait(800);
  const menu = document.getElementById("tabContextMenu");
  TabContextMenu.contextTab = gBrowser.selectedTab;
  await opened(menu, () => menu.openPopupAtScreen(100, 100, true));
  const contextMenu = look(menu);
  await closed(menu, () => menu.hidePopup());
  const panel = document.getElementById("appMenu-popup");
  await opened(panel, () => PanelUI.show());
  const mainMenu = look(panel);
  await closed(panel, () => PanelUI.hide());
  seen[name] = { contextMenu, mainMenu };
}
probe.remove();
const ok = Object.values(seen).every(s => Object.values(s).every(l => l.painted == l.theme));
return { ok, ...seen };

// timeout: 45
// New Tab's shortcuts are real links: the Tab key reaches them, right-clicking one gives the link
// menu, a middle-click opens one new tab (not two), a click opens the site in this tab and a
// Shift+click in a new window, as for any link.
const wait = ms => new Promise(r => setTimeout(r, ms));
const sites = ["one", "two"].map(name => ({ url: `data:text/html,<title>${name}</title>${name}`, title: name }));
Services.prefs.setStringPref("aether.newtab.pinned", JSON.stringify(sites));
await wait(800);
BrowserCommands.openTab();
await wait(1500);
const tab = gBrowser.selectedTab;
const page = gBrowser.selectedBrowser.contentWindow;
const doc = page.document;
const link = doc.querySelector(".link");
const href = link.getAttribute("href");

doc.getElementById("query").focus();
Services.focus.moveFocus(page, null, Services.focus.MOVEFOCUS_FORWARD, 0);
const tabReachesLink = Services.focus.focusedElement === link;

const at = element => {
  const box = element.getBoundingClientRect();
  return [box.left + box.width / 2, box.top + box.height / 2];
};
const mouse = (type, button) => page.synthesizeMouseEvent(type, ...at(link), { button, clickCount: 1 });
const menu = document.getElementById("contentAreaContextMenu");
const shown = new Promise(resolve => {
  menu.addEventListener("popupshown", () => resolve(true), { once: true });
  setTimeout(() => resolve(false), 2000);
});
mouse("contextmenu", 2);
const menuShown = await shown;
const linkMenu = menuShown && gContextMenu.onLink && !document.getElementById("context-openlinkintab").hidden;
if (menuShown) {
  menu.hidePopup();
  await wait(300);
}

const tabs = gBrowser.tabs.length;
for (const type of ["mousedown", "mouseup"]) mouse(type, 1);
await wait(1000);
const middleClickTabs = gBrowser.tabs.length - tabs;
gBrowser.selectedTab = tab;
await wait(300);

for (const type of ["mousedown", "mouseup"]) mouse(type, 0);
await wait(1500);
const clicked = { tabsAdded: gBrowser.tabs.length - tabs - middleClickTabs, url: tab.linkedBrowser.currentURI.spec };

BrowserCommands.openTab();
await wait(1500);
const again = gBrowser.selectedBrowser.contentWindow;
const windows = () => [...Services.wm.getEnumerator("navigator:browser")];
const before = windows().length;
again.document.querySelector(".link").dispatchEvent(new again.MouseEvent("click", { bubbles: true, cancelable: true, shiftKey: true }));
await wait(2000);
const shiftClick = { windowsAdded: windows().length - before, stayed: again.location.href.includes("newtab") };
windows().filter(w => w !== window).forEach(w => w.close());
return {
  ok: href === sites[0].url && tabReachesLink && linkMenu && middleClickTabs === 1 &&
    clicked.tabsAdded === 0 && clicked.url === sites[0].url && shiftClick.windowsAdded === 1 && shiftClick.stayed,
  href, tabReachesLink, menuShown, linkMenu, middleClickTabs, clicked, shiftClick,
};

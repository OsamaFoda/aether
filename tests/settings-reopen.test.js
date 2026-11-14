// Opening Astrelle Settings again (the right-click item, the sidebar's gear, the ≡ menu) goes back
// to the Settings tab already open, even after a jump link added a #section to its address.
const wait = ms => new Promise(r => setTimeout(r, ms));
const settingsTabs = () => gBrowser.tabs.filter(t => t.linkedBrowser.currentURI.spec.startsWith("about:astrelle")).length;
const fire = item => item.dispatchEvent(new CustomEvent("command", { bubbles: true }));
const item = [...document.getElementById("toolbar-context-menu").children].find(i => i.label === "Astrelle Settings…");
fire(item);
await wait(2500);
const doc = gBrowser.selectedBrowser.contentDocument;
doc.querySelector('nav.jump a[href="#look"]').click();
await wait(500);
const jumped = gBrowser.selectedBrowser.currentURI.spec;
const counts = {};
gBrowser.selectedTab = gBrowser.tabs[0];
fire(item);
await wait(1500);
counts.menuItem = settingsTabs();
gBrowser.selectedTab = gBrowser.tabs[0];
await SidebarController.show("viewCustomizeSidebar");
await wait(1500);
counts.gear = settingsTabs();
await PanelUI.show();
await wait(800);
gBrowser.selectedTab = gBrowser.tabs[0];
fire(document.getElementById("appMenu-aether-settings"));
await wait(1500);
counts.appMenu = settingsTabs();
return { ok: jumped === "about:astrelle#look" && Object.values(counts).every(n => n === 1), jumped, counts };

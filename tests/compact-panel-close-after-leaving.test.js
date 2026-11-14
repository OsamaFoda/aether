// Compact mode with a sidebar panel open: after switching apps and back, closing the panel by its
// shortcut (Ctrl+H here) lets the sidebar go, as it does without the trip away. The panel was
// what held it out, not the bars being kept out while you were away.
Services.prefs.setBoolPref("sidebar.verticalTabs", true);
Services.prefs.setBoolPref("aether.compactMode", true);
const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(1000);
await SidebarController.show("viewHistorySidebar");
await wait(1200);
gBrowser.selectedBrowser.focus();
window.dispatchEvent(new Event("deactivate"));
await wait(500);
window.dispatchEvent(new Event("activate"));
await wait(600);
SidebarController.toggle("viewHistorySidebar");
await wait(1500);
const right = document.getElementById("sidebar-container").getBoundingClientRect().right;
return { ok: right <= 0, sidebarRight: right };

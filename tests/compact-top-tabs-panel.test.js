// timeout: 45
// Compact mode with tabs on top and a sidebar panel open: the panel keeps the page's 8px gap from
// the top edge, and when the toolbar comes down it moves down with the page instead of having its
// header (title, close button, search) covered.
const wait = ms => new Promise(r => setTimeout(r, ms));
Services.prefs.setBoolPref("sidebar.verticalTabs", false);
Services.prefs.setBoolPref("aether.compactMode", true);
await wait(1500);
await SidebarController.show("viewHistorySidebar");
await wait(1500);
const box = document.getElementById("sidebar-box");
const toolbox = document.getElementById("navigator-toolbox");
const page = document.getElementById("tabbrowser-tabbox");
const topWhenHidden = Math.round(box.getBoundingClientRect().top);
document.documentElement.setAttribute("aether-hold", ""); // the toolbar brought down
await wait(1000);
const bar = Math.round(toolbox.getBoundingClientRect().bottom);
const b = box.getBoundingClientRect();
const topWhenOut = Math.round(b.top);
const pageTop = Math.round(page.getBoundingClientRect().top);
const hit = document.elementFromPoint(b.left + 20, b.top + 10);
document.documentElement.removeAttribute("aether-hold");
SidebarController.hide();
await wait(500);
Services.prefs.setBoolPref("aether.compactMode", false);
const ok = topWhenHidden === 8 && topWhenOut >= bar && topWhenOut === pageTop && box.contains(hit);
return { ok, topWhenHidden, topWhenOut, toolbarBottom: bar, pageTop, hit: hit?.id || hit?.localName };

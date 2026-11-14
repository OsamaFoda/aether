// Compact mode: with a sidebar panel open, touching the sidebar doesn't slide the page away from
// the panel (which opened a gap); with no panel, it still slides the page aside.
Services.prefs.setBoolPref("sidebar.verticalTabs", true);
Services.prefs.setBoolPref("aether.liquidGlass", true);
Services.prefs.setBoolPref("aether.compactMode", true);
const wait = ms => new Promise(r => setTimeout(r, ms));
const root = document.documentElement;
const page = document.getElementById("tabbrowser-tabbox");
await wait(1000);
root.setAttribute("aether-hold", "");
await wait(800);
const slidesWithoutPanel = getComputedStyle(page).transform !== "none";
root.removeAttribute("aether-hold");
await SidebarController.show("viewHistorySidebar");
await wait(1200);
root.setAttribute("aether-hold", "");
await wait(800);
const staysWithPanel = getComputedStyle(page).transform === "none";
root.removeAttribute("aether-hold");
return { ok: slidesWithoutPanel && staysWithPanel, slidesWithoutPanel, staysWithPanel };

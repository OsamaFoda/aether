// timeout: 60
// Compact mode, a sidebar made wider or narrower than usual: a new window (or one restored after
// a restart), which opens in compact mode, slides the page aside by the sidebar's real width, so
// it neither covers the sidebar nor leaves an empty strip beside it.
const wait = ms => new Promise(r => setTimeout(r, ms));
Services.prefs.setBoolPref("sidebar.verticalTabs", true);
Services.prefs.setBoolPref("aether.compactMode", false);
await wait(1200);
SidebarController._state.expandedLauncherWidth = 320; // what dragging its edge leaves
await wait(800);
Services.prefs.setBoolPref("aether.compactMode", true);
await wait(800);
const w2 = OpenBrowserWindow();
await new Promise(r => w2.addEventListener("load", r, { once: true }));
await wait(3000);
const d2 = w2.document;
const width = d2.getElementById("sidebar-container").getBoundingClientRect().width;
const told = d2.documentElement.style.getPropertyValue("--aether-sidebar-width");
w2.close();
Services.prefs.setBoolPref("aether.compactMode", false);
return { ok: Math.round(width) === 320 && told === "320px", width, told };

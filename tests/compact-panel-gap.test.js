// Compact mode: with a sidebar panel open, the panel card sits 8px from the sidebar, in Standard and Frosted Glass.
Services.prefs.setBoolPref("sidebar.verticalTabs", true);
const wait = ms => new Promise(r => setTimeout(r, ms));
const rect = id => document.getElementById(id).getBoundingClientRect();
const out = {};
for (const liquid of [false, true]) {
  Services.prefs.setBoolPref("aether.liquidGlass", liquid);
  Services.prefs.setBoolPref("aether.compactMode", true);
  await wait(1500);
  await SidebarController.show("viewHistorySidebar");
  await wait(1200);
  out[liquid ? "glass" : "standard"] = Math.round(rect("sidebar-box").left - rect("sidebar-container").right);
  SidebarController.hide();
  await wait(1000);
}
Services.prefs.setBoolPref("aether.compactMode", false);
return { ok: out.standard === 8 && out.glass === 8, ...out };

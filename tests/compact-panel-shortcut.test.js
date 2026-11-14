// Compact mode: opening a panel by shortcut (Ctrl+H) with the sidebar hidden brings the sidebar out alongside it, not after a pause.
Services.prefs.setBoolPref("sidebar.verticalTabs", true);
const wait = ms => new Promise(r => setTimeout(r, ms));
const side = document.getElementById("sidebar-container");
const out = {};
for (const liquid of [false, true]) {
  Services.prefs.setBoolPref("aether.liquidGlass", liquid);
  Services.prefs.setBoolPref("aether.compactMode", true);
  await wait(1500);
  const hidden = Math.round(side.getBoundingClientRect().right);
  document.getElementById("key_gotoHistory").doCommand();
  await wait(320);
  out[liquid ? "glass" : "standard"] = { hidden, at320ms: Math.round(side.getBoundingClientRect().left) };
  SidebarController.hide();
  await wait(1000);
}
Services.prefs.setBoolPref("aether.compactMode", false);
const ok = Object.values(out).every(o => o.hidden <= 0 && o.at320ms >= 0);
return { ok, ...out };

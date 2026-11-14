// Compact mode switched on after you've been to another app and back: the bars hide, rather
// than staying out as if they'd been kept out while you were away (they were only out because
// compact mode was off). Both with tabs down the side and on top.
const wait = ms => new Promise(r => setTimeout(r, ms));
const root = document.documentElement;
const result = { ok: true };
for (const vertical of [true, false]) {
  Services.prefs.setBoolPref("aether.compactMode", false);
  Services.prefs.setBoolPref("sidebar.verticalTabs", vertical);
  await wait(1200);
  gBrowser.selectedBrowser.focus();
  window.dispatchEvent(new Event("deactivate"));
  await wait(300);
  window.dispatchEvent(new Event("activate"));
  await wait(600);
  Services.prefs.setBoolPref("aether.compactMode", true);
  await wait(1500);
  const bars = document.getElementById(vertical ? "sidebar-container" : "navigator-toolbox").getBoundingClientRect();
  const hidden = vertical ? bars.right <= 0 : bars.bottom <= 0;
  result[vertical ? "verticalHidden" : "topHidden"] = hidden;
  result.ok &&= hidden;
}
Services.prefs.setBoolPref("aether.compactMode", false);
return result;

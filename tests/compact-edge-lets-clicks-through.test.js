// timeout: 45
// Compact mode, bars brought out from the edge: a click flung to the very edge of the window
// reaches what's there (a tab, the window's close button) rather than the strip that brought
// them out. In Frosted Glass the sidebar floats clear of the left edge, so the strip stays.
const wait = ms => new Promise(r => setTimeout(r, ms));
const edge = document.getElementById("aether-edge");
const result = { ok: true };
for (const [name, vertical, liquid] of [["top", false, false], ["vertical", true, false], ["frostedVertical", true, true]]) {
  Services.prefs.setBoolPref("aether.liquidGlass", liquid);
  Services.prefs.setBoolPref("sidebar.verticalTabs", vertical);
  Services.prefs.setBoolPref("aether.compactMode", true);
  await wait(1500);
  InspectorUtils.addPseudoClassLock(edge, ":hover"); // the mouse at the edge
  await wait(1000);
  const r = gBrowser.selectedTab.getBoundingClientRect();
  const hit = vertical ? document.elementFromPoint(2, r.top + r.height / 2) : document.elementFromPoint(r.left + r.width / 2, 2);
  InspectorUtils.removePseudoClassLock(edge, ":hover");
  const onStrip = hit === edge;
  result[name] = hit?.id || hit?.localName;
  result.ok &&= liquid ? onStrip : !onStrip && gBrowser.selectedTab.contains(hit);
}
Services.prefs.setBoolPref("aether.compactMode", false);
return result;

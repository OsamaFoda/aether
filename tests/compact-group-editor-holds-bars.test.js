// timeout: 45
// Compact mode: naming a new tab group (or editing one) holds the sidebar, or the top toolbar, out
// while its panel is open, so the panel stays next to the group it's about rather than floating
// at the window's edge.
const wait = ms => new Promise(r => setTimeout(r, ms));
const result = { ok: true };
for (const vertical of [true, false]) {
  Services.prefs.setBoolPref("sidebar.verticalTabs", vertical);
  Services.prefs.setBoolPref("aether.compactMode", true);
  await wait(1500);
  const tab = gBrowser.addTab("about:blank", { triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal() });
  await wait(300);
  gBrowser.addTabGroup([tab], { isUserTriggered: true }); // "Add Tab to New Group"
  await wait(1500);
  const panel = document.getElementById("tab-group-editor")?.panel;
  const bars = document.getElementById(vertical ? "sidebar-container" : "navigator-toolbox").getBoundingClientRect();
  const r = { panel: panel?.state, out: vertical ? bars.left >= 0 : bars.top >= 0 };
  result[vertical ? "vertical" : "top"] = r;
  result.ok &&= r.panel === "open" && r.out;
  panel?.hidePopup();
  await wait(500);
  gBrowser.removeTabGroup(tab.group);
  await wait(500);
}
Services.prefs.setBoolPref("aether.compactMode", false);
return result;

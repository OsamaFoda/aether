// Gaps around the page card are 8px, never wider: in compact mode with the sidebar hidden, on
// every side (the sidebar's resize splitter used to stay behind, making the left one 12px), and
// in Frosted Glass between the docked sidebar and the page.
const wait = ms => new Promise(r => setTimeout(r, ms));
const page = document.getElementById("tabbrowser-tabbox");
const sidebar = document.getElementById("sidebar-container");
Services.prefs.setBoolPref("sidebar.verticalTabs", true);
const result = { ok: true };
for (const liquid of [false, true]) {
  Services.prefs.setBoolPref("aether.liquidGlass", liquid);
  Services.prefs.setBoolPref("aether.compactMode", true);
  await wait(1500);
  const p = page.getBoundingClientRect();
  const gaps = [p.left, p.top, innerWidth - p.right, innerHeight - p.bottom].map(Math.round);
  result[liquid ? "frostedCompact" : "standardCompact"] = gaps;
  result.ok &&= gaps.every(g => g === 8);
  // Brought out, the page sits beside the sidebar as it does docked: 8px away, 4px in Standard.
  document.documentElement.setAttribute("aether-hold", "");
  await wait(1000);
  const beside = Math.round(page.getBoundingClientRect().left - sidebar.getBoundingClientRect().right);
  document.documentElement.removeAttribute("aether-hold");
  result[liquid ? "frostedRevealed" : "standardRevealed"] = beside;
  result.ok &&= beside === (liquid ? 8 : 4);
  if (liquid) {
    Services.prefs.setBoolPref("aether.compactMode", false);
    await wait(1500);
    const gap = Math.round(page.getBoundingClientRect().left - sidebar.getBoundingClientRect().right);
    result.frostedDocked = gap;
    result.ok &&= gap === 8;
  }
}
Services.prefs.setBoolPref("aether.compactMode", false);
return result;

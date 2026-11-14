// Flicking back to a tab whose highlight is still sliding: the new slide starts where the glass
// was, on the tab you just left, with no jump (vertical tabs and top tabs).
const wait = ms => new Promise(r => setTimeout(r, ms));
const frame = () => new Promise(r => requestAnimationFrame(r));
const system = Services.scriptSecurityManager.getSystemPrincipal();
const rect = glass => glass.getBoundingClientRect();
await wait(1000);
for (let i = 0; i < 7; i++) gBrowser.addTab(`data:text/html,<title>t${i}</title>x`, { triggeringPrincipal: system });
const seen = [];
for (const vertical of [true, false]) {
  Services.prefs.setBoolPref("sidebar.verticalTabs", vertical);
  await wait(1500);
  const tabs = gBrowser.tabs.slice(1);
  gBrowser.selectedTab = tabs[0];
  await wait(900);
  gBrowser.selectedTab = tabs[6];
  await wait(90);
  gBrowser.selectedTab = tabs[2];
  await wait(90);
  await frame();
  const left = rect(tabs[2].querySelector(".tab-background"));
  const glass = tabs[6].querySelector(".tab-background");
  gBrowser.selectedTab = tabs[6];
  await frame();
  const first = rect(glass);
  // Where it was when you left, along the way the tabs run.
  const jump = Math.round(vertical ? Math.abs(first.top - left.top) : Math.abs(first.left - left.left));
  seen.push({ vertical, jump });
  await wait(800);
}
return { ok: seen.every(s => s.jump <= 20), seen };

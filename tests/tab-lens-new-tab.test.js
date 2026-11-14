// With top tabs, a new tab (Ctrl+T, the + button) is still opening when it's selected: its glass
// slides over from the tab you were on without growing wider than the tab itself.
const wait = ms => new Promise(r => setTimeout(r, ms));
const frame = () => new Promise(r => requestAnimationFrame(r));
const system = Services.scriptSecurityManager.getSystemPrincipal();
Services.prefs.setBoolPref("sidebar.verticalTabs", false);
await wait(1000);
for (let i = 0; i < 5; i++) gBrowser.addTab(`data:text/html,<title>t${i}</title>x`, { triggeringPrincipal: system });
await wait(800);
gBrowser.selectedTab = gBrowser.tabs[2];
await wait(1000);
BrowserCommands.openTab();
const glass = gBrowser.selectedTab.querySelector(".tab-background");
const widths = [];
const started = performance.now();
while (performance.now() - started < 800) {
  await frame();
  widths.push(Math.round(glass.getBoundingClientRect().width));
}
const final = glass.getBoundingClientRect().width;
const widest = Math.max(...widths);
return { ok: widest <= final * 1.2, widest, final: Math.round(final), widths: widths.slice(0, 12) };

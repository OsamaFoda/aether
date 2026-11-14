// With vertical tabs the highlight slides from the tab you were on to the one you land on, also
// when a new tab goes to the top of the list and when you close the tab you're on.
const wait = ms => new Promise(r => setTimeout(r, ms));
const frame = () => new Promise(r => requestAnimationFrame(r));
const system = Services.scriptSecurityManager.getSystemPrincipal();
const follow = async glass => {
  const tops = [];
  const started = performance.now();
  while (performance.now() - started < 700) {
    await frame();
    tops.push(Math.round(glass.getBoundingClientRect().top));
  }
  return tops;
};
// Every frame lies between where the glass left from and where it lands (give or take the spring).
const between = (tops, from, to) => tops.every(top => top >= Math.min(from, to) - 8 && top <= Math.max(from, to) + 8);
Services.prefs.setBoolPref("sidebar.verticalTabs", true);
Services.prefs.setStringPref("aether.newTabsAt", "top");
await wait(1000);
for (let i = 0; i < 5; i++) gBrowser.addTab(`data:text/html,<title>t${i}</title>x`, { triggeringPrincipal: system });
await wait(1500);

gBrowser.selectedTab = gBrowser.tabs[3];
await wait(1000);
let from = Math.round(gBrowser.tabs[3].querySelector(".tab-background").getBoundingClientRect().top);
BrowserCommands.openTab();
let glass = gBrowser.selectedTab.querySelector(".tab-background");
let tops = await follow(glass);
const opened = { from, to: Math.round(glass.getBoundingClientRect().top), first: tops.slice(0, 6) };
opened.ok = gBrowser.selectedTab._tPos === 0 && between(tops, opened.from, opened.to);
gBrowser.removeTab(gBrowser.selectedTab, { animate: false });
await wait(500);

const [used, closing] = [gBrowser.tabs[5], gBrowser.tabs[2]];
gBrowser.selectedTab = used;
await wait(900);
gBrowser.selectedTab = closing;
await wait(900);
from = Math.round(closing.querySelector(".tab-background").getBoundingClientRect().top);
BrowserCommands.closeTabOrWindow();
glass = gBrowser.selectedTab.querySelector(".tab-background");
tops = await follow(glass);
const closed = { from, to: Math.round(glass.getBoundingClientRect().top), first: tops.slice(0, 6) };
closed.ok = gBrowser.selectedTab === used && between(tops, closed.from, closed.to);
return { ok: opened.ok && closed.ok, opened, closed };

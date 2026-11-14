// Closing the tab you're on goes back to the tab you used before it, not to a link you opened in
// the background and never looked at.
const wait = ms => new Promise(r => setTimeout(r, ms));
const system = Services.scriptSecurityManager.getSystemPrincipal();
const page = title => `data:text/html,<title>${title}</title>${title}`;
await wait(1000);
const [a, b, c] = ["A", "B", "C"].map(title => gBrowser.addTab(page(title), { triggeringPrincipal: system }));
await wait(1500);
for (const tab of [a, b, c]) {
  gBrowser.selectedTab = tab;
  await wait(700);
}
// What "Open Link in New Tab" (and a middle-click) does.
for (const title of ["link1", "link2"]) {
  openLinkIn(page(title), "tab", { triggeringPrincipal: system, relatedToCurrent: true, inBackground: true });
  await wait(500);
}
await wait(500);
const stillOnC = gBrowser.selectedTab === c;
BrowserCommands.closeTabOrWindow();
await wait(500);
const landedOn = gBrowser.selectedTab.label;
return { ok: stillOnC && landedOn === "B", stillOnC, landedOn, tabs: gBrowser.tabs.map(t => t.label) };

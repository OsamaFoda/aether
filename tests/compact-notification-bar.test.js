// timeout: 60
// Compact mode: a notification bar (like "pop-up blocked") for the tab you're on brings the bars
// out, where it sits, rather than appearing off-screen with them; a bar for another tab doesn't,
// and clicking the page lets them go again. With vertical tabs and with top tabs.
const wait = ms => new Promise(r => setTimeout(r, ms));
const root = document.documentElement;
const out = (vertical) => vertical
  ? document.getElementById("sidebar-container").getBoundingClientRect().right > 0
  : document.getElementById("navigator-toolbox").getBoundingClientRect().bottom > 0;
const notify = (box, value) => box.appendNotification(value, {
  label: "Astrelle prevented this site from opening a pop-up window.",
  priority: box.PRIORITY_WARNING_MEDIUM,
}, [{ label: "Options", callback: () => true }]);
const seen = {};
const other = gBrowser.addTab("about:blank", { triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal() });
for (const vertical of [true, false]) {
  Services.prefs.setBoolPref("sidebar.verticalTabs", vertical);
  Services.prefs.setBoolPref("aether.compactMode", true);
  await wait(1500);
  const hiddenAtFirst = !out(vertical);
  const background = await notify(gBrowser.getNotificationBox(other.linkedBrowser), "aether-test-background");
  await wait(1200);
  const hiddenForOtherTab = !out(vertical);
  const bar = await notify(gBrowser.getNotificationBox(), "aether-test");
  await wait(1200);
  const outForThisTab = out(vertical);
  window.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  gBrowser.selectedBrowser.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  await wait(1500);
  const goneAfterClick = !out(vertical);
  gBrowser.getNotificationBox().removeNotification(bar);
  gBrowser.getNotificationBox(other.linkedBrowser).removeNotification(background);
  Services.prefs.setBoolPref("aether.compactMode", false);
  root.removeAttribute("aether-kept");
  await wait(800);
  seen[vertical ? "vertical" : "top"] = { hiddenAtFirst, hiddenForOtherTab, outForThisTab, goneAfterClick };
}
gBrowser.removeTab(other);
const ok = Object.values(seen).every(s => Object.values(s).every(Boolean));
return { ok, ...seen };

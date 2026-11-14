// timeout: 60
// A site's popup window (a sign-in popup: window.open with a size, so no toolbar) has no sidebar,
// as in Firefox: no tab list or address bar taking half of it, and in compact mode no edge that
// slides one out. Opened here with the features Firefox gives such a popup.
const wait = ms => new Promise(r => setTimeout(r, ms));
Services.prefs.setBoolPref("sidebar.verticalTabs", true);
const result = { ok: true };
for (const compact of [false, true]) {
  Services.prefs.setBoolPref("aether.compactMode", compact);
  await wait(1000);
  const opened = new Promise(resolve => {
    const observe = (subject, topic) => {
      Services.obs.removeObserver(observe, topic);
      resolve(subject);
    };
    Services.obs.addObserver(observe, "browser-delayed-startup-finished");
  });
  const url = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
  url.data = "about:blank";
  Services.ww.openWindow(null, AppConstants.BROWSER_CHROME_URL, "_blank", "chrome,dialog=no,width=560,height=420,resizable,scrollbars,status", url);
  const popup = await Promise.race([opened, wait(10000)]);
  if (!popup) return { ok: false, error: "no popup opened" };
  await wait(2000);
  const d = popup.document;
  const sidebar = d.getElementById("sidebar-container").getBoundingClientRect();
  const page = d.getElementById("tabbrowser-tabbox").getBoundingClientRect();
  const r = {
    sidebarWidth: Math.round(sidebar.width),
    pageLeft: Math.round(page.left),
    urlbarInSidebar: d.documentElement.hasAttribute("aether-urlbar-in-sidebar"),
    edge: popup.getComputedStyle(d.getElementById("aether-edge")).display,
  };
  result[compact ? "compact" : "off"] = r;
  result.ok &&= r.sidebarWidth === 0 && r.pageLeft < 20 && !r.urlbarInSidebar && r.edge === "none";
  popup.close();
  await wait(800);
}
Services.prefs.setBoolPref("aether.compactMode", false);
return result;

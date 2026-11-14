// The address bar's list of suggestions stays open (not closed and opened again) while another
// window has the focus, and closes if you come back by clicking the page.
Services.prefs.setBoolPref("sidebar.verticalTabs", true);
Services.prefs.setBoolPref("aether.compactMode", true);
const wait = ms => new Promise(r => setTimeout(r, ms));
const other = OpenBrowserWindow();
await new Promise(r => other.addEventListener("load", r, { once: true }));
await wait(1000);
window.focus();
await wait(500);
gURLBar.focus();
gURLBar.value = "hello wor";
gURLBar.startQuery({ searchString: "hello wor" });
await wait(800);
const openBefore = gURLBar.view.isOpen;
other.focus();
await wait(800);
const openWhileAway = gURLBar.view.isOpen;
window.focus();
await wait(800);
const openOnReturn = gURLBar.view.isOpen && gURLBar.value === "hello wor";
other.focus();
await wait(800);
window.focus();
gBrowser.selectedBrowser.focus();
await wait(800);
const closedAfterPageClick = !gURLBar.view.isOpen;
other.close();
return {
  ok: openBefore && openWhileAway && openOnReturn && closedAfterPageClick,
  openBefore, openWhileAway, openOnReturn, closedAfterPageClick,
};

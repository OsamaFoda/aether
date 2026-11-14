// Split view opens Astrelle's New Tab page beside the tab (not Firefox's about:opentabs), and the
// address strip under a pane is left off Astrelle's own pages but kept for websites.
const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(1000);
BrowserCommands.addTabSplitView();
await wait(1500);
const split = Boolean(gBrowser.selectedTab.splitview);
const url = gBrowser.selectedBrowser.currentURI.spec;
const footers = () => [...document.querySelectorAll("split-view-footer")].map(f => f.hasAttribute("aether-own-page"));
const ownPages = footers();
gBrowser.selectedBrowser.loadURI(Services.io.newURI("data:text/html,<title>t</title>hi"), {
  triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
});
await wait(1500);
const afterWebsite = footers();
return {
  ok: split && url === "chrome://aether/content/newtab/newtab.html" && ownPages.every(Boolean) && afterWebsite.includes(false),
  split, url, ownPages, afterWebsite,
};

// Astrelle Settings opens at about:astrelle, and still at the old about:aether.
const wait = ms => new Promise(r => setTimeout(r, ms));
const headings = {};
for (const url of ["about:astrelle", "about:aether"]) {
  const tab = gBrowser.addTrustedTab(url);
  gBrowser.selectedTab = tab;
  await wait(2000);
  headings[url] = tab.linkedBrowser.contentDocument?.querySelector("h1")?.textContent;
}
return { ok: Object.values(headings).every(h => h === "Astrelle Settings"), headings };

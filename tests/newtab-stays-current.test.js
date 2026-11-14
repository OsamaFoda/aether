// timeout: 60
// An open New Tab page keeps its shortcuts current: a pin or removal made on another New Tab page
// shows on it, and sites visited since show when it comes back into view.
const wait = ms => new Promise(r => setTimeout(r, ms));
async function addVisits(list) {
  const now = Date.now();
  await PlacesUtils.history.insertMany(list.map(({ url, title, n }) => ({ url, title,
    visits: Array.from({ length: n }, (_, k) => ({ date: new Date(now - (k + 1) * 60000), transition: PlacesUtils.history.TRANSITIONS.TYPED })) })));
  await Cc["@mozilla.org/places/frecency-recalculator;1"].getService(Ci.nsIObserver).wrappedJSObject.recalculateAnyOutdatedFrecencies();
}
const newTab = async () => {
  BrowserCommands.openTab();
  await wait(1500);
  return gBrowser.selectedBrowser.contentWindow;
};
const titles = page => [...page.document.querySelectorAll(".tile")]
  .map(tile => tile.querySelector(".title").textContent + (tile.hasAttribute("pinned") ? " [pinned]" : ""));
await wait(800);
await addVisits(Array.from({ length: 6 }, (_, i) => ({ url: `https://site${i}.example/`, title: `Site ${i}`, n: 30 - i })));
const a = await newTab();
const tabA = gBrowser.selectedTab;
const b = await newTab();
const tileB = title => [...b.document.querySelectorAll(".tile")].find(tile => tile.querySelector(".title").textContent === title);
tileB("Site 3").querySelector(".pin").click();
await wait(500);
tileB("Site 0").querySelector(".remove").click();
await wait(500);
const inB = titles(b);
gBrowser.selectedTab = tabA;
await wait(800);
const inA = titles(a);

await addVisits([{ url: "https://fresh.example/", title: "Fresh", n: 80 }]);
gBrowser.selectedTab = gBrowser.tabs[0];
await wait(300);
gBrowser.selectedTab = tabA;
await wait(800);
const afterVisits = titles(a);
return {
  ok: inB[0] === "Site 3 [pinned]" && !inB.includes("Site 0") && inA.join() === inB.join() &&
    afterVisits.includes("Fresh") && !afterVisits.includes("Site 0"),
  inB, inA, afterVisits,
};

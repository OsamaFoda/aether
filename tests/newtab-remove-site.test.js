// timeout: 60
// Removing a shortcut removes its site: another page of the same site doesn't take its place, now
// or after more visits to it.
const wait = ms => new Promise(r => setTimeout(r, ms));
async function addVisits(list) {
  const now = Date.now();
  await PlacesUtils.history.insertMany(list.map(({ url, title, n }) => ({ url, title,
    visits: Array.from({ length: n }, (_, k) => ({ date: new Date(now - (k + 1) * 60000), transition: PlacesUtils.history.TRANSITIONS.TYPED })) })));
  await Cc["@mozilla.org/places/frecency-recalculator;1"].getService(Ci.nsIObserver).wrappedJSObject.recalculateAnyOutdatedFrecencies();
}
const hosts = page => [...page.document.querySelectorAll(".link")].map(link => new URL(link.title).hostname);
await wait(800);
await addVisits([
  { url: "https://video.example/", title: "Video", n: 40 },
  { url: "https://video.example/watch?v=abc", title: "Some video", n: 8 },
  ...[0, 1, 2].map(i => ({ url: `https://site${i}.example/`, title: `Site ${i}`, n: 30 - i })),
]);
BrowserCommands.openTab();
await wait(1500);
let page = gBrowser.selectedBrowser.contentWindow;
const before = hosts(page);
[...page.document.querySelectorAll(".tile")].find(tile => tile.querySelector(".link").title === "https://video.example/")
  .querySelector(".remove").click();
await wait(800);
const afterRemove = hosts(page);
await addVisits([{ url: "https://video.example/watch?v=abc", title: "Some video", n: 60 }]);
page.location.reload();
await wait(1500);
page = gBrowser.selectedBrowser.contentWindow;
const afterVisits = hosts(page);
return {
  ok: before.includes("video.example") && !afterRemove.includes("video.example") &&
    !afterVisits.includes("video.example") && afterVisits.includes("site0.example"),
  before, afterRemove, afterVisits,
};

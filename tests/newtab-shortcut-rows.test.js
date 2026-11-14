// timeout: 60
// Eight shortcuts fill whole rows (8, 4 + 4 or 2 × 4) at any window size, rather than a row of 7
// with the eighth alone under it, and no tile runs past the page's column.
const wait = ms => new Promise(r => setTimeout(r, ms));
const now = Date.now();
await wait(800);
await PlacesUtils.history.insertMany(Array.from({ length: 12 }, (_, i) => ({
  url: `https://site${i}.example/`, title: `Site ${i} with a longer name`,
  visits: Array.from({ length: 30 - i }, (_, k) => ({ date: new Date(now - (k + 1) * 60000), transition: PlacesUtils.history.TRANSITIONS.TYPED })),
})));
await Cc["@mozilla.org/places/frecency-recalculator;1"].getService(Ci.nsIObserver).wrappedJSObject.recalculateAnyOutdatedFrecencies();
BrowserCommands.openTab();
await wait(1500);
const page = gBrowser.selectedBrowser.contentWindow;
const doc = page.document;
const measure = () => {
  const main = doc.querySelector("main").getBoundingClientRect();
  const rows = {};
  let inside = true;
  for (const tile of doc.querySelectorAll(".tile")) {
    const box = tile.getBoundingClientRect();
    rows[Math.round(box.top)] = (rows[Math.round(box.top)] || 0) + 1;
    for (const part of tile.querySelectorAll(".link, .title")) {
      const r = part.getBoundingClientRect();
      if (r.left < box.left - 0.5 || r.right > box.right + 0.5) inside = false;
    }
    if (box.left < main.left - 0.5 || box.right > main.right + 0.5) inside = false;
  }
  return { page: page.innerWidth, perRow: Object.values(rows).join("+"), inside };
};
const seen = [];
for (const width of [1280, 1600, 1000, 900, 800, 600, 450]) {
  window.resizeTo(width, 800);
  await wait(700);
  seen.push(measure());
}
const whole = ["8", "4+4", "2+2+2+2"];
return { ok: seen.every(s => whole.includes(s.perRow) && s.inside), seen };

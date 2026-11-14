// timeout: 45
// A zoomed New Tab page (Ctrl + / Ctrl -) still draws the window's wallpaper at the window's size
// and place, so it carries on from the one around the page instead of growing with the zoom.
const wait = ms => new Promise(r => setTimeout(r, ms));
Services.prefs.setBoolPref("aether.liquidGlass", true);
Services.prefs.setStringPref("aether.background", "wallpaper");
await wait(800);
BrowserCommands.openTab();
await wait(1500);
const browser = gBrowser.selectedBrowser;
const page = browser.contentWindow;
// The page's wallpaper box, and where it should be, in the window's own pixels.
const measure = () => {
  const box = page.getComputedStyle(page.document.body, "::before");
  const scale = page.devicePixelRatio / window.devicePixelRatio;
  const at = browser.getBoundingClientRect();
  return {
    zoom: Math.round(ZoomManager.getZoomForBrowser(browser) * 100),
    drawn: [box.left, box.top, box.width, box.height].map(v => Math.round(parseFloat(v) * scale)),
    wanted: [-at.left, -at.top, window.innerWidth, window.innerHeight].map(Math.round),
  };
};
const close = ({ drawn, wanted }) => drawn.every((v, i) => Math.abs(v - wanted[i]) <= 2);
const normal = measure();
FullZoom.enlarge();
FullZoom.enlarge();
await wait(1000);
const zoomed = measure();
FullZoom.reset();
await wait(300);
return { ok: zoomed.zoom > 100 && close(normal) && close(zoomed), normal, zoomed };

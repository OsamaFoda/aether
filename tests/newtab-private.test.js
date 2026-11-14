// timeout: 45
// A New Tab page in a private window is purple like the window around it, and shows the theme's
// wallpaper rather than the chosen picture, as the private window does.
const wait = ms => new Promise(r => setTimeout(r, ms));
Services.prefs.setStringPref("aether.palette", "ocean");
Services.prefs.setBoolPref("aether.liquidGlass", true);
Services.prefs.setStringPref("aether.background", "wallpaper");
Services.prefs.setStringPref("aether.wallpaper", "file:///tmp/aether-private-test.svg");
await wait(800);
const pw = OpenBrowserWindow({ private: true });
await new Promise(r => pw.addEventListener("load", r, { once: true }));
await wait(2000);
pw.BrowserCommands.openTab();
await wait(1500);
const page = pw.gBrowser.selectedBrowser.contentWindow;
const root = page.document.documentElement;
const style = (win, name) => win.getComputedStyle(win.document.documentElement).getPropertyValue(name).trim();
// The window's purple (styles/aether.css), for the light or dark the page itself is drawn in: in
// the hidden test browser the window and its pages needn't agree on that.
const dark = page.matchMedia("(prefers-color-scheme: dark)").matches;
const purple = dark ? { sky: "#150b26", accent: "#c084fc" } : { sky: "#f5efff", accent: "#7c3aed" };
const out = {
  url: page.location.href,
  dark,
  pageSky: style(page, "--p-sky-2"),
  pageAccent: style(page, "--p-accent"),
  pageWallpaper: root.getAttribute("aether-wallpaper"),
  pageWallpaperValue: style(page, "--aether-wallpaper").slice(0, 40),
};

// A normal window's page keeps the colour theme and the chosen picture.
BrowserCommands.openTab();
await wait(1500);
const normal = gBrowser.selectedBrowser.contentWindow;
out.normalSky = style(normal, "--p-sky-2");
out.normalWallpaper = normal.document.documentElement.getAttribute("aether-wallpaper");
pw.close();
return {
  ok: out.url.includes("newtab") && out.pageSky === purple.sky && out.pageAccent === purple.accent &&
    out.pageWallpaper === "theme" && !out.pageWallpaperValue.startsWith("url(") &&
    out.normalSky !== purple.sky && out.normalWallpaper === "picture",
  ...out,
};

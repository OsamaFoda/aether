// When the desktop's picture is one Astrelle can't show (GNOME's default .jxl, a slideshow, no
// GNOME), Settings offers no blank "Your desktop" tile, and a "desktop" choice left from before
// keeps the theme's wallpaper rather than none.
const wait = ms => new Promise(r => setTimeout(r, ms));
const { desktopWallpaper } = ChromeUtils.importESModule("chrome://aether/content/scripts/wallpaper.mjs");
const desktop = await desktopWallpaper(matchMedia("(prefers-color-scheme: dark)").matches);
Services.prefs.setBoolPref("aether.liquidGlass", true);
Services.prefs.setStringPref("aether.background", "wallpaper");
Services.prefs.setStringPref("aether.wallpaper", "desktop");
await wait(1500);
const windowLook = document.documentElement.getAttribute("aether-wallpaper");
const tab = gBrowser.addTrustedTab("about:astrelle");
gBrowser.selectedTab = tab;
await wait(3000);
const doc = tab.linkedBrowser.contentDocument;
const desktopTile = Boolean(doc.querySelector('#wallpapers [data-url="desktop"]'));
const pressed = doc.querySelector('#wallpapers [aria-pressed="true"]')?.dataset.url;
const ok = desktop
  ? windowLook === "picture" && desktopTile && pressed === "desktop"
  : windowLook === "theme" && !desktopTile && pressed === "";
return { ok, desktop, windowLook, desktopTile, pressed };

// Liquid Glass's background: either the desktop, through a see-through window (the "desktop"
// setting), or a wallpaper drawn inside Aether ("wallpaper", the default). Firefox can blur only
// what shares the browser area with the glass, never what's behind the window, so over the
// wallpaper the sidebar is real frosted glass, on any computer. The wallpaper is one made from
// the colour theme (styles/palettes.css, --p-wallpaper), the desktop's own (asked of GNOME, and
// again when the window comes forward), or a picture chosen in Aether Settings. Prefs:
// aether.background, and aether.wallpaper ("" for the theme's, "desktop", or a file: URL). The
// look is in aether.css (:root[aether-wallpaper]).

const { Subprocess } = ChromeUtils.importESModule("resource://gre/modules/Subprocess.sys.mjs");
import { thumbnail, wallpaperFiles } from "./thumbnails.mjs";

const BACKGROUND = "aether.background";
const WALLPAPER = "aether.wallpaper";
const PREFS = [BACKGROUND, WALLPAPER, "aether.liquidGlass"];

// GNOME's wallpaper for the light or dark look, as a file: URL, asked of GNOME's own `gsettings`
// (this Firefox has no reader of its own); null if there isn't one, or it's a slideshow (an .xml
// file), which a page can't show.
export async function desktopWallpaper(dark) {
  const read = async key => {
    const command = await Subprocess.pathSearch("gsettings");
    const proc = await Subprocess.call({ command, arguments: ["get", "org.gnome.desktop.background", key], stderr: "pipe" });
    const output = await proc.stdout.readString();
    await proc.wait();
    return output.trim().replace(/^'|'$/g, "");
  };
  try {
    const uri = (dark && await read("picture-uri-dark")) || await read("picture-uri");
    return /^file:.*\.(jpe?g|png|webp|avif|gif|svg)$/i.test(uri) ? uri : null;
  } catch {
    return null;
  }
}

// "theme", or a picture's file: URL.
export async function wallpaperURL(win) {
  const chosen = Services.prefs.getStringPref(WALLPAPER, "");
  if (chosen === "desktop") return desktopWallpaper(win.matchMedia("(prefers-color-scheme: dark)").matches);
  return chosen || "theme";
}

// A little after Aether starts, while nothing else is going on, make the wallpaper thumbnails
// Aether Settings shows (scripts/thumbnails.mjs), so they're ready when it's opened.
let thumbnailsMade = false;
function makeThumbnails(win) {
  if (thumbnailsMade) return;
  thumbnailsMade = true;
  win.setTimeout(async () => {
    const urls = [await desktopWallpaper(win.matchMedia("(prefers-color-scheme: dark)").matches), ...await wallpaperFiles()];
    for (const url of urls.filter(Boolean)) {
      await new Promise(resolve => ChromeUtils.idleDispatch(resolve, { timeout: 10000 }));
      if (win.closed) return;
      await thumbnail(url, win);
    }
  }, 20000);
}

export function init(win) {
  makeThumbnails(win);
  const root = win.document.documentElement;
  const dark = win.matchMedia("(prefers-color-scheme: dark)");

  let latest = 0;
  const update = async () => {
    const asked = ++latest;
    const on = Services.prefs.getBoolPref("aether.liquidGlass", false) &&
      Services.prefs.getStringPref(BACKGROUND, "wallpaper") === "wallpaper";
    const url = on && await wallpaperURL(win);
    if (asked !== latest) return; // a newer look is on its way
    if (!url) root.removeAttribute("aether-wallpaper");
    else root.setAttribute("aether-wallpaper", url === "theme" ? "theme" : "picture");
    if (url && url !== "theme") root.style.setProperty("--aether-wallpaper", `url("${url.replaceAll('"', "%22")}")`);
    else root.style.removeProperty("--aether-wallpaper");
  };

  PREFS.forEach(pref => Services.prefs.addObserver(pref, update));
  win.addEventListener("activate", update);
  dark.addEventListener("change", update);
  win.addEventListener("unload", () => PREFS.forEach(pref => Services.prefs.removeObserver(pref, update)), { once: true });
  update();
}

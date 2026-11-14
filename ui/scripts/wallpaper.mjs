// Liquid Glass's background: either the desktop, through a see-through window (the "desktop"
// setting), or a wallpaper drawn inside Astrelle ("wallpaper", the default). Firefox can blur only
// what shares the browser area with the glass, never what's behind the window, so over the
// wallpaper the sidebar is real frosted glass, on any computer. The wallpaper is one made from
// the colour theme (styles/palettes.css, --p-wallpaper), the desktop's own (asked of GNOME, and
// again when the window comes forward), or a picture chosen in Astrelle Settings. Prefs:
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

// "theme", or a picture's file: URL. The desktop's, when there's none a page can show, is the theme's.
export async function wallpaperURL(win) {
  const chosen = Services.prefs.getStringPref(WALLPAPER, "");
  if (chosen === "desktop") return (await desktopWallpaper(win.matchMedia("(prefers-color-scheme: dark)").matches)) || "theme";
  return chosen || "theme";
}

// A little after Astrelle starts, while nothing else is going on, make the wallpaper thumbnails
// Astrelle Settings shows (scripts/thumbnails.mjs), so they're ready when it's opened.
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

// "dark" or "light" for a picture that's dark or light overall, or null for one in between, read
// from its frosted copy (small and already blurred). Glass over a dark picture in light mode, or a
// light one in dark mode, is frosted more (aether.css, [aether-wallpaper-tone]), or the text on it
// would be unreadable.
async function pictureTone(win, url) {
  try {
    const picture = new win.Image();
    picture.src = url;
    await picture.decode();
    const canvas = win.document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
    canvas.width = canvas.height = 8;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(picture, 0, 0, 8, 8);
    const pixels = context.getImageData(0, 0, 8, 8).data;
    let sum = 0;
    for (let i = 0; i < pixels.length; i += 4) sum += 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
    const brightness = sum / (pixels.length / 4); // 0 to 255
    return brightness < 100 ? "dark" : brightness > 140 ? "light" : null;
  } catch {
    return null;
  }
}

export function init(win) {
  makeThumbnails(win);
  const root = win.document.documentElement;
  const dark = win.matchMedia("(prefers-color-scheme: dark)");

  let latest = 0;
  let frostedFor = null; // the picture the frosted copy is of
  const update = async () => {
    const asked = ++latest;
    const on = Services.prefs.getBoolPref("aether.liquidGlass", false) &&
      Services.prefs.getStringPref(BACKGROUND, "wallpaper") === "wallpaper";
    const url = on && await wallpaperURL(win);
    if (asked !== latest) return; // a newer look is on its way
    if (!url) root.removeAttribute("aether-wallpaper");
    else root.setAttribute("aether-wallpaper", url === "theme" ? "theme" : "picture");
    const css = url => `url("${url.replaceAll('"', "%22")}")`;
    if (url && url !== "theme") {
      root.style.setProperty("--aether-wallpaper", css(url));
      // A frosted copy, for glass floating where nothing behind it blurs (the address bar's list).
      if (url !== frostedFor) {
        frostedFor = url;
        root.style.removeProperty("--aether-wallpaper-frosted");
        root.removeAttribute("aether-wallpaper-tone");
        const frosted = await thumbnail(url, win, { frosted: true });
        if (frostedFor === url && frosted) {
          root.style.setProperty("--aether-wallpaper-frosted", css(frosted));
          const tone = await pictureTone(win, frosted);
          if (frostedFor === url && tone) root.setAttribute("aether-wallpaper-tone", tone);
        }
      }
    } else {
      frostedFor = null;
      root.style.removeProperty("--aether-wallpaper");
      root.style.removeProperty("--aether-wallpaper-frosted");
      root.removeAttribute("aether-wallpaper-tone");
    }
  };

  PREFS.forEach(pref => Services.prefs.addObserver(pref, update));
  win.addEventListener("activate", update);
  dark.addEventListener("change", update);
  win.addEventListener("unload", () => PREFS.forEach(pref => Services.prefs.removeObserver(pref, update)), { once: true });
  update();
}

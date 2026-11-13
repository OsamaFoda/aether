// Liquid Glass's background: either the desktop, through a see-through window (the "desktop"
// setting), or a wallpaper drawn inside Aether ("wallpaper", the default). Firefox can blur only
// what shares the browser area with the glass, never what's behind the window, so over the
// wallpaper the sidebar is real frosted glass, on any computer. The wallpaper is the desktop's own
// (asked of GNOME, and again when the window comes forward), unless a picture is chosen in Aether
// Settings. Prefs: aether.background, and aether.wallpaper (a file: URL, empty for the
// desktop's). The look is in aether.css (:root[aether-wallpaper]).

const { Subprocess } = ChromeUtils.importESModule("resource://gre/modules/Subprocess.sys.mjs");

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

export async function wallpaperURL(win) {
  return Services.prefs.getStringPref(WALLPAPER, "") ||
    desktopWallpaper(win.matchMedia("(prefers-color-scheme: dark)").matches);
}

export function init(win) {
  const root = win.document.documentElement;
  const dark = win.matchMedia("(prefers-color-scheme: dark)");

  let latest = 0;
  const update = async () => {
    const asked = ++latest;
    const on = Services.prefs.getBoolPref("aether.liquidGlass", false) &&
      Services.prefs.getStringPref(BACKGROUND, "wallpaper") === "wallpaper";
    const url = on && await wallpaperURL(win);
    if (asked !== latest) return; // a newer look is on its way
    root.toggleAttribute("aether-wallpaper", !!url);
    if (url) root.style.setProperty("--aether-wallpaper", `url("${url.replaceAll('"', "%22")}")`);
  };

  PREFS.forEach(pref => Services.prefs.addObserver(pref, update));
  win.addEventListener("activate", update);
  dark.addEventListener("change", update);
  win.addEventListener("unload", () => PREFS.forEach(pref => Services.prefs.removeObserver(pref, update)), { once: true });
  update();
}

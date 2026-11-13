// Aether's app icon: Aurora, Eclipse, Comet or Galaxy (the drawings are in ui/icons/), chosen in
// the welcome or in Customize Aether and kept in the aether.appIcon pref. The desktop takes the
// icon from Aether's launcher (aether.desktop in ~/.local/share/applications), so this keeps a copy
// of the chosen icon beside it and points the launcher at the copy; the dock follows in a moment.
// Builds carry Aurora as the window and About icon.

const { AppConstants } = ChromeUtils.importESModule("resource://gre/modules/AppConstants.sys.mjs");

export const ICONS = ["aurora", "eclipse", "comet", "galaxy"];
const PREF = "aether.appIcon";

export function chosen() {
  const name = Services.prefs.getStringPref(PREF, "aurora");
  return ICONS.includes(name) ? name : "aurora";
}

export function iconURL(name = chosen()) {
  return `chrome://aether/content/icons/${name}.svg`;
}

function dataHome() {
  return Services.env.get("XDG_DATA_HOME") ||
    PathUtils.join(Services.dirsvc.get("Home", Ci.nsIFile).path, ".local", "share");
}

async function updateLauncher() {
  const launcher = PathUtils.join(dataHome(), "applications", "aether.desktop");
  if (!(await IOUtils.exists(launcher))) return;
  const name = chosen();
  const source = Cc["@mozilla.org/chrome/chrome-registry;1"].getService(Ci.nsIChromeRegistry)
    .convertChromeURL(Services.io.newURI(iconURL(name))).QueryInterface(Ci.nsIFileURL).file.path;
  const copy = PathUtils.join(dataHome(), "aether", "icons", `${name}.svg`);
  await IOUtils.makeDirectory(PathUtils.parent(copy));
  await IOUtils.copy(source, copy);
  const text = await IOUtils.readUTF8(launcher);
  const updated = text.replace(/^Icon=.*$/m, `Icon=${copy}`);
  if (updated !== text) await IOUtils.writeUTF8(launcher, updated);
}

let started = false;

// Once per run, not per window.
export function init() {
  if (started || AppConstants.platform !== "linux") return;
  started = true;
  const update = () => updateLauncher().catch(e => console.error("Aether: app icon", e));
  Services.prefs.addObserver(PREF, update);
  update();
}

// Aether Settings (about:aether): every Aether setting on one page. Each applies the moment it's
// changed, and the page follows changes made elsewhere (the right-click menus, shortcuts, the
// Add-ons page) by reading the preferences and add-ons again whenever they change.

const { AddonManager } = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");
const { FileUtils } = ChromeUtils.importESModule("resource://gre/modules/FileUtils.sys.mjs");
import { follow } from "../scripts/palette.mjs";
import { iconURL } from "../scripts/app-icon.mjs";
import { desktopWallpaper } from "../scripts/wallpaper.mjs";
import { CHOICES, protectionState, setProtection, sipState, setSip, readSipBudget, saveSipBudget } from "../scripts/choices.mjs";

const $ = id => document.getElementById(id);
const BOOKMARKS_BAR = "browser.toolbars.bookmarks.visibility"; // "always", "never", or "newtab" (on new tabs only)
follow(document, window);

// A quick spring on whatever was just picked.
function pop(element) {
  element.classList.remove("pop");
  void element.offsetWidth;
  element.classList.add("pop");
}

// ---- Preferences ----

function refresh() {
  for (const group of document.querySelectorAll("[data-pref]")) {
    const value = CHOICES[group.dataset.pref].get();
    for (const button of group.querySelectorAll("[data-value]")) {
      button.setAttribute("aria-pressed", button.dataset.value === value);
    }
  }
  for (const box of document.querySelectorAll("[data-bool-pref]")) {
    box.checked = Services.prefs.getBoolPref(box.dataset.boolPref, box.dataset.default === "true");
  }
  $("bookmarks-bar").checked = Services.prefs.getStringPref(BOOKMARKS_BAR, "never") !== "never";
  $("liquid-background").hidden = CHOICES.glass.get() !== "liquid";
  $("wallpapers").hidden = CHOICES.background.get() !== "wallpaper";
  const wallpaper = Services.prefs.getStringPref(WALLPAPER, "");
  for (const tile of $("wallpapers").querySelectorAll("[data-url]")) {
    tile.setAttribute("aria-pressed", tile.dataset.url === wallpaper);
  }
  const icon = iconURL();
  $("logo").src = icon;
  document.querySelector('link[rel="icon"]').href = icon;
}

for (const group of document.querySelectorAll("[data-pref]")) {
  for (const button of group.querySelectorAll("[data-value]")) {
    button.addEventListener("click", () => {
      CHOICES[group.dataset.pref].set(button.dataset.value);
      pop(button);
      refresh(); // not every choice is an aether. pref the page watches
    });
  }
}

for (const box of document.querySelectorAll("[data-bool-pref]")) {
  box.addEventListener("change", () => Services.prefs.setBoolPref(box.dataset.boolPref, box.checked));
}

// Through Firefox's own switch (what Ctrl+Shift+B uses), which also shows or hides the bar in
// each window; the preference alone only takes effect on restart.
$("bookmarks-bar").addEventListener("change", event => {
  for (const win of Services.wm.getEnumerator("navigator:browser")) {
    win.setToolbarVisibility(win.BookmarkingUI.toolbar, event.target.checked ? "always" : "never");
  }
});

const WATCHED = ["aether.", "sidebar.verticalTabs", "ui.systemUsesDarkTheme", BOOKMARKS_BAR];
for (const pref of WATCHED) Services.prefs.addObserver(pref, refresh);

// ---- Wallpapers ----

const WALLPAPER = "aether.wallpaper"; // "" for the theme's, "desktop", or a file: URL
const FOLDER = PathUtils.join(Services.dirsvc.get("Home", Ci.nsIFile).path, "Pictures", "Wallpapers");
let queue = Promise.resolve(); // one thumbnail at a time, so making them doesn't hog the computer
const PICTURE = /\.(jpe?g|png|webp|avif|gif)$/i;

// Small copies of the wallpapers for the tiles, made once and kept in the profile: the pictures
// themselves are several megabytes each, far too much to decode and draw while scrolling.
const THUMBNAILS = PathUtils.join(PathUtils.profileDir, "aether-thumbnails");

async function thumbnail(url) {
  if (!url?.startsWith("file:")) return url;
  try {
    const path = Services.io.newURI(url).QueryInterface(Ci.nsIFileURL).file.path;
    const { lastModified } = await IOUtils.stat(path);
    const key = new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(`${path}|${lastModified}`)));
    const copy = PathUtils.join(THUMBNAILS, `${[...key].map(b => b.toString(16).padStart(2, "0")).join("")}.jpg`);
    if (!(await IOUtils.exists(copy))) {
      const picture = await createImageBitmap(new Blob([await IOUtils.read(path)]));
      const canvas = new OffscreenCanvas(320, Math.round(320 * picture.height / picture.width));
      canvas.getContext("2d").drawImage(picture, 0, 0, canvas.width, canvas.height);
      picture.close();
      const jpeg = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.82 });
      await IOUtils.makeDirectory(THUMBNAILS);
      await IOUtils.write(copy, new Uint8Array(await jpeg.arrayBuffer()));
    }
    return PathUtils.toFileURI(copy);
  } catch (e) {
    console.error("Aether settings: thumbnail", e);
    return null;
  }
}

function wallpaperTile(url, image, label) {
  const tile = document.createElement("button");
  tile.className = url ? "wallpaper" : "wallpaper theme";
  tile.dataset.url = url;
  tile.title = label || decodeURIComponent(url.split("/").pop());
  if (image) {
    const img = document.createElement("img");
    img.decoding = "async";
    img.alt = "";
    tile.append(img);
    queue = queue.then(() => thumbnail(image)).then(src => src && (img.src = src));
  }
  if (label) tile.append(Object.assign(document.createElement("span"), { textContent: label }));
  tile.addEventListener("click", () => {
    Services.prefs.setStringPref(WALLPAPER, url);
    pop(tile);
  });
  return tile;
}

async function choosePicture() {
  const picker = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
  picker.init(window.browsingContext, "Choose a wallpaper", Ci.nsIFilePicker.modeOpen);
  picker.appendFilters(Ci.nsIFilePicker.filterImages);
  if (await IOUtils.exists(FOLDER)) picker.displayDirectory = new FileUtils.File(FOLDER);
  const result = await new Promise(resolve => picker.open(resolve));
  if (result === Ci.nsIFilePicker.returnOK) {
    Services.prefs.setStringPref(WALLPAPER, PathUtils.toFileURI(picker.file.path));
    buildWallpapers();
  }
}

// The theme's own wallpaper, the desktop's, the pictures in ~/Pictures/Wallpapers, one chosen from
// elsewhere, then "Choose a picture…".
async function buildWallpapers() {
  const tiles = [
    wallpaperTile("", null, "Your theme"),
    wallpaperTile("desktop", await desktopWallpaper(matchMedia("(prefers-color-scheme: dark)").matches), "Your desktop"),
  ];
  const urls = [];
  try {
    for (const path of (await IOUtils.getChildren(FOLDER)).sort()) {
      if (PICTURE.test(path)) urls.push(PathUtils.toFileURI(path));
    }
  } catch {
    // No Wallpapers folder.
  }
  const chosen = Services.prefs.getStringPref(WALLPAPER, "");
  if (chosen && chosen !== "desktop" && !urls.includes(chosen)) urls.unshift(chosen);
  tiles.push(...urls.map(url => wallpaperTile(url, url)));
  const choose = Object.assign(document.createElement("button"), { className: "wallpaper choose", textContent: "Choose a picture…" });
  choose.addEventListener("click", choosePicture);
  $("wallpapers").replaceChildren(...tiles, choose);
  refresh();
}

// ---- Add-ons: protection and Sip ----

async function refreshAddons() {
  $("protection-on").checked = (await protectionState()) === "on";
  const sip = await sipState();
  $("sip-on").checked = sip === "on";
  $("sip-on").disabled = sip === "missing";
  $("sip-budget").disabled = sip !== "on";
  if (sip === "on") {
    const { budgetGB, resetDay } = await readSipBudget();
    if (budgetGB && document.activeElement !== $("budget-gb")) $("budget-gb").value = budgetGB;
    if (resetDay && document.activeElement !== $("reset-day")) $("reset-day").value = resetDay;
  }
}

$("protection-on").addEventListener("change", async event => {
  const box = event.target;
  const status = $("protection-status");
  box.disabled = true;
  status.hidden = false;
  status.className = "status";
  status.textContent = box.checked ? "Turning on…" : "Turning off…";
  try {
    await setProtection(box.checked);
    status.textContent = box.checked ? "Protection is on ✓" : "Protection is off";
  } catch (e) {
    console.error("Aether settings: protection", e);
    status.className = "status error";
    status.textContent = "Couldn't download it. Check your connection and try again.";
  }
  box.disabled = false;
  refreshAddons();
});

$("sip-on").addEventListener("change", async event => {
  event.target.disabled = true;
  try {
    await setSip(event.target.checked);
    if (event.target.checked) await saveSipBudget(Number($("budget-gb").value), $("reset-day").value);
  } catch (e) {
    console.error("Aether settings: Sip", e);
  }
  refreshAddons();
});

for (const id of ["budget-gb", "reset-day"]) {
  $(id).addEventListener("change", () => saveSipBudget(Number($("budget-gb").value), $("reset-day").value));
}

const addonListener = { onEnabled: refreshAddons, onDisabled: refreshAddons, onInstalled: refreshAddons, onUninstalled: refreshAddons };
AddonManager.addAddonListener(addonListener);

// ---- More ----

for (const button of document.querySelectorAll("[data-open]")) {
  button.addEventListener("click", () => window.browsingContext.topChromeWindow.openTrustedLinkIn(button.dataset.open, "tab"));
}

// Firefox's panel for choosing the sidebar's tools (the gear opens this page instead).
$("sidebar-tools").addEventListener("click", () => window.browsingContext.topChromeWindow.aetherCustomizeSidebar());

window.addEventListener("unload", () => {
  for (const pref of WATCHED) Services.prefs.removeObserver(pref, refresh);
  AddonManager.removeAddonListener(addonListener);
}, { once: true });

refresh();
refreshAddons();
buildWallpapers();

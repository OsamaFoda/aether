// A picture chosen in another Settings tab (or about:config) gets its tile, pressed, in this one.
const wait = ms => new Promise(r => setTimeout(r, ms));
const path = PathUtils.join(PathUtils.profileDir, "picked.png");
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
await IOUtils.write(path, Uint8Array.from(atob(png), c => c.charCodeAt(0)));
const url = PathUtils.toFileURI(path);
Services.prefs.setBoolPref("aether.liquidGlass", true);
const tab = gBrowser.addTrustedTab("about:astrelle");
gBrowser.selectedTab = tab;
await wait(3000);
const doc = tab.linkedBrowser.contentDocument;
Services.prefs.setStringPref("aether.wallpaper", url);
await wait(1500);
const tile = [...doc.querySelectorAll("#wallpapers [data-url]")].find(t => t.dataset.url === url);
const pressed = tile?.getAttribute("aria-pressed");
return { ok: pressed === "true", tile: Boolean(tile), pressed };

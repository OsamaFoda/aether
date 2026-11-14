// timeout: 60
// With the desktop's wallpaper chosen, an open New Tab page shows the same picture as its window:
// after the desktop switches between light and dark, after the desktop's wallpaper changes while
// the window was in the background, when the choice changes quickly while the desktop is slow
// to answer, and in a tab behind once it's shown again (not before: each ask runs gsettings). A
// stand-in gsettings answers from files here; no desktop setting is read or changed.
const wait = ms => new Promise(r => setTimeout(r, ms));
const dir = PathUtils.join(PathUtils.profileDir, "desktop-stand-in");
const file = (...names) => PathUtils.join(dir, ...names);
const url = name => PathUtils.toFileURI(file(name));
const svg = colour => `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="${colour}"/></svg>`;
await IOUtils.makeDirectory(PathUtils.join(dir, "bin"));
for (const [name, colour] of [["light.svg", "#fff"], ["dark.svg", "#000"], ["light2.svg", "#eee"], ["picture.svg", "#f00"]]) {
  await IOUtils.writeUTF8(file(name), svg(colour));
}
await IOUtils.writeUTF8(file("bin", "gsettings"),
  `#!/bin/sh\n[ "$1" = get ] || exit 1\nsleep $(cat "${dir}/delay" 2>/dev/null || echo 0)\necho "'$(cat "${dir}/$3")'"\n`);
await IOUtils.setPermissions(file("bin", "gsettings"), 0o755);
const answer = (key, value) => IOUtils.writeUTF8(file(key), value);
await answer("picture-uri", url("light.svg"));
await answer("picture-uri-dark", url("dark.svg"));
Services.env.set("PATH", `${PathUtils.join(dir, "bin")}:${Services.env.get("PATH")}`);

Services.prefs.setIntPref("ui.systemUsesDarkTheme", 0);
Services.prefs.setBoolPref("aether.liquidGlass", true);
Services.prefs.setStringPref("aether.background", "wallpaper");
Services.prefs.setStringPref("aether.wallpaper", "desktop");
await wait(1500);
BrowserCommands.openTab();
await wait(2000);
const page = gBrowser.selectedBrowser.contentWindow;
const pictures = () => [document, page.document].map(doc =>
  doc.documentElement.style.getPropertyValue("--aether-wallpaper").replace(/.*\/|"\)$/g, ""));
const out = { start: pictures() };
Services.prefs.setIntPref("ui.systemUsesDarkTheme", 1);
await wait(1500);
out.dark = pictures();
Services.prefs.setIntPref("ui.systemUsesDarkTheme", 0);
await wait(1500);
await answer("picture-uri", url("light2.svg"));
window.dispatchEvent(new Event("deactivate"));
window.dispatchEvent(new Event("activate"));
await wait(1500);
out.changedWhileAway = pictures();

await answer("delay", "0.6");
Services.prefs.setStringPref("aether.wallpaper", "");
await wait(300);
Services.prefs.setStringPref("aether.wallpaper", "desktop");
Services.prefs.setStringPref("aether.wallpaper", url("picture.svg"));
await wait(2500);
out.quickChange = pictures();
await answer("delay", "0");

// A page in a tab behind, which asks only once it's shown again, then catches up.
Services.prefs.setStringPref("aether.wallpaper", "desktop");
await wait(1500);
const newTab = gBrowser.selectedTab;
gBrowser.selectedTab = gBrowser.addTab("about:blank", { triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal() });
await wait(500);
await answer("picture-uri", url("light.svg"));
window.dispatchEvent(new Event("deactivate"));
window.dispatchEvent(new Event("activate"));
await wait(1500);
out.behind = pictures();
gBrowser.selectedTab = newTab;
await wait(1500);
out.shownAgain = pictures();
const same = ([inWindow, inPage], want) => inWindow === want && inPage === want;
return {
  ok: same(out.start, "light.svg") && same(out.dark, "dark.svg") && same(out.changedWhileAway, "light2.svg") &&
    same(out.quickChange, "picture.svg") && out.behind.join() === "light.svg,light2.svg" &&
    same(out.shownAgain, "light.svg"),
  ...out,
};

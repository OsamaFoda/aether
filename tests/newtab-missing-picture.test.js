// timeout: 45
// With Frosted Glass and a chosen picture that can't be shown (moved, deleted, not loaded yet), the
// New Tab page shows the theme's colour, as the window does, not a bare white or grey page; a
// picture that can be shown still covers it.
const wait = ms => new Promise(r => setTimeout(r, ms));
const pixel = async page => {
  const bitmap = await page.browsingContext.currentWindowGlobal.drawSnapshot(new DOMRect(20, 20, 1, 1), 1, "rgb(255,0,255)");
  const context = new OffscreenCanvas(1, 1).getContext("2d");
  context.drawImage(bitmap, 0, 0);
  return `rgb(${[...context.getImageData(0, 0, 1, 1).data].slice(0, 3).join(", ")})`;
};
const newTab = async () => {
  BrowserCommands.openTab();
  await wait(1500);
  return gBrowser.selectedBrowser.contentWindow;
};
const red = PathUtils.join(PathUtils.profileDir, "red.svg");
await IOUtils.writeUTF8(red, '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#ff0000"/></svg>');
Services.prefs.setBoolPref("aether.liquidGlass", true);
Services.prefs.setStringPref("aether.background", "wallpaper");
Services.prefs.setStringPref("aether.wallpaper", "file:///nonexistent/gone.jpg");
await wait(800);
let page = await newTab();
const sky = page.document.createElement("div");
sky.style.color = "var(--sky-2)";
page.document.body.append(sky);
const theme = page.getComputedStyle(sky).color;
sky.remove();
const missing = await pixel(page);

Services.prefs.setStringPref("aether.wallpaper", PathUtils.toFileURI(red));
await wait(800);
page = await newTab();
const shown = await pixel(page);
return { ok: missing === theme && shown === "rgb(255, 0, 0)", theme, missing, shown };

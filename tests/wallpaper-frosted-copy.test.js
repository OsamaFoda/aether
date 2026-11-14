// A picture wallpaper gets a frosted copy (for glass where nothing behind it blurs), and coming
// back to the window doesn't drop it, which showed the sharp picture for a moment.
const wait = ms => new Promise(r => setTimeout(r, ms));
const canvas = document.createElement("canvas");
canvas.width = 400;
canvas.height = 250;
const context = canvas.getContext("2d");
for (let x = 0; x < 400; x += 20) {
  context.fillStyle = x % 40 ? "#c00" : "#00c";
  context.fillRect(x, 0, 20, 250);
}
const blob = await new Promise(r => canvas.toBlob(r, "image/png"));
const picture = PathUtils.join(PathUtils.profileDir, "test-wallpaper.png");
await IOUtils.write(picture, new Uint8Array(await blob.arrayBuffer()));
Services.prefs.setBoolPref("aether.liquidGlass", true);
Services.prefs.setStringPref("aether.background", "wallpaper");
Services.prefs.setStringPref("aether.wallpaper", PathUtils.toFileURI(picture));
await wait(2500);
const root = document.documentElement;
const frosted = () => Boolean(root.style.getPropertyValue("--aether-wallpaper-frosted"));
const madeCopy = frosted();
const kept = [];
window.dispatchEvent(new Event("activate"));
for (let i = 0; i < 10; i++) {
  kept.push(frosted());
  await wait(30);
}
return { ok: madeCopy && kept.every(Boolean), madeCopy, keptOnReturn: kept.every(Boolean) };

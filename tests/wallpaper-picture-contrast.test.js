// timeout: 60
// Frosted Glass over a picture that fights the light or dark look (a night picture in light mode,
// a snowy one in dark mode) frosts the glass more, so the text on it stays readable; a picture
// that suits the look keeps the clear glass.
const wait = ms => new Promise(r => setTimeout(r, ms));
const root = document.documentElement;
const dark = matchMedia("(prefers-color-scheme: dark)").matches;
const picture = async (name, colour) => {
  const canvas = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
  canvas.width = 400;
  canvas.height = 250;
  const context = canvas.getContext("2d");
  context.fillStyle = colour;
  context.fillRect(0, 0, 400, 250);
  const blob = await new Promise(r => canvas.toBlob(r, "image/png"));
  const path = PathUtils.join(PathUtils.profileDir, name);
  await IOUtils.write(path, new Uint8Array(await blob.arrayBuffer()));
  return PathUtils.toFileURI(path);
};
const frost = async url => {
  Services.prefs.setStringPref("aether.wallpaper", url);
  await wait(300);
  for (let i = 0; i < 40 && !root.style.getPropertyValue("--aether-wallpaper-frosted"); i++) await wait(250);
  await wait(500);
  const alpha = getComputedStyle(root).getPropertyValue("--aether-frost").match(/[\d.]+/g)?.[3];
  return Number(alpha);
};
Services.prefs.setBoolPref("sidebar.verticalTabs", true);
Services.prefs.setBoolPref("aether.liquidGlass", true);
Services.prefs.setStringPref("aether.background", "wallpaper");
const night = await frost(await picture("night.png", "#0c1128"));
const snow = await frost(await picture("snow.png", "#eef2f7"));
const [fighting, suiting] = dark ? [snow, night] : [night, snow];
return { ok: fighting >= 0.6 && suiting < 0.4, dark, fighting, suiting };

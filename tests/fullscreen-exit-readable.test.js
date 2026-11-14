// dark
// The "Exit Full Screen" button's label is readable on its accent in dark mode, in every theme
// and on hover: it was white on the dark themes' pale accents.
const wait = ms => new Promise(r => setTimeout(r, ms));
const button = document.getElementById("fullscreen-exit-button");
const channels = c => c.match(/[\d.]+/g).slice(0, 3).map(v => c.startsWith("color(") ? v * 255 : Number(v));
const luminance = c => {
  const [r, g, b] = channels(c).map(v => (v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = () => {
  const look = getComputedStyle(button);
  const [light, dark] = [luminance(look.backgroundColor), luminance(look.color)].sort((a, b) => b - a);
  return Math.round((light + 0.05) / (dark + 0.05) * 10) / 10;
};
const seen = {};
for (const palette of ["nebula", "ocean", "aurora", "sunset", "rose", "graphite"]) {
  Services.prefs.setStringPref("aether.palette", palette);
  await wait(300);
  const normal = contrast();
  InspectorUtils.addPseudoClassLock(button, ":hover");
  const hover = contrast();
  InspectorUtils.removePseudoClassLock(button, ":hover");
  seen[palette] = { normal, hover };
}
Services.prefs.clearUserPref("aether.palette");
return { ok: Object.values(seen).every(s => s.normal >= 4.5 && s.hover >= 4.5), ...seen };

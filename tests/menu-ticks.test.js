// "Frosted Glass" and "Compact Mode" in the right-click menus are ticked only while they're on;
// they were written checked="false", which still draws a tick.
const wait = ms => new Promise(r => setTimeout(r, ms));
const menu = document.getElementById("toolbar-context-menu");
const item = label => menu.querySelector(`menuitem[label="${label}"]`);
const ticks = async (frosted, compact) => {
  Services.prefs.setBoolPref("aether.liquidGlass", frosted);
  Services.prefs.setBoolPref("aether.compactMode", compact);
  await wait(500);
  const shown = new Promise(r => menu.addEventListener("popupshown", r, { once: true }));
  menu.openPopupAtScreen(100, 100, true);
  await Promise.race([shown, wait(2000)]);
  const seen = { frosted: item("Frosted Glass").matches("[checked]"), compact: item("Compact Mode").matches("[checked]") };
  const hidden = new Promise(r => menu.addEventListener("popuphidden", r, { once: true }));
  menu.hidePopup();
  await Promise.race([hidden, wait(1000)]);
  return seen;
};
const off = await ticks(false, false);
const on = await ticks(true, true);
Services.prefs.setBoolPref("aether.compactMode", false);
return { ok: !off.frosted && !off.compact && on.frosted && on.compact, off, on };

// The New Tab page follows the window's position each frame only while it draws the wallpaper and
// shows: in Standard, or in a tab behind, it asks for no frames, which kept the browser busy.
const wait = ms => new Promise(r => setTimeout(r, ms));
async function frames(win, ms) {
  let n = 0;
  const original = win.requestAnimationFrame;
  win.requestAnimationFrame = callback => { n++; return original.call(win, callback); };
  await wait(ms);
  win.requestAnimationFrame = original;
  return n;
}
Services.prefs.setBoolPref("aether.liquidGlass", false);
await wait(1000);
BrowserCommands.openTab();
await wait(1500);
const tab = gBrowser.selectedTab;
const page = gBrowser.selectedBrowser.contentWindow;
const standard = await frames(page, 1000);
Services.prefs.setBoolPref("aether.liquidGlass", true);
Services.prefs.setStringPref("aether.background", "wallpaper");
await wait(500);
const frosted = await frames(page, 1000);
const placed = page.document.documentElement.style.getPropertyValue("--wall-w");
const other = gBrowser.addTab("about:blank", { triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal() });
gBrowser.selectedTab = other;
await wait(1000);
const behind = await frames(page, 2000);
gBrowser.selectedTab = tab;
await wait(500);
const back = await frames(page, 1000);
Services.prefs.setBoolPref("aether.liquidGlass", false);
await wait(500);
const standardAgain = await frames(page, 1000);
return {
  ok: standard <= 1 && frosted > 20 && Boolean(placed) && behind <= 1 && back > 20 && standardAgain <= 1,
  standard, frosted, placed, behind, back, standardAgain,
};

// While a tab's highlight slides over, the tab can still be used: clicking a tab and right away
// its close button closes it, with vertical tabs and with top tabs.
const wait = ms => new Promise(r => setTimeout(r, ms));
const wu = window.windowUtils;
const send = (x, y, message) => wu.sendNativeMouseEvent((mozInnerScreenX + x) * devicePixelRatio,
  (mozInnerScreenY + y) * devicePixelRatio, message, 0, 0, document.documentElement, null);
const click = async (x, y) => {
  send(x, y, wu.NATIVE_MOUSE_MESSAGE_MOVE); await wait(30);
  send(x, y, wu.NATIVE_MOUSE_MESSAGE_BUTTON_DOWN); await wait(30);
  send(x, y, wu.NATIVE_MOUSE_MESSAGE_BUTTON_UP); await wait(40);
};
const system = Services.scriptSecurityManager.getSystemPrincipal();
await wait(1000);
const seen = [];
for (const vertical of [true, false]) {
  Services.prefs.setBoolPref("sidebar.verticalTabs", vertical);
  while (gBrowser.tabs.length > 1) gBrowser.removeTab(gBrowser.tabs.at(-1), { animate: false });
  for (let i = 0; i < 5; i++) gBrowser.addTab(`data:text/html,<title>t${i}</title>x`, { triggeringPrincipal: system });
  gBrowser.selectedTab = gBrowser.tabs[0];
  await wait(1500);
  const tab = gBrowser.tabs[4];
  const r = tab.getBoundingClientRect();
  await click(r.left + 30, r.top + r.height / 2);
  const moving = tab.hasAttribute("aether-lens-moving");
  const close = tab.querySelector(".tab-close-button").getBoundingClientRect();
  await click(close.left + close.width / 2, close.top + close.height / 2);
  await wait(800);
  seen.push({ vertical, moving, closed: !tab.isConnected || tab.closing });
}
return { ok: seen.every(s => s.moving && s.closed), seen };

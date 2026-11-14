// The right end of "+ New Tab" in the sidebar opens a private window and nothing else; the rest
// of the button opens a tab.
const wait = ms => new Promise(r => setTimeout(r, ms));
const wu = window.windowUtils;
await wait(1500);
const button = ["tabs-newtab-button", "vertical-tabs-newtab-button"].map(id => document.getElementById(id))
  .find(b => b?.getBoundingClientRect().width > 0);
const windows = () => [...Services.wm.getEnumerator("navigator:browser")];
const click = async (x, y) => {
  const send = message => wu.sendNativeMouseEvent((mozInnerScreenX + x) * devicePixelRatio,
    (mozInnerScreenY + y) * devicePixelRatio, message, 0, 0, document.documentElement, null);
  send(wu.NATIVE_MOUSE_MESSAGE_MOVE); await wait(80);
  send(wu.NATIVE_MOUSE_MESSAGE_BUTTON_DOWN); await wait(80);
  send(wu.NATIVE_MOUSE_MESSAGE_BUTTON_UP);
  await wait(1800);
};
const seen = {};
for (const part of ["private", "rest"]) {
  const r = button.getBoundingClientRect();
  const tabs = gBrowser.tabs.length, count = windows().length;
  await click(part === "private" ? r.right - 12 : r.left + 20, r.top + r.height / 2);
  const opened = windows().filter(w => w !== window);
  seen[part] = { newTabs: gBrowser.tabs.length - tabs, newWindows: windows().length - count,
    private: opened.filter(w => PrivateBrowsingUtils.isWindowPrivate(w)).length };
  for (const w of opened) w.close();
  window.focus(); await wait(500);
  while (gBrowser.tabs.length > 1) gBrowser.removeTab(gBrowser.tabs.at(-1), { animate: false });
}
return {
  ok: seen.private.newTabs === 0 && seen.private.newWindows === 1 && seen.private.private === 1 &&
    seen.rest.newTabs === 1 && seen.rest.newWindows === 0,
  button: button?.id, seen,
};

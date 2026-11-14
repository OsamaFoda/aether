// timeout: 60
// A menu closed by choosing something in it stays closed: choosing New window in the app menu
// takes you to the new window, and coming back to this one doesn't open the menu again (only
// menus the desktop closed as you left do that).
const wait = ms => new Promise(r => setTimeout(r, ms));
Services.prefs.setBoolPref("sidebar.verticalTabs", true);
Services.prefs.setBoolPref("aether.compactMode", true);
await wait(1000);
PanelUI.show();
await wait(800);
const menu = document.getElementById("appMenu-popup");
const opened = new Promise(resolve => {
  const observe = (subject, topic) => {
    Services.obs.removeObserver(observe, topic);
    resolve(subject);
  };
  Services.obs.addObserver(observe, "browser-delayed-startup-finished");
});
document.getElementById("appMenu-new-window-button2").click();
const w2 = await Promise.race([opened, wait(10000)]);
await wait(1500);
const left = !document.hasFocus();
if (!left) window.dispatchEvent(new Event("deactivate")); // in case the new window didn't take the focus
await wait(1000);
window.focus();
window.dispatchEvent(new Event("activate"));
await wait(1500);
const reopened = menu.state !== "closed";
PanelUI.hide();
w2?.close();
return { ok: !!w2 && !reopened, newWindow: !!w2, left, reopened };

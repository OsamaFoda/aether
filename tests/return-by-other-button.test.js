// timeout: 45
// The app menu was open when you switched apps (the desktop closed it); you come back by clicking
// the Extensions button: its panel opens, and the app menu stays closed instead of opening over it.
const wait = ms => new Promise(r => setTimeout(r, ms));
Services.prefs.setBoolPref("sidebar.verticalTabs", true);
Services.prefs.setBoolPref("aether.compactMode", false);
await wait(1500);
PanelUI.show();
await wait(800);
const appMenu = document.getElementById("appMenu-popup");
PanelUI.hide();                               // the desktop closes it on leaving
window.dispatchEvent(new Event("deactivate"));
await wait(1000);
window.dispatchEvent(new Event("activate"));  // back, by pressing the Extensions button
const r = document.getElementById("unified-extensions-button").getBoundingClientRect();
const x = r.left + r.width / 2, y = r.top + r.height / 2;
const target = document.elementFromPoint(x, y);
for (const type of ["mousedown", "mouseup", "click"]) {
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y,
    screenX: mozInnerScreenX + x, screenY: mozInnerScreenY + y, button: 0, detail: 1, view: window }));
}
await wait(1500);
const extensions = document.getElementById("unified-extensions-panel")?.state;
const result = { ok: extensions === "open" && appMenu.state === "closed", extensions, appMenu: appMenu.state };
PanelUI.hide();
document.getElementById("unified-extensions-panel")?.hidePopup();
return result;

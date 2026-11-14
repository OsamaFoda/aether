// timeout: 45
// Compact mode, switching apps and back: bars that were out stay out while you're away and after
// you return, a menu the desktop closed on leaving opens again, and clicking the page then lets
// the bars go. (Leaving and returning are simulated with the window's deactivate/activate events.)
Services.prefs.setBoolPref("sidebar.verticalTabs", true);
Services.prefs.setBoolPref("aether.compactMode", true);
const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(1000);
const bars = document.getElementById("sidebar-container");
const out = () => bars.getBoundingClientRect().right > 0;
gURLBar.focus();
await wait(500);
PanelUI.show();
await wait(800);
const menu = document.getElementById("appMenu-popup");
PanelUI.hide();                     // the desktop closes menus on leaving...
gBrowser.selectedBrowser.focus();   // ...and takes the focus
window.dispatchEvent(new Event("deactivate"));
await wait(1500);
const outWhileAway = out();
window.dispatchEvent(new Event("activate"));
gURLBar.focus();
await wait(2500);
const outAfterReturn = out();
const menuReopened = menu.state === "open";
PanelUI.hide();
await wait(300);
gBrowser.selectedBrowser.focus();
await wait(1200);
const goneAfterPageClick = !out();
return {
  ok: outWhileAway && outAfterReturn && menuReopened && goneAfterPageClick,
  outWhileAway, outAfterReturn, menuReopened, goneAfterPageClick,
};

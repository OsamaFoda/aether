// dark
// A web page's <select> dropdown stays readable in Frosted Glass: Firefox colours it to match the
// page, and Astrelle's frosted menu painted a dark tint under the light page's dark text.
const wait = ms => new Promise(r => setTimeout(r, ms));
Services.prefs.setBoolPref("aether.liquidGlass", true);
Services.prefs.setStringPref("aether.background", "wallpaper");
const html = "<body style='margin:0;background:#fff'><select id=s style='position:absolute;left:40px;top:40px;width:260px'>" +
  "<option>Option one</option><option>Option two</option><option>Option three</option></select></body>";
gBrowser.selectedTab = gBrowser.addTab("data:text/html," + encodeURIComponent(html), {
  triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
});
await wait(1500);
gBrowser.selectedBrowser.messageManager.loadFrameScript(
  "data:,content.document.notifyUserGestureActivation();content.document.getElementById('s').showPicker();", false);
await wait(1500);
const menu = document.querySelector("#ContentSelectDropdown > menupopup");
if (menu?.state != "open") {
  return { ok: false, state: menu?.state };
}
const channels = c => c.match(/[\d.]+/g).slice(0, 3).map(v => c.startsWith("color(") ? v * 255 : Number(v));
const luminance = c => {
  const [r, g, b] = channels(c).map(v => (v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const part = getComputedStyle(menu.shadowRoot.querySelector("[part~='content']"));
const text = getComputedStyle(menu.querySelector("menuitem:not([_moz-menuactive])") ?? menu.querySelector("menuitem")).color;
const [light, dark] = [luminance(part.backgroundColor), luminance(text)].sort((a, b) => b - a);
const contrast = (light + 0.05) / (dark + 0.05);
menu.hidePopup();
return {
  ok: part.backgroundImage == "none" && contrast >= 4.5,
  background: part.backgroundColor,
  frost: part.backgroundImage.slice(0, 40),
  text,
  contrast: Math.round(contrast * 10) / 10,
};

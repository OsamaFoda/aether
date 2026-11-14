// The minimise, maximise and close buttons keep their symbols (their background image) on hover.
Services.prefs.setBoolPref("sidebar.verticalTabs", true);
Services.prefs.setBoolPref("aether.liquidGlass", true);
const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(1200);
const results = {};
for (const button of document.querySelectorAll(".titlebar-buttonbox .titlebar-button")) {
  const icon = button.querySelector(".toolbarbutton-icon");
  InspectorUtils.addPseudoClassLock(button, ":hover");
  await wait(300);
  results[button.className] = getComputedStyle(icon).backgroundImage;
  InspectorUtils.removePseudoClassLock(button, ":hover");
}
const images = Object.values(results);
return { ok: images.length >= 3 && images.every(i => i.includes("-moz-symbolic-icon")), results };

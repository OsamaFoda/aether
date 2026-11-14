// timeout: 60
// Customize Toolbar > Restore Defaults gives Astrelle's toolbar (and tabs down the side), not
// Firefox's; Undo after it still gives back your own.
const wait = ms => new Promise(r => setTimeout(r, ms));
const { CustomizableUI } = ChromeUtils.importESModule("moz-src:///browser/components/customizableui/CustomizableUI.sys.mjs");
const navbar = () => CustomizableUI.getWidgetIdsInArea(CustomizableUI.AREA_NAVBAR);
const ours = ["aether-workspaces", "aether-split-view", "aether-compact-mode", "home-button"];
const customize = async press => {
  gCustomizeMode.enter();
  await new Promise(r => window.addEventListener("customizationready", r, { once: true }));
  for (const id of press) {
    document.getElementById(id).doCommand();
    await wait(1500);
  }
  gCustomizeMode.exit();
  await new Promise(r => gNavToolbox.addEventListener("aftercustomization", r, { once: true }));
  await wait(1000);
};
await wait(1500);
const before = navbar();

CustomizableUI.removeWidgetFromArea("home-button");
await customize(["customization-reset-button", "customization-undo-reset-button"]);
const undone = navbar();

await customize(["customization-reset-button"]);
const reset = navbar();
const vertical = Services.prefs.getBoolPref("sidebar.verticalTabs");
return {
  ok: !undone.includes("home-button") && ours.every(id => reset.includes(id)) &&
    reset.indexOf("back-button") === 0 && !reset.includes("sidebar-button") && vertical,
  before, undone, reset, vertical,
};

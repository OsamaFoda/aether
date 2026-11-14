// timeout: 60
// A newer toolbar layout (aether.toolbarLayout going up) adds what it brings and leaves the rest
// of the toolbar the way you arranged it.
const wait = ms => new Promise(r => setTimeout(r, ms));
const { CustomizableUI } = ChromeUtils.importESModule("moz-src:///browser/components/customizableui/CustomizableUI.sys.mjs");
const placement = id => CustomizableUI.getPlacementOfWidget(id);
await wait(1500);
CustomizableUI.removeWidgetFromArea("home-button");
CustomizableUI.addWidgetToArea("aether-compact-mode", CustomizableUI.AREA_NAVBAR, 0);
CustomizableUI.addWidgetToArea("aether-split-view", CustomizableUI.AREA_FIXED_OVERFLOW_PANEL);
// A profile from before layout 2 (the home button), as the next window opens.
Services.prefs.setIntPref("aether.toolbarLayout", 1);
const other = OpenBrowserWindow();
await new Promise(r => other.addEventListener("load", r, { once: true }));
await wait(2500);
const seen = {
  compactMode: placement("aether-compact-mode"),
  splitView: placement("aether-split-view")?.area,
  home: placement("home-button"),
  layout: Services.prefs.getIntPref("aether.toolbarLayout"),
};
other.close();
return {
  ok: seen.compactMode?.position === 0 && seen.splitView === CustomizableUI.AREA_FIXED_OVERFLOW_PANEL &&
    seen.home?.area === CustomizableUI.AREA_NAVBAR && seen.layout === 2,
  seen, navbar: CustomizableUI.getWidgetIdsInArea(CustomizableUI.AREA_NAVBAR),
};

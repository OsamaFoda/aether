// Aether's toolbar layout, set once per profile (and again whenever LAYOUT goes up): back,
// forward, reload and home, the address bar, workspaces, then add-ons, Split View and Compact Mode.
// In the sidebar that's a row of buttons over the address bar (styles/aether.css); with top tabs,
// one row. Firefox's sidebar button goes, as Compact Mode does its job (scripts/compact-mode.mjs),
// and so do Firefox View and the tab list, which the sidebar already shows.
// Runs after the other scripts so their buttons exist.

const { CustomizableUI } = ChromeUtils.importESModule("moz-src:///browser/components/customizableui/CustomizableUI.sys.mjs");

const PREF = "aether.toolbarLayout";
const LAYOUT = 2; // 2: the home button
const ORDER = ["back-button", "forward-button", "stop-reload-button", "home-button", "vertical-spacer", "urlbar-container",
  "aether-workspaces", "unified-extensions-button", "aether-split-view", "aether-compact-mode"];
const REMOVE = ["sidebar-button", "firefox-view-button", "alltabs-button"];

export function init() {
  if (Services.prefs.getIntPref(PREF, 0) >= LAYOUT) return;
  Services.prefs.setIntPref(PREF, LAYOUT);

  for (const id of REMOVE) {
    if (CustomizableUI.getPlacementOfWidget(id)) CustomizableUI.removeWidgetFromArea(id);
  }
  // Add-on buttons the toolbar already has (like uBlock Origin's) sit with the add-ons button.
  const addons = CustomizableUI.getWidgetIdsInArea(CustomizableUI.AREA_NAVBAR).filter(id => id.endsWith("-browser-action"));
  const order = ORDER.flatMap(id => id === "unified-extensions-button" ? [id, ...addons] : [id]);
  order.forEach((id, position) => CustomizableUI.addWidgetToArea(id, CustomizableUI.AREA_NAVBAR, position));
}

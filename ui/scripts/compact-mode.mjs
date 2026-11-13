// Compact mode: the sidebar (or, with top tabs, the toolbar) slides away so the page fills the
// window, and comes back, pushing the page aside, when the mouse reaches that edge or the address
// bar is focused. Toggled with Ctrl+Alt+C, its toolbar button, or "Compact Mode" in the sidebar
// and toolbar right-click menus; remembered in the aether.compactMode pref. The look is in aether.css.
//
// With tabs down the side, compact mode is the only way the sidebar hides: it's otherwise always
// there and expanded, with the address bar in it. Firefox's own sidebar button and Ctrl+Alt+Z,
// which would collapse it to icons or hide it (tabs and all), toggle compact mode instead, and
// its "Expand sidebar on hover" (in its Settings) turns compact mode on rather than running its
// own hover tracking, which fought this and made the sidebar flicker.

const { CustomizableUI } = ChromeUtils.importESModule("moz-src:///browser/components/customizableui/CustomizableUI.sys.mjs");

const PREF = "aether.compactMode";
const VERTICAL_TABS = "sidebar.verticalTabs";
const VISIBILITY = "sidebar.visibility";
const MENUS = ["toolbar-context-menu", "sidebar-context-menu"];
const WIDGET = "aether-compact-mode";

// A toolbar button too, so it's easy to find.
try {
  CustomizableUI.createWidget({
    id: WIDGET,
    label: "Compact Mode",
    tooltiptext: "Compact Mode: hide the sidebar until the mouse reaches the edge (Ctrl+Alt+C)",
    defaultArea: CustomizableUI.AREA_NAVBAR,
    overflows: false, // always visible, never tucked into the » menu
    onCreated(node) {
      node.setAttribute("overflows", "false");
    },
    onCommand() {
      Services.prefs.setBoolPref(PREF, !Services.prefs.getBoolPref(PREF, false));
    },
  });
} catch {
  // Already created this session.
}

export function init(win) {
  const doc = win.document;
  const root = doc.documentElement;

  // A thin strip along the edge that reveals the hidden bar when the mouse touches it.
  const edge = doc.createElement("div");
  edge.id = "aether-edge";
  doc.getElementById("browser").append(edge);

  let leaving = 0;
  const update = () => {
    const compact = Services.prefs.getBoolPref(PREF, false);
    // Switched on: the sidebar and toolbar leave at once, together (styles/aether.css,
    // [aether-leaving]), marked before they start so the usual pause can't take hold.
    if (compact && !root.hasAttribute("aether-compact")) {
      root.setAttribute("aether-leaving", "");
      win.clearTimeout(leaving);
      leaving = win.setTimeout(() => root.removeAttribute("aether-leaving"), 700);
    }
    root.toggleAttribute("aether-compact", compact);
    root.toggleAttribute("aether-vertical", Services.prefs.getBoolPref(VERTICAL_TABS, false));
    doc.getElementById(WIDGET)?.toggleAttribute("checked", Services.prefs.getBoolPref(PREF, false));
    keepSidebar();
    tuckToolsAway();
  };
  const toggle = () => Services.prefs.setBoolPref(PREF, !Services.prefs.getBoolPref(PREF, false));
  const vertical = () => Services.prefs.getBoolPref(VERTICAL_TABS, false);

  const sidebar = win.SidebarController;
  const firefoxToggle = sidebar.handleToolbarButtonClick;
  sidebar.handleToolbarButtonClick = function () {
    return vertical() ? toggle() : firefoxToggle.call(this);
  };

  const firefoxExpandOnHover = sidebar.toggleExpandOnHover;
  sidebar.toggleExpandOnHover = function (enabled, ...rest) {
    return firefoxExpandOnHover.call(this, enabled && !vertical(), ...rest);
  };

  const container = doc.getElementById("sidebar-container");
  const keepSidebar = () => {
    if (!vertical() || !sidebar._state) return;
    const visibility = Services.prefs.getStringPref(VISIBILITY, "always-show");
    if (visibility !== "always-show") {
      if (visibility === "expand-on-hover") Services.prefs.setBoolPref(PREF, true);
      Services.prefs.setStringPref(VISIBILITY, "always-show"); // Firefox then shows and expands it
    } else if (container.hidden || !container.hasAttribute("sidebar-launcher-expanded")) {
      sidebar._state.updateVisibility(true, true);
    }
  };
  // With top tabs Firefox keeps a strip of sidebar tools down the left; tuck it away (Ctrl+Alt+Z
  // brings it back), so the page gets the whole width under the toolbar.
  let wasVertical = null;
  const tuckToolsAway = () => {
    if (!vertical() && wasVertical !== false) win.setTimeout(() => sidebar._state?.updateVisibility(false), 300);
    wasVertical = vertical();
  };
  new win.MutationObserver(keepSidebar).observe(container, {
    attributes: true,
    attributeFilter: ["sidebar-launcher-expanded", "hidden"],
  });

  win.addEventListener("keydown", event => {
    if (event.ctrlKey && event.altKey && !event.shiftKey && !event.metaKey && event.code === "KeyC") {
      event.preventDefault();
      toggle();
    }
  }, true);

  for (const id of MENUS) {
    const menu = doc.getElementById(id);
    if (!menu) continue;
    const item = doc.createXULElement("menuitem");
    item.setAttribute("type", "checkbox");
    item.setAttribute("label", "Compact Mode");
    item.setAttribute("acceltext", "Ctrl+Alt+C");
    item.addEventListener("command", toggle);
    menu.prepend(item);
    menu.addEventListener("popupshowing", () => {
      item.setAttribute("checked", Services.prefs.getBoolPref(PREF, false));
    });
  }

  // Focusing the address bar shows it for a moment (styles/aether.css, [aether-just-focused]);
  // after that only typing or its suggestions keep the bars out.
  const urlbar = doc.getElementById("urlbar");
  let justFocused = 0;
  urlbar?.addEventListener("focus", () => {
    urlbar.setAttribute("aether-just-focused", "");
    win.clearTimeout(justFocused);
    justFocused = win.setTimeout(() => urlbar.removeAttribute("aether-just-focused"), 2500);
  }, true);

  // A menu opened from the sidebar or toolbar (a right-click, or the containers menu of "+") is a
  // window of its own, so using it takes the mouse off them: hold them out until it closes.
  const toolbox = doc.getElementById("navigator-toolbox");
  const inBars = node => {
    for (let n = node; n; n = n.parentNode ?? n.host) {
      if (n === container || n === toolbox) return true;
    }
    return false;
  };
  const held = new Set();
  const hold = () => root.toggleAttribute("aether-hold", held.size > 0);
  win.addEventListener("popupshown", event => {
    const popup = event.target;
    if (popup.localName === "menupopup" && inBars(popup.triggerNode ?? popup.anchorNode)) {
      held.add(popup);
      hold();
    }
  }, true);
  win.addEventListener("popuphidden", event => {
    if (held.delete(event.target)) hold();
  }, true);

  Services.prefs.addObserver(PREF, update);
  Services.prefs.addObserver(VERTICAL_TABS, update);
  win.addEventListener("unload", () => {
    Services.prefs.removeObserver(PREF, update);
    Services.prefs.removeObserver(VERTICAL_TABS, update);
  }, { once: true });
  update();
}

// Compact mode: the sidebar (or, with top tabs, the toolbar) slides away so the page fills the
// window, and comes back, pushing the page aside, when the mouse reaches that edge or the address
// bar is focused. Toggled with Ctrl+Alt+C, its toolbar button, or "Compact Mode" in the sidebar
// and toolbar right-click menus; remembered in the aether.compactMode pref. The look is in aether.css.
//
// With tabs down the side, compact mode is the only way the sidebar hides: it's otherwise always
// there and expanded, with the address bar in it. Firefox's own sidebar button and Ctrl+Alt+Z,
// which would collapse it to icons or hide it (tabs and all), toggle compact mode instead.

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

  const update = () => {
    root.toggleAttribute("aether-compact", Services.prefs.getBoolPref(PREF, false));
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

  const container = doc.getElementById("sidebar-container");
  const keepSidebar = () => {
    if (!vertical() || !sidebar._state) return;
    if (Services.prefs.getStringPref(VISIBILITY, "always-show") !== "always-show") {
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

  Services.prefs.addObserver(PREF, update);
  Services.prefs.addObserver(VERTICAL_TABS, update);
  win.addEventListener("unload", () => {
    Services.prefs.removeObserver(PREF, update);
    Services.prefs.removeObserver(VERTICAL_TABS, update);
  }, { once: true });
  update();
}

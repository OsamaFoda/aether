// Compact mode: the sidebar (or, with top tabs, the toolbar) slides away so the page fills the
// window, and springs back as floating glass when the mouse reaches that edge or the address
// bar is focused. Toggled with Ctrl+Alt+C or "Compact Mode" in the sidebar and toolbar
// right-click menus; remembered in the aether.compactMode pref. The look is in aether.css.

const PREF = "aether.compactMode";
const VERTICAL_TABS = "sidebar.verticalTabs";
const MENUS = ["toolbar-context-menu", "sidebar-context-menu"];

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
  };
  const toggle = () => Services.prefs.setBoolPref(PREF, !Services.prefs.getBoolPref(PREF, false));

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
